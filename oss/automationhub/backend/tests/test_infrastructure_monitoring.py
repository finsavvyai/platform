"""
Test suite for Infrastructure Monitoring Service
"""

import pytest
from uuid import uuid4
from datetime import datetime

from app.services.infrastructure_monitoring import (
    InfrastructureMonitoringService,
    MetricType,
    AlertSeverity,
    MonitoringStatus,
    AlertRule,
    ScalingPolicy,
    MetricData
)
from app.services.infrastructure_deployment import DeploymentPlatform


@pytest.mark.asyncio
class TestInfrastructureMonitoringService:
    """Test cases for Infrastructure Monitoring Service"""

    async def test_service_initialization(self):
        """Test service can be initialized"""
        service = InfrastructureMonitoringService()
        assert service is not None
        assert hasattr(service, 'start_monitoring')
        assert hasattr(service, 'stop_monitoring')
        assert hasattr(service, 'get_monitoring_status')
        assert hasattr(service, 'generate_monitoring_report')
        assert hasattr(service, 'health_check')

    async def test_health_check(self):
        """Test service health check"""
        service = InfrastructureMonitoringService()
        result = await service.health_check()

        assert isinstance(result, dict)
        # Check that health check returns monitoring statistics
        assert "active_monitoring_sessions" in result

    async def test_metric_data_creation(self):
        """Test MetricData class creation"""
        deployment_id = uuid4()
        metric = MetricData(
            deployment_id=deployment_id,
            metric_type=MetricType.CPU_USAGE,
            value=75.0,
            unit="percent",
            timestamp=datetime.now()
        )

        assert metric.deployment_id == deployment_id
        assert metric.metric_type == MetricType.CPU_USAGE
        assert metric.value == 75.0
        assert metric.unit == "percent"

    async def test_alert_rule_creation(self):
        """Test AlertRule class creation"""
        rule = AlertRule(
            name="Test Rule",
            metric_type=MetricType.CPU_USAGE,
            threshold=80.0,
            comparison=">",
            severity=AlertSeverity.HIGH,
            enabled=True
        )

        assert rule.name == "Test Rule"
        assert rule.metric_type == MetricType.CPU_USAGE
        assert rule.threshold == 80.0
        assert rule.comparison == ">"
        assert rule.severity == AlertSeverity.HIGH
        assert rule.enabled is True

    async def test_scaling_policy_creation(self):
        """Test ScalingPolicy class creation"""
        deployment_id = uuid4()
        policy = ScalingPolicy(
            deployment_id=deployment_id,
            platform=DeploymentPlatform.AWS,
            min_instances=1,
            max_instances=10,
            target_cpu=70.0,
            enabled=True
        )

        assert policy.deployment_id == deployment_id
        assert policy.platform == DeploymentPlatform.AWS
        assert policy.min_instances == 1
        assert policy.max_instances == 10
        assert policy.target_cpu == 70.0
        assert policy.enabled is True

    async def test_enum_values(self):
        """Test enum values are accessible"""
        # Test MetricType enum
        assert MetricType.CPU_USAGE.value == "cpu_usage"
        assert MetricType.MEMORY_USAGE.value == "memory_usage"
        assert MetricType.DISK_USAGE.value == "disk_usage"

        # Test AlertSeverity enum
        assert AlertSeverity.CRITICAL.value == "critical"
        assert AlertSeverity.HIGH.value == "high"
        assert AlertSeverity.MEDIUM.value == "medium"
        assert AlertSeverity.LOW.value == "low"

        # Test MonitoringStatus enum
        assert MonitoringStatus.ACTIVE.value == "active"
        assert MonitoringStatus.INACTIVE.value == "inactive"

    async def test_get_monitoring_status_invalid_deployment(self):
        """Test get monitoring status for invalid deployment"""
        service = InfrastructureMonitoringService()
        deployment_id = uuid4()

        result = await service.get_monitoring_status(deployment_id)

        assert isinstance(result, dict)
        # Should handle gracefully without throwing exception
