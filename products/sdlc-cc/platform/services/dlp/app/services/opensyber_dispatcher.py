"""
OpenSyber DLP Dispatcher.

Posts redacted DLP violations to an OpenSyber SDLC webhook receiver
with HMAC-SHA256 signed bodies. Mirrors the receiver contract at
opensyber/apps/api/src/routes/integrations/sdlc.ts:

  POST {opensyber_url}/api/integrations/sdlc/violations
  Header: X-SDLC-Signature: sha256=<hex>
  Body:   {violations:[...], scan_id, scanned_at, document_count, connection_name}

Hard rules:
- redacted_excerpt MUST be <=512 chars (the receiver enforces it; we
  fail-fast before sending so raw PII never escapes the DLP service).
- 5xx + network errors are retried with exponential backoff (max 3
  retries). 4xx is terminal.
"""
from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
import logging
from dataclasses import asdict, dataclass, field
from typing import Any, Iterable, Mapping

import httpx

logger = logging.getLogger(__name__)

MAX_EXCERPT_LEN = 512
MAX_RETRIES = 3
ALLOWED_SOURCES = {"presidio", "regex", "classifier", "rule-engine"}
ALLOWED_SEVERITIES = {"critical", "high", "medium", "low", "info"}
SIGNATURE_HEADER = "X-SDLC-Signature"
SIGNATURE_PREFIX = "sha256="


class RedactionError(ValueError):
    """Raised when a violation excerpt is not properly redacted."""


@dataclass
class Violation:
    """Wire-shape violation matching the OpenSyber receiver schema."""

    violation_id: str
    severity: str
    entity_type: str
    rule_name: str | None
    redacted_excerpt: str
    document_id: str | None
    document_path: str | None
    confidence: float
    source: str

    def validate(self) -> None:
        if self.severity not in ALLOWED_SEVERITIES:
            raise ValueError(f"invalid severity: {self.severity}")
        if self.source not in ALLOWED_SOURCES:
            raise ValueError(f"invalid source: {self.source}")
        if not 0.0 <= float(self.confidence) <= 1.0:
            raise ValueError(f"confidence out of range: {self.confidence}")
        if len(self.redacted_excerpt) > MAX_EXCERPT_LEN:
            raise RedactionError(
                f"redacted_excerpt {len(self.redacted_excerpt)} > "
                f"{MAX_EXCERPT_LEN} for violation {self.violation_id}"
            )


@dataclass
class DispatchResult:
    status_code: int
    ok: bool
    attempt: int
    body: str = ""
    error: str | None = None


def compute_signature(secret: str, body: str) -> str:
    """Return `sha256=<hex>` HMAC-SHA256 of body, byte-for-byte
    matching the OpenSyber receiver's WebCrypto verifier."""
    digest = hmac.new(
        secret.encode("utf-8"), body.encode("utf-8"), hashlib.sha256
    ).hexdigest()
    return f"{SIGNATURE_PREFIX}{digest}"


def serialize_payload(
    violations: Iterable[Violation],
    scan_id: str,
    scanned_at: str,
    document_count: int,
    connection_name: str,
) -> tuple[str, dict[str, Any]]:
    """Build the JSON body. Validates every violation first; raises
    RedactionError before any network I/O if redaction is missing."""
    serialized: list[Mapping[str, Any]] = []
    for v in violations:
        v.validate()
        serialized.append(asdict(v))
    payload = {
        "violations": serialized,
        "scan_id": scan_id,
        "scanned_at": scanned_at,
        "document_count": int(document_count),
        "connection_name": connection_name,
    }
    body = json.dumps(payload, separators=(",", ":"), sort_keys=False)
    return body, payload


@dataclass
class OpenSyberDispatcher:
    opensyber_url: str
    secret: str
    connection_name: str
    timeout_seconds: float = 10.0
    max_retries: int = MAX_RETRIES
    backoff_base: float = 0.2  # seconds
    _client: httpx.AsyncClient | None = field(default=None, repr=False)

    @property
    def endpoint(self) -> str:
        return f"{self.opensyber_url.rstrip('/')}/api/integrations/sdlc/violations"

    async def dispatch(
        self,
        violations: list[Violation],
        scan_id: str,
        scanned_at: str,
        document_count: int,
    ) -> DispatchResult:
        body, _ = serialize_payload(
            violations, scan_id, scanned_at, document_count, self.connection_name
        )
        signature = compute_signature(self.secret, body)
        headers = {
            "Content-Type": "application/json",
            SIGNATURE_HEADER: signature,
        }
        client = self._client or httpx.AsyncClient(timeout=self.timeout_seconds)
        owns_client = self._client is None
        last_error: str | None = None
        try:
            for attempt in range(1, self.max_retries + 1):
                try:
                    resp = await client.post(self.endpoint, content=body, headers=headers)
                except (httpx.TimeoutException, httpx.TransportError) as exc:
                    last_error = f"{type(exc).__name__}: {exc}"
                    logger.warning(
                        "opensyber dispatch network error attempt=%d err=%s",
                        attempt,
                        last_error,
                    )
                    if attempt >= self.max_retries:
                        return DispatchResult(0, False, attempt, "", last_error)
                    await asyncio.sleep(self.backoff_base * (2 ** (attempt - 1)))
                    continue
                ok = 200 <= resp.status_code < 300
                if ok or 400 <= resp.status_code < 500:
                    return DispatchResult(resp.status_code, ok, attempt, resp.text)
                # 5xx -> retry
                last_error = f"server {resp.status_code}: {resp.text[:200]}"
                if attempt >= self.max_retries:
                    return DispatchResult(
                        resp.status_code, False, attempt, resp.text, last_error
                    )
                await asyncio.sleep(self.backoff_base * (2 ** (attempt - 1)))
            # unreachable
            return DispatchResult(0, False, self.max_retries, "", last_error)
        finally:
            if owns_client:
                await client.aclose()
