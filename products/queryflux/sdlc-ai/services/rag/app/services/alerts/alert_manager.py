"""
Alert Management Service.

This module provides real-time alert management for cost anomalies, budget breaches,
and other token-related events with multi-channel notifications and intelligent
alerting strategies.
"""

import asyncio
import json
import logging
import smtplib
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Any, Dict, List, Optional, Union, Callable
from dataclasses import dataclass, field
from enum import Enum
from collections import defaultdict
import uuid
import aiohttp
import jinja2

from email.mime.text import MimeText
from email.mime.multipart import MimeMultipart

import redis.asyncio as redis
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


class AlertSeverity(Enum):
    """Alert severity levels."""

    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


class AlertStatus(Enum):
    """Alert status types."""

    ACTIVE = "active"
    ACKNOWLEDGED = "acknowledged"
    RESOLVED = "resolved"
    SUPPRESSED = "suppressed"
    ESCALATED = "escalated"


class NotificationChannel(Enum):
    """Notification channel types."""

    EMAIL = "email"
    SLACK = "slack"
    WEBHOOK = "webhook"
    SMS = "sms"
    PUSH = "push"
    DISCORD = "discord"
    TEAMS = "teams"
    PAGERDUTY = "pagerduty"


class AlertType(Enum):
    """Types of alerts."""

    BUDGET_THRESHOLD = "budget_threshold"
    BUDGET_EXHAUSTED = "budget_exhausted"
    COST_ANOMALY = "cost_anomaly"
    USAGE_SPIKE = "usage_spiKE"
    TOKEN_QUOTA_EXCEEDED = "token_quota_exceeded"
    PROVIDER_FAILURE = "provider_failure"
    PERFORMANCE_DEGRADATION = "performance_degradation"
    COST_INCREASE = "cost_increase"
    SECURITY_ANOMALY = "security_anomaly"
    BILLING_ISSUE = "billing_issue"


@dataclass
class AlertRule:
    """Alert rule configuration."""

    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    name: str = ""
    description: str = ""
    enabled: bool = True

    # Rule conditions
    tenant_ids: List[str] = field(default_factory=list)
    alert_types: List[AlertType] = field(default_factory=list)
    severity_threshold: Optional[AlertSeverity] = None

    # Conditions
    budget_threshold_percentage: Optional[float] = None
    cost_increase_percentage: Optional[float] = None
    usage_spike_multiplier: Optional[float] = None
    anomaly_detection_sensitivity: float = 2.0  # Standard deviations

    # Notification settings
    notification_channels: List[NotificationChannel] = field(default_factory=list)
    notification_emails: List[str] = field(default_factory=list)
    notification_webhooks: List[str] = field(default_factory=list)
    notification_slack_channels: List[str] = field(default_factory=list)

    # Suppression and deduplication
    cooldown_minutes: int = 60
    suppression_rules: List[str] = field(default_factory=list)
    deduplication_window_minutes: int = 15

    # Escalation settings
    escalation_enabled: bool = False
    escalation_channels: List[NotificationChannel] = field(default_factory=list)
    escalation_delay_minutes: int = 30
    max_escalations: int = 3

    # Metadata
    created_at: datetime = field(default_factory=datetime.now)
    created_by: Optional[str] = None
    tags: List[str] = field(default_factory=list)
    priority: int = 0


@dataclass
class Alert:
    """Alert instance."""

    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    rule_id: str = ""
    tenant_id: str = ""
    alert_type: AlertType = AlertType.COST_ANOMALY
    severity: AlertSeverity = AlertSeverity.WARNING
    status: AlertStatus = AlertStatus.ACTIVE

    # Alert content
    title: str = ""
    message: str = ""
    description: str = ""

    # Context data
    context: Dict[str, Any] = field(default_factory=dict)
    metrics: Dict[str, Union[str, int, float, Decimal]] = field(default_factory=dict)

    # Timestamps
    triggered_at: datetime = field(default_factory=datetime.now)
    acknowledged_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    last_sent_at: Optional[datetime] = None

    # Acknowledgment and resolution
    acknowledged_by: Optional[str] = None
    resolved_by: Optional[str] = None
    resolution_notes: Optional[str] = None

    # Notification tracking
    notifications_sent: List[Dict[str, Any]] = field(default_factory=list)
    escalation_count: int = 0

    # Metadata
    tags: List[str] = field(default_factory=list)
    correlation_id: Optional[str] = None


@dataclass
class NotificationTemplate:
    """Notification template configuration."""

    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    name: str = ""
    channel: NotificationChannel = NotificationChannel.EMAIL

    # Template content
    subject_template: str = ""
    body_template: str = ""

    # Template variables
    variables: List[str] = field(default_factory=list)

    # Formatting
    content_type: str = "text/html"  # text/plain, text/html

    # Metadata
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    created_by: Optional[str] = None


class AlertMetrics(BaseModel):
    """Alert system metrics."""

    total_alerts: int = 0
    active_alerts: int = 0
    resolved_alerts: int = 0

    alerts_by_severity: Dict[str, int] = Field(default_factory=dict)
    alerts_by_type: Dict[str, int] = Field(default_factory=dict)
    alerts_by_tenant: Dict[str, int] = Field(default_factory=dict)

    # Performance metrics
    avg_resolution_time_minutes: float = 0.0
    avg_acknowledgment_time_minutes: float = 0.0

    # Notification metrics
    notifications_sent: int = 0
    notification_success_rate: float = 0.0

    # Time period
    period_start: datetime = Field(default_factory=datetime.now)
    period_end: datetime = Field(default_factory=datetime.now)


class AlertManager:
    """Comprehensive alert management service."""

    def __init__(
        self,
        redis_url: str = "redis://localhost:6379/0",
        smtp_server: Optional[str] = None,
        smtp_port: int = 587,
        smtp_username: Optional[str] = None,
        smtp_password: Optional[str] = None,
        slack_bot_token: Optional[str] = None,
        default_from_email: str = "alerts@sdlc.ai",
        template_dir: str = "templates",
        retention_days: int = 90,
        max_alerts_per_tenant: int = 1000,
        enable_deduplication: bool = True,
        enable_suppression: bool = True,
    ):
        """Initialize alert manager."""
        self.redis_url = redis_url
        self.smtp_server = smtp_server
        self.smtp_port = smtp_port
        self.smtp_username = smtp_username
        self.smtp_password = smtp_password
        self.slack_bot_token = slack_bot_token
        self.default_from_email = default_from_email
        self.template_dir = template_dir
        self.retention_days = retention_days
        self.max_alerts_per_tenant = max_alerts_per_tenant
        self.enable_deduplication = enable_deduplication
        self.enable_suppression = enable_suppression

        self._redis: Optional[redis.Redis] = None
        self._initialized = False

        # Template engine
        self._jinja_env = jinja2.Environment(
            loader=jinja2.FileSystemLoader(template_dir),
            autoescape=True,
        )

        # In-memory caches
        self._alert_rules: Dict[str, AlertRule] = {}
        self._active_alerts: Dict[str, Alert] = {}
        self._notification_templates: Dict[str, NotificationTemplate] = {}

        # HTTP session for webhooks
        self._http_session: Optional[aiohttp.ClientSession] = None

        # Background tasks
        self._alert_processing_task: Optional[asyncio.Task] = None
        self._notification_task: Optional[asyncio.Task] = None
        self._cleanup_task: Optional[asyncio.Task] = None

        # Redis key prefixes
        self.ALERTS_KEY_PREFIX = "alerts:"
        self.RULES_KEY_PREFIX = "alert_rules:"
        self.TEMPLATES_KEY_PREFIX = "alert_templates:"
        self.METRICS_KEY_PREFIX = "alert_metrics:"
        self.COOLDOWN_KEY_PREFIX = "alert_cooldown:"
        self.SUPPRESSION_KEY_PREFIX = "alert_suppression:"

    async def initialize(self) -> None:
        """Initialize the alert manager."""
        if self._initialized:
            return

        try:
            self._redis = redis.from_url(self.redis_url, decode_responses=False)

            # Test Redis connection
            await self._redis.ping()

            # Initialize HTTP session
            self._http_session = aiohttp.ClientSession()

            # Load default alert rules and templates
            await self._load_default_rules()
            await self._load_default_templates()

            # Start background tasks
            self._alert_processing_task = asyncio.create_task(
                self._alert_processing_loop()
            )
            self._notification_task = asyncio.create_task(
                self._notification_processing_loop()
            )
            self._cleanup_task = asyncio.create_task(self._cleanup_loop())

            self._initialized = True
            logger.info("Alert Manager initialized successfully")

        except Exception as e:
            logger.error(f"Failed to initialize Alert Manager: {e}")
            raise

    async def cleanup(self) -> None:
        """Clean up alert manager resources."""
        if not self._initialized:
            return

        try:
            # Stop background tasks
            if self._alert_processing_task:
                self._alert_processing_task.cancel()
                try:
                    await self._alert_processing_task
                except asyncio.CancelledError:
                    pass

            if self._notification_task:
                self._notification_task.cancel()
                try:
                    await self._notification_task
                except asyncio.CancelledError:
                    pass

            if self._cleanup_task:
                self._cleanup_task.cancel()
                try:
                    await self._cleanup_task
                except asyncio.CancelledError:
                    pass

            # Close HTTP session
            if self._http_session:
                await self._http_session.close()

            # Close Redis connection
            if self._redis:
                await self._redis.close()

            self._initialized = False
            logger.info("Alert Manager cleaned up")

        except Exception as e:
            logger.error(f"Error during Alert Manager cleanup: {e}")

    async def create_alert_rule(self, rule: AlertRule) -> str:
        """Create a new alert rule."""
        try:
            # Store rule
            rule_key = f"{self.RULES_KEY_PREFIX}{rule.id}"
            rule_data = {
                "name": rule.name,
                "description": rule.description,
                "enabled": str(rule.enabled).lower(),
                "tenant_ids": json.dumps(rule.tenant_ids),
                "alert_types": json.dumps([t.value for t in rule.alert_types]),
                "severity_threshold": rule.severity_threshold.value
                if rule.severity_threshold
                else "",
                "budget_threshold_percentage": str(rule.budget_threshold_percentage)
                if rule.budget_threshold_percentage
                else "",
                "cost_increase_percentage": str(rule.cost_increase_percentage)
                if rule.cost_increase_percentage
                else "",
                "usage_spike_multiplier": str(rule.usage_spike_multiplier)
                if rule.usage_spike_multiplier
                else "",
                "anomaly_detection_sensitivity": str(
                    rule.anomaly_detection_sensitivity
                ),
                "notification_channels": json.dumps(
                    [c.value for c in rule.notification_channels]
                ),
                "notification_emails": json.dumps(rule.notification_emails),
                "notification_webhooks": json.dumps(rule.notification_webhooks),
                "notification_slack_channels": json.dumps(
                    rule.notification_slack_channels
                ),
                "cooldown_minutes": str(rule.cooldown_minutes),
                "suppression_rules": json.dumps(rule.suppression_rules),
                "deduplication_window_minutes": str(rule.deduplication_window_minutes),
                "escalation_enabled": str(rule.escalation_enabled).lower(),
                "escalation_channels": json.dumps(
                    [c.value for c in rule.escalation_channels]
                ),
                "escalation_delay_minutes": str(rule.escalation_delay_minutes),
                "max_escalations": str(rule.max_escalations),
                "created_at": rule.created_at.isoformat(),
                "created_by": rule.created_by or "",
                "tags": json.dumps(rule.tags),
                "priority": str(rule.priority),
            }

            await self._redis.hset(rule_key, mapping=rule_data)
            await self._redis.expire(rule_key, 365 * 24 * 3600)  # 1 year

            # Update cache
            self._alert_rules[rule.id] = rule

            logger.info(f"Created alert rule '{rule.name}'")
            return rule.id

        except Exception as e:
            logger.error(f"Failed to create alert rule: {e}")
            raise

    async def trigger_alert(
        self,
        alert_type: AlertType,
        tenant_id: str,
        title: str,
        message: str,
        severity: AlertSeverity = AlertSeverity.WARNING,
        context: Optional[Dict[str, Any]] = None,
        metrics: Optional[Dict[str, Union[str, int, float, Decimal]]] = None,
        correlation_id: Optional[str] = None,
        tags: Optional[List[str]] = None,
    ) -> Alert:
        """Trigger a new alert."""
        if not self._initialized:
            await self.initialize()

        try:
            # Find applicable rules
            applicable_rules = [
                rule
                for rule in self._alert_rules.values()
                if rule.enabled
                and self._rule_matches(rule, tenant_id, alert_type, severity)
            ]

            if not applicable_rules:
                logger.debug(
                    f"No applicable rules found for alert type {alert_type.value}"
                )
                # Still create the alert but without rule-based processing
                applicable_rules = []

            # Check for suppression
            if await self._is_suppressed(tenant_id, alert_type, context):
                logger.info(f"Alert suppressed for tenant {tenant_id}")
                return None

            # Check for deduplication
            if self.enable_deduplication:
                existing_alert = await self._find_duplicate_alert(
                    tenant_id, alert_type, title, context
                )
                if existing_alert:
                    logger.debug(
                        f"Duplicate alert found, updating existing alert {existing_alert.id}"
                    )
                    await self._update_existing_alert(existing_alert, message, metrics)
                    return existing_alert

            # Create new alert
            alert = Alert(
                rule_id=applicable_rules[0].id if applicable_rules else "",
                tenant_id=tenant_id,
                alert_type=alert_type,
                severity=severity,
                title=title,
                message=message,
                description=message,
                context=context or {},
                metrics=metrics or {},
                tags=tags or [],
                correlation_id=correlation_id,
            )

            # Store alert
            await self._store_alert(alert)

            # Check cooldown for each rule
            for rule in applicable_rules:
                cooldown_key = f"{self.COOLDOWN_KEY_PREFIX}{rule.id}:{tenant_id}:{alert_type.value}"
                if not await self._redis.exists(cooldown_key):
                    # Set cooldown
                    await self._redis.setex(
                        cooldown_key, rule.cooldown_minutes * 60, "1"
                    )

                    # Queue notifications
                    await self._queue_notifications(alert, rule)
                else:
                    logger.debug(f"Alert in cooldown period for rule {rule.id}")

            # Add to active alerts
            self._active_alerts[alert.id] = alert

            logger.warning(f"Alert triggered: {title} for tenant {tenant_id}")
            return alert

        except Exception as e:
            logger.error(f"Failed to trigger alert: {e}")
            raise

    async def acknowledge_alert(
        self, alert_id: str, acknowledged_by: str, notes: Optional[str] = None
    ) -> bool:
        """Acknowledge an alert."""
        try:
            alert = await self._get_alert(alert_id)
            if not alert:
                return False

            alert.status = AlertStatus.ACKNOWLEDGED
            alert.acknowledged_at = datetime.now()
            alert.acknowledged_by = acknowledged_by
            if notes:
                alert.resolution_notes = notes

            await self._store_alert(alert)
            self._active_alerts[alert_id] = alert

            logger.info(f"Alert {alert_id} acknowledged by {acknowledged_by}")
            return True

        except Exception as e:
            logger.error(f"Failed to acknowledge alert: {e}")
            return False

    async def resolve_alert(
        self, alert_id: str, resolved_by: str, resolution_notes: Optional[str] = None
    ) -> bool:
        """Resolve an alert."""
        try:
            alert = await self._get_alert(alert_id)
            if not alert:
                return False

            alert.status = AlertStatus.RESOLVED
            alert.resolved_at = datetime.now()
            alert.resolved_by = resolved_by
            if resolution_notes:
                alert.resolution_notes = resolution_notes

            await self._store_alert(alert)

            # Remove from active alerts
            if alert_id in self._active_alerts:
                del self._active_alerts[alert_id]

            logger.info(f"Alert {alert_id} resolved by {resolved_by}")
            return True

        except Exception as e:
            logger.error(f"Failed to resolve alert: {e}")
            return False

    async def get_active_alerts(
        self, tenant_id: Optional[str] = None, severity: Optional[AlertSeverity] = None
    ) -> List[Alert]:
        """Get active alerts."""
        try:
            alerts = []

            for alert in self._active_alerts.values():
                if alert.status != AlertStatus.ACTIVE:
                    continue

                if tenant_id and alert.tenant_id != tenant_id:
                    continue

                if severity and alert.severity != severity:
                    continue

                alerts.append(alert)

            # Sort by severity and timestamp
            alerts.sort(key=lambda x: (x.severity.value, x.triggered_at), reverse=True)
            return alerts

        except Exception as e:
            logger.error(f"Failed to get active alerts: {e}")
            return []

    async def get_alert_metrics(
        self, tenant_id: Optional[str] = None, days: int = 30
    ) -> AlertMetrics:
        """Get alert system metrics."""
        try:
            end_date = datetime.now()
            start_date = end_date - timedelta(days=days)

            metrics = AlertMetrics(
                period_start=start_date,
                period_end=end_date,
            )

            # Get alert statistics
            pattern = f"{self.ALERTS_KEY_PREFIX}*"
            keys = await self._redis.keys(pattern)

            total_alerts = 0
            active_alerts = 0
            resolved_alerts = 0

            severity_counts = defaultdict(int)
            type_counts = defaultdict(int)
            tenant_counts = defaultdict(int)

            resolution_times = []
            acknowledgment_times = []

            for key in keys:
                alert_data = await self._redis.hgetall(key)
                if alert_data:
                    alert_id = key.decode().split(":")[-1]
                    status = alert_data.get(b"status", b"").decode()
                    severity = alert_data.get(b"severity", b"").decode()
                    alert_type = alert_data.get(b"alert_type", b"").decode()
                    alert_tenant_id = alert_data.get(b"tenant_id", b"").decode()
                    triggered_at = datetime.fromisoformat(
                        alert_data.get(
                            b"triggered_at", datetime.now().isoformat()
                        ).decode()
                    )

                    if start_date <= triggered_at <= end_date:
                        total_alerts += 1

                        if tenant_id and alert_tenant_id != tenant_id:
                            continue

                        severity_counts[severity] += 1
                        type_counts[alert_type] += 1
                        tenant_counts[alert_tenant_id] += 1

                        if status == "active":
                            active_alerts += 1
                        elif status == "resolved":
                            resolved_alerts += 1

                            # Calculate resolution time
                            resolved_at_str = alert_data.get(
                                b"resolved_at", b""
                            ).decode()
                            if resolved_at_str:
                                resolved_at = datetime.fromisoformat(resolved_at_str)
                                resolution_time = (
                                    resolved_at - triggered_at
                                ).total_seconds() / 60
                                resolution_times.append(resolution_time)

            metrics.total_alerts = total_alerts
            metrics.active_alerts = active_alerts
            metrics.resolved_alerts = resolved_alerts
            metrics.alerts_by_severity = dict(severity_counts)
            metrics.alerts_by_type = dict(type_counts)
            metrics.alerts_by_tenant = dict(tenant_counts)

            if resolution_times:
                metrics.avg_resolution_time_minutes = statistics.mean(resolution_times)

            return metrics

        except Exception as e:
            logger.error(f"Failed to get alert metrics: {e}")
            return AlertMetrics()

    async def send_test_notification(
        self,
        channel: NotificationChannel,
        recipient: str,
        test_message: Optional[str] = None,
    ) -> bool:
        """Send a test notification."""
        try:
            test_alert = Alert(
                tenant_id="test",
                alert_type=AlertType.COST_ANOMALY,
                severity=AlertSeverity.INFO,
                title="Test Notification",
                message=test_message
                or "This is a test notification from the Alert Manager.",
                context={"test": True},
            )

            success = await self._send_notification(test_alert, channel, recipient)

            if success:
                logger.info(
                    f"Test notification sent via {channel.value} to {recipient}"
                )
            else:
                logger.error(
                    f"Failed to send test notification via {channel.value} to {recipient}"
                )

            return success

        except Exception as e:
            logger.error(f"Failed to send test notification: {e}")
            return False

    async def _rule_matches(
        self,
        rule: AlertRule,
        tenant_id: str,
        alert_type: AlertType,
        severity: AlertSeverity,
    ) -> bool:
        """Check if an alert rule matches the alert conditions."""
        try:
            # Check tenant filter
            if rule.tenant_ids and tenant_id not in rule.tenant_ids:
                return False

            # Check alert type filter
            if rule.alert_types and alert_type not in rule.alert_types:
                return False

            # Check severity threshold
            if rule.severity_threshold:
                severity_order = [
                    AlertSeverity.INFO,
                    AlertSeverity.WARNING,
                    AlertSeverity.ERROR,
                    AlertSeverity.CRITICAL,
                ]
                if severity_order.index(severity) < severity_order.index(
                    rule.severity_threshold
                ):
                    return False

            return True

        except Exception as e:
            logger.error(f"Failed to check rule match: {e}")
            return False

    async def _is_suppressed(
        self, tenant_id: str, alert_type: AlertType, context: Optional[Dict[str, Any]]
    ) -> bool:
        """Check if alert should be suppressed."""
        if not self.enable_suppression:
            return False

        try:
            # Check suppression rules
            suppression_key = (
                f"{self.SUPPRESSION_KEY_PREFIX}{tenant_id}:{alert_type.value}"
            )
            suppressed = await self._redis.exists(suppression_key)

            return suppressed

        except Exception as e:
            logger.error(f"Failed to check suppression: {e}")
            return False

    async def _find_duplicate_alert(
        self,
        tenant_id: str,
        alert_type: AlertType,
        title: str,
        context: Optional[Dict[str, Any]],
    ) -> Optional[Alert]:
        """Find existing duplicate alert."""
        try:
            # Look for similar alerts in the last 15 minutes
            cutoff_time = datetime.now() - timedelta(minutes=15)

            for alert in self._active_alerts.values():
                if (
                    alert.tenant_id == tenant_id
                    and alert.alert_type == alert_type
                    and alert.title == title
                    and alert.triggered_at > cutoff_time
                    and alert.status == AlertStatus.ACTIVE
                ):
                    return alert

        except Exception as e:
            logger.error(f"Failed to find duplicate alert: {e}")

        return None

    async def _update_existing_alert(
        self,
        alert: Alert,
        message: str,
        metrics: Optional[Dict[str, Union[str, int, float, Decimal]]] = None,
    ) -> None:
        """Update existing alert with new information."""
        try:
            alert.message = message
            alert.triggered_at = datetime.now()  # Update trigger time

            if metrics:
                alert.metrics.update(metrics)

            await self._store_alert(alert)

        except Exception as e:
            logger.error(f"Failed to update existing alert: {e}")

    async def _store_alert(self, alert: Alert) -> None:
        """Store alert in Redis."""
        try:
            alert_key = f"{self.ALERTS_KEY_PREFIX}{alert.id}"
            alert_data = {
                "rule_id": alert.rule_id,
                "tenant_id": alert.tenant_id,
                "alert_type": alert.alert_type.value,
                "severity": alert.severity.value,
                "status": alert.status.value,
                "title": alert.title,
                "message": alert.message,
                "description": alert.description,
                "context": json.dumps(alert.context),
                "metrics": json.dumps(alert.metrics, default=str),
                "triggered_at": alert.triggered_at.isoformat(),
                "acknowledged_at": alert.acknowledged_at.isoformat()
                if alert.acknowledged_at
                else "",
                "resolved_at": alert.resolved_at.isoformat()
                if alert.resolved_at
                else "",
                "acknowledged_by": alert.acknowledged_by or "",
                "resolved_by": alert.resolved_by or "",
                "resolution_notes": alert.resolution_notes or "",
                "notifications_sent": json.dumps(alert.notifications_sent),
                "escalation_count": str(alert.escalation_count),
                "tags": json.dumps(alert.tags),
                "correlation_id": alert.correlation_id or "",
            }

            await self._redis.hset(alert_key, mapping=alert_data)
            await self._redis.expire(alert_key, self.retention_days * 24 * 3600)

        except Exception as e:
            logger.error(f"Failed to store alert: {e}")
            raise

    async def _get_alert(self, alert_id: str) -> Optional[Alert]:
        """Get alert by ID."""
        try:
            alert_key = f"{self.ALERTS_KEY_PREFIX}{alert_id}"
            alert_data = await self._redis.hgetall(alert_key)

            if alert_data:
                return Alert(
                    id=alert_id,
                    rule_id=alert_data.get(b"rule_id", b"").decode(),
                    tenant_id=alert_data.get(b"tenant_id", b"").decode(),
                    alert_type=AlertType(alert_data.get(b"alert_type", b"").decode()),
                    severity=AlertSeverity(alert_data.get(b"severity", b"").decode()),
                    status=AlertStatus(alert_data.get(b"status", b"").decode()),
                    title=alert_data.get(b"title", b"").decode(),
                    message=alert_data.get(b"message", b"").decode(),
                    description=alert_data.get(b"description", b"").decode(),
                    context=json.loads(alert_data.get(b"context", b"{}").decode()),
                    metrics=json.loads(alert_data.get(b"metrics", b"{}").decode()),
                    triggered_at=datetime.fromisoformat(
                        alert_data.get(
                            b"triggered_at", datetime.now().isoformat()
                        ).decode()
                    ),
                    acknowledged_at=datetime.fromisoformat(
                        alert_data.get(b"acknowledged_at", "").decode()
                    )
                    if alert_data.get(b"acknowledged_at")
                    else None,
                    resolved_at=datetime.fromisoformat(
                        alert_data.get(b"resolved_at", "").decode()
                    )
                    if alert_data.get(b"resolved_at")
                    else None,
                    acknowledged_by=alert_data.get(b"acknowledged_by", b"").decode()
                    or None,
                    resolved_by=alert_data.get(b"resolved_by", b"").decode() or None,
                    resolution_notes=alert_data.get(b"resolution_notes", b"").decode()
                    or None,
                    notifications_sent=json.loads(
                        alert_data.get(b"notifications_sent", b"[]").decode()
                    ),
                    escalation_count=int(
                        alert_data.get(b"escalation_count", b"0").decode()
                    ),
                    tags=json.loads(alert_data.get(b"tags", b"[]").decode()),
                    correlation_id=alert_data.get(b"correlation_id", b"").decode()
                    or None,
                )

        except Exception as e:
            logger.error(f"Failed to get alert: {e}")

        return None

    async def _queue_notifications(self, alert: Alert, rule: AlertRule) -> None:
        """Queue notifications for an alert."""
        try:
            notification_queue_key = f"{self.ALERTS_KEY_PREFIX}notifications:queue"
            notification_data = {
                "alert_id": alert.id,
                "rule_id": rule.id,
                "channels": [c.value for c in rule.notification_channels],
                "emails": rule.notification_emails,
                "webhooks": rule.notification_webhooks,
                "slack_channels": rule.notification_slack_channels,
                "queued_at": datetime.now().isoformat(),
            }

            await self._redis.lpush(
                notification_queue_key, json.dumps(notification_data)
            )

        except Exception as e:
            logger.error(f"Failed to queue notifications: {e}")

    async def _send_notification(
        self, alert: Alert, channel: NotificationChannel, recipient: str
    ) -> bool:
        """Send notification via specified channel."""
        try:
            if channel == NotificationChannel.EMAIL:
                return await self._send_email_notification(alert, recipient)
            elif channel == NotificationChannel.SLACK:
                return await self._send_slack_notification(alert, recipient)
            elif channel == NotificationChannel.WEBHOOK:
                return await self._send_webhook_notification(alert, recipient)
            else:
                logger.warning(f"Notification channel {channel.value} not implemented")
                return False

        except Exception as e:
            logger.error(f"Failed to send notification via {channel.value}: {e}")
            return False

    async def _send_email_notification(self, alert: Alert, recipient: str) -> bool:
        """Send email notification."""
        if not self.smtp_server:
            logger.warning("SMTP server not configured")
            return False

        try:
            # Render email template
            template = self._jinja_env.get_template("alert_email.html")
            subject = f"[{alert.severity.value.upper()}] {alert.title}"
            body = template.render(alert=alert)

            # Create email message
            msg = MimeMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = self.default_from_email
            msg["To"] = recipient

            # Attach HTML body
            html_part = MimeText(body, "html")
            msg.attach(html_part)

            # Send email
            server = smtplib.SMTP(self.smtp_server, self.smtp_port)
            if self.smtp_username and self.smtp_password:
                server.starttls()
                server.login(self.smtp_username, self.smtp_password)

            server.send_message(msg)
            server.quit()

            logger.info(f"Email notification sent to {recipient}")
            return True

        except Exception as e:
            logger.error(f"Failed to send email notification: {e}")
            return False

    async def _send_slack_notification(self, alert: Alert, channel: str) -> bool:
        """Send Slack notification."""
        if not self.slack_bot_token:
            logger.warning("Slack bot token not configured")
            return False

        try:
            # Prepare Slack message
            color = {
                AlertSeverity.INFO: "good",
                AlertSeverity.WARNING: "warning",
                AlertSeverity.ERROR: "danger",
                AlertSeverity.CRITICAL: "danger",
            }.get(alert.severity, "warning")

            payload = {
                "channel": channel,
                "attachments": [
                    {
                        "color": color,
                        "title": alert.title,
                        "text": alert.message,
                        "fields": [
                            {
                                "title": "Tenant",
                                "value": alert.tenant_id,
                                "short": True,
                            },
                            {
                                "title": "Severity",
                                "value": alert.severity.value.upper(),
                                "short": True,
                            },
                            {
                                "title": "Time",
                                "value": alert.triggered_at.strftime(
                                    "%Y-%m-%d %H:%M:%S UTC"
                                ),
                                "short": True,
                            },
                        ],
                        "footer": "Alert Manager",
                        "ts": int(alert.triggered_at.timestamp()),
                    }
                ],
            }

            # Send to Slack
            headers = {
                "Authorization": f"Bearer {self.slack_bot_token}",
                "Content-Type": "application/json",
            }

            async with self._http_session.post(
                "https://slack.com/api/chat.postMessage",
                headers=headers,
                json=payload,
            ) as response:
                if response.status == 200:
                    result = await response.json()
                    if result.get("ok"):
                        logger.info(f"Slack notification sent to {channel}")
                        return True
                    else:
                        logger.error(f"Slack API error: {result.get('error')}")
                        return False
                else:
                    logger.error(
                        f"Failed to send Slack notification: {response.status}"
                    )
                    return False

        except Exception as e:
            logger.error(f"Failed to send Slack notification: {e}")
            return False

    async def _send_webhook_notification(self, alert: Alert, webhook_url: str) -> bool:
        """Send webhook notification."""
        try:
            payload = {
                "alert_id": alert.id,
                "tenant_id": alert.tenant_id,
                "alert_type": alert.alert_type.value,
                "severity": alert.severity.value,
                "title": alert.title,
                "message": alert.message,
                "context": alert.context,
                "metrics": alert.metrics,
                "triggered_at": alert.triggered_at.isoformat(),
                "tags": alert.tags,
            }

            async with self._http_session.post(
                webhook_url, json=payload, timeout=30
            ) as response:
                if response.status < 400:
                    logger.info(f"Webhook notification sent to {webhook_url}")
                    return True
                else:
                    logger.error(
                        f"Failed to send webhook notification: {response.status}"
                    )
                    return False

        except Exception as e:
            logger.error(f"Failed to send webhook notification: {e}")
            return False

    async def _load_default_rules(self) -> None:
        """Load default alert rules."""
        try:
            # Budget threshold rule
            budget_rule = AlertRule(
                name="Budget Threshold Alert",
                description="Alert when budget usage exceeds threshold",
                alert_types=[AlertType.BUDGET_THRESHOLD],
                budget_threshold_percentage=80.0,
                severity_threshold=AlertSeverity.WARNING,
                notification_channels=[NotificationChannel.EMAIL],
                cooldown_minutes=60,
                priority=90,
            )
            await self.create_alert_rule(budget_rule)

            # Cost anomaly rule
            anomaly_rule = AlertRule(
                name="Cost Anomaly Alert",
                description="Alert when unusual cost patterns are detected",
                alert_types=[AlertType.COST_ANOMALY],
                severity_threshold=AlertSeverity.WARNING,
                notification_channels=[
                    NotificationChannel.EMAIL,
                    NotificationChannel.SLACK,
                ],
                cooldown_minutes=30,
                priority=80,
            )
            await self.create_alert_rule(anomaly_rule)

        except Exception as e:
            logger.error(f"Failed to load default rules: {e}")

    async def _load_default_templates(self) -> None:
        """Load default notification templates."""
        try:
            # Email template
            email_template = NotificationTemplate(
                name="Default Email Alert",
                channel=NotificationChannel.EMAIL,
                subject_template="[{{ severity.upper() }}] {{ title }}",
                body_template="""
<h2>Alert: {{ title }}</h2>
<p><strong>Severity:</strong> {{ severity.upper() }}</p>
<p><strong>Tenant:</strong> {{ tenant_id }}</p>
<p><strong>Time:</strong> {{ triggered_at }}</p>
<p><strong>Message:</strong> {{ message }}</p>

{% if context %}
<h3>Context:</h3>
<ul>
{% for key, value in context.items() %}
    <li><strong>{{ key }}:</strong> {{ value }}</li>
{% endfor %}
</ul>
{% endif %}

{% if metrics %}
<h3>Metrics:</h3>
<ul>
{% for key, value in metrics.items() %}
    <li><strong>{{ key }}:</strong> {{ value }}</li>
{% endfor %}
</ul>
{% endif %}

<p><small>This alert was generated by the SDLC.ai Alert Manager</small></p>
                """.strip(),
                content_type="text/html",
            )
            self._notification_templates[email_template.id] = email_template

        except Exception as e:
            logger.error(f"Failed to load default templates: {e}")

    async def _alert_processing_loop(self) -> None:
        """Background loop for processing alerts."""
        while True:
            try:
                await asyncio.sleep(10)  # Run every 10 seconds

                # Process queued notifications
                # Check for alert escalation
                # Update alert metrics

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in alert processing loop: {e}")

    async def _notification_processing_loop(self) -> None:
        """Background loop for processing notifications."""
        while True:
            try:
                await asyncio.sleep(5)  # Run every 5 seconds

                notification_queue_key = f"{self.ALERTS_KEY_PREFIX}notifications:queue"

                # Get pending notifications
                notification_data = await self._redis.rpop(notification_queue_key)
                if notification_data:
                    try:
                        data = json.loads(notification_data.decode())
                        await self._process_notification(data)
                    except Exception as e:
                        logger.error(f"Failed to process notification: {e}")

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in notification processing loop: {e}")

    async def _process_notification(self, notification_data: Dict[str, Any]) -> None:
        """Process a single notification."""
        try:
            alert_id = notification_data["alert_id"]
            rule_id = notification_data["rule_id"]

            alert = await self._get_alert(alert_id)
            if not alert:
                logger.error(f"Alert {alert_id} not found for notification")
                return

            channels = [NotificationChannel(c) for c in notification_data["channels"]]
            emails = notification_data["emails"]
            webhooks = notification_data["webhooks"]
            slack_channels = notification_data["slack_channels"]

            # Send notifications
            for channel in channels:
                if channel == NotificationChannel.EMAIL:
                    for email in emails:
                        success = await self._send_notification(alert, channel, email)
                        await self._record_notification_attempt(
                            alert, channel, email, success
                        )

                elif channel == NotificationChannel.SLACK:
                    for slack_channel in slack_channels:
                        success = await self._send_notification(
                            alert, channel, slack_channel
                        )
                        await self._record_notification_attempt(
                            alert, channel, slack_channel, success
                        )

                elif channel == NotificationChannel.WEBHOOK:
                    for webhook in webhooks:
                        success = await self._send_notification(alert, channel, webhook)
                        await self._record_notification_attempt(
                            alert, channel, webhook, success
                        )

        except Exception as e:
            logger.error(f"Failed to process notification: {e}")

    async def _record_notification_attempt(
        self, alert: Alert, channel: NotificationChannel, recipient: str, success: bool
    ) -> None:
        """Record notification attempt."""
        try:
            notification_record = {
                "channel": channel.value,
                "recipient": recipient,
                "sent_at": datetime.now().isoformat(),
                "success": success,
            }

            alert.notifications_sent.append(notification_record)
            await self._store_alert(alert)

        except Exception as e:
            logger.error(f"Failed to record notification attempt: {e}")

    async def _cleanup_loop(self) -> None:
        """Background loop for cleanup operations."""
        while True:
            try:
                await asyncio.sleep(3600)  # Run every hour

                # Clean up old alerts
                # Clean up old notification records
                # Update alert metrics

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in cleanup loop: {e}")

    async def __aenter__(self):
        """Async context manager entry."""
        await self.initialize()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        await self.cleanup()
