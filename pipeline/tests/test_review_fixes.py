"""Regression tests for issues found in code review."""
from datetime import date

from mhdebt import maturity
from mhdebt.match import Candidate, Probe, best_match
from mhdebt.normalize import parse_share_pct
from mhdebt.scoring import balance_after, payment_months
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
    assert e.prob_12m < 0.2 and "amortizes" in e.explanation


def test_known_open_cmbs_past_maturity_keeps_full_weight():
    e = maturity.exact(date(2026, 6, 6), TODAY, known_open=True)
    assert e.prob_past_due == 1.0 and "servicer" in e.explanation


def test_interest_only_and_short_amortization():
    assert balance_after(1_000_000, 6.0, 0, 24) == 1_000_000
    assert balance_after(1_000_000, 6.0, 6, 24) == 0
    assert round(payment_months(1_000_000, 6.0, 0)) == 5000
