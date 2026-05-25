"""Structured LLM outputs for the RAG service.

This package wraps the `instructor` library to provide validated Pydantic
models as LLM output, replacing fragile JSON string parsing. All features
here are opt-in via the ``STRUCTURED_OUTPUTS_ENABLED`` environment variable.
"""

from .models import (
    CitedAnswer,
    CitedSource,
    DocumentClassification,
    QueryIntent,
    QueryIntentLabel,
    RetrievalPlan,
    SensitivityLevel,
)
from .client import (
    get_structured_client,
    is_structured_enabled,
    StructuredLLMClient,
)
from .extractors import (
    classify_query,
    plan_retrieval,
    generate_cited_answer,
)

__all__ = [
    "CitedAnswer",
    "CitedSource",
    "DocumentClassification",
    "QueryIntent",
    "QueryIntentLabel",
    "RetrievalPlan",
    "SensitivityLevel",
    "StructuredLLMClient",
    "get_structured_client",
    "is_structured_enabled",
    "classify_query",
    "plan_retrieval",
    "generate_cited_answer",
]
