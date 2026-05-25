"""
Functional tests for the analytics API endpoints.
"""

import pytest
import json
from datetime import datetime
from uuid import uuid4
from unittest.mock import AsyncMock, patch, Mock

from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession

from udp.api.main import app
from udp.analytics.engine import AnalyticsMetric, MetricType, TimeInterval
from udp.domain.models import SecurityLevel


class TestAnalyticsAPI:
    """Functional tests for analytics API endpoints."""
    
    @pytest.fixture
    def client(self):
        """Create test client."""
        return TestClient(app)
    
    @pytest.fixture
    def sample_organization_id(self):
        """Sample organization ID for testing."""
        return str(uuid4())
    
    @pytest.fixture
    def mock_security_metrics(self):
        """Mock security metrics response."""
        return {
            "critical_vulnerabilities": AnalyticsMetric(
                name="Critical Vulnerabilities",
                value=12.0,
                metric_type=MetricType.COUNT,
                timestamp=datetime.utcnow(),
                metadata={
                    "severity_distribution": {
                        "CRITICAL": 12,
                        "HIGH": 25,
                        "MEDIUM": 48,
                        "LOW": 73
                    }
                }
            ),
            "average_cvss_score": AnalyticsMetric(
                name="Average CVSS Score",
                value=6.8,
                metric_type=MetricType.SCORE,
                timestamp=datetime.utcnow(),
                metadata={"max_score": 10.0}
            ),
            "exploitable_packages": AnalyticsMetric(
                name="Exploitable Packages",
                value=8.0,
                metric_type=MetricType.COUNT,
                timestamp=datetime.utcnow(),
                metadata={}
            )
        }
    
    @pytest.fixture
    def mock_executive_dashboard(self, sample_organization_id):
        """Mock executive dashboard response."""
        return {
            "organization_id": sample_organization_id,
            "generated_at": datetime.utcnow().isoformat(),
            "time_range": "1M",
            "overall_risk_score": 7.2,
            "security_summary": {
                "critical_vulnerabilities": 12,
                "average_cvss_score": 6.8,
                "exploitable_packages": 8
            },
            "compliance_summary": {
                "copyleft_percentage": 18.5,
                "enterprise_friendly_percentage": 81.5
            },
            "operational_summary": {
                "workflow_completion_rate": 87.3,
                "average_processing_time": 34.2,
                "pending_approvals": 5
            },
            "ecosystem_summary": {
                "distribution": {"npm": 65, "pypi": 35},
                "percentages": {"npm": 65.0, "pypi": 35.0}
            },
            "recommendations": [
                {
                    "type": "security",
                    "priority": "high",
                    "title": "Address Critical Vulnerabilities",
                    "description": "12 critical vulnerabilities require immediate attention"
                }
            ],
            "widgets": []
        }

    def test_get_executive_dashboard_success(
        self, 
        client, 
        sample_organization_id, 
        mock_executive_dashboard
    ):
        """Test successful executive dashboard retrieval."""
        with patch('udp.api.routes.analytics.analytics_engine') as mock_engine:
            mock_engine.generate_executive_dashboard.return_value = mock_executive_dashboard
            
            response = client.get(
                f"/api/v1/analytics/dashboard/{sample_organization_id}",
                params={"time_range": "1M"}
            )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert data["organization_id"] == sample_organization_id
        assert data["time_range"] == "1M"
        assert data["overall_risk_score"] == 7.2
        assert "security_summary" in data
        assert "compliance_summary" in data
        assert "operational_summary" in data
        assert "recommendations" in data

    def test_get_executive_dashboard_different_time_ranges(
        self, 
        client, 
        sample_organization_id,
        mock_executive_dashboard
    ):
        """Test executive dashboard with different time ranges."""
        time_ranges = ["1d", "1w", "1M", "3M", "1Y"]
        
        for time_range in time_ranges:
            mock_dashboard = mock_executive_dashboard.copy()
            mock_dashboard["time_range"] = time_range
            
            with patch('udp.api.routes.analytics.analytics_engine') as mock_engine:
                mock_engine.generate_executive_dashboard.return_value = mock_dashboard
                
                response = client.get(
                    f"/api/v1/analytics/dashboard/{sample_organization_id}",
                    params={"time_range": time_range}
                )
            
            assert response.status_code == 200
            data = response.json()
            assert data["time_range"] == time_range

    def test_get_executive_dashboard_invalid_organization(self, client):
        """Test executive dashboard with invalid organization ID."""
        with patch('udp.api.routes.analytics.analytics_engine') as mock_engine:
            mock_engine.generate_executive_dashboard.side_effect = Exception("Organization not found")
            
            response = client.get(
                f"/api/v1/analytics/dashboard/{uuid4()}",
                params={"time_range": "1M"}
            )
        
        assert response.status_code == 500
        data = response.json()
        assert "Failed to generate dashboard" in data["detail"]

    def test_get_security_metrics_success(
        self, 
        client, 
        sample_organization_id, 
        mock_security_metrics
    ):
        """Test successful security metrics retrieval."""
        with patch('udp.api.routes.analytics.analytics_engine') as mock_engine:
            mock_engine.get_security_metrics.return_value = mock_security_metrics
            
            response = client.get(
                f"/api/v1/analytics/metrics/security/{sample_organization_id}",
                params={"time_range": "1w"}
            )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert data["organization_id"] == sample_organization_id
        assert data["time_range"] == "1w"
        assert "metrics" in data
        assert "generated_at" in data
        
        # Verify metrics structure
        metrics = data["metrics"]
        assert "critical_vulnerabilities" in metrics
        assert "average_cvss_score" in metrics
        assert "exploitable_packages" in metrics
        
        # Verify metric format
        critical_metric = metrics["critical_vulnerabilities"]
        assert critical_metric["name"] == "Critical Vulnerabilities"
        assert critical_metric["value"] == 12.0
        assert critical_metric["type"] == "count"
        assert "timestamp" in critical_metric
        assert "metadata" in critical_metric

    def test_get_compliance_metrics_success(self, client, sample_organization_id):
        """Test successful compliance metrics retrieval."""
        mock_license_metrics = {
            "license_distribution": AnalyticsMetric(
                name="License Distribution",
                value=200.0,
                metric_type=MetricType.DISTRIBUTION,
                timestamp=datetime.utcnow(),
                metadata={
                    "distribution": {"MIT": 80, "Apache-2.0": 60, "GPL-3.0": 40, "BSD": 20},
                    "percentages": {"MIT": 40.0, "Apache-2.0": 30.0, "GPL-3.0": 20.0, "BSD": 10.0}
                }
            ),
            "copyleft_percentage": AnalyticsMetric(
                name="Copyleft Percentage",
                value=20.0,
                metric_type=MetricType.PERCENTAGE,
                timestamp=datetime.utcnow(),
                metadata={}
            ),
            "enterprise_friendly_percentage": AnalyticsMetric(
                name="Enterprise Friendly Percentage",
                value=80.0,
                metric_type=MetricType.PERCENTAGE,
                timestamp=datetime.utcnow(),
                metadata={}
            )
        }
        
        with patch('udp.api.routes.analytics.analytics_engine') as mock_engine:
            mock_engine.get_license_compliance_metrics.return_value = mock_license_metrics
            
            response = client.get(
                f"/api/v1/analytics/metrics/compliance/{sample_organization_id}",
                params={"time_range": "3M"}
            )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["organization_id"] == sample_organization_id
        assert data["time_range"] == "3M"
        
        metrics = data["metrics"]
        assert "license_distribution" in metrics
        assert "copyleft_percentage" in metrics
        assert "enterprise_friendly_percentage" in metrics
        
        # Verify distribution metadata
        license_dist = metrics["license_distribution"]
        assert license_dist["type"] == "distribution"
        assert "distribution" in license_dist["metadata"]
        assert "percentages" in license_dist["metadata"]

    def test_get_workflow_metrics_success(self, client, sample_organization_id):
        """Test successful workflow metrics retrieval."""
        mock_workflow_metrics = {
            "workflow_completion_rate": AnalyticsMetric(
                name="Workflow Completion Rate",
                value=91.5,
                metric_type=MetricType.PERCENTAGE,
                timestamp=datetime.utcnow(),
                metadata={"total_workflows": 200, "completed_workflows": 183}
            ),
            "average_processing_time": AnalyticsMetric(
                name="Average Processing Time",
                value=28.7,
                metric_type=MetricType.RATIO,
                timestamp=datetime.utcnow(),
                metadata={"seconds": 1722.0, "time_range": "1M"}
            ),
            "pending_approvals": AnalyticsMetric(
                name="Pending Approvals",
                value=12.0,
                metric_type=MetricType.COUNT,
                timestamp=datetime.utcnow(),
                metadata={}
            )
        }
        
        with patch('udp.api.routes.analytics.analytics_engine') as mock_engine:
            mock_engine.get_workflow_performance_metrics.return_value = mock_workflow_metrics
            
            response = client.get(
                f"/api/v1/analytics/metrics/workflows/{sample_organization_id}",
                params={"time_range": "1M"}
            )
        
        assert response.status_code == 200
        data = response.json()
        
        metrics = data["metrics"]
        assert "workflow_completion_rate" in metrics
        assert "average_processing_time" in metrics
        assert "pending_approvals" in metrics
        
        # Verify completion rate
        completion_rate = metrics["workflow_completion_rate"]
        assert completion_rate["value"] == 91.5
        assert completion_rate["type"] == "percentage"

    def test_get_ecosystem_insights_success(self, client, sample_organization_id):
        """Test successful ecosystem insights retrieval."""
        mock_ecosystem_metrics = {
            "ecosystem_distribution": AnalyticsMetric(
                name="Ecosystem Distribution",
                value=150.0,
                metric_type=MetricType.DISTRIBUTION,
                timestamp=datetime.utcnow(),
                metadata={
                    "distribution": {"npm": 90, "pypi": 45, "maven": 15},
                    "percentages": {"npm": 60.0, "pypi": 30.0, "maven": 10.0}
                }
            ),
            "dominant_ecosystem": AnalyticsMetric(
                name="Dominant Ecosystem",
                value=60.0,
                metric_type=MetricType.PERCENTAGE,
                timestamp=datetime.utcnow(),
                metadata={"ecosystem": "npm", "package_count": 90}
            )
        }
        
        with patch('udp.api.routes.analytics.analytics_engine') as mock_engine:
            mock_engine.get_ecosystem_insights.return_value = mock_ecosystem_metrics
            
            response = client.get(
                f"/api/v1/analytics/metrics/ecosystems/{sample_organization_id}",
                params={"time_range": "1Y"}
            )
        
        assert response.status_code == 200
        data = response.json()
        
        metrics = data["metrics"]
        assert "ecosystem_distribution" in metrics
        
        # Verify ecosystem distribution
        eco_dist = metrics["ecosystem_distribution"]
        assert eco_dist["type"] == "distribution"
        distribution = eco_dist["metadata"]["distribution"]
        assert "npm" in distribution
        assert "pypi" in distribution
        assert "maven" in distribution

    def test_generate_compliance_report_success(self, client, sample_organization_id):
        """Test successful compliance report generation."""
        mock_compliance_report = {
            "report_id": "compliance_test_20240615_143000",
            "organization_id": sample_organization_id,
            "generated_at": datetime.utcnow().isoformat(),
            "time_range": "1M",
            "framework": "SOX",
            "format": "json",
            "executive_summary": {
                "total_packages_analyzed": 250,
                "enterprise_friendly_percentage": 78.4,
                "copyleft_license_percentage": 21.6,
                "critical_vulnerabilities": 8,
                "average_cvss_score": 6.2
            },
            "license_analysis": {
                "distribution": {"MIT": 95, "Apache-2.0": 70, "GPL-3.0": 54, "BSD": 31},
                "enterprise_compliance": True,
                "copyleft_risk": False
            },
            "security_analysis": {
                "vulnerability_summary": {
                    "CRITICAL": 8,
                    "HIGH": 23,
                    "MEDIUM": 45,
                    "LOW": 89
                },
                "risk_assessment": "MEDIUM",
                "exploitable_packages": 6
            },
            "recommendations": [
                {
                    "category": "License Compliance",
                    "priority": "Medium",
                    "description": "Review copyleft license usage and ensure compatibility with business model"
                }
            ]
        }
        
        with patch('udp.api.routes.analytics.analytics_engine') as mock_engine:
            mock_engine.get_license_compliance_metrics.return_value = {}
            mock_engine.get_security_metrics.return_value = {}
            
            response = client.get(
                f"/api/v1/analytics/reports/compliance/{sample_organization_id}",
                params={
                    "framework": "SOX",
                    "time_range": "1M",
                    "format": "json"
                }
            )
        
        # Note: This would normally call the report generator
        # For functional testing, we're testing the API structure
        assert response.status_code == 200

    def test_get_security_trends_success(self, client, sample_organization_id):
        """Test successful security trends retrieval."""
        response = client.get(
            f"/api/v1/analytics/trends/{sample_organization_id}",
            params={
                "metric": "vulnerabilities",
                "interval": "1w",
                "periods": 8
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify trend response structure
        assert data["organization_id"] == sample_organization_id
        assert data["metric"] == "vulnerabilities"
        assert data["interval"] == "1w"
        assert data["periods_analyzed"] == 8
        assert "trend_direction" in data
        assert "data_points" in data
        assert "generated_at" in data

    def test_get_security_trends_different_metrics(self, client, sample_organization_id):
        """Test security trends with different metrics."""
        metrics = ["vulnerabilities", "licenses", "workflows"]
        
        for metric in metrics:
            response = client.get(
                f"/api/v1/analytics/trends/{sample_organization_id}",
                params={
                    "metric": metric,
                    "interval": "1d",
                    "periods": 5
                }
            )
            
            assert response.status_code == 200
            data = response.json()
            assert data["metric"] == metric

    def test_analytics_api_error_handling(self, client):
        """Test error handling in analytics API."""
        # Test with invalid organization ID format
        response = client.get("/api/v1/analytics/dashboard/invalid-uuid")
        assert response.status_code == 422  # Validation error
        
        # Test with analytics engine error
        with patch('udp.api.routes.analytics.analytics_engine') as mock_engine:
            mock_engine.generate_executive_dashboard.side_effect = Exception("Internal error")
            
            response = client.get(f"/api/v1/analytics/dashboard/{uuid4()}")
            assert response.status_code == 500

    def test_analytics_api_parameter_validation(self, client, sample_organization_id):
        """Test parameter validation in analytics API."""
        # Test invalid time range
        response = client.get(
            f"/api/v1/analytics/dashboard/{sample_organization_id}",
            params={"time_range": "invalid"}
        )
        assert response.status_code == 422
        
        # Test valid time ranges
        valid_ranges = ["1h", "1d", "1w", "1M", "3M", "1Y"]
        for time_range in valid_ranges:
            with patch('udp.api.routes.analytics.analytics_engine') as mock_engine:
                mock_engine.generate_executive_dashboard.return_value = {
                    "organization_id": sample_organization_id,
                    "time_range": time_range,
                    "overall_risk_score": 5.0
                }
                
                response = client.get(
                    f"/api/v1/analytics/dashboard/{sample_organization_id}",
                    params={"time_range": time_range}
                )
                assert response.status_code == 200

    def test_analytics_concurrent_requests(self, client, sample_organization_id):
        """Test handling of concurrent analytics requests."""
        import threading
        import time
        
        results = []
        errors = []
        
        def make_request():
            try:
                with patch('udp.api.routes.analytics.analytics_engine') as mock_engine:
                    # Add small delay to simulate processing
                    def slow_dashboard(*args, **kwargs):
                        time.sleep(0.1)
                        return {
                            "organization_id": sample_organization_id,
                            "overall_risk_score": 5.0,
                            "generated_at": datetime.utcnow().isoformat()
                        }
                    
                    mock_engine.generate_executive_dashboard = slow_dashboard
                    
                    response = client.get(f"/api/v1/analytics/dashboard/{sample_organization_id}")
                    results.append(response.status_code)
            except Exception as e:
                errors.append(str(e))
        
        # Create multiple concurrent requests
        threads = []
        for _ in range(5):
            thread = threading.Thread(target=make_request)
            threads.append(thread)
            thread.start()
        
        # Wait for all threads to complete
        for thread in threads:
            thread.join()
        
        # All requests should succeed
        assert len(errors) == 0
        assert all(status == 200 for status in results)

    def test_analytics_caching_behavior(self, client, sample_organization_id):
        """Test caching behavior in analytics API."""
        mock_dashboard = {
            "organization_id": sample_organization_id,
            "overall_risk_score": 6.5,
            "generated_at": datetime.utcnow().isoformat()
        }
        
        with patch('udp.api.routes.analytics.analytics_engine') as mock_engine:
            mock_engine.generate_executive_dashboard.return_value = mock_dashboard
            
            # Make first request
            response1 = client.get(f"/api/v1/analytics/dashboard/{sample_organization_id}")
            assert response1.status_code == 200
            
            # Make second request immediately
            response2 = client.get(f"/api/v1/analytics/dashboard/{sample_organization_id}")
            assert response2.status_code == 200
            
            # Both requests should succeed
            assert response1.json() == response2.json()

    def test_analytics_response_format_consistency(self, client, sample_organization_id):
        """Test response format consistency across analytics endpoints."""
        endpoints_and_patches = [
            (f"/api/v1/analytics/metrics/security/{sample_organization_id}", "get_security_metrics"),
            (f"/api/v1/analytics/metrics/compliance/{sample_organization_id}", "get_license_compliance_metrics"),
            (f"/api/v1/analytics/metrics/workflows/{sample_organization_id}", "get_workflow_performance_metrics"),
            (f"/api/v1/analytics/metrics/ecosystems/{sample_organization_id}", "get_ecosystem_insights")
        ]
        
        for endpoint, method_name in endpoints_and_patches:
            with patch('udp.api.routes.analytics.analytics_engine') as mock_engine:
                # Mock the specific method
                mock_method = getattr(mock_engine, method_name)
                mock_method.return_value = {
                    "test_metric": AnalyticsMetric(
                        name="Test Metric",
                        value=100.0,
                        metric_type=MetricType.COUNT,
                        timestamp=datetime.utcnow(),
                        metadata={}
                    )
                }
                
                response = client.get(endpoint)
                assert response.status_code == 200
                
                data = response.json()
                # All metric endpoints should have consistent structure
                assert "organization_id" in data
                assert "time_range" in data
                assert "metrics" in data
                assert "generated_at" in data


class TestAnalyticsAPIIntegration:
    """Integration tests for analytics API with database."""
    
    @pytest.fixture
    def client_with_db(self):
        """Create test client with database dependency override."""
        from udp.core.database import get_async_session
        
        async def mock_get_session():
            # Return a mock session for integration tests
            mock_session = AsyncMock(spec=AsyncSession)
            yield mock_session
        
        app.dependency_overrides[get_async_session] = mock_get_session
        client = TestClient(app)
        
        yield client
        
        # Clean up override
        app.dependency_overrides.clear()

    def test_dashboard_with_database_integration(self, client_with_db):
        """Test dashboard generation with database integration."""
        org_id = str(uuid4())
        
        with patch('udp.api.routes.analytics.analytics_engine') as mock_engine:
            mock_engine.generate_executive_dashboard.return_value = {
                "organization_id": org_id,
                "overall_risk_score": 7.5,
                "generated_at": datetime.utcnow().isoformat()
            }
            
            response = client_with_db.get(f"/api/v1/analytics/dashboard/{org_id}")
            
            assert response.status_code == 200
            data = response.json()
            assert data["organization_id"] == org_id


if __name__ == "__main__":
    pytest.main([__file__])