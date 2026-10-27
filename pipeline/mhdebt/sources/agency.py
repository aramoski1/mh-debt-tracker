"""Fannie Mae and Freddie Mac multifamily loan files (free with registration, downloaded by hand).

Fannie Mae DUS Disclose (https://disclose.fanniemae.com): run an Advanced Search for
Specific Property Type = Manufactured Housing Community, export to CSV, drop it in data/agency/fannie/.

Freddie Mac Multifamily Securities Investor Access (https://mf.freddiemac.com/investors/data):
export loan-level data for K-Deals, filter to manufactured housing, drop CSVs in data/agency/freddie/.

Column names differ between exports and over time, so each logical field accepts several spellings.
Check the "no column found" warnings on the first run and add spellings here if needed.
"""
from __future__ import annotations

from pathlib import Path
from typing import Iterator

from ..normalize import clean, parse_date, parse_money, parse_pct, parse_share_pct
from .tabular import read_rows

ALIASES: dict[str, list[str]] = {
    "loan_id": ["Loan Number", "Fannie Mae Loan Number", "Loan ID", "Loan Identifier", "Freddie Mac Loan Number",
                "Prospectus Loan ID", "Asset Number"],
    "pool_id": ["Pool Number", "Security Identifier", "CUSIP", "Deal Name", "Deal"],
    "property_name": ["Property Name"],
    "address": ["Property Address", "Property Street Address", "Address"],
    "city": ["Property City", "City"],
    "state": ["Property State", "State"],
    "zip": ["Property Zip Code", "Property Zip", "Zip Code", "Zip"],
    "county": ["Property County", "County"],
    "property_type": ["Specific Property Type", "Property Type", "General Property Type", "Property Subtype"],
    "units": ["Number of Units", "Total Units", "Units", "Number of Pads", "Pads"],
    "lender": ["Seller/Servicer", "Lender", "Lender Name", "Seller Name", "Originator", "Servicer Name"],
    "origination_date": ["Note Date", "Origination Date", "Loan Origination Date", "First Payment Date"],
    "maturity_date": ["Maturity Date", "Loan Maturity Date"],
    "original_amount": ["Original Loan Amount", "Original UPB", "Loan Amount", "Original Balance"],
    "current_balance": ["Current UPB", "Current Loan Balance", "UPB", "Current Balance", "Actual Balance"],
    "note_rate": ["Current Note Rate", "Note Rate", "Original Note Rate", "Interest Rate", "Current Interest Rate"],
    "dscr": ["Most Recent DSCR", "Current DSCR", "Underwritten DSCR", "UW NCF DSCR", "DSCR", "DCR"],
    "noi": ["Most Recent NOI", "Most Recent Net Operating Income", "NOI"],
    "occupancy": ["Most Recent Physical Occupancy", "Physical Occupancy", "Occupancy"],
    "amort_months": ["Amortization Term", "Original Amortization Term"],
    "term_months": ["Original Term", "Loan Term", "Original Loan Term"],
    "io": ["Interest Only Indicator", "Interest Only", "IO Indicator"],
}

MHC_WORDS = ("MANUFACTURED", "MHC", "MOBILE HOME", "MH COMMUNITY")


def is_mhc(row: dict) -> bool:
    pt = clean(row.get("property_type"))
    name = clean(row.get("property_name"))
    return any(w in pt for w in MHC_WORDS) or (not pt and any(w in name for w in MHC_WORDS))


def load(path: Path | str, agency: str, states: list[str] | None = None) -> Iterator[dict]:
    """Yield normalized loan dicts ready for db.upsert_loan()."""
    for r in read_rows(path, ALIASES):
        if not is_mhc(r):
            continue
        state = clean(r["state"])[:2]
        if states and state not in states:
            continue
        loan_id = (r["loan_id"] or "").strip() or f"{r['pool_id']}:{clean(r['property_name'])}"
        yield {
            "source_loan_id": loan_id,
            "lender_name_raw": r["lender"],
            "original_amount": parse_money(r["original_amount"]),
            "current_balance": parse_money(r["current_balance"]),
            "origination_date": parse_date(r["origination_date"]),
            "maturity_date": parse_date(r["maturity_date"]),
            "maturity_basis": "reported" if parse_date(r["maturity_date"]) else "unknown",
            "note_rate": parse_pct(r["note_rate"]),
            "term_months": int(parse_money(r["term_months"]) or 0) or None,
            "amort_months": int(parse_money(r["amort_months"]) or 0) or None,
            "interest_only": str(r["io"] or "").strip().upper() in ("Y", "YES", "TRUE", "1") if r["io"] else None,
            "dscr_current": parse_money(r["dscr"]),
            "noi_current": parse_money(r["noi"]),
            "occupancy_current": parse_share_pct(r["occupancy"]),
            "property_name_raw": r["property_name"],
            "property_address_raw": r["address"],
            "property_city_raw": r["city"],
            "property_state_raw": state,
            "property_zip_raw": r["zip"],
            "lender_kind": "agency_fannie" if agency == "fannie" else "agency_freddie",
            "units": int(parse_money(r["units"]) or 0) or None,
            "county": r["county"],
            "raw": {k: v for k, v in r.items() if v not in (None, "")},
        }
