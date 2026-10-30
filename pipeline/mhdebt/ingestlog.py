"""Plain-language ingestion errors. The raw text is stored; the desk shows the sanitized line."""
from __future__ import annotations


def sanitize(message: str) -> str:
    text = (message or "").replace("\n", " ").strip()
    low = text.lower()
    if "429" in text or "rate limit" in low or "too many requests" in low:
        return "The source asked us to slow down. The next run will retry."
    if "credit balance" in low or "billing" in low or "insufficient credit" in low:
        return "The model account is out of credit."
    if "overload" in low or "529" in text:
        return "The model is overloaded. The next run will retry."
    return text[:500] or "The job failed."


def record(conn, stage: str, message: str, source_ref: str | None = None, raw: str | None = None) -> None:
    try:
        conn.execute(
            """insert into ingestion_errors (stage, source_ref, message, raw)
               values (%s, %s, %s, %s)""",
            (stage, source_ref, sanitize(message), (raw or "")[:2000] or None),
        )
    except Exception:
        return
