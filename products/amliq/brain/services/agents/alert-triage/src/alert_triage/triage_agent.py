"""Triage orchestrator — Alert in, TriageResult out.

Safety invariants (enforced in code; mirrored in DESIGN.md §3):
1. `human_review_required` is ALWAYS True in v0.
2. Exactly ONE audit record emitted per `triage()` call.
3. `audit.reason` is one of the stable codes in `AuditReason`.
4. `audit.meta` carries rule-id list + counts + priority + category only —
   no party names, transaction IDs, amounts, country codes, or MCCs.
5. Agent NEVER closes an alert (read-only — no mutation API exists).
6. Empty `Alert` (no transaction_ids) short-circuits defensively.

License: Apache-2.0
"""

from __future__ import annotations

import uuid
from typing import Final

from alert_triage import classifier as cls
from alert_triage._audit import (
    ACTOR_ID,
    AUDIT_EVENT,
    AuditReason,
    build_record,
)
from alert_triage.reasoner import build_chain
from alert_triage.rules import evaluate_all
from alert_triage.types import (
    Alert,
    AuditEmitter,
    Category,
    Priority,
    ReasoningStep,
    TriageResult,
)

__all__ = ["ACTOR_ID", "AUDIT_EVENT", "AuditReason", "TriageAgent"]

_EMPTY_ALERT_CONFIDENCE: Final[float] = 0.2


class TriageAgent:
    """Read-only orchestrator. Stateless beyond its injected emitter.

    Invariant: every public `triage()` call emits exactly ONE audit
    record via the injected emitter, regardless of input shape.
    """

    def __init__(self, audit: AuditEmitter) -> None:
        self._audit = audit

    def triage(self, alert: Alert) -> TriageResult:
        """Classify an alert. Always emits exactly one audit record.

        The agent NEVER closes / dismisses / mutates the alert. The
        returned `TriageResult` is advisory.
        """
        # Invariant 6 — defensive empty-alert short-circuit.
        if not alert.transaction_ids:
            return self._emit_and_build(
                alert=alert,
                chain=[],
                priority=Priority.P4,
                category=Category.OTHER,
                actions=cls.recommended_actions(Priority.P4, Category.OTHER),
                conf=_EMPTY_ALERT_CONFIDENCE,
                reason=AuditReason.DATA_MISSING,
            )

        matches = evaluate_all(alert)
        chain = build_chain(matches)
        priority = cls.assign_priority(chain)
        category = cls.assign_category(chain, alert)
        actions = cls.recommended_actions(priority, category)
        conf = cls.confidence(chain)
        reason = AuditReason.TRIAGED if chain else AuditReason.NO_MATCH

        return self._emit_and_build(
            alert=alert,
            chain=chain,
            priority=priority,
            category=category,
            actions=actions,
            conf=conf,
            reason=reason,
        )

    # ------------------------------------------------------------------
    # Internals
    # ------------------------------------------------------------------

    def _emit_and_build(
        self,
        *,
        alert: Alert,
        chain: list[ReasoningStep],
        priority: Priority,
        category: Category,
        actions: list[str],
        conf: float,
        reason: AuditReason,
    ) -> TriageResult:
        rule_ids = [step.rule_id for step in chain]
        record = build_record(
            tenant_id=alert.tenant_id,
            alert_id=alert.alert_id,
            decision="triaged",
            reason=reason,
            matched_rule_ids=rule_ids,
            priority=priority.value,
            category=category.value,
            confidence=conf,
        )
        event_id = self._audit.emit(record) or uuid.uuid4().hex
        return TriageResult(
            alert_id=alert.alert_id,
            priority=priority,
            category=category,
            reasoning_chain=chain,
            recommended_actions=actions,
            confidence=conf,
            human_review_required=True,  # invariant 1 — never auto-close
            audit_event_id=event_id,
        )
