"""Bridge between the structured LLM classifier and query understanding.

Exposes :func:`maybe_classify_intent` which, when the global structured
outputs feature flag is on, asks the Instructor-backed classifier for an
intent label and maps it onto the service-level :class:`QueryIntent` enum.
Returns ``None`` when the feature is disabled or when the call fails, so
callers can fall back to the heuristic classifier.
"""

from __future__ import annotations

import logging
from typing import Optional, Tuple

from .models import QueryIntent

logger = logging.getLogger(__name__)

try:  # pragma: no cover - optional dependency
    from app.structured import (
        classify_query as _structured_classify_query,
        is_structured_enabled as _structured_enabled,
    )
except Exception:  # pragma: no cover - defensive
    _structured_classify_query = None  # type: ignore[assignment]

    def _structured_enabled() -> bool:  # type: ignore[misc]
        return False


_INTENT_MAP = {
    "factual": QueryIntent.QUESTION,
    "analytical": QueryIntent.ANALYSIS,
    "comparison": QueryIntent.COMPARISON,
    "procedural": QueryIntent.PROCEDURAL,
    "definition": QueryIntent.DEFINITION,
    "out_of_scope": QueryIntent.SEARCH,
}


def maybe_classify_intent(query: str) -> Optional[Tuple[QueryIntent, float]]:
    """Return a structured (intent, confidence) pair when enabled, else None."""
    if not _structured_enabled() or _structured_classify_query is None:
        return None
    try:
        result = _structured_classify_query(query)
    except Exception as exc:  # pragma: no cover - defensive
        logger.debug("structured intent classification failed: %s", exc)
        return None
    if result is None:
        return None
    mapped = _INTENT_MAP.get(result.label.value)
    if mapped is None:
        return None
    return mapped, float(result.confidence)
