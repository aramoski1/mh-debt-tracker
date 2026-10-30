"""Fill-only merge with provenance locks.

A nightly ingest may fill an empty field. It may replace an estimate or a web
tag with a recorded source. It never overwrites a value tagged jack, document,
or a recorded source, and it never clears a value.
"""
from __future__ import annotations

LOCKED = frozenset({
    "edgar", "recorder", "assessor", "sba", "hud", "agency", "fdic", "document", "jack",
})
# Weak writers fill blanks only.
WEAK = frozenset({"estimate", "web", "hifld"})
# A strong writer may replace a weak tag, never a lock.
STRONG = frozenset({"edgar", "recorder", "assessor", "sba", "hud", "agency", "fdic", "document"})


def has_value(value: object) -> bool:
    return value is not None and value != ""


def apply_ingest(
    existing: dict | None,
    sources: dict | None,
    incoming: dict,
    writer: str,
) -> tuple[dict, dict]:
    """Return the row to write and the updated field_sources map."""
    current = dict(existing or {})
    tags = {k: v for k, v in (sources or {}).items() if isinstance(v, str) and v}
    written: dict = {}
    for key, value in incoming.items():
        if key in ("id", "field_sources"):
            continue
        if not has_value(value):
            continue
        tag = tags.get(key)
        prior = current.get(key)
        if tag in LOCKED:
            continue
        if has_value(prior) and writer in WEAK:
            continue
        if has_value(prior) and tag not in WEAK and tag is not None:
            continue
        if has_value(prior) and tag is None:
            # Untagged filled values predate this column. Treat them as recorded.
            continue
        written[key] = value
        tags[key] = writer
    nxt = {**current, **written}
    return nxt, tags
