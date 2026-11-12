"""Maturity estimation.

When a loan's maturity date is published (agency, CMBS, SBA) or stated in the recorded document, we use it.
Otherwise we estimate it as a probability distribution over the loan terms typical for that lender type,
conditioned on what the public record tells us since origination:

  * term priors by lender type (TERM_PRIORS) - tune with Cooper Cardinal's banking contacts
  * a recorded modification restarts the clock with a short extension
  * a loan still open (no release recorded) after a candidate maturity date makes that term less likely,
    but not impossible: extensions and late-recorded releases are common. That residual mass is reported
    as "past due or extended", itself a strong pressure signal.

Outputs p10/p50/p90 dates and the probability the loan comes due within 12 and 24 months.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date

from .normalize import add_months

# months -> probability. Long fully-amortizing terms (180+) carry no balloon, so they produce little pressure.
TERM_PRIORS: dict[str, dict[int, float]] = {
    "community_bank": {36: 0.12, 60: 0.50, 84: 0.15, 120: 0.15, 240: 0.08},
    "regional_bank":  {36: 0.10, 60: 0.45, 84: 0.20, 120: 0.20, 240: 0.05},
    "national_bank":  {36: 0.10, 60: 0.40, 84: 0.20, 120: 0.25, 240: 0.05},
    "credit_union":   {60: 0.50, 120: 0.35, 240: 0.15},
    "agency_fannie":  {60: 0.15, 84: 0.25, 120: 0.60},
    "agency_freddie": {60: 0.15, 84: 0.25, 120: 0.60},
    "agency_lender":  {60: 0.15, 84: 0.25, 120: 0.60},
    "cmbs_trust":     {60: 0.20, 120: 0.80},
    "conduit_lender": {60: 0.20, 120: 0.80},
    "life_company":   {120: 0.50, 180: 0.35, 240: 0.15},
    "debt_fund":      {24: 0.30, 36: 0.45, 60: 0.25},
    "sba_lender":     {300: 1.0},
    "individual":     {36: 0.15, 60: 0.35, 84: 0.20, 120: 0.30},   # seller financing
    "government":     {360: 1.0},
    "unknown":        {36: 0.10, 60: 0.40, 84: 0.15, 120: 0.30, 240: 0.05},
}
# A modification on a park loan is usually a short extension.
EXTENSION_PRIOR = {12: 0.30, 24: 0.30, 36: 0.25, 60: 0.15}


def p_open_after(months_past: int) -> float:
    """Chance a loan is still open this long after its contractual maturity with no release recorded
    (refinance in progress, extension, forbearance, or a release that hasn't been recorded yet)."""
    if months_past <= 6:
        return 0.60
    if months_past <= 18:
        return 0.35
    return 0.15
BALLOON_FREE_MONTHS = 180  # terms this long are assumed fully amortizing


@dataclass
class Estimate:
    p10: date | None
    p50: date | None
    p90: date | None
    prob_12m: float
    prob_24m: float
    prob_past_due: float
    basis: str
    method: str
    explanation: str
    likely: date | None = None   # single most likely date (mode); what the app shows by default
    fully_amortizing: bool = False


def _quantile(points: list[tuple[date, float]], q: float) -> date | None:
    total = sum(w for _, w in points)
    if total <= 0:
        return None
    acc = 0.0
    for d, w in sorted(points):
        acc += w / total
        if acc >= q - 1e-9:
            return d
    return sorted(points)[-1][0]


AMORTIZING_PRESSURE = 0.15  # a loan that pays itself down by maturity creates little refinance pressure


def exact(maturity: date, today: date, basis: str = "reported", fully_amortizing: bool = False,
          known_open: bool = False) -> Estimate:
    """known_open: the loan appears in a current servicer report (CMBS, agency), so it is certainly still open."""
    months_out = (maturity.year - today.year) * 12 + (maturity.month - today.month)
    past = maturity < today
    # A stated date long past with no payoff recorded is most likely a payoff we can't see.
    still_open = p_open_after(-months_out) if past and not known_open else 1.0
    expl = f"Maturity {maturity.isoformat()} ({'reported by the lender/servicer' if basis == 'reported' else 'stated in the recorded document'})."
    if past and known_open:
        expl += " The date has passed and the loan is still in the servicer's report: extended, in default, or being worked out."
    elif past and still_open >= 0.35:
        expl += " The date has passed with no payoff recorded: likely extended, refinancing, or in default."
    elif past:
        expl += " The date passed long ago; the loan was most likely repaid without a recorded release."
    k = AMORTIZING_PRESSURE if fully_amortizing else 1.0
    if fully_amortizing:
        expl += " Fully amortizing — no balloon."
    return Estimate(
        p10=maturity, p50=maturity, p90=maturity, likely=maturity,
        prob_12m=k * still_open if past or months_out <= 12 else 0.0,
        prob_24m=k * still_open if past or months_out <= 24 else 0.0,
        prob_past_due=k * still_open if past else 0.0,
        basis=basis, method="exact", explanation=expl, fully_amortizing=fully_amortizing,
    )


def estimate(
    start: date,
    lender_kind: str,
    today: date,
    *,
    modification_date: date | None = None,
    known_term_months: int | None = None,
    fully_amortizing: bool = False,
) -> Estimate:
    """Distribution over maturity dates for a loan with no stated maturity."""
    if known_term_months:
        pays_off = fully_amortizing or known_term_months >= BALLOON_FREE_MONTHS
        est = exact(add_months(start, known_term_months), today, basis="estimated", fully_amortizing=pays_off)
        est.method = "known_term"
        est.explanation = f"Term of {known_term_months} months from {start.isoformat()}."
        if pays_off:
            est.explanation += " Fully amortizing — no balloon."
        return est
    if modification_date and modification_date > start:
        anchor, prior, why = modification_date, EXTENSION_PRIOR, f"modification recorded {modification_date.isoformat()}"
    else:
        anchor, prior = start, TERM_PRIORS.get(lender_kind, TERM_PRIORS["unknown"])
        why = f"{lender_kind.replace('_', ' ')} loan recorded {start.isoformat()}"

    # Each candidate term gets weight  prior(term) x P(still open | that term).  The weights are NOT
    # renormalized: whatever mass is lost is the chance the loan was already paid off or refinanced without a
    # release we can see. That keeps a 2010 loan with no recorded payoff from looking "past due".
    points: list[tuple[date, float]] = []
    balloon_points: list[tuple[date, float]] = []
    for months, p in prior.items():
        m = add_months(anchor, months)
        months_past = (today.year - m.year) * 12 + today.month - m.month
        w = p * (p_open_after(months_past) if m < today else 1.0)
        points.append((m, w))
        if months < BALLOON_FREE_MONTHS:  # long terms fully amortize: no balloon, little refinance pressure
            balloon_points.append((m, w))
    p_open = sum(w for _, w in points)
    in12 = sum(w for d, w in balloon_points if (d - today).days <= 366)
    in24 = sum(w for d, w in balloon_points if (d - today).days <= 731)
    p_past = sum(w for d, w in balloon_points if d < today)

    likely = max(points, key=lambda x: x[1])[0] if points else None
    balloon_free = not balloon_points
    if balloon_free and likely:
        expl = (f"Estimated from {why}. Fully amortizing — no balloon. "
                f"The term ends {likely.isoformat()}.")
    else:
        expl = (f"Estimated from {why}. Most likely maturity {likely.isoformat() if likely else 'unknown'}; "
                f"{round(in24 * 100)}% chance it comes due within 24 months")
        if p_past > 0.05:
            expl += f", {round(p_past * 100)}% chance it is already past its original maturity (extended or unreleased)"
        expl += "."
        if p_open < 0.6:
            expl += (f" No payoff is recorded, but there is about a {round((1 - p_open) * 100)}% chance it was already "
                     "repaid or refinanced without a release in our data.")
    return Estimate(
        p10=_quantile(points, 0.10), p50=_quantile(points, 0.50), p90=_quantile(points, 0.90),
        prob_12m=round(in12, 3), prob_24m=round(in24, 3), prob_past_due=round(p_past, 3),
        basis="estimated", method=f"term_prior:{lender_kind}" + (":extension" if anchor != start else ""),
        explanation=expl, likely=likely, fully_amortizing=balloon_free,
    )
