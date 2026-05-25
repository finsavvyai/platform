"""
DLP Violation Reporting and Alerting System for SDLC.ai DLP Service.

This module provides comprehensive violation tracking, alerting, reporting,
and remediation workflow capabilities for DLP violations.
"""

import asyncio
import logging
import smtplib
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional, Union
import json
import uuid
from email.mime.text import MimeText
from email.mime.multipart import MimeMultipart
import threading
from collections import defaultdict, Counter
import statistics

from app.core.config import get_settings
from app.models.schemas import ViolationInfo, ViolationSeverity, ViolationStatus

logger = logging.getLogger(__name__)


class AlertType(str, Enum):
    """Alert types."""

    EMAIL = "EMAIL"
    WEBHOOK = "WEBHOOK"
    SMS = "SMS"
    SLACK = "SLACK"
    TEAMS = "TEAMS"
    DATADOG = "DATADOG"
    PAGERDUTY = "PAGERDUTY"


class ReportType(str, Enum):
    """Report types."""

    VIOLATION_SUMMARY = "VIOLATION_SUMMARY"
    DAILY_DIGEST = "DAILY_DIGEST"
    WEEKLY_ANALYSIS = "WEEKLY_ANALYSIS"
    MONTHLY_COMPLIANCE = "MONTHLY_COMPLIANCE"
    TREND_ANALYSIS = "TREND_ANALYSIS"
    CUSTOM = "CUSTOM"


class ReportFormat(str, Enum):
    """Report formats."""

    JSON = "JSON"
    CSV = "CSV"
    PDF = "PDF"
    HTML = "HTML"
    EXCEL = "EXCEL"


@dataclass
class AlertConfiguration:
    """Configuration for alert notifications."""

    id: str
    name: str
    alert_type: AlertType
    is_enabled: bool = True

    # Trigger conditions
    severity_threshold: Optional[ViolationSeverity] = None
    violation_count_threshold: int = 1
    time_window_minutes: int = 60

    # Recipient configuration
    recipients: List[str] = field(default_factory=list)

    # Template configuration
    subject_template: Optional[str] = None
    body_template: Optional[str] = None

    # Rate limiting
    max_alerts_per_hour: int = 10
    cooldown_minutes: int = 15

    # Metadata
    metadata: Dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class AlertMessage:
    """Alert message to be sent."""

    id: str
    alert_config_id: str
    subject: str
    body: str
    severity: ViolationSeverity

    # Recipients
    to_recipients: List[str]
    cc_recipients: List[str] = field(default_factory=list)
    bcc_recipients: List[str] = field(default_factory=list)

    # Metadata
    violation_ids: List[str] = field(default_factory=list)
    scan_id: Optional[str] = None
    tenant_id: Optional[str] = None

    # Timestamps
    created_at: datetime = field(default_factory=datetime.utcnow)
    sent_at: Optional[datetime] = None

    # Status
    status: str = "PENDING"  # PENDING, SENT, FAILED
    error_message: Optional[str] = None
    retry_count: int = 0


@dataclass
class ViolationTrend:
    """Violation trend data."""

    time_period: str  # hourly, daily, weekly, monthly
    start_time: datetime
    end_time: datetime

    # Trend data
    total_violations: int
    violations_by_severity: Dict[ViolationSeverity, int]
    violations_by_type: Dict[str, int]
    violations_by_tenant: Dict[str, int]

    # Change analysis
    change_percentage: float
    trend_direction: str  # INCREASING, DECREASING, STABLE

    # Statistical data
    average_violations_per_period: float
    peak_violation_count: int
    peak_violation_time: Optional[datetime]


@dataclass
class ComplianceReport:
    """Compliance report data."""

    report_type: ReportType
    period_start: datetime
    period_end: datetime
    tenant_id: Optional[str]

    # Summary statistics
    total_scans: int
    total_violations: int
    violation_rate: float

    # Breakdown by category
    violations_by_severity: Dict[ViolationSeverity, int]
    violations_by_type: Dict[str, int]
    violations_by_day: Dict[str, int]

    # Risk metrics
    average_risk_score: float
    high_risk_incidents: int
    critical_violations: int

    # Remediation metrics
    violations_resolved: int
    violations_investigating: int
    average_resolution_time_hours: float

    # Compliance status
    compliance_score: float  # 0-100
    compliance_issues: List[str]

    # Recommendations
    recommendations: List[str]

    # Metadata
    generated_at: datetime = field(default_factory=datetime.utcnow)
    generated_by: str = "system"


class AlertChannel(ABC):
    """Abstract base class for alert channels."""

    @abstractmethod
    async def send_alert(self, alert_message: AlertMessage) -> bool:
        """Send an alert message."""
        pass

    @abstractmethod
    def validate_configuration(self, config: Dict[str, Any]) -> Tuple[bool, List[str]]:
        """Validate channel configuration."""
        pass


class EmailAlertChannel(AlertChannel):
    """Email alert channel."""

    def __init__(self):
        self.settings = get_settings()

    async def send_alert(self, alert_message: AlertMessage) -> bool:
        """Send email alert."""
        try:
            # Create message
            msg = MimeMultipart()
            msg["From"] = self.settings.smtp_username or "noreply@sdlc.ai"
            msg["To"] = ", ".join(alert_message.to_recipients)

            if alert_message.cc_recipients:
                msg["Cc"] = ", ".join(alert_message.cc_recipients)

            msg["Subject"] = alert_message.subject

            # Add body
            msg.attach(MimeText(alert_message.body, "html"))

            # Send email
            with smtplib.SMTP(
                self.settings.smtp_server, self.settings.smtp_port
            ) as server:
                if self.settings.smtp_username and self.settings.smtp_password:
                    server.starttls()
                    server.login(
                        self.settings.smtp_username, self.settings.smtp_password
                    )

                all_recipients = (
                    alert_message.to_recipients
                    + alert_message.cc_recipients
                    + alert_message.bcc_recipients
                )
                server.send_message(msg, to_addrs=all_recipients)

            logger.info(f"Email alert sent to {len(all_recipients)} recipients")
            return True

        except Exception as e:
            logger.error(f"Failed to send email alert: {e}")
            return False

    def validate_configuration(self, config: Dict[str, Any]) -> Tuple[bool, List[str]]:
        """Validate email configuration."""
        errors = []

        if not config.get("smtp_server"):
            errors.append("SMTP server is required")

        if not config.get("smtp_port"):
            errors.append("SMTP port is required")

        if not config.get("recipients"):
            errors.append("At least one recipient is required")

        return len(errors) == 0, errors


class WebhookAlertChannel(AlertChannel):
    """Webhook alert channel."""

    def __init__(self):
        import httpx

        self.client = httpx.AsyncClient(timeout=30.0)

    async def send_alert(self, alert_message: AlertMessage) -> bool:
        """Send webhook alert."""
        try:
            webhook_url = alert_message.metadata.get("webhook_url")
            if not webhook_url:
                logger.error("Webhook URL not found in alert metadata")
                return False

            payload = {
                "id": alert_message.id,
                "subject": alert_message.subject,
                "body": alert_message.body,
                "severity": alert_message.severity.value,
                "recipients": alert_message.to_recipients,
                "violation_ids": alert_message.violation_ids,
                "scan_id": alert_message.scan_id,
                "tenant_id": alert_message.tenant_id,
                "created_at": alert_message.created_at.isoformat(),
            }

            response = await self.client.post(
                webhook_url, json=payload, headers={"Content-Type": "application/json"}
            )

            if response.status_code in [200, 201, 202]:
                logger.info(f"Webhook alert sent successfully to {webhook_url}")
                return True
            else:
                logger.error(f"Webhook alert failed with status {response.status_code}")
                return False

        except Exception as e:
            logger.error(f"Failed to send webhook alert: {e}")
            return False

    def validate_configuration(self, config: Dict[str, Any]) -> Tuple[bool, List[str]]:
        """Validate webhook configuration."""
        errors = []

        if not config.get("webhook_url"):
            errors.append("Webhook URL is required")

        return len(errors) == 0, errors


class SlackAlertChannel(AlertChannel):
    """Slack alert channel."""

    def __init__(self):
        import httpx

        self.client = httpx.AsyncClient(timeout=30.0)

    async def send_alert(self, alert_message: AlertMessage) -> bool:
        """Send Slack alert."""
        try:
            webhook_url = alert_message.metadata.get("slack_webhook_url")
            if not webhook_url:
                logger.error("Slack webhook URL not found in alert metadata")
                return False

            # Create Slack message
            slack_message = {
                "text": alert_message.subject,
                "attachments": [
                    {
                        "color": self._get_slack_color(alert_message.severity),
                        "title": alert_message.subject,
                        "text": alert_message.body,
                        "fields": [
                            {
                                "title": "Severity",
                                "value": alert_message.severity.value,
                                "short": True,
                            },
                            {
                                "title": "Violations",
                                "value": str(len(alert_message.violation_ids)),
                                "short": True,
                            },
                        ],
                        "footer": "SDLC.ai DLP",
                        "ts": int(alert_message.created_at.timestamp()),
                    }
                ],
            }

            response = await self.client.post(webhook_url, json=slack_message)

            if response.status_code == 200:
                logger.info("Slack alert sent successfully")
                return True
            else:
                logger.error(f"Slack alert failed with status {response.status_code}")
                return False

        except Exception as e:
            logger.error(f"Failed to send Slack alert: {e}")
            return False

    def _get_slack_color(self, severity: ViolationSeverity) -> str:
        """Get Slack color for severity."""
        color_map = {
            ViolationSeverity.LOW: "good",
            ViolationSeverity.MEDIUM: "warning",
            ViolationSeverity.HIGH: "danger",
            ViolationSeverity.CRITICAL: "#ff0000",
        }
        return color_map.get(severity, "warning")

    def validate_configuration(self, config: Dict[str, Any]) -> Tuple[bool, List[str]]:
        """Validate Slack configuration."""
        errors = []

        if not config.get("slack_webhook_url"):
            errors.append("Slack webhook URL is required")

        return len(errors) == 0, errors


class ViolationReporter:
    """Main violation reporting and alerting service."""

    def __init__(self):
        self.settings = get_settings()

        # Alert channels
        self.channels = {
            AlertType.EMAIL: EmailAlertChannel(),
            AlertType.WEBHOOK: WebhookAlertChannel(),
            AlertType.SLACK: SlackAlertChannel(),
        }

        # Alert configurations
        self.alert_configs: Dict[str, AlertConfiguration] = {}

        # Alert rate limiting
        self.alert_history: Dict[str, List[datetime]] = defaultdict(list)
        self._rate_limit_lock = threading.Lock()

        # Alert queue and processing
        self.alert_queue = asyncio.Queue()
        self.alert_processor_running = False

        # Statistics
        self._stats = defaultdict(int)
        self._stats_lock = threading.Lock()

    async def start(self):
        """Start the violation reporter service."""
        if self.alert_processor_running:
            return

        self.alert_processor_running = True

        # Start alert processor
        asyncio.create_task(self._alert_processor())

        logger.info("Violation reporter service started")

    async def stop(self):
        """Stop the violation reporter service."""
        self.alert_processor_running = False
        logger.info("Violation reporter service stopped")

    def add_alert_configuration(
        self, config: AlertConfiguration
    ) -> Tuple[bool, List[str]]:
        """Add an alert configuration."""
        try:
            # Validate configuration
            channel = self.channels.get(config.alert_type)
            if not channel:
                return False, [f"Unsupported alert type: {config.alert_type}"]

            is_valid, errors = channel.validate_configuration(config.metadata)
            if not is_valid:
                return False, errors

            # Store configuration
            self.alert_configs[config.id] = config

            logger.info(f"Added alert configuration: {config.name}")
            return True, []

        except Exception as e:
            logger.error(f"Failed to add alert configuration: {e}")
            return False, [str(e)]

    def remove_alert_configuration(self, config_id: str) -> bool:
        """Remove an alert configuration."""
        if config_id in self.alert_configs:
            del self.alert_configs[config_id]
            logger.info(f"Removed alert configuration: {config_id}")
            return True
        return False

    async def report_violations(
        self,
        violations: List[ViolationInfo],
        scan_id: Optional[str] = None,
        tenant_id: Optional[str] = None,
        immediate: bool = False,
    ) -> List[str]:
        """Report violations and trigger alerts if needed."""
        if not violations:
            return []

        alert_ids = []

        # Check each alert configuration
        for config in self.alert_configs.values():
            if not config.is_enabled:
                continue

            if self._should_trigger_alert(config, violations):
                alert_id = await self._create_and_queue_alert(
                    config, violations, scan_id, tenant_id
                )
                if alert_id:
                    alert_ids.append(alert_id)

        # Update statistics
        with self._stats_lock:
            self._stats["violations_reported"] += len(violations)
            self._stats["alerts_triggered"] += len(alert_ids)

        # Process immediately if requested
        if immediate and alert_ids:
            await self._process_alert_queue()

        return alert_ids

    def _should_trigger_alert(
        self, config: AlertConfiguration, violations: List[ViolationInfo]
    ) -> bool:
        """Check if alert should be triggered based on configuration."""

        # Check severity threshold
        if config.severity_threshold:
            severity_order = {
                ViolationSeverity.LOW: 1,
                ViolationSeverity.MEDIUM: 2,
                ViolationSeverity.HIGH: 3,
                ViolationSeverity.CRITICAL: 4,
            }

            max_severity_violations = [
                v
                for v in violations
                if severity_order[v.severity]
                >= severity_order[config.severity_threshold]
            ]

            if not max_severity_violations:
                return False
        else:
            max_severity_violations = violations

        # Check violation count threshold
        if len(max_severity_violations) < config.violation_count_threshold:
            return False

        # Check rate limiting
        if not self._check_rate_limit(config):
            return False

        return True

    def _check_rate_limit(self, config: AlertConfiguration) -> bool:
        """Check if alert is within rate limits."""
        with self._rate_limit_lock:
            now = datetime.utcnow()
            recent_alerts = self.alert_history[config.id]

            # Clean old alerts outside time window
            recent_alerts = [
                alert_time
                for alert_time in recent_alerts
                if (now - alert_time).total_seconds() < 3600  # 1 hour
            ]
            self.alert_history[config.id] = recent_alerts

            # Check hourly limit
            if len(recent_alerts) >= config.max_alerts_per_hour:
                return False

            # Check cooldown
            if recent_alerts:
                last_alert = recent_alerts[-1]
                if (now - last_alert).total_seconds() < config.cooldown_minutes * 60:
                    return False

            # Record this alert
            recent_alerts.append(now)
            return True

    async def _create_and_queue_alert(
        self,
        config: AlertConfiguration,
        violations: List[ViolationInfo],
        scan_id: Optional[str],
        tenant_id: Optional[str],
    ) -> Optional[str]:
        """Create and queue an alert."""
        try:
            # Generate alert content
            subject = self._generate_alert_subject(config, violations)
            body = self._generate_alert_body(config, violations)

            # Create alert message
            alert_message = AlertMessage(
                id=str(uuid.uuid4()),
                alert_config_id=config.id,
                subject=subject,
                body=body,
                severity=max(violations, key=lambda v: v.severity).severity,
                to_recipients=config.recipients,
                violation_ids=[v.id for v in violations],
                scan_id=scan_id,
                tenant_id=tenant_id,
                metadata=config.metadata,
            )

            # Queue for processing
            await self.alert_queue.put(alert_message)

            return alert_message.id

        except Exception as e:
            logger.error(f"Failed to create alert: {e}")
            return None

    def _generate_alert_subject(
        self, config: AlertConfiguration, violations: List[ViolationInfo]
    ) -> str:
        """Generate alert subject."""
        if config.subject_template:
            return config.subject_template.format(
                count=len(violations),
                severity=max(violations, key=lambda v: v.severity).severity.value,
                types=list(set(v.violation_type for v in violations))[:3],
            )

        # Default subject
        max_severity = max(violations, key=lambda v: v.severity).severity
        return f"DLP Alert: {len(violations)} {max_severity.value} violations detected"

    def _generate_alert_body(
        self, config: AlertConfiguration, violations: List[ViolationInfo]
    ) -> str:
        """Generate alert body."""
        if config.body_template:
            return config.body_template.format(
                violations=violations,
                count=len(violations),
                severity=max(violations, key=lambda v: v.severity).severity.value,
            )

        # Default HTML body
        max_severity = max(violations, key=lambda v: v.severity).severity

        html_body = f"""
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; margin: 20px; }}
                .header {{ background-color: #f8f9fa; padding: 20px; border-radius: 5px; }}
                .severity-{max_severity.value.lower()} {{
                    background-color: {self._get_severity_color(max_severity)};
                    color: white;
                    padding: 5px 10px;
                    border-radius: 3px;
                }}
                .violation {{ margin: 10px 0; padding: 15px; border-left: 4px solid #ddd; }}
                .critical {{ border-left-color: #dc3545; }}
                .high {{ border-left-color: #fd7e14; }}
                .medium {{ border-left-color: #ffc107; }}
                .low {{ border-left-color: #28a745; }}
            </style>
        </head>
        <body>
            <div class="header">
                <h2>DLP Violation Alert</h2>
                <p><strong>Severity:</strong> <span class="severity-{max_severity.value.lower()}">{max_severity.value}</span></p>
                <p><strong>Total Violations:</strong> {len(violations)}</p>
                <p><strong>Time:</strong> {datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")}</p>
            </div>

            <h3>Violation Details</h3>
        """

        # Add violation details (limit to first 10 for readability)
        for i, violation in enumerate(violations[:10]):
            html_body += f"""
            <div class="violation {violation.severity.value.lower()}">
                <p><strong>Type:</strong> {violation.violation_type}</p>
                <p><strong>Severity:</strong> {violation.severity.value}</p>
                <p><strong>Confidence:</strong> {violation.confidence:.2f}</p>
                <p><strong>Detected Value:</strong> {violation.detected_value}</p>
                <p><strong>Context:</strong> {violation.context}</p>
            </div>
            """

        if len(violations) > 10:
            html_body += (
                f"<p><em>... and {len(violations) - 10} more violations</em></p>"
            )

        html_body += """
        </body>
        </html>
        """

        return html_body

    def _get_severity_color(self, severity: ViolationSeverity) -> str:
        """Get color for severity level."""
        color_map = {
            ViolationSeverity.LOW: "#28a745",
            ViolationSeverity.MEDIUM: "#ffc107",
            ViolationSeverity.HIGH: "#fd7e14",
            ViolationSeverity.CRITICAL: "#dc3545",
        }
        return color_map.get(severity, "#6c757d")

    async def _alert_processor(self):
        """Background processor for alert queue."""
        logger.info("Alert processor started")

        while self.alert_processor_running:
            try:
                # Wait for alert with timeout
                try:
                    alert_message = await asyncio.wait_for(
                        self.alert_queue.get(), timeout=1.0
                    )
                except asyncio.TimeoutError:
                    continue

                # Process alert
                await self._process_alert(alert_message)

            except Exception as e:
                logger.error(f"Error in alert processor: {e}")
                await asyncio.sleep(1.0)

        logger.info("Alert processor stopped")

    async def _process_alert(self, alert_message: AlertMessage):
        """Process a single alert message."""
        try:
            config = self.alert_configs.get(alert_message.alert_config_id)
            if not config:
                logger.error(
                    f"Alert configuration not found: {alert_message.alert_config_id}"
                )
                return

            # Get appropriate channel
            channel = self.channels.get(config.alert_type)
            if not channel:
                logger.error(f"Alert channel not found: {config.alert_type}")
                return

            # Send alert
            success = await channel.send_alert(alert_message)

            if success:
                alert_message.status = "SENT"
                alert_message.sent_at = datetime.utcnow()
                with self._stats_lock:
                    self._stats["alerts_sent"] += 1
            else:
                alert_message.status = "FAILED"
                with self._stats_lock:
                    self._stats["alerts_failed"] += 1

                # Retry logic
                if alert_message.retry_count < 3:
                    alert_message.retry_count += 1
                    await asyncio.sleep(
                        2**alert_message.retry_count
                    )  # Exponential backoff
                    await self.alert_queue.put(alert_message)

        except Exception as e:
            logger.error(f"Error processing alert {alert_message.id}: {e}")
            alert_message.status = "FAILED"
            alert_message.error_message = str(e)

    async def _process_alert_queue(self):
        """Process all alerts in queue immediately."""
        alerts_to_process = []

        # Get all alerts from queue
        while not self.alert_queue.empty():
            try:
                alert = self.alert_queue.get_nowait()
                alerts_to_process.append(alert)
            except asyncio.QueueEmpty:
                break

        # Process alerts in parallel
        if alerts_to_process:
            await asyncio.gather(
                *[self._process_alert(alert) for alert in alerts_to_process],
                return_exceptions=False,
            )

    async def generate_report(
        self,
        report_type: ReportType,
        tenant_id: Optional[str] = None,
        period_start: Optional[datetime] = None,
        period_end: Optional[datetime] = None,
        format: ReportFormat = ReportFormat.JSON,
    ) -> ComplianceReport:
        """Generate a compliance report."""

        # Set default period if not provided
        if not period_end:
            period_end = datetime.utcnow()

        if not period_start:
            if report_type == ReportType.DAILY_DIGEST:
                period_start = period_end - timedelta(days=1)
            elif report_type == ReportType.WEEKLY_ANALYSIS:
                period_start = period_end - timedelta(weeks=1)
            elif report_type == ReportType.MONTHLY_COMPLIANCE:
                period_start = period_end - timedelta(days=30)
            else:
                period_start = period_end - timedelta(days=1)

        # This would typically query a database for actual violation data
        # For now, return a mock report
        return ComplianceReport(
            report_type=report_type,
            period_start=period_start,
            period_end=period_end,
            tenant_id=tenant_id,
            total_scans=1000,  # Mock data
            total_violations=50,
            violation_rate=0.05,
            violations_by_severity={
                ViolationSeverity.LOW: 20,
                ViolationSeverity.MEDIUM: 20,
                ViolationSeverity.HIGH: 8,
                ViolationSeverity.CRITICAL: 2,
            },
            violations_by_type={
                "EMAIL_ADDRESS": 15,
                "PHONE_NUMBER": 10,
                "CREDIT_CARD": 8,
                "SSN": 5,
                "PERSON": 12,
            },
            violations_by_day={
                "2024-01-01": 10,
                "2024-01-02": 15,
                "2024-01-03": 8,
                "2024-01-04": 12,
                "2024-01-05": 5,
            },
            average_risk_score=0.65,
            high_risk_incidents=10,
            critical_violations=2,
            violations_resolved=40,
            violations_investigating=8,
            average_resolution_time_hours=24.5,
            compliance_score=85.5,
            compliance_issues=[
                "High rate of email address violations",
                "Insufficient user training on PII handling",
            ],
            recommendations=[
                "Implement additional email masking",
                "Conduct security awareness training",
                "Review data classification policies",
            ],
        )

    async def get_violation_trends(
        self,
        tenant_id: Optional[str] = None,
        time_period: str = "daily",
        days: int = 30,
    ) -> List[ViolationTrend]:
        """Get violation trends over time."""

        trends = []
        current_time = datetime.utcnow()

        # Generate mock trend data
        for i in range(days):
            period_end = current_time - timedelta(days=i)
            period_start = period_end - timedelta(days=1)

            # Mock data with some variation
            base_violations = 10
            variation = int(5 * (i % 7) / 3)  # Weekly pattern
            total_violations = base_violations + variation

            trends.append(
                ViolationTrend(
                    time_period=time_period,
                    start_time=period_start,
                    end_time=period_end,
                    total_violations=total_violations,
                    violations_by_severity={
                        ViolationSeverity.LOW: total_violations // 2,
                        ViolationSeverity.MEDIUM: total_violations // 3,
                        ViolationSeverity.HIGH: total_violations // 6,
                        ViolationSeverity.CRITICAL: max(1, total_violations // 10),
                    },
                    violations_by_type={
                        "EMAIL_ADDRESS": total_violations // 3,
                        "PHONE_NUMBER": total_violations // 4,
                        "PERSON": total_violations // 3,
                    },
                    violations_by_tenant={"default": total_violations}
                    if not tenant_id
                    else {tenant_id: total_violations},
                    change_percentage=0.0,  # Would calculate from previous period
                    trend_direction="STABLE",
                    average_violations_per_period=float(total_violations),
                    peak_violation_count=total_violations,
                    peak_violation_time=period_end,
                )
            )

        return trends

    def get_statistics(self) -> Dict[str, Any]:
        """Get violation reporter statistics."""
        with self._stats_lock:
            stats = dict(self._stats)

        stats.update(
            {
                "alert_configurations": len(self.alert_configs),
                "active_channels": len(self.channels),
                "alert_queue_size": self.alert_queue.qsize(),
            }
        )

        return stats


# Singleton instance
_violation_reporter = None


def get_violation_reporter() -> ViolationReporter:
    """Get singleton instance of violation reporter."""
    global _violation_reporter
    if _violation_reporter is None:
        _violation_reporter = ViolationReporter()
    return _violation_reporter
