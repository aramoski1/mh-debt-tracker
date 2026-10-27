"""FDIC BankFind API (free, no key): bank identity plus call-report balances for CRE concentration.

https://api.fdic.gov/banks/institutions  and  https://api.fdic.gov/banks/financials

CRE concentration = (construction + multifamily + nonfarm nonresidential loans) / total equity capital.
Regulators flag banks above ~300%; those lenders are less likely to extend a maturing park loan.

The call-report field names below are the FDIC's standard variable names. If the API rejects one,
`probe_fields()` prints which of them are available so you can adjust FIELDS.
"""
from __future__ import annotations

from typing import Iterator

from ..http import PoliteClient

BASE = "https://api.fdic.gov/banks"

FIELDS = {
    "assets": "ASSET",        # total assets ($000)
    "equity": "EQ",           # total equity capital ($000)
    "construction": "LNRECONS",  # construction & land development loans
    "multifamily": "LNREMULT",   # multifamily residential loans
    "nonres": "LNRENRES",     # nonfarm nonresidential loans
}


def institutions(client: PoliteClient, active_only: bool = True) -> Iterator[dict]:
    """All FDIC-insured institutions: name, cert, state, city."""
    offset = 0
    flt = "ACTIVE:1" if active_only else ""
    while True:
        resp = client.get(
            f"{BASE}/institutions",
            params={"filters": flt, "fields": "NAME,CERT,STALP,CITY,ASSET,BKCLASS,ACTIVE",
                    "limit": 10000, "offset": offset, "format": "json"},
            cache_ttl=7 * 86400,
        ).json()
        rows = [d["data"] for d in resp.get("data", [])]
        yield from rows
        offset += len(rows)
        if not rows or offset >= resp.get("meta", {}).get("total", 0):
            break


def latest_financials(client: PoliteClient, cert: int) -> dict | None:
    resp = client.get(
        f"{BASE}/financials",
        params={"filters": f"CERT:{cert}", "fields": ",".join(["CERT", "REPDTE", *FIELDS.values()]),
                "sort_by": "REPDTE", "sort_order": "DESC", "limit": 1, "format": "json"},
        cache_ttl=30 * 86400,
    ).json()
    rows = resp.get("data", [])
    if not rows:
        return None
    d = rows[0]["data"]
    cre = sum(float(d.get(FIELDS[k]) or 0) for k in ("construction", "multifamily", "nonres"))
    eq = float(d.get(FIELDS["equity"]) or 0)
    return {
        "report_date": d.get("REPDTE"),
        "total_assets_k": int(float(d.get(FIELDS["assets"]) or 0)),
        "cre_loans_k": int(cre),
        "total_capital_k": int(eq),
        "cre_concentration": round(cre / eq * 100, 1) if eq > 0 else None,
    }


def size_kind(total_assets_k: int | None) -> str:
    """Bucket a bank by size. Community banks (< $10B) are the lenders most likely to hold short-term park loans."""
    if not total_assets_k:
        return "community_bank"
    if total_assets_k < 10_000_000:
        return "community_bank"
    if total_assets_k < 100_000_000:
        return "regional_bank"
    return "national_bank"


def probe_fields(client: PoliteClient, cert: int = 628) -> None:
    resp = client.get(f"{BASE}/financials", params={"filters": f"CERT:{cert}", "limit": 1, "format": "json"}).json()
    keys = set(resp["data"][0]["data"].keys()) if resp.get("data") else set()
    for logical, f in FIELDS.items():
        print(f"{logical:13s} {f:10s} {'ok' if f in keys else 'MISSING'}")
