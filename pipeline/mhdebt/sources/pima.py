"""Pima County, Arizona: parcels (free GIS layer) and recorder documents (free portal, manual export).

Parcels  https://gisdata.pima.gov/arcgis1/rest/services/GISOpenData/LandRecords/MapServer/12
         PARCEL_USE codes for parks are assumed to follow the Arizona 08xx structure used by Maricopa.
         Run `mhdebt probe pima` to list distinct PARCEL_USE values and confirm before relying on it.
         The owner name is usually MAIL1. DOCKET/PAGE/RECORDDATE point at the last recorded deed.

Recorder https://pimacountyaz-web.tylerhost.net/web  (free to search and view; no documented API)
         Search by the owner name for DEED OF TRUST / RELEASE / MODIFICATION, export the results, and load
         them with `mhdebt ingest recorder-export --county pima --file results.csv`.
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Iterator

from ..http import PoliteClient
from ..normalize import parse_date, parse_money
from . import arcgis
from .doc_types import normalize_doc_type
from .tabular import read_rows

PARCELS = "https://gisdata.pima.gov/arcgis1/rest/services/GISOpenData/LandRecords/MapServer/12"
PARK_WHERE = os.getenv("PIMA_PARK_WHERE", "PARCEL_USE >= '0840' AND PARCEL_USE <= '0899'")


def park_parcels(client: PoliteClient) -> Iterator[dict]:
    from .maricopa import park_kind_from_puc

    for a in arcgis.query(client, PARCELS, where=PARK_WHERE, page_size=2000, geometry=True):
        apn = a.get("PARCEL")
        if not apn:
            continue
        mail = [a.get(f"MAIL{i}") for i in range(1, 6) if a.get(f"MAIL{i}")]
        city_state_zip = mail[-1] if len(mail) >= 2 else ""
        parts = str(city_state_zip).rsplit(" ", 2)
        acres = a.get("GISACRES")
        yield {
            "county": "pima",
            "apn": str(apn),
            "state": "AZ",
            "situs_address": a.get("ADDRESS_OL"),
            "situs_city": None,
            "situs_zip": None,
            "owner_name": mail[0] if mail else None,
            "owner_mailing": " ".join(mail[1:-1]) if len(mail) > 2 else None,
            "owner_city": parts[0] if len(parts) == 3 else None,
            "owner_state": parts[1] if len(parts) == 3 else None,
            "owner_zip": parts[2][:5] if len(parts) == 3 else None,
            "land_use_code": a.get("PARCEL_USE"),
            "land_use_desc": park_kind_from_puc(a.get("PARCEL_USE")),
            "acres": parse_money(acres),
            "lat": a.get("LAT") or a.get("_lat"),
            "lon": a.get("LON") or a.get("_lon"),
            "last_sale_date": parse_date(a.get("RECORDDATE")),
            "last_sale_price": None,
            "deed_number": f"{a.get('DOCKET')}-{a.get('PAGE')}" if a.get("DOCKET") else None,
            "raw": a,
        }


EXPORT_ALIASES = {
    "number": ["Document Number", "Recording Number", "Instrument Number", "Sequence", "Doc Number", "Fee Number"],
    "type": ["Document Type", "Doc Type", "Type", "Instrument Type"],
    "date": ["Recording Date", "Recorded Date", "Record Date", "Date Recorded"],
    "grantor": ["Grantor", "Grantors", "From", "Grantor Name"],
    "grantee": ["Grantee", "Grantees", "To", "Grantee Name"],
    "amount": ["Consideration", "Amount", "Loan Amount"],
    "parcel": ["Parcel", "Parcel Number", "APN", "Legal"],
    "related": ["Related Documents", "Reference", "Related"],
}


def load_recorder_export(path: Path | str, county: str = "pima") -> Iterator[dict]:
    """Load a search-results export from a county recorder portal into recorded_documents rows."""
    for r in read_rows(path, EXPORT_ALIASES):
        num = (r["number"] or "").strip()
        if not num:
            continue
        split = lambda v: [x.strip() for x in str(v or "").replace(";", "|").split("|") if x.strip()]  # noqa: E731
        yield {
            "county": county,
            "recording_number": num,
            "doc_type": normalize_doc_type(r["type"]),
            "doc_type_raw": r["type"],
            "recording_date": parse_date(r["date"]),
            "grantors": split(r["grantor"]),
            "grantees": split(r["grantee"]),
            "amount": parse_money(r["amount"]),
            "apns": split(r["parcel"]),
            "references_number": (r["related"] or "").strip() or None,
            "raw": {k: v for k, v in r.items() if v},
        }
