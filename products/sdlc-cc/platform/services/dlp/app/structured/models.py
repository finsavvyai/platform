"""Pydantic models for structured LLM outputs used by the DLP service.

These models describe the allowed shapes of LLM responses for policy
decisions, sensitivity classification, and masking plans. Field
descriptions double as prompts for the LLM when used via `instructor`.
"""

from __future__ import annotations

from enum import StrEnum

from pydantic import BaseModel, Field, confloat


class PolicyAction(StrEnum):
    """Actions a DLP policy decision can take."""

    ALLOW = "allow"
    REDACT = "redact"
    MASK = "mask"
    BLOCK = "block"
    ESCALATE = "escalate"


class DlpSensitivity(StrEnum):
    """Sensitivity buckets used by DLP classification."""

    PUBLIC = "public"
    INTERNAL = "internal"
    CONFIDENTIAL = "confidential"
    RESTRICTED = "restricted"
    SECRET = "secret"


class MaskingOperation(StrEnum):
    """Supported masking operations produced by the planner."""

    REDACT = "redact"
    HASH = "hash"
    TOKENIZE = "tokenize"
    PARTIAL_MASK = "partial_mask"
    REPLACE = "replace"


class PolicyDecision(BaseModel):
    """Decision about whether and how to act on a piece of content."""

    action: PolicyAction = Field(
        ...,
        description="Primary action to take against the evaluated content.",
    )
    matched_rule_ids: list[str] = Field(
        default_factory=list,
        description="IDs of the rules the content matched, if any.",
        max_length=32,
    )
    confidence: confloat(ge=0.0, le=1.0) = Field(  # type: ignore[valid-type]
        ...,
        description="Confidence in the chosen action, 0..1.",
    )
    rationale: str = Field(
        ...,
        description="Short human-readable justification for the decision.",
        max_length=500,
    )
    requires_review: bool = Field(
        default=False,
        description="True when a human reviewer should double-check the action.",
    )


class ClassificationResult(BaseModel):
    """Structured result of sensitivity classification."""

    sensitivity: DlpSensitivity = Field(
        ..., description="Sensitivity bucket assigned to the content."
    )
    categories: list[str] = Field(
        default_factory=list,
        description="Content categories such as 'pii', 'phi', 'finance'.",
        max_length=16,
    )
    confidence: confloat(ge=0.0, le=1.0) = Field(  # type: ignore[valid-type]
        ...,
        description="Model confidence in the classification, 0..1.",
    )
    detected_entities: list[str] = Field(
        default_factory=list,
        description="Short labels for detected sensitive entities.",
        max_length=32,
    )
    summary: str = Field(
        default="",
        description="One sentence summary of why this level was chosen.",
        max_length=300,
    )


class MaskingPlanItem(BaseModel):
    """A single masking instruction in a :class:`MaskingPlan`."""

    entity_label: str = Field(
        ...,
        description="Label of the entity to mask, e.g. 'EMAIL', 'SSN'.",
        max_length=64,
    )
    operation: MaskingOperation = Field(
        ..., description="Masking operation to apply to this entity type."
    )
    replacement: str | None = Field(
        default=None,
        description="Replacement text for REPLACE/PARTIAL_MASK operations.",
        max_length=128,
    )
    reason: str = Field(
        default="",
        description="Why this operation was chosen.",
        max_length=300,
    )


class MaskingPlan(BaseModel):
    """A plan describing how to mask sensitive content in a document."""

    items: list[MaskingPlanItem] = Field(
        default_factory=list,
        description="Ordered masking operations to apply.",
        max_length=64,
    )
    preserve_format: bool = Field(
        default=True,
        description="Keep the original formatting/length where feasible.",
    )
    notes: str = Field(
        default="",
        description="Free-form notes for reviewers.",
        max_length=500,
    )
