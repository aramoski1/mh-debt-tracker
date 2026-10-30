import io
import json
import zipfile
from datetime import date, timedelta
from pathlib import Path

from mhdebt.rates import BLS_AZ_UNEMPLOYMENT
from mhdebt.sources import edgar_search, exhibits, form_d, hud_fha, news
from mhdebt.sources.sheet import read_xlsx

FIX = Path(__file__).parent / "fixtures"


def _xlsx(rows: list[list]) -> bytes:
    letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    body = []
    for r_i, row in enumerate(rows, start=1):
        cells = []
        for c_i, value in enumerate(row):
            if value is None:
                continue
            ref = f"{letters[c_i]}{r_i}"
            if isinstance(value, tuple):
                cells.append(f'<c r="{ref}" t="n"><v>{value[0]}</v></c>')
            else:
                text = str(value).replace("&", "&amp;")
                cells.append(f'<c r="{ref}" t="inlineStr"><is><t>{text}</t></is></c>')
        body.append(f'<row r="{r_i}">{"".join(cells)}</row>')
    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        f"<sheetData>{''.join(body)}</sheetData></worksheet>"
    )
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as book:
        book.writestr("xl/worksheets/sheet1.xml", xml)
    return buf.getvalue()


def test_hud_keeps_mobile_home_categories_and_drops_lookalike_names():
    headers = [
        "HUD PROJECT NUMBER", "PROPERTY NAME", "PROPERTY CITY", "PROPERTY STATE", "PROPERTY ZIP",
        "UNITS", "INITIAL ENDORSEMENT DATE", "MATURITY DATE", "TERM IN MONTHS", "INTEREST RATE",
        "ORIGINAL MORTGAGE AMOUNT", "HOLDER NAME", "SOA CATEGORY/Sub Category",
    ]
    book = _xlsx([
        ["FHA_BF90_RM_T", "3"],
        headers,
        ["12100410", "BLUE PACIFIC MOBILE HOME PARK", "APTOS", "CA", "95003",
         (100,), (40785,), (55397,), (480,), (4.27,), (5650000,), "LUMENT REAL ESTATE CAPITAL, LL",
         "207 MOBILE HOME COURTS"],
        ["00000008", "NORTH MOBILE NURSING AND REHABILITATION CENTER", "MOBILE", "AL", "36608",
         (40,), (40000,), (50000,), (420,), (5,), (1000000,), "NO DATA AVAILABLE", "207 Nursing Homes"],
        ["00000009", "MANUFACTURERS NATIONAL BANK", "CHICAGO", "IL", "60603",
         (1,), None, None, None, None, None, "A BANK", "221 APARTMENTS"],
        ["00000010", "SOME COURT", "TUCSON", "AZ", "85701",
         (80,), (41000,), (52000,), (360,), (3.5,), (2000000,), "A LENDER",
         "223d 2yr Opr. Loss/207 Mobile Home Park"],
    ])
    rows = read_xlsx(book)
    assert rows[0]["SOA CATEGORY/Sub Category"] == "207 MOBILE HOME COURTS"
    loans = hud_fha.parse_workbook(book, "paid_off")
    by_id = {row["source_loan_id"]: row for row in loans}
    assert set(by_id) == {"12100410", "00000010"}
    park = by_id["12100410"]
    assert park["maturity_date"] == date(1899, 12, 30) + timedelta(days=55397)
    assert park["origination_date"] == date(1899, 12, 30) + timedelta(days=40785)
    assert park["note_rate"] == 4.27
    assert park["property_zip_raw"] == "95003"
    assert park["lender_name_raw"] == "LUMENT REAL ESTATE CAPITAL, LL"
    assert park["status"] == "paid_off"
    assert by_id["00000010"]["property_state_raw"] == "AZ"
    assert hud_fha.excel_date("40785").year == 2011


def test_form_d_keeps_mhc_names_and_the_latest_zip():
    html = """
    <a href="/files/structureddata/data/form-d-data-sets/2026q1_d.zip">q1</a>
    <a href="/files/datastandardsinnovation/data/form-d-data-sets/2026q2_d.zip">q2</a>
    <a href="/files/datastandardsinnovation/data/form-d-data-sets/2026q3_d.zip">q3</a>
    """
    assert form_d.latest_zip_url(html).endswith("/2026q3_d.zip")
    assert not form_d.is_park_issuer("MANUFACTURERS NATIONAL BANK")
    assert form_d.is_park_issuer("Winchester MHC Partners LLC")
    files = {
        "ISSUERS.tsv": (
            "ACCESSIONNUMBER\tIS_PRIMARYISSUER_FLAG\tCIK\tENTITYNAME\tCITY\tSTATEORCOUNTRY\tENTITYTYPE\n"
            "0002155990-26-000001\tYES\t0002155990\tWinchester MHC Partners LLC\tCHARLOTTESVILLE\tVA\tLimited Liability Company\n"
            "0000000001-26-000001\tYES\t0000000001\tAcme Software Inc\tPHOENIX\tAZ\tCorporation\n"
        ),
        "OFFERING.tsv": (
            "ACCESSIONNUMBER\tINDUSTRYGROUPTYPE\tSALE_DATE\tISEQUITYTYPE\tISDEBTTYPE\tTOTALOFFERINGAMOUNT\tTOTALAMOUNTSOLD\n"
            "0002155990-26-000001\tOther\t2026-09-01\ttrue\tfalse\tIndefinite\t1250000\n"
        ),
        "FORMDSUBMISSION.tsv": "ACCESSIONNUMBER\tFILING_DATE\n0002155990-26-000001\t2026-09-18\n",
    }
    rows = form_d.parse_quarter(files)
    assert len(rows) == 1
    assert rows[0]["issuer_name"] == "Winchester MHC Partners LLC"
    assert rows[0]["state"] == "VA"
    assert rows[0]["filed_on"] == "2026-09-18"
    assert rows[0]["total_offering"] is None
    assert rows[0]["total_sold"] == 1_250_000
    assert rows[0]["is_equity"] is True
    assert rows[0]["url"].endswith("/0002155990-26-000001-index.html")


def test_edgar_hit_becomes_an_archives_link():
    hits = edgar_search.parse_hits(json.loads((FIX / "efts_mobile_home.json").read_text()))
    assert hits[0]["source_id"] == "0000912593-26-000086"
    assert hits[0]["form"] == "10-K"
    assert hits[0]["filed_on"] == "2026-02-25"
    assert hits[0]["url"] == (
        "https://www.sec.gov/Archives/edgar/data/912593/000091259326000086/0000912593-26-000086-index.html"
    )
    assert "SUN COMMUNITIES" in hits[0]["title"]


def test_news_rss_skips_items_without_a_link():
    rows = news.parse_rss((FIX / "news_az_mhp.xml").read_bytes())
    assert len(rows) == 1
    assert rows[0]["title"] == "Apache Junction park listed for sale"
    assert rows[0]["filed_on"] == "2026-10-30"
    assert rows[0]["source"] == "google_news"


def test_exhibit_index_keeps_ex99_only():
    links = exhibits.exhibit_links(
        json.loads((FIX / "edgar_index_ex99.json").read_text()),
        "https://www.sec.gov/Archives/edgar/data/1/2",
    )
    assert links == [{"name": "ex99-1.htm", "url": "https://www.sec.gov/Archives/edgar/data/1/2/ex99-1.htm"}]
    named = exhibits.exhibit_links(
        {"directory": {"item": [{"name": "exh_102.xml"}, {"name": "exh_99.htm"}]}},
        "https://www.sec.gov/Archives/edgar/data/1/2",
    )
    assert [row["name"] for row in named] == ["exh_99.htm"]
    pictures = exhibits.exhibit_links(
        {"directory": {"item": [{"name": "ex99-1.htm"}, {"name": "ex99-1_001.jpg"}]}},
        "https://www.sec.gov/Archives/edgar/data/1/2",
    )
    assert [row["name"] for row in pictures] == ["ex99-1.htm"]


def test_arizona_unemployment_series_is_the_one_that_answered():
    assert BLS_AZ_UNEMPLOYMENT == "LASST040000000000003"
