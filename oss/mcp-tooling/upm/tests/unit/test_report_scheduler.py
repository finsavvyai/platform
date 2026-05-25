"""
Comprehensive unit tests for the report scheduler.
"""

import pytest
import asyncio
from datetime import datetime, timedelta
from uuid import uuid4
from unittest.mock import Mock, AsyncMock, patch, call

from udp.reporting.scheduler import (
    ReportScheduler, ScheduleFrequency, DeliveryMethod, ReportStatus,
    ReportSchedule, ReportJob, report_scheduler
)
from udp.reporting.generators import ReportFormat
from udp.analytics.engine import TimeInterval


class TestScheduleFrequency:
    """Test schedule frequency enumeration."""
    
    def test_schedule_frequency_values(self):
        """Test all schedule frequencies have correct values."""
        assert ScheduleFrequency.DAILY.value == "daily"
        assert ScheduleFrequency.WEEKLY.value == "weekly"
        assert ScheduleFrequency.MONTHLY.value == "monthly"
        assert ScheduleFrequency.QUARTERLY.value == "quarterly"
        assert ScheduleFrequency.ANNUALLY.value == "annually"
        assert ScheduleFrequency.ON_DEMAND.value == "on_demand"


class TestDeliveryMethod:
    """Test delivery method enumeration."""
    
    def test_delivery_method_values(self):
        """Test all delivery methods have correct values."""
        assert DeliveryMethod.EMAIL.value == "email"
        assert DeliveryMethod.SLACK.value == "slack"
        assert DeliveryMethod.WEBHOOK.value == "webhook"
        assert DeliveryMethod.S3_UPLOAD.value == "s3_upload"
        assert DeliveryMethod.SFTP.value == "sftp"
        assert DeliveryMethod.API_CALLBACK.value == "api_callback"


class TestReportStatus:
    """Test report status enumeration."""
    
    def test_report_status_values(self):
        """Test all report statuses have correct values."""
        assert ReportStatus.SCHEDULED.value == "scheduled"
        assert ReportStatus.RUNNING.value == "running"
        assert ReportStatus.COMPLETED.value == "completed"
        assert ReportStatus.FAILED.value == "failed"
        assert ReportStatus.CANCELLED.value == "cancelled"


class TestReportSchedule:
    """Test ReportSchedule dataclass."""
    
    def test_report_schedule_creation(self):
        """Test creating a report schedule."""
        org_id = uuid4()
        schedule_id = "test-schedule-123"
        next_run = datetime.utcnow() + timedelta(days=1)
        
        schedule = ReportSchedule(
            schedule_id=schedule_id,
            organization_id=org_id,
            report_type="compliance",
            frequency=ScheduleFrequency.DAILY,
            format=ReportFormat.PDF,
            delivery_methods=[DeliveryMethod.EMAIL, DeliveryMethod.SLACK],
            recipients=["admin@test.com", "slack-webhook-url"],
            parameters={"framework": "SOX"},
            next_run=next_run,
            created_by="test_user"
        )
        
        assert schedule.schedule_id == schedule_id
        assert schedule.organization_id == org_id
        assert schedule.report_type == "compliance"
        assert schedule.frequency == ScheduleFrequency.DAILY
        assert schedule.format == ReportFormat.PDF
        assert len(schedule.delivery_methods) == 2
        assert schedule.recipients == ["admin@test.com", "slack-webhook-url"]
        assert schedule.parameters == {"framework": "SOX"}
        assert schedule.next_run == next_run
        assert schedule.is_active == True  # Default value
        assert schedule.created_by == "test_user"
        assert schedule.created_at is not None  # Auto-generated
    
    def test_report_schedule_defaults(self):
        """Test report schedule with default values."""
        schedule = ReportSchedule(
            schedule_id="test-schedule",
            organization_id=uuid4(),
            report_type="security",
            frequency=ScheduleFrequency.WEEKLY,
            format=ReportFormat.JSON,
            delivery_methods=[DeliveryMethod.EMAIL],
            recipients=[],
            parameters={},
            next_run=datetime.utcnow()
        )
        
        assert schedule.is_active == True
        assert schedule.created_at is not None
        assert schedule.created_by is None
        assert schedule.last_run is None
        assert schedule.last_status == ReportStatus.SCHEDULED


class TestReportJob:
    """Test ReportJob dataclass."""
    
    def test_report_job_creation(self):
        """Test creating a report job."""
        job_id = "job-456"
        org_id = uuid4()
        
        job = ReportJob(
            job_id=job_id,
            schedule_id="schedule-123",
            organization_id=org_id,
            report_type="executive",
            format=ReportFormat.HTML,
            parameters={"time_range": "3M"},
            delivery_config={
                "methods": [DeliveryMethod.WEBHOOK],
                "recipients": ["https://api.example.com/webhook"]
            }
        )
        
        assert job.job_id == job_id
        assert job.schedule_id == "schedule-123"
        assert job.organization_id == org_id
        assert job.report_type == "executive"
        assert job.format == ReportFormat.HTML
        assert job.parameters == {"time_range": "3M"}
        assert job.status == ReportStatus.SCHEDULED  # Default
        assert job.created_at is not None
        assert job.started_at is None
        assert job.completed_at is None


class TestReportScheduler:
    """Comprehensive tests for the ReportScheduler class."""
    
    @pytest.fixture
    def scheduler_instance(self):
        """Create a fresh scheduler instance."""
        scheduler = ReportScheduler()
        scheduler.schedules.clear()
        scheduler.active_jobs.clear()
        return scheduler
    
    @pytest.fixture
    def sample_organization_id(self):
        """Sample organization ID for testing."""
        return uuid4()

    @pytest.mark.asyncio
    async def test_create_schedule_success(self, scheduler_instance, sample_organization_id):
        """Test successful schedule creation."""
        schedule_id = await scheduler_instance.create_schedule(
            organization_id=sample_organization_id,
            report_type="compliance",
            frequency=ScheduleFrequency.WEEKLY,
            format=ReportFormat.PDF,
            delivery_methods=[DeliveryMethod.EMAIL, DeliveryMethod.SLACK],
            recipients=["admin@test.com", "slack-channel"],
            parameters={"framework": "ISO27001", "include_details": True},
            created_by="test_admin"
        )
        
        # Verify schedule was created
        assert schedule_id in scheduler_instance.schedules
        
        schedule = scheduler_instance.schedules[schedule_id]
        assert schedule.organization_id == sample_organization_id
        assert schedule.report_type == "compliance"
        assert schedule.frequency == ScheduleFrequency.WEEKLY
        assert schedule.format == ReportFormat.PDF
        assert DeliveryMethod.EMAIL in schedule.delivery_methods
        assert DeliveryMethod.SLACK in schedule.delivery_methods
        assert schedule.recipients == ["admin@test.com", "slack-channel"]
        assert schedule.parameters["framework"] == "ISO27001"
        assert schedule.created_by == "test_admin"
        assert schedule.is_active == True
        
        # Verify next_run was calculated
        assert schedule.next_run > datetime.utcnow()

    @pytest.mark.asyncio
    async def test_create_schedule_with_defaults(self, scheduler_instance, sample_organization_id):
        """Test schedule creation with default parameters."""
        schedule_id = await scheduler_instance.create_schedule(
            organization_id=sample_organization_id,
            report_type="security",
            frequency=ScheduleFrequency.DAILY
        )
        
        schedule = scheduler_instance.schedules[schedule_id]
        assert schedule.format == ReportFormat.PDF  # Default format
        assert schedule.delivery_methods == [DeliveryMethod.EMAIL]  # Default delivery
        assert schedule.recipients == []
        assert schedule.parameters == {}
        assert schedule.created_by is None

    @pytest.mark.asyncio
    async def test_create_schedule_with_celery(self, scheduler_instance, sample_organization_id):
        """Test schedule creation with Celery integration."""
        mock_celery = Mock()
        scheduler_instance.celery_app = mock_celery
        
        with patch.object(scheduler_instance, '_schedule_celery_task', new_callable=AsyncMock) as mock_schedule:
            schedule_id = await scheduler_instance.create_schedule(
                organization_id=sample_organization_id,
                report_type="executive",
                frequency=ScheduleFrequency.MONTHLY
            )
            
            # Should have called Celery scheduling
            mock_schedule.assert_called_once()
            schedule = scheduler_instance.schedules[schedule_id]
            mock_schedule.assert_called_with(schedule)

    @pytest.mark.asyncio
    async def test_update_schedule_success(self, scheduler_instance, sample_organization_id):
        """Test successful schedule update."""
        # Create a schedule first
        schedule_id = await scheduler_instance.create_schedule(
            organization_id=sample_organization_id,
            report_type="compliance",
            frequency=ScheduleFrequency.DAILY,
            format=ReportFormat.JSON
        )
        
        # Update the schedule
        updates = {
            "frequency": ScheduleFrequency.WEEKLY,
            "format": ReportFormat.PDF,
            "delivery_methods": [DeliveryMethod.WEBHOOK],
            "recipients": ["https://api.example.com/reports"],
            "parameters": {"new_param": "value"},
            "is_active": False
        }
        
        success = await scheduler_instance.update_schedule(schedule_id, updates)
        assert success == True
        
        # Verify updates were applied
        schedule = scheduler_instance.schedules[schedule_id]
        assert schedule.frequency == ScheduleFrequency.WEEKLY
        assert schedule.format == ReportFormat.PDF
        assert schedule.delivery_methods == [DeliveryMethod.WEBHOOK]
        assert schedule.recipients == ["https://api.example.com/reports"]
        assert schedule.parameters == {"new_param": "value"}
        assert schedule.is_active == False

    @pytest.mark.asyncio
    async def test_update_schedule_frequency_reschedules(self, scheduler_instance, sample_organization_id):
        """Test that updating frequency reschedules the next run."""
        mock_celery = Mock()
        scheduler_instance.celery_app = mock_celery
        
        # Create schedule
        schedule_id = await scheduler_instance.create_schedule(
            organization_id=sample_organization_id,
            report_type="security",
            frequency=ScheduleFrequency.DAILY
        )
        
        original_next_run = scheduler_instance.schedules[schedule_id].next_run
        
        with patch.object(scheduler_instance, '_schedule_celery_task', new_callable=AsyncMock):
            # Update frequency
            await scheduler_instance.update_schedule(
                schedule_id, {"frequency": ScheduleFrequency.WEEKLY}
            )
        
        # Next run should be updated
        new_next_run = scheduler_instance.schedules[schedule_id].next_run
        assert new_next_run != original_next_run
        assert new_next_run > original_next_run  # Weekly is longer than daily

    @pytest.mark.asyncio
    async def test_update_schedule_nonexistent(self, scheduler_instance):
        """Test updating a non-existent schedule."""
        success = await scheduler_instance.update_schedule(
            "nonexistent-schedule", {"format": ReportFormat.HTML}
        )
        
        assert success == False

    @pytest.mark.asyncio
    async def test_update_schedule_invalid_fields(self, scheduler_instance, sample_organization_id):
        """Test updating schedule with invalid fields."""
        schedule_id = await scheduler_instance.create_schedule(
            organization_id=sample_organization_id,
            report_type="compliance",
            frequency=ScheduleFrequency.DAILY
        )
        
        original_schedule = scheduler_instance.schedules[schedule_id]
        original_org_id = original_schedule.organization_id
        
        # Try to update non-allowed fields
        updates = {
            "organization_id": uuid4(),  # Should not be updateable
            "schedule_id": "new-id",  # Should not be updateable
            "format": ReportFormat.HTML  # Should be updateable
        }
        
        success = await scheduler_instance.update_schedule(schedule_id, updates)
        assert success == True
        
        updated_schedule = scheduler_instance.schedules[schedule_id]
        # Non-allowed fields should remain unchanged
        assert updated_schedule.organization_id == original_org_id
        assert updated_schedule.schedule_id == schedule_id
        # Allowed fields should be updated
        assert updated_schedule.format == ReportFormat.HTML

    @pytest.mark.asyncio
    async def test_delete_schedule_success(self, scheduler_instance, sample_organization_id):
        """Test successful schedule deletion."""
        schedule_id = await scheduler_instance.create_schedule(
            organization_id=sample_organization_id,
            report_type="executive",
            frequency=ScheduleFrequency.QUARTERLY
        )
        
        # Verify schedule exists
        assert schedule_id in scheduler_instance.schedules
        
        success = await scheduler_instance.delete_schedule(schedule_id)
        assert success == True
        assert schedule_id not in scheduler_instance.schedules

    @pytest.mark.asyncio
    async def test_delete_schedule_with_celery(self, scheduler_instance, sample_organization_id):
        """Test schedule deletion with Celery integration."""
        mock_celery = Mock()
        scheduler_instance.celery_app = mock_celery
        
        schedule_id = await scheduler_instance.create_schedule(
            organization_id=sample_organization_id,
            report_type="compliance",
            frequency=ScheduleFrequency.MONTHLY
        )
        
        with patch.object(scheduler_instance, '_cancel_celery_task', new_callable=AsyncMock) as mock_cancel:
            success = await scheduler_instance.delete_schedule(schedule_id)
            
            assert success == True
            mock_cancel.assert_called_once_with(schedule_id)

    @pytest.mark.asyncio
    async def test_delete_schedule_nonexistent(self, scheduler_instance):
        """Test deleting a non-existent schedule."""
        success = await scheduler_instance.delete_schedule("nonexistent-schedule")
        assert success == False

    @pytest.mark.asyncio
    async def test_generate_report_now_success(self, scheduler_instance, sample_organization_id):
        """Test successful on-demand report generation."""
        with patch.object(scheduler_instance, '_execute_report_job', new_callable=AsyncMock) as mock_execute:
            job_id = await scheduler_instance.generate_report_now(
                organization_id=sample_organization_id,
                report_type="security",
                format=ReportFormat.HTML,
                delivery_methods=[DeliveryMethod.EMAIL, DeliveryMethod.WEBHOOK],
                recipients=["admin@test.com", "https://api.example.com/webhook"],
                parameters={"time_range": "1M", "include_remediation": True}
            )
        
        # Verify job was created and executed
        assert job_id in scheduler_instance.active_jobs
        mock_execute.assert_called_once()
        
        job = scheduler_instance.active_jobs[job_id]
        assert job.schedule_id == "on_demand"
        assert job.organization_id == sample_organization_id
        assert job.report_type == "security"
        assert job.format == ReportFormat.HTML
        assert job.parameters["time_range"] == "1M"
        assert job.parameters["include_remediation"] == True
        
        delivery_config = job.delivery_config
        assert DeliveryMethod.EMAIL in delivery_config["methods"]
        assert DeliveryMethod.WEBHOOK in delivery_config["methods"]
        assert delivery_config["recipients"] == ["admin@test.com", "https://api.example.com/webhook"]

    @pytest.mark.asyncio
    async def test_get_schedule_status_success(self, scheduler_instance, sample_organization_id):
        """Test getting schedule status."""
        schedule_id = await scheduler_instance.create_schedule(
            organization_id=sample_organization_id,
            report_type="compliance",
            frequency=ScheduleFrequency.WEEKLY,
            created_by="test_user"
        )
        
        status = await scheduler_instance.get_schedule_status(schedule_id)
        
        assert status is not None
        assert status["schedule_id"] == schedule_id
        assert status["organization_id"] == str(sample_organization_id)
        assert status["report_type"] == "compliance"
        assert status["frequency"] == "weekly"
        assert status["is_active"] == True
        assert status["created_by"] == "test_user"
        assert "next_run" in status
        assert "created_at" in status

    @pytest.mark.asyncio
    async def test_get_schedule_status_nonexistent(self, scheduler_instance):
        """Test getting status for non-existent schedule."""
        status = await scheduler_instance.get_schedule_status("nonexistent-schedule")
        assert status is None

    @pytest.mark.asyncio
    async def test_get_job_status_success(self, scheduler_instance):
        """Test getting job status."""
        job_id = "test-job-123"
        org_id = uuid4()
        
        job = ReportJob(
            job_id=job_id,
            schedule_id="test-schedule",
            organization_id=org_id,
            report_type="executive",
            format=ReportFormat.PDF,
            parameters={"time_range": "3M"},
            delivery_config={"methods": [DeliveryMethod.EMAIL], "recipients": []}
        )
        
        scheduler_instance.active_jobs[job_id] = job
        
        status = await scheduler_instance.get_job_status(job_id)
        
        assert status is not None
        assert status["job_id"] == job_id
        assert status["organization_id"] == str(org_id)
        assert status["report_type"] == "executive"
        assert status["status"] == "scheduled"
        assert status["started_at"] is None
        assert status["completed_at"] is None

    @pytest.mark.asyncio
    async def test_get_job_status_nonexistent(self, scheduler_instance):
        """Test getting status for non-existent job."""
        status = await scheduler_instance.get_job_status("nonexistent-job")
        assert status is None

    @pytest.mark.asyncio
    async def test_list_schedules_all(self, scheduler_instance, sample_organization_id):
        """Test listing all schedules."""
        org2_id = uuid4()
        
        # Create schedules for different organizations
        schedule1_id = await scheduler_instance.create_schedule(
            organization_id=sample_organization_id,
            report_type="compliance",
            frequency=ScheduleFrequency.DAILY
        )
        
        schedule2_id = await scheduler_instance.create_schedule(
            organization_id=org2_id,
            report_type="security",
            frequency=ScheduleFrequency.WEEKLY
        )
        
        schedules = await scheduler_instance.list_schedules()
        
        assert len(schedules) == 2
        schedule_ids = [s["schedule_id"] for s in schedules]
        assert schedule1_id in schedule_ids
        assert schedule2_id in schedule_ids

    @pytest.mark.asyncio
    async def test_list_schedules_filtered_by_organization(self, scheduler_instance, sample_organization_id):
        """Test listing schedules filtered by organization."""
        org2_id = uuid4()
        
        # Create schedules for different organizations
        schedule1_id = await scheduler_instance.create_schedule(
            organization_id=sample_organization_id,
            report_type="compliance",
            frequency=ScheduleFrequency.DAILY
        )
        
        await scheduler_instance.create_schedule(
            organization_id=org2_id,
            report_type="security",
            frequency=ScheduleFrequency.WEEKLY
        )
        
        # Filter by first organization
        schedules = await scheduler_instance.list_schedules(sample_organization_id)
        
        assert len(schedules) == 1
        assert schedules[0]["schedule_id"] == schedule1_id
        assert schedules[0]["organization_id"] == str(sample_organization_id)

    @pytest.mark.asyncio
    async def test_run_scheduled_reports_due_schedules(self, scheduler_instance, sample_organization_id):
        """Test running due scheduled reports."""
        # Create a schedule that's due to run
        schedule_id = await scheduler_instance.create_schedule(
            organization_id=sample_organization_id,
            report_type="compliance",
            frequency=ScheduleFrequency.DAILY
        )
        
        # Manually set next_run to past time to make it due
        schedule = scheduler_instance.schedules[schedule_id]
        schedule.next_run = datetime.utcnow() - timedelta(hours=1)
        
        with patch.object(scheduler_instance, '_execute_scheduled_report', new_callable=AsyncMock) as mock_execute:
            await scheduler_instance.run_scheduled_reports()
            
            mock_execute.assert_called_once_with(schedule)

    @pytest.mark.asyncio
    async def test_run_scheduled_reports_not_due(self, scheduler_instance, sample_organization_id):
        """Test running scheduled reports when none are due."""
        # Create a schedule that's not due yet
        await scheduler_instance.create_schedule(
            organization_id=sample_organization_id,
            report_type="compliance",
            frequency=ScheduleFrequency.DAILY
        )
        
        with patch.object(scheduler_instance, '_execute_scheduled_report', new_callable=AsyncMock) as mock_execute:
            await scheduler_instance.run_scheduled_reports()
            
            # Should not execute any reports
            mock_execute.assert_not_called()

    @pytest.mark.asyncio
    async def test_run_scheduled_reports_inactive_schedules(self, scheduler_instance, sample_organization_id):
        """Test that inactive schedules are not executed."""
        schedule_id = await scheduler_instance.create_schedule(
            organization_id=sample_organization_id,
            report_type="compliance",
            frequency=ScheduleFrequency.DAILY
        )
        
        # Set schedule as inactive and past due
        schedule = scheduler_instance.schedules[schedule_id]
        schedule.is_active = False
        schedule.next_run = datetime.utcnow() - timedelta(hours=1)
        
        with patch.object(scheduler_instance, '_execute_scheduled_report', new_callable=AsyncMock) as mock_execute:
            await scheduler_instance.run_scheduled_reports()
            
            # Should not execute inactive schedules
            mock_execute.assert_not_called()

    @pytest.mark.asyncio
    async def test_execute_scheduled_report_success(self, scheduler_instance, sample_organization_id):
        """Test successful execution of a scheduled report."""
        schedule = ReportSchedule(
            schedule_id="test-schedule",
            organization_id=sample_organization_id,
            report_type="compliance",
            frequency=ScheduleFrequency.WEEKLY,
            format=ReportFormat.PDF,
            delivery_methods=[DeliveryMethod.EMAIL],
            recipients=["admin@test.com"],
            parameters={"framework": "SOX"},
            next_run=datetime.utcnow() - timedelta(hours=1)
        )
        
        with patch.object(scheduler_instance, '_execute_report_job', new_callable=AsyncMock) as mock_execute:
            await scheduler_instance._execute_scheduled_report(schedule)
            
            # Should have created and executed a job
            mock_execute.assert_called_once()
            
            # Should have updated schedule status
            assert schedule.last_status == ReportStatus.COMPLETED
            assert schedule.last_run is not None
            assert schedule.next_run > datetime.utcnow()  # Should be rescheduled

    @pytest.mark.asyncio
    async def test_execute_scheduled_report_failure(self, scheduler_instance, sample_organization_id):
        """Test handling of scheduled report execution failure."""
        schedule = ReportSchedule(
            schedule_id="test-schedule",
            organization_id=sample_organization_id,
            report_type="compliance",
            frequency=ScheduleFrequency.WEEKLY,
            format=ReportFormat.PDF,
            delivery_methods=[DeliveryMethod.EMAIL],
            recipients=["admin@test.com"],
            parameters={},
            next_run=datetime.utcnow() - timedelta(hours=1)
        )
        
        with patch.object(scheduler_instance, '_execute_report_job', new_callable=AsyncMock) as mock_execute:
            mock_execute.side_effect = Exception("Job execution failed")
            
            await scheduler_instance._execute_scheduled_report(schedule)
            
            # Should have marked schedule as failed
            assert schedule.last_status == ReportStatus.FAILED

    def test_calculate_next_run_all_frequencies(self, scheduler_instance):
        """Test next run calculation for all frequencies."""
        base_time = datetime(2024, 6, 15, 12, 0, 0)
        
        test_cases = [
            (ScheduleFrequency.DAILY, timedelta(days=1)),
            (ScheduleFrequency.WEEKLY, timedelta(weeks=1)),
            (ScheduleFrequency.MONTHLY, timedelta(days=30)),
            (ScheduleFrequency.QUARTERLY, timedelta(days=90)),
            (ScheduleFrequency.ANNUALLY, timedelta(days=365)),
            (ScheduleFrequency.ON_DEMAND, timedelta(0))  # Should return same time
        ]
        
        for frequency, expected_delta in test_cases:
            next_run = scheduler_instance._calculate_next_run(frequency, base_time)
            actual_delta = next_run - base_time
            assert actual_delta == expected_delta

    def test_calculate_next_run_default_base_time(self, scheduler_instance):
        """Test next run calculation with default base time."""
        before_call = datetime.utcnow()
        next_run = scheduler_instance._calculate_next_run(ScheduleFrequency.DAILY)
        after_call = datetime.utcnow()
        
        # Should be approximately 1 day from now
        expected_min = before_call + timedelta(days=1) - timedelta(seconds=5)
        expected_max = after_call + timedelta(days=1) + timedelta(seconds=5)
        
        assert expected_min <= next_run <= expected_max

    @pytest.mark.asyncio
    async def test_execute_report_job_compliance_report(self, scheduler_instance):
        """Test executing a compliance report job."""
        job = ReportJob(
            job_id="test-job",
            schedule_id="test-schedule",
            organization_id=uuid4(),
            report_type="compliance",
            format=ReportFormat.JSON,
            parameters={"framework": "ISO27001", "time_range": TimeInterval.MONTH},
            delivery_config={"methods": [DeliveryMethod.EMAIL], "recipients": ["admin@test.com"]}
        )
        
        mock_report_result = {
            "report_data": {"test": "data"},
            "metadata": {"report_id": "test-report-123"}
        }
        
        with patch('udp.reporting.scheduler.get_async_session') as mock_session_ctx, \
             patch('udp.reporting.scheduler.report_generator') as mock_generator, \
             patch.object(scheduler_instance, '_save_report_output', return_value="/tmp/report.json"), \
             patch.object(scheduler_instance, '_deliver_report', new_callable=AsyncMock):
            
            mock_session_ctx.return_value.__aenter__.return_value = AsyncMock()
            mock_generator.generate_compliance_report.return_value = mock_report_result
            
            await scheduler_instance._execute_report_job(job)
            
            # Verify job status progression
            assert job.status == ReportStatus.COMPLETED
            assert job.started_at is not None
            assert job.completed_at is not None
            assert job.output_location == "/tmp/report.json"
            
            # Verify report generator was called correctly
            mock_generator.generate_compliance_report.assert_called_once()
            call_args = mock_generator.generate_compliance_report.call_args
            assert call_args[1]["organization_id"] == job.organization_id
            assert call_args[1]["time_range"] == TimeInterval.MONTH
            assert call_args[1]["format"] == ReportFormat.JSON

    @pytest.mark.asyncio
    async def test_execute_report_job_security_report(self, scheduler_instance):
        """Test executing a security report job."""
        job = ReportJob(
            job_id="security-job",
            schedule_id="security-schedule",
            organization_id=uuid4(),
            report_type="security",
            format=ReportFormat.PDF,
            parameters={"include_remediation": True},
            delivery_config={"methods": [DeliveryMethod.SLACK], "recipients": ["slack-channel"]}
        )
        
        mock_report_result = {
            "report_data": b"PDF content",
            "metadata": {"report_id": "security-report-456"}
        }
        
        with patch('udp.reporting.scheduler.get_async_session') as mock_session_ctx, \
             patch('udp.reporting.scheduler.report_generator') as mock_generator, \
             patch.object(scheduler_instance, '_save_report_output', return_value="/tmp/security.pdf"), \
             patch.object(scheduler_instance, '_deliver_report', new_callable=AsyncMock):
            
            mock_session_ctx.return_value.__aenter__.return_value = AsyncMock()
            mock_generator.generate_security_report.return_value = mock_report_result
            
            await scheduler_instance._execute_report_job(job)
            
            assert job.status == ReportStatus.COMPLETED
            mock_generator.generate_security_report.assert_called_once()

    @pytest.mark.asyncio
    async def test_execute_report_job_executive_report(self, scheduler_instance):
        """Test executing an executive report job."""
        job = ReportJob(
            job_id="exec-job",
            schedule_id="exec-schedule",
            organization_id=uuid4(),
            report_type="executive",
            format=ReportFormat.HTML,
            parameters={"time_range": TimeInterval.QUARTER},
            delivery_config={"methods": [DeliveryMethod.WEBHOOK], "recipients": ["https://api.example.com"]}
        )
        
        mock_report_result = {
            "report_data": "<html>Executive Summary</html>",
            "metadata": {"report_id": "exec-report-789"}
        }
        
        with patch('udp.reporting.scheduler.get_async_session') as mock_session_ctx, \
             patch('udp.reporting.scheduler.report_generator') as mock_generator, \
             patch.object(scheduler_instance, '_save_report_output', return_value="/tmp/executive.html"), \
             patch.object(scheduler_instance, '_deliver_report', new_callable=AsyncMock):
            
            mock_session_ctx.return_value.__aenter__.return_value = AsyncMock()
            mock_generator.generate_executive_summary.return_value = mock_report_result
            
            await scheduler_instance._execute_report_job(job)
            
            assert job.status == ReportStatus.COMPLETED
            mock_generator.generate_executive_summary.assert_called_once()

    @pytest.mark.asyncio
    async def test_execute_report_job_unknown_type(self, scheduler_instance):
        """Test executing job with unknown report type."""
        job = ReportJob(
            job_id="unknown-job",
            schedule_id="unknown-schedule",
            organization_id=uuid4(),
            report_type="unknown_type",
            format=ReportFormat.JSON,
            parameters={},
            delivery_config={"methods": [DeliveryMethod.EMAIL], "recipients": []}
        )
        
        with patch('udp.reporting.scheduler.get_async_session') as mock_session_ctx:
            mock_session_ctx.return_value.__aenter__.return_value = AsyncMock()
            
            with pytest.raises(ValueError, match="Unknown report type: unknown_type"):
                await scheduler_instance._execute_report_job(job)
            
            assert job.status == ReportStatus.FAILED
            assert job.error_message == "Unknown report type: unknown_type"

    @pytest.mark.asyncio
    async def test_execute_report_job_generation_failure(self, scheduler_instance):
        """Test handling of report generation failure."""
        job = ReportJob(
            job_id="fail-job",
            schedule_id="fail-schedule",
            organization_id=uuid4(),
            report_type="compliance",
            format=ReportFormat.JSON,
            parameters={},
            delivery_config={"methods": [DeliveryMethod.EMAIL], "recipients": []}
        )
        
        with patch('udp.reporting.scheduler.get_async_session') as mock_session_ctx, \
             patch('udp.reporting.scheduler.report_generator') as mock_generator:
            
            mock_session_ctx.return_value.__aenter__.return_value = AsyncMock()
            mock_generator.generate_compliance_report.side_effect = Exception("Generation failed")
            
            with pytest.raises(Exception, match="Generation failed"):
                await scheduler_instance._execute_report_job(job)
            
            assert job.status == ReportStatus.FAILED
            assert job.error_message == "Generation failed"
            assert job.completed_at is not None

    @pytest.mark.asyncio
    async def test_deliver_report_multiple_methods(self, scheduler_instance):
        """Test report delivery with multiple methods."""
        job = ReportJob(
            job_id="multi-delivery-job",
            schedule_id="test-schedule",
            organization_id=uuid4(),
            report_type="compliance",
            format=ReportFormat.PDF,
            parameters={},
            delivery_config={
                "methods": [DeliveryMethod.EMAIL, DeliveryMethod.SLACK, DeliveryMethod.WEBHOOK],
                "recipients": ["admin@test.com", "slack-channel", "https://webhook.com"]
            }
        )
        
        report_data = "test report data"
        
        with patch.object(scheduler_instance, '_deliver_via_email', new_callable=AsyncMock) as mock_email, \
             patch.object(scheduler_instance, '_deliver_via_slack', new_callable=AsyncMock) as mock_slack, \
             patch.object(scheduler_instance, '_deliver_via_webhook', new_callable=AsyncMock) as mock_webhook:
            
            await scheduler_instance._deliver_report(job, report_data)
            
            # All delivery methods should have been called
            mock_email.assert_called_once_with(
                job, report_data, job.delivery_config["recipients"]
            )
            mock_slack.assert_called_once_with(
                job, report_data, job.delivery_config["recipients"]
            )
            mock_webhook.assert_called_once_with(
                job, report_data, job.delivery_config["recipients"]
            )

    @pytest.mark.asyncio
    async def test_deliver_report_partial_failure(self, scheduler_instance):
        """Test report delivery with partial failure."""
        job = ReportJob(
            job_id="partial-fail-job",
            schedule_id="test-schedule",
            organization_id=uuid4(),
            report_type="compliance",
            format=ReportFormat.JSON,
            parameters={},
            delivery_config={
                "methods": [DeliveryMethod.EMAIL, DeliveryMethod.SLACK],
                "recipients": ["admin@test.com"]
            }
        )
        
        with patch.object(scheduler_instance, '_deliver_via_email', new_callable=AsyncMock) as mock_email, \
             patch.object(scheduler_instance, '_deliver_via_slack', new_callable=AsyncMock) as mock_slack:
            
            # Email succeeds, Slack fails
            mock_email.return_value = None
            mock_slack.side_effect = Exception("Slack delivery failed")
            
            # Should not raise exception, just log the error
            await scheduler_instance._deliver_report(job, "test data")
            
            mock_email.assert_called_once()
            mock_slack.assert_called_once()

    @pytest.mark.asyncio
    async def test_save_report_output_json(self, scheduler_instance):
        """Test saving JSON report output."""
        job_id = "test-job-123"
        report_data = {"test": "data", "number": 123}
        
        with patch('builtins.open', mock_open()) as mock_file:
            output_path = await scheduler_instance._save_report_output(
                job_id, report_data, ReportFormat.JSON
            )
            
            assert output_path == "/tmp/report_test-job-123.json"
            mock_file.assert_called_once_with("/tmp/report_test-job-123.json", 'w')
            
            # Verify JSON was written
            handle = mock_file()
            written_calls = [call[0][0] for call in handle.write.call_args_list]
            written_content = ''.join(written_calls)
            import json
            parsed_data = json.loads(written_content)
            assert parsed_data == report_data

    @pytest.mark.asyncio
    async def test_save_report_output_other_formats(self, scheduler_instance):
        """Test saving report output in other formats."""
        job_id = "test-job-456"
        report_data = "<html>Test Report</html>"
        
        with patch('builtins.open', mock_open()) as mock_file:
            output_path = await scheduler_instance._save_report_output(
                job_id, report_data, ReportFormat.HTML
            )
            
            assert output_path == "/tmp/report_test-job-456.html"
            mock_file.assert_called_once_with("/tmp/report_test-job-456.html", 'w')
            
            handle = mock_file()
            handle.write.assert_called_once_with(str(report_data))

    def test_delivery_method_implementations(self, scheduler_instance):
        """Test that all delivery methods have implementations."""
        job = Mock()
        report_data = "test data"
        recipients = ["test@example.com"]
        
        # Test that all delivery methods have handler functions
        for method in DeliveryMethod:
            assert method in scheduler_instance.delivery_handlers
            handler = scheduler_instance.delivery_handlers[method]
            assert callable(handler)

    def test_global_report_scheduler_instance(self):
        """Test the global report_scheduler instance."""
        assert report_scheduler is not None
        assert isinstance(report_scheduler, ReportScheduler)
        assert report_scheduler.celery_app is None  # Default
        assert isinstance(report_scheduler.schedules, dict)
        assert isinstance(report_scheduler.active_jobs, dict)


if __name__ == "__main__":
    pytest.main([__file__])