"""Owner pressure score (0-100): how likely this owner is to need a sale or recapitalization soon.

  maturity     0-35  loan coming due within 12/24 months, or already past maturity
  rate_shock   0-20  refinance rate today minus the rate they borrowed at
  refi_gap     0-20  coverage at today's rate on a 25-year bank amortization (DSCR scale, not the dollar gap)
  lender       0-10  lender under pressure (high CRE concentration, CMBS loan delinquent or in special servicing)
  owner        0-15  long hold, out-of-state or individual owner, single-park owner

Each component returns its points plus the facts behind them. A missing input stays missing.
Weights are deliberately simple.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date

from .maturity import Estimate
from .rates import RateCurve

# The rent table is not an NOI. Owner pressure does not fill a blank park with it.
# The underwriting desk may show 90% and 40% only as labeled defaults on a form.
LOT_RENT = {"AZ": 700, "TX": 600, "FL": 800, "CA": 1000, "CO": 850, "NV": 750, "NM": 550, "UT": 700, "ND": 550,
            "_default": 650}
RV_SITE_MONTHLY = 450
OCCUPANCY = 0.90
EXPENSE_RATIO = 0.40
REFI_LTV_CAP = 0.75
SELLER_AMORT_YEARS = 25     # seller refinance test and the coverage score
DESK_AMORT_YEARS = 30       # our own loan on the underwriting desk
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
    held_since_basis: str = "deed"          # deed | reported owned-since date
    # From park_operating; None falls back to units and the statewide assumptions.
    lot_rent: float | None = None           # average monthly lot rent
    rentable_sites: int | None = None       # total sites less those under development
    occupancy: float | None = None          # 0-1
    operating_source: str | None = None
    value: float | None = None              # a saved asking or underwriting price; LTV is not applied without one


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
    total: float | None
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
    return noi_with_basis(p)[0]


def noi_with_basis(p: ParkFacts) -> tuple[float | None, str]:
    """Income for a pressure score. A blank rent, occupancy, or expense stays blank.

    Zero is a real figure. A statewide rent is never substituted. The 40% expense
    ratio is not applied here: there is no expense field on the pressure score.
    """
    sites = p.rentable_sites if p.rentable_sites is not None else p.units
    if sites is None:
        return None, "No income on file. Site count was not entered."
    if p.lot_rent is None:
        return None, "No income on file. Lot rent was not entered."
    if p.occupancy is None:
        return None, "No income on file. Occupancy was not entered."
    if sites == 0 or p.lot_rent == 0 or p.occupancy == 0:
        return 0.0, "Entered rent, occupancy, or rentable sites is zero."
    return None, "No income on file. An expense ratio was not entered."


def _blank(why: str) -> dict:
    return {"points": None, "scored": False, "why": why}


def score(park: ParkFacts, loan: LoanFacts | None, rates: RateCurve, today: date) -> Score:
    if loan is None:
        return Score(total=None, components={
            "unscored": _blank("Not scored — no loan on file."),
            "maturity": _blank("No loan on file. The payment, the balance, and the refinance gap stay blank."),
            "rate_shock": _blank("No loan on file."),
            "refi_gap": _blank("No loan on file. The payment, the balance, and the refinance gap stay blank."),
            "lender": _blank("No loan on file."),
            "owner": _blank("No loan on file."),
        })

    comp: dict[str, dict] = {}

    # --- maturity --------------------------------------------------------------------------
    if loan.payment_status == "foreclosure":
        comp["maturity"] = {"points": 35, "basis": "document",
                            "why": "Notice of trustee sale or lis pendens recorded: the lender is enforcing."}
    elif loan.estimate and loan.estimate.fully_amortizing:
        e = loan.estimate
        comp["maturity"] = {"points": 0, "likely": (e.likely or e.p50).isoformat() if (e.likely or e.p50) else None,
                            "p50": e.p50.isoformat() if e.p50 else None,
                            "prob_12m": e.prob_12m, "prob_24m": e.prob_24m, "basis": e.basis,
                            "why": "Fully amortizing — no balloon."}
    elif loan.estimate and loan.estimate.basis in ("document", "reported") and loan.estimate.p50 and loan.estimate.p50 < today:
        e = loan.estimate
        comp["maturity"] = {"points": 35, "likely": e.p50.isoformat(), "p50": e.p50.isoformat(),
                            "prob_12m": e.prob_12m, "prob_24m": e.prob_24m, "basis": e.basis,
                            "why": "Maturity date has passed. " + e.explanation}
    elif loan.estimate:
        e = loan.estimate
        pts = 35 * _clamp(0.55 * e.prob_12m + 0.30 * e.prob_24m + 0.15 * e.prob_past_due)
        comp["maturity"] = {"points": round(pts, 1), "likely": (e.likely or e.p50).isoformat() if (e.likely or e.p50) else None,
                            "p50": e.p50.isoformat() if e.p50 else None,
                            "prob_12m": e.prob_12m, "prob_24m": e.prob_24m, "basis": e.basis,
                            "why": e.explanation}
    else:
        comp["maturity"] = {"points": 0, "why": "No maturity date on this loan."}

    # --- rate shock ------------------------------------------------------------------------
    kind = loan.lender_kind
    spread, spread_basis, spread_n = rates.spread_for(kind)
    new_rate = rates.loan_rate(today, kind)
    old_rate = None
    old_basis = None
    if loan.note_rate is not None:
        old_rate, old_basis = loan.note_rate, "reported"
    elif loan.start_date:
        old_rate, old_basis = rates.loan_rate(loan.start_date, loan.lender_kind), "estimated"
    if old_rate is not None:
        shock = new_rate - old_rate
        comp["rate_shock"] = {"points": round(20 * _clamp(shock / 3.0), 1), "old_rate": round(old_rate, 2),
                              "old_rate_basis": old_basis,
                              "new_rate": new_rate, "shock_pct_pts": round(shock, 2),
                              "spread": spread, "spread_basis": spread_basis, "spread_n": spread_n}
    else:
        comp["rate_shock"] = {"points": 0, "new_rate": new_rate, "spread": spread,
                              "spread_basis": spread_basis, "spread_n": spread_n,
                              "why": "No note rate on file, and no origination date to estimate one."}

    # --- coverage at today's rate ----------------------------------------------------------
    # Only a reported NOI. Rent, occupancy, and a statewide guess do not fill this in.
    if loan.noi is not None:
        noi, noi_basis = loan.noi, "reported"
    else:
        noi, noi_basis = None, "No income on file."
    bal = loan.current_balance
    if bal is None and loan.original_amount is not None and loan.start_date and old_rate is not None:
        months = (today.year - loan.start_date.year) * 12 + today.month - loan.start_date.month
        amort = 0 if loan.interest_only else (loan.amort_months if loan.amort_months is not None else 300)
        bal = balance_after(loan.original_amount, old_rate, amort, max(0, months))
    if noi is None or bal is None:
        missing = "no income on file" if noi is None else "no balance on file"
        comp["refi_gap"] = {"points": None, "scored": False, "noi_basis": noi_basis,
                            "why": f"Coverage not scored — {missing}."}
        if bal is not None:
            comp["refi_gap"]["balance"] = round(bal)
            comp["refi_gap"]["balance_basis"] = "reported" if loan.current_balance is not None else "estimated"
    else:
        ds_new = payment(bal, new_rate, SELLER_AMORT_YEARS) * 12
        dscr_new = noi / ds_new if ds_new else None
        raw = bal * (dscr_new / DSCR_TEST) if dscr_new is not None else 0.0
        max_loan_dscr = max(0.0, raw)
        if park.value and park.value > 0:
            price_cap = park.value * REFI_LTV_CAP
            if max_loan_dscr <= price_cap:
                max_loan = max_loan_dscr
                bind = "1.25x DSCR binds"
            else:
                max_loan = price_cap
                bind = "75% of price (desk cap) binds"
            ltv_applied = True
        else:
            max_loan = max_loan_dscr
            bind = "no saved price, so the 75% LTV cap was not applied"
            ltv_applied = False
        gap = max(0.0, bal - max_loan)
        pts = 20 * _clamp((1.40 - dscr_new) / 0.55) if dscr_new is not None else 0
        comp["refi_gap"] = {
            "points": round(pts, 1), "scored": True, "noi": round(noi), "noi_basis": noi_basis,
            "balance": round(bal), "balance_basis": "reported" if loan.current_balance is not None else "estimated",
            "dscr_at_new_rate": round(dscr_new, 2) if dscr_new is not None else None,
            "equity_needed": round(gap), "ltv_applied": ltv_applied, "amort_years": SELLER_AMORT_YEARS,
            "why": f"{SELLER_AMORT_YEARS}-year bank amortization. {bind}",
        }

    # --- lender ----------------------------------------------------------------------------
    lp, lwhy = 0.0, []
    if loan.lender_cre_concentration is not None and loan.lender_cre_concentration >= 300:
        lp += 6; lwhy.append(f"lender CRE concentration {loan.lender_cre_concentration:.0f}% of capital")
    elif loan.lender_cre_concentration is not None and loan.lender_cre_concentration >= 200:
        lp += 3; lwhy.append(f"lender CRE concentration {loan.lender_cre_concentration:.0f}%")
    if loan.lender_kind in ("community_bank", "debt_fund"):
        lp += 2; lwhy.append(loan.lender_kind.replace("_", " "))
    if loan.payment_status and loan.payment_status not in ("0", "A", "B"):
        lp += 8; lwhy.append("foreclosure notice recorded" if loan.payment_status == "foreclosure" else
                             f"CMBS payment status {loan.payment_status} (delinquent or special servicing)")
    comp["lender"] = {"points": min(10, lp), "why": "; ".join(lwhy) or None}

    # --- owner -----------------------------------------------------------------------------
    op, owhy = 0.0, []
    held_note = "" if park.held_since_basis == "deed" else " (reported owned-since date)"
    if park.held_since:
        years = (today - park.held_since).days / 365.25
        if years >= 15:
            op += 5; owhy.append(f"held about {years:.0f} years{held_note}")
        elif years >= 8:
            op += 3; owhy.append(f"held about {years:.0f} years{held_note}")
    if park.owner_state and park.owner_state.upper() != park.state.upper():
        op += 3; owhy.append(f"owner based in {park.owner_state}")
    if park.owner_entity_type in ("individual", "trust"):
        article = "an" if park.owner_entity_type == "individual" else "a"
        op += 4; owhy.append(f"owned by {article} {park.owner_entity_type}")
    if park.owner_park_count == 1:
        op += 3; owhy.append("single-park owner")
    comp["owner"] = {"points": min(15, op), "why": "; ".join(owhy) or None}

    total = sum(comp[k]["points"] for k in ("maturity", "rate_shock", "refi_gap", "lender", "owner")
                if isinstance(comp[k]["points"], (int, float)))
    return Score(total=round(min(100, total), 1), components=comp)


def acquisition_fit(
    *,
    units: int | None,
    state: str | None,
    kind: str | None,
    note_rate: float | None,
    market_rate: float | None,
    km_to_managed: float | None,
    min_sites: int = 50,
    max_sites: int = 400,
    states: list[str] | None = None,
    kinds: list[str] | None = None,
) -> dict:
    """0-100 fit against the buy box. A missing fact scores 0 and says why, so parks stay comparable."""
    states = [s.upper() for s in (states or ["AZ"])]
    kinds = kinds or ["mhp", "rv", "mixed"]
    parts = []
    if units is None:
        parts.append({"key": "size", "points": 0, "max": 25, "why": "Site count is unknown."})
    elif min_sites <= units <= max_sites:
        parts.append({"key": "size", "points": 25, "max": 25, "why": f"{units} sites is inside {min_sites}-{max_sites}."})
    else:
        parts.append({"key": "size", "points": 0, "max": 25, "why": f"{units} sites is outside {min_sites}-{max_sites}."})
    st = (state or "").upper()
    parts.append({"key": "state", "points": 20 if st in states else 0, "max": 20,
                  "why": f"{st or 'Unknown state'} {'is' if st in states else 'is not'} in the buy box."})
    parts.append({"key": "kind", "points": 15 if kind in kinds else 0, "max": 15,
                  "why": f"{kind or 'unknown'} {'is' if kind in kinds else 'is not'} a type the box wants."})
    if note_rate is None or market_rate is None:
        parts.append({"key": "rate", "points": 0, "max": 20, "why": "No note rate to compare with today's rate."})
    elif note_rate + 0.50 <= market_rate:
        parts.append({"key": "rate", "points": 20, "max": 20,
                      "why": f"Note rate {note_rate:.2f}% is at least half a point inside today's {market_rate:.2f}%."})
    else:
        parts.append({"key": "rate", "points": 0, "max": 20,
                      "why": f"Note rate {note_rate:.2f}% is not inside today's {market_rate:.2f}%."})
    if km_to_managed is None:
        parts.append({"key": "distance", "points": 0, "max": 20, "why": "No managed park is marked, so distance is not scored."})
    elif km_to_managed <= 40:
        parts.append({"key": "distance", "points": 20, "max": 20,
                      "why": f"About {km_to_managed / 1.609:.0f} miles from a managed park."})
    else:
        parts.append({"key": "distance", "points": 0, "max": 20,
                      "why": f"About {km_to_managed / 1.609:.0f} miles from the nearest managed park."})
    return {"points": sum(p["points"] for p in parts), "parts": parts}
