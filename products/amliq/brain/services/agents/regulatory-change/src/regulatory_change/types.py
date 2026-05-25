"""Pydantic types + injected protocols for the Regulatory Change Agent.

These shapes mirror cross-package contracts:
- `ComplianceDoc` mirrors the TS shape in
  `products/amliq/brain/corpus/src/types.ts` (mesh M2 §1). Python cannot
  import TS; the shape is replicated and version-pinned by code review.
- `JiraDraft` is the Brain-internal contract (no TS counterpart yet).
- `AuditEmitter` / `JiraClient` are injected protocols — no concrete
  dependency on transport. Per mesh §7, every agent output carries
  `human_review_required: bool` defaulting to True in v0.

License: Apache-2.0
"""

from __future__ import annotations

from enum import StrEnum
from typing import Any, Protocol, runtime_checkable

from pydantic import BaseModel, ConfigDict, Field


class ChangeReason(StrEnum):
    """Stable reason codes for regulatory-change audit records. PII-free."""

    OK = "ok"
    NO_CHANGE = "no_change"
    TYPO_ONLY = "typo_only"
    MISSING_PRIOR = "missing_prior"
    DIFF_FAILED = "diff_failed"
    UNKNOWN_ERROR = "unknown_error"


Materiality = str  # constrained to {"material","clarifying","typo"} at runtime
_MATERIALITY_VALUES: frozenset[str] = frozenset({"material", "clarifying", "typo"})


def _check_materiality(value: str) -> str:
    if value not in _MATERIALITY_VALUES:
        raise ValueError(
            f"materiality must be one of {sorted(_MATERIALITY_VALUES)}, got {value!r}"
        )
    return value


class ComplianceDoc(BaseModel):
    """Mirror of the TS `ComplianceDoc` (`corpus/src/types.ts`)."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    source: str = Field(..., min_length=1)
    jurisdiction: str = Field(..., min_length=2, max_length=2)
    doc_id: str = Field(..., min_length=1)
    title: str = Field(..., min_length=1)
    published_at: str = Field(..., min_length=1)
    sha256: str = Field(..., min_length=8)
    body: str = ""


class Section(BaseModel):
    """A logical chunk of a `ComplianceDoc.body` — heading + paragraph text."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    heading: str = ""
    text: str = ""


class ChangeChunk(BaseModel):
    """A section whose body changed between prior and current versions."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    heading: str = ""
    prior_text: str = ""
    current_text: str = ""


class PolicyDelta(BaseModel):
    """Aggregate diff between two versions of a `ComplianceDoc`."""

    model_config = ConfigDict(extra="forbid")

    doc_id: str = Field(..., min_length=1)
    prior_version_id: str | None = None
    new_version_id: str = Field(..., min_length=1)
    sections_added: list[Section] = Field(default_factory=list)
    sections_removed: list[Section] = Field(default_factory=list)
    sections_changed: list[ChangeChunk] = Field(default_factory=list)
    diff_summary: str = ""
    materiality: str = "clarifying"

    def __init__(self, **data: Any) -> None:
        if "materiality" in data and data["materiality"] is not None:
            data["materiality"] = _check_materiality(data["materiality"])
        super().__init__(**data)


class JiraDraft(BaseModel):
    """Draft Jira ticket. NEVER auto-filed — human review required."""

    model_config = ConfigDict(extra="forbid")

    title: str = Field(..., min_length=1, max_length=200)
    body: str = ""
    labels: list[str] = Field(default_factory=list)
    severity: str = "low"  # {"low","medium","high"}
    source_doc_id: str = Field(..., min_length=1)
    materiality: str = "clarifying"
    audit_event_id: str = ""
    human_review_required: bool = True  # mesh §7 invariant — defaults True


class RegulatoryUpdate(BaseModel):
    """Output of `RegulatoryChangeAgent.process()`."""

    model_config = ConfigDict(extra="forbid")

    doc_id: str = Field(..., min_length=1)
    delta: PolicyDelta
    jira_draft: JiraDraft | None = None
    audit_event_id: str = ""
    audit_reason: str = ChangeReason.UNKNOWN_ERROR.value
    human_review_required: bool = True  # mesh §7 invariant — defaults True


@runtime_checkable
class JiraClient(Protocol):
    """Injected Jira port. v0 implementations MUST be draft-only (no HTTP).

    `draft(payload)` records a draft intent and returns a synthetic
    draft id. A future HTTP-capable adapter is intentionally out of
    scope for this package (see DESIGN.md §3 invariant 2).
    """

    def draft(self, payload: JiraDraft) -> str: ...


@runtime_checkable
class AuditEmitter(Protocol):
    """Injected audit-emit port. Mirrors TS round-1 audit shape."""

    def emit(self, record: dict[str, Any]) -> str: ...
