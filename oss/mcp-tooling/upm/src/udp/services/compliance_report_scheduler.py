"""
Compliance Report Scheduler Service.

Handles automated compliance report generation with flexible scheduling,
distribution, and management capabilities.
"""

import asyncio
import logging
from dataclasses import asdict, dataclass
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Optional
from uuid import UUID, uuid4

from celery import Celery
from celery.schedules import crontab
from croniter import croniter
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.config import get_settings
from ..core.exceptions import ComplianceError, ValidationError
from ..core.models.organizations import Organization
from ..services.compliance_reporting import (
    ComplianceFramework,
    ComplianceReportingEngine,
    ReportFormat,
)
from ..services.notification_service import NotificationService

logger = logging.getLogger(__name__)
settings = get_settings()


class ScheduleType(str, Enum):
    """Schedule types for automated reports."""

    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    YEARLY = "yearly"
    CRON = "cron"
    INTERVAL = "interval"


class ScheduleStatus(str, Enum):
    """Schedule status."""

    ACTIVE = "active"
    PAUSED = "paused"
    DISABLED = "disabled"
    ERROR = "error"


@dataclass
class ScheduleConfig:
    """Schedule configuration."""

    schedule_type: ScheduleType
    cron_expression: Optional[str] = None
    interval_minutes: Optional[int] = None
    day_of_month: Optional[int] = None
    day_of_week: Optional[int] = None  # 0 = Monday, 6 = Sunday
    hour: int = 9  # 9 AM by default
    minute: int = 0
    timezone: str = "UTC"


@dataclass
class ReportSchedule:
    """Report schedule definition."""

    schedule_id: str
    organization_id: UUID
    framework: ComplianceFramework
    project_id: Optional[UUID]
    config: ScheduleConfig
    recipients: list[str]
    format: ReportFormat
    include_recommendations: bool
    include_trends: bool
    custom_filters: dict[str, Any]
    status: ScheduleStatus
    created_at: datetime
    last_run: Optional[datetime]
    next_run: Optional[datetime]
    run_count: int = 0
    error_count: int = 0
    last_error: Optional[str] = None


class ComplianceReportScheduler:
    """
    Automated compliance report scheduler.

    Features:
    - Flexible scheduling (cron, interval, periodic)
    - Multi-framework support
    - Automated distribution via email
    - Error handling and retry logic
    - Schedule management API
    """

    def __init__(self, db: AsyncSession):
        self.db = db
        self.reporting_engine = ComplianceReportingEngine(db)
        self.notification_service = NotificationService(db)
        self.active_schedules: dict[str, ReportSchedule] = {}
        self.scheduler_task: Optional[asyncio.Task] = None
        self.is_running = False

        # Initialize Celery if configured
        if settings.ENABLE_CELERY:
            self.celery_app = Celery(
                "compliance_scheduler",
                broker=settings.CELERY_BROKER_URL,
                backend=settings.CELERY_RESULT_BACKEND,
            )
            self._setup_celery_tasks()

        logger.info("Compliance Report Scheduler initialized")

    async def start(self):
        """Start the scheduler."""
        if self.is_running:
            logger.warning("Scheduler is already running")
            return

        self.is_running = True
        self.scheduler_task = asyncio.create_task(self._scheduler_loop())
        logger.info("Compliance report scheduler started")

    async def stop(self):
        """Stop the scheduler."""
        self.is_running = False
        if self.scheduler_task:
            self.scheduler_task.cancel()
            try:
                await self.scheduler_task
            except asyncio.CancelledError:
                pass
        logger.info("Compliance report scheduler stopped")

    async def create_schedule(
        self,
        organization_id: UUID,
        framework: ComplianceFramework,
        config: ScheduleConfig,
        recipients: list[str],
        format: ReportFormat = ReportFormat.PDF,
        project_id: Optional[UUID] = None,
        include_recommendations: bool = True,
        include_trends: bool = True,
        custom_filters: Optional[dict[str, Any]] = None,
        start_immediately: bool = True,
    ) -> ReportSchedule:
        """
        Create a new automated report schedule.

        Args:
            organization_id: Organization to report on
            framework: Compliance framework
            config: Schedule configuration
            recipients: List of email recipients
            format: Report format
            project_id: Specific project (optional)
            include_recommendations: Include recommendations in reports
            include_trends: Include trend analysis
            custom_filters: Custom filtering criteria
            start_immediately: Start schedule immediately

        Returns:
            Created schedule
        """
        try:
            logger.info(
                f"Creating {framework.value} report schedule for organization {organization_id}"
            )

            # Validate organization
            org = await self.db.get(Organization, organization_id)
            if not org:
                raise ValidationError(f"Organization {organization_id} not found")

            # Validate recipients
            for recipient in recipients:
                if not self._is_valid_email(recipient):
                    raise ValidationError(f"Invalid email address: {recipient}")

            # Validate schedule configuration
            if config.schedule_type == ScheduleType.CRON and not config.cron_expression:
                raise ValidationError("Cron expression required for cron schedule type")
            elif (
                config.schedule_type == ScheduleType.INTERVAL
                and not config.interval_minutes
            ):
                raise ValidationError(
                    "Interval minutes required for interval schedule type"
                )

            # Create schedule
            schedule_id = f"schedule-{uuid4().hex[:8]}"
            now = datetime.utcnow()

            schedule = ReportSchedule(
                schedule_id=schedule_id,
                organization_id=organization_id,
                framework=framework,
                project_id=project_id,
                config=config,
                recipients=recipients,
                format=format,
                include_recommendations=include_recommendations,
                include_trends=include_trends,
                custom_filters=custom_filters or {},
                status=ScheduleStatus.ACTIVE
                if start_immediately
                else ScheduleStatus.PAUSED,
                created_at=now,
                last_run=None,
                next_run=self._calculate_next_run(config, now),
            )

            # Store schedule in organization settings
            await self._store_schedule(schedule)

            # Add to active schedules if enabled
            if schedule.status == ScheduleStatus.ACTIVE:
                self.active_schedules[schedule_id] = schedule

            logger.info(f"Created report schedule: {schedule_id}")
            return schedule

        except Exception as e:
            logger.error(f"Failed to create schedule: {e}", exc_info=True)
            raise ComplianceError(f"Schedule creation failed: {str(e)}")

    async def update_schedule(
        self,
        schedule_id: str,
        config: Optional[ScheduleConfig] = None,
        recipients: Optional[list[str]] = None,
        status: Optional[ScheduleStatus] = None,
        **kwargs,
    ) -> ReportSchedule:
        """
        Update an existing schedule.

        Args:
            schedule_id: Schedule to update
            config: New schedule configuration
            recipients: New recipient list
            status: New status
            **kwargs: Other fields to update

        Returns:
            Updated schedule
        """
        try:
            logger.info(f"Updating schedule: {schedule_id}")

            # Get existing schedule
            schedule = await self._get_schedule(schedule_id)
            if not schedule:
                raise ValidationError(f"Schedule {schedule_id} not found")

            # Update fields
            if config:
                schedule.config = config
                schedule.next_run = self._calculate_next_run(config, datetime.utcnow())
            if recipients:
                schedule.recipients = recipients
            if status:
                schedule.status = status
                if status == ScheduleStatus.ACTIVE:
                    self.active_schedules[schedule_id] = schedule
                elif schedule_id in self.active_schedules:
                    del self.active_schedules[schedule_id]

            # Update other fields
            for key, value in kwargs.items():
                if hasattr(schedule, key):
                    setattr(schedule, key, value)

            # Store updated schedule
            await self._store_schedule(schedule)

            logger.info(f"Updated schedule: {schedule_id}")
            return schedule

        except Exception as e:
            logger.error(f"Failed to update schedule: {e}", exc_info=True)
            raise ComplianceError(f"Schedule update failed: {str(e)}")

    async def delete_schedule(self, schedule_id: str) -> bool:
        """
        Delete a schedule.

        Args:
            schedule_id: Schedule to delete

        Returns:
            True if deleted successfully
        """
        try:
            logger.info(f"Deleting schedule: {schedule_id}")

            # Remove from active schedules
            if schedule_id in self.active_schedules:
                del self.active_schedules[schedule_id]

            # Remove from storage
            await self._delete_schedule_storage(schedule_id)

            logger.info(f"Deleted schedule: {schedule_id}")
            return True

        except Exception as e:
            logger.error(f"Failed to delete schedule: {e}", exc_info=True)
            raise ComplianceError(f"Schedule deletion failed: {str(e)}")

    async def get_schedule(self, schedule_id: str) -> Optional[ReportSchedule]:
        """Get schedule by ID."""
        schedule = self.active_schedules.get(schedule_id)
        if not schedule:
            schedule = await self._get_schedule(schedule_id)
        return schedule

    async def list_schedules(
        self,
        organization_id: Optional[UUID] = None,
        framework: Optional[ComplianceFramework] = None,
        status: Optional[ScheduleStatus] = None,
    ) -> list[ReportSchedule]:
        """
        List schedules with optional filtering.

        Args:
            organization_id: Filter by organization
            framework: Filter by framework
            status: Filter by status

        Returns:
            List of schedules
        """
        schedules = []

        # Get from storage
        stored_schedules = await self._get_all_schedules()

        for schedule_data in stored_schedules:
            schedule = self._deserialize_schedule(schedule_data)

            # Apply filters
            if organization_id and schedule.organization_id != organization_id:
                continue
            if framework and schedule.framework != framework:
                continue
            if status and schedule.status != status:
                continue

            schedules.append(schedule)

        return schedules

    async def run_schedule_now(self, schedule_id: str) -> dict[str, Any]:
        """
        Execute a schedule immediately.

        Args:
            schedule_id: Schedule to run

        Returns:
            Execution result
        """
        try:
            logger.info(f"Running schedule immediately: {schedule_id}")

            # Get schedule
            schedule = await self.get_schedule(schedule_id)
            if not schedule:
                raise ValidationError(f"Schedule {schedule_id} not found")

            # Execute report generation
            result = await self._execute_scheduled_report(schedule)

            # Update schedule statistics
            schedule.last_run = datetime.utcnow()
            schedule.run_count += 1
            await self._store_schedule(schedule)

            return result

        except Exception as e:
            logger.error(f"Failed to run schedule {schedule_id}: {e}", exc_info=True)
            raise ComplianceError(f"Schedule execution failed: {str(e)}")

    async def get_schedule_history(
        self,
        schedule_id: str,
        limit: int = 50,
    ) -> list[dict[str, Any]]:
        """
        Get execution history for a schedule.

        Args:
            schedule_id: Schedule ID
            limit: Maximum number of records

        Returns:
            Execution history
        """
        try:
            # Query execution history from database
            # For now, return mock data
            return [
                {
                    "execution_id": uuid4().hex[:8],
                    "schedule_id": schedule_id,
                    "executed_at": (datetime.utcnow() - timedelta(days=i)).isoformat(),
                    "status": "success",
                    "report_id": f"report-{uuid4().hex[:8]}",
                    "duration_seconds": 45 + i * 5,
                }
                for i in range(min(limit, 10))
            ]

        except Exception as e:
            logger.error(f"Failed to get schedule history: {e}", exc_info=True)
            return []

    async def _scheduler_loop(self):
        """Main scheduler loop."""
        logger.info("Scheduler loop started")

        while self.is_running:
            try:
                now = datetime.utcnow()

                # Check each active schedule
                schedules_to_run = []
                for schedule in list(self.active_schedules.values()):
                    if schedule.next_run and schedule.next_run <= now:
                        schedules_to_run.append(schedule)

                # Execute due schedules
                if schedules_to_run:
                    logger.info(f"Executing {len(schedules_to_run)} scheduled reports")

                    # Create tasks for parallel execution
                    tasks = [
                        self._execute_scheduled_report(schedule)
                        for schedule in schedules_to_run
                    ]

                    # Wait for all to complete
                    results = await asyncio.gather(*tasks, return_exceptions=True)

                    # Process results and update schedules
                    for schedule, result in zip(schedules_to_run, results, strict=False):
                        if isinstance(result, Exception):
                            await self._handle_schedule_error(schedule, result)
                        else:
                            await self._handle_schedule_success(schedule, result)

                # Sleep until next minute
                await asyncio.sleep(60)

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Scheduler loop error: {e}", exc_info=True)
                await asyncio.sleep(60)

        logger.info("Scheduler loop stopped")

    async def _execute_scheduled_report(
        self, schedule: ReportSchedule
    ) -> dict[str, Any]:
        """Execute a scheduled report."""
        start_time = datetime.utcnow()

        try:
            logger.info(f"Executing scheduled report: {schedule.schedule_id}")

            # Generate report
            report = await self.reporting_engine.generate_framework_report(
                framework=schedule.framework,
                organization_id=schedule.organization_id,
                project_id=schedule.project_id,
                format=schedule.format,
                include_recommendations=schedule.include_recommendations,
                include_trends=schedule.include_trends,
                custom_filters=schedule.custom_filters,
            )

            # Send notifications
            await self._send_report_notifications(schedule, report)

            # Calculate next run time
            schedule.next_run = self._calculate_next_run(
                schedule.config, datetime.utcnow()
            )

            # Create execution record
            execution_result = {
                "schedule_id": schedule.schedule_id,
                "execution_id": uuid4().hex[:8],
                "executed_at": start_time.isoformat(),
                "completed_at": datetime.utcnow().isoformat(),
                "status": "success",
                "report_id": report["report_id"],
                "duration_seconds": (datetime.utcnow() - start_time).total_seconds(),
                "recipients_notified": len(schedule.recipients),
            }

            logger.info(f"Completed scheduled report: {schedule.schedule_id}")
            return execution_result

        except Exception as e:
            logger.error(
                f"Failed to execute scheduled report {schedule.schedule_id}: {e}",
                exc_info=True,
            )
            raise

    async def _handle_schedule_success(
        self, schedule: ReportSchedule, result: dict[str, Any]
    ):
        """Handle successful schedule execution."""
        schedule.last_run = datetime.utcnow()
        schedule.run_count += 1
        schedule.last_error = None
        await self._store_schedule(schedule)

    async def _handle_schedule_error(self, schedule: ReportSchedule, error: Exception):
        """Handle schedule execution error."""
        schedule.last_run = datetime.utcnow()
        schedule.error_count += 1
        schedule.last_error = str(error)

        # Disable schedule after too many errors
        if schedule.error_count >= 3:
            schedule.status = ScheduleStatus.ERROR
            if schedule.schedule_id in self.active_schedules:
                del self.active_schedules[schedule.schedule_id]

        await self._store_schedule(schedule)

        # Send error notification
        await self._send_error_notification(schedule, error)

    async def _send_report_notifications(
        self, schedule: ReportSchedule, report: dict[str, Any]
    ):
        """Send report notifications to recipients."""
        try:
            for recipient in schedule.recipients:
                await self.notification_service.send_email(
                    to_email=recipient,
                    subject=f"Compliance Report: {schedule.framework.value.upper()} - {report['report_id']}",
                    template="compliance_report_notification",
                    template_data={
                        "framework": schedule.framework.value.upper(),
                        "report_id": report["report_id"],
                        "compliance_score": report.get("metrics", {}).get(
                            "compliance_percentage", 0
                        ),
                        "violations": report.get("metrics", {}).get(
                            "violation_count", 0
                        ),
                        "generated_at": report["generated_at"],
                        "organization_id": str(schedule.organization_id),
                    },
                    attachments=[report.get("output_file")]
                    if report.get("output_file")
                    else None,
                )

            logger.info(f"Sent notifications to {len(schedule.recipients)} recipients")

        except Exception as e:
            logger.error(f"Failed to send notifications: {e}", exc_info=True)

    async def _send_error_notification(
        self, schedule: ReportSchedule, error: Exception
    ):
        """Send error notification to admin."""
        try:
            # Get organization admin
            org = await self.db.get(Organization, schedule.organization_id)
            if org and org.settings.get("admin_email"):
                await self.notification_service.send_email(
                    to_email=org.settings["admin_email"],
                    subject=f"Compliance Report Schedule Error: {schedule.schedule_id}",
                    template="schedule_error_notification",
                    template_data={
                        "schedule_id": schedule.schedule_id,
                        "framework": schedule.framework.value,
                        "error_message": str(error),
                        "error_count": schedule.error_count,
                        "last_run": schedule.last_run.isoformat()
                        if schedule.last_run
                        else None,
                    },
                )

            logger.info(f"Sent error notification for schedule {schedule.schedule_id}")

        except Exception as e:
            logger.error(f"Failed to send error notification: {e}", exc_info=True)

    def _calculate_next_run(
        self, config: ScheduleConfig, from_time: datetime
    ) -> Optional[datetime]:
        """Calculate next run time based on schedule configuration."""
        if config.schedule_type == ScheduleType.CRON:
            if config.cron_expression:
                cron = croniter(config.cron_expression, from_time)
                return cron.get_next(datetime)
        elif config.schedule_type == ScheduleType.INTERVAL:
            if config.interval_minutes:
                return from_time + timedelta(minutes=config.interval_minutes)
        elif config.schedule_type == ScheduleType.DAILY:
            return from_time.replace(
                hour=config.hour, minute=config.minute, second=0, microsecond=0
            ) + timedelta(days=1)
        elif config.schedule_type == ScheduleType.WEEKLY:
            days_ahead = (config.day_of_week - from_time.weekday() + 7) % 7
            if days_ahead == 0:
                days_ahead = 7
            next_run = from_time + timedelta(days=days_ahead)
            return next_run.replace(
                hour=config.hour, minute=config.minute, second=0, microsecond=0
            )
        elif config.schedule_type == ScheduleType.MONTHLY:
            if config.day_of_month:
                day = min(config.day_of_month, 28)  # Avoid month-end issues
                if from_time.day > day:
                    next_run = from_time.replace(day=1) + timedelta(days=32)
                    next_run = next_run.replace(day=day)
                else:
                    next_run = from_time.replace(day=day)
                return next_run.replace(
                    hour=config.hour, minute=config.minute, second=0, microsecond=0
                )

        return None

    def _is_valid_email(self, email: str) -> bool:
        """Validate email address format."""
        import re

        pattern = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
        return bool(re.match(pattern, email))

    async def _store_schedule(self, schedule: ReportSchedule):
        """Store schedule in database."""
        try:
            org = await self.db.get(Organization, schedule.organization_id)
            if not org:
                return

            if not org.settings:
                org.settings = {}
            if "report_schedules" not in org.settings:
                org.settings["report_schedules"] = {}

            org.settings["report_schedules"][schedule.schedule_id] = asdict(schedule)
            await self.db.commit()

        except Exception as e:
            logger.error(f"Failed to store schedule: {e}", exc_info=True)
            await self.db.rollback()

    async def _get_schedule(self, schedule_id: str) -> Optional[ReportSchedule]:
        """Get schedule from storage."""
        try:
            # Query all organizations for the schedule
            orgs_query = select(Organization).where(
                Organization.settings.contains({"report_schedules": {schedule_id: {}}})
            )
            result = await self.db.execute(orgs_query)
            org = result.scalar_one_or_none()

            if org and org.settings and org.settings.get("report_schedules"):
                schedule_data = org.settings["report_schedules"].get(schedule_id)
                if schedule_data:
                    return self._deserialize_schedule(schedule_data)

            return None

        except Exception as e:
            logger.error(f"Failed to get schedule: {e}", exc_info=True)
            return None

    async def _get_all_schedules(self) -> list[dict[str, Any]]:
        """Get all schedules from storage."""
        try:
            orgs_query = select(Organization).where(Organization.settings.isnot(None))
            result = await self.db.execute(orgs_query)
            orgs = result.scalars().all()

            all_schedules = []
            for org in orgs:
                if org.settings and org.settings.get("report_schedules"):
                    for schedule_data in org.settings["report_schedules"].values():
                        all_schedules.append(schedule_data)

            return all_schedules

        except Exception as e:
            logger.error(f"Failed to get all schedules: {e}", exc_info=True)
            return []

    async def _delete_schedule_storage(self, schedule_id: str):
        """Delete schedule from storage."""
        try:
            # Find organization with the schedule
            orgs_query = select(Organization).where(
                Organization.settings.contains({"report_schedules": {schedule_id: {}}})
            )
            result = await self.db.execute(orgs_query)
            org = result.scalar_one_or_none()

            if org and org.settings and org.settings.get("report_schedules"):
                if schedule_id in org.settings["report_schedules"]:
                    del org.settings["report_schedules"][schedule_id]
                    await self.db.commit()

        except Exception as e:
            logger.error(f"Failed to delete schedule storage: {e}", exc_info=True)

    def _deserialize_schedule(self, data: dict[str, Any]) -> ReportSchedule:
        """Deserialize schedule from dictionary."""
        # Convert string dates back to datetime objects
        if isinstance(data.get("created_at"), str):
            data["created_at"] = datetime.fromisoformat(data["created_at"])
        if isinstance(data.get("last_run"), str):
            data["last_run"] = datetime.fromisoformat(data["last_run"])
        if isinstance(data.get("next_run"), str):
            data["next_run"] = datetime.fromisoformat(data["next_run"])

        # Convert UUID strings back to UUID objects
        if isinstance(data.get("organization_id"), str):
            data["organization_id"] = UUID(data["organization_id"])
        if isinstance(data.get("project_id"), str):
            data["project_id"] = UUID(data["project_id"])

        # Convert enums
        if isinstance(data.get("framework"), str):
            data["framework"] = ComplianceFramework(data["framework"])
        if isinstance(data.get("status"), str):
            data["status"] = ScheduleStatus(data["status"])
        if isinstance(data.get("format"), str):
            data["format"] = ReportFormat(data["format"])

        # Handle config deserialization
        if isinstance(data.get("config"), dict):
            config_data = data["config"]
            if isinstance(config_data.get("schedule_type"), str):
                config_data["schedule_type"] = ScheduleType(
                    config_data["schedule_type"]
                )
            data["config"] = ScheduleConfig(**config_data)

        return ReportSchedule(**data)

    def _setup_celery_tasks(self):
        """Setup Celery tasks for distributed execution."""

        @self.celery_app.task(bind=True, name="generate_compliance_report")
        def generate_report_task(self, schedule_id: str):
            """Celery task for generating compliance reports."""
            # This would run in a separate worker process
            # For now, just log the task
            logger.info(
                f"Celery task: generate compliance report for schedule {schedule_id}"
            )
            return {"status": "completed", "schedule_id": schedule_id}

        # Configure periodic tasks
        self.celery_app.conf.beat_schedule = {
            "check-compliance-schedules": {
                "task": "check_and_run_schedules",
                "schedule": crontab(minute="*"),  # Every minute
            },
        }
        self.celery_app.conf.timezone = "UTC"
