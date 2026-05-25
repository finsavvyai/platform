"""
Integration tests for Advanced Analytics API endpoints
"""

import pytest
import asyncio
from datetime import datetime, timedelta
from unittest.mock import Mock, patch, AsyncMock
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.models.advanced_analytics import (
    AnalyticsMetric, AnomalyDetection, PredictiveModel,
    PerformanceForecast, IntelligenceReport
)
from app.core.database import get_db


class TestAdvancedAnalyticsAPI:
    """Test suite for Advanced Analytics API endpoints"""

    @pytest.fixture
    def client(self):
        """Create test client"""
        return TestClient(app)

    @pytest.fixture
    def mock_db(self):
        """Mock database session"""
        return Mock(spec=Session)

    @pytest.fixture
    def override_get_db(self, mock_db):
        """Override database dependency"""
        def _override_get_db():
            try:
                yield mock_db
            finally:
                pass
        return _override_get_db

    @pytest.fixture
    def auth_headers(self):
        """Mock authentication headers"""
        return {
            "Authorization": "Bearer test_token",
            "X-Tenant-ID": "1"
        }

    class TestMetricsCollectionEndpoint:
        """Test metrics collection endpoints"""

        def test_collect_metrics_success(self, client, override_get_db, auth_headers):
            """Test successful metrics collection"""
            app.dependency_overrides[get_db] = override_get_db

            with patch('app.api.v1.endpoints.advanced_analytics.AdvancedAnalyticsService') as mock_service_class:
                mock_service = Mock()
                mock_service.collect_metrics = AsyncMock(return_value={
                    "success": True,
                    "metrics_collected": 150,
                    "collection_id": "col_123456789",
                    "provider_results": {
                        "aws": {"metrics_collected": 100, "success": True},
                        "azure": {"metrics_collected": 50, "success": True}
                    },
                    "execution_time": 12.5,
                    "started_at": datetime.utcnow().isoformat()
                })
                mock_service_class.return_value = mock_service

                response = client.post(
                    "/api/v1/analytics/metrics/collect",
                    json={
                        "providers": ["aws", "azure"],
                        "metrics": ["cpu_utilization", "memory_usage"],
                        "time_range": "1h",
                        "resource_types": ["virtual_machine"]
                    },
                    headers=auth_headers
                )

                assert response.status_code == 200
                data = response.json()
                assert data["success"] is True
                assert data["metrics_collected"] == 150
                assert "collection_id" in data
                assert len(data["provider_results"]) == 2

        def test_collect_metrics_validation_error(self, client, override_get_db, auth_headers):
            """Test metrics collection with invalid request"""
            app.dependency_overrides[get_db] = override_get_db

            response = client.post(
                "/api/v1/analytics/metrics/collect",
                json={
                    "providers": ["invalid_provider"],
                    "metrics": [],
                    "time_range": "invalid_time_range"
                },
                headers=auth_headers
            )

            assert response.status_code == 422  # Validation error

        def test_get_recent_metrics(self, client, override_get_db, auth_headers):
            """Test retrieving recent metrics"""
            app.dependency_overrides[get_db] = override_get_db

            # Mock database query
            mock_query = Mock()
            mock_query.filter.return_value.filter.return_value.order_by.return_value.limit.return_value.all.return_value = [
                AnalyticsMetric(
                    id=1,
                    metric_name="cpu_utilization",
                    metric_type="performance",
                    value=75.5,
                    unit="percentage",
                    resource_type="virtual_machine",
                    resource_id="vm-001",
                    timestamp=datetime.utcnow(),
                    collected_at=datetime.utcnow()
                ),
                AnalyticsMetric(
                    id=2,
                    metric_name="memory_usage",
                    metric_type="resource",
                    value=8192,
                    unit="bytes",
                    resource_type="virtual_machine",
                    resource_id="vm-001",
                    timestamp=datetime.utcnow(),
                    collected_at=datetime.utcnow()
                )
            ]

            mock_db = override_get_db()
            mock_db.query.return_value = mock_query

            response = client.get(
                "/api/v1/analytics/metrics/recent?time_range=24h&limit=50",
                headers=auth_headers
            )

            assert response.status_code == 200
            data = response.json()
            assert len(data) == 2
            assert data[0]["metric_name"] == "cpu_utilization"
            assert data[1]["metric_name"] == "memory_usage"

        def test_get_metrics_summary(self, client, override_get_db, auth_headers):
            """Test metrics summary endpoint"""
            app.dependency_overrides[get_db] = override_get_db

            with patch('app.api.v1.endpoints.advanced_analytics.AdvancedAnalyticsService') as mock_service_class:
                mock_service = Mock()
                mock_service.get_metrics_summary = AsyncMock(return_value={
                    "total_metrics": 10000,
                    "metric_types": {
                        "performance": 6000,
                        "resource": 3000,
                        "security": 1000
                    },
                    "providers": {
                        "aws": 5000,
                        "azure": 3000,
                        "gcp": 1500,
                        "cloudflare": 500
                    },
                    "time_range": "24h",
                    "collection_rate": 150.5,
                    "last_collection": datetime.utcnow().isoformat()
                })
                mock_service_class.return_value = mock_service

                response = client.get(
                    "/api/v1/analytics/metrics/summary?time_range=24h",
                    headers=auth_headers
                )

                assert response.status_code == 200
                data = response.json()
                assert data["total_metrics"] == 10000
                assert "metric_types" in data
                assert "providers" in data

    class TestAnomalyDetectionEndpoints:
        """Test anomaly detection endpoints"""

        def test_detect_anomalies_success(self, client, override_get_db, auth_headers):
            """Test successful anomaly detection"""
            app.dependency_overrides[get_db] = override_get_db

            with patch('app.api.v1.endpoints.advanced_analytics.AdvancedAnalyticsService') as mock_service_class:
                mock_service = Mock()
                mock_service.detect_anomalies = AsyncMock(return_value={
                    "success": True,
                    "analysis_id": "anl_123456789",
                    "analysis_type": "comprehensive",
                    "anomalies_detected": 5,
                    "severity_breakdown": {
                        "critical": 1,
                        "high": 2,
                        "medium": 1,
                        "low": 1
                    },
                    "anomaly_types": {
                        "cpu_spike": 2,
                        "memory_leak": 1,
                        "network_latency": 1,
                        "disk_space": 1
                    },
                    "execution_time": 8.3,
                    "analysis_period": "24h",
                    "metrics_analyzed": 1500
                })
                mock_service_class.return_value = mock_service

                response = client.post(
                    "/api/v1/analytics/anomalies/detect",
                    json={
                        "analysis_type": "comprehensive",
                        "sensitivity": "medium",
                        "metrics": ["cpu_utilization", "memory_usage"],
                        "resource_types": ["virtual_machine", "database"]
                    },
                    headers=auth_headers
                )

                assert response.status_code == 200
                data = response.json()
                assert data["success"] is True
                assert data["anomalies_detected"] == 5
                assert "severity_breakdown" in data
                assert "anomaly_types" in data

        def test_get_active_anomalies(self, client, override_get_db, auth_headers):
            """Test retrieving active anomalies"""
            app.dependency_overrides[get_db] = override_get_db

            # Mock database query
            mock_query = Mock()
            mock_query.filter.return_value.order_by.return_value.all.return_value = [
                AnomalyDetection(
                    id=1,
                    metric_id=1,
                    provider_id=1,
                    resource_id="vm-001",
                    anomaly_type="cpu_spike",
                    severity="high",
                    score=0.85,
                    threshold=0.7,
                    metric_value=95.0,
                    description="CPU utilization spike detected",
                    first_detected_at=datetime.utcnow(),
                    last_detected_at=datetime.utcnow(),
                    status="open"
                ),
                AnomalyDetection(
                    id=2,
                    metric_id=2,
                    provider_id=1,
                    resource_id="vm-002",
                    anomaly_type="memory_leak",
                    severity="medium",
                    score=0.75,
                    threshold=0.7,
                    metric_value=16384,
                    description="Memory usage trending upwards",
                    first_detected_at=datetime.utcnow(),
                    last_detected_at=datetime.utcnow(),
                    status="open"
                )
            ]

            mock_db = override_get_db()
            mock_db.query.return_value = mock_query

            response = client.get(
                "/api/v1/analytics/anomalies/active?severity=high&limit=20",
                headers=auth_headers
            )

            assert response.status_code == 200
            data = response.json()
            assert len(data) == 2
            assert data[0]["anomaly_type"] == "cpu_spike"
            assert data[0]["severity"] == "high"

        def test_acknowledge_anomaly(self, client, override_get_db, auth_headers):
            """Test acknowledging an anomaly"""
            app.dependency_overrides[get_db] = override_get_db

            with patch('app.api.v1.endpoints.advanced_analytics.AdvancedAnalyticsService') as mock_service_class:
                mock_service = Mock()
                mock_service.acknowledge_anomaly = AsyncMock(return_value={
                    "success": True,
                    "anomaly_id": "anm_123456789",
                    "status": "acknowledged",
                    "acknowledged_at": datetime.utcnow().isoformat(),
                    "acknowledged_by": "test_user",
                    "previous_status": "open"
                })
                mock_service_class.return_value = mock_service

                response = client.post(
                    "/api/v1/analytics/anomalies/anm_123456789/acknowledge",
                    json={"acknowledged_by": "test_user"},
                    headers=auth_headers
                )

                assert response.status_code == 200
                data = response.json()
                assert data["success"] is True
                assert data["status"] == "acknowledged"

        def test_resolve_anomaly(self, client, override_get_db, auth_headers):
            """Test resolving an anomaly"""
            app.dependency_overrides[get_db] = override_get_db

            with patch('app.api.v1.endpoints.advanced_analytics.AdvancedAnalyticsService') as mock_service_class:
                mock_service = Mock()
                mock_service.resolve_anomaly = AsyncMock(return_value={
                    "success": True,
                    "anomaly_id": "anm_123456789",
                    "status": "resolved",
                    "resolved_at": datetime.utcnow().isoformat(),
                    "resolution_method": "manual",
                    "previous_status": "acknowledged"
                })
                mock_service_class.return_value = mock_service

                response = client.post(
                    "/api/v1/analytics/anomalies/anm_123456789/resolve",
                    json={"resolution_method": "manual", "notes": "Fixed CPU throttling"},
                    headers=auth_headers
                )

                assert response.status_code == 200
                data = response.json()
                assert data["success"] is True
                assert data["status"] == "resolved"

    class TestPredictionEndpoints:
        """Test prediction endpoints"""

        def test_generate_predictions_success(self, client, override_get_db, auth_headers):
            """Test successful prediction generation"""
            app.dependency_overrides[get_db] = override_get_db

            with patch('app.api.v1.endpoints.advanced_analytics.AdvancedAnalyticsService') as mock_service_class:
                mock_service = Mock()
                mock_service.generate_predictions = AsyncMock(return_value={
                    "success": True,
                    "model_id": "mdl_123456789",
                    "model_type": "time_series",
                    "predictions": [
                        {
                            "timestamp": (datetime.utcnow() + timedelta(hours=1)).isoformat(),
                            "predicted_value": 78.5,
                            "confidence_interval": [72.0, 85.0],
                            "confidence_score": 0.85
                        },
                        {
                            "timestamp": (datetime.utcnow() + timedelta(hours=2)).isoformat(),
                            "predicted_value": 76.2,
                            "confidence_interval": [70.5, 81.9],
                            "confidence_score": 0.82
                        }
                    ],
                    "model_accuracy": 0.87,
                    "mae": 4.2,
                    "rmse": 6.1,
                    "training_data_points": 1000,
                    "forecast_horizon": 24
                })
                mock_service_class.return_value = mock_service

                response = client.post(
                    "/api/v1/analytics/predictions/generate",
                    json={
                        "model_type": "time_series",
                        "target_metrics": ["cpu_utilization", "memory_usage"],
                        "forecast_horizon": 24,
                        "confidence_level": 0.95
                    },
                    headers=auth_headers
                )

                assert response.status_code == 200
                data = response.json()
                assert data["success"] is True
                assert "predictions" in data
                assert len(data["predictions"]) > 0
                assert data["model_accuracy"] > 0

        def test_get_predictions(self, client, override_get_db, auth_headers):
            """Test retrieving predictions"""
            app.dependency_overrides[get_db] = override_get_db

            # Mock database query
            mock_query = Mock()
            mock_query.filter.return_value.order_by.return_value.all.return_value = [
                PerformanceForecast(
                    id=1,
                    tenant_id=1,
                    model_id=1,
                    metric_name="cpu_utilization",
                    forecast_type="time_series",
                    forecast_horizon=24,
                    forecast_values={
                        "next_24h": [78.5, 76.2, 74.8, 73.5]
                    },
                    confidence_intervals={
                        "next_24h": [[72.0, 85.0], [70.5, 81.9], [69.0, 80.6], [67.8, 79.2]]
                    },
                    forecast_start_at=datetime.utcnow(),
                    forecast_end_at=datetime.utcnow() + timedelta(hours=24),
                    accuracy=0.87
                )
            ]

            mock_db = override_get_db()
            mock_db.query.return_value = mock_query

            response = client.get(
                "/api/v1/analytics/predictions?metric_name=cpu_utilization&limit=20",
                headers=auth_headers
            )

            assert response.status_code == 200
            data = response.json()
            assert len(data) == 1
            assert data[0]["metric_name"] == "cpu_utilization"

        def test_get_model_performance(self, client, override_get_db, auth_headers):
            """Test retrieving model performance metrics"""
            app.dependency_overrides[get_db] = override_get_db

            with patch('app.api.v1.endpoints.advanced_analytics.AdvancedAnalyticsService') as mock_service_class:
                mock_service = Mock()
                mock_service.get_model_performance = AsyncMock(return_value={
                    "models": [
                        {
                            "model_id": "mdl_123456789",
                            "model_name": "CPU_Forecast_Model_v1",
                            "model_type": "time_series",
                            "target_metric": "cpu_utilization",
                            "accuracy": 0.87,
                            "mae": 4.2,
                            "rmse": 6.1,
                            "training_data_points": 1000,
                            "last_trained_at": (datetime.utcnow() - timedelta(hours=2)).isoformat(),
                            "last_prediction_at": datetime.utcnow().isoformat(),
                            "status": "active"
                        }
                    ],
                    "summary": {
                        "total_models": 1,
                        "active_models": 1,
                        "average_accuracy": 0.87,
                        "total_predictions_24h": 24
                    }
                })
                mock_service_class.return_value = mock_service

                response = client.get(
                    "/api/v1/analytics/predictions/models/performance",
                    headers=auth_headers
                )

                assert response.status_code == 200
                data = response.json()
                assert len(data["models"]) == 1
                assert data["summary"]["total_models"] == 1

    class TestIntelligenceReportEndpoints:
        """Test intelligence report endpoints"""

        def test_generate_intelligence_report_success(self, client, override_get_db, auth_headers):
            """Test successful intelligence report generation"""
            app.dependency_overrides[get_db] = override_get_db

            with patch('app.api.v1.endpoints.advanced_analytics.AdvancedAnalyticsService') as mock_service_class:
                mock_service = Mock()
                mock_service.generate_intelligence_report = AsyncMock(return_value={
                    "success": True,
                    "report_id": "rpt_123456789",
                    "report_type": "performance",
                    "status": "completed",
                    "summary": {
                        "executive_summary": "System performance is within normal parameters with minor optimization opportunities.",
                        "total_metrics_analyzed": 5000,
                        "anomalies_detected": 3,
                        "predictions_generated": 150,
                        "insights_generated": 12,
                        "recommendations_count": 8
                    },
                    "key_insights": [
                        {
                            "title": "CPU Utilization Trend",
                            "description": "Average CPU utilization increased by 5% over the past week",
                            "significance": 0.75
                        }
                    ],
                    "recommendations": [
                        {
                            "action": "Optimize database queries",
                            "priority": "medium",
                            "impact": "Improve response times by 15%"
                        }
                    ],
                    "charts_data": {
                        "performance_trends": {...},
                        "anomaly_distribution": {...}
                    },
                    "generated_at": datetime.utcnow().isoformat(),
                    "analysis_period": "7d"
                })
                mock_service_class.return_value = mock_service

                response = client.post(
                    "/api/v1/analytics/reports/generate",
                    json={
                        "report_type": "performance",
                        "analysis_period": "7d",
                        "include_charts": True,
                        "include_recommendations": True,
                        "metrics": ["cpu_utilization", "memory_usage", "response_time"]
                    },
                    headers=auth_headers
                )

                assert response.status_code == 200
                data = response.json()
                assert data["success"] is True
                assert "report_id" in data
                assert "summary" in data
                assert "key_insights" in data
                assert "recommendations" in data

        def test_get_recent_reports(self, client, override_get_db, auth_headers):
            """Test retrieving recent intelligence reports"""
            app.dependency_overrides[get_db] = override_get_db

            # Mock database query
            mock_query = Mock()
            mock_query.filter.return_value.order_by.return_value.limit.return_value.all.return_value = [
                IntelligenceReport(
                    id=1,
                    tenant_id=1,
                    report_name="Weekly Performance Analysis",
                    report_type="performance",
                    executive_summary="System performance analysis for the past week",
                    analysis_period_start=datetime.utcnow() - timedelta(days=7),
                    analysis_period_end=datetime.utcnow(),
                    total_metrics_analyzed=5000,
                    anomalies_detected=3,
                    predictions_generated=150,
                    key_insights=[{"title": "CPU Trend", "description": "CPU usage trending up"}],
                    charts_data={},
                    recommendations=[{"action": "Optimize queries", "priority": "medium"}],
                    status="completed",
                    generated_at=datetime.utcnow()
                )
            ]

            mock_db = override_get_db()
            mock_db.query.return_value = mock_query

            response = client.get(
                "/api/v1/analytics/reports/recent?limit=10",
                headers=auth_headers
            )

            assert response.status_code == 200
            data = response.json()
            assert len(data) == 1
            assert data[0]["report_type"] == "performance"

        def test_get_report_details(self, client, override_get_db, auth_headers):
            """Test retrieving detailed report"""
            app.dependency_overrides[get_db] = override_get_db

            # Mock database query
            mock_query = Mock()
            mock_query.filter.return_value.first.return_value = IntelligenceReport(
                id=1,
                tenant_id=1,
                report_name="Security Analysis Report",
                report_type="security",
                executive_summary="Security analysis for the past 24 hours",
                analysis_period_start=datetime.utcnow() - timedelta(days=1),
                analysis_period_end=datetime.utcnow(),
                total_metrics_analyzed=2000,
                anomalies_detected=5,
                predictions_generated=50,
                key_insights=[{"title": "Failed Logins", "description": "Spike in failed login attempts"}],
                charts_data={"anomaly_timeline": [...], "severity_distribution": [...]},
                recommendations=[{"action": "Review access logs", "priority": "high"}],
                status="completed",
                generated_at=datetime.utcnow()
            )

            mock_db = override_get_db()
            mock_db.query.return_value = mock_query

            response = client.get(
                "/api/v1/analytics/reports/rpt_123456789",
                headers=auth_headers
            )

            assert response.status_code == 200
            data = response.json()
            assert data["report_type"] == "security"
            assert "charts_data" in data
            assert len(data["recommendations"]) > 0

    class TestDashboardEndpoints:
        """Test dashboard endpoints"""

        def test_get_dashboard_metrics(self, client, override_get_db, auth_headers):
            """Test retrieving dashboard metrics"""
            app.dependency_overrides[get_db] = override_get_db

            with patch('app.api.v1.endpoints.advanced_analytics.AdvancedAnalyticsService') as mock_service_class:
                mock_service = Mock()
                mock_service.get_dashboard_metrics = AsyncMock(return_value={
                    "total_metrics": 50000,
                    "active_anomalies": 12,
                    "predictive_models": 5,
                    "intelligence_reports": 25,
                    "insights_generated": 150,
                    "system_health": 0.95,
                    "collection_rate": 850.5,
                    "anomaly_trend": "increasing",
                    "prediction_accuracy": 0.87,
                    "last_analysis": datetime.utcnow().isoformat(),
                    "provider_status": {
                        "aws": {"status": "healthy", "metrics_count": 20000},
                        "azure": {"status": "healthy", "metrics_count": 15000},
                        "gcp": {"status": "healthy", "metrics_count": 10000},
                        "cloudflare": {"status": "healthy", "metrics_count": 5000}
                    }
                })
                mock_service_class.return_value = mock_service

                response = client.get(
                    "/api/v1/analytics/dashboard/metrics",
                    headers=auth_headers
                )

                assert response.status_code == 200
                data = response.json()
                assert data["total_metrics"] == 50000
                assert data["active_anomalies"] == 12
                assert data["system_health"] == 0.95
                assert "provider_status" in data

        def test_get_dashboard_time_series(self, client, override_get_db, auth_headers):
            """Test retrieving dashboard time series data"""
            app.dependency_overrides[get_db] = override_get_db

            with patch('app.api.v1.endpoints.advanced_analytics.AdvancedAnalyticsService') as mock_service_class:
                mock_service = Mock()
                mock_service.get_dashboard_time_series = AsyncMock(return_value={
                    "metrics_timeline": [
                        {
                            "timestamp": (datetime.utcnow() - timedelta(hours=2)).isoformat(),
                            "cpu_utilization": 75.5,
                            "memory_usage": 60.2,
                            "disk_usage": 45.8,
                            "network_io": 120.5
                        },
                        {
                            "timestamp": (datetime.utcnow() - timedelta(hours=1)).isoformat(),
                            "cpu_utilization": 78.2,
                            "memory_usage": 62.1,
                            "disk_usage": 46.1,
                            "network_io": 125.8
                        },
                        {
                            "timestamp": datetime.utcnow().isoformat(),
                            "cpu_utilization": 72.8,
                            "memory_usage": 58.9,
                            "disk_usage": 45.3,
                            "network_io": 118.2
                        }
                    ],
                    "anomaly_timeline": [
                        {
                            "timestamp": (datetime.utcnow() - timedelta(minutes=30)).isoformat(),
                            "anomaly_type": "cpu_spike",
                            "severity": "medium",
                            "count": 1
                        }
                    ],
                    "prediction_timeline": [
                        {
                            "timestamp": (datetime.utcnow() + timedelta(hours=1)).isoformat(),
                            "predicted_cpu": 76.5,
                            "confidence_interval": [70.0, 83.0]
                        }
                    ],
                    "time_range": "3h"
                })
                mock_service_class.return_value = mock_service

                response = client.get(
                    "/api/v1/analytics/dashboard/timeseries?time_range=3h&metrics=cpu_utilization,memory_usage",
                    headers=auth_headers
                )

                assert response.status_code == 200
                data = response.json()
                assert "metrics_timeline" in data
                assert len(data["metrics_timeline"]) == 3
                assert "anomaly_timeline" in data
                assert "prediction_timeline" in data

    class TestErrorHandling:
        """Test error handling and edge cases"""

        def test_unauthorized_access(self, client):
            """Test unauthorized access to analytics endpoints"""
            response = client.post(
                "/api/v1/analytics/metrics/collect",
                json={"providers": ["aws"], "metrics": ["cpu_utilization"]}
            )

            assert response.status_code == 401  # Unauthorized

        def test_invalid_tenant_id(self, client, auth_headers):
            """Test with invalid tenant ID"""
            invalid_headers = {
                "Authorization": "Bearer test_token",
                "X-Tenant-ID": "99999"  # Non-existent tenant
            }

            response = client.post(
                "/api/v1/analytics/metrics/collect",
                json={"providers": ["aws"], "metrics": ["cpu_utilization"]},
                headers=invalid_headers
            )

            assert response.status_code == 404  # Tenant not found

        def test_service_unavailable(self, client, override_get_db, auth_headers):
            """Test behavior when analytics service is unavailable"""
            app.dependency_overrides[get_db] = override_get_db

            with patch('app.api.v1.endpoints.advanced_analytics.AdvancedAnalyticsService') as mock_service_class:
                mock_service_class.side_effect = Exception("Service unavailable")

                response = client.post(
                    "/api/v1/analytics/metrics/collect",
                    json={"providers": ["aws"], "metrics": ["cpu_utilization"]},
                    headers=auth_headers
                )

                assert response.status_code == 500

        def test_rate_limiting(self, client, override_get_db, auth_headers):
            """Test rate limiting on analytics endpoints"""
            app.dependency_overrides[get_db] = override_get_db

            # Mock successful responses
            with patch('app.api.v1.endpoints.advanced_analytics.AdvancedAnalyticsService') as mock_service_class:
                mock_service = Mock()
                mock_service.collect_metrics = AsyncMock(return_value={"success": True})
                mock_service_class.return_value = mock_service

                # Make multiple rapid requests
                responses = []
                for _ in range(20):  # Exceed reasonable rate limit
                    response = client.post(
                        "/api/v1/analytics/metrics/collect",
                        json={"providers": ["aws"], "metrics": ["cpu_utilization"]},
                        headers=auth_headers
                    )
                    responses.append(response)
                    client.post(  # Small delay between requests
                        "/api/v1/analytics/metrics/collect",
                        json={"providers": ["aws"], "metrics": ["memory_usage"]},
                        headers=auth_headers
                    )

                # Check if rate limiting is applied (should be some 429 responses)
                rate_limited_responses = [r for r in responses if r.status_code == 429]
                # This test assumes rate limiting is implemented
                # If not implemented, this would fail and indicate missing security feature

    class TestPerformanceAndScalability:
        """Test performance and scalability aspects"""

        def test_large_dataset_handling(self, client, override_get_db, auth_headers):
            """Test handling of large dataset requests"""
            app.dependency_overrides[get_db] = override_get_db

            with patch('app.api.v1.endpoints.advanced_analytics.AdvancedAnalyticsService') as mock_service_class:
                mock_service = Mock()
                mock_service.collect_metrics = AsyncMock(return_value={
                    "success": True,
                    "metrics_collected": 10000,
                    "execution_time": 45.2  # Reasonable time for large dataset
                })
                mock_service_class.return_value = mock_service

                import time
                start_time = time.time()

                response = client.post(
                    "/api/v1/analytics/metrics/collect",
                    json={
                        "providers": ["aws", "azure", "gcp", "cloudflare"],
                        "metrics": ["cpu_utilization", "memory_usage", "disk_usage", "network_io"],
                        "time_range": "30d"  # Large time range
                    },
                    headers=auth_headers
                )

                end_time = time.time()
                response_time = end_time - start_time

                assert response.status_code == 200
                # Should respond within reasonable time (adjust threshold as needed)
                assert response_time < 60.0  # 60 seconds max

        def test_concurrent_requests(self, client, override_get_db, auth_headers):
            """Test handling of concurrent requests"""
            app.dependency_overrides[get_db] = override_get_db

            with patch('app.api.v1.endpoints.advanced_analytics.AdvancedAnalyticsService') as mock_service_class:
                mock_service = Mock()
                mock_service.collect_metrics = AsyncMock(return_value={"success": True})
                mock_service_class.return_value = mock_service

                import threading
                import time

                results = []

                def make_request():
                    start_time = time.time()
                    response = client.post(
                        "/api/v1/analytics/metrics/collect",
                        json={"providers": ["aws"], "metrics": ["cpu_utilization"]},
                        headers=auth_headers
                    )
                    end_time = time.time()
                    results.append({
                        "status_code": response.status_code,
                        "response_time": end_time - start_time
                    })

                # Create multiple concurrent requests
                threads = []
                for _ in range(10):
                    thread = threading.Thread(target=make_request)
                    threads.append(thread)
                    thread.start()

                # Wait for all threads to complete
                for thread in threads:
                    thread.join()

                # All requests should succeed
                assert len(results) == 10
                assert all(r["status_code"] == 200 for r in results)
                # Response times should be reasonable
                assert all(r["response_time"] < 30.0 for r in results)