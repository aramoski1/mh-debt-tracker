"""Per-park operating figures (rent, sites, vacancy, park type, owned-since) from broker entry or an imported file.

Rows live in `park_operating`, one per observation. `merge` takes the newest non-empty value of each field, so a
later entry that only updates rent keeps the site count from an earlier one. `occupancy` turns sites and vacancy into
a fill rate; scoring uses it in place of the flat statewide assumption.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from pathlib import Path
from typing import Iterator

from .normalize import clean, parse_date, parse_money, parse_share_pct
from .sources.tabular import read_rows

NUMERIC = ("rent_current", "rent_jan_this", "rent_jan_last", "rent_jan_prior", "occupancy_pct", "rv_share_pct")
INTEGER = ("total_sites", "vacant_sites", "dev_sites", "park_owned_homes", "empty_homes", "year_built")
OTHER = ("age_restricted", "land_tenure", "owned_since", "amenities")
FIELDS = NUMERIC + INTEGER + OTHER


@dataclass
class Operating:
    values: dict = field(default_factory=dict)
    sources: dict = field(default_factory=dict)  # field -> "source, observed_on"

    def get(self, k: str):
        return self.values.get(k)

    def occupancy(self) -> float | None:
        """Share of rentable sites that are occupied, 0-1. A stated percentage wins over a computed one."""
        if self.get("occupancy_pct") is not None:
            return float(self.get("occupancy_pct")) / 100
        total, vacant = self.get("total_sites"), self.get("vacant_sites")
        if not total or vacant is None:
            return None
        rentable = total - (self.get("dev_sites") or 0)
        if rentable <= 0:
            return None
        return max(0.0, min(1.0, (rentable - vacant) / rentable))

    def rentable_sites(self) -> int | None:
        total = self.get("total_sites")
        if not total:
            return None
        return max(0, total - (self.get("dev_sites") or 0))

    def source_of(self, *keys: str) -> str | None:
        seen = [self.sources[k] for k in keys if k in self.sources]
        return "; ".join(dict.fromkeys(seen)) or None


def merge(rows: list[dict]) -> Operating:
    """rows: park_operating rows for one park, newest first (observed_on desc, created_at desc)."""
    op = Operating()
    for r in rows:
        for k in FIELDS:
            v = r.get(k)
            if v is None or v == "" or k in op.values:
                continue
            op.values[k] = float(v) if k in NUMERIC else v
            op.sources[k] = f"{r['source']}, {r['observed_on']}"
    return op


# ---------------------------------------------------------------------------
# Import files
# ---------------------------------------------------------------------------

ALIASES: dict[str, list[str]] = {
    "park_id": ["Tracker ID", "Park ID", "park_id"],
    "name": ["Community Name", "Park Name", "Property Name", "Community", "Name"],
    "address": ["Street Address", "Address", "Property Address", "Street"],
    "city": ["City"],
    "state": ["State"],
    "zip": ["Zip Code", "Zip", "Postal Code"],
    "lat": ["Latitude", "Lat"],
    "lon": ["Longitude", "Lon", "Long", "Lng"],
    "as_of": ["As Of", "As Of Date", "Report Date", "Survey Date"],
    "rent_current": ["Current Site Rent", "Average Site Rent", "Avg Lot Rent", "Lot Rent", "Site Rent"],
    "rent_jan_this": ["Rent Jan 1 This Year", "Site Rent Jan 1 Current Year", "Rent Jan This Year"],
    "rent_jan_last": ["Rent Jan 1 Last Year", "Site Rent Jan 1 Prior Year", "Rent Jan Last Year"],
    "rent_jan_prior": ["Rent Jan 1 Two Years Ago", "Site Rent Jan 1 Two Years Prior", "Rent Jan Prior Year"],
    "total_sites": ["Total Sites", "Total Lots", "Total Pads", "Total Units"],
    "vacant_sites": ["Vacant Sites", "Vacant Lots", "Vacancies"],
    "dev_sites": ["Sites Under Development", "Undeveloped Sites", "Development Sites"],
    "park_owned_homes": ["Park Owned Homes", "Community Owned Homes", "Rental Homes", "POH"],
    "empty_homes": ["Empty Homes", "Vacant Homes"],
    "occupancy_pct": ["Occupancy", "Occupancy %", "Occupancy Rate", "Fill Rate", "Physical Occupancy"],
    "rv_share_pct": ["RV Sites %", "Percent RV Sites", "RV Share", "RV %"],
    "age_restricted": ["Age Restriction", "Age Restricted", "55+", "Age Type"],
    "year_built": ["Year Built", "Year Opened", "Year Established"],
    "land_tenure": ["Land Ownership", "Land Owned or Leased", "Land Tenure"],
    "owned_since": ["Owned Since", "Current Owner Since", "Acquisition Date", "Date Acquired"],
    "amenities": ["Amenities", "Community Amenities"],
}


def _int(v) -> int | None:
    x = parse_money(v)
    return int(round(x)) if x is not None else None


def _age_restricted(v) -> bool | None:
    s = clean(v)
    if not s:
        return None
    if "ALL" in s or "FAMILY" in s or s in ("N", "NO", "FALSE", "0"):
        return False
    if "55" in s or "62" in s or "SENIOR" in s or "AGE" in s or s in ("Y", "YES", "TRUE", "1"):
        return True
    return None


def _tenure(v) -> str | None:
    s = clean(v)
    if "LEASE" in s or "GROUND" in s:
        return "leased"
    if "OWN" in s or "FEE" in s:
        return "owned"
    return None


def parse_row(r: dict) -> dict:
    """Normalize one logical-field row from read_rows into park_operating columns."""
    out: dict = {}
    for k in ("rent_current", "rent_jan_this", "rent_jan_last", "rent_jan_prior"):
        out[k] = parse_money(r.get(k))
    for k in ("total_sites", "vacant_sites", "dev_sites", "park_owned_homes", "empty_homes", "year_built"):
        out[k] = _int(r.get(k))
    for k in ("occupancy_pct", "rv_share_pct"):
        x = parse_share_pct(r.get(k))
        out[k] = x if x is None or 0 <= x <= 100 else None
    out["age_restricted"] = _age_restricted(r.get("age_restricted"))
    out["land_tenure"] = _tenure(r.get("land_tenure"))
    out["owned_since"] = parse_date(r.get("owned_since"))
    out["amenities"] = (str(r["amenities"]).strip() or None) if r.get("amenities") else None
    return out


def load(path: Path | str, default_as_of: date) -> Iterator[dict]:
    """Yield {'match': {...identity...}, 'observed_on': date, 'values': {...}} for rows with at least one figure."""
    for r in read_rows(path, ALIASES):
        values = parse_row(r)
        if all(v is None for v in values.values()):
            continue
        yield {
            "match": {k: (str(r[k]).strip() if r.get(k) not in (None, "") else None)
                      for k in ("park_id", "name", "address", "city", "state", "zip", "lat", "lon")},
            "observed_on": parse_date(r.get("as_of")) or default_as_of,
            "values": values,
        }
