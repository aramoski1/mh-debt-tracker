"""Runtime configuration, read from environment variables (see .env.example)."""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

try:  # load pipeline/.env (or ./.env) so `mhdebt` works without exporting variables by hand
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).resolve().parents[1] / ".env")
    load_dotenv()
except ImportError:
    pass


def _list(name: str, default: str) -> list[str]:
    return [s.strip().upper() for s in os.getenv(name, default).split(",") if s.strip()]


@dataclass(frozen=True)
class Settings:
    # Postgres connection string. On Supabase use the pooled "session" URI from Project Settings > Database.
    database_url: str = field(default_factory=lambda: os.getenv("DATABASE_URL", ""))
    # SEC requires a descriptive User-Agent with a contact email on every request.
    sec_user_agent: str = field(
        default_factory=lambda: os.getenv("SEC_USER_AGENT", "Vertical Frame research alec@verticalframe.ai")
    )
    anthropic_api_key: str = field(default_factory=lambda: os.getenv("ANTHROPIC_API_KEY", ""))
    # Model used to read scanned loan documents. Sonnet balances accuracy and cost for OCR-heavy pages.
    doc_model: str = field(default_factory=lambda: os.getenv("DOC_MODEL", "claude-sonnet-5-5"))
    # Cheaper model for short classification tasks (lender names, call notes).
    fast_model: str = field(default_factory=lambda: os.getenv("FAST_MODEL", "claude-haiku-5-5"))
    target_states: list[str] = field(default_factory=lambda: _list("TARGET_STATES", "AZ"))
    data_dir: Path = field(default_factory=lambda: Path(os.getenv("DATA_DIR", "./data")))
    cache_dir: Path = field(default_factory=lambda: Path(os.getenv("CACHE_DIR", "./.cache")))
    # Hard cap on documents sent to the model per run, to keep spend predictable.
    max_docs_per_run: int = field(default_factory=lambda: int(os.getenv("MAX_DOCS_PER_RUN", "200")))


settings = Settings()
