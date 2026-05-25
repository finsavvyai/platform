"""
Unit tests for the Package Recommendation Engine.

Tests the collaborative filtering, content-based filtering, and hybrid
recommendation models, as well as the AI service integration.
"""

import pytest
import numpy as np
import json
from datetime import datetime, timedelta
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from typing import List, Dict, Any

from src.udp.ml.recommendation_models import (
    CollaborativeFilteringModel,
    ContentBasedFilteringModel,
    HybridRecommendationModel,
    UserContext,
    RecommendationResult,
    PackageFeatures,
)
from src.udp.services.ai_service import AIRecommendationService
from src.udp.core.models import (
    User,
    Project,
    Package,
    UserFeedback,
    Organization,
    ProjectDependency,
)


class TestCollaborativeFilteringModel:
    """Test cases for Collaborative Filtering Model."""

    @pytest.fixture
    def model(self):
        """Create a collaborative filtering model instance."""
        return CollaborativeFilteringModel()

    @pytest.fixture
    def sample_training_data(self):
        """Create sample training data."""
        # User-item interaction data
        X = np.array(
            [
                ["user1", "package1"],
                ["user1", "package2"],
                ["user1", "package3"],
                ["user2", "package1"],
                ["user2", "package3"],
                ["user2", "package4"],
                ["user3", "package2"],
                ["user3", "package3"],
                ["user3", "package4"],
                ["user3", "package5"],
            ]
        )

        # Interaction scores (1 for positive interaction)
        y = np.array([1, 1, 0.8, 1, 0.9, 1, 0.7, 1, 0.8, 1])

        return X, y

    def test_model_initialization(self, model):
        """Test model initialization."""
        assert model.model_name == "collaborative_filtering"
        assert model.version == "1.0.0"
        assert model.similarity_metric == "cosine"
        assert not model.is_trained
        assert model.user_item_matrix is None
        assert model.item_similarity_matrix is None

    def test_train_model(self, model, sample_training_data):
        """Test model training."""
        X, y = sample_training_data

        # Train the model
        metrics = model.train(X, y)

        # Check that model is trained
        assert model.is_trained
        assert model.training_data_size == len(X)
        assert len(model.user_index_map) == 3  # 3 unique users
        assert len(model.package_index_map) == 5  # 5 unique packages

        # Check metrics
        assert metrics.accuracy > 0
        assert metrics.precision > 0
        assert metrics.recall > 0
        assert metrics.f1_score > 0
        assert metrics.auc_roc > 0

    def test_predict_with_trained_model(self, model, sample_training_data):
        """Test predictions with trained model."""
        X, y = sample_training_data

        # Train the model
        model.train(X, y)

        # Test predictions
        test_X = np.array(
            [
                ["user1", "package1"],  # Known interaction
                ["user1", "package5"],  # New package for user1
                ["user3", "package1"],  # New package for user3
            ]
        )

        result = model.predict(test_X)

        # Check prediction structure
        assert len(result.prediction) == 3
        assert result.confidence > 0
        assert result.model_version == model.version

        # Check prediction values are within [0, 1]
        assert all(0 <= p <= 1 for p in result.prediction)

    def test_predict_without_training(self, model):
        """Test prediction without training raises error."""
        with pytest.raises(ValueError, match="Model must be trained"):
            model.predict(np.array([["user1", "package1"]]))

    def test_cosine_similarity(self, model):
        """Test cosine similarity calculation."""
        vec1 = np.array([1, 0, 1])
        vec2 = np.array([0, 1, 1])

        similarity = model._cosine_similarity(vec1, vec2)

        # Check similarity is between 0 and 1
        assert 0 <= similarity <= 1

        # Test with identical vectors
        assert model._cosine_similarity(vec1, vec1) == 1.0

        # Test with orthogonal vectors
        orthogonal1 = np.array([1, 0])
        orthogonal2 = np.array([0, 1])
        assert model._cosine_similarity(orthogonal1, orthogonal2) == 0.0

    def test_jaccard_similarity(self, model):
        """Test Jaccard similarity calculation."""
        vec1 = np.array([1, 0, 1, 1])
        vec2 = np.array([0, 1, 1, 1])

        similarity = model._jaccard_similarity(vec1, vec2)

        # Check similarity is between 0 and 1
        assert 0 <= similarity <= 1

        # Calculate expected Jaccard similarity
        intersection = 2  # Two common items (indices 2 and 3)
        union = 3  # Three unique items (indices 0, 1, and either 2 or 3)
        expected = intersection / union
        assert abs(similarity - expected) < 0.001

    def test_get_similar_packages(self, model, sample_training_data):
        """Test getting similar packages."""
        X, y = sample_training_data
        model.train(X, y)

        # Get similar packages
        similar = model.get_similar_packages("package1", top_k=3)

        # Check structure
        assert len(similar) <= 3
        assert all(isinstance(pkg, tuple) and len(pkg) == 2 for pkg in similar)
        assert all(
            isinstance(name, str) and isinstance(score, float)
            for name, score in similar
        )

        # Check that package1 itself is not included
        package_names = [name for name, _ in similar]
        assert "package1" not in package_names

    def test_save_and_load_model(self, model, sample_training_data, tmp_path):
        """Test saving and loading model."""
        X, y = sample_training_data

        # Train model
        model.train(X, y)

        # Save model
        save_path = tmp_path / "test_model.json"
        success = model.save_model(str(save_path))
        assert success
        assert save_path.exists()

        # Load model into new instance
        new_model = CollaborativeFilteringModel()
        load_success = new_model.load_model(str(save_path))
        assert load_success

        # Check that loaded model has same properties
        assert new_model.is_trained
        assert new_model.model_name == model.model_name
        assert new_model.version == model.version
        assert len(new_model.user_index_map) == len(model.user_index_map)
        assert len(new_model.package_index_map) == len(model.package_index_map)


class TestContentBasedFilteringModel:
    """Test cases for Content-Based Filtering Model."""

    @pytest.fixture
    def model(self):
        """Create a content-based filtering model instance."""
        return ContentBasedFilteringModel()

    @pytest.fixture
    def sample_package_data(self):
        """Create sample package feature data."""
        packages = [
            (
                "package1",
                {
                    "name": "package1",
                    "ecosystem": "maven",
                    "popularity": 0.9,
                    "security": 0.8,
                    "maintenance": 0.85,
                    "community": 0.7,
                    "license_compat": 0.9,
                    "deps_count": 5,
                    "reverse_deps": 100,
                    "last_updated": 30,
                    "vulns": 0,
                    "download_trend": 0.1,
                    "version_stability": 0.8,
                    "tags": ["web", "framework"],
                    "categories": ["development"],
                },
            ),
            (
                "package2",
                {
                    "name": "package2",
                    "ecosystem": "maven",
                    "popularity": 0.7,
                    "security": 0.9,
                    "maintenance": 0.6,
                    "community": 0.8,
                    "license_compat": 0.7,
                    "deps_count": 10,
                    "reverse_deps": 50,
                    "last_updated": 100,
                    "vulns": 1,
                    "download_trend": -0.05,
                    "version_stability": 0.6,
                    "tags": ["security", "utility"],
                    "categories": ["security"],
                },
            ),
        ]

        X = np.array(packages)
        y = np.array([0.9, 0.7])  # Target scores

        return X, y

    def test_model_initialization(self, model):
        """Test model initialization."""
        assert model.model_name == "content_based_filtering"
        assert model.version == "1.0.0"
        assert not model.is_trained
        assert "popularity" in model.feature_weights
        assert "security" in model.feature_weights
        assert sum(model.feature_weights.values()) == 1.0

    def test_train_model(self, model, sample_package_data):
        """Test model training."""
        X, y = sample_package_data

        # Train the model
        metrics = model.train(X, y)

        # Check that model is trained
        assert model.is_trained
        assert len(model.package_features) == 2

        # Check metrics
        assert metrics.accuracy > 0
        assert metrics.precision > 0
        assert metrics.recall > 0
        assert metrics.f1_score > 0

    def test_calculate_package_score(self, model, sample_package_data):
        """Test package score calculation."""
        X, y = sample_package_data
        model.train(X, y)

        # Get package features
        features = model.package_features["package1"]

        # Calculate score
        score = model._calculate_package_score(features)

        # Check score is within [0, 1]
        assert 0 <= score <= 1

        # Popular, secure package should have high score
        assert score > 0.7

    def test_feature_confidence_calculation(self, model):
        """Test feature confidence calculation."""
        # Complete features
        complete_features = PackageFeatures(
            package_id="test",
            name="test",
            ecosystem="maven",
            popularity_score=0.8,
            security_score=0.9,
            maintenance_score=0.7,
            community_score=0.6,
            license_compatibility=0.9,
            dependency_count=5,
            last_updated_days=30,
        )

        confidence = model._calculate_feature_confidence(complete_features)
        assert confidence == 1.0  # All features present

        # Incomplete features
        incomplete_features = PackageFeatures(
            package_id="test", name="test", ecosystem="maven"
        )

        confidence = model._calculate_feature_confidence(incomplete_features)
        assert confidence < 0.5  # Few features present


class TestHybridRecommendationModel:
    """Test cases for Hybrid Recommendation Model."""

    @pytest.fixture
    def hybrid_model(self):
        """Create a hybrid recommendation model instance."""
        return HybridRecommendationModel()

    @pytest.fixture
    def user_context(self):
        """Create a sample user context."""
        return UserContext(
            user_id="user123",
            project_id="project456",
            ecosystem="maven",
            current_dependencies={"spring-boot", "junit"},
            project_tags={"web", "enterprise"},
            security_requirements={"min_security_score": 0.8},
            team_preferences={"quality_threshold": 0.7},
        )

    def test_model_initialization(self, hybrid_model):
        """Test model initialization."""
        assert not hybrid_model.is_trained
        assert hybrid_model.hybrid_weights["collaborative"] == 0.6
        assert hybrid_model.hybrid_weights["content"] == 0.4
        assert sum(hybrid_model.hybrid_weights.values()) == 1.0

    def test_context_weight_calculation(self, hybrid_model):
        """Test context-aware weight calculation."""
        # Context with user and project
        context1 = UserContext(
            user_id="user123", project_id="project456", ecosystem="maven"
        )
        weights1 = hybrid_model._calculate_context_weights(context1)
        assert "collaborative" in weights1
        assert "content" in weights1
        assert sum(weights1.values()) == 1.0

        # Context without user (rely more on content)
        context2 = UserContext(project_id="project456", ecosystem="maven")
        weights2 = hybrid_model._calculate_context_weights(context2)
        assert weights2["content"] > weights2["collaborative"]

        # Context with security requirements (rely more on content)
        context3 = UserContext(
            user_id="user123",
            ecosystem="maven",
            security_requirements={"min_security_score": 0.9},
        )
        weights3 = hybrid_model._calculate_context_weights(context3)
        assert weights3["content"] > weights3["collaborative"]

    def test_benefit_identification(self, hybrid_model, user_context):
        """Test benefit identification for recommendations."""
        # Secure, popular package
        secure_package = PackageFeatures(
            package_id="secure-lib",
            name="secure-lib",
            ecosystem="maven",
            security_score=0.95,
            popularity_score=0.9,
            maintenance_score=0.9,
            community_score=0.8,
            vulnerability_count=0,
            last_updated_days=10,
            dependency_count=3,
            tags=["security", "encryption"],
        )

        benefits = hybrid_model._identify_benefits(secure_package, user_context)

        assert "Secure with no known vulnerabilities" in benefits
        assert "Proven in production by many organizations" in benefits
        assert "Regular updates and bug fixes" in benefits

    def test_risk_identification(self, hybrid_model, user_context):
        """Test risk factor identification."""
        # Package with risks
        risky_package = PackageFeatures(
            package_id="risky-lib",
            name="risky-lib",
            ecosystem="maven",
            security_score=0.3,
            popularity_score=0.2,
            maintenance_score=0.3,
            vulnerability_count=5,
            last_updated_days=500,
            dependency_count=100,
        )

        risks = hybrid_model._identify_risk_factors(risky_package, user_context)

        assert any("vulnerabilities" in risk for risk in risks)
        assert "Not updated in over a year" in risks
        assert "Large dependency tree may impact bundle size" in risks


class TestAIRecommendationService:
    """Test cases for AI Recommendation Service."""

    @pytest.fixture
    def service(self):
        """Create AI recommendation service instance."""
        return AIRecommendationService()

    @pytest.fixture
    def mock_session(self):
        """Create mock database session."""
        session = AsyncMock()
        return session

    @pytest.fixture
    def sample_user(self):
        """Create sample user."""
        user = User()
        user.id = "user123"
        user.email = "test@example.com"
        user.name = "Test User"
        return user

    @pytest.fixture
    def sample_project(self):
        """Create sample project."""
        project = Project()
        project.id = "project456"
        project.name = "Test Project"
        project.ecosystem = "maven"
        project.organization_id = "org789"
        project.tags = ["web", "enterprise"]
        return project

    @pytest.fixture
    def sample_package(self):
        """Create sample package."""
        package = Package()
        package.name = "spring-boot-starter-web"
        package.ecosystem = "maven"
        package.popularity_score = 0.95
        package.community_score = 0.9
        package.last_updated = datetime.utcnow() - timedelta(days=30)
        package.tags = ["web", "framework", "spring"]
        return package

    @pytest.mark.asyncio
    async def test_build_user_context(
        self, service, mock_session, sample_user, sample_project
    ):
        """Test building user context."""
        # Mock queries
        mock_session.execute.side_effect = [
            AsyncMock(scalar_one_or_none=AsyncMock(return_value=sample_project)),
            AsyncMock(scalars=AsyncMock(all=AsyncMock(return_value=[]))),
            AsyncMock(scalar_one_or_none=AsyncMock(return_value=None)),
            AsyncMock(scalars=AsyncMock(all=AsyncMock(return_value=[]))),
        ]

        with patch("src.udp.services.ai_service.get_async_session") as mock_get_session:
            mock_get_session.return_value.__aenter__.return_value = mock_session

            context = await service._build_user_context(
                user_id=sample_user.id, project_id=sample_project.id, ecosystem="maven"
            )

            assert context.user_id == sample_user.id
            assert context.project_id == sample_project.id
            assert context.ecosystem == "maven"
            assert context.organization_id == sample_project.organization_id
            assert "web" in context.project_tags

    @pytest.mark.asyncio
    async def test_extract_package_features(
        self, service, mock_session, sample_package
    ):
        """Test package feature extraction."""
        # Mock vulnerability count query
        mock_session.execute.return_value.scalar.return_value = 0

        features = await service._extract_package_features(sample_package, mock_session)

        assert features["name"] == sample_package.name
        assert features["ecosystem"] == sample_package.ecosystem
        assert features["popularity"] == sample_package.popularity_score
        assert features["community"] == sample_package.community_score
        assert features["vulns"] == 0

    @pytest.mark.asyncio
    async def test_get_package_recommendations(
        self, service, sample_user, sample_project, sample_package
    ):
        """Test getting package recommendations."""
        # Mock dependencies
        with (
            patch.object(service, "_build_user_context") as mock_build_context,
            patch.object(service, "_get_candidate_packages") as mock_candidates,
            patch.object(service, "_generate_recommendations") as mock_generate,
        ):
            # Setup mocks
            mock_context = UserContext(
                user_id=sample_user.id, project_id=sample_project.id, ecosystem="maven"
            )
            mock_build_context.return_value = mock_context
            mock_candidates.return_value = ["package1", "package2", "package3"]

            mock_recommendations = [
                RecommendationResult(
                    package_name="package1",
                    ecosystem="maven",
                    version="1.0.0",
                    confidence_score=0.9,
                    relevance_score=0.85,
                    security_score=0.95,
                    popularity_score=0.9,
                    reason="Highly secure and popular package",
                )
            ]
            mock_generate.return_value = mock_recommendations

            # Mock cache
            with (
                patch.object(service.cache_service, "get", return_value=None),
                patch.object(service.cache_service, "set") as mock_cache_set,
            ):
                recommendations = await service.get_package_recommendations(
                    user_id=sample_user.id,
                    project_id=sample_project.id,
                    ecosystem="maven",
                    limit=10,
                )

                assert len(recommendations) == 1
                assert recommendations[0].package_name == "package1"
                assert recommendations[0].confidence_score == 0.9

                # Verify cache was called
                mock_cache_set.assert_called_once()

    @pytest.mark.asyncio
    async def test_update_user_feedback(self, service, mock_session):
        """Test updating user feedback."""
        with patch("src.udp.services.ai_service.get_async_session") as mock_get_session:
            mock_get_session.return_value.__aenter__.return_value = mock_session

            # Mock feedback submission
            success = await service.update_user_feedback(
                user_id="user123",
                package_name="spring-boot",
                ecosystem="maven",
                feedback_score=0.9,
                feedback_type="rating",
                feedback_data={"comment": "Excellent library!"},
            )

            assert success

            # Verify session operations
            mock_session.add.assert_called_once()
            mock_session.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_alternative_packages(
        self, service, mock_session, sample_package
    ):
        """Test getting alternative packages."""
        # Mock package query
        mock_session.execute.return_value.scalar_one_or_none.return_value = (
            sample_package
        )

        with (
            patch.object(service, "_build_user_context") as mock_build_context,
            patch.object(service, "_find_similar_packages") as mock_similar,
        ):
            mock_context = UserContext(ecosystem="maven")
            mock_build_context.return_value = mock_context

            mock_alternatives = [
                RecommendationResult(
                    package_name="micronaut",
                    ecosystem="maven",
                    version="2.0.0",
                    confidence_score=0.75,
                    relevance_score=0.8,
                    security_score=0.85,
                    popularity_score=0.7,
                    reason="Lightweight alternative to Spring Boot",
                )
            ]
            mock_similar.return_value = mock_alternatives

            alternatives = await service.get_alternative_packages(
                package_name="spring-boot",
                ecosystem="maven",
                limit=5,
                user_id="user123",
            )

            assert len(alternatives) == 1
            assert alternatives[0].package_name == "micronaut"
            assert alternatives[0].alternative_for == "spring-boot"

    @pytest.mark.asyncio
    async def test_get_recommendation_explanation(self, service):
        """Test getting recommendation explanation."""
        with patch.object(service, "get_package_recommendations") as mock_recs:
            # Setup mock recommendations
            mock_recommendations = [
                RecommendationResult(
                    package_name="spring-boot",
                    ecosystem="maven",
                    confidence_score=0.9,
                    relevance_score=0.85,
                    security_score=0.95,
                    popularity_score=0.9,
                    reason="Excellent framework for web applications",
                    benefits=["Secure", "Popular", "Well-maintained"],
                    risk_factors=["Large dependency tree"],
                    similar_packages=["micronaut", "quarkus"],
                    usage_stats={"downloads": "10M+", "stars": "60K+"},
                )
            ]
            mock_recs.return_value = mock_recommendations

            explanation = await service.get_recommendation_explanation(
                package_name="spring-boot", user_id="user123", project_id="project456"
            )

            assert explanation["package"] == "spring-boot"
            assert explanation["confidence_score"] == 0.9
            assert "Excellent framework" in explanation["reason"]
            assert len(explanation["benefits"]) > 0
            assert len(explanation["risk_factors"]) > 0
            assert "model_contributions" in explanation

    def test_policy_compliance_check(self, service):
        """Test policy compliance checking."""
        # High security package
        recommendation = RecommendationResult(
            package_name="secure-lib",
            ecosystem="maven",
            confidence_score=0.9,
            relevance_score=0.8,
            security_score=0.95,
            popularity_score=0.8,
            reason="Secure library",
        )

        # Context with high security requirements
        context = UserContext(
            ecosystem="maven", security_requirements={"min_security_score": 0.9}
        )

        compliant = service._check_policy_compliance(recommendation, context)
        assert compliant

        # Low security package
        low_sec_rec = RecommendationResult(
            package_name="risky-lib",
            ecosystem="maven",
            confidence_score=0.5,
            relevance_score=0.6,
            security_score=0.3,
            popularity_score=0.4,
            reason="Risky library",
        )

        non_compliant = service._check_policy_compliance(low_sec_rec, context)
        assert not non_compliant

    @pytest.mark.asyncio
    async def test_cache_invalidation(self, service):
        """Test cache invalidation for user recommendations."""
        with (
            patch.object(
                service.cache_service,
                "keys",
                return_value=[
                    "recommendations:user123:project456:maven:10",
                    "recommendations:user123::npm:5",
                ],
            ),
            patch.object(service.cache_service, "delete_many") as mock_delete,
        ):
            await service._invalidate_user_recommendation_cache("user123")

            mock_delete.assert_called_once_with(
                [
                    "recommendations:user123:project456:maven:10",
                    "recommendations:user123::npm:5",
                ]
            )


class TestRecommendationIntegration:
    """Integration tests for the recommendation system."""

    @pytest.mark.asyncio
    async def test_end_to_end_recommendation_flow(self):
        """Test complete recommendation flow from request to response."""
        # This would be a more comprehensive integration test
        # that tests the actual API endpoints with real data

        # For now, we'll simulate the flow
        service = AIRecommendationService()

        # Mock all external dependencies
        with (
            patch.object(service, "_build_user_context"),
            patch.object(service, "_get_candidate_packages") as mock_candidates,
            patch.object(service, "_generate_recommendations") as mock_generate,
            patch.object(service.cache_service, "get", return_value=None),
        ):
            # Setup
            mock_candidates.return_value = ["spring-boot", "micronaut", "quarkus"]

            mock_recommendations = [
                RecommendationResult(
                    package_name="spring-boot",
                    ecosystem="maven",
                    version="2.7.0",
                    confidence_score=0.92,
                    relevance_score=0.88,
                    security_score=0.90,
                    popularity_score=0.95,
                    reason="Most popular Java web framework",
                ),
                RecommendationResult(
                    package_name="micronaut",
                    ecosystem="maven",
                    version="3.5.0",
                    confidence_score=0.85,
                    relevance_score=0.82,
                    security_score=0.88,
                    popularity_score=0.75,
                    reason="Lightweight alternative to Spring Boot",
                ),
            ]
            mock_generate.return_value = mock_recommendations

            # Execute
            recommendations = await service.get_package_recommendations(
                user_id="user123", project_id="project456", ecosystem="maven", limit=10
            )

            # Verify
            assert len(recommendations) == 2
            assert recommendations[0].package_name == "spring-boot"
            assert (
                recommendations[0].confidence_score
                > recommendations[1].confidence_score
            )

    def test_model_persistence_and_loading(self, tmp_path):
        """Test saving and loading models across sessions."""
        # Create and train models
        cf_model = CollaborativeFilteringModel()
        cb_model = ContentBasedFilteringModel()

        # Create sample data
        X_collab = np.array([["user1", "pkg1"], ["user2", "pkg2"]])
        y_collab = np.array([1, 1])

        X_content = np.array([("pkg1", {"popularity": 0.9, "security": 0.8})])
        y_content = np.array([0.85])

        # Train models
        cf_model.train(X_collab, y_collab)
        cb_model.train(X_content, y_content)

        # Save models
        cf_path = tmp_path / "cf_model.json"
        cb_path = tmp_path / "cb_model.json"

        cf_model.save_model(str(cf_path))
        cb_model.save_model(str(cb_path))

        # Load models in new instances
        new_cf = CollaborativeFilteringModel()
        new_cb = ContentBasedFilteringModel()

        new_cf.load_model(str(cf_path))
        new_cb.load_model(str(cb_path))

        # Verify loaded models
        assert new_cf.is_trained
        assert new_cb.is_trained
        assert len(new_cf.user_index_map) == len(cf_model.user_index_map)
        assert len(new_cb.package_features) == len(cb_model.package_features)
