"""Median note spread over the Treasury on the origination date.

Built only from loans already in the database (CMBS and SBA) that have both a
note rate and an origination date. A kind is used in the model only when the
sample is at least MIN_SAMPLE. Smaller samples are stored and shown, and left
out of the rate.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import date
from statistics import median

MIN_SAMPLE = 8


def median_spreads(loans: list[dict], treasury_on) -> list[dict]:
    """loans: source, lender_kind, note_rate, origination_date (date).

    treasury_on(date) -> percent, or None when no print exists on or before that day.
    """
    buckets: dict[tuple[str, str], list[float]] = defaultdict(list)
    for ln in loans:
        start = ln.get("origination_date")
        rate = ln.get("note_rate")
        if start is None or rate is None:
            continue
        if not isinstance(start, date):
            continue
        t = treasury_on(start)
        if t is None:
            continue
        buckets[(ln.get("source") or "unknown", ln.get("lender_kind") or "unknown")].append(float(rate) - float(t))
    out = []
    for (source, kind), xs in sorted(buckets.items()):
        out.append({
            "source": source,
            "lender_kind": kind,
            "median_spread": round(float(median(xs)), 3),
            "sample_size": len(xs),
            "usable": len(xs) >= MIN_SAMPLE,
        })
    return out


# Nearest constant-maturity Treasury we already store. Park loans are not priced off the 1-month bill.
TENORS = (("DGS5", 60), ("DGS7", 84), ("DGS10", 120))


def tenor_for_term(term_months: int | None) -> tuple[str, str]:
    """(FRED series, method). A missing term stays on the 5-year and is labeled as such."""
    if not term_months or term_months <= 0:
        return "DGS5", "term_unknown_uses_5y"
    series = min(TENORS, key=lambda item: (abs(item[1] - term_months), item[1]))[0]
    return series, "matching_tenor"


def quarter_label(d: date) -> str:
    return f"{d.year}Q{(d.month - 1) // 3 + 1}"


def spreads_by_term(loans: list[dict], rate_on) -> list[dict]:
    """loans may include term_months. rate_on(series, date) -> percent, or None.

    One row per source, lender type, Treasury tenor, origination quarter, and method.
    A loan with no term is not mixed into the matching-tenor sample for that quarter.
    """
    buckets: dict[tuple, list[float]] = defaultdict(list)
    for ln in loans:
        start = ln.get("origination_date")
        note = ln.get("note_rate")
        if not isinstance(start, date) or note is None:
            continue
        tenor, method = tenor_for_term(ln.get("term_months"))
        base = rate_on(tenor, start)
        if base is None:
            continue
        key = (ln.get("source") or "unknown", ln.get("lender_kind") or "unknown", tenor, quarter_label(start), method)
        buckets[key].append(float(note) - float(base))
    out = []
    for (source, kind, tenor, quarter, method), xs in sorted(buckets.items()):
        out.append({
            "source": source,
            "lender_kind": kind,
            "tenor": tenor,
            "quarter": quarter,
            "method": method,
            "median_spread": round(float(median(xs)), 3),
            "sample_size": len(xs),
            "usable": len(xs) >= MIN_SAMPLE,
        })
    return out


def spread_for_model(rows: list[dict]) -> dict[str, dict]:
    """One spread per lender kind: the usable sample with the most loans."""
    best: dict[str, dict] = {}
    for r in rows:
        if not r.get("usable") and r.get("sample_size", 0) < MIN_SAMPLE:
            continue
        kind = r["lender_kind"]
        if kind not in best or r["sample_size"] > best[kind]["n"]:
            best[kind] = {"median": float(r["median_spread"]), "n": int(r["sample_size"]), "source": r["source"]}
    return best
