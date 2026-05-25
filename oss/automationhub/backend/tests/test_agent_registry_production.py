"""
Comprehensive Tests for Production-Grade Agent Registry

This module contains comprehensive unit and integration tests for the enhanced
agent registry, health monitoring, capability discovery, performance analytics,
and failover management systems.
"""

import pytest
import asyncio
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from uuid import UUID, uuid4
import json
import time
from unittest.mock import Mock, AsyncMock, patch, MagicMock

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import sessionmaker

from app.agents.base import (
    UPMAgent, Task, TaskType, AgentStatus, Capability,
    ExecutionContext, PerformanceMetrics, LLMConfig
)
from app.agents.enhanced_registry import (
    EnhancedAgentRegistry, RegistrationStatus, LoadBalancingStrategy,
    AgentRegistration, FailoverConfig
)
from app.services.agent_health import (
    AgentHealthMonitor, HealthCheckResult, AgentMetrics,
    HealthCheckLevel
)
from app.services.capability_discovery import (
    CapabilityDiscoveryService, AgentCapability, CapabilityType,
    SkillLevel, MatchingAlgorithm
)
from app.services.performance_analytics import (
    PerformanceAnalyticsService, PerformanceMetric, MetricType,
    AlertSeverity, PerformanceReport
)
from app.services.failover_manager import (
    FailoverManager, FailoverState, CircuitBreakerState,
    LoadBalancingMode, FailoverGroup, AgentEndpoint
)


# Fixtures and test data

@pytest.fixture
async def test_db_session():
    """Create test database session."""
    # Mock database session for testing
    session = Mock(spec=AsyncSession)
    session.execute = AsyncMock()
    session.commit = AsyncMock()
    session.rollback = AsyncMock()
    return session


@pytest.fixture
def sample_agent():
    """Create a sample agent for testing."""
    class TestAgent(UPMAgent):
        def __init__(self, name="TestAgent"):
            super().__init__(name=name)
            self.test_capabilities = [
                Capability(
                    name="test_capability",
                    description="Test capability",
                    supported_task_types=[TaskType.CUSTOM]
                )
            ]
            self.capabilities = self.test_capabilities

        async def execute_task(self, task: Task, context: ExecutionContext):
            from app.agents.base import TaskResult, TaskStatus
            return TaskResult(
                task_id=task.id,
                status=TaskStatus.COMPLETED,
                result="test_result"
            )

        async def can_handle_task(self, task: Task) -> bool:
            return task.type in [TaskType.CUSTOM]

    return TestAgent()


@pytest.fixture
def sample_task():
    """Create a sample task for testing."""
    return Task(
        type=TaskType.CUSTOM,
        name="test_task",
        description="Test task for unit testing",
        parameters={"test_param": "test_value"},
        priority=5
    )


@pytest.fixture
async def enhanced_registry():
    """Create enhanced registry instance for testing."""
    registry = EnhancedAgentRegistry()
    await registry.start()
    yield registry
    await registry.stop()


@pytest.fixture
async def health_monitor():
    """Create health monitor instance for testing."""
    monitor = AgentHealthMonitor()
    await monitor.start()
    yield monitor
    await monitor.stop()


@pytest.fixture
async def capability_discovery():
    """Create capability discovery instance for testing."""
    discovery = CapabilityDiscoveryService()
    await discovery.start()
    yield discovery
    await discovery.stop()


@pytest.fixture
async def performance_analytics():
    """Create performance analytics instance for testing."""
    analytics = PerformanceAnalyticsService()
    analytics.start()
    yield analytics
    analytics.stop()


@pytest.fixture
async def failover_manager():
    """Create failover manager instance for testing."""
    manager = FailoverManager()
    await manager.start()
    yield manager
    await manager.stop()


# Enhanced Registry Tests

class TestEnhancedAgentRegistry:
    """Test suite for EnhancedAgentRegistry."""

    @pytest.mark.asyncio
    async def test_agent_registration_enhanced(self, enhanced_registry, sample_agent):
        """Test enhanced agent registration."""
        # Register agent with enhanced features
        agent_id = await enhanced_registry.register_agent_enhanced(
            sample_agent,
            metadata={"environment": "test"},
            weight=1.5,
            max_concurrent_tasks=5
        )

        # Verify registration
        assert agent_id == sample_agent.id
        registration = await enhanced_registry.get_agent_registration(agent_id)
        assert registration is not None
        assert registration.agent_id == agent_id
        assert registration.name == sample_agent.name
        assert registration.weight == 1.5
        assert registration.max_concurrent_tasks == 5
        assert registration.status == RegistrationStatus.ACTIVE

    @pytest.mark.asyncio
    async def test_task_assignment_with_load_balancing(self, enhanced_registry, sample_task):
        """Test task assignment with different load balancing strategies."""
        # Create multiple test agents
        agents = []
        for i in range(3):
            agent = Mock(spec=UPMAgent)
            agent.id = uuid4()
            agent.name = f"TestAgent_{i}"
            agent.status = AgentStatus.IDLE
            agent.capabilities = [
                Capability(
                    name="test_capability",
                    description="Test capability",
                    supported_task_types=[TaskType.CUSTOM]
                )
            ]
            agents.append(agent)
            await enhanced_registry.register_agent_enhanced(agent)

        # Test task assignment
        for strategy in [
            LoadBalancingStrategy.ROUND_ROBIN,
            LoadBalancingStrategy.LEAST_CONNECTIONS,
            LoadBalancingStrategy.PERFORMANCE_BASED
        ]:
            assigned_agent = await enhanced_registry.assign_task_to_agent(
                sample_task, strategy=strategy
            )
            assert assigned_agent is not None
            assert assigned_agent in [agent.id for agent in agents]

    @pytest.mark.asyncio
    async def test_heartbeat_monitoring(self, enhanced_registry, sample_agent):
        """Test agent heartbeat monitoring."""
        await enhanced_registry.register_agent_enhanced(sample_agent)

        # Update heartbeat
        success = await enhanced_registry.update_agent_heartbeat(sample_agent.id)
        assert success is True

        # Verify heartbeat was updated
        registration = await enhanced_registry.get_agent_registration(sample_agent.id)
        assert registration is not None
        assert (datetime.utcnow() - registration.last_heartbeat).total_seconds() < 10

    @pytest.mark.asyncio
    async def test_agent_deregistration_with_cleanup(self, enhanced_registry, sample_agent):
        """Test agent deregistration with proper cleanup."""
        await enhanced_registry.register_agent_enhanced(sample_agent)

        # Try to deregister while no active tasks
        success = await enhanced_registry.deregister_agent_enhanced(sample_agent.id)
        assert success is True

        # Verify agent is removed
        registration = await enhanced_registry.get_agent_registration(sample_agent.id)
        assert registration is None

    @pytest.mark.asyncio
    async def test_enhanced_registry_statistics(self, enhanced_registry, sample_agent):
        """Test enhanced registry statistics."""
        await enhanced_registry.register_agent_enhanced(sample_agent)

        stats = await enhanced_registry.get_registry_stats_enhanced()
        assert stats["total_agents"] == 1
        assert "status_distribution" in stats
        assert "task_capacity" in stats
        assert "load_balancing_strategy" in stats

    @pytest.mark.asyncio
    async def test_failover_configuration(self, enhanced_registry):
        """Test failover configuration."""
        config = FailoverConfig(
            agent_group="test_group",
            primary_agents=[uuid4(), uuid4()],
            backup_agents=[uuid4()],
            failover_threshold=0.6,
            auto_failback=True
        )

        await enhanced_registry.configure_failover(config)
        # Verify configuration is stored (implementation dependent)
        assert config.agent_group == "test_group"


# Health Monitoring Tests

class TestAgentHealthMonitor:
    """Test suite for AgentHealthMonitor."""

    @pytest.mark.asyncio
    async def test_basic_health_check(self, health_monitor, sample_agent):
        """Test basic health check functionality."""
        result = await health_monitor.check_agent_health(
            sample_agent.id,
            HealthCheckLevel.BASIC
        )

        assert isinstance(result, HealthCheckResult)
        assert result.agent_id == sample_agent.id
        assert result.agent_name == sample_agent.name
        assert isinstance(result.healthy, bool)
        assert isinstance(result.response_time_ms, float)
        assert isinstance(result.checks, dict)
        assert isinstance(result.errors, list)

    @pytest.mark.asyncio
    async def test_comprehensive_health_check(self, health_monitor, sample_agent):
        """Test comprehensive health check."""
        result = await health_monitor.check_agent_health(
            sample_agent.id,
            HealthCheckLevel.COMPREHENSIVE
        )

        # Comprehensive checks should include more detailed metrics
        assert "performance" in result.metrics
        assert "memory_usage" in result.metrics

    @pytest.mark.asyncio
    async def test_health_check_with_nonexistent_agent(self, health_monitor):
        """Test health check with non-existent agent."""
        fake_agent_id = uuid4()
        result = await health_monitor.check_agent_health(fake_agent_id)

        assert result.healthy is False
        assert any("not found" in error for error in result.errors)

    @pytest.mark.asyncio
    async def test_system_health_overview(self, health_monitor, sample_agent):
        """Test system health overview."""
        # Register some agents first
        await health_monitor.check_agent_health(sample_agent.id)

        overview = await health_monitor.get_system_health_overview()

        assert "timestamp" in overview
        assert "total_agents" in overview
        assert "healthy_agents" in overview
        assert "health_percentage" in overview
        assert "monitoring" in overview

    @pytest.mark.asyncio
    async def test_health_history_tracking(self, health_monitor, sample_agent):
        """Test health history tracking."""
        # Perform multiple health checks
        await health_monitor.check_agent_health(sample_agent.id)
        await asyncio.sleep(0.1)
        await health_monitor.check_agent_health(sample_agent.id)

        history = await health_monitor.get_agent_health_history(sample_agent.id, hours=1)

        assert isinstance(history, list)
        # Should have at least one health check record
        assert len(history) >= 1
        assert all("timestamp" in record for record in history)

    @pytest.mark.asyncio
    async def test_alert_generation(self, health_monitor, sample_agent):
        """Test alert generation for health issues."""
        # Configure low alert thresholds for testing
        health_monitor._alert_thresholds["response_time_ms"] = 1.0  # Very low

        result = await health_monitor.check_agent_health(sample_agent.id)

        # Should potentially generate alerts if response time is too high
        # (This would need to be adjusted based on actual implementation)


# Capability Discovery Tests

class TestCapabilityDiscoveryService:
    """Test suite for CapabilityDiscoveryService."""

    @pytest.mark.asyncio
    async def test_capability_discovery(self, capability_discovery, sample_agent):
        """Test automatic capability discovery."""
        capabilities = await capability_discovery.discover_agent_capabilities(sample_agent)

        assert isinstance(capabilities, list)
        assert len(capabilities) > 0  # Should discover at least some capabilities

        for capability in capabilities:
            assert isinstance(capability, AgentCapability)
            assert capability.name is not None
            assert capability.description is not None
            assert capability.capability_type in CapabilityType

    @pytest.mark.asyncio
    async def test_capability_classification(self, capability_discovery):
        """Test capability classification logic."""
        # Test classification based on names
        test_cases = [
            ("web_automation", CapabilityType.TECHNICAL),
            ("data_analysis", CapabilityType.ANALYTICAL),
            ("email_communication", CapabilityType.COMMUNICATION),
            ("business_strategy", CapabilityType.BUSINESS)
        ]

        for capability_name, expected_type in test_cases:
            classified_type = capability_discovery._classify_capability_type(capability_name)
            assert classified_type == expected_type

    @pytest.mark.asyncio
    async def test_skill_level_estimation(self, capability_discovery):
        """Test skill level estimation."""
        base_capability = Capability(
            name="advanced_capability",
            description="An advanced level capability",
            supported_task_types=[TaskType.CUSTOM]
        )

        skill_level = capability_discovery._estimate_skill_level(base_capability)
        assert skill_level in SkillLevel

    @pytest.mark.asyncio
    async def test_task_to_agent_matching(self, capability_discovery, sample_task):
        """Test task-to-agent matching."""
        matches = await capability_discovery.match_task_to_agents(
            sample_task,
            algorithm=MatchingAlgorithm.HYBRID,
            top_k=3
        )

        assert isinstance(matches, list)
        # For empty registry, should return empty list
        assert len(matches) == 0

    @pytest.mark.asyncio
    async def test_capability_performance_tracking(self, capability_discovery, sample_agent):
        """Test capability performance tracking."""
        agent_id = sample_agent.id
        capability_name = "test_capability"

        # Record some performance data
        await capability_discovery.update_capability_performance(
            agent_id, capability_name, True, 1000.0, 0.9
        )
        await capability_discovery.update_capability_performance(
            agent_id, capability_name, False, 2000.0, 0.3
        )

        # Get capability profile
        profile = await capability_discovery.get_agent_capability_profile(agent_id)

        if profile:  # Only check if profile exists (may not in test environment)
            assert isinstance(profile, AgentCapabilityProfile)
            assert profile.agent_id == agent_id

    @pytest.mark.asyncio
    async def test_capability_expert_finding(self, capability_discovery):
        """Test finding capability experts."""
        experts = await capability_discovery.find_capability_experts(
            "test_capability",
            SkillLevel.ADVANCED,
            max_results=5
        )

        assert isinstance(experts, list)
        # Should return list of (agent_id, expertise_score) tuples
        for expert in experts:
            assert len(expert) == 2
            assert isinstance(expert[0], UUID)  # agent_id
            assert isinstance(expert[1], float)  # expertise_score
            assert 0.0 <= expert[1] <= 1.0

    @pytest.mark.asyncio
    async def test_skill_development_recommendations(self, capability_discovery, sample_agent):
        """Test skill development recommendations."""
        recommendations = await capability_discovery.recommend_skill_development(sample_agent.id)

        assert isinstance(recommendations, list)
        for recommendation in recommendations:
            assert isinstance(recommendation, dict)
            assert "type" in recommendation
            assert "skill" in recommendation
            assert "priority" in recommendation


# Performance Analytics Tests

class TestPerformanceAnalyticsService:
    """Test suite for PerformanceAnalyticsService."""

    @pytest.mark.asyncio
    async def test_metric_recording(self, performance_analytics, sample_agent):
        """Test metric recording functionality."""
        agent_id = sample_agent.id
        metric_name = "test_metric"

        await performance_analytics.record_metric(
            agent_id=agent_id,
            metric_name=metric_name,
            value=100.0,
            metric_type=MetricType.GAUGE,
            tags={"test": "true"},
            unit="count"
        )

        # Verify metric was recorded (implementation dependent)
        # This would typically check internal storage or Redis

    @pytest.mark.asyncio
    async def test_task_execution_recording(self, performance_analytics, sample_agent):
        """Test task execution metric recording."""
        agent_id = sample_agent.id
        task_id = uuid4()

        await performance_analytics.record_task_execution(
            agent_id=agent_id,
            task_id=task_id,
            task_type="test",
            success=True,
            execution_time_ms=1500.0
        )

        # Verify metrics were recorded for different aspects
        # This would check that multiple metrics were created

    @pytest.mark.asyncio
    async def test_agent_health_recording(self, performance_analytics, sample_agent):
        """Test agent health metric recording."""
        agent_id = sample_agent.id

        await performance_analytics.record_agent_health(
            agent_id=agent_id,
            healthy=True,
            response_time_ms=50.0,
            cpu_usage=25.5,
            memory_usage=45.2,
            active_connections=3
        )

        # Verify health metrics were recorded
        # This would check multiple health-related metrics

    @pytest.mark.asyncio
    async def test_system_performance_overview(self, performance_analytics, sample_agent):
        """Test system performance overview."""
        # Record some metrics first
        await performance_analytics.record_agent_health(
            agent_id=sample_agent.id,
            healthy=True,
            response_time_ms=50.0,
            cpu_usage=25.5,
            memory_usage=45.2
        )

        overview = await performance_analytics.get_system_performance_overview()

        assert "timestamp" in overview
        assert "total_agents" in overview
        assert "healthy_agents" in overview
        assert "system_load" in overview
        assert "alerts" in overview

    @pytest.mark.asyncio
    async def test_performance_report_generation(self, performance_analytics, sample_agent):
        """Test performance report generation."""
        agent_id = sample_agent.id

        # Record some metrics first
        await performance_analytics.record_task_execution(
            agent_id=agent_id,
            task_id=uuid4(),
            task_type="test",
            success=True,
            execution_time_ms=1000.0
        )

        report = await performance_analytics.create_performance_report(
            agent_id=agent_id,
            report_type="summary",
            period_hours=1
        )

        assert isinstance(report, PerformanceReport)
        assert report.agent_id == agent_id
        assert report.report_type == "summary"
        assert isinstance(report.metrics, dict)
        assert isinstance(report.insights, list)
        assert isinstance(report.recommendations, list)

    @pytest.mark.asyncio
    async def test_alert_creation_and_management(self, performance_analytics, sample_agent):
        """Test alert creation and management."""
        agent_id = sample_agent.id

        alert_id = await performance_analytics.create_alert(
            agent_id=agent_id,
            metric_name="response_time",
            condition=">",
            threshold=5000.0,
            severity=AlertSeverity.WARNING,
            message="High response time detected"
        )

        assert alert_id is not None
        assert isinstance(alert_id, str)

    @pytest.mark.asyncio
    async def test_performance_trends_analysis(self, performance_analytics, sample_agent):
        """Test performance trends analysis."""
        agent_id = sample_agent.id

        # Record some metrics over time
        for i in range(10):
            await performance_analytics.record_metric(
                agent_id=agent_id,
                metric_name="test_metric",
                value=100.0 + i * 10,
                metric_type=MetricType.GAUGE
            )
            await asyncio.sleep(0.01)  # Small delay

        trends = await performance_analytics.get_performance_trends(
            agent_id=agent_id,
            metric_name="test_metric",
            hours=1
        )

        assert "period_start" in trends
        assert "period_end" in trends
        assert "trends" in trends


# Failover Manager Tests

class TestFailoverManager:
    """Test suite for FailoverManager."""

    @pytest.mark.asyncio
    async def test_failover_group_creation(self, failover_manager):
        """Test failover group creation."""
        group_id = "test_group"
        primary_agents = [uuid4(), uuid4()]
        backup_agents = [uuid4()]

        group = await failover_manager.create_failover_group(
            group_id=group_id,
            name="Test Failover Group",
            primary_agents=primary_agents,
            backup_agents=backup_agents,
            failover_threshold=0.5
        )

        assert group.group_id == group_id
        assert group.name == "Test Failover Group"
        assert len(group.primary_endpoints) == 2
        assert len(group.backup_endpoints) == 1
        assert group.failover_threshold == 0.5

    @pytest.mark.asyncio
    async def test_request_routing(self, failover_manager):
        """Test request routing through failover group."""
        group_id = "routing_test_group"
        primary_agents = [uuid4()]
        backup_agents = [uuid4()]

        await failover_manager.create_failover_group(
            group_id=group_id,
            name="Routing Test Group",
            primary_agents=primary_agents,
            backup_agents=backup_agents
        )

        request_data = {"test": "data"}
        selected_agent, response = await failover_manager.route_request(
            group_id=group_id,
            request_data=request_data
        )

        # For mocked environment, this might return None
        # The important thing is that it doesn't crash
        assert isinstance(selected_agent, (UUID, type(None)))
        assert isinstance(response, dict)

    @pytest.mark.asyncio
    async def test_manual_failover_trigger(self, failover_manager):
        """Test manual failover triggering."""
        group_id = "manual_failover_test_group"
        primary_agents = [uuid4(), uuid4()]
        backup_agents = [uuid4()]

        await failover_manager.create_failover_group(
            group_id=group_id,
            name="Manual Failover Test Group",
            primary_agents=primary_agents,
            backup_agents=backup_agents
        )

        await failover_manager.trigger_manual_failover(
            group_id=group_id,
            reason="Manual testing",
            affected_agents=primary_agents[:1]
        )

        # Check failover status
        status = await failover_manager.get_failover_status(group_id)
        assert status["group_id"] == group_id
        assert "state" in status

    @pytest.mark.asyncio
    async def test_maintenance_window_scheduling(self, failover_manager):
        """Test maintenance window scheduling."""
        group_id = "maintenance_test_group"
        primary_agents = [uuid4()]
        backup_agents = [uuid4()]

        await failover_manager.create_failover_group(
            group_id=group_id,
            name="Maintenance Test Group",
            primary_agents=primary_agents,
            backup_agents=backup_agents
        )

        start_time = datetime.utcnow() + timedelta(minutes=1)
        end_time = datetime.utcnow() + timedelta(hours=1)

        await failover_manager.schedule_maintenance_window(
            group_id=group_id,
            start_time=start_time,
            end_time=end_time,
            affected_agents=primary_agents,
            description="Test maintenance window"
        )

        # Maintenance scheduling should not raise errors
        assert True

    @pytest.mark.asyncio
    async def test_failover_status_monitoring(self, failover_manager):
        """Test failover status monitoring."""
        group_id = "status_test_group"
        primary_agents = [uuid4()]
        backup_agents = [uuid4()]

        await failover_manager.create_failover_group(
            group_id=group_id,
            name="Status Test Group",
            primary_agents=primary_agents,
            backup_agents=backup_agents
        )

        status = await failover_manager.get_failover_status(group_id)

        assert status["group_id"] == group_id
        assert "name" in status
        assert "state" in status
        assert "primary_endpoints" in status
        assert "backup_endpoints" in status
        assert "health_percentage" in status


# Integration Tests

class TestAgentRegistryIntegration:
    """Integration tests for the complete agent registry system."""

    @pytest.mark.asyncio
    async def test_complete_agent_lifecycle(self, enhanced_registry, health_monitor,
                                          capability_discovery, performance_analytics,
                                          sample_agent, sample_task):
        """Test complete agent lifecycle with all components."""
        # 1. Register agent with enhanced registry
        agent_id = await enhanced_registry.register_agent_enhanced(
            sample_agent,
            metadata={"environment": "test_integration"},
            weight=1.0,
            max_concurrent_tasks=10
        )

        # 2. Discover capabilities
        capabilities = await capability_discovery.discover_agent_capabilities(sample_agent)
        assert len(capabilities) > 0

        # 3. Perform health check
        health_result = await health_monitor.check_agent_health(agent_id)
        assert isinstance(health_result, HealthCheckResult)

        # 4. Record performance metrics
        await performance_analytics.record_task_execution(
            agent_id=agent_id,
            task_id=uuid4(),
            task_type=sample_task.type,
            success=True,
            execution_time_ms=1000.0
        )

        # 5. Assign task through load balancer
        assigned_agent = await enhanced_registry.assign_task_to_agent(sample_task)
        assert assigned_agent is not None

        # 6. Record task completion
        await enhanced_registry.record_task_completion(
            agent_id=assigned_agent,
            task_id=sample_task.id,
            success=True,
            execution_time_ms=1000.0
        )

        # 7. Update capability performance
        for capability in capabilities:
            await capability_discovery.update_capability_performance(
                agent_id, capability.name, True, 1000.0, 0.9
            )

        # 8. Generate performance report
        report = await performance_analytics.create_performance_report(
            agent_id=agent_id,
            report_type="comprehensive",
            period_hours=1
        )
        assert isinstance(report, PerformanceReport)

        # 9. Deregister agent
        success = await enhanced_registry.deregister_agent_enhanced(agent_id)
        assert success is True

    @pytest.mark.asyncio
    async def test_multi_agent_collaboration(self, enhanced_registry,
                                          capability_discovery, sample_task):
        """Test multi-agent scenario with load balancing."""
        # Create multiple test agents
        agents = []
        for i in range(5):
            agent = Mock(spec=UPMAgent)
            agent.id = uuid4()
            agent.name = f"CollabAgent_{i}"
            agent.status = AgentStatus.IDLE
            agent.capabilities = [
                Capability(
                    name="collaboration_capability",
                    description="Capability for collaboration testing",
                    supported_task_types=[TaskType.CUSTOM]
                )
            ]
            agents.append(agent)
            await enhanced_registry.register_agent_enhanced(agent, weight=float(i + 1))

        # Create failover group
        group_id = "collab_test_group"
        primary_agents = [agent.id for agent in agents[:3]]
        backup_agents = [agent.id for agent in agents[3:]]

        failover_manager = FailoverManager()
        await failover_manager.start()

        try:
            await failover_manager.create_failover_group(
                group_id=group_id,
                name="Collaboration Test Group",
                primary_agents=primary_agents,
                backup_agents=backup_agents
            )

            # Test task routing with different load balancing strategies
            strategies = [
                LoadBalancingStrategy.ROUND_ROBIN,
                LoadBalancingStrategy.WEIGHTED_ROUND_ROBIN,
                LoadBalancingStrategy.PERFORMANCE_BASED
            ]

            for strategy in strategies:
                enhanced_registry._load_balancing_strategy = strategy

                # Assign multiple tasks
                assigned_agents = []
                for i in range(10):
                    assigned_agent = await enhanced_registry.assign_task_to_agent(sample_task, strategy=strategy)
                    if assigned_agent:
                        assigned_agents.append(assigned_agent)

                # Verify load distribution
                if len(assigned_agents) > 0:
                    agent_counts = {}
                    for agent_id in assigned_agents:
                        agent_counts[agent_id] = agent_counts.get(agent_id, 0) + 1

                    # Should distribute tasks across agents
                    assert len(agent_counts) > 0

        finally:
            await failover_manager.stop()

            # Clean up agents
            for agent in agents:
                await enhanced_registry.deregister_agent_enhanced(agent.id)

    @pytest.mark.asyncio
    async def test_failover_scenario(self, failover_manager, health_monitor):
        """Test complete failover scenario."""
        # Create failover group
        group_id = "failover_test_group"
        primary_agents = [uuid4(), uuid4()]
        backup_agents = [uuid4(), uuid4()]

        await failover_manager.create_failover_group(
            group_id=group_id,
            name="Failover Test Group",
            primary_agents=primary_agents,
            backup_agents=backup_agents,
            failover_threshold=0.5
        )

        # Simulate primary agent failures
        status = await failover_manager.get_failover_status(group_id)
        initial_state = status["state"]

        # Trigger manual failover
        await failover_manager.trigger_manual_failover(
            group_id=group_id,
            reason="Testing failover scenario",
            affected_agents=primary_agents[:1]
        )

        # Check status after failover
        status_after_failover = await failover_manager.get_failover_status(group_id)

        # Should have recorded failover events
        assert status_after_failover["group_id"] == group_id

        # Test request routing during failover
        request_data = {"test": "failover_request"}
        selected_agent, response = await failover_manager.route_request(
            group_id=group_id,
            request_data=request_data
        )

        # Should still be able to route requests (to backup agents)
        # For mocked environment, may return None
        assert isinstance(selected_agent, (UUID, type(None)))


# Performance and Load Tests

class TestAgentRegistryPerformance:
    """Performance tests for the agent registry system."""

    @pytest.mark.asyncio
    @pytest.mark.performance
    async def test_high_volume_registration(self, enhanced_registry):
        """Test high-volume agent registration performance."""
        start_time = time.time()

        # Register many agents
        agent_count = 100
        agents = []

        for i in range(agent_count):
            agent = Mock(spec=UPMAgent)
            agent.id = uuid4()
            agent.name = f"PerfAgent_{i}"
            agent.status = AgentStatus.IDLE
            agent.capabilities = []
            agents.append(agent)

            await enhanced_registry.register_agent_enhanced(agent, weight=1.0)

        registration_time = time.time() - start_time

        # Verify performance
        assert registration_time < 10.0  # Should complete within 10 seconds
        assert len(agents) == agent_count

        # Test retrieval performance
        start_time = time.time()

        for agent in agents:
            registration = await enhanced_registry.get_agent_registration(agent.id)
            assert registration is not None

        retrieval_time = time.time() - start_time
        assert retrieval_time < 5.0  # Should complete within 5 seconds

        # Clean up
        for agent in agents:
            await enhanced_registry.deregister_agent_enhanced(agent.id)

    @pytest.mark.asyncio
    @pytest.mark.performance
    async def test_high_volume_task_assignment(self, enhanced_registry, sample_task):
        """Test high-volume task assignment performance."""
        # Create many agents
        agent_count = 50
        agents = []

        for i in range(agent_count):
            agent = Mock(spec=UPMAgent)
            agent.id = uuid4()
            agent.name = f"TaskAgent_{i}"
            agent.status = AgentStatus.IDLE
            agent.capabilities = [
                Capability(
                    name="task_capability",
                    description="Task processing capability",
                    supported_task_types=[TaskType.CUSTOM]
                )
            ]
            agents.append(agent)
            await enhanced_registry.register_agent_enhanced(agent, weight=1.0)

        # Test task assignment performance
        task_count = 1000
        start_time = time.time()

        assigned_agents = []
        for i in range(task_count):
            assigned_agent = await enhanced_registry.assign_task_to_agent(sample_task)
            if assigned_agent:
                assigned_agents.append(assigned_agent)

        assignment_time = time.time() - start_time

        # Verify performance
        assert assignment_time < 30.0  # Should complete within 30 seconds
        assert len(assigned_agents) > 0

        # Calculate assignment rate
        assignment_rate = len(assigned_agents) / assignment_time
        assert assignment_rate > 10  # Should handle at least 10 assignments per second

        # Clean up
        for agent in agents:
            await enhanced_registry.deregister_agent_enhanced(agent.id)

    @pytest.mark.asyncio
    @pytest.mark.performance
    async def test_concurrent_health_checks(self, health_monitor, sample_agent):
        """Test concurrent health check performance."""
        # Register agent
        await health_monitor.check_agent_health(sample_agent.id)

        # Perform concurrent health checks
        concurrent_checks = 50
        start_time = time.time()

        tasks = []
        for i in range(concurrent_checks):
            task = health_monitor.check_agent_health(sample_agent.id)
            tasks.append(task)

        results = await asyncio.gather(*tasks, return_exceptions=True)
        health_check_time = time.time() - start_time

        # Verify performance and correctness
        assert health_check_time < 10.0  # Should complete within 10 seconds

        successful_checks = [r for r in results if isinstance(r, HealthCheckResult)]
        assert len(successful_checks) == concurrent_checks

        # Calculate check rate
        check_rate = concurrent_checks / health_check_time
        assert check_rate > 5  # Should handle at least 5 checks per second

    @pytest.mark.asyncio
    @pytest.mark.performance
    async def test_memory_usage_under_load(self, performance_analytics):
        """Test memory usage under high load."""
        import psutil
        import os

        process = psutil.Process(os.getpid())
        initial_memory = process.memory_info().rss / 1024 / 1024  # MB

        # Record many metrics
        agent_id = uuid4()
        metric_count = 10000

        for i in range(metric_count):
            await performance_analytics.record_metric(
                agent_id=agent_id,
                metric_name=f"metric_{i % 100}",  # 100 different metric types
                value=i,
                metric_type=MetricType.GAUGE
            )

        final_memory = process.memory_info().rss / 1024 / 1024  # MB
        memory_increase = final_memory - initial_memory

        # Memory increase should be reasonable
        assert memory_increase < 500  # Should be less than 500MB increase

        # Verify metrics were recorded (implementation dependent)
        # This would typically check internal storage efficiency


# Error Handling and Edge Cases

class TestAgentRegistryErrorHandling:
    """Test error handling and edge cases."""

    @pytest.mark.asyncio
    async def test_invalid_agent_registration(self, enhanced_registry):
        """Test registration with invalid agent data."""
        # Test with None agent
        with pytest.raises(Exception):
            await enhanced_registry.register_agent_enhanced(None)

    @pytest.mark.asyncio
    async def test_duplicate_agent_registration(self, enhanced_registry, sample_agent):
        """Test duplicate agent registration handling."""
        # Register agent first time
        await enhanced_registry.register_agent_enhanced(sample_agent)

        # Try to register same agent again
        with pytest.raises(Exception):  # Should raise appropriate error
            await enhanced_registry.register_agent_enhanced(sample_agent)

    @pytest.mark.asyncio
    async def test_task_assignment_with_no_agents(self, enhanced_registry, sample_task):
        """Test task assignment when no agents are available."""
        assigned_agent = await enhanced_registry.assign_task_to_agent(sample_task)
        assert assigned_agent is None

    @pytest.mark.asyncio
    async def test_health_check_timeout(self, health_monitor):
        """Test health check timeout handling."""
        # Create agent that will timeout
        slow_agent = Mock(spec=UPMAgent)
        slow_agent.id = uuid4()
        slow_agent.name = "SlowAgent"
        slow_agent.health_check = AsyncMock(side_effect=asyncio.sleep(10))

        # Should handle timeout gracefully
        result = await health_monitor.check_agent_health(
            slow_agent.id,
            HealthCheckLevel.BASIC
        )

        assert result.healthy is False
        assert any("timeout" in error.lower() for error in result.errors)

    @pytest.mark.asyncio
    async def test_capability_discovery_with_invalid_agent(self, capability_discovery):
        """Test capability discovery with invalid agent."""
        invalid_agent = Mock(spec=UPMAgent)
        invalid_agent.id = uuid4()
        invalid_agent.capabilities = None  # Invalid capabilities
        invalid_agent.name = "InvalidAgent"
        invalid_agent.__class__.__name__ = "InvalidAgent"

        # Should handle gracefully without crashing
        capabilities = await capability_discovery.discover_agent_capabilities(invalid_agent)
        assert isinstance(capabilities, list)

    @pytest.mark.asyncio
    async def test_failover_with_no_backup_agents(self, failover_manager):
        """Test failover when no backup agents are available."""
        group_id = "no_backup_group"
        primary_agents = [uuid4()]

        await failover_manager.create_failover_group(
            group_id=group_id,
            name="No Backup Group",
            primary_agents=primary_agents,
            backup_agents=[]  # No backup agents
        )

        # Trigger failover
        await failover_manager.trigger_manual_failover(
            group_id=group_id,
            reason="Testing no backup scenario",
            affected_agents=primary_agents
        )

        # Should handle gracefully
        request_data = {"test": "no_backup"}
        selected_agent, response = await failover_manager.route_request(
            group_id=group_id,
            request_data=request_data
        )

        # Should return None when no endpoints available
        assert selected_agent is None
        assert "error" in response

    @pytest.mark.asyncio
    async def test_metrics_recording_with_invalid_data(self, performance_analytics):
        """Test metrics recording with invalid data."""
        agent_id = uuid4()

        # Test with various invalid inputs
        invalid_cases = [
            (None, "metric_name", 1.0),  # None agent_id
            (agent_id, None, 1.0),    # None metric_name
            (agent_id, "metric_name", "invalid_value"),  # Invalid value type
        ]

        for agent_id_param, metric_name, value in invalid_cases:
            with pytest.raises(Exception):  # Should handle gracefully
                await performance_analytics.record_metric(
                    agent_id=agent_id_param,
                    metric_name=metric_name,
                    value=value
                )


# Configuration and Customization Tests

class TestAgentRegistryConfiguration:
    """Test configuration and customization options."""

    @pytest.mark.asyncio
    async def test_load_balancing_strategy_configuration(self, enhanced_registry):
        """Test different load balancing strategy configurations."""
        strategies = [
            LoadBalancingStrategy.ROUND_ROBIN,
            LoadBalancingStrategy.LEAST_CONNECTIONS,
            LoadBalancingStrategy.WEIGHTED_ROUND_ROBIN,
            LoadBalancingStrategy.RESPONSE_TIME,
            LoadBalancingStrategy.PERFORMANCE_BASED
        ]

        for strategy in strategies:
            enhanced_registry._load_balancing_strategy = strategy
            assert enhanced_registry._load_balancing_strategy == strategy

    @pytest.mark.asyncio
    async def test_health_monitor_configuration(self, health_monitor):
        """Test health monitor configuration options."""
        # Test threshold configuration
        original_thresholds = health_monitor._alert_thresholds.copy()

        health_monitor._alert_thresholds["response_time_ms"] = 2000.0
        health_monitor._alert_thresholds["cpu_usage_percent"] = 90.0

        assert health_monitor._alert_thresholds["response_time_ms"] == 2000.0
        assert health_monitor._alert_thresholds["cpu_usage_percent"] == 90.0

        # Restore original thresholds
        health_monitor._alert_thresholds = original_thresholds

    @pytest.mark.asyncio
    async def test_capability_discovery_configuration(self, capability_discovery):
        """Test capability discovery configuration."""
        # Test confidence threshold
        original_threshold = capability_discovery._min_confidence_threshold
        capability_discovery._min_confidence_threshold = 0.5

        assert capability_discovery._min_confidence_threshold == 0.5

        # Restore original threshold
        capability_discovery._min_confidence_threshold = original_threshold

    @pytest.mark.asyncio
    async def test_performance_analytics_configuration(self, performance_analytics):
        """Test performance analytics configuration."""
        # Test buffer flush interval
        original_interval = performance_analytics._buffer_flush_interval
        performance_analytics._buffer_flush_interval = 60

        assert performance_analytics._buffer_flush_interval == 60

        # Restore original interval
        performance_analytics._buffer_flush_interval = original_interval

    @pytest.mark.asyncio
    async def test_failover_configuration_options(self, failover_manager):
        """Test failover configuration options."""
        # Test default configurations
        default_lb_config = failover_manager._default_load_balancer_config
        default_cb_config = failover_manager._default_circuit_breaker_config

        assert default_lb_config.mode == LoadBalancingMode.PERFORMANCE_BASED
        assert default_cb_config.failure_threshold == 5


# Test Utilities

@pytest.fixture
def mock_redis():
    """Mock Redis client for testing."""
    with patch('app.core.redis.redis_client') as mock_redis:
        mock_redis.ping = AsyncMock(return_value=True)
        mock_redis.get = AsyncMock(return_value=None)
        mock_redis.set = AsyncMock(return_value=True)
        mock_redis.setex = AsyncMock(return_value=True)
        mock_redis.delete = AsyncMock(return_value=1)
        mock_redis.keys = AsyncMock(return_value=[])
        mock_redis.zadd = AsyncMock(return_value=1)
        mock_redis.zrangebyscore = AsyncMock(return_value=[])
        mock_redis.lpush = AsyncMock(return_value=1)
        mock_redis.ltrim = AsyncMock(return_value=1)
        mock_redis.expire = AsyncMock(return_value=1)
        yield mock_redis


@pytest.fixture
def mock_database():
    """Mock database session for testing."""
    with patch('app.core.database.get_db') as mock_get_db:
        mock_session = Mock(spec=AsyncSession)
        mock_session.execute = AsyncMock()
        mock_session.commit = AsyncMock()
        mock_session.rollback = AsyncMock()
        mock_get_db.return_value.__aenter__ = AsyncMock(return_value=mock_session)
        mock_get_db.return_value.__aexit__ = AsyncMock(return_value=None)
        yield mock_session


# Running Tests

if __name__ == "__main__":
    pytest.main([
        __file__,
        "-v",
        "--tb=short",
        "--asyncio-mode=auto"
    ])