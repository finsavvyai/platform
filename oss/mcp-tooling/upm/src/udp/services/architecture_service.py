"""
Architecture Service for AI-powered pattern recommendations.

This service provides architectural analysis and recommendations for
cross-language integration patterns, best practices, and performance
optimizations.
"""

import logging
from dataclasses import asdict
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import join, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.base import BaseService
from ..core.models import (
    Package,
    PackageVersion,
    Project,
    ProjectDependency,
)
from ..core.patterns.models import (
    ArchitecturePattern,
    ArchitectureRecommendation,
    ArchitectureRecommendationModel,
    BestPractice,
    IntegrationPattern,
    PatternMatch,
    PerformanceRecommendation,
    ProjectArchitecture,
)
from ..core.patterns.recognition_engine import PatternRecognitionEngine
from ..infrastructure.cache import CacheService
from ..infrastructure.database import get_async_session

logger = logging.getLogger(__name__)


class ArchitectureService(BaseService):
    """AI-powered architecture recommendation service."""

    def __init__(self):
        super().__init__()
        self.pattern_engine = PatternRecognitionEngine()
        self.cache_service = CacheService()

        # Caching configuration
        self.recommendation_cache_ttl = 3600  # 1 hour
        self.analysis_cache_ttl = 1800  # 30 minutes

    async def initialize(self):
        """Initialize the architecture service."""
        await super().initialize()
        logger.info("Architecture service initialized")

    async def get_architecture_recommendations(
        self,
        project_id: str,
        user_id: Optional[str] = None,
        force_refresh: bool = False,
        include_project_structure: bool = False,
    ) -> ArchitectureRecommendationModel:
        """
        Get comprehensive architecture recommendations for a project.

        Args:
            project_id: The project to analyze
            user_id: Optional user context for personalization
            force_refresh: Whether to force a fresh analysis
            include_project_structure: Whether to include file structure analysis

        Returns:
            Complete architecture recommendation with patterns and best practices
        """
        try:
            # Check cache first
            cache_key = f"arch_recommendations:{project_id}:{user_id or 'anonymous'}"
            if not force_refresh:
                cached_result = await self.cache_service.get(cache_key)
                if cached_result:
                    logger.info(
                        f"Returning cached recommendations for project {project_id}"
                    )
                    return ArchitectureRecommendationModel.parse_obj(cached_result)

            logger.info(
                f"Generating architecture recommendations for project {project_id}"
            )

            async with get_async_session() as session:
                # Get project data
                project = await self._get_project(session, project_id)
                if not project:
                    raise ValueError(f"Project {project_id} not found")

                # Analyze project architecture
                project_arch = await self._analyze_project_architecture(
                    session, project_id, include_project_structure
                )

                # Get project structure if requested
                project_structure = None
                if include_project_structure:
                    project_structure = await self._get_project_structure(
                        session, project_id
                    )

                # Get dependency details
                dependencies = await self._get_project_dependencies(session, project_id)

                # Generate recommendations using AI engine
                recommendations = await self.pattern_engine.analyze_architecture(
                    project_arch, project_structure, dependencies
                )

                # Cache the result
                await self.cache_service.set(
                    cache_key,
                    asdict(recommendations),
                    ttl=self.recommendation_cache_ttl,
                )

                # Store analysis result for future reference
                await self._store_analysis_result(
                    session, project_id, user_id, recommendations
                )

                logger.info(
                    f"Generated {len(recommendations.detected_patterns)} patterns, "
                    f"{len(recommendations.integration_patterns)} integration recommendations"
                )

                return ArchitectureRecommendationModel.from_orm(recommendations)

        except Exception as e:
            logger.error(f"Error generating architecture recommendations: {e}")
            raise

    async def detect_patterns(
        self,
        project_id: str,
        pattern_types: Optional[list[ArchitecturePattern]] = None,
    ) -> list[PatternMatch]:
        """
        Detect specific architecture patterns in a project.

        Args:
            project_id: The project to analyze
            pattern_types: Optional list of patterns to focus on

        Returns:
            List of detected patterns with confidence scores
        """
        try:
            cache_key = f"patterns:{project_id}:{hash(tuple(pattern_types or []))}"
            cached_result = await self.cache_service.get(cache_key)
            if cached_result:
                return [PatternMatch(**p) for p in cached_result]

            async with get_async_session() as session:
                project_arch = await self._analyze_project_architecture(
                    session, project_id, include_structure=True
                )

                # Get patterns from the engine
                full_recommendations = await self.pattern_engine.analyze_architecture(
                    project_arch
                )

                # Filter by pattern types if specified
                detected_patterns = full_recommendations.detected_patterns
                if pattern_types:
                    detected_patterns = [
                        p for p in detected_patterns if p.pattern in pattern_types
                    ]

                # Cache the result
                await self.cache_service.set(
                    cache_key,
                    [asdict(p) for p in detected_patterns],
                    ttl=self.analysis_cache_ttl,
                )

                return detected_patterns

        except Exception as e:
            logger.error(f"Error detecting patterns: {e}")
            raise

    async def get_integration_recommendations(
        self,
        project_id: str,
        target_languages: Optional[list[str]] = None,
        performance_requirements: Optional[str] = None,
    ) -> list[IntegrationPattern]:
        """
        Get integration pattern recommendations for cross-language communication.

        Args:
            project_id: The project to analyze
            target_languages: Optional target languages to integrate with
            performance_requirements: Optional performance requirements

        Returns:
            List of integration pattern recommendations
        """
        try:
            async with get_async_session() as session:
                project_arch = await self._analyze_project_architecture(
                    session, project_id
                )

                # Override with provided parameters
                if target_languages:
                    project_arch.languages.extend(
                        [
                            lang
                            for lang in target_languages
                            if lang not in project_arch.languages
                        ]
                    )
                if performance_requirements:
                    project_arch.performance_requirements = performance_requirements

                # Get full recommendations
                recommendations = await self.pattern_engine.analyze_architecture(
                    project_arch
                )

                return recommendations.integration_patterns

        except Exception as e:
            logger.error(f"Error getting integration recommendations: {e}")
            raise

    async def get_best_practices(
        self,
        project_id: str,
        categories: Optional[list[str]] = None,
        pattern_focus: Optional[list[ArchitecturePattern]] = None,
    ) -> list[BestPractice]:
        """
        Get best practice recommendations for the project.

        Args:
            project_id: The project to analyze
            categories: Optional categories to focus on
            pattern_focus: Optional patterns to focus recommendations on

        Returns:
            List of best practice recommendations
        """
        try:
            async with get_async_session() as session:
                project_arch = await self._analyze_project_architecture(
                    session, project_id
                )

                # Get detected patterns
                detected_patterns = []
                if pattern_focus:
                    # Force analysis for specific patterns
                    full_recs = await self.pattern_engine.analyze_architecture(
                        project_arch
                    )
                    detected_patterns = full_recs.detected_patterns

                # Get best practices from engine
                recommendations = await self.pattern_engine.analyze_architecture(
                    project_arch
                )

                # Filter by categories if specified
                best_practices = recommendations.best_practices
                if categories:
                    best_practices = [
                        bp
                        for bp in best_practices
                        if bp.category.lower() in [c.lower() for c in categories]
                    ]

                return best_practices

        except Exception as e:
            logger.error(f"Error getting best practices: {e}")
            raise

    async def get_performance_recommendations(
        self,
        project_id: str,
        focus_areas: Optional[list[str]] = None,
    ) -> list[PerformanceRecommendation]:
        """
        Get performance optimization recommendations.

        Args:
            project_id: The project to analyze
            focus_areas: Optional areas to focus on (e.g., 'database', 'network', 'memory')

        Returns:
            List of performance recommendations
        """
        try:
            async with get_async_session() as session:
                project_arch = await self._analyze_project_architecture(
                    session, project_id
                )

                dependencies = await self._get_project_dependencies(session, project_id)

                # Get recommendations from engine
                recommendations = await self.pattern_engine.analyze_architecture(
                    project_arch, dependencies=dependencies
                )

                # Filter by focus areas if specified
                perf_recs = recommendations.performance_recommendations
                if focus_areas:
                    perf_recs = [
                        pr
                        for pr in perf_recs
                        if any(area in pr.component.lower() for area in focus_areas)
                    ]

                return perf_recs

        except Exception as e:
            logger.error(f"Error getting performance recommendations: {e}")
            raise

    async def compare_architectures(
        self,
        project_ids: list[str],
    ) -> dict[str, Any]:
        """
        Compare architecture patterns across multiple projects.

        Args:
            project_ids: List of project IDs to compare

        Returns:
            Comparison results with patterns and recommendations
        """
        try:
            comparisons = {}

            for project_id in project_ids:
                recommendations = await self.get_architecture_recommendations(
                    project_id, force_refresh=False
                )

                comparisons[project_id] = {
                    "patterns": [
                        p.pattern.value for p in recommendations.detected_patterns
                    ],
                    "integration_count": len(recommendations.integration_patterns),
                    "best_practices_count": len(recommendations.best_practices),
                    "performance_issues": len(
                        recommendations.performance_recommendations
                    ),
                    "confidence_score": recommendations.confidence_score,
                }

            # Find common patterns
            all_patterns = []
            for project_data in comparisons.values():
                all_patterns.extend(project_data["patterns"])

            pattern_frequency = {}
            for pattern in all_patterns:
                pattern_frequency[pattern] = pattern_frequency.get(pattern, 0) + 1

            return {
                "project_comparisons": comparisons,
                "common_patterns": pattern_frequency,
                "recommendations": self._generate_comparison_recommendations(
                    comparisons
                ),
            }

        except Exception as e:
            logger.error(f"Error comparing architectures: {e}")
            raise

    async def track_recommendation_adoption(
        self,
        project_id: str,
        recommendation_id: str,
        status: str,
        feedback: Optional[str] = None,
    ) -> bool:
        """
        Track the adoption and feedback of recommendations.

        Args:
            project_id: The project ID
            recommendation_id: The recommendation being tracked
            status: Adoption status (e.g., 'accepted', 'rejected', 'implemented')
            feedback: Optional feedback from the user

        Returns:
            True if tracking successful
        """
        try:
            # Store adoption data for ML improvement
            adoption_data = {
                "project_id": project_id,
                "recommendation_id": recommendation_id,
                "status": status,
                "feedback": feedback,
                "timestamp": datetime.utcnow().isoformat(),
            }

            # Store in database or analytics system
            # This would be implemented based on the specific analytics requirements

            logger.info(
                f"Tracked recommendation adoption: {recommendation_id} - {status}"
            )
            return True

        except Exception as e:
            logger.error(f"Error tracking recommendation adoption: {e}")
            return False

    # Private helper methods

    async def _get_project(
        self, session: AsyncSession, project_id: str
    ) -> Optional[Project]:
        """Get project by ID."""
        result = await session.execute(select(Project).where(Project.id == project_id))
        return result.scalar_one_or_none()

    async def _analyze_project_architecture(
        self,
        session: AsyncSession,
        project_id: str,
        include_structure: bool = False,
    ) -> ProjectArchitecture:
        """Analyze and build project architecture model."""
        # Get project dependencies
        dependencies = await self._get_project_dependencies(session, project_id)

        # Extract languages from dependencies
        languages = set()
        frameworks = set()
        cross_language_count = 0

        for dep in dependencies:
            # Determine language from package ecosystem
            if dep.get("ecosystem") == "maven":
                languages.add("java")
            elif dep.get("ecosystem") == "npm":
                languages.add("javascript")
            elif dep.get("ecosystem") == "pypi":
                languages.add("python")
            elif dep.get("ecosystem") == "cargo":
                languages.add("rust")
            elif dep.get("ecosystem") == "go":
                languages.add("go")

            # Extract framework information
            name = dep.get("name", "").lower()
            if "spring" in name:
                frameworks.add("spring")
            elif "flask" in name:
                frameworks.add("flask")
            elif "django" in name:
                frameworks.add("django")
            elif "fastapi" in name:
                frameworks.add("fastapi")
            elif "express" in name:
                frameworks.add("express")
            elif "react" in name:
                frameworks.add("react")
            elif "angular" in name:
                frameworks.add("angular")

        # Count cross-language dependencies
        if len(languages) > 1:
            cross_language_count = len(
                [d for d in dependencies if d.get("cross_language")]
            )

        # Get integration points
        integration_points = await self._get_integration_points(session, project_id)

        # Determine complexity indicators
        complexity_indicators = []
        if len(dependencies) > 100:
            complexity_indicators.append("high_dependency_count")
        if len(languages) > 3:
            complexity_indicators.append("polyglot_complexity")
        if cross_language_count > 10:
            complexity_indicators.append("high_cross_language_coupling")

        return ProjectArchitecture(
            project_id=project_id,
            languages=list(languages),
            frameworks=list(frameworks),
            dependency_count=len(dependencies),
            cross_language_dependencies=cross_language_count,
            integration_points=integration_points,
            complexity_indicators=complexity_indicators,
        )

    async def _get_project_dependencies(
        self,
        session: AsyncSession,
        project_id: str,
    ) -> list[dict[str, Any]]:
        """Get all dependencies for a project."""
        query = (
            select(
                ProjectDependency,
                Package,
                PackageVersion,
            )
            .select_from(
                join(
                    ProjectDependency,
                    Package,
                    ProjectDependency.package_id == Package.id,
                ).outerjoin(
                    PackageVersion,
                    ProjectDependency.package_version_id == PackageVersion.id,
                )
            )
            .where(ProjectDependency.project_id == project_id)
        )

        result = await session.execute(query)
        dependencies = []

        for row in result:
            proj_dep, package, version = row

            dependencies.append(
                {
                    "id": proj_dep.id,
                    "name": package.name,
                    "ecosystem": package.ecosystem,
                    "version": version.version if version else None,
                    "scope": proj_dep.scope,
                    "cross_language": bool(proj_dep.cross_language_calls),
                }
            )

        return dependencies

    async def _get_project_structure(
        self,
        session: AsyncSession,
        project_id: str,
    ) -> Optional[dict[str, Any]]:
        """Get project file structure if available."""
        # This would integrate with repository scanning
        # For now, return None as it's not implemented
        return None

    async def _get_integration_points(
        self,
        session: AsyncSession,
        project_id: str,
    ) -> list[str]:
        """Get integration points for the project."""
        # This would identify API endpoints, message queues, etc.
        # For now, return empty list
        return []

    async def _store_analysis_result(
        self,
        session: AsyncSession,
        project_id: str,
        user_id: Optional[str],
        recommendations: ArchitectureRecommendation,
    ) -> None:
        """Store analysis results for historical tracking."""
        # This would store the analysis in the database
        # Implementation depends on the specific schema
        pass

    def _generate_comparison_recommendations(
        self,
        comparisons: dict[str, Any],
    ) -> list[str]:
        """Generate recommendations based on project comparisons."""
        recommendations = []

        # Analyze patterns across projects
        if comparisons:
            avg_patterns = sum(
                len(data["patterns"]) for data in comparisons.values()
            ) / len(comparisons)

            if avg_patterns < 2:
                recommendations.append(
                    "Consider adopting more architecture patterns for better structure"
                )

            avg_issues = sum(
                data["performance_issues"] for data in comparisons.values()
            ) / len(comparisons)

            if avg_issues > 3:
                recommendations.append(
                    "High number of performance issues detected across projects. "
                    "Consider performance optimization initiatives."
                )

        return recommendations
