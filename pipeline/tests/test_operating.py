"""Park operating figures: parsing an import file, merging observations, and their effect on the refinance gap."""
from datetime import date

from mhdebt import db, jobs, operating
from mhdebt.rates import RateCurve
from mhdebt.scoring import LoanFacts, ParkFacts, noi_with_basis, score

from test_pipeline_db import PARCELS, TODAY, _hifld_file

CSV = """Community Name,Street Address,City,State,Zip,Average Site Rent,Rent Jan 1 Last Year,Total Sites,Vacant Sites,Sites Under Development,Age Restriction,Land Ownership,Owned Since
Sunrise Mobile Home Park,4400 E Main St,Mesa,AZ,85205,"$812",780,142,12,2,55+,Owned,03/15/1994
Nowhere Estates,1 Fake Rd,Yuma,AZ,85364,600,,80,4,,All Ages,Leased,
"""


def test_parse_and_occupancy(tmp_path):
    f = tmp_path / "rents.csv"
    f.write_text(CSV)
    rows = list(operating.load(f, TODAY))
    assert len(rows) == 2
    v = rows[0]["values"]
    assert v["rent_current"] == 812 and v["rent_jan_last"] == 780 and v["total_sites"] == 142
    assert v["age_restricted"] is True and v["land_tenure"] == "owned" and v["owned_since"] == date(1994, 3, 15)
    assert rows[1]["values"]["age_restricted"] is False and rows[1]["values"]["land_tenure"] == "leased"
    assert rows[0]["observed_on"] == TODAY

    op = operating.merge([{**v, "source": "csv", "observed_on": TODAY}])
    assert op.rentable_sites() == 140
    assert round(op.occupancy(), 4) == round(128 / 140, 4)


def test_merge_keeps_newest_non_empty():
    newer = {"source": "manual", "observed_on": date(2026, 10, 1), "rent_current": 850, "total_sites": None}
    older = {"source": "csv", "observed_on": date(2026, 1, 1), "rent_current": 800, "total_sites": 100, "occupancy_pct": 93}
    op = operating.merge([newer, older])
    assert op.get("rent_current") == 850 and op.get("total_sites") == 100
    assert op.occupancy() == 0.93
    assert op.source_of("rent_current", "total_sites") == "manual, 2026-10-01; csv, 2026-01-01"


def test_rent_does_not_become_pressure_income():
    blank, basis = noi_with_basis(ParkFacts(state="AZ", kind="mhp", units=100))
    assert blank is None and basis == "No income on file. Lot rent was not entered."

    entered, entered_basis = noi_with_basis(ParkFacts(
        state="AZ", kind="mhp", units=100, lot_rent=900, rentable_sites=98, occupancy=0.80,
        operating_source="csv, 2026-10-29"))
    assert entered is None and "expense ratio" in entered_basis

    loan = LoanFacts(lender_kind="community_bank", start_date=date(2021, 6, 1), note_rate=4.0,
                     original_amount=5_000_000, amort_months=300, current_balance=4_000_000)
    missing = score(ParkFacts(state="AZ", units=100, lot_rent=900, occupancy=0.9), loan, RateCurve(), TODAY)
    assert missing.components["refi_gap"]["points"] is None
    reported = score(ParkFacts(state="AZ", units=100), LoanFacts(
        lender_kind="community_bank", start_date=date(2021, 6, 1), note_rate=4.0,
        current_balance=4_000_000, noi=200_000), RateCurve(), TODAY)
    assert reported.components["refi_gap"]["noi_basis"] == "reported"
    assert reported.components["refi_gap"]["points"] is not None


def test_import_matches_parks_and_feeds_score(conn, tmp_path):
    jobs.ingest_hifld(conn, None, ["AZ"], geojson=_hifld_file(tmp_path))
    jobs.ingest_parcels(conn, None, "maricopa", rows=[dict(p) for p in PARCELS])
    f = tmp_path / "rents.csv"
    f.write_text(CSV)

    st = jobs.ingest_operating_file(conn, f, "vendor", ["AZ"], TODAY)
    assert st["rows"] == 1 and st["unmatched"] == 1 and "Nowhere Estates" in st["unmatched_sample"][0]
    again = jobs.ingest_operating_file(conn, f, "vendor", ["AZ"], TODAY)  # idempotent
    assert again["rows"] == 1
    assert conn.execute("select count(*) n from park_operating").fetchone()["n"] == 1

    park_id = conn.execute("select id from parks where sources->>'hifld' = '1001'").fetchone()["id"]
    db.upsert_loan(conn, "county", "test-sunrise-loan", {
        "park_id": park_id, "status": "active", "original_amount": 1_000_000, "current_balance": 800_000,
        "note_rate": 5.0, "origination_date": date(2018, 1, 1), "maturity_date": date(2028, 1, 1),
        "maturity_basis": "reported", "amort_months": 360, "balloon": True,
    })
    conn.commit()
    jobs.score_parks(conn, RateCurve(), today=TODAY, states=["AZ"])
    row = conn.execute("""select s.score, s.components from park_scores s join parks p on p.id = s.park_id
                           where p.sources->>'hifld' = '1001'""").fetchone()
    assert row["score"] is not None
    assert "owned-since" in row["components"]["owner"]["why"]  # 1994 owned-since date, about 32 years
