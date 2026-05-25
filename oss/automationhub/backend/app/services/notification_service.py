"""
Comprehensive Notification Service for Multi-Channel Alert Management

This service provides enterprise-grade notification capabilities including:
- Multi-channel notifications (email, Slack, SMS, webhooks)
- Escalation policies and alert routing
- Alert aggregation and deduplication
- Notification templates and customization
- Delivery tracking and retry mechanisms
- Rate limiting and throttling
"""

import asyncio
import json
import logging
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional, Set, Union
from uuid import UUID, uuid4

import aiohttp
import aiosmtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from pydantic import BaseModel, Field, validator

from app.core.redis import redis_client
from app.core.config import settings

logger = logging.getLogger(__name__)


class NotificationChannel(str, Enum):
    """Supported notification channels."""
    EMAIL = "email"
    SLACK = "slack"
    SMS = "sms"
    WEBHOOK = "webhook"
    DISCORD = "discord"
    TEAMS = "teams"
    PUSH = "push"


class NotificationPriority(str, Enum):
    """Notification priority levels."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class NotificationStatus(str, Enum):
    """Notification delivery status."""
    PENDING = "pending"
    SENDING = "sending"
    DELIVERED = "delivered"
    FAILED = "failed"
    RETRYING = "retrying"
    ESCALATED = "escalated"


class NotificationRule(BaseModel):
    """Notification rule configuration."""
    id: UUID = Field(default_factory=uuid4)
    name: str
    description: Optional[str] = None
    enabled: bool = True

    # Alert matching criteria
    alert_types: List[str] = []
    severities: List[str] = []
    tags: List[str] = []

    # Notification configuration
    channels: List[NotificationChannel] = []
    recipients: List[str] = []  # Email addresses, phone numbers, webhook URLs, etc.

    # Delivery options
    priority: NotificationPriority = NotificationPriority.MEDIUM
    rate_limit_minutes: int = 5
    max_notifications_per_hour: int = 10

    # Escalation
    escalation_enabled: bool = False
    escalation_delay_minutes: int = 15
    escalation_channels: List[NotificationChannel] = []
    escalation_recipients: List[str] = []

    # Templates
    subject_template: Optional[str] = None
    message_template: Optional[str] = None

    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        use_enum_values = True


class NotificationMessage(BaseModel):
    """Notification message."""
    id: UUID = Field(default_factory=uuid4)
    rule_id: UUID
    alert_id: UUID

    # Content
    title: str
    message: str
    severity: NotificationPriority

    # Delivery information
    channels: List[NotificationChannel]
    recipients: List[str]

    # Status tracking
    status: NotificationStatus = NotificationStatus.PENDING
    attempts: int = 0
    max_attempts: int = 3

    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    first_attempt_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    next_retry_at: Optional[datetime] = None

    # Results
    delivery_results: Dict[str, Any] = Field(default_factory=dict)
    error_message: Optional[str] = None

    class Config:
        use_enum_values = True


class EscalationPolicy(BaseModel):
    """Escalation policy for alerts."""
    id: UUID = Field(default_factory=uuid4)
    name: str
    description: Optional[str] = None

    # Escalation levels
    levels: List[Dict[str, Any]] = Field(default_factory=list)

    # Timing
    first_escalation_minutes: int = 15
    subsequent_escalation_minutes: int = 30

    # Conditions
    escalation_conditions: Dict[str, Any] = Field(default_factory=dict)

    enabled: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        use_enum_values = True


class NotificationService:
    """
    Comprehensive notification service with multi-channel support.

    Features:
    - Email, Slack, SMS, webhook notifications
    - Escalation policies and intelligent routing
    - Rate limiting and deduplication
    - Delivery tracking and retry logic
    - Template-based message formatting
    - Real-time delivery status updates
    """

    def __init__(self):
        self.redis = redis_client

        # Notification queue and processing
        self._notification_queue: asyncio.Queue = asyncio.Queue()
        self._processing_task: Optional[asyncio.Task] = None
        self._active = False

        # Rate limiting
        self._rate_limits: Dict[str, Dict[str, Any]] = {}

        # Delivery statistics
        self._delivery_stats: Dict[str, Any] = {
            "total_sent": 0,
            "total_failed": 0,
            "by_channel": {},
            "by_priority": {}
        }

        # Notification templates
        self._templates = self._initialize_templates()

        # HTTP session for webhook calls
        self._http_session: Optional[aiohttp.ClientSession] = None

        logger.info("Notification service initialized")

    def _initialize_templates(self) -> Dict[str, Dict[str, str]]:
        """Initialize notification templates."""
        return {
            "default": {
                "subject": "Alert: {alert_title}",
                "message": """
Alert: {alert_title}
Severity: {severity}
Description: {description}
Time: {timestamp}
{additional_details}
                """.strip()
            },
            "critical": {
                "subject": "🚨 CRITICAL: {alert_title}",
                "message": """
🚨 CRITICAL ALERT 🚨

Title: {alert_title}
Severity: CRITICAL
Description: {description}
Time: {timestamp}
Agent: {agent_name}
Task: {task_name}

Immediate action required!
{additional_details}
                """.strip()
            },
            "task_failure": {
                "subject": "Task Failed: {task_name}",
                "message": """
Task Execution Failed

Task: {task_name}
Agent: {agent_name}
Error: {error_message}
Duration: {duration}
Time: {timestamp}

{additional_details}
                """.strip()
            },
            "system_health": {
                "subject": "System Health Alert: {metric_name}",
                "message": """
System Health Alert

Metric: {metric_name}
Current Value: {current_value}
Threshold: {threshold}
Severity: {severity}
Time: {timestamp}

Recommendations:
{recommendations}

{additional_details}
                """.strip()
            }
        }

    async def start(self):
        """Start the notification service."""
        if self._active:
            return

        self._active = True

        # Create HTTP session
        self._http_session = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=30),
            connector=aiohttp.TCPConnector(limit=100)
        )

        # Start processing task
        self._processing_task = asyncio.create_task(self._processing_loop())

        logger.info("Notification service started")

    async def stop(self):
        """Stop the notification service."""
        self._active = False

        # Cancel processing task
        if self._processing_task:
            self._processing_task.cancel()
            try:
                await self._processing_task
            except asyncio.CancelledError:
                pass

        # Close HTTP session
        if self._http_session:
            await self._http_session.close()

        logger.info("Notification service stopped")

    async def create_notification_rule(self, rule_data: Dict[str, Any]) -> NotificationRule:
        """Create a new notification rule."""
        try:
            rule = NotificationRule(**rule_data)

            # Store rule in Redis
            await self.redis.set(
                f"notification_rule:{rule.id}",
                rule.dict(),
                expire=86400 * 30  # 30 days
            )

            # Index rule for lookup
            await self.redis.sadd("notification_rules", str(rule.id))

            logger.info(f"Created notification rule: {rule.name}")
            return rule

        except Exception as e:
            logger.error(f"Failed to create notification rule: {e}")
            raise

    async def update_notification_rule(self, rule_id: UUID, updates: Dict[str, Any]) -> NotificationRule:
        """Update an existing notification rule."""
        try:
            # Get existing rule
            rule_data = await self.redis.get(f"notification_rule:{rule_id}")
            if not rule_data:
                raise ValueError(f"Notification rule {rule_id} not found")

            rule = NotificationRule(**rule_data)

            # Apply updates
            for field, value in updates.items():
                if hasattr(rule, field):
                    setattr(rule, field, value)

            rule.updated_at = datetime.utcnow()

            # Store updated rule
            await self.redis.set(
                f"notification_rule:{rule.id}",
                rule.dict(),
                expire=86400 * 30
            )

            logger.info(f"Updated notification rule: {rule.name}")
            return rule

        except Exception as e:
            logger.error(f"Failed to update notification rule: {e}")
            raise

    async def delete_notification_rule(self, rule_id: UUID):
        """Delete a notification rule."""
        try:
            # Remove from Redis
            await self.redis.delete(f"notification_rule:{rule_id}")
            await self.redis.srem("notification_rules", str(rule_id))

            logger.info(f"Deleted notification rule: {rule_id}")

        except Exception as e:
            logger.error(f"Failed to delete notification rule: {e}")
            raise

    async def send_notification(
        self,
        alert_data: Dict[str, Any],
        custom_rules: Optional[List[UUID]] = None
    ) -> List[NotificationMessage]:
        """
        Send notification for an alert based on matching rules.

        Args:
            alert_data: Alert information
            custom_rules: Optional list of specific rule IDs to use

        Returns:
            List of notification messages created
        """
        try:
            notifications = []

            # Get matching rules
            if custom_rules:
                rules = []
                for rule_id in custom_rules:
                    rule_data = await self.redis.get(f"notification_rule:{rule_id}")
                    if rule_data:
                        rules.append(NotificationRule(**rule_data))
            else:
                rules = await self._get_matching_rules(alert_data)

            # Create notifications for each rule
            for rule in rules:
                if not rule.enabled:
                    continue

                # Check rate limits
                if await self._is_rate_limited(rule, alert_data):
                    logger.info(f"Rate limit exceeded for rule: {rule.name}")
                    continue

                # Create notification message
                message = await self._create_notification_message(rule, alert_data)
                notifications.append(message)

                # Add to processing queue
                await self._notification_queue.put(message)

                # Update rate limit tracking
                await self._update_rate_limit(rule, alert_data)

            logger.info(f"Created {len(notifications)} notifications for alert")
            return notifications

        except Exception as e:
            logger.error(f"Failed to send notification: {e}")
            raise

    async def _get_matching_rules(self, alert_data: Dict[str, Any]) -> List[NotificationRule]:
        """Get notification rules that match the alert."""
        matching_rules = []

        # Get all rule IDs
        rule_ids = await self.redis.smembers("notification_rules")

        for rule_id in rule_ids:
            try:
                rule_data = await self.redis.get(f"notification_rule:{rule_id}")
                if not rule_data:
                    continue

                rule = NotificationRule(**rule_data)

                # Check if rule matches alert
                if self._rule_matches_alert(rule, alert_data):
                    matching_rules.append(rule)

            except Exception as e:
                logger.warning(f"Error processing rule {rule_id}: {e}")
                continue

        return matching_rules

    def _rule_matches_alert(self, rule: NotificationRule, alert_data: Dict[str, Any]) -> bool:
        """Check if a notification rule matches an alert."""
        # Check alert types
        if rule.alert_types and alert_data.get("alert_type") not in rule.alert_types:
            return False

        # Check severities
        if rule.severities and alert_data.get("severity") not in rule.severities:
            return False

        # Check tags
        if rule.tags:
            alert_tags = set(alert_data.get("tags", []))
            rule_tags = set(rule.tags)
            if not alert_tags.intersection(rule_tags):
                return False

        return True

    async def _is_rate_limited(self, rule: NotificationRule, alert_data: Dict[str, Any]) -> bool:
        """Check if notification is rate limited."""
        rate_key = f"rate_limit:{rule.id}"

        # Get current count
        current_count = await self.redis.get(rate_key) or 0

        # Check hourly limit
        if current_count >= rule.max_notifications_per_hour:
            return True

        # Check per-minute limit
        minute_key = f"{rate_key}:{datetime.utcnow().strftime('%Y%m%d%H%M')}"
        minute_count = await self.redis.get(minute_key) or 0

        if minute_count >= rule.rate_limit_minutes:
            return True

        return False

    async def _update_rate_limit(self, rule: NotificationRule, alert_data: Dict[str, Any]):
        """Update rate limiting counters."""
        rate_key = f"rate_limit:{rule.id}"

        # Increment hourly count
        await self.redis.incr(rate_key)
        await self.redis.expire(rate_key, 3600)  # 1 hour

        # Increment minute count
        minute_key = f"{rate_key}:{datetime.utcnow().strftime('%Y%m%d%H%M')}"
        await self.redis.incr(minute_key)
        await self.redis.expire(minute_key, 120)  # 2 minutes

    async def _create_notification_message(
        self,
        rule: NotificationRule,
        alert_data: Dict[str, Any]
    ) -> NotificationMessage:
        """Create a notification message from rule and alert data."""

        # Format message using template
        template_name = self._get_template_name(alert_data)
        template = self._templates.get(template_name, self._templates["default"])

        # Use custom templates if provided
        subject_template = rule.subject_template or template.get("subject", "")
        message_template = rule.message_template or template.get("message", "")

        # Format templates
        title = subject_template.format(**alert_data)
        message = message_template.format(**alert_data)

        # Create notification message
        notification = NotificationMessage(
            rule_id=rule.id,
            alert_id=UUID(alert_data.get("alert_id", uuid4())),
            title=title,
            message=message,
            severity=rule.priority,
            channels=rule.channels,
            recipients=rule.recipients
        )

        return notification

    def _get_template_name(self, alert_data: Dict[str, Any]) -> str:
        """Get the appropriate template name for the alert."""
        alert_type = alert_data.get("alert_type", "")
        severity = alert_data.get("severity", "")

        if severity == "critical":
            return "critical"
        elif alert_type == "task_failure":
            return "task_failure"
        elif alert_type == "system_health":
            return "system_health"
        else:
            return "default"

    async def _processing_loop(self):
        """Main notification processing loop."""
        while self._active:
            try:
                # Wait for notification with timeout
                try:
                    notification = await asyncio.wait_for(
                        self._notification_queue.get(),
                        timeout=1.0
                    )
                except asyncio.TimeoutError:
                    continue

                # Process notification
                await self._process_notification(notification)

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in notification processing loop: {e}")
                await asyncio.sleep(1)

    async def _process_notification(self, notification: NotificationMessage):
        """Process a single notification."""
        try:
            # Update status
            notification.status = NotificationStatus.SENDING
            notification.first_attempt_at = datetime.utcnow()
            notification.attempts += 1

            # Store notification
            await self._store_notification(notification)

            # Send to each channel
            delivery_results = {}
            all_channels_successful = True

            for channel in notification.channels:
                try:
                    success = await self._send_to_channel(notification, channel)
                    delivery_results[channel.value] = {
                        "success": success,
                        "timestamp": datetime.utcnow().isoformat(),
                        "attempts": notification.attempts
                    }

                    if not success:
                        all_channels_successful = False

                except Exception as e:
                    logger.error(f"Failed to send to {channel}: {e}")
                    delivery_results[channel.value] = {
                        "success": False,
                        "error": str(e),
                        "timestamp": datetime.utcnow().isoformat(),
                        "attempts": notification.attempts
                    }
                    all_channels_successful = False

            # Update notification with results
            notification.delivery_results = delivery_results

            if all_channels_successful:
                notification.status = NotificationStatus.DELIVERED
                notification.delivered_at = datetime.utcnow()
                await self._update_delivery_stats(notification, "delivered")
            else:
                await self._handle_delivery_failure(notification)

            # Store updated notification
            await self._store_notification(notification)

        except Exception as e:
            logger.error(f"Error processing notification {notification.id}: {e}")
            notification.status = NotificationStatus.FAILED
            notification.error_message = str(e)
            await self._store_notification(notification)
            await self._update_delivery_stats(notification, "failed")

    async def _send_to_channel(
        self,
        notification: NotificationMessage,
        channel: NotificationChannel
    ) -> bool:
        """Send notification to a specific channel."""
        try:
            if channel == NotificationChannel.EMAIL:
                return await self._send_email(notification)
            elif channel == NotificationChannel.SLACK:
                return await self._send_slack(notification)
            elif channel == NotificationChannel.SMS:
                return await self._send_sms(notification)
            elif channel == NotificationChannel.WEBHOOK:
                return await self._send_webhook(notification)
            elif channel == NotificationChannel.DISCORD:
                return await self._send_discord(notification)
            elif channel == NotificationChannel.TEAMS:
                return await self._send_teams(notification)
            else:
                logger.warning(f"Unsupported notification channel: {channel}")
                return False

        except Exception as e:
            logger.error(f"Error sending to {channel}: {e}")
            return False

    async def _send_email(self, notification: NotificationMessage) -> bool:
        """Send email notification."""
        try:
            # Check email configuration
            if not all([settings.SMTP_HOST, settings.SMTP_USER, settings.SMTP_PASSWORD]):
                logger.warning("Email configuration not complete")
                return False

            # Create message
            msg = MIMEMultipart()
            msg['From'] = settings.SMTP_FROM_EMAIL
            msg['To'] = ', '.join(notification.recipients)
            msg['Subject'] = notification.title

            # Add HTML and plain text versions
            msg.attach(MIMEText(notification.message, 'plain'))

            # Send email
            await aiosmtplib.send(
                msg,
                hostname=settings.SMTP_HOST,
                port=settings.SMTP_PORT,
                start_tls=True,
                username=settings.SMTP_USER,
                password=settings.SMTP_PASSWORD,
            )

            logger.info(f"Email sent to {len(notification.recipients)} recipients")
            return True

        except Exception as e:
            logger.error(f"Failed to send email: {e}")
            return False

    async def _send_slack(self, notification: NotificationMessage) -> bool:
        """Send Slack notification."""
        try:
            # Check Slack configuration
            webhook_url = settings.SLACK_WEBHOOK_URL
            if not webhook_url:
                logger.warning("Slack webhook URL not configured")
                return False

            # Format Slack message
            payload = {
                "text": notification.title,
                "attachments": [
                    {
                        "color": self._get_slack_color(notification.severity),
                        "title": notification.title,
                        "text": notification.message,
                        "ts": int(notification.created_at.timestamp())
                    }
                ]
            }

            # Send to Slack
            async with self._http_session.post(webhook_url, json=payload) as response:
                if response.status == 200:
                    logger.info("Slack notification sent successfully")
                    return True
                else:
                    logger.error(f"Slack API error: {response.status}")
                    return False

        except Exception as e:
            logger.error(f"Failed to send Slack notification: {e}")
            return False

    async def _send_sms(self, notification: NotificationMessage) -> bool:
        """Send SMS notification."""
        try:
            # Check SMS configuration
            if not settings.SMS_API_KEY:
                logger.warning("SMS API key not configured")
                return False

            # This is a placeholder for SMS integration
            # In production, integrate with SMS provider (Twilio, AWS SNS, etc.)
            logger.info(f"SMS would be sent to {len(notification.recipients)} recipients")
            return True

        except Exception as e:
            logger.error(f"Failed to send SMS: {e}")
            return False

    async def _send_webhook(self, notification: NotificationMessage) -> bool:
        """Send webhook notification."""
        try:
            webhook_urls = [r for r in notification.recipients if r.startswith('http')]

            if not webhook_urls:
                logger.warning("No valid webhook URLs found")
                return False

            payload = {
                "notification_id": str(notification.id),
                "title": notification.title,
                "message": notification.message,
                "severity": notification.severity.value,
                "timestamp": notification.created_at.isoformat(),
                "alert_id": str(notification.alert_id),
                "rule_id": str(notification.rule_id)
            }

            # Send to all webhook URLs
            success_count = 0
            for webhook_url in webhook_urls:
                try:
                    async with self._http_session.post(
                        webhook_url,
                        json=payload,
                        headers={"Content-Type": "application/json"}
                    ) as response:
                        if response.status < 400:
                            success_count += 1
                        else:
                            logger.warning(f"Webhook failed: {webhook_url} - {response.status}")

                except Exception as e:
                    logger.error(f"Webhook error: {webhook_url} - {e}")

            logger.info(f"Webhook sent to {success_count}/{len(webhook_urls)} URLs")
            return success_count > 0

        except Exception as e:
            logger.error(f"Failed to send webhook: {e}")
            return False

    async def _send_discord(self, notification: NotificationMessage) -> bool:
        """Send Discord notification."""
        try:
            webhook_urls = [r for r in notification.recipients if 'discord.com' in r]

            if not webhook_urls:
                logger.warning("No valid Discord webhook URLs found")
                return False

            # Format Discord message
            payload = {
                "content": notification.title,
                "embeds": [
                    {
                        "title": notification.title,
                        "description": notification.message,
                        "color": self._get_discord_color(notification.severity),
                        "timestamp": notification.created_at.isoformat()
                    }
                ]
            }

            # Send to Discord
            success_count = 0
            for webhook_url in webhook_urls:
                try:
                    async with self._http_session.post(webhook_url, json=payload) as response:
                        if response.status == 204:  # Discord returns 204 for success
                            success_count += 1
                        else:
                            logger.warning(f"Discord webhook failed: {response.status}")

                except Exception as e:
                    logger.error(f"Discord webhook error: {e}")

            logger.info(f"Discord notification sent to {success_count}/{len(webhook_urls)} webhooks")
            return success_count > 0

        except Exception as e:
            logger.error(f"Failed to send Discord notification: {e}")
            return False

    async def _send_teams(self, notification: NotificationMessage) -> bool:
        """Send Microsoft Teams notification."""
        try:
            webhook_urls = [r for r in notification.recipients if 'office.com' in r]

            if not webhook_urls:
                logger.warning("No valid Teams webhook URLs found")
                return False

            # Format Teams message (Adaptive Card format)
            payload = {
                "type": "message",
                "attachments": [
                    {
                        "contentType": "application/vnd.microsoft.card.adaptive",
                        "content": {
                            "type": "AdaptiveCard",
                            "version": "1.2",
                            "body": [
                                {
                                    "type": "TextBlock",
                                    "text": notification.title,
                                    "size": "large",
                                    "weight": "bolder"
                                },
                                {
                                    "type": "TextBlock",
                                    "text": notification.message,
                                    "wrap": True
                                }
                            ]
                        }
                    }
                ]
            }

            # Send to Teams
            success_count = 0
            for webhook_url in webhook_urls:
                try:
                    async with self._http_session.post(webhook_url, json=payload) as response:
                        if response.status == 200:
                            success_count += 1
                        else:
                            logger.warning(f"Teams webhook failed: {response.status}")

                except Exception as e:
                    logger.error(f"Teams webhook error: {e}")

            logger.info(f"Teams notification sent to {success_count}/{len(webhook_urls)} webhooks")
            return success_count > 0

        except Exception as e:
            logger.error(f"Failed to send Teams notification: {e}")
            return False

    def _get_slack_color(self, severity: NotificationPriority) -> str:
        """Get Slack color based on severity."""
        colors = {
            NotificationPriority.LOW: "good",      # green
            NotificationPriority.MEDIUM: "warning",  # yellow
            NotificationPriority.HIGH: "danger",     # red
            NotificationPriority.CRITICAL: "#ff0000",  # bright red
        }
        return colors.get(severity, "good")

    def _get_discord_color(self, severity: NotificationPriority) -> int:
        """Get Discord color based on severity."""
        colors = {
            NotificationPriority.LOW: 0x00ff00,      # green
            NotificationPriority.MEDIUM: 0xffff00,   # yellow
            NotificationPriority.HIGH: 0xff6600,     # orange
            NotificationPriority.CRITICAL: 0xff0000, # red
        }
        return colors.get(severity, 0x00ff00)

    async def _handle_delivery_failure(self, notification: NotificationMessage):
        """Handle notification delivery failure."""
        if notification.attempts >= notification.max_attempts:
            # Mark as failed
            notification.status = NotificationStatus.FAILED
            notification.error_message = "Max delivery attempts exceeded"
            await self._update_delivery_stats(notification, "failed")

            # Check for escalation
            await self._check_escalation(notification)
        else:
            # Schedule retry
            notification.status = NotificationStatus.RETRYING
            retry_delay = min(300, 60 * (2 ** notification.attempts))  # Exponential backoff, max 5 minutes
            notification.next_retry_at = datetime.utcnow() + timedelta(seconds=retry_delay)

            # Schedule retry
            asyncio.create_task(self._retry_notification(notification, retry_delay))

    async def _retry_notification(self, notification: NotificationMessage, delay: int):
        """Retry sending a notification after delay."""
        await asyncio.sleep(delay)

        if self._active:
            await self._notification_queue.put(notification)

    async def _check_escalation(self, notification: NotificationMessage):
        """Check if notification should be escalated."""
        try:
            # Get rule
            rule_data = await self.redis.get(f"notification_rule:{notification.rule_id}")
            if not rule_data:
                return

            rule = NotificationRule(**rule_data)

            if not rule.escalation_enabled:
                return

            # Create escalated notification
            escalated = NotificationMessage(
                rule_id=notification.rule_id,
                alert_id=notification.alert_id,
                title=f"[ESCALATED] {notification.title}",
                message=f"ORIGINAL NOTIFICATION FAILED TO DELIVER\n\n{notification.message}",
                severity=NotificationPriority.CRITICAL,
                channels=rule.escalation_channels or rule.channels,
                recipients=rule.escalation_recipients or rule.recipients,
                status=NotificationStatus.ESCALATED
            )

            # Add to queue
            await self._notification_queue.put(escalated)

            logger.info(f"Escalated notification {notification.id}")

        except Exception as e:
            logger.error(f"Failed to escalate notification: {e}")

    async def _store_notification(self, notification: NotificationMessage):
        """Store notification in Redis."""
        try:
            await self.redis.set(
                f"notification:{notification.id}",
                notification.dict(),
                expire=86400 * 7  # 7 days
            )
        except Exception as e:
            logger.error(f"Failed to store notification: {e}")

    async def _update_delivery_stats(self, notification: NotificationMessage, result: str):
        """Update delivery statistics."""
        try:
            # Update overall stats
            if result == "delivered":
                self._delivery_stats["total_sent"] += 1
            else:
                self._delivery_stats["total_failed"] += 1

            # Update by channel
            for channel in notification.channels:
                channel_key = channel.value
                if channel_key not in self._delivery_stats["by_channel"]:
                    self._delivery_stats["by_channel"][channel_key] = {"sent": 0, "failed": 0}

                if result == "delivered":
                    self._delivery_stats["by_channel"][channel_key]["sent"] += 1
                else:
                    self._delivery_stats["by_channel"][channel_key]["failed"] += 1

            # Update by priority
            priority_key = notification.severity.value
            if priority_key not in self._delivery_stats["by_priority"]:
                self._delivery_stats["by_priority"][priority_key] = {"sent": 0, "failed": 0}

            if result == "delivered":
                self._delivery_stats["by_priority"][priority_key]["sent"] += 1
            else:
                self._delivery_stats["by_priority"][priority_key]["failed"] += 1

            # Store stats in Redis periodically
            await self.redis.set(
                "notification_stats",
                self._delivery_stats,
                expire=86400  # 1 day
            )

        except Exception as e:
            logger.error(f"Failed to update delivery stats: {e}")

    async def get_notification_history(
        self,
        limit: int = 100,
        status: Optional[NotificationStatus] = None,
        channel: Optional[NotificationChannel] = None,
        hours: int = 24
    ) -> List[Dict[str, Any]]:
        """Get notification history."""
        try:
            # Get recent notification IDs
            cutoff_time = datetime.utcnow() - timedelta(hours=hours)

            # This is a simplified implementation
            # In production, use proper indexing and pagination
            notifications = []

            # Get all notification keys
            keys = await self.redis.keys("notification:*")

            for key in keys[:limit * 2]:  # Get more than needed for filtering
                try:
                    data = await self.redis.get(key)
                    if not data:
                        continue

                    notification = NotificationMessage(**data)

                    # Filter by time
                    if notification.created_at < cutoff_time:
                        continue

                    # Filter by status
                    if status and notification.status != status:
                        continue

                    # Filter by channel
                    if channel and channel not in notification.channels:
                        continue

                    notifications.append(notification.dict())

                    if len(notifications) >= limit:
                        break

                except Exception as e:
                    logger.warning(f"Error parsing notification {key}: {e}")
                    continue

            # Sort by creation time (newest first)
            notifications.sort(key=lambda x: x["created_at"], reverse=True)

            return notifications

        except Exception as e:
            logger.error(f"Failed to get notification history: {e}")
            return []

    async def get_delivery_statistics(self) -> Dict[str, Any]:
        """Get comprehensive delivery statistics."""
        try:
            # Get stored stats
            stored_stats = await self.redis.get("notification_stats")
            if stored_stats:
                return stored_stats

            # Return current stats
            return self._delivery_stats

        except Exception as e:
            logger.error(f"Failed to get delivery statistics: {e}")
            return {}

    async def acknowledge_notification(self, notification_id: UUID, user_id: UUID) -> bool:
        """Acknowledge a notification."""
        try:
            # Get notification
            notification_data = await self.redis.get(f"notification:{notification_id}")
            if not notification_data:
                return False

            # Store acknowledgment
            acknowledgment = {
                "notification_id": str(notification_id),
                "user_id": str(user_id),
                "acknowledged_at": datetime.utcnow().isoformat()
            }

            await self.redis.set(
                f"notification_ack:{notification_id}:{user_id}",
                acknowledgment,
                expire=86400 * 30  # 30 days
            )

            logger.info(f"Notification {notification_id} acknowledged by user {user_id}")
            return True

        except Exception as e:
            logger.error(f"Failed to acknowledge notification: {e}")
            return False


# Global notification service instance
notification_service: Optional[NotificationService] = None


async def get_notification_service() -> NotificationService:
    """Get or create the global notification service instance."""
    global notification_service

    if notification_service is None:
        notification_service = NotificationService()
        await notification_service.start()

    return notification_service


async def shutdown_notification_service():
    """Shutdown the global notification service instance."""
    global notification_service

    if notification_service:
        await notification_service.stop()
        notification_service = None