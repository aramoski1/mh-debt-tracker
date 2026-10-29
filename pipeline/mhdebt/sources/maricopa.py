"""Maricopa County, Arizona: assessor parcels (free GIS layer) and recorder documents (free public API).

Parcels   https://gis.mcassessor.maricopa.gov/arcgis/rest/services/Parcels/MapServer/0
          PUC 0840-0849 mobile home parks, 0850-0859 RV/travel trailer parks, 0860-0869 MH co-ops,
          0870 RV co-op, 0880 RV subdivision, 0890-0899 mixed MH/RV parks. (0810-0839 are MH subdivision lots.)
          DEED_NUMBER is the recording number of the most recent deed.

Recorder  https://publicapi.recorder.maricopa.gov  (no key)
          GET /documents/{recordingNumber}          -> index data: names, document codes, date, page count
          GET /preview/pdf?recordingNumber={n}&suffix= -> the scanned document as a PDF
          These endpoints are not formally documented. Run `mhdebt probe maricopa` first; it prints the
          raw responses so field names can be confirmed, and `_doc_from_json` adjusted if they differ.

How we find loans without a search API:
  1. Acquisition loans: when a park is bought with financing, the deed of trust is recorded immediately
     after the deed, so it sits at DEED_NUMBER + 1 (occasionally +2..+4). We check those numbers.
  2. Refinances, modifications and releases after the purchase: a name search on the owner entity.
     The search endpoint is configurable (MARICOPA_RECORDER_SEARCH_URL) because it is undocumented.
     GET /documents/search accepts beginDate, endDate, documentCode, pageSize and pageNumber, but a
     live check on 2026-10-27 showed it ignores `name` and returns empty `names`, so do not point the
     setting at that URL. Without a real name search, step 1 still covers every financed acquisition.
"""
from __future__ import annotations

import os
import re
from datetime import date
from typing import Iterator

from ..http import PoliteClient
from ..normalize import clean, norm_entity, parse_date, parse_money
from . import arcgis
from .doc_types import normalize_doc_type

PARCELS = "https://gis.mcassessor.maricopa.gov/arcgis/rest/services/Parcels/MapServer/0"
RECORDER = os.getenv("MARICOPA_RECORDER_API", "https://publicapi.recorder.maricopa.gov")
SEARCH_URL = os.getenv("MARICOPA_RECORDER_SEARCH_URL", "")  # must actually filter by name; /documents/search does not
PARK_WHERE = "PUC >= '0840' AND PUC <= '0899'"
ADJACENT_LOOKAHEAD = 4
MAX_SEARCH_PAGES = 20


def park_kind_from_puc(puc: str | None) -> str:
    p = (puc or "").strip()
    if p[:3] in ("084", "086"):
        return "mhp"
    if p[:3] == "085" or p in ("0870", "0880"):
        return "rv"
    if p[:3] == "089":
        return "mixed"
    return "unknown"


def park_parcels(client: PoliteClient) -> Iterator[dict]:
    for a in arcgis.query(client, PARCELS, where=PARK_WHERE, page_size=1000, geometry=True):
        apn = a.get("APN") or a.get("APN_DASH")
        if not apn:
            continue
        yield {
            "county": "maricopa",
            "apn": str(apn),
            "state": "AZ",
            "situs_address": a.get("PHYSICAL_ADDRESS"),
            "situs_city": a.get("PHYSICAL_CITY"),
            "situs_zip": str(a.get("PHYSICAL_ZIP") or "")[:5] or None,
            "owner_name": a.get("OWNER_NAME"),
            "owner_mailing": a.get("MAIL_ADDR1") or a.get("MAIL_ADDRESS"),
            "owner_city": a.get("MAIL_CITY"),
            "owner_state": a.get("MAIL_STATE"),
            "owner_zip": str(a.get("MAIL_ZIP") or "")[:5] or None,
            "land_use_code": a.get("PUC"),
            "land_use_desc": park_kind_from_puc(a.get("PUC")),
            "acres": (parse_money(a.get("LAND_SIZE")) or 0) / 43560 or None,
            "lat": a.get("LATITUDE") or a.get("_lat"),
            "lon": a.get("LONGITUDE") or a.get("_lon"),
            "last_sale_date": parse_date(a.get("SALE_DATE") or a.get("DEED_DATE")),
            "last_sale_price": parse_money(a.get("SALE_PRICE")),
            "deed_number": str(a.get("DEED_NUMBER") or "").strip() or None,
            "subdivision": a.get("SUBNAME"),
            "raw": a,
        }


# ---------------------------------------------------------------------------
# Recorder
# ---------------------------------------------------------------------------

def _first(d: dict, *keys: str):
    for k in keys:
        if k in d and d[k] not in (None, "", []):
            return d[k]
    lower = {k.lower(): v for k, v in d.items()}
    for k in keys:
        if k.lower() in lower and lower[k.lower()] not in (None, "", []):
            return lower[k.lower()]
    return None


def _doc_from_json(num: str, j: dict) -> dict:
    codes = _first(j, "documentCodes", "documentCode", "docCodes", "codes") or []
    if isinstance(codes, str):
        codes = [codes]
    codes = [c.get("description") or c.get("code") if isinstance(c, dict) else str(c) for c in codes]
    names = _first(j, "names", "parties", "grantorGrantee") or []
    if isinstance(names, str):
        names = [part.strip() for part in re.split(r"[;|]", names) if part.strip()]
    grantors, grantees, flat = [], [], []
    for n in names:
        if isinstance(n, dict):
            nm = n.get("name") or n.get("fullName") or ""
            role = (n.get("type") or n.get("role") or n.get("partyType") or "").upper()
            (grantors if role.startswith(("GRANTOR", "TRUSTOR", "MORTGAGOR", "1")) else
             grantees if role.startswith(("GRANTEE", "BENEFICIARY", "MORTGAGEE", "2")) else flat).append(nm)
        else:
            flat.append(str(n))
    raw_type = " / ".join(codes)
    return {
        "county": "maricopa",
        "recording_number": num,
        "doc_type": next((t for t in (normalize_doc_type(c) for c in codes) if t != "other"), "other"),
        "doc_type_raw": raw_type,
        "recording_date": parse_date(_first(j, "recordingDate", "recordedDate", "dateRecorded")),
        "grantors": grantors,
        # Without roles, keep every name in grantees; the matcher separates owner from lender by name.
        "grantees": grantees or flat,
        "page_count": _first(j, "pageAmount", "pageCount", "pages"),
        "amount": parse_money(_first(j, "amount", "consideration", "loanAmount")),
        "pdf_url": f"{RECORDER}/preview/pdf?recordingNumber={num}&suffix=",
        "raw": j,
    }


class Recorder:
    def __init__(self, client: PoliteClient):
        self.client = client

    def document(self, recording_number: str) -> dict | None:
        try:
            j = self.client.get(f"{RECORDER}/documents/{recording_number}", cache_ttl=90 * 86400).json()
        except Exception:  # noqa: BLE001 - 404 for numbers that don't exist
            return None
        if not j or (isinstance(j, dict) and j.get("restricted")):
            return None
        return _doc_from_json(recording_number, j)

    def pdf(self, recording_number: str) -> bytes:
        return self.client.get(f"{RECORDER}/preview/pdf", params={"recordingNumber": recording_number, "suffix": ""},
                               cache_ttl=365 * 86400).content

    def adjacent_loans(self, deed_number: str, owner_name: str | None) -> list[dict]:
        """Deeds of trust recorded right after a deed, i.e. the acquisition financing."""
        out = []
        if not deed_number or not deed_number.isdigit():
            return out
        owner = norm_entity(owner_name)
        for k in range(1, ADJACENT_LOOKAHEAD + 1):
            doc = self.document(str(int(deed_number) + k))
            if not doc:
                continue
            if doc["doc_type"] in ("deed_of_trust", "mortgage"):
                names = {norm_entity(n) for n in doc["grantors"] + doc["grantees"]}
                # Require the buyer's name on the loan, unless the index gave us no names at all.
                if not owner or not names or any(owner and (owner in n or n in owner) for n in names if n):
                    doc["references_number"] = deed_number
                    out.append(doc)
            elif doc["doc_type"] == "deed":
                break  # another transaction started; stop looking
        return out

    def search_by_name(self, name: str, begin: date, end: date | None = None) -> list[dict]:
        """Name search for later loan activity. Requires MARICOPA_RECORDER_SEARCH_URL (see module doc)."""
        if not SEARCH_URL:
            return []
        params = {"name": clean(name), "beginDate": begin.isoformat(),
                  "endDate": (end or date.today()).isoformat(), "pageSize": 100, "pageNumber": 1}
        out: list[dict] = []
        seen: set[str] = set()
        for _ in range(MAX_SEARCH_PAGES):
            j = self.client.get(SEARCH_URL, params=params, cache_ttl=7 * 86400).json()
            rows = j if isinstance(j, list) else (j.get("searchResults") or j.get("results") or j.get("documents") or [])
            new = 0
            for r in rows:
                num = str(_first(r, "recordingNumber", "documentNumber") or "")
                if num and num not in seen:
                    seen.add(num)
                    out.append(_doc_from_json(num, r))
                    new += 1
            # Stop on a short page, or if the endpoint ignored pageNumber and repeated itself.
            if len(rows) < params["pageSize"] or new == 0:
                break
            params["pageNumber"] += 1
        return out
