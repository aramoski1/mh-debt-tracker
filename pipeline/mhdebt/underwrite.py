"""Back-of-the-envelope acquisition math. Every input is passed in; nothing is filled from a guess.

Cash-on-cash is year-1 cash flow divided by equity. The year-5 figure compounds rent,
sells at the same cap rate, and pays off the remaining balance. IRR is the annual
rate that zeros those cash flows. It is math on the inputs, not a forecast.
"""
from __future__ import annotations

from .scoring import DSCR_TEST, REFI_AMORT_YEARS, REFI_LTV_CAP, payment, balance_after


def noi(sites: float, lot_rent: float, occupancy: float, expense_ratio: float) -> float:
    return sites * lot_rent * 12 * occupancy * (1 - expense_ratio)


def proceeds(value: float, year_noi: float, annual_rate_pct: float) -> tuple[float, str]:
    """The lower of the LTV cap and the DSCR test. Both need a value and income."""
    by_ltv = value * REFI_LTV_CAP
    debt_service_cap = year_noi / DSCR_TEST
    # Loan whose payment equals the DSCR cap.
    # payment(L) * 12 = debt_service_cap => L = debt_service_cap / (payment(1) * 12)
    unit = payment(1.0, annual_rate_pct, REFI_AMORT_YEARS) * 12
    by_dscr = debt_service_cap / unit if unit else 0.0
    if by_ltv <= by_dscr:
        return by_ltv, "ltv"
    return by_dscr, "dscr"


def irr(cashflows: list[float]) -> float | None:
    """Annual IRR as a percent. None when the flows do not change sign or Newton fails."""
    if not cashflows or not (any(c > 0 for c in cashflows) and any(c < 0 for c in cashflows)):
        return None
    rate = 0.10
    for _ in range(40):
        npv = sum(c / (1 + rate) ** t for t, c in enumerate(cashflows))
        d = sum(-t * c / (1 + rate) ** (t + 1) for t, c in enumerate(cashflows))
        if abs(d) < 1e-12:
            return None
        nxt = rate - npv / d
        if nxt <= -0.99:
            nxt = -0.99
        if abs(nxt - rate) < 1e-7:
            return round(nxt * 100, 2)
        rate = nxt
    return None


def scenario(
    *,
    price: float,
    sites: float,
    lot_rent: float,
    occupancy: float,
    expense_ratio: float,
    cap_rate_pct: float,
    rent_growth: float,
    annual_rate_pct: float,
    years: int = 5,
) -> dict:
    """One financing case. occupancy and expense_ratio and rent_growth are fractions (0.90, 0.40, 0.03)."""
    if price <= 0 or cap_rate_pct <= 0 or sites <= 0:
        return {"ok": False, "why": "Need a price, a cap rate, and a site count."}
    base = noi(sites, lot_rent, occupancy, expense_ratio)
    loan, binding = proceeds(price, base, annual_rate_pct)
    equity = price - loan
    if equity <= 0:
        return {"ok": False, "why": "The loan would cover the whole price. Raise the cap rate or lower the loan."}
    debt_service = payment(loan, annual_rate_pct, REFI_AMORT_YEARS) * 12
    cash = base - debt_service
    flows = [-equity]
    for t in range(1, years + 1):
        noi_t = base * (1 + rent_growth) ** t
        flows.append(noi_t - debt_service)
    exit_noi = base * (1 + rent_growth) ** years
    exit_value = exit_noi / (cap_rate_pct / 100)
    balance = balance_after(loan, annual_rate_pct, REFI_AMORT_YEARS * 12, years * 12)
    flows[-1] += exit_value - balance
    return {
        "ok": True,
        "noi": round(base),
        "loan": round(loan),
        "binding": binding,
        "equity": round(equity),
        "cash_on_cash": round(cash / equity * 100, 2),
        "irr": irr(flows),
        "exit_value": round(exit_value),
        "balance_at_exit": round(balance),
    }
