"""Behavioural tests for `draft_agent` happy and failure paths.

Invariant-focused tests live in `test_draft_agent_invariants.py`.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import pytest

from sar_draft import (
    AuditReason,
    DraftAgent,
    SarDraft,
    TemplateRegistry,
)
from sar_draft.template_registry import TemplateRegistryError
from tests.conftest import FakeAudit, FakeRetrieval, make_agent, make_alert, make_hits


def test_happy_path_returns_sar_draft() -> None:
    r, a = FakeRetrieval(make_hits(3)), FakeAudit()
    out = make_agent(r, a).draft(make_alert())
    assert isinstance(out, SarDraft)
    assert out.template_id == "structuring"
    assert out.alert_id == "A-1"
    assert "A-1" in out.filled_text
    assert "Acme Corp" in out.filled_text
    assert out.confidence == 1.0
    assert out.audit_event_id == "audit-1"


def test_retrieval_query_uses_alert_type_and_jurisdiction() -> None:
    r, a = FakeRetrieval(make_hits()), FakeAudit()
    make_agent(r, a).draft(make_alert(alert_type="unusual_activity", jurisdiction="US"))
    assert len(r.calls) == 1
    query, tenant_id, top_k = r.calls[0]
    assert "unusual_activity" in query
    assert "US" in query
    assert tenant_id == "tenant-1"
    assert top_k == 5


def test_confidence_low_when_few_citations() -> None:
    r, a = FakeRetrieval(make_hits(n_citations=1)), FakeAudit()
    assert make_agent(r, a).draft(make_alert()).confidence == 0.6


def test_confidence_high_when_many_citations() -> None:
    r, a = FakeRetrieval(make_hits(n_citations=5)), FakeAudit()
    assert make_agent(r, a).draft(make_alert()).confidence == 1.0


def test_custom_top_k_is_respected() -> None:
    r, a = FakeRetrieval(make_hits()), FakeAudit()
    agent = DraftAgent(
        registry=TemplateRegistry.from_default(),
        retrieval=r,
        audit=a,
        top_k=2,
    )
    agent.draft(make_alert())
    assert r.calls[0][2] == 2


def test_unmapped_alert_type_raises_with_missing_template_reason() -> None:
    r, a = FakeRetrieval(make_hits()), FakeAudit()
    with pytest.raises(TemplateRegistryError):
        make_agent(r, a).draft(make_alert(alert_type="nonexistent"))
    assert a.records[0]["reason"] == AuditReason.MISSING_TEMPLATE.value
    assert a.records[0]["meta"]["template_id"] == ""


def test_retrieval_failure_yields_retrieval_failed_reason() -> None:
    r, a = FakeRetrieval(RuntimeError("network")), FakeAudit()
    with pytest.raises(RuntimeError, match="retrieval failed"):
        make_agent(r, a).draft(make_alert())
    assert a.records[0]["reason"] == AuditReason.RETRIEVAL_FAILED.value


def test_audit_emit_failure_propagates() -> None:
    r, a = FakeRetrieval(make_hits()), FakeAudit(raise_exc=RuntimeError("sink down"))
    with pytest.raises(RuntimeError, match="sink down"):
        make_agent(r, a).draft(make_alert())


def test_render_failure_path_emits_render_failed_reason(tmp_path: Path) -> None:
    """Cover the render_failed branch via a template that demands a missing var."""
    root: Path = tmp_path / "templates"
    root.mkdir()
    (root / "_index.yaml").write_text(
        "templates:\n"
        "  - id: structuring\n"
        "    file: structuring.j2\n"
        "    title: t\n"
        "    required_vars: [alert_id, missing_field]\n"
        "    matches_alert_types: [structuring]\n",
        encoding="utf-8",
    )
    (root / "structuring.j2").write_text(
        "{{ alert_id }} {{ missing_field }}\n", encoding="utf-8"
    )
    reg = TemplateRegistry(root)
    r, a = FakeRetrieval(make_hits()), FakeAudit()
    agent = DraftAgent(registry=reg, retrieval=r, audit=a)
    with pytest.raises(RuntimeError, match="render failed"):
        agent.draft(make_alert())
    assert a.records[0]["reason"] == AuditReason.RENDER_FAILED.value
    assert a.records[0]["decision"] == "failed"


class _EmptyAudit:
    def emit(self, record: dict[str, Any]) -> str:
        return ""  # forces uuid fallback


def test_audit_event_id_falls_back_to_uuid_when_emitter_returns_empty() -> None:
    r = FakeRetrieval(make_hits())
    a = _EmptyAudit()
    agent = DraftAgent(
        registry=TemplateRegistry.from_default(),
        retrieval=r,
        audit=a,
    )
    out = agent.draft(make_alert())
    assert out.audit_event_id
    assert len(out.audit_event_id) >= 16  # uuid hex
