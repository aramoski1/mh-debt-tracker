import os
import uuid
from pathlib import Path

import psycopg
import pytest

MIGRATIONS = Path(__file__).resolve().parents[2] / "supabase" / "migrations"
ADMIN_URL = os.getenv("TEST_DATABASE_ADMIN_URL", "postgresql://postgres@localhost:54329/postgres?host=/tmp")


@pytest.fixture()
def conn():
    """A fresh database with all migrations applied. Skips if no local Postgres is available."""
    try:
        admin = psycopg.connect(ADMIN_URL, autocommit=True)
    except psycopg.OperationalError:
        pytest.skip("no local Postgres (set TEST_DATABASE_ADMIN_URL)")
    name = f"mhdebt_test_{uuid.uuid4().hex[:8]}"
    admin.execute(f"create database {name}")
    url = ADMIN_URL.replace("/postgres?", f"/{name}?")
    with psycopg.connect(url, autocommit=True) as c:
        for f in sorted(MIGRATIONS.glob("*.sql")):
            c.execute(f.read_text())
    from mhdebt import db

    c = db.connect(url)
    try:
        yield c
    finally:
        c.close()
        admin.execute(f"drop database {name} with (force)")
        admin.close()
