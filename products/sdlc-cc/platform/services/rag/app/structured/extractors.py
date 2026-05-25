"""High-level helpers that turn raw text into validated Pydantic models.

All functions in this module return ``None`` when structured outputs are
disabled or when the underlying call fails. Callers are expected to fall
back to the existing (string parsing) code paths in that case so the
feature can ship dark behind ``STRUCTURED_OUTPUTS_ENABLED``.
"""

from __future__ import annotations

import logging
from typing import Iterable, List, Mapping, Optional, Sequence

from .client import StructuredLLMClient, get_structured_client
from .models import (
    CitedAnswer,
    DocumentClassification,
    QueryIntent,
    RetrievalPlan,
)

logger = logging.getLogger(__name__)

_CLASSIFY_SYSTEM = (
    "You are a query classification engine for an enterprise RAG system. "
    "Classify the user's query into a single intent label and report your "
    "confidence. Use 'out_of_scope' for anything the knowledge base cannot "
    "reasonably answer."
)

_PLAN_SYSTEM = (
    "You are a retrieval planner for an enterprise RAG system. Given a query "
    "and a list of available filters, pick the filters, expected document "
    "types, and top_k most likely to surface the answer."
)

_ANSWER_SYSTEM = (
    "You are an enterprise RAG assistant. Answer ONLY using the provided "
    "context. Cite sources by id. If the context is insufficient, set "
    "refused=true and explain briefly in the answer field."
)

_CLASSIFY_DOC_SYSTEM = (
    "You classify enterprise documents. Assign a category, tags, language, "
    "sensitivity level, and a one or two sentence summary."
)


def _client() -> Optional[StructuredLLMClient]:
    return get_structured_client()


def classify_query(query: str) -> Optional[QueryIntent]:
    """Return a :class:`QueryIntent` for the query, or None on failure/disabled."""
    client = _client()
    if client is None:
        return None
    try:
        return client.create(
            response_model=QueryIntent,
            messages=[
                {"role": "system", "content": _CLASSIFY_SYSTEM},
                {"role": "user", "content": query},
            ],
            temperature=0.0,
            max_tokens=256,
        )
    except Exception as exc:  # pragma: no cover - defensive
        logger.warning("structured classify_query failed: %s", exc)
        return None


def plan_retrieval(
    query: str, available_filters: Sequence[str]
) -> Optional[RetrievalPlan]:
    """Produce a :class:`RetrievalPlan` bounded to the supplied filter set."""
    client = _client()
    if client is None:
        return None
    filters_str = ", ".join(available_filters) if available_filters else "(none)"
    user = (
        f"Query: {query}\n"
        f"Available filters: {filters_str}\n"
        "Return a retrieval plan using only the available filters."
    )
    try:
        plan = client.create(
            response_model=RetrievalPlan,
            messages=[
                {"role": "system", "content": _PLAN_SYSTEM},
                {"role": "user", "content": user},
            ],
            temperature=0.0,
            max_tokens=512,
        )
        # Enforce filter allow-list defensively.
        allow = set(available_filters)
        plan.suggested_filters = [f for f in plan.suggested_filters if f in allow]
        return plan
    except Exception as exc:  # pragma: no cover - defensive
        logger.warning("structured plan_retrieval failed: %s", exc)
        return None


def generate_cited_answer(
    query: str,
    context: str,
    sources: Iterable[Mapping[str, str]],
) -> Optional[CitedAnswer]:
    """Generate a :class:`CitedAnswer` grounded in ``context`` and ``sources``."""
    client = _client()
    if client is None:
        return None
    source_list: List[Mapping[str, str]] = list(sources)
    source_block = "\n".join(
        f"- id={s.get('id', '?')}: {s.get('title', '')}" for s in source_list
    )
    user = (
        f"Question: {query}\n\n"
        f"Context:\n{context}\n\n"
        f"Known sources:\n{source_block or '(none)'}\n\n"
        "Write an answer and cite the sources you used."
    )
    try:
        return client.create(
            response_model=CitedAnswer,
            messages=[
                {"role": "system", "content": _ANSWER_SYSTEM},
                {"role": "user", "content": user},
            ],
            temperature=0.1,
            max_tokens=1024,
        )
    except Exception as exc:  # pragma: no cover - defensive
        logger.warning("structured generate_cited_answer failed: %s", exc)
        return None


def classify_document(text: str) -> Optional[DocumentClassification]:
    """Classify a document body and return a :class:`DocumentClassification`."""
    client = _client()
    if client is None:
        return None
    snippet = text[:4000]
    try:
        return client.create(
            response_model=DocumentClassification,
            messages=[
                {"role": "system", "content": _CLASSIFY_DOC_SYSTEM},
                {"role": "user", "content": snippet},
            ],
            temperature=0.0,
            max_tokens=512,
        )
    except Exception as exc:  # pragma: no cover - defensive
        logger.warning("structured classify_document failed: %s", exc)
        return None
