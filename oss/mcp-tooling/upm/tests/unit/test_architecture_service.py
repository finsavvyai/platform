"""
Unit tests for Architecture Service.

Tests the AI service layer including caching, database interactions,
and recommendation generation.
"""

import pytest
import asyncio
from datetime import datetime
from unittest.mock import Mock, AsyncMock, patch, MagicMock

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.udp.services.architecture_service import ArchitectureService
from src.udp.core.patterns.models import (
    ArchitecturePattern,
    ProjectArchitecture,
    ArchitectureRecommendation,
    IntegrationPattern,
    IntegrationTechnology,
    BestPractice,
    PerformanceRecommendation,
    PatternMatch,
)
from src.udp.core.models import Project, Package, ProjectDependency, PackageVersion


class TestArchitectureService:
    """Test cases for ArchitectureService."""

    @pytest.fixture
    def service(self):
        """Create an architecture service instance."""
        return ArchitectureService()

    @pytest.fixture
    def mock_session(self):
        """Create a mock database session."""
        session = AsyncMock(spec=AsyncSession)
        return session

    @pytest.fixture
    def mock_project(self):
        """Create a mock project."""
        project = Mock(spec=Project)
        project.id = "test-project-123"
        project.name = "Test Project"
        project.organization_id = "test-org-123"
        return project

    @pytest.fixture
    def sample_dependencies(self):
        """Create sample project dependencies."""
        return [
            {
                "id": "dep-1",
                "name": "spring-boot-starter",
                "ecosystem": "maven",
                "version": "2.7.0",
                "scope": "compile",
                "cross_language": False,
            },
            {
                "id": "dep-2",
                "name": "fastapi",
                "ecosystem": "pypi",
                "version": "0.95.0",
                "scope": "runtime",
                "cross_language": True,
            },
            {
                "id": "dep-3",
                "name": "express",
                "ecosystem": "npm",
                "version": "4.18.0",
                "scope": "production",
                "cross_language": False,
            },
        ]

    @pytest.mark.asyncio
    async def test_initialize(self, service):
        """Test service initialization."""
        with patch.object(service, "initialize") as mock_init:
            await service.initialize()
            mock_init.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_architecture_recommendations_cache_hit(self, service):
        """Test getting recommendations from cache."""
        project_id = "test-project-123"
        cached_result = {
            "project_id": project_id,
            "detected_patterns": [{"pattern": "microservices", "confidence": 0.8}],
            "integration_patterns": [],
            "best_practices": [],
            "performance_recommendations": [],
            "anti_patterns": [],
            "confidence_score": 0.8,
        }

        with patch.object(service.cache_service, "get", return_value=cached_result):
            result = await service.get_architecture_recommendations(
                project_id=project_id, user_id="user-123"
            )

            assert result.project_id == project_id
            assert len(result.detected_patterns) == 1
            assert result.detected_patterns[0].pattern == "microservices"
            assert result.detected_patterns[0].confidence == 0.8

    @pytest.mark.asyncio
    async def test_get_architecture_recommendations_cache_miss(
        self, service, mock_session, mock_project
    ):
        """Test getting recommendations with cache miss."""
        project_id = "test-project-123"
        user_id = "user-123"

        # Mock cache miss
        service.cache_service.get = AsyncMock(return_value=None)

        # Mock database operations
        with patch(
            "src.udp.services.architecture_service.get_async_session"
        ) as mock_get_session:
            mock_get_session.return_value.__aenter__.return_value = mock_session

            # Mock project retrieval
            mock_session.execute = AsyncMock()
            mock_session.execute.return_value.scalar_one_or_none = mock_project

            # Mock dependency retrieval
            with patch.object(service, "_get_project_dependencies", return_value=[]):
                with patch.object(
                    service, "_analyze_project_architecture"
                ) as mock_analyze:
                    mock_analyze.return_value = ProjectArchitecture(
                        project_id=project_id,
                        languages=["java", "python"],
                        dependency_count=3,
                    )

                    # Mock pattern engine
                    with patch.object(
                        service.pattern_engine, "analyze_architecture"
                    ) as mock_analyze_engine:
                        mock_analyze_engine.return_value = ArchitectureRecommendation(
                            project_id=project_id,
                            detected_patterns=[
                                PatternMatch(
                                    pattern=ArchitecturePattern.MICROSERVICES,
                                    confidence=0.8,
                                )
                            ],
                            confidence_score=0.8,
                        )

                        result = await service.get_architecture_recommendations(
                            project_id=project_id, user_id=user_id, force_refresh=False
                        )

                        assert result.project_id == project_id
                        assert len(result.detected_patterns) == 1
                        assert (
                            result.detected_patterns[0].pattern
                            == ArchitecturePattern.MICROSERVICES
                        )

                        # Verify caching
                        service.cache_service.set.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_architecture_recommendations_force_refresh(self, service):
        """Test forcing refresh of recommendations."""
        project_id = "test-project-123"

        with patch.object(service.cache_service, "get") as mock_cache_get:
            # Should not check cache if force_refresh is True
            result = await service.get_architecture_recommendations(
                project_id=project_id, force_refresh=True
            )

            mock_cache_get.assert_not_called()

    @pytest.mark.asyncio
    async def test_get_architecture_recommendations_project_not_found(self, service):
        """Test handling of non-existent project."""
        project_id = "non-existent-project"

        with patch(
            "src.udp.services.architecture_service.get_async_session"
        ) as mock_get_session:
            mock_get_session.return_value.__aenter__.return_value = AsyncMock(
                spec=AsyncSession
            )

            mock_session = mock_get_session.return_value.__aenter__.return_value
            mock_session.execute = AsyncMock()
            mock_session.execute.return_value.scalar_one_or_none = None

            with pytest.raises(ValueError, match="Project .* not found"):
                await service.get_architecture_recommendations(project_id=project_id)

    @pytest.mark.asyncio
    async def test_detect_patterns_with_filter(self, service):
        """Test pattern detection with specific pattern types."""
        project_id = "test-project-123"
        pattern_types = [
            ArchitecturePattern.MICROSERVICES,
            ArchitecturePattern.REST_API,
        ]

        with patch.object(
            service.pattern_engine, "analyze_architecture"
        ) as mock_analyze:
            mock_analyze.return_value = ArchitectureRecommendation(
                project_id=project_id,
                detected_patterns=[
                    PatternMatch(
                        pattern=ArchitecturePattern.MICROSERVICES, confidence=0.8
                    ),
                    PatternMatch(pattern=ArchitecturePattern.REST_API, confidence=0.7),
                    PatternMatch(pattern=ArchitecturePattern.MONOLITH, confidence=0.6),
                ],
            )

            with patch.object(service, "_analyze_project_architecture"):
                result = await service.detect_patterns(project_id, pattern_types)

                # Should only return specified patterns
                assert len(result) == 2
                patterns = [p.pattern for p in result]
                assert ArchitecturePattern.MICROSERVICES in patterns
                assert ArchitecturePattern.REST_API in patterns
                assert ArchitecturePattern.MONOLITH not in patterns

    @pytest.mark.asyncio
    async def test_get_integration_recommendations_with_params(self, service):
        """Test integration recommendations with custom parameters."""
        project_id = "test-project-123"
        target_languages = ["rust", "go"]
        performance_requirements = "very_high"

        with patch.object(
            service.pattern_engine, "analyze_architecture"
        ) as mock_analyze:
            mock_analyze.return_value = ArchitectureRecommendation(
                project_id=project_id,
                integration_patterns=[
                    IntegrationPattern(
                        pattern="WebAssembly Bridge",
                        technology=IntegrationTechnology.WEBASSEMBLY,
                        description="Test",
                        implementation_complexity="high",
                    )
                ],
            )

            with patch.object(
                service, "_analyze_project_architecture"
            ) as mock_analyze_arch:
                mock_analyze_arch.return_value = ProjectArchitecture(
                    project_id=project_id, languages=["java", "python"]
                )

                result = await service.get_integration_recommendations(
                    project_id=project_id,
                    target_languages=target_languages,
                    performance_requirements=performance_requirements,
                )

                assert len(result) == 1
                assert result[0].technology == IntegrationTechnology.WEBASSEMBLY

                # Verify parameters were applied
                mock_analyze_arch.assert_called_once()
                call_args = mock_analyze_arch.call_args[0]
                arch = call_args[1]
                assert "rust" in arch.languages
                assert "go" in arch.languages
                assert arch.performance_requirements == "very_high"

    @pytest.mark.asyncio
    async def test_get_best_practices_with_categories(self, service):
        """Test getting best practices filtered by categories."""
        project_id = "test-project-123"
        categories = ["API Design", "Performance"]

        with patch.object(
            service.pattern_engine, "analyze_architecture"
        ) as mock_analyze:
            mock_analyze.return_value = ArchitectureRecommendation(
                project_id=project_id,
                best_practices=[
                    BestPractice(
                        category="API Design",
                        title="RESTful Principles",
                        description="Test",
                        rationale="Test",
                    ),
                    BestPractice(
                        category="Performance",
                        title="Circuit Breaker",
                        description="Test",
                        rationale="Test",
                    ),
                    BestPractice(
                        category="Security",
                        title="Authentication",
                        description="Test",
                        rationale="Test",
                    ),
                ],
            )

            with patch.object(service, "_analyze_project_architecture"):
                result = await service.get_best_practices(
                    project_id=project_id, categories=categories
                )

                # Should only return practices from specified categories
                assert len(result) == 2
                cats = [bp.category for bp in result]
                assert "API Design" in cats
                assert "Performance" in cats
                assert "Security" not in cats

    @pytest.mark.asyncio
    async def test_get_performance_recommendations_with_focus(self, service):
        """Test performance recommendations with focus areas."""
        project_id = "test-project-123"
        focus_areas = ["database", "network"]

        with patch.object(
            service.pattern_engine, "analyze_architecture"
        ) as mock_analyze:
            mock_analyze.return_value = ArchitectureRecommendation(
                project_id=project_id,
                performance_recommendations=[
                    PerformanceRecommendation(
                        component="Database Connections",
                        issue="Inefficient connections",
                        recommendation="Use connection pooling",
                        expected_improvement="50% better throughput",
                        implementation_effort="medium",
                    ),
                    PerformanceRecommendation(
                        component="Network Latency",
                        issue="High latency calls",
                        recommendation="Implement caching",
                        expected_improvement="40% reduction",
                        implementation_effort="low",
                    ),
                    PerformanceRecommendation(
                        component="Memory Usage",
                        issue="Memory leaks",
                        recommendation="Fix memory management",
                        expected_improvement="30% reduction",
                        implementation_effort="high",
                    ),
                ],
            )

            with patch.object(service, "_analyze_project_architecture"):
                with patch.object(service, "_get_project_dependencies"):
                    result = await service.get_performance_recommendations(
                        project_id=project_id, focus_areas=focus_areas
                    )

                    # Should only return recommendations for focus areas
                    assert len(result) == 2
                    components = [pr.component for pr in result]
                    assert "Database Connections" in components
                    assert "Network Latency" in components
                    assert "Memory Usage" not in components

    @pytest.mark.asyncio
    async def test_compare_architectures(self, service):
        """Test comparing architectures across multiple projects."""
        project_ids = ["proj-1", "proj-2", "proj-3"]

        with patch.object(service, "get_architecture_recommendations") as mock_get_recs:
            # Mock recommendations for each project
            mock_get_recs.side_effect = [
                ArchitectureRecommendation(
                    project_id="proj-1",
                    detected_patterns=[
                        PatternMatch(ArchitecturePattern.MICROSERVICES, 0.8),
                        PatternMatch(ArchitecturePattern.REST_API, 0.7),
                    ],
                    integration_patterns=[Mock()],
                    best_practices=[Mock(), Mock()],
                    performance_recommendations=[Mock()],
                    confidence_score=0.8,
                ),
                ArchitectureRecommendation(
                    project_id="proj-2",
                    detected_patterns=[PatternMatch(ArchitecturePattern.MONOLITH, 0.9)],
                    integration_patterns=[Mock()],
                    best_practices=[Mock()],
                    performance_recommendations=[Mock(), Mock(), Mock()],
                    confidence_score=0.7,
                ),
                ArchitectureRecommendation(
                    project_id="proj-3",
                    detected_patterns=[
                        PatternMatch(ArchitecturePattern.MICROSERVICES, 0.6),
                        PatternMatch(ArchitecturePattern.EVENT_DRIVEN, 0.8),
                    ],
                    integration_patterns=[Mock(), Mock()],
                    best_practices=[Mock()],
                    performance_recommendations=[Mock()],
                    confidence_score=0.75,
                ),
            ]

            result = await service.compare_architectures(project_ids)

            # Verify structure
            assert "project_comparisons" in result
            assert "common_patterns" in result
            assert "recommendations" in result

            # Verify project comparisons
            comparisons = result["project_comparisons"]
            assert len(comparisons) == 3
            assert "proj-1" in comparisons
            assert comparisons["proj-1"]["patterns"] == ["microservices", "rest_api"]
            assert comparisons["proj-1"]["performance_issues"] == 1
            assert comparisons["proj-2"]["performance_issues"] == 3

            # Verify common patterns
            common_patterns = result["common_patterns"]
            assert "microservices" in common_patterns
            assert common_patterns["microservices"] == 2  # Appears in 2 projects

    @pytest.mark.asyncio
    async def test_compare_architectures_too_many_projects(self, service):
        """Test comparing too many projects should raise error."""
        project_ids = ["proj-" + str(i) for i in range(11)]  # 11 projects

        with pytest.raises(Exception, match="Cannot compare more than 10"):
            await service.compare_architectures(project_ids)

    @pytest.mark.asyncio
    async def test_track_recommendation_adoption(self, service):
        """Test tracking recommendation adoption."""
        project_id = "test-project"
        recommendation_id = "rec-123"
        status = "implemented"
        feedback = "Successfully implemented the recommendation"

        result = await service.track_recommendation_adoption(
            project_id=project_id,
            recommendation_id=recommendation_id,
            status=status,
            feedback=feedback,
        )

        assert result is True

    @pytest.mark.asyncio
    async def test_analyze_project_architecture(self, service, sample_dependencies):
        """Test project architecture analysis."""
        project_id = "test-project"

        with patch.object(
            service, "_get_project_dependencies", return_value=sample_dependencies
        ):
            with patch.object(
                service, "_get_integration_points", return_value=["api-gateway"]
            ):
                arch = await service._analyze_project_architecture(
                    mock_session, project_id
                )

                assert arch.project_id == project_id
                assert "java" in arch.languages
                assert "python" in arch.languages
                assert "javascript" in arch.languages
                assert "spring" in arch.frameworks
                assert "fastapi" in arch.frameworks
                assert arch.dependency_count == 3
                assert arch.cross_language_dependencies == 1
                assert len(arch.integration_points) == 1

    def test_generate_comparison_recommendations(self, service):
        """Test generating recommendations from comparisons."""
        comparisons = {
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
            "proj-3": {
                "patterns": [],
                "integration_count": 0,
                "best_practices_count": 1,
                "performance_issues": 0,
                "confidence_score": 0.5,
            },
        }

        recommendations = service._generate_comparison_recommendations(comparisons)

        assert isinstance(recommendations, list)
        # Should recommend adopting more patterns due to low average
        assert any("adopting more architecture patterns" in r for r in recommendations)
