"""Internal audit-record helpers for the SAR Draft Agent.

Kept private (leading underscore module) — not part of the public API.
Split out of `draft_agent` to keep that file under the 200-line cap and to
let the redaction + stable-reason logic be tested in isolation.

License: Apache-2.0
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import UTC, datetime
from enum import StrEnum
from typing import Any, Final

from sar_draft.types import Citation

AUDIT_EVENT: Final[str] = "brain.sar.drafted"
ACTOR_ID: Final[str] = "agent:sar-draft"

# PII-shaped patterns redacted from any audit value before emit.
# Order: longer / more specific first.
_PII_PATTERNS: Final[list[re.Pattern[str]]] = [
    re.compile(r"\b\d{3}-\d{2}-\d{4}\b"),                       # US SSN
    re.compile(r"\b\d{4}[ -]?\d{4}[ -]?\d{4}[ -]?\d{4}\b"),     # 16-digit card/acct
    re.compile(r"\b[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b"),            # IBAN-ish
    re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+"),                    # email
]
_REDACTED: Final[str] = "[redacted]"


class AuditReason(StrEnum):
    """Stable reason codes for SAR-draft audit records. PII-free by design."""

    OK = "ok"
    MISSING_TEMPLATE = "missing_template"
    RETRIEVAL_FAILED = "retrieval_failed"
    RENDER_FAILED = "render_failed"
    UNKNOWN_ERROR = "unknown_error"


def redact(value: Any) -> Any:
    """Recursively redact PII-pattern matches from strings, dicts, lists."""
    if isinstance(value, str):
        out = value
        for pat in _PII_PATTERNS:
            out = pat.sub(_REDACTED, out)
        return out
    if isinstance(value, dict):
        return {k: redact(v) for k, v in value.items()}
    if isinstance(value, list):
        return [redact(v) for v in value]
    return value


def now_iso() -> str:
    return datetime.now(tz=UTC).isoformat()


def build_record(
    *,
    tenant_id: str,
    alert_id: str,
    decision: str,
    reason: AuditReason,
    template_id: str,
    confidence: float,
) -> dict[str, Any]:
    """Construct a PII-safe audit record matching the TS round-1 shape."""
    record = {
        "ts": now_iso(),
        "actor_id": ACTOR_ID,
        "event": AUDIT_EVENT,
        "resource": f"{tenant_id}:{alert_id}",
        "decision": decision,
        "reason": reason.value,
        "meta": {
            "template_id": template_id,
            "confidence": confidence,
        },
    }
    return redact(record)  # type: ignore[no-any-return]


@dataclass
class DraftOutcome:
    """Internal: compute result captured WITHOUT side-effects."""

    ok: bool = False
    reason: AuditReason = AuditReason.UNKNOWN_ERROR
    template_id: str = ""
    filled_text: str | None = None
    citations: list[Citation] = field(default_factory=list)
    confidence: float = 0.0
    error: BaseException | None = None
