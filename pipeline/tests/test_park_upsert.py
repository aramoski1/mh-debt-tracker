"""A new park still inserts when the source leaves a column blank."""
from mhdebt.db import PARK_COLS, bind_columns
from mhdebt.fieldlock import apply_ingest


def test_new_park_insert_binds_every_blank_column():
    merged, tags = apply_ingest(
        {},
        {},
        {"name": "Sunrise Mobile Home Park", "address": "4400 E Main St", "phone": None, "website": ""},
        "hifld",
    )
    merged["name_norm"] = "sunrise mobile home park"
    merged["sources"] = "{}"
    merged["kind"] = merged.get("kind") or "unknown"
    merged["state"] = merged.get("state") or ""
    merged["field_sources"] = tags
    params = bind_columns(merged, [*PARK_COLS, "name_norm", "sources", "field_sources"])

    assert params["name"] == "Sunrise Mobile Home Park"
    assert params["address"] == "4400 E Main St"
    assert params["phone"] is None
    assert params["website"] is None
    assert params["units"] is None
    assert params["lat"] is None
    assert params["county"] is None
    assert set(PARK_COLS) <= set(params)
    assert "phone" not in tags
    assert "website" not in tags
