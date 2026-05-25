"""
LLM Cost Tracking Service.

This module provides real-time cost monitoring, budget management,
and cost analytics for LLM operations across multiple providers.
"""

import asyncio
import logging
import time
from datetime import datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Dict, List, Optional, Union
from dataclasses import dataclass, field
from enum import Enum
from collections import defaultdict, deque

import redis.asyncio as redis
from pydantic import BaseModel

from .base_provider import TokenUsage

logger = logging.getLogger(__name__)


class CostAlertType(Enum):
    """Cost alert types."""

    BUDGET_THRESHOLD = "budget_threshold"
    DAILY_LIMIT = "daily_limit"
    MONTHLY_LIMIT = "monthly_limit"
    UNUSUAL_SPENDING = "unusual_spending"
    COST_SPIKE = "cost_spike"


class TimePeriod(Enum):
    """Time periods for cost analysis."""

    HOURLY = "hourly"
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    YEARLY = "yearly"


@dataclass
class CostRecord:
    """Individual cost record."""

    timestamp: datetime
    tenant_id: Optional[str]
    provider: str
    model: str
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    cost: Decimal
    request_id: Optional[str] = None
    user_id: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class BudgetAlert:
    """Budget alert configuration."""

    tenant_id: Optional[str]
    alert_type: CostAlertType
    threshold: Union[float, Decimal]
    period: TimePeriod
    enabled: bool = True
    notification_channels: List[str] = field(default_factory=list)
    cooldown_minutes: int = 60
    last_triggered: Optional[datetime] = None


@dataclass
class TenantBudget:
    """Budget configuration for a tenant."""

    tenant_id: str
    daily_limit: Optional[Decimal] = None
    monthly_limit: Optional[Decimal] = None
    alerts: List[BudgetAlert] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)


class CostMetrics(BaseModel):
    """Cost metrics model."""

    total_cost: Decimal
    total_tokens: int
    total_requests: int
    avg_cost_per_request: Decimal
    avg_tokens_per_request: float
    providers: Dict[str, Decimal]
    models: Dict[str, Decimal]
    period: TimePeriod
    timestamp: datetime


class CostTracker:
    """Real-time cost tracking and budget management service."""

    def __init__(
        self,
        redis_url: str = "redis://localhost:6379/0",
        default_currency: str = "USD",
        cost_precision: int = 6,
        retention_days: int = 90,
        alert_check_interval: int = 300,  # 5 minutes
        cache_ttl: int = 3600,  # 1 hour
    ):
        """Initialize Cost Tracker."""
        self.redis_url = redis_url
        self.default_currency = default_currency
        self.cost_precision = cost_precision
        self.retention_days = retention_days
        self.alert_check_interval = alert_check_interval
        self.cache_ttl = cache_ttl

        self._redis: Optional[redis.Redis] = None
        self._alert_check_task: Optional[asyncio.Task] = None
        self._budgets: Dict[str, TenantBudget] = {}
        self._initialized = False

        # Keys for Redis storage
        self.COST_KEY_PREFIX = "llm:cost:"
        self.TOKENS_KEY_PREFIX = "llm:tokens:"
        self.BUDGET_KEY_PREFIX = "llm:budget:"
        self.ALERT_KEY_PREFIX = "llm:alert:"
        self.METRICS_KEY_PREFIX = "llm:metrics:"

    async def initialize(self) -> None:
        """Initialize the cost tracker."""
        if self._initialized:
            return

        try:
            self._redis = redis.from_url(self.redis_url, decode_responses=False)

            # Test Redis connection
            await self._redis.ping()

            # Start alert monitoring
            self._alert_check_task = asyncio.create_task(self._alert_monitoring_loop())

            self._initialized = True
            logger.info("Cost Tracker initialized successfully")

        except Exception as e:
            logger.error(f"Failed to initialize Cost Tracker: {e}")
            raise

    async def cleanup(self) -> None:
        """Clean up cost tracker resources."""
        if not self._initialized:
            return

        try:
            # Stop alert monitoring
            if self._alert_check_task:
                self._alert_check_task.cancel()
                try:
                    await self._alert_check_task
                except asyncio.CancelledError:
                    pass

            # Close Redis connection
            if self._redis:
                await self._redis.close()

            self._initialized = False
            logger.info("Cost Tracker cleaned up")

        except Exception as e:
            logger.error(f"Error during Cost Tracker cleanup: {e}")

    async def track_usage(
        self,
        provider: str,
        model: str,
        usage: TokenUsage,
        cost: Union[float, Decimal],
        tenant_id: Optional[str] = None,
        user_id: Optional[str] = None,
        request_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Track LLM usage and cost."""
        if not self._initialized:
            await self.initialize()

        try:
            # Convert cost to Decimal with proper precision
            cost_decimal = Decimal(str(cost)).quantize(
                Decimal(f"0.{'0' * self.cost_precision}"), rounding=ROUND_HALF_UP
            )

            # Create cost record
            record = CostRecord(
                timestamp=datetime.now(),
                tenant_id=tenant_id,
                provider=provider,
                model=model,
                prompt_tokens=usage.prompt_tokens,
                completion_tokens=usage.completion_tokens,
                total_tokens=usage.total_tokens,
                cost=cost_decimal,
                request_id=request_id,
                user_id=user_id,
                metadata=metadata or {},
            )

            # Store in Redis
            await self._store_cost_record(record)

            # Update aggregates
            await self._update_aggregates(record)

            # Check budget alerts
            await self._check_budget_alerts(record)

            logger.debug(
                f"Tracked usage: provider={provider}, model={model}, cost={cost_decimal}, tokens={usage.total_tokens}"
            )

        except Exception as e:
            logger.error(f"Failed to track usage: {e}")
            raise

    async def track_usage_estimate(
        self,
        provider: str,
        model: str,
        estimated_tokens: int,
        tenant_id: Optional[str] = None,
        user_id: Optional[str] = None,
        request_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Track estimated usage for streaming requests."""
        # Create estimated usage
        estimated_usage = TokenUsage(
            prompt_tokens=estimated_tokens // 2,  # Rough split
            completion_tokens=estimated_tokens // 2,
            total_tokens=estimated_tokens,
        )

        # Estimate cost (this would need to be implemented based on provider/model pricing)
        estimated_cost = await self._estimate_cost(provider, model, estimated_usage)

        await self.track_usage(
            provider=provider,
            model=model,
            usage=estimated_usage,
            cost=estimated_cost,
            tenant_id=tenant_id,
            user_id=user_id,
            request_id=request_id,
            metadata={**(metadata or {}), "estimated": True},
        )

    async def get_cost_metrics(
        self,
        tenant_id: Optional[str] = None,
        period: TimePeriod = TimePeriod.DAILY,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> CostMetrics:
        """Get cost metrics for a specific period and tenant."""
        if not self._initialized:
            await self.initialize()

        try:
            # Determine date range
            if not end_date:
                end_date = datetime.now()
            if not start_date:
                start_date = self._get_start_date(period, end_date)

            # Get metrics from cache or calculate
            cache_key = f"{self.METRICS_KEY_PREFIX}{tenant_id or 'global'}:{period.value}:{start_date.isoformat()}:{end_date.isoformat()}"

            cached_metrics = await self._redis.get(cache_key)
            if cached_metrics:
                return CostMetrics.parse_raw(cached_metrics)

            # Calculate metrics
            metrics = await self._calculate_metrics(
                tenant_id, period, start_date, end_date
            )

            # Cache the result
            await self._redis.setex(cache_key, self.cache_ttl, metrics.json())

            return metrics

        except Exception as e:
            logger.error(f"Failed to get cost metrics: {e}")
            raise

    async def get_tenant_budget(self, tenant_id: str) -> Optional[TenantBudget]:
        """Get budget configuration for a tenant."""
        if tenant_id in self._budgets:
            return self._budgets[tenant_id]

        # Try to load from Redis
        try:
            budget_data = await self._redis.hgetall(
                f"{self.BUDGET_KEY_PREFIX}{tenant_id}"
            )
            if budget_data:
                budget = TenantBudget(
                    tenant_id=tenant_id,
                    daily_limit=Decimal(budget_data.get(b"daily_limit", b"0").decode()),
                    monthly_limit=Decimal(
                        budget_data.get(b"monthly_limit", b"0").decode()
                    ),
                    created_at=datetime.fromisoformat(
                        budget_data.get(
                            b"created_at", datetime.now().isoformat()
                        ).decode()
                    ),
                    updated_at=datetime.fromisoformat(
                        budget_data.get(
                            b"updated_at", datetime.now().isoformat()
                        ).decode()
                    ),
                )
                self._budgets[tenant_id] = budget
                return budget
        except Exception as e:
            logger.error(f"Failed to load tenant budget: {e}")

        return None

    async def set_tenant_budget(self, budget: TenantBudget) -> None:
        """Set budget configuration for a tenant."""
        try:
            budget.updated_at = datetime.now()

            # Store in Redis
            await self._redis.hset(
                f"{self.BUDGET_KEY_PREFIX}{budget.tenant_id}",
                mapping={
                    "daily_limit": str(budget.daily_limit or 0),
                    "monthly_limit": str(budget.monthly_limit or 0),
                    "created_at": budget.created_at.isoformat(),
                    "updated_at": budget.updated_at.isoformat(),
                },
            )

            # Store in memory
            self._budgets[budget.tenant_id] = budget

            logger.info(f"Set budget for tenant {budget.tenant_id}")

        except Exception as e:
            logger.error(f"Failed to set tenant budget: {e}")
            raise

    async def check_budget_status(self, tenant_id: str) -> Dict[str, Any]:
        """Check current budget status for a tenant."""
        budget = await self.get_tenant_budget(tenant_id)
        if not budget:
            return {"has_budget": False}

        # Get current costs
        now = datetime.now()
        daily_metrics = await self.get_cost_metrics(tenant_id, TimePeriod.DAILY)
        monthly_metrics = await self.get_cost_metrics(tenant_id, TimePeriod.MONTHLY)

        status = {
            "has_budget": True,
            "daily_limit": float(budget.daily_limit or 0),
            "monthly_limit": float(budget.monthly_limit or 0),
            "daily_spent": float(daily_metrics.total_cost),
            "monthly_spent": float(monthly_metrics.total_cost),
            "daily_remaining": float(
                (budget.daily_limit or 0) - daily_metrics.total_cost
            ),
            "monthly_remaining": float(
                (budget.monthly_limit or 0) - monthly_metrics.total_cost
            ),
            "daily_percentage": (
                float(daily_metrics.total_cost / (budget.daily_limit or 1)) * 100
                if budget.daily_limit
                else 0
            ),
            "monthly_percentage": (
                float(monthly_metrics.total_cost / (budget.monthly_limit or 1)) * 100
                if budget.monthly_limit
                else 0
            ),
        }

        return status

    async def _store_cost_record(self, record: CostRecord) -> None:
        """Store a cost record in Redis."""
        try:
            # Store detailed record
            record_key = f"{self.COST_KEY_PREFIX}{record.timestamp.strftime('%Y-%m-%d:%H')}:{record.tenant_id or 'global'}"
            record_data = {
                "timestamp": record.timestamp.isoformat(),
                "tenant_id": record.tenant_id,
                "provider": record.provider,
                "model": record.model,
                "prompt_tokens": record.prompt_tokens,
                "completion_tokens": record.completion_tokens,
                "total_tokens": record.total_tokens,
                "cost": str(record.cost),
                "request_id": record.request_id,
                "user_id": record.user_id,
                "metadata": str(record.metadata),
            }

            # Use Redis list for time-series data
            await self._redis.lpush(record_key, str(record_data))

            # Set expiration for retention
            await self._redis.expire(record_key, self.retention_days * 24 * 3600)

        except Exception as e:
            logger.error(f"Failed to store cost record: {e}")
            raise

    async def _update_aggregates(self, record: CostRecord) -> None:
        """Update aggregated cost metrics."""
        try:
            # Update hourly aggregates
            hour_key = f"{self.COST_KEY_PREFIX}hour:{record.timestamp.strftime('%Y-%m-%d:%H')}:{record.tenant_id or 'global'}"
            await self._redis.hincrbyfloat(hour_key, "total_cost", float(record.cost))
            await self._redis.hincrby(hour_key, "total_tokens", record.total_tokens)
            await self._redis.hincrby(hour_key, "total_requests", 1)
            await self._redis.hincrbyfloat(
                hour_key, f"provider:{record.provider}", float(record.cost)
            )
            await self._redis.hincrbyfloat(
                hour_key, f"model:{record.model}", float(record.cost)
            )
            await self._redis.expire(hour_key, 25 * 3600)  # 25 hours

            # Update daily aggregates
            day_key = f"{self.COST_KEY_PREFIX}day:{record.timestamp.strftime('%Y-%m-%d')}:{record.tenant_id or 'global'}"
            await self._redis.hincrbyfloat(day_key, "total_cost", float(record.cost))
            await self._redis.hincrby(day_key, "total_tokens", record.total_tokens)
            await self._redis.hincrby(day_key, "total_requests", 1)
            await self._redis.hincrbyfloat(
                day_key, f"provider:{record.provider}", float(record.cost)
            )
            await self._redis.hincrbyfloat(
                day_key, f"model:{record.model}", float(record.cost)
            )
            await self._redis.expire(day_key, self.retention_days * 24 * 3600)

            # Update monthly aggregates
            month_key = f"{self.COST_KEY_PREFIX}month:{record.timestamp.strftime('%Y-%m')}:{record.tenant_id or 'global'}"
            await self._redis.hincrbyfloat(month_key, "total_cost", float(record.cost))
            await self._redis.hincrby(month_key, "total_tokens", record.total_tokens)
            await self._redis.hincrby(month_key, "total_requests", 1)
            await self._redis.hincrbyfloat(
                month_key, f"provider:{record.provider}", float(record.cost)
            )
            await self._redis.hincrbyfloat(
                month_key, f"model:{record.model}", float(record.cost)
            )
            await self._redis.expire(month_key, 365 * 24 * 3600)  # 1 year

        except Exception as e:
            logger.error(f"Failed to update aggregates: {e}")

    async def _calculate_metrics(
        self,
        tenant_id: Optional[str],
        period: TimePeriod,
        start_date: datetime,
        end_date: datetime,
    ) -> CostMetrics:
        """Calculate cost metrics for the given parameters."""
        try:
            # Get the appropriate aggregate key
            if period == TimePeriod.HOURLY:
                keys_pattern = f"{self.COST_KEY_PREFIX}hour:*:{tenant_id or 'global'}"
            elif period == TimePeriod.DAILY:
                keys_pattern = f"{self.COST_KEY_PREFIX}day:*:{tenant_id or 'global'}"
            elif period == TimePeriod.MONTHLY:
                keys_pattern = f"{self.COST_KEY_PREFIX}month:*:{tenant_id or 'global'}"
            else:
                # For weekly/yearly, we'll aggregate from daily data
                keys_pattern = f"{self.COST_KEY_PREFIX}day:*:{tenant_id or 'global'}"

            # Get all matching keys
            keys = await self._redis.keys(keys_pattern)

            total_cost = Decimal("0")
            total_tokens = 0
            total_requests = 0
            providers = defaultdict(Decimal)
            models = defaultdict(Decimal)

            for key in keys:
                data = await self._redis.hgetall(key)
                if data:
                    total_cost += Decimal(data.get(b"total_cost", b"0").decode())
                    total_tokens += int(data.get(b"total_tokens", b"0").decode())
                    total_requests += int(data.get(b"total_requests", b"0").decode())

                    # Aggregate by provider and model
                    for field, value in data.items():
                        field_str = field.decode()
                        if field_str.startswith("provider:"):
                            provider_name = field_str[9:]  # Remove "provider:" prefix
                            providers[provider_name] += Decimal(value.decode())
                        elif field_str.startswith("model:"):
                            model_name = field_str[6:]  # Remove "model:" prefix
                            models[model_name] += Decimal(value.decode())

            # Calculate averages
            avg_cost_per_request = (
                total_cost / total_requests if total_requests > 0 else Decimal("0")
            )
            avg_tokens_per_request = (
                total_tokens / total_requests if total_requests > 0 else 0
            )

            return CostMetrics(
                total_cost=total_cost,
                total_tokens=total_tokens,
                total_requests=total_requests,
                avg_cost_per_request=avg_cost_per_request,
                avg_tokens_per_request=avg_tokens_per_request,
                providers=dict(providers),
                models=dict(models),
                period=period,
                timestamp=datetime.now(),
            )

        except Exception as e:
            logger.error(f"Failed to calculate metrics: {e}")
            raise

    async def _estimate_cost(
        self, provider: str, model: str, usage: TokenUsage
    ) -> Decimal:
        """Estimate cost for a given usage."""
        # This would ideally use a pricing database or configuration
        # For now, we'll use some basic estimates

        pricing = {
            "openai": {
                "gpt-4": {"input": 0.03, "output": 0.06},
                "gpt-3.5-turbo": {"input": 0.0015, "output": 0.002},
            },
            "anthropic": {
                "claude-3-opus": {"input": 0.015, "output": 0.075},
                "claude-3-sonnet": {"input": 0.003, "output": 0.015},
            },
        }

        try:
            provider_pricing = pricing.get(provider, {})
            model_pricing = provider_pricing.get(
                model, {"input": 0.001, "output": 0.002}
            )

            input_cost = (usage.prompt_tokens / 1000) * model_pricing["input"]
            output_cost = (usage.completion_tokens / 1000) * model_pricing["output"]

            return Decimal(str(input_cost + output_cost)).quantize(
                Decimal(f"0.{'0' * self.cost_precision}"), rounding=ROUND_HALF_UP
            )

        except Exception:
            # Fallback to default pricing
            return Decimal(str((usage.total_tokens / 1000) * 0.002)).quantize(
                Decimal(f"0.{'0' * self.cost_precision}"), rounding=ROUND_HALF_UP
            )

    async def _check_budget_alerts(self, record: CostRecord) -> None:
        """Check if any budget alerts should be triggered."""
        if not record.tenant_id:
            return

        budget = await self.get_tenant_budget(record.tenant_id)
        if not budget:
            return

        # Check daily and monthly limits
        current_time = datetime.now()

        # Daily limit check
        if budget.daily_limit:
            daily_start = current_time.replace(
                hour=0, minute=0, second=0, microsecond=0
            )
            daily_metrics = await self.get_cost_metrics(
                record.tenant_id, TimePeriod.DAILY, daily_start, current_time
            )

            if daily_metrics.total_cost >= budget.daily_limit:
                await self._trigger_alert(
                    record.tenant_id,
                    CostAlertType.DAILY_LIMIT,
                    f"Daily budget limit of ${budget.daily_limit} exceeded. Current spend: ${daily_metrics.total_cost}",
                )

        # Monthly limit check
        if budget.monthly_limit:
            monthly_start = current_time.replace(
                day=1, hour=0, minute=0, second=0, microsecond=0
            )
            monthly_metrics = await self.get_cost_metrics(
                record.tenant_id, TimePeriod.MONTHLY, monthly_start, current_time
            )

            if monthly_metrics.total_cost >= budget.monthly_limit:
                await self._trigger_alert(
                    record.tenant_id,
                    CostAlertType.MONTHLY_LIMIT,
                    f"Monthly budget limit of ${budget.monthly_limit} exceeded. Current spend: ${monthly_metrics.total_cost}",
                )

    async def _trigger_alert(
        self, tenant_id: str, alert_type: CostAlertType, message: str
    ) -> None:
        """Trigger a budget alert."""
        try:
            alert_key = f"{self.ALERT_KEY_PREFIX}{tenant_id}:{alert_type.value}"

            # Check if we're in cooldown period
            last_triggered = await self._redis.get(f"{alert_key}:last_triggered")
            if last_triggered:
                last_time = datetime.fromisoformat(last_triggered.decode())
                if datetime.now() - last_time < timedelta(
                    minutes=60
                ):  # 1 hour cooldown
                    return

            # Store alert
            alert_data = {
                "tenant_id": tenant_id,
                "alert_type": alert_type.value,
                "message": message,
                "timestamp": datetime.now().isoformat(),
            }

            await self._redis.lpush(f"{alert_key}:history", str(alert_data))
            await self._redis.set(
                f"{alert_key}:last_triggered", datetime.now().isoformat()
            )

            # Log alert
            logger.warning(f"Budget alert triggered for tenant {tenant_id}: {message}")

            # Here you could also send notifications via email, Slack, etc.

        except Exception as e:
            logger.error(f"Failed to trigger alert: {e}")

    async def _alert_monitoring_loop(self) -> None:
        """Background loop for monitoring alerts."""
        while True:
            try:
                await asyncio.sleep(self.alert_check_interval)
                # Additional monitoring logic could go here
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Alert monitoring loop error: {e}")

    def _get_start_date(self, period: TimePeriod, end_date: datetime) -> datetime:
        """Get start date for a given period."""
        if period == TimePeriod.HOURLY:
            return end_date - timedelta(hours=1)
        elif period == TimePeriod.DAILY:
            return end_date - timedelta(days=1)
        elif period == TimePeriod.WEEKLY:
            return end_date - timedelta(weeks=1)
        elif period == TimePeriod.MONTHLY:
            return end_date - timedelta(days=30)
        elif period == TimePeriod.YEARLY:
            return end_date - timedelta(days=365)
        else:
            return end_date - timedelta(days=1)

    async def __aenter__(self):
        """Async context manager entry."""
        await self.initialize()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        await self.cleanup()
