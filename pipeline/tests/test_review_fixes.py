"""Regression tests for issues found in code review."""
from datetime import date

from mhdebt import jobs, maturity
from mhdebt.match import Candidate, Probe, best_match
from mhdebt.normalize import parse_share_pct
from mhdebt.rates import RateCurve
from mhdebt.scoring import LoanFacts, ParkFacts, acquisition_fit, balance_after, payment_months, score
from mhdebt.sources.doc_types import normalize_doc_type
from mhdebt.sources.edgar_cmbs import parse_ex102

TODAY = date(2026, 10, 27)


def test_doc_type_traps():
    assert normalize_doc_type("DEED OF TRUST AND ASSIGNMENT OF RENTS") == "deed_of_trust"
    assert normalize_doc_type("ASSIGNMENT OF DEED OF TRUST") == "assignment"
    assert normalize_doc_type("CANCELLATION OF NOTICE OF TRUSTEE SALE") == "cancellation"
    assert normalize_doc_type("RELEASE OF LIS PENDENS") == "lis_pendens_release"
    assert normalize_doc_type("MODIFICATION OF DEED OF TRUST") == "modification"
    assert normalize_doc_type("DEED OF RECONVEYANCE") == "release"


def test_portfolio_share_uses_all_properties():
    xml = b"""<?xml version="1.0"?><assetData xmlns="http://www.sec.gov/edgar/document/absee/cmbs/assetdata">
      <assets><assetNumber>9</assetNumber><originalLoanAmount>50000000</originalLoanAmount>
        <maturityDate>01-01-2028</maturityDate>
        <property><propertyName>A MHP</propertyName><propertyState>AZ</propertyState><propertyTypeCode>MH</propertyTypeCode><unitsBedsRoomsNumber>100</unitsBedsRoomsNumber></property>
        <property><propertyName>B MHP</propertyName><propertyState>TX</propertyState><propertyTypeCode>MH</propertyTypeCode><unitsBedsRoomsNumber>300</unitsBedsRoomsNumber></property>
        <property><propertyName>C MHP</propertyName><propertyState>FL</propertyState><propertyTypeCode>MH</propertyTypeCode><unitsBedsRoomsNumber>100</unitsBedsRoomsNumber></property>
      </assets></assetData>"""
    (loan,) = parse_ex102(xml, "1", "T", states=["AZ"])
    assert len(loan.properties) == 1 and abs(loan.properties[0].share - 0.2) < 1e-9


def test_partial_year_noi_is_annualized():
    xml = b"""<?xml version="1.0"?><assetData xmlns="http://www.sec.gov/edgar/document/absee/cmbs/assetdata">
      <assets><assetNumber>1</assetNumber><property><propertyName>X MHP</propertyName><propertyState>AZ</propertyState>
        <propertyTypeCode>MH</propertyTypeCode><mostRecentNetOperatingIncomeAmount>300000</mostRecentNetOperatingIncomeAmount>
        <mostRecentFinancialsStartDate>01-01-2026</mostRecentFinancialsStartDate>
        <mostRecentFinancialsEndDate>06-30-2026</mostRecentFinancialsEndDate>
        <mostRecentPhysicalOccupancyPercentage>1.0</mostRecentPhysicalOccupancyPercentage></property></assets></assetData>"""
    (loan,) = parse_ex102(xml, "1", "T", states=["AZ"])
    assert loan.properties[0].noi_current == 600000
    assert loan.properties[0].occupancy == 100.0


def test_share_pct():
    assert parse_share_pct("1.0") == 100.0 and parse_share_pct("0.95") == 95.0 and parse_share_pct("93") == 93


def test_name_only_match_does_not_cross_cities():
    cands = [Candidate("mesa", "Sunrise Village", "100 Main St", "Mesa", "85201", None, None)]
    c, _ = best_match(Probe("Sunrise MHP", None, "Tucson", "85713"), cands)
    assert c is None


def test_fully_amortizing_loan_has_little_pressure():
    e = maturity.exact(date(2027, 3, 1), TODAY, fully_amortizing=True)
    assert e.prob_12m < 0.2 and "Fully amortizing — no balloon." in e.explanation


def test_known_open_cmbs_past_maturity_keeps_full_weight():
    e = maturity.exact(date(2026, 6, 6), TODAY, known_open=True)
    assert e.prob_past_due == 1.0 and "servicer" in e.explanation


def test_interest_only_and_short_amortization():
    assert balance_after(1_000_000, 6.0, 0, 24) == 1_000_000
    assert balance_after(1_000_000, 6.0, 6, 24) == 0
    assert round(payment_months(1_000_000, 6.0, 0)) == 5000


def _loaded_estimate(**over):
    row = {
        "p10_date": date(2027, 1, 11), "p50_date": date(2027, 1, 11), "p90_date": date(2027, 1, 11),
        "prob_12m": 0.15, "prob_24m": 0.15, "prob_past_due": 0,
        "basis": "document", "method": "exact", "likely_date": date(2027, 1, 11),
        "explanation": "Maturity 2027-01-11 (stated in the recorded document). Fully amortizing — no balloon.",
        "balloon": None, "term_months": None, "amort_months": None,
    }
    row.update(over)
    return jobs._estimate_from_row(row, date(2026, 11, 11))


def test_reloaded_estimate_keeps_the_amortizing_flag():
    """The maturity table does not store the flag. The job rebuilds it from the loan and the stored sentence."""
    assert _loaded_estimate().fully_amortizing
    assert _loaded_estimate(
        explanation="Maturity 2027-01-11 (stated in the recorded document).",
        balloon=False,
    ).fully_amortizing
    assert not _loaded_estimate(
        explanation="Maturity 2027-01-11 (stated in the recorded document).",
        balloon=True,
    ).fully_amortizing
    assert _loaded_estimate(
        explanation="Term of 300 months from 2001-11-11. Fully amortizing — no balloon.",
        balloon=None, term_months=300, amort_months=None, prob_12m=0, prob_24m=0,
    ).fully_amortizing


def test_explicit_balloon_stays_a_balloon_when_the_term_is_long():
    """A 5-year or 20-year balloon with a 30-year amortization is not paid off."""
    for term in (60, 240):
        est = _loaded_estimate(
            explanation="Maturity 2027-01-11 (stated in the recorded document).",
            balloon=True, term_months=term, amort_months=360, prob_12m=1.0, prob_24m=1.0,
        )
        assert est.fully_amortizing is False
    got = score(
        ParkFacts(state="AZ", kind="mhp", units=100),
        LoanFacts(
            lender_kind="community_bank", note_rate=7.0, current_balance=5_000_000,
            estimate=_loaded_estimate(
                explanation="Maturity 2027-01-11 (stated in the recorded document).",
                balloon=True, term_months=240, amort_months=360, prob_12m=1.0, prob_24m=1.0,
            ),
        ),
        RateCurve(), date(2026, 11, 11),
    )
    assert got.components["maturity"]["points"] == 29.8
    assert "Fully amortizing" not in got.components["maturity"]["why"]


def test_reloaded_amortizing_loan_scores_zero_not_the_probability():
    est = _loaded_estimate()
    got = score(
        ParkFacts(state="AZ", kind="mhp", units=100),
        LoanFacts(lender_kind="sba", note_rate=5.0, current_balance=1_000_000, estimate=est),
        RateCurve(), date(2026, 11, 11),
    )
    assert got.components["maturity"]["points"] == 0
    assert got.components["maturity"]["why"] == "Fully amortizing — no balloon."


def test_reloaded_past_amortizing_date_is_not_35():
    est = _loaded_estimate(
        p10_date=date(2020, 1, 1), p50_date=date(2020, 1, 1), p90_date=date(2020, 1, 1),
        likely_date=date(2020, 1, 1), prob_12m=0.15, prob_24m=0.15, prob_past_due=0.15,
        explanation="Maturity 2020-01-01 (stated in the recorded document). Fully amortizing — no balloon.",
    )
    got = score(
        ParkFacts(state="AZ", kind="mhp", units=100),
        LoanFacts(lender_kind="sba", note_rate=5.0, current_balance=1_000_000, estimate=est),
        RateCurve(), date(2026, 11, 11),
    )
    assert got.components["maturity"]["points"] == 0


def test_half_point_inside_todays_rate_scores():
    hit = acquisition_fit(units=120, state="AZ", kind="mhp", note_rate=6.5, market_rate=7.0, km_to_managed=None)
    miss = acquisition_fit(units=120, state="AZ", kind="mhp", note_rate=6.51, market_rate=7.0, km_to_managed=None)
    assert hit["points"] == 80
    assert next(p for p in miss["parts"] if p["key"] == "rate")["points"] == 0


def test_a_loan_score_replaces_a_blank_without_comparing_none():
    park = ParkFacts(state="AZ", kind="mhp", units=100)
    blank = score(park, None, RateCurve(), date(2026, 11, 11))
    loan = score(park, LoanFacts(lender_kind="community_bank", note_rate=5.0, current_balance=1_000_000),
                 RateCurve(), date(2026, 11, 11))
    assert blank.total is None and loan.total is not None
    assert jobs._prefer_score(loan, blank)
    assert not jobs._prefer_score(blank, loan)
