"""A nightly ingest must not overwrite a value Jack typed."""
from mhdebt.fieldlock import apply_ingest


def test_nightly_run_keeps_jacks_fields_and_fills_blanks():
    existing = {"name": "Sunrise Estates", "units": 120, "phone": None}
    sources = {"name": "jack", "units": "jack"}
    incoming = {"name": "Park at 4400 E Main", "units": 118, "phone": "480-555-0100"}

    nxt, tags = apply_ingest(existing, sources, incoming, "hifld")

    assert nxt["name"] == "Sunrise Estates"
    assert nxt["units"] == 120
    assert nxt["phone"] == "480-555-0100"
    assert tags["name"] == "jack"
    assert tags["phone"] == "hifld"


def test_edgar_replaces_an_estimate_but_not_a_document():
    existing = {"maturity_date": "2034-01-01", "note_rate": 4.1}
    sources = {"maturity_date": "estimate", "note_rate": "document"}
    incoming = {"maturity_date": "2027-06-01", "note_rate": 7.25}

    nxt, tags = apply_ingest(existing, sources, incoming, "edgar")

    assert nxt["maturity_date"] == "2027-06-01"
    assert tags["maturity_date"] == "edgar"
    assert nxt["note_rate"] == 4.1
    assert tags["note_rate"] == "document"


def test_same_writer_refreshes_its_own_balance():
    nxt, tags = apply_ingest(
        {"current_balance": 5_000_000, "note_rate": 4.1},
        {"current_balance": "edgar", "note_rate": "jack"},
        {"current_balance": 4_800_000, "note_rate": 6.5},
        "edgar",
    )
    assert nxt["current_balance"] == 4_800_000
    assert tags["current_balance"] == "edgar"
    assert nxt["note_rate"] == 4.1
    assert tags["note_rate"] == "jack"


def test_blank_phone_does_not_clear_a_stored_phone():
    nxt, tags = apply_ingest(
        {"name": "Sunrise", "phone": "480-555-0100", "website": "https://example.test"},
        {"phone": "hifld", "website": "jack"},
        {"phone": None, "website": ""},
        "hifld",
    )
    assert nxt["phone"] == "480-555-0100"
    assert nxt["website"] == "https://example.test"
    assert tags["phone"] == "hifld"
    assert tags["website"] == "jack"


def test_ingest_does_not_clear_a_value_with_a_blank():
    nxt, tags = apply_ingest({"name": "Sunrise Estates"}, {"name": "assessor"}, {"name": None, "city": ""}, "hifld")
    assert nxt["name"] == "Sunrise Estates"
    assert tags["name"] == "assessor"
    assert "city" not in nxt or nxt.get("city") in (None, "")


def test_untagged_filled_value_survives_a_rerun():
    nxt, _ = apply_ingest({"name": "Sunrise Estates"}, {}, {"name": "Park at 4400 E Main"}, "hifld")
    assert nxt["name"] == "Sunrise Estates"
