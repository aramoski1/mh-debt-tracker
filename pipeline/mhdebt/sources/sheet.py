"""First-sheet reader for the HUD workbooks. The files store text as inline strings, not shared strings."""
from __future__ import annotations

import io
import zipfile

from lxml import etree

_NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"


def _col_index(ref: str) -> int:
    letters = "".join(ch for ch in ref if ch.isalpha())
    n = 0
    for ch in letters:
        n = n * 26 + (ord(ch.upper()) - 64)
    return n - 1


def _cell_text(cell: etree._Element, shared: list[str]) -> str | None:
    kind = cell.get("t")
    if kind == "inlineStr":
        text = "".join(cell.itertext()).strip()
        return text or None
    value = cell.find(f"{_NS}v")
    if value is None or value.text is None:
        return None
    raw = value.text.strip()
    if not raw:
        return None
    if kind == "s":
        return shared[int(raw)]
    return raw


def read_xlsx(data: bytes, header_marker: str = "HUD PROJECT NUMBER") -> list[dict[str, str | None]]:
    """Rows under the header that contains `header_marker`. A title row above that header is ignored."""
    book = zipfile.ZipFile(io.BytesIO(data))
    shared: list[str] = []
    if "xl/sharedStrings.xml" in book.namelist():
        root = etree.fromstring(book.read("xl/sharedStrings.xml"))
        shared = ["".join(node.itertext()) for node in root.findall(f"{_NS}si")]
    sheet_name = next(name for name in book.namelist() if name.startswith("xl/worksheets/sheet"))
    root = etree.fromstring(book.read(sheet_name))
    table: list[list[str | None]] = []
    for row in root.findall(f"{_NS}sheetData/{_NS}row"):
        cells: dict[int, str | None] = {}
        for cell in row.findall(f"{_NS}c"):
            cells[_col_index(cell.get("r") or "A")] = _cell_text(cell, shared)
        if not cells:
            continue
        table.append([cells.get(i) for i in range(max(cells) + 1)])
    header_at = next((i for i, row in enumerate(table) if header_marker in row), None)
    if header_at is None:
        return []
    headers = [str(cell or "").strip() for cell in table[header_at]]
    out = []
    for row in table[header_at + 1:]:
        if not any(row):
            continue
        out.append({
            headers[i]: (row[i] if i < len(row) else None)
            for i in range(len(headers)) if headers[i]
        })
    return out
