"""Context Retrieval Service — orchestrates multi-stage retrieval."""

import logging
from datetime import datetime
from typing import Dict, Any

from sentence_transformers import CrossEncoder
from sklearn.feature_extraction.text import TfidfVectorizer

from app.core.config import get_settings
from app.services.vector_search_service import (
    SearchQuery, RankingStrategy, SearchMode,
)
from app.services.hybrid_search import HybridSearcher, HybridSearchConfig, ScoredResult

from .models import (
    RetrievalStrategy, RetrievalStage,
    RetrievalRequest, RetrievalResult,
)
from .stages import (
    broad_retrieval_stage, focused_retrieval_stage,
    refinement_stage, _result_to_candidate,
)
from .reranking import apply_reranking, apply_diversification, fusion_retrieval
from .fallback import fallback_retrieval

logger = logging.getLogger(__name__)
settings = get_settings()


class ContextRetrievalService:
    """Advanced context retrieval service"""

    def __init__(self, document_repository, vector_search_service, query_understanding_service):
        self.document_repository = document_repository
        self.vector_search_service = vector_search_service
        self.query_understanding_service = query_understanding_service
        self._cross_encoder = None
        self._tfidf_vectorizer = None
        self._retrieval_cache: Dict[int, Any] = {}
        self._user_profiles: Dict[str, Dict[str, Any]] = {}
        self._hybrid_searcher = HybridSearcher(HybridSearchConfig.from_env())
        self._initialize_models()
        logger.info("Context Retrieval Service initialized")

    def _initialize_models(self):
        try:
            self._cross_encoder = CrossEncoder("ms-marco-MiniLM-L-6-v2")
            self._tfidf_vectorizer = TfidfVectorizer(
                max_features=5000, stop_words="english",
                ngram_range=(1, 3), min_df=2, max_df=0.8, sublinear_tf=True,
            )
        except Exception as e:
            logger.error(f"Failed to initialize retrieval models: {e}")

    async def retrieve_context(self, request: RetrievalRequest) -> RetrievalResult:
        start = datetime.now()
        try:
            if not request.query_analysis:
                request.query_analysis = await self.query_understanding_service.analyze_query(
                    request.query_text, request.user_context, use_expansion=True)
            candidates = await self._perform_retrieval(request)
            reranked = await apply_reranking(candidates, request)
            diversified = await apply_diversification(reranked, request)
            personalized = await self._apply_personalization(diversified, request)
            selected = [c.chunk for c in personalized[:request.max_chunks]]
            t = (datetime.now() - start).total_seconds() * 1000
            result = RetrievalResult(
                candidates=personalized[:request.max_chunks],
                query_understanding=request.query_analysis,
                retrieval_strategy=request.retrieval_strategy,
                total_candidates_evaluated=len(candidates),
                retrieval_time_ms=t, reranking_time_ms=0, diversity_time_ms=0, total_time_ms=t,
                coverage_estimate=self._estimate_coverage(selected, request),
                quality_metrics=self._calc_quality(selected),
                strategy_performance={"initial": len(candidates), "final": len(personalized)},
                selected_chunks=selected)
            self._cache(request, result)
            return result
        except Exception as e:
            logger.error(f"Context retrieval failed: {e}")
            return await fallback_retrieval(request, self.vector_search_service)

    async def _perform_retrieval(self, request):
        candidates = []
        bf = self._build_filters
        if request.retrieval_strategy == RetrievalStrategy.MULTI_STAGE:
            bc = await broad_retrieval_stage(request, self.vector_search_service, bf)
            candidates.extend(bc)
            if bc:
                candidates.extend(await focused_retrieval_stage(bc, request, self.vector_search_service, bf))
            if candidates:
                candidates.extend(await refinement_stage(candidates, request, self._cross_encoder))
        elif request.retrieval_strategy == RetrievalStrategy.HYBRID_FUSION:
            dc = await self._search(request, RankingStrategy.SEMANTIC_ONLY, SearchMode.ACCURATE, "dense")
            sc = await self._search(request, RankingStrategy.HYBRID_SEMANTIC_KEYWORD, SearchMode.FAST, "sparse")
            candidates = fusion_retrieval(dc + sc, request)
        elif request.retrieval_strategy == RetrievalStrategy.HYBRID_RRF:
            candidates = await self._hybrid_rrf_retrieval(request)
        else:
            candidates = await self._search(request, RankingStrategy.SEMANTIC_ONLY, SearchMode.ACCURATE, "dense")
        seen, unique = set(), []
        for c in candidates:
            if c.chunk.id not in seen:
                seen.add(c.chunk.id)
                unique.append(c)
        return unique[:request.max_chunks * 3]

    async def _hybrid_rrf_retrieval(self, request):
        """Run hybrid search with RRF fusion."""
        dense_candidates = await self._search(
            request, RankingStrategy.SEMANTIC_ONLY, SearchMode.ACCURATE, "dense")
        dense_scored = [
            ScoredResult(
                doc_id=c.chunk.id, score=c.raw_score, content=c.chunk.content,
                metadata=c.chunk.metadata, chunk_id=c.chunk.id,
                document_id=c.chunk.document_id, source="dense",
            ) for c in dense_candidates
        ]
        corpus = [
            {"doc_id": c.chunk.id, "content": c.chunk.content,
             "metadata": c.chunk.metadata, "chunk_id": c.chunk.id,
             "document_id": c.chunk.document_id}
            for c in dense_candidates
        ]
        fused = await self._hybrid_searcher.search(
            query=request.query_text, dense_results=dense_scored,
            corpus_chunks=corpus, top_k=request.max_chunks * 3)
        fused_map = {r.chunk_id or r.doc_id: r for r in fused}
        reordered = []
        for c in dense_candidates:
            if c.chunk.id in fused_map:
                c.final_score = fused_map[c.chunk.id].score
                reordered.append(c)
        reordered.sort(key=lambda x: x.final_score, reverse=True)
        return reordered

    async def _search(self, request, ranking, mode, method):
        text = request.query_text
        if method == "sparse" and request.query_analysis:
            text = " ".join(request.query_analysis.keywords)
        sq = SearchQuery(
            text=text, filters=self._build_filters(request), limit=request.max_chunks * 2,
            ranking_strategy=ranking, search_mode=mode,
            min_relevance_score=request.min_relevance_score if method == "dense" else 0.1,
            tenant_id=request.tenant_id, user_id=request.user_id)
        results, _ = await self.vector_search_service.search(sq)
        return [_result_to_candidate(r, request, f"{method}_vector_search", RetrievalStage.BROAD_RETRIEVAL) for r in results]

    async def _apply_personalization(self, candidates, request):
        if not request.user_context or not request.personalization_enabled:
            return candidates
        try:
            profile = self._user_profiles.get(request.user_id, {"preferred_topics": [], "preferred_sources": [], "preferred_content_types": ["text"]})
            for c in candidates:
                ut = profile.get("preferred_topics", [])
                ct = c.chunk.metadata.get("topics", [])
                ps = 0.3 * min(len(set(ut) & set(ct)) / max(len(ut), 1), 1.0) if ut else 0
                if c.chunk.metadata.get("source") in profile.get("preferred_sources", []): ps += 0.2
                c.personalized_score = min(ps, 1.0)
                c.final_score += 0.2 * c.personalized_score
            return sorted(candidates, key=lambda x: x.final_score, reverse=True)
        except Exception:
            return candidates

    def _build_filters(self, request):
        f: Dict[str, Any] = {}
        if request.tenant_id: f["tenant_id"] = request.tenant_id
        if request.content_type_filters: f["content_type"] = request.content_type_filters
        if request.language_filters: f["language"] = request.language_filters
        if request.source_filters: f["source"] = request.source_filters
        if request.temporal_filter: f.update(request.temporal_filter)
        return f

    def _calc_quality(self, chunks):
        if not chunks: return {}
        return {"avg_relevance": 0.8, "source_diversity": len(set(c.metadata.get("source", "?") for c in chunks)) / len(chunks)}

    def _estimate_coverage(self, chunks, request):
        if not chunks or not request.query_analysis: return 0.5
        qk = set(request.query_analysis.keywords)
        covered = set()
        for c in chunks: covered.update(qk & set(c.content.lower().split()))
        return len(covered) / len(qk) if qk else 0.5

    def _cache(self, request, result):
        h = hash(request.query_text.lower())
        self._retrieval_cache[h] = {"result": result, "timestamp": datetime.now()}
        if len(self._retrieval_cache) > 1000:
            oldest = min(self._retrieval_cache, key=lambda k: self._retrieval_cache[k]["timestamp"])
            del self._retrieval_cache[oldest]

    def get_service_metrics(self):
        return {
            "cache_size": len(self._retrieval_cache),
            "cross_encoder_loaded": self._cross_encoder is not None,
            "supported_strategies": [s.value for s in RetrievalStrategy],
        }
