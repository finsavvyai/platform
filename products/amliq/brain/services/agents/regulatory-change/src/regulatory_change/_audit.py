"""Internal audit-record helpers for the Regulatory Change Agent.

Mirrors the sar-draft `_audit` shape. Private module (leading underscore).

Stable codes only in `reason`; `meta` is restricted to a non-PII allow-list
(`doc_id`, `materiality`, `sections_count`). No raw body, no party names.

License: Apache-2.0
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any, Final

from regulatory_change.types import ChangeReason

AUDIT_EVENT: Final[str] = "brain.regulatory.change_detected"
ACTOR_ID: Final[str] = "agent:regulatory-change"


def now_iso() -> str:
    return datetime.now(tz=UTC).isoformat()


def build_record(
    *,
    doc_id: str,
    decision: str,
    reason: ChangeReason,
    materiality: str,
    sections_count: int,
) -> dict[str, Any]:
    """Construct a PII-safe audit record matching the TS round-1 shape.

    `meta` is an allow-list — DESIGN.md §3 invariant 8.
    """
    return {
        "ts": now_iso(),
        "actor_id": ACTOR_ID,
        "event": AUDIT_EVENT,
        "resource": f"doc:{doc_id}",
        "decision": decision,
        "reason": reason.value,
        "meta": {
            "doc_id": doc_id,
            "materiality": materiality,
            "sections_count": sections_count,
        },
    }
