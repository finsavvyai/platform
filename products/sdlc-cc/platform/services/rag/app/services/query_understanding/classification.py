"""
Query Classification

Intent detection, complexity assessment, and query type classification.
"""

import re
from typing import List, Tuple

from .models import (
    QueryIntent,
    QueryComplexity,
    QueryType,
    QueryEntity,
)


def classify_intent(query: str) -> Tuple[QueryIntent, float]:
    """Classify query intent."""
    ql = query.lower()

    question_patterns = [
        r"\b(what|who|where|when|why|how|which|whose)\b",
        r"\?$",
        r"\b(can|could|would|should|is|are|do|does|did)\b.*\?$",
    ]
    command_patterns = [
        r"\b(show|find|get|list|search|look for|give me)\b",
        r"\b(create|update|delete|modify|change)\b",
    ]
    comparison_patterns = [
        r"\b(compare|versus|vs|difference|better|worse)\b",
    ]
    definition_patterns = [
        r"\b(define|definition|meaning|what is|what are)\b",
    ]
    procedural_patterns = [
        r"\b(how to|steps|process|procedure|guide)\b",
    ]

    scores = {}
    scores[QueryIntent.QUESTION] = sum(
        1 for p in question_patterns if re.search(p, ql, re.IGNORECASE)
    )
    scores[QueryIntent.COMMAND] = sum(
        1 for p in command_patterns if re.search(p, ql, re.IGNORECASE)
    )
    scores[QueryIntent.COMPARISON] = sum(
        1 for p in comparison_patterns if re.search(p, ql, re.IGNORECASE)
    )
    scores[QueryIntent.DEFINITION] = sum(
        1 for p in definition_patterns if re.search(p, ql, re.IGNORECASE)
    )
    scores[QueryIntent.PROCEDURAL] = sum(
        1 for p in procedural_patterns if re.search(p, ql, re.IGNORECASE)
    )
    scores[QueryIntent.SEARCH] = 0.1

    best = max(scores, key=scores.get)
    confidence = min(scores[best] / 3.0, 1.0)
    if confidence < 0.3:
        best = QueryIntent.SEARCH
        confidence = 0.5
    return best, confidence


def assess_complexity(
    query: str, entities: List[QueryEntity]
) -> QueryComplexity:
    """Assess query complexity."""
    score = 0
    wc = len(query.split())
    if wc > 20: score += 3
    elif wc > 10: score += 2
    elif wc > 5: score += 1
    score += min(len(entities), 3)
    if "?" in query: score += 1
    conjs = ["and", "or", "but", "while", "although", "however"]
    score += sum(1 for c in conjs if c in query.lower())
    techs = ["algorithm", "implementation", "architecture", "framework", "methodology", "optimization"]
    score += sum(1 for t in techs if t in query.lower())
    if score <= 2: return QueryComplexity.SIMPLE
    if score <= 5: return QueryComplexity.MODERATE
    if score <= 8: return QueryComplexity.COMPLEX
    return QueryComplexity.EXPERT


def classify_query_type(query: str, intent: QueryIntent) -> QueryType:
    """Classify query type."""
    ql = query.lower()
    temporal = ["when", "time", "date", "duration", "before", "after", "recent", "latest"]
    if any(w in ql for w in temporal): return QueryType.TEMPORAL
    spatial = ["where", "location", "place", "area", "region", "near"]
    if any(w in ql for w in spatial): return QueryType.SPATIAL
    causal = ["why", "because", "cause", "reason", "result", "effect", "impact"]
    if any(w in ql for w in causal): return QueryType.CAUSAL
    comp = ["compare", "versus", "vs", "difference", "better", "worse"]
    if any(w in ql for w in comp): return QueryType.COMPARATIVE
    if intent in [QueryIntent.QUESTION, QueryIntent.DEFINITION, QueryIntent.SEARCH]:
        return QueryType.FACTUAL
    conceptual = ["concept", "theory", "principle", "understand", "explain", "meaning"]
    if any(w in ql for w in conceptual): return QueryType.CONCEPTUAL
    mapping = {
        QueryIntent.PROCEDURAL: QueryType.PROCEDURAL,
        QueryIntent.ANALYSIS: QueryType.CONCEPTUAL,
        QueryIntent.RECOMMENDATION: QueryType.OPINION,
    }
    return mapping.get(intent, QueryType.FACTUAL)
