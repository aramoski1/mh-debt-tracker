"""CMBS loan-level data from SEC EDGAR (Regulation AB II asset data, exhibit EX-102).

Every public CMBS trust files a monthly ABS-EE with an XML file listing each loan and its properties,
including property type (MH = manufactured housing), address, maturity date, balance, rate and DSCR.
This module finds each trust's latest ABS-EE, streams its EX-102 file, and keeps only park loans.

Discovery:  https://www.sec.gov/Archives/edgar/full-index/{year}/QTR{q}/form.idx  (form type "ABS-EE")
Filing:     https://www.sec.gov/Archives/edgar/data/{cik}/{accession_no_dashes}/index.json
"""
from __future__ import annotations

import io
import re
from dataclasses import dataclass, field
from datetime import date
from typing import Iterable, Iterator

from lxml import etree

from ..http import PoliteClient
from ..normalize import clean, months_between, parse_date, parse_money, parse_pct, parse_share_pct

CMBS_NS = "http://www.sec.gov/edgar/document/absee/cmbs/assetdata"
ARCHIVES = "https://www.sec.gov/Archives"

# Property type codes that can be a park. MH is manufactured housing. RV parks have no code of their own;
# they show up as OT (other), LO (lodging) or MU (mixed use), so for those we also require park words in the name.
PARK_TYPE_CODES = {"MH"}
MAYBE_PARK_CODES = {"OT", "LO", "MU"}
RV_NAME = re.compile(r"\b(RV|R V|RESORT|CAMPGROUND|KOA|MOBILE HOME|MHP|MHC|TRAILER)\b")

# Shelf names that are never CMBS; skipping them avoids downloading large auto/card/RMBS files.
NON_CMBS = re.compile(
    r"AUTO|VEHICLE|MOTOR|LEASE TRUST|RECEIVABLES|CARD|EQUIPMENT|STUDENT|TOYOTA|HONDA|NISSAN|HYUNDAI|"
    r"CARMAX|ALLY|SANTANDER DRIVE|DRIVE AUTO|GM FINANCIAL|MERCEDES|BMW|VOLKSWAGEN|HARLEY|WORLD OMNI|"
    r"VERIZON|SEQUOIA|EXETER|FORD CREDIT|CNH|JOHN DEERE|KUBOTA|DELL|AMERICAN EXPRESS|DISCOVER|SYNCHRONY|"
    r"CITIBANK CREDIT|CHASE ISSUANCE|BARCLAYS DRYROCK|PORSCHE|TESLA|VOLVO|FIFTH THIRD AUTO|USAA AUTO"
)


@dataclass
class AbsFiling:
    cik: str
    company: str
    filed: date
    path: str  # edgar/data/{cik}/{accession}.txt

    @property
    def accession(self) -> str:
        return self.path.rsplit("/", 1)[-1].removesuffix(".txt")

    @property
    def folder(self) -> str:
        return f"{ARCHIVES}/edgar/data/{int(self.cik)}/{self.accession.replace('-', '')}"


@dataclass
class CmbsProperty:
    name: str | None
    address: str | None
    city: str | None
    state: str | None
    zip: str | None
    county: str | None
    type_code: str | None
    units: int | None
    year_built: int | None
    valuation: float | None
    occupancy: float | None
    noi_current: float | None
    dscr_noi_current: float | None
    debt_service_current: float | None
    share: float = 1.0  # this property's share of the loan (by units, else value, else equal)


@dataclass
class CmbsLoan:
    trust_cik: str
    trust_name: str
    asset_number: str
    originator: str | None
    origination_date: date | None
    original_amount: float | None
    maturity_date: date | None
    term_months: int | None
    amort_months: int | None
    original_rate: float | None
    current_rate: float | None
    current_balance: float | None
    interest_only: bool | None
    balloon: bool | None
    modified: bool | None
    payment_status: str | None
    servicer: str | None
    reporting_period_end: date | None
    properties: list[CmbsProperty] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Discovery
# ---------------------------------------------------------------------------

def quarters_back(today: date, n: int) -> list[tuple[int, int]]:
    y, q = today.year, (today.month - 1) // 3 + 1
    out = []
    for _ in range(n):
        out.append((y, q))
        q -= 1
        if q == 0:
            y, q = y - 1, 4
    return out


def parse_form_index(text: str) -> Iterator[AbsFiling]:
    """Parse EDGAR's fixed-width form.idx and yield ABS-EE filings."""
    for line in text.splitlines():
        if not line.startswith("ABS-EE"):
            continue
        # Columns are separated by 2+ spaces; the company name can contain single spaces.
        parts = re.split(r"\s{2,}", line.strip())
        if len(parts) < 5 or parts[0] != "ABS-EE":
            continue
        form, company, cik, filed, path = parts[0], parts[1], parts[2], parts[3], parts[4]
        d = parse_date(filed)
        if d:
            yield AbsFiling(cik=cik, company=company, filed=d, path=path)


def latest_cmbs_filings(client: PoliteClient, today: date | None = None, quarters: int = 2) -> list[AbsFiling]:
    """Most recent ABS-EE per filer over the last `quarters` quarters, excluding obvious non-CMBS shelves."""
    today = today or date.today()
    latest: dict[str, AbsFiling] = {}
    for year, q in quarters_back(today, quarters):
        url = f"{ARCHIVES}/edgar/full-index/{year}/QTR{q}/form.idx"
        try:
            text = client.get(url, cache_ttl=6 * 3600).text
        except Exception:  # noqa: BLE001 - a future quarter may not exist yet
            continue
        for f in parse_form_index(text):
            if NON_CMBS.search(f.company.upper()):
                continue
            if f.cik not in latest or f.filed > latest[f.cik].filed:
                latest[f.cik] = f
    return sorted(latest.values(), key=lambda f: f.company)


def find_ex102_url(client: PoliteClient, filing: AbsFiling) -> str | None:
    idx = client.get(f"{filing.folder}/index.json", cache_ttl=30 * 86400).json()
    names = [i["name"] for i in idx.get("directory", {}).get("item", [])]
    xmls = [n for n in names if n.lower().endswith(".xml")]
    for pat in (r"ex[-_]?102|exh[-_]?102", r"(^|[^0-9])102([^0-9]|$)"):
        for n in xmls:
            if re.search(pat, n.lower()):
                return f"{filing.folder}/{n}"
    return None


# ---------------------------------------------------------------------------
# Parsing
# ---------------------------------------------------------------------------

def _txt(el: etree._Element, tag: str) -> str | None:
    child = el.find(f"{{{CMBS_NS}}}{tag}")
    if child is None or child.text is None:
        return None
    return child.text.strip() or None


def _int(v: str | None) -> int | None:
    x = parse_money(v)
    return int(x) if x is not None else None


def _bool(v: str | None) -> bool | None:
    if v is None:
        return None
    return v.strip().lower() in ("true", "1", "y", "yes")


def _annual_noi(el: etree._Element) -> float | None:
    """Most-recent NOI is often year-to-date or a trailing quarter; scale partial periods to 12 months."""
    noi = parse_money(_txt(el, "mostRecentNetOperatingIncomeAmount"))
    start = parse_date(_txt(el, "mostRecentFinancialsStartDate"))
    end = parse_date(_txt(el, "mostRecentFinancialsEndDate"))
    if noi is None or not start or not end or end <= start:
        return noi
    months = months_between(start, end) + 1
    return noi * 12 / months if 1 <= months < 11 else noi


def _property(el: etree._Element) -> CmbsProperty:
    return CmbsProperty(
        name=_txt(el, "propertyName"),
        address=_txt(el, "propertyAddress"),
        city=_txt(el, "propertyCity"),
        state=_txt(el, "propertyState"),
        zip=_txt(el, "propertyZip"),
        county=_txt(el, "propertyCounty"),
        type_code=(_txt(el, "propertyTypeCode") or "").upper() or None,
        units=_int(_txt(el, "unitsBedsRoomsNumber") or _txt(el, "unitsBedsRoomsSecuritizationNumber")),
        year_built=_int(_txt(el, "yearBuiltNumber")),
        valuation=parse_money(_txt(el, "mostRecentValuationAmount") or _txt(el, "valuationSecuritizationAmount")),
        occupancy=parse_share_pct(_txt(el, "mostRecentPhysicalOccupancyPercentage")
                                  or _txt(el, "physicalOccupancySecuritizationPercentage")),
        noi_current=_annual_noi(el),
        dscr_noi_current=parse_money(_txt(el, "mostRecentDebtServiceCoverageNetOperatingIncomePercentage")),
        debt_service_current=parse_money(_txt(el, "mostRecentDebtServiceAmount")),
    )


def is_park_property(p: CmbsProperty) -> bool:
    if p.type_code in PARK_TYPE_CODES:
        return True
    return p.type_code in MAYBE_PARK_CODES and bool(RV_NAME.search(clean(p.name)))


def parse_ex102(
    stream: io.BufferedIOBase | bytes,
    trust_cik: str,
    trust_name: str,
    states: Iterable[str] | None = None,
) -> Iterator[CmbsLoan]:
    """Stream an EX-102 file and yield loans with at least one park property (in `states`, if given)."""
    states = {s.upper() for s in states} if states else None
    source = io.BytesIO(stream) if isinstance(stream, (bytes, bytearray)) else stream
    for _, el in etree.iterparse(source, events=("end",), tag=f"{{{CMBS_NS}}}assets", huge_tree=True):
        props = [_property(p) for p in el.findall(f"{{{CMBS_NS}}}property")]
        # Allocate the loan across ALL its properties before filtering, so a park in a mixed portfolio
        # carries only its own share of the debt.
        units = [p.units or 0 for p in props]
        vals = [p.valuation or 0 for p in props]
        basis = units if all(units) else vals if all(vals) else None
        for i, p in enumerate(props):
            p.share = (basis[i] / sum(basis)) if basis else 1 / max(1, len(props))
        parks = [p for p in props if is_park_property(p) and (states is None or (p.state or "").upper() in states)]
        if parks:
            yield CmbsLoan(
                trust_cik=trust_cik,
                trust_name=trust_name,
                asset_number=_txt(el, "assetNumber") or "",
                originator=_txt(el, "originatorName"),
                origination_date=parse_date(_txt(el, "originationDate")),
                original_amount=parse_money(_txt(el, "originalLoanAmount")),
                maturity_date=parse_date(_txt(el, "maturityDate")),
                term_months=_int(_txt(el, "originalTermLoanNumber")),
                amort_months=_int(_txt(el, "originalAmortizationTermNumber")),
                original_rate=parse_pct(_txt(el, "originalInterestRatePercentage")),
                current_rate=parse_pct(_txt(el, "reportPeriodInterestRatePercentage")),
                current_balance=parse_money(_txt(el, "reportPeriodEndActualBalanceAmount")),
                interest_only=_bool(_txt(el, "interestOnlyIndicator")),
                balloon=_bool(_txt(el, "balloonIndicator")),
                modified=_bool(_txt(el, "modifiedIndicator")),
                payment_status=_txt(el, "paymentStatusLoanCode"),
                servicer=_txt(el, "primaryServicerName"),
                reporting_period_end=parse_date(_txt(el, "reportingPeriodEndDate")),
                properties=parks,
            )
        el.clear()
        while el.getprevious() is not None:
            del el.getparent()[0]


def fetch_park_loans(client: PoliteClient, filing: AbsFiling, states: Iterable[str] | None) -> list[CmbsLoan] | None:
    """Park loans in this filing. None means the filing has no CMBS asset data (so nothing can be inferred
    about payoffs); an empty list means a CMBS file was read and it holds no park loans in `states`."""
    url = find_ex102_url(client, filing)
    if not url:
        return None
    with client._client.stream("GET", url) as resp:  # stream: some files are hundreds of MB
        resp.raise_for_status()
        raw = resp.iter_bytes()
        head = b""
        for chunk in raw:
            head += chunk
            if len(head) > 4096:
                break
        if CMBS_NS.encode() not in head:
            return None  # RMBS, auto, or another asset class
        body = _ChainedStream(head, raw)
        return list(parse_ex102(body, filing.cik, filing.company, states))


class _ChainedStream(io.RawIOBase):
    """File-like wrapper over (already read prefix + remaining byte iterator) for streaming XML parsing."""

    def __init__(self, head: bytes, rest: Iterator[bytes]):
        self._buf = head
        self._rest = rest

    def readable(self) -> bool:
        return True

    def readinto(self, b) -> int:  # type: ignore[override]
        while not self._buf:
            try:
                self._buf = next(self._rest)
            except StopIteration:
                return 0
        n = min(len(b), len(self._buf))
        b[:n] = self._buf[:n]
        self._buf = self._buf[n:]
        return n

    def read(self, size: int = -1) -> bytes:  # lxml calls read()
        if size is None or size < 0:
            chunks = [self._buf, *self._rest]
            self._buf = b""
            return b"".join(chunks)
        buf = bytearray(size)
        n = self.readinto(buf)
        return bytes(buf[:n])
