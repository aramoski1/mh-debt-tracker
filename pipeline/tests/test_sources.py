from datetime import date
from types import SimpleNamespace

from mhdebt import docai
from mhdebt.geocode import parse_response
from mhdebt.sources import agency, maricopa, pima, sba
from mhdebt.sources.doc_types import normalize_doc_type


def test_doc_types():
    assert normalize_doc_type("DEED TRST") == "deed_of_trust"
    assert normalize_doc_type("DT") == "deed_of_trust"
    assert normalize_doc_type("RZ") == "release"
    assert normalize_doc_type("REL D/T") == "release"
    assert normalize_doc_type("PR") == "partial_release"
    assert normalize_doc_type("MF") == "modification"
    assert normalize_doc_type("AS") == "assignment"
    assert normalize_doc_type("NOTICE OF TRUSTEE SALE") == "trustee_sale_notice"
    assert normalize_doc_type("WARRANTY DEED") == "deed"
    assert normalize_doc_type("MG") == "mortgage"


def test_maricopa_doc_parsing_and_adjacency():
    j = {"recordingNumber": "20210900002", "recordingDate": "09-01-2021", "documentCodes": ["DEED TRST"],
         "names": ["SAGUARO VISTA HOLDINGS LLC", "COMMERCE BANK OF ARIZONA"], "pageAmount": 24}
    d = maricopa._doc_from_json("20210900002", j)
    assert d["doc_type"] == "deed_of_trust" and d["recording_date"] == date(2021, 9, 1) and d["page_count"] == 24
    assert d["pdf_url"].endswith("recordingNumber=20210900002&suffix=")

    docs = {
        "20210900002": d,
        "20210900003": maricopa._doc_from_json("20210900003", {"documentCodes": ["WAR DEED"], "names": ["X"]}),
    }
    rec = maricopa.Recorder(client=None)
    rec.document = lambda n: docs.get(n)  # type: ignore[method-assign]
    found = rec.adjacent_loans("20210900001", "Saguaro Vista Holdings, L.L.C.")
    assert [x["recording_number"] for x in found] == ["20210900002"]
    assert found[0]["references_number"] == "20210900001"


def test_maricopa_puc_kinds():
    assert maricopa.park_kind_from_puc("0840") == "mhp"
    assert maricopa.park_kind_from_puc("0852") == "rv"
    assert maricopa.park_kind_from_puc("0891") == "mixed"


def test_agency_loader(tmp_path):
    f = tmp_path / "dus.csv"
    f.write_text(
        "Loan Number,Property Name,Property Address,Property City,Property State,Property Zip Code,"
        "Specific Property Type,Number of Units,Seller/Servicer,Note Date,Maturity Date,Original Loan Amount,"
        "Current UPB,Current Note Rate,Most Recent DSCR\n"
        "123456,Shady Acres MHC,100 Main St,Mesa,AZ,85201,Manufactured Housing Community,120,Walker & Dunlop,"
        "06/15/2019,07/01/2029,6500000,6100000,4.12,1.62\n"
        "222,Tower Apts,1 Elm,Mesa,AZ,85201,Conventional,200,Berkadia,01/01/2020,01/01/2030,1,1,3,1\n"
        "333,Gulf MHC,1 Bay,Tampa,FL,33601,Manufactured Housing Community,90,Arbor,01/01/2020,01/01/2027,1,1,3,1\n")
    rows = list(agency.load(f, "fannie", ["AZ"]))
    assert len(rows) == 1
    r = rows[0]
    assert r["maturity_date"] == date(2029, 7, 1) and r["note_rate"] == 4.12 and r["dscr_current"] == 1.62
    assert r["units"] == 120 and r["lender_kind"] == "agency_fannie"


def test_sba_loader(tmp_path):
    f = tmp_path / "foia.csv"
    f.write_text(
        "Program,BorrName,BorrStreet,BorrCity,BorrState,BorrZip,BankName,GrossApproval,ApprovalDate,"
        "InitialInterestRate,TermInMonths,NAICSCode,ProjectCounty,ProjectState,LoanStatus\n"
        "7A,Cactus RV Park LLC,1 Desert Rd,Quartzsite,AZ,85346,Live Oak Banking Company,2100000,03/15/2022,"
        "6.75,300,721211,LA PAZ,AZ,EXEMPT\n"
        "7A,Joe's Pizza,1 Main,Mesa,AZ,85201,Chase,50000,01/01/2022,8,120,722511,MARICOPA,AZ,PIF\n")
    rows = list(sba.load(f, ["AZ"]))
    assert len(rows) == 1
    assert rows[0]["maturity_date"] == date(2047, 3, 15) and rows[0]["park_kind"] == "rv"


def test_pima_export(tmp_path):
    f = tmp_path / "pima.csv"
    f.write_text("Document Number,Document Type,Recording Date,Grantor,Grantee,Parcel\n"
                 "20221234567,DEED OF TRUST,05/02/2022,DESERT PALMS LLC,ARIZONA BANK & TRUST,135-01-0010\n")
    rows = list(pima.load_recorder_export(f))
    assert rows[0]["doc_type"] == "deed_of_trust" and rows[0]["apns"] == ["135-01-0010"]


def test_geocode_response():
    text = ('"1","100 MAIN ST, MESA, AZ, 85201","Match","Exact","100 N MAIN ST, MESA, AZ, 85201",'
            '"-111.83,33.41","123","L"\n"2","NOWHERE","No_Match"\n')
    assert parse_response(text) == {"1": (33.41, -111.83)}


class FakeAnthropic:
    """Stands in for anthropic.Anthropic: returns a tool_use block like the real API."""

    def __init__(self, payload):
        self.payload = payload
        self.calls = []
        self.messages = self

    def create(self, **kw):
        self.calls.append(kw)
        return SimpleNamespace(content=[SimpleNamespace(type="tool_use", input=self.payload)],
                               usage=SimpleNamespace(input_tokens=5000, output_tokens=300))


def test_docai_extraction_requires_evidence():
    good = FakeAnthropic({
        "document_type": "deed_of_trust", "lender_name": "Commerce Bank of Arizona", "loan_amount": 4600000,
        "note_date": "2021-08-27", "maturity_date": "2026-09-01", "maturity_is_computed": False,
        "interest_rate_pct": 3.95, "apns": ["145-10-001"],
        "evidence": [{"field": "maturity_date", "page": 2,
                      "quote": "the entire balance shall be due and payable on September 1, 2026"}]})
    x = docai.extract(good, "claude-sonnet-5-5", pdf=b"%PDF-1.4 fake")
    assert docai.trustworthy_maturity(x) == date(2026, 9, 1)
    call = good.calls[0]
    assert call["tool_choice"] == {"type": "tool", "name": "record_loan_terms"}
    assert call["messages"][0]["content"][0]["type"] == "document"

    no_quote = FakeAnthropic({"document_type": "deed_of_trust", "maturity_date": "2026-09-01",
                              "maturity_is_computed": False, "apns": [], "evidence": []})
    assert docai.trustworthy_maturity(docai.extract(no_quote, "m", pdf=b"x")) is None
