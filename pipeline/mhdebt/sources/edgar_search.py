"""EDGAR full-text search hits. The hit is stored. The filing body is not downloaded.

The index is https://efts.sec.gov/LATEST/search-index. A "mobile home park" 10-K search returned
Sun Communities on 2026-10-30. The same phrase on form ABS-EE returned no hits that day.
"""
from __future__ import annotations

from datetime import date

from .form_d import archives_index

EFTS_URL = "https://efts.sec.gov/LATEST/search-index"
# Fixed queries. The end date is filled in at request time. Each query keeps one page.
QUERIES = (
    {"q": '"mobile home park"', "forms": "10-K,10-Q,8-K"},
    {"q": '"manufactured housing community"', "forms": "ABS-EE,424B2,424B5,FWP,8-K"},
)
PAGE_SIZE = 40
START = "2024-01-01"


def search_params(query: dict, end: date | None = None) -> dict:
    return {
        **query,
        "dateRange": "custom",
        "startdt": START,
        "enddt": (end or date.today()).isoformat(),
        "from": 0,
        "size": PAGE_SIZE,
    }


def parse_hits(payload: dict) -> list[dict]:
    hits = ((payload.get("hits") or {}).get("hits")) or []
    out = []
    for hit in hits:
        src = hit.get("_source") or {}
        adsh = src.get("adsh")
        if not adsh:
            continue
        ciks = src.get("ciks") or []
        cik = str(ciks[0]) if ciks else ""
        names = src.get("display_names") or []
        title = names[0] if isinstance(names, list) and names else (names or None)
        out.append({
            "source": "edgar_efts",
            "source_id": adsh,
            "title": title,
            "url": archives_index(cik, adsh) if cik else None,
            "filed_on": (src.get("file_date") or "")[:10] or None,
            "form": src.get("form"),
            "snippet": hit.get("_id"),
        })
    return out
