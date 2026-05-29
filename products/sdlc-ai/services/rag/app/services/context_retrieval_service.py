"""
Context Retrieval Service

Advanced multi-stage context retrieval with sophisticated reranking algorithms,
cross-encoder scoring, diversity-aware selection, and personalized retrieval strategies.
"""

import asyncio
import logging
import math
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple, Set
from enum import Enum
from dataclasses import dataclass, field
import json
import numpy as np
from collections import defaultdict, Counter

from sentence_transformers import CrossEncoder
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from app.core.config import get_settings
from app.models.document import DocumentChunk, DocumentStatus
from app.repositories.document import DocumentRepository
from app.services.query_understanding_service import (
    QueryUnderstandingService,
    QueryAnalysis,
    QueryIntent,
    QueryContext,
)
from app.services.vector_search_service import (
    VectorSearchService,
    SearchQuery,
    SearchResult,
    RankingStrategy,
    SearchMode,
)

logger = logging.getLogger(__name__)
settings = get_settings()


class RetrievalStrategy(str, Enum):
    """Context retrieval strategies"""

    DENSE_ONLY = "dense_only"  # Vector similarity only
    SPARSE_ONLY = "sparse_only"  # Keyword matching only
    HYBRID_FUSION = "hybrid_fusion"  # Dense + sparse fusion
    MULTI_STAGE = "multi_stage"  # Broad → focused → refinement
    CROSS_ENCODER_RERANK = "cross_encoder_rerank"  # Neural reranking
    DIVERSITY_AWARE = "diversity_aware"  # Maximal marginal relevance
    PERSONALIZED = "personalized"  # User-aware retrieval
    TEMPORAL_WEIGHTED = "temporal_weighted"  # Time-aware retrieval
    AUTHORITY_WEIGHTED = "authority_weighted"  # Source authority weighting


class RetrievalStage(str, Enum):
    """Multi-stage retrieval stages"""

    BROAD_RETRIEVAL = "broad_retrieval"  # Initial broad search
    FOCUSED_RETRIEVAL = "focused_retrieval"  # Focused search with filters
    REFINEMENT = "refinement"  # Final refinement and reranking
    DIVERSIFICATION = "diversification"  # Ensure result diversity
    PERSONALIZATION = "personalization"  # Apply personalization


@dataclass
class RetrievalRequest:
    """Context retrieval request"""

    query_text: str
    query_analysis: Optional[QueryAnalysis] = None
    user_context: Optional[QueryContext] = None
    tenant_id: Optional[str] = None
    user_id: Optional[str] = None
    max_context_length: int = 4000  # tokens
    max_chunks: int = 10
    retrieval_strategy: RetrievalStrategy = RetrievalStrategy.MULTI_STAGE
    min_relevance_score: float = 0.3
    include_metadata: bool = True
    boost_recent: bool = True
    boost_authoritative: bool = True
    diversity_threshold: float = 0.7
    personalization_enabled: bool = True
    temporal_filter: Optional[Dict[str, Any]] = None
    source_filters: Optional[List[str]] = None
    content_type_filters: Optional[List[str]] = None
    language_filters: Optional[List[str]] = None


@dataclass
class RetrievalCandidate:
    """Retrieved document candidate with scoring"""

    chunk: DocumentChunk
    raw_score: float
    relevance_score: float
    authority_score: float
    recency_score: float
    diversity_score: float
    personalized_score: float
    final_score: float
    retrieval_method: str
    stage_obtained: RetrievalStage
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class RetrievalResult:
    """Complete retrieval result"""

    candidates: List[RetrievalCandidate]
    query_understanding: Optional[QueryAnalysis]
    retrieval_strategy: RetrievalStrategy
    total_candidates_evaluated: int
    retrieval_time_ms: float
    reranking_time_ms: float
    diversity_time_ms: float
    total_time_ms: float
    coverage_estimate: float
    quality_metrics: Dict[str, float]
    strategy_performance: Dict[str, Any]
    selected_chunks: List[DocumentChunk]


@dataclass
class RetrievalMetrics:
    """Retrieval performance metrics"""

    precision_at_k: Dict[int, float]
    recall_at_k: Dict[int, float]
    f1_at_k: Dict[int, float]
    mean_reciprocal_rank: float
    mean_average_precision: float
    normalized_discounted_cumulative_gain: float
    diversity_score: float
    novelty_score: float
    coverage_score: float
    authority_distribution: Dict[str, float]
    temporal_distribution: Dict[str, int]


class ContextRetrievalService:
    """Advanced context retrieval service"""

    def __init__(
        self,
        document_repository: DocumentRepository,
        vector_search_service: VectorSearchService,
        query_understanding_service: QueryUnderstandingService,
    ):
        self.document_repository = document_repository
        self.vector_search_service = vector_search_service
        self.query_understanding_service = query_understanding_service

        # Initialize components
        self._cross_encoder = None
        self._tfidf_vectorizer = None
        self._retrieval_cache = {}
        self._user_profiles = {}
        self._document_popularity = {}
        self._authority_scores = {}

        # Initialize models
        self._initialize_models()

        logger.info("Context Retrieval Service initialized")

    def _initialize_models(self) -> None:
        """Initialize retrieval models"""
        try:
            # Initialize cross-encoder for reranking
            self._cross_encoder = CrossEncoder("ms-marco-MiniLM-L-6-v2")

            # Initialize TF-IDF vectorizer for sparse retrieval
            self._tfidf_vectorizer = TfidfVectorizer(
                max_features=5000,
                stop_words="english",
                ngram_range=(1, 3),
                min_df=2,
                max_df=0.8,
                sublinear_tf=True,
            )

            logger.info("Retrieval models initialized successfully")

        except Exception as e:
            logger.error(f"Failed to initialize retrieval models: {e}")

    async def retrieve_context(self, request: RetrievalRequest) -> RetrievalResult:
        """
        Perform comprehensive context retrieval

        Args:
            request: Retrieval request parameters

        Returns:
            Complete retrieval result
        """
        start_time = datetime.now()

        try:
            # Analyze query if not provided
            if not request.query_analysis:
                request.query_analysis = (
                    await self.query_understanding_service.analyze_query(
                        request.query_text, request.user_context, use_expansion=True
                    )
                )

            # Perform multi-stage retrieval
            candidates = await self._perform_multi_stage_retrieval(request)

            # Apply reranking
            reranked_candidates = await self._apply_reranking(candidates, request)

            # Apply diversification
            diversified_candidates = await self._apply_diversification(
                reranked_candidates, request
            )

            # Apply personalization
            personalized_candidates = await self._apply_personalization(
                diversified_candidates, request
            )

            # Select final chunks
            selected_chunks = self._select_final_chunks(
                personalized_candidates, request
            )

            # Calculate metrics
            retrieval_time = (datetime.now() - start_time).total_seconds() * 1000

            quality_metrics = self._calculate_quality_metrics(
                selected_chunks, request.query_analysis
            )

            strategy_performance = self._calculate_strategy_performance(
                candidates, personalized_candidates, request
            )

            result = RetrievalResult(
                candidates=personalized_candidates[: request.max_chunks],
                query_understanding=request.query_analysis,
                retrieval_strategy=request.retrieval_strategy,
                total_candidates_evaluated=len(candidates),
                retrieval_time_ms=retrieval_time,
                reranking_time_ms=0.0,  # Would track separately
                diversity_time_ms=0.0,  # Would track separately
                total_time_ms=retrieval_time,
                coverage_estimate=self._estimate_coverage(selected_chunks, request),
                quality_metrics=quality_metrics,
                strategy_performance=strategy_performance,
                selected_chunks=selected_chunks,
            )

            # Cache successful retrievals
            self._cache_retrieval(request, result)

            logger.info(
                f"Context retrieval completed: {len(selected_chunks)} chunks, "
                f"strategy={request.retrieval_strategy}, time={retrieval_time:.2f}ms"
            )

            return result

        except Exception as e:
            logger.error(f"Context retrieval failed: {e}")
            # Return fallback result
            return await self._fallback_retrieval(request)

    async def _perform_multi_stage_retrieval(
        self, request: RetrievalRequest
    ) -> List[RetrievalCandidate]:
        """
        Perform multi-stage retrieval based on strategy

        Args:
            request: Retrieval request

        Returns:
            List of retrieval candidates
        """
        candidates = []

        if request.retrieval_strategy == RetrievalStrategy.MULTI_STAGE:
            # Stage 1: Broad retrieval
            broad_candidates = await self._broad_retrieval_stage(request)
            candidates.extend(broad_candidates)

            # Stage 2: Focused retrieval
            if len(broad_candidates) > 0:
                focused_candidates = await self._focused_retrieval_stage(
                    broad_candidates, request
                )
                candidates.extend(focused_candidates)

            # Stage 3: Refinement
            if len(candidates) > 0:
                refined_candidates = await self._refinement_stage(candidates, request)
                candidates.extend(refined_candidates)

        elif request.retrieval_strategy == RetrievalStrategy.HYBRID_FUSION:
            # Dense retrieval
            dense_candidates = await self._dense_retrieval(request)
            candidates.extend(dense_candidates)

            # Sparse retrieval
            sparse_candidates = await self._sparse_retrieval(request)
            candidates.extend(sparse_candidates)

            # Fusion
            candidates = self._fusion_retrieval(candidates, request)

        elif request.retrieval_strategy == RetrievalStrategy.DIVERSITY_AWARE:
            candidates = await self._diversity_aware_retrieval(request)

        elif request.retrieval_strategy == RetrievalStrategy.PERSONALIZED:
            candidates = await self._personalized_retrieval(request)

        else:
            # Default to dense retrieval
            candidates = await self._dense_retrieval(request)

        # Remove duplicates and limit candidates
        unique_candidates = self._remove_duplicate_candidates(candidates)
        return unique_candidates[: request.max_chunks * 3]  # Get 3x more for reranking

    async def _broad_retrieval_stage(
        self, request: RetrievalRequest
    ) -> List[RetrievalCandidate]:
        """
        Stage 1: Broad retrieval with relaxed constraints

        Args:
            request: Retrieval request

        Returns:
            List of broad retrieval candidates
        """
        try:
            # Create broad search query
            search_query = SearchQuery(
                text=request.query_text,
                filters=self._build_base_filters(request),
                limit=request.max_chunks * 5,  # Get more results
                ranking_strategy=RankingStrategy.HYBRID_SEMANTIC_KEYWORD,
                search_mode=SearchMode.BALANCED,
                min_relevance_score=0.1,  # Low threshold for broad search
                diversity_threshold=0.0,  # No diversity constraint
                tenant_id=request.tenant_id,
                user_id=request.user_id,
            )

            # Perform vector search
            results, _ = await self.vector_search_service.search(search_query)

            # Convert to retrieval candidates
            candidates = []
            for result in results:
                candidate = RetrievalCandidate(
                    chunk=DocumentChunk(
                        id=result.chunk_id,
                        document_id=result.document_id,
                        content=result.content,
                        metadata=result.metadata,
                        created_at=datetime.now(),  # Would get from actual chunk
                        tenant_id=request.tenant_id or "",
                    ),
                    raw_score=result.score,
                    relevance_score=result.relevance_score,
                    authority_score=result.authority_score,
                    recency_score=result.recency_score,
                    diversity_score=result.diversity_score,
                    personalized_score=result.personalized_score,
                    final_score=result.final_score,
                    retrieval_method="broad_vector_search",
                    stage_obtained=RetrievalStage.BROAD_RETRIEVAL,
                    metadata={"search_rank": result.rank},
                )
                candidates.append(candidate)

            logger.info(f"Broad retrieval: {len(candidates)} candidates")
            return candidates

        except Exception as e:
            logger.error(f"Broad retrieval stage failed: {e}")
            return []

    async def _focused_retrieval_stage(
        self, broad_candidates: List[RetrievalCandidate], request: RetrievalRequest
    ) -> List[RetrievalCandidate]:
        """
        Stage 2: Focused retrieval with refined constraints

        Args:
            broad_candidates: Results from broad stage
            request: Retrieval request

        Returns:
            List of focused retrieval candidates
        """
        try:
            # Analyze top candidates to understand query focus
            top_candidates = broad_candidates[:5]
            focus_terms = self._extract_focus_terms(
                top_candidates, request.query_analysis
            )

            # Create focused search query
            focused_query_text = f"{request.query_text} {' '.join(focus_terms)}"

            search_query = SearchQuery(
                text=focused_query_text,
                filters=self._build_focused_filters(request, focus_terms),
                limit=request.max_chunks * 3,
                ranking_strategy=RankingStrategy.SEMANTIC_ONLY,
                search_mode=SearchMode.ACCURATE,
                min_relevance_score=0.3,
                diversity_threshold=0.5,
                tenant_id=request.tenant_id,
                user_id=request.user_id,
            )

            # Perform focused search
            results, _ = await self.vector_search_service.search(search_query)

            # Convert to retrieval candidates
            candidates = []
            for result in results:
                # Check if already in broad candidates
                if not any(c.chunk.id == result.chunk_id for c in broad_candidates):
                    candidate = RetrievalCandidate(
                        chunk=DocumentChunk(
                            id=result.chunk_id,
                            document_id=result.document_id,
                            content=result.content,
                            metadata=result.metadata,
                            created_at=datetime.now(),
                            tenant_id=request.tenant_id or "",
                        ),
                        raw_score=result.score,
                        relevance_score=result.relevance_score,
                        authority_score=result.authority_score,
                        recency_score=result.recency_score,
                        diversity_score=result.diversity_score,
                        personalized_score=result.personalized_score,
                        final_score=result.final_score,
                        retrieval_method="focused_vector_search",
                        stage_obtained=RetrievalStage.FOCUSED_RETRIEVAL,
                        metadata={
                            "search_rank": result.rank,
                            "focus_terms": focus_terms,
                        },
                    )
                    candidates.append(candidate)

            logger.info(f"Focused retrieval: {len(candidates)} additional candidates")
            return candidates

        except Exception as e:
            logger.error(f"Focused retrieval stage failed: {e}")
            return []

    async def _refinement_stage(
        self, candidates: List[RetrievalCandidate], request: RetrievalRequest
    ) -> List[RetrievalCandidate]:
        """
        Stage 3: Refinement with cross-encoder reranking

        Args:
            candidates: Combined candidates from previous stages
            request: Retrieval request

        Returns:
            Refined candidate list
        """
        try:
            if not self._cross_encoder:
                logger.warning("Cross-encoder not available, skipping refinement")
                return []

            # Prepare query-document pairs for cross-encoder
            query_doc_pairs = []
            for candidate in candidates[:20]:  # Limit for efficiency
                query_doc_pairs.append([request.query_text, candidate.chunk.content])

            # Get cross-encoder scores
            if query_doc_pairs:
                ce_scores = self._cross_encoder.predict(query_doc_pairs)
            else:
                ce_scores = []

            # Update candidate scores with cross-encoder results
            refined_candidates = []
            for i, candidate in enumerate(candidates[: len(ce_scores)]):
                ce_score = float(ce_scores[i])

                # Combine scores (weighted average)
                combined_score = 0.7 * candidate.final_score + 0.3 * ce_score

                refined_candidate = RetrievalCandidate(
                    chunk=candidate.chunk,
                    raw_score=candidate.raw_score,
                    relevance_score=candidate.relevance_score,
                    authority_score=candidate.authority_score,
                    recency_score=candidate.recency_score,
                    diversity_score=candidate.diversity_score,
                    personalized_score=candidate.personalized_score,
                    final_score=combined_score,
                    retrieval_method="cross_encoder_reranking",
                    stage_obtained=RetrievalStage.REFINEMENT,
                    metadata={
                        **candidate.metadata,
                        "cross_encoder_score": ce_score,
                        "original_score": candidate.final_score,
                    },
                )
                refined_candidates.append(refined_candidate)

            logger.info(
                f"Refinement stage: {len(refined_candidates)} refined candidates"
            )
            return refined_candidates

        except Exception as e:
            logger.error(f"Refinement stage failed: {e}")
            return []

    async def _dense_retrieval(
        self, request: RetrievalRequest
    ) -> List[RetrievalCandidate]:
        """
        Dense vector-based retrieval

        Args:
            request: Retrieval request

        Returns:
            List of dense retrieval candidates
        """
        try:
            search_query = SearchQuery(
                text=request.query_text,
                filters=self._build_base_filters(request),
                limit=request.max_chunks * 2,
                ranking_strategy=RankingStrategy.SEMANTIC_ONLY,
                search_mode=SearchMode.ACCURATE,
                min_relevance_score=request.min_relevance_score,
                tenant_id=request.tenant_id,
                user_id=request.user_id,
            )

            results, _ = await self.vector_search_service.search(search_query)

            candidates = []
            for result in results:
                candidate = RetrievalCandidate(
                    chunk=DocumentChunk(
                        id=result.chunk_id,
                        document_id=result.document_id,
                        content=result.content,
                        metadata=result.metadata,
                        created_at=datetime.now(),
                        tenant_id=request.tenant_id or "",
                    ),
                    raw_score=result.score,
                    relevance_score=result.relevance_score,
                    authority_score=result.authority_score,
                    recency_score=result.recency_score,
                    diversity_score=result.diversity_score,
                    personalized_score=result.personalized_score,
                    final_score=result.final_score,
                    retrieval_method="dense_vector_search",
                    stage_obtained=RetrievalStage.BROAD_RETRIEVAL,
                    metadata={"search_rank": result.rank},
                )
                candidates.append(candidate)

            return candidates

        except Exception as e:
            logger.error(f"Dense retrieval failed: {e}")
            return []

    async def _sparse_retrieval(
        self, request: RetrievalRequest
    ) -> List[RetrievalCandidate]:
        """
        Sparse keyword-based retrieval

        Args:
            request: Retrieval request

        Returns:
            List of sparse retrieval candidates
        """
        try:
            # Extract keywords from query
            if request.query_analysis:
                keywords = request.query_analysis.keywords
                key_phrases = request.query_analysis.key_phrases
            else:
                keywords = request.query_text.lower().split()
                key_phrases = []

            # Build search terms
            search_terms = keywords + key_phrases
            search_text = " ".join(search_terms)

            # Perform keyword search (would integrate with search engine)
            # For now, simulate with vector search using keyword matching
            search_query = SearchQuery(
                text=search_text,
                filters=self._build_base_filters(request),
                limit=request.max_chunks * 2,
                ranking_strategy=RankingStrategy.HYBRID_SEMANTIC_KEYWORD,
                search_mode=SearchMode.FAST,
                min_relevance_score=0.1,
                tenant_id=request.tenant_id,
                user_id=request.user_id,
            )

            results, _ = await self.vector_search_service.search(search_query)

            candidates = []
            for result in results:
                candidate = RetrievalCandidate(
                    chunk=DocumentChunk(
                        id=result.chunk_id,
                        document_id=result.document_id,
                        content=result.content,
                        metadata=result.metadata,
                        created_at=datetime.now(),
                        tenant_id=request.tenant_id or "",
                    ),
                    raw_score=result.score,
                    relevance_score=result.relevance_score,
                    authority_score=result.authority_score,
                    recency_score=result.recency_score,
                    diversity_score=result.diversity_score,
                    personalized_score=result.personalized_score,
                    final_score=result.final_score
                    * 0.8,  # Slightly lower weight for sparse
                    retrieval_method="sparse_keyword_search",
                    stage_obtained=RetrievalStage.BROAD_RETRIEVAL,
                    metadata={"search_rank": result.rank, "matched_keywords": keywords},
                )
                candidates.append(candidate)

            return candidates

        except Exception as e:
            logger.error(f"Sparse retrieval failed: {e}")
            return []

    def _fusion_retrieval(
        self, candidates: List[RetrievalCandidate], request: RetrievalRequest
    ) -> List[RetrievalCandidate]:
        """
        Fusion of multiple retrieval methods

        Args:
            candidates: Combined candidates from different methods
            request: Retrieval request

        Returns:
            Fused candidate list
        """
        try:
            # Group candidates by chunk ID
            candidate_groups = defaultdict(list)
            for candidate in candidates:
                candidate_groups[candidate.chunk.id].append(candidate)

            fused_candidates = []
            for chunk_id, group in candidate_groups.items():
                # Calculate fusion score (weighted average)
                total_weight = 0
                weighted_score = 0

                retrieval_methods = set()
                all_metadata = {}

                for candidate in group:
                    weight = self._get_method_weight(candidate.retrieval_method)
                    weighted_score += candidate.final_score * weight
                    total_weight += weight
                    retrieval_methods.add(candidate.retrieval_method)
                    all_metadata.update(candidate.metadata)

                # Calculate fused score
                if total_weight > 0:
                    fused_score = weighted_score / total_weight
                else:
                    fused_score = sum(c.final_score for c in group) / len(group)

                # Create fused candidate
                fused_candidate = RetrievalCandidate(
                    chunk=group[0].chunk,  # Use first candidate's chunk
                    raw_score=fused_score,
                    relevance_score=max(c.relevance_score for c in group),
                    authority_score=max(c.authority_score for c in group),
                    recency_score=max(c.recency_score for c in group),
                    diversity_score=max(c.diversity_score for c in group),
                    personalized_score=max(c.personalized_score for c in group),
                    final_score=fused_score,
                    retrieval_method=f"fusion({','.join(retrieval_methods)})",
                    stage_obtained=RetrievalStage.REFINEMENT,
                    metadata={
                        **all_metadata,
                        "fusion_methods": list(retrieval_methods),
                        "fusion_candidate_count": len(group),
                    },
                )
                fused_candidates.append(fused_candidate)

            # Sort by fused score
            fused_candidates.sort(key=lambda x: x.final_score, reverse=True)

            return fused_candidates

        except Exception as e:
            logger.error(f"Fusion retrieval failed: {e}")
            return candidates

    def _get_method_weight(self, method: str) -> float:
        """
        Get weight for retrieval method in fusion

        Args:
            method: Retrieval method name

        Returns:
            Method weight
        """
        method_weights = {
            "dense_vector_search": 1.0,
            "sparse_keyword_search": 0.8,
            "broad_vector_search": 0.7,
            "focused_vector_search": 0.9,
            "cross_encoder_reranking": 1.2,
            "diversity_aware_search": 0.9,
            "personalized_search": 1.1,
        }
        return method_weights.get(method, 1.0)

    async def _diversity_aware_retrieval(
        self, request: RetrievalRequest
    ) -> List[RetrievalCandidate]:
        """
        Diversity-aware retrieval using maximal marginal relevance

        Args:
            request: Retrieval request

        Returns:
            Diversity-aware candidate list
        """
        try:
            # Get initial candidates
            initial_candidates = await self._dense_retrieval(request)

            if not initial_candidates:
                return []

            # Apply maximal marginal relevance (MMR)
            diverse_candidates = []
            remaining_candidates = initial_candidates.copy()

            # Select best candidate as starting point
            if remaining_candidates:
                diverse_candidates.append(remaining_candidates.pop(0))

            # Iteratively select diverse candidates
            while len(diverse_candidates) < request.max_chunks and remaining_candidates:
                best_candidate = None
                best_mmr_score = -1

                for candidate in remaining_candidates:
                    # Calculate relevance score
                    relevance = candidate.final_score

                    # Calculate maximum similarity to already selected candidates
                    max_similarity = 0
                    for selected in diverse_candidates:
                        similarity = self._calculate_content_similarity(
                            candidate.chunk.content, selected.chunk.content
                        )
                        max_similarity = max(max_similarity, similarity)

                    # Calculate MMR score
                    mmr_score = (request.diversity_threshold * relevance) - (
                        (1 - request.diversity_threshold) * max_similarity
                    )

                    if mmr_score > best_mmr_score:
                        best_mmr_score = mmr_score
                        best_candidate = candidate

                if best_candidate:
                    diverse_candidates.append(best_candidate)
                    remaining_candidates.remove(best_candidate)
                else:
                    break

            # Update retrieval method
            for candidate in diverse_candidates:
                candidate.retrieval_method = "diversity_aware_mmr"
                candidate.stage_obtained = RetrievalStage.DIVERSIFICATION

            return diverse_candidates

        except Exception as e:
            logger.error(f"Diversity-aware retrieval failed: {e}")
            return await self._dense_retrieval(request)

    async def _personalized_retrieval(
        self, request: RetrievalRequest
    ) -> List[RetrievalCandidate]:
        """
        Personalized retrieval based on user context

        Args:
            request: Retrieval request

        Returns:
            Personalized candidate list
        """
        try:
            if not request.user_context or not request.personalization_enabled:
                return await self._dense_retrieval(request)

            # Get user preferences and history
            user_profile = await self._get_user_profile(request.user_id)

            # Perform base retrieval
            base_candidates = await self._dense_retrieval(request)

            # Apply personalization scores
            personalized_candidates = []
            for candidate in base_candidates:
                # Calculate personalization score
                personalization_score = self._calculate_personalization_score(
                    candidate, user_profile, request.user_context
                )

                # Update final score with personalization
                personalized_score = (
                    0.7 * candidate.final_score + 0.3 * personalization_score
                )

                personalized_candidate = RetrievalCandidate(
                    chunk=candidate.chunk,
                    raw_score=candidate.raw_score,
                    relevance_score=candidate.relevance_score,
                    authority_score=candidate.authority_score,
                    recency_score=candidate.recency_score,
                    diversity_score=candidate.diversity_score,
                    personalized_score=personalization_score,
                    final_score=personalized_score,
                    retrieval_method="personalized_retrieval",
                    stage_obtained=RetrievalStage.PERSONALIZATION,
                    metadata={
                        **candidate.metadata,
                        "personalization_score": personalization_score,
                        "original_score": candidate.final_score,
                    },
                )
                personalized_candidates.append(personalized_candidate)

            # Sort by personalized score
            personalized_candidates.sort(key=lambda x: x.final_score, reverse=True)

            return personalized_candidates

        except Exception as e:
            logger.error(f"Personalized retrieval failed: {e}")
            return await self._dense_retrieval(request)

    def _calculate_personalization_score(
        self,
        candidate: RetrievalCandidate,
        user_profile: Dict[str, Any],
        user_context: QueryContext,
    ) -> float:
        """
        Calculate personalization score for a candidate

        Args:
            candidate: Retrieval candidate
            user_profile: User profile data
            user_context: User context information

        Returns:
            Personalization score (0-1)
        """
        score = 0.0

        # Topic relevance
        user_topics = user_profile.get("preferred_topics", [])
        candidate_topics = candidate.chunk.metadata.get("topics", [])
        topic_overlap = len(set(user_topics) & set(candidate_topics))
        if topic_overlap > 0:
            score += 0.3 * min(topic_overlap / len(user_topics), 1.0)

        # Source preference
        preferred_sources = user_profile.get("preferred_sources", [])
        candidate_source = candidate.chunk.metadata.get("source")
        if candidate_source in preferred_sources:
            score += 0.2

        # Content type preference
        preferred_types = user_profile.get("preferred_content_types", [])
        candidate_type = candidate.chunk.metadata.get("content_type")
        if candidate_type in preferred_types:
            score += 0.2

        # Recency interaction
        recent_documents = user_context.recent_topics or []
        if candidate.chunk.document_id in recent_documents:
            score += 0.1

        # Language preference
        preferred_language = user_profile.get("preferred_language", "en")
        if candidate.chunk.metadata.get("language") == preferred_language:
            score += 0.1

        # Reading level match
        user_reading_level = user_profile.get("reading_level", "intermediate")
        candidate_level = candidate.chunk.metadata.get("reading_level", "intermediate")
        if user_reading_level == candidate_level:
            score += 0.1

        return min(score, 1.0)

    async def _apply_reranking(
        self, candidates: List[RetrievalCandidate], request: RetrievalRequest
    ) -> List[RetrievalCandidate]:
        """
        Apply advanced reranking to candidates

        Args:
            candidates: Initial candidates
            request: Retrieval request

        Returns:
            Reranked candidates
        """
        if not candidates:
            return candidates

        try:
            # Apply different reranking strategies based on query intent
            if request.query_analysis:
                intent = request.query_analysis.intent

                if intent == QueryIntent.COMPARISON:
                    return self._apply_comparison_reranking(candidates, request)
                elif intent == QueryIntent.DEFINITION:
                    return self._apply_definition_reranking(candidates, request)
                elif intent == QueryIntent.PROCEDURAL:
                    return self._apply_procedural_reranking(candidates, request)
                elif intent == QueryIntent.ANALYSIS:
                    return self._apply_analysis_reranking(candidates, request)

            # Default reranking
            return self._apply_default_reranking(candidates, request)

        except Exception as e:
            logger.error(f"Reranking failed: {e}")
            return candidates

    def _apply_comparison_reranking(
        self, candidates: List[RetrievalCandidate], request: RetrievalRequest
    ) -> List[RetrievalCandidate]:
        """
        Apply comparison-focused reranking

        Args:
            candidates: Initial candidates
            request: Retrieval request

        Returns:
            Reranked candidates for comparison queries
        """
        for candidate in candidates:
            content = candidate.chunk.content.lower()

            # Boost content with comparative language
            comparison_words = [
                "versus",
                "compared",
                "difference",
                "whereas",
                "however",
                "while",
                "although",
                "unlike",
                "similar",
                "contrast",
            ]
            comparison_count = sum(1 for word in comparison_words if word in content)

            if comparison_count > 0:
                comparison_boost = min(comparison_count * 0.1, 0.5)
                candidate.final_score += comparison_boost
                candidate.metadata["comparison_boost"] = comparison_boost

            # Boost structured content (tables, lists)
            if (
                "table" in content
                or "list" in content
                or any(c in content for c in ["1.", "2.", "3."])
            ):
                candidate.final_score += 0.2
                candidate.metadata["structured_content_boost"] = 0.2

        return sorted(candidates, key=lambda x: x.final_score, reverse=True)

    def _apply_definition_reranking(
        self, candidates: List[RetrievalCandidate], request: RetrievalRequest
    ) -> List[RetrievalCandidate]:
        """
        Apply definition-focused reranking

        Args:
            candidates: Initial candidates
            request: Retrieval request

        Returns:
            Reranked candidates for definition queries
        """
        for candidate in candidates:
            content = candidate.chunk.content.lower()

            # Boost content with definition patterns
            definition_patterns = [
                "is defined as",
                "refers to",
                "means",
                "definition",
                "the term",
                "can be described as",
                "is a type of",
            ]
            definition_score = sum(
                1 for pattern in definition_patterns if pattern in content
            )

            if definition_score > 0:
                definition_boost = min(definition_score * 0.15, 0.6)
                candidate.final_score += definition_boost
                candidate.metadata["definition_boost"] = definition_boost

            # Boost concise content (better for definitions)
            content_length = len(candidate.chunk.content)
            if content_length < 500:  # Short, concise definitions
                conciseness_boost = (500 - content_length) / 1000
                candidate.final_score += conciseness_boost
                candidate.metadata["conciseness_boost"] = conciseness_boost

        return sorted(candidates, key=lambda x: x.final_score, reverse=True)

    def _apply_procedural_reranking(
        self, candidates: List[RetrievalCandidate], request: RetrievalRequest
    ) -> List[RetrievalCandidate]:
        """
        Apply procedural-focused reranking

        Args:
            candidates: Initial candidates
            request: Retrieval request

        Returns:
            Reranked candidates for procedural queries
        """
        for candidate in candidates:
            content = candidate.chunk.content.lower()

            # Boost content with procedural indicators
            procedural_words = [
                "step",
                "first",
                "then",
                "next",
                "finally",
                "procedure",
                "process",
                "method",
                "how to",
                "guide",
                "instruction",
            ]
            procedural_count = sum(1 for word in procedural_words if word in content)

            if procedural_count > 0:
                procedural_boost = min(procedural_count * 0.1, 0.5)
                candidate.final_score += procedural_boost
                candidate.metadata["procedural_boost"] = procedural_boost

            # Boost numbered/ordered content
            if any(f"{i}." in content for i in range(1, 10)):
                candidate.final_score += 0.3
                candidate.metadata["ordered_content_boost"] = 0.3

        return sorted(candidates, key=lambda x: x.final_score, reverse=True)

    def _apply_analysis_reranking(
        self, candidates: List[RetrievalCandidate], request: RetrievalRequest
    ) -> List[RetrievalCandidate]:
        """
        Apply analysis-focused reranking

        Args:
            candidates: Initial candidates
            request: Retrieval request

        Returns:
            Reranked candidates for analysis queries
        """
        for candidate in candidates:
            content = candidate.chunk.content.lower()

            # Boost content with analytical language
            analytical_words = [
                "analysis",
                "examine",
                "evaluate",
                "assess",
                "consider",
                "factor",
                "impact",
                "effect",
                "relationship",
                "correlation",
            ]
            analytical_count = sum(1 for word in analytical_words if word in content)

            if analytical_count > 0:
                analytical_boost = min(analytical_count * 0.1, 0.4)
                candidate.final_score += analytical_boost
                candidate.metadata["analytical_boost"] = analytical_boost

            # Boost data-rich content
            data_indicators = ["%", "$", "data", "statistics", "study", "research"]
            data_count = sum(1 for indicator in data_indicators if indicator in content)
            if data_count > 0:
                data_boost = min(data_count * 0.05, 0.3)
                candidate.final_score += data_boost
                candidate.metadata["data_content_boost"] = data_boost

        return sorted(candidates, key=lambda x: x.final_score, reverse=True)

    def _apply_default_reranking(
        self, candidates: List[RetrievalCandidate], request: RetrievalRequest
    ) -> List[RetrievalCandidate]:
        """
        Apply default reranking strategy

        Args:
            candidates: Initial candidates
            request: Retrieval request

        Returns:
            Default reranked candidates
        """
        # Sort by final score
        return sorted(candidates, key=lambda x: x.final_score, reverse=True)

    async def _apply_diversification(
        self, candidates: List[RetrievalCandidate], request: RetrievalRequest
    ) -> List[RetrievalCandidate]:
        """
        Apply diversification to ensure result variety

        Args:
            candidates: Reranked candidates
            request: Retrieval request

        Returns:
            Diversified candidates
        """
        if len(candidates) <= request.max_chunks:
            return candidates

        try:
            # Use maximal marginal relevance for diversification
            diverse_candidates = []
            remaining_candidates = candidates.copy()

            # Select best candidate
            if remaining_candidates:
                diverse_candidates.append(remaining_candidates.pop(0))

            # Select diverse candidates
            while len(diverse_candidates) < request.max_chunks and remaining_candidates:
                best_candidate = None
                best_mmr_score = -1

                for candidate in remaining_candidates:
                    # Calculate MMR score
                    relevance = candidate.final_score
                    max_similarity = 0

                    for selected in diverse_candidates:
                        similarity = self._calculate_content_similarity(
                            candidate.chunk.content, selected.chunk.content
                        )
                        max_similarity = max(max_similarity, similarity)

                    mmr_score = (request.diversity_threshold * relevance) - (
                        (1 - request.diversity_threshold) * max_similarity
                    )

                    if mmr_score > best_mmr_score:
                        best_mmr_score = mmr_score
                        best_candidate = candidate

                if best_candidate:
                    diverse_candidates.append(best_candidate)
                    remaining_candidates.remove(best_candidate)
                    best_candidate.metadata["mmr_score"] = best_mmr_score
                else:
                    break

            return diverse_candidates

        except Exception as e:
            logger.error(f"Diversification failed: {e}")
            return candidates[: request.max_chunks]

    def _calculate_content_similarity(self, content1: str, content2: str) -> float:
        """
        Calculate similarity between two content pieces

        Args:
            content1: First content
            content2: Second content

        Returns:
            Similarity score (0-1)
        """
        try:
            # Simple Jaccard similarity on word sets
            words1 = set(content1.lower().split())
            words2 = set(content2.lower().split())

            if not words1 or not words2:
                return 0.0

            intersection = len(words1.intersection(words2))
            union = len(words1.union(words2))

            return intersection / union if union > 0 else 0.0

        except Exception as e:
            logger.warning(f"Content similarity calculation failed: {e}")
            return 0.0

    async def _apply_personalization(
        self, candidates: List[RetrievalCandidate], request: RetrievalRequest
    ) -> List[RetrievalCandidate]:
        """
        Apply personalization to candidates

        Args:
            candidates: Diversified candidates
            request: Retrieval request

        Returns:
            Personalized candidates
        """
        if not request.user_context or not request.personalization_enabled:
            return candidates

        try:
            user_profile = await self._get_user_profile(request.user_id)

            for candidate in candidates:
                personalization_score = self._calculate_personalization_score(
                    candidate, user_profile, request.user_context
                )

                candidate.personalized_score = personalization_score

                # Apply personalization boost
                personalization_boost = 0.2 * personalization_score
                candidate.final_score += personalization_boost
                candidate.metadata["personalization_boost"] = personalization_boost

            # Re-sort after personalization
            return sorted(candidates, key=lambda x: x.final_score, reverse=True)

        except Exception as e:
            logger.error(f"Personalization failed: {e}")
            return candidates

    def _select_final_chunks(
        self, candidates: List[RetrievalCandidate], request: RetrievalRequest
    ) -> List[DocumentChunk]:
        """
        Select final chunks for context assembly

        Args:
            candidates: Personalized candidates
            request: Retrieval request

        Returns:
            Selected document chunks
        """
        # Take top candidates
        selected_candidates = candidates[: request.max_chunks]

        # Return just the chunks
        return [candidate.chunk for candidate in selected_candidates]

    def _build_base_filters(self, request: RetrievalRequest) -> Dict[str, Any]:
        """
        Build base filters for retrieval

        Args:
            request: Retrieval request

        Returns:
            Filter dictionary
        """
        filters = {}

        if request.tenant_id:
            filters["tenant_id"] = request.tenant_id

        if request.content_type_filters:
            filters["content_type"] = request.content_type_filters

        if request.language_filters:
            filters["language"] = request.language_filters

        if request.source_filters:
            filters["source"] = request.source_filters

        if request.temporal_filter:
            filters.update(request.temporal_filter)

        return filters

    def _build_focused_filters(
        self, request: RetrievalRequest, focus_terms: List[str]
    ) -> Dict[str, Any]:
        """
        Build focused filters for second-stage retrieval

        Args:
            request: Retrieval request
            focus_terms: Terms to focus on

        Returns:
            Enhanced filter dictionary
        """
        filters = self._build_base_filters(request)

        # Add focus term boosts
        if focus_terms:
            filters["focus_terms"] = focus_terms

        return filters

    def _extract_focus_terms(
        self,
        candidates: List[RetrievalCandidate],
        query_analysis: Optional[QueryAnalysis],
    ) -> List[str]:
        """
        Extract focus terms from top candidates

        Args:
            candidates: Top candidates
            query_analysis: Query analysis

        Returns:
            List of focus terms
        """
        focus_terms = []

        # Extract from query analysis
        if query_analysis:
            focus_terms.extend(query_analysis.keywords[:5])
            focus_terms.extend([entity.text for entity in query_analysis.entities[:3]])

        # Extract from candidate content
        for candidate in candidates[:3]:
            content_words = candidate.chunk.content.lower().split()
            # Simple frequency analysis
            word_freq = Counter(content_words)
            focus_terms.extend([word for word, freq in word_freq.most_common(3)])

        # Remove duplicates and limit
        return list(set(focus_terms))[:10]

    def _remove_duplicate_candidates(
        self, candidates: List[RetrievalCandidate]
    ) -> List[RetrievalCandidate]:
        """
        Remove duplicate candidates

        Args:
            candidates: List of candidates

        Returns:
            Deduplicated candidates
        """
        seen_chunks = set()
        unique_candidates = []

        for candidate in candidates:
            if candidate.chunk.id not in seen_chunks:
                seen_chunks.add(candidate.chunk.id)
                unique_candidates.append(candidate)

        return unique_candidates

    async def _get_user_profile(self, user_id: str) -> Dict[str, Any]:
        """
        Get user profile for personalization

        Args:
            user_id: User ID

        Returns:
            User profile dictionary
        """
        # Check cache first
        if user_id in self._user_profiles:
            return self._user_profiles[user_id]

        # Default profile (would load from database in real implementation)
        default_profile = {
            "preferred_topics": [],
            "preferred_sources": [],
            "preferred_content_types": ["text"],
            "preferred_language": "en",
            "reading_level": "intermediate",
            "interaction_history": [],
        }

        # Cache profile
        self._user_profiles[user_id] = default_profile

        return default_profile

    def _calculate_quality_metrics(
        self, chunks: List[DocumentChunk], query_analysis: Optional[QueryAnalysis]
    ) -> Dict[str, float]:
        """
        Calculate quality metrics for retrieved chunks

        Args:
            chunks: Retrieved chunks
            query_analysis: Query analysis

        Returns:
            Quality metrics dictionary
        """
        if not chunks:
            return {}

        metrics = {}

        # Average relevance score
        metrics["avg_relevance"] = 0.8  # Would calculate from actual scores

        # Content diversity
        unique_sources = len(
            set(chunk.metadata.get("source", "unknown") for chunk in chunks)
        )
        metrics["source_diversity"] = unique_sources / len(chunks)

        # Content length distribution
        avg_length = sum(len(chunk.content) for chunk in chunks) / len(chunks)
        metrics["avg_content_length"] = avg_length

        # Recency score
        if query_analysis and query_analysis.urgency == "high":
            recent_chunks = sum(1 for chunk in chunks if self._is_recent_content(chunk))
            metrics["recency_score"] = recent_chunks / len(chunks)
        else:
            metrics["recency_score"] = 0.5

        # Authority score
        authoritative_chunks = sum(
            1 for chunk in chunks if self._is_authoritative_source(chunk)
        )
        metrics["authority_score"] = authoritative_chunks / len(chunks)

        return metrics

    def _is_recent_content(self, chunk: DocumentChunk) -> bool:
        """
        Check if content is recent

        Args:
            chunk: Document chunk

        Returns:
            True if content is recent
        """
        # Simple check (would use actual created_at in real implementation)
        return chunk.metadata.get("is_recent", False)

    def _is_authoritative_source(self, chunk: DocumentChunk) -> bool:
        """
        Check if content is from authoritative source

        Args:
            chunk: Document chunk

        Returns:
            True if source is authoritative
        """
        authoritative_sources = ["peer_reviewed", "official", "academic", "research"]
        source_type = chunk.metadata.get("source_type", "").lower()
        return source_type in authoritative_sources

    def _calculate_strategy_performance(
        self,
        initial_candidates: List[RetrievalCandidate],
        final_candidates: List[RetrievalCandidate],
        request: RetrievalRequest,
    ) -> Dict[str, Any]:
        """
        Calculate retrieval strategy performance

        Args:
            initial_candidates: Initial retrieval candidates
            final_candidates: Final selected candidates
            request: Retrieval request

        Returns:
            Strategy performance metrics
        """
        performance = {}

        # Candidate reduction
        performance["initial_candidates"] = len(initial_candidates)
        performance["final_candidates"] = len(final_candidates)
        performance["reduction_ratio"] = len(final_candidates) / max(
            len(initial_candidates), 1
        )

        # Method distribution
        method_counts = Counter(c.retrieval_method for c in initial_candidates)
        performance["method_distribution"] = dict(method_counts)

        # Stage distribution
        stage_counts = Counter(c.stage_obtained for c in final_candidates)
        performance["stage_distribution"] = dict(stage_counts)

        # Score improvement
        if initial_candidates and final_candidates:
            initial_avg = sum(c.final_score for c in initial_candidates) / len(
                initial_candidates
            )
            final_avg = sum(c.final_score for c in final_candidates) / len(
                final_candidates
            )
            performance["score_improvement"] = final_avg - initial_avg
        else:
            performance["score_improvement"] = 0.0

        return performance

    def _estimate_coverage(
        self, chunks: List[DocumentChunk], request: RetrievalRequest
    ) -> float:
        """
        Estimate information coverage of retrieved chunks

        Args:
            chunks: Retrieved chunks
            request: Retrieval request

        Returns:
            Coverage estimate (0-1)
        """
        if not chunks or not request.query_analysis:
            return 0.5

        # Simple coverage estimation based on keyword coverage
        query_keywords = set(request.query_analysis.keywords)
        covered_keywords = set()

        for chunk in chunks:
            chunk_words = set(chunk.content.lower().split())
            covered_keywords.update(query_keywords.intersection(chunk_words))

        if not query_keywords:
            return 0.5

        return len(covered_keywords) / len(query_keywords)

    def _cache_retrieval(
        self, request: RetrievalRequest, result: RetrievalResult
    ) -> None:
        """
        Cache retrieval result for future use

        Args:
            request: Retrieval request
            result: Retrieval result
        """
        # Simple caching based on query hash
        query_hash = hash(request.query_text.lower())
        self._retrieval_cache[query_hash] = {
            "request": request,
            "result": result,
            "timestamp": datetime.now(),
        }

        # Keep cache size manageable
        if len(self._retrieval_cache) > 1000:
            oldest_key = min(
                self._retrieval_cache.keys(),
                key=lambda k: self._retrieval_cache[k]["timestamp"],
            )
            del self._retrieval_cache[oldest_key]

    async def _fallback_retrieval(self, request: RetrievalRequest) -> RetrievalResult:
        """
        Fallback retrieval when main retrieval fails

        Args:
            request: Retrieval request

        Returns:
            Fallback retrieval result
        """
        logger.warning("Using fallback retrieval strategy")

        try:
            # Simple keyword-based retrieval
            search_query = SearchQuery(
                text=request.query_text,
                filters={"tenant_id": request.tenant_id} if request.tenant_id else {},
                limit=request.max_chunks,
                ranking_strategy=RankingStrategy.HYBRID_SEMANTIC_KEYWORD,
                search_mode=SearchMode.FAST,
                min_relevance_score=0.1,
                tenant_id=request.tenant_id,
            )

            results, _ = await self.vector_search_service.search(search_query)

            candidates = []
            for result in results:
                candidate = RetrievalCandidate(
                    chunk=DocumentChunk(
                        id=result.chunk_id,
                        document_id=result.document_id,
                        content=result.content,
                        metadata=result.metadata,
                        created_at=datetime.now(),
                        tenant_id=request.tenant_id or "",
                    ),
                    raw_score=result.score,
                    relevance_score=result.relevance_score,
                    authority_score=result.authority_score,
                    recency_score=result.recency_score,
                    diversity_score=result.diversity_score,
                    personalized_score=result.personalized_score,
                    final_score=result.final_score,
                    retrieval_method="fallback_retrieval",
                    stage_obtained=RetrievalStage.BROAD_RETRIEVAL,
                    metadata={"fallback": True},
                )
                candidates.append(candidate)

            return RetrievalResult(
                candidates=candidates[: request.max_chunks],
                query_understanding=request.query_analysis,
                retrieval_strategy=RetrievalStrategy.HYBRID_FUSION,
                total_candidates_evaluated=len(results),
                retrieval_time_ms=0.0,
                reranking_time_ms=0.0,
                diversity_time_ms=0.0,
                total_time_ms=0.0,
                coverage_estimate=0.5,
                quality_metrics={"fallback_used": True},
                strategy_performance={"fallback": True},
                selected_chunks=[c.chunk for c in candidates[: request.max_chunks]],
            )

        except Exception as e:
            logger.error(f"Fallback retrieval failed: {e}")
            # Return empty result
            return RetrievalResult(
                candidates=[],
                query_understanding=request.query_analysis,
                retrieval_strategy=RetrievalStrategy.HYBRID_FUSION,
                total_candidates_evaluated=0,
                retrieval_time_ms=0.0,
                reranking_time_ms=0.0,
                diversity_time_ms=0.0,
                total_time_ms=0.0,
                coverage_estimate=0.0,
                quality_metrics={"error": str(e)},
                strategy_performance={"error": True},
                selected_chunks=[],
            )

    def get_service_metrics(self) -> Dict[str, Any]:
        """
        Get service performance metrics

        Returns:
            Service metrics dictionary
        """
        return {
            "cache_size": len(self._retrieval_cache),
            "user_profiles_cached": len(self._user_profiles),
            "cross_encoder_loaded": self._cross_encoder is not None,
            "tfidf_vectorizer_ready": self._tfidf_vectorizer is not None,
            "supported_strategies": [strategy.value for strategy in RetrievalStrategy],
            "supported_stages": [stage.value for stage in RetrievalStage],
        }
