"""
AI Service for Package Recommendations.

Implements intelligent package recommendations using machine learning
models including collaborative filtering, content-based filtering, and
hybrid approaches with context awareness.
"""

import logging
from dataclasses import asdict
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

import numpy as np
from sqlalchemy import and_, desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.base import BaseService
from ..core.models import (
    Organization,
    Package,
    Project,
    ProjectDependency,
    User,
    UserFeedback,
    Vulnerability,
)
from ..infrastructure.cache import CacheService
from ..infrastructure.database import get_async_session
from ..ml.recommendation_models import (
    HybridRecommendationModel,
    RecommendationResult,
    UserContext,
)

logger = logging.getLogger(__name__)


class AIRecommendationService(BaseService):
    """AI-powered package recommendation service."""

    def __init__(self):
        super().__init__()
        self.hybrid_model = HybridRecommendationModel()
        self.cache_service = CacheService()
        self.model_path = Path("models/recommendations")
        self.model_path.mkdir(parents=True, exist_ok=True)

        # Model configuration
        self.min_interactions_for_cf = 10
        self.feature_extraction_batch_size = 100
        self.recommendation_cache_ttl = 3600  # 1 hour

    async def initialize(self):
        """Initialize the AI service and load trained models."""
        await super().initialize()

        # Try to load pre-trained models
        await self._load_models()

        if not self.hybrid_model.is_trained:
            logger.info("No pre-trained models found, will train on demand")

    async def get_package_recommendations(
        self,
        user_id: Optional[str] = None,
        project_id: Optional[str] = None,
        ecosystem: str = "maven",
        limit: int = 10,
        exclude_packages: Optional[set[str]] = None,
        include_alternatives: bool = True,
    ) -> list[RecommendationResult]:
        """
        Get package recommendations for a user/project.

        Args:
            user_id: The user requesting recommendations
            project_id: The project context for recommendations
            ecosystem: The package ecosystem (maven, npm, pypi, etc.)
            limit: Maximum number of recommendations to return
            exclude_packages: Packages to exclude from recommendations
            include_alternatives: Whether to include alternatives to existing packages

        Returns:
            List of recommendation results with confidence scores
        """
        try:
            # Generate cache key
            cache_key = f"recommendations:{user_id}:{project_id}:{ecosystem}:{limit}"
            if exclude_packages:
                cache_key += f":{hash(tuple(sorted(exclude_packages)))}"

            # Try to get from cache
            cached = await self.cache_service.get(cache_key)
            if cached:
                return [RecommendationResult(**r) for r in cached]

            # Build user context
            context = await self._build_user_context(user_id, project_id, ecosystem)

            # Get candidate packages
            candidates = await self._get_candidate_packages(
                context, exclude_packages or set(), include_alternatives
            )

            if not candidates:
                logger.warning(f"No candidate packages found for context {context}")
                return []

            # Ensure model is trained
            if not self.hybrid_model.is_trained:
                await self._train_models(context)

            # Generate recommendations
            recommendations = await self._generate_recommendations(
                candidates, context, limit
            )

            # Cache results
            await self.cache_service.set(
                cache_key,
                [asdict(r) for r in recommendations],
                ttl=self.recommendation_cache_ttl,
            )

            return recommendations

        except Exception as e:
            logger.error(f"Error getting package recommendations: {e}")
            return []

    async def get_alternative_packages(
        self,
        package_name: str,
        ecosystem: str,
        limit: int = 5,
        user_id: Optional[str] = None,
    ) -> list[RecommendationResult]:
        """
        Get alternative packages for a given package.

        Args:
            package_name: The package to find alternatives for
            ecosystem: The package ecosystem
            limit: Maximum number of alternatives to return
            user_id: User context for personalized alternatives

        Returns:
            List of alternative package recommendations
        """
        try:
            # Get package information
            async with get_async_session() as session:
                package_query = select(Package).where(
                    and_(Package.name == package_name, Package.ecosystem == ecosystem)
                )
                package_result = await session.execute(package_query)
                package = package_result.scalar_one_or_none()

                if not package:
                    logger.warning(f"Package {package_name} not found in {ecosystem}")
                    return []

            # Build context
            context = await self._build_user_context(user_id, None, ecosystem)

            # Find similar packages using content-based filtering
            alternatives = await self._find_similar_packages(package, context, limit)

            # Mark as alternatives
            for alt in alternatives:
                alt.alternative_for = package_name

            return alternatives

        except Exception as e:
            logger.error(f"Error getting alternative packages: {e}")
            return []

    async def update_user_feedback(
        self,
        user_id: str,
        package_name: str,
        ecosystem: str,
        feedback_score: float,  # 0.0 to 1.0
        feedback_type: str,  # "recommendation", "usage", "rating"
        feedback_data: Optional[dict[str, Any]] = None,
    ) -> bool:
        """
        Update user feedback to improve recommendations.

        Args:
            user_id: The user providing feedback
            package_name: The package being rated
            ecosystem: The package ecosystem
            feedback_score: The feedback score (0.0 to 1.0)
            feedback_type: Type of feedback
            feedback_data: Additional feedback data

        Returns:
            True if feedback was successfully recorded
        """
        try:
            async with get_async_session() as session:
                # Store feedback in database
                feedback = UserFeedback(
                    user_id=user_id,
                    package_name=package_name,
                    ecosystem=ecosystem,
                    feedback_score=feedback_score,
                    feedback_type=feedback_type,
                    feedback_data=feedback_data or {},
                    created_at=datetime.utcnow(),
                )

                session.add(feedback)
                await session.commit()

                # Update model with new feedback
                context = UserContext(user_id=user_id, ecosystem=ecosystem)
                self.hybrid_model.update_feedback(
                    package_name, user_id, feedback_score, context
                )

                # Invalidate relevant caches
                await self._invalidate_user_recommendation_cache(user_id)

                logger.info(
                    f"Recorded feedback from user {user_id} for {package_name}: {feedback_score}"
                )

                return True

        except Exception as e:
            logger.error(f"Error updating user feedback: {e}")
            return False

    async def get_recommendation_explanation(
        self,
        package_name: str,
        user_id: Optional[str] = None,
        project_id: Optional[str] = None,
    ) -> dict[str, Any]:
        """
        Get detailed explanation for why a package was recommended.

        Args:
            package_name: The recommended package
            user_id: The user who received the recommendation
            project_id: The project context

        Returns:
            Detailed explanation of the recommendation
        """
        try:
            # Get recommendation details
            recommendations = await self.get_package_recommendations(
                user_id=user_id, project_id=project_id, limit=50
            )

            # Find the specific recommendation
            target_rec = None
            for rec in recommendations:
                if rec.package_name == package_name:
                    target_rec = rec
                    break

            if not target_rec:
                return {"error": "Package not found in recommendations"}

            # Build detailed explanation
            explanation = {
                "package": package_name,
                "confidence_score": target_rec.confidence_score,
                "relevance_score": target_rec.relevance_score,
                "security_score": target_rec.security_score,
                "popularity_score": target_rec.popularity_score,
                "reason": target_rec.reason,
                "benefits": target_rec.benefits,
                "risk_factors": target_rec.risk_factors,
                "similar_packages": target_rec.similar_packages,
                "usage_statistics": target_rec.usage_stats,
                "model_contributions": {
                    "collaborative_filtering": "Teams with similar preferences use this package",
                    "content_based": "Package attributes match your project requirements",
                },
            }

            return explanation

        except Exception as e:
            logger.error(f"Error getting recommendation explanation: {e}")
            return {"error": "Failed to generate explanation"}

    async def _build_user_context(
        self, user_id: Optional[str], project_id: Optional[str], ecosystem: str
    ) -> UserContext:
        """Build user context for recommendations."""
        context = UserContext(
            user_id=user_id, project_id=project_id, ecosystem=ecosystem
        )

        async with get_async_session() as session:
            # Get project information if available
            if project_id:
                project_query = select(Project).where(Project.id == project_id)
                project_result = await session.execute(project_query)
                project = project_result.scalar_one_or_none()

                if project:
                    context.organization_id = project.organization_id
                    context.project_tags = set(project.tags or [])

                    # Get current dependencies
                    deps_query = select(ProjectDependency).where(
                        ProjectDependency.project_id == project_id
                    )
                    deps_result = await session.execute(deps_query)
                    deps = deps_result.scalars().all()

                    for dep in deps:
                        context.current_dependencies.add(dep.package_name)

            # Get user preferences and history
            if user_id:
                # Get user's organizations
                org_query = (
                    select(Organization)
                    .join(User, Organization.id == User.organization_id)
                    .where(User.id == user_id)
                )
                org_result = await session.execute(org_query)
                org = org_result.scalar_one_or_none()

                if org:
                    context.organization_id = org.id

                # Get user's feedback history
                feedback_query = (
                    select(UserFeedback)
                    .where(
                        and_(
                            UserFeedback.user_id == user_id,
                            UserFeedback.ecosystem == ecosystem,
                        )
                    )
                    .order_by(desc(UserFeedback.created_at))
                    .limit(100)
                )

                feedback_result = await session.execute(feedback_query)
                feedbacks = feedback_result.scalars().all()

                # Analyze usage patterns from feedback
                for feedback in feedbacks:
                    if feedback.feedback_type == "usage":
                        context.usage_patterns[feedback.package_name] = (
                            feedback.feedback_score
                        )

                # Set team preferences based on feedback
                if feedbacks:
                    avg_score = sum(f.feedback_score for f in feedbacks) / len(
                        feedbacks
                    )
                    context.team_preferences["quality_threshold"] = avg_score
                    context.team_preferences["security_focus"] = (
                        0.8  # Default to security-focused
                    )

        return context

    async def _get_candidate_packages(
        self,
        context: UserContext,
        exclude_packages: set[str],
        include_alternatives: bool,
    ) -> list[str]:
        """Get candidate packages for recommendations."""
        candidates = []

        async with get_async_session() as session:
            # Base query for packages in the ecosystem
            query = select(Package.name).where(
                and_(
                    Package.ecosystem == context.ecosystem,
                    ~Package.name.in_(exclude_packages),
                )
            )

            # If we have current dependencies, find packages frequently used together
            if context.current_dependencies and include_alternatives:
                # Find packages used in similar projects
                similar_deps_query = (
                    select(ProjectDependency.package_name)
                    .join(Project, ProjectDependency.project_id == Project.id)
                    .where(
                        and_(
                            Project.ecosystem == context.ecosystem,
                            ProjectDependency.package_name.in_(
                                context.current_dependencies
                            ),
                        )
                    )
                    .distinct()
                )

                similar_result = await session.execute(similar_deps_query)
                candidates.extend([r[0] for r in similar_result.fetchall()])

            # Add popular packages in the ecosystem
            popular_query = query.order_by(desc(Package.popularity_score)).limit(200)
            popular_result = await session.execute(popular_query)
            candidates.extend([r[0] for r in popular_result.fetchall()])

            # Add recently updated packages
            recent_query = query.order_by(desc(Package.last_updated)).limit(100)
            recent_result = await session.execute(recent_query)
            candidates.extend([r[0] for r in recent_result.fetchall()])

        # Remove duplicates and exclude current dependencies
        unique_candidates = list(set(candidates) - context.current_dependencies)

        # Limit candidates for performance
        return unique_candidates[:500]

    async def _train_models(self, context: UserContext):
        """Train the recommendation models."""
        try:
            logger.info("Training recommendation models...")

            # Get training data for collaborative filtering
            collab_data = await self._get_collaborative_filtering_data(context)

            # Get training data for content-based filtering
            content_data = await self._get_content_based_filtering_data(context)

            # Train hybrid model
            if collab_data and content_data:
                success = self.hybrid_model.train(collab_data, content_data)
                if success:
                    # Save trained models
                    await self._save_models()
                    logger.info("Models trained and saved successfully")
                else:
                    logger.error("Failed to train models")
            else:
                logger.warning("Insufficient training data available")

        except Exception as e:
            logger.error(f"Error training models: {e}")

    async def _get_collaborative_filtering_data(
        self, context: UserContext
    ) -> Optional[tuple[np.ndarray, np.ndarray]]:
        """Get training data for collaborative filtering."""
        try:
            async with get_async_session() as session:
                # Get user-package interactions from project dependencies
                interactions_query = (
                    select(Project.user_id, ProjectDependency.package_name)
                    .join(Project, ProjectDependency.project_id == Project.id)
                    .where(
                        and_(
                            Project.ecosystem == context.ecosystem,
                            Project.user_id.isnot(None),
                        )
                    )
                    .distinct()
                )

                interactions_result = await session.execute(interactions_query)
                interactions = interactions_result.fetchall()

                if len(interactions) < self.min_interactions_for_cf:
                    return None

                # Convert to numpy arrays
                X = np.array([(str(u), p) for u, p in interactions])
                y = np.ones(len(interactions))  # All interactions are positive

                return X, y

        except Exception as e:
            logger.error(f"Error getting collaborative filtering data: {e}")
            return None

    async def _get_content_based_filtering_data(
        self, context: UserContext
    ) -> Optional[tuple[np.ndarray, np.ndarray]]:
        """Get training data for content-based filtering."""
        try:
            async with get_async_session() as session:
                # Get packages with their features
                packages_query = (
                    select(Package)
                    .where(Package.ecosystem == context.ecosystem)
                    .limit(self.feature_extraction_batch_size)
                )

                packages_result = await session.execute(packages_query)
                packages = packages_result.scalars().all()

                if not packages:
                    return None

                # Extract features for each package
                X = []
                y = []

                for package in packages:
                    features = await self._extract_package_features(package, session)
                    X.append((package.name, features))

                    # Use popularity as target (could be improved with actual usage data)
                    y.append(package.popularity_score or 0.5)

                X = np.array(X)
                y = np.array(y)

                return X, y

        except Exception as e:
            logger.error(f"Error getting content-based filtering data: {e}")
            return None

    async def _extract_package_features(
        self, package: Package, session: AsyncSession
    ) -> dict[str, Any]:
        """Extract features from a package."""
        # Get vulnerability count
        vuln_query = select(func.count(Vulnerability.id)).where(
            Vulnerability.package_name == package.name
        )
        vuln_result = await session.execute(vuln_query)
        vulnerability_count = vuln_result.scalar() or 0

        # Calculate days since last update
        days_since_update = 0
        if package.last_updated:
            days_since_update = (datetime.utcnow() - package.last_updated).days

        # Build feature dictionary
        features = {
            "name": package.name,
            "ecosystem": package.ecosystem,
            "popularity": package.popularity_score or 0.0,
            "security": max(0.0, 1.0 - (vulnerability_count * 0.1)),
            "maintenance": max(0.0, 1.0 - (days_since_update / 365)),
            "community": package.community_score or 0.0,
            "license_compat": 0.8,  # Default, would check actual license
            "deps_count": package.dependencies_count or 0,
            "reverse_deps": package.reverse_dependencies_count or 0,
            "last_updated": days_since_update,
            "vulns": vulnerability_count,
            "download_trend": package.download_trend or 0.0,
            "version_stability": package.version_stability or 0.0,
            "tags": package.tags or [],
            "categories": package.categories or [],
        }

        return features

    async def _generate_recommendations(
        self, candidates: list[str], context: UserContext, limit: int
    ) -> list[RecommendationResult]:
        """Generate recommendations from candidate packages."""
        # Create input array for model
        if context.user_id:
            X = np.array([(context.user_id, pkg) for pkg in candidates])
        else:
            X = np.array([("anonymous", pkg) for pkg in candidates])

        # Get predictions from hybrid model
        recommendations = self.hybrid_model.predict(X, context)

        # Filter and sort recommendations
        filtered_recs = []
        for rec in recommendations:
            # Apply minimum confidence threshold
            if rec.confidence_score >= 0.3:
                # Check policy compliance
                if await self._check_policy_compliance(rec, context):
                    filtered_recs.append(rec)

        # Sort by confidence score and return top recommendations
        filtered_recs.sort(key=lambda r: r.confidence_score, reverse=True)
        return filtered_recs[:limit]

    async def _check_policy_compliance(
        self, recommendation: RecommendationResult, context: UserContext
    ) -> bool:
        """Check if recommendation complies with policies."""
        # Security requirement check
        if context.security_requirements:
            min_security = context.security_requirements.get("min_security_score", 0.5)
            if recommendation.security_score < min_security:
                return False

        # License policy check
        if context.license_policy:
            # In production, check actual license compatibility
            allowed_licenses = context.license_policy.get("allowed_licenses", [])
            if allowed_licenses and recommendation.package_name not in allowed_licenses:
                return False

        return True

    async def _find_similar_packages(
        self, package: Package, context: UserContext, limit: int
    ) -> list[RecommendationResult]:
        """Find packages similar to the given package."""
        try:
            # Get content-based similarities
            async with get_async_session() as session:
                # Find packages with similar tags or categories
                similar_query = (
                    select(Package)
                    .where(
                        and_(
                            Package.ecosystem == package.ecosystem,
                            Package.name != package.name,
                            or_(
                                Package.tags.overlap(package.tags or []),
                                Package.categories.overlap(package.categories or []),
                            ),
                        )
                    )
                    .order_by(desc(Package.popularity_score))
                    .limit(limit * 2)
                )

                similar_result = await session.execute(similar_query)
                similar_packages = similar_result.scalars().all()

            # Create recommendation results
            recommendations = []
            for similar_pkg in similar_packages:
                rec = RecommendationResult(
                    package_name=similar_pkg.name,
                    ecosystem=similar_pkg.ecosystem,
                    version="latest",
                    confidence_score=0.7,  # Default confidence
                    relevance_score=similar_pkg.popularity_score or 0.5,
                    security_score=0.8,  # Would calculate based on vulnerabilities
                    popularity_score=similar_pkg.popularity_score or 0.5,
                    reason=f"Similar to {package.name} with compatible features",
                )
                recommendations.append(rec)

            # Sort and return top recommendations
            recommendations.sort(key=lambda r: r.confidence_score, reverse=True)
            return recommendations[:limit]

        except Exception as e:
            logger.error(f"Error finding similar packages: {e}")
            return []

    async def _save_models(self):
        """Save trained models to disk."""
        try:
            # Save collaborative filtering model
            cf_path = self.model_path / "collaborative_filtering.json"
            self.hybrid_model.collaborative_model.save_model(str(cf_path))

            # Save content-based model
            cb_path = self.model_path / "content_based_filtering.json"
            self.hybrid_model.content_based_model.save_model(str(cb_path))

            logger.info("Models saved to disk")

        except Exception as e:
            logger.error(f"Error saving models: {e}")

    async def _load_models(self):
        """Load pre-trained models from disk."""
        try:
            # Load collaborative filtering model
            cf_path = self.model_path / "collaborative_filtering.json"
            if cf_path.exists():
                self.hybrid_model.collaborative_model.load_model(str(cf_path))

            # Load content-based model
            cb_path = self.model_path / "content_based_filtering.json"
            if cb_path.exists():
                self.hybrid_model.content_based_model.load_model(str(cb_path))

            # Check if both models are loaded
            if (
                self.hybrid_model.collaborative_model.is_trained
                and self.hybrid_model.content_based_model.is_trained
            ):
                self.hybrid_model.is_trained = True
                logger.info("Pre-trained models loaded successfully")

        except Exception as e:
            logger.error(f"Error loading models: {e}")

    async def _invalidate_user_recommendation_cache(self, user_id: str):
        """Invalidate recommendation cache for a user."""
        try:
            # Get all cache keys for this user
            pattern = f"recommendations:{user_id}:*"
            keys = await self.cache_service.keys(pattern)

            # Delete all matching keys
            if keys:
                await self.cache_service.delete_many(keys)

        except Exception as e:
            logger.error(f"Error invalidating cache for user {user_id}: {e}")


# Global service instance
ai_recommendation_service = AIRecommendationService()
