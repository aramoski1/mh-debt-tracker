"""Google News RSS headlines for Arizona park sales. The article page is not fetched."""
from __future__ import annotations

import hashlib
from email.utils import parsedate_to_datetime

from lxml import etree

NEWS_URL = "https://news.google.com/rss/search"
QUERY = 'Arizona "mobile home park"'
LIMIT = 15


def parse_rss(xml: bytes, limit: int = LIMIT) -> list[dict]:
    root = etree.fromstring(xml)
    out = []
    for item in root.findall(".//item"):
        if len(out) >= limit:
            break
        title = (item.findtext("title") or "").strip()
        link = (item.findtext("link") or "").strip()
        if not link or not title:
            continue
        filed = None
        raw_date = item.findtext("pubDate")
        if raw_date:
            try:
                filed = parsedate_to_datetime(raw_date).date().isoformat()
            except (TypeError, ValueError, OverflowError):
                filed = None
        out.append({
            "source": "google_news",
            "source_id": hashlib.sha256(link.encode()).hexdigest()[:24],
            "title": title,
            "url": link,
            "filed_on": filed,
            "form": "rss",
            "snippet": (item.findtext("source") or "").strip() or None,
        })
    return out
