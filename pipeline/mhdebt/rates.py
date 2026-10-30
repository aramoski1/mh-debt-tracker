"""Interest rate history, used to estimate what an owner paid then versus what a refinance costs now.

FRED constant-maturity yields and the bank prime and Moody's Baa spread, free CSV, no key:
  https://fred.stlouisfed.org/graph/fredgraph.csv?id=DGS5
SOFR, New York Fed, no key (verified 2026-10-30):
  https://markets.newyorkfed.org/api/rates/secured/sofr/search.csv
The model still prices a park loan off the 5-year Treasury plus a spread. The spread is the
median measured from CMBS and SBA notes when that sample has at least 8 loans; otherwise the
assumed SPREAD table below. If FRED is unreachable, an approximate annual table is used instead.
"""
from __future__ import annotations

import csv
import io
from datetime import date

from .http import PoliteClient
from .spreads import MIN_SAMPLE

FRED_URL = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=DGS5"
FRED_SERIES = ("DGS5", "DGS7", "DGS10", "DPRIME", "BAA10Y")
SOFR_URL = "https://markets.newyorkfed.org/api/rates/secured/sofr/search.csv"

# Approximate annual averages of the 5-year Treasury yield (%), fallback only. Refresh from FRED when possible.
FALLBACK_5Y = {
    1995: 6.38, 1996: 6.18, 1997: 6.22, 1998: 5.15, 1999: 5.55, 2000: 6.16, 2001: 4.56, 2002: 3.82, 2003: 2.97,
    2004: 3.43, 2005: 4.05, 2006: 4.75, 2007: 4.43, 2008: 2.80, 2009: 2.20, 2010: 1.93, 2011: 1.52, 2012: 0.76, 2013: 1.17,
    2014: 1.64, 2015: 1.53, 2016: 1.33, 2017: 1.91, 2018: 2.75, 2019: 1.96, 2020: 0.53, 2021: 0.86, 2022: 3.00,
    2023: 4.06, 2024: 4.07, 2025: 3.95, 2026: 3.85,
}

# Typical spread over the 5-year Treasury for a park loan, by lender type (percentage points).
# These are working assumptions to tune with Cooper Cardinal's lending contacts.
SPREAD = {
    "community_bank": 2.75, "regional_bank": 2.50, "national_bank": 2.25, "credit_union": 2.75,
    "agency_fannie": 1.80, "agency_freddie": 1.80, "agency_lender": 1.80, "cmbs_trust": 2.25, "conduit_lender": 2.25,
    "life_company": 1.70, "debt_fund": 4.00, "sba_lender": 2.75, "individual": 2.00, "government": 1.00, "unknown": 2.50,
}
# Seller financing tends to be priced off what the buyer could get elsewhere, with a floor.
SELLER_FLOOR = 5.0


def parse_fred(text: str, series: str) -> list[tuple[date, float]]:
    """FRED fredgraph.csv rows. A '.' value is a missing print and is skipped."""
    out = []
    for row in csv.DictReader(io.StringIO(text)):
        raw_d = row.get("observation_date") or row.get("DATE")
        raw_v = row.get(series)
        if not raw_d or raw_v in (None, "", "."):
            continue
        out.append((date.fromisoformat(raw_d[:10]), float(raw_v)))
    return out


def parse_sofr(text: str) -> list[tuple[date, float]]:
    """NY Fed SOFR CSV. Dates are M/D/YYYY. The rate column is 'Rate (%)'."""
    out = []
    for row in csv.DictReader(io.StringIO(text)):
        raw_d, raw_v = row.get("Effective Date"), row.get("Rate (%)")
        if not raw_d or not raw_v:
            continue
        m, d, y = (int(x) for x in raw_d.split("/"))
        out.append((date(y, m, d), float(raw_v)))
    return out


def fetch_prints(client: PoliteClient) -> list[tuple[str, date, float]]:
    """Download every series before a database connection is opened."""
    out: list[tuple[str, date, float]] = []
    for series in FRED_SERIES:
        text = client.get(f"https://fred.stlouisfed.org/graph/fredgraph.csv?id={series}", cache_ttl=86400).text
        out.extend((series, d, v) for d, v in parse_fred(text, series))
    text = client.get(SOFR_URL, params={"startDate": "04/02/2018", "endDate": date.today().strftime("%m/%d/%Y")},
                      cache_ttl=86400).text
    out.extend(("SOFR", d, v) for d, v in parse_sofr(text))
    return out


class RateCurve:
    def __init__(self, monthly: dict[tuple[int, int], float] | None = None, spreads: dict[str, dict] | None = None):
        self.monthly = monthly or {}
        # kind -> {median, n, source}; only kinds with n >= MIN_SAMPLE belong here
        self.spreads = spreads or {}

    @classmethod
    def load(cls, client: PoliteClient | None = None) -> "RateCurve":
        if client is None:
            return cls()
        try:
            text = client.get(FRED_URL, cache_ttl=86400).text
        except Exception:  # noqa: BLE001
            return cls()
        sums: dict[tuple[int, int], list[float]] = {}
        for row in csv.DictReader(io.StringIO(text)):
            d, v = row.get("observation_date") or row.get("DATE"), row.get("DGS5")
            if not d or not v or v == ".":
                continue
            y, m = int(d[:4]), int(d[5:7])
            sums.setdefault((y, m), []).append(float(v))
        return cls({k: sum(v) / len(v) for k, v in sums.items()})

    def treasury_5y(self, d: date) -> float:
        if (d.year, d.month) in self.monthly:
            return self.monthly[(d.year, d.month)]
        if self.monthly:
            # nearest month available
            key = min(self.monthly, key=lambda k: abs((k[0] - d.year) * 12 + k[1] - d.month))
            return self.monthly[key]
        return FALLBACK_5Y[min(FALLBACK_5Y, key=lambda y: abs(y - d.year))]

    def spread_for(self, lender_kind: str) -> tuple[float, str, int]:
        """(spread in percentage points, 'measured' or 'assumed', sample size)."""
        measured = self.spreads.get(lender_kind)
        if measured and int(measured.get("n") or 0) >= MIN_SAMPLE:
            return float(measured["median"]), "measured", int(measured["n"])
        return SPREAD.get(lender_kind, SPREAD["unknown"]), "assumed", int(measured["n"]) if measured else 0

    def loan_rate(self, d: date, lender_kind: str) -> float:
        spread, _, _ = self.spread_for(lender_kind)
        rate = self.treasury_5y(d) + spread
        if lender_kind == "individual":
            rate = max(rate, SELLER_FLOOR)
        return round(rate, 2)
