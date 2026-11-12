"""The baseline review: a later tape can refresh its own numbers, and an empty index pays nothing off."""
from datetime import date
from types import SimpleNamespace

from mhdebt import db, jobs
from mhdebt.sources.edgar_cmbs import CmbsLoan, CmbsProperty


def test_empty_filing_list_pays_nothing_off():
    assert jobs.trusts_dropped_from_filings({"0001": "acc-1", "0002": "acc-2"}, []) == []


def test_a_trust_missing_from_a_real_list_is_gone():
    filings = [SimpleNamespace(cik="0001")]
    assert jobs.trusts_dropped_from_filings({"0001": "acc-1", "0002": "acc-2"}, filings) == ["0002"]


def test_a_loan_in_this_months_file_is_marked_active(monkeypatch):
    saved = {}

    def capture(conn, source, source_loan_id, rec):
        saved["source"] = source
        saved["id"] = source_loan_id
        saved["rec"] = rec
        return "loan-id"

    monkeypatch.setattr(db, "upsert_loan", capture)
    monkeypatch.setattr(db, "upsert_lender", lambda *args, **kwargs: "lender-id")
    prop = CmbsProperty(None, None, None, "AZ", None, None, None, None, None, None, None, None, None, None)
    loan = CmbsLoan(
        "0001", "TEST 2019-C1", "12", None, date(2019, 1, 1), 1_000_000, date(2029, 1, 1),
        120, 360, 4.5, 4.2, 800_000, False, True, False, "current", None, date(2026, 10, 31), [prop],
    )
    assert jobs.upsert_cmbs_loan(None, loan) == 1
    assert saved["source"] == "cmbs"
    assert saved["rec"]["status"] == "active"
    assert saved["rec"]["current_balance"] == 800_000
