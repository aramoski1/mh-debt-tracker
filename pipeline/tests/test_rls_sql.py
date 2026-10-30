"""The new tables turn row level security on in the migration text.

This does not open two Supabase roles. It checks the SQL we ship.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2] / "supabase" / "migrations"


def test_ops_and_buyer_desk_enable_rls():
    names = [
        "20261030000011_ops.sql",
        "20261030000012_buyer_desk.sql",
    ]
    text = "\n".join((ROOT / name).read_text(encoding="utf-8") for name in names)
    assert "enable row level security" in text
    assert "ingestion_errors" in text
    assert "watch_findings" in text
    assert "saved_views" in text
    assert "create policy" in text
