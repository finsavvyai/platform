"""
Real-Time Alerting System.

Comprehensive alerting system with intelligent rules, multiple notification
channels, and advanced alert processing for the Universal Dependency Platform.
"""

import asyncio
import json
import logging
import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from enum import Enum
from typing import Any, Optional

import requests

logger = logging.getLogger(__name__)


class AlertSeverity(str, Enum):
    """Alert severity levels."""
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


class AlertStatus(str, Enum):
    """Alert status."""
    ACTIVE = "active"
    ACKNOWLEDGED = "acknowledged"
    RESOLVED = "resolved"
    SUPPRESSED = "suppressed"


class AlertChannelType(str, Enum):
    """Alert channel types."""
    EMAIL = "email"
    SLACK = "slack"
    WEBHOOK = "webhook"
    SMS = "sms"
    PAGERDUTY = "pagerduty"
    TEAMS = "teams"


@dataclass
class AlertRule:
    """Alert rule definition."""
    id: str
    name: str
    description: str
    metric_name: str
    condition: str  # e.g., ">", "<", "==", "!="
    threshold: float
    severity: AlertSeverity
    enabled: bool = True
    tags: dict[str, str] = field(default_factory=dict)
    cooldown_period: int = 300  # seconds
    evaluation_interval: int = 60  # seconds
    last_triggered: Optional[datetime] = None
    trigger_count: int = 0


@dataclass
class Alert:
    """Alert instance."""
    id: str
    rule_id: str
    title: str
    description: str
    severity: AlertSeverity
    status: AlertStatus
    timestamp: datetime
    metric_name: str
    metric_value: float
    threshold: float
    tags: dict[str, str] = field(default_factory=dict)
    metadata: dict[str, Any] = field(default_factory=dict)
    acknowledged_by: Optional[str] = None
    acknowledged_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None


@dataclass
class AlertChannel:
    """Alert notification channel."""
    id: str
    name: str
    type: AlertChannelType
    enabled: bool = True
    config: dict[str, Any] = field(default_factory=dict)
    severity_filter: list[AlertSeverity] = field(default_factory=lambda: list(AlertSeverity))
    tags_filter: dict[str, str] = field(default_factory=dict)


class BaseNotificationService(ABC):
    """Base class for notification services."""

    def __init__(self, channel: AlertChannel):
        self.channel = channel

    @abstractmethod
    async def send_notification(self, alert: Alert) -> bool:
        """Send notification for an alert."""
        pass

    def should_send(self, alert: Alert) -> bool:
        """Check if notification should be sent for this alert."""
        if not self.channel.enabled:
            return False

        if alert.severity not in self.channel.severity_filter:
            return False

        # Check tags filter
        for key, value in self.channel.tags_filter.items():
            if alert.tags.get(key) != value:
                return False

        return True


class EmailNotificationService(BaseNotificationService):
    """Email notification service."""

    async def send_notification(self, alert: Alert) -> bool:
        """Send email notification."""
        try:
            if not self.should_send(alert):
                return False

            config = self.channel.config

            # Create email message
            msg = MIMEMultipart()
            msg['From'] = config.get('from_email', 'alerts@udp.com')
            msg['To'] = config.get('to_email', 'admin@udp.com')
            msg['Subject'] = f"[{alert.severity.upper()}] {alert.title}"

            # Create email body
            body = f"""
Alert Details:
- Title: {alert.title}
- Description: {alert.description}
- Severity: {alert.severity.upper()}
- Status: {alert.status.upper()}
- Timestamp: {alert.timestamp}
- Metric: {alert.metric_name} = {alert.metric_value}
- Threshold: {alert.threshold}

Tags: {json.dumps(alert.tags, indent=2)}
Metadata: {json.dumps(alert.metadata, indent=2)}

Alert ID: {alert.id}
Rule ID: {alert.rule_id}
"""

            msg.attach(MIMEText(body, 'plain'))

            # Send email (simplified - in production would use proper SMTP)
            logger.info(f"Email notification sent for alert {alert.id} to {config.get('to_email')}")
            return True

        except Exception as e:
            logger.error(f"Failed to send email notification: {e}", exc_info=True)
            return False


class SlackNotificationService(BaseNotificationService):
    """Slack notification service."""

    async def send_notification(self, alert: Alert) -> bool:
        """Send Slack notification."""
        try:
            if not self.should_send(alert):
                return False

            config = self.channel.config
            webhook_url = config.get('webhook_url')

            if not webhook_url:
                logger.error("Slack webhook URL not configured")
                return False

            # Create Slack message
            color_map = {
                AlertSeverity.CRITICAL: "danger",
                AlertSeverity.HIGH: "warning",
                AlertSeverity.MEDIUM: "warning",
                AlertSeverity.LOW: "good",
                AlertSeverity.INFO: "good"
            }

            payload = {
                "attachments": [
                    {
                        "color": color_map.get(alert.severity, "good"),
                        "title": alert.title,
                        "text": alert.description,
                        "fields": [
                            {
                                "title": "Severity",
                                "value": alert.severity.upper(),
                                "short": True
                            },
                            {
                                "title": "Status",
                                "value": alert.status.upper(),
                                "short": True
                            },
                            {
                                "title": "Metric",
                                "value": f"{alert.metric_name} = {alert.metric_value}",
                                "short": True
                            },
                            {
                                "title": "Threshold",
                                "value": str(alert.threshold),
                                "short": True
                            },
                            {
                                "title": "Timestamp",
                                "value": alert.timestamp.isoformat(),
                                "short": False
                            }
                        ],
                        "footer": "Universal Dependency Platform",
                        "ts": int(alert.timestamp.timestamp())
                    }
                ]
            }

            # Send to Slack
            response = requests.post(webhook_url, json=payload, timeout=10)
            response.raise_for_status()

            logger.info(f"Slack notification sent for alert {alert.id}")
            return True

        except Exception as e:
            logger.error(f"Failed to send Slack notification: {e}", exc_info=True)
            return False


class WebhookNotificationService(BaseNotificationService):
    """Webhook notification service."""

    async def send_notification(self, alert: Alert) -> bool:
        """Send webhook notification."""
        try:
            if not self.should_send(alert):
                return False

            config = self.channel.config
            webhook_url = config.get('url')

            if not webhook_url:
                logger.error("Webhook URL not configured")
                return False

            # Create webhook payload
            payload = {
                "alert_id": alert.id,
                "rule_id": alert.rule_id,
                "title": alert.title,
                "description": alert.description,
                "severity": alert.severity.value,
                "status": alert.status.value,
                "timestamp": alert.timestamp.isoformat(),
                "metric_name": alert.metric_name,
                "metric_value": alert.metric_value,
                "threshold": alert.threshold,
                "tags": alert.tags,
                "metadata": alert.metadata
            }

            # Send webhook
            headers = config.get('headers', {})
            response = requests.post(webhook_url, json=payload, headers=headers, timeout=10)
            response.raise_for_status()

            logger.info(f"Webhook notification sent for alert {alert.id}")
            return True

        except Exception as e:
            logger.error(f"Failed to send webhook notification: {e}", exc_info=True)
            return False


class SMSNotificationService(BaseNotificationService):
    """SMS notification service."""

    async def send_notification(self, alert: Alert) -> bool:
        """Send SMS notification."""
        try:
            if not self.should_send(alert):
                return False

            config = self.channel.config
            phone_number = config.get('phone_number')

            if not phone_number:
                logger.error("SMS phone number not configured")
                return False

            # Create SMS message
            message = f"[{alert.severity.upper()}] {alert.title}: {alert.description}"

            # In production, this would integrate with SMS service like Twilio
            logger.info(f"SMS notification sent for alert {alert.id} to {phone_number}: {message}")
            return True

        except Exception as e:
            logger.error(f"Failed to send SMS notification: {e}", exc_info=True)
            return False


class PagerDutyNotificationService(BaseNotificationService):
    """PagerDuty notification service."""

    async def send_notification(self, alert: Alert) -> bool:
        """Send PagerDuty notification."""
        try:
            if not self.should_send(alert):
                return False

            config = self.channel.config
            integration_key = config.get('integration_key')

            if not integration_key:
                logger.error("PagerDuty integration key not configured")
                return False

            # Create PagerDuty payload
            payload = {
                "routing_key": integration_key,
                "event_action": "trigger",
                "dedup_key": alert.id,
                "payload": {
                    "summary": alert.title,
                    "source": "Universal Dependency Platform",
                    "severity": alert.severity.value,
                    "component": alert.metric_name,
                    "group": "dependency-management",
                    "class": "dependency_alert",
                    "custom_details": {
                        "description": alert.description,
                        "metric_value": alert.metric_value,
                        "threshold": alert.threshold,
                        "tags": alert.tags,
                        "metadata": alert.metadata
                    }
                }
            }

            # Send to PagerDuty
            response = requests.post(
                "https://events.pagerduty.com/v2/enqueue",
                json=payload,
                timeout=10
            )
            response.raise_for_status()

            logger.info(f"PagerDuty notification sent for alert {alert.id}")
            return True

        except Exception as e:
            logger.error(f"Failed to send PagerDuty notification: {e}", exc_info=True)
            return False


class TeamsNotificationService(BaseNotificationService):
    """Microsoft Teams notification service."""

    async def send_notification(self, alert: Alert) -> bool:
        """Send Teams notification."""
        try:
            if not self.should_send(alert):
                return False

            config = self.channel.config
            webhook_url = config.get('webhook_url')

            if not webhook_url:
                logger.error("Teams webhook URL not configured")
                return False

            # Create Teams message
            color_map = {
                AlertSeverity.CRITICAL: "FF0000",
                AlertSeverity.HIGH: "FFA500",
                AlertSeverity.MEDIUM: "FFFF00",
                AlertSeverity.LOW: "00FF00",
                AlertSeverity.INFO: "00BFFF"
            }

            payload = {
                "@type": "MessageCard",
                "@context": "http://schema.org/extensions",
                "themeColor": color_map.get(alert.severity, "00BFFF"),
                "summary": alert.title,
                "sections": [
                    {
                        "activityTitle": alert.title,
                        "activitySubtitle": f"Severity: {alert.severity.upper()}",
                        "activityImage": "https://example.com/alert-icon.png",
                        "facts": [
                            {
                                "name": "Description",
                                "value": alert.description
                            },
                            {
                                "name": "Status",
                                "value": alert.status.upper()
                            },
                            {
                                "name": "Metric",
                                "value": f"{alert.metric_name} = {alert.metric_value}"
                            },
                            {
                                "name": "Threshold",
                                "value": str(alert.threshold)
                            },
                            {
                                "name": "Timestamp",
                                "value": alert.timestamp.isoformat()
                            }
                        ],
                        "markdown": True
                    }
                ]
            }

            # Send to Teams
            response = requests.post(webhook_url, json=payload, timeout=10)
            response.raise_for_status()

            logger.info(f"Teams notification sent for alert {alert.id}")
            return True

        except Exception as e:
            logger.error(f"Failed to send Teams notification: {e}", exc_info=True)
            return False


class AlertProcessor:
    """Alert processing and evaluation engine."""

    def __init__(self):
        self.rules: dict[str, AlertRule] = {}
        self.active_alerts: dict[str, Alert] = {}
        self.alert_history: list[Alert] = []
        self.metric_cache: dict[str, list[float]] = {}

    def add_rule(self, rule: AlertRule):
        """Add an alert rule."""
        self.rules[rule.id] = rule
        logger.info(f"Added alert rule: {rule.name}")

    def remove_rule(self, rule_id: str):
        """Remove an alert rule."""
        if rule_id in self.rules:
            del self.rules[rule_id]
            logger.info(f"Removed alert rule: {rule_id}")

    def update_rule(self, rule: AlertRule):
        """Update an alert rule."""
        self.rules[rule.id] = rule
        logger.info(f"Updated alert rule: {rule.name}")

    def evaluate_metric(self, metric_name: str, value: float, timestamp: datetime) -> list[Alert]:
        """Evaluate metric against alert rules."""
        triggered_alerts = []

        for rule in self.rules.values():
            if not rule.enabled or rule.metric_name != metric_name:
                continue

            # Check cooldown period
            if rule.last_triggered:
                time_since_last = (timestamp - rule.last_triggered).total_seconds()
                if time_since_last < rule.cooldown_period:
                    continue

            # Evaluate condition
            if self._evaluate_condition(value, rule.condition, rule.threshold):
                # Create alert
                alert = Alert(
                    id=str(uuid.uuid4()),
                    rule_id=rule.id,
                    title=f"{rule.name} - {metric_name} {rule.condition} {rule.threshold}",
                    description=rule.description,
                    severity=rule.severity,
                    status=AlertStatus.ACTIVE,
                    timestamp=timestamp,
                    metric_name=metric_name,
                    metric_value=value,
                    threshold=rule.threshold,
                    tags=rule.tags.copy()
                )

                triggered_alerts.append(alert)
                self.active_alerts[alert.id] = alert
                self.alert_history.append(alert)

                # Update rule
                rule.last_triggered = timestamp
                rule.trigger_count += 1

                logger.warning(f"Alert triggered: {alert.title} (severity: {alert.severity})")

        return triggered_alerts

    def _evaluate_condition(self, value: float, condition: str, threshold: float) -> bool:
        """Evaluate alert condition."""
        try:
            if condition == ">":
                return value > threshold
            elif condition == ">=":
                return value >= threshold
            elif condition == "<":
                return value < threshold
            elif condition == "<=":
                return value <= threshold
            elif condition == "==":
                return abs(value - threshold) < 0.001  # Float comparison
            elif condition == "!=":
                return abs(value - threshold) >= 0.001
            else:
                logger.error(f"Unknown condition: {condition}")
                return False
        except Exception as e:
            logger.error(f"Error evaluating condition: {e}")
            return False

    def acknowledge_alert(self, alert_id: str, acknowledged_by: str) -> bool:
        """Acknowledge an alert."""
        if alert_id in self.active_alerts:
            alert = self.active_alerts[alert_id]
            alert.status = AlertStatus.ACKNOWLEDGED
            alert.acknowledged_by = acknowledged_by
            alert.acknowledged_at = datetime.utcnow()
            logger.info(f"Alert {alert_id} acknowledged by {acknowledged_by}")
            return True
        return False

    def resolve_alert(self, alert_id: str) -> bool:
        """Resolve an alert."""
        if alert_id in self.active_alerts:
            alert = self.active_alerts[alert_id]
            alert.status = AlertStatus.RESOLVED
            alert.resolved_at = datetime.utcnow()
            del self.active_alerts[alert_id]
            logger.info(f"Alert {alert_id} resolved")
            return True
        return False

    def get_active_alerts(self) -> list[Alert]:
        """Get all active alerts."""
        return list(self.active_alerts.values())

    def get_alert_history(self, duration_seconds: int = 3600) -> list[Alert]:
        """Get alert history for the specified duration."""
        cutoff_time = datetime.utcnow() - timedelta(seconds=duration_seconds)
        return [alert for alert in self.alert_history if alert.timestamp >= cutoff_time]


class AlertManager:
    """Main alert management system."""

    def __init__(self):
        self.processor = AlertProcessor()
        self.channels: dict[str, AlertChannel] = {}
        self.notification_services: dict[str, BaseNotificationService] = {}
        self.is_running = False
        self._notification_queue = asyncio.Queue()

    def add_channel(self, channel: AlertChannel):
        """Add a notification channel."""
        self.channels[channel.id] = channel

        # Create notification service
        service = self._create_notification_service(channel)
        if service:
            self.notification_services[channel.id] = service
            logger.info(f"Added notification channel: {channel.name} ({channel.type})")

    def _create_notification_service(self, channel: AlertChannel) -> Optional[BaseNotificationService]:
        """Create notification service for channel."""
        try:
            if channel.type == AlertChannelType.EMAIL:
                return EmailNotificationService(channel)
            elif channel.type == AlertChannelType.SLACK:
                return SlackNotificationService(channel)
            elif channel.type == AlertChannelType.WEBHOOK:
                return WebhookNotificationService(channel)
            elif channel.type == AlertChannelType.SMS:
                return SMSNotificationService(channel)
            elif channel.type == AlertChannelType.PAGERDUTY:
                return PagerDutyNotificationService(channel)
            elif channel.type == AlertChannelType.TEAMS:
                return TeamsNotificationService(channel)
            else:
                logger.error(f"Unknown channel type: {channel.type}")
                return None
        except Exception as e:
            logger.error(f"Failed to create notification service: {e}")
            return None

    async def start(self):
        """Start the alert manager."""
        self.is_running = True
        logger.info("Starting Alert Manager")

        # Start notification processor
        asyncio.create_task(self._process_notifications())

    async def stop(self):
        """Stop the alert manager."""
        self.is_running = False
        logger.info("Stopped Alert Manager")

    async def process_metrics(self, metrics: list[Any]):
        """Process metrics and evaluate alert rules."""
        try:
            for metric in metrics:
                if hasattr(metric, 'name') and hasattr(metric, 'value'):
                    triggered_alerts = self.processor.evaluate_metric(
                        metric.name, metric.value, metric.timestamp
                    )

                    # Queue notifications
                    for alert in triggered_alerts:
                        await self._notification_queue.put(alert)

        except Exception as e:
            logger.error(f"Error processing metrics: {e}", exc_info=True)

    async def _process_notifications(self):
        """Process notification queue."""
        while self.is_running:
            try:
                # Get alert from queue
                alert = await asyncio.wait_for(self._notification_queue.get(), timeout=1.0)

                # Send notifications to all channels
                for service in self.notification_services.values():
                    try:
                        await service.send_notification(alert)
                    except Exception as e:
                        logger.error(f"Failed to send notification: {e}")

                # Mark task as done
                self._notification_queue.task_done()

            except asyncio.TimeoutError:
                continue
            except Exception as e:
                logger.error(f"Error processing notifications: {e}", exc_info=True)

    def add_rule(self, rule: AlertRule):
        """Add an alert rule."""
        self.processor.add_rule(rule)

    def remove_rule(self, rule_id: str):
        """Remove an alert rule."""
        self.processor.remove_rule(rule_id)

    def update_rule(self, rule: AlertRule):
        """Update an alert rule."""
        self.processor.update_rule(rule)

    def acknowledge_alert(self, alert_id: str, acknowledged_by: str) -> bool:
        """Acknowledge an alert."""
        return self.processor.acknowledge_alert(alert_id, acknowledged_by)

    def resolve_alert(self, alert_id: str) -> bool:
        """Resolve an alert."""
        return self.processor.resolve_alert(alert_id)

    def get_active_alerts(self) -> list[Alert]:
        """Get all active alerts."""
        return self.processor.get_active_alerts()

    def get_alert_history(self, duration_seconds: int = 3600) -> list[Alert]:
        """Get alert history."""
        return self.processor.get_alert_history(duration_seconds)

    def get_alert_summary(self) -> dict[str, Any]:
        """Get alert summary statistics."""
        active_alerts = self.get_active_alerts()
        history = self.get_alert_history(3600)  # Last hour

        summary = {
            "active_alerts": len(active_alerts),
            "alerts_last_hour": len(history),
            "severity_breakdown": {
                severity.value: len([a for a in active_alerts if a.severity == severity])
                for severity in AlertSeverity
            },
            "total_rules": len(self.processor.rules),
            "enabled_rules": len([r for r in self.processor.rules.values() if r.enabled]),
            "notification_channels": len(self.channels),
            "enabled_channels": len([c for c in self.channels.values() if c.enabled])
        }

        return summary
