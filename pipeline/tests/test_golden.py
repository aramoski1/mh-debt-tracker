"""Hand-checked loan, score, and acquisition math.

Expected values live in fixtures/golden_parks.json. They were recomputed from the
annuity and score formulas, then compared with these functions. A failure here means
the code and that arithmetic diverged.
"""
import json
from datetime import date
from pathlib import Path

from mhdebt.maturity import estimate, exact
from mhdebt.rates import RateCurve
from mhdebt.scoring import (
    LoanFacts,
    ParkFacts,
    acquisition_fit,
    balance_after,
    noi_with_basis,
    payment_months,
    score,
)
from mhdebt.underwrite import irr, scenario

FIX = json.loads((Path(__file__).parent / "fixtures" / "golden_parks.json").read_text(encoding="utf-8"))
TODAY = date.fromisoformat(FIX["as_of"])
MATURITY = {row["id"]: row for row in FIX["maturity"] + FIX["extra_maturity"]}


def curve() -> RateCurve:
    monthly = {}
    for key, value in FIX["treasury_5y"].items():
        year, month = key.split("-")
        monthly[(int(year), int(month))] = value
    return RateCurve(monthly, FIX["measured_spreads"])


def _date(value):
    return date.fromisoformat(value) if value else None


def build_estimate(spec):
    if spec["mode"] == "exact":
        return exact(
            _date(spec["date"]), TODAY, basis=spec.get("basis", "reported"),
            fully_amortizing=spec.get("fully_amortizing", False),
            known_open=spec.get("known_open", False),
        )
    if spec["mode"] == "known_term":
        return estimate(
            _date(spec["start"]), spec["lender_kind"], TODAY,
            known_term_months=spec["known_term_months"],
            fully_amortizing=spec.get("fully_amortizing", False),
        )
    return estimate(_date(spec["start"]), spec["lender_kind"], TODAY)


def build_park(raw) -> ParkFacts:
    body = dict(raw)
    body["held_since"] = _date(body.get("held_since"))
    return ParkFacts(**body)


def build_loan(raw):
    if raw is None:
        return None
    body = dict(raw)
    maturity_id = body.pop("maturity", None)
    body["start_date"] = _date(body.get("start_date"))
    if maturity_id:
        body["estimate"] = build_estimate(MATURITY[maturity_id])
    return LoanFacts(**body)


def close(got, exp, tol, label):
    assert got is not None and abs(float(got) - float(exp)) <= tol, f"{label}: got {got}, expected {exp}"


def test_golden_payments():
    for row in FIX["payments"]:
        got = payment_months(row["principal"], row["rate"], row["months"])
        close(got, row["expected"], 0.05, f"payment {row['principal']} @ {row['rate']}% / {row['months']}")


def test_golden_balances():
    for row in FIX["balances"]:
        got = balance_after(row["principal"], row["rate"], row["amort_months"], row["months_paid"])
        close(got, row["expected"], 0.05, f"balance {row}")


def test_golden_noi():
    for row in FIX["noi"]:
        park = ParkFacts(
            state=row["state"], kind=row["kind"], units=row["units"],
            lot_rent=row.get("lot_rent"), occupancy=row.get("occupancy"),
        )
        got, basis = noi_with_basis(park)
        assert basis == row["basis"], (row["id"], basis)
        if row["expected"] is None:
            assert got is None, row["id"]
        else:
            close(got, row["expected"], 0.05, row["id"])


def test_golden_maturity():
    for row in FIX["maturity"] + FIX["extra_maturity"]:
        got = build_estimate(row)
        for key in ("prob_12m", "prob_24m", "prob_past_due"):
            if key in row:
                close(getattr(got, key), row[key], 0.001, f"{row['id']} {key}")
        for key in ("p10", "p50", "p90", "likely"):
            if key in row:
                value = getattr(got, key)
                assert value is not None and value.isoformat() == row[key], (row["id"], key, value)
        dates = [d for d in (got.p10, got.p50, got.p90) if d is not None]
        assert dates == sorted(dates), row["id"]


def _part(got, exp, label):
    if exp is None:
        assert got is None, f"{label}: got {got}, expected missing"
    else:
        close(got, exp, 0.1, label)


def test_golden_scores():
    rates = curve()
    for row in FIX["parks"]:
        got = score(build_park(row["park"]), build_loan(row["loan"]), rates, TODAY)
        exp = row["expected"]
        label = row["id"]
        if exp["total"] is None:
            assert got.total is None, label
        else:
            close(got.total, exp["total"], 0.1, f"{label} total")
        parts = got.components
        _part(parts["maturity"]["points"], exp["maturity"], f"{label} maturity")
        _part(parts["rate_shock"]["points"], exp["rate_shock"], f"{label} rate shock")
        _part(parts["refi_gap"]["points"], exp["refi_gap"], f"{label} refi")
        _part(parts["lender"]["points"], exp["lender"], f"{label} lender")
        _part(parts["owner"]["points"], exp["owner"], f"{label} owner")
        noi, basis = noi_with_basis(build_park(row["park"]))
        if exp["noi"] is None:
            assert noi is None, label
        else:
            close(noi, exp["noi"], 0.05, f"{label} noi")
        assert basis == exp["noi_basis"], (label, basis)
        if "old_rate" in exp:
            close(parts["rate_shock"]["old_rate"], exp["old_rate"], 0.01, f"{label} old rate")
        if "old_rate_basis" in exp:
            assert parts["rate_shock"]["old_rate_basis"] == exp["old_rate_basis"], label
        if "new_rate" in exp:
            close(parts["rate_shock"]["new_rate"], exp["new_rate"], 0.01, f"{label} new rate")
        if "shock_pct_pts" in exp:
            close(parts["rate_shock"]["shock_pct_pts"], exp["shock_pct_pts"], 0.01, f"{label} shock")
        if "spread_basis" in exp:
            assert parts["rate_shock"]["spread_basis"] == exp["spread_basis"], label
            close(parts["rate_shock"]["spread"], exp["spread"], 0.01, f"{label} spread")
        if "dscr" in exp:
            close(parts["refi_gap"]["dscr_at_new_rate"], exp["dscr"], 0.01, f"{label} dscr")
            close(parts["refi_gap"]["equity_needed"], exp["equity_needed"], 1, f"{label} equity")
            close(parts["refi_gap"]["noi"], exp["refi_noi"], 1, f"{label} refi noi")
            close(parts["refi_gap"]["balance"], exp["refi_balance"], 1, f"{label} balance")
            assert parts["refi_gap"]["ltv_applied"] is exp["ltv_applied"], label
        if "refi_noi_basis" in exp:
            assert parts["refi_gap"]["noi_basis"] == exp["refi_noi_basis"], label
        if "balance_basis" in exp:
            assert parts["refi_gap"]["balance_basis"] == exp["balance_basis"], label
        part_sum = sum(parts[k]["points"] for k in ("maturity", "rate_shock", "refi_gap", "lender", "owner")
                       if isinstance(parts[k]["points"], (int, float)))
        if got.total is not None:
            close(got.total, min(100, part_sum), 0.05, f"{label} total is the sum of the parts")


def test_golden_scenarios():
    assert irr([-100, 0, 121]) == 10.0
    for row in FIX["scenarios"]:
        kwargs = {k: v for k, v in row.items() if k != "expected"}
        got = scenario(**kwargs)
        exp = row["expected"]
        assert got["ok"] is True
        assert got["binding"] == exp["binding"], kwargs
        for key in ("noi", "loan", "equity", "exit_value", "balance_at_exit"):
            close(got[key], exp[key], 1, f"{key} {kwargs['annual_rate_pct']}")
        close(got["cash_on_cash"], exp["cash_on_cash"], 0.01, "cash on cash")
        close(got["irr"], exp["irr"], 0.01, "irr")
    refused = scenario(price=0, sites=10, lot_rent=700, occupancy=0.9, expense_ratio=0.4,
                       cap_rate_pct=8, rent_growth=0, annual_rate_pct=7)
    assert refused["ok"] is False


def test_golden_python_fit():
    for row in FIX["fit"]:
        got = acquisition_fit(
            units=row["units"], state=row["state"], kind=row["kind"],
            note_rate=row["note_rate"], market_rate=row["market_rate"],
            km_to_managed=row["km_to_managed"],
        )
        assert got["points"] == row["expected"], (row, got["points"])


def test_zero_note_rate_is_a_real_rate():
    """A reported 0% coupon originated this month is 675 bps inside today's rate."""
    loan = LoanFacts(lender_kind="community_bank", start_date=TODAY, note_rate=0.0, current_balance=1_000_000)
    shock = score(ParkFacts(state="AZ", units=80), loan, curve(), TODAY).components["rate_shock"]
    assert shock["old_rate"] == 0.0
    assert shock["old_rate_basis"] == "reported"
    assert shock["points"] == 20.0


def test_zero_coupon_balance_amortizes_at_zero():
    """65 months into a 300-month 0% loan, the balance is principal times 235/300."""
    loan = LoanFacts(
        lender_kind="community_bank", start_date=date(2021, 6, 15), note_rate=0.0,
        original_amount=1_000_000, amort_months=300,
    )
    gap = score(ParkFacts(state="AZ", units=80), loan, curve(), TODAY).components["refi_gap"]
    close(gap["balance"], 783_333.33, 1, "0% remaining balance")


def test_zero_noi_is_not_replaced():
    loan = LoanFacts(
        lender_kind="community_bank", start_date=date(2021, 6, 15), note_rate=5.0,
        current_balance=1_000_000, noi=0.0,
    )
    gap = score(ParkFacts(state="AZ", units=80), loan, curve(), TODAY).components["refi_gap"]
    assert gap["noi"] == 0
    assert gap["points"] == 20.0


def test_zero_lot_rent_is_not_replaced():
    noi, _basis = noi_with_basis(ParkFacts(state="AZ", units=100, lot_rent=0.0, occupancy=0.9))
    assert noi == 0


def test_zero_rentable_sites_are_not_replaced_with_total_units():
    noi, _basis = noi_with_basis(ParkFacts(state="AZ", units=100, rentable_sites=0, lot_rent=700, occupancy=0.9))
    assert noi == 0


def test_note_rate_without_a_start_date_still_sets_the_shock():
    loan = LoanFacts(lender_kind="community_bank", note_rate=4.0, current_balance=1_000_000)
    shock = score(ParkFacts(state="AZ", units=80), loan, curve(), TODAY).components["rate_shock"]
    close(shock["points"], 18.3, 0.1, "shock points")
    close(shock["old_rate"], 4.0, 0.01, "old rate")


def test_negative_income_does_not_size_a_negative_loan():
    loan = LoanFacts(
        lender_kind="cmbs_trust", start_date=date(2024, 8, 1), note_rate=5.1,
        current_balance=1_000_000, noi=-100_000,
    )
    gap = score(ParkFacts(state="AZ", units=80), loan, curve(), TODAY).components["refi_gap"]
    assert gap["equity_needed"] <= gap["balance"]


def test_seller_coverage_worked_example():
    """Hand-checked 25-year bank test. Today's rate is the 7% in the example, not the treasury curve."""
    pay = payment_months(5_000_000, 7.0, 25 * 12)
    assert abs(pay - 35_338.96) < 0.01
    annual = pay * 12
    assert round(annual) == 424_068
    dscr = 450_000 / annual
    assert round(dscr, 2) == 1.06
    points = round(20 * max(0.0, min(1.0, (1.40 - dscr) / 0.55)), 1)
    assert points == 12.3
    max_loan = 450_000 / (1.25 * (annual / 5_000_000))
    assert abs(max_loan - 4_244_607) < 1
    assert abs(5_000_000 - max_loan - 755_393) < 1


def test_fully_amortizing_prior_is_not_a_balloon():
    got = estimate(date(2001, 11, 11), "sba_lender", TODAY)
    assert got.fully_amortizing
    assert got.prob_12m == 0
    assert "Fully amortizing — no balloon." in got.explanation
    assert "0% chance" not in got.explanation
