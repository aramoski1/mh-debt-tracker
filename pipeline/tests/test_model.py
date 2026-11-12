from datetime import date

from mhdebt import maturity
from mhdebt.lenders import LenderClassifier, is_title_company
from mhdebt.normalize import add_months, entity_type, norm_entity, norm_park_name, parse_date, parse_pct
from mhdebt.rates import RateCurve
from mhdebt.scoring import LoanFacts, ParkFacts, payment, score

TODAY = date(2026, 10, 27)


def test_normalize():
    assert norm_entity("Sunny Acres MHP, L.L.C.") == "SUNNY ACRES MHP"
    assert norm_park_name("Desert Sun Mobile Home Park") == "DESERT SUN"
    assert norm_park_name("The Palms RV Resort") == "PALMS"
    assert entity_type("John and Mary Smith") == "individual"
    assert entity_type("Smith Family Revocable Trust") == "trust"
    assert entity_type("Cactus Holdings LLC") == "llc"
    assert parse_date("12-06-2026") == date(2026, 12, 6)
    assert parse_date("2026-12-06T00:00:00") == date(2026, 12, 6)
    assert parse_pct("0.0415") == 4.15 and parse_pct("4.15") == 4.15
    assert add_months(date(2021, 1, 31), 1) == date(2021, 2, 28)


def test_lender_rules():
    fdic = [{"NAME": "Western Alliance Bank", "CERT": 57512, "ASSET": 80_000_000},
            {"NAME": "Commerce Bank of Arizona", "CERT": 57000, "ASSET": 300_000}]
    c = LenderClassifier(fdic)
    assert c.classify("Western Alliance Bank, an Arizona corporation").kind == "regional_bank"
    assert c.classify("COMMERCE BANK OF ARIZONA").kind == "community_bank"
    assert c.classify("Desert Schools Federal Credit Union").kind == "credit_union"
    assert c.classify("Walker & Dunlop, LLC").kind == "agency_lender"
    assert c.classify("Argentic Real Estate Finance LLC").kind == "conduit_lender"
    assert c.classify("Wilmington Trust, N.A., as Trustee for the Registered Holders of BANK 2019-BNK19 Commercial Mortgage Pass-Through Certificates").kind == "cmbs_trust"
    assert c.classify("Robert J. Hansen and Linda Hansen, husband and wife").kind == "individual"
    assert c.classify("The Hansen Family Trust").kind == "individual"
    assert c.classify("Midland National Life Insurance Company").kind == "life_company"
    assert is_title_company("First American Title Insurance Company")
    assert not is_title_company("Western Alliance Bank")


def test_exact_maturity():
    e = maturity.exact(date(2027, 3, 1), TODAY)
    assert e.prob_12m == 1.0 and e.prob_24m == 1.0 and e.prob_past_due == 0
    past = maturity.exact(date(2026, 6, 6), TODAY)
    assert past.prob_past_due == 0.6 and "extended" in past.explanation
    ancient = maturity.exact(date(2015, 6, 6), TODAY)
    assert ancient.prob_12m == 0.15 and "repaid" in ancient.explanation


def test_estimate_community_bank_2021():
    # A 2021 community bank loan: the 5-year term lands in 2026 -> high near-term probability.
    e = maturity.estimate(date(2021, 11, 15), "community_bank", TODAY)
    assert e.basis == "estimated"
    assert e.prob_12m > 0.5
    assert e.p10 <= e.p50 <= e.p90


def test_stale_loan_fades():
    # A 2010 bank loan with no release recorded is most likely already gone.
    e = maturity.estimate(date(2010, 3, 1), "community_bank", TODAY)
    assert e.prob_12m < 0.2 and "already" in e.explanation


def test_estimate_life_company_recent_is_low_pressure():
    e = maturity.estimate(date(2024, 3, 1), "life_company", TODAY)
    assert e.prob_24m == 0


def test_modification_restarts_clock():
    e = maturity.estimate(date(2015, 1, 1), "community_bank", TODAY, modification_date=date(2025, 6, 1))
    assert "modification" in e.explanation
    assert e.p50 >= date(2026, 6, 1)


def test_known_term():
    e = maturity.estimate(date(2020, 1, 1), "sba_lender", TODAY, known_term_months=300)
    assert e.p50 == date(2045, 1, 1) and e.method == "known_term"


def test_score_high_pressure_park():
    rates = RateCurve()  # fallback table
    est = maturity.estimate(date(2021, 8, 1), "community_bank", TODAY)
    park = ParkFacts(state="AZ", kind="mhp", units=80, owner_entity_type="individual", owner_state="CA",
                     owner_park_count=1, held_since=date(2004, 5, 1))
    loan = LoanFacts(lender_kind="community_bank", lender_cre_concentration=340, start_date=date(2021, 8, 1),
                     original_amount=5_000_000, amort_months=300, estimate=est, noi=200_000)
    s = score(park, loan, rates, TODAY)
    assert s.components["rate_shock"]["shock_pct_pts"] > 2
    assert s.components["refi_gap"]["noi_basis"] == "reported"
    assert s.components["refi_gap"]["dscr_at_new_rate"] < 1.25
    assert s.total >= 60, s.components
    blank = score(park, LoanFacts(lender_kind="community_bank", start_date=date(2021, 8, 1),
                                  original_amount=5_000_000, estimate=est), rates, TODAY)
    assert blank.components["refi_gap"]["points"] is None


def test_score_free_and_clear_park_is_not_scored():
    s = score(ParkFacts(state="AZ", units=40, owner_entity_type="llc", owner_state="AZ", owner_park_count=5), None,
              RateCurve(), TODAY)
    assert s.total is None
    assert s.components["unscored"]["why"] == "Not scored — no loan on file."


def test_payment_math():
    assert round(payment(1_000_000, 6.0, 30)) == 5996
