"""Safety-invariant tests for `RegulatoryChangeAgent`.

Each test maps to a numbered invariant in DESIGN.md §3. Tightly scoped so
a regression is unambiguous in CI output.
"""

from __future__ import annotations

from regulatory_change import (
    ChangeReason,
    RegulatoryChangeAgent,
    RegulatoryUpdate,
)
from tests.conftest import FakeAudit, FakeJiraClient, make_agent, make_doc


def test_invariant_3_never_creates_real_ticket() -> None:
    """The agent must call `JiraClient.draft()` only — never any other method.

    `StrictJira.__getattr__` raises on any attribute lookup other than
    `draft`. If the agent ever reached for `create_ticket` / `submit`,
    this test would fail.
    """

    class StrictJira:
        def __init__(self) -> None:
            self.draft_calls: int = 0

        def draft(self, payload: object) -> str:
            self.draft_calls += 1
            return "strict-draft-1"

        def __getattr__(self, name: str) -> object:
            raise AssertionError(
                f"agent reached for non-draft method {name!r} on JiraClient — "
                "violates safety invariant 3 (never auto-creates a ticket)"
            )

    jira = StrictJira()
    audit = FakeAudit()
    prior = make_doc(body="A\nold")
    current = make_doc(
        body="A\nold\n\nB\nNEW MATERIAL SECTION HERE WITH ENOUGH TEXT TO CARE."
    )
    agent = RegulatoryChangeAgent(jira=jira, audit=audit)
    out = agent.process(current, prior)
    assert jira.draft_calls == 1
    assert out.jira_draft is not None


def test_invariant_4_audit_reason_is_stable_code() -> None:
    """INV-4 — reason ∈ {ChangeReason values}."""
    stable_values = {r.value for r in ChangeReason}
    jira, audit = FakeJiraClient(), FakeAudit()
    make_agent(jira, audit).process(make_doc(body="A\nfoo"), make_doc(body="A\nfoo"))
    assert audit.records[0]["reason"] in stable_values


def test_invariant_7_audit_emit_failure_does_not_crash() -> None:
    """INV-7 — audit emit failure must NOT crash the agent."""
    jira = FakeJiraClient()
    audit = FakeAudit(raise_exc=RuntimeError("sink down"))
    prior = make_doc(body="A\nold")
    current = make_doc(
        body="A\nold\n\nB\nnew material section text long enough to matter."
    )
    out = make_agent(jira, audit).process(current, prior)
    # Did NOT raise. Audit was attempted. Output still returned.
    assert isinstance(out, RegulatoryUpdate)
    assert out.audit_event_id  # falls back to uuid
    assert len(out.audit_event_id) >= 16
    # Jira draft still produced (material).
    assert out.jira_draft is not None


def test_invariant_8_audit_meta_pii_free() -> None:
    """INV-8 — meta carries only doc_id + materiality + sections_count.

    The agent must NEVER put document bodies, party names, or transaction
    descriptions into the audit meta. We assert the meta keys explicitly.
    """
    jira, audit = FakeJiraClient(), FakeAudit()
    sensitive_body = "A\nMr. John Q. Public, SSN 123-45-6789, sent $9,500 to Acme."
    current = make_doc(body=sensitive_body + " (this version has more material).")
    prior = make_doc(body=sensitive_body)
    make_agent(jira, audit).process(current, prior)

    rec = audit.records[0]
    assert set(rec["meta"].keys()) == {"doc_id", "materiality", "sections_count"}
    serialised = repr(rec)
    assert "John Q. Public" not in serialised
    assert "123-45-6789" not in serialised
    assert "Acme" not in serialised


def test_mesh_7_human_review_required_true_on_every_update() -> None:
    """Mesh §7 — every Brain agent output has human_review_required=True."""
    jira, audit = FakeJiraClient(), FakeAudit()
    out_missing_prior = make_agent(jira, audit).process(make_doc(body="A\nx"), None)
    out_no_change = make_agent(jira, audit).process(
        make_doc(body="A\nx"), make_doc(body="A\nx")
    )
    out_material = make_agent(jira, audit).process(
        make_doc(body="A\nold\n\nB\nnew material with plenty of words."),
        make_doc(body="A\nold"),
    )
    assert out_missing_prior.human_review_required is True
    assert out_no_change.human_review_required is True
    assert out_material.human_review_required is True
    # And whenever a JiraDraft exists, IT also has human_review_required=True.
    assert out_material.jira_draft is not None
    assert out_material.jira_draft.human_review_required is True
