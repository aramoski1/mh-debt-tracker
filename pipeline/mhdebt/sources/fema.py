"""FEMA National Flood Hazard Layer, flood zone at a point.

Verified 2026-10-30 against MapServer layer 28 (flood hazard zones):
  https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query
A Phoenix point returned FLD_ZONE "X". No API key.
"""
from __future__ import annotations

NFHL_ZONES = "https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query"


def parse_flood(payload: dict) -> str | None:
    """Zone code, or None when the service returned no polygon for the point."""
    feats = payload.get("features") or []
    if not feats:
        return None
    zone = (feats[0].get("attributes") or {}).get("FLD_ZONE")
    return str(zone) if zone else None


def flood_zone(client, lon: float, lat: float) -> str | None:
    r = client.get(NFHL_ZONES, params={
        "geometry": f"{lon},{lat}",
        "geometryType": "esriGeometryPoint",
        "inSR": "4326",
        "spatialRel": "esriSpatialRelIntersects",
        "outFields": "FLD_ZONE,ZONE_SUBTY",
        "returnGeometry": "false",
        "f": "json",
    }, cache_ttl=30 * 86400)
    return parse_flood(r.json())
