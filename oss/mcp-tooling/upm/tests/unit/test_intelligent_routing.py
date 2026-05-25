"""
Unit tests for Intelligent Routing Workflow module.

Tests the LangGraph integration with intelligent routing,
adaptive execution, and performance monitoring.
"""

import pytest
import asyncio
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
import uuid
from langgraph.graph import StateGraph

from udp.workflows.intelligent_routing import IntelligentRoutingWorkflow
from udp.workflows.state import DependencyAnalysisState
from udp.core.workflow_optimizer import (
    WorkflowComplexity,
    RoutingStrategy,
    RoutingDecision,
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
    }


@pytest.fixture
def routing_workflow():
    """Create intelligent routing workflow instance."""
    return IntelligentRoutingWorkflow(organization_id=str(uuid.uuid4()))


class TestIntelligentRoutingWorkflow:
    """Test cases for IntelligentRoutingWorkflow class."""

    @pytest.mark.asyncio
    async def test_create_intelligent_workflow_simple(
        self, routing_workflow, mock_project, workflow_config
    ):
        """Test creating intelligent workflow for simple case."""
        # Mock the optimizer responses
        routing_workflow.optimizer.analyze_workflow_complexity = AsyncMock(
            return_value=(WorkflowComplexity.SIMPLE, 0.9)
        )
        routing_workflow.optimizer.optimize_workflow_routing = AsyncMock(
            return_value=RoutingDecision(
                workflow_id=workflow_config["workflow_id"],
                strategy=RoutingStrategy.SEQUENTIAL,
                priority=5,
                estimated_duration=timedelta(minutes=10),
                resource_allocation={"cpu_cores": 1, "memory_mb": 512},
                parallel_nodes=[],
                optimization_reasons=["Simple workflow detected"],
                confidence_score=0.9,
            )
        )

        # Mock system metrics
        routing_workflow.optimizer._get_current_metrics = AsyncMock(
            return_value=MagicMock(cpu_usage=0.3, memory_usage=0.4, active_workflows=2)
        )

        workflow, decision = await routing_workflow.create_intelligent_workflow(
            mock_project, workflow_config
        )

        # Verify workflow graph was created
        assert isinstance(workflow, StateGraph)
        assert isinstance(decision, RoutingDecision)
        assert decision.strategy == RoutingStrategy.SEQUENTIAL
        assert len(decision.parallel_nodes) == 0

        # Verify routing was stored
        assert decision.workflow_id in routing_workflow.active_routings
        assert (
            routing_workflow.active_routings[decision.workflow_id]["decision"]
            == decision
        )

    @pytest.mark.asyncio
    async def test_create_intelligent_workflow_complex(
        self, routing_workflow, mock_project
    ):
        """Test creating intelligent workflow for complex case."""
        complex_config = {
            "workflow_id": str(uuid.uuid4()),
            "steps": [
                "vulnerability_scan",
                "license_check",
                "compliance_check",
                "dependency_analysis",
                "transitive_resolution",
                "conflict_detection",
                "policy_evaluation",
                "recommendations",
            ],
            "security_scan": True,
            "policy_check": True,
            "require_approval": True,
            "include_transitive": True,
            "deep_analysis": True,
            "priority": 8,
        }

        # Mock optimizer for complex workflow
        routing_workflow.optimizer.analyze_workflow_complexity = AsyncMock(
            return_value=(WorkflowComplexity.VERY_COMPLEX, 0.85)
        )
        routing_workflow.optimizer.optimize_workflow_routing = AsyncMock(
            return_value=RoutingDecision(
                workflow_id=complex_config["workflow_id"],
                strategy=RoutingStrategy.PARALLEL,
                priority=9,
                estimated_duration=timedelta(hours=1),
                resource_allocation={"cpu_cores": 4, "memory_mb": 2048},
                parallel_nodes=[
                    "vulnerability_scan",
                    "license_check",
                    "compliance_check",
                ],
                optimization_reasons=["High complexity - parallel execution enabled"],
                confidence_score=0.85,
            )
        )

        routing_workflow.optimizer._get_current_metrics = AsyncMock(
            return_value=MagicMock(cpu_usage=0.5, memory_usage=0.6, active_workflows=5)
        )

        workflow, decision = await routing_workflow.create_intelligent_workflow(
            mock_project, complex_config
        )

        assert isinstance(workflow, StateGraph)
        assert decision.strategy == RoutingStrategy.PARALLEL
        assert len(decision.parallel_nodes) > 0
        assert decision.priority == 9

    @pytest.mark.asyncio
    async def test_validate_input_success(self, routing_workflow):
        """Test successful input validation."""
        state = DependencyAnalysisState(
            project_id=str(uuid.uuid4()),
            ecosystem="maven",
            config={"api_key": "test-key"},
        )

        result = await routing_workflow._validate_input(state)

        assert result["status"] == "validated"
        assert result["validation_passed"] is True
        assert len(result["validation_errors"]) == 0
        assert "validated_at" in result

    @pytest.mark.asyncio
    async def test_validate_input_failure(self, routing_workflow):
        """Test input validation failure."""
        state = DependencyAnalysisState(
            project_id="",  # Missing project ID
            ecosystem="",  # Missing ecosystem
            config={"security_scan": True},  # Missing API key for security scan
        )

        result = await routing_workflow._validate_input(state)

        assert result["status"] == "validation_failed"
        assert result["validation_passed"] is False
        assert len(result["validation_errors"]) == 2
        assert "Project ID is required" in result["validation_errors"]
        assert "Ecosystem is required" in result["validation_errors"]

    @pytest.mark.asyncio
    async def test_complexity_analysis(self, routing_workflow):
        """Test complexity analysis step."""
        project_id = str(uuid.uuid4())
        state = DependencyAnalysisState(
            project_id=project_id, ecosystem="npm", config={"priority": 5}
        )

        # Mock project retrieval
        mock_project = MagicMock(spec=Project)
        mock_project.id = project_id

        # Mock optimizer
        routing_workflow.optimizer.analyze_workflow_complexity = AsyncMock(
            return_value=(WorkflowComplexity.MODERATE, 0.8)
        )

        with (
            patch(
                "udp.workflows.intelligent_routing.get_async_session"
            ) as mock_session,
            patch("udp.workflows.intelligent_routing.select") as mock_select,
        ):
            # Setup mock session
            mock_session.return_value.__aenter__.return_value.scalar = AsyncMock(
                return_value=mock_project
            )

            result = await routing_workflow._complexity_analysis(state)

            assert result["status"] == "complexity_analyzed"
            assert result["complexity"] == WorkflowComplexity.MODERATE.value
            assert result["complexity_confidence"] == 0.8
            assert "analyzed_at" in result

    @pytest.mark.asyncio
    async def test_resource_check(self, routing_workflow):
        """Test resource checking step."""
        state = DependencyAnalysisState(project_id=str(uuid.uuid4()), ecosystem="pypi")

        # Mock metrics
        routing_workflow.optimizer._get_current_metrics = AsyncMock(
            return_value=MagicMock(
                cpu_usage=0.4, memory_usage=0.5, active_workflows=3, queue_length=1
            )
        )

        result = await routing_workflow._resource_check(state)

        assert result["status"] == "resources_checked"
        assert result["parallel_feasible"] is True
        assert "resource_metrics" in result
        assert result["resource_metrics"]["cpu_usage"] == 0.4
        assert "resource_checked_at" in result

    @pytest.mark.asyncio
    async def test_parallel_dependency_analysis(self, routing_workflow):
        """Test parallel dependency analysis."""
        state = DependencyAnalysisState(
            project_id=str(uuid.uuid4()),
            ecosystem="maven",
            config={"include_transitive": True},
        )

        # Mock the parallel tasks
        with (
            patch.object(
                routing_workflow, "_extract_direct_dependencies"
            ) as mock_direct,
            patch.object(
                routing_workflow, "_resolve_transitive_dependencies"
            ) as mock_transitive,
            patch.object(
                routing_workflow, "_detect_dependency_conflicts"
            ) as mock_conflicts,
        ):
            mock_direct.return_value = {
                "dependencies": [{"name": "spring-core", "version": "5.3.0"}]
            }
            mock_transitive.return_value = {
                "dependencies": [{"name": "spring-jcl", "version": "5.3.0"}]
            }
            mock_conflicts.return_value = {"conflicts": []}

            result = await routing_workflow._parallel_dependency_analysis(state)

            assert result["status"] == "parallel_dependency_analysis_completed"
            assert len(result["dependencies"]) > 0
            assert len(result["transitive_dependencies"]) > 0
            assert "dependency_analysis_time" in result
            assert "dependency_analysis_completed_at" in result

    @pytest.mark.asyncio
    async def test_parallel_security_scan(self, routing_workflow):
        """Test parallel security scanning."""
        state = DependencyAnalysisState(
            project_id=str(uuid.uuid4()),
            config={"security_scan": True, "license_check": True, "malware_scan": True},
        )

        # Mock security scanning tasks
        with (
            patch.object(routing_workflow, "_scan_vulnerabilities") as mock_vuln,
            patch.object(routing_workflow, "_check_license_compliance") as mock_license,
            patch.object(routing_workflow, "_scan_malware") as mock_malware,
        ):
            mock_vuln.return_value = {
                "vulnerabilities": [{"id": "CVE-2021-1234", "severity": "high"}]
            }
            mock_license.return_value = {
                "license_issues": [{"package": "pkg", "license": "GPL"}]
            }
            mock_malware.return_value = {"malware": []}

            result = await routing_workflow._parallel_security_scan(state)

            assert result["status"] == "parallel_security_scan_completed"
            assert len(result["vulnerabilities"]) > 0
            assert len(result["license_issues"]) > 0
            assert "security_scan_time" in result
            assert "security_scan_completed_at" in result

    @pytest.mark.asyncio
    async def test_merge_parallel_results(self, routing_workflow):
        """Test merging parallel execution results."""
        state = DependencyAnalysisState(
            dependencies=[
                {"name": "spring-core", "version": "5.3.0", "ecosystem": "maven"},
                {"name": "spring-web", "version": "5.3.0", "ecosystem": "maven"},
            ],
            transitive_dependencies=[
                {
                    "name": "spring-core",
                    "version": "5.3.0",
                    "ecosystem": "maven",
                },  # Duplicate
                {"name": "spring-jcl", "version": "5.3.0", "ecosystem": "maven"},
            ],
            vulnerabilities=[{"id": "CVE-2021-1234"}],
            license_issues=[{"package": "pkg", "license": "GPL"}],
            malware_detected=[],
        )

        result = await routing_workflow._merge_parallel_results(state)

        assert result["status"] == "results_merged"
        assert len(result["merged_dependencies"]) == 3  # Duplicates removed
        assert result["total_security_issues"] == 2  # 1 vuln + 1 license issue
        assert "merged_at" in result

    @pytest.mark.asyncio
    async def test_adaptive_analysis(self, routing_workflow):
        """Test adaptive analysis with performance monitoring."""
        state = DependencyAnalysisState(
            project_id=str(uuid.uuid4()), workflow_id=str(uuid.uuid4()), ecosystem="npm"
        )

        # Mock dependency extraction
        with patch.object(routing_workflow, "_dependency_extraction") as mock_extract:
            mock_extract.return_value = {
                "dependencies": [{"name": "express", "version": "4.17.0"}]
            }

            result = await routing_workflow._adaptive_analysis(state)

            assert result["status"] == "adaptive_analysis_completed"
            assert "performance_metrics" in result
            assert "checkpoints" in result["performance_metrics"]
            assert "start_time" in result["performance_metrics"]

    @pytest.mark.asyncio
    async def test_performance_monitor(self, routing_workflow):
        """Test performance monitoring."""
        state = DependencyAnalysisState(
            performance_metrics={"start_time": time.time() - 10, "checkpoints": []}
        )

        # Mock system metrics
        with (
            patch.object(routing_workflow, "_get_memory_usage", return_value=0.5),
            patch.object(routing_workflow, "_get_cpu_usage", return_value=0.6),
        ):
            result = await routing_workflow._performance_monitor(state)

            assert result["status"] == "performance_monitored"
            assert len(result["performance_metrics"]["checkpoints"]) == 1
            checkpoint = result["performance_metrics"]["checkpoints"][0]
            assert checkpoint["cpu_usage"] == 0.6
            assert checkpoint["memory_usage"] == 0.5

    @pytest.mark.asyncio
    async def test_route_adjustment(self, routing_workflow):
        """Test route adjustment based on adaptations."""
        state = DependencyAnalysisState(
            adaptations={
                "parallelize_remaining": True,
                "increase_resources": True,
                "reroute_tasks": True,
            }
        )

        with patch.object(routing_workflow, "_optimize_task_order") as mock_order:
            mock_order.return_value = ["security_scanning", "policy_evaluation"]

            result = await routing_workflow._route_adjustment(state)

            assert result["status"] == "route_adjusted"
            assert result["execution_mode"] == "parallel"
            assert result["resource_level"] == "high"
            assert result["task_order"] == ["security_scanning", "policy_evaluation"]
            assert "route_adjusted_at" in result

    def test_check_parallel_feasibility(self, routing_workflow):
        """Test parallel feasibility check."""
        # Should return parallel when feasible
        state = {"parallel_feasible": True, "complexity": "complex"}
        result = routing_workflow._check_parallel_feasibility(state)
        assert result == "parallel"

        # Should return sequential when not feasible
        state = {"parallel_feasible": False, "complexity": "simple"}
        result = routing_workflow._check_parallel_feasibility(state)
        assert result == "sequential"

    def test_adaptive_routing_decision(self, routing_workflow):
        """Test adaptive routing decision logic."""
        # Should optimize when adaptations exist
        state = {
            "adaptation_count": 1,
            "adaptations": {"parallelize": True},
            "performance_metrics": {"start_time": time.time()},
        }
        result = routing_workflow._adaptive_routing_decision(state)
        assert result == "optimize"

        # Should complete if too many adaptations
        state = {
            "adaptation_count": 4,
            "performance_metrics": {"start_time": time.time()},
        }
        result = routing_workflow._adaptive_routing_decision(state)
        assert result == "complete"

        # Should continue if no adaptations needed
        state = {
            "adaptation_count": 0,
            "performance_metrics": {"start_time": time.time()},
        }
        result = routing_workflow._adaptive_routing_decision(state)
        assert result == "continue"

    @pytest.mark.asyncio
    async def test_final_output(self, routing_workflow):
        """Test final output preparation."""
        state = DependencyAnalysisState(
            workflow_id=str(uuid.uuid4()),
            status="processing",
            performance_metrics={"start_time": time.time() - 100, "checkpoints": []},
            recommendations=[{"type": "upgrade", "package": "test"}],
        )

        with patch.object(routing_workflow, "_store_performance_data") as mock_store:
            result = await routing_workflow._final_output(state)

            assert result["status"] == "completed"
            assert "completed_at" in result
            assert "total_execution_time" in result
            assert result["total_execution_time"] > 0
            mock_store.assert_called_once()


@pytest.mark.asyncio
async def test_workflow_edge_cases():
    """Test edge cases and error handling."""
    routing_workflow = IntelligentRoutingWorkflow()

    # Test with missing project ID
    state = DependencyAnalysisState()
    result = await routing_workflow._validate_input(state)
    assert result["status"] == "validation_failed"

    # Test complexity analysis with missing project
    state = DependencyAnalysisState(project_id=str(uuid.uuid4()), ecosystem="maven")

    with (
        patch("udp.workflows.intelligent_routing.get_async_session") as mock_session,
        patch("udp.workflows.intelligent_routing.select") as mock_select,
    ):
        mock_session.return_value.__aenter__.return_value.scalar = AsyncMock(
            return_value=None  # Project not found
        )

        result = await routing_workflow._complexity_analysis(state)
        assert result["status"] == "complexity_analysis_error"
        assert "error" in result


# Integration test
@pytest.mark.asyncio
async def test_full_intelligent_workflow_execution():
    """Integration test for full intelligent workflow execution."""
    routing_workflow = IntelligentRoutingWorkflow()

    # Create test project
    project = MagicMock(spec=Project)
    project.id = uuid.uuid4()

    # Create complex workflow config
    config = {
        "workflow_id": str(uuid.uuid4()),
        "steps": [
            "dependency_extraction",
            "vulnerability_scan",
            "license_check",
            "policy_evaluation",
            "recommendations",
        ],
        "security_scan": True,
        "license_check": True,
        "require_approval": True,
        "deep_analysis": True,
        "priority": 8,
    }

    # Mock all dependencies
    routing_workflow.optimizer.analyze_workflow_complexity = AsyncMock(
        return_value=(WorkflowComplexity.COMPLEX, 0.85)
    )
    routing_workflow.optimizer.optimize_workflow_routing = AsyncMock(
        return_value=RoutingDecision(
            workflow_id=config["workflow_id"],
            strategy=RoutingStrategy.ADAPTIVE,
            priority=9,
            estimated_duration=timedelta(minutes=30),
            resource_allocation={"cpu_cores": 2, "memory_mb": 1024},
            parallel_nodes=["vulnerability_scan", "license_check"],
            optimization_reasons=["Complex workflow - adaptive routing"],
            confidence_score=0.85,
        )
    )
    routing_workflow.optimizer._get_current_metrics = AsyncMock(
        return_value=MagicMock(cpu_usage=0.5, memory_usage=0.6, active_workflows=4)
    )

    # Create workflow
    workflow, decision = await routing_workflow.create_intelligent_workflow(
        project, config
    )

    # Verify workflow structure
    assert isinstance(workflow, StateGraph)
    assert decision.strategy == RoutingStrategy.ADAPTIVE
    assert len(decision.parallel_nodes) > 0

    # Test workflow execution through key steps
    state = DependencyAnalysisState(
        project_id=str(project.id),
        ecosystem="maven",
        config=config,
        workflow_id=config["workflow_id"],
    )

    # Execute validation
    state = await routing_workflow._validate_input(state)
    assert state["status"] == "validated"

    # Execute complexity analysis
    with (
        patch("udp.workflows.intelligent_routing.get_async_session") as mock_session,
        patch("udp.workflows.intelligent_routing.select") as mock_select,
    ):
        mock_session.return_value.__aenter__.return_value.scalar = AsyncMock(
            return_value=project
        )

        state = await routing_workflow._complexity_analysis(state)
        assert state["status"] == "complexity_analyzed"
        assert state["complexity"] == WorkflowComplexity.COMPLEX.value

    # Execute resource check
    state = await routing_workflow._resource_check(state)
    assert state["status"] == "resources_checked"

    # Execute adaptive analysis
    with patch.object(routing_workflow, "_dependency_extraction") as mock_extract:
        mock_extract.return_value = {"dependencies": []}
        state = await routing_workflow._adaptive_analysis(state)
        assert state["status"] == "adaptive_analysis_completed"
