"""Tests for `jira_drafter.draft_jira` — safety-critical (100 % coverage gate).

Enforces:
- INV-1: every produced draft has `human_review_required=True`.
- INV-2: this module performs NO outbound HTTP — verified at the AST
  level by inspecting the import graph of `jira_drafter.py`.
"""

from __future__ import annotations

import ast
from pathlib import Path

import pytest

from regulatory_change import draft_jira
from regulatory_change.types import ChangeChunk, ComplianceDoc, PolicyDelta, Section
from tests.conftest import make_doc

_HTTP_FORBIDDEN_MODULES = {
    "requests",
    "httpx",
    "urllib",
    "urllib.request",
    "urllib3",
    "http.client",
    "aiohttp",
    "httplib2",
    "socket",
}


def _delta(materiality: str = "material", **kw: object) -> PolicyDelta:
    base: dict[str, object] = {
        "doc_id": "FIN-2026-01",
        "new_version_id": "sha-current",
        "prior_version_id": "sha-prior",
        "diff_summary": "test summary",
        "materiality": materiality,
    }
    base.update(kw)
    return PolicyDelta(**base)  # type: ignore[arg-type]


def test_invariant_human_review_always_required() -> None:
    """INV-1 — never auto-file."""
    for materiality in ("material", "clarifying", "typo"):
        draft = draft_jira(make_doc(), _delta(materiality=materiality))
        assert draft.human_review_required is True, materiality


def test_invariant_no_http_imports() -> None:
    """INV-2 — `jira_drafter.py` does not import any HTTP client.

    Inspects the AST of the source file and asserts none of the modules in
    `_HTTP_FORBIDDEN_MODULES` appear in import statements. Any future PR
    that adds an HTTP dep here will break this test.
    """
    src_path = (
        Path(__file__).resolve().parent.parent
        / "src"
        / "regulatory_change"
        / "jira_drafter.py"
    )
    source = src_path.read_text(encoding="utf-8")
    tree = ast.parse(source)
    imported: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            imported.update(alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module is not None:
            imported.add(node.module)
    bad = imported & _HTTP_FORBIDDEN_MODULES
    assert not bad, f"jira_drafter.py must not import HTTP modules; found: {bad}"


def test_labels_include_source_jurisdiction_doc_and_materiality() -> None:
    doc = make_doc(
        doc_id="FIN-77", source="fincen-rss", jurisdiction="US"
    )
    delta = _delta(materiality="material")
    out = draft_jira(doc, delta)
    assert "amliq-brain" in out.labels
    assert "regulatory-change" in out.labels
    assert "jurisdiction:US" in out.labels
    assert "source:fincen-rss" in out.labels
    assert "doc:FIN-77" in out.labels
    assert "materiality:material" in out.labels


def test_severity_high_for_material() -> None:
    assert draft_jira(make_doc(), _delta(materiality="material")).severity == "high"


def test_severity_medium_for_clarifying() -> None:
    assert draft_jira(make_doc(), _delta(materiality="clarifying")).severity == "medium"


def test_severity_low_for_typo() -> None:
    assert draft_jira(make_doc(), _delta(materiality="typo")).severity == "low"


def test_severity_unknown_materiality_defaults_high() -> None:
    """Defensive — if pydantic ever loosens, we still pick the safe severity.

    We construct a JiraDraft via direct dict bypass of the materiality
    check by going through the model_copy path on an already-built delta.
    """
    delta = _delta(materiality="material")
    # mutate post-construction by bypassing validation (defensive testing only)
    object.__setattr__(delta, "materiality", "weird-future-value")
    out = draft_jira(make_doc(), delta)
    assert out.severity == "high"


def test_title_contains_source_and_doc_id() -> None:
    out = draft_jira(make_doc(doc_id="FIN-2026-99", source="fincen-rss"), _delta())
    assert "fincen-rss" in out.title
    assert "FIN-2026-99" in out.title


def test_title_truncated_when_too_long() -> None:
    huge_id = "X" * 300
    out = draft_jira(make_doc(doc_id=huge_id, source="fincen-rss"), _delta())
    assert len(out.title) <= 200
    assert out.title.endswith("…")


def test_body_contains_human_review_warning() -> None:
    out = draft_jira(make_doc(), _delta())
    assert "Human review required" in out.body
    assert "NOT auto-filed" in out.body


def test_body_lists_changed_headings() -> None:
    delta = _delta(
        sections_changed=[
            ChangeChunk(heading="Section X", prior_text="a", current_text="b"),
            ChangeChunk(heading="", prior_text="c", current_text="d"),
        ]
    )
    out = draft_jira(make_doc(), delta)
    assert "Section X" in out.body
    assert "(no heading)" in out.body


def test_body_reports_section_counts() -> None:
    delta = _delta(
        sections_added=[Section(heading="A", text="")],
        sections_removed=[Section(heading="B", text="")],
        sections_changed=[ChangeChunk(heading="C", prior_text="x", current_text="y")],
    )
    out = draft_jira(make_doc(), delta)
    assert "Sections added: 1" in out.body
    assert "Sections removed: 1" in out.body
    assert "Sections changed: 1" in out.body


def test_audit_event_id_empty_before_orchestrator_fills_it() -> None:
    out = draft_jira(make_doc(), _delta())
    assert out.audit_event_id == ""


def test_source_doc_id_propagated() -> None:
    out = draft_jira(make_doc(doc_id="FIN-XYZ"), _delta())
    assert out.source_doc_id == "FIN-XYZ"


def test_doc_with_empty_body_still_drafts() -> None:
    # Bodies don't change the contract; the body string just becomes shorter.
    doc = make_doc(body="")
    out = draft_jira(doc, _delta())
    assert out.human_review_required is True


def test_compliance_doc_is_a_basemodel() -> None:
    """Sanity: the type we're working with matches the cross-pkg shape."""
    assert isinstance(make_doc(), ComplianceDoc)


def test_invalid_materiality_in_delta_raises_at_construction() -> None:
    with pytest.raises(ValueError):
        _delta(materiality="not-a-valid-value")
