"""
Security Monitoring and Analytics System for Universal Dependency Platform.

Provides comprehensive security monitoring, threat detection, incident response,
and analytics capabilities for maintaining platform security posture.
"""

import asyncio
import json
import logging
from collections import defaultdict, deque
from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from ..core.config import get_settings
from .enhanced_middleware import SecurityEvent, ThreatType
from .rate_limiter import get_rate_limiter

logger = logging.getLogger(__name__)


class AlertSeverity(str, Enum):
    """Security alert severity levels."""

    INFO = "info"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class AlertStatus(str, Enum):
    """Security alert status."""

    NEW = "new"
    INVESTIGATING = "investigating"
    RESOLVED = "resolved"
    FALSE_POSITIVE = "false_positive"
    ESCALATED = "escalated"


class IncidentStatus(str, Enum):
    """Security incident status."""

    OPEN = "open"
    IN_PROGRESS = "in_progress"
    CONTAINED = "contained"
    RESOLVED = "resolved"
    CLOSED = "closed"


@dataclass
class SecurityAlert:
    """Security alert for monitoring."""

    id: str
    title: str
    description: str
    severity: AlertSeverity
    status: AlertStatus
    threat_type: ThreatType
    source_ip: str
    user_id: Optional[str]
    organization_id: Optional[str]
    endpoint: str
    payload: Optional[str]
    metadata: dict[str, Any]
    created_at: datetime
    updated_at: datetime
    resolved_at: Optional[datetime] = None
    resolved_by: Optional[str] = None
    notes: Optional[str] = None


@dataclass
class SecurityIncident:
    """Security incident for tracking major security events."""

    id: str
    title: str
    description: str
    severity: AlertSeverity
    status: IncidentStatus
    threat_types: list[ThreatType]
    affected_ips: list[str]
    affected_users: list[str]
    affected_organizations: list[str]
    alert_count: int
    metadata: dict[str, Any]
    created_at: datetime
    updated_at: datetime
    resolved_at: Optional[datetime] = None
    resolved_by: Optional[str] = None
    resolution_summary: Optional[str] = None


@dataclass
class SecurityMetrics:
    """Security metrics for monitoring."""

    total_events: int
    events_by_threat_type: dict[ThreatType, int]
    events_by_severity: dict[str, int]
    unique_ips: int
    unique_users: int
    top_source_ips: list[tuple[str, int]]
    top_endpoints: list[tuple[str, int]]
    blocked_requests: int
    rate_limit_violations: int
    time_window: str


@dataclass
class ThreatIntelligence:
    """Threat intelligence data."""

    ip_addresses: dict[str, dict[str, Any]]
    threat_patterns: list[dict[str, Any]]
    known_attackers: set[str]
    malicious_networks: set[str]
    last_updated: datetime


class SecurityMonitor:
    """
    Comprehensive security monitoring and threat detection system.
    """

    def __init__(self, db_session: AsyncSession):
        self.db_session = db_session
        self.settings = get_settings()
        self.rate_limiter = None
        self.event_buffer = deque(maxlen=10000)
        self.active_alerts: dict[str, SecurityAlert] = {}
        self.active_incidents: dict[str, SecurityIncident] = {}
        self.threat_intelligence = ThreatIntelligence(
            ip_addresses={},
            threat_patterns=[],
            known_attackers=set(),
            malicious_networks=set(),
            last_updated=datetime.utcnow(),
        )
        self._monitoring_active = False
        self._monitoring_task = None

    async def start_monitoring(self):
        """Start security monitoring background tasks."""
        if self._monitoring_active:
            return

        self._monitoring_active = True
        self.rate_limiter = await get_rate_limiter()

        # Start background monitoring tasks
        self._monitoring_task = asyncio.create_task(self._monitoring_loop())

        logger.info("Security monitoring started")

    async def stop_monitoring(self):
        """Stop security monitoring background tasks."""
        self._monitoring_active = False

        if self._monitoring_task:
            self._monitoring_task.cancel()
            try:
                await self._monitoring_task
            except asyncio.CancelledError:
                pass

        logger.info("Security monitoring stopped")

    async def record_security_event(self, event: SecurityEvent):
        """
        Record a security event for analysis and potential alerting.
        """

        # Add to buffer for analysis
        self.event_buffer.append(event)

        # Log the event
        logger.warning(
            f"Security event recorded: {event.threat_type.value} - "
            f"IP: {event.source_ip} - Endpoint: {event.endpoint}"
        )

        # Check for immediate alert conditions
        await self._check_alert_conditions(event)

        # Check for incident creation
        await self._check_incident_conditions(event)

    async def get_security_metrics(
        self, time_window: str = "1h", organization_id: Optional[str] = None
    ) -> SecurityMetrics:
        """
        Get security metrics for the specified time window.
        """

        # Parse time window
        window_delta = self._parse_time_window(time_window)
        start_time = datetime.utcnow() - window_delta

        # Filter events by time window
        events_in_window = [
            event for event in self.event_buffer if event.timestamp >= start_time
        ]

        # Apply organization filter if specified
        if organization_id:
            events_in_window = [
                event
                for event in events_in_window
                if event.details.get("organization_id") == organization_id
            ]

        # Calculate metrics
        total_events = len(events_in_window)

        events_by_threat_type = defaultdict(int)
        events_by_severity = defaultdict(int)
        unique_ips = set()
        unique_users = set()
        endpoint_counts = defaultdict(int)
        ip_counts = defaultdict(int)

        blocked_requests = 0
        rate_limit_violations = 0

        for event in events_in_window:
            events_by_threat_type[event.threat_type] += 1
            events_by_severity[event.severity] += 1
            unique_ips.add(event.source_ip)

            if event.user_agent != "unknown":
                unique_users.add(event.user_agent)

            endpoint_counts[event.endpoint] += 1
            ip_counts[event.source_ip] += 1

            # Count specific event types
            if event.threat_type in [ThreatType.DDoS, ThreatType.BRUTE_FORCE]:
                blocked_requests += 1
            if event.threat_type == ThreatType.BRUTE_FORCE:
                rate_limit_violations += 1

        # Get top items
        top_source_ips = sorted(ip_counts.items(), key=lambda x: x[1], reverse=True)[
            :10
        ]
        top_endpoints = sorted(
            endpoint_counts.items(), key=lambda x: x[1], reverse=True
        )[:10]

        return SecurityMetrics(
            total_events=total_events,
            events_by_threat_type=dict(events_by_threat_type),
            events_by_severity=dict(events_by_severity),
            unique_ips=len(unique_ips),
            unique_users=len(unique_users),
            top_source_ips=top_source_ips,
            top_endpoints=top_endpoints,
            blocked_requests=blocked_requests,
            rate_limit_violations=rate_limit_violations,
            time_window=time_window,
        )

    async def get_active_alerts(
        self, organization_id: Optional[str] = None
    ) -> list[SecurityAlert]:
        """Get active security alerts."""

        alerts = list(self.active_alerts.values())

        if organization_id:
            alerts = [
                alert for alert in alerts if alert.organization_id == organization_id
            ]

        # Sort by severity and creation time
        severity_order = {
            AlertSeverity.CRITICAL: 0,
            AlertSeverity.HIGH: 1,
            AlertSeverity.MEDIUM: 2,
            AlertSeverity.LOW: 3,
            AlertSeverity.INFO: 4,
        }

        alerts.sort(key=lambda x: (severity_order.get(x.severity, 5), x.created_at))

        return alerts

    async def get_active_incidents(
        self, organization_id: Optional[str] = None
    ) -> list[SecurityIncident]:
        """Get active security incidents."""

        incidents = list(self.active_incidents.values())

        if organization_id:
            incidents = [
                incident
                for incident in incidents
                if organization_id in incident.affected_organizations
            ]

        # Sort by severity and creation time
        severity_order = {
            AlertSeverity.CRITICAL: 0,
            AlertSeverity.HIGH: 1,
            AlertSeverity.MEDIUM: 2,
            AlertSeverity.LOW: 3,
            AlertSeverity.INFO: 4,
        }

        incidents.sort(key=lambda x: (severity_order.get(x.severity, 5), x.created_at))

        return incidents

    async def create_alert(
        self,
        title: str,
        description: str,
        severity: AlertSeverity,
        threat_type: ThreatType,
        source_ip: str,
        endpoint: str,
        user_id: Optional[str] = None,
        organization_id: Optional[str] = None,
        metadata: Optional[dict[str, Any]] = None,
    ) -> SecurityAlert:
        """Create a new security alert."""

        alert_id = secrets.token_urlsafe(16)

        alert = SecurityAlert(
            id=alert_id,
            title=title,
            description=description,
            severity=severity,
            status=AlertStatus.NEW,
            threat_type=threat_type,
            source_ip=source_ip,
            user_id=user_id,
            organization_id=organization_id,
            endpoint=endpoint,
            payload=metadata.get("payload") if metadata else None,
            metadata=metadata or {},
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )

        self.active_alerts[alert_id] = alert

        # Log alert creation
        logger.error(
            f"Security alert created: {title} - "
            f"Severity: {severity.value} - IP: {source_ip}"
        )

        # Send notification for high and critical alerts
        if severity in [AlertSeverity.HIGH, AlertSeverity.CRITICAL]:
            await self._send_alert_notification(alert)

        return alert

    async def update_alert_status(
        self,
        alert_id: str,
        status: AlertStatus,
        resolved_by: Optional[str] = None,
        notes: Optional[str] = None,
    ) -> bool:
        """Update security alert status."""

        if alert_id not in self.active_alerts:
            return False

        alert = self.active_alerts[alert_id]
        alert.status = status
        alert.updated_at = datetime.utcnow()

        if status == AlertStatus.RESOLVED:
            alert.resolved_at = datetime.utcnow()
            alert.resolved_by = resolved_by
            alert.notes = notes

            # Remove from active alerts after resolution
            asyncio.create_task(self._archive_alert(alert_id))

        logger.info(f"Updated alert {alert_id} status to {status.value}")
        return True

    async def _monitoring_loop(self):
        """Background monitoring loop."""

        while self._monitoring_active:
            try:
                # Perform periodic monitoring tasks
                await self._analyze_event_patterns()
                await self._update_threat_intelligence()
                await self._cleanup_old_data()

                # Sleep for 60 seconds
                await asyncio.sleep(60)

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in monitoring loop: {e}")
                await asyncio.sleep(60)

    async def _check_alert_conditions(self, event: SecurityEvent):
        """Check if event should trigger an immediate alert."""

        # High and critical severity events always trigger alerts
        if event.severity in ["high", "critical"]:
            await self.create_alert(
                title=f"{event.threat_type.value.replace('_', ' ').title()} Detected",
                description=f"High-severity {event.threat_type.value} detected from IP {event.source_ip}",
                severity=AlertSeverity.HIGH
                if event.severity == "high"
                else AlertSeverity.CRITICAL,
                threat_type=event.threat_type,
                source_ip=event.source_ip,
                endpoint=event.endpoint,
                user_id=event.details.get("user_id"),
                organization_id=event.details.get("organization_id"),
                metadata=event.details,
            )

        # Check for repeated events from same IP
        recent_events = [
            e
            for e in self.event_buffer
            if (
                e.source_ip == event.source_ip
                and e.threat_type == event.threat_type
                and e.timestamp > datetime.utcnow() - timedelta(minutes=5)
            )
        ]

        if len(recent_events) >= 5:
            await self.create_alert(
                title=f"Repeated {event.threat_type.value} Activity",
                description=f"Multiple {event.threat_type.value} events detected from IP {event.source_ip}",
                severity=AlertSeverity.MEDIUM,
                threat_type=event.threat_type,
                source_ip=event.source_ip,
                endpoint=event.endpoint,
                user_id=event.details.get("user_id"),
                organization_id=event.details.get("organization_id"),
                metadata={"event_count": len(recent_events)},
            )

    async def _check_incident_conditions(self, event: SecurityEvent):
        """Check if event should trigger incident creation."""

        # Get recent events for pattern analysis
        recent_events = [
            e
            for e in self.event_buffer
            if e.timestamp > datetime.utcnow() - timedelta(minutes=30)
        ]

        # Group events by IP and threat type
        ip_events = defaultdict(list)
        for e in recent_events:
            ip_events[e.source_ip].append(e)

        # Check for DDoS patterns
        for ip, events in ip_events.items():
            if len(events) >= 50:  # 50+ events in 30 minutes
                await self._create_ddos_incident(ip, events)

        # Check for brute force patterns
        auth_events = [
            e for e in recent_events if e.threat_type == ThreatType.BRUTE_FORCE
        ]
        if len(auth_events) >= 20:  # 20+ auth failures in 30 minutes
            await self._create_brute_force_incident(auth_events)

    async def _create_ddos_incident(self, source_ip: str, events: list[SecurityEvent]):
        """Create a DDoS incident."""

        incident_id = secrets.token_urlsafe(16)

        # Get unique users and organizations affected
        affected_users = set()
        affected_orgs = set()

        for event in events:
            if event.user_agent != "unknown":
                affected_users.add(event.user_agent)
            if event.details.get("organization_id"):
                affected_orgs.add(event.details["organization_id"])

        incident = SecurityIncident(
            id=incident_id,
            title="DDoS Attack Detected",
            description=f"High volume of requests detected from IP {source_ip}",
            severity=AlertSeverity.HIGH,
            status=IncidentStatus.OPEN,
            threat_types=[ThreatType.DDoS],
            affected_ips=[source_ip],
            affected_users=list(affected_users),
            affected_organizations=list(affected_orgs),
            alert_count=len(events),
            metadata={
                "events_per_minute": len(events) / 30,
                "unique_endpoints": len(set(e.endpoint for e in events)),
                "first_event": min(e.timestamp for e in events).isoformat(),
                "last_event": max(e.timestamp for e in events).isoformat(),
            },
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )

        self.active_incidents[incident_id] = incident

        logger.error(f"DDoS incident created: {incident_id} - IP: {source_ip}")

        # Send critical notification
        await self._send_incident_notification(incident)

    async def _create_brute_force_incident(self, events: list[SecurityEvent]):
        """Create a brute force incident."""

        incident_id = secrets.token_urlsafe(16)

        # Get unique IPs and affected users
        source_ips = set(e.source_ip for e in events)
        affected_users = set()
        affected_orgs = set()

        for event in events:
            if event.user_agent != "unknown":
                affected_users.add(event.user_agent)
            if event.details.get("organization_id"):
                affected_orgs.add(event.details["organization_id"])

        incident = SecurityIncident(
            id=incident_id,
            title="Brute Force Attack Detected",
            description="Multiple authentication failure attempts detected",
            severity=AlertSeverity.HIGH,
            status=IncidentStatus.OPEN,
            threat_types=[ThreatType.BRUTE_FORCE],
            affected_ips=list(source_ips),
            affected_users=list(affected_users),
            affected_organizations=list(affected_orgs),
            alert_count=len(events),
            metadata={
                "unique_ips": len(source_ips),
                "unique_endpoints": len(set(e.endpoint for e in events)),
                "first_event": min(e.timestamp for e in events).isoformat(),
                "last_event": max(e.timestamp for e in events).isoformat(),
            },
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )

        self.active_incidents[incident_id] = incident

        logger.error(f"Brute force incident created: {incident_id}")

        # Send critical notification
        await self._send_incident_notification(incident)

    async def _analyze_event_patterns(self):
        """Analyze event patterns for emerging threats."""

        if len(self.event_buffer) < 100:
            return  # Not enough data

        # Get events from last hour
        recent_events = [
            e
            for e in self.event_buffer
            if e.timestamp > datetime.utcnow() - timedelta(hours=1)
        ]

        # Check for unusual patterns
        await self._check_unusual_patterns(recent_events)

    async def _check_unusual_patterns(self, events: list[SecurityEvent]):
        """Check for unusual patterns in events."""

        # Group events by threat type
        threat_counts = defaultdict(int)
        for event in events:
            threat_counts[event.threat_type] += 1

        # Check for spikes in specific threat types
        for threat_type, count in threat_counts.items():
            if count >= 10:  # Threshold for unusual activity
                logger.warning(
                    f"Unusual spike in {threat_type.value} events: {count} in last hour"
                )

                # Create informational alert
                await self.create_alert(
                    title=f"Unusual Activity Pattern: {threat_type.value}",
                    description=f"Spike in {threat_type.value} events detected: {count} in last hour",
                    severity=AlertSeverity.INFO,
                    threat_type=threat_type,
                    source_ip="multiple",
                    endpoint="various",
                    metadata={"event_count": count, "time_window": "1h"},
                )

    async def _update_threat_intelligence(self):
        """Update threat intelligence data."""

        # In a real implementation, this would fetch data from
        # threat intelligence feeds, security vendors, etc.

        # For now, we'll update based on recent events
        recent_events = [
            e
            for e in self.event_buffer
            if e.timestamp > datetime.utcnow() - timedelta(hours=24)
        ]

        # Update IP reputation data
        for event in recent_events:
            if event.source_ip not in self.threat_intelligence.ip_addresses:
                self.threat_intelligence.ip_addresses[event.source_ip] = {
                    "threat_score": 0,
                    "last_seen": event.timestamp,
                    "event_count": 0,
                    "threat_types": [],
                }

            ip_data = self.threat_intelligence.ip_addresses[event.source_ip]
            ip_data["last_seen"] = event.timestamp
            ip_data["event_count"] += 1

            if event.threat_type not in ip_data["threat_types"]:
                ip_data["threat_types"].append(event.threat_type.value)

            # Update threat score based on severity
            severity_scores = {"low": 1, "medium": 5, "high": 15, "critical": 30}
            ip_data["threat_score"] += severity_scores.get(event.severity, 1)

        self.threat_intelligence.last_updated = datetime.utcnow()

    async def _cleanup_old_data(self):
        """Clean up old data to prevent memory leaks."""

        # Remove events older than 7 days
        cutoff_time = datetime.utcnow() - timedelta(days=7)

        while self.event_buffer and self.event_buffer[0].timestamp < cutoff_time:
            self.event_buffer.popleft()

        # Clean up resolved alerts older than 30 days
        alert_cutoff = datetime.utcnow() - timedelta(days=30)

        alerts_to_remove = [
            alert_id
            for alert_id, alert in self.active_alerts.items()
            if (
                alert.status == AlertStatus.RESOLVED
                and alert.resolved_at
                and alert.resolved_at < alert_cutoff
            )
        ]

        for alert_id in alerts_to_remove:
            del self.active_alerts[alert_id]

    async def _send_alert_notification(self, alert: SecurityAlert):
        """Send alert notification to administrators."""

        # In a real implementation, this would send emails, Slack messages,
        # PagerDuty alerts, etc.

        logger.critical(
            f"SECURITY ALERT: {alert.title} - "
            f"Severity: {alert.severity.value} - "
            f"IP: {alert.source_ip} - "
            f"Endpoint: {alert.endpoint}"
        )

        # For now, we'll just log to a file
        try:
            with open("security_alerts.log", "a") as f:
                f.write(
                    json.dumps(
                        {
                            "type": "alert",
                            "id": alert.id,
                            "title": alert.title,
                            "severity": alert.severity.value,
                            "threat_type": alert.threat_type.value,
                            "source_ip": alert.source_ip,
                            "endpoint": alert.endpoint,
                            "created_at": alert.created_at.isoformat(),
                            "metadata": alert.metadata,
                        }
                    )
                    + "\n"
                )
        except Exception as e:
            logger.error(f"Failed to log alert: {e}")

    async def _send_incident_notification(self, incident: SecurityIncident):
        """Send incident notification to administrators."""

        # In a real implementation, this would trigger incident response procedures
        logger.critical(
            f"SECURITY INCIDENT: {incident.title} - "
            f"Severity: {incident.severity.value} - "
            f"Affected IPs: {len(incident.affected_ips)} - "
            f"Alert Count: {incident.alert_count}"
        )

        # For now, we'll just log to a file
        try:
            with open("security_incidents.log", "a") as f:
                f.write(
                    json.dumps(
                        {
                            "type": "incident",
                            "id": incident.id,
                            "title": incident.title,
                            "severity": incident.severity.value,
                            "threat_types": [t.value for t in incident.threat_types],
                            "affected_ips": incident.affected_ips,
                            "alert_count": incident.alert_count,
                            "created_at": incident.created_at.isoformat(),
                            "metadata": incident.metadata,
                        }
                    )
                    + "\n"
                )
        except Exception as e:
            logger.error(f"Failed to log incident: {e}")

    async def _archive_alert(self, alert_id: str):
        """Archive a resolved alert after delay."""

        # Wait 24 hours before archiving
        await asyncio.sleep(24 * 3600)

        if alert_id in self.active_alerts:
            del self.active_alerts[alert_id]
            logger.info(f"Archived resolved alert: {alert_id}")

    def _parse_time_window(self, window: str) -> timedelta:
        """Parse time window string into timedelta."""

        if window.endswith("h"):
            return timedelta(hours=int(window[:-1]))
        elif window.endswith("d"):
            return timedelta(days=int(window[:-1]))
        elif window.endswith("w"):
            return timedelta(weeks=int(window[:-1]))
        elif window.endswith("m"):
            return timedelta(minutes=int(window[:-1]))
        else:
            # Default to 1 hour
            return timedelta(hours=1)


# Dependency injection function
async def get_security_monitor(db_session: AsyncSession) -> SecurityMonitor:
    """Get security monitor instance."""
    monitor = SecurityMonitor(db_session)
    await monitor.start_monitoring()
    return monitor
