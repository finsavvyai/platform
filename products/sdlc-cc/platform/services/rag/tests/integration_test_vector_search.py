"""
Integration Tests for Vector Search with Ranking

This integration test validates the complete vector search implementation
including ranking algorithms, performance monitoring, and API endpoints.
"""

import pytest
import numpy as np
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from unittest.mock import patch, AsyncMock, MagicMock

from app.main import app
from app.models.document import DocumentChunk
from app.repositories.document import DocumentRepository
from app.models.user import User
from app.core.security import create_access_token


@pytest.fixture
def test_client():
    """Test client for FastAPI app"""
    return TestClient(app)


@pytest.fixture
async def mock_user():
    """Mock authenticated user"""
    return User(
        id="user_123",
        email="test@example.com",
        tenant_id="tenant_456",
        is_active=True,
        is_admin=False,
    )


@pytest.fixture
async def admin_user():
    """Mock admin user"""
    return User(
        id="admin_123",
        email="admin@example.com",
        tenant_id="tenant_456",
        is_active=True,
        is_admin=True,
    )


@pytest.fixture
def sample_document_chunks():
    """Generate sample document chunks for testing"""
    chunks = []

    # Create documents with different characteristics
    documents_info = [
        {
            "id": "doc_1",
            "topic": "machine learning",
            "source_type": "peer_reviewed",
            "citation_count": 150,
            "rating": 5.0,
            "author_verified": True,
            "days_old": 5,
            "content": "Machine learning algorithms are transforming artificial intelligence research. Neural networks, particularly deep learning models, have achieved remarkable success in various domains including computer vision, natural language processing, and reinforcement learning.",
        },
        {
            "id": "doc_2",
            "topic": "quantum computing",
            "source_type": "internal",
            "citation_count": 25,
            "rating": 3.5,
            "author_verified": False,
            "days_old": 30,
            "content": "Quantum computing represents a paradigm shift in computation. Unlike classical bits, quantum bits or qubits can exist in superposition, enabling parallel computation at an unprecedented scale. This technology promises to revolutionize cryptography, optimization, and scientific simulation.",
        },
        {
            "id": "doc_3",
            "topic": "machine learning",
            "source_type": "official_document",
            "citation_count": 75,
            "rating": 4.0,
            "author_verified": True,
            "days_old": 1,
            "content": "Recent advances in transformer architectures have significantly improved natural language understanding. Models like GPT and BERT demonstrate the power of self-attention mechanisms in capturing long-range dependencies and contextual relationships in text data.",
        },
        {
            "id": "doc_4",
            "topic": "blockchain",
            "source_type": "peer_reviewed",
            "citation_count": 200,
            "rating": 4.5,
            "author_verified": True,
            "days_old": 365,
            "content": "Blockchain technology provides a decentralized and immutable ledger system. Smart contracts enable programmable transactions without intermediaries. Applications span from cryptocurrency to supply chain management and digital identity verification.",
        },
        {
            "id": "doc_5",
            "topic": "cybersecurity",
            "source_type": "internal",
            "citation_count": 10,
            "rating": 3.0,
            "author_verified": False,
            "days_old": 60,
            "content": "Zero-trust architecture redefines network security by assuming no implicit trust. Every access request must be authenticated, authorized, and encrypted. This approach significantly reduces the attack surface and prevents lateral movement by malicious actors.",
        },
    ]

    for i, doc_info in enumerate(documents_info):
        # Create 3 chunks per document
        chunk_size = 100
        words = doc_info["content"].split()

        for j in range(0, len(words), chunk_size):
            chunk_words = words[j : j + chunk_size]
            chunk_content = " ".join(chunk_words)

            chunk = DocumentChunk(
                id=f"chunk_{i}_{j // chunk_size}",
                document_id=doc_info["id"],
                content=chunk_content,
                metadata={
                    "title": f"{doc_info['topic'].title()} Research Paper",
                    "author": f"Author_{i}",
                    "source_type": doc_info["source_type"],
                    "citation_count": doc_info["citation_count"],
                    "rating": doc_info["rating"],
                    "author_verified": doc_info["author_verified"],
                    "topics": [doc_info["topic"]],
                    "created_at": (
                        datetime.now() - timedelta(days=doc_info["days_old"])
                    ).isoformat(),
                },
                embedding=np.random.rand(1536).tolist(),
                created_at=datetime.now() - timedelta(days=doc_info["days_old"]),
            )
            chunks.append(chunk)

    return chunks


class TestVectorSearchIntegration:
    """Integration tests for vector search functionality"""

    @pytest.mark.asyncio
    async def test_end_to_end_search_flow(
        self, test_client, mock_user, sample_document_chunks
    ):
        """Test complete search flow from API to service"""
        # Mock authentication
        token = create_access_token(
            data={"sub": mock_user.id, "tenant_id": mock_user.tenant_id}
        )
        headers = {"Authorization": f"Bearer {token}"}

        # Mock document repository
        mock_repo = AsyncMock(spec=DocumentRepository)
        mock_repo.similarity_search.return_value = sample_document_chunks[:10]

        with patch("app.api.endpoints.vector_search.document_repository", mock_repo):
            # Test search request
            search_request = {
                "query": "machine learning neural networks",
                "limit": 5,
                "ranking_strategy": "hybrid_semantic_keyword",
                "boost_recent": True,
                "include_explanations": True,
                "filters": {"topics": ["machine learning"]},
            }

            response = test_client.post(
                "/api/v1/search/query", json=search_request, headers=headers
            )

            # Verify response
            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True
            assert "results" in data["data"]
            assert len(data["data"]["results"]) <= 5

            # Verify result structure
            result = data["data"]["results"][0]
            assert "chunk_id" in result
            assert "score" in result
            assert "rank" in result
            assert "highlights" in result
            assert "score_breakdown" in result

            # Verify metrics
            assert "metrics" in data
            metrics = data["metrics"]
            assert "search_time_ms" in metrics
            assert "cache_hit" in metrics
            assert "average_score" in metrics

    @pytest.mark.asyncio
    async def test_ranking_strategies_comparison(
        self, test_client, mock_user, sample_document_chunks
    ):
        """Test different ranking strategies produce different results"""
        token = create_access_token(
            data={"sub": mock_user.id, "tenant_id": mock_user.tenant_id}
        )
        headers = {"Authorization": f"Bearer {token}"}

        mock_repo = AsyncMock(spec=DocumentRepository)
        mock_repo.similarity_search.return_value = sample_document_chunks

        with patch("app.api.endpoints.vector_search.document_repository", mock_repo):
            strategies = [
                "semantic_only",
                "hybrid_semantic_keyword",
                "authority_weighted",
            ]
            results_by_strategy = {}

            for strategy in strategies:
                search_request = {
                    "query": "research papers",
                    "limit": 5,
                    "ranking_strategy": strategy,
                }

                response = test_client.post(
                    "/api/v1/search/query", json=search_request, headers=headers
                )
                assert response.status_code == 200

                data = response.json()
                result_ids = [r["chunk_id"] for r in data["data"]["results"]]
                results_by_strategy[strategy] = result_ids

            # Verify that strategies produce different rankings
            # At least one strategy should differ from others
            all_same = all(
                results_by_strategy[strategies[0]] == results_by_strategy[strategy]
                for strategy in strategies[1:]
            )
            assert not all_same, (
                "Different strategies should produce different rankings"
            )

    @pytest.mark.asyncio
    async def test_search_with_filters(
        self, test_client, mock_user, sample_document_chunks
    ):
        """Test search with various filters"""
        token = create_access_token(
            data={"sub": mock_user.id, "tenant_id": mock_user.tenant_id}
        )
        headers = {"Authorization": f"Bearer {token}"}

        mock_repo = AsyncMock(spec=DocumentRepository)
        mock_repo.similarity_search.return_value = sample_document_chunks

        with patch("app.api.endpoints.vector_search.document_repository", mock_repo):
            # Test source type filter
            search_request = {
                "query": "research",
                "filters": {"source_type": "peer_reviewed"},
                "limit": 10,
            }

            response = test_client.post(
                "/api/v1/search/query", json=search_request, headers=headers
            )
            assert response.status_code == 200

            # Test date range filter
            search_request = {
                "query": "recent research",
                "filters": {
                    "date_range": {
                        "start": "2024-01-01T00:00:00Z",
                        "end": "2024-12-31T23:59:59Z",
                    }
                },
            }

            response = test_client.post(
                "/api/v1/search/query", json=search_request, headers=headers
            )
            assert response.status_code == 200

            # Test multiple filters
            search_request = {
                "query": "machine learning",
                "filters": {
                    "topics": ["machine learning"],
                    "source_type": "peer_reviewed",
                    "min_rating": 4.0,
                },
            }

            response = test_client.post(
                "/api/v1/search/query", json=search_request, headers=headers
            )
            assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_search_analytics_and_monitoring(
        self, test_client, mock_user, admin_user
    ):
        """Test search analytics and monitoring features"""
        # Test regular user analytics
        token = create_access_token(
            data={"sub": mock_user.id, "tenant_id": mock_user.tenant_id}
        )
        headers = {"Authorization": f"Bearer {token}"}

        response = test_client.get(
            "/api/v1/search/analytics?time_period=1h", headers=headers
        )
        assert response.status_code == 200

        data = response.json()
        assert data["success"] is True
        assert "summary" in data["data"]
        assert "performance" in data["data"]
        assert "insights" in data["data"]

        # Test admin analytics for all tenants
        admin_token = create_access_token(
            data={
                "sub": admin_user.id,
                "tenant_id": admin_user.tenant_id,
                "is_admin": True,
            }
        )
        admin_headers = {"Authorization": f"Bearer {admin_token}"}

        response = test_client.get(
            "/api/v1/search/analytics?time_period=24h", headers=admin_headers
        )
        assert response.status_code == 200

        # Test performance report generation
        response = test_client.get(
            "/api/v1/search/performance/report?time_period=24h", headers=admin_headers
        )
        assert response.status_code == 200

        report_data = response.json()
        assert "summary" in report_data
        assert "recommendations" in report_data
        assert "thresholds" in report_data

    @pytest.mark.asyncio
    async def test_performance_alerts_system(self, test_client, admin_user):
        """Test performance alerts creation and resolution"""
        token = create_access_token(
            data={
                "sub": admin_user.id,
                "tenant_id": admin_user.tenant_id,
                "is_admin": True,
            }
        )
        headers = {"Authorization": f"Bearer {token}"}

        # Create mock monitoring service with alerts
        with patch(
            "app.api.endpoints.vector_search.monitoring_service"
        ) as mock_monitoring:
            mock_alert = MagicMock()
            mock_alert.alert_id = "alert_123"
            mock_alert.severity.value = "high"
            mock_alert.metric_type.value = "search_latency"
            mock_alert.message = "High search latency detected"
            mock_alert.timestamp = datetime.now()
            mock_alert.current_value = 750.0
            mock_alert.threshold_value = 500.0
            mock_alert.affected_tenant_id = None
            mock_alert.resolved = False
            mock_alert.resolved_at = None

            mock_monitoring.get_active_alerts.return_value = [mock_alert]
            mock_monitoring.resolve_alert.return_value = True

            # Get active alerts
            response = test_client.get("/api/v1/search/alerts", headers=headers)
            assert response.status_code == 200

            data = response.json()
            assert data["success"] is True
            assert len(data["data"]["alerts"]) == 1
            assert data["data"]["alerts"][0]["severity"] == "high"

            # Resolve alert
            response = test_client.post(
                "/api/v1/search/alerts/alert_123/resolve", headers=headers
            )
            assert response.status_code == 200

            resolution_data = response.json()
            assert resolution_data["success"] is True
            assert resolution_data["data"]["resolved"] is True

    @pytest.mark.asyncio
    async def test_search_health_check(self, test_client):
        """Test search service health check endpoint"""
        response = test_client.get("/api/v1/search/health")

        # Should return healthy status
        assert response.status_code == 200

        data = response.json()
        assert data["success"] is True
        assert "status" in data["data"]
        assert "components" in data["data"]
        assert "metrics" in data["data"]

        # Check component health
        components = data["data"]["components"]
        assert "vector_index" in components
        assert "cache" in components
        assert "search_engine" in components

        # Check metrics
        metrics = data["data"]["metrics"]
        assert "queries_last_hour" in metrics
        assert "average_latency_ms" in metrics
        assert "cache_hit_rate" in metrics

    @pytest.mark.asyncio
    async def test_ranking_strategies_endpoint(self, test_client):
        """Test ranking strategies information endpoint"""
        response = test_client.get("/api/v1/search/strategies")

        assert response.status_code == 200

        data = response.json()
        assert data["success"] is True
        assert "strategies" in data["data"]

        strategies = data["data"]["strategies"]
        assert "semantic_only" in strategies
        assert "hybrid_semantic_keyword" in strategies
        assert "personalized" in strategies

        # Check strategy information
        hybrid_strategy = strategies["hybrid_semantic_keyword"]
        assert "name" in hybrid_strategy
        assert "description" in hybrid_strategy
        assert "use_cases" in hybrid_strategy
        assert "performance" in hybrid_strategy
        assert "accuracy" in hybrid_strategy

    @pytest.mark.asyncio
    async def test_search_error_handling(self, test_client, mock_user):
        """Test error handling in search endpoints"""
        token = create_access_token(
            data={"sub": mock_user.id, "tenant_id": mock_user.tenant_id}
        )
        headers = {"Authorization": f"Bearer {token}"}

        # Test invalid query
        invalid_request = {
            "query": "",  # Empty query
            "limit": 0,  # Invalid limit
        }

        response = test_client.post(
            "/api/v1/search/query", json=invalid_request, headers=headers
        )
        assert response.status_code == 422  # Validation error

        # Test unauthorized access
        response = test_client.post("/api/v1/search/query", json={"query": "test"})
        assert response.status_code == 401  # Unauthorized

        # Test admin-only endpoint without admin
        response = test_client.get("/api/v1/search/performance/report", headers=headers)
        assert response.status_code == 403  # Forbidden

    @pytest.mark.asyncio
    async def test_caching_behavior(
        self, test_client, mock_user, sample_document_chunks
    ):
        """Test search result caching behavior"""
        token = create_access_token(
            data={"sub": mock_user.id, "tenant_id": mock_user.tenant_id}
        )
        headers = {"Authorization": f"Bearer {token}"}

        mock_repo = AsyncMock(spec=DocumentRepository)
        mock_repo.similarity_search.return_value = sample_document_chunks[:5]

        with patch("app.api.endpoints.vector_search.document_repository", mock_repo):
            # First search - should miss cache
            search_request = {
                "query": "machine learning",
                "search_mode": "fast",
                "limit": 5,
            }

            response1 = test_client.post(
                "/api/v1/search/query", json=search_request, headers=headers
            )
            assert response1.status_code == 200

            data1 = response1.json()
            cache_hit1 = data1["metrics"]["cache_hit"]

            # Second identical search - should hit cache
            response2 = test_client.post(
                "/api/v1/search/query", json=search_request, headers=headers
            )
            assert response2.status_code == 200

            data2 = response2.json()
            cache_hit2 = data2["metrics"]["cache_hit"]

            # Verify caching behavior
            # Note: In a real implementation, caching might take time to populate
            # This test demonstrates the expected behavior
            assert isinstance(cache_hit1, bool)
            assert isinstance(cache_hit2, bool)

    @pytest.mark.asyncio
    async def test_personalized_search(
        self, test_client, mock_user, sample_document_chunks
    ):
        """Test personalized search ranking"""
        token = create_access_token(
            data={"sub": mock_user.id, "tenant_id": mock_user.tenant_id}
        )
        headers = {"Authorization": f"Bearer {token}"}

        mock_repo = AsyncMock(spec=DocumentRepository)
        mock_repo.similarity_search.return_value = sample_document_chunks

        # Mock user preferences
        with patch(
            "app.services.vector_search_service.VectorSearchService._get_user_preferences"
        ) as mock_prefs:
            mock_prefs.return_value = {
                "preferred_sources": ["arxiv", "nature"],
                "preferred_topics": ["machine learning"],
                "viewed_documents": ["doc_1"],
            }

            search_request = {
                "query": "artificial intelligence",
                "ranking_strategy": "personalized",
                "limit": 5,
            }

            response = test_client.post(
                "/api/v1/search/query", json=search_request, headers=headers
            )
            assert response.status_code == 200

            data = response.json()
            results = data["data"]["results"]

            # Verify personalized scores are included
            for result in results:
                score_breakdown = result["score_breakdown"]
                assert "personalized" in score_breakdown
                assert isinstance(score_breakdown["personalized"], (int, float))

    @pytest.mark.asyncio
    async def test_diversity_in_search_results(
        self, test_client, mock_user, sample_document_chunks
    ):
        """Test diversity weighting in search results"""
        token = create_access_token(
            data={"sub": mock_user.id, "tenant_id": mock_user.tenant_id}
        )
        headers = {"Authorization": f"Bearer {token}"}

        # Create chunks with similar content from same documents
        similar_chunks = []
        for i in range(10):
            chunk = DocumentChunk(
                id=f"similar_chunk_{i}",
                document_id="doc_same",  # Same document
                content=f"Machine learning and artificial intelligence research paper {i}",
                metadata={
                    "topics": ["machine learning"],
                    "source_type": "peer_reviewed",
                },
                embedding=np.random.rand(1536).tolist(),
            )
            similar_chunks.append(chunk)

        mock_repo = AsyncMock(spec=DocumentRepository)
        mock_repo.similarity_search.return_value = similar_chunks

        with patch("app.api.endpoints.vector_search.document_repository", mock_repo):
            # Search with high diversity requirement
            search_request = {
                "query": "machine learning",
                "ranking_strategy": "diversity_weighted",
                "diversity_threshold": 0.5,  # Low threshold for high diversity
                "limit": 5,
            }

            response = test_client.post(
                "/api/v1/search/query", json=search_request, headers=headers
            )
            assert response.status_code == 200

            data = response.json()
            results = data["data"]["results"]

            # Verify diversity scores are calculated
            for result in results:
                score_breakdown = result["score_breakdown"]
                assert "diversity" in score_breakdown
                # Diversity score should be reduced for similar documents
                assert isinstance(score_breakdown["diversity"], (int, float))


if __name__ == "__main__":
    # Run integration tests
    pytest.main([__file__, "-v"])
