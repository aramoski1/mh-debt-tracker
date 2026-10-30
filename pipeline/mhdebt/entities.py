"""Precision-first owner name match. Shared words like Holdings do not link two owners."""
from __future__ import annotations
import re

STOP = {"llc", "inc", "corp", "corporation", "company", "co", "trust", "the", "and", "of", "holdings", "lp", "llp"}
AGENTS = ("ct corporation", "corporation service company", "registered agent", "national registered agents")


def is_statutory_agent(name: str | None) -> bool:
    text = (name or "").lower()
    return any(agent in text for agent in AGENTS)


def _core(name: str) -> list[str]:
    return [tok for tok in re.findall(r"[a-z0-9]+", name.lower()) if tok not in STOP and len(tok) > 1]


def names_match(left: str | None, right: str | None) -> bool:
    if not left or not right:
        return False
    if is_statutory_agent(left) or is_statutory_agent(right):
        return False
    if left.strip().lower() == right.strip().lower():
        return True
    a, b = _core(left), _core(right)
    if len(a) < 2 or len(b) < 2:
        return False
    sa, sb = " ".join(a), " ".join(b)
    return sa in sb or sb in sa
