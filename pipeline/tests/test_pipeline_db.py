"""End-to-end run of every job against a real Postgres database, with fixture data instead of network calls."""
import json
from datetime import date
from pathlib import Path

from mhdebt import db, jobs
from mhdebt.rates import RateCurve
from mhdebt.sources.edgar_cmbs import parse_ex102

FIX = Path(__file__).parent / "fixtures"
TODAY = date(2026, 10, 27)


def _hifld_file(tmp_path: Path) -> Path:
    feats = [
        {"type": "Feature", "geometry": {"type": "Point", "coordinates": [-111.7605, 33.4152]},
         "properties": {"MHPID": "1001", "NAME": "SUNRISE MOBILE HOME PARK", "ADDRESS": "4400 E MAIN ST", "CITY": "MESA",
                        "STATE": "AZ", "ZIP": "85205", "COUNTY": "MARICOPA", "TYPE": "MOBILE HOME PARK",
                        "STATUS": "OPEN", "UNITS": 142}},
        {"type": "Feature", "geometry": {"type": "Point", "coordinates": [-110.9930, 32.1890]},
         "properties": {"MHPID": "1002", "NAME": "DESERT PALMS RV RESORT", "ADDRESS": "1590 W AJO WAY",
                        "CITY": "TUCSON", "STATE": "AZ", "ZIP": "85713", "COUNTY": "PIMA",
                        "TYPE": "RECREATIONAL VEHICLE PARK", "STATUS": "OPEN", "UNITS": 210}},
        {"type": "Feature", "geometry": {"type": "Point", "coordinates": [-112.1000, 33.5300]},
         "properties": {"MHPID": "1003", "NAME": "SAGUARO VISTA MHP", "ADDRESS": "5600 N 43RD AVE", "CITY": "PHOENIX",
                        "STATE": "AZ", "ZIP": "85019", "COUNTY": "MARICOPA", "TYPE": "MOBILE HOME PARK",
                        "STATUS": "OPEN", "UNITS": 96}},
        {"type": "Feature", "geometry": {"type": "Point", "coordinates": [-97.1, 31.5]},
         "properties": {"MHPID": "2001", "NAME": "LONE STAR MHP", "STATE": "TX", "TYPE": "MOBILE HOME PARK",
                        "STATUS": "OPEN"}},
    ]
    p = tmp_path / "mhp.geojson"
    p.write_text(json.dumps({"type": "FeatureCollection", "features": feats}))
    return p


PARCELS = [
    {"county": "maricopa", "apn": "145-10-001", "state": "AZ", "situs_address": "5600 N 43RD AVE",
     "situs_city": "PHOENIX", "situs_zip": "85019", "owner_name": "SAGUARO VISTA HOLDINGS LLC",
     "owner_mailing": "100 OCEAN AVE", "owner_city": "SANTA MONICA", "owner_state": "CA", "owner_zip": "90401",
     "land_use_code": "0840", "land_use_desc": "mhp", "lat": 33.5302, "lon": -112.1003,
     "last_sale_date": date(2009, 4, 2), "deed_number": "20090301234", "raw": {}},
    {"county": "maricopa", "apn": "301-22-050", "state": "AZ", "situs_address": "800 W APACHE TRL",
     "situs_city": "APACHE JUNCTION", "situs_zip": "85120", "owner_name": "ROBERT HANSEN",
     "owner_mailing": "800 W APACHE TRL", "owner_city": "APACHE JUNCTION", "owner_state": "AZ", "owner_zip": "85120",
     "land_use_code": "0850", "land_use_desc": "rv", "lat": 33.41, "lon": -111.55,
     "last_sale_date": date(1998, 1, 10), "deed_number": "19980012345", "raw": {}},
]


def test_full_pipeline(conn, tmp_path):
    geojson = _hifld_file(tmp_path)
    jobs.ingest_hifld(conn, None, ["AZ"], geojson=geojson)
    assert conn.execute("select count(*) n from parks").fetchone()["n"] == 3  # TX filtered out
    blank = conn.execute("select phone, website from parks where sources->>'hifld' = '1001'").fetchone()
    assert blank["phone"] is None and blank["website"] is None
    jobs.ingest_hifld(conn, None, ["AZ"], geojson=geojson)
    assert conn.execute("select count(*) n from parks").fetchone()["n"] == 3

    st = jobs.ingest_parcels(conn, None, "maricopa", rows=[dict(p) for p in PARCELS])
    assert st == {"linked": 1, "created": 1}
    saguaro = conn.execute("select p.id, o.mailing_state from parks p join owners o on o.id=p.owner_id "
                           "where p.sources->>'hifld'='1003'").fetchone()
    assert saguaro["mailing_state"] == "CA"

    for ln in parse_ex102((FIX / "exh_102_sample.xml").read_bytes(), "1752363", "TEST 2019-C1", states=["AZ"]):
        jobs.upsert_cmbs_loan(conn, ln)
    conn.commit()
    st = jobs.match_loans(conn, ["AZ"])
    assert st["linked"] == 2 and st["created"] == 1  # Sunrise + Desert Palms linked, Palm Shadows is new

    # County records for Saguaro Vista: an old loan that was released, and a 2021 community bank loan.
    sag = str(saguaro["id"])
    hansen_park = conn.execute("select park_id from parcels where apn='301-22-050'").fetchone()["park_id"]
    docs = [
        {"county": "maricopa", "recording_number": "20140500001", "doc_type": "deed_of_trust",
         "recording_date": date(2014, 5, 1), "grantees": ["SAGUARO VISTA HOLDINGS LLC", "FIRST AMERICAN TITLE INSURANCE CO",
                                                          "OLD DESERT BANK"], "amount": 2_100_000, "park_id": sag},
        {"county": "maricopa", "recording_number": "20210900002", "doc_type": "deed_of_trust",
         "recording_date": date(2021, 9, 1), "grantees": ["SAGUARO VISTA HOLDINGS LLC", "PIONEER TITLE AGENCY",
                                                          "COMMERCE BANK OF ARIZONA, an Arizona corporation"],
         "amount": 4_600_000, "park_id": sag},
        {"county": "maricopa", "recording_number": "20211000003", "doc_type": "release",
         "recording_date": date(2021, 10, 1), "references_number": "20140500001", "park_id": sag},
        {"county": "maricopa", "recording_number": "20180300004", "doc_type": "deed_of_trust",
         "recording_date": date(2018, 3, 1), "grantees": ["ROBERT HANSEN", "THE MILLER FAMILY TRUST"],
         "amount": 900_000, "park_id": str(hansen_park)},
        {"county": "maricopa", "recording_number": "20260900005", "doc_type": "trustee_sale_notice",
         "recording_date": date(2026, 9, 15), "park_id": str(hansen_park)},
    ]
    for d in docs:
        db.upsert_recorded_document(conn, d)
    conn.commit()
    st = jobs.build_county_loans(conn, today=TODAY)
    assert st["new_loans"] == 3 and st["released"] == 1 and st["distress_notices"] == 1

    loans = {r["source_loan_id"]: r for r in conn.execute(
        "select l.source_loan_id, l.status, l.lender_name_raw from loans l where source='county'").fetchall()}
    assert loans["maricopa:20140500001"]["status"] == "released"
    assert loans["maricopa:20210900002"]["lender_name_raw"] == "Commerce Bank of Arizona"
    assert loans["maricopa:20180300004"]["status"] == "foreclosure"

    jobs.classify_lenders(conn, None)
    kinds = {r["name"]: r["kind"] for r in conn.execute("select name, kind from lenders").fetchall()}
    assert kinds["Commerce Bank of Arizona"] == "community_bank"
    assert kinds["The Miller Family Trust"] == "individual"
    assert kinds["TEST 2019-C1"] == "cmbs_trust"

    jobs.estimate_maturities(conn, today=TODAY)
    jobs.score_parks(conn, RateCurve(), today=TODAY, states=["AZ"])

    rows = conn.execute("select name, score, maturity_basis, maturity_date from park_overview order by score desc").fetchall()
    for r in rows:
        print(r["name"], r["score"], r["maturity_basis"], r["maturity_date"])
    by_name = {r["name"]: r for r in rows}
    assert len(rows) == 5
    # Distressed seller-financed RV park and the 2021 bank loan with an out-of-state owner rank at the top.
    assert {rows[0]["name"], rows[1]["name"]} == {"Park at 800 W Apache Trl", "Desert Palms RV Resort"}
    assert by_name["Saguaro Vista MHP"]["maturity_date"] == date(2026, 9, 1)  # most likely: 5-year bank term
    assert by_name["Saguaro Vista MHP"]["maturity_basis"] == "estimated"
    assert by_name["Sunrise Mobile Home Park"]["maturity_basis"] == "reported"
    assert by_name["Sunrise Mobile Home Park"]["maturity_date"] == date(2026, 12, 6)
    kinds_alerts = {r["kind"] for r in conn.execute("select kind from alerts").fetchall()}
    assert {"distress", "maturity_window"} <= kinds_alerts

    # Re-running everything is idempotent.
    jobs.build_county_loans(conn, today=TODAY)
    jobs.score_parks(conn, RateCurve(), today=TODAY, states=["AZ"])
    assert conn.execute("select count(*) n from loans").fetchone()["n"] == 6
