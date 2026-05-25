"""
Enterprise Audit Logging System.

Provides comprehensive audit logging for security events, compliance tracking,
and forensic analysis across the Universal Dependency Platform.
"""

import json
import logging
from dataclasses import asdict, dataclass
from datetime import datetime
from enum import Enum
from typing import Any, Optional, Union
from uuid import UUID

logger = logging.getLogger(__name__)


class AuditEventType(str, Enum):
    """Types of audit events."""
    AUTHENTICATION = "authentication"
    AUTHORIZATION = "authorization"
    DATA_ACCESS = "data_access"
    DATA_MODIFICATION = "data_modification"
    POLICY_VIOLATION = "policy_violation"
    SECURITY_EVENT = "security_event"
    COMPLIANCE_EVENT = "compliance_event"
    SYSTEM_EVENT = "system_event"
    WORKFLOW_EXECUTION = "workflow_execution"
    DEPENDENCY_ANALYSIS = "dependency_analysis"
    VULNERABILITY_SCAN = "vulnerability_scan"
    LICENSE_CHECK = "license_check"
    CONFIGURATION_CHANGE = "configuration_change"
    USER_MANAGEMENT = "user_management"
    ORGANIZATION_MANAGEMENT = "organization_management"


class AuditEventSeverity(str, Enum):
    """Severity levels for audit events."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class AuditEventStatus(str, Enum):
    """Status of audit events."""
    SUCCESS = "success"
    FAILURE = "failure"
    WARNING = "warning"
    INFO = "info"


@dataclass
class AuditEvent:
    """Audit event record."""
    id: UUID
    event_type: AuditEventType
    severity: AuditEventSeverity
    status: AuditEventStatus
    timestamp: datetime
    user_id: Optional[str]
    organization_id: Optional[UUID]
    session_id: Optional[str]
    source_ip: Optional[str]
    user_agent: Optional[str]
    resource_type: Optional[str]
    resource_id: Optional[str]
    action: str
    description: str
    details: dict[str, Any]
    outcome: str
    risk_score: float
    tags: list[str]
    correlation_id: Optional[str]
    parent_event_id: Optional[UUID]


@dataclass
class AuditQuery:
    """Audit log query parameters."""
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    event_types: Optional[list[AuditEventType]] = None
    severity_levels: Optional[list[AuditEventSeverity]] = None
    user_ids: Optional[list[str]] = None
    organization_ids: Optional[list[UUID]] = None
    resource_types: Optional[list[str]] = None
    resource_ids: Optional[list[str]] = None
    status: Optional[list[AuditEventStatus]] = None
    tags: Optional[list[str]] = None
    correlation_id: Optional[str] = None
    limit: int = 1000
    offset: int = 0


class AuditLogger:
    """Enterprise audit logging system."""

    def __init__(self):
        self.events: list[AuditEvent] = []
        self.event_index: dict[str, list[AuditEvent]] = {}
        self.retention_days = 2555  # 7 years default
        self.compression_enabled = True
        self.encryption_enabled = True

    def log_event(
        self,
        event_type: AuditEventType,
        action: str,
        description: str,
        user_id: Optional[str] = None,
        organization_id: Optional[UUID] = None,
        resource_type: Optional[str] = None,
        resource_id: Optional[str] = None,
        details: Optional[dict[str, Any]] = None,
        severity: AuditEventSeverity = AuditEventSeverity.MEDIUM,
        status: AuditEventStatus = AuditEventStatus.INFO,
        session_id: Optional[str] = None,
        source_ip: Optional[str] = None,
        user_agent: Optional[str] = None,
        tags: Optional[list[str]] = None,
        correlation_id: Optional[str] = None,
        parent_event_id: Optional[UUID] = None
    ) -> UUID:
        """
        Log an audit event.

        Args:
            event_type: Type of audit event
            action: Action performed
            description: Description of the event
            user_id: ID of the user who performed the action
            organization_id: Organization context
            resource_type: Type of resource affected
            resource_id: ID of the resource affected
            details: Additional event details
            severity: Severity level of the event
            status: Status of the event
            session_id: Session identifier
            source_ip: Source IP address
            user_agent: User agent string
            tags: Event tags for categorization
            correlation_id: Correlation ID for related events
            parent_event_id: Parent event ID for event chains

        Returns:
            UUID of the logged event
        """
        try:
            event_id = UUID()

            # Calculate risk score
            risk_score = self._calculate_risk_score(
                event_type, severity, status, details or {}
            )

            # Create audit event
            event = AuditEvent(
                id=event_id,
                event_type=event_type,
                severity=severity,
                status=status,
                timestamp=datetime.utcnow(),
                user_id=user_id,
                organization_id=organization_id,
                session_id=session_id,
                source_ip=source_ip,
                user_agent=user_agent,
                resource_type=resource_type,
                resource_id=resource_id,
                action=action,
                description=description,
                details=details or {},
                outcome=self._determine_outcome(status, details or {}),
                risk_score=risk_score,
                tags=tags or [],
                correlation_id=correlation_id,
                parent_event_id=parent_event_id
            )

            # Store event
            self.events.append(event)

            # Update indexes
            self._update_indexes(event)

            # Log to application logger
            self._log_to_application_logger(event)

            logger.debug(f"Audit event logged: {event_id} - {event_type.value}")
            return event_id

        except Exception as e:
            logger.error(f"Failed to log audit event: {e}", exc_info=True)
            raise

    def query_events(self, query: AuditQuery) -> list[AuditEvent]:
        """
        Query audit events based on criteria.

        Args:
            query: Query parameters

        Returns:
            List of matching audit events
        """
        try:
            logger.debug(f"Querying audit events with {len(query.__dict__)} criteria")

            # Start with all events
            results = self.events.copy()

            # Apply filters
            if query.start_time:
                results = [e for e in results if e.timestamp >= query.start_time]

            if query.end_time:
                results = [e for e in results if e.timestamp <= query.end_time]

            if query.event_types:
                results = [e for e in results if e.event_type in query.event_types]

            if query.severity_levels:
                results = [e for e in results if e.severity in query.severity_levels]

            if query.user_ids:
                results = [e for e in results if e.user_id in query.user_ids]

            if query.organization_ids:
                results = [e for e in results if e.organization_id in query.organization_ids]

            if query.resource_types:
                results = [e for e in results if e.resource_type in query.resource_types]

            if query.resource_ids:
                results = [e for e in results if e.resource_id in query.resource_ids]

            if query.status:
                results = [e for e in results if e.status in query.status]

            if query.tags:
                results = [e for e in results if any(tag in e.tags for tag in query.tags)]

            if query.correlation_id:
                results = [e for e in results if e.correlation_id == query.correlation_id]

            # Sort by timestamp (newest first)
            results.sort(key=lambda e: e.timestamp, reverse=True)

            # Apply pagination
            start_idx = query.offset
            end_idx = start_idx + query.limit
            results = results[start_idx:end_idx]

            logger.debug(f"Query returned {len(results)} events")
            return results

        except Exception as e:
            logger.error(f"Failed to query audit events: {e}", exc_info=True)
            return []

    def get_event_by_id(self, event_id: UUID) -> Optional[AuditEvent]:
        """Get a specific audit event by ID."""
        try:
            for event in self.events:
                if event.id == event_id:
                    return event
            return None
        except Exception as e:
            logger.error(f"Failed to get event by ID: {e}")
            return None

    def get_related_events(
        self,
        event_id: UUID,
        max_depth: int = 3
    ) -> list[AuditEvent]:
        """Get events related to a specific event through correlation or parent-child relationships."""
        try:
            target_event = self.get_event_by_id(event_id)
            if not target_event:
                return []

            related_events = []
            visited = set()

            def find_related(current_event: AuditEvent, depth: int):
                if depth > max_depth or current_event.id in visited:
                    return

                visited.add(current_event.id)

                # Find events with same correlation ID
                if current_event.correlation_id:
                    for event in self.events:
                        if (event.correlation_id == current_event.correlation_id and
                            event.id not in visited):
                            related_events.append(event)
                            find_related(event, depth + 1)

                # Find child events
                for event in self.events:
                    if (event.parent_event_id == current_event.id and
                        event.id not in visited):
                        related_events.append(event)
                        find_related(event, depth + 1)

                # Find parent events
                if current_event.parent_event_id:
                    parent = self.get_event_by_id(current_event.parent_event_id)
                    if parent and parent.id not in visited:
                        related_events.append(parent)
                        find_related(parent, depth + 1)

            find_related(target_event, 0)
            return related_events

        except Exception as e:
            logger.error(f"Failed to get related events: {e}")
            return []

    def generate_audit_report(
        self,
        organization_id: UUID,
        start_time: datetime,
        end_time: datetime,
        report_type: str = "compliance"
    ) -> dict[str, Any]:
        """Generate an audit report for compliance or security purposes."""
        try:
            logger.info(f"Generating audit report for organization {organization_id}")

            # Query events for the time period
            query = AuditQuery(
                start_time=start_time,
                end_time=end_time,
                organization_ids=[organization_id]
            )
            events = self.query_events(query)

            # Generate report based on type
            if report_type == "compliance":
                return self._generate_compliance_report(events, organization_id)
            elif report_type == "security":
                return self._generate_security_report(events, organization_id)
            elif report_type == "summary":
                return self._generate_summary_report(events, organization_id)
            else:
                return self._generate_generic_report(events, organization_id)

        except Exception as e:
            logger.error(f"Failed to generate audit report: {e}", exc_info=True)
            return {}

    def export_audit_logs(
        self,
        query: AuditQuery,
        format: str = "json"
    ) -> Union[str, bytes]:
        """Export audit logs in specified format."""
        try:
            events = self.query_events(query)

            if format == "json":
                return json.dumps([asdict(event) for event in events], default=str)
            elif format == "csv":
                return self._export_to_csv(events)
            elif format == "xml":
                return self._export_to_xml(events)
            else:
                raise ValueError(f"Unsupported export format: {format}")

        except Exception as e:
            logger.error(f"Failed to export audit logs: {e}", exc_info=True)
            raise

    def _calculate_risk_score(
        self,
        event_type: AuditEventType,
        severity: AuditEventSeverity,
        status: AuditEventStatus,
        details: dict[str, Any]
    ) -> float:
        """Calculate risk score for an audit event."""
        base_score = 0.0

        # Base score by event type
        type_scores = {
            AuditEventType.AUTHENTICATION: 0.3,
            AuditEventType.AUTHORIZATION: 0.4,
            AuditEventType.DATA_ACCESS: 0.2,
            AuditEventType.DATA_MODIFICATION: 0.6,
            AuditEventType.POLICY_VIOLATION: 0.8,
            AuditEventType.SECURITY_EVENT: 0.9,
            AuditEventType.COMPLIANCE_EVENT: 0.7,
            AuditEventType.SYSTEM_EVENT: 0.1,
            AuditEventType.WORKFLOW_EXECUTION: 0.3,
            AuditEventType.DEPENDENCY_ANALYSIS: 0.2,
            AuditEventType.VULNERABILITY_SCAN: 0.5,
            AuditEventType.LICENSE_CHECK: 0.3,
            AuditEventType.CONFIGURATION_CHANGE: 0.6,
            AuditEventType.USER_MANAGEMENT: 0.5,
            AuditEventType.ORGANIZATION_MANAGEMENT: 0.7
        }
        base_score += type_scores.get(event_type, 0.5)

        # Severity multiplier
        severity_multipliers = {
            AuditEventSeverity.LOW: 0.5,
            AuditEventSeverity.MEDIUM: 1.0,
            AuditEventSeverity.HIGH: 1.5,
            AuditEventSeverity.CRITICAL: 2.0
        }
        base_score *= severity_multipliers.get(severity, 1.0)

        # Status adjustment
        if status == AuditEventStatus.FAILURE:
            base_score *= 1.5
        elif status == AuditEventStatus.WARNING:
            base_score *= 1.2

        # Additional factors from details
        if details.get('sensitive_data_accessed'):
            base_score += 0.3
        if details.get('privilege_escalation'):
            base_score += 0.4
        if details.get('external_access'):
            base_score += 0.2

        return min(10.0, max(0.0, base_score))

    def _determine_outcome(
        self,
        status: AuditEventStatus,
        details: dict[str, Any]
    ) -> str:
        """Determine the outcome of an audit event."""
        if status == AuditEventStatus.SUCCESS:
            return "Operation completed successfully"
        elif status == AuditEventStatus.FAILURE:
            return f"Operation failed: {details.get('error', 'Unknown error')}"
        elif status == AuditEventStatus.WARNING:
            return f"Operation completed with warnings: {details.get('warning', 'Unknown warning')}"
        else:
            return "Operation completed"

    def _update_indexes(self, event: AuditEvent):
        """Update search indexes for the event."""
        # Index by organization
        if event.organization_id:
            org_key = str(event.organization_id)
            if org_key not in self.event_index:
                self.event_index[org_key] = []
            self.event_index[org_key].append(event)

        # Index by user
        if event.user_id:
            user_key = f"user_{event.user_id}"
            if user_key not in self.event_index:
                self.event_index[user_key] = []
            self.event_index[user_key].append(event)

        # Index by event type
        type_key = f"type_{event.event_type.value}"
        if type_key not in self.event_index:
            self.event_index[type_key] = []
        self.event_index[type_key].append(event)

    def _log_to_application_logger(self, event: AuditEvent):
        """Log event to application logger for immediate visibility."""
        log_level = {
            AuditEventSeverity.LOW: logging.INFO,
            AuditEventSeverity.MEDIUM: logging.WARNING,
            AuditEventSeverity.HIGH: logging.ERROR,
            AuditEventSeverity.CRITICAL: logging.CRITICAL
        }.get(event.severity, logging.INFO)

        logger.log(
            log_level,
            f"AUDIT: {event.event_type.value} - {event.action} - {event.description} "
            f"(User: {event.user_id}, Org: {event.organization_id}, Risk: {event.risk_score})"
        )

    def _generate_compliance_report(
        self,
        events: list[AuditEvent],
        organization_id: UUID
    ) -> dict[str, Any]:
        """Generate compliance-focused audit report."""
        # Count events by type
        event_counts = {}
        for event in events:
            event_type = event.event_type.value
            event_counts[event_type] = event_counts.get(event_type, 0) + 1

        # Count by severity
        severity_counts = {}
        for event in events:
            severity = event.severity.value
            severity_counts[severity] = severity_counts.get(severity, 0) + 1

        # Count by status
        status_counts = {}
        for event in events:
            status = event.status.value
            status_counts[status] = status_counts.get(status, 0) + 1

        # Calculate compliance metrics
        total_events = len(events)
        high_risk_events = len([e for e in events if e.risk_score > 7.0])
        policy_violations = len([e for e in events if e.event_type == AuditEventType.POLICY_VIOLATION])

        return {
            "report_type": "compliance",
            "organization_id": str(organization_id),
            "report_period": {
                "start_time": min(e.timestamp for e in events) if events else None,
                "end_time": max(e.timestamp for e in events) if events else None
            },
            "summary": {
                "total_events": total_events,
                "high_risk_events": high_risk_events,
                "policy_violations": policy_violations,
                "compliance_score": max(0, 100 - (high_risk_events / total_events * 100)) if total_events > 0 else 100
            },
            "event_breakdown": {
                "by_type": event_counts,
                "by_severity": severity_counts,
                "by_status": status_counts
            },
            "recommendations": self._generate_compliance_recommendations(events)
        }

    def _generate_security_report(
        self,
        events: list[AuditEvent],
        organization_id: UUID
    ) -> dict[str, Any]:
        """Generate security-focused audit report."""
        security_events = [e for e in events if e.event_type in [
            AuditEventType.AUTHENTICATION,
            AuditEventType.AUTHORIZATION,
            AuditEventType.SECURITY_EVENT,
            AuditEventType.POLICY_VIOLATION
        ]]

        # Analyze authentication events
        auth_events = [e for e in security_events if e.event_type == AuditEventType.AUTHENTICATION]
        failed_logins = len([e for e in auth_events if e.status == AuditEventStatus.FAILURE])

        # Analyze authorization events
        authz_events = [e for e in security_events if e.event_type == AuditEventType.AUTHORIZATION]
        denied_access = len([e for e in authz_events if e.status == AuditEventStatus.FAILURE])

        return {
            "report_type": "security",
            "organization_id": str(organization_id),
            "security_metrics": {
                "total_security_events": len(security_events),
                "failed_authentications": failed_logins,
                "denied_authorizations": denied_access,
                "policy_violations": len([e for e in security_events if e.event_type == AuditEventType.POLICY_VIOLATION])
            },
            "threat_indicators": self._analyze_threat_indicators(security_events),
            "recommendations": self._generate_security_recommendations(security_events)
        }

    def _generate_summary_report(
        self,
        events: list[AuditEvent],
        organization_id: UUID
    ) -> dict[str, Any]:
        """Generate summary audit report."""
        return {
            "report_type": "summary",
            "organization_id": str(organization_id),
            "total_events": len(events),
            "time_range": {
                "start": min(e.timestamp for e in events) if events else None,
                "end": max(e.timestamp for e in events) if events else None
            },
            "top_events": self._get_top_events(events, 10),
            "risk_summary": self._calculate_risk_summary(events)
        }

    def _generate_generic_report(
        self,
        events: list[AuditEvent],
        organization_id: UUID
    ) -> dict[str, Any]:
        """Generate generic audit report."""
        return {
            "report_type": "generic",
            "organization_id": str(organization_id),
            "total_events": len(events),
            "events": [asdict(event) for event in events]
        }

    def _generate_compliance_recommendations(self, events: list[AuditEvent]) -> list[str]:
        """Generate compliance recommendations based on events."""
        recommendations = []

        high_risk_events = [e for e in events if e.risk_score > 7.0]
        if high_risk_events:
            recommendations.append("Review and address high-risk events immediately")

        policy_violations = [e for e in events if e.event_type == AuditEventType.POLICY_VIOLATION]
        if policy_violations:
            recommendations.append("Strengthen policy enforcement mechanisms")

        failed_events = [e for e in events if e.status == AuditEventStatus.FAILURE]
        if len(failed_events) > len(events) * 0.1:  # More than 10% failures
            recommendations.append("Investigate high failure rate in operations")

        return recommendations

    def _generate_security_recommendations(self, events: list[AuditEvent]) -> list[str]:
        """Generate security recommendations based on events."""
        recommendations = []

        failed_auth = [e for e in events if e.event_type == AuditEventType.AUTHENTICATION and e.status == AuditEventStatus.FAILURE]
        if len(failed_auth) > 10:
            recommendations.append("Implement account lockout policies for failed authentication attempts")

        denied_authz = [e for e in events if e.event_type == AuditEventType.AUTHORIZATION and e.status == AuditEventStatus.FAILURE]
        if len(denied_authz) > 5:
            recommendations.append("Review user permissions and access patterns")

        return recommendations

    def _analyze_threat_indicators(self, events: list[AuditEvent]) -> list[dict[str, Any]]:
        """Analyze events for threat indicators."""
        indicators = []

        # Check for brute force attempts
        auth_failures = [e for e in events if e.event_type == AuditEventType.AUTHENTICATION and e.status == AuditEventStatus.FAILURE]
        if len(auth_failures) > 5:
            indicators.append({
                "type": "brute_force_attempt",
                "severity": "high",
                "description": f"Multiple failed authentication attempts ({len(auth_failures)})",
                "events": [str(e.id) for e in auth_failures[:5]]
            })

        # Check for privilege escalation
        authz_failures = [e for e in events if e.event_type == AuditEventType.AUTHORIZATION and e.status == AuditEventStatus.FAILURE]
        if len(authz_failures) > 3:
            indicators.append({
                "type": "privilege_escalation_attempt",
                "severity": "medium",
                "description": f"Multiple authorization failures ({len(authz_failures)})",
                "events": [str(e.id) for e in authz_failures[:3]]
            })

        return indicators

    def _get_top_events(self, events: list[AuditEvent], limit: int) -> list[dict[str, Any]]:
        """Get top events by risk score."""
        sorted_events = sorted(events, key=lambda e: e.risk_score, reverse=True)
        return [
            {
                "id": str(e.id),
                "type": e.event_type.value,
                "action": e.action,
                "risk_score": e.risk_score,
                "timestamp": e.timestamp.isoformat()
            }
            for e in sorted_events[:limit]
        ]

    def _calculate_risk_summary(self, events: list[AuditEvent]) -> dict[str, Any]:
        """Calculate risk summary for events."""
        if not events:
            return {"average_risk": 0, "max_risk": 0, "high_risk_count": 0}

        risk_scores = [e.risk_score for e in events]
        high_risk_count = len([score for score in risk_scores if score > 7.0])

        return {
            "average_risk": sum(risk_scores) / len(risk_scores),
            "max_risk": max(risk_scores),
            "min_risk": min(risk_scores),
            "high_risk_count": high_risk_count,
            "high_risk_percentage": (high_risk_count / len(events)) * 100
        }

    def _export_to_csv(self, events: list[AuditEvent]) -> str:
        """Export events to CSV format."""
        import csv
        import io

        output = io.StringIO()
        writer = csv.writer(output)

        # Write header
        writer.writerow([
            "ID", "Event Type", "Severity", "Status", "Timestamp", "User ID",
            "Organization ID", "Action", "Description", "Risk Score"
        ])

        # Write data
        for event in events:
            writer.writerow([
                str(event.id),
                event.event_type.value,
                event.severity.value,
                event.status.value,
                event.timestamp.isoformat(),
                event.user_id or "",
                str(event.organization_id) if event.organization_id else "",
                event.action,
                event.description,
                event.risk_score
            ])

        return output.getvalue()

    def _export_to_xml(self, events: list[AuditEvent]) -> str:
        """Export events to XML format."""
        import xml.etree.ElementTree as ET

        root = ET.Element("audit_events")

        for event in events:
            event_elem = ET.SubElement(root, "event")
            event_elem.set("id", str(event.id))
            event_elem.set("type", event.event_type.value)
            event_elem.set("severity", event.severity.value)
            event_elem.set("status", event.status.value)
            event_elem.set("timestamp", event.timestamp.isoformat())
            event_elem.set("risk_score", str(event.risk_score))

            ET.SubElement(event_elem, "action").text = event.action
            ET.SubElement(event_elem, "description").text = event.description

            if event.user_id:
                ET.SubElement(event_elem, "user_id").text = event.user_id
            if event.organization_id:
                ET.SubElement(event_elem, "organization_id").text = str(event.organization_id)

        return ET.tostring(root, encoding='unicode')
