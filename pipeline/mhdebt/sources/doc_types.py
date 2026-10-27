"""Map county document codes and descriptions to a small set of normalized types.

Order matters (first match wins). The traps this order avoids:
  * "DEED OF TRUST AND ASSIGNMENT OF RENTS" is a deed of trust, not an assignment
  * "CANCELLATION OF NOTICE OF TRUSTEE SALE" cancels a foreclosure; it doesn't start one
  * "RELEASE OF LIS PENDENS" ends a lawsuit notice
  * "MODIFICATION OF DEED OF TRUST" / "ASSIGNMENT OF DEED OF TRUST" are not new loans
"""
from __future__ import annotations

import re

PATTERNS: list[tuple[re.Pattern, str]] = [
    (re.compile(r"CANCEL|RESCI|WITHDRAW"), "cancellation"),
    (re.compile(r"REL\w*\W+(OF\W+)?LIS\W*PEND|LIS\W*PEND\w*\W+REL"), "lis_pendens_release"),
    (re.compile(r"NOTICE.*(TRUSTEE|SALE)|TRUSTEE.?S? SALE|^NS$|^NTS$"), "trustee_sale_notice"),
    (re.compile(r"TRUSTEE.?S? DEED|^TD$|SHERIFF|TREASURER"), "trustee_deed"),
    (re.compile(r"LIS PEND|^LP$"), "lis_pendens"),
    (re.compile(r"PART(IAL)? REL|^PR$"), "partial_release"),
    (re.compile(r"REL|RECON|SATISF|^RZ$|^RD$"), "release"),
    (re.compile(r"ASSIGN\w*\W+(OF\W+)?(THE\W+)?(DEED OF TR|D/?T\b|BENEFICIAL|MORTGAGE|NOTE)"), "assignment"),
    (re.compile(r"MOD|ASSMP|ASSUMP|EXTEN|^MF$|^SP$"), "modification"),
    (re.compile(r"SUBORD"), "subordination"),
    (re.compile(r"APPOINT|SUBST.*TRUST|^AO$|^AN$"), "substitution_of_trustee"),
    (re.compile(r"DEED.{0,4}(OF )?TR|D/?T\b|^DT$|^DOT$"), "deed_of_trust"),
    (re.compile(r"ASSIGN|^AS$|^AD$"), "assignment"),
    (re.compile(r"MORTGAGE|^MG$|^MTG$"), "mortgage"),
    (re.compile(r"FIN.*STATEMENT|UCC|F/S"), "ucc"),
    (re.compile(r"DEED|^DE$|^WD$|^SW$|^QC$|^QD$"), "deed"),
]

LOAN_TYPES = {"deed_of_trust", "mortgage"}
DISTRESS_TYPES = {"trustee_sale_notice", "lis_pendens", "trustee_deed"}
CURE_TYPES = {"cancellation", "lis_pendens_release"}


def normalize_doc_type(code_or_desc: str | None) -> str:
    s = (code_or_desc or "").upper().strip()
    for pat, t in PATTERNS:
        if pat.search(s):
            return t
    return "other"
