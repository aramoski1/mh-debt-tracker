import json
from datetime import date
from pathlib import Path

from mhdebt.rates import RateCurve, parse_fred, parse_sofrai, parse_sofr, parse_treasury_curve
from mhdebt.scoring import LoanFacts, ParkFacts, acquisition_fit, score
from mhdebt.sources import fema, maricopa
from mhdebt.sources.doc_types import normalize_doc_type
from mhdebt.spreads import median_spreads, quarter_label, spread_for_model, spreads_by_term, tenor_for_term
from mhdebt.underwrite import irr, scenario

FIX = Path(__file__).parent / "fixtures"
TODAY = date(2026, 10, 30)


def test_fred_and_sofr_fixtures():
    dgs = parse_fred((FIX / "fred_dgs10_sample.csv").read_text(), "DGS10")
    assert dgs[0] == (date(1962, 1, 2), 4.06)
    assert dgs[-1] == (date(2026, 10, 28), 5.05)
    sofr = parse_sofr((FIX / "nyfed_sofr_sample.csv").read_text())
    assert sofr[0] == (date(2026, 10, 28), 3.94)


def test_maricopa_distress_codes_and_search_shape():
    assert normalize_doc_type("N/TR SALE") == "trustee_sale_notice"
    assert normalize_doc_type("LIS PEND") == "lis_pendens"
    payload = json.loads((FIX / "maricopa_search_ns.json").read_text())
    doc = maricopa._doc_from_json("20260573151", payload["searchResults"][0])
    assert doc["doc_type"] == "trustee_sale_notice"
    assert doc["grantors"] == [] and doc["grantees"] == []


def test_fema_point():
    payload = json.loads((FIX / "fema_flood_point.json").read_text())
    assert fema.parse_flood(payload) == "X"
    assert fema.parse_flood({"features": []}) is None


def test_treasury_curve_and_sofr_averages():
    curve = parse_treasury_curve((FIX / "treasury_yield_curve_sample.xml").read_bytes())
    by = {series: value for series, _, value in curve}
    assert by["TSY_5Y"] == 4.78 and by["TSY_10Y"] == 4.98
    assert "TSY_30YEARDISPLAY" not in by
    avgs = parse_sofrai(json.loads((FIX / "nyfed_sofrai_sample.json").read_text()))
    assert ( "SOFR_AVG_30", date(2026, 10, 30), 3.89857) in avgs
    assert ("SOFR_INDEX", date(2026, 10, 30), 1.2649531) in avgs


def test_spread_uses_the_nearest_tenor_and_quarter():
    assert tenor_for_term(None) == ("DGS5", "term_unknown_uses_5y")
    assert tenor_for_term(120) == ("DGS10", "matching_tenor")
    assert quarter_label(date(2024, 6, 1)) == "2024Q2"
    loans = [{
        "source": "cmbs", "lender_kind": "cmbs_trust", "note_rate": 6.5,
        "origination_date": date(2024, 6, 1), "term_months": 120,
    }]
    rows = spreads_by_term(loans, lambda series, d: {"DGS10": 4.5}.get(series))
    assert rows[0]["tenor"] == "DGS10" and rows[0]["quarter"] == "2024Q2"
    assert rows[0]["median_spread"] == 2.0 and rows[0]["method"] == "matching_tenor"


def test_measured_spread_needs_a_sample():
    loans = [{"source": "cmbs", "lender_kind": "cmbs_trust", "note_rate": 6.5,
              "origination_date": date(2024, 6, 1)} for _ in range(8)]
    loans.append({"source": "sba", "lender_kind": "sba_lender", "note_rate": 8.0,
                  "origination_date": date(2024, 6, 1)})
    rows = median_spreads(loans, lambda d: 4.0)
    by = {(r["source"], r["lender_kind"]): r for r in rows}
    assert by[("cmbs", "cmbs_trust")]["median_spread"] == 2.5
    assert by[("cmbs", "cmbs_trust")]["usable"] is True
    assert by[("sba", "sba_lender")]["usable"] is False
    model = spread_for_model(rows)
    assert "cmbs_trust" in model and "sba_lender" not in model


def test_ltv_cap_waits_for_a_saved_price():
    rates = RateCurve()
    loan = LoanFacts(lender_kind="community_bank", start_date=date(2021, 8, 1),
                     original_amount=5_000_000, current_balance=4_000_000, note_rate=4.0)
    bare = score(ParkFacts(state="AZ", units=80), loan, rates, TODAY).components["refi_gap"]
    priced = score(ParkFacts(state="AZ", units=80, value=3_000_000), loan, rates, TODAY).components["refi_gap"]
    assert bare["ltv_applied"] is False
    assert priced["ltv_applied"] is True
    assert priced["equity_needed"] >= bare["equity_needed"]


def test_fit_states_its_gaps():
    fit = acquisition_fit(units=120, state="AZ", kind="mhp", note_rate=4.0, market_rate=7.0, km_to_managed=None)
    assert fit["points"] == 80
    distance = next(p for p in fit["parts"] if p["key"] == "distance")
    assert distance["points"] == 0 and "managed" in distance["why"]


def test_irr_on_a_known_flow():
    assert irr([-100, 0, 121]) == 10.0


def test_bls_and_water_match():
    from mhdebt.rates import parse_bls
    from mhdebt.sources.epa import link_systems, parse_system

    rows = parse_bls({"Results": {"series": [{"data": [
        {"year": "2026", "period": "M09", "value": "432.092"},
        {"year": "2026", "period": "M08", "value": "-"},
        {"year": "2026", "period": "M13", "value": "400"},
    ]}]}})
    assert rows == [(date(2026, 9, 1), 432.092)]
    system = parse_system(json.loads((FIX / "epa_sdwa_system.json").read_text()))
    assert system["pws_id"] == "AZ0415101" and system["serious_violator"] is False
    linked = link_systems([system], [
        {"id": "a", "name": "3 Dreamers RV Park", "county": "La Paz"},
        {"id": "b", "name": "Saguaro Vista", "county": "La Paz"},
    ])
    assert linked[0]["park_id"] == "a"
    ambiguous = link_systems([system], [
        {"id": "a", "name": "3 Dreamers RV Park", "county": "La Paz"},
        {"id": "b", "name": "3 Dreamers RV Park LLC", "county": "La Paz"},
    ])
    assert ambiguous[0]["park_id"] is None
    false = link_systems([
        {"pws_id": "X", "name": "APACHE NITROGEN PRODUCTS", "county": "Cochise",
         "serious_violator": False, "qtrs_with_violations": 0, "rules_violated_3yr": 0},
    ], [{"id": "p", "name": "Apache Mobile Park", "county": "Cochise"}])
    assert false[0]["park_id"] is None
    village = link_systems([
        {"pws_id": "Y", "name": "Arizona Village", "county": "Pima",
         "serious_violator": True, "qtrs_with_violations": 1, "rules_violated_3yr": 1},
    ], [{"id": "p", "name": "Arizona Trailer Court", "county": "Pima"}])
    assert village[0]["park_id"] is None


def test_scenario_names_the_binding_constraint():
    out = scenario(price=1_000_000, sites=100, lot_rent=700, occupancy=0.9, expense_ratio=0.4,
                   cap_rate_pct=8, rent_growth=0.0, annual_rate_pct=7.0)
    assert out["ok"] is True
    assert out["binding"] in ("ltv", "dscr")
    assert out["irr"] is not None
