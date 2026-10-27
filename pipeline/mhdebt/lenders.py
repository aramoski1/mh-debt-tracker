"""Classify a lender from the name on a recorded mortgage or loan file.

The lender type drives the maturity estimate (a community bank loan is usually 5 years, a life company
loan 10+), so getting this right matters more than any other single step. Order of evidence:
  1. explicit rules below (agencies, CMBS trusts, credit unions, insurers, SBA, title companies)
  2. a fuzzy match to the FDIC institution list (gives bank size and CRE concentration)
  3. an optional model call for names the rules can't place
"""
from __future__ import annotations

import re
from dataclasses import dataclass

from rapidfuzz import fuzz, process

from .normalize import clean, entity_type, norm_entity

R = lambda p: re.compile(p)  # noqa: E731

RULES: list[tuple[re.Pattern, str]] = [
    (R(r"\bFANNIE MAE\b|\bFEDERAL NATIONAL MORTGAGE\b"), "agency_fannie"),
    (R(r"\bFREDDIE MAC\b|\bFEDERAL HOME LOAN MORTGAGE\b"), "agency_freddie"),
    (R(r"COMMERCIAL MORTGAGE|MORTGAGE TRUST 20|PASS ?THROUGH CERTIFICATES|\bCMBS\b|MORTGAGE SECURITIES|"
       r"\bAS TRUSTEE FOR THE (HOLDERS|REGISTERED HOLDERS|BENEFIT OF)"), "cmbs_trust"),
    (R(r"SMALL BUSINESS ADMINISTRATION|DEVELOPMENT (CORP|COMPANY)|CERTIFIED DEVELOPMENT|\bCDC\b"), "sba_lender"),
    (R(r"CREDIT UNION|\bF ?C ?U\b"), "credit_union"),
    (R(r"LIFE INSURANCE|INSURANCE COMPANY|ASSURANCE|ANNUITY|MUTUAL LIFE|\bLIFE CO\b"), "life_company"),
    (R(r"\bUNITED STATES OF AMERICA\b|\bUSDA\b|RURAL DEVELOPMENT|DEPARTMENT OF|\bCOUNTY OF\b|\bSTATE OF\b|"
       r"\bCITY OF\b|HOUSING (FINANCE|AUTHORITY)"), "government"),
]

# Fannie Mae DUS lenders and Freddie Mac Optigo lenders. A recorded deed of trust naming one of these
# on a park is very likely an agency loan; the exact agency gets confirmed when the agency file matches.
AGENCY_LENDERS = [
    "WALKER DUNLOP", "BERKADIA", "GREYSTONE", "ARBOR", "LUMENT", "ORIX REAL ESTATE CAPITAL", "CBRE MULTIFAMILY",
    "CBRE CAPITAL MARKETS", "GRANDBRIDGE", "NEWMARK", "KNIGHT REAL ESTATE", "JLL REAL ESTATE CAPITAL",
    "CAPITAL ONE MULTIFAMILY", "PNC REAL ESTATE", "WELLS FARGO MULTIFAMILY", "M T REALTY CAPITAL", "KEYBANK REAL ESTATE",
    "HUNT MORTGAGE", "HUNT REAL ESTATE CAPITAL", "BELLWETHER ENTERPRISE", "MERCHANTS CAPITAL", "NORTHMARQ",
    "PILLAR MULTIFAMILY", "PINNACLE", "DWIGHT CAPITAL", "BASIS MULTIFAMILY", "SABAL CAPITAL", "REGIONS REAL ESTATE",
    "BERKELEY POINT", "PRUDENTIAL MULTIFAMILY", "PGIM REAL ESTATE",
]

# Balance-sheet and conduit originators that usually securitize.
CONDUIT_LENDERS = [
    "ARGENTIC", "LMF COMMERCIAL", "LADDER CAPITAL", "STARWOOD MORTGAGE", "RIALTO", "CITI REAL ESTATE FUNDING",
    "GOLDMAN SACHS MORTGAGE", "MORGAN STANLEY MORTGAGE CAPITAL", "GERMAN AMERICAN CAPITAL", "UBS AG", "BENEFIT STREET",
    "LOANCORE", "3650 REIT", "NATIXIS", "SOCIETE GENERALE", "BSPRT", "CANTOR COMMERCIAL", "RAIT", "JEFFERIES LOANCORE",
    "BARCLAYS CAPITAL REAL ESTATE", "BANK OF AMERICA COMMERCIAL MORTGAGE", "LONGPOINT", "STARWOOD", "AREF",
    "COLUMN FINANCIAL", "MONTEREY CAPITAL", "UNION CAPITAL", "AMERICAN NATIONAL INSURANCE",
]

# Title companies show up as the trustee on Arizona deeds of trust; they are never the lender.
TITLE_COMPANIES = R(
    r"TITLE (INSURANCE|AGENCY|COMPANY|CO|GUARANTY|SECURITY|OF)|FIRST AMERICAN|FIDELITY NATIONAL|STEWART TITLE|"
    r"OLD REPUBLIC|CHICAGO TITLE|PIONEER TITLE|GREAT AMERICAN TITLE|LAWYERS TITLE|TICOR|ESCROW|PREMIER TITLE|"
    r"NAVI TITLE|THOMAS TITLE|SECURITY TITLE|CLEAR TITLE|ARIZONA TITLE"
)

BANK_WORDS = R(r"\bBANK\b|\bBANCORP\b|\bN A\b|NATIONAL ASSOCIATION|SAVINGS|\bFSB\b|BANK AND TRUST|BANKING")
FUND_WORDS = R(r"CAPITAL|FUND|LENDING|LENDERS|CREDIT|FINANCE|FINANCIAL|INVESTORS|INVESTMENT|MORTGAGE|REIT|"
               r"FUNDING|PARTNERS|LOAN")
FAMILY_TRUST = R(r"(FAMILY|LIVING|REVOCABLE|IRREVOCABLE|SURVIVORS) TRUST|\bTRUSTEES?\b|\bET UX\b|\bHUSBAND\b|\bWIFE\b")


DESCRIPTORS = R(
    r"\b(AN?|ITS) [A-Z ]*?(CORPORATION|BANKING ASSOCIATION|BANKING CORPORATION|LIMITED LIABILITY COMPANY|"
    r"STATE CHARTERED BANK|SAVINGS BANK|CREDIT UNION|LIMITED PARTNERSHIP|TRUST COMPANY)\b.*$|"
    r"\bITS SUCCESSORS.*$|\bISAOA\b.*$|\bATIMA\b.*$|\bAS (BENEFICIARY|LENDER|TRUSTEE)\b.*$"
)


def strip_descriptors(name: str) -> str:
    """'Western Alliance Bank, an Arizona corporation, its successors' -> 'WESTERN ALLIANCE BANK'."""
    return DESCRIPTORS.sub("", clean(name)).strip()


@dataclass
class Classification:
    kind: str
    reason: str
    fdic_cert: int | None = None
    fdic_name: str | None = None
    confidence: float = 0.8


def is_title_company(name: str) -> bool:
    return bool(TITLE_COMPANIES.search(clean(name)))


def _contains_any(n: str, names: list[str]) -> str | None:
    n = " ".join(n.replace("&", " ").split())
    for x in names:
        if x in n:
            return x
    return None


class LenderClassifier:
    def __init__(self, fdic_institutions: list[dict] | None = None):
        self._fdic = {}
        for inst in fdic_institutions or []:
            self._fdic[norm_entity(inst["NAME"])] = inst
        self._fdic_keys = list(self._fdic)

    def fdic_match(self, name: str) -> dict | None:
        if not self._fdic_keys:
            return None
        n = norm_entity(strip_descriptors(name))
        hit = process.extractOne(n, self._fdic_keys, scorer=fuzz.token_sort_ratio, score_cutoff=90)
        return self._fdic[hit[0]] if hit else None

    def classify(self, name: str) -> Classification:
        n = clean(name)
        if not n:
            return Classification("unknown", "empty", confidence=0)
        for pat, kind in RULES:
            if pat.search(n):
                return Classification(kind, f"rule:{pat.pattern[:30]}", confidence=0.95)
        if hit := _contains_any(n, AGENCY_LENDERS):
            return Classification("agency_lender", f"agency lender list:{hit}", confidence=0.85)
        if hit := _contains_any(n, CONDUIT_LENDERS):
            return Classification("conduit_lender", f"conduit list:{hit}", confidence=0.85)
        inst = self.fdic_match(name)
        if inst:
            from .sources.fdic import size_kind

            return Classification(size_kind(inst.get("ASSET")), "fdic match", fdic_cert=inst.get("CERT"),
                                  fdic_name=inst.get("NAME"), confidence=0.9)
        if BANK_WORDS.search(n):
            return Classification("community_bank", "bank words, no FDIC match", confidence=0.6)
        if FAMILY_TRUST.search(n) or entity_type(name) == "individual":
            return Classification("individual", "person or family trust (likely seller financing)", confidence=0.75)
        if FUND_WORDS.search(n):
            return Classification("debt_fund", "finance words", confidence=0.55)
        if entity_type(name) in ("llc", "partnership", "corp"):
            # An LLC lender on a park is usually a private lender or the prior owner's entity (seller carry-back).
            return Classification("individual", "private entity (likely seller financing or private lender)", confidence=0.45)
        return Classification("unknown", "no rule matched", confidence=0.0)


LLM_PROMPT = """You classify the lender named on a recorded mortgage or deed of trust on a US mobile home or RV park.
Answer with one of: community_bank, regional_bank, national_bank, credit_union, agency_lender, conduit_lender,
life_company, debt_fund, sba_lender, individual, government, unknown.
Use individual for people, family trusts, and private LLCs that are likely the seller carrying back a note.
Lender name: {name}"""


def classify_with_model(name: str, client, model: str) -> Classification:
    """Fallback for names the rules can't place. `client` is an anthropic.Anthropic instance."""
    allowed = ["community_bank", "regional_bank", "national_bank", "credit_union", "agency_lender", "conduit_lender",
               "life_company", "debt_fund", "sba_lender", "individual", "government", "unknown"]
    msg = client.messages.create(
        model=model,
        max_tokens=50,
        messages=[{"role": "user", "content": LLM_PROMPT.format(name=name)}],
    )
    text = "".join(b.text for b in msg.content if getattr(b, "type", "") == "text").strip().lower()
    kind = next((a for a in allowed if a in text), "unknown")
    return Classification(kind, "model", confidence=0.6)
