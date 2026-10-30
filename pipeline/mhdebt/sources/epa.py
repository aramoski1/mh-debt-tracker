"""EPA ECHO Safe Drinking Water systems for Arizona.

Verified 2026-10-30. Active systems come back in two calls, no key:
  https://echodata.epa.gov/echo/sdw_rest_services.get_systems?output=JSON&p_st=AZ&p_act=Y
  https://echodata.epa.gov/echo/sdw_rest_services.get_qid?output=JSON&qid=...
The row has a name, a county, and violation flags. It does not have a coordinate,
so a system is attached to a park only by name, and only when one park is clearly the best match.
"""
from __future__ import annotations

from rapidfuzz import fuzz

from ..normalize import norm_entity, norm_park_name

SYSTEMS_URL = "https://echodata.epa.gov/echo/sdw_rest_services.get_systems"
QID_URL = "https://echodata.epa.gov/echo/sdw_rest_services.get_qid"
NAME_MIN = 95


def _name_score(system_name: str, park_name: str) -> float:
    """How sure these two names are the same place, after generic words are removed.

    token_set_ratio scored 100 whenever one leftover word sat inside a longer name
    ('Apache' inside 'Apache Nitrogen Products'). A one-word remainder is not enough.
    Spaces are ignored so 'Silverview' matches 'Silver View'.
    """
    left = norm_park_name(system_name)
    right = norm_park_name(park_name)
    if not left or not right:
        return 0.0
    if len(left.split()) >= 2 and len(right.split()) >= 2:
        if left.replace(" ", "") == right.replace(" ", ""):
            return 100.0
        return float(fuzz.token_sort_ratio(left, right))
    # One leftover word ('Arizona', 'Rim') matches too many places. Compare the full names.
    full = float(fuzz.token_sort_ratio(norm_entity(system_name), norm_entity(park_name)))
    return full if full >= NAME_MIN else 0.0


def _int(v) -> int | None:
    try:
        return int(v)
    except (TypeError, ValueError):
        return None


def parse_system(row: dict) -> dict:
    return {
        "pws_id": str(row.get("PWSId") or ""),
        "name": row.get("PWSName") or "",
        "county": ", ".join(str(c) for c in row["CountiesServed"]) if isinstance(row.get("CountiesServed"), list) else (row.get("CountiesServed") or None),
        "serious_violator": str(row.get("SeriousViolator") or "").lower() == "yes",
        "qtrs_with_violations": _int(row.get("QtrsWithVio")),
        "rules_violated_3yr": _int(row.get("RulesVio3yr")),
    }


def fetch_systems(client, state: str = "AZ") -> list[dict]:
    meta = client.get(SYSTEMS_URL, params={"output": "JSON", "p_st": state, "p_act": "Y"}, cache_ttl=86400).json()
    qid = (meta.get("Results") or {}).get("QueryID")
    if not qid:
        return []
    body = client.get(QID_URL, params={"output": "JSON", "qid": qid}, cache_ttl=86400).json()
    rows = (body.get("Results") or {}).get("WaterSystems") or []
    return [parse_system(r) for r in rows if r.get("PWSId")]


def _counties(value) -> set[str]:
    if isinstance(value, list):
        parts = [str(p) for p in value]
    else:
        parts = str(value or "").replace(";", ",").split(",")
    return {p.lower().replace(" county", "").strip() for p in parts if p.strip()}


def link_systems(systems: list[dict], parks: list[dict]) -> list[dict]:
    """Attach a system to a park when the names score at least 95 and the county does not contradict.

    Two close scores stay unlinked. A one-word overlap is not enough. A system that lists several
    counties matches a park in any of them. parks need id, name, and county.
    """
    prepared = [(p, norm_park_name(p.get("name")), _counties(p.get("county"))) for p in parks]
    out = []
    for system in systems:
        sname = norm_park_name(system.get("name"))
        scounty = _counties(system.get("county"))
        ranked: list[tuple[float, str]] = []
        if sname:
            for park, pname, pcounty in prepared:
                if not pname:
                    continue
                if scounty and pcounty and scounty.isdisjoint(pcounty):
                    continue
                score = _name_score(system.get("name") or "", park.get("name") or "")
                if score >= NAME_MIN:
                    ranked.append((score, str(park["id"])))
        ranked.sort(reverse=True)
        park_id = None
        score = None
        if ranked and (len(ranked) == 1 or ranked[0][0] - ranked[1][0] >= 5):
            score, park_id = ranked[0]
        row = dict(system)
        row["park_id"] = park_id
        row["match_score"] = score
        out.append(row)
    return out
