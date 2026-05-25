"""
Universal Dependency Platform - Report Scheduler

Enterprise-grade automated report scheduling with configurable
intervals, delivery methods, and stakeholder notifications.
"""

import asyncio
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Callable
from uuid import UUID, uuid4
from enum import Enum
from dataclasses import dataclass, asdict
import json
import structlog

from celery import Celery
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_

from udp.core.database import get_async_session
from udp.reporting.generators import report_generator, ReportFormat
from udp.analytics.engine import TimeInterval
from udp.infrastructure.models import OrganizationModel
from udp.core.config import settings

logger = structlog.get_logger()


class ScheduleFrequency(Enum):
    """Report scheduling frequencies."""
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    ANNUALLY = "annually"
    ON_DEMAND = "on_demand"


class DeliveryMethod(Enum):
    """Report delivery methods."""
    EMAIL = "email"
    SLACK = "slack"
    WEBHOOK = "webhook"
    S3_UPLOAD = "s3_upload"
    SFTP = "sftp"
    API_CALLBACK = "api_callback"


class ReportStatus(Enum):
    """Report generation status."""
    SCHEDULED = "scheduled"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


@dataclass
class ReportSchedule:
    """Report scheduling configuration."""
    schedule_id: str
    organization_id: UUID
    report_type: str  # compliance, security, executive
    frequency: ScheduleFrequency
    format: str
    delivery_methods: List[DeliveryMethod]
    recipients: List[str]  # Email addresses or webhook URLs
    parameters: Dict[str, Any]
    next_run: datetime
    is_active: bool = True
    created_at: datetime = None
    created_by: str = None
    last_run: datetime = None
    last_status: ReportStatus = ReportStatus.SCHEDULED
    
    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.utcnow()


@dataclass
class ReportJob:
    """Individual report generation job."""
    job_id: str
    schedule_id: str
    organization_id: UUID
    report_type: str
    format: str
    parameters: Dict[str, Any]
    delivery_config: Dict[str, Any]
    status: ReportStatus = ReportStatus.SCHEDULED
    created_at: datetime = None
    started_at: datetime = None
    completed_at: datetime = None
    error_message: str = None
    output_location: str = None
    
    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.utcnow()


class ReportScheduler:
    """
    Enterprise report scheduler with automated generation and delivery.
    
    Manages scheduled report generation, handles delivery to multiple
    channels, and provides monitoring and error handling capabilities.
    """
    
    def __init__(self, celery_app: Optional[Celery] = None):
        self.celery_app = celery_app
        self.schedules: Dict[str, ReportSchedule] = {}
        self.active_jobs: Dict[str, ReportJob] = {}
        self.delivery_handlers = {
            DeliveryMethod.EMAIL: self._deliver_via_email,
            DeliveryMethod.SLACK: self._deliver_via_slack,
            DeliveryMethod.WEBHOOK: self._deliver_via_webhook,
            DeliveryMethod.S3_UPLOAD: self._deliver_via_s3,
            DeliveryMethod.API_CALLBACK: self._deliver_via_api_callback
        }
    
    async def create_schedule(
        self,
        organization_id: UUID,
        report_type: str,
        frequency: ScheduleFrequency,
        format: str = ReportFormat.PDF,
        delivery_methods: List[DeliveryMethod] = None,
        recipients: List[str] = None,
        parameters: Dict[str, Any] = None,
        created_by: str = None
    ) -> str:
        """
        Create a new report schedule.
        
        Args:
            organization_id: Organization ID
            report_type: Type of report (compliance, security, executive)
            frequency: Schedule frequency
            format: Output format
            delivery_methods: List of delivery methods
            recipients: List of recipients
            parameters: Report parameters
            created_by: User who created the schedule
            
        Returns:
            Schedule ID
        """
        try:
            schedule_id = str(uuid4())
            
            # Calculate next run time
            next_run = self._calculate_next_run(frequency)
            
            schedule = ReportSchedule(
                schedule_id=schedule_id,
                organization_id=organization_id,
                report_type=report_type,
                frequency=frequency,
                format=format,
                delivery_methods=delivery_methods or [DeliveryMethod.EMAIL],
                recipients=recipients or [],
                parameters=parameters or {},
                next_run=next_run,
                created_by=created_by
            )
            
            self.schedules[schedule_id] = schedule
            
            # Schedule the first run
            if self.celery_app:
                await self._schedule_celery_task(schedule)
            
            logger.info(
                "Report schedule created",
                schedule_id=schedule_id,
                organization_id=str(organization_id),
                report_type=report_type,
                frequency=frequency.value,
                next_run=next_run.isoformat()
            )
            
            return schedule_id
            
        except Exception as e:
            logger.error(
                "Failed to create report schedule",
                organization_id=str(organization_id),
                error=str(e)
            )
            raise
    
    async def update_schedule(
        self,
        schedule_id: str,
        updates: Dict[str, Any]
    ) -> bool:
        """
        Update an existing report schedule.
        
        Args:
            schedule_id: Schedule ID
            updates: Dictionary of fields to update
            
        Returns:
            Success status
        """
        try:
            if schedule_id not in self.schedules:
                raise ValueError(f"Schedule {schedule_id} not found")
            
            schedule = self.schedules[schedule_id]
            
            # Update allowed fields
            allowed_fields = {
                'frequency', 'format', 'delivery_methods', 'recipients',
                'parameters', 'is_active'
            }
            
            for field, value in updates.items():
                if field in allowed_fields:
                    setattr(schedule, field, value)
            
            # Recalculate next run if frequency changed
            if 'frequency' in updates:
                schedule.next_run = self._calculate_next_run(schedule.frequency)
                
                # Reschedule Celery task
                if self.celery_app:
                    await self._schedule_celery_task(schedule)
            
            logger.info(
                "Report schedule updated",
                schedule_id=schedule_id,
                updated_fields=list(updates.keys())
            )
            
            return True
            
        except Exception as e:
            logger.error(
                "Failed to update report schedule",
                schedule_id=schedule_id,
                error=str(e)
            )
            return False
    
    async def delete_schedule(self, schedule_id: str) -> bool:
        """
        Delete a report schedule.
        
        Args:
            schedule_id: Schedule ID
            
        Returns:
            Success status
        """
        try:
            if schedule_id in self.schedules:
                del self.schedules[schedule_id]
                
                # Cancel Celery task if exists
                if self.celery_app:
                    await self._cancel_celery_task(schedule_id)
                
                logger.info("Report schedule deleted", schedule_id=schedule_id)
                return True
            
            return False
            
        except Exception as e:
            logger.error(
                "Failed to delete report schedule",
                schedule_id=schedule_id,
                error=str(e)
            )
            return False
    
    async def generate_report_now(
        self,
        organization_id: UUID,
        report_type: str,
        format: str = ReportFormat.PDF,
        delivery_methods: List[DeliveryMethod] = None,
        recipients: List[str] = None,
        parameters: Dict[str, Any] = None
    ) -> str:
        """
        Generate a report immediately (on-demand).
        
        Args:
            organization_id: Organization ID
            report_type: Type of report
            format: Output format
            delivery_methods: Delivery methods
            recipients: Recipients
            parameters: Report parameters
            
        Returns:
            Job ID
        """
        try:
            job_id = str(uuid4())
            
            job = ReportJob(
                job_id=job_id,
                schedule_id="on_demand",
                organization_id=organization_id,
                report_type=report_type,
                format=format,
                parameters=parameters or {},
                delivery_config={
                    "methods": delivery_methods or [DeliveryMethod.EMAIL],
                    "recipients": recipients or []
                }
            )
            
            self.active_jobs[job_id] = job
            
            # Execute immediately
            await self._execute_report_job(job)
            
            logger.info(
                "On-demand report generated",
                job_id=job_id,
                organization_id=str(organization_id),
                report_type=report_type
            )
            
            return job_id
            
        except Exception as e:
            logger.error(
                "Failed to generate on-demand report",
                organization_id=str(organization_id),
                error=str(e)
            )
            raise
    
    async def get_schedule_status(self, schedule_id: str) -> Optional[Dict[str, Any]]:
        """Get status information for a schedule."""
        if schedule_id not in self.schedules:
            return None
        
        schedule = self.schedules[schedule_id]
        return {
            "schedule_id": schedule_id,
            "organization_id": str(schedule.organization_id),
            "report_type": schedule.report_type,
            "frequency": schedule.frequency.value,
            "is_active": schedule.is_active,
            "next_run": schedule.next_run.isoformat(),
            "last_run": schedule.last_run.isoformat() if schedule.last_run else None,
            "last_status": schedule.last_status.value,
            "created_at": schedule.created_at.isoformat(),
            "created_by": schedule.created_by
        }
    
    async def get_job_status(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Get status information for a job."""
        if job_id not in self.active_jobs:
            return None
        
        job = self.active_jobs[job_id]
        return {
            "job_id": job_id,
            "schedule_id": job.schedule_id,
            "organization_id": str(job.organization_id),
            "report_type": job.report_type,
            "status": job.status.value,
            "created_at": job.created_at.isoformat(),
            "started_at": job.started_at.isoformat() if job.started_at else None,
            "completed_at": job.completed_at.isoformat() if job.completed_at else None,
            "error_message": job.error_message,
            "output_location": job.output_location
        }
    
    async def list_schedules(self, organization_id: Optional[UUID] = None) -> List[Dict[str, Any]]:
        """List all schedules, optionally filtered by organization."""
        schedules = []
        
        for schedule in self.schedules.values():
            if organization_id is None or schedule.organization_id == organization_id:
                schedule_info = await self.get_schedule_status(schedule.schedule_id)
                schedules.append(schedule_info)
        
        return schedules
    
    async def run_scheduled_reports(self) -> None:
        """Run all due scheduled reports."""
        current_time = datetime.utcnow()
        
        for schedule in self.schedules.values():
            if (schedule.is_active and 
                schedule.next_run <= current_time):
                
                try:
                    await self._execute_scheduled_report(schedule)
                except Exception as e:
                    logger.error(
                        "Failed to execute scheduled report",
                        schedule_id=schedule.schedule_id,
                        error=str(e)
                    )
    
    async def _execute_scheduled_report(self, schedule: ReportSchedule) -> None:
        """Execute a scheduled report."""
        job_id = str(uuid4())
        
        job = ReportJob(
            job_id=job_id,
            schedule_id=schedule.schedule_id,
            organization_id=schedule.organization_id,
            report_type=schedule.report_type,
            format=schedule.format,
            parameters=schedule.parameters,
            delivery_config={
                "methods": schedule.delivery_methods,
                "recipients": schedule.recipients
            }
        )
        
        self.active_jobs[job_id] = job
        
        try:
            await self._execute_report_job(job)
            
            # Update schedule for next run
            schedule.last_run = datetime.utcnow()
            schedule.last_status = ReportStatus.COMPLETED
            schedule.next_run = self._calculate_next_run(schedule.frequency, schedule.last_run)
            
        except Exception as e:
            schedule.last_status = ReportStatus.FAILED
            logger.error(
                "Scheduled report execution failed",
                schedule_id=schedule.schedule_id,
                job_id=job_id,
                error=str(e)
            )
    
    async def _execute_report_job(self, job: ReportJob) -> None:
        """Execute a report generation job."""
        try:
            job.status = ReportStatus.RUNNING
            job.started_at = datetime.utcnow()
            
            logger.info(
                "Starting report generation",
                job_id=job.job_id,
                report_type=job.report_type
            )
            
            # Generate the report
            async with get_async_session() as db:
                if job.report_type == "compliance":
                    report_result = await report_generator.generate_compliance_report(
                        db=db,
                        organization_id=job.organization_id,
                        time_range=job.parameters.get("time_range", TimeInterval.MONTH),
                        format=job.format
                    )
                elif job.report_type == "security":
                    report_result = await report_generator.generate_security_report(
                        db=db,
                        organization_id=job.organization_id,
                        time_range=job.parameters.get("time_range", TimeInterval.MONTH),
                        format=job.format
                    )
                elif job.report_type == "executive":
                    report_result = await report_generator.generate_executive_summary(
                        db=db,
                        organization_id=job.organization_id,
                        time_range=job.parameters.get("time_range", TimeInterval.QUARTER),
                        format=job.format
                    )
                else:
                    raise ValueError(f"Unknown report type: {job.report_type}")
            
            # Save report output
            output_location = await self._save_report_output(
                job.job_id, report_result["report_data"], job.format
            )
            job.output_location = output_location
            
            # Deliver report
            await self._deliver_report(job, report_result["report_data"])
            
            job.status = ReportStatus.COMPLETED
            job.completed_at = datetime.utcnow()
            
            logger.info(
                "Report generation completed",
                job_id=job.job_id,
                output_location=output_location
            )
            
        except Exception as e:
            job.status = ReportStatus.FAILED
            job.error_message = str(e)
            job.completed_at = datetime.utcnow()
            
            logger.error(
                "Report generation failed",
                job_id=job.job_id,
                error=str(e)
            )
            raise
    
    async def _deliver_report(self, job: ReportJob, report_data: Any) -> None:
        """Deliver report using configured delivery methods."""
        delivery_methods = job.delivery_config.get("methods", [])
        recipients = job.delivery_config.get("recipients", [])
        
        for method in delivery_methods:
            if method in self.delivery_handlers:
                try:
                    await self.delivery_handlers[method](
                        job, report_data, recipients
                    )
                    logger.info(
                        "Report delivered successfully",
                        job_id=job.job_id,
                        delivery_method=method.value
                    )
                except Exception as e:
                    logger.error(
                        "Report delivery failed",
                        job_id=job.job_id,
                        delivery_method=method.value,
                        error=str(e)
                    )
    
    def _calculate_next_run(
        self, 
        frequency: ScheduleFrequency, 
        base_time: Optional[datetime] = None
    ) -> datetime:
        """Calculate next run time based on frequency."""
        if base_time is None:
            base_time = datetime.utcnow()
        
        if frequency == ScheduleFrequency.DAILY:
            return base_time + timedelta(days=1)
        elif frequency == ScheduleFrequency.WEEKLY:
            return base_time + timedelta(weeks=1)
        elif frequency == ScheduleFrequency.MONTHLY:
            return base_time + timedelta(days=30)
        elif frequency == ScheduleFrequency.QUARTERLY:
            return base_time + timedelta(days=90)
        elif frequency == ScheduleFrequency.ANNUALLY:
            return base_time + timedelta(days=365)
        else:
            return base_time  # ON_DEMAND doesn't have next run
    
    async def _save_report_output(
        self, 
        job_id: str, 
        report_data: Any, 
        format: str
    ) -> str:
        """Save report output to storage."""
        # In production, this would save to S3, local storage, etc.
        filename = f"report_{job_id}.{format.lower()}"
        output_path = f"/tmp/{filename}"  # Simplified for demo
        
        if format == ReportFormat.JSON:
            with open(output_path, 'w') as f:
                json.dump(report_data, f, indent=2)
        else:
            with open(output_path, 'w') as f:
                f.write(str(report_data))
        
        return output_path
    
    # Delivery method implementations (simplified)
    async def _deliver_via_email(self, job: ReportJob, report_data: Any, recipients: List[str]):
        """Deliver report via email."""
        # Would integrate with email service (SendGrid, SES, etc.)
        logger.info(f"Email delivery simulated for job {job.job_id} to {recipients}")
    
    async def _deliver_via_slack(self, job: ReportJob, report_data: Any, recipients: List[str]):
        """Deliver report via Slack."""
        # Would integrate with Slack API
        logger.info(f"Slack delivery simulated for job {job.job_id}")
    
    async def _deliver_via_webhook(self, job: ReportJob, report_data: Any, recipients: List[str]):
        """Deliver report via webhook."""
        # Would make HTTP POST requests
        logger.info(f"Webhook delivery simulated for job {job.job_id} to {recipients}")
    
    async def _deliver_via_s3(self, job: ReportJob, report_data: Any, recipients: List[str]):
        """Deliver report via S3 upload."""
        # Would upload to S3 bucket
        logger.info(f"S3 upload simulated for job {job.job_id}")
    
    async def _deliver_via_api_callback(self, job: ReportJob, report_data: Any, recipients: List[str]):
        """Deliver report via API callback."""
        # Would make API callback with report location
        logger.info(f"API callback simulated for job {job.job_id}")
    
    async def _schedule_celery_task(self, schedule: ReportSchedule):
        """Schedule Celery task for report generation."""
        if self.celery_app:
            # Would schedule periodic Celery task
            logger.info(f"Celery task scheduled for {schedule.schedule_id}")
    
    async def _cancel_celery_task(self, schedule_id: str):
        """Cancel Celery task for schedule."""
        if self.celery_app:
            # Would cancel periodic Celery task
            logger.info(f"Celery task cancelled for {schedule_id}")


# Global scheduler instance
report_scheduler = ReportScheduler()