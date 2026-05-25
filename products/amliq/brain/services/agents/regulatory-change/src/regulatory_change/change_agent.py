"""Regulatory Change Agent orchestrator.

Safety invariants (DESIGN.md §3):
1. JiraDraft.human_review_required is ALWAYS True (enforced in jira_drafter).
2. No outbound HTTP from this package.
3. The agent NEVER auto-creates a Jira ticket — it only DRAFTS, then
   passes the draft to the injected `JiraClient.draft()` (which is a
   draft-only protocol in v0).
4. Audit `reason` ∈ `ChangeReason` stable codes.
5. Missing prior → empty delta + `missing_prior` audit reason (no crash).
6. Classifier defaults to `'material'` on ambiguous diffs.
7. Audit emit failure does NOT crash the agent — best-effort post-
   classification.

License: Apache-2.0
"""

from __future__ import annotations

import uuid

from regulatory_change._audit import AUDIT_EVENT, build_record
from regulatory_change.classifier import apply_classification
from regulatory_change.differ import diff_policy
from regulatory_change.jira_drafter import draft_jira
from regulatory_change.types import (
    AuditEmitter,
    ChangeReason,
    ComplianceDoc,
    JiraClient,
    JiraDraft,
    PolicyDelta,
    RegulatoryUpdate,
)

__all__ = ["AUDIT_EVENT", "ChangeReason", "RegulatoryChangeAgent"]


def _materiality_to_reason(materiality: str, has_prior: bool) -> ChangeReason:
    if not has_prior:  # pragma: no cover — orchestrator short-circuits earlier
        return ChangeReason.MISSING_PRIOR
    if materiality == "typo":
        return ChangeReason.TYPO_ONLY
    return ChangeReason.OK


class RegulatoryChangeAgent:
    """Orchestrator. Stateless beyond its injected dependencies."""

    def __init__(self, jira: JiraClient, audit: AuditEmitter) -> None:
        self._jira = jira
        self._audit = audit

    def process(
        self,
        current_doc: ComplianceDoc,
        prior_doc: ComplianceDoc | None,
    ) -> RegulatoryUpdate:
        """Run differ → classifier → (if material) draft jira → audit.

        Always returns a `RegulatoryUpdate`. Never raises on audit failure.
        Never auto-creates a Jira ticket.
        """
        has_prior = prior_doc is not None
        delta, reason = self._compute_delta(current_doc, prior_doc, has_prior)

        jira_draft = self._maybe_draft_jira(current_doc, delta)
        decision = self._decision_label(delta, has_prior)

        event_id = self._emit(
            doc_id=current_doc.doc_id,
            decision=decision,
            reason=reason,
            materiality=delta.materiality,
            sections_count=self._sections_count(delta),
        )

        if jira_draft is not None:
            jira_draft = jira_draft.model_copy(update={"audit_event_id": event_id})
            # The agent NEVER calls create_ticket — only the draft protocol.
            # The fake records the intent; the future HTTP adapter is OUT
            # of this package's scope.
            self._jira.draft(jira_draft)

        return RegulatoryUpdate(
            doc_id=current_doc.doc_id,
            delta=delta,
            jira_draft=jira_draft,
            audit_event_id=event_id,
            audit_reason=reason.value,
            human_review_required=True,
        )

    def _compute_delta(
        self,
        current: ComplianceDoc,
        prior: ComplianceDoc | None,
        has_prior: bool,
    ) -> tuple[PolicyDelta, ChangeReason]:
        try:
            raw = diff_policy(current, prior)
        except Exception:  # defensive — pure differ should not raise
            empty = PolicyDelta(
                doc_id=current.doc_id,
                prior_version_id=None,
                new_version_id=current.sha256,
                diff_summary="diff failed",
                materiality="material",  # conservative on failure
            )
            return empty, ChangeReason.DIFF_FAILED

        if not has_prior:
            return raw, ChangeReason.MISSING_PRIOR

        classified = apply_classification(raw)
        reason = _materiality_to_reason(classified.materiality, has_prior=True)
        # NO_CHANGE override: identical bodies with no chunks/added/removed.
        if (
            not classified.sections_added
            and not classified.sections_removed
            and not classified.sections_changed
        ):
            return classified, ChangeReason.NO_CHANGE
        return classified, reason

    def _maybe_draft_jira(
        self, doc: ComplianceDoc, delta: PolicyDelta
    ) -> JiraDraft | None:
        if delta.materiality != "material":
            return None
        return draft_jira(doc, delta)

    @staticmethod
    def _decision_label(delta: PolicyDelta, has_prior: bool) -> str:
        if not has_prior:
            return "skipped"
        if delta.materiality == "material":
            return "drafted"
        if delta.materiality == "typo":
            return "ignored_typo"
        return "noted"

    @staticmethod
    def _sections_count(delta: PolicyDelta) -> int:
        return (
            len(delta.sections_added)
            + len(delta.sections_removed)
            + len(delta.sections_changed)
        )

    def _emit(
        self,
        *,
        doc_id: str,
        decision: str,
        reason: ChangeReason,
        materiality: str,
        sections_count: int,
    ) -> str:
        """Best-effort audit emit. Failure does NOT crash the agent (inv 7)."""
        record = build_record(
            doc_id=doc_id,
            decision=decision,
            reason=reason,
            materiality=materiality,
            sections_count=sections_count,
        )
        try:
            event_id = self._audit.emit(record)
        except Exception:
            return uuid.uuid4().hex
        return event_id or uuid.uuid4().hex
