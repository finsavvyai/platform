"""
Integration Tests for Vector Search Service with Ranking

These tests verify the complete vector search pipeline including
search, ranking, monitoring, and API integration.
"""

import pytest
import asyncio
import numpy as np
from datetime import datetime, timedelta
from httpx import AsyncClient
from unittest.mock import patch, AsyncMock, MagicMock

from app.main import app
from app.services.vector_search_service import (
    VectorSearchService,
    SearchQuery,
    RankingStrategy,
)
from app.services.search_monitoring_service import SearchMonitoringService
from app.models.document import DocumentChunk
from app.models.user import User


@pytest.fixture
async def test_client():
    """Test client for API testing"""
    async with AsyncClient(app=app, base_url="http://test") as client:
        yield client


@pytest.fixture
def mock_user():
    """Mock authenticated user"""
    return User(
        id="user_123",
        email="test@example.com",
        tenant_id="tenant_456",
        is_admin=False,
        created_at=datetime.now(),
    )


@pytest.fixture
def mock_admin_user():
    """Mock admin user"""
    return User(
        id="admin_123",
        email="admin@example.com",
        tenant_id="tenant_456",
        is_admin=True,
        created_at=datetime.now(),
    )


@pytest.fixture
def sample_document_chunks():
    """Sample document chunks for testing"""
    chunks = []

    # Create documents with varying properties for testing ranking
    documents_data = [
        {
            "id": "doc_1",
            "content": "Machine learning algorithms are computational methods that allow computers to learn patterns from data without being explicitly programmed.",
            "metadata": {
                "title": "Introduction to Machine Learning",
                "author": "Dr. Smith",
                "source_type": "peer_reviewed",
                "citation_count": 250,
                "rating": 4.8,
                "author_verified": True,
                "topics": ["machine learning", "algorithms", "AI"],
                "created_at": (datetime.now() - timedelta(days=30)).isoformat(),
            },
            "created_at": datetime.now() - timedelta(days=30),
        },
        {
            "id": "doc_2",
            "content": "Deep learning is a subset of machine learning that uses neural networks with multiple layers to analyze various factors of data.",
            "metadata": {
                "title": "Deep Learning Fundamentals",
                "author": "Prof. Johnson",
                "source_type": "peer_reviewed",
                "citation_count": 180,
                "rating": 4.6,
                "author_verified": True,
                "topics": ["deep learning", "neural networks", "AI"],
                "created_at": (datetime.now() - timedelta(days=60)).isoformat(),
            },
            "created_at": datetime.now() - timedelta(days=60),
        },
        {
            "id": "doc_3",
            "content": "Natural language processing (NLP) is a branch of artificial intelligence that helps computers understand and interpret human language.",
            "metadata": {
                "title": "NLP Overview",
                "author": "Dr. Williams",
                "source_type": "internal",
                "citation_count": 50,
                "rating": 4.2,
                "author_verified": False,
                "topics": ["NLP", "language processing", "AI"],
                "created_at": (datetime.now() - timedelta(days=90)).isoformat(),
            },
            "created_at": datetime.now() - timedelta(days=90),
        },
        {
            "id": "doc_4",
            "content": "Computer vision enables machines to interpret and understand visual information from the world, such as images and videos.",
            "metadata": {
                "title": "Computer Vision Applications",
                "author": "Tech Corp",
                "source_type": "blog",
                "citation_count": 25,
                "rating": 3.8,
                "author_verified": False,
                "topics": ["computer vision", "image processing", "AI"],
                "created_at": (datetime.now() - timedelta(days=5)).isoformat(),
            },
            "created_at": datetime.now() - timedelta(days=5),
        },
        {
            "id": "doc_5",
            "content": "Reinforcement learning is a type of machine learning where an agent learns to make decisions by performing actions and receiving rewards or penalties.",
            "metadata": {
                "title": "Reinforcement Learning Guide",
                "author": "Dr. Brown",
                "source_type": "peer_reviewed",
                "citation_count": 120,
                "rating": 4.5,
                "author_verified": True,
                "topics": ["reinforcement learning", "decision making", "AI"],
                "created_at": (datetime.now() - timedelta(days=1)).isoformat(),
            },
            "created_at": datetime.now() - timedelta(days=1),
        },
    ]

    for i, doc_data in enumerate(documents_data):
        # Create chunks for each document
        chunk = DocumentChunk(
            id=f"chunk_{i + 1}",
            document_id=doc_data["id"],
            content=doc_data["content"],
            metadata=doc_data["metadata"],
            embedding=np.random.rand(1536).tolist(),  # Random embeddings
            created_at=doc_data["created_at"],
        )
        chunks.append(chunk)

    return chunks


@pytest.fixture
def vector_search_service():
    """Vector search service instance"""

    mock_repo = AsyncMock()
    service = VectorSearchService(mock_repo)
    return service


@pytest.fixture
def search_monitoring_service():
    """Search monitoring service instance"""
    return SearchMonitoringService()


class TestVectorSearchIntegration:
    """Integration tests for vector search"""

    @pytest.mark.asyncio
    async def test_end_to_end_search_pipeline(
        self, test_client, mock_user, sample_document_chunks
    ):
        """Test complete search pipeline through API"""

        # Mock authentication
        with patch("app.api.dependencies.get_current_user", return_value=mock_user):
            # Mock document repository
            with patch("app.api.dependencies.get_document_repository") as mock_repo_dep:
                mock_repo = AsyncMock()
                mock_repo.similarity_search.return_value = sample_document_chunks
                mock_repo_dep.return_value = mock_repo

                # Perform search request
                search_request = {
                    "query": "machine learning algorithms",
                    "limit": 5,
                    "ranking_strategy": "hybrid_semantic_keyword",
                    "include_explanations": True,
                }

                response = await test_client.post(
                    "/api/v1/search/query", json=search_request
                )

                # Verify response
                assert response.status_code == 200
                data = response.json()

                assert data["success"] is True
                assert "results" in data["data"]
                assert len(data["data"]["results"]) <= 5
                assert "metrics" in data

                # Verify result structure
                result = data["data"]["results"][0]
                assert "chunk_id" in result
                assert "document_id" in result
                assert "content" in result
                assert "score" in result
                assert "rank" in result
                assert "score_breakdown" in result
                assert "highlights" in result

                # Verify metrics
                metrics = data["metrics"]
                assert "search_time_ms" in metrics
                assert "ranking_time_ms" in metrics
                assert "total_time_ms" in metrics
                assert "cache_hit" in metrics
                assert "query_complexity" in metrics

    @pytest.mark.asyncio
    async def test_different_ranking_strategies(
        self, vector_search_service, sample_document_chunks
    ):
        """Test that different ranking strategies produce different results"""

        # Setup mock repository
        vector_search_service.document_repository.similarity_search.return_value = (
            sample_document_chunks
        )

        strategies = [
            RankingStrategy.SEMANTIC_ONLY,
            RankingStrategy.HYBRID_SEMANTIC_KEYWORD,
            RankingStrategy.AUTHORITY_WEIGHTED,
            RankingStrategy.RECENCY_WEIGHTED,
        ]

        query_text = "artificial intelligence and machine learning"
        embedding = np.random.rand(1536).tolist()

        results_by_strategy = {}

        for strategy in strategies:
            query = SearchQuery(
                text=query_text,
                embedding=embedding,
                ranking_strategy=strategy,
                limit=5,
                tenant_id="tenant_456",
            )

            results, _ = await vector_search_service.search(query)
            results_by_strategy[strategy] = [r.chunk_id for r in results]

        # Verify that strategies produce different rankings
        # At least some strategies should differ
        all_same = all(
            results_by_strategy[strategies[0]] == results_by_strategy[strategy]
            for strategy in strategies[1:]
        )
        assert not all_same, "Different strategies should produce different rankings"

    @pytest.mark.asyncio
    async def test_search_with_filters(
        self, test_client, mock_user, sample_document_chunks
    ):
        """Test search with document filters"""

        with patch("app.api.dependencies.get_current_user", return_value=mock_user):
            with patch("app.api.dependencies.get_document_repository") as mock_repo_dep:
                mock_repo = AsyncMock()
                mock_repo.similarity_search.return_value = sample_document_chunks
                mock_repo_dep.return_value = mock_repo

                # Search with filters
                search_request = {
                    "query": "AI",
                    "filters": {"source_type": "peer_reviewed", "min_rating": 4.5},
                    "limit": 10,
                }

                response = await test_client.post(
                    "/api/v1/search/query", json=search_request
                )

                assert response.status_code == 200
                data = response.json()

                # Verify that results respect filters
                # (In real implementation, this would be enforced by the repository)
                assert len(data["data"]["results"]) > 0

    @pytest.mark.asyncio
    async def test_search_monitoring_integration(
        self, search_monitoring_service, vector_search_service, sample_document_chunks
    ):
        """Test integration between search service and monitoring"""

        # Setup
        vector_search_service.document_repository.similarity_search.return_value = (
            sample_document_chunks
        )

        # Perform multiple searches
        queries = [
            ("machine learning", RankingStrategy.HYBRID_SEMANTIC_KEYWORD),
            ("deep learning", RankingStrategy.AUTHORITY_WEIGHTED),
            ("neural networks", RankingStrategy.RECENCY_WEIGHTED),
        ]

        for query_text, strategy in queries:
            query = SearchQuery(
                text=query_text,
                embedding=np.random.rand(1536).tolist(),
                ranking_strategy=strategy,
                limit=5,
                tenant_id="tenant_456",
                user_id="user_123",
            )

            results, metrics = await vector_search_service.search(query)

            # Record the search
            await search_monitoring_service.record_search(
                query_text=query_text,
                metrics=metrics,
                results=results,
                tenant_id="tenant_456",
                user_id="user_123",
                ranking_strategy=strategy.value,
            )

        # Get analytics
        analytics = await search_monitoring_service.get_analytics("1h")

        # Verify analytics
        assert analytics.total_queries == 3
        assert analytics.successful_queries == 3
        assert analytics.ranking_strategy_usage[strategy.value] == 1
        assert analytics.average_search_time_ms > 0

        # Check for alerts
        alerts = await search_monitoring_service.get_active_alerts()
        # Should have no alerts for normal performance
        critical_alerts = [a for a in alerts if a.severity.value == "critical"]
        assert len(critical_alerts) == 0

    @pytest.mark.asyncio
    async def test_performance_alert_generation(self, search_monitoring_service):
        """Test that performance alerts are generated for poor performance"""

        # Simulate slow searches
        slow_metrics = MagicMock()
        slow_metrics.search_time_ms = 600.0  # Above threshold
        slow_metrics.ranking_time_ms = 50.0
        slow_metrics.total_time_ms = 650.0
        slow_metrics.cache_hit = False
        slow_metrics.average_score = 0.3
        slow_metrics.query_complexity = "high"

        # Record slow search
        await search_monitoring_service.record_search(
            query_text="test query",
            metrics=slow_metrics,
            results=[],
            tenant_id="tenant_456",
            user_id="user_123",
        )

        # Check for alerts
        alerts = await search_monitoring_service.get_active_alerts()

        # Should have high latency alert
        latency_alerts = [a for a in alerts if "latency" in a.message.lower()]
        assert len(latency_alerts) > 0

        # Should have low relevance alert
        relevance_alerts = [a for a in alerts if "relevance" in a.message.lower()]
        assert len(relevance_alerts) > 0

    @pytest.mark.asyncio
    async def test_search_api_analytics_endpoint(self, test_client, mock_user):
        """Test search analytics API endpoint"""

        with patch("app.api.dependencies.get_current_user", return_value=mock_user):
            response = await test_client.get("/api/v1/search/analytics?time_period=24h")

            assert response.status_code == 200
            data = response.json()

            assert data["success"] is True
            assert "data" in data
            assert "summary" in data["data"]
            assert "performance" in data["data"]
            assert "insights" in data["data"]
            assert "alerts" in data["data"]

            # Verify summary structure
            summary = data["data"]["summary"]
            assert "total_queries" in summary
            assert "success_rate" in summary
            assert "error_rate" in summary

            # Verify performance structure
            performance = data["data"]["performance"]
            assert "average_search_time_ms" in performance
            assert "cache_hit_rate" in performance
            assert "average_relevance_score" in performance

    @pytest.mark.asyncio
    async def test_search_health_endpoint(self, test_client):
        """Test search health check endpoint"""

        response = await test_client.get("/api/v1/search/health")

        assert response.status_code == 200
        data = response.json()

        assert data["success"] is True
        assert "data" in data
        assert "status" in data["data"]
        assert "components" in data["data"]
        assert "metrics" in data["data"]

        # Verify health status
        health_data = data["data"]
        assert health_data["status"] in ["healthy", "degraded", "unhealthy"]

        # Verify component health
        components = health_data["components"]
        assert "vector_index" in components
        assert "cache" in components
        assert "search_engine" in components

    @pytest.mark.asyncio
    async def test_ranking_strategies_endpoint(self, test_client):
        """Test ranking strategies information endpoint"""

        response = await test_client.get("/api/v1/search/strategies")

        assert response.status_code == 200
        data = response.json()

        assert data["success"] is True
        assert "strategies" in data["data"]
        assert "default" in data["data"]

        strategies = data["data"]["strategies"]

        # Verify all expected strategies are present
        expected_strategies = [
            "semantic_only",
            "hybrid_semantic_keyword",
            "personalized",
            "recency_weighted",
            "authority_weighted",
            "diversity_weighted",
        ]

        for strategy in expected_strategies:
            assert strategy in strategies
            assert "name" in strategies[strategy]
            assert "description" in strategies[strategy]
            assert "use_cases" in strategies[strategy]
            assert "performance" in strategies[strategy]
            assert "accuracy" in strategies[strategy]

    @pytest.mark.asyncio
    async def test_search_error_handling(self, test_client, mock_user):
        """Test search API error handling"""

        with patch("app.api.dependencies.get_current_user", return_value=mock_user):
            # Test with invalid query
            invalid_request = {
                "query": "",  # Empty query
                "limit": 5,
            }

            response = await test_client.post(
                "/api/v1/search/query", json=invalid_request
            )

            # Should return validation error
            assert response.status_code == 422

            # Test with invalid filters
            invalid_filters = {"query": "test", "filters": {"invalid_filter": "value"}}

            response = await test_client.post(
                "/api/v1/search/query", json=invalid_filters
            )

            # Should return validation error
            assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_search_caching_behavior(
        self, vector_search_service, sample_document_chunks
    ):
        """Test search result caching"""

        # Setup
        vector_search_service.document_repository.similarity_search.return_value = (
            sample_document_chunks
        )

        # Create identical queries
        query_text = "caching test query"
        embedding = np.random.rand(1536).tolist()

        query1 = SearchQuery(
            text=query_text,
            embedding=embedding,
            ranking_strategy=RankingStrategy.HYBRID_SEMANTIC_KEYWORD,
            search_mode="fast",  # Enable caching
            limit=5,
            tenant_id="tenant_456",
        )

        query2 = SearchQuery(
            text=query_text,
            embedding=embedding,
            ranking_strategy=RankingStrategy.HYBRID_SEMANTIC_KEYWORD,
            search_mode="fast",
            limit=5,
            tenant_id="tenant_456",
        )

        # First search
        results1, metrics1 = await vector_search_service.search(query1)

        # Verify cache miss
        assert metrics1.cache_hit is False

        # Second search (should hit cache)
        results2, metrics2 = await vector_search_service.search(query2)

        # Verify cache hit
        assert metrics2.cache_hit is True
        assert metrics2.search_time_ms < 5.0  # Should be very fast from cache

        # Verify results are identical
        assert len(results1) == len(results2)
        for r1, r2 in zip(results1, results2):
            assert r1.chunk_id == r2.chunk_id
            assert r1.final_score == r2.final_score

    @pytest.mark.asyncio
    async def test_search_pagination(
        self, test_client, mock_user, sample_document_chunks
    ):
        """Test search result pagination"""

        with patch("app.api.dependencies.get_current_user", return_value=mock_user):
            with patch("app.api.dependencies.get_document_repository") as mock_repo_dep:
                mock_repo = AsyncMock()
                mock_repo.similarity_search.return_value = sample_document_chunks
                mock_repo_dep.return_value = mock_repo

                # First page
                search_request = {"query": "test pagination", "limit": 2, "offset": 0}

                response1 = await test_client.post(
                    "/api/v1/search/query", json=search_request
                )

                assert response1.status_code == 200
                data1 = response1.json()

                assert len(data1["data"]["results"]) == 2
                assert data1["data"]["offset"] == 0
                assert data1["data"]["limit"] == 2

                # Second page
                search_request["offset"] = 2

                response2 = await test_client.post(
                    "/api/v1/search/query", json=search_request
                )

                assert response2.status_code == 200
                data2 = response2.json()

                assert len(data2["data"]["results"]) <= 2
                assert data2["data"]["offset"] == 2

                # Verify different results on different pages
                if len(data2["data"]["results"]) > 0:
                    page1_ids = {r["chunk_id"] for r in data1["data"]["results"]}
                    page2_ids = {r["chunk_id"] for r in data2["data"]["results"]}
                    assert len(page1_ids.intersection(page2_ids)) == 0

    @pytest.mark.asyncio
    async def test_personalized_search(
        self, vector_search_service, sample_document_chunks
    ):
        """Test personalized search ranking"""

        # Setup user preferences
        user_id = "user_123"
        vector_search_service._user_preferences_cache[user_id] = {
            "preferred_sources": ["peer_reviewed"],
            "preferred_topics": ["machine learning"],
            "viewed_documents": ["doc_1"],
        }

        # Setup mock repository
        vector_search_service.document_repository.similarity_search.return_value = (
            sample_document_chunks
        )

        # Perform personalized search
        query = SearchQuery(
            text="machine learning",
            embedding=np.random.rand(1536).tolist(),
            ranking_strategy=RankingStrategy.PERSONALIZED,
            limit=5,
            tenant_id="tenant_456",
            user_id=user_id,
        )

        results, _ = await vector_search_service.search(query)

        # Verify personalization was applied
        for result in results:
            # Check if viewed documents get a boost
            if result.document_id in ["doc_1"]:
                assert result.personalized_score > 1.0

            # Check if preferred sources get a boost
            metadata = result.metadata
            if metadata.get("source_type") == "peer_reviewed":
                assert result.personalized_score > 1.0


class TestSearchPerformanceIntegration:
    """Performance-focused integration tests"""

    @pytest.mark.asyncio
    async def test_concurrent_searches(
        self, vector_search_service, sample_document_chunks
    ):
        """Test handling of concurrent searches"""

        # Setup
        vector_search_service.document_repository.similarity_search.return_value = (
            sample_document_chunks
        )

        # Create multiple concurrent searches
        async def perform_search(query_id):
            query = SearchQuery(
                text=f"concurrent search query {query_id}",
                embedding=np.random.rand(1536).tolist(),
                limit=5,
                tenant_id=f"tenant_{query_id % 5}",
            )
            return await vector_search_service.search(query)

        # Run 10 concurrent searches
        tasks = [perform_search(i) for i in range(10)]
        results = await asyncio.gather(*tasks)

        # Verify all searches completed successfully
        assert len(results) == 10
        for search_results, metrics in results:
            assert len(search_results) > 0
            assert metrics.search_time_ms > 0

    @pytest.mark.asyncio
    async def test_large_result_set_handling(self, vector_search_service):
        """Test handling of large result sets"""

        # Create large number of chunks
        large_chunk_set = []
        for i in range(1000):
            chunk = DocumentChunk(
                id=f"chunk_{i}",
                document_id=f"doc_{i % 100}",
                content=f"Content chunk {i} with searchable text",
                metadata={"index": i},
                embedding=np.random.rand(1536).tolist(),
                created_at=datetime.now() - timedelta(days=i % 365),
            )
            large_chunk_set.append(chunk)

        # Setup mock repository
        vector_search_service.document_repository.similarity_search.return_value = (
            large_chunk_set
        )

        # Perform search with limits
        query = SearchQuery(
            text="search test",
            embedding=np.random.rand(1536).tolist(),
            limit=50,  # Small limit from large set
            tenant_id="tenant_large",
        )

        results, metrics = await vector_search_service.search(query)

        # Verify proper pagination
        assert len(results) <= 50
        assert metrics.total_results == 1000

        # Verify ranking was applied to all results before pagination
        assert all(hasattr(r, "rank") for r in results)
        assert results[0].rank == 1
        assert results[-1].rank <= 50
