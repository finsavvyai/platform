"""End-to-end tests for `TriageAgent`.

Covers safety invariants (DESIGN.md §3): exactly-one audit emit,
human-review-always-required, PII-free audit meta, no close API,
defensive empty-alert path.
"""

from __future__ import annotations

import inspect

import pytest

from alert_triage import (
    AUDIT_EVENT,
    AuditReason,
    Category,
    Priority,
    TriageAgent,
    TriageResult,
)
from alert_triage._audit import ACTOR_ID
from tests.conftest import FakeAudit, make_agent, make_alert

# ----------------------------- happy paths ---------------------------------


def test_happy_path_sanctions_triggers_p1() -> None:
    a = FakeAudit()
    out = make_agent(a).triage(make_alert(country_to="IR"))
    assert isinstance(out, TriageResult)
    assert out.priority is Priority.P1
    assert out.category is Category.SANCTIONS
    assert out.alert_id == "A-1"
    assert "freeze_funds" in out.recommended_actions
    assert out.audit_event_id == "audit-1"


def test_happy_path_structuring_triggers_p3_structuring() -> None:
    a = FakeAudit()
    out = make_agent(a).triage(make_alert(amount_minor=9_500_00))
    assert out.priority is Priority.P3
    assert out.category is Category.STRUCTURING
    assert "request_sof_docs" in out.recommended_actions


def test_happy_path_decision_block_triggers_p1_fraud() -> None:
    a = FakeAudit()
    out = make_agent(a).triage(make_alert(decision_score=90.0))
    assert out.priority is Priority.P1
    assert out.category is Category.FRAUD
    assert "freeze_card" in out.recommended_actions


def test_two_non_critical_rules_triggers_p2() -> None:
    a = FakeAudit()
    out = make_agent(a).triage(
        make_alert(mcc="7995", decision_score=70.0)
    )
    assert out.priority is Priority.P2
    assert len(out.reasoning_chain) == 2


def test_no_rule_match_routes_to_other_p4() -> None:
    a = FakeAudit()
    out = make_agent(a).triage(make_alert())
    assert out.priority is Priority.P4
    assert out.category is Category.OTHER
    assert out.reasoning_chain == []


def test_missing_subject_hash_routes_to_kyc_when_no_other_rule() -> None:
    a = FakeAudit()
    out = make_agent(a).triage(make_alert(subject_hash=""))
    assert out.category is Category.KYC
    assert out.recommended_actions == ["request_kyc_refresh"]


# ----------------------------- invariants ----------------------------------


def test_invariant_1_human_review_always_required_on_match() -> None:
    a = FakeAudit()
    out = make_agent(a).triage(make_alert(country_to="IR"))
    assert out.human_review_required is True


def test_invariant_1_human_review_always_required_on_no_match() -> None:
    a = FakeAudit()
    out = make_agent(a).triage(make_alert())
    assert out.human_review_required is True


def test_invariant_1_human_review_always_required_on_empty_alert() -> None:
    a = FakeAudit()
    out = make_agent(a).triage(make_alert(transaction_ids=[]))
    assert out.human_review_required is True


def test_invariant_2_audit_emit_called_exactly_once_on_match() -> None:
    a = FakeAudit()
    make_agent(a).triage(make_alert(country_to="IR"))
    assert len(a.records) == 1


def test_invariant_2_audit_emit_called_exactly_once_on_no_match() -> None:
    a = FakeAudit()
    make_agent(a).triage(make_alert())
    assert len(a.records) == 1


def test_invariant_2_audit_emit_called_exactly_once_on_empty() -> None:
    a = FakeAudit()
    make_agent(a).triage(make_alert(transaction_ids=[]))
    assert len(a.records) == 1


def test_invariant_3_audit_reason_is_stable_code() -> None:
    a = FakeAudit()
    make_agent(a).triage(make_alert(country_to="IR"))
    assert a.records[0]["reason"] in {x.value for x in AuditReason}
    assert a.records[0]["reason"] == AuditReason.TRIAGED.value


def test_invariant_3_audit_reason_no_match_for_blank_alert() -> None:
    a = FakeAudit()
    make_agent(a).triage(make_alert())
    assert a.records[0]["reason"] == AuditReason.NO_MATCH.value


def test_invariant_3_audit_reason_data_missing_for_empty_alert() -> None:
    a = FakeAudit()
    make_agent(a).triage(make_alert(transaction_ids=[]))
    assert a.records[0]["reason"] == AuditReason.DATA_MISSING.value


def test_invariant_4_audit_meta_pii_free() -> None:
    """meta carries rule IDs + counts + priority + category + confidence only."""
    a = FakeAudit()
    make_agent(a).triage(
        make_alert(
            country_to="IR",
            mcc="7995",
            amount_minor=9_500_00,
            decision_score=70.0,
            raw_meta={"name": "Sensitive Person", "ssn": "123-45-6789"},
        )
    )
    rec = a.records[0]
    serialised = repr(rec)
    # No raw_meta contents leak.
    assert "Sensitive Person" not in serialised
    assert "123-45-6789" not in serialised
    # No amount values, country codes, or MCC leak into meta.
    assert "9500" not in serialised
    assert "IR" not in serialised
    assert "7995" not in serialised
    # Meta keys are exactly the documented set.
    assert set(rec["meta"].keys()) == {
        "matched_rule_ids",
        "matched_count",
        "priority",
        "category",
        "confidence",
    }
    # And the rule_ids list is non-empty for a matched alert.
    assert isinstance(rec["meta"]["matched_rule_ids"], list)
    assert rec["meta"]["matched_count"] == len(rec["meta"]["matched_rule_ids"])


def test_invariant_5_no_close_api_exists() -> None:
    """Static check: TriageAgent has no method that would close/dismiss an alert."""
    forbidden = {"close", "dismiss", "resolve", "mark_resolved", "update", "delete"}
    methods = {
        name
        for name, _ in inspect.getmembers(TriageAgent, predicate=inspect.isfunction)
    }
    assert methods.isdisjoint(forbidden), (
        f"TriageAgent must be read-only; found mutation methods: {methods & forbidden}"
    )


def test_invariant_6_empty_alert_defensive() -> None:
    a = FakeAudit()
    out = make_agent(a).triage(make_alert(transaction_ids=[]))
    assert out.priority is Priority.P4
    assert out.category is Category.OTHER
    assert out.reasoning_chain == []
    assert out.confidence == 0.2
    assert a.records[0]["meta"]["matched_count"] == 0


# ----------------------------- audit shape ---------------------------------


def test_audit_record_shape_matches_round1_contract() -> None:
    a = FakeAudit()
    make_agent(a).triage(make_alert(country_to="IR"))
    rec = a.records[0]
    assert rec["event"] == AUDIT_EVENT
    assert rec["actor_id"] == ACTOR_ID
    assert rec["resource"] == "tenant-1:A-1"
    assert rec["decision"] == "triaged"
    assert rec["reason"] == AuditReason.TRIAGED.value
    assert rec["meta"]["priority"] == "p1"
    assert rec["meta"]["category"] == "sanctions"
    assert "r_sanctions_country" in rec["meta"]["matched_rule_ids"]
    assert "ts" in rec


def test_audit_emit_failure_propagates() -> None:
    a = FakeAudit(raise_exc=RuntimeError("sink down"))
    with pytest.raises(RuntimeError, match="sink down"):
        make_agent(a).triage(make_alert(country_to="IR"))


def test_audit_event_id_falls_back_to_uuid_when_emitter_returns_empty() -> None:
    a = FakeAudit(return_empty=True)
    out = make_agent(a).triage(make_alert(country_to="IR"))
    assert out.audit_event_id
    assert len(out.audit_event_id) >= 16  # uuid hex


# ----------------------------- non-empty recommendations -------------------


def test_recommended_actions_non_empty_for_p1() -> None:
    a = FakeAudit()
    out = make_agent(a).triage(make_alert(country_to="IR"))
    assert out.priority is Priority.P1
    assert len(out.recommended_actions) >= 1


def test_recommended_actions_non_empty_for_p2() -> None:
    a = FakeAudit()
    out = make_agent(a).triage(make_alert(mcc="7995", decision_score=70.0))
    assert out.priority is Priority.P2
    assert len(out.recommended_actions) >= 1


def test_recommended_actions_non_empty_for_p3() -> None:
    a = FakeAudit()
    out = make_agent(a).triage(make_alert(decision_score=70.0))
    assert out.priority is Priority.P3
    assert len(out.recommended_actions) >= 1


def test_reasoning_chain_ordered_by_weight() -> None:
    a = FakeAudit()
    out = make_agent(a).triage(
        make_alert(
            country_to="IR",                       # weight 100
            decision_score=90.0,                   # weight 90
            mcc="7995",                            # weight 40
        )
    )
    weights = [s.weight for s in out.reasoning_chain]
    assert weights == sorted(weights, reverse=True)
    assert out.reasoning_chain[0].rule_id == "r_sanctions_country"
