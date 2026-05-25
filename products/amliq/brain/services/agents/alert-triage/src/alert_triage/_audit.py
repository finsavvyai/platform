"""Internal audit-record helpers for the Alert Triage Agent.

Private module (leading underscore) — not part of the public API. Split
out of `triage_agent` to keep that file under the 200-line cap and to
let the stable-reason + PII-free-meta logic be tested in isolation.

License: Apache-2.0
"""

from __future__ import annotations

from datetime import UTC, datetime
from enum import StrEnum
from typing import Any, Final

AUDIT_EVENT: Final[str] = "brain.alert.triaged"
ACTOR_ID: Final[str] = "agent:alert-triage"


class AuditReason(StrEnum):
    """Stable reason codes for triage audit records. PII-free by design."""

    TRIAGED = "triaged"
    NO_MATCH = "no_match"
    DATA_MISSING = "data_missing"
    ERROR = "error"


def now_iso() -> str:
    return datetime.now(tz=UTC).isoformat()


def build_record(
    *,
    tenant_id: str,
    alert_id: str,
    decision: str,
    reason: AuditReason,
    matched_rule_ids: list[str],
    priority: str,
    category: str,
    confidence: float,
) -> dict[str, Any]:
    """Construct a PII-safe audit record matching the TS round-1 shape.

    `meta` carries:
      - matched_rule_ids: list[str]   (rule IDs only — no party/txn data)
      - matched_count:    int
      - priority:         "p1".."p4"
      - category:         "sanctions"|...|"other"
      - confidence:       float

    No transaction IDs, amounts, country codes, MCC values, or party
    names — those would be PII in some jurisdictions and the AMLIQ
    parent CLAUDE forbids them in audit `reason`/`meta`.
    """
    return {
        "ts": now_iso(),
        "actor_id": ACTOR_ID,
        "event": AUDIT_EVENT,
        "resource": f"{tenant_id}:{alert_id}",
        "decision": decision,
        "reason": reason.value,
        "meta": {
            "matched_rule_ids": list(matched_rule_ids),
            "matched_count": len(matched_rule_ids),
            "priority": priority,
            "category": category,
            "confidence": confidence,
        },
    }
