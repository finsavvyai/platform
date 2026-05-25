"""
Integration tests for Architecture API endpoints.

Tests the full API workflow including authentication,
authorization, and end-to-end functionality.
"""

import pytest
import json
import asyncio
from httpx import AsyncClient
from unittest.mock import patch, AsyncMock

from src.udp.main import app
from src.udp.core.patterns.models import (
    ArchitecturePattern,
    ArchitectureRecommendation,
    PatternMatch,
    IntegrationPattern,
    BestPractice,
    PerformanceRecommendation,
)
from src.udp.core.models import User


class TestArchitectureAPI:
    """Integration tests for architecture API endpoints."""

    @pytest.fixture
    async def client(self):
        """Create an async test client."""
        async with AsyncClient(app=app, base_url="http://test") as ac:
            yield ac

    @pytest.fixture
    def mock_user(self):
        """Create a mock authenticated user."""
        return {
            "id": "test-user-123",
            "email": "test@example.com",
            "name": "Test User",
            "roles": ["developer", "architect"],
        }

    @pytest.mark.asyncio
    async def test_get_architecture_recommendations_success(self, client, mock_user):
        """Test successful architecture recommendations retrieval."""
        project_id = "test-project-123"

        # Mock authentication
        with patch(
            "src.udp.api.v1.architecture.get_current_user", return_value=mock_user
        ):
            # Mock service response
            mock_recommendations = ArchitectureRecommendation(
                project_id=project_id,
                detected_patterns=[
                    PatternMatch(
                        pattern=ArchitecturePattern.MICROSERVICES,
                        confidence=0.8,
                        evidence=["Multiple service boundaries detected"],
                    )
                ],
                integration_patterns=[
                    IntegrationPattern(
                        pattern="REST API Integration",
                        technology="rest",
                        description="Use REST APIs for communication",
                        benefits=["Standard protocol"],
                        implementation_complexity="low",
                    )
                ],
                best_practices=[
                    BestPractice(
                        category="API Design",
                        title="RESTful Principles",
                        description="Follow REST best practices",
                        rationale="Improves usability",
                    )
                ],
                performance_recommendations=[
                    PerformanceRecommendation(
                        component="Database",
                        issue="Inefficient queries",
                        recommendation="Add indexes",
                        expected_improvement="50% faster queries",
                        implementation_effort="medium",
                    )
                ],
                confidence_score=0.85,
            )

            with patch(
                "src.udp.api.v1.architecture.architecture_service.get_architecture_recommendations"
            ) as mock_service:
                mock_service.return_value = mock_recommendations

                response = await client.get(
                    f"/api/v1/architecture/projects/{project_id}/recommendations"
                )

                assert response.status_code == 200
                data = response.json()

                assert data["project_id"] == project_id
                assert len(data["detected_patterns"]) == 1
                assert data["detected_patterns"][0]["pattern"] == "microservices"
                assert data["detected_patterns"][0]["confidence"] == 0.8
                assert len(data["integration_patterns"]) == 1
                assert data["integration_patterns"][0]["technology"] == "rest"
                assert len(data["best_practices"]) == 1
                assert data["best_practices"][0]["category"] == "API Design"
                assert len(data["performance_recommendations"]) == 1
                assert data["confidence_score"] == 0.85

    @pytest.mark.asyncio
    async def test_get_architecture_recommendations_not_found(self, client, mock_user):
        """Test handling of non-existent project."""
        project_id = "non-existent-project"

        with patch(
            "src.udp.api.v1.architecture.get_current_user", return_value=mock_user
        ):
            with patch(
                "src.udp.api.v1.architecture.architecture_service.get_architecture_recommendations"
            ) as mock_service:
                mock_service.side_effect = ValueError(f"Project {project_id} not found")

                response = await client.get(
                    f"/api/v1/architecture/projects/{project_id}/recommendations"
                )

                assert response.status_code == 404
                assert "not found" in response.json()["detail"].lower()

    @pytest.mark.asyncio
    async def test_detect_patterns_endpoint(self, client, mock_user):
        """Test pattern detection endpoint."""
        project_id = "test-project-123"

        with patch(
            "src.udp.api.v1.architecture.get_current_user", return_value=mock_user
        ):
            mock_patterns = [
                PatternMatch(
                    pattern=ArchitecturePattern.MICROSERVICES,
                    confidence=0.9,
                    evidence=["Service boundaries", "Independent deployments"],
                ),
                PatternMatch(
                    pattern=ArchitecturePattern.REST_API,
                    confidence=0.8,
                    evidence=["HTTP endpoints", "JSON responses"],
                ),
            ]

            with patch(
                "src.udp.api.v1.architecture.architecture_service.detect_patterns"
            ) as mock_service:
                mock_service.return_value = mock_patterns

                response = await client.get(
                    f"/api/v1/architecture/projects/{project_id}/patterns"
                )

                assert response.status_code == 200
                data = response.json()

                assert len(data) == 2
                assert data[0]["pattern"] == "microservices"
                assert data[0]["confidence"] == 0.9
                assert len(data[0]["evidence"]) == 2
                assert data[1]["pattern"] == "rest_api"

    @pytest.mark.asyncio
    async def test_detect_patterns_with_filter(self, client, mock_user):
        """Test pattern detection with specific pattern filter."""
        project_id = "test-project-123"
        pattern_types = ["microservices", "api_gateway"]

        with patch(
            "src.udp.api.v1.architecture.get_current_user", return_value=mock_user
        ):
            mock_patterns = [
                PatternMatch(pattern=ArchitecturePattern.MICROSERVICES, confidence=0.9)
            ]

            with patch(
                "src.udp.api.v1.architecture.architecture_service.detect_patterns"
            ) as mock_service:
                mock_service.return_value = mock_patterns

                response = await client.get(
                    f"/api/v1/architecture/projects/{project_id}/patterns",
                    params={"pattern_types": pattern_types},
                )

                assert response.status_code == 200
                data = response.json()

                assert len(data) == 1
                mock_service.assert_called_once_with(
                    project_id=project_id,
                    pattern_types=[
                        ArchitecturePattern.MICROSERVICES,
                        ArchitecturePattern.API_GATEWAY,
                    ],
                )

    @pytest.mark.asyncio
    async def test_get_integration_recommendations(self, client, mock_user):
        """Test integration recommendations endpoint."""
        project_id = "test-project-123"
        target_languages = ["rust", "go"]
        performance_requirements = "very_high"

        with patch(
            "src.udp.api.v1.architecture.get_current_user", return_value=mock_user
        ):
            mock_integrations = [
                IntegrationPattern(
                    pattern="WebAssembly Bridge",
                    technology="wasm",
                    description="Use WebAssembly for high performance",
                    benefits=["Near-native speed"],
                    implementation_complexity="high",
                ),
                IntegrationPattern(
                    pattern="gRPC Integration",
                    technology="grpc",
                    description="Use gRPC for efficient communication",
                    benefits=["Binary protocol"],
                    implementation_complexity="medium",
                ),
            ]

            with patch(
                "src.udp.api.v1.architecture.architecture_service.get_integration_recommendations"
            ) as mock_service:
                mock_service.return_value = mock_integrations

                response = await client.get(
                    f"/api/v1/architecture/projects/{project_id}/integration-recommendations",
                    params={
                        "target_languages": target_languages,
                        "performance_requirements": performance_requirements,
                    },
                )

                assert response.status_code == 200
                data = response.json()

                assert len(data) == 2
                assert data[0]["technology"] == "wasm"
                assert data[0]["implementation_complexity"] == "high"
                assert data[1]["technology"] == "grpc"

                mock_service.assert_called_once_with(
                    project_id=project_id,
                    target_languages=target_languages,
                    performance_requirements=performance_requirements,
                )

    @pytest.mark.asyncio
    async def test_get_best_practices(self, client, mock_user):
        """Test best practices endpoint."""
        project_id = "test-project-123"
        categories = ["API Design", "Performance"]

        with patch(
            "src.udp.api.v1.architecture.get_current_user", return_value=mock_user
        ):
            mock_practices = [
                BestPractice(
                    category="API Design",
                    title="Use RESTful Principles",
                    description="Follow REST conventions",
                    rationale="Better developer experience",
                    implementation_steps=[
                        "Define resources",
                        "Use proper HTTP methods",
                    ],
                    anti_patterns=["RPC-style endpoints"],
                )
            ]

            with patch(
                "src.udp.api.v1.architecture.architecture_service.get_best_practices"
            ) as mock_service:
                mock_service.return_value = mock_practices

                response = await client.get(
                    f"/api/v1/architecture/projects/{project_id}/best-practices",
                    params={"categories": categories},
                )

                assert response.status_code == 200
                data = response.json()

                assert len(data) == 1
                assert data[0]["category"] == "API Design"
                assert data[0]["title"] == "Use RESTful Principles"
                assert len(data[0]["implementation_steps"]) == 2
                assert len(data[0]["anti_patterns"]) == 1

    @pytest.mark.asyncio
    async def test_get_performance_recommendations(self, client, mock_user):
        """Test performance recommendations endpoint."""
        project_id = "test-project-123"
        focus_areas = ["database", "network"]

        with patch(
            "src.udp.api.v1.architecture.get_current_user", return_value=mock_user
        ):
            mock_recs = [
                PerformanceRecommendation(
                    component="Database Connections",
                    issue="Connection pool exhaustion",
                    recommendation="Increase pool size",
                    expected_improvement="60% better throughput",
                    implementation_effort="low",
                    priority="high",
                    metrics={"throughput_improvement": 0.6},
                )
            ]

            with patch(
                "src.udp.api.v1.architecture.architecture_service.get_performance_recommendations"
            ) as mock_service:
                mock_service.return_value = mock_recs

                response = await client.get(
                    f"/api/v1/architecture/projects/{project_id}/performance-recommendations",
                    params={"focus_areas": focus_areas},
                )

                assert response.status_code == 200
                data = response.json()

                assert len(data) == 1
                assert data[0]["component"] == "Database Connections"
                assert data[0]["issue"] == "Connection pool exhaustion"
                assert data[0]["priority"] == "high"
                assert "throughput_improvement" in data[0]["metrics"]

    @pytest.mark.asyncio
    async def test_compare_architectures(self, client, mock_user):
        """Test architecture comparison endpoint."""
        project_ids = ["proj-1", "proj-2", "proj-3"]

        with patch(
            "src.udp.api.v1.architecture.get_current_user", return_value=mock_user
        ):
            mock_comparison = {
                "project_comparisons": {
                    "proj-1": {
                        "patterns": ["microservices", "rest_api"],
                        "integration_count": 2,
                        "best_practices_count": 5,
                        "performance_issues": 2,
                        "confidence_score": 0.8,
                    },
                    "proj-2": {
                        "patterns": ["monolith"],
                        "integration_count": 1,
                        "best_practices_count": 3,
                        "performance_issues": 1,
                        "confidence_score": 0.7,
                    },
                },
                "common_patterns": {"microservices": 1, "rest_api": 1, "monolith": 1},
                "recommendations": [
                    "Consider standardizing on common patterns across projects"
                ],
            }

            with patch(
                "src.udp.api.v1.architecture.architecture_service.compare_architectures"
            ) as mock_service:
                mock_service.return_value = mock_comparison

                response = await client.post(
                    "/api/v1/architecture/compare", params={"project_ids": project_ids}
                )

                assert response.status_code == 200
                data = response.json()

                assert "project_comparisons" in data
                assert "common_patterns" in data
                assert "recommendations" in data
                assert len(data["project_comparisons"]) == 2
                assert data["common_patterns"]["microservices"] == 1
                assert len(data["recommendations"]) == 1

    @pytest.mark.asyncio
    async def test_compare_architectures_too_many_projects(self, client, mock_user):
        """Test comparison with too many projects should fail."""
        project_ids = ["proj-" + str(i) for i in range(11)]  # 11 projects

        with patch(
            "src.udp.api.v1.architecture.get_current_user", return_value=mock_user
        ):
            response = await client.post(
                "/api/v1/architecture/compare", params={"project_ids": project_ids}
            )

            assert response.status_code == 400
            assert "Cannot compare more than 10" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_track_recommendation_adoption(self, client, mock_user):
        """Test tracking recommendation adoption."""
        recommendation_id = "rec-123"
        project_id = "proj-123"
        status = "implemented"
        feedback = "Successfully implemented with good results"

        with patch(
            "src.udp.api.v1.architecture.get_current_user", return_value=mock_user
        ):
            with patch(
                "src.udp.api.v1.architecture.architecture_service.track_recommendation_adoption"
            ) as mock_service:
                mock_service.return_value = True

                response = await client.post(
                    f"/api/v1/architecture/recommendations/{recommendation_id}/track",
                    params={
                        "project_id": project_id,
                        "status": status,
                        "feedback": feedback,
                    },
                )

                assert response.status_code == 200
                data = response.json()

                assert data["message"] == "Adoption tracked successfully"
                assert data["status"] == status

                mock_service.assert_called_once_with(
                    project_id=project_id,
                    recommendation_id=recommendation_id,
                    status=status,
                    feedback=feedback,
                )

    @pytest.mark.asyncio
    async def test_list_supported_patterns(self, client, mock_user):
        """Test listing supported architecture patterns."""
        with patch(
            "src.udp.api.v1.architecture.get_current_user", return_value=mock_user
        ):
            response = await client.get("/api/v1/architecture/patterns")

            assert response.status_code == 200
            data = response.json()

            assert "integration_patterns" in data
            assert "complexity_levels" in data
            assert "integration_technologies" in data

            # Check patterns
            patterns = data["integration_patterns"]
            assert any(p["value"] == "microservices" for p in patterns)
            assert any(p["value"] == "monolith" for p in patterns)

            # Check complexity levels
            complexities = data["complexity_levels"]
            assert any(c["value"] == "low" for c in complexities)
            assert any(c["value"] == "high" for c in complexities)

            # Check technologies
            techs = data["integration_technologies"]
            assert "rest" in techs
            assert "grpc" in techs
            assert "wasm" in techs

    @pytest.mark.asyncio
    async def test_trigger_analysis_background(self, client, mock_user):
        """Test triggering background analysis."""
        project_id = "proj-123"

        with patch(
            "src.udp.api.v1.architecture.get_current_user", return_value=mock_user
        ):
            # Mock background task
            with patch("src.udp.api.v1.architecture.BackgroundTasks") as mock_tasks:
                mock_add_task = AsyncMock()
                mock_tasks.return_value.add_task = mock_add_task

                response = await client.post(
                    f"/api/v1/architecture/projects/{project_id}/analyze"
                )

                assert response.status_code == 200
                data = response.json()

                assert data["message"] == "Architecture analysis initiated"
                assert data["project_id"] == project_id
                assert data["status"] == "in_progress"

                # Verify background task was scheduled
                mock_add_task.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_architecture_recommendations_with_cache_refresh(
        self, client, mock_user
    ):
        """Test recommendations with cache refresh."""
        project_id = "test-project-123"

        with patch(
            "src.udp.api.v1.architecture.get_current_user", return_value=mock_user
        ):
            with patch(
                "src.udp.api.v1.architecture.architecture_service.get_architecture_recommendations"
            ) as mock_service:
                mock_service.return_value = ArchitectureRecommendation(
                    project_id=project_id, confidence_score=0.9
                )

                # First call with force_refresh=False
                response1 = await client.get(
                    f"/api/v1/architecture/projects/{project_id}/recommendations",
                    params={"force_refresh": False},
                )

                # Second call with force_refresh=True
                response2 = await client.get(
                    f"/api/v1/architecture/projects/{project_id}/recommendations",
                    params={"force_refresh": True},
                )

                assert response1.status_code == 200
                assert response2.status_code == 200

                # Verify service was called with correct parameters
                assert mock_service.call_count == 2
                mock_service.assert_any_call(
                    project_id=project_id,
                    user_id=mock_user["id"],
                    force_refresh=False,
                    include_project_structure=False,
                )
                mock_service.assert_any_call(
                    project_id=project_id,
                    user_id=mock_user["id"],
                    force_refresh=True,
                    include_project_structure=True,
                )

    @pytest.mark.asyncio
    async def test_unauthorized_access(self, client):
        """Test that unauthorized access is blocked."""
        project_id = "test-project-123"

        with patch("src.udp.api.v1.architecture.get_current_user") as mock_auth:
            mock_auth.side_effect = Exception("Unauthorized")

            response = await client.get(
                f"/api/v1/architecture/projects/{project_id}/recommendations"
            )

            # Should be blocked by authentication middleware
            assert response.status_code in [401, 403]

    @pytest.mark.asyncio
    async def test_server_error_handling(self, client, mock_user):
        """Test proper error handling for server errors."""
        project_id = "test-project-123"

        with patch(
            "src.udp.api.v1.architecture.get_current_user", return_value=mock_user
        ):
            with patch(
                "src.udp.api.v1.architecture.architecture_service.get_architecture_recommendations"
            ) as mock_service:
                mock_service.side_effect = Exception("Database connection failed")

                response = await client.get(
                    f"/api/v1/architecture/projects/{project_id}/recommendations"
                )

                assert response.status_code == 500
                assert (
                    "Failed to generate architecture recommendations"
                    in response.json()["detail"]
                )
