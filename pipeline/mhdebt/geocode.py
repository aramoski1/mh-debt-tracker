"""US Census batch geocoder (free, 10,000 addresses per request).

POST https://geocoding.geo.census.gov/geocoder/locations/addressbatch
form: addressFile=<csv: id,street,city,state,zip  (no header)>, benchmark=Public_AR_Current
"""
from __future__ import annotations

import csv
import io

from .http import PoliteClient

URL = "https://geocoding.geo.census.gov/geocoder/locations/addressbatch"


def batch(client: PoliteClient, rows: list[tuple[str, str, str, str, str]]) -> dict[str, tuple[float, float]]:
    """rows: (id, street, city, state, zip). Returns id -> (lat, lon) for matched addresses."""
    out: dict[str, tuple[float, float]] = {}
    for i in range(0, len(rows), 9500):
        buf = io.StringIO()
        csv.writer(buf).writerows(rows[i:i + 9500])
        resp = client.post(URL, files={"addressFile": ("in.csv", buf.getvalue(), "text/csv")},
                           data={"benchmark": "Public_AR_Current"}, timeout=600)
        out.update(parse_response(resp.text))
    return out


def parse_response(text: str) -> dict[str, tuple[float, float]]:
    out = {}
    for rec in csv.reader(io.StringIO(text)):
        # id, input address, Match|No_Match|Tie, Exact|Non_Exact, matched address, "lon,lat", tigerline id, side
        if len(rec) >= 6 and rec[2] == "Match" and "," in rec[5]:
            lon, lat = rec[5].split(",")
            out[rec[0]] = (float(lat), float(lon))
    return out
