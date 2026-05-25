"""
Budget Enforcement Service.

This module provides comprehensive budget management and enforcement capabilities
for multi-tenant LLM operations with real-time monitoring and automatic controls.
"""

import asyncio
import json
import logging
import time
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Any, Dict, List, Optional, Union, Tuple
from dataclasses import dataclass, field, asdict
from enum import Enum
import uuid

import redis.asyncio as redis
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


class BudgetType(Enum):
    """Budget types."""

    HOURLY = "hourly"
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    YEARLY = "yearly"
    CUSTOM = "custom"


class BudgetStatus(Enum):
    """Budget status types."""

    ACTIVE = "active"
    EXHAUSTED = "exhausted"
    WARNING = "warning"
    SUSPENDED = "suspended"
    EXPIRED = "expired"


class EnforcementAction(Enum):
    """Budget enforcement actions."""

    NONE = "none"
    WARN = "warn"
    THROTTLE = "throttle"
    BLOCK = "block"
    ESCALATE = "escalate"
    NOTIFICATION = "notification"


@dataclass
class BudgetLimit:
    """Budget limit configuration."""

    budget_type: BudgetType
    amount: Decimal
    currency: str = "USD"
    token_limit: Optional[int] = None
    request_limit: Optional[int] = None

    # Time period
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    reset_interval: Optional[timedelta] = None

    # Usage tracking
    amount_used: Decimal = field(default_factory=lambda: Decimal("0"))
    tokens_used: int = 0
    requests_used: int = 0

    # Settings
    enabled: bool = True
    soft_limit: bool = False  # Soft limit allows overage with warnings
    warn_threshold: float = 0.8  # Warn at 80% usage
    critical_threshold: float = 0.95  # Critical at 95% usage

    def reset_usage(self) -> None:
        """Reset usage counters."""
        self.amount_used = Decimal("0")
        self.tokens_used = 0
        self.requests_used = 0
        if self.start_date:
            self.start_date = datetime.now()

    def is_expired(self) -> bool:
        """Check if budget period is expired."""
        if self.end_date:
            return datetime.now() > self.end_date
        return False

    def usage_percentage(self) -> float:
        """Calculate usage percentage."""
        if self.amount == 0:
            return 0.0
        return min(100.0, float(self.amount_used / self.amount) * 100.0)

    def remaining_amount(self) -> Decimal:
        """Calculate remaining amount."""
        return max(Decimal("0"), self.amount - self.amount_used)

    def can_consume(
        self, amount: Decimal = Decimal("0"), tokens: int = 0, requests: int = 0
    ) -> Tuple[bool, str, BudgetStatus]:
        """Check if consumption is allowed."""
        if not self.enabled or self.is_expired():
            return True, "Budget disabled or expired", BudgetStatus.EXPIRED

        # Check amount limit
        if self.amount > Decimal("0"):
            if self.amount_used + amount > self.amount:
                if not self.soft_limit:
                    return False, "Budget amount exceeded", BudgetStatus.EXHAUSTED

        # Check token limit
        if self.token_limit and self.token_limit > 0:
            if self.tokens_used + tokens > self.token_limit:
                if not self.soft_limit:
                    return False, "Token limit exceeded", BudgetStatus.EXHAUSTED

        # Check request limit
        if self.request_limit and self.request_limit > 0:
            if self.requests_used + requests > self.request_limit:
                if not self.soft_limit:
                    return False, "Request limit exceeded", BudgetStatus.EXHAUSTED

        # Determine status
        usage_pct = self.usage_percentage()
        if usage_pct >= self.critical_threshold:
            status = BudgetStatus.WARNING
        elif usage_pct >= self.warn_threshold:
            status = BudgetStatus.WARNING
        else:
            status = BudgetStatus.ACTIVE

        return True, "Allowed", status

    def consume(
        self, amount: Decimal = Decimal("0"), tokens: int = 0, requests: int = 0
    ) -> Tuple[bool, BudgetStatus]:
        """Consume from budget."""
        can_consume, reason, status = self.can_consume(amount, tokens, requests)

        if not can_consume:
            if self.soft_limit:
                # Log warning but allow consumption
                logger.warning(f"Soft budget exceeded: {reason}")
            else:
                return False, BudgetStatus.EXHAUSTED

        # Update usage
        self.amount_used += amount
        self.tokens_used += tokens
        self.requests_used += requests

        # Recalculate status
        usage_pct = self.usage_percentage()
        if usage_pct >= self.critical_threshold:
            status = BudgetStatus.WARNING
        elif usage_pct >= self.warn_threshold:
            status = BudgetStatus.WARNING
        else:
            status = BudgetStatus.ACTIVE

        return True, status


@dataclass
class BudgetPolicy:
    """Budget enforcement policy."""

    tenant_id: str
    name: str
    description: Optional[str] = None

    # Budget limits
    limits: List[BudgetLimit] = field(default_factory=list)

    # Enforcement actions
    warning_action: EnforcementAction = EnforcementAction.NOTIFICATION
    critical_action: EnforcementAction = EnforcementAction.THROTTLE
    exhausted_action: EnforcementAction = EnforcementAction.BLOCK

    # Escalation settings
    escalation_enabled: bool = False
    escalation_emails: List[str] = field(default_factory=list)
    escalation_webhooks: List[str] = field(default_factory=list)

    # Throttling settings
    throttle_rate_limit: Optional[int] = None  # Requests per minute
    throttle_token_limit: Optional[int] = None  # Tokens per minute

    # Notification settings
    notification_channels: List[str] = field(default_factory=list)
    notification_cooldown: int = 300  # 5 minutes

    # Metadata
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    created_by: Optional[str] = None
    tags: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            **asdict(self),
            "limits": [limit.__dict__ for limit in self.limits],
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }


@dataclass
class BudgetViolation:
    """Budget violation record."""

    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: datetime = field(default_factory=datetime.now)
    tenant_id: str
    policy_name: str
    violation_type: BudgetStatus

    # Violation details
    budget_type: BudgetType
    limit_amount: Decimal
    current_usage: Decimal
    attempted_usage: Decimal
    overage_amount: Decimal

    # Request details
    request_id: Optional[str] = None
    user_id: Optional[str] = None
    provider: Optional[str] = None
    model: Optional[str] = None

    # Action taken
    action_taken: EnforcementAction = EnforcementAction.NONE
    blocked: bool = False
    throttled: bool = False

    # Resolution
    resolved: bool = False
    resolved_at: Optional[datetime] = None
    resolved_by: Optional[str] = None
    resolution_notes: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            **asdict(self),
            "limit_amount": str(self.limit_amount),
            "current_usage": str(self.current_usage),
            "attempted_usage": str(self.attempted_usage),
            "overage_amount": str(self.overage_amount),
            "timestamp": self.timestamp.isoformat(),
            "resolved_at": self.resolved_at.isoformat() if self.resolved_at else None,
        }


class BudgetMetrics(BaseModel):
    """Budget metrics and analytics."""

    tenant_id: str
    period: str
    start_time: datetime
    end_time: datetime

    # Budget metrics
    total_budget: Decimal = Field(default_factory=lambda: Decimal("0"))
    total_spent: Decimal = Field(default_factory=lambda: Decimal("0"))
    total_remaining: Decimal = Field(default_factory=lambda: Decimal("0"))
    utilization_rate: float = 0.0

    # Violation metrics
    total_violations: int = 0
    blocked_requests: int = 0
    throttled_requests: int = 0
    warnings_sent: int = 0

    # Budget breakdown
    budget_breakdown: Dict[str, Dict[str, Union[Decimal, float]]] = Field(
        default_factory=dict
    )

    # Trends
    daily_spend_trend: List[Dict[str, Union[datetime, Decimal]]] = Field(
        default_factory=list
    )

    class Config:
        arbitrary_types_allowed = True


class BudgetManager:
    """Budget enforcement and management service."""

    def __init__(
        self,
        redis_url: str = "redis://localhost:6379/0",
        cache_ttl: int = 300,  # 5 minutes
        violation_retention_days: int = 90,
        policy_check_interval: int = 60,  # 1 minute
        enable_real_time_enforcement: bool = True,
        default_currency: str = "USD",
    ):
        """Initialize budget manager."""
        self.redis_url = redis_url
        self.cache_ttl = cache_ttl
        self.violation_retention_days = violation_retention_days
        self.policy_check_interval = policy_check_interval
        self.enable_real_time_enforcement = enable_real_time_enforcement
        self.default_currency = default_currency

        self._redis: Optional[redis.Redis] = None
        self._initialized = False

        # In-memory caches
        self._policy_cache: Dict[str, BudgetPolicy] = {}
        self._throttled_tenants: Dict[str, datetime] = {}

        # Background tasks
        self._policy_check_task: Optional[asyncio.Task] = None
        self._cleanup_task: Optional[asyncio.Task] = None

        # Redis key prefixes
        self.POLICY_KEY_PREFIX = "budget:policy:"
        self.VIOLATION_KEY_PREFIX = "budget:violation:"
        self.METRICS_KEY_PREFIX = "budget:metrics:"
        self.THROTTLE_KEY_PREFIX = "budget:throttle:"
        self.ALERT_KEY_PREFIX = "budget:alert:"

    async def initialize(self) -> None:
        """Initialize the budget manager."""
        if self._initialized:
            return

        try:
            self._redis = redis.from_url(self.redis_url, decode_responses=False)

            # Test Redis connection
            await self._redis.ping()

            # Start background tasks
            if self.enable_real_time_enforcement:
                self._policy_check_task = asyncio.create_task(
                    self._policy_monitoring_loop()
                )

            self._cleanup_task = asyncio.create_task(self._cleanup_expired_data())

            self._initialized = True
            logger.info("Budget Manager initialized successfully")

        except Exception as e:
            logger.error(f"Failed to initialize Budget Manager: {e}")
            raise

    async def cleanup(self) -> None:
        """Clean up budget manager resources."""
        if not self._initialized:
            return

        try:
            # Stop background tasks
            if self._policy_check_task:
                self._policy_check_task.cancel()
                try:
                    await self._policy_check_task
                except asyncio.CancelledError:
                    pass

            if self._cleanup_task:
                self._cleanup_task.cancel()
                try:
                    await self._cleanup_task
                except asyncio.CancelledError:
                    pass

            # Close Redis connection
            if self._redis:
                await self._redis.close()

            self._initialized = False
            logger.info("Budget Manager cleaned up")

        except Exception as e:
            logger.error(f"Error during Budget Manager cleanup: {e}")

    async def create_budget_policy(self, policy: BudgetPolicy) -> str:
        """Create a new budget policy."""
        try:
            # Validate policy
            await self._validate_policy(policy)

            # Store in Redis
            policy_key = f"{self.POLICY_KEY_PREFIX}{policy.tenant_id}:{policy.name}"
            policy_data = json.dumps(policy.to_dict())
            await self._redis.set(policy_key, policy_data)

            # Update cache
            self._policy_cache[f"{policy.tenant_id}:{policy.name}"] = policy

            logger.info(
                f"Created budget policy '{policy.name}' for tenant {policy.tenant_id}"
            )
            return f"{policy.tenant_id}:{policy.name}"

        except Exception as e:
            logger.error(f"Failed to create budget policy: {e}")
            raise

    async def get_budget_policy(
        self, tenant_id: str, policy_name: str
    ) -> Optional[BudgetPolicy]:
        """Get budget policy for tenant."""
        cache_key = f"{tenant_id}:{policy_name}"
        if cache_key in self._policy_cache:
            return self._policy_cache[cache_key]

        # Try to load from Redis
        try:
            policy_key = f"{self.POLICY_KEY_PREFIX}{cache_key}"
            policy_data = await self._redis.get(policy_key)
            if policy_data:
                policy_dict = json.loads(policy_data)

                # Reconstruct BudgetLimit objects
                limits = []
                for limit_data in policy_dict.get("limits", []):
                    limit = BudgetLimit(
                        budget_type=BudgetType(limit_data["budget_type"]),
                        amount=Decimal(limit_data["amount"]),
                        currency=limit_data.get("currency", "USD"),
                        token_limit=limit_data.get("token_limit"),
                        request_limit=limit_data.get("request_limit"),
                        start_date=datetime.fromisoformat(limit_data["start_date"])
                        if limit_data.get("start_date")
                        else None,
                        end_date=datetime.fromisoformat(limit_data["end_date"])
                        if limit_data.get("end_date")
                        else None,
                        amount_used=Decimal(limit_data.get("amount_used", "0")),
                        tokens_used=limit_data.get("tokens_used", 0),
                        requests_used=limit_data.get("requests_used", 0),
                        enabled=limit_data.get("enabled", True),
                        soft_limit=limit_data.get("soft_limit", False),
                        warn_threshold=limit_data.get("warn_threshold", 0.8),
                        critical_threshold=limit_data.get("critical_threshold", 0.95),
                    )
                    limits.append(limit)

                policy = BudgetPolicy(
                    tenant_id=policy_dict["tenant_id"],
                    name=policy_dict["name"],
                    description=policy_dict.get("description"),
                    limits=limits,
                    warning_action=EnforcementAction(
                        policy_dict.get("warning_action", "notification")
                    ),
                    critical_action=EnforcementAction(
                        policy_dict.get("critical_action", "throttle")
                    ),
                    exhausted_action=EnforcementAction(
                        policy_dict.get("exhausted_action", "block")
                    ),
                    escalation_enabled=policy_dict.get("escalation_enabled", False),
                    escalation_emails=policy_dict.get("escalation_emails", []),
                    escalation_webhooks=policy_dict.get("escalation_webhooks", []),
                    throttle_rate_limit=policy_dict.get("throttle_rate_limit"),
                    throttle_token_limit=policy_dict.get("throttle_token_limit"),
                    notification_channels=policy_dict.get("notification_channels", []),
                    notification_cooldown=policy_dict.get("notification_cooldown", 300),
                    created_at=datetime.fromisoformat(policy_dict["created_at"]),
                    updated_at=datetime.fromisoformat(policy_dict["updated_at"]),
                    created_by=policy_dict.get("created_by"),
                    tags=policy_dict.get("tags", []),
                )

                self._policy_cache[cache_key] = policy
                return policy

        except Exception as e:
            logger.error(f"Failed to load budget policy: {e}")

        return None

    async def check_budget_enforcement(
        self,
        tenant_id: str,
        amount: Decimal = Decimal("0"),
        tokens: int = 0,
        requests: int = 1,
        request_id: Optional[str] = None,
        user_id: Optional[str] = None,
        provider: Optional[str] = None,
        model: Optional[str] = None,
    ) -> Tuple[bool, Optional[EnforcementAction], Optional[str]]:
        """Check if request is allowed under budget constraints."""
        if not self._initialized:
            await self.initialize()

        try:
            # Get all policies for tenant
            policies = await self._get_tenant_policies(tenant_id)
            if not policies:
                return True, None, "No budget policies found"

            # Check each policy
            for policy in policies:
                if not policy.limits:
                    continue

                for limit in policy.limits:
                    if not limit.enabled:
                        continue

                    # Check if budget is expired
                    if limit.is_expired():
                        continue

                    # Check consumption
                    can_consume, reason, status = limit.can_consume(
                        amount, tokens, requests
                    )

                    if not can_consume:
                        # Budget exceeded - record violation
                        violation = BudgetViolation(
                            tenant_id=tenant_id,
                            policy_name=policy.name,
                            violation_type=status,
                            budget_type=limit.budget_type,
                            limit_amount=limit.amount,
                            current_usage=limit.amount_used,
                            attempted_usage=amount,
                            overage_amount=(limit.amount_used + amount) - limit.amount,
                            request_id=request_id,
                            user_id=user_id,
                            provider=provider,
                            model=model,
                            action_taken=policy.exhausted_action,
                            blocked=True,
                        )

                        await self._record_violation(violation)
                        await self._enforce_action(
                            policy, policy.exhausted_action, violation
                        )

                        return (
                            False,
                            policy.exhausted_action,
                            f"Budget exceeded: {reason}",
                        )

                    elif status == BudgetStatus.WARNING:
                        # Warning threshold exceeded
                        violation = BudgetViolation(
                            tenant_id=tenant_id,
                            policy_name=policy.name,
                            violation_type=status,
                            budget_type=limit.budget_type,
                            limit_amount=limit.amount,
                            current_usage=limit.amount_used,
                            attempted_usage=amount,
                            overage_amount=Decimal("0"),
                            request_id=request_id,
                            user_id=user_id,
                            provider=provider,
                            model=model,
                            action_taken=policy.warning_action,
                            blocked=False,
                        )

                        await self._record_violation(violation)
                        await self._enforce_action(
                            policy, policy.warning_action, violation
                        )

            # All budgets OK - consume from all applicable limits
            for policy in policies:
                for limit in policy.limits:
                    if limit.enabled and not limit.is_expired():
                        limit.consume(amount, tokens, requests)
                        await self._update_limit_usage(tenant_id, policy.name, limit)

            return True, None, "Budget check passed"

        except Exception as e:
            logger.error(f"Failed to check budget enforcement: {e}")
            return True, None, "Budget check failed - allowing request"

    async def get_budget_metrics(
        self,
        tenant_id: str,
        period: str = "monthly",
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> BudgetMetrics:
        """Get budget metrics for tenant."""
        if not self._initialized:
            await self.initialize()

        try:
            # Determine date range
            if not end_date:
                end_date = datetime.now()
            if not start_date:
                start_date = self._get_start_date(period, end_date)

            # Generate cache key
            cache_key = f"{self.METRICS_KEY_PREFIX}{tenant_id}:{period}:{start_date.isoformat()}:{end_date.isoformat()}"

            # Try to get from cache
            cached_metrics = await self._redis.get(cache_key)
            if cached_metrics:
                return BudgetMetrics.parse_raw(cached_metrics)

            # Calculate metrics
            metrics = await self._calculate_budget_metrics(
                tenant_id, period, start_date, end_date
            )

            # Cache the result
            await self._redis.setex(cache_key, self.cache_ttl, metrics.json())

            return metrics

        except Exception as e:
            logger.error(f"Failed to get budget metrics: {e}")
            return BudgetMetrics(
                tenant_id=tenant_id,
                period=period,
                start_time=start_date or datetime.now(),
                end_time=end_date or datetime.now(),
            )

    async def _validate_policy(self, policy: BudgetPolicy) -> None:
        """Validate budget policy."""
        if not policy.tenant_id:
            raise ValueError("Tenant ID is required")

        if not policy.name:
            raise ValueError("Policy name is required")

        if not policy.limits:
            raise ValueError("At least one budget limit is required")

        # Validate each limit
        for limit in policy.limits:
            if limit.amount <= 0:
                raise ValueError("Budget amount must be positive")

            if limit.warn_threshold < 0 or limit.warn_threshold > 1:
                raise ValueError("Warning threshold must be between 0 and 1")

            if limit.critical_threshold < 0 or limit.critical_threshold > 1:
                raise ValueError("Critical threshold must be between 0 and 1")

            if limit.critical_threshold <= limit.warn_threshold:
                raise ValueError(
                    "Critical threshold must be greater than warning threshold"
                )

    async def _get_tenant_policies(self, tenant_id: str) -> List[BudgetPolicy]:
        """Get all policies for a tenant."""
        policies = []

        try:
            # Get all policy keys for tenant
            pattern = f"{self.POLICY_KEY_PREFIX}{tenant_id}:*"
            keys = await self._redis.keys(pattern)

            for key in keys:
                policy_data = await self._redis.get(key)
                if policy_data:
                    json.loads(policy_data)
                    policy_name = key.decode().split(":")[-1]

                    policy = await self.get_budget_policy(tenant_id, policy_name)
                    if policy:
                        policies.append(policy)

        except Exception as e:
            logger.error(f"Failed to get tenant policies: {e}")

        return policies

    async def _record_violation(self, violation: BudgetViolation) -> None:
        """Record a budget violation."""
        try:
            # Store violation
            violation_key = f"{self.VIOLATION_KEY_PREFIX}{violation.id}"
            violation_data = json.dumps(violation.to_dict())
            await self._redis.setex(
                violation_key,
                self.violation_retention_days * 24 * 3600,
                violation_data,
            )

            # Add to tenant violation list
            tenant_violations_key = (
                f"{self.VIOLATION_KEY_PREFIX}tenant:{violation.tenant_id}"
            )
            await self._redis.lpush(tenant_violations_key, violation.id)
            await self._redis.expire(
                tenant_violations_key,
                self.violation_retention_days * 24 * 3600,
            )

            logger.warning(
                f"Budget violation recorded for tenant {violation.tenant_id}: "
                f"{violation.violation_type.value} - {violation.overage_amount}"
            )

        except Exception as e:
            logger.error(f"Failed to record violation: {e}")

    async def _enforce_action(
        self,
        policy: BudgetPolicy,
        action: EnforcementAction,
        violation: BudgetViolation,
    ) -> None:
        """Enforce budget violation action."""
        try:
            if action == EnforcementAction.NONE:
                return

            elif action == EnforcementAction.NOTIFICATION:
                await self._send_notification(policy, violation)

            elif action == EnforcementAction.THROTTLE:
                await self._apply_throttling(policy, violation)

            elif action == EnforcementAction.BLOCK:
                # Already handled in check_budget_enforcement
                pass

            elif action == EnforcementAction.ESCALATE:
                await self._escalate_violation(policy, violation)

            # Store action taken
            action_key = f"{self.ALERT_KEY_PREFIX}{violation.tenant_id}:{action.value}:{int(time.time())}"
            action_data = {
                "tenant_id": violation.tenant_id,
                "action": action.value,
                "violation_id": violation.id,
                "timestamp": violation.timestamp.isoformat(),
            }
            await self._redis.setex(action_key, 86400, json.dumps(action_data))

        except Exception as e:
            logger.error(f"Failed to enforce action: {e}")

    async def _send_notification(
        self, policy: BudgetPolicy, violation: BudgetViolation
    ) -> None:
        """Send budget violation notification."""
        try:
            # Check cooldown
            cooldown_key = (
                f"{self.ALERT_KEY_PREFIX}cooldown:{policy.tenant_id}:{policy.name}"
            )
            last_notification = await self._redis.get(cooldown_key)
            if last_notification:
                return  # In cooldown period

            # Prepare notification message
            message = f"""
Budget Alert - {violation.violation_type.value.upper()}

Tenant: {policy.tenant_id}
Policy: {policy.name}
Budget Type: {violation.budget_type.value}
Current Usage: {violation.current_usage} / {violation.limit_amount}
Usage Percentage: {(float(violation.current_usage / violation.limit_amount) * 100):.1f}%

Request Details:
- Request ID: {violation.request_id}
- User ID: {violation.user_id}
- Provider: {violation.provider}
- Model: {violation.model}

Action Required: Review usage and adjust budget if needed.
            """.strip()

            # Send to configured channels
            for channel in policy.notification_channels:
                if channel == "email":
                    await self._send_email_notification(policy, message)
                elif channel == "webhook":
                    await self._send_webhook_notification(policy, violation)
                # Add more channels as needed

            # Set cooldown
            await self._redis.setex(cooldown_key, policy.notification_cooldown, "1")

            logger.info(f"Sent budget notification for tenant {policy.tenant_id}")

        except Exception as e:
            logger.error(f"Failed to send notification: {e}")

    async def _apply_throttling(
        self, policy: BudgetPolicy, violation: BudgetViolation
    ) -> None:
        """Apply throttling to tenant."""
        try:
            throttle_key = f"{self.THROTTLE_KEY_PREFIX}{policy.tenant_id}"

            # Set throttling with rate limiting
            if policy.throttle_rate_limit:
                # Implement token bucket or sliding window rate limiting
                await self._redis.setex(
                    throttle_key, 300, str(policy.throttle_rate_limit)
                )

            self._throttled_tenants[policy.tenant_id] = datetime.now() + timedelta(
                minutes=5
            )

            logger.warning(f"Applied throttling to tenant {policy.tenant_id}")

        except Exception as e:
            logger.error(f"Failed to apply throttling: {e}")

    async def _escalate_violation(
        self, policy: BudgetPolicy, violation: BudgetViolation
    ) -> None:
        """Escalate budget violation."""
        try:
            escalation_message = f"""
CRITICAL BUDGET VIOLATION - ESCALATION REQUIRED

Tenant: {policy.tenant_id}
Policy: {policy.name}
Violation Type: {violation.violation_type.value}
Budget Type: {violation.budget_type.value}
Overage Amount: {violation.overage_amount}

Immediate attention required from system administrators.
            """.strip()

            # Send escalation emails
            for email in policy.escalation_emails:
                await self._send_email_notification(policy, escalation_message, [email])

            # Send escalation webhooks
            for webhook in policy.escalation_webhooks:
                await self._send_webhook_notification(policy, violation, webhook)

            logger.critical(f"Escalated budget violation for tenant {policy.tenant_id}")

        except Exception as e:
            logger.error(f"Failed to escalate violation: {e}")

    async def _send_email_notification(
        self, policy: BudgetPolicy, message: str, recipients: Optional[List[str]] = None
    ) -> None:
        """Send email notification (placeholder implementation)."""
        # This would integrate with your email service
        logger.info(f"Email notification sent: {message[:100]}...")

    async def _send_webhook_notification(
        self,
        policy: BudgetPolicy,
        violation: BudgetViolation,
        webhook_url: Optional[str] = None,
    ) -> None:
        """Send webhook notification (placeholder implementation)."""
        # This would make HTTP request to webhook URL
        logger.info(f"Webhook notification sent for violation {violation.id}")

    async def _update_limit_usage(
        self, tenant_id: str, policy_name: str, limit: BudgetLimit
    ) -> None:
        """Update limit usage in storage."""
        try:
            # Update policy with new usage
            policy = await self.get_budget_policy(tenant_id, policy_name)
            if policy:
                # Find and update the specific limit
                for policy_limit in policy.limits:
                    if (
                        policy_limit.budget_type == limit.budget_type
                        and policy_limit.start_date == limit.start_date
                    ):
                        policy_limit.amount_used = limit.amount_used
                        policy_limit.tokens_used = limit.tokens_used
                        policy_limit.requests_used = limit.requests_used
                        break

                # Save updated policy
                await self.create_budget_policy(policy)

        except Exception as e:
            logger.error(f"Failed to update limit usage: {e}")

    async def _calculate_budget_metrics(
        self,
        tenant_id: str,
        period: str,
        start_date: datetime,
        end_date: datetime,
    ) -> BudgetMetrics:
        """Calculate budget metrics."""
        try:
            metrics = BudgetMetrics(
                tenant_id=tenant_id,
                period=period,
                start_time=start_date,
                end_time=end_date,
            )

            # Get tenant policies
            policies = await self._get_tenant_policies(tenant_id)

            total_budget = Decimal("0")
            total_spent = Decimal("0")

            for policy in policies:
                for limit in policy.limits:
                    if limit.enabled:
                        total_budget += limit.amount
                        total_spent += limit.amount_used

                        # Add to breakdown
                        budget_type = limit.budget_type.value
                        if budget_type not in metrics.budget_breakdown:
                            metrics.budget_breakdown[budget_type] = {
                                "budget": Decimal("0"),
                                "spent": Decimal("0"),
                                "remaining": Decimal("0"),
                                "utilization": 0.0,
                            }

                        metrics.budget_breakdown[budget_type]["budget"] += limit.amount
                        metrics.budget_breakdown[budget_type]["spent"] += (
                            limit.amount_used
                        )

            # Calculate totals and utilization
            metrics.total_budget = total_budget
            metrics.total_spent = total_spent
            metrics.total_remaining = total_budget - total_spent

            if total_budget > 0:
                metrics.utilization_rate = float(total_spent / total_budget) * 100.0

            # Update breakdown remaining and utilization
            for budget_type in metrics.budget_breakdown:
                breakdown = metrics.budget_breakdown[budget_type]
                breakdown["remaining"] = breakdown["budget"] - breakdown["spent"]
                if breakdown["budget"] > 0:
                    breakdown["utilization"] = (
                        float(breakdown["spent"] / breakdown["budget"]) * 100.0
                    )

            return metrics

        except Exception as e:
            logger.error(f"Failed to calculate budget metrics: {e}")
            return BudgetMetrics(
                tenant_id=tenant_id,
                period=period,
                start_time=start_date,
                end_time=end_date,
            )

    async def _policy_monitoring_loop(self) -> None:
        """Background loop for policy monitoring."""
        while True:
            try:
                await asyncio.sleep(self.policy_check_interval)

                # Check for expired budgets and reset if needed
                # Check for policy updates
                # Perform automated budget actions

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in policy monitoring loop: {e}")

    async def _cleanup_expired_data(self) -> None:
        """Background task to clean up expired data."""
        while True:
            try:
                await asyncio.sleep(3600)  # Run every hour

                # Clean up old violations
                # Clean up old throttling records
                # Clean up old alert records

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in cleanup loop: {e}")

    def _get_start_date(self, period: str, end_date: datetime) -> datetime:
        """Get start date for a given period."""
        if period == "hourly":
            return end_date - timedelta(hours=1)
        elif period == "daily":
            return end_date - timedelta(days=1)
        elif period == "weekly":
            return end_date - timedelta(weeks=1)
        elif period == "monthly":
            return end_date - timedelta(days=30)
        elif period == "quarterly":
            return end_date - timedelta(days=90)
        elif period == "yearly":
            return end_date - timedelta(days=365)
        else:
            return end_date - timedelta(days=30)

    async def __aenter__(self):
        """Async context manager entry."""
        await self.initialize()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        await self.cleanup()
