"""
Comprehensive Alerting Service with Advanced Management Features

This service provides enterprise-grade alerting capabilities including:
- Intelligent alert rule configuration
- Multi-channel alert delivery and escalation
- Alert aggregation and deduplication
- Alert acknowledgment and resolution tracking
- Alert analytics and trend analysis
- Integration with monitoring systems
"""

import asyncio
import json
import logging
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional, Set, Union
from uuid import UUID, uuid4

from pydantic import BaseModel, Field, validator

from app.core.redis import redis_client
from app.services.notification_service import (
    NotificationService,
    NotificationPriority,
    get_notification_service
)
from app.services.task_monitor import AlertSeverity, AlertType

logger = logging.getLogger(__name__)


class AlertStatus(str, Enum):
    """Alert status states."""
    ACTIVE = "active"
    ACKNOWLEDGED = "acknowledged"
    RESOLVED = "resolved"
    SUPPRESSED = "suppressed"
    ESCALATED = "escalated"


class AlertRule(BaseModel):
    """Alert rule configuration."""
    id: UUID = Field(default_factory=uuid4)
    name: str
    description: Optional[str] = None
    enabled: bool = True

    # Conditions
    conditions: Dict[str, Any] = Field(default_factory=dict)
    metric_thresholds: Dict[str, Dict[str, Any]] = Field(default_factory=dict)

    # Timing
    evaluation_interval_seconds: int = 60
    for_duration_seconds: int = 300
    resolve_after_seconds: Optional[int] = None

    # Severity and priority
    severity: AlertSeverity = AlertSeverity.MEDIUM
    priority: NotificationPriority = NotificationPriority.MEDIUM

    # Notification rules
    notification_rules: List[UUID] = Field(default_factory=list)

    # Suppression and deduplication
    suppression_rules: List[Dict[str, Any]] = Field(default_factory=list)
    deduplication_window_minutes: int = 15

    # Metadata
    tags: List[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        use_enum_values = True


class AlertInstance(BaseModel):
    """Alert instance."""
    id: UUID = Field(default_factory=uuid4)
    rule_id: UUID
    name: str
    description: str
    severity: AlertSeverity

    # Status tracking
    status: AlertStatus = AlertStatus.ACTIVE
    acknowledged_by: Optional[UUID] = None
    acknowledged_at: Optional[datetime] = None
    resolved_by: Optional[UUID] = None
    resolved_at: Optional[datetime] = None
    resolution_message: Optional[str] = None

    # Timing
    first_seen_at: datetime = Field(default_factory=datetime.utcnow)
    last_seen_at: datetime = Field(default_factory=datetime.utcnow)
    evaluation_count: int = 1

    # Context and data
    source: str
    metric_name: Optional[str] = None
    current_value: Optional[float] = None
    threshold_value: Optional[float] = None
    context: Dict[str, Any] = Field(default_factory=dict)

    # Deduplication
    fingerprint: str
    related_alerts: List[UUID] = Field(default_factory=list)

    # Notifications
    notifications_sent: List[UUID] = Field(default_factory=list)
    last_notification_at: Optional[datetime] = None
    escalation_count: int = 0

    # Metadata
    tags: List[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        use_enum_values = True


class AlertGroup(BaseModel):
    """Alert grouping for better organization."""
    id: UUID = Field(default_factory=uuid4)
    name: str
    description: Optional[str] = None

    # Grouping criteria
    grouping_rules: List[Dict[str, Any]] = Field(default_factory=list)
    group_by_fields: List[str] = []

    # Group status
    status: AlertStatus = AlertStatus.ACTIVE
    alert_count: int = 0
    highest_severity: AlertSeverity = AlertSeverity.LOW

    # Alerts in group
    alert_ids: List[UUID] = Field(default_factory=list)

    # Timing
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        use_enum_values = True


class AlertingService:
    """
    Comprehensive alerting service with intelligent management.

    Features:
    - Flexible alert rule configuration
    - Multi-channel notification and escalation
    - Alert aggregation and deduplication
    - Alert acknowledgment and resolution workflows
    - Advanced analytics and reporting
    - Integration with monitoring systems
    """

    def __init__(self):
        self.redis = redis_client
        self.notification_service: Optional[NotificationService] = None

        # Alert management
        self._active_rules: Dict[UUID, AlertRule] = {}
        self._active_alerts: Dict[UUID, AlertInstance] = {}
        self._alert_groups: Dict[UUID, AlertGroup] = {}

        # Processing
        self._evaluation_task: Optional[asyncio.Task] = None
        self._cleanup_task: Optional[asyncio.Task] = None
        self._active = False

        # Metrics
        self._alert_metrics = {
            "total_alerts": 0,
            "active_alerts": 0,
            "resolved_alerts": 0,
            "acknowledged_alerts": 0,
            "escalated_alerts": 0,
            "by_severity": {},
            "by_source": {},
            "resolution_times": []
        }

        logger.info("Alerting service initialized")

    async def start(self):
        """Start the alerting service."""
        if self._active:
            return

        self._active = True

        # Get notification service
        self.notification_service = await get_notification_service()

        # Load active rules
        await self._load_active_rules()

        # Start background tasks
        self._evaluation_task = asyncio.create_task(self._evaluation_loop())
        self._cleanup_task = asyncio.create_task(self._cleanup_loop())

        logger.info("Alerting service started")

    async def stop(self):
        """Stop the alerting service."""
        self._active = False

        # Cancel background tasks
        if self._evaluation_task:
            self._evaluation_task.cancel()
            try:
                await self._evaluation_task
            except asyncio.CancelledError:
                pass

        if self._cleanup_task:
            self._cleanup_task.cancel()
            try:
                await self._cleanup_task
            except asyncio.CancelledError:
                pass

        logger.info("Alerting service stopped")

    async def create_alert_rule(self, rule_data: Dict[str, Any]) -> AlertRule:
        """Create a new alert rule."""
        try:
            rule = AlertRule(**rule_data)

            # Store rule
            await self._store_alert_rule(rule)

            # Add to active rules if enabled
            if rule.enabled:
                self._active_rules[rule.id] = rule

            logger.info(f"Created alert rule: {rule.name}")
            return rule

        except Exception as e:
            logger.error(f"Failed to create alert rule: {e}")
            raise

    async def update_alert_rule(self, rule_id: UUID, updates: Dict[str, Any]) -> AlertRule:
        """Update an existing alert rule."""
        try:
            # Get existing rule
            rule = await self._get_alert_rule(rule_id)
            if not rule:
                raise ValueError(f"Alert rule {rule_id} not found")

            # Apply updates
            for field, value in updates.items():
                if hasattr(rule, field):
                    setattr(rule, field, value)

            rule.updated_at = datetime.utcnow()

            # Store updated rule
            await self._store_alert_rule(rule)

            # Update active rules
            if rule.enabled:
                self._active_rules[rule.id] = rule
            elif rule.id in self._active_rules:
                del self._active_rules[rule.id]

            logger.info(f"Updated alert rule: {rule.name}")
            return rule

        except Exception as e:
            logger.error(f"Failed to update alert rule: {e}")
            raise

    async def delete_alert_rule(self, rule_id: UUID):
        """Delete an alert rule."""
        try:
            # Remove from storage
            await self.redis.delete(f"alert_rule:{rule_id}")
            await self.redis.srem("alert_rules", str(rule_id))

            # Remove from active rules
            if rule_id in self._active_rules:
                del self._active_rules[rule_id]

            logger.info(f"Deleted alert rule: {rule_id}")

        except Exception as e:
            logger.error(f"Failed to delete alert rule: {e}")
            raise

    async def evaluate_metric(self, metric_name: str, value: float, source: str, context: Dict[str, Any] = None):
        """
        Evaluate a metric against all alert rules.

        Args:
            metric_name: Name of the metric
            value: Current metric value
            source: Source of the metric
            context: Additional context data
        """
        try:
            # Check against all active rules
            for rule in self._active_rules.values():
                if await self._rule_matches_metric(rule, metric_name, value, source, context):
                    await self._trigger_alert(rule, metric_name, value, source, context)

        except Exception as e:
            logger.error(f"Failed to evaluate metric {metric_name}: {e}")

    async def create_manual_alert(
        self,
        name: str,
        description: str,
        severity: AlertSeverity,
        source: str,
        context: Dict[str, Any] = None,
        tags: List[str] = None
    ) -> AlertInstance:
        """Create a manual alert."""
        try:
            alert = AlertInstance(
                rule_id=uuid4(),  # Manual alert has no rule
                name=name,
                description=description,
                severity=severity,
                source=source,
                context=context or {},
                fingerprint=self._generate_fingerprint(name, source, context),
                tags=tags or []
            )

            # Store alert
            await self._store_alert(alert)
            self._active_alerts[alert.id] = alert

            # Send notifications
            await self._send_alert_notifications(alert)

            # Update metrics
            await self._update_alert_metrics("created", alert)

            logger.info(f"Created manual alert: {alert.name}")
            return alert

        except Exception as e:
            logger.error(f"Failed to create manual alert: {e}")
            raise

    async def acknowledge_alert(self, alert_id: UUID, user_id: UUID, message: Optional[str] = None) -> bool:
        """Acknowledge an alert."""
        try:
            alert = self._active_alerts.get(alert_id)
            if not alert:
                # Try to get from storage
                alert_data = await self.redis.get(f"alert:{alert_id}")
                if alert_data:
                    alert = AlertInstance(**alert_data)
                    if alert.status == AlertStatus.RESOLVED:
                        return False  # Cannot acknowledge resolved alerts
                else:
                    return False  # Alert not found

            # Update alert status
            alert.status = AlertStatus.ACKNOWLEDGED
            alert.acknowledged_by = user_id
            alert.acknowledged_at = datetime.utcnow()
            alert.updated_at = datetime.utcnow()

            # Store updated alert
            await self._store_alert(alert)
            self._active_alerts[alert_id] = alert

            # Update metrics
            await self._update_alert_metrics("acknowledged", alert)

            logger.info(f"Alert {alert_id} acknowledged by user {user_id}")
            return True

        except Exception as e:
            logger.error(f"Failed to acknowledge alert: {e}")
            return False

    async def resolve_alert(self, alert_id: UUID, user_id: UUID, resolution_message: Optional[str] = None) -> bool:
        """Resolve an alert."""
        try:
            alert = self._active_alerts.get(alert_id)
            if not alert:
                # Try to get from storage
                alert_data = await self.redis.get(f"alert:{alert_id}")
                if alert_data:
                    alert = AlertInstance(**alert_data)
                    if alert.status == AlertStatus.RESOLVED:
                        return True  # Already resolved
                else:
                    return False  # Alert not found

            # Calculate resolution time
            resolution_time = (datetime.utcnow() - alert.first_seen_at).total_seconds()

            # Update alert status
            alert.status = AlertStatus.RESOLVED
            alert.resolved_by = user_id
            alert.resolved_at = datetime.utcnow()
            alert.resolution_message = resolution_message
            alert.updated_at = datetime.utcnow()

            # Store updated alert
            await self._store_alert(alert)

            # Remove from active alerts
            if alert_id in self._active_alerts:
                del self._active_alerts[alert_id]

            # Update metrics
            await self._update_alert_metrics("resolved", alert)
            self._alert_metrics["resolution_times"].append(resolution_time)

            logger.info(f"Alert {alert_id} resolved by user {user_id} in {resolution_time:.1f}s")
            return True

        except Exception as e:
            logger.error(f"Failed to resolve alert: {e}")
            return False

    async def get_active_alerts(
        self,
        severity: Optional[AlertSeverity] = None,
        source: Optional[str] = None,
        tags: Optional[List[str]] = None,
        limit: int = 100
    ) -> List[AlertInstance]:
        """Get active alerts with optional filtering."""
        try:
            alerts = []

            for alert in self._active_alerts.values():
                if alert.status not in [AlertStatus.ACTIVE, AlertStatus.ACKNOWLEDGED]:
                    continue

                # Apply filters
                if severity and alert.severity != severity:
                    continue

                if source and alert.source != source:
                    continue

                if tags and not any(tag in alert.tags for tag in tags):
                    continue

                alerts.append(alert)

                if len(alerts) >= limit:
                    break

            # Sort by severity and creation time
            severity_order = [AlertSeverity.CRITICAL, AlertSeverity.HIGH, AlertSeverity.MEDIUM, AlertSeverity.LOW]
            alerts.sort(key=lambda a: (
                severity_order.index(a.severity),
                a.first_seen_at
            ), reverse=True)

            return alerts

        except Exception as e:
            logger.error(f"Failed to get active alerts: {e}")
            return []

    async def get_alert_history(
        self,
        hours: int = 24,
        severity: Optional[AlertSeverity] = None,
        source: Optional[str] = None,
        status: Optional[AlertStatus] = None,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """Get alert history."""
        try:
            cutoff_time = datetime.utcnow() - timedelta(hours=hours)

            # Get recent alerts from storage
            alert_keys = await self.redis.keys("alert:*")
            alerts = []

            for key in alert_keys[:limit * 2]:  # Get more than needed for filtering
                try:
                    data = await self.redis.get(key)
                    if not data:
                        continue

                    alert = AlertInstance(**data)

                    # Filter by time
                    if alert.created_at < cutoff_time:
                        continue

                    # Apply other filters
                    if severity and alert.severity != severity:
                        continue

                    if source and alert.source != source:
                        continue

                    if status and alert.status != status:
                        continue

                    alerts.append(alert.dict())

                    if len(alerts) >= limit:
                        break

                except Exception as e:
                    logger.warning(f"Error parsing alert {key}: {e}")
                    continue

            # Sort by creation time (newest first)
            alerts.sort(key=lambda x: x["created_at"], reverse=True)

            return alerts

        except Exception as e:
            logger.error(f"Failed to get alert history: {e}")
            return []

    async def get_alert_statistics(self) -> Dict[str, Any]:
        """Get comprehensive alert statistics."""
        try:
            # Calculate current stats
            current_stats = {
                "total_alerts": len(self._active_alerts),
                "active_alerts": len([a for a in self._active_alerts.values() if a.status == AlertStatus.ACTIVE]),
                "acknowledged_alerts": len([a for a in self._active_alerts.values() if a.status == AlertStatus.ACKNOWLEDGED]),
                "by_severity": {},
                "by_source": {},
                "average_resolution_time": 0,
                "alerts_per_hour": 0,
                "escalation_rate": 0
            }

            # Count by severity
            for alert in self._active_alerts.values():
                severity_key = alert.severity.value
                current_stats["by_severity"][severity_key] = current_stats["by_severity"].get(severity_key, 0) + 1

            # Count by source
            for alert in self._active_alerts.values():
                source_key = alert.source
                current_stats["by_source"][source_key] = current_stats["by_source"].get(source_key, 0) + 1

            # Calculate average resolution time
            if self._alert_metrics["resolution_times"]:
                current_stats["average_resolution_time"] = sum(self._alert_metrics["resolution_times"]) / len(self._alert_metrics["resolution_times"])

            # Calculate alerts per hour (last 24h)
            last_24h_alerts = await self.get_alert_history(hours=24)
            current_stats["alerts_per_hour"] = len(last_24h_alerts) / 24

            # Calculate escalation rate
            total_escalated = len([a for a in self._active_alerts.values() if a.escalation_count > 0])
            total_alerts = len(self._active_alerts) or 1
            current_stats["escalation_rate"] = (total_escalated / total_alerts) * 100

            # Merge with stored metrics
            stored_metrics = await self.redis.get("alert_metrics") or {}
            return {**stored_metrics, **current_stats}

        except Exception as e:
            logger.error(f"Failed to get alert statistics: {e}")
            return {}

    async def _load_active_rules(self):
        """Load active alert rules from storage."""
        try:
            rule_ids = await self.redis.smembers("alert_rules")

            for rule_id in rule_ids:
                try:
                    rule_data = await self.redis.get(f"alert_rule:{rule_id}")
                    if rule_data:
                        rule = AlertRule(**rule_data)
                        if rule.enabled:
                            self._active_rules[UUID(rule_id)] = rule
                except Exception as e:
                    logger.warning(f"Error loading rule {rule_id}: {e}")
                    continue

            logger.info(f"Loaded {len(self._active_rules)} active alert rules")

        except Exception as e:
            logger.error(f"Failed to load active rules: {e}")

    async def _evaluation_loop(self):
        """Main alert evaluation loop."""
        while self._active:
            try:
                # Evaluate all active rules
                for rule in list(self._active_rules.values()):
                    if not rule.enabled:
                        continue

                    try:
                        await self._evaluate_rule(rule)
                    except Exception as e:
                        logger.error(f"Error evaluating rule {rule.name}: {e}")

                # Store metrics
                await self.redis.set("alert_metrics", self._alert_metrics, expire=86400)

                # Wait for next evaluation cycle
                await asyncio.sleep(60)  # Evaluate every minute

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in evaluation loop: {e}")
                await asyncio.sleep(10)

    async def _cleanup_loop(self):
        """Cleanup loop for old alerts and maintenance."""
        while self._active:
            try:
                # Clean up old resolved alerts (older than 7 days)
                cutoff_time = datetime.utcnow() - timedelta(days=7)

                for alert_id, alert in list(self._active_alerts.items()):
                    if (alert.status == AlertStatus.RESOLVED and
                        alert.resolved_at and alert.resolved_at < cutoff_time):
                        del self._active_alerts[alert_id]

                # Clean up old notification acknowledgments
                # This would be implemented based on your needs

                await asyncio.sleep(3600)  # Run cleanup every hour

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in cleanup loop: {e}")
                await asyncio.sleep(300)

    async def _evaluate_rule(self, rule: AlertRule):
        """Evaluate a single alert rule."""
        try:
            # Get metrics for rule evaluation
            # This would integrate with your monitoring system
            # For now, we'll assume metrics are pushed via evaluate_metric()

        except Exception as e:
            logger.error(f"Error evaluating rule {rule.name}: {e}")

    async def _rule_matches_metric(
        self,
        rule: AlertRule,
        metric_name: str,
        value: float,
        source: str,
        context: Dict[str, Any]
    ) -> bool:
        """Check if a metric matches an alert rule."""
        try:
            # Check metric name
            if rule.metric_thresholds and metric_name not in rule.metric_thresholds:
                return False

            # Check threshold
            if metric_name in rule.metric_thresholds:
                threshold_config = rule.metric_thresholds[metric_name]
                operator = threshold_config.get("operator", ">")
                threshold_value = threshold_config.get("value", 0)

                if operator == ">" and value <= threshold_value:
                    return False
                elif operator == "<" and value >= threshold_value:
                    return False
                elif operator == "==" and value != threshold_value:
                    return False
                elif operator == "!=" and value == threshold_value:
                    return False

            # Check source
            if "sources" in rule.conditions and source not in rule.conditions["sources"]:
                return False

            # Check additional conditions
            for condition_key, condition_value in rule.conditions.items():
                if condition_key == "tags":
                    alert_tags = set(context.get("tags", []))
                    required_tags = set(condition_value)
                    if not alert_tags.intersection(required_tags):
                        return False

            return True

        except Exception as e:
            logger.error(f"Error checking rule match: {e}")
            return False

    async def _trigger_alert(
        self,
        rule: AlertRule,
        metric_name: str,
        value: float,
        source: str,
        context: Dict[str, Any]
    ):
        """Trigger an alert from a rule."""
        try:
            # Generate fingerprint for deduplication
            fingerprint = self._generate_fingerprint(rule.name, source, {
                "metric_name": metric_name,
                "rule_id": str(rule.id)
            })

            # Check for existing alert with same fingerprint
            existing_alert = await self._find_alert_by_fingerprint(fingerprint)

            if existing_alert:
                # Update existing alert
                existing_alert.last_seen_at = datetime.utcnow()
                existing_alert.evaluation_count += 1
                existing_alert.current_value = value
                existing_alert.updated_at = datetime.utcnow()

                await self._store_alert(existing_alert)
                self._active_alerts[existing_alert.id] = existing_alert

                logger.debug(f"Updated existing alert: {existing_alert.name}")
            else:
                # Create new alert
                alert = AlertInstance(
                    rule_id=rule.id,
                    name=rule.name,
                    description=rule.description or f"Alert triggered for metric {metric_name}",
                    severity=rule.severity,
                    source=source,
                    metric_name=metric_name,
                    current_value=value,
                    threshold_value=rule.metric_thresholds.get(metric_name, {}).get("value"),
                    context=context,
                    fingerprint=fingerprint,
                    tags=rule.tags
                )

                # Store alert
                await self._store_alert(alert)
                self._active_alerts[alert.id] = alert

                # Send notifications
                await self._send_alert_notifications(alert)

                # Update metrics
                await self._update_alert_metrics("created", alert)

                logger.info(f"Triggered new alert: {alert.name}")

        except Exception as e:
            logger.error(f"Failed to trigger alert: {e}")

    async def _find_alert_by_fingerprint(self, fingerprint: str) -> Optional[AlertInstance]:
        """Find an active alert by fingerprint."""
        try:
            # Check active alerts first
            for alert in self._active_alerts.values():
                if alert.fingerprint == fingerprint and alert.status in [AlertStatus.ACTIVE, AlertStatus.ACKNOWLEDGED]:
                    return alert

            # Check storage
            fingerprint_key = f"alert_fingerprint:{fingerprint}"
            alert_data = await self.redis.get(fingerprint_key)
            if alert_data:
                alert = AlertInstance(**alert_data)
                if alert.status in [AlertStatus.ACTIVE, AlertStatus.ACKNOWLEDGED]:
                    return alert

            return None

        except Exception as e:
            logger.error(f"Failed to find alert by fingerprint: {e}")
            return None

    async def _send_alert_notifications(self, alert: AlertInstance):
        """Send notifications for an alert."""
        try:
            if not self.notification_service:
                logger.warning("Notification service not available")
                return

            # Prepare alert data for notification
            alert_data = {
                "alert_id": str(alert.id),
                "alert_title": alert.name,
                "description": alert.description,
                "severity": alert.severity.value,
                "source": alert.source,
                "metric_name": alert.metric_name,
                "current_value": alert.current_value,
                "threshold_value": alert.threshold_value,
                "timestamp": alert.created_at.isoformat(),
                "context": alert.context,
                "tags": alert.tags
            }

            # Get notification rules for alert
            notification_rule_ids = []

            # If alert has a rule, get its notification rules
            if alert.rule_id:
                rule = await self._get_alert_rule(alert.rule_id)
                if rule:
                    notification_rule_ids = rule.notification_rules

            # Send notifications
            notifications = await self.notification_service.send_notification(
                alert_data,
                custom_rules=notification_rule_ids
            )

            # Update alert with notification info
            alert.notifications_sent = [n.id for n in notifications]
            alert.last_notification_at = datetime.utcnow()

            await self._store_alert(alert)

        except Exception as e:
            logger.error(f"Failed to send alert notifications: {e}")

    def _generate_fingerprint(self, name: str, source: str, context: Dict[str, Any]) -> str:
        """Generate a unique fingerprint for alert deduplication."""
        import hashlib

        # Create fingerprint from key fields
        fingerprint_data = {
            "name": name,
            "source": source,
            "metric_name": context.get("metric_name", ""),
            "rule_id": context.get("rule_id", "")
        }

        fingerprint_str = json.dumps(fingerprint_data, sort_keys=True)
        return hashlib.md5(fingerprint_str.encode()).hexdigest()

    async def _store_alert(self, alert: AlertInstance):
        """Store an alert in Redis."""
        try:
            # Store alert
            await self.redis.set(
                f"alert:{alert.id}",
                alert.dict(),
                expire=86400 * 7  # 7 days
            )

            # Store fingerprint mapping
            await self.redis.set(
                f"alert_fingerprint:{alert.fingerprint}",
                alert.dict(),
                expire=86400 * 7
            )

            # Add to active alerts set
            if alert.status in [AlertStatus.ACTIVE, AlertStatus.ACKNOWLEDGED]:
                await self.redis.sadd("active_alerts", str(alert.id))

        except Exception as e:
            logger.error(f"Failed to store alert: {e}")

    async def _store_alert_rule(self, rule: AlertRule):
        """Store an alert rule in Redis."""
        try:
            await self.redis.set(
                f"alert_rule:{rule.id}",
                rule.dict(),
                expire=86400 * 30  # 30 days
            )
            await self.redis.sadd("alert_rules", str(rule.id))
        except Exception as e:
            logger.error(f"Failed to store alert rule: {e}")

    async def _get_alert_rule(self, rule_id: UUID) -> Optional[AlertRule]:
        """Get an alert rule by ID."""
        try:
            rule_data = await self.redis.get(f"alert_rule:{rule_id}")
            if rule_data:
                return AlertRule(**rule_data)
            return None
        except Exception as e:
            logger.error(f"Failed to get alert rule: {e}")
            return None

    async def _update_alert_metrics(self, action: str, alert: AlertInstance):
        """Update alert metrics."""
        try:
            # Update total counts
            if action == "created":
                self._alert_metrics["total_alerts"] += 1
                self._alert_metrics["active_alerts"] += 1
            elif action == "acknowledged":
                self._alert_metrics["acknowledged_alerts"] += 1
            elif action == "resolved":
                self._alert_metrics["resolved_alerts"] += 1
                if alert.status == AlertStatus.ACTIVE:
                    self._alert_metrics["active_alerts"] -= 1

            # Update by severity
            severity_key = alert.severity.value
            if severity_key not in self._alert_metrics["by_severity"]:
                self._alert_metrics["by_severity"][severity_key] = {"created": 0, "resolved": 0}

            if action == "created":
                self._alert_metrics["by_severity"][severity_key]["created"] += 1
            elif action == "resolved":
                self._alert_metrics["by_severity"][severity_key]["resolved"] += 1

            # Update by source
            source_key = alert.source
            if source_key not in self._alert_metrics["by_source"]:
                self._alert_metrics["by_source"][source_key] = {"created": 0, "resolved": 0}

            if action == "created":
                self._alert_metrics["by_source"][source_key]["created"] += 1
            elif action == "resolved":
                self._alert_metrics["by_source"][source_key]["resolved"] += 1

        except Exception as e:
            logger.error(f"Failed to update alert metrics: {e}")


# Global alerting service instance
alerting_service: Optional[AlertingService] = None


async def get_alerting_service() -> AlertingService:
    """Get or create the global alerting service instance."""
    global alerting_service

    if alerting_service is None:
        alerting_service = AlertingService()
        await alerting_service.start()

    return alerting_service


async def shutdown_alerting_service():
    """Shutdown the global alerting service instance."""
    global alerting_service

    if alerting_service:
        await alerting_service.stop()
        alerting_service = None