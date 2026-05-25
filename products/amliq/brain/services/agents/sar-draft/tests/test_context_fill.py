"""Tests for `context_fill` — 100% coverage target (template safety lives here)."""

from __future__ import annotations

import pytest

from sar_draft.context_fill import (
    MissingVariableError,
    RenderError,
    assert_required_vars,
    build_context,
    collect_citations,
    render,
)
from sar_draft.types import AlertInput, Citation, SearchResult, TemplateMeta


def _alert(**overrides: object) -> AlertInput:
    base: dict[str, object] = {
        "alert_id": "A-1",
        "tenant_id": "tenant-1",
        "alert_type": "structuring",
        "transaction_ids": ["T-1", "T-2"],
        "amount": 9500.0,
        "currency": "USD",
        "parties": ["Acme Corp"],
        "timestamps": ["2026-05-25T00:00:00Z"],
        "jurisdiction": "US",
    }
    base.update(overrides)
    return AlertInput(**base)  # type: ignore[arg-type]


def _meta(**overrides: object) -> TemplateMeta:
    base: dict[str, object] = {
        "id": "structuring",
        "file": "structuring.j2",
        "title": "t",
        "required_vars": ["alert_id", "subject_identifier"],
        "matches_alert_types": ["structuring"],
    }
    base.update(overrides)
    return TemplateMeta(**base)  # type: ignore[arg-type]


def test_build_context_happy_path() -> None:
    ctx = build_context(_alert(), [])
    assert ctx["alert_id"] == "A-1"
    assert ctx["tenant_id"] == "tenant-1"
    assert ctx["transaction_summary"] == "T-1, T-2"
    assert ctx["subject_identifier"] == "Acme Corp"
    assert ctx["citation_count"] == 0


def test_build_context_no_parties_gives_empty_subject() -> None:
    ctx = build_context(_alert(parties=[]), [])
    assert ctx["subject_identifier"] == ""


def test_build_context_aggregates_citations() -> None:
    hits = [
        SearchResult(
            doc_id="D1", snippet="snip1", score=0.9,
            citations=[Citation(doc_id="D1", span_start=0, span_end=4, source="fincen")],
        ),
        SearchResult(
            doc_id="D2", snippet="snip2", score=0.8,
            citations=[
                Citation(doc_id="D2", span_start=5, span_end=9, source="fincen"),
                Citation(doc_id="D2", span_start=10, span_end=14, source="fincen"),
            ],
        ),
    ]
    ctx = build_context(_alert(), hits)
    assert ctx["citation_count"] == 3
    assert "snip1" in ctx["evidence_snippets"]
    assert "snip2" in ctx["evidence_snippets"]


def test_build_context_extras_cannot_shadow_alert_fields() -> None:
    ctx = build_context(_alert(), [], extra={"alert_id": "HIJACKED", "custom": "ok"})
    assert ctx["alert_id"] == "A-1"
    assert ctx["custom"] == "ok"


def test_collect_citations_flattens() -> None:
    hits = [
        SearchResult(
            doc_id="D1", snippet="", score=0.5,
            citations=[Citation(doc_id="D1", span_start=0, span_end=1, source="s")],
        ),
        SearchResult(doc_id="D2", snippet="", score=0.5),  # zero citations
    ]
    cites = collect_citations(hits)
    assert len(cites) == 1
    assert cites[0].doc_id == "D1"


def test_assert_required_vars_missing_raises() -> None:
    with pytest.raises(MissingVariableError, match="subject_identifier"):
        assert_required_vars(_meta(), {"alert_id": "A-1"})


def test_assert_required_vars_empty_string_treated_missing() -> None:
    with pytest.raises(MissingVariableError, match="subject_identifier"):
        assert_required_vars(_meta(), {"alert_id": "A-1", "subject_identifier": ""})


def test_assert_required_vars_none_treated_missing() -> None:
    with pytest.raises(MissingVariableError, match="subject_identifier"):
        assert_required_vars(_meta(), {"alert_id": "A-1", "subject_identifier": None})


def test_assert_required_vars_all_present_no_raise() -> None:
    assert_required_vars(_meta(), {"alert_id": "A-1", "subject_identifier": "Acme"})


def test_render_happy_path() -> None:
    body = "Alert: {{ alert_id }} / Subject: {{ subject_identifier }}\n"
    out = render(body, _meta(), {"alert_id": "A-1", "subject_identifier": "Acme"})
    assert out == "Alert: A-1 / Subject: Acme\n"


def test_html_input_is_escaped() -> None:
    """Template injection / XSS safety — autoescape must escape user input."""
    body = "Subject: {{ subject_identifier }}\n"
    out = render(
        body,
        _meta(required_vars=["subject_identifier"]),
        {"subject_identifier": "<script>alert('x')</script>"},
    )
    assert "<script>" not in out
    assert "&lt;script&gt;" in out


def test_template_injection_attempt_is_escaped() -> None:
    """User-supplied jinja syntax must NOT be re-evaluated."""
    body = "Subject: {{ subject_identifier }}\n"
    out = render(
        body,
        _meta(required_vars=["subject_identifier"]),
        {"subject_identifier": "{{ 7*7 }}"},
    )
    assert "49" not in out
    assert "{{ 7*7 }}" in out or "{{ 7*7 }}".replace("{", "&#") in out or "7*7" in out


def test_missing_var_raises_missing_variable_error() -> None:
    body = "Hello {{ never_provided }}\n"
    meta = _meta(required_vars=[])  # bypass pre-flight so jinja itself raises
    with pytest.raises(MissingVariableError):
        render(body, meta, {})


def test_render_failed_for_syntax_error() -> None:
    body = "Hello {% if %}\n"
    meta = _meta(required_vars=[])
    with pytest.raises(RenderError):
        render(body, meta, {})


def test_render_required_var_missing_raises_via_preflight() -> None:
    body = "Hello {{ subject_identifier }}\n"
    with pytest.raises(MissingVariableError, match="subject_identifier"):
        render(body, _meta(required_vars=["subject_identifier"]), {})
