"""
Retrieval Fallback

Fallback retrieval strategy when main retrieval fails.
"""

import logging

from app.services.vector_search_service import (
    SearchQuery, RankingStrategy, SearchMode,
)

from .models import (
    RetrievalRequest, RetrievalResult,
    RetrievalStrategy, RetrievalStage,
)
from .stages import _result_to_candidate

logger = logging.getLogger(__name__)


async def fallback_retrieval(
    request: RetrievalRequest, vector_search_service
) -> RetrievalResult:
    """Fallback retrieval when main retrieval fails."""
    logger.warning("Using fallback retrieval strategy")
    try:
        sq = SearchQuery(
            text=request.query_text,
            filters={"tenant_id": request.tenant_id}
            if request.tenant_id
            else {},
            limit=request.max_chunks,
            ranking_strategy=RankingStrategy.HYBRID_SEMANTIC_KEYWORD,
            search_mode=SearchMode.FAST,
            min_relevance_score=0.1,
            tenant_id=request.tenant_id,
        )
        results, _ = await vector_search_service.search(sq)
        cands = [
            _result_to_candidate(
                r, request, "fallback_retrieval",
                RetrievalStage.BROAD_RETRIEVAL,
            )
            for r in results
        ]
        return RetrievalResult(
            candidates=cands[: request.max_chunks],
            query_understanding=request.query_analysis,
            retrieval_strategy=RetrievalStrategy.HYBRID_FUSION,
            total_candidates_evaluated=len(results),
            retrieval_time_ms=0, reranking_time_ms=0,
            diversity_time_ms=0, total_time_ms=0,
            coverage_estimate=0.5,
            quality_metrics={"fallback_used": True},
            strategy_performance={"fallback": True},
            selected_chunks=[
                c.chunk for c in cands[: request.max_chunks]
            ],
        )
    except Exception as e:
        logger.error(f"Fallback retrieval failed: {e}")
        return RetrievalResult(
            candidates=[],
            query_understanding=request.query_analysis,
            retrieval_strategy=RetrievalStrategy.HYBRID_FUSION,
            total_candidates_evaluated=0,
            retrieval_time_ms=0, reranking_time_ms=0,
            diversity_time_ms=0, total_time_ms=0,
            coverage_estimate=0,
            quality_metrics={"error": str(e)},
            strategy_performance={"error": True},
            selected_chunks=[],
        )
