"""Behavioural tests for `RegulatoryChangeAgent.process()`.

Invariant-focused tests live in `test_change_agent_invariants.py`.
"""

from __future__ import annotations

import pytest

from regulatory_change import (
    AUDIT_EVENT,
    ChangeReason,
    RegulatoryChangeAgent,
    RegulatoryUpdate,
)
from regulatory_change._audit import ACTOR_ID
from tests.conftest import FakeAudit, FakeJiraClient, make_agent, make_doc


def test_material_change_drafts_jira_and_emits_audit_once() -> None:
    prior = make_doc(body="A\nfirst version.")
    current = make_doc(
        body="A\nfirst version.\n\nB\na whole new section added by regulator."
    )
    jira, audit = FakeJiraClient(), FakeAudit()
    out = make_agent(jira, audit).process(current, prior)

    assert isinstance(out, RegulatoryUpdate)
    assert out.jira_draft is not None
    assert out.delta.materiality == "material"
    assert out.audit_reason == ChangeReason.OK.value
    assert len(audit.records) == 1
    assert len(jira.drafts) == 1
    assert jira.drafts[0].audit_event_id == out.audit_event_id


def test_clarifying_change_does_not_draft_jira() -> None:
    prior = make_doc(body="A\nalpha beta")
    current = make_doc(body="A\nalpha beta gamma")  # 1-token add → clarifying
    jira, audit = FakeJiraClient(), FakeAudit()
    out = make_agent(jira, audit).process(current, prior)
    assert out.delta.materiality == "clarifying"
    assert out.jira_draft is None
    assert jira.drafts == []
    assert len(audit.records) == 1


def test_typo_only_change_does_not_draft_jira_and_uses_typo_reason() -> None:
    prior = make_doc(body="A\nhello, world.")
    current = make_doc(body="A\nhello world")  # punctuation drop only
    jira, audit = FakeJiraClient(), FakeAudit()
    out = make_agent(jira, audit).process(current, prior)
    assert out.delta.materiality == "typo"
    assert out.jira_draft is None
    assert out.audit_reason == ChangeReason.TYPO_ONLY.value
    assert jira.drafts == []


def test_no_change_returns_no_change_reason() -> None:
    body = "A\nidentical text"
    jira, audit = FakeJiraClient(), FakeAudit()
    out = make_agent(jira, audit).process(make_doc(body=body), make_doc(body=body))
    assert out.audit_reason == ChangeReason.NO_CHANGE.value
    assert out.jira_draft is None


def test_missing_prior_returns_empty_delta() -> None:
    jira, audit = FakeJiraClient(), FakeAudit()
    out = make_agent(jira, audit).process(make_doc(body="A\nfirst"), None)
    assert out.delta.sections_added == []
    assert out.delta.sections_removed == []
    assert out.delta.sections_changed == []
    assert out.audit_reason == ChangeReason.MISSING_PRIOR.value
    assert out.jira_draft is None
    assert len(audit.records) == 1
    assert audit.records[0]["decision"] == "skipped"


def test_audit_emit_called_exactly_once_per_process_call() -> None:
    jira, audit = FakeJiraClient(), FakeAudit()
    prior = make_doc(body="A\nfoo")
    current = make_doc(body="A\nbar")
    make_agent(jira, audit).process(current, prior)
    assert len(audit.records) == 1


def test_audit_record_shape_matches_round1_contract() -> None:
    jira, audit = FakeJiraClient(), FakeAudit()
    prior = make_doc(body="A\nfoo")
    current = make_doc(
        body="A\nfoo\n\nB\nbrand new material section with plenty of text included."
    )
    make_agent(jira, audit).process(current, prior)
    rec = audit.records[0]
    assert rec["event"] == AUDIT_EVENT
    assert rec["actor_id"] == ACTOR_ID
    assert rec["resource"] == f"doc:{current.doc_id}"
    assert rec["decision"] == "drafted"
    assert rec["reason"] == ChangeReason.OK.value
    assert rec["meta"]["doc_id"] == current.doc_id
    assert rec["meta"]["materiality"] == "material"


def test_emitter_returning_empty_string_falls_back_to_uuid() -> None:
    class EmptyAudit:
        def emit(self, record: object) -> str:
            return ""

    jira = FakeJiraClient()
    audit = EmptyAudit()
    prior = make_doc(body="A\nfoo")
    current = make_doc(body="A\nbar")
    out = RegulatoryChangeAgent(jira=jira, audit=audit).process(current, prior)
    assert out.audit_event_id
    assert len(out.audit_event_id) >= 16


def test_differ_failure_yields_diff_failed_reason(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Defensive — pure differ shouldn't raise, but if it does, we capture it."""
    from regulatory_change import change_agent as agent_mod

    def boom(*_args: object, **_kw: object) -> object:
        raise RuntimeError("differ exploded")

    monkeypatch.setattr(agent_mod, "diff_policy", boom)
    jira, audit = FakeJiraClient(), FakeAudit()
    out = make_agent(jira, audit).process(make_doc(body="A\nx"), make_doc(body="A\ny"))
    assert out.audit_reason == ChangeReason.DIFF_FAILED.value
    assert out.delta.diff_summary == "diff failed"
    # Defensive default materiality on failure is "material" → drafts a Jira.
    assert out.jira_draft is not None


def test_jira_draft_failure_propagates() -> None:
    """If the injected Jira client says draft failed, surface it.

    Audit has already been emitted by then — the failure carries the
    audit event id forward in the exception chain.
    """
    jira = FakeJiraClient(raise_exc=RuntimeError("draft sink down"))
    audit = FakeAudit()
    prior = make_doc(body="A\nold")
    current = make_doc(body="A\nold\n\nB\nbrand new material section with text.")
    with pytest.raises(RuntimeError, match="draft sink down"):
        make_agent(jira, audit).process(current, prior)
    # Audit was emitted BEFORE the jira draft was attempted.
    assert len(audit.records) == 1
