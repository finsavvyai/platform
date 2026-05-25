"""
Unit tests for Workflow Optimizer module.

Tests the ML-based complexity prediction, intelligent routing,
and resource optimization functionality.
"""

import pytest
import asyncio
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
import uuid

from udp.core.workflow_optimizer import (
    WorkflowOptimizer,
    WorkflowComplexity,
    RoutingStrategy,
    RoutingDecision,
    WorkflowFeatures,
    ResourceMetrics,
)
from udp.core.models.project import Project


@pytest.fixture
def mock_project():
    """Create a mock project for testing."""
    project = MagicMock(spec=Project)
    project.id = uuid.uuid4()
    project.name = "test-project"
    project.primary_language = "python"
    project.organization_id = uuid.uuid4()
    return project


@pytest.fixture
def workflow_config():
    """Sample workflow configuration."""
    return {
        "workflow_id": str(uuid.uuid4()),
        "steps": [
            "dependency_extraction",
            "security_scanning",
            "policy_evaluation",
            "recommendation_generation",
        ],
        "security_scan": True,
        "policy_check": True,
        "require_approval": False,
        "include_transitive": True,
        "priority": 5,
        "resources": {"cpu": 2, "memory": 1024, "timeout": 1800},
    }


@pytest.fixture
def optimizer():
    """Create workflow optimizer instance."""
    return WorkflowOptimizer(organization_id=str(uuid.uuid4()))


class TestWorkflowOptimizer:
    """Test cases for WorkflowOptimizer class."""

    @pytest.mark.asyncio
    async def test_analyze_workflow_complexity_simple(
        self, optimizer, mock_project, workflow_config
    ):
        """Test complexity analysis for simple workflow."""
        # Mock the complexity predictor
        optimizer.complexity_predictor.predict_complexity = AsyncMock(return_value=0.2)

        # Mock database queries
        with patch.object(optimizer, "_extract_workflow_features") as mock_extract:
            mock_extract.return_value = WorkflowFeatures(
                project_size=10,
                ecosystem_count=1,
                has_transitive_deps=False,
                security_scan_required=True,
                policy_evaluation_required=True,
                human_approval_required=False,
                historical_success_rate=0.95,
                avg_execution_time=300,
                concurrent_workflows=2,
                system_load=0.3,
                priority_score=5,
                estimated_resources={},
            )

            complexity, confidence = await optimizer.analyze_workflow_complexity(
                mock_project, workflow_config
            )

            assert complexity == WorkflowComplexity.SIMPLE
            assert 0 <= confidence <= 1
            assert confidence > 0.5  # Should have reasonable confidence

    @pytest.mark.asyncio
    async def test_analyze_workflow_complexity_complex(
        self, optimizer, mock_project, workflow_config
    ):
        """Test complexity analysis for complex workflow."""
        # Mock the complexity predictor
        optimizer.complexity_predictor.predict_complexity = AsyncMock(return_value=0.8)

        # Create complex workflow config
        complex_config = workflow_config.copy()
        complex_config.update(
            {
                "require_approval": True,
                "steps": workflow_config["steps"] * 3,  # More steps
                "deep_analysis": True,
            }
        )

        with patch.object(optimizer, "_extract_workflow_features") as mock_extract:
            mock_extract.return_value = WorkflowFeatures(
                project_size=500,
                ecosystem_count=5,
                has_transitive_deps=True,
                security_scan_required=True,
                policy_evaluation_required=True,
                human_approval_required=True,
                historical_success_rate=0.85,
                avg_execution_time=3600,
                concurrent_workflows=8,
                system_load=0.7,
                priority_score=8,
                estimated_resources={},
            )

            complexity, confidence = await optimizer.analyze_workflow_complexity(
                mock_project, complex_config
            )

            assert complexity == WorkflowComplexity.VERY_COMPLEX
            assert 0 <= confidence <= 1

    @pytest.mark.asyncio
    async def test_optimize_workflow_routing_high_load(
        self, optimizer, workflow_config
    ):
        """Test routing optimization under high system load."""
        workflow_id = workflow_config["workflow_id"]

        # Create high load metrics
        high_load_metrics = ResourceMetrics(
            cpu_usage=0.9,
            memory_usage=0.85,
            active_workflows=15,
            queue_length=10,
            avg_response_time=5.0,
            throughput=0.5,
            error_rate=0.1,
        )

        with patch.object(
            optimizer, "_get_current_metrics", return_value=high_load_metrics
        ):
            decision = await optimizer.optimize_workflow_routing(
                workflow_id,
                WorkflowComplexity.COMPLEX,
                workflow_config,
                high_load_metrics,
            )

            assert isinstance(decision, RoutingDecision)
            assert decision.workflow_id == workflow_id
            assert decision.strategy in [
                RoutingStrategy.PRIORITY_QUEUE,
                RoutingStrategy.ADAPTIVE,
            ]
            assert (
                decision.priority >= 7
            )  # Should get higher priority due to complexity
            assert decision.confidence_score > 0

    @pytest.mark.asyncio
    async def test_optimize_workflow_routing_low_load(self, optimizer, workflow_config):
        """Test routing optimization under low system load."""
        workflow_id = workflow_config["workflow_id"]

        # Create low load metrics
        low_load_metrics = ResourceMetrics(
            cpu_usage=0.2,
            memory_usage=0.3,
            active_workflows=2,
            queue_length=0,
            avg_response_time=0.5,
            throughput=0.95,
            error_rate=0.01,
        )

        with patch.object(
            optimizer, "_get_current_metrics", return_value=low_load_metrics
        ):
            decision = await optimizer.optimize_workflow_routing(
                workflow_id,
                WorkflowComplexity.SIMPLE,
                workflow_config,
                low_load_metrics,
            )

            assert isinstance(decision, RoutingDecision)
            assert decision.strategy == RoutingStrategy.SEQUENTIAL
            assert (
                len(decision.parallel_nodes) == 0
            )  # Simple workflows shouldn't have parallel nodes

    @pytest.mark.asyncio
    async def test_adapt_workflow_execution_slow_performance(self, optimizer):
        """Test workflow adaptation for slow performance."""
        workflow_id = str(uuid.uuid4())

        # Simulate slow performance
        current_state = {
            "progress": 0.3,  # Only 30% complete
            "estimated_duration": 3600,  # 1 hour estimated
            "quality_score": 0.8,
        }

        performance_metrics = {
            "elapsed_time": 1800,  # Already 30 minutes elapsed
            "cpu_usage": 0.95,
            "error_rate": 0.02,
        }

        adaptations = await optimizer.adapt_workflow_execution(
            workflow_id, current_state, performance_metrics
        )

        assert isinstance(adaptations, dict)
        assert "parallelize_remaining" in adaptations
        assert adaptations["parallelize_remaining"] is True
        assert "scale_resources" in adaptations
        assert adaptations["scale_resources"] == "increase"

    @pytest.mark.asyncio
    async def test_adapt_workflow_execution_high_error_rate(self, optimizer):
        """Test workflow adaptation for high error rate."""
        workflow_id = str(uuid.uuid4())

        current_state = {"progress": 0.5, "quality_score": 0.9}

        performance_metrics = {
            "error_rate": 0.15,  # 15% error rate
            "cpu_usage": 0.6,
        }

        adaptations = await optimizer.adapt_workflow_execution(
            workflow_id, current_state, performance_metrics
        )

        assert "retry_strategy" in adaptations
        assert adaptations["retry_strategy"] == "exponential_backoff"
        assert "circuit_breaker" in adaptations
        assert adaptations["circuit_breaker"] is True

    @pytest.mark.asyncio
    async def test_learn_from_execution_success(self, optimizer):
        """Test learning from successful execution."""
        workflow_id = str(uuid.uuid4())

        # Simulate successful execution
        actual_duration = timedelta(minutes=45)
        actual_resources = {"cpu": 2.5, "memory": 1536}
        success = True

        # Mock the ML predictor
        optimizer.complexity_predictor.update_model = AsyncMock()

        # Add a routing decision to history
        from dataclasses import asdict

        optimizer._routing_history.append(
            {
                "timestamp": datetime.utcnow(),
                "decision": asdict(
                    RoutingDecision(
                        workflow_id=workflow_id,
                        strategy=RoutingStrategy.PARALLEL,
                        priority=7,
                        estimated_duration=timedelta(minutes=30),
                        resource_allocation={},
                        parallel_nodes=[],
                        optimization_reasons=[],
                        confidence_score=0.8,
                    )
                ),
            }
        )

        await optimizer.learn_from_execution(
            workflow_id, actual_duration, actual_resources, success
        )

        # Verify ML model was updated
        optimizer.complexity_predictor.update_model.assert_called_once()

    @pytest.mark.asyncio
    async def test_extract_workflow_features(self, optimizer, mock_project):
        """Test workflow feature extraction."""
        workflow_config = {
            "security_scan": True,
            "policy_check": True,
            "require_approval": False,
            "include_transitive": True,
            "priority": 5,
            "resources": {"cpu": 2},
        }

        with patch("udp.core.workflow_optimizer.get_async_session") as mock_session:
            mock_session.return_value.__aenter__.return_value.scalar = AsyncMock(
                side_effect=[
                    50,
                    3,
                    600,
                    8,
                    10,
                ]  # deps_count, ecosystems, avg_duration, success, total
            )

            features = await optimizer._extract_workflow_features(
                mock_project, workflow_config
            )

            assert isinstance(features, WorkflowFeatures)
            assert features.project_size == 50
            assert features.ecosystem_count == 3
            assert features.has_transitive_deps is True
            assert features.security_scan_required is True
            assert features.policy_evaluation_required is True
            assert features.human_approval_required is False
            assert features.priority_score == 5

    def test_score_to_complexity(self, optimizer):
        """Test conversion of complexity score to complexity level."""
        assert optimizer._score_to_complexity(0.1) == WorkflowComplexity.SIMPLE
        assert optimizer._score_to_complexity(0.3) == WorkflowComplexity.MODERATE
        assert optimizer._score_to_complexity(0.6) == WorkflowComplexity.COMPLEX
        assert optimizer._score_to_complexity(0.9) == WorkflowComplexity.VERY_COMPLEX

    def test_calculate_confidence(self, optimizer):
        """Test confidence score calculation."""
        # High confidence features
        high_conf_features = WorkflowFeatures(
            project_size=100,
            ecosystem_count=3,
            has_transitive_deps=True,
            security_scan_required=True,
            policy_evaluation_required=True,
            human_approval_required=False,
            historical_success_rate=0.95,
            avg_execution_time=600,
            concurrent_workflows=5,
            system_load=0.4,
            priority_score=7,
            estimated_resources={},
        )

        confidence = optimizer._calculate_confidence(high_conf_features)
        assert confidence > 0.7

        # Low confidence features
        low_conf_features = WorkflowFeatures(
            project_size=0,
            ecosystem_count=0,
            has_transitive_deps=False,
            security_scan_required=False,
            policy_evaluation_required=False,
            human_approval_required=False,
            historical_success_rate=0,
            avg_execution_time=0,
            concurrent_workflows=0,
            system_load=0.95,
            priority_score=1,
            estimated_resources={},
        )

        confidence = optimizer._calculate_confidence(low_conf_features)
        assert confidence < 0.5

    @pytest.mark.asyncio
    async def test_determine_routing_strategy(self, optimizer):
        """Test routing strategy determination."""
        config = {"priority": 5}

        # Test high load scenario
        high_load = ResourceMetrics(
            cpu_usage=0.9,
            memory_usage=0.9,
            active_workflows=15,
            queue_length=10,
            avg_response_time=5.0,
            throughput=0.5,
            error_rate=0.1,
        )

        strategy = await optimizer._determine_routing_strategy(
            WorkflowComplexity.COMPLEX, config, high_load
        )
        assert strategy == RoutingStrategy.PRIORITY_QUEUE

        # Test low load simple scenario
        low_load = ResourceMetrics(
            cpu_usage=0.2,
            memory_usage=0.2,
            active_workflows=1,
            queue_length=0,
            avg_response_time=0.5,
            throughput=0.95,
            error_rate=0.01,
        )

        strategy = await optimizer._determine_routing_strategy(
            WorkflowComplexity.SIMPLE, config, low_load
        )
        assert strategy == RoutingStrategy.SEQUENTIAL

        # Test complex scenario with moderate load
        moderate_load = ResourceMetrics(
            cpu_usage=0.5,
            memory_usage=0.5,
            active_workflows=5,
            queue_length=2,
            avg_response_time=1.5,
            throughput=0.8,
            error_rate=0.02,
        )

        strategy = await optimizer._determine_routing_strategy(
            WorkflowComplexity.VERY_COMPLEX, config, moderate_load
        )
        assert strategy in [RoutingStrategy.PARALLEL, RoutingStrategy.ADAPTIVE]

    def test_calculate_priority(self, optimizer):
        """Test priority calculation."""
        config = {"priority": 5}
        metrics = ResourceMetrics(
            cpu_usage=0.5,
            memory_usage=0.5,
            active_workflows=5,
            queue_length=2,
            avg_response_time=1.5,
            throughput=0.8,
            error_rate=0.02,
        )

        # Test normal priority
        priority = optimizer._calculate_priority(
            config, WorkflowComplexity.MODERATE, metrics
        )
        assert 1 <= priority <= 10
        assert priority == 6  # Base 5 + complexity bonus 1

        # Test urgent workflow
        urgent_config = config.copy()
        urgent_config["urgent"] = True
        priority = optimizer._calculate_priority(
            urgent_config, WorkflowComplexity.MODERATE, metrics
        )
        assert priority == 9  # 6 + urgent bonus 3

        # Test SLA required
        sla_config = config.copy()
        sla_config["sla_required"] = True
        priority = optimizer._calculate_priority(
            sla_config, WorkflowComplexity.MODERATE, metrics
        )
        assert priority == 8  # 6 + SLA bonus 2

    def test_identify_parallel_nodes(self, optimizer):
        """Test identification of parallel executable nodes."""
        config = {
            "steps": [
                "vulnerability_scan",
                "license_check",
                "compliance_check",
                "dependency_analysis",
                "recommendation_generation",
            ]
        }

        # Complex workflow should have parallel nodes
        parallel = optimizer._identify_parallel_nodes(
            config, WorkflowComplexity.VERY_COMPLEX
        )
        assert len(parallel) > 0
        assert "vulnerability_scan" in parallel
        assert "license_check" in parallel

        # Simple workflow should not have parallel nodes
        parallel = optimizer._identify_parallel_nodes(config, WorkflowComplexity.SIMPLE)
        assert len(parallel) == 0

    def test_get_default_routing(self, optimizer):
        """Test default routing decision fallback."""
        workflow_id = str(uuid.uuid4())

        decision = optimizer._get_default_routing(
            workflow_id, WorkflowComplexity.COMPLEX
        )

        assert isinstance(decision, RoutingDecision)
        assert decision.workflow_id == workflow_id
        assert decision.strategy == RoutingStrategy.SEQUENTIAL
        assert decision.priority == 5
        assert decision.confidence_score == 0.3
        assert "default safe routing" in decision.optimization_reasons[0]


@pytest.mark.asyncio
async def test_optimizer_integration():
    """Integration test for the full optimizer workflow."""
    optimizer = WorkflowOptimizer()

    # Create test project
    project = MagicMock(spec=Project)
    project.id = uuid.uuid4()

    # Create workflow config
    config = {
        "workflow_id": str(uuid.uuid4()),
        "steps": ["extract", "scan", "evaluate", "recommend"],
        "security_scan": True,
        "policy_check": True,
        "priority": 7,
    }

    # Mock dependencies
    with (
        patch.object(optimizer, "_extract_workflow_features") as mock_extract,
        patch.object(optimizer, "_get_current_metrics") as mock_metrics,
    ):
        mock_extract.return_value = WorkflowFeatures(
            project_size=100,
            ecosystem_count=2,
            has_transitive_deps=True,
            security_scan_required=True,
            policy_evaluation_required=True,
            human_approval_required=False,
            historical_success_rate=0.9,
            avg_execution_time=900,
            concurrent_workflows=3,
            system_load=0.4,
            priority_score=7,
            estimated_resources={},
        )

        mock_metrics.return_value = ResourceMetrics(
            cpu_usage=0.4,
            memory_usage=0.5,
            active_workflows=3,
            queue_length=1,
            avg_response_time=1.2,
            throughput=0.85,
            error_rate=0.02,
        )

        # Run full optimization workflow
        complexity, confidence = await optimizer.analyze_workflow_complexity(
            project, config
        )
        assert complexity in WorkflowComplexity

        decision = await optimizer.optimize_workflow_routing(
            config["workflow_id"], complexity, config
        )
        assert isinstance(decision, RoutingDecision)

        # Test adaptation
        adaptations = await optimizer.adapt_workflow_execution(
            config["workflow_id"],
            {"progress": 0.5},
            {"elapsed_time": 300, "error_rate": 0.05},
        )
        assert isinstance(adaptations, dict)
