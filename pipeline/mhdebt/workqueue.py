"""Jobs the nightly run drains. Creating a kind with no handler fails. Failures retry with backoff."""
from __future__ import annotations

from typing import Any, Callable

from psycopg.types.json import Jsonb

Handler = Callable[[Any, dict], dict]

HANDLERS: dict[str, Handler] = {}


class UnknownJob(ValueError):
    pass


def handler(kind: str):
    def wrap(fn: Handler) -> Handler:
        HANDLERS[kind] = fn
        return fn
    return wrap


def backoff_seconds(attempts: int) -> int:
    return min(3600, 30 * (2 ** max(attempts - 1, 0)))


def apply_result(job: dict, ok: bool, error: str | None = None, result: dict | None = None) -> dict:
    if ok:
        return {**job, "status": "done", "last_error": None, "result": result or {}}
    attempts = int(job.get("attempts") or 0) + 1
    nxt = {**job, "attempts": attempts, "last_error": (error or "failed")[:500]}
    if attempts >= 3:
        nxt["status"] = "failed"
        return nxt
    nxt["status"] = "pending"
    nxt["delay_seconds"] = backoff_seconds(attempts)
    return nxt


def enqueue(conn, kind: str, payload: dict | None = None) -> str:
    if kind not in HANDLERS:
        raise UnknownJob(kind)
    row = conn.execute(
        """insert into jobs (kind, payload) values (%s, %s) returning id""",
        (kind, Jsonb(payload or {})),
    ).fetchone()
    return str(row["id"])


@handler("enrich_park")
def enrich_park(_conn, payload: dict) -> dict:
    return {"park_id": payload.get("park_id"), "note": "No extra public source is configured for a single park."}


@handler("recheck_ownership")
def recheck_ownership(_conn, payload: dict) -> dict:
    return {"park_id": payload.get("park_id"), "note": "Stored owner was not changed. A finding would be flagged for review."}


@handler("extract_document")
def extract_document(_conn, payload: dict) -> dict:
    return {"document_id": payload.get("document_id"), "note": "Use mhdebt extract. A value is kept only when its quote is in the document."}


@handler("rebuild_owner")
def rebuild_owner(_conn, payload: dict) -> dict:
    return {"owner_id": payload.get("owner_id"), "note": "The owner page reads parks already linked to that name."}


def process_due(conn, limit: int = 10) -> dict:
    rows = conn.execute(
        """select id, kind, payload, attempts from jobs
           where status = 'pending' and run_after <= now()
           order by run_after asc limit %s""",
        (limit,),
    ).fetchall()
    done = failed = 0
    for row in rows:
        kind = row["kind"]
        fn = HANDLERS.get(kind)
        if fn is None:
            nxt = apply_result(dict(row), False, f"no handler for {kind}")
        else:
            try:
                nxt = apply_result(dict(row), True, result=fn(conn, row["payload"] or {}))
            except Exception as exc:  # noqa: BLE001
                nxt = apply_result(dict(row), False, str(exc))
        delay = int(nxt.get("delay_seconds") or 0)
        conn.execute(
            """update jobs set status = %s, attempts = %s, last_error = %s, result = %s,
                  run_after = now() + make_interval(secs => %s), updated_at = now()
               where id = %s""",
            (nxt["status"], nxt.get("attempts") or row["attempts"], nxt.get("last_error"),
             Jsonb(nxt.get("result") or {}), delay, row["id"]),
        )
        if nxt["status"] == "done":
            done += 1
        elif nxt["status"] == "failed":
            failed += 1
    conn.commit()
    return {"seen": len(rows), "done": done, "failed": failed}
