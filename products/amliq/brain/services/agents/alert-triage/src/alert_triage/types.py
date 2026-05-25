"""Pydantic types + injected protocols for the Alert Triage Agent.

These shapes mirror cross-package contracts:
- `Alert` carries fields drawn from `AmlDecision` and the analyst
  console; `amount_minor` is integer cents (mirrors AMLIQ `MoneyMinor`).
- `TriageResult` mirrors mesh §7 (Brain Month 3) — `human_review_required`
  defaults to `True` in v0.
- `AuditEmitter` is an injected protocol — no concrete dependency on TS
  or transport layers.

License: Apache-2.0
"""

from __future__ import annotations

from enum import StrEnum
from typing import Any, Literal, Protocol, runtime_checkable

from pydantic import BaseModel, ConfigDict, Field

AlertSource = Literal["aml_decision", "manual", "monitor"]


class Priority(StrEnum):
    """Triage priority — `p1` highest urgency, `p4` lowest."""

    P1 = "p1"
    P2 = "p2"
    P3 = "p3"
    P4 = "p4"


class Category(StrEnum):
    """Triage category — mutually exclusive, deterministic per `Alert`."""

    SANCTIONS = "sanctions"
    STRUCTURING = "structuring"
    KYC = "kyc"
    FRAUD = "fraud"
    OTHER = "other"


class Alert(BaseModel):
    """Input alert payload.

    `amount_minor` is integer cents (no floats — mirrors AMLIQ `MoneyMinor`).
    `subject_hash` is the upstream hashed identifier; empty/missing triggers
    a `kyc` category in the classifier.
    `decision_score` is the `max_risk_score` from `AmlDecision` (0..100),
    optional because non-Investigate sources may not carry one.
    `raw_meta` is opaque carry-through; the agent never emits it to audit.
    """

    model_config = ConfigDict(extra="forbid")

    alert_id: str = Field(..., min_length=1)
    tenant_id: str = Field(..., min_length=1)
    source: AlertSource
    subject_hash: str = Field(default="")
    transaction_ids: list[str] = Field(default_factory=list)
    amount_minor: int = Field(default=0, ge=0)
    currency: str = Field(default="USD", min_length=3, max_length=8)
    mcc: str | None = None
    country_from: str | None = Field(default=None, max_length=2)
    country_to: str | None = Field(default=None, max_length=2)
    decision_score: float | None = Field(default=None, ge=0.0, le=100.0)
    raw_meta: dict[str, Any] = Field(default_factory=dict)


class ReasoningStep(BaseModel):
    """One node in the ordered reasoning chain.

    `evidence` carries rule-specific, PII-free facts (e.g. matched country
    code, MCC, amount band). The agent never puts party names or
    transaction IDs in `evidence`.
    """

    model_config = ConfigDict(frozen=True, extra="forbid")

    rule_id: str = Field(..., min_length=1)
    matched: bool
    evidence: dict[str, Any] = Field(default_factory=dict)
    weight: int = Field(..., ge=0, le=1000)


class TriageResult(BaseModel):
    """Output contract — mesh §7 TriageResult.

    `human_review_required` is always `True` in v0; the field stays so
    downstream consumers can rely on the shape when the policy widens.
    `confidence` is `[0.0, 1.0]` and reflects rule-match strength only —
    not ML model confidence.
    """

    model_config = ConfigDict(extra="forbid")

    alert_id: str
    priority: Priority
    category: Category
    reasoning_chain: list[ReasoningStep] = Field(default_factory=list)
    recommended_actions: list[str] = Field(default_factory=list)
    confidence: float = Field(..., ge=0.0, le=1.0)
    human_review_required: bool = True
    audit_event_id: str = Field(..., min_length=1)


@runtime_checkable
class AuditEmitter(Protocol):
    """Injected audit-emit port.

    Record shape mirrors the TS round-1 audit shape:
        { ts, actor_id, event, resource, decision, reason, meta }
    Implementations MUST signal failure by raising — the agent catches
    nothing here (audit emit failure is release-blocking per parent CLAUDE).
    """

    def emit(self, record: dict[str, Any]) -> str: ...
