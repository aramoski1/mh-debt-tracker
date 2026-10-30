"""FHA-insured multifamily mortgages from HUD's public active and terminated workbooks.

The active file is FHA-BF90-RM-A.xlsx and the terminated file is FHA-BF90-RM-T.xlsx, both linked from
https://www.hud.gov/hud-partners/multifamily-fhasl-active. A row is a park loan only when its own
section-of-act category contains "mobile home". On 2026-10-30 that was "207 MOBILE HOME COURTS" and
"223d 2yr Opr. Loss/207 Mobile Home Park". Name searches also hit banks and nursing homes, so the name
is not the filter.
"""
from __future__ import annotations

import re
from datetime import date, timedelta

from .sheet import read_xlsx

ACTIVE_URL = "https://www.hud.gov/sites/default/files/Housing/documents/FHA-BF90-RM-A.xlsx"
TERMINATED_URL = "https://www.hud.gov/sites/default/files/Housing/documents/FHA-BF90-RM-T.xlsx"
PAGE_URL = "https://www.hud.gov/hud-partners/multifamily-fhasl-active"

_PARK_SOA = re.compile(r"mobile home", re.I)
_EXCEL_EPOCH = date(1899, 12, 30)
_SKIP_HOLDERS = {"", "NO DATA AVAILABLE", "N/A", "NONE", "NULL"}


def excel_date(value: str | None) -> date | None:
    """HUD stores endorsement and maturity dates as Excel serials."""
    if not value:
        return None
    text = value.strip()
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", text[:10]) and len(text) >= 10:
        return date.fromisoformat(text[:10])
    try:
        serial = float(text)
    except ValueError:
        return None
    if not 20000 <= serial <= 80000:
        return None
    return _EXCEL_EPOCH + timedelta(days=int(serial))


def _num(value: str | None) -> float | None:
    if value in (None, ""):
        return None
    try:
        return float(value)
    except ValueError:
        return None


def _zip(value: str | None) -> str | None:
    if not value:
        return None
    digits = re.sub(r"\D", "", value.split(".", 1)[0])
    return digits[:5] or None


def _text(value: str | None) -> str | None:
    text = (value or "").strip()
    return text or None


def _column(row: dict, prefix: str) -> str | None:
    for key, value in row.items():
        if key.upper().startswith(prefix):
            return value
    return None


def is_park_row(row: dict) -> bool:
    return bool(_PARK_SOA.search(_column(row, "SOA CATEGORY") or ""))


def loan_from_row(row: dict, status: str) -> dict | None:
    """One upsert record. `status` is active for the current workbook and paid_off for the terminated one."""
    if not is_park_row(row):
        return None
    project = _text(row.get("HUD PROJECT NUMBER"))
    if not project:
        return None
    holder = _text(row.get("HOLDER NAME"))
    if holder and holder.upper() in _SKIP_HOLDERS:
        holder = None
    units = _num(row.get("UNITS"))
    term = _num(row.get("TERM IN MONTHS"))
    maturity = excel_date(row.get("MATURITY DATE"))
    return {
        "source_loan_id": project,
        "lender_name_raw": holder,
        "original_amount": _num(row.get("ORIGINAL MORTGAGE AMOUNT")),
        "current_balance": _num(row.get("AMORITIZED PRINCIPAL BALANCE") or row.get("AMORTIZED PRINCIPAL BALANCE")),
        "origination_date": excel_date(row.get("FINAL ENDORSEMENT DATE") or row.get("INITIAL ENDORSEMENT DATE")),
        "maturity_date": maturity,
        "maturity_basis": "reported" if maturity else "unknown",
        "note_rate": _num(row.get("INTEREST RATE")),
        "term_months": int(term) if term is not None else None,
        "status": status,
        "property_name_raw": _text(row.get("PROPERTY NAME")),
        "property_city_raw": _text(row.get("PROPERTY CITY")),
        "property_state_raw": _text(row.get("PROPERTY STATE")),
        "property_zip_raw": _zip(row.get("PROPERTY ZIP")),
        "raw": {
            "soa": _text(_column(row, "SOA CATEGORY")),
            "section_of_act": _text(row.get("SECTION OF ACT CODE")),
            "units": int(units) if units is not None else None,
            "servicer": _text(row.get("SERVICER NAME")),
            "holder": holder,
            "workbook": "active" if status == "active" else "terminated",
            "source_url": ACTIVE_URL if status == "active" else TERMINATED_URL,
        },
    }


def parse_workbook(data: bytes, status: str) -> list[dict]:
    return [loan for row in read_xlsx(data) if (loan := loan_from_row(row, status))]
