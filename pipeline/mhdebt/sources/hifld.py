"""HIFLD Mobile Home Parks: the federal list of mobile home and RV parks, with location, type, units and phone.

HIFLD Open went offline in Aug 2025. The public copy that still answers is the Homeland Infrastructure
Foundation-Level Data archive published by the Federal User Community on ArcGIS Online (about 56,000
parks, including Arizona). The NASA NCCS mirror of the same layer is kept as a fallback; it sometimes
returns 503. A different item also named Mobile Home Parks only covers a few dozen California sites, so
it is not used.

Field names are uppercase on the archive and lowercase on the NASA mirror; both are handled.
type: MOBILE HOME PARK | RECREATIONAL VEHICLE PARK | MHP/RV/MIGRANT HOUSING
units: -999 means unknown.  It undercounts in places, so county parcel data fills the gaps.
"""
from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Iterator

from ..http import PoliteClient
from ..normalize import nice_title
from . import arcgis

log = logging.getLogger("mhdebt.hifld")

# (layer url, state-field name). The archive is the copy that answers; NASA is the same layer when it is up.
MIRRORS = (
    ("https://services2.arcgis.com/FiaPA4ga0iQKduv3/arcgis/rest/services/Mobile_Home_Parks_Archive/FeatureServer/0", "STATE"),
    ("https://maps.nccs.nasa.gov/mapping/rest/services/hifld_open/public_venues/FeatureServer/3", "state"),
)


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
    hid = a.get("mhpid") or a.get("id") or a.get("objectid") or ""
    if isinstance(hid, float) and hid.is_integer():
        hid = int(hid)
    hid = str(hid)
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
    errors: list[Exception] = []
    for url, field in MIRRORS:
        where = " OR ".join(f"{field}='{s}'" for s in states) if states else "1=1"
        try:
            batch = list(arcgis.query(client, url, where=where, page_size=2000, geometry=True))
        except Exception as exc:  # noqa: BLE001 - try the next public copy
            log.warning("HIFLD source failed (%s): %s", url, exc)
            errors.append(exc)
            continue
        if not batch:
            log.warning("HIFLD source returned no rows: %s", url)
            continue
        for attrs in batch:
            rec = normalize(attrs)
            if rec:
                yield rec
        return
    if errors:
        raise errors[-1]
    raise RuntimeError("HIFLD sources returned no parks")


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
