"""Command line: `mhdebt --help`.

Typical first run (Arizona):
  mhdebt ingest hifld
  mhdebt ingest parcels --county maricopa
  mhdebt ingest parcels --county pima
  mhdebt ingest cmbs
  mhdebt ingest agency --agency fannie --file data/agency/fannie/dus_mhc.csv
  mhdebt ingest sba --file data/sba/foia-7a-fy2010-present.csv
  mhdebt ingest recorder --county maricopa
  mhdebt build
  mhdebt extract --limit 50
  mhdebt model

Nightly: `mhdebt run` does everything that needs no manual download.
"""
from __future__ import annotations

import json
import logging
from datetime import date
from pathlib import Path

import typer

from . import db, jobs
from .config import settings
from .http import PoliteClient
from .rates import RateCurve

app = typer.Typer(no_args_is_help=True, help="Debt maturity intelligence for mobile home and RV parks.")
ingest = typer.Typer(no_args_is_help=True, help="Load a data source.")
probe = typer.Typer(no_args_is_help=True, help="Check a live data source and print what it returns.")
app.add_typer(ingest, name="ingest")
app.add_typer(probe, name="probe")

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")


def _out(stats: dict) -> None:
    typer.echo(json.dumps(stats, default=str, indent=2))


def _states(states: str | None) -> list[str]:
    return [s.strip().upper() for s in states.split(",")] if states else settings.target_states


@ingest.command("hifld")
def ingest_hifld(states: str = typer.Option(None, help="Comma-separated, default TARGET_STATES"),
                 geojson: Path = typer.Option(None, help="Use a downloaded DataLumos GeoJSON instead of the live mirror")):
    with db.connect() as conn:
        _out(jobs.ingest_hifld(conn, PoliteClient(), _states(states), geojson))


@ingest.command("parcels")
def ingest_parcels(county: str = typer.Option(..., help="maricopa | pima")):
    with db.connect() as conn:
        _out(jobs.ingest_parcels(conn, PoliteClient(), county.lower()))


@ingest.command("cmbs")
def ingest_cmbs(states: str = typer.Option(None)):
    with db.connect() as conn:
        _out(jobs.ingest_cmbs(conn, PoliteClient(), _states(states)))


@ingest.command("agency")
def ingest_agency(agency: str = typer.Option(..., help="fannie | freddie"), file: Path = typer.Option(...),
                  states: str = typer.Option(None)):
    with db.connect() as conn:
        _out(jobs.ingest_agency_file(conn, file, agency.lower(), _states(states)))


@ingest.command("sba")
def ingest_sba(file: Path = typer.Option(...), states: str = typer.Option(None)):
    with db.connect() as conn:
        _out(jobs.ingest_sba_file(conn, file, _states(states)))


@ingest.command("recorder")
def ingest_recorder(county: str = typer.Option("maricopa")):
    if county.lower() != "maricopa":
        raise typer.BadParameter("Only Maricopa has an API; use `ingest recorder-export` for other counties.")
    with db.connect() as conn:
        _out(jobs.ingest_recorder_maricopa(conn, PoliteClient()))


@ingest.command("recorder-export")
def ingest_recorder_export(county: str = typer.Option(...), file: Path = typer.Option(...)):
    with db.connect() as conn:
        _out(jobs.ingest_recorder_export(conn, file, county.lower()))


@app.command()
def build():
    """Match published loans to parks, turn recorded documents into loans, classify lenders, geocode."""
    client = PoliteClient()
    with db.connect() as conn:
        _out(jobs.match_loans(conn, settings.target_states))
        _out(jobs.build_county_loans(conn))
        _out(jobs.classify_lenders(conn, client))
        _out(jobs.geocode_parks(conn, client))


@app.command()
def extract(limit: int = typer.Option(None, help="Max documents this run (default MAX_DOCS_PER_RUN)")):
    """Read pending loan documents with Claude."""
    import anthropic

    if not settings.anthropic_api_key:
        raise typer.BadParameter("ANTHROPIC_API_KEY is not set")
    with db.connect() as conn:
        _out(jobs.extract_documents(conn, PoliteClient(), anthropic.Anthropic(api_key=settings.anthropic_api_key),
                                    limit))
        _out(jobs.build_county_loans(conn))


@app.command()
def model(today: str = typer.Option(None, help="YYYY-MM-DD, for backtesting")):
    """Estimate maturities and score every park."""
    d = date.fromisoformat(today) if today else date.today()
    with db.connect() as conn:
        _out(jobs.estimate_maturities(conn, d))
        _out(jobs.score_parks(conn, RateCurve.load(PoliteClient()), d))


@app.command()
def run(skip_extract: bool = False):
    """Nightly: refresh every automatic source, then rebuild and rescore."""
    client = PoliteClient()
    states = settings.target_states
    with db.connect() as conn:
        for step in (lambda: jobs.ingest_hifld(conn, client, states),
                     lambda: jobs.ingest_parcels(conn, client, "maricopa") if "AZ" in states else {},
                     lambda: jobs.ingest_parcels(conn, client, "pima") if "AZ" in states else {},
                     lambda: jobs.ingest_cmbs(conn, client, states),
                     lambda: jobs.ingest_recorder_maricopa(conn, client) if "AZ" in states else {}):
            try:
                _out(step())
            except Exception as exc:  # noqa: BLE001 - keep going; the run log records the failure
                logging.exception("step failed: %s", exc)
    build()
    if not skip_extract and settings.anthropic_api_key:
        extract(limit=None)
    model(today=None)


@app.command()
def top(n: int = 25, state: str = "AZ"):
    """Print the highest-scoring parks."""
    with db.connect() as conn:
        rows = conn.execute("""select name, city, units, score, lender_name, lender_kind, maturity_date, maturity_basis,
                                      owner_name, owner_state
                               from park_overview where state=%s and score is not null
                               order by score desc limit %s""", (state, n)).fetchall()
    for r in rows:
        typer.echo(f"{r['score']:>5}  {r['name'][:34]:34} {(r['city'] or '')[:14]:14} {str(r['units'] or ''):>4}  "
                   f"{str(r['maturity_date'] or ''):10} {r['maturity_basis'] or '':9} {(r['lender_name'] or '')[:28]:28} "
                   f"{(r['owner_name'] or '')[:28]} ({r['owner_state'] or ''})")


# ---------------------------------------------------------------------------
# Probes: run these first against live sources to confirm field names.
# ---------------------------------------------------------------------------

@probe.command("maricopa")
def probe_maricopa(recording_number: str = typer.Argument("20240443284")):
    from .sources import arcgis, maricopa

    c = PoliteClient()
    typer.echo("Parcel layer, distinct park PUC codes:")
    typer.echo(arcgis.distinct(c, maricopa.PARCELS, "PUC", maricopa.PARK_WHERE))
    typer.echo(f"\nRecorder document {recording_number}:")
    r = c.get(f"{maricopa.RECORDER}/documents/{recording_number}")
    typer.echo(json.dumps(r.json(), indent=2)[:3000])
    typer.echo("\nParsed as:")
    _out(maricopa._doc_from_json(recording_number, r.json()))


@probe.command("pima")
def probe_pima():
    from .sources import arcgis, pima

    c = PoliteClient()
    vals = arcgis.distinct(c, pima.PARCELS, "PARCEL_USE")
    typer.echo(f"{len(vals)} distinct PARCEL_USE values; those starting 08:")
    typer.echo([v for v in vals if str(v).startswith("08")])


@probe.command("fdic")
def probe_fdic():
    from .sources import fdic

    fdic.probe_fields(PoliteClient())


@probe.command("cmbs")
def probe_cmbs(limit: int = 3):
    from .sources import edgar_cmbs

    c = PoliteClient()
    fs = edgar_cmbs.latest_cmbs_filings(c)
    typer.echo(f"{len(fs)} candidate trusts. Checking {limit}:")
    for f in fs[:limit]:
        loans = edgar_cmbs.fetch_park_loans(c, f, None)
        if loans is None:
            typer.echo(f"  {f.company} {f.filed}: no CMBS asset file")
        else:
            typer.echo(f"  {f.company} {f.filed}: {len(loans)} park loans")


if __name__ == "__main__":
    app()
