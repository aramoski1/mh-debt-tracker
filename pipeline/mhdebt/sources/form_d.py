"""SEC Form D quarterly files. Only issuers whose name says MHC, mobile home, manufactured housing, or RV park.

The dataset page lists the zip files. 2026 Q3 is
https://www.sec.gov/files/datastandardsinnovation/data/form-d-data-sets/2026q3_d.zip.
Each zip holds tab-separated ISSUERS, OFFERING, and FORMDSUBMISSION files keyed by ACCESSIONNUMBER.
An offering is a securities sale, not a loan maturity.
"""
from __future__ import annotations

import csv
import io
import re
import zipfile

PAGE_URL = "https://www.sec.gov/data-research/sec-markets-data/form-d-data-sets"
_HREF = re.compile(r'href="([^"]+?\d{4}q[1-4]_d\.zip)"', re.I)
_PARK_NAME = re.compile(r"\bMHC\b|MOBILE HOME|MANUFACTURED HOUSING|\bRV PARK\b", re.I)


def latest_zip_url(html: str) -> str | None:
    found = []
    for href in _HREF.findall(html):
        found.append(href if href.startswith("http") else f"https://www.sec.gov{href}")

    def quarter(url: str) -> tuple[int, int]:
        match = re.search(r"(\d{4})q([1-4])_d\.zip", url, re.I)
        return (int(match.group(1)), int(match.group(2))) if match else (0, 0)

    return max(found, key=quarter) if found else None


def archives_index(cik: str, accession: str) -> str:
    return (
        f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/"
        f"{accession.replace('-', '')}/{accession}-index.html"
    )


def _money(value: str | None) -> float | None:
    text = (value or "").strip().replace(",", "").replace("$", "")
    if not text or text.lower() in {"indefinite", "n/a", "na"}:
        return None
    try:
        return float(text)
    except ValueError:
        return None


def _flag(value: str | None) -> bool | None:
    text = (value or "").strip().lower()
    if text in {"true", "yes", "1", "y"}:
        return True
    if text in {"false", "no", "0", "n"}:
        return False
    return None


def _tsv(text: str) -> list[dict[str, str]]:
    return list(csv.DictReader(io.StringIO(text), delimiter="\t"))


def _member(files: dict[str, str], suffix: str) -> str:
    for name, text in files.items():
        if name.upper().endswith(suffix):
            return text
    return ""


def is_park_issuer(name: str | None) -> bool:
    return bool(_PARK_NAME.search(name or ""))


def parse_quarter(files: dict[str, str]) -> list[dict]:
    """Primary issuers whose entity name matches a park, joined to the offering and the filing date."""
    issuers = _tsv(_member(files, "ISSUERS.TSV"))
    offerings = {row.get("ACCESSIONNUMBER"): row for row in _tsv(_member(files, "OFFERING.TSV"))}
    filed = {
        row.get("ACCESSIONNUMBER"): (row.get("FILING_DATE") or "")[:10] or None
        for row in _tsv(_member(files, "FORMDSUBMISSION.TSV"))
    }
    out = []
    for row in issuers:
        if (row.get("IS_PRIMARYISSUER_FLAG") or "").upper() not in {"", "YES"}:
            continue
        name = (row.get("ENTITYNAME") or "").strip()
        accession = (row.get("ACCESSIONNUMBER") or "").strip()
        if not accession or not is_park_issuer(name):
            continue
        offer = offerings.get(accession) or {}
        cik = (row.get("CIK") or "").strip()
        out.append({
            "accession": accession,
            "issuer_name": name,
            "city": (row.get("CITY") or "").strip() or None,
            "state": (row.get("STATEORCOUNTRY") or "").strip() or None,
            "entity_type": (row.get("ENTITYTYPE") or "").strip() or None,
            "industry_group": (offer.get("INDUSTRYGROUPTYPE") or "").strip() or None,
            "filed_on": filed.get(accession),
            "sale_date": ((offer.get("SALE_DATE") or "").strip()[:10] or None),
            "is_equity": _flag(offer.get("ISEQUITYTYPE")),
            "is_debt": _flag(offer.get("ISDEBTTYPE")),
            "total_offering": _money(offer.get("TOTALOFFERINGAMOUNT")),
            "total_sold": _money(offer.get("TOTALAMOUNTSOLD")),
            "url": archives_index(cik, accession) if cik else None,
        })
    return out


def parse_zip(data: bytes) -> list[dict]:
    book = zipfile.ZipFile(io.BytesIO(data))
    files = {name: book.read(name).decode("utf-8-sig", errors="replace") for name in book.namelist()}
    return parse_quarter(files)
