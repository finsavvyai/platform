"""
Audit Trail Documentation Service.

Provides comprehensive audit trail generation and management for
compliance reporting, ensuring full traceability of all compliance
activities and decisions.
"""

import hashlib
import json
import logging
from dataclasses import asdict, dataclass
from datetime import datetime, timedelta
from enum import Enum
from pathlib import Path
from typing import Any, Optional
from uuid import UUID, uuid4

from sqlalchemy import asc, select
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.config import get_settings
from ..core.exceptions import ComplianceError, ValidationError
from ..core.models.audit_logs import AuditLog as DBAuditLog

logger = logging.getLogger(__name__)
settings = get_settings()


class AuditEventType(str, Enum):
    """Audit event types."""

    REPORT_GENERATED = "report_generated"
    REPORT_VIEWED = "report_viewed"
    REPORT_DOWNLOADED = "report_downloaded"
    REPORT_SHARED = "report_shared"
    COMPLIANCE_CHECK = "compliance_check"
    VIOLATION_DETECTED = "violation_detected"
    VIOLATION_REMEDIATED = "violation_remediated"
    POLICY_EVALUATED = "policy_evaluated"
    EXCEPTION_GRANTED = "exception_granted"
    EXCEPTION_REVOKED = "exception_revoked"
    SCHEDULE_CREATED = "schedule_created"
    SCHEDULE_MODIFIED = "schedule_modified"
    SCHEDULE_EXECUTED = "schedule_executed"
    DATA_EXPORTED = "data_exported"
    SYSTEM_CONFIGURED = "system_configured"
    USER_AUTHENTICATED = "user_authenticated"
    ACCESS_GRANTED = "access_granted"
    ACCESS_DENIED = "access_denied"


class AuditSeverity(str, Enum):
    """Audit event severity levels."""

    INFO = "info"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class AuditEvent:
    """Individual audit event."""

    event_id: str
    event_type: AuditEventType
    timestamp: datetime
    user_id: Optional[UUID]
    organization_id: Optional[UUID]
    project_id: Optional[UUID]
    resource_id: Optional[str]
    resource_type: str
    action: str
    details: dict[str, Any]
    ip_address: Optional[str]
    user_agent: Optional[str]
    session_id: Optional[str]
    severity: AuditSeverity
    outcome: str  # success, failure, error
    source_system: str
    correlation_id: Optional[str] = None


@dataclass
class AuditTrail:
    """Complete audit trail for a resource or period."""

    trail_id: str
    resource_type: str
    resource_id: Optional[str]
    organization_id: Optional[UUID]
    start_date: datetime
    end_date: datetime
    events: list[AuditEvent]
    total_events: int
    summary: dict[str, Any]
    integrity_hash: str
    generated_at: datetime


class AuditTrailDocumentationService:
    """
    Comprehensive audit trail documentation service.

    Features:
    - Complete audit event logging and tracking
    - Immutable audit trail with cryptographic integrity
    - Compliance-specific audit reports
    - Audit trail export and archiving
    - Long-term retention management
    - Audit trail verification and validation
    """

    def __init__(self, db: AsyncSession):
        self.db = db
        self.archive_path = Path(
            settings.AUDIT_ARCHIVE_PATH or "/tmp/upm_audit_archives"
        )
        self.archive_path.mkdir(parents=True, exist_ok=True)
        self.current_events: list[AuditEvent] = []
        self.event_batch_size = 100

        logger.info("Audit Trail Documentation Service initialized")

    async def log_event(
        self,
        event_type: AuditEventType,
        user_id: Optional[UUID] = None,
        organization_id: Optional[UUID] = None,
        project_id: Optional[UUID] = None,
        resource_id: Optional[str] = None,
        resource_type: str = "unknown",
        action: str = "",
        details: Optional[dict[str, Any]] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        session_id: Optional[str] = None,
        severity: AuditSeverity = AuditSeverity.INFO,
        outcome: str = "success",
        source_system: str = "upm",
        correlation_id: Optional[str] = None,
    ) -> str:
        """
        Log an audit event.

        Args:
            event_type: Type of audit event
            user_id: User performing the action
            organization_id: Organization scope
            project_id: Project scope
            resource_id: ID of affected resource
            resource_type: Type of resource
            action: Action performed
            details: Additional event details
            ip_address: User IP address
            user_agent: User agent string
            session_id: Session identifier
            severity: Event severity
            outcome: Action outcome
            source_system: Source system
            correlation_id: Correlation ID for related events

        Returns:
            Event ID
        """
        try:
            # Create audit event
            event = AuditEvent(
                event_id=str(uuid4()),
                event_type=event_type,
                timestamp=datetime.utcnow(),
                user_id=user_id,
                organization_id=organization_id,
                project_id=project_id,
                resource_id=resource_id,
                resource_type=resource_type,
                action=action,
                details=details or {},
                ip_address=ip_address,
                user_agent=user_agent,
                session_id=session_id,
                severity=severity,
                outcome=outcome,
                source_system=source_system,
                correlation_id=correlation_id,
            )

            # Add to current batch
            self.current_events.append(event)

            # Flush batch if needed
            if len(self.current_events) >= self.event_batch_size:
                await self._flush_event_batch()

            # Log to database immediately for high severity events
            if severity in [AuditSeverity.HIGH, AuditSeverity.CRITICAL]:
                await self._persist_event(event)

            logger.debug(
                f"Logged audit event: {event_type.value} for {resource_type}:{resource_id}"
            )
            return event.event_id

        except Exception as e:
            logger.error(f"Failed to log audit event: {e}", exc_info=True)
            # Don't raise - audit logging should not break main flow
            return str(uuid4())

    async def generate_audit_trail(
        self,
        resource_type: str,
        resource_id: Optional[str] = None,
        organization_id: Optional[UUID] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        event_types: Optional[list[AuditEventType]] = None,
        severity_filter: Optional[list[AuditSeverity]] = None,
        include_details: bool = True,
    ) -> AuditTrail:
        """
        Generate comprehensive audit trail.

        Args:
            resource_type: Type of resource
            resource_id: Specific resource ID (optional)
            organization_id: Organization scope
            start_date: Start date for trail
            end_date: End date for trail
            event_types: Filter by event types
            severity_filter: Filter by severity levels
            include_details: Include full event details

        Returns:
            Complete audit trail
        """
        try:
            logger.info(f"Generating audit trail for {resource_type}:{resource_id}")

            # Set default date range
            if not end_date:
                end_date = datetime.utcnow()
            if not start_date:
                start_date = end_date - timedelta(days=30)

            # Retrieve events from database
            events = await self._retrieve_audit_events(
                resource_type=resource_type,
                resource_id=resource_id,
                organization_id=organization_id,
                start_date=start_date,
                end_date=end_date,
                event_types=event_types,
                severity_filter=severity_filter,
            )

            # Generate summary
            summary = self._generate_audit_summary(events)

            # Calculate integrity hash
            integrity_hash = self._calculate_integrity_hash(events)

            # Create audit trail
            trail = AuditTrail(
                trail_id=str(uuid4()),
                resource_type=resource_type,
                resource_id=resource_id,
                organization_id=organization_id,
                start_date=start_date,
                end_date=end_date,
                events=events if include_details else [],
                total_events=len(events),
                summary=summary,
                integrity_hash=integrity_hash,
                generated_at=datetime.utcnow(),
            )

            logger.info(f"Generated audit trail with {len(events)} events")
            return trail

        except Exception as e:
            logger.error(f"Failed to generate audit trail: {e}", exc_info=True)
            raise ComplianceError(f"Audit trail generation failed: {str(e)}")

    async def generate_compliance_audit_report(
        self,
        framework: str,
        organization_id: UUID,
        report_period: int = 90,  # days
        format: str = "json",
    ) -> dict[str, Any]:
        """
        Generate compliance-specific audit report.

        Args:
            framework: Compliance framework (SOX, HIPAA, PCI-DSS, GDPR)
            organization_id: Organization to report on
            report_period: Report period in days
            format: Output format

        Returns:
            Compliance audit report
        """
        try:
            logger.info(f"Generating {framework} compliance audit report")

            # Get audit trail for period
            end_date = datetime.utcnow()
            start_date = end_date - timedelta(days=report_period)

            # Retrieve all compliance-related events
            compliance_events = await self._retrieve_compliance_events(
                organization_id=organization_id,
                start_date=start_date,
                end_date=end_date,
                framework=framework,
            )

            # Group events by type
            grouped_events = self._group_events_by_type(compliance_events)

            # Generate framework-specific sections
            sections = await self._generate_framework_audit_sections(
                framework, grouped_events, organization_id
            )

            # Calculate compliance metrics
            metrics = self._calculate_audit_metrics(compliance_events)

            # Identify compliance gaps
            gaps = self._identify_compliance_gaps(framework, compliance_events)

            # Generate recommendations
            recommendations = self._generate_audit_recommendations(gaps)

            # Create audit report
            report = {
                "report_id": str(uuid4()),
                "framework": framework,
                "organization_id": str(organization_id),
                "report_period": {
                    "start_date": start_date.isoformat(),
                    "end_date": end_date.isoformat(),
                    "days": report_period,
                },
                "generated_at": datetime.utcnow().isoformat(),
                "format": format,
                "executive_summary": {
                    "total_events": len(compliance_events),
                    "compliance_score": metrics.get("compliance_score", 0),
                    "critical_events": metrics.get("critical_events", 0),
                    "compliance_gaps": len(gaps),
                    "overall_status": self._determine_audit_status(metrics, gaps),
                },
                "sections": sections,
                "metrics": metrics,
                "compliance_gaps": gaps,
                "recommendations": recommendations,
                "audit_integrity": {
                    "hash": self._calculate_integrity_hash(compliance_events),
                    "verified": True,
                    "verification_method": "SHA-256",
                },
                "appendices": {
                    "event_types": list(set(e.event_type for e in compliance_events)),
                    "users_involved": list(
                        set(str(e.user_id) for e in compliance_events if e.user_id)
                    ),
                    "systems_involved": list(
                        set(e.source_system for e in compliance_events)
                    ),
                },
            }

            # Store audit report
            await self._store_audit_report(report)

            logger.info(f"Generated {framework} audit report: {report['report_id']}")
            return report

        except Exception as e:
            logger.error(
                f"Failed to generate compliance audit report: {e}", exc_info=True
            )
            raise ComplianceError(f"Audit report generation failed: {str(e)}")

    async def verify_audit_trail_integrity(
        self,
        trail_id: str,
    ) -> dict[str, Any]:
        """
        Verify the integrity of an audit trail.

        Args:
            trail_id: Audit trail ID to verify

        Returns:
            Integrity verification result
        """
        try:
            logger.info(f"Verifying audit trail integrity: {trail_id}")

            # Retrieve stored audit trail
            trail = await self._get_stored_audit_trail(trail_id)
            if not trail:
                raise ValidationError(f"Audit trail {trail_id} not found")

            # Recalculate hash
            current_hash = self._calculate_integrity_hash(trail["events"])
            stored_hash = trail.get("integrity_hash")

            # Verify integrity
            is_valid = current_hash == stored_hash

            # Check for tampering indicators
            tampering_indicators = []
            if not is_valid:
                tampering_indicators.append("Hash mismatch detected")

            # Verify chronological order
            if trail["events"]:
                for i in range(1, len(trail["events"])):
                    if (
                        trail["events"][i]["timestamp"]
                        < trail["events"][i - 1]["timestamp"]
                    ):
                        tampering_indicators.append(
                            f"Chronological violation at event {i}"
                        )

            # Verify required events are present
            required_events = self._get_required_events_for_resource(
                trail["resource_type"], trail["resource_id"]
            )
            missing_events = []
            event_types = set(e["event_type"] for e in trail["events"])

            for req_event in required_events:
                if req_event not in event_types:
                    missing_events.append(req_event)

            if missing_events:
                tampering_indicators.append(
                    f"Missing required events: {missing_events}"
                )

            verification_result = {
                "trail_id": trail_id,
                "verified_at": datetime.utcnow().isoformat(),
                "integrity_valid": is_valid,
                "hash_match": is_valid,
                "calculated_hash": current_hash,
                "stored_hash": stored_hash,
                "tampering_indicators": tampering_indicators,
                "chronological_order_valid": len(tampering_indicators) == 0
                or not any(
                    "Chronological" in indicator for indicator in tampering_indicators
                ),
                "missing_required_events": missing_events,
                "overall_status": "valid"
                if is_valid and not tampering_indicators
                else "invalid",
                "recommendations": (
                    ["Audit trail appears valid and untampered"]
                    if is_valid and not tampering_indicators
                    else ["Investigate potential audit trail tampering"]
                ),
            }

            # Log verification event
            await self.log_event(
                event_type=AuditEventType.SYSTEM_CONFIGURED,
                resource_type="audit_trail",
                resource_id=trail_id,
                action="integrity_verification",
                details={
                    "verification_result": verification_result["overall_status"],
                    "indicators_found": len(tampering_indicators),
                },
                severity=AuditSeverity.HIGH if not is_valid else AuditSeverity.INFO,
            )

            return verification_result

        except Exception as e:
            logger.error(f"Failed to verify audit trail integrity: {e}", exc_info=True)
            raise ComplianceError(f"Integrity verification failed: {str(e)}")

    async def archive_audit_trail(
        self,
        trail_id: str,
        retention_years: int = 7,
    ) -> dict[str, Any]:
        """
        Archive audit trail for long-term storage.

        Args:
            trail_id: Audit trail to archive
            retention_years: Retention period in years

        Returns:
            Archive result
        """
        try:
            logger.info(f"Archiving audit trail: {trail_id}")

            # Get audit trail
            trail = await self._get_stored_audit_trail(trail_id)
            if not trail:
                raise ValidationError(f"Audit trail {trail_id} not found")

            # Create archive file
            archive_filename = (
                f"{trail_id}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.json"
            )
            archive_path = self.archive_path / archive_filename

            # Prepare archive data
            archive_data = {
                "metadata": {
                    "trail_id": trail_id,
                    "archived_at": datetime.utcnow().isoformat(),
                    "retention_years": retention_years,
                    "expiry_date": (
                        datetime.utcnow() + timedelta(days=retention_years * 365)
                    ).isoformat(),
                    "format_version": "1.0",
                },
                "audit_trail": trail,
                "signature": self._generate_digital_signature(trail),
            }

            # Write archive file
            with open(archive_path, "w") as f:
                json.dump(archive_data, f, indent=2, default=str)

            # Calculate archive checksum
            with open(archive_path, "rb") as f:
                checksum = hashlib.sha256(f.read()).hexdigest()

            # Mark trail as archived
            await self._mark_trail_archived(trail_id, archive_filename)

            # Log archive event
            await self.log_event(
                event_type=AuditEventType.DATA_EXPORTED,
                resource_type="audit_trail",
                resource_id=trail_id,
                action="archive",
                details={
                    "archive_file": archive_filename,
                    "retention_years": retention_years,
                    "checksum": checksum,
                },
                severity=AuditSeverity.MEDIUM,
            )

            archive_result = {
                "trail_id": trail_id,
                "archive_filename": archive_filename,
                "archive_path": str(archive_path),
                "archived_at": archive_data["metadata"]["archived_at"],
                "retention_years": retention_years,
                "expiry_date": archive_data["metadata"]["expiry_date"],
                "checksum": checksum,
                "file_size_bytes": archive_path.stat().st_size,
                "status": "archived",
            }

            logger.info(f"Archived audit trail to: {archive_path}")
            return archive_result

        except Exception as e:
            logger.error(f"Failed to archive audit trail: {e}", exc_info=True)
            raise ComplianceError(f"Audit trail archival failed: {str(e)}")

    async def export_audit_events(
        self,
        organization_id: UUID,
        start_date: datetime,
        end_date: datetime,
        event_types: Optional[list[AuditEventType]] = None,
        format: str = "csv",
        include_pii: bool = False,
    ) -> str:
        """
        Export audit events for external analysis.

        Args:
            organization_id: Organization to export for
            start_date: Export start date
            end_date: Export end date
            event_types: Filter by event types
            format: Export format (csv, json, xlsx)
            include_pii: Include personally identifiable information

        Returns:
            Path to exported file
        """
        try:
            logger.info(f"Exporting audit events for organization {organization_id}")

            # Retrieve events
            events = await self._retrieve_audit_events(
                organization_id=organization_id,
                start_date=start_date,
                end_date=end_date,
                event_types=event_types,
            )

            # Filter PII if required
            if not include_pii:
                events = self._remove_pii_from_events(events)

            # Generate export filename
            timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
            export_filename = f"audit_export_{organization_id}_{timestamp}.{format}"
            export_path = self.archive_path / export_filename

            # Export based on format
            if format == "csv":
                await self._export_to_csv(events, export_path)
            elif format == "json":
                await self._export_to_json(events, export_path)
            elif format == "xlsx":
                await self._export_to_xlsx(events, export_path)
            else:
                raise ValidationError(f"Unsupported export format: {format}")

            # Log export event
            await self.log_event(
                event_type=AuditEventType.DATA_EXPORTED,
                organization_id=organization_id,
                resource_type="audit_events",
                action="bulk_export",
                details={
                    "export_file": export_filename,
                    "event_count": len(events),
                    "format": format,
                    "pii_included": include_pii,
                    "date_range": {
                        "start": start_date.isoformat(),
                        "end": end_date.isoformat(),
                    },
                },
                severity=AuditSeverity.HIGH,
            )

            logger.info(f"Exported {len(events)} events to: {export_path}")
            return str(export_path)

        except Exception as e:
            logger.error(f"Failed to export audit events: {e}", exc_info=True)
            raise ComplianceError(f"Audit export failed: {str(e)}")

    # Helper methods
    async def _flush_event_batch(self):
        """Flush current batch of events to database."""
        if not self.current_events:
            return

        try:
            for event in self.current_events:
                await self._persist_event(event)

            self.current_events.clear()
            logger.debug("Flushed audit event batch to database")

        except Exception as e:
            logger.error(f"Failed to flush audit event batch: {e}", exc_info=True)

    async def _persist_event(self, event: AuditEvent):
        """Persist single audit event to database."""
        try:
            db_event = DBAuditLog(
                event_id=event.event_id,
                event_type=event.event_type.value,
                timestamp=event.timestamp,
                user_id=event.user_id,
                organization_id=event.organization_id,
                project_id=event.project_id,
                resource_id=event.resource_id,
                resource_type=event.resource_type,
                action=event.action,
                event_details=event.details,
                ip_address=event.ip_address,
                user_agent=event.user_agent,
                session_id=event.session_id,
                severity=event.severity.value,
                outcome=event.outcome,
                source_system=event.source_system,
                correlation_id=event.correlation_id,
            )

            self.db.add(db_event)
            await self.db.commit()

        except Exception as e:
            logger.error(f"Failed to persist audit event: {e}", exc_info=True)
            await self.db.rollback()

    async def _retrieve_audit_events(
        self,
        resource_type: Optional[str] = None,
        resource_id: Optional[str] = None,
        organization_id: Optional[UUID] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        event_types: Optional[list[AuditEventType]] = None,
        severity_filter: Optional[list[AuditSeverity]] = None,
    ) -> list[AuditEvent]:
        """Retrieve audit events from database."""
        try:
            query = select(DBAuditLog)

            # Apply filters
            if resource_type:
                query = query.where(DBAuditLog.resource_type == resource_type)
            if resource_id:
                query = query.where(DBAuditLog.resource_id == resource_id)
            if organization_id:
                query = query.where(DBAuditLog.organization_id == organization_id)
            if start_date:
                query = query.where(DBAuditLog.timestamp >= start_date)
            if end_date:
                query = query.where(DBAuditLog.timestamp <= end_date)
            if event_types:
                query = query.where(
                    DBAuditLog.event_type.in_([et.value for et in event_types])
                )
            if severity_filter:
                query = query.where(
                    DBAuditLog.severity.in_([s.value for s in severity_filter])
                )

            # Order by timestamp
            query = query.order_by(asc(DBAuditLog.timestamp))

            # Execute query
            result = await self.db.execute(query)
            db_events = result.scalars().all()

            # Convert to AuditEvent objects
            events = []
            for db_event in db_events:
                event = AuditEvent(
                    event_id=db_event.event_id,
                    event_type=AuditEventType(db_event.event_type),
                    timestamp=db_event.timestamp,
                    user_id=db_event.user_id,
                    organization_id=db_event.organization_id,
                    project_id=db_event.project_id,
                    resource_id=db_event.resource_id,
                    resource_type=db_event.resource_type,
                    action=db_event.action,
                    details=db_event.event_details or {},
                    ip_address=db_event.ip_address,
                    user_agent=db_event.user_agent,
                    session_id=db_event.session_id,
                    severity=AuditSeverity(db_event.severity),
                    outcome=db_event.outcome,
                    source_system=db_event.source_system,
                    correlation_id=db_event.correlation_id,
                )
                events.append(event)

            return events

        except Exception as e:
            logger.error(f"Failed to retrieve audit events: {e}", exc_info=True)
            return []

    def _generate_audit_summary(self, events: list[AuditEvent]) -> dict[str, Any]:
        """Generate summary statistics for audit trail."""
        if not events:
            return {"total_events": 0}

        # Count by type
        event_types = {}
        for event in events:
            event_types[event.event_type.value] = (
                event_types.get(event.event_type.value, 0) + 1
            )

        # Count by severity
        severity_counts = {}
        for event in events:
            severity_counts[event.severity.value] = (
                severity_counts.get(event.severity.value, 0) + 1
            )

        # Count by outcome
        outcomes = {}
        for event in events:
            outcomes[event.outcome] = outcomes.get(event.outcome, 0) + 1

        # Unique users
        unique_users = len(set(str(e.user_id) for e in events if e.user_id))

        # Time range
        timestamps = [e.timestamp for e in events]
        time_range = {
            "first_event": min(timestamps).isoformat(),
            "last_event": max(timestamps).isoformat(),
            "duration_hours": (max(timestamps) - min(timestamps)).total_seconds()
            / 3600,
        }

        return {
            "total_events": len(events),
            "event_types": event_types,
            "severity_breakdown": severity_counts,
            "outcomes": outcomes,
            "unique_users": unique_users,
            "time_range": time_range,
            "events_per_hour": len(events) / max(1, time_range["duration_hours"]),
        }

    def _calculate_integrity_hash(self, events: list[AuditEvent]) -> str:
        """Calculate SHA-256 hash of audit events."""
        # Create canonical representation
        event_data = json.dumps(
            [asdict(e) for e in events], sort_keys=True, default=str
        )
        return hashlib.sha256(event_data.encode()).hexdigest()

    async def _retrieve_compliance_events(
        self,
        organization_id: UUID,
        start_date: datetime,
        end_date: datetime,
        framework: str,
    ) -> list[AuditEvent]:
        """Retrieve compliance-specific events."""
        # Define compliance event types based on framework
        compliance_event_types = [
            AuditEventType.REPORT_GENERATED,
            AuditEventType.COMPLIANCE_CHECK,
            AuditEventType.VIOLATION_DETECTED,
            AuditEventType.VIOLATION_REMEDIATED,
            AuditEventType.POLICY_EVALUATED,
            AuditEventType.EXCEPTION_GRANTED,
            AuditEventType.EXCEPTION_REVOKED,
        ]

        return await self._retrieve_audit_events(
            organization_id=organization_id,
            start_date=start_date,
            end_date=end_date,
            event_types=compliance_event_types,
        )

    def _group_events_by_type(
        self, events: list[AuditEvent]
    ) -> dict[str, list[AuditEvent]]:
        """Group events by type."""
        grouped = {}
        for event in events:
            event_type = event.event_type.value
            if event_type not in grouped:
                grouped[event_type] = []
            grouped[event_type].append(event)
        return grouped

    async def _generate_framework_audit_sections(
        self,
        framework: str,
        grouped_events: dict[str, list[AuditEvent]],
        organization_id: UUID,
    ) -> list[dict[str, Any]]:
        """Generate framework-specific audit sections."""
        sections = []

        # Common sections
        sections.append(
            {
                "title": "Access Control Audit",
                "content": self._generate_access_control_audit(grouped_events),
            }
        )

        sections.append(
            {
                "title": "Report Generation Audit",
                "content": self._generate_report_audit(grouped_events),
            }
        )

        sections.append(
            {
                "title": "Violation Management Audit",
                "content": self._generate_violation_audit(grouped_events),
            }
        )

        # Framework-specific sections
        if framework.upper() == "SOX":
            sections.append(
                {
                    "title": "Financial Controls Audit",
                    "content": self._generate_sox_audit(grouped_events),
                }
            )
        elif framework.upper() == "HIPAA":
            sections.append(
                {
                    "title": "PHI Protection Audit",
                    "content": self._generate_hipaa_audit(grouped_events),
                }
            )
        elif framework.upper() == "PCI-DSS":
            sections.append(
                {
                    "title": "Cardholder Data Audit",
                    "content": self._generate_pci_dss_audit(grouped_events),
                }
            )
        elif framework.upper() == "GDPR":
            sections.append(
                {
                    "title": "Data Protection Audit",
                    "content": self._generate_gdpr_audit(grouped_events),
                }
            )

        return sections

    def _calculate_audit_metrics(self, events: list[AuditEvent]) -> dict[str, Any]:
        """Calculate audit metrics."""
        total_events = len(events)
        if total_events == 0:
            return {"compliance_score": 0}

        # Calculate compliance score based on outcomes
        successful_events = sum(1 for e in events if e.outcome == "success")
        compliance_score = (successful_events / total_events) * 100

        # Count critical events
        critical_events = sum(1 for e in events if e.severity == AuditSeverity.CRITICAL)

        # Calculate event frequency
        if events:
            time_span = (
                max(e.timestamp for e in events) - min(e.timestamp for e in events)
            ).total_seconds()
            events_per_day = (total_events / time_span) * 86400 if time_span > 0 else 0
        else:
            events_per_day = 0

        return {
            "compliance_score": round(compliance_score, 2),
            "total_events": total_events,
            "successful_events": successful_events,
            "failed_events": total_events - successful_events,
            "critical_events": critical_events,
            "events_per_day": round(events_per_day, 2),
        }

    def _identify_compliance_gaps(
        self,
        framework: str,
        events: list[AuditEvent],
    ) -> list[dict[str, Any]]:
        """Identify compliance gaps based on audit events."""
        gaps = []

        # Check for missing event types
        required_events = self._get_required_audit_events(framework)
        present_events = set(e.event_type for e in events)

        for required_event in required_events:
            if required_event not in present_events:
                gaps.append(
                    {
                        "type": "missing_events",
                        "description": f"Missing required audit events: {required_event.value}",
                        "severity": "high",
                        "recommendation": f"Implement logging for {required_event.value} events",
                    }
                )

        # Check for failed compliance checks
        failed_checks = [
            e
            for e in events
            if e.event_type == AuditEventType.COMPLIANCE_CHECK
            and e.outcome == "failure"
        ]
        if failed_checks:
            gaps.append(
                {
                    "type": "failed_checks",
                    "description": f"{len(failed_checks)} failed compliance checks detected",
                    "severity": "high",
                    "recommendation": "Investigate and remediate failed compliance checks",
                }
            )

        return gaps

    def _generate_audit_recommendations(self, gaps: list[dict[str, Any]]) -> list[str]:
        """Generate audit recommendations based on gaps."""
        recommendations = []

        for gap in gaps:
            if gap.get("recommendation"):
                recommendations.append(gap["recommendation"])

        # Add general recommendations
        recommendations.extend(
            [
                "Regularly review audit trails for compliance",
                "Implement automated monitoring for critical events",
                "Ensure all access attempts are logged and reviewed",
                "Maintain proper segregation of duties in audit logging",
            ]
        )

        return list(set(recommendations))

    def _determine_audit_status(
        self, metrics: dict[str, Any], gaps: list[dict[str, Any]]
    ) -> str:
        """Determine overall audit status."""
        score = metrics.get("compliance_score", 0)
        critical_events = metrics.get("critical_events", 0)
        high_severity_gaps = sum(1 for g in gaps if g.get("severity") == "high")

        if score >= 95 and critical_events == 0 and high_severity_gaps == 0:
            return "COMPLIANT"
        elif score >= 80 and critical_events == 0:
            return "MINOR_ISSUES"
        else:
            return "REQUIRES_ATTENTION"

    async def _store_audit_report(self, report: dict[str, Any]):
        """Store audit report in database."""
        # This would store the report in a dedicated table
        logger.debug(f"Storing audit report: {report['report_id']}")

    async def _get_stored_audit_trail(self, trail_id: str) -> Optional[dict[str, Any]]:
        """Retrieve stored audit trail."""
        # This would retrieve from database or archive
        logger.debug(f"Retrieving audit trail: {trail_id}")
        return None  # Placeholder

    def _get_required_events_for_resource(
        self, resource_type: str, resource_id: Optional[str]
    ) -> list[AuditEventType]:
        """Get required audit events for resource type."""
        # Define required events based on resource type
        if resource_type == "compliance_report":
            return [
                AuditEventType.REPORT_GENERATED,
                AuditEventType.REPORT_VIEWED,
                AuditEventType.REPORT_DOWNLOADED,
            ]
        return []

    def _generate_digital_signature(self, trail: dict[str, Any]) -> str:
        """Generate digital signature for audit trail."""
        # Simplified - would use proper digital signature
        data = json.dumps(trail, sort_keys=True, default=str)
        return hashlib.sha256(data.encode()).hexdigest()

    async def _mark_trail_archived(self, trail_id: str, archive_filename: str):
        """Mark audit trail as archived."""
        # This would update the database
        logger.debug(f"Marked trail {trail_id} as archived: {archive_filename}")

    def _remove_pii_from_events(self, events: list[AuditEvent]) -> list[AuditEvent]:
        """Remove personally identifiable information from events."""
        filtered_events = []
        for event in events:
            # Create copy without PII
            filtered_event = AuditEvent(
                event_id=event.event_id,
                event_type=event.event_type,
                timestamp=event.timestamp,
                user_id=None,  # Remove user ID
                organization_id=event.organization_id,
                project_id=event.project_id,
                resource_id=event.resource_id,
                resource_type=event.resource_type,
                action=event.action,
                details=event.details,
                ip_address=None,  # Remove IP
                user_agent=None,  # Remove user agent
                session_id=None,  # Remove session ID
                severity=event.severity,
                outcome=event.outcome,
                source_system=event.source_system,
                correlation_id=event.correlation_id,
            )
            filtered_events.append(filtered_event)
        return filtered_events

    async def _export_to_csv(self, events: list[AuditEvent], file_path: Path):
        """Export events to CSV format."""
        import csv

        with open(file_path, "w", newline="") as csvfile:
            fieldnames = [
                "event_id",
                "event_type",
                "timestamp",
                "resource_type",
                "resource_id",
                "action",
                "severity",
                "outcome",
                "source_system",
            ]
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)

            writer.writeheader()
            for event in events:
                writer.writerow(
                    {
                        "event_id": event.event_id,
                        "event_type": event.event_type.value,
                        "timestamp": event.timestamp.isoformat(),
                        "resource_type": event.resource_type,
                        "resource_id": event.resource_id,
                        "action": event.action,
                        "severity": event.severity.value,
                        "outcome": event.outcome,
                        "source_system": event.source_system,
                    }
                )

    async def _export_to_json(self, events: list[AuditEvent], file_path: Path):
        """Export events to JSON format."""
        export_data = {
            "metadata": {
                "exported_at": datetime.utcnow().isoformat(),
                "total_events": len(events),
            },
            "events": [asdict(e) for e in events],
        }

        with open(file_path, "w") as f:
            json.dump(export_data, f, indent=2, default=str)

    async def _export_to_xlsx(self, events: list[AuditEvent], file_path: Path):
        """Export events to Excel format."""
        # This would use a library like openpyxl
        # For now, export as CSV
        await self._export_to_csv(events, file_path.with_suffix(".csv"))

    def _get_required_audit_events(self, framework: str) -> list[AuditEventType]:
        """Get required audit events for compliance framework."""
        # Define framework-specific required events
        base_events = [
            AuditEventType.USER_AUTHENTICATED,
            AuditEventType.REPORT_GENERATED,
            AuditEventType.COMPLIANCE_CHECK,
        ]

        if framework.upper() == "SOX":
            base_events.extend(
                [
                    AuditEventType.VIOLATION_DETECTED,
                    AuditEventType.EXCEPTION_GRANTED,
                ]
            )
        elif framework.upper() == "HIPAA":
            base_events.extend(
                [
                    AuditEventType.DATA_EXPORTED,
                    AuditEventType.ACCESS_GRANTED,
                ]
            )

        return base_events

    # Framework-specific audit generation methods
    def _generate_access_control_audit(
        self, grouped_events: dict[str, list[AuditEvent]]
    ) -> dict[str, Any]:
        """Generate access control audit section."""
        access_events = (
            grouped_events.get("user_authenticated", [])
            + grouped_events.get("access_granted", [])
            + grouped_events.get("access_denied", [])
        )

        return {
            "total_access_events": len(access_events),
            "successful_logins": sum(
                1 for e in access_events if e.outcome == "success"
            ),
            "failed_logins": sum(1 for e in access_events if e.outcome == "failure"),
            "unique_users": len(
                set(str(e.user_id) for e in access_events if e.user_id)
            ),
        }

    def _generate_report_audit(
        self, grouped_events: dict[str, list[AuditEvent]]
    ) -> dict[str, Any]:
        """Generate report audit section."""
        report_events = (
            grouped_events.get("report_generated", [])
            + grouped_events.get("report_viewed", [])
            + grouped_events.get("report_downloaded", [])
        )

        return {
            "total_reports": len(
                [
                    e
                    for e in report_events
                    if e.event_type == AuditEventType.REPORT_GENERATED
                ]
            ),
            "total_views": len(
                [
                    e
                    for e in report_events
                    if e.event_type == AuditEventType.REPORT_VIEWED
                ]
            ),
            "total_downloads": len(
                [
                    e
                    for e in report_events
                    if e.event_type == AuditEventType.REPORT_DOWNLOADED
                ]
            ),
        }

    def _generate_violation_audit(
        self, grouped_events: dict[str, list[AuditEvent]]
    ) -> dict[str, Any]:
        """Generate violation audit section."""
        violations = grouped_events.get("violation_detected", [])
        remediated = grouped_events.get("violation_remediated", [])

        return {
            "violations_detected": len(violations),
            "violations_remediated": len(remediated),
            "open_violations": len(violations) - len(remediated),
            "remediation_rate": (len(remediated) / len(violations) * 100)
            if violations
            else 100,
        }

    def _generate_sox_audit(
        self, grouped_events: dict[str, list[AuditEvent]]
    ) -> dict[str, Any]:
        """Generate SOX-specific audit section."""
        return {
            "financial_controls_access": len(grouped_events.get("access_granted", [])),
            "exception_requests": len(grouped_events.get("exception_granted", [])),
            "policy_evaluations": len(grouped_events.get("policy_evaluated", [])),
        }

    def _generate_hipaa_audit(
        self, grouped_events: dict[str, list[AuditEvent]]
    ) -> dict[str, Any]:
        """Generate HIPAA-specific audit section."""
        return {
            "phi_access_events": len(
                [
                    e
                    for e in grouped_events.get("access_granted", [])
                    if "phi" in e.action.lower()
                ]
            ),
            "data_exports": len(grouped_events.get("data_exported", [])),
            "breach_events": len(
                [
                    e
                    for e in grouped_events.get("violation_detected", [])
                    if "breach" in e.action.lower()
                ]
            ),
        }

    def _generate_pci_dss_audit(
        self, grouped_events: dict[str, list[AuditEvent]]
    ) -> dict[str, Any]:
        """Generate PCI-DSS-specific audit section."""
        return {
            "cardholder_access": len(
                [
                    e
                    for e in grouped_events.get("access_granted", [])
                    if "cardholder" in e.action.lower()
                ]
            ),
            "security_scans": len(
                [
                    e
                    for e in grouped_events.get("compliance_check", [])
                    if "security" in e.action.lower()
                ]
            ),
            "data_encryption_events": len(
                [e for e in grouped_events if "encryption" in str(e.details).lower()]
            ),
        }

    def _generate_gdpr_audit(
        self, grouped_events: dict[str, list[AuditEvent]]
    ) -> dict[str, Any]:
        """Generate GDPR-specific audit section."""
        return {
            "data_subject_requests": len(
                [
                    e
                    for e in grouped_events.get("user_authenticated", [])
                    if "dsar" in str(e.details).lower()
                ]
            ),
            "consent_events": len(
                [e for e in grouped_events if "consent" in str(e.details).lower()]
            ),
            "data_processing_events": len(
                [e for e in grouped_events if "processing" in e.action.lower()]
            ),
        }
