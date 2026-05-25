"""
Context Assembly Sorting

Chunk sorting strategies for different assembly approaches.
"""

from typing import List

from app.services.query_understanding_service import QueryIntent

from .models import AssemblyRequest, AssemblyStrategy, ContextChunk

# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def sort_chunks_by_strategy(
    chunks: List[ContextChunk], request: AssemblyRequest
) -> List[ContextChunk]:
    """Sort chunks based on assembly strategy."""
    strategy = request.assembly_strategy

    if strategy == AssemblyStrategy.SEQUENTIAL:
        return chunks
    elif strategy == AssemblyStrategy.IMPORTANCE_WEIGHTED:
        return sorted(chunks, key=lambda x: x.importance_score, reverse=True)
    elif strategy == AssemblyStrategy.DIVERSITY_OPTIMIZED:
        return _sort_by_diversity(chunks)
    elif strategy == AssemblyStrategy.COHERENCE_FOCUSED:
        return sorted(chunks, key=lambda x: x.coherence_score, reverse=True)
    elif strategy == AssemblyStrategy.CITATION_AWARE:
        return _sort_by_citation_importance(chunks)
    elif strategy == AssemblyStrategy.HIERARCHICAL:
        return _sort_hierarchically(chunks)
    elif strategy == AssemblyStrategy.ADAPTIVE:
        return _adaptive_sorting(chunks, request)
    else:
        return sorted(chunks, key=lambda x: x.importance_score, reverse=True)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _content_similarity(content1: str, content2: str) -> float:
    """Simple word-overlap similarity (0-1)."""
    words1 = set(content1.lower().split())
    words2 = set(content2.lower().split())
    if not words1 or not words2:
        return 0.0
    intersection = len(words1.intersection(words2))
    union = len(words1.union(words2))
    return intersection / union if union > 0 else 0.0


def _sort_by_diversity(chunks: List[ContextChunk]) -> List[ContextChunk]:
    if not chunks:
        return chunks

    sorted_chunks = [chunks[0]]
    remaining = chunks[1:]

    while remaining:
        best_chunk = None
        best_score = -1

        for chunk in remaining:
            min_sim = min(
                _content_similarity(
                    chunk.processed_content, sc.processed_content
                )
                for sc in sorted_chunks
            )
            diversity_score = chunk.importance_score * (1 - min_sim)
            if diversity_score > best_score:
                best_score = diversity_score
                best_chunk = chunk

        if best_chunk:
            sorted_chunks.append(best_chunk)
            remaining.remove(best_chunk)
        else:
            break

    return sorted_chunks


def _sort_by_citation_importance(
    chunks: List[ContextChunk],
) -> List[ContextChunk]:

    def _score(chunk: ContextChunk) -> float:
        ci = chunk.citation_info
        score = chunk.importance_score * 0.5
        source = ci.get("source", "").lower()
        if any(t in source for t in ["academic", "journal", "peer"]):
            score += 0.3
        pub_date = ci.get("publication_date", "")
        if pub_date and "202" in pub_date:
            score += 0.1
        return score

    return sorted(chunks, key=_score, reverse=True)


def _sort_hierarchically(
    chunks: List[ContextChunk],
) -> List[ContextChunk]:
    overview_chunks = []
    detail_chunks = []
    indicators = [
        "introduction", "overview", "summary", "background",
        "definition", "concept", "principle", "theory",
    ]

    for chunk in chunks:
        content = chunk.processed_content.lower()
        if any(ind in content for ind in indicators):
            overview_chunks.append(chunk)
        else:
            detail_chunks.append(chunk)

    overview_chunks.sort(key=lambda x: x.importance_score, reverse=True)
    detail_chunks.sort(key=lambda x: x.importance_score, reverse=True)
    return overview_chunks + detail_chunks


def _adaptive_sorting(
    chunks: List[ContextChunk], request: AssemblyRequest
) -> List[ContextChunk]:
    if not request.query_analysis:
        return sorted(chunks, key=lambda x: x.importance_score, reverse=True)

    intent = request.query_analysis.intent
    if intent == QueryIntent.COMPARISON:
        return _sort_for_comparison(chunks)
    elif intent == QueryIntent.DEFINITION:
        return _sort_for_definition(chunks)
    elif intent == QueryIntent.PROCEDURAL:
        return _sort_for_procedural(chunks)
    elif intent == QueryIntent.ANALYSIS:
        return _sort_for_analysis(chunks)
    return sorted(chunks, key=lambda x: x.importance_score, reverse=True)


def _word_boost_sort(chunks, words, weight=0.1, extra_fn=None):
    """Generic word-boost sort helper."""
    def _score(c):
        ct = c.processed_content.lower()
        cnt = sum(1 for w in words if w in ct)
        extra = extra_fn(c, ct) if extra_fn else 0
        return c.importance_score + cnt * weight + extra
    return sorted(chunks, key=_score, reverse=True)


def _sort_for_comparison(chunks):
    return _word_boost_sort(chunks, [
        "versus", "compare", "difference", "while", "however",
        "although", "whereas", "unlike", "similar", "contrast",
    ])


def _sort_for_definition(chunks):
    words = ["define", "definition", "meaning", "refers to",
             "is a", "can be defined as", "the term", "concept"]
    def extra(c, _ct):
        return 0.0 if len(c.processed_content) >= 500 else 0.05
    return _word_boost_sort(chunks, words, 0.15, extra)


def _sort_for_procedural(chunks):
    words = ["step", "first", "then", "next", "finally", "procedure",
             "process", "method", "how to", "guide", "instruction"]
    def extra(_c, ct):
        return 0.3 if any(f"{i}." in ct for i in range(1, 10)) else 0
    return _word_boost_sort(chunks, words, 0.1, extra)


def _sort_for_analysis(chunks):
    words = ["analysis", "examine", "evaluate", "assess", "consider",
             "factor", "impact", "effect", "relationship", "correlation"]
    data = ["%", "$", "data", "statistics", "study", "research"]
    def extra(_c, ct):
        return sum(1 for d in data if d in ct) * 0.05
    return _word_boost_sort(chunks, words, 0.1, extra)
