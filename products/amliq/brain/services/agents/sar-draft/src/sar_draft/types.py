"""Pydantic types + injected protocols for the SAR Draft Agent.

These shapes mirror cross-package contracts:
- `Citation` mirrors `SearchResult.citations[*]` from the TS SEARCH-UI
  (mesh §3).
- `SarDraft` matches mesh §4.
- `RetrievalAdapter` / `AuditEmitter` are injected protocols — no
  concrete import dependency on TS packages (Python cannot import TS
  anyway; the contract is documented in `oss/finsavvy-rag/src/types/`).

License: Apache-2.0
"""

from __future__ import annotations

from typing import Any, Protocol, runtime_checkable

from pydantic import BaseModel, ConfigDict, Field


class Citation(BaseModel):
    """Provenance pointer into a source document.

    Mirrors the shape of `SearchResult.citations[*]` from SEARCH-UI so the
    TS layer can render highlights without translation.
    """

    model_config = ConfigDict(frozen=True, extra="forbid")

    doc_id: str = Field(..., min_length=1)
    span_start: int = Field(..., ge=0)
    span_end: int = Field(..., ge=0)
    source: str = Field(..., min_length=1)


class SearchResult(BaseModel):
    """Single retrieval hit. Mirrors mesh §3 SearchResult (TS-defined)."""

    model_config = ConfigDict(extra="forbid")

    doc_id: str = Field(..., min_length=1)
    snippet: str
    score: float = Field(..., ge=0.0, le=1.0)
    citations: list[Citation] = Field(default_factory=list)


class AlertInput(BaseModel):
    """Triggering alert from AMLIQ Investigate `/v1/aml/decision`.

    `raw` carries only what the agent needs; PII fields are hashed/redacted
    upstream where possible. The agent itself never emits `raw` to audit.
    """

    model_config = ConfigDict(extra="forbid")

    alert_id: str = Field(..., min_length=1)
    tenant_id: str = Field(..., min_length=1)
    alert_type: str = Field(..., min_length=1)
    transaction_ids: list[str] = Field(default_factory=list)
    amount: float | None = None
    currency: str | None = Field(default=None, max_length=8)
    parties: list[str] = Field(default_factory=list)
    timestamps: list[str] = Field(default_factory=list)
    jurisdiction: str = Field(default="US", min_length=2, max_length=2)
    raw: dict[str, Any] = Field(default_factory=dict)


class TemplateMeta(BaseModel):
    """Static metadata describing one SAR template on disk."""

    model_config = ConfigDict(frozen=True, extra="forbid")

    id: str = Field(..., min_length=1)
    file: str = Field(..., min_length=1)
    title: str = Field(..., min_length=1)
    required_vars: list[str] = Field(default_factory=list)
    matches_alert_types: list[str] = Field(default_factory=list)


class SarDraft(BaseModel):
    """Output contract — mesh §4 SarDraft.

    `human_review_required` is always `True` in v0; the field is kept so
    downstream consumers can rely on the shape when the policy widens.
    """

    model_config = ConfigDict(extra="forbid")

    alert_id: str
    template_id: str
    filled_text: str
    citations: list[Citation] = Field(default_factory=list)
    confidence: float = Field(..., ge=0.0, le=1.0)
    human_review_required: bool = True
    audit_event_id: str = Field(..., min_length=1)


@runtime_checkable
class RetrievalAdapter(Protocol):
    """Injected retrieval port — the agent never imports a concrete client."""

    def search(
        self,
        query: str,
        tenant_id: str,
        top_k: int,
    ) -> list[SearchResult]: ...


@runtime_checkable
class AuditEmitter(Protocol):
    """Injected audit-emit port.

    The record shape mirrors the TS round-1 audit shape:
        { ts, actor_id, event, resource, decision, reason, meta }
    Implementations MUST be idempotent for retry safety and MUST NOT raise
    on well-formed input; they signal failure by raising explicitly which
    the agent catches and converts into an audit reason code.
    """

    def emit(self, record: dict[str, Any]) -> str: ...
