"""Direct tests for `_audit` helpers (redaction, record builder).

These cover the leaf branches that the orchestrator-level tests in
`test_draft_agent` do not naturally exercise (e.g. list redaction,
non-string non-collection passthrough, `_confidence` early-return).
"""

from __future__ import annotations

from sar_draft._audit import (
    ACTOR_ID,
    AUDIT_EVENT,
    AuditReason,
    build_record,
    now_iso,
    redact,
)
from sar_draft.draft_agent import _confidence  # type: ignore[attr-defined]


def test_redact_string_with_ssn() -> None:
    assert redact("user 123-45-6789 ssn") == "user [redacted] ssn"


def test_redact_string_with_card() -> None:
    assert "[redacted]" in redact("4111 1111 1111 1111")


def test_redact_string_with_iban_pattern() -> None:
    assert "[redacted]" in redact("DE89370400440532013000")


def test_redact_string_with_email() -> None:
    assert "[redacted]" in redact("send to user@example.com please")


def test_redact_passes_through_non_pii_string() -> None:
    assert redact("hello world") == "hello world"


def test_redact_recurses_into_dict() -> None:
    out = redact({"k": "user@example.com", "n": 1})
    assert out == {"k": "[redacted]", "n": 1}


def test_redact_recurses_into_list() -> None:
    out = redact(["plain", "user@example.com", 42, ["nested user@example.com"]])
    assert out == ["plain", "[redacted]", 42, ["nested [redacted]"]]


def test_redact_returns_non_str_non_collection_unchanged() -> None:
    assert redact(42) == 42
    assert redact(None) is None
    assert redact(3.14) == 3.14
    assert redact(True) is True


def test_now_iso_includes_timezone() -> None:
    s = now_iso()
    assert s.endswith("+00:00") or s.endswith("Z")


def test_build_record_shape_and_redaction() -> None:
    rec = build_record(
        tenant_id="tenant-1",
        alert_id="user@example.com",
        decision="generated",
        reason=AuditReason.OK,
        template_id="structuring",
        confidence=1.0,
    )
    assert rec["event"] == AUDIT_EVENT
    assert rec["actor_id"] == ACTOR_ID
    assert "[redacted]" in rec["resource"]
    assert rec["meta"] == {"template_id": "structuring", "confidence": 1.0}


def test_confidence_unfilled_returns_floor() -> None:
    assert _confidence(filled=False, citation_count=999) == 0.3


def test_confidence_filled_few_citations() -> None:
    assert _confidence(filled=True, citation_count=0) == 0.6


def test_confidence_filled_many_citations() -> None:
    assert _confidence(filled=True, citation_count=3) == 1.0
