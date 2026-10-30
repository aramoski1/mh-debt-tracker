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
