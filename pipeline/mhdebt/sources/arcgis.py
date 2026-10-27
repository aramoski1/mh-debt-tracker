"""Paged queries against ArcGIS REST MapServer/FeatureServer layers (most county and federal GIS data)."""
from __future__ import annotations

from typing import Iterator

from ..http import PoliteClient


def query(
    client: PoliteClient,
    layer_url: str,
    where: str = "1=1",
    out_fields: str = "*",
    page_size: int = 1000,
    geometry: bool = False,
    extra: dict | None = None,
    cache_ttl: float | None = 86400,
) -> Iterator[dict]:
    """Yield feature attribute dicts (plus _lat/_lon when geometry is requested and the feature is a point)."""
    offset = 0
    while True:
        params = {
            "where": where, "outFields": out_fields, "returnGeometry": str(geometry).lower(),
            "resultOffset": offset, "resultRecordCount": page_size, "f": "json", "outSR": 4326,
            **(extra or {}),
        }
        data = client.get(f"{layer_url.rstrip('/')}/query", params=params, cache_ttl=cache_ttl).json()
        if "error" in data:
            raise RuntimeError(f"ArcGIS error from {layer_url}: {data['error']}")
        feats = data.get("features", [])
        for f in feats:
            attrs = dict(f.get("attributes", {}))
            g = f.get("geometry") or {}
            if "x" in g and "y" in g:
                attrs["_lon"], attrs["_lat"] = g["x"], g["y"]
            elif "rings" in g and g["rings"]:
                ring = g["rings"][0]
                attrs["_lon"] = sum(p[0] for p in ring) / len(ring)
                attrs["_lat"] = sum(p[1] for p in ring) / len(ring)
            yield attrs
        if not feats or not data.get("exceededTransferLimit", len(feats) >= page_size):
            break
        offset += len(feats)


def distinct(client: PoliteClient, layer_url: str, field: str, where: str = "1=1") -> list:
    data = client.get(
        f"{layer_url.rstrip('/')}/query",
        params={"where": where, "outFields": field, "returnDistinctValues": "true", "returnGeometry": "false",
                "f": "json"},
    ).json()
    return sorted({f["attributes"].get(field) for f in data.get("features", [])}, key=lambda v: str(v))
