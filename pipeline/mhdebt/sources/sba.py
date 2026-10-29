"""SBA 7(a) and 504 loan-level FOIA data (free): https://data.sba.gov/dataset/7a-504-foia

The dataset page lists the current CSV snapshots. `download_foia` saves the files whose fiscal-year
range reaches `since_fy` (default 2010) into data/sba/. Older decades are still on that page; pass
a lower `since_fy` to include them. Re-running skips a file whose size already matches the server.

RV parks and campgrounds (NAICS 721211) borrow through SBA often; mobile home parks rarely do, because
SBA does not finance passive real estate, but we keep NAICS 531190/531110 in case an operating business qualifies.

7(a) real estate loans fully amortize (no balloon), so they are not a refinance trigger on their own.
They are still valuable: exact origination date, lender, and the operating business's name and address.
"""
from __future__ import annotations

import re
from pathlib import Path
from typing import Iterator

from ..http import PoliteClient
from ..normalize import add_months, clean, parse_date, parse_money, parse_pct
from .tabular import read_rows

DATASET_PAGE = "https://data.sba.gov/dataset/7a-504-foia"
_CSV_URL = re.compile(
    r"https://data\.sba\.gov/sites/default/files/uploaded_resources/"
    r"(FOIA_(?:7a|504)_FY\d{4}[^\"'\s<>]*\.csv)",
    re.IGNORECASE,
)

PARK_NAICS = {"721211": "rv", "531190": "mhp", "531110": "mhp", "721214": "rv"}

ALIASES = {
    "program": ["Program"],
    "borrower": ["BorrName", "Borrower Name"],
    "street": ["BorrStreet", "Borrower Street"],
    "city": ["BorrCity", "Borrower City"],
    "state": ["BorrState", "Borrower State"],
    "zip": ["BorrZip", "Borrower Zip"],
    "lender": ["BankName", "ThirdPartyLender_Name", "CDC_Name", "Lender Name"],
    "lender_fdic": ["BankFDICNumber"],
    "amount": ["GrossApproval", "Gross Approval"],
    "approval_date": ["ApprovalDate", "Approval Date"],
    "first_disbursement": ["FirstDisbursementDate"],
    "rate": ["InitialInterestRate", "Initial Interest Rate"],
    "term": ["TermInMonths", "TerminMonths", "Term In Months"],
    "naics": ["NAICSCode", "NaicsCode", "NAICS Code"],
    "project_county": ["ProjectCounty"],
    "project_state": ["ProjectState"],
    "status": ["LoanStatus", "Loan Status"],
    "paid_in_full": ["PaidinFullDate", "PaidInFullDate"],
}

STATUS_MAP = {"PIF": "paid_off", "CHGOFF": "paid_off", "CANCLD": "paid_off", "EXEMPT": "active", "COMMIT": "active"}


def _covers_since(filename: str, since_fy: int) -> bool:
    years = [int(y) for y in re.findall(r"FY(\d{4})", filename, re.IGNORECASE)]
    if not years:
        return False
    end = 9999 if re.search(r"present", filename, re.IGNORECASE) else years[-1]
    return end >= since_fy


def foia_csv_urls(html: str, since_fy: int = 2010) -> list[str]:
    """CSV snapshot URLs on the dataset page, in page order, skipping files that end before since_fy."""
    urls: list[str] = []
    seen: set[str] = set()
    for match in _CSV_URL.finditer(html):
        url = match.group(0)
        if url in seen or not _covers_since(match.group(1), since_fy):
            continue
        seen.add(url)
        urls.append(url)
    return urls


def download_foia(client: PoliteClient, dest: Path, since_fy: int = 2010) -> list[Path]:
    """Download the current FOIA CSVs. Returns the local paths, including files already on disk."""
    html = client.get(DATASET_PAGE, cache_ttl=24 * 3600).text
    urls = foia_csv_urls(html, since_fy)
    if not urls:
        raise RuntimeError(f"no FOIA CSVs found on {DATASET_PAGE}")
    return [client.download(url, dest / url.rsplit("/", 1)[-1]) for url in urls]


def load(path: Path | str, states: list[str] | None = None) -> Iterator[dict]:
    for r in read_rows(path, ALIASES):
        naics = str(r["naics"] or "").strip()[:6]
        if naics not in PARK_NAICS:
            continue
        state = clean(r["project_state"] or r["state"])[:2]
        if states and state not in states:
            continue
        approved = parse_date(r["approval_date"])
        term = int(parse_money(r["term"]) or 0) or None
        program = clean(r["program"]) or "7A"
        yield {
            "source_loan_id": f"{program}:{clean(r['borrower'])}:{approved}:{int(parse_money(r['amount']) or 0)}",
            "lender_name_raw": r["lender"],
            "lender_fdic": int(parse_money(r["lender_fdic"]) or 0) or None,
            "borrower_name_raw": r["borrower"],
            "original_amount": parse_money(r["amount"]),
            "origination_date": approved,
            "maturity_date": add_months(approved, term) if approved and term else None,
            "maturity_basis": "reported" if approved and term else "unknown",
            "note_rate": parse_pct(r["rate"]),
            "term_months": term,
            "amort_months": term,
            "balloon": False,
            "status": STATUS_MAP.get(clean(r["status"]).replace(" ", ""), "active"),
            "property_name_raw": r["borrower"],
            "property_address_raw": r["street"],
            "property_city_raw": r["city"],
            "property_state_raw": state,
            "property_zip_raw": r["zip"],
            "park_kind": PARK_NAICS[naics],
            "county": r["project_county"],
            "raw": {k: v for k, v in r.items() if v not in (None, "")},
        }
