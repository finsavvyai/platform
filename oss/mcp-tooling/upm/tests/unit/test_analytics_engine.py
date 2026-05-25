"""
Comprehensive unit tests for the analytics engine.
"""

import pytest
import asyncio
from datetime import datetime, timedelta
from uuid import uuid4
from unittest.mock import Mock, AsyncMock, patch, MagicMock

from udp.analytics.engine import (
    AnalyticsEngine, AnalyticsMetric, MetricType, TimeInterval,
    DashboardWidget, analytics_engine
)
from udp.domain.models import SecurityLevel, EcosystemType, LicenseType
from udp.infrastructure.models import (
    VulnerabilityModel, PackageModel, WorkflowModel, OrganizationModel
)


class TestAnalyticsMetric:
    """Test the AnalyticsMetric data structure."""
    
    def test_analytics_metric_creation(self):
        """Test creating an analytics metric."""
        timestamp = datetime.utcnow()
        metric = AnalyticsMetric(
            name="Test Metric",
            value=100.5,
            metric_type=MetricType.COUNT,
            timestamp=timestamp,
            metadata={"source": "test"},
            trend_direction="up",
            trend_percentage=5.2
        )
        
        assert metric.name == "Test Metric"
        assert metric.value == 100.5
        assert metric.metric_type == MetricType.COUNT
        assert metric.timestamp == timestamp
        assert metric.metadata == {"source": "test"}
        assert metric.trend_direction == "up"
        assert metric.trend_percentage == 5.2
    
    def test_analytics_metric_optional_fields(self):
        """Test analytics metric with optional fields."""
        metric = AnalyticsMetric(
            name="Simple Metric",
            value=50.0,
            metric_type=MetricType.PERCENTAGE,
            timestamp=datetime.utcnow(),
            metadata={}
        )
        
        assert metric.trend_direction is None
        assert metric.trend_percentage is None


class TestDashboardWidget:
    """Test the DashboardWidget configuration."""
    
    def test_dashboard_widget_creation(self):
        """Test creating a dashboard widget."""
        widget = DashboardWidget(
            widget_id="security_chart",
            title="Security Overview",
            widget_type="chart",
            data_source="security_metrics",
            config={"chart_type": "pie"},
            refresh_interval=300,
            position={"x": 0, "y": 0, "width": 6, "height": 4}
        )
        
        assert widget.widget_id == "security_chart"
        assert widget.title == "Security Overview"
        assert widget.widget_type == "chart"
        assert widget.data_source == "security_metrics"
        assert widget.config == {"chart_type": "pie"}
        assert widget.refresh_interval == 300
        assert widget.position == {"x": 0, "y": 0, "width": 6, "height": 4}
    
    def test_dashboard_widget_defaults(self):
        """Test dashboard widget with default values."""
        widget = DashboardWidget(
            widget_id="simple_widget",
            title="Simple Widget",
            widget_type="metric",
            data_source="simple_metrics",
            config={}
        )
        
        assert widget.refresh_interval == 300  # Default value
        assert widget.position is None  # Default value


class TestAnalyticsEngine:
    """Comprehensive tests for the AnalyticsEngine class."""
    
    @pytest.fixture
    def analytics_engine_instance(self):
        """Create a fresh analytics engine instance."""
        engine = AnalyticsEngine()
        engine.metric_cache = {}  # Clear cache
        return engine
    
    @pytest.fixture
    def mock_db_session(self):
        """Create a comprehensive mock database session."""
        session = AsyncMock()
        
        # Mock vulnerability data
        vuln_result = Mock()
        vuln_result.fetchall.return_value = [
            Mock(severity=SecurityLevel.CRITICAL, count=3),
            Mock(severity=SecurityLevel.HIGH, count=7),
            Mock(severity=SecurityLevel.MEDIUM, count=15)
        ]
        
        # Mock CVSS score
        cvss_result = Mock()
        cvss_result.scalar.return_value = 6.8
        
        # Mock counts
        count_result = Mock()
        count_result.scalar.return_value = 25
        
        # Configure session to return appropriate mocks
        session.execute.side_effect = [
            vuln_result,  # Vulnerability counts
            cvss_result,  # Average CVSS
            count_result,  # Exploitable packages
            Mock(fetchall=lambda: [(LicenseType.MIT, 50), (LicenseType.APACHE_2_0, 30)]),  # License distribution
            count_result,  # Copyleft count
            count_result,  # Enterprise friendly count
            count_result,  # Total workflows
            count_result,  # Completed workflows
            Mock(scalar=lambda: 1800.0),  # Average duration
            count_result,  # Pending approvals
            Mock(fetchall=lambda: [(EcosystemType.NPM, 60), (EcosystemType.PYPI, 40)])  # Ecosystem distribution
        ]
        
        return session
    
    @pytest.fixture
    def sample_organization_id(self):
        """Sample organization ID for testing."""
        return uuid4()

    @pytest.mark.asyncio
    async def test_get_security_metrics_success(self, analytics_engine_instance, mock_db_session, sample_organization_id):
        """Test successful security metrics calculation."""
        metrics = await analytics_engine_instance.get_security_metrics(
            db=mock_db_session,
            organization_id=sample_organization_id,
            time_range=TimeInterval.MONTH
        )
        
        # Verify all expected metrics are present
        expected_metrics = [
            "critical_vulnerabilities", 
            "high_vulnerabilities", 
            "average_cvss_score", 
            "exploitable_packages"
        ]
        
        for metric_name in expected_metrics:
            assert metric_name in metrics
            assert isinstance(metrics[metric_name], AnalyticsMetric)
        
        # Verify metric values
        assert metrics["critical_vulnerabilities"].value == 3.0
        assert metrics["critical_vulnerabilities"].metric_type == MetricType.COUNT
        assert metrics["high_vulnerabilities"].value == 7.0
        assert metrics["average_cvss_score"].value == 6.8
        assert metrics["exploitable_packages"].value == 25.0
        
        # Verify metadata
        critical_metadata = metrics["critical_vulnerabilities"].metadata
        assert "time_range" in critical_metadata
        assert critical_metadata["time_range"] == "1M"
        assert "severity_distribution" in critical_metadata

    @pytest.mark.asyncio
    async def test_get_security_metrics_no_organization_filter(self, analytics_engine_instance, mock_db_session):
        """Test security metrics without organization filter."""
        metrics = await analytics_engine_instance.get_security_metrics(
            db=mock_db_session,
            organization_id=None,
            time_range=TimeInterval.WEEK
        )
        
        assert "critical_vulnerabilities" in metrics
        assert metrics["critical_vulnerabilities"].metadata["time_range"] == "1w"

    @pytest.mark.asyncio
    async def test_get_license_compliance_metrics_success(self, analytics_engine_instance, mock_db_session, sample_organization_id):
        """Test successful license compliance metrics calculation."""
        metrics = await analytics_engine_instance.get_license_compliance_metrics(
            db=mock_db_session,
            organization_id=sample_organization_id,
            time_range=TimeInterval.QUARTER
        )
        
        expected_metrics = [
            "license_distribution",
            "copyleft_percentage", 
            "enterprise_friendly_percentage"
        ]
        
        for metric_name in expected_metrics:
            assert metric_name in metrics
            assert isinstance(metrics[metric_name], AnalyticsMetric)
        
        # Verify metric types
        assert metrics["license_distribution"].metric_type == MetricType.DISTRIBUTION
        assert metrics["copyleft_percentage"].metric_type == MetricType.PERCENTAGE
        assert metrics["enterprise_friendly_percentage"].metric_type == MetricType.PERCENTAGE
        
        # Verify metadata structure
        distribution_metadata = metrics["license_distribution"].metadata
        assert "distribution" in distribution_metadata
        assert "percentages" in distribution_metadata

    @pytest.mark.asyncio
    async def test_get_workflow_performance_metrics_success(self, analytics_engine_instance, mock_db_session, sample_organization_id):
        """Test successful workflow performance metrics calculation."""
        metrics = await analytics_engine_instance.get_workflow_performance_metrics(
            db=mock_db_session,
            organization_id=sample_organization_id,
            time_range=TimeInterval.DAY
        )
        
        expected_metrics = [
            "workflow_completion_rate",
            "average_processing_time", 
            "pending_approvals"
        ]
        
        for metric_name in expected_metrics:
            assert metric_name in metrics
            assert isinstance(metrics[metric_name], AnalyticsMetric)
        
        # Verify completion rate calculation
        completion_rate = metrics["workflow_completion_rate"]
        assert completion_rate.metric_type == MetricType.PERCENTAGE
        assert 0 <= completion_rate.value <= 100
        
        # Verify processing time conversion (seconds to minutes)
        processing_time = metrics["average_processing_time"]
        assert processing_time.metric_type == MetricType.RATIO
        assert processing_time.value == 30.0  # 1800 seconds / 60

    @pytest.mark.asyncio
    async def test_get_ecosystem_insights_success(self, analytics_engine_instance, mock_db_session, sample_organization_id):
        """Test successful ecosystem insights calculation."""
        metrics = await analytics_engine_instance.get_ecosystem_insights(
            db=mock_db_session,
            organization_id=sample_organization_id,
            time_range=TimeInterval.YEAR
        )
        
        assert "ecosystem_distribution" in metrics
        
        distribution_metric = metrics["ecosystem_distribution"]
        assert distribution_metric.metric_type == MetricType.DISTRIBUTION
        
        metadata = distribution_metric.metadata
        assert "distribution" in metadata
        assert "percentages" in metadata
        
        # Verify all ecosystem types are represented
        distribution = metadata["distribution"]
        for ecosystem in EcosystemType:
            assert ecosystem.value in distribution

    @pytest.mark.asyncio
    async def test_generate_executive_dashboard_success(self, analytics_engine_instance, mock_db_session, sample_organization_id):
        """Test successful executive dashboard generation."""
        # Mock the individual metric methods
        mock_security_metrics = {
            "critical_vulnerabilities": AnalyticsMetric("Critical", 5.0, MetricType.COUNT, datetime.utcnow(), {}),
            "average_cvss_score": AnalyticsMetric("CVSS", 7.2, MetricType.SCORE, datetime.utcnow(), {}),
            "exploitable_packages": AnalyticsMetric("Exploitable", 2.0, MetricType.COUNT, datetime.utcnow(), {})
        }
        
        mock_license_metrics = {
            "copyleft_percentage": AnalyticsMetric("Copyleft", 15.0, MetricType.PERCENTAGE, datetime.utcnow(), {}),
            "enterprise_friendly_percentage": AnalyticsMetric("Enterprise", 85.0, MetricType.PERCENTAGE, datetime.utcnow(), {})
        }
        
        mock_workflow_metrics = {
            "workflow_completion_rate": AnalyticsMetric("Completion", 92.0, MetricType.PERCENTAGE, datetime.utcnow(), {}),
            "average_processing_time": AnalyticsMetric("Processing", 25.0, MetricType.RATIO, datetime.utcnow(), {}),
            "pending_approvals": AnalyticsMetric("Pending", 3.0, MetricType.COUNT, datetime.utcnow(), {})
        }
        
        mock_ecosystem_metrics = {
            "ecosystem_distribution": AnalyticsMetric("Distribution", 100.0, MetricType.DISTRIBUTION, datetime.utcnow(), {
                "distribution": {"npm": 60, "pypi": 40}
            })
        }
        
        with patch.object(analytics_engine_instance, 'get_security_metrics', return_value=mock_security_metrics), \
             patch.object(analytics_engine_instance, 'get_license_compliance_metrics', return_value=mock_license_metrics), \
             patch.object(analytics_engine_instance, 'get_workflow_performance_metrics', return_value=mock_workflow_metrics), \
             patch.object(analytics_engine_instance, 'get_ecosystem_insights', return_value=mock_ecosystem_metrics), \
             patch.object(analytics_engine_instance, '_calculate_risk_score', return_value=6.8):
            
            dashboard = await analytics_engine_instance.generate_executive_dashboard(
                db=mock_db_session,
                organization_id=sample_organization_id,
                time_range=TimeInterval.QUARTER
            )
        
        # Verify dashboard structure
        required_sections = [
            "organization_id", "generated_at", "time_range", "overall_risk_score",
            "security_summary", "compliance_summary", "operational_summary",
            "ecosystem_summary", "recommendations", "widgets"
        ]
        
        for section in required_sections:
            assert section in dashboard
        
        # Verify data integrity
        assert dashboard["organization_id"] == str(sample_organization_id)
        assert dashboard["time_range"] == "3M"
        assert dashboard["overall_risk_score"] == 6.8
        assert isinstance(dashboard["recommendations"], list)
        assert isinstance(dashboard["widgets"], list)

    def test_calculate_start_time_intervals(self, analytics_engine_instance):
        """Test start time calculation for different intervals."""
        end_time = datetime(2024, 6, 15, 12, 0, 0)
        
        test_cases = [
            (TimeInterval.HOUR, timedelta(hours=1)),
            (TimeInterval.DAY, timedelta(days=1)),
            (TimeInterval.WEEK, timedelta(weeks=1)),
            (TimeInterval.MONTH, timedelta(days=30)),
            (TimeInterval.QUARTER, timedelta(days=90)),
            (TimeInterval.YEAR, timedelta(days=365))
        ]
        
        for interval, expected_delta in test_cases:
            start_time = analytics_engine_instance._calculate_start_time(end_time, interval)
            actual_delta = end_time - start_time
            assert actual_delta == expected_delta

    def test_metric_caching_functionality(self, analytics_engine_instance):
        """Test metric caching and retrieval."""
        cache_key = "test_security_metrics_org123_1M"
        
        # Create test metrics
        test_metrics = {
            "critical_vulnerabilities": AnalyticsMetric(
                "Critical", 10.0, MetricType.COUNT, datetime.utcnow(), {}
            )
        }
        
        # Test cache miss
        cached_result = analytics_engine_instance._get_cached_metric(cache_key)
        assert cached_result is None
        
        # Cache the metrics
        analytics_engine_instance._cache_metric(cache_key, test_metrics)
        
        # Test cache hit
        cached_result = analytics_engine_instance._get_cached_metric(cache_key)
        assert cached_result is not None
        assert "critical_vulnerabilities" in cached_result
        assert cached_result["critical_vulnerabilities"].value == 10.0

    def test_metric_cache_expiration(self, analytics_engine_instance):
        """Test metric cache expiration."""
        cache_key = "expired_metrics"
        test_metrics = {
            "test": AnalyticsMetric("Test", 1.0, MetricType.COUNT, datetime.utcnow(), {})
        }
        
        # Cache with very short TTL
        original_ttl = analytics_engine_instance.cache_ttl
        analytics_engine_instance.cache_ttl = 0  # Immediate expiration
        
        analytics_engine_instance._cache_metric(cache_key, test_metrics)
        
        # Should be expired immediately
        cached_result = analytics_engine_instance._get_cached_metric(cache_key)
        assert cached_result is None
        
        # Restore original TTL
        analytics_engine_instance.cache_ttl = original_ttl

    @pytest.mark.asyncio
    async def test_calculate_risk_score_with_graphs(self, analytics_engine_instance, sample_organization_id):
        """Test risk score calculation with dependency graphs."""
        mock_db = AsyncMock()
        
        # Mock query result with risk scores
        mock_result = Mock()
        mock_result.fetchall.return_value = [(7.5,), (6.2,), (8.1,)]
        mock_db.execute.return_value = mock_result
        
        risk_score = await analytics_engine_instance._calculate_risk_score(
            mock_db, sample_organization_id
        )
        
        # Should return average of [7.5, 6.2, 8.1] = 7.27
        expected_average = round((7.5 + 6.2 + 8.1) / 3, 2)
        assert risk_score == expected_average

    @pytest.mark.asyncio
    async def test_calculate_risk_score_no_data(self, analytics_engine_instance, sample_organization_id):
        """Test risk score calculation with no data."""
        mock_db = AsyncMock()
        
        # Mock empty result
        mock_result = Mock()
        mock_result.fetchall.return_value = []
        mock_db.execute.return_value = mock_result
        
        risk_score = await analytics_engine_instance._calculate_risk_score(
            mock_db, sample_organization_id
        )
        
        assert risk_score == 0.0

    @pytest.mark.asyncio
    async def test_generate_recommendations_critical_vulnerabilities(self, analytics_engine_instance):
        """Test recommendation generation for critical vulnerabilities."""
        security_metrics = {
            "critical_vulnerabilities": AnalyticsMetric("Critical", 5.0, MetricType.COUNT, datetime.utcnow(), {})
        }
        license_metrics = {
            "copyleft_percentage": AnalyticsMetric("Copyleft", 10.0, MetricType.PERCENTAGE, datetime.utcnow(), {})
        }
        workflow_metrics = {
            "workflow_completion_rate": AnalyticsMetric("Completion", 95.0, MetricType.PERCENTAGE, datetime.utcnow(), {})
        }
        
        recommendations = await analytics_engine_instance._generate_recommendations(
            security_metrics, license_metrics, workflow_metrics
        )
        
        # Should generate security recommendation for critical vulnerabilities
        assert len(recommendations) >= 1
        security_rec = next((r for r in recommendations if r["type"] == "security"), None)
        assert security_rec is not None
        assert security_rec["priority"] == "high"
        assert "critical vulnerabilities" in security_rec["description"].lower()

    @pytest.mark.asyncio
    async def test_generate_recommendations_high_copyleft(self, analytics_engine_instance):
        """Test recommendation generation for high copyleft usage."""
        security_metrics = {
            "critical_vulnerabilities": AnalyticsMetric("Critical", 0.0, MetricType.COUNT, datetime.utcnow(), {})
        }
        license_metrics = {
            "copyleft_percentage": AnalyticsMetric("Copyleft", 35.0, MetricType.PERCENTAGE, datetime.utcnow(), {})
        }
        workflow_metrics = {
            "workflow_completion_rate": AnalyticsMetric("Completion", 85.0, MetricType.PERCENTAGE, datetime.utcnow(), {})
        }
        
        recommendations = await analytics_engine_instance._generate_recommendations(
            security_metrics, license_metrics, workflow_metrics
        )
        
        # Should generate compliance recommendation for high copyleft usage
        compliance_rec = next((r for r in recommendations if r["type"] == "compliance"), None)
        assert compliance_rec is not None
        assert compliance_rec["priority"] == "medium"
        assert "copyleft" in compliance_rec["description"].lower()

    @pytest.mark.asyncio
    async def test_generate_recommendations_low_completion_rate(self, analytics_engine_instance):
        """Test recommendation generation for low workflow completion rate."""
        security_metrics = {
            "critical_vulnerabilities": AnalyticsMetric("Critical", 0.0, MetricType.COUNT, datetime.utcnow(), {})
        }
        license_metrics = {
            "copyleft_percentage": AnalyticsMetric("Copyleft", 15.0, MetricType.PERCENTAGE, datetime.utcnow(), {})
        }
        workflow_metrics = {
            "workflow_completion_rate": AnalyticsMetric("Completion", 65.0, MetricType.PERCENTAGE, datetime.utcnow(), {})
        }
        
        recommendations = await analytics_engine_instance._generate_recommendations(
            security_metrics, license_metrics, workflow_metrics
        )
        
        # Should generate operational recommendation for low completion rate
        operational_rec = next((r for r in recommendations if r["type"] == "operational"), None)
        assert operational_rec is not None
        assert operational_rec["priority"] == "medium"
        assert "completion rate" in operational_rec["description"].lower()

    def test_generate_dashboard_widgets(self, analytics_engine_instance):
        """Test dashboard widget generation."""
        widgets = analytics_engine_instance._generate_dashboard_widgets()
        
        # Should generate standard set of widgets
        assert len(widgets) >= 4
        
        widget_ids = [w.widget_id for w in widgets]
        expected_widgets = [
            "security_overview", "risk_score", 
            "license_compliance", "workflow_performance"
        ]
        
        for expected_widget in expected_widgets:
            assert expected_widget in widget_ids
        
        # Verify widget structure
        security_widget = next(w for w in widgets if w.widget_id == "security_overview")
        assert security_widget.title == "Security Overview"
        assert security_widget.widget_type == "chart"
        assert security_widget.data_source == "security_metrics"
        assert "position" in security_widget.__dict__

    @pytest.mark.asyncio
    async def test_error_handling_in_security_metrics(self, analytics_engine_instance):
        """Test error handling in security metrics calculation."""
        mock_db = AsyncMock()
        mock_db.execute.side_effect = Exception("Database error")
        
        with pytest.raises(Exception) as exc_info:
            await analytics_engine_instance.get_security_metrics(
                db=mock_db,
                organization_id=uuid4(),
                time_range=TimeInterval.MONTH
            )
        
        assert "Database error" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_different_time_intervals(self, analytics_engine_instance, mock_db_session, sample_organization_id):
        """Test metrics calculation with different time intervals."""
        time_intervals = [
            TimeInterval.HOUR, TimeInterval.DAY, TimeInterval.WEEK,
            TimeInterval.MONTH, TimeInterval.QUARTER, TimeInterval.YEAR
        ]
        
        for interval in time_intervals:
            metrics = await analytics_engine_instance.get_security_metrics(
                db=mock_db_session,
                organization_id=sample_organization_id,
                time_range=interval
            )
            
            # Verify time range is properly set in metadata
            assert metrics["critical_vulnerabilities"].metadata["time_range"] == interval.value

    def test_analytics_engine_singleton(self):
        """Test that the global analytics_engine instance works correctly."""
        assert analytics_engine is not None
        assert isinstance(analytics_engine, AnalyticsEngine)
        
        # Test that cache is initialized
        assert hasattr(analytics_engine, 'metric_cache')
        assert hasattr(analytics_engine, 'cache_ttl')
        assert analytics_engine.cache_ttl == 300  # 5 minutes default


class TestMetricTypes:
    """Test metric type enumeration."""
    
    def test_metric_type_values(self):
        """Test all metric types have correct values."""
        assert MetricType.COUNT.value == "count"
        assert MetricType.PERCENTAGE.value == "percentage"
        assert MetricType.RATIO.value == "ratio"
        assert MetricType.TREND.value == "trend"
        assert MetricType.DISTRIBUTION.value == "distribution"
        assert MetricType.SCORE.value == "score"


class TestTimeIntervals:
    """Test time interval enumeration."""
    
    def test_time_interval_values(self):
        """Test all time intervals have correct values."""
        assert TimeInterval.HOUR.value == "1h"
        assert TimeInterval.DAY.value == "1d"
        assert TimeInterval.WEEK.value == "1w"
        assert TimeInterval.MONTH.value == "1M"
        assert TimeInterval.QUARTER.value == "3M"
        assert TimeInterval.YEAR.value == "1Y"


if __name__ == "__main__":
    pytest.main([__file__])