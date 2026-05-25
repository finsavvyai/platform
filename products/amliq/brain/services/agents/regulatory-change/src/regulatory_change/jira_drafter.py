"""Pure Jira draft builder — `PolicyDelta` + `ComplianceDoc` → `JiraDraft`.

Safety invariants enforced HERE (100 % coverage gate):
- INV-1: `human_review_required` is ALWAYS True on every produced draft.
- INV-2: This module performs NO outbound HTTP — it does not import
         `requests`, `httpx`, `urllib`, `http.client`, or `aiohttp`.
         The `test_invariant_no_http_imports` test asserts this at the
         AST level.

The orchestrator passes the resulting `JiraDraft` to the injected
`JiraClient.draft()` — which in v0 is a fake that records the draft
without making HTTP calls (DESIGN.md §3 invariants 2 + 3).

License: Apache-2.0
"""

from __future__ import annotations

from typing import Final

from regulatory_change.types import ComplianceDoc, JiraDraft, PolicyDelta

_TITLE_PREFIX: Final[str] = "[AMLIQ Brain] regulatory change"
_TITLE_MAX_LEN: Final[int] = 200

_SEVERITY_BY_MATERIALITY: Final[dict[str, str]] = {
    "material": "high",
    "clarifying": "medium",
    "typo": "low",
}


def _build_title(doc: ComplianceDoc) -> str:
    raw = f"{_TITLE_PREFIX} — {doc.source}:{doc.doc_id}"
    if len(raw) <= _TITLE_MAX_LEN:
        return raw
    # Reserve 1 char for the ellipsis sentinel.
    return raw[: _TITLE_MAX_LEN - 1] + "…"


def _build_labels(doc: ComplianceDoc, materiality: str) -> list[str]:
    return [
        "amliq-brain",
        "regulatory-change",
        f"jurisdiction:{doc.jurisdiction}",
        f"source:{doc.source}",
        f"doc:{doc.doc_id}",
        f"materiality:{materiality}",
    ]


def _build_body(doc: ComplianceDoc, delta: PolicyDelta) -> str:
    lines: list[str] = [
        f"**Source**: {doc.source}",
        f"**Jurisdiction**: {doc.jurisdiction}",
        f"**Doc**: {doc.doc_id} — {doc.title}",
        f"**Materiality**: {delta.materiality}",
        f"**Diff summary**: {delta.diff_summary}",
        "",
        f"- Sections added: {len(delta.sections_added)}",
        f"- Sections removed: {len(delta.sections_removed)}",
        f"- Sections changed: {len(delta.sections_changed)}",
    ]
    if delta.sections_changed:
        lines.append("")
        lines.append("**Changed headings:**")
        for chunk in delta.sections_changed:
            lines.append(f"- {chunk.heading or '(no heading)'}")
    lines.append("")
    lines.append(
        "_Human review required. This draft was NOT auto-filed. A "
        "compliance officer must sign off before any ticket is created._"
    )
    return "\n".join(lines)


def draft_jira(doc: ComplianceDoc, delta: PolicyDelta) -> JiraDraft:
    """Build a JiraDraft. Pure. Always sets `human_review_required=True`.

    INVARIANT 1 (release-blocking): the returned draft has
    `human_review_required=True`. The orchestrator never overrides this.
    """
    severity = _SEVERITY_BY_MATERIALITY.get(delta.materiality, "high")
    return JiraDraft(
        title=_build_title(doc),
        body=_build_body(doc, delta),
        labels=_build_labels(doc, delta.materiality),
        severity=severity,
        source_doc_id=doc.doc_id,
        materiality=delta.materiality,
        audit_event_id="",  # populated by orchestrator post-emit
        human_review_required=True,  # invariant 1
    )
