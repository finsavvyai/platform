"""
Context Assembly Scoring

Authority, recency, query relevance, and coherence scoring.
"""

import re
from datetime import datetime

from app.models.document import DocumentChunk
from app.services.query_understanding_service import QueryAnalysis, QueryIntent


def get_authority_score(chunk: DocumentChunk) -> float:
    """Get authority score for a chunk (0-1)."""
    metadata = chunk.metadata or {}
    score = 0.5

    source_type = metadata.get("source_type", "").lower()
    if source_type == "peer_reviewed":
        score += 0.4
    elif source_type == "academic":
        score += 0.3
    elif source_type == "official":
        score += 0.2

    citation_count = metadata.get("citation_count", 0)
    if citation_count > 100:
        score += 0.2
    elif citation_count > 10:
        score += 0.1

    if metadata.get("author_verified"):
        score += 0.1

    return min(score, 1.0)


def get_recency_score(chunk: DocumentChunk) -> float:
    """Get recency score for a chunk (0-1)."""
    metadata = chunk.metadata or {}

    if metadata.get("is_recent"):
        return 1.0

    year = metadata.get("publication_year")
    if year:
        current_year = datetime.now().year
        age = current_year - year
        if age < 1:
            return 1.0
        elif age < 3:
            return 0.8
        elif age < 5:
            return 0.6
        elif age < 10:
            return 0.4
        else:
            return 0.2

    return 0.5


def calculate_query_relevance(
    chunk: DocumentChunk, query_analysis: QueryAnalysis
) -> float:
    """Calculate query relevance for a chunk (0-1)."""
    content_lower = chunk.content.lower()
    score = 0.0

    query_keywords = query_analysis.keywords or []
    keyword_matches = sum(
        1 for kw in query_keywords if kw.lower() in content_lower
    )
    if query_keywords:
        score += (keyword_matches / len(query_keywords)) * 0.4

    query_entities = query_analysis.entities or []
    entity_matches = sum(
        1 for e in query_entities if e.text.lower() in content_lower
    )
    if query_entities:
        score += (entity_matches / len(query_entities)) * 0.3

    intent = query_analysis.intent
    if intent == QueryIntent.DEFINITION:
        if any(
            w in content_lower
            for w in ["define", "definition", "meaning", "refers to"]
        ):
            score += 0.2
    elif intent == QueryIntent.PROCEDURAL:
        if any(
            w in content_lower
            for w in ["step", "process", "procedure", "method"]
        ):
            score += 0.2
    elif intent == QueryIntent.COMPARISON:
        if any(
            w in content_lower
            for w in ["versus", "compare", "difference", "while"]
        ):
            score += 0.2

    return min(score, 1.0)


def calculate_coherence_score(content: str) -> float:
    """Calculate coherence score for content (0-1)."""
    sentences = re.split(r"[.!?]+", content)
    sentences = [s.strip() for s in sentences if s.strip()]

    if len(sentences) < 2:
        return 0.5

    avg_len = sum(len(s.split()) for s in sentences) / len(sentences)
    length_score = 1.0 if 10 <= avg_len <= 25 else 0.5

    transition_words = [
        "however", "therefore", "moreover", "furthermore",
        "consequently", "additionally", "nevertheless",
        "meanwhile", "likewise", "similarly",
    ]
    t_count = sum(1 for w in transition_words if w in content.lower())
    transition_score = min(t_count / len(sentences), 1.0)

    connectors = ["because", "since", "so", "thus", "hence", "thereby"]
    c_count = sum(1 for c in connectors if c in content.lower())
    connector_score = min(c_count / len(sentences), 1.0)

    return (length_score + transition_score + connector_score) / 3
