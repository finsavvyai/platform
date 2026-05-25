"""Pydantic models for structured LLM outputs used by the RAG service.

These models are passed to `instructor` as ``response_model``, so the
LLM provider is forced to return JSON that validates against them. Any
field descriptions double as instructions for the LLM.
"""

from __future__ import annotations

from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field, confloat, conint


class QueryIntentLabel(str, Enum):
    """High level intent categories for RAG queries."""

    FACTUAL = "factual"
    ANALYTICAL = "analytical"
    COMPARISON = "comparison"
    PROCEDURAL = "procedural"
    DEFINITION = "definition"
    OUT_OF_SCOPE = "out_of_scope"


class SensitivityLevel(str, Enum):
    """Document sensitivity classification levels."""

    PUBLIC = "public"
    INTERNAL = "internal"
    CONFIDENTIAL = "confidential"
    RESTRICTED = "restricted"


class QueryIntent(BaseModel):
    """Structured classification of a user query's intent."""

    label: QueryIntentLabel = Field(
        ...,
        description=(
            "Primary intent of the query. Use 'out_of_scope' if the query "
            "cannot be answered from the knowledge base."
        ),
    )
    confidence: confloat(ge=0.0, le=1.0) = Field(  # type: ignore[valid-type]
        ...,
        description="Model confidence in the assigned label, 0..1.",
    )
    rationale: str = Field(
        default="",
        description="One sentence explaining why this label was chosen.",
        max_length=500,
    )
    requires_clarification: bool = Field(
        default=False,
        description="True when the query is ambiguous and needs follow-up.",
    )


class RetrievalPlan(BaseModel):
    """A plan for how to retrieve documents for a query."""

    suggested_filters: List[str] = Field(
        default_factory=list,
        description=(
            "Filters that should be applied during retrieval. Each entry "
            "must be one of the caller-provided available filters."
        ),
        max_length=16,
    )
    expected_doc_types: List[str] = Field(
        default_factory=list,
        description="Document types most likely to contain the answer.",
        max_length=8,
    )
    top_k: conint(ge=1, le=50) = Field(  # type: ignore[valid-type]
        default=5,
        description="Recommended number of chunks to retrieve.",
    )
    reasoning: str = Field(
        default="",
        description="Short justification for the selected plan.",
        max_length=500,
    )


class CitedSource(BaseModel):
    """A single source supporting a generated answer."""

    source_id: str = Field(..., description="Unique identifier of the source.")
    quote: Optional[str] = Field(
        default=None,
        description="Short verbatim quote backing the claim (<= 280 chars).",
        max_length=280,
    )
    relevance: confloat(ge=0.0, le=1.0) = Field(  # type: ignore[valid-type]
        default=1.0,
        description="How relevant this source is to the answer, 0..1.",
    )


class CitedAnswer(BaseModel):
    """Final RAG answer with explicit citations and follow-up suggestions."""

    answer: str = Field(
        ...,
        description="Answer text. Must cite sources by id where applicable.",
    )
    sources: List[CitedSource] = Field(
        default_factory=list,
        description="Ordered list of sources used to generate the answer.",
        max_length=20,
    )
    confidence: confloat(ge=0.0, le=1.0) = Field(  # type: ignore[valid-type]
        ...,
        description="Model confidence that the answer is correct and grounded.",
    )
    follow_up_questions: List[str] = Field(
        default_factory=list,
        description="Suggested follow-up questions the user could ask next.",
        max_length=5,
    )
    refused: bool = Field(
        default=False,
        description="True when the model refused to answer (e.g. out of scope).",
    )


class DocumentClassification(BaseModel):
    """Structured classification of an uploaded document."""

    category: str = Field(
        ...,
        description="High level category, e.g. 'contract', 'policy', 'report'.",
        max_length=64,
    )
    tags: List[str] = Field(
        default_factory=list,
        description="Free-form tags that describe the document.",
        max_length=16,
    )
    language: str = Field(
        default="en",
        description="BCP-47 language code, e.g. 'en', 'fr', 'es'.",
        max_length=8,
    )
    sensitivity_level: SensitivityLevel = Field(
        default=SensitivityLevel.INTERNAL,
        description="Data sensitivity classification.",
    )
    summary: str = Field(
        default="",
        description="One to two sentence summary of the document.",
        max_length=500,
    )
