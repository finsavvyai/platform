"""
Retrieval Reranking

Intent-specific reranking strategies and diversification.
"""

import logging
from collections import defaultdict
from typing import List, Dict, Any

from app.services.query_understanding_service import QueryIntent

from .models import (
    RetrievalRequest,
    RetrievalCandidate,
    RetrievalStage,
)

logger = logging.getLogger(__name__)


async def apply_reranking(
    candidates: List[RetrievalCandidate],
    request: RetrievalRequest,
) -> List[RetrievalCandidate]:
    """Apply advanced reranking to candidates."""
    if not candidates:
        return candidates
    try:
        if request.query_analysis:
            intent = request.query_analysis.intent
            if intent == QueryIntent.COMPARISON:
                return _rerank_comparison(candidates)
            elif intent == QueryIntent.DEFINITION:
                return _rerank_definition(candidates)
            elif intent == QueryIntent.PROCEDURAL:
                return _rerank_procedural(candidates)
            elif intent == QueryIntent.ANALYSIS:
                return _rerank_analysis(candidates)
        return sorted(candidates, key=lambda x: x.final_score, reverse=True)
    except Exception as e:
        logger.error(f"Reranking failed: {e}")
        return candidates


async def apply_diversification(
    candidates: List[RetrievalCandidate],
    request: RetrievalRequest,
) -> List[RetrievalCandidate]:
    """Apply diversification to ensure result variety."""
    if len(candidates) <= request.max_chunks:
        return candidates
    try:
        diverse = []
        remaining = candidates.copy()
        if remaining:
            diverse.append(remaining.pop(0))
        while len(diverse) < request.max_chunks and remaining:
            best = None
            best_mmr = -1
            for c in remaining:
                rel = c.final_score
                max_sim = max(
                    (content_similarity(c.chunk.content, s.chunk.content) for s in diverse),
                    default=0,
                )
                mmr = request.diversity_threshold * rel - (1 - request.diversity_threshold) * max_sim
                if mmr > best_mmr:
                    best_mmr = mmr
                    best = c
            if best:
                diverse.append(best)
                remaining.remove(best)
                best.metadata["mmr_score"] = best_mmr
            else:
                break
        return diverse
    except Exception as e:
        logger.error(f"Diversification failed: {e}")
        return candidates[:request.max_chunks]


def content_similarity(content1: str, content2: str) -> float:
    """Simple Jaccard word overlap similarity."""
    w1 = set(content1.lower().split())
    w2 = set(content2.lower().split())
    if not w1 or not w2:
        return 0.0
    return len(w1 & w2) / len(w1 | w2)


def fusion_retrieval(
    candidates: List[RetrievalCandidate],
    request: RetrievalRequest,
) -> List[RetrievalCandidate]:
    """Fuse multiple retrieval methods."""
    try:
        groups: Dict[str, list] = defaultdict(list)
        for c in candidates:
            groups[c.chunk.id].append(c)

        method_weights = {
            "dense_vector_search": 1.0,
            "sparse_keyword_search": 0.8,
            "broad_vector_search": 0.7,
            "focused_vector_search": 0.9,
            "cross_encoder_reranking": 1.2,
        }

        fused = []
        for chunk_id, group in groups.items():
            tw = 0
            ws = 0
            methods = set()
            meta: Dict[str, Any] = {}
            for c in group:
                w = method_weights.get(c.retrieval_method, 1.0)
                ws += c.final_score * w
                tw += w
                methods.add(c.retrieval_method)
                meta.update(c.metadata)
            score = ws / tw if tw > 0 else sum(c.final_score for c in group) / len(group)
            fused.append(RetrievalCandidate(
                chunk=group[0].chunk, raw_score=score,
                relevance_score=max(c.relevance_score for c in group),
                authority_score=max(c.authority_score for c in group),
                recency_score=max(c.recency_score for c in group),
                diversity_score=max(c.diversity_score for c in group),
                personalized_score=max(c.personalized_score for c in group),
                final_score=score,
                retrieval_method=f"fusion({','.join(methods)})",
                stage_obtained=RetrievalStage.REFINEMENT,
                metadata={**meta, "fusion_methods": list(methods)},
            ))
        fused.sort(key=lambda x: x.final_score, reverse=True)
        return fused
    except Exception as e:
        logger.error(f"Fusion retrieval failed: {e}")
        return candidates


def _rerank_comparison(candidates):
    words = ["versus", "compared", "difference", "whereas", "however", "while", "although", "unlike", "similar", "contrast"]
    for c in candidates:
        ct = c.chunk.content.lower()
        cnt = sum(1 for w in words if w in ct)
        if cnt > 0:
            c.final_score += min(cnt * 0.1, 0.5)
        if "table" in ct or "list" in ct or any(f"{i}." in ct for i in range(1, 10)):
            c.final_score += 0.2
    return sorted(candidates, key=lambda x: x.final_score, reverse=True)


def _rerank_definition(candidates):
    patterns = ["is defined as", "refers to", "means", "definition", "the term", "can be described as", "is a type of"]
    for c in candidates:
        ct = c.chunk.content.lower()
        cnt = sum(1 for p in patterns if p in ct)
        if cnt > 0:
            c.final_score += min(cnt * 0.15, 0.6)
        if len(c.chunk.content) < 500:
            c.final_score += (500 - len(c.chunk.content)) / 1000
    return sorted(candidates, key=lambda x: x.final_score, reverse=True)


def _rerank_procedural(candidates):
    words = ["step", "first", "then", "next", "finally", "procedure", "process", "method", "how to", "guide", "instruction"]
    for c in candidates:
        ct = c.chunk.content.lower()
        cnt = sum(1 for w in words if w in ct)
        if cnt > 0:
            c.final_score += min(cnt * 0.1, 0.5)
        if any(f"{i}." in ct for i in range(1, 10)):
            c.final_score += 0.3
    return sorted(candidates, key=lambda x: x.final_score, reverse=True)


def _rerank_analysis(candidates):
    words = ["analysis", "examine", "evaluate", "assess", "consider", "factor", "impact", "effect", "relationship", "correlation"]
    data = ["%", "$", "data", "statistics", "study", "research"]
    for c in candidates:
        ct = c.chunk.content.lower()
        cnt = sum(1 for w in words if w in ct)
        if cnt > 0:
            c.final_score += min(cnt * 0.1, 0.4)
        dc = sum(1 for d in data if d in ct)
        if dc > 0:
            c.final_score += min(dc * 0.05, 0.3)
    return sorted(candidates, key=lambda x: x.final_score, reverse=True)
