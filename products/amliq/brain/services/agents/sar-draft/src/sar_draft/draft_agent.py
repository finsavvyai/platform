"""SAR Draft orchestrator — alert in, SarDraft out.

Safety invariants (enforced in code; mirrored in DESIGN.md §3):
1. `human_review_required` is ALWAYS True in v0.
2. Exactly ONE audit record is emitted per `draft()` call.
3. `audit.reason` is one of the stable codes in `AuditReason`.
4. `audit.meta` carries `template_id` + `confidence` only — never PII.
5. PII patterns in record values are redacted at the boundary.

License: Apache-2.0
"""

from __future__ import annotations

import uuid
from typing import Final

from sar_draft._audit import (
    ACTOR_ID,
    AUDIT_EVENT,
    AuditReason,
    DraftOutcome,
    build_record,
)
from sar_draft.context_fill import (
    MissingVariableError,
    RenderError,
    build_context,
    collect_citations,
    render,
)
from sar_draft.template_registry import TemplateRegistry, TemplateRegistryError
from sar_draft.types import AlertInput, AuditEmitter, RetrievalAdapter, SarDraft

__all__ = ["ACTOR_ID", "AUDIT_EVENT", "AuditReason", "DraftAgent"]

_DEFAULT_TOP_K: Final[int] = 5
_FULL_CONFIDENCE_MIN_CITATIONS: Final[int] = 3


def _confidence(*, filled: bool, citation_count: int) -> float:
    if not filled:
        return 0.3
    if citation_count >= _FULL_CONFIDENCE_MIN_CITATIONS:
        return 1.0
    return 0.6


class DraftAgent:
    """Orchestrator. Stateless beyond its injected dependencies.

    Invariant: every public `draft()` call emits exactly ONE audit record
    via the injected emitter, regardless of success or failure path.
    """

    def __init__(
        self,
        registry: TemplateRegistry,
        retrieval: RetrievalAdapter,
        audit: AuditEmitter,
        top_k: int = _DEFAULT_TOP_K,
    ) -> None:
        self._registry = registry
        self._retrieval = retrieval
        self._audit = audit
        self._top_k = top_k

    def draft(self, alert: AlertInput) -> SarDraft:
        """Generate a SAR draft. Always emits exactly one audit record."""
        result = self._compute(alert)
        event_id = self._emit(alert=alert, outcome=result)

        if not result.ok:
            assert result.error is not None
            raise result.error

        assert result.filled_text is not None
        return SarDraft(
            alert_id=alert.alert_id,
            template_id=result.template_id,
            filled_text=result.filled_text,
            citations=result.citations,
            confidence=result.confidence,
            human_review_required=True,  # invariant 1 — never auto-file
            audit_event_id=event_id,
        )

    def _compute(self, alert: AlertInput) -> DraftOutcome:
        out = DraftOutcome()
        meta = self._registry.for_alert_type(alert.alert_type)
        if meta is None:
            out.reason = AuditReason.MISSING_TEMPLATE
            out.error = TemplateRegistryError(
                f"no template for alert_type={alert.alert_type!r}"
            )
            return out
        out.template_id = meta.id

        try:
            hits = self._retrieval.search(
                query=f"{alert.alert_type} {alert.jurisdiction}",
                tenant_id=alert.tenant_id,
                top_k=self._top_k,
            )
        except Exception as exc:  # convert to stable reason; rationale in DESIGN.md §3
            out.reason = AuditReason.RETRIEVAL_FAILED
            err = RuntimeError("retrieval failed")
            err.__cause__ = exc
            out.error = err
            return out

        ctx = build_context(alert, hits)
        try:
            body = self._registry.read_body(out.template_id)
            filled_text = render(body, meta, ctx)
        except (MissingVariableError, RenderError) as exc:
            out.reason = AuditReason.RENDER_FAILED
            err = RuntimeError("render failed")
            err.__cause__ = exc
            out.error = err
            return out

        citations = collect_citations(hits)
        out.ok = True
        out.reason = AuditReason.OK
        out.filled_text = filled_text
        out.citations = citations
        out.confidence = _confidence(filled=True, citation_count=len(citations))
        return out

    def _emit(self, *, alert: AlertInput, outcome: DraftOutcome) -> str:
        decision = "generated" if outcome.ok else "failed"
        record = build_record(
            tenant_id=alert.tenant_id,
            alert_id=alert.alert_id,
            decision=decision,
            reason=outcome.reason,
            template_id=outcome.template_id,
            confidence=outcome.confidence,
        )
        event_id = self._audit.emit(record)
        return event_id or uuid.uuid4().hex
