"""Entity resolution: which park does this loan, parcel or document belong to?

Parks arrive from several lists (HIFLD, county parcels, CMBS and agency loan files) with different names,
abbreviations and coordinates. A candidate pair is scored on name, street address, zip and distance; pairs
above MATCH_THRESHOLD are linked, and the confidence is stored so weak links can be reviewed.
"""
from __future__ import annotations

import math
from dataclasses import dataclass

from rapidfuzz import fuzz

from .normalize import norm_address, norm_park_name, street_number, zip5

MATCH_THRESHOLD = 0.70
NEARBY_METERS = 400


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6_371_000
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


@dataclass
class Candidate:
    id: str
    name: str | None
    address: str | None
    city: str | None
    zip: str | None
    lat: float | None
    lon: float | None


@dataclass
class Probe:
    name: str | None
    address: str | None
    city: str | None
    zip: str | None
    lat: float | None = None
    lon: float | None = None


def _contradicts(p: Probe, c: Candidate) -> bool:
    """Different zip (or city) and no matching street number: not the same place, whatever the name says."""
    same_number = bool(street_number(p.address)) and street_number(p.address) == street_number(c.address)
    if same_number:
        return False
    if zip5(p.zip) and zip5(c.zip) and zip5(p.zip) != zip5(c.zip):
        return True
    if p.city and c.city and fuzz.ratio(p.city.upper(), c.city.upper()) < 85:
        return True
    return False


def similarity(p: Probe, c: Candidate) -> float:
    if _contradicts(p, c):
        return 0.0
    score, weight = 0.0, 0.0

    pn, cn = norm_park_name(p.name), norm_park_name(c.name)
    if pn and cn:
        score += 0.40 * fuzz.token_set_ratio(pn, cn) / 100
        weight += 0.40

    pa, ca = norm_address(p.address), norm_address(c.address)
    if pa and ca:
        same_num = street_number(pa) and street_number(pa) == street_number(ca)
        street_sim = fuzz.token_sort_ratio(pa, ca) / 100
        score += 0.35 * (0.5 * bool(same_num) + 0.5 * street_sim)
        weight += 0.35

    if zip5(p.zip) and zip5(c.zip):
        score += 0.10 * (zip5(p.zip) == zip5(c.zip))
        weight += 0.10
    elif p.city and c.city:
        score += 0.10 * (fuzz.ratio(p.city.upper(), c.city.upper()) > 90)
        weight += 0.10

    if None not in (p.lat, p.lon, c.lat, c.lon):
        d = haversine_m(p.lat, p.lon, c.lat, c.lon)
        score += 0.15 * max(0.0, 1 - d / 1500)
        weight += 0.15

    return score / weight if weight else 0.0


def best_match(p: Probe, candidates: list[Candidate]) -> tuple[Candidate | None, float]:
    best, best_s = None, 0.0
    for c in candidates:
        s = similarity(p, c)
        if s > best_s:
            best, best_s = c, s
    return (best, round(best_s, 3)) if best_s >= MATCH_THRESHOLD else (None, round(best_s, 3))


def nearest(lat: float, lon: float, candidates: list[Candidate], within_m: float = NEARBY_METERS) -> Candidate | None:
    best, best_d = None, within_m
    for c in candidates:
        if c.lat is None or c.lon is None:
            continue
        d = haversine_m(lat, lon, c.lat, c.lon)
        if d <= best_d:
            best, best_d = c, d
    return best
