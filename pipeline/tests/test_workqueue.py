import pytest

from mhdebt.ingestlog import sanitize
from mhdebt.workqueue import UnknownJob, apply_result, backoff_seconds, enqueue


def test_sanitize_hides_vendor_noise():
    assert "slow down" in sanitize("HTTP 429 Too Many Requests")
    assert "credit" in sanitize("Your credit balance is too low").lower()
    assert "overloaded" in sanitize("Error 529 overloaded")
    assert sanitize("parcel 12 unmatched") == "parcel 12 unmatched"


def test_retry_then_fail():
    job = {"attempts": 0, "status": "pending"}
    once = apply_result(job, False, "timeout")
    assert once["status"] == "pending" and once["attempts"] == 1
    assert once["delay_seconds"] == backoff_seconds(1)
    twice = apply_result(once, False, "timeout")
    third = apply_result(twice, False, "timeout")
    assert third["status"] == "failed" and third["attempts"] == 3


def test_success_clears_the_error():
    done = apply_result({"attempts": 1, "last_error": "timeout"}, True, result={"note": "ok"})
    assert done["status"] == "done" and done["last_error"] is None


def test_unknown_kind_is_refused():
    with pytest.raises(UnknownJob):
        enqueue(None, "enrich_property", {})
