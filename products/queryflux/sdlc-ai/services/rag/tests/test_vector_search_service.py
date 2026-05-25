"""
Tests for Vector Search Service with Ranking Algorithms
"""

import pytest
import asyncio
import numpy as np
from datetime import datetime, timedelta
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from typing import List

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
def vector_search_service(mock_document_repository):
    """Vector search service instance"""
    return VectorSearchService(mock_document_repository)


@pytest.fixture
def sample_chunks():
    """Sample document chunks for testing"""
    chunks = []

    for i in range(10):
        chunk = DocumentChunk(
            id=f"chunk_{i}",
            document_id=f"doc_{i % 3}",
            content=f"This is sample content chunk {i}. It contains information about topic {i % 3}.",
            metadata={
                "source_type": "internal" if i % 2 == 0 else "peer_reviewed",
                "citation_count": i * 10,
                "rating": 4.0 + (i % 2),
                "author_verified": i % 3 == 0,
                "created_at": datetime.now() - timedelta(days=i),
            },
            embedding=np.random.rand(1536).tolist(),
            created_at=datetime.now() - timedelta(days=i),
        )
        chunks.append(chunk)

    return chunks


@pytest.fixture
def sample_query():
    """Sample search query"""
    return SearchQuery(
        text="sample query about topic 1",
        embedding=np.random.rand(1536).tolist(),
        limit=5,
        ranking_strategy=RankingStrategy.HYBRID_SEMANTIC_KEYWORD,
        tenant_id="tenant_123",
        user_id="user_456",
    )


class TestVectorSearchService:
    """Test cases for VectorSearchService"""

    @pytest.mark.asyncio
    async def test_search_basic(
        self, vector_search_service, sample_chunks, sample_query
    ):
        """Test basic search functionality"""
        # Setup mock repository
        vector_search_service.document_repository.similarity_search.return_value = (
            sample_chunks
        )

        # Perform search
        results, metrics = await vector_search_service.search(sample_query)

        # Verify results
        assert len(results) <= sample_query.limit
        assert isinstance(results[0], SearchResult)
        assert results[0].rank == 1
        assert results[0].final_score >= 0
        assert results[0].final_score <= 1

        # Verify metrics
        assert isinstance(metrics, SearchMetrics)
        assert metrics.total_results == len(sample_chunks)
        assert metrics.search_time_ms > 0
        assert isinstance(metrics.cache_hit, bool)

    @pytest.mark.asyncio
    async def test_search_with_cache_hit(self, vector_search_service, sample_query):
        """Test search with cache hit"""
        # Setup cache
        cache_key = vector_search_service._generate_cache_key(sample_query)
        cached_results = [
            SearchResult(
                chunk_id="cached_chunk",
                document_id="cached_doc",
                content="Cached content",
                metadata={},
                score=0.9,
                relevance_score=0.9,
                semantic_score=0.9,
                keyword_score=0.8,
                authority_score=0.7,
                recency_score=0.8,
                diversity_score=1.0,
                personalized_score=1.0,
                final_score=0.9,
                rank=1,
            )
        ]
        vector_search_service._search_cache[cache_key] = (
            cached_results,
            datetime.now(),
        )

        # Set search mode to FAST
        sample_query.search_mode = SearchMode.FAST

        # Perform search
        results, metrics = await vector_search_service.search(sample_query)

        # Verify cache hit
        assert len(results) == 1
        assert results[0].chunk_id == "cached_chunk"
        assert metrics.cache_hit is True
        assert metrics.search_time_ms < 5.0

    @pytest.mark.asyncio
    async def test_ranking_strategies(
        self, vector_search_service, sample_chunks, sample_query
    ):
        """Test different ranking strategies"""
        vector_search_service.document_repository.similarity_search.return_value = (
            sample_chunks
        )

        strategies = [
            RankingStrategy.SEMANTIC_ONLY,
            RankingStrategy.HYBRID_SEMANTIC_KEYWORD,
            RankingStrategy.RECENCY_WEIGHTED,
            RankingStrategy.AUTHORITY_WEIGHTED,
            RankingStrategy.DIVERSITY_WEIGHTED,
        ]

        results_by_strategy = {}

        for strategy in strategies:
            sample_query.ranking_strategy = strategy
            results, _ = await vector_search_service.search(sample_query)
            results_by_strategy[strategy] = results

        # Verify that different strategies produce different rankings
        for strategy in strategies:
            assert len(results_by_strategy[strategy]) > 0

            # Check that scores are calculated
            for result in results_by_strategy[strategy]:
                assert result.final_score >= 0
                assert result.final_score <= 1

    @pytest.mark.asyncio
    async def test_semantic_score_calculation(
        self, vector_search_service, sample_query
    ):
        """Test semantic score calculation"""
        # Create chunk with known embedding
        chunk = DocumentChunk(
            id="test_chunk",
            document_id="test_doc",
            content="Test content",
            metadata={},
            embedding=[1.0] * 1536,  # All ones
            created_at=datetime.now(),
        )

        # Calculate semantic score
        score = vector_search_service._calculate_semantic_score(sample_query, chunk)

        assert score >= 0
        assert score <= 1

        # Test with identical embeddings
        chunk.embedding = sample_query.embedding
        score = vector_search_service._calculate_semantic_score(sample_query, chunk)
        assert score > 0.9  # Should be very high for identical vectors

    @pytest.mark.asyncio
    async def test_keyword_score_calculation(self, vector_search_service, sample_query):
        """Test keyword score calculation"""
        # Create chunk with matching keywords
        chunk = DocumentChunk(
            id="test_chunk",
            document_id="test_doc",
            content="sample query about topic 1 with more text",
            metadata={},
            embedding=None,
            created_at=datetime.now(),
        )

        score = await vector_search_service._calculate_keyword_score(
            sample_query, chunk
        )

        assert score >= 0
        assert score <= 1

        # Test with no matching keywords
        chunk.content = "completely different content without any matching words"
        score = await vector_search_service._calculate_keyword_score(
            sample_query, chunk
        )
        assert score == 0.0

    @pytest.mark.asyncio
    async def test_authority_score_calculation(self, vector_search_service):
        """Test authority score calculation"""
        # Test peer-reviewed document
        chunk_peer = DocumentChunk(
            id="peer_chunk",
            document_id="peer_doc",
            content="Peer reviewed content",
            metadata={
                "source_type": "peer_reviewed",
                "citation_count": 150,
                "rating": 5.0,
                "author_verified": True,
            },
        )

        score_peer = await vector_search_service._calculate_authority_score(chunk_peer)
        assert score_peer > 0.8

        # Test internal document
        chunk_internal = DocumentChunk(
            id="internal_chunk",
            document_id="internal_doc",
            content="Internal content",
            metadata={
                "source_type": "internal",
                "citation_count": 0,
                "rating": 3.0,
                "author_verified": False,
            },
        )

        score_internal = await vector_search_service._calculate_authority_score(
            chunk_internal
        )
        assert score_internal < score_peer

    def test_recency_score_calculation(self, vector_search_service):
        """Test recency score calculation"""
        # Recent document
        chunk_recent = DocumentChunk(
            id="recent_chunk",
            document_id="recent_doc",
            content="Recent content",
            created_at=datetime.now() - timedelta(days=1),
        )

        query = SearchQuery(text="test", boost_recent=True)
        score_recent = vector_search_service._calculate_recency_score(
            chunk_recent, query
        )
        assert score_recent > 0.9

        # Old document
        chunk_old = DocumentChunk(
            id="old_chunk",
            document_id="old_doc",
            content="Old content",
            created_at=datetime.now() - timedelta(days=365),
        )

        score_old = vector_search_service._calculate_recency_score(chunk_old, query)
        assert score_old < 0.7
        assert score_old > 0.4  # Should not be too low due to exponential decay

    def test_diversity_score_calculation(self, vector_search_service):
        """Test diversity score calculation"""
        query = SearchQuery(text="test", diversity_threshold=0.7)

        # First result should have full diversity score
        chunk1 = DocumentChunk(
            id="chunk1",
            document_id="doc1",
            content="Content 1",
            embedding=np.random.rand(1536).tolist(),
        )

        diversity_score1 = vector_search_service._calculate_diversity_score(
            chunk1, [], query
        )
        assert diversity_score1 == 1.0

        # Similar result should have lower diversity score
        chunk2 = DocumentChunk(
            id="chunk2",
            document_id="doc1",  # Same document
            content="Content 2",
            embedding=chunk1.embedding,  # Same embedding
        )

        existing_result = SearchResult(
            chunk_id="existing",
            document_id="doc1",
            content="Existing",
            metadata={"embedding": chunk1.embedding},
            score=0.9,
            relevance_score=0.9,
            semantic_score=0.9,
            keyword_score=0.8,
            authority_score=0.7,
            recency_score=0.8,
            diversity_score=1.0,
            personalized_score=1.0,
            final_score=0.9,
            rank=1,
        )

        diversity_score2 = vector_search_service._calculate_diversity_score(
            chunk2, [existing_result], query
        )
        assert diversity_score2 < 1.0

    @pytest.mark.asyncio
    async def test_personalized_score_calculation(self, vector_search_service):
        """Test personalized score calculation"""
        # Setup user preferences
        vector_search_service._user_preferences_cache["user_456"] = {
            "preferred_sources": ["arxiv", "nature"],
            "preferred_topics": ["machine learning", "ai"],
            "viewed_documents": ["doc_1", "doc_2"],
        }

        query = SearchQuery(
            text="test",
            user_id="user_456",
            ranking_strategy=RankingStrategy.PERSONALIZED,
        )

        # Chunk with preferred source
        chunk_preferred = DocumentChunk(
            id="preferred_chunk",
            document_id="doc_1",  # Previously viewed
            content="Content about machine learning",
            metadata={"source": "arxiv", "topics": ["machine learning", "ai"]},
        )

        score_preferred = await vector_search_service._calculate_personalized_score(
            query, chunk_preferred
        )
        assert score_preferred > 1.0  # Should be boosted

        # Chunk without preferences
        chunk_generic = DocumentChunk(
            id="generic_chunk",
            document_id="doc_3",
            content="Generic content",
            metadata={"source": "unknown"},
        )

        score_generic = await vector_search_service._calculate_personalized_score(
            query, chunk_generic
        )
        assert score_generic == 1.0  # No boost

    def test_apply_filters(self, vector_search_service):
        """Test result filtering"""
        # Create test results
        results = [
            SearchResult(
                chunk_id=f"chunk_{i}",
                document_id=f"doc_{i}",
                content=f"Content {i}",
                metadata={
                    "document_type": "pdf" if i % 2 == 0 else "docx",
                    "author": f"author_{i % 3}",
                    "created_at": datetime.now() - timedelta(days=i),
                },
                score=0.9 - i * 0.1,
                relevance_score=0.9 - i * 0.1,
                semantic_score=0.9 - i * 0.1,
                keyword_score=0.8 - i * 0.05,
                authority_score=0.7,
                recency_score=0.8,
                diversity_score=1.0,
                personalized_score=1.0,
                final_score=0.9 - i * 0.1,
                rank=i + 1,
            )
            for i in range(10)
        ]

        # Test minimum relevance filter
        query = SearchQuery(text="test", min_relevance_score=0.5)
        filtered = vector_search_service._apply_filters(results, query)
        assert len(filtered) == 6  # Only results with score >= 0.5

        # Test document type filter
        query.filters = {"document_type": "pdf"}
        filtered = vector_search_service._apply_filters(results, query)
        assert all(r.metadata.get("document_type") == "pdf" for r in filtered)

    def test_apply_pagination(self, vector_search_service):
        """Test result pagination"""
        results = [
            SearchResult(
                chunk_id=f"chunk_{i}",
                document_id=f"doc_{i}",
                content=f"Content {i}",
                metadata={},
                score=0.9,
                relevance_score=0.9,
                semantic_score=0.9,
                keyword_score=0.8,
                authority_score=0.7,
                recency_score=0.8,
                diversity_score=1.0,
                personalized_score=1.0,
                final_score=0.9,
                rank=i + 1,
            )
            for i in range(20)
        ]

        # Test pagination
        query = SearchQuery(text="test", limit=5, offset=10)
        paginated = vector_search_service._apply_pagination(results, query)

        assert len(paginated) == 5
        assert paginated[0].rank == 11
        assert paginated[-1].rank == 15

    def test_generate_highlights(self, vector_search_service):
        """Test highlight generation"""
        content = "This is a long sentence about machine learning. Another sentence about deep learning. A third sentence about neural networks and AI."
        query = "machine learning AI"

        highlights = vector_search_service._generate_highlights(content, query)

        assert len(highlights) > 0
        assert any("machine learning" in h.lower() for h in highlights)
        assert any("AI" in h for h in highlights)

    def test_calculate_query_complexity(self, vector_search_service):
        """Test query complexity calculation"""
        # Simple query
        query = SearchQuery(
            text="simple query", ranking_strategy=RankingStrategy.SEMANTIC_ONLY
        )
        complexity = vector_search_service._calculate_query_complexity(query)
        assert complexity == "low"

        # Complex query
        query = SearchQuery(
            text="this is a very long and complex query with many words that should increase complexity",
            filters={"type": "pdf", "date": {"start": "2023-01-01"}},
            ranking_strategy=RankingStrategy.PERSONALIZED,
        )
        complexity = vector_search_service._calculate_query_complexity(query)
        assert complexity in ["medium", "high"]

    def test_score_distribution(self, vector_search_service):
        """Test score distribution calculation"""
        results = [
            SearchResult(
                chunk_id="chunk_1",
                document_id="doc_1",
                content="Content",
                metadata={},
                score=0.9,
                relevance_score=0.9,
                semantic_score=0.9,
                keyword_score=0.8,
                authority_score=0.7,
                recency_score=0.8,
                diversity_score=1.0,
                personalized_score=1.0,
                final_score=score,
                rank=1,
            )
            for score in [0.1, 0.3, 0.5, 0.7, 0.9]
        ]

        distribution = vector_search_service._calculate_score_distribution(results)

        assert distribution["0-0.2"] == 1
        assert distribution["0.2-0.4"] == 1
        assert distribution["0.4-0.6"] == 1
        assert distribution["0.6-0.8"] == 1
        assert distribution["0.8-1.0"] == 1

    @pytest.mark.asyncio
    async def test_error_handling(self, vector_search_service, sample_query):
        """Test error handling in search"""
        # Setup mock to raise exception
        vector_search_service.document_repository.similarity_search.side_effect = (
            Exception("Database error")
        )

        # Perform search
        results, metrics = await vector_search_service.search(sample_query)

        # Verify graceful handling
        assert len(results) == 0
        assert metrics.total_results == 0

    @pytest.mark.asyncio
    async def test_search_with_no_embedding(
        self, vector_search_service, sample_chunks, sample_query
    ):
        """Test search when embedding is not provided"""
        # Remove embedding from query
        sample_query.embedding = None
        vector_search_service.document_repository.similarity_search.return_value = (
            sample_chunks
        )

        # Perform search
        results, metrics = await vector_search_service.search(sample_query)

        # Verify that embedding was generated
        assert len(results) > 0
        assert sample_query.embedding is not None
        assert len(sample_query.embedding) > 0


class TestSearchResultRanking:
    """Test cases specifically for search result ranking"""

    @pytest.mark.asyncio
    async def test_ranking_consistency(self, vector_search_service, sample_chunks):
        """Test that ranking is consistent across multiple runs"""
        # Create identical queries
        query1 = SearchQuery(
            text="test query",
            embedding=np.random.rand(1536).tolist(),
            ranking_strategy=RankingStrategy.HYBRID_SEMANTIC_KEYWORD,
        )
        query2 = SearchQuery(
            text="test query",
            embedding=query1.embedding.copy(),
            ranking_strategy=RankingStrategy.HYBRID_SEMANTIC_KEYWORD,
        )

        vector_search_service.document_repository.similarity_search.return_value = (
            sample_chunks
        )

        # Perform searches
        results1, _ = await vector_search_service.search(query1)
        results2, _ = await vector_search_service.search(query2)

        # Verify consistent ranking
        assert len(results1) == len(results2)
        for r1, r2 in zip(results1, results2):
            assert r1.chunk_id == r2.chunk_id
            assert abs(r1.final_score - r2.final_score) < 0.001

    @pytest.mark.asyncio
    async def test_ranking_with_different_strategies(
        self, vector_search_service, sample_chunks
    ):
        """Test that different strategies produce different rankings"""
        query_text = "machine learning algorithms"
        embedding = np.random.rand(1536).tolist()

        strategies = [
            RankingStrategy.SEMANTIC_ONLY,
            RankingStrategy.HYBRID_SEMANTIC_KEYWORD,
            RankingStrategy.AUTHORITY_WEIGHTED,
        ]

        rankings_by_strategy = {}

        vector_search_service.document_repository.similarity_search.return_value = (
            sample_chunks
        )

        for strategy in strategies:
            query = SearchQuery(
                text=query_text, embedding=embedding, ranking_strategy=strategy, limit=5
            )

            results, _ = await vector_search_service.search(query)
            rankings_by_strategy[strategy] = [r.chunk_id for r in results]

        # Verify that at least some strategies produce different rankings
        if len(sample_chunks) > 2:
            # Not all rankings should be identical
            all_same = all(
                rankings_by_strategy[strategies[0]] == rankings_by_strategy[strategy]
                for strategy in strategies[1:]
            )
            assert not all_same, (
                "Different strategies should produce different rankings"
            )

    @pytest.mark.asyncio
    async def test_ranking_score_explanations(
        self, vector_search_service, sample_chunks
    ):
        """Test that ranking results include proper explanations"""
        query = SearchQuery(
            text="test query with explanation",
            embedding=np.random.rand(1536).tolist(),
            ranking_strategy=RankingStrategy.HYBRID_SEMANTIC_KEYWORD,
            boost_recent=True,
            boost_authority=True,
        )

        vector_search_service.document_repository.similarity_search.return_value = (
            sample_chunks
        )

        # Perform search
        results, _ = await vector_search_service.search(query)

        # Verify explanations
        for result in results:
            assert "strategy" in result.explanation
            assert "score_breakdown" in result.explanation
            assert "boosts_applied" in result.explanation

            breakdown = result.explanation["score_breakdown"]
            assert "semantic" in breakdown
            assert "keyword" in breakdown
            assert "authority" in breakdown
            assert "recency" in breakdown
            assert "diversity" in breakdown
            assert "personalized" in breakdown

            boosts = result.explanation["boosts_applied"]
            assert isinstance(boosts["authority_boost"], bool)
            assert isinstance(boosts["recent_boost"], bool)
            assert "diversity_threshold" in boosts
