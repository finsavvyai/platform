"""Safety-invariant tests for `DraftAgent`.

Each test maps to a numbered invariant in DESIGN.md §3. Tightly scoped so
a regression is unambiguous in CI output.
"""

from __future__ import annotations

from sar_draft import AUDIT_EVENT, AuditReason
from sar_draft._audit import ACTOR_ID
from sar_draft.template_registry import TemplateRegistryError
from tests.conftest import FakeAudit, FakeRetrieval, make_agent, make_alert, make_hits


def test_invariant_1_human_review_always_required() -> None:
    """Invariant 1 — never auto-file in v0."""
    r, a = FakeRetrieval(make_hits()), FakeAudit()
    out = make_agent(r, a).draft(make_alert())
    assert out.human_review_required is True


def test_invariant_2_audit_emit_called_exactly_once_on_success() -> None:
    """Invariant 2 — exactly one audit record per draft() call."""
    r, a = FakeRetrieval(make_hits()), FakeAudit()
    make_agent(r, a).draft(make_alert())
    assert len(a.records) == 1


def test_invariant_2_audit_emit_called_exactly_once_on_missing_template() -> None:
    r, a = FakeRetrieval([]), FakeAudit()
    import pytest

    with pytest.raises(TemplateRegistryError):
        make_agent(r, a).draft(make_alert(alert_type="never_seen"))
    assert len(a.records) == 1
    assert a.records[0]["reason"] == AuditReason.MISSING_TEMPLATE.value
    assert a.records[0]["decision"] == "failed"


def test_invariant_2_audit_emit_called_exactly_once_on_retrieval_failure() -> None:
    r, a = FakeRetrieval(RuntimeError("net")), FakeAudit()
    import pytest

    with pytest.raises(RuntimeError, match="retrieval failed"):
        make_agent(r, a).draft(make_alert())
    assert len(a.records) == 1


def test_invariant_3_audit_reason_is_stable_code() -> None:
    """Invariant 3 — reason ∈ AuditReason values."""
    r, a = FakeRetrieval(make_hits()), FakeAudit()
    make_agent(r, a).draft(make_alert())
    assert a.records[0]["reason"] in {x.value for x in AuditReason}


def test_invariant_4_audit_meta_pii_free() -> None:
    """Invariant 4 — meta carries template_id + confidence only; no PII."""
    r, a = FakeRetrieval(make_hits()), FakeAudit()
    make_agent(r, a).draft(make_alert(parties=["Sensitive Person Name"], amount=99999.99))
    rec = a.records[0]
    serialised = repr(rec)
    assert "Sensitive Person Name" not in serialised
    assert "99999.99" not in serialised
    assert "9500" not in serialised
    assert set(rec["meta"].keys()) == {"template_id", "confidence"}


def test_invariant_5_pii_pattern_redacted_ssn() -> None:
    """Invariant 5 — SSN-shaped pattern is redacted at the boundary."""
    r, a = FakeRetrieval(make_hits()), FakeAudit()
    make_agent(r, a).draft(make_alert(alert_id="123-45-6789"))
    rec = a.records[0]
    assert "123-45-6789" not in rec["resource"]
    assert "[redacted]" in rec["resource"]


def test_invariant_5_pii_pattern_redacted_email() -> None:
    r, a = FakeRetrieval(make_hits()), FakeAudit()
    make_agent(r, a).draft(make_alert(alert_id="user@example.com"))
    assert "user@example.com" not in a.records[0]["resource"]


def test_audit_record_shape_matches_round1_contract() -> None:
    """Cross-check the record matches the TS round-1 audit shape."""
    r, a = FakeRetrieval(make_hits()), FakeAudit()
    make_agent(r, a).draft(make_alert())
    rec = a.records[0]
    assert rec["event"] == AUDIT_EVENT
    assert rec["actor_id"] == ACTOR_ID
    assert rec["resource"] == "tenant-1:A-1"
    assert rec["decision"] == "generated"
    assert rec["reason"] == "ok"
    assert rec["meta"]["template_id"] == "structuring"
    assert rec["meta"]["confidence"] == 1.0
