"""HIFLD Mobile Home Parks: ~43,000 mobile home and RV parks with location, type and unit counts.

HIFLD Open went offline in Aug 2025. Two working copies:
  * Live ArcGIS mirror (NASA NCCS):
    https://maps.nccs.nasa.gov/mapping/rest/services/hifld_open/public_venues/FeatureServer/3
  * DataLumos archive (snapshot 2024-09-16): https://www.datalumos.org/datalumos/project/239601
    download mobile-home-parks-geojson.zip, unzip, and pass the .geojson path to `load_geojson`.

Field names are lowercase in the mirror and uppercase in some downloads; both are handled.
type: MOBILE HOME PARK | RECREATIONAL VEHICLE PARK | MHP/RV/MIGRANT HOUSING
units: -999 means unknown.  It undercounts in places, so county parcel data fills the gaps.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Iterator

from ..http import PoliteClient
from ..normalize import nice_title
from . import arcgis

MIRROR = "https://maps.nccs.nasa.gov/mapping/rest/services/hifld_open/public_venues/FeatureServer/3"


def _kind(t: str | None) -> str:
    t = (t or "").upper()
    if "MOBILE" in t and "RV" in t:
        return "mixed"
    if "RECREATIONAL" in t or t.startswith("RV"):
        return "rv"
    if "MOBILE" in t:
        return "mhp"
    return "unknown"


def normalize(attrs: dict) -> dict | None:
    a = {k.lower(): v for k, v in attrs.items()}
    units = a.get("units")
    try:
        units = int(units) if units not in (None, "", "NOT AVAILABLE") and int(units) > 0 else None
    except (TypeError, ValueError):
        units = None
    status = (a.get("status") or "").upper()
    if status == "CLOSED":
        return None
    hid = str(a.get("mhpid") or a.get("id") or a.get("objectid") or "")
    if not hid:
        return None
    return {
        "source_id": hid,
        "name": nice_title(a.get("name") or ""),
        "address": nice_title(a.get("address")) or None,
        "city": nice_title(a.get("city")) or None,
        "state": (a.get("state") or "").upper(),
        "zip": str(a.get("zip") or "")[:5] or None,
        "county": nice_title(a.get("county")) or None,
        "lat": a.get("latitude") or a.get("_lat"),
        "lon": a.get("longitude") or a.get("_lon"),
        "kind": _kind(a.get("type")),
        "units": units,
        "status": status or None,
        "website": a.get("website") if a.get("website") not in ("NOT AVAILABLE", "") else None,
        "phone": a.get("telephone") if a.get("telephone") not in ("NOT AVAILABLE", "") else None,
    }


def fetch(client: PoliteClient, states: list[str]) -> Iterator[dict]:
    where = " OR ".join(f"state='{s}'" for s in states) if states else "1=1"
    for attrs in arcgis.query(client, MIRROR, where=where, page_size=2000, geometry=True):
        rec = normalize(attrs)
        if rec:
            yield rec


def load_geojson(path: Path | str, states: list[str]) -> Iterator[dict]:
    data = json.loads(Path(path).read_text())
    for f in data.get("features", []):
        attrs = dict(f.get("properties") or {})
        coords = (f.get("geometry") or {}).get("coordinates")
        if coords and len(coords) == 2:
            attrs["_lon"], attrs["_lat"] = coords
        rec = normalize(attrs)
        if rec and (not states or rec["state"] in states):
            yield rec
