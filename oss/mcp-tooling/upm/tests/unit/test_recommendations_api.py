"""
Unit tests for Recommendations API endpoints.

Tests the REST API endpoints for package recommendations,
alternatives, feedback, and explanations.
"""

import pytest
import json
from datetime import datetime
from unittest.mock import Mock, AsyncMock, patch
from fastapi.testclient import TestClient
from fastapi import status

from src.udp.api.v1.recommendations import (
    router,
    RecommendationRequest,
    RecommendationResponse,
    AlternativeRequest,
    FeedbackRequest,
    FeedbackResponse,
    ExplanationRequest,
    ExplanationResponse,
)
from src.udp.services.ai_service import RecommendationResult
from src.udp.core.models import User


class TestRecommendationsAPI:
    """Test cases for Recommendations API endpoints."""

    @pytest.fixture
    def client(self):
        """Create test client."""
        from src.udp.api.main import app

        return TestClient(app)

    @pytest.fixture
    def mock_user(self):
        """Create mock authenticated user."""
        user = User()
        user.id = "user123"
        user.email = "test@example.com"
        user.name = "Test User"
        return user

    @pytest.fixture
    def sample_recommendations(self):
        """Create sample recommendation results."""
        return [
            RecommendationResult(
                package_name="spring-boot-starter-web",
                ecosystem="maven",
                version="2.7.0",
                confidence_score=0.92,
                relevance_score=0.88,
                security_score=0.90,
                popularity_score=0.95,
                reason="Most popular Java web framework with excellent security",
                benefits=[
                    "Secure with no known vulnerabilities",
                    "Proven in production by many organizations",
                    "Regular updates and bug fixes",
                ],
                risk_factors=["Large dependency tree may impact bundle size"],
                similar_packages=["micronaut", "quarkus"],
                usage_stats={
                    "downloads": "100M+",
                    "stars": "60K+",
                    "forks": "25K+",
                    "contributors": 500,
                },
                last_updated=datetime.utcnow(),
            ),
            RecommendationResult(
                package_name="micronaut-http",
                ecosystem="maven",
                version="3.5.0",
                confidence_score=0.85,
                relevance_score=0.82,
                security_score=0.88,
                popularity_score=0.75,
                reason="Lightweight and fast alternative to Spring Boot",
                benefits=["Lightweight with minimal dependencies", "Fast startup time"],
                risk_factors=["Smaller community compared to Spring"],
                similar_packages=["spring-boot", "quarkus"],
                usage_stats={"downloads": "5M+", "stars": "7K+"},
                last_updated=datetime.utcnow(),
            ),
        ]

    @pytest.fixture
    def auth_headers(self, mock_user):
        """Create authentication headers."""
        return {"Authorization": f"Bearer mock_token_for_{mock_user.id}"}

    def test_get_recommendations_success(
        self, client, mock_user, auth_headers, sample_recommendations
    ):
        """Test successful package recommendations request."""
        with (
            patch(
                "src.udp.api.v1.recommendations.get_current_user",
                return_value=mock_user,
            ),
            patch(
                "src.udp.api.v1.recommendations.ai_recommendation_service"
            ) as mock_service,
        ):
            # Setup mock service
            mock_service.get_package_recommendations.return_value = (
                sample_recommendations
            )

            # Make request
            response = client.post(
                "/api/v1/recommendations/",
                json={"ecosystem": "maven", "limit": 10, "include_alternatives": True},
                headers=auth_headers,
            )

            # Verify response
            assert response.status_code == status.HTTP_200_OK
            data = response.json()

            assert "recommendations" in data
            assert "total_count" in data
            assert "generated_at" in data
            assert "context" in data

            assert len(data["recommendations"]) == 2
            assert data["total_count"] == 2

            # Check first recommendation
            rec1 = data["recommendations"][0]
            assert rec1["package_name"] == "spring-boot-starter-web"
            assert rec1["ecosystem"] == "maven"
            assert rec1["confidence_score"] == 0.92
            assert rec1["security_score"] == 0.90
            assert "Most popular Java web framework" in rec1["reason"]
            assert len(rec1["benefits"]) > 0
            assert len(rec1["risk_factors"]) > 0
            assert rec1["usage_stats"]["downloads"] == "100M+"

            # Verify service was called correctly
            mock_service.get_package_recommendations.assert_called_once_with(
                user_id=str(mock_user.id),
                project_id=None,
                ecosystem="maven",
                limit=10,
                exclude_packages=None,
                include_alternatives=True,
            )

    def test_get_recommendations_with_project_context(
        self, client, mock_user, auth_headers, sample_recommendations
    ):
        """Test recommendations with project context."""
        with (
            patch(
                "src.udp.api.v1.recommendations.get_current_user",
                return_value=mock_user,
            ),
            patch(
                "src.udp.api.v1.recommendations.ai_recommendation_service"
            ) as mock_service,
        ):
            mock_service.get_package_recommendations.return_value = (
                sample_recommendations
            )

            # Make request with project context
            response = client.post(
                "/api/v1/recommendations/",
                json={
                    "project_id": "project456",
                    "ecosystem": "npm",
                    "limit": 5,
                    "exclude_packages": ["lodash", "moment"],
                },
                headers=auth_headers,
            )

            assert response.status_code == status.HTTP_200_OK
            data = response.json()

            # Check context information
            assert data["context"]["ecosystem"] == "npm"
            assert data["context"]["has_project_context"] is True
            assert data["context"]["has_user_context"] is True
            assert data["context"]["excluded_count"] == 2

            # Verify service call
            mock_service.get_package_recommendations.assert_called_once_with(
                user_id=str(mock_user.id),
                project_id="project456",
                ecosystem="npm",
                limit=5,
                exclude_packages={"lodash", "moment"},
                include_alternatives=True,
            )

    def test_get_recommendations_unauthenticated(self, client, sample_recommendations):
        """Test recommendations without authentication."""
        with (
            patch("src.udp.api.v1.recommendations.get_current_user", return_value=None),
            patch(
                "src.udp.api.v1.recommendations.ai_recommendation_service"
            ) as mock_service,
        ):
            mock_service.get_package_recommendations.return_value = (
                sample_recommendations
            )

            # Make request without auth headers
            response = client.post(
                "/api/v1/recommendations/", json={"ecosystem": "maven", "limit": 10}
            )

            # Should still work (public endpoint)
            assert response.status_code == status.HTTP_200_OK
            data = response.json()
            assert len(data["recommendations"]) == 2

            # Service should be called without user_id
            mock_service.get_package_recommendations.assert_called_once_with(
                user_id=None,
                project_id=None,
                ecosystem="maven",
                limit=10,
                exclude_packages=None,
                include_alternatives=True,
            )

    def test_get_recommendations_invalid_ecosystem(self, client, auth_headers):
        """Test recommendations with invalid ecosystem."""
        response = client.post(
            "/api/v1/recommendations/",
            json={"ecosystem": "invalid_ecosystem", "limit": 10},
            headers=auth_headers,
        )

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        assert "ecosystem" in response.json()["detail"][0]["loc"]

    def test_get_recommendations_invalid_limit(self, client, auth_headers):
        """Test recommendations with invalid limit."""
        response = client.post(
            "/api/v1/recommendations/",
            json={
                "ecosystem": "maven",
                "limit": 150,  # Over maximum of 100
            },
            headers=auth_headers,
        )

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        assert "limit" in response.json()["detail"][0]["loc"]

    def test_get_alternatives_success(
        self, client, mock_user, auth_headers, sample_recommendations
    ):
        """Test getting package alternatives."""
        with (
            patch(
                "src.udp.api.v1.recommendations.get_current_user",
                return_value=mock_user,
            ),
            patch(
                "src.udp.api.v1.recommendations.ai_recommendation_service"
            ) as mock_service,
        ):
            # Setup mock alternatives
            alternatives = sample_recommendations[1:]  # Return only micronaut
            for alt in alternatives:
                alt.alternative_for = "spring-boot"

            mock_service.get_alternative_packages.return_value = alternatives

            # Make request
            response = client.post(
                "/api/v1/recommendations/alternatives",
                json={"package_name": "spring-boot", "ecosystem": "maven", "limit": 5},
                headers=auth_headers,
            )

            assert response.status_code == status.HTTP_200_OK
            data = response.json()

            assert len(data["recommendations"]) == 1
            alt = data["recommendations"][0]
            assert alt["package_name"] == "micronaut-http"
            assert alt["alternative_for"] == "spring-boot"
            assert "Lightweight and fast alternative" in alt["reason"]

            # Verify service call
            mock_service.get_alternative_packages.assert_called_once_with(
                package_name="spring-boot",
                ecosystem="maven",
                limit=5,
                user_id=str(mock_user.id),
            )

    def test_submit_feedback_success(self, client, mock_user, auth_headers):
        """Test successful feedback submission."""
        with (
            patch(
                "src.udp.api.v1.recommendations.get_current_user",
                return_value=mock_user,
            ),
            patch(
                "src.udp.api.v1.recommendations.ai_recommendation_service"
            ) as mock_service,
        ):
            mock_service.update_user_feedback.return_value = True

            # Submit feedback
            response = client.post(
                "/api/v1/recommendations/feedback",
                json={
                    "user_id": str(mock_user.id),
                    "package_name": "spring-boot",
                    "ecosystem": "maven",
                    "feedback_score": 0.9,
                    "feedback_type": "rating",
                    "feedback_data": {
                        "comment": "Excellent framework!",
                        "ease_of_use": 0.95,
                        "documentation_quality": 0.9,
                    },
                },
                headers=auth_headers,
            )

            assert response.status_code == status.HTTP_200_OK
            data = response.json()

            assert data["success"] is True
            assert data["message"] == "Feedback submitted successfully"
            assert "feedback_id" in data

            # Verify service call
            mock_service.update_user_feedback.assert_called_once_with(
                user_id=str(mock_user.id),
                package_name="spring-boot",
                ecosystem="maven",
                feedback_score=0.9,
                feedback_type="rating",
                feedback_data={
                    "comment": "Excellent framework!",
                    "ease_of_use": 0.95,
                    "documentation_quality": 0.9,
                },
            )

    def test_submit_feedback_invalid_score(self, client, auth_headers):
        """Test feedback submission with invalid score."""
        response = client.post(
            "/api/v1/recommendations/feedback",
            json={
                "user_id": "user123",
                "package_name": "spring-boot",
                "ecosystem": "maven",
                "feedback_score": 1.5,  # Over maximum of 1.0
                "feedback_type": "rating",
            },
            headers=auth_headers,
        )

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        assert "feedback_score" in response.json()["detail"][0]["loc"]

    def test_submit_feedback_different_user(self, client, auth_headers):
        """Test feedback submission for different user (should fail)."""
        response = client.post(
            "/api/v1/recommendations/feedback",
            json={
                "user_id": "different_user",
                "package_name": "spring-boot",
                "ecosystem": "maven",
                "feedback_score": 0.8,
                "feedback_type": "rating",
            },
            headers=auth_headers,
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "Cannot submit feedback for another user" in response.json()["detail"]

    def test_explain_recommendation_success(
        self, client, mock_user, auth_headers, sample_recommendations
    ):
        """Test getting recommendation explanation."""
        with (
            patch(
                "src.udp.api.v1.recommendations.get_current_user",
                return_value=mock_user,
            ),
            patch(
                "src.udp.api.v1.recommendations.ai_recommendation_service"
            ) as mock_service,
        ):
            # Setup mock explanation
            explanation = {
                "package": "spring-boot-starter-web",
                "confidence_score": 0.92,
                "relevance_score": 0.88,
                "security_score": 0.90,
                "popularity_score": 0.95,
                "reason": "Most popular Java web framework with excellent security track record",
                "benefits": [
                    "Secure with no known vulnerabilities",
                    "Proven in production by many organizations",
                    "Regular updates and bug fixes",
                    "Strong community support",
                ],
                "risk_factors": ["Large dependency tree may impact bundle size"],
                "similar_packages": ["micronaut", "quarkus", "vert.x"],
                "usage_statistics": {
                    "downloads": "100M+",
                    "stars": "60K+",
                    "forks": "25K+",
                    "contributors": 500,
                },
                "model_contributions": {
                    "collaborative_filtering": "Teams with similar preferences use this package",
                    "content_based": "Package attributes match your project requirements",
                },
            }

            mock_service.get_recommendation_explanation.return_value = explanation

            # Request explanation
            response = client.post(
                "/api/v1/recommendations/explain",
                json={
                    "package_name": "spring-boot-starter-web",
                    "user_id": str(mock_user.id),
                    "project_id": "project456",
                },
                headers=auth_headers,
            )

            assert response.status_code == status.HTTP_200_OK
            data = response.json()

            assert data["package"] == "spring-boot-starter-web"
            assert data["confidence_score"] == 0.92
            assert "excellent security" in data["reason"]
            assert len(data["benefits"]) > 0
            assert len(data["risk_factors"]) > 0
            assert "micronaut" in data["similar_packages"]
            assert "model_contributions" in data

            # Verify service call
            mock_service.get_recommendation_explanation.assert_called_once_with(
                package_name="spring-boot-starter-web",
                user_id=str(mock_user.id),
                project_id="project456",
            )

    def test_explain_recommendation_not_found(self, client, auth_headers):
        """Test explanation for non-existent recommendation."""
        with (
            patch("src.udp.api.v1.recommendations.get_current_user", return_value=None),
            patch(
                "src.udp.api.v1.recommendations.ai_recommendation_service"
            ) as mock_service,
        ):
            mock_service.get_recommendation_explanation.return_value = {
                "error": "Package not found in recommendations"
            }

            response = client.post(
                "/api/v1/recommendations/explain",
                json={"package_name": "non-existent-package", "ecosystem": "maven"},
            )

            assert response.status_code == status.HTTP_404_NOT_FOUND
            assert "Package not found" in response.json()["detail"]

    def test_get_popular_packages(
        self, client, mock_user, auth_headers, sample_recommendations
    ):
        """Test getting popular packages."""
        with (
            patch(
                "src.udp.api.v1.recommendations.get_current_user",
                return_value=mock_user,
            ),
            patch(
                "src.udp.api.v1.recommendations.ai_recommendation_service"
            ) as mock_service,
        ):
            mock_service.get_package_recommendations.return_value = (
                sample_recommendations
            )

            # Request popular packages
            response = client.get(
                "/api/v1/recommendations/popular/maven?limit=20", headers=auth_headers
            )

            assert response.status_code == status.HTTP_200_OK
            data = response.json()

            assert "packages" in data
            assert data["ecosystem"] == "maven"
            assert data["total_count"] == 2

            packages = data["packages"]
            assert len(packages) == 2
            assert packages[0]["name"] == "spring-boot-starter-web"
            assert packages[0]["popularity_score"] == 0.95
            assert packages[0]["security_score"] == 0.90

            # Verify service call
            mock_service.get_package_recommendations.assert_called_once_with(
                user_id=str(mock_user.id),
                ecosystem="maven",
                limit=20,
                exclude_packages=set(),
            )

    def test_get_popular_packages_with_category(self, client, auth_headers):
        """Test getting popular packages filtered by category."""
        with (
            patch("src.udp.api.v1.recommendations.get_current_user", return_value=None),
            patch(
                "src.udp.api.v1.recommendations.ai_recommendation_service"
            ) as mock_service,
        ):
            # Mock recommendations with tags
            rec1 = RecommendationResult(
                package_name="react",
                ecosystem="npm",
                confidence_score=0.9,
                relevance_score=0.85,
                security_score=0.8,
                popularity_score=0.95,
                reason="Popular frontend library",
                similar_packages=["vue", "angular"],
            )
            rec1.similar_packages = ["frontend", "ui", "react"]

            rec2 = RecommendationResult(
                package_name="express",
                ecosystem="npm",
                confidence_score=0.85,
                relevance_score=0.8,
                security_score=0.75,
                popularity_score=0.9,
                reason="Popular backend framework",
                similar_packages=["koa", "fastify"],
            )
            rec2.similar_packages = ["backend", "server", "api"]

            mock_service.get_package_recommendations.return_value = [rec1, rec2]

            # Request with category filter
            response = client.get(
                "/api/v1/recommendations/popular/npm?category=frontend&limit=10"
            )

            assert response.status_code == status.HTTP_200_OK
            data = response.json()

            # Should only return frontend packages
            assert len(data["packages"]) == 1
            assert data["packages"][0]["name"] == "react"
            assert data["category"] == "frontend"

    def test_get_trending_packages(self, client, auth_headers):
        """Test getting trending packages."""
        with (
            patch("src.udp.api.v1.recommendations.get_current_user", return_value=None),
            patch(
                "src.udp.api.v1.recommendations.ai_recommendation_service"
            ) as mock_service,
        ):
            # Mock trending packages
            trending_rec = RecommendationResult(
                package_name="next.js",
                ecosystem="npm",
                confidence_score=0.93,
                relevance_score=0.9,
                security_score=0.85,
                popularity_score=0.92,
                reason="Fast growing React framework",
                usage_stats={"downloads": "5M+", "growth_rate": "150%"},
            )

            mock_service.get_package_recommendations.return_value = [trending_rec]

            # Request trending packages
            response = client.get(
                "/api/v1/recommendations/trending/npm?days=30&limit=10",
                headers=auth_headers,
            )

            assert response.status_code == status.HTTP_200_OK
            data = response.json()

            assert data["ecosystem"] == "npm"
            assert data["period_days"] == 30
            assert len(data["packages"]) == 1

            package = data["packages"][0]
            assert package["name"] == "next.js"
            assert package["trend_score"] == 0.93
            assert package["risk_level"] == "low"  # Based on security_score > 0.8

    def test_server_error_handling(self, client, auth_headers):
        """Test handling of server errors."""
        with (
            patch("src.udp.api.v1.recommendations.get_current_user", return_value=None),
            patch(
                "src.udp.api.v1.recommendations.ai_recommendation_service"
            ) as mock_service,
        ):
            # Simulate server error
            mock_service.get_package_recommendations.side_effect = Exception(
                "Database connection failed"
            )

            response = client.post(
                "/api/v1/recommendations/",
                json={"ecosystem": "maven", "limit": 10},
                headers=auth_headers,
            )

            assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
            assert "Failed to generate recommendations" in response.json()["detail"]

    def test_request_validation(self, client, auth_headers):
        """Test request validation for various invalid inputs."""
        # Test invalid ecosystem
        response = client.post(
            "/api/v1/recommendations/",
            json={"ecosystem": "invalid", "limit": 10},
            headers=auth_headers,
        )
        assert response.status_code == 422

        # Test invalid limit (negative)
        response = client.post(
            "/api/v1/recommendations/",
            json={"ecosystem": "maven", "limit": -5},
            headers=auth_headers,
        )
        assert response.status_code == 422

        # Test invalid feedback type
        response = client.post(
            "/api/v1/recommendations/feedback",
            json={
                "user_id": "user123",
                "package_name": "test",
                "ecosystem": "maven",
                "feedback_score": 0.8,
                "feedback_type": "invalid_type",
            },
            headers=auth_headers,
        )
        assert response.status_code == 422
