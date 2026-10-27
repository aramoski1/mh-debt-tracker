"""A polite HTTP client: rate limiting per host, retries with backoff, and an on-disk cache."""
from __future__ import annotations

import hashlib
import json
import time
from pathlib import Path
from threading import Lock
from typing import Any
from urllib.parse import urlparse

import httpx

from .config import settings

# Requests per second allowed per host. SEC's published fair-access limit is 10/s; we stay under it.
HOST_RPS: dict[str, float] = {
    "www.sec.gov": 8.0,
    "efts.sec.gov": 5.0,
    "geocoding.geo.census.gov": 2.0,
    "api.fdic.gov": 4.0,
}
DEFAULT_RPS = 3.0


class PoliteClient:
    def __init__(self, user_agent: str | None = None, cache_dir: Path | None = None, timeout: float = 60.0):
        self._client = httpx.Client(
            headers={"User-Agent": user_agent or settings.sec_user_agent, "Accept-Encoding": "gzip, deflate"},
            timeout=timeout,
            follow_redirects=True,
        )
        self._last: dict[str, float] = {}
        self._lock = Lock()
        self.cache_dir = cache_dir or settings.cache_dir / "http"
        self.cache_dir.mkdir(parents=True, exist_ok=True)

    def _throttle(self, host: str) -> None:
        rps = HOST_RPS.get(host, DEFAULT_RPS)
        with self._lock:
            wait = self._last.get(host, 0) + 1.0 / rps - time.monotonic()
            if wait > 0:
                time.sleep(wait)
            self._last[host] = time.monotonic()

    def _cache_path(self, method: str, url: str, body: Any) -> Path:
        key = hashlib.sha256(f"{method} {url} {json.dumps(body, sort_keys=True, default=str)}".encode()).hexdigest()
        return self.cache_dir / key[:2] / key

    def request(
        self,
        method: str,
        url: str,
        *,
        cache_ttl: float | None = None,
        retries: int = 4,
        **kwargs: Any,
    ) -> httpx.Response:
        """Send a request. If cache_ttl (seconds) is set, a cached body younger than that is reused."""
        cpath = self._cache_path(method, url, {k: v for k, v in kwargs.items() if k in ("params", "json", "data")})
        if cache_ttl is not None and cpath.exists() and time.time() - cpath.stat().st_mtime < cache_ttl:
            return httpx.Response(200, content=cpath.read_bytes(), request=httpx.Request(method, url))

        host = urlparse(url).netloc
        delay = 2.0
        for attempt in range(retries + 1):
            self._throttle(host)
            try:
                resp = self._client.request(method, url, **kwargs)
            except (httpx.TransportError, httpx.TimeoutException):
                if attempt == retries:
                    raise
                time.sleep(delay)
                delay *= 2
                continue
            if resp.status_code in (429, 500, 502, 503, 504) and attempt < retries:
                retry_after = resp.headers.get("Retry-After")
                time.sleep(float(retry_after) if retry_after and retry_after.isdigit() else delay)
                delay *= 2
                continue
            resp.raise_for_status()
            if cache_ttl is not None:
                cpath.parent.mkdir(parents=True, exist_ok=True)
                cpath.write_bytes(resp.content)
            return resp
        raise RuntimeError("unreachable")

    def get(self, url: str, **kwargs: Any) -> httpx.Response:
        return self.request("GET", url, **kwargs)

    def post(self, url: str, **kwargs: Any) -> httpx.Response:
        return self.request("POST", url, **kwargs)

    def close(self) -> None:
        self._client.close()
