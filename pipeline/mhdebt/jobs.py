"""Pipeline jobs. Each job is idempotent and safe to re-run; `run_all` executes them in order.

  parks:     ingest_hifld -> ingest_parcels (county) -> geocode_parks
  loans:     ingest_cmbs, ingest_agency_file, ingest_sba -> match_loans
  county:    ingest_recorder (Maricopa API) / ingest_recorder_export (Pima) -> build_county_loans
  enrich:    classify_lenders (FDIC) -> extract_documents (Claude)
  model:     estimate_maturities -> score_parks (+ alerts)
  operating: ingest_operating_file (rent, sites, vacancy per park; also entered by brokers on the park page)
"""
from __future__ import annotations

import logging
from datetime import date, timedelta
from pathlib import Path

from . import db, geocode, maturity, operating
from .config import settings
from .docai import extract, trustworthy_maturity
from .http import PoliteClient
from .lenders import LenderClassifier, is_title_company, strip_descriptors
from .match import Candidate, Probe, best_match, nearest, similarity
from .normalize import nice_title, norm_entity
from .rates import RateCurve
from .scoring import LoanFacts, ParkFacts, score
from .sources import agency, edgar_cmbs, fdic, hifld, maricopa, pima, sba
from .sources.doc_types import CURE_TYPES, DISTRESS_TYPES, LOAN_TYPES

log = logging.getLogger("mhdebt")


def _candidates(conn, states: list[str]) -> list[Candidate]:
    rows = conn.execute(
        "select id, name, address, city, zip, lat, lon from parks where state = any(%s)", (states,)
    ).fetchall()
    return [Candidate(str(r["id"]), r["name"], r["address"], r["city"], r["zip"], r["lat"], r["lon"]) for r in rows]


# ---------------------------------------------------------------------------
# Parks
# ---------------------------------------------------------------------------

def ingest_hifld(conn, client: PoliteClient, states: list[str], geojson: Path | None = None) -> dict:
    """Load the federal park list.

    A park already in the database within 150 meters, with an address that does not contradict the
    federal record, keeps its loans and owner and picks up the federal name, phone and site count.
    """
    with db.source_run(conn, "hifld") as stats:
        rows = list(hifld.load_geojson(geojson, states) if geojson else hifld.fetch(client, states))
        cands = _candidates(conn, states)
        claimed: set[str] = set()
        linked = created = 0
        for i, rec in enumerate(rows, start=1):
            existing = conn.execute(
                "select id from parks where sources->>'hifld' = %s", (rec["source_id"],)
            ).fetchone()
            if existing:
                db.upsert_park_by_source(conn, "hifld", rec["source_id"], rec)
            else:
                park_id = _attach_hifld(conn, rec, cands, claimed)
                if park_id:
                    linked += 1
                    claimed.add(park_id)
                else:
                    park_id = db.upsert_park_by_source(conn, "hifld", rec["source_id"], rec)
                    created += 1
                    claimed.add(park_id)
                    cands.append(Candidate(
                        park_id, rec.get("name"), rec.get("address"), rec.get("city"),
                        rec.get("zip"), _num(rec.get("lat")), _num(rec.get("lon")),
                    ))
            if i % 200 == 0:
                conn.commit()
        conn.commit()
        stats["parks"] = len(rows)
        stats["linked"] = linked
        stats["created"] = created
    return stats


def _num(v) -> float | None:
    try:
        return float(v) if v is not None and v != "" else None
    except (TypeError, ValueError):
        return None


def _attach_hifld(conn, rec: dict, cands: list[Candidate], claimed: set[str]) -> str | None:
    lat, lon = _num(rec.get("lat")), _num(rec.get("lon"))
    if lat is None or lon is None:
        return None
    probe = Probe(rec.get("name"), rec.get("address"), rec.get("city"), rec.get("zip"), lat, lon)
    near = nearest(lat, lon, cands, within_m=150)
    if near is None or near.id in claimed:
        return None
    if near.address and rec.get("address") and similarity(probe, near) < 0.5:
        return None
    taken = conn.execute("select sources->>'hifld' as hifld from parks where id = %s", (near.id,)).fetchone()
    if taken and taken["hifld"]:
        return None
    db.add_park_source(conn, near.id, "hifld", rec["source_id"])
    db.upsert_park_by_source(conn, "hifld", rec["source_id"], rec)
    return near.id


def ingest_parcels(conn, client: PoliteClient, county: str, rows=None) -> dict:
    """Load park parcels, attach each to a known park (or create one), and set the owner of record."""
    fetcher = {"maricopa": maricopa.park_parcels, "pima": pima.park_parcels}[county]
    with db.source_run(conn, f"{county}_parcels") as stats:
        cands = _candidates(conn, ["AZ"])
        linked = created = 0
        for p in rows if rows is not None else fetcher(client):
            park_id = None
            existing = conn.execute("select park_id from parcels where county=%s and apn=%s",
                                    (county, p["apn"])).fetchone()
            if existing and existing["park_id"]:
                park_id = str(existing["park_id"])
            if not park_id and p.get("lat") and p.get("lon"):
                probe = Probe(p.get("subdivision"), p.get("situs_address"), p.get("situs_city"), p.get("situs_zip"),
                              p["lat"], p["lon"])
                # Accept a park sitting practically on the parcel unless its address contradicts the parcel's;
                # otherwise require a name/address/distance match.
                c = nearest(p["lat"], p["lon"], cands, within_m=150)
                if c and c.address and p.get("situs_address") and similarity(probe, c) < 0.5:
                    c = None
                if c is None:
                    c, _ = best_match(probe, cands)
                if c:
                    park_id, linked = c.id, linked + 1
            if not park_id:
                # Parks the federal list missed: create one from the parcel.
                name = p.get("subdivision") or (f"Park at {p['situs_address']}" if p.get("situs_address")
                                                else f"{county.title()} parcel {p['apn']}")
                park_id = db.upsert_park_by_source(conn, f"{county}_assessor", p["apn"], {
                    "name": nice_title(name), "address": nice_title(p.get("situs_address")),
                    "city": nice_title(p.get("situs_city")), "state": "AZ", "zip": p.get("situs_zip"),
                    "county": county.title(), "lat": p.get("lat"), "lon": p.get("lon"),
                    "kind": p.get("land_use_desc") or "unknown"})
                cands.append(Candidate(park_id, name, p.get("situs_address"), p.get("situs_city"), p.get("situs_zip"),
                                       p.get("lat"), p.get("lon")))
                created += 1
            else:
                db.add_park_source(conn, park_id, f"{county}_assessor", p["apn"])
            p["park_id"] = park_id
            db.upsert_parcel(conn, p)
            owner_id = db.upsert_owner(conn, p.get("owner_name") or "", mailing=p.get("owner_mailing"),
                                       city=p.get("owner_city"), state=p.get("owner_state"), zip_=p.get("owner_zip"))
            if owner_id:
                conn.execute("update parks set owner_id = %s, county = coalesce(county, %s) where id = %s",
                             (owner_id, county.title(), park_id))
        conn.execute("""update owners o set park_count = (select count(*) from parks p where p.owner_id = o.id)""")
        conn.commit()
        stats.update(linked=linked, created=created)
    return stats


def geocode_parks(conn, client: PoliteClient) -> dict:
    with db.source_run(conn, "geocode") as stats:
        rows = conn.execute("""select id, address, city, state, zip from parks
                               where (lat is null or lon is null) and address is not null""").fetchall()
        hits = geocode.batch(client, [(str(r["id"]), r["address"], r["city"] or "", r["state"], r["zip"] or "")
                                      for r in rows]) if rows else {}
        for pid, (lat, lon) in hits.items():
            conn.execute("update parks set lat=%s, lon=%s where id=%s", (lat, lon, pid))
        conn.commit()
        stats.update(requested=len(rows), matched=len(hits))
    return stats


# ---------------------------------------------------------------------------
# Published loans: CMBS, agency, SBA
# ---------------------------------------------------------------------------

def _loan_with_lender(conn, rec: dict, lender_name: str | None, kind: str) -> dict:
    if lender_name:
        rec["lender_id"] = db.upsert_lender(conn, lender_name, kind)
        rec["lender_name_raw"] = lender_name
    return rec


def ingest_cmbs(conn, client: PoliteClient, states: list[str], today: date | None = None) -> dict:
    with db.source_run(conn, "cmbs") as stats:
        state = db.get_state(conn, "cmbs")
        seen: dict = state.get("seen", {})
        filings = edgar_cmbs.latest_cmbs_filings(client, today=today)
        stats["filings"], n_loans = len(filings), 0
        paid_off = 0
        active_ciks = {f.cik for f in filings}
        for f in filings:
            if seen.get(f.cik) == f.accession:
                continue  # already processed this month's report for this trust
            try:
                loans = edgar_cmbs.fetch_park_loans(client, f, states)
            except Exception as exc:  # noqa: BLE001 - one bad filing shouldn't stop the run
                log.warning("cmbs %s failed: %s", f.company, exc)
                continue
            if loans is None:
                seen[f.cik] = f.accession
                continue
            ids = []
            for ln in loans:
                n_loans += upsert_cmbs_loan(conn, ln)
                ids += [f"{ln.trust_cik}:{ln.asset_number}:{i}" for i in range(len(ln.properties))]
            # Loans that dropped out of this month's report were paid off or liquidated.
            paid_off += conn.execute("""update loans set status='paid_off', updated_at=now()
                                        where source='cmbs' and raw->>'trust_cik' = %s and status='active'
                                          and not (source_loan_id = any(%s))""", (f.cik, ids)).rowcount
            seen[f.cik] = f.accession
            db.set_state(conn, "cmbs", {"seen": seen})
            conn.commit()
        # Trusts that stopped filing have paid off or been collapsed.
        gone = [c for c in seen if c not in active_ciks]
        if gone:
            paid_off += conn.execute("""update loans set status='paid_off' where source='cmbs' and status='active'
                                        and raw->>'trust_cik' = any(%s)""", (gone,)).rowcount
            for c in gone:
                seen.pop(c, None)
            db.set_state(conn, "cmbs", {"seen": seen})
            conn.commit()
        stats.update(park_loans=n_loans, paid_off=paid_off)
    return stats


def upsert_cmbs_loan(conn, ln: edgar_cmbs.CmbsLoan) -> int:
    """One loan row per park property. Portfolio loans are split across properties by unit count
    (equal shares if units are missing), so each park carries only its share of the debt."""
    n = 0
    for i, p in enumerate(ln.properties):
        share = p.share
        alloc = lambda v: round(v * share, 2) if v is not None else None  # noqa: E731
        rec = {
            "original_amount": alloc(ln.original_amount), "current_balance": alloc(ln.current_balance),
            "origination_date": ln.origination_date, "maturity_date": ln.maturity_date,
            "maturity_basis": "reported" if ln.maturity_date else "unknown",
            "note_rate": ln.current_rate or ln.original_rate, "term_months": ln.term_months,
            "amort_months": ln.amort_months, "interest_only": ln.interest_only, "balloon": ln.balloon,
            "dscr_current": p.dscr_noi_current, "noi_current": p.noi_current, "occupancy_current": p.occupancy,
            "payment_status": ln.payment_status,
            "property_name_raw": p.name, "property_address_raw": p.address, "property_city_raw": p.city,
            "property_state_raw": p.state, "property_zip_raw": p.zip,
            "raw": {"trust": ln.trust_name, "trust_cik": ln.trust_cik, "asset": ln.asset_number,
                    "originator": ln.originator, "servicer": ln.servicer, "units": p.units, "county": p.county,
                    "type_code": p.type_code, "park_properties_in_loan": len(ln.properties),
                    "allocation_share": round(share, 4), "loan_original_amount": ln.original_amount,
                    "loan_current_balance": ln.current_balance,
                    "modified": ln.modified, "period_end": ln.reporting_period_end},
        }
        _loan_with_lender(conn, rec, ln.trust_name, "cmbs_trust")
        db.upsert_loan(conn, "cmbs", f"{ln.trust_cik}:{ln.asset_number}:{i}", rec)
        n += 1
    return n


def ingest_agency_file(conn, path: Path, agency_name: str, states: list[str]) -> dict:
    with db.source_run(conn, f"{agency_name}_file") as stats:
        n = 0
        kind = "agency_fannie" if agency_name == "fannie" else "agency_freddie"
        for rec in agency.load(path, agency_name, states):
            # The servicer named in the file is the DUS/Optigo lender; the credit risk sits with the agency.
            rec["raw"]["seller_servicer"] = rec.get("lender_name_raw")
            _loan_with_lender(conn, rec, "Fannie Mae" if agency_name == "fannie" else "Freddie Mac", kind)
            db.upsert_loan(conn, agency_name, rec["source_loan_id"], rec)
            n += 1
        conn.commit()
        stats["loans"] = n
    return stats


def prepare_sba(client: PoliteClient, states: list[str], since_fy: int = 2010,
                file: Path | None = None) -> list[tuple[Path, list[dict]]]:
    """Download (unless `file` is set) and parse FOIA rows before a database connection is opened.

    The CSVs are a few hundred megabytes. Parsing them while a Supabase session sits idle gets the
    connection closed, so the caller should connect only after this returns."""
    paths = [file] if file else sba.download_foia(client, settings.data_dir / "sba", since_fy)
    prepared = []
    for path in paths:
        rows = list(sba.load(path, states))
        log.info("sba %s: %s park loans", path.name, len(rows))
        prepared.append((path, rows))
    return prepared


def ingest_sba_prepared(conn, prepared: list[tuple[Path, list[dict]]]) -> dict:
    loans = 0
    for path, rows in prepared:
        loans += ingest_sba_file(conn, path, [], rows).get("loans", 0)
    return {"files": [path.name for path, _ in prepared], "loans": loans}


def ingest_sba_file(conn, path: Path, states: list[str], rows: list[dict] | None = None) -> dict:
    pending = rows if rows is not None else list(sba.load(path, states))
    with db.source_run(conn, "sba_file") as stats:
        n = 0
        for rec in pending:
            # The bank behind an SBA loan is a normal bank; keep the program on the loan, not the lender.
            rec["raw"]["program_lender"] = "sba"
            _loan_with_lender(conn, rec, rec.get("lender_name_raw"), "unknown")
            db.upsert_loan(conn, "sba", rec["source_loan_id"], rec)
            n += 1
            if n % 200 == 0:
                conn.commit()
        conn.commit()
        stats["loans"] = n
    return stats


def match_loans(conn, states: list[str]) -> dict:
    """Link published loans to parks; create parks for loans on parks no list had."""
    with db.source_run(conn, "match_loans") as stats:
        cands = _candidates(conn, states)
        rows = conn.execute("""select id, source, source_loan_id, property_name_raw, property_address_raw,
                                      property_city_raw, property_state_raw, property_zip_raw, raw
                               from loans where park_id is null and source <> 'county'
                                 and property_state_raw = any(%s)""", (states,)).fetchall()
        linked = created = 0
        for r in rows:
            probe = Probe(r["property_name_raw"], r["property_address_raw"], r["property_city_raw"], r["property_zip_raw"])
            c, conf = best_match(probe, cands)
            if c:
                conn.execute("update loans set park_id=%s, match_confidence=%s where id=%s", (c.id, conf, r["id"]))
                linked += 1
                continue
            if not (r["property_name_raw"] or r["property_address_raw"]):
                continue
            raw = r["raw"] or {}
            kind = "rv" if r["source"] == "sba" and raw.get("naics", "").startswith("7212") else "mhp"
            pid = db.upsert_park_by_source(conn, r["source"], r["source_loan_id"], {
                "name": nice_title(r["property_name_raw"] or f"Park at {r['property_address_raw']}"),
                "address": r["property_address_raw"], "city": r["property_city_raw"],
                "state": r["property_state_raw"], "zip": (r["property_zip_raw"] or "")[:5] or None,
                "county": raw.get("county"), "kind": kind, "units": raw.get("units")})
            conn.execute("update loans set park_id=%s, match_confidence=1 where id=%s", (pid, r["id"]))
            cands.append(Candidate(pid, r["property_name_raw"], r["property_address_raw"], r["property_city_raw"],
                                   r["property_zip_raw"], None, None))
            created += 1
        conn.commit()
        stats.update(candidates=len(rows), linked=linked, created=created)
    return stats


# ---------------------------------------------------------------------------
# County recorder
# ---------------------------------------------------------------------------

def ingest_recorder_maricopa(conn, client: PoliteClient) -> dict:
    """Acquisition loans by deed-number adjacency (reliable), plus later activity by owner-name search.

    Name-search results carry no parcel, so they are only attached to a park when that is unambiguous:
    the owner is an entity (not a person, whose name collides with strangers) and owns exactly one tracked park.
    Everything else is stored unlinked for review rather than guessed onto the wrong park."""
    rec = maricopa.Recorder(client)
    wanted = LOAN_TYPES | DISTRESS_TYPES | CURE_TYPES | {"release", "partial_release", "modification", "assignment"}
    with db.source_run(conn, "maricopa_recorder") as stats:
        parcels = conn.execute("""
            select pa.apn, pa.park_id, pa.owner_name, pa.last_deed_number, pa.last_sale_date,
                   o.entity_type, o.park_count
            from parcels pa join parks p on p.id = pa.park_id left join owners o on o.id = p.owner_id
            where pa.county='maricopa'""").fetchall()
        found = unlinked = 0
        searched: set[str] = set()
        for p in parcels:
            for d in rec.adjacent_loans(p["last_deed_number"], p["owner_name"]) if p["last_deed_number"] else []:
                d["park_id"], d["apns"] = str(p["park_id"]), [p["apn"]]
                d.setdefault("raw", {})["linked_by"] = "deed_adjacency"
                db.upsert_recorded_document(conn, d)
                found += 1
            owner_key = norm_entity(p["owner_name"])
            if not owner_key or owner_key in searched or p["entity_type"] in ("individual", "unknown", None):
                continue
            searched.add(owner_key)
            since = (p["last_sale_date"] or date(2005, 1, 1)) - timedelta(days=1)
            unambiguous = (p["park_count"] or 0) == 1
            for d in rec.search_by_name(p["owner_name"], since):
                if d["doc_type"] not in wanted:
                    continue
                d.setdefault("raw", {})["linked_by"] = "owner_name" if unambiguous else "unlinked_owner_name"
                if unambiguous:
                    d["park_id"], d["apns"] = str(p["park_id"]), [p["apn"]]
                else:
                    d["park_id"] = None
                    unlinked += 1
                db.upsert_recorded_document(conn, d)
                found += 1
            conn.commit()
        conn.commit()
        stats.update(parcels=len(parcels), documents=found, unlinked_for_review=unlinked)
    return stats


def ingest_recorder_export(conn, path: Path, county: str) -> dict:
    with db.source_run(conn, f"{county}_recorder_export") as stats:
        n = 0
        for d in pima.load_recorder_export(path, county):
            # Link by APN if the export carried one, else by owner name on the park's parcels.
            row = None
            for apn in d["apns"]:
                row = conn.execute("select park_id from parcels where county=%s and apn=%s", (county, apn)).fetchone()
                if row:
                    break
            if not row:
                names = [norm_entity(x) for x in d["grantors"] + d["grantees"]]
                hits = conn.execute("""select distinct pa.park_id from parcels pa join parks p on p.id = pa.park_id
                                       join owners o on o.id = p.owner_id
                                       where pa.county=%s and o.name_norm = any(%s)""", (county, names)).fetchall()
                row = hits[0] if len(hits) == 1 else None  # an owner with several parks: leave for review
            d["park_id"] = str(row["park_id"]) if row and row["park_id"] else None
            db.upsert_recorded_document(conn, d)
            n += 1
        conn.commit()
        stats["documents"] = n
    return stats


def _lender_from_doc(doc: dict, owner_norm: str) -> str | None:
    """Pick the lender among the names on a deed of trust: not the owner, not a title company."""
    names = (doc.get("grantees") or []) + (doc.get("grantors") or [])
    for n in names:
        nn = norm_entity(n)
        if not nn or is_title_company(n):
            continue
        if owner_norm and (owner_norm in nn or nn in owner_norm):
            continue
        return nice_title(strip_descriptors(n))
    return None


def build_county_loans(conn, today: date | None = None) -> dict:
    """Turn recorded deeds of trust into loans, then replay every recorded event in date order to derive each
    county loan's status. Status is recomputed from the documents on every run, so the result is deterministic.

      release              -> the referenced loan (or the oldest open one before it) is released
      newer deed of trust  -> an older open loan on the park, at least 60 days earlier, is refinanced
      trustee sale notice / lis pendens (last 24 months) -> open loans recorded before it are in foreclosure
      cancellation / release of lis pendens            -> foreclosure flags on the park are cleared
      trustee's deed       -> loans recorded before it are paid off (the lender took title)
    """
    today = today or date.today()
    with db.source_run(conn, "build_county_loans") as stats:
        docs = conn.execute("""select d.*, o.name_norm as owner_norm, p.name as park_name, p.state as park_state
                               from recorded_documents d join parks p on p.id = d.park_id
                               left join owners o on o.id = p.owner_id
                               order by d.recording_date nulls last, d.recording_number""").fetchall()
        new_loans = released = distress = 0
        loan_by_doc: dict[str, str] = {}
        for d in docs:
            if d["doc_type"] not in LOAN_TYPES:
                continue
            ex = d["extracted"] or {}
            lender = ex.get("lender_name") or _lender_from_doc(d, d["owner_norm"] or "")
            rec = {"park_id": str(d["park_id"]), "recording_date": d["recording_date"],
                   "origination_date": d["recording_date"], "original_amount": d["amount"] or ex.get("loan_amount"),
                   "document_id": str(d["id"]), "borrower_name_raw": ex.get("borrower_name"),
                   "property_state_raw": d["park_state"], "maturity_basis": "unknown",
                   "raw": {"county": d["county"], "recording_number": d["recording_number"]}}
            if lender:
                rec["lender_id"] = db.upsert_lender(conn, lender, "unknown")
                rec["lender_name_raw"] = lender
            sid = f"{d['county']}:{d['recording_number']}"
            is_new = conn.execute("select 1 from loans where source='county' and source_loan_id=%s",
                                  (sid,)).fetchone() is None
            loan_by_doc[str(d["id"])] = db.upsert_loan(conn, "county", sid, rec)
            if is_new:
                new_loans += 1
                if d["recording_date"] and d["recording_date"] >= today - timedelta(days=120):
                    db.add_alert(conn, str(d["park_id"]), "new_loan", f"New loan recorded on {d['park_name']}",
                                 f"{lender or 'Unknown lender'}, recorded {d['recording_date']}", f"newloan:{sid}")

        conn.execute("update loans set status = 'active' where source = 'county'")
        for d in docs:
            t, park, when = d["doc_type"], str(d["park_id"]), d["recording_date"] or today
            recent = (today - when).days <= 180
            if t in LOAN_TYPES:
                new_id = loan_by_doc.get(str(d["id"]))
                conn.execute("""update loans old set status = 'refinanced'
                                from loans newer
                                where newer.id = %s and old.park_id = %s and old.source = 'county'
                                  and old.status in ('active', 'foreclosure') and old.id <> newer.id
                                  and old.recording_date <= %s - interval '60 days'
                                  and coalesce(newer.original_amount, 0) >= 0.5 * coalesce(old.original_amount, 0)""",
                             (new_id, park, when))
            elif t == "release":
                target = None
                if d["references_number"]:
                    target = conn.execute("""select l.id from loans l join recorded_documents rd on rd.id = l.document_id
                                             where rd.county=%s and rd.recording_number=%s""",
                                          (d["county"], d["references_number"])).fetchone()
                if not target:
                    target = conn.execute("""select id from loans where park_id=%s and source='county'
                                             and status in ('active', 'foreclosure') and recording_date < %s
                                             order by recording_date limit 1""", (park, when)).fetchone()
                if target:
                    conn.execute("update loans set status='released', updated_at=now() where id=%s", (target["id"],))
                    released += 1
            elif t in CURE_TYPES:
                conn.execute("update loans set status='active' where park_id=%s and source='county' "
                             "and status='foreclosure'", (park,))
            elif t in ("trustee_sale_notice", "lis_pendens"):
                if (today - when).days > 730:
                    continue  # an old notice with no trustee's deed after it was almost certainly cured
                conn.execute("""update loans set status='foreclosure' where park_id=%s and source='county'
                                and status='active' and recording_date < %s""", (park, when))
                distress += 1
                if recent:
                    db.add_alert(conn, park, "distress", f"{t.replace('_', ' ').capitalize()} on {d['park_name']}",
                                 f"Recorded {d['recording_date']} ({d['recording_number']})",
                                 f"distress:{d['county']}:{d['recording_number']}")
            elif t == "trustee_deed":
                conn.execute("""update loans set status='paid_off' where park_id=%s and source='county'
                                and status in ('active', 'foreclosure') and recording_date < %s""", (park, when))
                if recent:
                    db.add_alert(conn, park, "distress", f"Foreclosure sale completed on {d['park_name']}",
                                 f"Trustee's deed recorded {d['recording_date']}",
                                 f"tdeed:{d['county']}:{d['recording_number']}")
        conn.commit()
        stats.update(documents=len(docs), new_loans=new_loans, released=released, distress_notices=distress)
    return stats


# ---------------------------------------------------------------------------
# Enrichment
# ---------------------------------------------------------------------------

def classify_lenders(conn, client: PoliteClient | None, use_fdic: bool = True) -> dict:
    with db.source_run(conn, "classify_lenders") as stats:
        insts = list(fdic.institutions(client)) if (client and use_fdic) else []
        clf = LenderClassifier(insts)
        rows = conn.execute("select id, name, kind from lenders where classified_by is distinct from 'manual'").fetchall()
        changed = fin = 0
        for r in rows:
            c = clf.classify(r["name"])
            if c.kind == "unknown" and r["kind"] != "unknown":
                continue
            # Published-source kinds (cmbs_trust, agency, sba) set at ingest are more reliable than name rules.
            if r["kind"] in ("cmbs_trust", "agency_fannie", "agency_freddie") and c.kind != r["kind"]:
                continue
            extra = {}
            if c.fdic_cert and client:
                f = fdic.latest_financials(client, c.fdic_cert)
                if f:
                    extra = {k: f[k] for k in ("total_assets_k", "cre_loans_k", "total_capital_k", "cre_concentration")}
                    fin += 1
            conn.execute("""update lenders set kind=%s, fdic_cert=coalesce(%s, fdic_cert), classified_by=%s,
                              total_assets_k=coalesce(%s, total_assets_k), cre_loans_k=coalesce(%s, cre_loans_k),
                              total_capital_k=coalesce(%s, total_capital_k),
                              cre_concentration=coalesce(%s, cre_concentration), updated_at=now() where id=%s""",
                         (c.kind, c.fdic_cert, "fdic" if c.fdic_cert else "rule", extra.get("total_assets_k"),
                          extra.get("cre_loans_k"), extra.get("total_capital_k"), extra.get("cre_concentration"),
                          r["id"]))
            changed += 1
        conn.commit()
        stats.update(lenders=len(rows), classified=changed, with_financials=fin)
    return stats


def extract_documents(conn, client: PoliteClient, anthropic_client, limit: int | None = None) -> dict:
    """Read pending loan documents with Claude; promote stated maturity dates to the loan."""
    limit = limit or settings.max_docs_per_run
    recorders = {"maricopa": maricopa.Recorder(client)}
    with db.source_run(conn, "extract_documents") as stats:
        docs = conn.execute("""select d.id, d.county, d.recording_number, d.doc_type, d.recording_date, d.amount,
                                      d.grantors, d.grantees
                               from recorded_documents d
                               where d.extraction_status='pending' and d.doc_type in
                                     ('deed_of_trust','mortgage','modification')
                               order by d.recording_date desc nulls last limit %s""", (limit,)).fetchall()
        done = with_maturity = tokens = 0
        for d in docs:
            rec = recorders.get(d["county"])
            if not rec:
                conn.execute("update recorded_documents set extraction_status='skipped' where id=%s", (d["id"],))
                continue
            try:
                pdf = rec.pdf(d["recording_number"])
                ctx = f"type={d['doc_type']}, recorded={d['recording_date']}, names={d['grantors'] + d['grantees']}"
                x = extract(anthropic_client, settings.doc_model, pdf=pdf, context=ctx)
            except Exception as exc:  # noqa: BLE001
                log.warning("extract %s failed: %s", d["recording_number"], exc)
                conn.execute("update recorded_documents set extraction_status='failed' where id=%s", (d["id"],))
                conn.commit()
                continue
            tokens += x.input_tokens + x.output_tokens
            conn.execute("update recorded_documents set extraction_status='done', extracted=%s, amount=coalesce(amount,%s) where id=%s",
                         (db._j(x.data), x.loan_amount, d["id"]))
            mat = trustworthy_maturity(x)
            if d["doc_type"] == "modification":
                # A modification changes an existing loan: the one it references, else the newest open
                # county loan on the park recorded before it.
                target = None
                ref = x.data.get("references_recording_number")
                if ref:
                    target = conn.execute("""select l.id from loans l join recorded_documents rd on rd.id=l.document_id
                                             where rd.county=%s and rd.recording_number=%s""",
                                          (d["county"], ref)).fetchone()
                if not target:
                    target = conn.execute("""select l.id from loans l join recorded_documents md on md.id=%s
                                             where l.park_id=md.park_id and l.source='county'
                                               and l.status in ('active','foreclosure')
                                               and l.recording_date < md.recording_date
                                             order by l.recording_date desc limit 1""", (d["id"],)).fetchone()
                if target and mat:
                    conn.execute("""update loans set maturity_date=%s, maturity_basis='document',
                                    note_rate=coalesce(%s, note_rate), updated_at=now() where id=%s""",
                                 (mat, x.rate, target["id"]))
                done += 1
                with_maturity += bool(mat)
                conn.commit()
                continue
            conn.execute("""update loans set
                              maturity_date = coalesce(%s, maturity_date),
                              maturity_basis = case when %s::date is not null then 'document' else maturity_basis end,
                              note_rate = coalesce(note_rate, %s),
                              original_amount = coalesce(original_amount, %s),
                              origination_date = coalesce(%s, origination_date),
                              lender_name_raw = coalesce(%s, lender_name_raw),
                              updated_at = now()
                            where document_id = %s""",
                         (mat, mat, x.rate, x.loan_amount, x.note_date, x.data.get("lender_name"), d["id"]))
            if x.data.get("lender_name"):
                lid = db.upsert_lender(conn, x.data["lender_name"])
                conn.execute("update loans set lender_id=%s where document_id=%s", (lid, d["id"]))
            done += 1
            with_maturity += bool(mat)
            conn.commit()
        stats.update(documents=len(docs), extracted=done, maturity_found=with_maturity, tokens=tokens)
    return stats


# ---------------------------------------------------------------------------
# Model
# ---------------------------------------------------------------------------

def estimate_maturities(conn, today: date | None = None) -> dict:
    today = today or date.today()
    with db.source_run(conn, "estimate") as stats:
        rows = conn.execute("""
            select l.id, l.park_id, l.maturity_date, l.maturity_basis, l.origination_date, l.recording_date,
                   l.term_months, l.amort_months, l.balloon, l.source, coalesce(ld.kind::text, 'unknown') as lender_kind,
                   (select max(d.recording_date) from recorded_documents d
                     where d.park_id = l.park_id and d.doc_type = 'modification'
                       and d.recording_date > coalesce(l.recording_date, l.origination_date)) as mod_date
            from loans l left join lenders ld on ld.id = l.lender_id
            where l.status in ('active', 'foreclosure')""").fetchall()
        n = 0
        for r in rows:
            start = r["origination_date"] or r["recording_date"]
            amortizing = r["balloon"] is False or bool(
                r["term_months"] and r["amort_months"] and r["amort_months"] <= r["term_months"])
            if r["maturity_date"]:
                e = maturity.exact(r["maturity_date"], today,
                                   basis="document" if r["maturity_basis"] == "document" else "reported",
                                   fully_amortizing=amortizing,
                                   known_open=r["source"] in ("cmbs", "fannie", "freddie"))
            elif start:
                e = maturity.estimate(start, r["lender_kind"], today, modification_date=r["mod_date"],
                                      known_term_months=r["term_months"], fully_amortizing=amortizing)
            else:
                continue
            conn.execute("""insert into maturity_estimates (loan_id, p10_date, p50_date, p90_date, prob_12m, prob_24m,
                                                            prob_past_due, likely_date, basis, method, explanation, computed_at)
                            values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s, now())
                            on conflict (loan_id) do update set p10_date=excluded.p10_date, p50_date=excluded.p50_date,
                              p90_date=excluded.p90_date, prob_12m=excluded.prob_12m, prob_24m=excluded.prob_24m,
                              prob_past_due=excluded.prob_past_due, likely_date=excluded.likely_date, basis=excluded.basis, method=excluded.method,
                              explanation=excluded.explanation, computed_at=now()""",
                         (r["id"], e.p10, e.p50, e.p90, e.prob_12m, e.prob_24m, e.prob_past_due, e.likely, e.basis, e.method,
                          e.explanation))
            n += 1
        conn.commit()
        stats["estimated"] = n
    return stats


def ingest_operating_file(conn, path: Path, source: str, states: list[str], as_of: date | None = None) -> dict:
    """Load per-park rent, site and vacancy figures from a CSV/XLSX. Rows are matched to known parks by tracker id,
    or by name, address and location; rows that match no park are listed, never created as new parks."""
    as_of = as_of or date.today()
    with db.source_run(conn, f"operating_{source}") as stats:
        cands = _candidates(conn, states)
        by_id = {c.id: c for c in cands}
        n, unmatched = 0, []
        for rec in operating.load(path, as_of):
            m = rec["match"]
            park_id = m["park_id"] if m["park_id"] in by_id else None
            if not park_id:
                lat, lon = _num(m["lat"]), _num(m["lon"])
                probe = Probe(m["name"], m["address"], m["city"], m["zip"], lat, lon)
                hit, _ = best_match(probe, cands)
                if hit is None and lat is not None and lon is not None:
                    near = nearest(lat, lon, cands, within_m=150)
                    if near and (not near.address or not m["address"] or similarity(probe, near) >= 0.5):
                        hit = near
                park_id = hit.id if hit else None
            if not park_id:
                unmatched.append(" ".join(x for x in (m["name"], m["address"], m["city"]) if x) or "(no identity)")
                continue
            v = rec["values"]
            cols = list(operating.FIELDS)
            conn.execute(f"""
                insert into park_operating (park_id, source, source_ref, observed_on, {", ".join(cols)})
                values (%s, %s, %s, %s, {", ".join(["%s"] * len(cols))})
                on conflict (park_id, source, source_ref, observed_on) do update set
                  {", ".join(f"{c} = excluded.{c}" for c in cols)}, created_at = now()""",
                (park_id, source, path.name, rec["observed_on"], *[v.get(c) for c in cols]))
            n += 1
            if n % 200 == 0:
                conn.commit()
        conn.commit()
        stats.update(rows=n, unmatched=len(unmatched), unmatched_sample=unmatched[:25])
    return stats


def _estimate_from_row(r: dict, today: date) -> maturity.Estimate | None:
    if r["p50_date"] is None:
        return None
    return maturity.Estimate(r["p10_date"], r["p50_date"], r["p90_date"], float(r["prob_12m"] or 0),
                             float(r["prob_24m"] or 0), float(r["prob_past_due"] or 0), r["basis"], r["method"],
                             r["explanation"] or "", r["likely_date"])


def score_parks(conn, rates: RateCurve, today: date | None = None, states: list[str] | None = None) -> dict:
    today = today or date.today()
    with db.source_run(conn, "score") as stats:
        parks = conn.execute("""
            select p.id, p.name, p.state, p.kind, p.units, o.entity_type, o.mailing_state, o.park_count,
                   (select min(pa.last_sale_date) from parcels pa where pa.park_id = p.id) as held_since,
                   s.score as prev_score
            from parks p left join owners o on o.id = p.owner_id left join park_scores s on s.park_id = p.id
            where %s::text[] is null or p.state = any(%s)""", (states, states)).fetchall()
        loans = conn.execute("""
            select l.*, coalesce(ld.kind::text, 'unknown') as lender_kind, ld.cre_concentration,
                   me.p10_date, me.p50_date, me.p90_date, me.prob_12m, me.prob_24m, me.prob_past_due, me.likely_date, me.basis, me.method, me.explanation
            from loans l left join lenders ld on ld.id = l.lender_id
            left join maturity_estimates me on me.loan_id = l.id
            where l.park_id is not null and l.status in ('active', 'foreclosure')""").fetchall()
        by_park: dict[str, list[dict]] = {}
        for ln in loans:
            by_park.setdefault(str(ln["park_id"]), []).append(ln)
        op_rows: dict[str, list[dict]] = {}
        for r in conn.execute("select * from park_operating order by park_id, observed_on desc, created_at desc"):
            op_rows.setdefault(str(r["park_id"]), []).append(r)

        n = jumps = 0
        for p in parks:
            op = operating.merge(op_rows.get(str(p["id"]), []))
            owned_since = op.get("owned_since")
            pf = ParkFacts(state=p["state"], kind=p["kind"], units=p["units"],
                           owner_entity_type=p["entity_type"] or "unknown", owner_state=p["mailing_state"],
                           owner_park_count=p["park_count"], held_since=owned_since or p["held_since"],
                           held_since_basis="reported" if owned_since else "deed",
                           lot_rent=op.get("rent_current"), rentable_sites=op.rentable_sites(),
                           occupancy=op.occupancy(),
                           operating_source=op.source_of("rent_current", "total_sites", "vacant_sites", "occupancy_pct"))
            best, best_loan = score(pf, None, rates, today), None
            for ln in by_park.get(str(p["id"]), []):
                lf = LoanFacts(lender_kind=ln["lender_kind"],
                               lender_cre_concentration=float(ln["cre_concentration"]) if ln["cre_concentration"] else None,
                               start_date=ln["origination_date"] or ln["recording_date"],
                               note_rate=float(ln["note_rate"]) if ln["note_rate"] else None,
                               original_amount=float(ln["original_amount"]) if ln["original_amount"] else None,
                               current_balance=float(ln["current_balance"]) if ln["current_balance"] else None,
                               amort_months=ln["amort_months"], interest_only=ln["interest_only"], noi=float(ln["noi_current"]) if ln["noi_current"] else None,
                               payment_status="foreclosure" if ln["status"] == "foreclosure" else ln["payment_status"],
                               estimate=_estimate_from_row(ln, today))
                s = score(pf, lf, rates, today)
                if s.total > best.total:
                    best, best_loan = s, ln
            conn.execute("""insert into park_scores (park_id, score, components, primary_loan_id, computed_at)
                            values (%s,%s,%s,%s, now())
                            on conflict (park_id) do update set score=excluded.score, components=excluded.components,
                              primary_loan_id=excluded.primary_loan_id, computed_at=now()""",
                         (p["id"], best.total, db._j(best.components), best_loan["id"] if best_loan else None))
            conn.execute("""insert into park_score_history (park_id, score, computed_on) values (%s,%s,%s)
                            on conflict (park_id, computed_on) do update set score=excluded.score""",
                         (p["id"], best.total, today))
            if p["prev_score"] is not None and best.total - float(p["prev_score"]) >= 15:
                jumps += db.add_alert(conn, str(p["id"]), "score_jump", f"{p['name']} jumped to {best.total:.0f}",
                                      f"Up from {float(p['prev_score']):.0f}", f"jump:{p['id']}:{today}")
            m = best.components.get("maturity", {})
            if m.get("basis") in ("reported", "document") and m.get("prob_12m") == 1.0 and m.get("p50"):
                db.add_alert(conn, str(p["id"]), "maturity_window", f"{p['name']}: loan matures {m['p50']}",
                             m.get("why"), f"window:{best_loan['id'] if best_loan else p['id']}:{m['p50']}")
            n += 1
        conn.commit()
        stats.update(parks=n, score_jumps=jumps)
    return stats
