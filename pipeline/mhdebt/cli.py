"""Command line: `mhdebt --help`.

Typical first run (Arizona):
  mhdebt ingest hifld
  mhdebt ingest parcels --county maricopa
  mhdebt ingest parcels --county pima
  mhdebt ingest cmbs
  mhdebt ingest agency --agency fannie --file data/agency/fannie/dus_mhc.csv
  mhdebt ingest sba                       # downloads the public FOIA CSVs, then loads them
  mhdebt ingest recorder --county maricopa
  mhdebt ingest operating --file data/operating/rents.csv --source <vendor>   # rent, sites, vacancy
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
def ingest_sba(file: Path = typer.Option(None, help="One FOIA CSV already on disk. Omit to download the public files."),
               states: str = typer.Option(None),
               since_fy: int = typer.Option(2010, help="Skip snapshots that end before this fiscal year")):
    prepared = jobs.prepare_sba(PoliteClient(), _states(states), since_fy, file)
    with db.connect() as conn:
        _out(jobs.ingest_sba_prepared(conn, prepared))


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


@ingest.command("operating")
def ingest_operating(file: Path = typer.Option(..., help="CSV or XLSX, one row per community"),
                     source: str = typer.Option("csv", help="Who the figures come from, e.g. the data vendor"),
                     as_of: str = typer.Option(None, help="YYYY-MM-DD for rows without an as-of column; default today"),
                     states: str = typer.Option(None)):
    """Load rent, site count and vacancy per park. Takes effect on the next `mhdebt model`."""
    when = date.fromisoformat(as_of) if as_of else None
    with db.connect() as conn:
        _out(jobs.ingest_operating_file(conn, file, source.strip().lower(), _states(states), when))


# The function is not named jobs: that name is the ingest module, and a function
# with the same name hides it from `mhdebt run`.
@app.command("jobs")
def run_jobs(limit: int = typer.Option(10, help="How many due jobs to run")):
    """Run due background jobs. Unknown kinds cannot be queued. Failures retry, then stop."""
    from . import workqueue
    with db.connect() as conn:
        _out(workqueue.process_due(conn, limit))


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
    curve = RateCurve.load(PoliteClient())
    with db.connect() as conn:
        curve.spreads = jobs.spread_map(conn)
        _out(jobs.estimate_maturities(conn, d))
        _out(jobs.score_parks(conn, curve, d))


@app.command()
def rates():
    """Download Treasury, prime, Baa, and SOFR, then measure spreads on loans already loaded."""
    prints = jobs.fetch_prints(PoliteClient())
    with db.connect() as conn:
        _out(jobs.store_rate_prints(conn, prints))
        _out(jobs.measure_spreads(conn))


@app.command("holdout")
def holdout():
    """Compare the term prior with maturities the filings already stated."""
    with db.connect() as conn:
        _out(jobs.maturity_holdout(conn))


@ingest.command("distress")
def ingest_distress(days: int = 14, limit: int = 80):
    """Maricopa trustee-sale and lis pendens notices, by document code. Names come from the document, not the search row."""
    docs = jobs.prepare_distress(PoliteClient(), days=days, limit=limit)
    with db.connect() as conn:
        _out(jobs.ingest_distress_prepared(conn, docs))


@ingest.command("flood")
def ingest_flood(limit: int = 100):
    """FEMA flood zone for parks that do not have one yet."""
    client = PoliteClient()
    with db.connect() as conn:
        parks = jobs.parks_missing_flood(conn, limit)
    rows = jobs.prepare_flood(client, parks)
    with db.connect() as conn:
        _out(jobs.store_flood(conn, rows))


@ingest.command("water")
def ingest_water(state: str = "AZ"):
    """EPA drinking-water systems. A system is linked only when one park name is clearly the best match."""
    systems = jobs.prepare_water(PoliteClient(), state)
    with db.connect() as conn:
        _out(jobs.ingest_water_prepared(conn, systems, state))


@app.command()
def run(skip_extract: bool = False):
    """Nightly: refresh every automatic source, then rebuild and rescore."""
    if not settings.database_url:
        raise typer.BadParameter("DATABASE_URL is not set")
    client = PoliteClient()
    states = settings.target_states
    try:
        sba_rows = jobs.prepare_sba(client, states)
    except Exception as exc:  # noqa: BLE001 - a FOIA outage should not skip the other sources
        logging.exception("sba download failed: %s", exc)
        sba_rows = []
    try:
        prints = jobs.fetch_prints(client)
    except Exception as exc:  # noqa: BLE001
        logging.exception("rate download failed: %s", exc)
        prints = []
    try:
        distress = jobs.prepare_distress(client) if "AZ" in states else []
    except Exception as exc:  # noqa: BLE001
        logging.exception("distress download failed: %s", exc)
        distress = []
    try:
        water = jobs.prepare_water(client, "AZ") if "AZ" in states else []
    except Exception as exc:  # noqa: BLE001
        logging.exception("water download failed: %s", exc)
        water = []
    try:
        hud_rows = jobs.prepare_hud(client)
    except Exception as exc:  # noqa: BLE001
        logging.exception("hud download failed: %s", exc)
        hud_rows = []
    try:
        offerings = jobs.prepare_form_d(client)
    except Exception as exc:  # noqa: BLE001
        logging.exception("form d download failed: %s", exc)
        offerings = []
    try:
        filings = jobs.prepare_edgar(client)
    except Exception as exc:  # noqa: BLE001
        logging.exception("edgar search failed: %s", exc)
        filings = []
    try:
        headlines = jobs.prepare_news(client)
    except Exception as exc:  # noqa: BLE001
        logging.exception("news download failed: %s", exc)
        headlines = []
    with db.connect() as conn:
        for step in (lambda: jobs.ingest_hifld(conn, client, states),
                     lambda: jobs.ingest_parcels(conn, client, "maricopa") if "AZ" in states else {},
                     lambda: jobs.ingest_parcels(conn, client, "pima") if "AZ" in states else {},
                     lambda: jobs.ingest_cmbs(conn, client, states),
                     lambda: jobs.ingest_sba_prepared(conn, sba_rows),
                     lambda: jobs.ingest_recorder_maricopa(conn, client) if "AZ" in states else {},
                     lambda: jobs.store_rate_prints(conn, prints) if prints else {},
                     lambda: jobs.measure_spreads(conn) if prints else {},
                     lambda: jobs.ingest_distress_prepared(conn, distress) if distress else {},
                     lambda: jobs.ingest_water_prepared(conn, water, "AZ") if water else {},
                     lambda: jobs.ingest_hud_prepared(conn, hud_rows) if hud_rows else {},
                     lambda: jobs.ingest_offerings_prepared(conn, offerings) if offerings else {},
                     lambda: jobs.ingest_filings_prepared(conn, filings, "edgar_efts") if filings else {},
                     lambda: jobs.ingest_filings_prepared(conn, headlines, "google_news") if headlines else {},
                     lambda: jobs.ingest_exhibits(conn, client),
                     lambda: jobs.ingest_8k_exhibits(conn, client),
                     lambda: jobs.refresh_signals(conn) if "AZ" in states else {}):
            try:
                _out(step())
            except Exception as exc:  # noqa: BLE001 - keep going; the run log records the failure
                logging.exception("step failed: %s", exc)
    build()
    try:
        with db.connect() as conn:
            pending = jobs.parks_missing_flood(conn, 100)
        if pending:
            zones = jobs.prepare_flood(client, pending)
            with db.connect() as conn:
                _out(jobs.store_flood(conn, zones))
    except Exception as exc:  # noqa: BLE001
        logging.exception("flood step failed: %s", exc)
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


@probe.command("sba")
def probe_sba(since_fy: int = 2010):
    from .sources import sba

    html = PoliteClient().get(sba.DATASET_PAGE, cache_ttl=24 * 3600).text
    urls = sba.foia_csv_urls(html, since_fy)
    typer.echo(f"{len(urls)} FOIA CSVs covering FY{since_fy} or later:")
    for url in urls:
        typer.echo(f"  {url}")


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


@probe.command("epa")
def probe_epa():
    from .sources import epa

    rows = epa.fetch_systems(PoliteClient(), "AZ")
    typer.echo(f"{len(rows)} active Arizona water systems. First: {rows[0] if rows else None}")


@probe.command("sofr")
def probe_sofr():
    from .rates import SOFR_URL, parse_sofr

    text = PoliteClient().get(SOFR_URL, params={"startDate": "10/01/2026", "endDate": "10/28/2026"}).text
    rows = parse_sofr(text)
    typer.echo(f"{len(rows)} SOFR prints in the sample window. Latest: {rows[0] if rows else None}")


@probe.command("sofrai")
def probe_sofrai():
    from .rates import SOFRAI_URL, parse_sofrai

    payload = PoliteClient().get(SOFRAI_URL, params={"startDate": "2026-10-27", "endDate": "2026-10-30"}).json()
    rows = parse_sofrai(payload)
    typer.echo(f"{len(rows)} average prints. Latest day: {[r for r in rows if r[1] == max(x[1] for x in rows)]}")


@probe.command("treasury")
def probe_treasury(year: int = 2026):
    from .rates import TREASURY_CURVE_URL, parse_treasury_curve

    xml = PoliteClient().get(TREASURY_CURVE_URL.format(year=year)).content
    rows = parse_treasury_curve(xml)
    latest = max((d for _, d, _ in rows), default=None)
    typer.echo(f"{len(rows)} tenor-day prints in {year}. Latest {latest}:")
    for series, d, value in rows:
        if d == latest and series in ("TSY_5Y", "TSY_7Y", "TSY_10Y", "TSY_30Y"):
            typer.echo(f"  {series} {value}")


@probe.command("fred")
def probe_fred(series: str = "DGS10"):
    from .rates import parse_fred

    text = PoliteClient().get(f"https://fred.stlouisfed.org/graph/fredgraph.csv?id={series}").text
    rows = parse_fred(text, series)
    typer.echo(f"{series}: {len(rows)} prints. Latest: {rows[-1] if rows else None}")


@probe.command("fema")
def probe_fema(lon: float = -112.07, lat: float = 33.45):
    from .sources import fema

    zone = fema.flood_zone(PoliteClient(), lon, lat)
    typer.echo(f"Flood zone at {lat}, {lon}: {zone or 'none'}")


@probe.command("distress")
def probe_distress(code: str = "NS"):
    from .sources import maricopa

    rows = maricopa.Recorder(PoliteClient()).search_by_code(code, date(2026, 10, 1), date(2026, 10, 15), page_size=2)
    typer.echo(f"{len(rows)} rows. First: {rows[0] if rows else None}")


@ingest.command("hud")
def ingest_hud():
    """FHA mortgages whose section-of-act category contains 'mobile home'."""
    rows = jobs.prepare_hud(PoliteClient())
    with db.connect() as conn:
        _out(jobs.ingest_hud_prepared(conn, rows))


@ingest.command("form-d")
def ingest_form_d():
    """Latest Form D quarter, kept only when the issuer name is a park."""
    rows = jobs.prepare_form_d(PoliteClient())
    with db.connect() as conn:
        _out(jobs.ingest_offerings_prepared(conn, rows))


@ingest.command("edgar")
def ingest_edgar():
    """One page of EDGAR search hits for the fixed park queries. Filing text is not downloaded."""
    rows = jobs.prepare_edgar(PoliteClient())
    with db.connect() as conn:
        _out(jobs.ingest_filings_prepared(conn, rows, "edgar_efts"))


@ingest.command("news")
def ingest_news():
    """Google News RSS headlines. Article pages are not fetched."""
    rows = jobs.prepare_news(PoliteClient())
    with db.connect() as conn:
        _out(jobs.ingest_filings_prepared(conn, rows, "google_news"))


@ingest.command("exhibits")
def ingest_exhibits(limit: int = 8):
    """EX-99 links from the next ABS-EE indexes and from 8-Ks already in the search hits."""
    client = PoliteClient()
    with db.connect() as conn:
        _out(jobs.ingest_exhibits(conn, client, limit))
        _out(jobs.ingest_8k_exhibits(conn, client, limit))


@ingest.command("signals")
def ingest_signals():
    """Rebuild distress, assessor sales, and recorded owners from rows already stored."""
    with db.connect() as conn:
        _out(jobs.refresh_signals(conn))


@probe.command("hud")
def probe_hud():
    from .sources import hud_fha

    rows = jobs.prepare_hud(PoliteClient())
    az = [r for r in rows if (r.get("property_state_raw") or "").upper() == "AZ"]
    typer.echo(f"{len(rows)} mobile-home rows ({sum(1 for r in rows if r.get('status') == 'active')} active). Arizona: {len(az)}")
    sample = (az or rows)[:3]
    for row in sample:
        typer.echo(f"  {row.get('property_name_raw')}  {row.get('property_state_raw')}  "
                   f"{(row.get('raw') or {}).get('soa')}  maturity {row.get('maturity_date')}")
    typer.echo(f"Active workbook: {hud_fha.ACTIVE_URL}")


@probe.command("form-d")
def probe_form_d():
    from .sources import form_d

    client = PoliteClient()
    url = form_d.latest_zip_url(client.get(form_d.PAGE_URL).text)
    typer.echo(f"latest zip: {url}")
    rows = jobs.prepare_form_d(client)
    typer.echo(f"{len(rows)} park issuers")
    for row in rows[:8]:
        typer.echo(f"  {row['filed_on']}  {row['state']}  {row['issuer_name']}")


@probe.command("edgar")
def probe_edgar():
    from .sources import edgar_search

    payload = PoliteClient().get(
        edgar_search.EFTS_URL, params=edgar_search.search_params(edgar_search.QUERIES[0]) | {"size": 2},
    ).json()
    hits = edgar_search.parse_hits(payload)
    total = ((payload.get("hits") or {}).get("total") or {}).get("value")
    typer.echo(f"total reported {total}; parsed {len(hits)}")
    for hit in hits:
        typer.echo(f"  {hit['filed_on']}  {hit['form']}  {hit['title']}")
        typer.echo(f"    {hit['url']}")


@probe.command("news")
def probe_news():
    rows = jobs.prepare_news(PoliteClient())
    typer.echo(f"{len(rows)} headlines")
    for row in rows[:5]:
        typer.echo(f"  {row['filed_on']}  {row['title']}")


@probe.command("pinal")
def probe_pinal():
    """The Casa Grande mirror of Pinal parcels. A Mobile filter returned no rows on 2026-10-30."""
    url = ("https://rogue.casagrandeaz.gov/arcgis/rest/services/Pinal_County/"
           "Pinal_County_Parcels/MapServer/0/query")
    data = PoliteClient().get(url, params={
        "where": "Assessing_Use_Description LIKE '%Mobile%'",
        "outFields": "Assessing_Use_Code,Assessing_Use_Description",
        "returnGeometry": "false", "resultRecordCount": 5, "f": "json",
    }).json()
    feats = data.get("features") or []
    typer.echo(f"{len(feats)} features for Assessing_Use_Description LIKE '%Mobile%'")
    if data.get("error"):
        typer.echo(data["error"])
    typer.echo("No park use code was identified, so Pinal parcels are not loaded.")


@probe.command("azgeo")
def probe_azgeo():
    """State parcel layer. The probed fields are APN, address, and place name."""
    url = ("https://azgeo.az.gov/arcgis/rest/services/TerraSystems/AZParcelFeatures/FeatureServer/0/query")
    data = PoliteClient().get(url, params={
        "where": "1=1", "outFields": "*", "returnGeometry": "false", "resultRecordCount": 1, "f": "json",
    }).json()
    feats = data.get("features") or []
    keys = sorted((feats[0].get("attributes") or {}).keys()) if feats else []
    typer.echo(f"fields: {keys or data.get('error')}")
    typer.echo("No owner and no use code, so the layer is not loaded.")


if __name__ == "__main__":
    app()
