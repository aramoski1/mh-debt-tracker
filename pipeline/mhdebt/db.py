"""Database access. Thin SQL helpers over psycopg; every write is an idempotent upsert."""
from __future__ import annotations

import json
from contextlib import contextmanager
from datetime import date
from typing import Any, Iterator

import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

from .config import settings
from .fieldlock import apply_ingest
from .normalize import entity_type, norm_entity, norm_park_name


def connect(url: str | None = None) -> psycopg.Connection:
    url = url or settings.database_url
    if not url:
        raise RuntimeError("DATABASE_URL is not set")
    return psycopg.connect(url, row_factory=dict_row, autocommit=False)


def _j(v: Any) -> Jsonb | None:
    return None if v is None else Jsonb(json.loads(json.dumps(v, default=str)))


@contextmanager
def source_run(conn: psycopg.Connection, source: str) -> Iterator[dict]:
    """Record a pipeline run with its stats; commits on success, records the error on failure."""
    stats: dict[str, Any] = {}
    run_id = conn.execute("insert into source_runs (source) values (%s) returning id", (source,)).fetchone()["id"]
    conn.commit()
    try:
        yield stats
        conn.execute(
            "update source_runs set finished_at = now(), status = 'ok', stats = %s where id = %s", (_j(stats), run_id)
        )
        conn.commit()
    except Exception as exc:  # noqa: BLE001
        conn.rollback()
        conn.execute(
            "update source_runs set finished_at = now(), status = 'error', stats = %s, error = %s where id = %s",
            (_j(stats), repr(exc)[:2000], run_id),
        )
        conn.commit()
        raise


def get_state(conn: psycopg.Connection, source: str) -> dict:
    row = conn.execute("select state from source_state where source = %s", (source,)).fetchone()
    return row["state"] if row else {}


def set_state(conn: psycopg.Connection, source: str, state: dict) -> None:
    conn.execute(
        """insert into source_state (source, state) values (%s, %s)
           on conflict (source) do update set state = excluded.state, updated_at = now()""",
        (source, _j(state)),
    )


# ---------------------------------------------------------------------------
# Upserts
# ---------------------------------------------------------------------------

def upsert_owner(conn, name: str, *, mailing: str | None = None, city: str | None = None,
                 state: str | None = None, zip_: str | None = None) -> str | None:
    if not name or not norm_entity(name):
        return None
    row = conn.execute(
        """insert into owners (name, name_norm, entity_type, mailing_address, mailing_city, mailing_state, mailing_zip)
           values (%s, %s, %s, %s, %s, %s, coalesce(%s, ''))
           on conflict (name_norm, mailing_zip) do update set
             mailing_address = coalesce(excluded.mailing_address, owners.mailing_address),
             mailing_city = coalesce(excluded.mailing_city, owners.mailing_city),
             mailing_state = coalesce(excluded.mailing_state, owners.mailing_state),
             updated_at = now()
           returning id""",
        (name.strip(), norm_entity(name), entity_type(name), mailing, city, state, zip_),
    ).fetchone()
    return str(row["id"])


PARK_COLS = ["name", "address", "city", "state", "zip", "county", "lat", "lon", "kind", "units", "status", "website", "phone"]
WRITER_TAG = {"hifld": "hifld", "cmbs": "edgar", "edgar": "edgar", "sba": "sba", "hud": "hud", "maricopa": "assessor", "pima": "assessor"}


def upsert_park_by_source(conn, source: str, source_id: str, rec: dict) -> str:
    """Insert or update a park keyed by an external id stored in parks.sources[source]."""
    existing = conn.execute(
        f"select id, {', '.join(PARK_COLS)}, field_sources from parks where sources->>%s = %s",
        (source, source_id),
    ).fetchone()
    incoming = {c: rec.get(c) for c in PARK_COLS}
    writer = WRITER_TAG.get(source, source if source in {"hifld", "jack"} else "web")
    if existing:
        merged, tags = apply_ingest(dict(existing), existing["field_sources"] or {}, incoming, writer)
        merged["name_norm"] = norm_park_name(merged.get("name")) or existing.get("name_norm")
        sets = ", ".join(f"{c} = %({c})s" for c in [*PARK_COLS, "name_norm"])
        conn.execute(
            f"update parks set {sets}, field_sources = %(field_sources)s, updated_at = now() where id = %(id)s",
            {**merged, "field_sources": _j(tags), "id": existing["id"]},
        )
        return str(existing["id"])
    merged, tags = apply_ingest({}, {}, incoming, writer)
    merged["name_norm"] = norm_park_name(merged.get("name"))
    merged["sources"] = _j({source: source_id})
    merged["kind"] = merged.get("kind") or "unknown"
    merged["state"] = merged.get("state") or ""
    merged["field_sources"] = _j(tags)
    keys = [*PARK_COLS, "name_norm", "sources", "field_sources"]
    row = conn.execute(
        f"insert into parks ({', '.join(keys)}) values ({', '.join('%(' + k + ')s' for k in keys)}) returning id",
        merged,
    ).fetchone()
    return str(row["id"])


def add_park_source(conn, park_id: str, source: str, source_id: str) -> None:
    conn.execute(
        "update parks set sources = sources || %s, updated_at = now() where id = %s",
        (_j({source: source_id}), park_id),
    )


def upsert_lender(conn, name: str, kind: str = "unknown", *, classified_by: str = "rule", **extra: Any) -> str | None:
    n = norm_entity(name)
    if not n:
        return None
    alias = conn.execute("select lender_id from lender_aliases where alias_norm = %s", (n,)).fetchone()
    if alias:
        lender_id = str(alias["lender_id"])
        if kind != "unknown":
            conn.execute(
                "update lenders set kind = %s, classified_by = %s, updated_at = now() where id = %s and kind = 'unknown'",
                (kind, classified_by, lender_id),
            )
        return lender_id
    row = conn.execute(
        """insert into lenders (name, name_norm, kind, classified_by, fdic_cert, ncua_charter, hq_state,
                                total_assets_k, cre_loans_k, total_capital_k, cre_concentration)
           values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
           on conflict (name_norm) do update set
             kind = case when lenders.kind = 'unknown' then excluded.kind else lenders.kind end,
             fdic_cert = coalesce(excluded.fdic_cert, lenders.fdic_cert),
             ncua_charter = coalesce(excluded.ncua_charter, lenders.ncua_charter),
             hq_state = coalesce(excluded.hq_state, lenders.hq_state),
             total_assets_k = coalesce(excluded.total_assets_k, lenders.total_assets_k),
             cre_loans_k = coalesce(excluded.cre_loans_k, lenders.cre_loans_k),
             total_capital_k = coalesce(excluded.total_capital_k, lenders.total_capital_k),
             cre_concentration = coalesce(excluded.cre_concentration, lenders.cre_concentration),
             updated_at = now()
           returning id""",
        (name.strip(), n, kind, classified_by, extra.get("fdic_cert"), extra.get("ncua_charter"), extra.get("hq_state"),
         extra.get("total_assets_k"), extra.get("cre_loans_k"), extra.get("total_capital_k"), extra.get("cre_concentration")),
    ).fetchone()
    lender_id = str(row["id"])
    conn.execute("insert into lender_aliases (alias_norm, lender_id) values (%s, %s) on conflict do nothing", (n, lender_id))
    return lender_id


LOAN_COLS = [
    "park_id", "lender_id", "lender_name_raw", "borrower_name_raw", "original_amount", "current_balance",
    "origination_date", "recording_date", "maturity_date", "maturity_basis", "note_rate", "term_months",
    "amort_months", "interest_only", "balloon", "dscr_current", "noi_current", "occupancy_current",
    "payment_status", "status", "document_id", "property_name_raw", "property_address_raw", "property_city_raw",
    "property_state_raw", "property_zip_raw", "match_confidence",
]


def upsert_loan(conn, source: str, source_loan_id: str, rec: dict) -> str:
    incoming = {c: rec.get(c) for c in LOAN_COLS}
    incoming["maturity_basis"] = incoming["maturity_basis"] or ("reported" if incoming["maturity_date"] else "unknown")
    existing = conn.execute(
        f"select {', '.join(LOAN_COLS)}, field_sources from loans where source = %s and source_loan_id = %s",
        (source, source_loan_id),
    ).fetchone()
    writer = WRITER_TAG.get(source, "web")
    merged, tags = apply_ingest(dict(existing) if existing else {}, (existing or {}).get("field_sources") or {}, incoming, writer)
    vals = {c: merged.get(c) for c in LOAN_COLS}
    status = vals.pop("status")  # None means "leave the current status alone"
    vals["raw"] = _j(rec.get("raw"))
    vals["field_sources"] = _j(tags)
    keys = [c for c in LOAN_COLS if c != "status"] + ["raw", "field_sources"]
    # Never overwrite a known park link or a better maturity basis with nulls.
    updates = ", ".join(
        f"{c} = coalesce(excluded.{c}, loans.{c})" for c in keys if c not in ("maturity_basis", "status")
    )
    row = conn.execute(
        f"""insert into loans (source, source_loan_id, status, {', '.join(keys)})
            values (%(source)s, %(sid)s, coalesce(%(status)s::loan_status, 'active'),
                    {', '.join('%(' + k + ')s' for k in keys)})
            on conflict (source, source_loan_id) do update set {updates},
              maturity_basis = case when excluded.maturity_basis = 'unknown' then loans.maturity_basis
                                    else excluded.maturity_basis end,
              status = coalesce(%(status)s::loan_status, loans.status),
              updated_at = now()
            returning id""",
        {**vals, "source": source, "sid": source_loan_id, "status": status},
    ).fetchone()
    return str(row["id"])


def upsert_recorded_document(conn, rec: dict) -> str:
    keys = ["county", "recording_number", "doc_type", "doc_type_raw", "recording_date", "grantors", "grantees",
            "amount", "apns", "references_number", "page_count", "pdf_url", "park_id"]
    vals = {k: rec.get(k) for k in keys}
    for k in ("grantors", "grantees", "apns"):
        vals[k] = vals[k] or []
    vals["raw"] = _j(rec.get("raw"))
    row = conn.execute(
        f"""insert into recorded_documents ({', '.join(keys)}, raw)
            values ({', '.join('%(' + k + ')s' for k in keys)}, %(raw)s)
            on conflict (county, recording_number) do update set
              doc_type = excluded.doc_type, recording_date = excluded.recording_date,
              grantors = excluded.grantors, grantees = excluded.grantees,
              amount = coalesce(excluded.amount, recorded_documents.amount),
              apns = case when cardinality(excluded.apns) > 0 then excluded.apns else recorded_documents.apns end,
              references_number = coalesce(excluded.references_number, recorded_documents.references_number),
              pdf_url = coalesce(excluded.pdf_url, recorded_documents.pdf_url),
              park_id = coalesce(recorded_documents.park_id, excluded.park_id),
              raw = excluded.raw
            returning id""",
        vals,
    ).fetchone()
    return str(row["id"])


def upsert_parcel(conn, rec: dict) -> None:
    keys = ["county", "apn", "state", "park_id", "situs_address", "situs_city", "situs_zip", "owner_name",
            "owner_mailing", "owner_city", "owner_state", "owner_zip", "land_use_code", "land_use_desc", "acres",
            "lat", "lon", "last_sale_date", "last_sale_price", "last_deed_number"]
    vals = {k: rec.get(k) for k in keys}
    vals["last_deed_number"] = rec.get("last_deed_number") or rec.get("deed_number")
    vals["raw"] = _j(rec.get("raw"))
    updates = ", ".join(f"{k} = coalesce(excluded.{k}, parcels.{k})" for k in keys if k not in ("county", "apn"))
    conn.execute(
        f"""insert into parcels ({', '.join(keys)}, raw) values ({', '.join('%(' + k + ')s' for k in keys)}, %(raw)s)
            on conflict (county, apn) do update set {updates}, raw = excluded.raw, updated_at = now()""",
        vals,
    )


def add_alert(conn, park_id: str | None, kind: str, title: str, detail: str | None, dedupe_key: str) -> bool:
    row = conn.execute(
        """insert into alerts (park_id, kind, title, detail, dedupe_key) values (%s, %s, %s, %s, %s)
           on conflict (dedupe_key) do nothing returning id""",
        (park_id, kind, title, detail, dedupe_key),
    ).fetchone()
    return row is not None


def iso(d: date | None) -> str | None:
    return d.isoformat() if d else None


def upsert_filing_hit(conn, rec: dict) -> None:
    conn.execute(
        """insert into filing_hits (source, source_id, title, url, filed_on, form, snippet)
           values (%(source)s, %(source_id)s, %(title)s, %(url)s, %(filed_on)s, %(form)s, %(snippet)s)
           on conflict (source, source_id) do update set
             title = excluded.title, url = excluded.url, filed_on = excluded.filed_on,
             form = excluded.form, snippet = excluded.snippet""",
        rec,
    )


def upsert_offering(conn, rec: dict) -> None:
    conn.execute(
        """insert into form_d_offerings (
             accession, issuer_name, city, state, entity_type, industry_group, filed_on, sale_date,
             is_equity, is_debt, total_offering, total_sold, url)
           values (%(accession)s, %(issuer_name)s, %(city)s, %(state)s, %(entity_type)s, %(industry_group)s,
                   %(filed_on)s, %(sale_date)s, %(is_equity)s, %(is_debt)s, %(total_offering)s, %(total_sold)s, %(url)s)
           on conflict (accession) do update set
             issuer_name = excluded.issuer_name, city = excluded.city, state = excluded.state,
             entity_type = excluded.entity_type, industry_group = excluded.industry_group,
             filed_on = excluded.filed_on, sale_date = excluded.sale_date,
             is_equity = excluded.is_equity, is_debt = excluded.is_debt,
             total_offering = excluded.total_offering, total_sold = excluded.total_sold, url = excluded.url""",
        rec,
    )
