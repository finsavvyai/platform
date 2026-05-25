"""
Tests for analytics engine and reporting functionality.
"""

import pytest
import asyncio
from datetime import datetime, timedelta
from uuid import uuid4
from unittest.mock import Mock, AsyncMock, patch

from udp.analytics.engine import (
    AnalyticsEngine, AnalyticsMetric, MetricType, TimeInterval,
    analytics_engine
)
from udp.reporting.generators import ReportGenerator, ReportFormat
from udp.reporting.scheduler import (
    ReportScheduler, ScheduleFrequency, DeliveryMethod,
    ReportSchedule, ReportJob, ReportStatus
)
from udp.domain.models import SecurityLevel, EcosystemType


class TestAnalyticsEngine:
    """Test suite for analytics engine."""
    
    @pytest.fixture
    def analytics_engine_instance(self):
        """Create analytics engine instance."""
        return AnalyticsEngine()
    
    @pytest.fixture
    def mock_db_session(self):
        """Create mock database session."""
        mock_session = AsyncMock()
        mock_result = Mock()
        mock_result.scalar.return_value = 5
        mock_result.fetchall.return_value = [
            (SecurityLevel.CRITICAL, 2),
            (SecurityLevel.HIGH, 3)
        ]
        mock_session.execute.return_value = mock_result
        return mock_session
    
    @pytest.mark.asyncio
    async def test_get_security_metrics(self, analytics_engine_instance, mock_db_session):
        """Test security metrics calculation."""
        organization_id = uuid4()
        
        metrics = await analytics_engine_instance.get_security_metrics(
            db=mock_db_session,
            organization_id=organization_id,
            time_range=TimeInterval.MONTH
        )
        
        assert "critical_vulnerabilities" in metrics
        assert "high_vulnerabilities" in metrics
        assert "average_cvss_score" in metrics
        assert "exploitable_packages" in metrics
        
        # Verify metric structure
        critical_metric = metrics["critical_vulnerabilities"]
        assert isinstance(critical_metric, AnalyticsMetric)
        assert critical_metric.metric_type == MetricType.COUNT
        assert isinstance(critical_metric.value, float)
        assert isinstance(critical_metric.timestamp, datetime)
    
    @pytest.mark.asyncio
    async def test_get_license_compliance_metrics(self, analytics_engine_instance, mock_db_session):
        """Test license compliance metrics."""
        organization_id = uuid4()
        
        metrics = await analytics_engine_instance.get_license_compliance_metrics(
            db=mock_db_session,
            organization_id=organization_id,
            time_range=TimeInterval.MONTH
        )
        
        assert "license_distribution" in metrics
        assert "copyleft_percentage" in metrics
        assert "enterprise_friendly_percentage" in metrics
        
        # Check metric types
        distribution_metric = metrics["license_distribution"]
        assert distribution_metric.metric_type == MetricType.DISTRIBUTION
        
        copyleft_metric = metrics["copyleft_percentage"]
        assert copyleft_metric.metric_type == MetricType.PERCENTAGE
    
    @pytest.mark.asyncio
    async def test_get_workflow_performance_metrics(self, analytics_engine_instance, mock_db_session):
        """Test workflow performance metrics."""
        organization_id = uuid4()
        
        metrics = await analytics_engine_instance.get_workflow_performance_metrics(
            db=mock_db_session,
            organization_id=organization_id,
            time_range=TimeInterval.MONTH
        )
        
        assert "workflow_completion_rate" in metrics
        assert "average_processing_time" in metrics
        assert "pending_approvals" in metrics
        
        # Verify percentage metric
        completion_metric = metrics["workflow_completion_rate"]
        assert completion_metric.metric_type == MetricType.PERCENTAGE
        assert 0 <= completion_metric.value <= 100
    
    @pytest.mark.asyncio
    async def test_get_ecosystem_insights(self, analytics_engine_instance, mock_db_session):
        """Test ecosystem insights calculation."""
        organization_id = uuid4()
        
        metrics = await analytics_engine_instance.get_ecosystem_insights(
            db=mock_db_session,
            organization_id=organization_id,
            time_range=TimeInterval.MONTH
        )
        
        assert "ecosystem_distribution" in metrics
        distribution_metric = metrics["ecosystem_distribution"]
        assert distribution_metric.metric_type == MetricType.DISTRIBUTION
        assert "distribution" in distribution_metric.metadata
        assert "percentages" in distribution_metric.metadata
    
    @pytest.mark.asyncio
    async def test_generate_executive_dashboard(self, analytics_engine_instance, mock_db_session):
        """Test executive dashboard generation."""
        organization_id = uuid4()
        
        dashboard = await analytics_engine_instance.generate_executive_dashboard(
            db=mock_db_session,
            organization_id=organization_id,
            time_range=TimeInterval.QUARTER
        )
        
        assert "organization_id" in dashboard
        assert "generated_at" in dashboard
        assert "overall_risk_score" in dashboard
        assert "security_summary" in dashboard
        assert "compliance_summary" in dashboard
        assert "operational_summary" in dashboard
        assert "recommendations" in dashboard
        assert "widgets" in dashboard
        
        # Verify dashboard structure
        assert dashboard["organization_id"] == str(organization_id)
        assert isinstance(dashboard["overall_risk_score"], (int, float))
        assert isinstance(dashboard["recommendations"], list)
    
    def test_cache_functionality(self, analytics_engine_instance):
        """Test metric caching."""
        cache_key = "test_cache_key"
        test_metrics = {
            "test_metric": AnalyticsMetric(
                name="Test Metric",
                value=100.0,
                metric_type=MetricType.COUNT,
                timestamp=datetime.utcnow(),
                metadata={}
            )
        }
        
        # Cache metrics
        analytics_engine_instance._cache_metric(cache_key, test_metrics)
        
        # Retrieve from cache
        cached_metrics = analytics_engine_instance._get_cached_metric(cache_key)
        assert cached_metrics is not None
        assert "test_metric" in cached_metrics
        
        # Test cache expiration (simulate old cache)
        analytics_engine_instance.cache_ttl = -1  # Force expiration
        expired_metrics = analytics_engine_instance._get_cached_metric(cache_key)
        assert expired_metrics is None
    
    def test_time_interval_calculation(self, analytics_engine_instance):
        """Test time interval calculations."""
        end_time = datetime.utcnow()
        
        # Test different intervals
        start_daily = analytics_engine_instance._calculate_start_time(end_time, TimeInterval.DAY)
        assert (end_time - start_daily).days == 1
        
        start_weekly = analytics_engine_instance._calculate_start_time(end_time, TimeInterval.WEEK)
        assert (end_time - start_weekly).days == 7
        
        start_monthly = analytics_engine_instance._calculate_start_time(end_time, TimeInterval.MONTH)
        assert (end_time - start_monthly).days == 30


class TestReportGenerator:
    """Test suite for report generator."""
    
    @pytest.fixture
    def report_generator_instance(self):
        """Create report generator instance."""
        return ReportGenerator()
    
    @pytest.fixture
    def mock_organization(self):
        """Create mock organization."""
        org = Mock()
        org.id = uuid4()
        org.name = "Test Organization"
        org.domain = "test.com"
        org.industry = "Technology"
        org.compliance_frameworks = ["SOX", "ISO27001"]
        org.allowed_licenses = ["MIT", "Apache-2.0"]
        org.blocked_licenses = ["GPL-3.0"]
        return org
    
    @pytest.fixture
    def mock_metrics(self):
        """Create mock metrics."""
        return {
            "critical_vulnerabilities": AnalyticsMetric(
                name="Critical Vulnerabilities",
                value=5.0,
                metric_type=MetricType.COUNT,
                timestamp=datetime.utcnow(),
                metadata={"severity_distribution": {"CRITICAL": 5, "HIGH": 10}}
            ),
            "license_distribution": AnalyticsMetric(
                name="License Distribution",
                value=100.0,
                metric_type=MetricType.DISTRIBUTION,
                timestamp=datetime.utcnow(),
                metadata={"distribution": {"MIT": 50, "Apache-2.0": 30, "GPL-3.0": 20}}
            ),
            "workflow_completion_rate": AnalyticsMetric(
                name="Workflow Completion Rate",
                value=85.0,
                metric_type=MetricType.PERCENTAGE,
                timestamp=datetime.utcnow(),
                metadata={}
            )
        }
    
    @pytest.mark.asyncio
    async def test_generate_compliance_report(self, report_generator_instance, mock_organization, mock_metrics):
        """Test compliance report generation."""
        mock_db = AsyncMock()
        mock_db.get.return_value = mock_organization
        
        with patch.object(analytics_engine, 'get_security_metrics', return_value=mock_metrics), \
             patch.object(analytics_engine, 'get_license_compliance_metrics', return_value=mock_metrics), \
             patch.object(analytics_engine, 'get_workflow_performance_metrics', return_value=mock_metrics):
            
            report = await report_generator_instance.generate_compliance_report(
                db=mock_db,
                organization_id=mock_organization.id,
                framework="SOX",
                time_range=TimeInterval.MONTH,
                format=ReportFormat.JSON
            )
        
        assert "report_data" in report
        assert "metadata" in report
        assert "generation_summary" in report
        
        # Verify report structure
        report_data = report["report_data"]
        assert "report_metadata" in report_data
        assert "executive_summary" in report_data
        assert "compliance_assessment" in report_data
        assert "recommendations" in report_data
        
        # Check metadata
        metadata = report_data["report_metadata"]
        assert metadata["report_type"] == "compliance"
        assert metadata["compliance_framework"] == "SOX"
        assert metadata["organization_name"] == mock_organization.name
    
    @pytest.mark.asyncio
    async def test_generate_security_report(self, report_generator_instance, mock_organization, mock_metrics):
        """Test security report generation."""
        mock_db = AsyncMock()
        
        with patch.object(analytics_engine, 'get_security_metrics', return_value=mock_metrics), \
             patch.object(analytics_engine, 'get_ecosystem_insights', return_value=mock_metrics):
            
            report = await report_generator_instance.generate_security_report(
                db=mock_db,
                organization_id=mock_organization.id,
                time_range=TimeInterval.MONTH,
                format=ReportFormat.JSON
            )
        
        assert "report_data" in report
        assert "metadata" in report
        assert "security_summary" in report
        
        # Verify security-specific sections
        report_data = report["report_data"]
        assert "threat_landscape" in report_data
        assert "risk_assessment" in report_data
        assert "security_recommendations" in report_data
    
    @pytest.mark.asyncio
    async def test_generate_executive_summary(self, report_generator_instance, mock_organization):
        """Test executive summary generation."""
        mock_db = AsyncMock()
        mock_dashboard = {
            "organization_id": str(mock_organization.id),
            "overall_risk_score": 6.5,
            "security_summary": {"critical_vulnerabilities": 3},
            "compliance_summary": {"copyleft_percentage": 15.0},
            "operational_summary": {"workflow_completion_rate": 88.0}
        }
        
        with patch.object(analytics_engine, 'generate_executive_dashboard', return_value=mock_dashboard):
            
            report = await report_generator_instance.generate_executive_summary(
                db=mock_db,
                organization_id=mock_organization.id,
                time_range=TimeInterval.QUARTER,
                format=ReportFormat.PDF
            )
        
        assert "report_data" in report
        assert "metadata" in report
        assert "key_insights" in report
        
        # Verify executive-specific sections
        report_data = report["report_data"]
        assert "key_metrics" in report_data
        assert "strategic_insights" in report_data
        assert "business_impact" in report_data
        assert "strategic_recommendations" in report_data
    
    def test_format_report_json(self, report_generator_instance):
        """Test JSON report formatting."""
        test_data = {
            "test_field": "test_value",
            "timestamp": datetime.utcnow(),
            "number": 123.45
        }
        
        formatted_report = report_generator_instance._serialize_report_data(test_data)
        
        assert isinstance(formatted_report, dict)
        assert formatted_report["test_field"] == "test_value"
        assert isinstance(formatted_report["timestamp"], str)
        assert formatted_report["number"] == 123.45
    
    def test_format_report_html(self, report_generator_instance):
        """Test HTML report formatting."""
        test_data = {
            "report_metadata": {
                "generated_at": datetime.utcnow(),
                "organization_name": "Test Org"
            }
        }
        
        html_report = report_generator_instance._generate_basic_html(test_data)
        
        assert isinstance(html_report, str)
        assert "<!DOCTYPE html>" in html_report
        assert "Test Org" in html_report or "N/A" in html_report
    
    def test_utility_methods(self, report_generator_instance):
        """Test utility methods."""
        # Test datetime formatting
        test_datetime = datetime(2024, 1, 15, 14, 30, 0)
        formatted_datetime = report_generator_instance._format_datetime(test_datetime)
        assert "2024-01-15 14:30:00 UTC" == formatted_datetime
        
        # Test percentage formatting
        assert report_generator_instance._format_percentage(85.5) == "85.5%"
        
        # Test number formatting
        assert report_generator_instance._format_number(1234.5) == "1,234.5"
        assert report_generator_instance._format_number(5678) == "5,678"
        
        # Test risk level calculation
        mock_metrics = {
            "critical_vulnerabilities": Mock(value=3),
            "average_cvss_score": Mock(value=8.5)
        }
        risk_level = report_generator_instance._calculate_risk_level(mock_metrics)
        assert risk_level == "CRITICAL"
        
        # Test compliance grade
        assert report_generator_instance._get_compliance_grade(95.0) == "A"
        assert report_generator_instance._get_compliance_grade(75.0) == "C"
        assert report_generator_instance._get_compliance_grade(50.0) == "F"


class TestReportScheduler:
    """Test suite for report scheduler."""
    
    @pytest.fixture
    def scheduler_instance(self):
        """Create scheduler instance."""
        return ReportScheduler()
    
    @pytest.mark.asyncio
    async def test_create_schedule(self, scheduler_instance):
        """Test schedule creation."""
        organization_id = uuid4()
        
        schedule_id = await scheduler_instance.create_schedule(
            organization_id=organization_id,
            report_type="compliance",
            frequency=ScheduleFrequency.WEEKLY,
            format=ReportFormat.PDF,
            delivery_methods=[DeliveryMethod.EMAIL],
            recipients=["admin@test.com"],
            parameters={"framework": "SOX"},
            created_by="test_user"
        )
        
        assert schedule_id in scheduler_instance.schedules
        
        schedule = scheduler_instance.schedules[schedule_id]
        assert schedule.organization_id == organization_id
        assert schedule.report_type == "compliance"
        assert schedule.frequency == ScheduleFrequency.WEEKLY
        assert schedule.is_active == True
        assert schedule.created_by == "test_user"
    
    @pytest.mark.asyncio
    async def test_update_schedule(self, scheduler_instance):
        """Test schedule updates."""
        # Create a schedule first
        organization_id = uuid4()
        schedule_id = await scheduler_instance.create_schedule(
            organization_id=organization_id,
            report_type="security",
            frequency=ScheduleFrequency.DAILY
        )
        
        # Update the schedule
        updates = {
            "frequency": ScheduleFrequency.MONTHLY,
            "format": ReportFormat.JSON,
            "is_active": False
        }
        
        success = await scheduler_instance.update_schedule(schedule_id, updates)
        assert success == True
        
        # Verify updates
        schedule = scheduler_instance.schedules[schedule_id]
        assert schedule.frequency == ScheduleFrequency.MONTHLY
        assert schedule.format == ReportFormat.JSON
        assert schedule.is_active == False
    
    @pytest.mark.asyncio
    async def test_delete_schedule(self, scheduler_instance):
        """Test schedule deletion."""
        organization_id = uuid4()
        schedule_id = await scheduler_instance.create_schedule(
            organization_id=organization_id,
            report_type="executive",
            frequency=ScheduleFrequency.QUARTERLY
        )
        
        # Verify schedule exists
        assert schedule_id in scheduler_instance.schedules
        
        # Delete schedule
        success = await scheduler_instance.delete_schedule(schedule_id)
        assert success == True
        assert schedule_id not in scheduler_instance.schedules
    
    @pytest.mark.asyncio
    async def test_generate_report_now(self, scheduler_instance):
        """Test on-demand report generation."""
        organization_id = uuid4()
        
        with patch.object(scheduler_instance, '_execute_report_job', new_callable=AsyncMock):
            job_id = await scheduler_instance.generate_report_now(
                organization_id=organization_id,
                report_type="compliance",
                format=ReportFormat.HTML,
                delivery_methods=[DeliveryMethod.EMAIL],
                recipients=["user@test.com"]
            )
        
        assert job_id in scheduler_instance.active_jobs
        
        job = scheduler_instance.active_jobs[job_id]
        assert job.organization_id == organization_id
        assert job.report_type == "compliance"
        assert job.format == ReportFormat.HTML
        assert job.schedule_id == "on_demand"
    
    @pytest.mark.asyncio
    async def test_get_schedule_status(self, scheduler_instance):
        """Test schedule status retrieval."""
        organization_id = uuid4()
        schedule_id = await scheduler_instance.create_schedule(
            organization_id=organization_id,
            report_type="security",
            frequency=ScheduleFrequency.WEEKLY
        )
        
        status = await scheduler_instance.get_schedule_status(schedule_id)
        
        assert status is not None
        assert status["schedule_id"] == schedule_id
        assert status["organization_id"] == str(organization_id)
        assert status["report_type"] == "security"
        assert status["frequency"] == "weekly"
        assert status["is_active"] == True
    
    @pytest.mark.asyncio
    async def test_list_schedules(self, scheduler_instance):
        """Test schedule listing."""
        org1_id = uuid4()
        org2_id = uuid4()
        
        # Create schedules for different organizations
        schedule1_id = await scheduler_instance.create_schedule(
            organization_id=org1_id,
            report_type="compliance",
            frequency=ScheduleFrequency.DAILY
        )
        
        schedule2_id = await scheduler_instance.create_schedule(
            organization_id=org2_id,
            report_type="security", 
            frequency=ScheduleFrequency.WEEKLY
        )
        
        # List all schedules
        all_schedules = await scheduler_instance.list_schedules()
        assert len(all_schedules) >= 2
        
        # List schedules for specific organization
        org1_schedules = await scheduler_instance.list_schedules(org1_id)
        assert len(org1_schedules) == 1
        assert org1_schedules[0]["schedule_id"] == schedule1_id
    
    def test_calculate_next_run(self, scheduler_instance):
        """Test next run time calculations."""
        base_time = datetime.utcnow()
        
        # Test different frequencies
        daily_next = scheduler_instance._calculate_next_run(
            ScheduleFrequency.DAILY, base_time
        )
        assert (daily_next - base_time).days == 1
        
        weekly_next = scheduler_instance._calculate_next_run(
            ScheduleFrequency.WEEKLY, base_time
        )
        assert (weekly_next - base_time).days == 7
        
        monthly_next = scheduler_instance._calculate_next_run(
            ScheduleFrequency.MONTHLY, base_time
        )
        assert (monthly_next - base_time).days == 30
        
        quarterly_next = scheduler_instance._calculate_next_run(
            ScheduleFrequency.QUARTERLY, base_time
        )
        assert (quarterly_next - base_time).days == 90
    
    @pytest.mark.asyncio
    async def test_run_scheduled_reports(self, scheduler_instance):
        """Test scheduled report execution."""
        organization_id = uuid4()
        
        # Create a schedule that's due to run
        schedule_id = await scheduler_instance.create_schedule(
            organization_id=organization_id,
            report_type="compliance",
            frequency=ScheduleFrequency.DAILY
        )
        
        # Set next_run to past time to make it due
        schedule = scheduler_instance.schedules[schedule_id]
        schedule.next_run = datetime.utcnow() - timedelta(hours=1)
        
        with patch.object(scheduler_instance, '_execute_scheduled_report', new_callable=AsyncMock) as mock_execute:
            await scheduler_instance.run_scheduled_reports()
            mock_execute.assert_called_once_with(schedule)
    
    @pytest.mark.asyncio
    async def test_job_status_tracking(self, scheduler_instance):
        """Test job status tracking."""
        job = ReportJob(
            job_id="test_job_123",
            schedule_id="test_schedule",
            organization_id=uuid4(),
            report_type="security",
            format=ReportFormat.PDF,
            parameters={},
            delivery_config={}
        )
        
        scheduler_instance.active_jobs[job.job_id] = job
        
        # Get initial status
        status = await scheduler_instance.get_job_status(job.job_id)
        assert status["status"] == ReportStatus.SCHEDULED.value
        assert status["started_at"] is None
        assert status["completed_at"] is None
        
        # Update job status
        job.status = ReportStatus.RUNNING
        job.started_at = datetime.utcnow()
        
        updated_status = await scheduler_instance.get_job_status(job.job_id)
        assert updated_status["status"] == ReportStatus.RUNNING.value
        assert updated_status["started_at"] is not None


class TestIntegration:
    """Integration tests for analytics and reporting components."""
    
    @pytest.mark.asyncio
    async def test_end_to_end_report_generation(self):
        """Test complete report generation workflow."""
        # This would test the full pipeline from analytics to report generation
        # In a real test environment, this would use actual database connections
        # and verify the complete workflow
        pass
    
    @pytest.mark.asyncio
    async def test_scheduled_compliance_report_workflow(self):
        """Test scheduled compliance report workflow."""
        # This would test creating a schedule, triggering generation,
        # and verifying delivery
        pass


if __name__ == "__main__":
    pytest.main([__file__])