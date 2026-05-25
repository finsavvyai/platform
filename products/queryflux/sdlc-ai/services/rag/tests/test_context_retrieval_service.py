"""
Tests for Context Retrieval Service with Multi-Stage Retrieval and Reranking
"""

import pytest
import asyncio
import numpy as np
from datetime import datetime, timedelta
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from typing import List, Dict, Any

from app.services.context_retrieval_service import (
    ContextRetrievalService,
    RetrievalStrategy,
    RetrievalRequest,
    RetrievalResult,
    RetrievalMetrics,
    RetrievalStage,
    ContextSource,
    DenseRetrievalConfig,
    SparseRetrievalConfig,
    HybridRetrievalConfig,
    MultiStageConfig,
)
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
    SearchMetrics,
    RankingStrategy,
    SearchMode,
)
from app.models.document import DocumentChunk
from app.repositories.document import DocumentRepository


@pytest.fixture
def mock_document_repository():
    """Mock document repository"""
    repo = AsyncMock(spec=DocumentRepository)
    return repo


@pytest.fixture
def mock_vector_search_service():
    """Mock vector search service"""
    service = AsyncMock(spec=VectorSearchService)
    return service


@pytest.fixture
def mock_query_understanding_service():
    """Mock query understanding service"""
    service = AsyncMock(spec=QueryUnderstandingService)
    return service


@pytest.fixture
def context_retrieval_service(
    mock_document_repository,
    mock_vector_search_service,
    mock_query_understanding_service,
):
    """Context retrieval service instance"""
    return ContextRetrievalService(
        document_repository=mock_document_repository,
        vector_search_service=mock_vector_search_service,
        query_understanding_service=mock_query_understanding_service,
    )


@pytest.fixture
def sample_chunks():
    """Sample document chunks for testing"""
    chunks = []

    # Create chunks with varying relevance and metadata
    topics = [
        "machine learning",
        "deep learning",
        "neural networks",
        "AI ethics",
        "data science",
    ]
    sources = ["peer_reviewed", "internal", "blog", "news", "documentation"]

    for i in range(20):
        topic = topics[i % len(topics)]
        source = sources[i % len(sources)]

        chunk = DocumentChunk(
            id=f"chunk_{i}",
            document_id=f"doc_{i % 5}",
            content=f"Content about {topic} from {source}. This is chunk {i} with detailed information. "
            * 5,
            chunk_index=i,
            start_pos=i * 100,
            end_pos=(i + 1) * 100,
            token_count=50,
            metadata={
                "source_type": source,
                "topic": topic,
                "citation_count": i * 5,
                "rating": 3.0 + (i % 3),
                "date": datetime.now() - timedelta(days=i),
                "author": f"author_{i % 5}",
            },
            embedding=np.random.rand(384).tolist(),
            created_at=datetime.now() - timedelta(hours=i),
            updated_at=datetime.now() - timedelta(minutes=i),
        )
        chunks.append(chunk)

    return chunks


@pytest.fixture
def sample_query_analysis():
    """Sample query analysis"""
    return QueryAnalysis(
        original_query="What are the latest developments in machine learning?",
        cleaned_query="latest developments machine learning",
        intent=QueryIntent.RESEARCH,
        entities=[{"text": "machine learning", "type": "TOPIC", "confidence": 0.9}],
        keywords=["machine learning", "developments", "latest"],
        context=QueryContext(
            domain="technology",
            complexity="high",
            scope="recent",
            time_frame=datetime.now() - timedelta(days=30),
        ),
        expanded_queries=[
            "recent machine learning advances",
            "new ML algorithms 2024",
            "machine learning breakthroughs",
        ],
        sentiment="neutral",
        confidence=0.95,
    )


class TestContextRetrievalService:
    """Test cases for ContextRetrievalService"""

    @pytest.mark.asyncio
    async def test_dense_retrieval_strategy(
        self, context_retrieval_service, mock_vector_search_service, sample_chunks
    ):
        """Test dense retrieval strategy using vector similarity"""
        # Setup
        request = RetrievalRequest(
            query="What is machine learning?",
            strategy=RetrievalStrategy.DENSE_ONLY,
            dense_config=DenseRetrievalConfig(
                top_k=10,
                similarity_threshold=0.7,
                rerank=True,
                diversity_penalty=0.1,
            ),
        )

        mock_search_results = [
            SearchResult(
                chunk=chunk,
                score=0.8 + (i * 0.01),
                explanation=f"Vector similarity {i}",
                metadata={"rank": i},
            )
            for i, chunk in enumerate(sample_chunks[:10])
        ]

        mock_vector_search_service.search.return_value = SearchResult(
            results=mock_search_results,
            query=request.query,
            total_found=100,
            search_time=0.05,
            metrics=SearchMetrics(
                total_results=100,
                search_time=0.05,
                index_size=10000,
                cache_hit=False,
            ),
        )

        # Execute
        result = await context_retrieval_service.retrieve_context(request)

        # Verify
        assert isinstance(result, RetrievalResult)
        assert len(result.results) == 10
        assert result.strategy_used == RetrievalStrategy.DENSE_ONLY
        assert result.total_results == 100

        # Check that results are sorted by score
        scores = [r.score for r in result.results]
        assert scores == sorted(scores, reverse=True)

        # Verify vector search was called correctly
        mock_vector_search_service.search.assert_called_once()
        call_args = mock_vector_search_service.search.call_args
        assert call_args[1]["query"] == request.query
        assert call_args[1]["top_k"] == 10

    @pytest.mark.asyncio
    async def test_sparse_retrieval_strategy(
        self, context_retrieval_service, mock_document_repository, sample_chunks
    ):
        """Test sparse retrieval strategy using keyword matching"""
        # Setup
        request = RetrievalRequest(
            query="machine learning algorithms",
            strategy=RetrievalStrategy.SPARSE_ONLY,
            sparse_config=SparseRetrievalConfig(
                top_k=10,
                bm25_b=0.75,
                bm25_k1=1.2,
                min_term_frequency=1,
            ),
        )

        mock_document_repository.search_by_keywords.return_value = sample_chunks[:10]

        # Execute
        result = await context_retrieval_service.retrieve_context(request)

        # Verify
        assert isinstance(result, RetrievalResult)
        assert len(result.results) == 10
        assert result.strategy_used == RetrievalStrategy.SPARSE_ONLY

        # Verify keyword search was called
        mock_document_repository.search_by_keywords.assert_called_once()

    @pytest.mark.asyncio
    async def test_hybrid_fusion_strategy(
        self,
        context_retrieval_service,
        mock_vector_search_service,
        mock_document_repository,
        sample_chunks,
    ):
        """Test hybrid fusion strategy combining dense and sparse retrieval"""
        # Setup
        request = RetrievalRequest(
            query="deep learning neural networks",
            strategy=RetrievalStrategy.HYBRID_FUSION,
            hybrid_config=HybridRetrievalConfig(
                dense_weight=0.6,
                sparse_weight=0.4,
                top_k=15,
                fusion_method="rrf",  # Reciprocal Rank Fusion
            ),
        )

        # Mock dense results
        dense_results = [
            SearchResult(
                chunk=chunk,
                score=0.8 + (i * 0.01),
                explanation=f"Dense similarity {i}",
            )
            for i, chunk in enumerate(sample_chunks[:10])
        ]

        # Mock sparse results
        sparse_results = sample_chunks[5:15]

        mock_vector_search_service.search.return_value = SearchResult(
            results=dense_results,
            query=request.query,
            total_found=100,
        )
        mock_document_repository.search_by_keywords.return_value = sparse_results

        # Execute
        result = await context_retrieval_service.retrieve_context(request)

        # Verify
        assert isinstance(result, RetrievalResult)
        assert len(result.results) <= 15
        assert result.strategy_used == RetrievalStrategy.HYBRID_FUSION

        # Check that both dense and sparse retrieval were called
        mock_vector_search_service.search.assert_called_once()
        mock_document_repository.search_by_keywords.assert_called_once()

    @pytest.mark.asyncio
    async def test_multi_stage_strategy(
        self,
        context_retrieval_service,
        mock_vector_search_service,
        mock_query_understanding_service,
        sample_chunks,
        sample_query_analysis,
    ):
        """Test multi-stage retrieval strategy"""
        # Setup
        request = RetrievalRequest(
            query="AI ethics and responsible AI",
            strategy=RetrievalStrategy.MULTI_STAGE,
            multi_stage_config=MultiStageConfig(
                broad_top_k=50,
                focused_top_k=20,
                final_top_k=10,
                expansion_enabled=True,
                rerank_enabled=True,
            ),
        )

        mock_query_understanding_service.analyze_query.return_value = (
            sample_query_analysis
        )

        # Mock broad search results
        broad_results = sample_chunks[:30]

        # Mock focused search results
        focused_results = sample_chunks[10:25]

        mock_vector_search_service.search.side_effect = [
            SearchResult(results=broad_results, total_found=100),  # Broad search
            SearchResult(results=focused_results, total_found=50),  # Focused search
        ]

        # Execute
        result = await context_retrieval_service.retrieve_context(request)

        # Verify
        assert isinstance(result, RetrievalResult)
        assert len(result.results) <= 10
        assert result.strategy_used == RetrievalStrategy.MULTI_STAGE
        assert len(result.stages) == 3  # Broad, Focused, Refinement

        # Check stages
        stage_names = [stage.stage_name for stage in result.stages]
        assert "broad_retrieval" in stage_names
        assert "focused_retrieval" in stage_names
        assert "refinement" in stage_names

    @pytest.mark.asyncio
    async def test_context_filtering_by_date(
        self, context_retrieval_service, mock_vector_search_service, sample_chunks
    ):
        """Test filtering context by date range"""
        # Setup
        request = RetrievalRequest(
            query="recent AI developments",
            date_filter={
                "start_date": datetime.now() - timedelta(days=7),
                "end_date": datetime.now(),
            },
            max_results=10,
        )

        # Mock results with various dates
        recent_chunks = sample_chunks[:5]  # First 5 chunks are most recent
        mock_results = [
            SearchResult(
                chunk=chunk,
                score=0.9,
                explanation="Recent content",
            )
            for chunk in recent_chunks
        ]

        mock_vector_search_service.search.return_value = SearchResult(
            results=mock_results,
            total_found=5,
        )

        # Execute
        result = await context_retrieval_service.retrieve_context(request)

        # Verify all results are within date range
        for context_item in result.results:
            chunk_date = context_item.chunk.metadata.get("date")
            assert chunk_date >= request.date_filter["start_date"]
            assert chunk_date <= request.date_filter["end_date"]

    @pytest.mark.asyncio
    async def test_context_filtering_by_source_type(
        self, context_retrieval_service, mock_vector_search_service, sample_chunks
    ):
        """Test filtering context by source type"""
        # Setup
        request = RetrievalRequest(
            query="research papers",
            source_types=["peer_reviewed"],
            max_results=10,
        )

        # Mock only peer-reviewed results
        peer_reviewed_chunks = [
            c for c in sample_chunks if c.metadata.get("source_type") == "peer_reviewed"
        ]
        mock_results = [
            SearchResult(
                chunk=chunk,
                score=0.95,
                explanation="Peer-reviewed content",
            )
            for chunk in peer_reviewed_chunks[:5]
        ]

        mock_vector_search_service.search.return_value = SearchResult(
            results=mock_results,
            total_found=len(peer_reviewed_chunks),
        )

        # Execute
        result = await context_retrieval_service.retrieve_context(request)

        # Verify all results are from peer-reviewed sources
        for context_item in result.results:
            assert context_item.chunk.metadata.get("source_type") == "peer_reviewed"

    @pytest.mark.asyncio
    async def test_reranking_with_cross_encoder(
        self, context_retrieval_service, sample_chunks
    ):
        """Test reranking using cross-encoder"""
        # Setup with patch for cross-encoder
        with patch(
            "app.services.context_retrieval_service.CrossEncoder"
        ) as MockCrossEncoder:
            mock_cross_encoder = Mock()
            mock_cross_encoder.predict.return_value = np.random.rand(10)
            MockCrossEncoder.return_value = mock_cross_encoder

            request = RetrievalRequest(
                query="neural network architectures",
                strategy=RetrievalStrategy.DENSE_ONLY,
                dense_config=DenseRetrievalConfig(rerank=True, top_k=10),
            )

            # Mock initial results
            initial_results = sample_chunks[:10]

            with patch.object(
                context_retrieval_service, "_get_dense_results"
            ) as mock_dense:
                mock_dense.return_value = initial_results

                # Execute
                result = await context_retrieval_service.retrieve_context(request)

                # Verify cross-encoder was used for reranking
                assert mock_cross_encoder.predict.called
                assert result.metrics.reranking_enabled

    @pytest.mark.asyncio
    async def test_diversity_aware_selection(
        self, context_retrieval_service, mock_vector_search_service, sample_chunks
    ):
        """Test diversity-aware result selection"""
        # Setup
        request = RetrievalRequest(
            query="machine learning",
            max_results=10,
            diversity_threshold=0.8,
            diversity_strategy="maximal_marginal_relevance",
        )

        # Mock results with high similarity
        similar_chunks = sample_chunks[:15]
        mock_results = [
            SearchResult(
                chunk=chunk,
                score=0.95,  # All high scores but potentially similar
                explanation="High similarity",
            )
            for chunk in similar_chunks
        ]

        mock_vector_search_service.search.return_value = SearchResult(
            results=mock_results,
            total_found=100,
        )

        # Execute
        result = await context_retrieval_service.retrieve_context(request)

        # Verify diversity was applied
        assert len(result.results) <= 10
        assert result.metrics.diversity_score > 0

    @pytest.mark.asyncio
    async def test_personalized_retrieval(
        self, context_retrieval_service, mock_vector_search_service, sample_chunks
    ):
        """Test personalized retrieval based on user profile"""
        # Setup
        request = RetrievalRequest(
            query="data science best practices",
            user_id="user_123",
            personalized=True,
            user_profile={
                "interests": ["machine learning", "statistics", "python"],
                "expertise_level": "advanced",
                "preferred_sources": ["peer_reviewed", "documentation"],
                "recently_viewed": ["doc_1", "doc_2"],
            },
            max_results=10,
        )

        # Mock personalized results
        preferred_chunks = [
            c
            for c in sample_chunks
            if c.metadata.get("source_type") in ["peer_reviewed", "documentation"]
        ]
        mock_results = [
            SearchResult(
                chunk=chunk,
                score=0.9 + (0.1 if chunk.document_id in ["doc_1", "doc_2"] else 0),
                explanation="Personalized match",
            )
            for chunk in preferred_chunks[:10]
        ]

        mock_vector_search_service.search.return_value = SearchResult(
            results=mock_results,
            total_found=50,
        )

        # Execute
        result = await context_retrieval_service.retrieve_context(request)

        # Verify personalization was applied
        assert result.metrics.personalization_applied

    @pytest.mark.asyncio
    async def test_context_caching(
        self, context_retrieval_service, mock_vector_search_service
    ):
        """Test context retrieval caching"""
        # Setup
        request = RetrievalRequest(
            query="recurrent neural networks",
            enable_cache=True,
            cache_ttl=3600,  # 1 hour
        )

        # First call - should hit the search service
        with patch.object(
            context_retrieval_service, "_get_cached_results"
        ) as mock_cache:
            mock_cache.return_value = None  # Cache miss

            with patch.object(
                context_retrieval_service, "_store_cached_results"
            ) as mock_store:
                # Execute
                result1 = await context_retrieval_service.retrieve_context(request)

                # Verify cache store was called
                mock_store.assert_called_once()

        # Second call - should hit cache
        with patch.object(
            context_retrieval_service, "_get_cached_results"
        ) as mock_cache:
            cached_result = RetrievalResult(
                results=[],
                query=request.query,
                strategy_used=RetrievalStrategy.DENSE_ONLY,
                total_results=0,
                retrieval_time=0.001,
                metrics=RetrievalMetrics(),
                stages=[],
            )
            mock_cache.return_value = cached_result

            # Execute
            result2 = await context_retrieval_service.retrieve_context(request)

            # Verify cache was hit
            assert result2.retrieval_time < 0.01  # Should be very fast

    @pytest.mark.asyncio
    async def test_error_handling_and_fallback(
        self, context_retrieval_service, mock_vector_search_service
    ):
        """Test error handling and fallback mechanisms"""
        # Setup
        request = RetrievalRequest(
            query="test query",
            strategy=RetrievalStrategy.DENSE_ONLY,
            fallback_enabled=True,
        )

        # Mock search service failure
        mock_vector_search_service.search.side_effect = Exception(
            "Search service unavailable"
        )

        # Execute
        result = await context_retrieval_service.retrieve_context(request)

        # Verify fallback was applied
        assert len(result.results) >= 0
        assert result.metrics.fallback_triggered

    @pytest.mark.asyncio
    async def test_metrics_collection(
        self, context_retrieval_service, mock_vector_search_service, sample_chunks
    ):
        """Test comprehensive metrics collection"""
        # Setup
        request = RetrievalRequest(
            query="comprehensive test query",
            collect_metrics=True,
            max_results=10,
        )

        mock_results = [
            SearchResult(
                chunk=chunk,
                score=0.8 + (i * 0.01),
                explanation=f"Test result {i}",
            )
            for i, chunk in enumerate(sample_chunks[:10])
        ]

        mock_vector_search_service.search.return_value = SearchResult(
            results=mock_results,
            total_found=100,
            search_time=0.05,
            metrics=SearchMetrics(
                total_results=100,
                search_time=0.05,
                index_size=10000,
                cache_hit=False,
            ),
        )

        # Execute
        result = await context_retrieval_service.retrieve_context(request)

        # Verify metrics
        assert result.metrics is not None
        assert result.metrics.total_retrieved == 100
        assert result.metrics.total_returned == 10
        assert result.metrics.retrieval_time > 0
        assert hasattr(result.metrics, "average_score")
        assert hasattr(result.metrics, "diversity_score")

    @pytest.mark.asyncio
    async def test_async_batch_retrieval(
        self, context_retrieval_service, mock_vector_search_service, sample_chunks
    ):
        """Test async batch retrieval for multiple queries"""
        # Setup
        requests = [
            RetrievalRequest(query=f"query {i}", max_results=5) for i in range(5)
        ]

        # Mock results for each query
        for i, request in enumerate(requests):
            mock_results = [
                SearchResult(
                    chunk=chunk,
                    score=0.8 + (i * 0.01),
                    explanation=f"Batch result {i}-{j}",
                )
                for j, chunk in enumerate(sample_chunks[i * 5 : (i + 1) * 5])
            ]
            mock_vector_search_service.search.return_value = SearchResult(
                results=mock_results,
                total_found=50,
            )

        # Execute batch retrieval
        results = await context_retrieval_service.batch_retrieve_context(requests)

        # Verify
        assert len(results) == 5
        for result in results:
            assert isinstance(result, RetrievalResult)
            assert len(result.results) == 5

    def test_retrieval_request_validation(self):
        """Test retrieval request validation"""
        # Valid request
        valid_request = RetrievalRequest(
            query="test query",
            max_results=10,
        )
        assert valid_request.is_valid()

        # Invalid request - empty query
        invalid_request = RetrievalRequest(
            query="",
            max_results=10,
        )
        assert not invalid_request.is_valid()

        # Invalid request - negative max_results
        invalid_request2 = RetrievalRequest(
            query="test",
            max_results=-1,
        )
        assert not invalid_request2.is_valid()

    @pytest.mark.asyncio
    async def test_context_source_tracking(
        self, context_retrieval_service, mock_vector_search_service, sample_chunks
    ):
        """Test tracking of context sources"""
        # Setup
        request = RetrievalRequest(
            query="track sources test",
            track_sources=True,
            max_results=5,
        )

        # Mock results from different sources
        mock_results = []
        for i, chunk in enumerate(sample_chunks[:5]):
            source_type = chunk.metadata.get("source_type", "unknown")
            mock_results.append(
                SearchResult(
                    chunk=chunk,
                    score=0.8 + (i * 0.01),
                    explanation=f"From {source_type}",
                )
            )

        mock_vector_search_service.search.return_value = SearchResult(
            results=mock_results,
            total_found=100,
        )

        # Execute
        result = await context_retrieval_service.retrieve_context(request)

        # Verify source tracking
        assert result.context_sources is not None
        assert len(result.context_sources) > 0

        # Check source distribution
        source_counts = {}
        for source in result.context_sources:
            source_counts[source.source_type] = (
                source_counts.get(source.source_type, 0) + 1
            )
        assert sum(source_counts.values()) == len(result.results)
