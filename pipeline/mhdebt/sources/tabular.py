"""Read CSV/XLSX files whose column names vary between vendors and vintages.

Each source declares the logical fields it needs and a list of accepted header spellings.
Headers are compared after lowercasing and stripping everything but letters and digits.
"""
from __future__ import annotations

import csv
import io
import re
from pathlib import Path
from typing import Iterator

_KEY = re.compile(r"[^a-z0-9]")


def key(h: str) -> str:
    return _KEY.sub("", h.lower())


def resolve_columns(headers: list[str], aliases: dict[str, list[str]]) -> dict[str, str]:
    """Map logical field -> actual header. Exact alias match first, then 'alias contained in header'."""
    by_key = {key(h): h for h in headers}
    out: dict[str, str] = {}
    for logical, names in aliases.items():
        for n in names:
            if key(n) in by_key:
                out[logical] = by_key[key(n)]
                break
        else:
            for n in names:
                hit = next((h for k, h in by_key.items() if key(n) and key(n) in k), None)
                if hit:
                    out[logical] = hit
                    break
    return out


def read_rows(path: Path | str, aliases: dict[str, list[str]], encoding: str = "utf-8-sig") -> Iterator[dict]:
    """Yield dicts keyed by logical field names. Unmapped logical fields are None."""
    path = Path(path)
    if path.suffix.lower() in (".xlsx", ".xlsm"):
        from openpyxl import load_workbook  # optional dependency

        ws = load_workbook(path, read_only=True, data_only=True).active
        it = ws.iter_rows(values_only=True)
        headers = [str(h or "") for h in next(it)]
        rows = ({headers[i]: v for i, v in enumerate(r) if i < len(headers)} for r in it)
    else:
        raw = path.read_bytes()
        text = None
        for enc in (encoding, "latin-1"):
            try:
                text = raw.decode(enc)
                break
            except UnicodeDecodeError:
                continue
        sample = text[:20000]
        try:
            dialect = csv.Sniffer().sniff(sample, delimiters=",|\t;")
        except csv.Error:
            dialect = csv.excel
        reader = csv.DictReader(io.StringIO(text), dialect=dialect)
        headers = reader.fieldnames or []
        rows = reader
    cols = resolve_columns(headers, aliases)
    missing = [f for f in aliases if f not in cols]
    if missing:
        # Not fatal: a field may simply not exist in this vintage. Surface it once for the operator.
        print(f"[tabular] {path.name}: no column found for {missing}")
    for r in rows:
        yield {logical: (r.get(cols[logical]) if logical in cols else None) for logical in aliases}
