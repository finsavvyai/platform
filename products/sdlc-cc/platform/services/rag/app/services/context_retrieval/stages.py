"""
Multi-Stage Retrieval

Broad, focused, and refinement retrieval stages.
"""

import logging
from collections import Counter
from datetime import datetime
from typing import List, Optional

from app.models.document import DocumentChunk
from app.services.query_understanding_service import QueryAnalysis
from app.services.vector_search_service import (
    SearchQuery, RankingStrategy, SearchMode,
)

from .models import (
    RetrievalRequest, RetrievalCandidate, RetrievalStage,
)

logger = logging.getLogger(__name__)


async def broad_retrieval_stage(
    request: RetrievalRequest, vector_search_service, build_base_filters_fn,
) -> List[RetrievalCandidate]:
    """Stage 1: Broad retrieval with relaxed constraints."""
    try:
        sq = SearchQuery(
            text=request.query_text,
            filters=build_base_filters_fn(request),
            limit=request.max_chunks * 5,
            ranking_strategy=RankingStrategy.HYBRID_SEMANTIC_KEYWORD,
            search_mode=SearchMode.BALANCED,
            min_relevance_score=0.1,
            diversity_threshold=0.0,
            tenant_id=request.tenant_id,
            user_id=request.user_id,
        )
        results, _ = await vector_search_service.search(sq)
        candidates = [
            _result_to_candidate(r, request, "broad_vector_search", RetrievalStage.BROAD_RETRIEVAL)
            for r in results
        ]
        logger.info(f"Broad retrieval: {len(candidates)} candidates")
        return candidates
    except Exception as e:
        logger.error(f"Broad retrieval stage failed: {e}")
        return []


async def focused_retrieval_stage(
    broad_candidates: List[RetrievalCandidate],
    request: RetrievalRequest,
    vector_search_service,
    build_base_filters_fn,
) -> List[RetrievalCandidate]:
    """Stage 2: Focused retrieval with refined constraints."""
    try:
        top = broad_candidates[:5]
        focus_terms = extract_focus_terms(top, request.query_analysis)
        focused_text = f"{request.query_text} {' '.join(focus_terms)}"
        filters = build_base_filters_fn(request)
        if focus_terms:
            filters["focus_terms"] = focus_terms

        sq = SearchQuery(
            text=focused_text, filters=filters,
            limit=request.max_chunks * 3,
            ranking_strategy=RankingStrategy.SEMANTIC_ONLY,
            search_mode=SearchMode.ACCURATE,
            min_relevance_score=0.3, diversity_threshold=0.5,
            tenant_id=request.tenant_id, user_id=request.user_id,
        )
        results, _ = await vector_search_service.search(sq)
        existing_ids = {c.chunk.id for c in broad_candidates}
        candidates = [
            _result_to_candidate(r, request, "focused_vector_search", RetrievalStage.FOCUSED_RETRIEVAL)
            for r in results if r.chunk_id not in existing_ids
        ]
        logger.info(f"Focused retrieval: {len(candidates)} additional candidates")
        return candidates
    except Exception as e:
        logger.error(f"Focused retrieval stage failed: {e}")
        return []


async def refinement_stage(
    candidates: List[RetrievalCandidate],
    request: RetrievalRequest,
    cross_encoder,
) -> List[RetrievalCandidate]:
    """Stage 3: Refinement with cross-encoder reranking."""
    try:
        if not cross_encoder:
            return []
        pairs = [[request.query_text, c.chunk.content] for c in candidates[:20]]
        if not pairs:
            return []
        scores = cross_encoder.predict(pairs)
        refined = []
        for i, c in enumerate(candidates[:len(scores)]):
            ce = float(scores[i])
            combined = 0.7 * c.final_score + 0.3 * ce
            rc = RetrievalCandidate(
                chunk=c.chunk, raw_score=c.raw_score,
                relevance_score=c.relevance_score, authority_score=c.authority_score,
                recency_score=c.recency_score, diversity_score=c.diversity_score,
                personalized_score=c.personalized_score, final_score=combined,
                retrieval_method="cross_encoder_reranking",
                stage_obtained=RetrievalStage.REFINEMENT,
                metadata={**c.metadata, "cross_encoder_score": ce, "original_score": c.final_score},
            )
            refined.append(rc)
        return refined
    except Exception as e:
        logger.error(f"Refinement stage failed: {e}")
        return []


def extract_focus_terms(
    candidates: List[RetrievalCandidate],
    query_analysis: Optional[QueryAnalysis],
) -> List[str]:
    """Extract focus terms from top candidates."""
    terms = []
    if query_analysis:
        terms.extend(query_analysis.keywords[:5])
        terms.extend([e.text for e in query_analysis.entities[:3]])
    for c in candidates[:3]:
        wf = Counter(c.chunk.content.lower().split())
        terms.extend([w for w, _ in wf.most_common(3)])
    return list(set(terms))[:10]


def _result_to_candidate(result, request, method, stage):
    return RetrievalCandidate(
        chunk=DocumentChunk(
            id=result.chunk_id, document_id=result.document_id,
            content=result.content, metadata=result.metadata,
            created_at=datetime.now(), tenant_id=request.tenant_id or "",
        ),
        raw_score=result.score, relevance_score=result.relevance_score,
        authority_score=result.authority_score, recency_score=result.recency_score,
        diversity_score=result.diversity_score, personalized_score=result.personalized_score,
        final_score=result.final_score, retrieval_method=method,
        stage_obtained=stage, metadata={"search_rank": result.rank},
    )
