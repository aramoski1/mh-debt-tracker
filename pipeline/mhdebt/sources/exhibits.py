"""EX-99 links from ABS-EE filing indexes. The exhibit file itself is not downloaded.

EX-102 is already the loan tape. EX-99 is a free-form exhibit. We keep the URL when the filing
index names it, and nothing when it does not.
"""
from __future__ import annotations

import re
from datetime import date

from ..http import PoliteClient
from .edgar_cmbs import ARCHIVES, parse_form_index

# ABS-EE indexes name EX-102 as exh102 or exh_102. An EX-99, when a filing has one, uses the same shapes.
_EX99 = re.compile(r"exh?[-_]?99", re.I)


def exhibit_links(index: dict, folder: str) -> list[dict]:
    items = (index.get("directory") or {}).get("item") or []
    out = []
    for item in items:
        name = item.get("name") or ""
        if not _EX99.search(name):
            continue
        if name.lower().endswith((".jpg", ".jpeg", ".gif", ".png", ".zip")):
            continue
        out.append({"name": name, "url": f"{folder.rstrip('/')}/{name}"})
    return out


def fetch_page(client: PoliteClient, offset: int, limit: int = 8, today: date | None = None) -> tuple[list[dict], int, int]:
    """The next `limit` ABS-EE filings in this quarter's form index, and the offset to resume from."""
    today = today or date.today()
    quarter = (today.month - 1) // 3 + 1
    url = f"{ARCHIVES}/edgar/full-index/{today.year}/QTR{quarter}/form.idx"
    filings = list(parse_form_index(client.get(url, cache_ttl=6 * 3600).text))
    if not filings:
        return [], 0, 0
    if offset >= len(filings) or offset < 0:
        offset = 0
    batch = filings[offset:offset + limit]
    hits = []
    for filing in batch:
        try:
            index = client.get(f"{filing.folder}/index.json", cache_ttl=30 * 86400).json()
        except Exception:  # noqa: BLE001 - one missing index should not stop the page
            continue
        for link in exhibit_links(index, filing.folder):
            hits.append({
                "source": "edgar_exhibit",
                "source_id": f"{filing.accession}:{link['name']}",
                "title": f"{filing.company} {link['name']}",
                "url": link["url"],
                "filed_on": filing.filed.isoformat(),
                "form": "ABS-EE",
                "snippet": "Exhibit link only. The exhibit file was not downloaded.",
            })
    return hits, offset + len(batch), len(filings)
