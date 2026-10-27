"""Owner pressure score (0-100): how likely this owner is to need a sale or recapitalization soon.

  maturity     0-35  loan coming due within 12/24 months, or already past maturity
  rate_shock   0-20  refinance rate today minus the rate they borrowed at
  refi_gap     0-20  whether the park's income still covers debt service at today's rate (DSCR < 1.25 = gap)
  lender       0-10  lender under pressure (high CRE concentration, CMBS loan delinquent or in special servicing)
  owner        0-15  long hold, out-of-state or individual owner, single-park owner

Each component returns its points plus the facts behind them, so a broker can see *why* a park ranks high.
Weights are deliberately simple; tune them from which calls turn into listings.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date

from .maturity import Estimate
from .rates import RateCurve

# Assumed average monthly lot rent by state, used only when a park's income isn't reported.
# National average asking lot rent was about $752 in Q2 2025 (Northmarq). Replace with MHVillage or
# Cooper Cardinal's own rent rolls for target markets.
LOT_RENT = {"AZ": 700, "TX": 600, "FL": 800, "CA": 1000, "CO": 850, "NV": 750, "NM": 550, "UT": 700, "ND": 550,
            "_default": 650}
RV_SITE_MONTHLY = 450       # blended monthly revenue per RV site, very rough
OCCUPANCY = 0.90
EXPENSE_RATIO = 0.40        # MH parks commonly run 35-45%
REFI_LTV_CAP = 0.75
REFI_AMORT_YEARS = 30
DSCR_TEST = 1.25


@dataclass
class ParkFacts:
    state: str
    kind: str = "unknown"
    units: int | None = None
    owner_entity_type: str = "unknown"
    owner_state: str | None = None
    owner_park_count: int | None = None  # None: owner unknown
    held_since: date | None = None


@dataclass
class LoanFacts:
    lender_kind: str = "unknown"
    lender_cre_concentration: float | None = None
    start_date: date | None = None          # origination or recording date
    note_rate: float | None = None
    original_amount: float | None = None
    current_balance: float | None = None
    amort_months: int | None = None
    interest_only: bool | None = None
    noi: float | None = None
    payment_status: str | None = None       # CMBS: 0 current, 1+ delinquent/special servicing
    estimate: Estimate | None = None


@dataclass
class Score:
    total: float
    components: dict = field(default_factory=dict)


def _clamp(x: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, x))


def payment_months(principal: float, annual_rate_pct: float, months: int) -> float:
    r = annual_rate_pct / 100 / 12
    if months <= 0:
        return principal * r  # interest only
    if r == 0:
        return principal / months
    return principal * r / (1 - (1 + r) ** -months)


def payment(principal: float, annual_rate_pct: float, years: int) -> float:
    return payment_months(principal, annual_rate_pct, years * 12)


def balance_after(principal: float, annual_rate_pct: float, amort_months: int, months_paid: int) -> float:
    """Remaining balance after `months_paid` payments; amort_months <= 0 means interest only."""
    if amort_months <= 0:
        return principal
    months_paid = min(months_paid, amort_months)
    r = annual_rate_pct / 100 / 12
    if r == 0:
        return principal * (1 - months_paid / amort_months)
    pmt = payment_months(principal, annual_rate_pct, amort_months)
    return max(0.0, principal * (1 + r) ** months_paid - pmt * ((1 + r) ** months_paid - 1) / r)


def estimated_noi(p: ParkFacts) -> float | None:
    if not p.units:
        return None
    monthly = RV_SITE_MONTHLY if p.kind == "rv" else LOT_RENT.get(p.state, LOT_RENT["_default"])
    return p.units * monthly * 12 * OCCUPANCY * (1 - EXPENSE_RATIO)


def score(park: ParkFacts, loan: LoanFacts | None, rates: RateCurve, today: date) -> Score:
    comp: dict[str, dict] = {}

    # --- maturity --------------------------------------------------------------------------
    if loan and loan.payment_status == "foreclosure":
        comp["maturity"] = {"points": 35, "basis": "document",
                            "why": "Notice of trustee sale or lis pendens recorded: the lender is enforcing."}
    elif loan and loan.estimate:
        e = loan.estimate
        pts = 35 * _clamp(0.55 * e.prob_12m + 0.30 * e.prob_24m + 0.15 * e.prob_past_due)
        comp["maturity"] = {"points": round(pts, 1), "likely": (e.likely or e.p50).isoformat() if (e.likely or e.p50) else None,
                            "p50": e.p50.isoformat() if e.p50 else None,
                            "prob_12m": e.prob_12m, "prob_24m": e.prob_24m, "basis": e.basis,
                            "why": e.explanation}
    else:
        comp["maturity"] = {"points": 0, "why": "No recorded loan found (possibly owned free and clear)."}

    # --- rate shock ------------------------------------------------------------------------
    new_rate = rates.loan_rate(today, loan.lender_kind if loan else "community_bank")
    old_rate = None
    if loan and loan.start_date:
        old_rate = loan.note_rate or rates.loan_rate(loan.start_date, loan.lender_kind)
        shock = new_rate - old_rate
        comp["rate_shock"] = {"points": round(20 * _clamp(shock / 3.0), 1), "old_rate": round(old_rate, 2),
                              "old_rate_basis": "reported" if loan.note_rate else "estimated",
                              "new_rate": new_rate, "shock_pct_pts": round(shock, 2)}
    else:
        comp["rate_shock"] = {"points": 0}

    # --- refinance gap ---------------------------------------------------------------------
    noi = (loan.noi if loan and loan.noi else None) or estimated_noi(park)
    noi_basis = "reported" if loan and loan.noi else "estimated from units and market lot rent"
    bal = None
    if loan:
        bal = loan.current_balance
        if bal is None and loan.original_amount and loan.start_date and old_rate:
            months = (today.year - loan.start_date.year) * 12 + today.month - loan.start_date.month
            amort = 0 if loan.interest_only else (loan.amort_months or 300)
            bal = balance_after(loan.original_amount, old_rate, amort, max(0, months))
    if noi and bal:
        ds_new = payment(bal, new_rate, REFI_AMORT_YEARS) * 12
        dscr_new = noi / ds_new if ds_new else None
        # Proceeds a lender would offer: the lower of the DSCR test and the LTV cap at a market cap rate.
        max_loan_dscr = bal * (dscr_new / DSCR_TEST) if dscr_new else 0
        gap = max(0.0, bal - max_loan_dscr)
        pts = 20 * _clamp((1.40 - dscr_new) / 0.55) if dscr_new else 0
        comp["refi_gap"] = {"points": round(pts, 1), "noi": round(noi), "noi_basis": noi_basis,
                            "balance": round(bal), "balance_basis": "reported" if loan.current_balance else "estimated",
                            "dscr_at_new_rate": round(dscr_new, 2) if dscr_new else None,
                            "equity_needed": round(gap, -3)}
    else:
        comp["refi_gap"] = {"points": 0, "why": "Not enough data (need loan amount and units or income)."}

    # --- lender ----------------------------------------------------------------------------
    lp, lwhy = 0.0, []
    if loan:
        if loan.lender_cre_concentration and loan.lender_cre_concentration >= 300:
            lp += 6; lwhy.append(f"lender CRE concentration {loan.lender_cre_concentration:.0f}% of capital")
        elif loan.lender_cre_concentration and loan.lender_cre_concentration >= 200:
            lp += 3; lwhy.append(f"lender CRE concentration {loan.lender_cre_concentration:.0f}%")
        if loan.lender_kind in ("community_bank", "debt_fund"):
            lp += 2; lwhy.append(loan.lender_kind.replace("_", " "))
        if loan.payment_status and loan.payment_status not in ("0", "A", "B"):
            lp += 8; lwhy.append("foreclosure notice recorded" if loan.payment_status == "foreclosure" else
                                 f"CMBS payment status {loan.payment_status} (delinquent or special servicing)")
    comp["lender"] = {"points": min(10, lp), "why": "; ".join(lwhy) or None}

    # --- owner -----------------------------------------------------------------------------
    op, owhy = 0.0, []
    if park.held_since:
        years = (today - park.held_since).days / 365.25
        if years >= 15:
            op += 5; owhy.append(f"held about {years:.0f} years")
        elif years >= 8:
            op += 3; owhy.append(f"held about {years:.0f} years")
    if park.owner_state and park.owner_state.upper() != park.state.upper():
        op += 3; owhy.append(f"owner based in {park.owner_state}")
    if park.owner_entity_type in ("individual", "trust"):
        op += 4; owhy.append(f"owned by an {park.owner_entity_type}")
    if park.owner_park_count == 1:
        op += 3; owhy.append("single-park owner")
    comp["owner"] = {"points": min(15, op), "why": "; ".join(owhy) or None}

    total = sum(c["points"] for c in comp.values())
    return Score(total=round(min(100, total), 1), components=comp)
