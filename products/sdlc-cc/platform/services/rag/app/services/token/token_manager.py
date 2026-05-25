"""
Enhanced Token Management Service.

This module provides comprehensive token tracking, management, and optimization
capabilities for multi-provider LLM operations with real-time accuracy and
multi-tenant support.
"""

import asyncio
import json
import logging
import time
from datetime import datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Dict, Optional, Union, Tuple, Set
from dataclasses import dataclass, field, asdict
from enum import Enum
from collections import deque
import uuid

import redis.asyncio as redis
from pydantic import BaseModel, Field

from ..llm.base_provider import TokenUsage

logger = logging.getLogger(__name__)


class TokenType(Enum):
    """Token types for different operations."""

    PROMPT = "prompt"
    COMPLETION = "completion"
    FUNCTION_CALL = "function_call"
    VISION = "vision"
    EMBEDDING = "embedding"
    TRANSCRIPTION = "transcription"
    TRANSLATION = "translation"


class ProviderType(Enum):
    """LLM provider types."""

    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    AZURE_OPENAI = "azure_openai"
    HUGGING_FACE = "hugging_face"
    COHERE = "cohere"
    GOOGLE = "google"
    MISTRAL = "mistrall"
    CUSTOM = "custom"


@dataclass
class TokenPricing:
    """Token pricing configuration."""

    provider: ProviderType
    model: str
    input_token_price: Decimal  # Price per 1K input tokens
    output_token_price: Decimal  # Price per 1K output tokens
    currency: str = "USD"
    effective_date: datetime = field(default_factory=datetime.now)
    tier_quantities: Optional[Dict[str, int]] = None  # Quantity tiers for pricing
    tier_prices: Optional[Dict[str, Tuple[Decimal, Decimal]]] = None
    context_window: Optional[int] = None
    max_output_tokens: Optional[int] = None

    def calculate_cost(
        self, input_tokens: int, output_tokens: int, apply_tiers: bool = False
    ) -> Decimal:
        """Calculate cost for given token usage."""
        if apply_tiers and self.tier_quantities and self.tier_prices:
            return self._calculate_tiered_cost(input_tokens, output_tokens)

        input_cost = (Decimal(input_tokens) / 1000) * self.input_token_price
        output_cost = (Decimal(output_tokens) / 1000) * self.output_token_price
        total_cost = input_cost + output_cost

        return total_cost.quantize(Decimal("0.000001"), rounding=ROUND_HALF_UP)

    def _calculate_tiered_cost(self, input_tokens: int, output_tokens: int) -> Decimal:
        """Calculate cost with tiered pricing."""
        total_cost = Decimal("0")
        remaining_input = input_tokens
        remaining_output = output_tokens

        for tier, quantity in sorted(
            self.tier_quantities.items(), key=lambda x: int(x[1])
        ):
            if remaining_input <= 0 and remaining_output <= 0:
                break

            input_price, output_price = self.tier_prices[tier]
            tier_input = min(remaining_input, quantity)
            tier_output = min(remaining_output, quantity)

            total_cost += (Decimal(tier_input) / 1000) * input_price
            total_cost += (Decimal(tier_output) / 1000) * output_price

            remaining_input -= tier_input
            remaining_output -= tier_output

        # Handle remaining tokens at base rate
        if remaining_input > 0 or remaining_output > 0:
            total_cost += self.calculate_cost(remaining_input, remaining_output, False)

        return total_cost.quantize(Decimal("0.000001"), rounding=ROUND_HALF_UP)


@dataclass
class TokenUsageRecord:
    """Detailed token usage record."""

    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: datetime = field(default_factory=datetime.now)
    tenant_id: Optional[str] = None
    user_id: Optional[str] = None
    request_id: Optional[str] = None
    session_id: Optional[str] = None

    # Provider and model info
    provider: ProviderType = ProviderType.OPENAI
    model: str = ""
    model_version: Optional[str] = None

    # Token counts
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    cached_tokens: int = 0
    function_call_tokens: int = 0
    vision_tokens: int = 0

    # Cost information
    input_cost: Decimal = field(default_factory=lambda: Decimal("0"))
    output_cost: Decimal = field(default_factory=lambda: Decimal("0"))
    total_cost: Decimal = field(default_factory=lambda: Decimal("0"))
    currency: str = "USD"

    # Operation details
    operation_type: str = "chat_completion"
    request_duration_ms: Optional[int] = None
    success: bool = True
    error_code: Optional[str] = None
    error_message: Optional[str] = None

    # Metadata
    metadata: Dict[str, Any] = field(default_factory=dict)
    tags: Set[str] = field(default_factory=set)
    region: Optional[str] = None

    def calculate_costs(self, pricing: TokenPricing) -> None:
        """Calculate costs based on pricing."""
        self.input_cost = pricing.calculate_cost(
            self.prompt_tokens + self.cached_tokens + self.function_call_tokens,
            0,
        )
        self.output_cost = pricing.calculate_cost(
            0, self.completion_tokens + self.vision_tokens
        )
        self.total_cost = self.input_cost + self.output_cost

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            **asdict(self),
            "tags": list(self.tags),
            "input_cost": str(self.input_cost),
            "output_cost": str(self.output_cost),
            "total_cost": str(self.total_cost),
            "timestamp": self.timestamp.isoformat(),
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "TokenUsageRecord":
        """Create from dictionary."""
        if "tags" in data and isinstance(data["tags"], list):
            data["tags"] = set(data["tags"])

        # Convert string costs back to Decimal
        for cost_field in ["input_cost", "output_cost", "total_cost"]:
            if cost_field in data and isinstance(data[cost_field], str):
                data[cost_field] = Decimal(data[cost_field])

        # Convert timestamp
        if isinstance(data.get("timestamp"), str):
            data["timestamp"] = datetime.fromisoformat(data["timestamp"])

        # Convert provider
        if isinstance(data.get("provider"), str):
            data["provider"] = ProviderType(data["provider"])

        return cls(**data)


@dataclass
class TokenQuota:
    """Token quota configuration."""

    tenant_id: str
    user_id: Optional[str] = None
    quota_type: str = "monthly"  # hourly, daily, weekly, monthly, yearly

    # Token limits
    prompt_token_limit: Optional[int] = None
    completion_token_limit: Optional[int] = None
    total_token_limit: Optional[int] = None
    cost_limit: Optional[Decimal] = None

    # Usage tracking
    prompt_tokens_used: int = 0
    completion_tokens_used: int = 0
    total_tokens_used: int = 0
    cost_used: Decimal = field(default_factory=lambda: Decimal("0"))

    # Time period
    start_date: datetime = field(default_factory=datetime.now)
    end_date: Optional[datetime] = None
    reset_interval: Optional[timedelta] = None

    # Settings
    enabled: bool = True
    warn_threshold: float = 0.8  # Warn at 80% usage
    hard_limit: bool = True  # Enforce hard limit vs. soft limit
    auto_renew: bool = False  # Auto-renew quota when expired

    def reset_usage(self) -> None:
        """Reset usage counters."""
        self.prompt_tokens_used = 0
        self.completion_tokens_used = 0
        self.total_tokens_used = 0
        self.cost_used = Decimal("0")
        self.start_date = datetime.now()

    def is_expired(self) -> bool:
        """Check if quota is expired."""
        if self.end_date:
            return datetime.now() > self.end_date
        return False

    def usage_percentage(self, metric: str = "total_tokens") -> float:
        """Get usage percentage for a specific metric."""
        limits = {
            "prompt_tokens": self.prompt_token_limit,
            "completion_tokens": self.completion_token_limit,
            "total_tokens": self.total_token_limit,
            "cost": float(self.cost_limit) if self.cost_limit else None,
        }

        used = {
            "prompt_tokens": self.prompt_tokens_used,
            "completion_tokens": self.completion_tokens_used,
            "total_tokens": self.total_tokens_used,
            "cost": float(self.cost_used),
        }

        limit = limits.get(metric)
        if limit is None or limit == 0:
            return 0.0

        return min(100.0, (used[metric] / limit) * 100.0)

    def can_consume(
        self,
        prompt_tokens: int = 0,
        completion_tokens: int = 0,
        cost: Decimal = Decimal("0"),
    ) -> Tuple[bool, str]:
        """Check if quota allows consumption."""
        if not self.enabled or self.is_expired():
            return True, "Quota disabled or expired"

        # Check each limit
        if self.prompt_token_limit:
            if self.prompt_tokens_used + prompt_tokens > self.prompt_token_limit:
                return False, "Prompt token limit exceeded"

        if self.completion_token_limit:
            if (
                self.completion_tokens_used + completion_tokens
                > self.completion_token_limit
            ):
                return False, "Completion token limit exceeded"

        if self.total_token_limit:
            total_tokens = prompt_tokens + completion_tokens
            if self.total_tokens_used + total_tokens > self.total_token_limit:
                return False, "Total token limit exceeded"

        if self.cost_limit:
            if self.cost_used + cost > self.cost_limit:
                return False, "Cost limit exceeded"

        return True, "Allowed"

    def consume(
        self,
        prompt_tokens: int = 0,
        completion_tokens: int = 0,
        cost: Decimal = Decimal("0"),
    ) -> bool:
        """Consume tokens from quota."""
        can_consume, reason = self.can_consume(prompt_tokens, completion_tokens, cost)
        if not can_consume:
            if self.hard_limit:
                return False
            # Log warning for soft limit
            logger.warning(f"Soft quota exceeded: {reason}")

        self.prompt_tokens_used += prompt_tokens
        self.completion_tokens_used += completion_tokens
        self.total_tokens_used += prompt_tokens + completion_tokens
        self.cost_used += cost

        return True


class TokenMetrics(BaseModel):
    """Token usage metrics."""

    total_tokens: int = 0
    prompt_tokens: int = 0
    completion_tokens: int = 0
    cached_tokens: int = 0
    function_call_tokens: int = 0
    vision_tokens: int = 0

    total_cost: Decimal = Field(default_factory=lambda: Decimal("0"))
    input_cost: Decimal = Field(default_factory=lambda: Decimal("0"))
    output_cost: Decimal = Field(default_factory=lambda: Decimal("0"))

    total_requests: int = 0
    successful_requests: int = 0
    failed_requests: int = 0
    avg_request_duration_ms: float = 0.0

    provider_breakdown: Dict[str, Dict[str, Union[int, Decimal]]] = Field(
        default_factory=dict
    )
    model_breakdown: Dict[str, Dict[str, Union[int, Decimal]]] = Field(
        default_factory=dict
    )
    operation_breakdown: Dict[str, Dict[str, Union[int, Decimal]]] = Field(
        default_factory=dict
    )

    period: str = "daily"
    start_time: datetime = Field(default_factory=datetime.now)
    end_time: datetime = Field(default_factory=datetime.now)

    class Config:
        arbitrary_types_allowed = True


class TokenManager:
    """Enhanced token management service."""

    def __init__(
        self,
        redis_url: str = "redis://localhost:6379/0",
        cache_ttl: int = 3600,
        batch_size: int = 100,
        flush_interval: int = 60,
        enable_persistence: bool = True,
        default_currency: str = "USD",
        cost_precision: int = 6,
    ):
        """Initialize token manager."""
        self.redis_url = redis_url
        self.cache_ttl = cache_ttl
        self.batch_size = batch_size
        self.flush_interval = flush_interval
        self.enable_persistence = enable_persistence
        self.default_currency = default_currency
        self.cost_precision = cost_precision

        self._redis: Optional[redis.Redis] = None
        self._initialized = False

        # In-memory caches
        self._pricing_cache: Dict[Tuple[str, str], TokenPricing] = {}
        self._quota_cache: Dict[str, TokenQuota] = {}
        self._pending_records: deque = deque()

        # Background tasks
        self._flush_task: Optional[asyncio.Task] = None
        self._cleanup_task: Optional[asyncio.Task] = None

        # Redis key prefixes
        self.RECORDS_KEY_PREFIX = "token:records:"
        self.QUOTA_KEY_PREFIX = "token:quota:"
        self.PRICING_KEY_PREFIX = "token:pricing:"
        self.METRICS_KEY_PREFIX = "token:metrics:"
        self.AGGREGATES_KEY_PREFIX = "token:aggregates:"

    async def initialize(self) -> None:
        """Initialize the token manager."""
        if self._initialized:
            return

        try:
            self._redis = redis.from_url(self.redis_url, decode_responses=False)

            # Test Redis connection
            await self._redis.ping()

            # Load default pricing configurations
            await self._load_default_pricing()

            # Start background tasks
            self._flush_task = asyncio.create_task(self._flush_pending_records())
            self._cleanup_task = asyncio.create_task(self._cleanup_expired_data())

            self._initialized = True
            logger.info("Token Manager initialized successfully")

        except Exception as e:
            logger.error(f"Failed to initialize Token Manager: {e}")
            raise

    async def cleanup(self) -> None:
        """Clean up token manager resources."""
        if not self._initialized:
            return

        try:
            # Stop background tasks
            if self._flush_task:
                self._flush_task.cancel()
                try:
                    await self._flush_task
                except asyncio.CancelledError:
                    pass

            if self._cleanup_task:
                self._cleanup_task.cancel()
                try:
                    await self._cleanup_task
                except asyncio.CancelledError:
                    pass

            # Flush any pending records
            if self._pending_records:
                await self._flush_records_batch()

            # Close Redis connection
            if self._redis:
                await self._redis.close()

            self._initialized = False
            logger.info("Token Manager cleaned up")

        except Exception as e:
            logger.error(f"Error during Token Manager cleanup: {e}")

    async def track_token_usage(
        self,
        provider: Union[str, ProviderType],
        model: str,
        usage: TokenUsage,
        tenant_id: Optional[str] = None,
        user_id: Optional[str] = None,
        request_id: Optional[str] = None,
        session_id: Optional[str] = None,
        operation_type: str = "chat_completion",
        request_duration_ms: Optional[int] = None,
        success: bool = True,
        error_code: Optional[str] = None,
        error_message: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        tags: Optional[Set[str]] = None,
        region: Optional[str] = None,
    ) -> TokenUsageRecord:
        """Track token usage for a request."""
        if not self._initialized:
            await self.initialize()

        # Convert provider to enum
        if isinstance(provider, str):
            provider = ProviderType(provider)

        # Get pricing information
        pricing = await self.get_pricing(provider, model)
        if not pricing:
            logger.warning(f"No pricing found for {provider.value}:{model}")
            # Create default pricing
            pricing = TokenPricing(
                provider=provider,
                model=model,
                input_token_price=Decimal("0.001"),
                output_token_price=Decimal("0.002"),
            )

        # Create usage record
        record = TokenUsageRecord(
            tenant_id=tenant_id,
            user_id=user_id,
            request_id=request_id,
            session_id=session_id,
            provider=provider,
            model=model,
            prompt_tokens=usage.prompt_tokens,
            completion_tokens=usage.completion_tokens,
            total_tokens=usage.total_tokens,
            request_duration_ms=request_duration_ms,
            success=success,
            error_code=error_code,
            error_message=error_message,
            operation_type=operation_type,
            metadata=metadata or {},
            tags=tags or set(),
            region=region,
        )

        # Calculate costs
        record.calculate_costs(pricing)

        # Check quota limits
        if tenant_id:
            await self._check_and_update_quota(record)

        # Add to pending records for batch processing
        self._pending_records.append(record)

        # Update real-time aggregates
        await self._update_real_time_aggregates(record)

        return record

    async def estimate_tokens(
        self,
        text: str,
        provider: Union[str, ProviderType] = ProviderType.OPENAI,
        model: str = "gpt-3.5-turbo",
    ) -> int:
        """Estimate token count for text."""
        if isinstance(provider, str):
            provider = ProviderType(provider)

        # Different tokenization methods based on provider
        if provider == ProviderType.OPENAI:
            return await self._estimate_openai_tokens(text, model)
        elif provider == ProviderType.ANTHROPIC:
            return await self._estimate_anthropic_tokens(text, model)
        else:
            # Default estimation: ~4 characters per token
            return len(text) // 4

    async def get_pricing(
        self, provider: Union[str, ProviderType], model: str
    ) -> Optional[TokenPricing]:
        """Get pricing information for provider/model."""
        if isinstance(provider, str):
            provider = ProviderType(provider)

        cache_key = (provider.value, model)
        if cache_key in self._pricing_cache:
            return self._pricing_cache[cache_key]

        # Try to load from Redis
        try:
            pricing_data = await self._redis.hgetall(
                f"{self.PRICING_KEY_PREFIX}{provider.value}:{model}"
            )
            if pricing_data:
                pricing = TokenPricing(
                    provider=provider,
                    model=model,
                    input_token_price=Decimal(
                        pricing_data.get(b"input_price", b"0").decode()
                    ),
                    output_token_price=Decimal(
                        pricing_data.get(b"output_price", b"0").decode()
                    ),
                    currency=pricing_data.get(b"currency", b"USD").decode(),
                    context_window=int(
                        pricing_data.get(b"context_window", b"4096").decode()
                    ),
                    max_output_tokens=int(
                        pricing_data.get(b"max_output", b"4096").decode()
                    ),
                )
                self._pricing_cache[cache_key] = pricing
                return pricing
        except Exception as e:
            logger.error(f"Failed to load pricing from Redis: {e}")

        return None

    async def set_pricing(self, pricing: TokenPricing) -> None:
        """Set pricing information."""
        try:
            # Store in Redis
            await self._redis.hset(
                f"{self.PRICING_KEY_PREFIX}{pricing.provider.value}:{pricing.model}",
                mapping={
                    "input_price": str(pricing.input_token_price),
                    "output_price": str(pricing.output_token_price),
                    "currency": pricing.currency,
                    "context_window": str(pricing.context_window or 0),
                    "max_output": str(pricing.max_output_tokens or 0),
                    "effective_date": pricing.effective_date.isoformat(),
                },
            )

            # Update cache
            self._pricing_cache[(pricing.provider.value, pricing.model)] = pricing

            logger.info(f"Set pricing for {pricing.provider.value}:{pricing.model}")

        except Exception as e:
            logger.error(f"Failed to set pricing: {e}")
            raise

    async def get_quota(
        self, tenant_id: str, quota_type: str = "monthly"
    ) -> Optional[TokenQuota]:
        """Get token quota for tenant."""
        cache_key = f"{tenant_id}:{quota_type}"
        if cache_key in self._quota_cache:
            return self._quota_cache[cache_key]

        # Try to load from Redis
        try:
            quota_data = await self._redis.hgetall(
                f"{self.QUOTA_KEY_PREFIX}{cache_key}"
            )
            if quota_data:
                quota = TokenQuota(
                    tenant_id=tenant_id,
                    quota_type=quota_type,
                    prompt_token_limit=int(
                        quota_data.get(b"prompt_limit", b"0").decode()
                    )
                    or None,
                    completion_token_limit=int(
                        quota_data.get(b"completion_limit", b"0").decode()
                    )
                    or None,
                    total_token_limit=int(quota_data.get(b"total_limit", b"0").decode())
                    or None,
                    cost_limit=Decimal(quota_data.get(b"cost_limit", b"0").decode())
                    or None,
                    prompt_tokens_used=int(
                        quota_data.get(b"prompt_used", b"0").decode()
                    ),
                    completion_tokens_used=int(
                        quota_data.get(b"completion_used", b"0").decode()
                    ),
                    total_tokens_used=int(quota_data.get(b"total_used", b"0").decode()),
                    cost_used=Decimal(quota_data.get(b"cost_used", b"0").decode()),
                    start_date=datetime.fromisoformat(
                        quota_data.get(
                            b"start_date", datetime.now().isoformat()
                        ).decode()
                    ),
                    end_date=datetime.fromisoformat(
                        quota_data.get(b"end_date", "").decode()
                    )
                    if quota_data.get(b"end_date")
                    else None,
                    enabled=quota_data.get(b"enabled", b"true").decode().lower()
                    == "true",
                    warn_threshold=float(
                        quota_data.get(b"warn_threshold", b"0.8").decode()
                    ),
                    hard_limit=quota_data.get(b"hard_limit", b"true").decode().lower()
                    == "true",
                    auto_renew=quota_data.get(b"auto_renew", b"false").decode().lower()
                    == "true",
                )
                self._quota_cache[cache_key] = quota
                return quota
        except Exception as e:
            logger.error(f"Failed to load quota from Redis: {e}")

        return None

    async def set_quota(self, quota: TokenQuota) -> None:
        """Set token quota for tenant."""
        try:
            cache_key = f"{quota.tenant_id}:{quota.quota_type}"

            # Store in Redis
            await self._redis.hset(
                f"{self.QUOTA_KEY_PREFIX}{cache_key}",
                mapping={
                    "prompt_limit": str(quota.prompt_token_limit or 0),
                    "completion_limit": str(quota.completion_token_limit or 0),
                    "total_limit": str(quota.total_token_limit or 0),
                    "cost_limit": str(quota.cost_limit or 0),
                    "prompt_used": str(quota.prompt_tokens_used),
                    "completion_used": str(quota.completion_tokens_used),
                    "total_used": str(quota.total_tokens_used),
                    "cost_used": str(quota.cost_used),
                    "start_date": quota.start_date.isoformat(),
                    "end_date": quota.end_date.isoformat() if quota.end_date else "",
                    "enabled": str(quota.enabled).lower(),
                    "warn_threshold": str(quota.warn_threshold),
                    "hard_limit": str(quota.hard_limit).lower(),
                    "auto_renew": str(quota.auto_renew).lower(),
                },
            )

            # Update cache
            self._quota_cache[cache_key] = quota

            logger.info(f"Set quota for tenant {quota.tenant_id} ({quota.quota_type})")

        except Exception as e:
            logger.error(f"Failed to set quota: {e}")
            raise

    async def get_metrics(
        self,
        tenant_id: Optional[str] = None,
        user_id: Optional[str] = None,
        period: str = "daily",
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> TokenMetrics:
        """Get token usage metrics."""
        if not self._initialized:
            await self.initialize()

        try:
            # Determine date range
            if not end_date:
                end_date = datetime.now()
            if not start_date:
                start_date = self._get_start_date(period, end_date)

            # Generate cache key
            cache_key = f"{self.METRICS_KEY_PREFIX}{tenant_id or 'global'}:{period}:{start_date.isoformat()}:{end_date.isoformat()}"

            # Try to get from cache
            cached_metrics = await self._redis.get(cache_key)
            if cached_metrics:
                return TokenMetrics.parse_raw(cached_metrics)

            # Calculate metrics from aggregates
            metrics = await self._calculate_metrics(
                tenant_id, user_id, period, start_date, end_date
            )

            # Cache the result
            await self._redis.setex(cache_key, self.cache_ttl, metrics.json())

            return metrics

        except Exception as e:
            logger.error(f"Failed to get metrics: {e}")
            return TokenMetrics()

    async def _estimate_openai_tokens(self, text: str, model: str) -> int:
        """Estimate tokens for OpenAI models."""
        # Simple character-based estimation
        # For more accurate results, integrate with tiktoken
        if model.startswith("gpt-4"):
            # GPT-4 models: ~3 characters per token
            return len(text) // 3
        else:
            # GPT-3.5 and others: ~4 characters per token
            return len(text) // 4

    async def _estimate_anthropic_tokens(self, text: str, model: str) -> int:
        """Estimate tokens for Anthropic models."""
        # Claude models: ~4 characters per token
        return len(text) // 4

    async def _load_default_pricing(self) -> None:
        """Load default pricing configurations."""
        default_pricing = [
            # OpenAI pricing
            TokenPricing(
                provider=ProviderType.OPENAI,
                model="gpt-4",
                input_token_price=Decimal("0.03"),
                output_token_price=Decimal("0.06"),
                context_window=8192,
                max_output_tokens=4096,
            ),
            TokenPricing(
                provider=ProviderType.OPENAI,
                model="gpt-4-turbo",
                input_token_price=Decimal("0.01"),
                output_token_price=Decimal("0.03"),
                context_window=128000,
                max_output_tokens=4096,
            ),
            TokenPricing(
                provider=ProviderType.OPENAI,
                model="gpt-3.5-turbo",
                input_token_price=Decimal("0.0015"),
                output_token_price=Decimal("0.002"),
                context_window=16384,
                max_output_tokens=4096,
            ),
            # Anthropic pricing
            TokenPricing(
                provider=ProviderType.ANTHROPIC,
                model="claude-3-opus-20240229",
                input_token_price=Decimal("0.015"),
                output_token_price=Decimal("0.075"),
                context_window=200000,
                max_output_tokens=4096,
            ),
            TokenPricing(
                provider=ProviderType.ANTHROPIC,
                model="claude-3-sonnet-20240229",
                input_token_price=Decimal("0.003"),
                output_token_price=Decimal("0.015"),
                context_window=200000,
                max_output_tokens=4096,
            ),
            TokenPricing(
                provider=ProviderType.ANTHROPIC,
                model="claude-3-haiku-20240307",
                input_token_price=Decimal("0.00025"),
                output_token_price=Decimal("0.00125"),
                context_window=200000,
                max_output_tokens=4096,
            ),
        ]

        for pricing in default_pricing:
            await self.set_pricing(pricing)

        logger.info(f"Loaded {len(default_pricing)} default pricing configurations")

    async def _check_and_update_quota(self, record: TokenUsageRecord) -> None:
        """Check quota limits and update usage."""
        if not record.tenant_id:
            return

        # Get quota for different periods
        quota_types = ["hourly", "daily", "monthly"]
        for quota_type in quota_types:
            quota = await self.get_quota(record.tenant_id, quota_type)
            if quota and quota.enabled:
                # Check if quota allows consumption
                can_consume = quota.consume(
                    prompt_tokens=record.prompt_tokens,
                    completion_tokens=record.completion_tokens,
                    cost=record.total_cost,
                )

                if not can_consume:
                    logger.warning(
                        f"Quota exceeded for tenant {record.tenant_id} ({quota_type})"
                    )
                    # Store quota exceeded event
                    await self._store_quota_exceeded_event(record, quota)

                # Update quota in storage
                await self.set_quota(quota)

    async def _store_quota_exceeded_event(
        self, record: TokenUsageRecord, quota: TokenQuota
    ) -> None:
        """Store quota exceeded event for alerting."""
        try:
            event_data = {
                "tenant_id": record.tenant_id,
                "quota_type": quota.quota_type,
                "request_id": record.request_id,
                "timestamp": record.timestamp.isoformat(),
                "usage_percentage": quota.usage_percentage(),
                "limits": {
                    "prompt_tokens": quota.prompt_token_limit,
                    "completion_tokens": quota.completion_token_limit,
                    "total_tokens": quota.total_token_limit,
                    "cost": str(quota.cost_limit),
                },
                "current_usage": {
                    "prompt_tokens": quota.prompt_tokens_used,
                    "completion_tokens": quota.completion_tokens_used,
                    "total_tokens": quota.total_tokens_used,
                    "cost": str(quota.cost_used),
                },
            }

            event_key = f"{self.RECORDS_KEY_PREFIX}quota_exceeded:{record.tenant_id}:{int(time.time())}"
            await self._redis.setex(event_key, 86400, json.dumps(event_data))

        except Exception as e:
            logger.error(f"Failed to store quota exceeded event: {e}")

    async def _update_real_time_aggregates(self, record: TokenUsageRecord) -> None:
        """Update real-time aggregated metrics."""
        try:
            # Update provider aggregates
            provider_key = f"{self.AGGREGATES_KEY_PREFIX}provider:{record.provider.value}:{record.timestamp.strftime('%Y-%m-%d:%H')}"
            await self._redis.hincrbyfloat(
                provider_key, "total_cost", float(record.total_cost)
            )
            await self._redis.hincrby(provider_key, "total_tokens", record.total_tokens)
            await self._redis.hincrby(provider_key, "total_requests", 1)
            await self._redis.hincrby(
                provider_key, "successful_requests", 1 if record.success else 0
            )
            await self._redis.expire(provider_key, 25 * 3600)  # 25 hours

            # Update model aggregates
            model_key = f"{self.AGGREGATES_KEY_PREFIX}model:{record.provider.value}:{record.model}:{record.timestamp.strftime('%Y-%m-%d:%H')}"
            await self._redis.hincrbyfloat(
                model_key, "total_cost", float(record.total_cost)
            )
            await self._redis.hincrby(model_key, "total_tokens", record.total_tokens)
            await self._redis.hincrby(model_key, "total_requests", 1)
            await self._redis.expire(model_key, 25 * 3600)

            # Update tenant aggregates
            if record.tenant_id:
                tenant_key = f"{self.AGGREGATES_KEY_PREFIX}tenant:{record.tenant_id}:{record.timestamp.strftime('%Y-%m-%d:%H')}"
                await self._redis.hincrbyfloat(
                    tenant_key, "total_cost", float(record.total_cost)
                )
                await self._redis.hincrby(
                    tenant_key, "total_tokens", record.total_tokens
                )
                await self._redis.hincrby(tenant_key, "total_requests", 1)
                await self._redis.expire(tenant_key, 25 * 3600)

        except Exception as e:
            logger.error(f"Failed to update real-time aggregates: {e}")

    async def _flush_pending_records(self) -> None:
        """Background task to flush pending records."""
        while True:
            try:
                await asyncio.sleep(self.flush_interval)

                if self._pending_records:
                    await self._flush_records_batch()

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in flush pending records loop: {e}")

    async def _flush_records_batch(self) -> None:
        """Flush a batch of pending records."""
        if not self._pending_records:
            return

        batch = []
        while self._pending_records and len(batch) < self.batch_size:
            batch.append(self._pending_records.popleft())

        if not batch:
            return

        try:
            # Store records in Redis
            pipe = self._redis.pipeline()
            for record in batch:
                record_key = f"{self.RECORDS_KEY_PREFIX}{record.timestamp.strftime('%Y-%m-%d:%H')}:{record.tenant_id or 'global'}"
                record_data = json.dumps(record.to_dict())
                pipe.lpush(record_key, record_data)
                pipe.expire(record_key, 90 * 24 * 3600)  # 90 days retention

            await pipe.execute()

            logger.debug(f"Flushed {len(batch)} token usage records")

        except Exception as e:
            logger.error(f"Failed to flush records batch: {e}")
            # Re-add failed records to pending queue
            for record in batch:
                self._pending_records.appendleft(record)

    async def _calculate_metrics(
        self,
        tenant_id: Optional[str],
        user_id: Optional[str],
        period: str,
        start_date: datetime,
        end_date: datetime,
    ) -> TokenMetrics:
        """Calculate metrics from stored data."""
        try:
            metrics = TokenMetrics(
                period=period, start_time=start_date, end_time=end_date
            )

            # Get aggregate keys for the period
            if period == "hourly":
                time_format = "%Y-%m-%d:%H"
            elif period == "daily":
                time_format = "%Y-%m-%d"
            elif period == "weekly" or period == "monthly":
                time_format = "%Y-%m-%d"
            else:
                time_format = "%Y-%m-%d"

            # Query aggregate data
            if tenant_id:
                pattern = f"{self.AGGREGATES_KEY_PREFIX}tenant:{tenant_id}:*"
            else:
                pattern = f"{self.AGGREGATES_KEY_PREFIX}provider:*"

            keys = await self._redis.keys(pattern)
            for key in keys:
                data = await self._redis.hgetall(key)
                if data:
                    # Parse key to extract time
                    key_parts = key.decode().split(":")
                    if len(key_parts) >= 3:
                        time_str = key_parts[-1]
                        try:
                            key_time = datetime.strptime(time_str, time_format)
                            if start_date <= key_time <= end_date:
                                # Add to metrics
                                metrics.total_cost += Decimal(
                                    data.get(b"total_cost", b"0").decode()
                                )
                                metrics.total_tokens += int(
                                    data.get(b"total_tokens", b"0").decode()
                                )
                                metrics.total_requests += int(
                                    data.get(b"total_requests", b"0").decode()
                                )
                                metrics.successful_requests += int(
                                    data.get(b"successful_requests", b"0").decode()
                                )
                        except ValueError:
                            continue

            return metrics

        except Exception as e:
            logger.error(f"Failed to calculate metrics: {e}")
            return TokenMetrics()

    async def _cleanup_expired_data(self) -> None:
        """Background task to clean up expired data."""
        while True:
            try:
                await asyncio.sleep(3600)  # Run every hour

                # Clean up expired quota records
                # Clean up old pricing records
                # Clean up old aggregate records

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
        else:
            return end_date - timedelta(days=1)

    async def __aenter__(self):
        """Async context manager entry."""
        await self.initialize()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        await self.cleanup()
