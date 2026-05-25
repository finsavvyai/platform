"""
Integration tests for Advanced Analytics database models
"""

import pytest
from datetime import datetime, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.models.advanced_analytics import (
    AnalyticsMetric, AnomalyDetection, PredictiveModel,
    PerformanceForecast, IntelligenceReport, InsightPattern,
    AnomalyAlert, Base
)
from app.core.database import get_db


class TestAdvancedAnalyticsModels:
    """Test suite for Advanced Analytics database models"""

    @pytest.fixture(scope="function")
    def db_session(self):
        """Create in-memory database for testing"""
        engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool
        )

        # Create all tables
        Base.metadata.create_all(bind=engine)

        # Create session
        TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        session = TestingSessionLocal()

        try:
            yield session
        finally:
            session.close()

    @pytest.fixture
    def sample_tenant(self, db_session):
        """Create a sample tenant for testing"""
        # This would normally be created via the tenant model
        # For testing, we'll use a hardcoded ID
        return 1

    @pytest.fixture
    def sample_provider(self, db_session):
        """Create a sample multi-cloud provider for testing"""
        # This would normally be created via the multi-cloud provider model
        # For testing, we'll use a hardcoded ID
        return 1

    class TestAnalyticsMetricModel:
        """Test AnalyticsMetric model"""

        def test_create_analytics_metric(self, db_session, sample_tenant, sample_provider):
            """Test creating a new analytics metric"""
            metric = AnalyticsMetric(
                tenant_id=sample_tenant,
                provider_id=sample_provider,
                resource_id="vm-001",
                resource_type="virtual_machine",
                metric_name="cpu_utilization",
                metric_type="performance",
                value=75.5,
                unit="percentage",
                tags={"provider": "aws", "region": "us-east-1"},
                timestamp=datetime.utcnow(),
                collected_at=datetime.utcnow(),
                metadata={"source": "cloudwatch", "interval": "5m"}
            )

            db_session.add(metric)
            db_session.commit()
            db_session.refresh(metric)

            assert metric.id is not None
            assert metric.metric_name == "cpu_utilization"
            assert metric.metric_type == "performance"
            assert metric.value == 75.5
            assert metric.unit == "percentage"
            assert metric.tenant_id == sample_tenant
            assert metric.provider_id == sample_provider
            assert metric.resource_id == "vm-001"
            assert metric.resource_type == "virtual_machine"

        def test_analytics_metric_relationships(self, db_session, sample_tenant, sample_provider):
            """Test analytics metric relationships"""
            # Create metric
            metric = AnalyticsMetric(
                tenant_id=sample_tenant,
                provider_id=sample_provider,
                resource_id="vm-001",
                resource_type="virtual_machine",
                metric_name="memory_usage",
                metric_type="resource",
                value=8192,
                unit="bytes",
                timestamp=datetime.utcnow(),
                collected_at=datetime.utcnow()
            )

            db_session.add(metric)
            db_session.commit()

            # Create anomaly associated with this metric
            anomaly = AnomalyDetection(
                tenant_id=sample_tenant,
                metric_id=metric.id,
                provider_id=sample_provider,
                resource_id="vm-001",
                anomaly_type="memory_spike",
                severity="high",
                score=0.85,
                threshold=0.7,
                metric_value=16384,
                description="Memory usage spike detected",
                first_detected_at=datetime.utcnow(),
                last_detected_at=datetime.utcnow()
            )

            db_session.add(anomaly)
            db_session.commit()
            db_session.refresh(metric)
            db_session.refresh(anomaly)

            # Verify relationship
            assert len(metric.anomaly_detections) == 1
            assert metric.anomaly_detections[0].id == anomaly.id
            assert anomaly.metric_id == metric.id

        def test_analytics_metric_validation(self, db_session, sample_tenant):
            """Test analytics metric field validation"""
            # Test required fields
            with pytest.raises(Exception):  # SQLAlchemy will raise an integrity error
                metric = AnalyticsMetric(
                    # Missing required tenant_id
                    metric_name="cpu_utilization",
                    metric_type="performance",
                    value=75.5,
                    unit="percentage",
                    timestamp=datetime.utcnow(),
                    collected_at=datetime.utcnow()
                )
                db_session.add(metric)
                db_session.commit()

        def test_analytics_metric_json_fields(self, db_session, sample_tenant, sample_provider):
            """Test JSON fields in analytics metric"""
            complex_tags = {
                "provider": "aws",
                "region": "us-east-1",
                "az": "us-east-1a",
                "instance_type": "t3.medium",
                "environment": "production",
                "custom_labels": {
                    "team": "backend",
                    "service": "api"
                }
            }

            complex_metadata = {
                "source": "cloudwatch",
                "interval": "5m",
                "namespace": "AWS/EC2",
                "dimensions": {
                    "InstanceId": "i-1234567890abcdef0"
                },
                "statistics": ["Average", "Maximum", "Minimum"]
            }

            metric = AnalyticsMetric(
                tenant_id=sample_tenant,
                provider_id=sample_provider,
                resource_id="vm-001",
                resource_type="virtual_machine",
                metric_name="network_throughput",
                metric_type="network",
                value=1048576,
                unit="bytes_per_second",
                tags=complex_tags,
                timestamp=datetime.utcnow(),
                collected_at=datetime.utcnow(),
                metadata=complex_metadata
            )

            db_session.add(metric)
            db_session.commit()
            db_session.refresh(metric)

            assert metric.tags == complex_tags
            assert metric.metadata == complex_metadata
            assert metric.tags["custom_labels"]["team"] == "backend"

    class TestAnomalyDetectionModel:
        """Test AnomalyDetection model"""

        def test_create_anomaly_detection(self, db_session, sample_tenant, sample_provider):
            """Test creating a new anomaly detection"""
            anomaly = AnomalyDetection(
                tenant_id=sample_tenant,
                metric_id=1,
                provider_id=sample_provider,
                resource_id="vm-001",
                anomaly_type="cpu_spike",
                severity="high",
                score=0.92,
                threshold=0.7,
                metric_value=95.0,
                expected_value=45.0,
                deviation=50.0,
                confidence=0.95,
                status="open",
                description="Critical CPU spike detected on virtual machine",
                analysis_details={
                    "algorithm": "isolation_forest",
                    "features": ["cpu_utilization", "memory_usage", "network_io"],
                    "context": {"time_window": "1h", "baseline_period": "7d"}
                },
                first_detected_at=datetime.utcnow(),
                last_detected_at=datetime.utcnow()
            )

            db_session.add(anomaly)
            db_session.commit()
            db_session.refresh(anomaly)

            assert anomaly.id is not None
            assert anomaly.anomaly_type == "cpu_spike"
            assert anomaly.severity == "high"
            assert anomaly.score == 0.92
            assert anomaly.status == "open"
            assert anomaly.confidence == 0.95

        def test_anomaly_detection_lifecycle(self, db_session, sample_tenant, sample_provider):
            """Test anomaly detection lifecycle states"""
            anomaly = AnomalyDetection(
                tenant_id=sample_tenant,
                metric_id=1,
                provider_id=sample_provider,
                resource_id="vm-001",
                anomaly_type="memory_leak",
                severity="medium",
                score=0.78,
                threshold=0.7,
                metric_value=16384,
                description="Gradual memory increase detected",
                first_detected_at=datetime.utcnow(),
                last_detected_at=datetime.utcnow(),
                status="open"
            )

            db_session.add(anomaly)
            db_session.commit()

            # Test acknowledging anomaly
            anomaly.status = "acknowledged"
            anomaly.acknowledged_at = datetime.utcnow()
            db_session.commit()
            db_session.refresh(anomaly)

            assert anomaly.status == "acknowledged"
            assert anomaly.acknowledged_at is not None

            # Test resolving anomaly
            anomaly.status = "resolved"
            anomaly.resolved_at = datetime.utcnow()
            anomaly.resolution_details = {
                "method": "manual",
                "action_taken": "Restarted service",
                "notes": "Memory leak fixed by patching application"
            }
            db_session.commit()
            db_session.refresh(anomaly)

            assert anomaly.status == "resolved"
            assert anomaly.resolved_at is not None
            assert anomaly.resolution_details["action_taken"] == "Restarted service"

        def test_anomaly_detection_alert_relationship(self, db_session, sample_tenant, sample_provider):
            """Test relationship between anomaly and alerts"""
            anomaly = AnomalyDetection(
                tenant_id=sample_tenant,
                metric_id=1,
                provider_id=sample_provider,
                resource_id="vm-001",
                anomaly_type="disk_space",
                severity="critical",
                score=0.95,
                threshold=0.8,
                metric_value=95.0,
                description="Disk usage critically high",
                first_detected_at=datetime.utcnow(),
                last_detected_at=datetime.utcnow(),
                status="open"
            )

            db_session.add(anomaly)
            db_session.commit()

            # Create alert for this anomaly
            alert = AnomalyAlert(
                tenant_id=sample_tenant,
                anomaly_id=anomaly.id,
                provider_id=sample_provider,
                resource_id="vm-001",
                alert_type="disk_space_critical",
                severity="critical",
                title="Critical: Disk Space Running Out",
                message="Disk usage on vm-001 has reached 95% capacity",
                action_required="Immediate cleanup required",
                threshold_value=90.0,
                actual_value=95.0,
                trigger_conditions={
                    "disk_usage": {"operator": ">", "value": 90},
                    "time_window": "15m"
                },
                status="open",
                escalation_level=1
            )

            db_session.add(alert)
            db_session.commit()
            db_session.refresh(anomaly)
            db_session.refresh(alert)

            assert len(anomaly.alerts) == 1
            assert anomaly.alerts[0].id == alert.id
            assert alert.anomaly_id == anomaly.id

    class TestPredictiveModelModel:
        """Test PredictiveModel model"""

        def test_create_predictive_model(self, db_session, sample_tenant, sample_provider):
            """Test creating a new predictive model"""
            model = PredictiveModel(
                tenant_id=sample_tenant,
                provider_id=sample_provider,
                model_name="CPU_Forecast_Model_v1",
                model_type="time_series",
                target_metric="cpu_utilization",
                algorithm="random_forest",
                parameters={
                    "n_estimators": 100,
                    "max_depth": 10,
                    "random_state": 42
                },
                features=["hour_of_day", "day_of_week", "cpu_utilization_lag_1h", "cpu_utilization_lag_24h"],
                accuracy=0.87,
                precision=0.85,
                recall=0.89,
                f1_score=0.87,
                mae=4.2,
                mse=17.6,
                rmse=4.2,
                training_data_points=1000,
                validation_data_points=200,
                training_start_at=datetime.utcnow() - timedelta(days=30),
                training_end_at=datetime.utcnow() - timedelta(days=1),
                last_trained_at=datetime.utcnow() - timedelta(hours=2),
                last_prediction_at=datetime.utcnow() - timedelta(minutes=30),
                status="trained",
                performance_metrics={
                    "training_time": 120.5,
                    "memory_usage": 512,
                    "feature_importance": {
                        "hour_of_day": 0.35,
                        "day_of_week": 0.25,
                        "cpu_utilization_lag_1h": 0.30,
                        "cpu_utilization_lag_24h": 0.10
                    }
                },
                feature_importance={
                    "hour_of_day": 0.35,
                    "day_of_week": 0.25,
                    "cpu_utilization_lag_1h": 0.30,
                    "cpu_utilization_lag_24h": 0.10
                }
            )

            db_session.add(model)
            db_session.commit()
            db_session.refresh(model)

            assert model.id is not None
            assert model.model_name == "CPU_Forecast_Model_v1"
            assert model.model_type == "time_series"
            assert model.algorithm == "random_forest"
            assert model.accuracy == 0.87
            assert model.status == "trained"

        def test_predictive_model_with_forecasts(self, db_session, sample_tenant, sample_provider):
            """Test predictive model with associated forecasts"""
            model = PredictiveModel(
                tenant_id=sample_tenant,
                provider_id=sample_provider,
                model_name="Memory_Usage_Predictor",
                model_type="regression",
                target_metric="memory_usage",
                algorithm="linear_regression",
                accuracy=0.82,
                status="trained",
                last_trained_at=datetime.utcnow() - timedelta(hours=1)
            )

            db_session.add(model)
            db_session.commit()

            # Create forecasts using this model
            forecast = PerformanceForecast(
                tenant_id=sample_tenant,
                provider_id=sample_provider,
                model_id=model.id,
                resource_id="vm-001",
                metric_name="memory_usage",
                forecast_type="time_series",
                forecast_horizon=24,
                forecast_values={
                    "next_24h": [8192, 8250, 8300, 8350, 8400, 8420]
                },
                confidence_intervals={
                    "next_24h": [[8000, 8500], [8050, 8550], [8100, 8600], [8150, 8650], [8200, 8700], [8220, 8720]]
                },
                forecast_start_at=datetime.utcnow(),
                forecast_end_at=datetime.utcnow() + timedelta(hours=24),
                model_version="v1.0",
                accuracy=0.82,
                mae=256.5,
                status="active"
            )

            db_session.add(forecast)
            db_session.commit()
            db_session.refresh(model)
            db_session.refresh(forecast)

            assert len(model.forecasts) == 1
            assert model.forecasts[0].id == forecast.id
            assert forecast.model_id == model.id

    class TestPerformanceForecastModel:
        """Test PerformanceForecast model"""

        def test_create_performance_forecast(self, db_session, sample_tenant, sample_provider):
            """Test creating a new performance forecast"""
            forecast = PerformanceForecast(
                tenant_id=sample_tenant,
                provider_id=sample_provider,
                model_id=1,
                resource_id="webapp-prod-01",
                metric_name="response_time",
                forecast_type="time_series",
                forecast_horizon=48,
                forecast_values={
                    "next_48h": [
                        {"timestamp": "2025-01-20T01:00:00Z", "value": 120.5},
                        {"timestamp": "2025-01-20T02:00:00Z", "value": 115.2},
                        {"timestamp": "2025-01-20T03:00:00Z", "value": 125.8}
                    ]
                },
                confidence_intervals={
                    "next_48h": [
                        [100.0, 140.0],
                        [95.0, 135.0],
                        [105.0, 145.0]
                    ]
                },
                forecast_start_at=datetime.utcnow(),
                forecast_end_at=datetime.utcnow() + timedelta(hours=48),
                model_version="v2.1",
                accuracy=0.88,
                mae=8.5,
                mse=72.2,
                rmse=8.5,
                status="active"
            )

            db_session.add(forecast)
            db_session.commit()
            db_session.refresh(forecast)

            assert forecast.id is not None
            assert forecast.metric_name == "response_time"
            assert forecast.forecast_type == "time_series"
            assert forecast.forecast_horizon == 48
            assert forecast.status == "active"

        def test_performance_forecast_validation(self, db_session, sample_tenant):
            """Test performance forecast field validation"""
            # Test that forecast_horizon is positive
            with pytest.raises(Exception):
                forecast = PerformanceForecast(
                    tenant_id=sample_tenant,
                    model_id=1,
                    metric_name="cpu_utilization",
                    forecast_type="time_series",
                    forecast_horizon=-1,  # Invalid negative value
                    forecast_values={"next_24h": [75.0, 80.0]},
                    forecast_start_at=datetime.utcnow(),
                    forecast_end_at=datetime.utcnow() + timedelta(hours=24)
                )
                db_session.add(forecast)
                db_session.commit()

    class TestIntelligenceReportModel:
        """Test IntelligenceReport model"""

        def test_create_intelligence_report(self, db_session, sample_tenant, sample_provider):
            """Test creating a new intelligence report"""
            report = IntelligenceReport(
                tenant_id=sample_tenant,
                provider_id=sample_provider,
                report_name="Weekly Infrastructure Analysis",
                report_type="performance",
                description="Comprehensive analysis of infrastructure performance over the past week",
                executive_summary="Overall system performance is stable with minor optimization opportunities identified in database query patterns.",
                analysis_period_start=datetime.utcnow() - timedelta(days=7),
                analysis_period_end=datetime.utcnow(),
                total_metrics_analyzed=15000,
                anomalies_detected=8,
                predictions_generated=200,
                key_insights=[
                    {
                        "title": "Database Query Optimization",
                        "description": "Identified 15 slow queries that could be optimized for 25% performance improvement",
                        "significance": 0.8,
                        "category": "performance"
                    },
                    {
                        "title": "CPU Utilization Trend",
                        "description": "Average CPU utilization increased by 5% over the past week, staying within acceptable range",
                        "significance": 0.6,
                        "category": "trend"
                    }
                ],
                charts_data={
                    "performance_trends": {
                        "type": "line_chart",
                        "data": [{"x": "2025-01-13", "y": 72.5}, {"x": "2025-01-14", "y": 75.2}]
                    },
                    "anomaly_distribution": {
                        "type": "pie_chart",
                        "data": [{"name": "CPU", "value": 3}, {"name": "Memory", "value": 2}]
                    }
                },
                recommendations=[
                    {
                        "action": "Optimize database indexes",
                        "priority": "high",
                        "impact": "Improve query performance by 25%",
                        "estimated_effort": "2-3 days",
                        "category": "performance"
                    },
                    {
                        "action": "Review auto-scaling policies",
                        "priority": "medium",
                        "impact": "Reduce costs by 10-15%",
                        "estimated_effort": "1 day",
                        "category": "cost_optimization"
                    }
                ],
                action_items=[
                    {
                        "task": "Create database optimization plan",
                        "assignee": "Database Team",
                        "due_date": "2025-01-27",
                        "status": "pending"
                    }
                ],
                data_sources=["aws_cloudwatch", "azure_monitor", "gcp_stackdriver"],
                methodology="Combination of statistical analysis and machine learning anomaly detection",
                confidence_level=0.85,
                report_metadata={
                    "version": "1.0",
                    "generated_by": "AI_Analytics_Engine_v2.1",
                    "processing_time": 45.2,
                    "data_quality_score": 0.92
                },
                status="completed",
                generated_at=datetime.utcnow(),
                expires_at=datetime.utcnow() + timedelta(days=30)
            )

            db_session.add(report)
            db_session.commit()
            db_session.refresh(report)

            assert report.id is not None
            assert report.report_name == "Weekly Infrastructure Analysis"
            assert report.report_type == "performance"
            assert report.total_metrics_analyzed == 15000
            assert report.anomalies_detected == 8
            assert len(report.key_insights) == 2
            assert len(report.recommendations) == 2
            assert report.confidence_level == 0.85

        def test_intelligence_report_lifecycle(self, db_session, sample_tenant, sample_provider):
            """Test intelligence report lifecycle states"""
            report = IntelligenceReport(
                tenant_id=sample_tenant,
                provider_id=sample_provider,
                report_name="Security Analysis",
                report_type="security",
                analysis_period_start=datetime.utcnow() - timedelta(days=1),
                analysis_period_end=datetime.utcnow(),
                total_metrics_analyzed=5000,
                anomalies_detected=3,
                predictions_generated=50,
                key_insights=[],
                charts_data={},
                recommendations=[],
                action_items=[],
                status="generating"
            )

            db_session.add(report)
            db_session.commit()

            # Test completing report generation
            report.status = "completed"
            report.generated_at = datetime.utcnow()
            report.executive_summary = "Security analysis completed successfully"
            db_session.commit()
            db_session.refresh(report)

            assert report.status == "completed"
            assert report.generated_at is not None

    class TestInsightPatternModel:
        """Test InsightPattern model"""

        def test_create_insight_pattern(self, db_session, sample_tenant, sample_provider):
            """Test creating a new insight pattern"""
            pattern = InsightPattern(
                tenant_id=sample_tenant,
                provider_id=sample_provider,
                pattern_name="Weekly_CPU_Spike_Pattern",
                pattern_type="seasonal",
                description="Consistent CPU utilization spike every Tuesday morning",
                pattern_data={
                    "season": "weekly",
                    "day_of_week": "tuesday",
                    "time_window": "09:00-11:00",
                    "average_increase": 25.5,
                    "consistency": 0.85
                },
                frequency=12,  # Detected 12 times
                confidence=0.92,
                significance=0.78,
                recommendations=[
                    "Consider scheduling maintenance during off-peak hours",
                    "Investigate weekly batch jobs running during this period"
                ],
                last_seen_at=datetime.utcnow() - timedelta(days=1),
                times_detected=12,
                status="active"
            )

            db_session.add(pattern)
            db_session.commit()
            db_session.refresh(pattern)

            assert pattern.id is not None
            assert pattern.pattern_name == "Weekly_CPU_Spike_Pattern"
            assert pattern.pattern_type == "seasonal"
            assert pattern.frequency == 12
            assert pattern.confidence == 0.92
            assert pattern.status == "active"

        def test_insight_pattern_evolution(self, db_session, sample_tenant, sample_provider):
            """Test insight pattern evolution over time"""
            pattern = InsightPattern(
                tenant_id=sample_tenant,
                provider_id=sample_provider,
                pattern_name="Memory_Usage_Growth",
                pattern_type="trend",
                description="Gradual increase in memory usage over time",
                pattern_data={
                    "trend": "increasing",
                    "slope": 0.15,
                    "correlation": 0.89
                },
                frequency=5,
                confidence=0.75,
                significance=0.65,
                recommendations=["Monitor for memory leaks"],
                last_seen_at=datetime.utcnow() - timedelta(days=2),
                times_detected=5,
                status="active"
            )

            db_session.add(pattern)
            db_session.commit()

            # Simulate pattern being detected again
            pattern.frequency += 1
            pattern.times_detected += 1
            pattern.last_seen_at = datetime.utcnow()
            pattern.confidence = min(0.95, pattern.confidence + 0.05)  # Increase confidence
            db_session.commit()
            db_session.refresh(pattern)

            assert pattern.frequency == 6
            assert pattern.times_detected == 6
            assert pattern.confidence > 0.75

    class TestAnomalyAlertModel:
        """Test AnomalyAlert model"""

        def test_create_anomaly_alert(self, db_session, sample_tenant, sample_provider):
            """Test creating a new anomaly alert"""
            alert = AnomalyAlert(
                tenant_id=sample_tenant,
                anomaly_id=1,
                provider_id=sample_provider,
                resource_id="db-prod-01",
                alert_type="connection_pool_exhaustion",
                severity="critical",
                title="Critical: Database Connection Pool Exhausted",
                message="Database connection pool on db-prod-01 has reached maximum capacity",
                description="All available database connections are currently in use, indicating potential connection leaks or high load",
                action_required="Immediate investigation required",
                recommendations=[
                    "Check for connection leaks in application code",
                    "Consider increasing connection pool size",
                    "Review current database query performance"
                ],
                threshold_value=95.0,
                actual_value=100.0,
                trigger_conditions={
                    "connection_usage": {"operator": ">=", "value": 95},
                    "duration": "5m",
                    "consecutive_checks": 3
                },
                context_data={
                    "current_connections": 100,
                    "max_connections": 100,
                    "active_queries": 85,
                    "average_response_time": 2500
                },
                status="open",
                escalation_level=1,
                metadata={
                    "alert_rule": "db_connection_pool_high",
                    "notification_channels": ["email", "slack"],
                    "auto_escalation": True
                }
            )

            db_session.add(alert)
            db_session.commit()
            db_session.refresh(alert)

            assert alert.id is not None
            assert alert.alert_type == "connection_pool_exhaustion"
            assert alert.severity == "critical"
            assert alert.escalation_level == 1
            assert alert.status == "open"

        def test_anomaly_alert_escalation(self, db_session, sample_tenant, sample_provider):
            """Test anomaly alert escalation process"""
            alert = AnomalyAlert(
                tenant_id=sample_tenant,
                anomaly_id=1,
                provider_id=sample_provider,
                resource_id="api-gateway-prod",
                alert_type="high_latency",
                severity="high",
                title="High Latency Detected",
                message="API response times exceeding acceptable thresholds",
                threshold_value=1000.0,
                actual_value=2500.0,
                status="open",
                escalation_level=0
            )

            db_session.add(alert)
            db_session.commit()

            # Simulate escalation after 30 minutes
            alert.escalation_level = 1
            alert.escalation_notified_at = datetime.utcnow()
            db_session.commit()
            db_session.refresh(alert)

            assert alert.escalation_level == 1
            assert alert.escalation_notified_at is not None

            # Simulate acknowledgement
            alert.status = "acknowledged"
            alert.acknowledged_at = datetime.utcnow()
            alert.acknowledged_by = "ops_team_lead"
            db_session.commit()
            db_session.refresh(alert)

            assert alert.status == "acknowledged"
            assert alert.acknowledged_at is not None
            assert alert.acknowledged_by == "ops_team_lead"

    class TestModelRelationships:
        """Test complex relationships between models"""

        def test_complete_analytics_flow(self, db_session, sample_tenant, sample_provider):
            """Test complete analytics flow from metrics to reports"""

            # 1. Create metrics
            metrics = []
            for i in range(10):
                metric = AnalyticsMetric(
                    tenant_id=sample_tenant,
                    provider_id=sample_provider,
                    resource_id=f"vm-{i:03d}",
                    resource_type="virtual_machine",
                    metric_name="cpu_utilization",
                    metric_type="performance",
                    value=50.0 + (i * 5),
                    unit="percentage",
                    timestamp=datetime.utcnow() - timedelta(minutes=i*5),
                    collected_at=datetime.utcnow() - timedelta(minutes=i*5)
                )
                metrics.append(metric)
                db_session.add(metric)

            db_session.commit()

            # 2. Detect anomalies
            anomaly = AnomalyDetection(
                tenant_id=sample_tenant,
                metric_id=metrics[9].id,  # Use the last metric (highest CPU)
                provider_id=sample_provider,
                resource_id="vm-009",
                anomaly_type="cpu_spike",
                severity="medium",
                score=0.78,
                threshold=0.7,
                metric_value=95.0,
                description="High CPU utilization detected",
                first_detected_at=datetime.utcnow(),
                last_detected_at=datetime.utcnow(),
                status="open"
            )
            db_session.add(anomaly)
            db_session.commit()

            # 3. Create alert for anomaly
            alert = AnomalyAlert(
                tenant_id=sample_tenant,
                anomaly_id=anomaly.id,
                provider_id=sample_provider,
                resource_id="vm-009",
                alert_type="cpu_high",
                severity="medium",
                title="CPU Utilization High",
                message="CPU utilization on vm-009 is above threshold",
                threshold_value=80.0,
                actual_value=95.0,
                status="open",
                escalation_level=0
            )
            db_session.add(alert)
            db_session.commit()

            # 4. Train predictive model
            model = PredictiveModel(
                tenant_id=sample_tenant,
                provider_id=sample_provider,
                model_name="CPU_Predictor",
                model_type="time_series",
                target_metric="cpu_utilization",
                algorithm="random_forest",
                accuracy=0.85,
                status="trained",
                last_trained_at=datetime.utcnow()
            )
            db_session.add(model)
            db_session.commit()

            # 5. Generate forecast
            forecast = PerformanceForecast(
                tenant_id=sample_tenant,
                provider_id=sample_provider,
                model_id=model.id,
                resource_id="vm-009",
                metric_name="cpu_utilization",
                forecast_type="time_series",
                forecast_horizon=12,
                forecast_values={"next_12h": [75.0, 78.0, 80.0, 76.0]},
                forecast_start_at=datetime.utcnow(),
                forecast_end_at=datetime.utcnow() + timedelta(hours=12),
                status="active"
            )
            db_session.add(forecast)
            db_session.commit()

            # 6. Generate intelligence report
            report = IntelligenceReport(
                tenant_id=sample_tenant,
                provider_id=sample_provider,
                report_name="Performance Analysis Report",
                report_type="performance",
                analysis_period_start=datetime.utcnow() - timedelta(hours=1),
                analysis_period_end=datetime.utcnow(),
                total_metrics_analyzed=len(metrics),
                anomalies_detected=1,
                predictions_generated=4,
                key_insights=[{
                    "title": "CPU Performance Pattern",
                    "description": "Gradual increase in CPU utilization across VMs",
                    "significance": 0.75
                }],
                charts_data={},
                recommendations=[{
                    "action": "Investigate CPU performance trends",
                    "priority": "medium",
                    "impact": "Prevent future performance issues"
                }],
                action_items=[],
                status="completed",
                generated_at=datetime.utcnow()
            )
            db_session.add(report)
            db_session.commit()
            db_session.refresh(report)

            # 7. Create insight pattern
            pattern = InsightPattern(
                tenant_id=sample_tenant,
                provider_id=sample_provider,
                pattern_name="CPU_Growth_Trend",
                pattern_type="trend",
                description="Consistent increase in CPU utilization",
                pattern_data={"trend": "increasing"},
                frequency=1,
                confidence=0.8,
                significance=0.7,
                recommendations=["Monitor capacity planning"],
                last_seen_at=datetime.utcnow(),
                times_detected=1,
                status="active"
            )
            db_session.add(pattern)
            db_session.commit()

            # Verify all relationships are correctly established
            db_session.refresh(metrics[-1])
            assert len(metrics[-1].anomaly_detections) == 1
            assert metrics[-1].anomaly_detections[0].id == anomaly.id

            db_session.refresh(anomaly)
            assert len(anomaly.alerts) == 1
            assert anomaly.alerts[0].id == alert.id

            db_session.refresh(model)
            assert len(model.forecasts) == 1
            assert model.forecasts[0].id == forecast.id

            # Verify counts and data integrity
            assert db_session.query(AnalyticsMetric).count() == 10
            assert db_session.query(AnomalyDetection).count() == 1
            assert db_session.query(AnomalyAlert).count() == 1
            assert db_session.query(PredictiveModel).count() == 1
            assert db_session.query(PerformanceForecast).count() == 1
            assert db_session.query(IntelligenceReport).count() == 1
            assert db_session.query(InsightPattern).count() == 1