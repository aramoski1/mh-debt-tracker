"""Normalization for names, addresses, dates and money, shared by every source."""
from __future__ import annotations

import re
from datetime import date, datetime
from typing import Any

_PUNCT = re.compile(r"[^\w\s&]")
_SPACES = re.compile(r"\s+")

ENTITY_SUFFIXES = {
    "LLC", "L L C", "LLLP", "LP", "L P", "LLP", "INC", "INCORPORATED", "CORP", "CORPORATION", "CO",
    "COMPANY", "LTD", "LIMITED", "PLLC", "PC", "NA", "N A", "FSB", "TRUST", "TR", "TRUSTEE", "TRUSTEES",
    "THE", "ET AL", "ETAL", "ET UX", "ETUX",
}

PARK_WORDS = {
    "MOBILE", "HOME", "HOMES", "PARK", "PARKS", "MHP", "MHC", "RV", "R V", "RESORT", "COMMUNITY",
    "COMMUNITIES", "ESTATES", "VILLAGE", "MANUFACTURED", "HOUSING", "TRAILER", "COURT", "CT", "MANOR",
    "CAMPGROUND", "CAMP",
}

STREET_ABBR = {
    "STREET": "ST", "AVENUE": "AVE", "ROAD": "RD", "DRIVE": "DR", "BOULEVARD": "BLVD", "LANE": "LN",
    "HIGHWAY": "HWY", "PARKWAY": "PKWY", "COURT": "CT", "PLACE": "PL", "TERRACE": "TER", "CIRCLE": "CIR",
    "TRAIL": "TRL", "WAY": "WAY", "NORTH": "N", "SOUTH": "S", "EAST": "E", "WEST": "W",
    "NORTHEAST": "NE", "NORTHWEST": "NW", "SOUTHEAST": "SE", "SOUTHWEST": "SW",
}


def clean(s: Any) -> str:
    if s is None:
        return ""
    s = str(s).upper().replace("&AMP;", "&")
    s = _PUNCT.sub(" ", s)
    return _SPACES.sub(" ", s).strip()


def norm_entity(name: Any) -> str:
    """Normalize a person or company name for matching: 'Sunny Acres MHP, L.L.C.' -> 'SUNNY ACRES MHP'."""
    words = _join_initials(clean(name).split())
    # strip trailing suffix tokens repeatedly, and a leading THE
    while words and (words[-1] in ENTITY_SUFFIXES or " ".join(words[-2:]) in ENTITY_SUFFIXES):
        if " ".join(words[-2:]) in ENTITY_SUFFIXES:
            words = words[:-2]
        else:
            words = words[:-1]
    if words and words[0] == "THE":
        words = words[1:]
    return " ".join(words)


def _join_initials(words: list[str]) -> list[str]:
    """['L', 'L', 'C'] -> ['LLC'];  ['N', 'A'] -> ['NA']. Keeps single initials inside person names."""
    out: list[str] = []
    run: list[str] = []
    for w in [*words, ""]:
        if len(w) == 1 and w.isalpha():
            run.append(w)
            continue
        if len(run) >= 2:
            out.append("".join(run))
        else:
            out.extend(run)
        run = []
        if w:
            out.append(w)
    return out


def norm_park_name(name: Any) -> str:
    """Core identifying words of a park name: 'Desert Sun Mobile Home Park' -> 'DESERT SUN'."""
    words = [w for w in norm_entity(name).split() if w not in PARK_WORDS]
    return " ".join(words) or norm_entity(name)


def norm_address(addr: Any) -> str:
    words = clean(addr).split()
    return " ".join(STREET_ABBR.get(w, w) for w in words)


def street_number(addr: Any) -> str | None:
    m = re.match(r"\s*(\d+)", str(addr or ""))
    return m.group(1) if m else None


def zip5(z: Any) -> str | None:
    m = re.search(r"\d{5}", str(z or ""))
    return m.group(0) if m else None


def entity_type(name: Any) -> str:
    n = clean(name)
    toks = set(n.split())
    if re.search(r"\bL ?L ?C\b|\bLLLP\b|\bL ?P\b|\bLLP\b|\bPLLC\b", n):
        return "llc" if "LLC" in n.replace(" ", "") else "partnership"
    if toks & {"TRUST", "TR", "TRUSTEE", "TRUSTEES", "REVOCABLE", "LIVING", "FAMILY"} and "BANK" not in toks:
        return "trust"
    if toks & {"INC", "CORP", "CORPORATION", "INCORPORATED", "CO", "COMPANY", "LTD"}:
        return "corp"
    if toks & {"REIT", "PROPERTIES", "COMMUNITIES", "HOLDINGS", "FUND", "PARTNERS", "CAPITAL", "INVESTMENTS"}:
        return "corp"
    if 2 <= len(toks) <= 5 and not any(ch.isdigit() for ch in n):
        return "individual"
    return "unknown"


_DATE_FORMATS = ("%m-%d-%Y", "%Y-%m-%d", "%m/%d/%Y", "%Y%m%d", "%m/%d/%y", "%d-%b-%Y", "%b %d, %Y", "%B %d, %Y")


def parse_date(v: Any) -> date | None:
    if v is None or v == "":
        return None
    if isinstance(v, datetime):
        return v.date()
    if isinstance(v, date):
        return v
    s = str(v).strip()
    if s.isdigit() and len(s) == 13:  # epoch milliseconds (ArcGIS)
        return datetime.utcfromtimestamp(int(s) / 1000).date()
    s = s.split("T")[0]
    for fmt in _DATE_FORMATS:
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    return None


def parse_money(v: Any) -> float | None:
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return float(v)
    s = re.sub(r"[^\d.\-]", "", str(v))
    try:
        return float(s) if s not in ("", "-", ".") else None
    except ValueError:
        return None


def parse_pct(v: Any) -> float | None:
    """Rates arrive as 0.0425 or 4.25; always return percent (4.25)."""
    x = parse_money(v)
    if x is None:
        return None
    return round(x * 100, 6) if 0 < x < 1 else x


def parse_share_pct(v: Any) -> float | None:
    """Shares such as occupancy: 0.95 and 95 both mean 95%, and 1.0 means 100%."""
    x = parse_money(v)
    if x is None:
        return None
    return round(x * 100, 4) if 0 <= x <= 1.0 else x


def months_between(a: date, b: date) -> int:
    return (b.year - a.year) * 12 + (b.month - a.month)


def add_months(d: date, months: int) -> date:
    y, m = divmod(d.month - 1 + months, 12)
    year, month = d.year + y, m + 1
    for day in (d.day, 30, 29, 28):
        try:
            return date(year, month, day)
        except ValueError:
            continue
    raise ValueError("bad date")


_UPPER = {"MHP", "MHC", "RV", "LLC", "LP", "LLLP", "II", "III", "IV", "KOA", "USA", "NA", "N.A.", "FSB", "CMBS", "AZ"}
_LOWER = {"of", "and", "the", "at", "in", "on", "for", "a", "an"}


def nice_title(s: str | None) -> str | None:
    """'SAGUARO VISTA MHP' -> 'Saguaro Vista MHP';  'COMMERCE BANK OF ARIZONA' -> 'Commerce Bank of Arizona'."""
    if not s:
        return s
    out = []
    for i, w in enumerate(str(s).split()):
        core = w.strip(",.").upper()
        if core in _UPPER:
            out.append(w.upper())
        elif i > 0 and w.lower() in _LOWER:
            out.append(w.lower())
        else:
            out.append(w[:1].upper() + w[1:].lower())
    return " ".join(out)
