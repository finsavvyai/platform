"""
OpenSyber PipeWarden Dispatcher.

Posts SDLC pipeline findings to the OpenSyber PipeWarden ingest webhook
with HMAC-SHA256 signed bodies. Mirrors the receiver contract at
opensyber/apps/api/src/routes/integrations/pipewarden.ts:

  POST {webhook_url}            (full URL — usually
                                 https://api.opensyber.cloud/api/integrations/pipewarden/findings)
  Header: X-PipeWarden-Signature: sha256=<hex(HMAC-SHA256(secret, raw_body))>
  Body:   {findings:[...], risk_score, summary, connection_name, analyzed_at}

HMAC parity rules (must hold byte-for-byte vs the TS WebCrypto verifier
in pipewarden.ts:hmacSha256Hex):
  - Sign the EXACT body bytes that are sent on the wire (no whitespace
    normalisation, no key sorting). We control serialization here so we
    pin `json.dumps(..., separators=(",", ":"), sort_keys=False)` and
    sign that.
  - Hex digest is lowercase.
  - Header value carries the literal `sha256=` prefix.

Integration call site: a pipeline scanner (e.g. insights-detector main
loop or the dlp/regex/classifier engines under services/dlp) builds a
finding dict, then calls `OpenSyberDispatcher(...).dispatch(finding)`
or `dispatch_batch(findings)` to push them into the unified findings
feed at api.opensyber.cloud.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import logging
import time
from dataclasses import dataclass
from typing import Any

import requests

logger = logging.getLogger(__name__)

SIGNATURE_HEADER = "X-PipeWarden-Signature"
SIGNATURE_PREFIX = "sha256="
DEFAULT_TIMEOUT_SECONDS = 10.0
DEFAULT_MAX_RETRIES = 3
# Backoff schedule: 1s, 2s, 4s — applied AFTER attempts 1, 2 (before 2, 3).
BACKOFF_SCHEDULE_SECONDS: tuple[float, ...] = (1.0, 2.0, 4.0)


class OpenSyberDispatchError(RuntimeError):
    """Raised when a dispatch finally fails (4xx terminal or retries exhausted)."""


def canonical_body(payload: dict[str, Any]) -> bytes:
    """Serialize the payload to the bytes that will be signed AND sent.

    Pinning `separators=(",", ":")` and `sort_keys=False` keeps the
    bytes stable and exactly equal to what the receiver hashes via
    `c.req.text()` -> TextEncoder().encode(...). We do NOT sort keys
    because the TS receiver does not — it just hashes raw bytes.
    """
    return json.dumps(payload, separators=(",", ":"), sort_keys=False).encode("utf-8")


def compute_signature(secret: str, body: bytes) -> str:
    """Return `sha256=<hex>` HMAC-SHA256 of `body`.

    Matches `hmacSha256Hex(secret, payload)` in pipewarden.ts byte-for-byte:
      - secret encoded as UTF-8
      - hex lowercase, length 64
      - prefixed with `sha256=`
    """
    digest = hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()
    return f"{SIGNATURE_PREFIX}{digest}"


@dataclass
class DispatchResult:
    """Result of a single dispatch attempt sequence."""

    status_code: int
    ok: bool
    attempts: int
    response_body: str = ""
    error: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {"status_code": self.status_code, "ok": self.ok,
                "attempts": self.attempts, "response_body": self.response_body,
                "error": self.error}


class OpenSyberDispatcher:
    """Sync dispatcher to OpenSyber's PipeWarden ingest webhook."""

    def __init__(
        self,
        webhook_url: str,
        secret: str,
        *,
        timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS,
        max_retries: int = DEFAULT_MAX_RETRIES,
        session: requests.Session | None = None,
        sleep: Any = time.sleep,
    ) -> None:
        if not webhook_url:
            raise ValueError("webhook_url required")
        if not secret:
            raise ValueError("secret required")
        self.webhook_url = webhook_url
        self.secret = secret
        self.timeout_seconds = float(timeout_seconds)
        self.max_retries = int(max_retries)
        self._session = session or requests.Session()
        self._sleep = sleep

    def dispatch(self, finding: dict[str, Any]) -> dict[str, Any]:
        """Post a single finding payload. Returns DispatchResult.to_dict()."""
        result = self._post(finding)
        return result.to_dict()

    def dispatch_batch(self, findings: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Post each finding sequentially. Returns one result dict per input."""
        return [self.dispatch(f) for f in findings]

    def _post(self, payload: dict[str, Any]) -> DispatchResult:
        body = canonical_body(payload)
        signature = compute_signature(self.secret, body)
        headers = {
            "Content-Type": "application/json",
            SIGNATURE_HEADER: signature,
            "User-Agent": "sdlc-opensyber-dispatcher/1.0",
        }
        last_error: str | None = None
        last_status = 0
        last_text = ""

        for attempt in range(1, self.max_retries + 1):
            try:
                resp = self._session.post(
                    self.webhook_url,
                    data=body,
                    headers=headers,
                    timeout=self.timeout_seconds,
                )
            except (requests.Timeout, requests.RequestException) as exc:
                last_error = f"{type(exc).__name__}: {exc}"
                last_status = 0
                logger.warning("opensyber dispatch error attempt=%d err=%s",
                               attempt, last_error)
                if not self._maybe_sleep(attempt):
                    break
                continue

            last_status = resp.status_code
            last_text = resp.text
            if 200 <= resp.status_code < 300:
                return DispatchResult(resp.status_code, True, attempt, resp.text, None)
            if 400 <= resp.status_code < 500:
                # 4xx is terminal — no retries.
                return DispatchResult(
                    resp.status_code,
                    False,
                    attempt,
                    resp.text,
                    f"client error {resp.status_code}",
                )
            # 5xx → retry per schedule
            last_error = f"server {resp.status_code}: {resp.text[:200]}"
            logger.warning("opensyber dispatch 5xx attempt=%d err=%s",
                           attempt, last_error)
            if not self._maybe_sleep(attempt):
                break

        return DispatchResult(last_status, False, self.max_retries, last_text, last_error)

    def _maybe_sleep(self, attempt: int) -> bool:
        """Sleep per backoff schedule between attempts. Returns False when
        no further attempts should be made."""
        if attempt >= self.max_retries:
            return False
        idx = attempt - 1
        if idx >= len(BACKOFF_SCHEDULE_SECONDS):
            return False
        self._sleep(BACKOFF_SCHEDULE_SECONDS[idx])
        return True
