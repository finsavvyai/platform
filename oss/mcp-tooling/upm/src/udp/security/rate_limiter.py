"""
Advanced Rate Limiting System for Universal Dependency Platform.

Implements sophisticated rate limiting with Redis backend, supporting
multiple strategies (sliding window, token bucket, fixed window),
hierarchical limits, and distributed synchronization.
"""

import asyncio
import hashlib
import logging
import time
from dataclasses import dataclass
from enum import Enum
from typing import Any, Optional

import redis.asyncio as redis
from redis.asyncio import Redis

from ..core.config import settings

logger = logging.getLogger(__name__)


class RateLimitStrategy(str, Enum):
    """Rate limiting strategies."""

    SLIDING_WINDOW = "sliding_window"
    TOKEN_BUCKET = "token_bucket"
    FIXED_WINDOW = "fixed_window"
    LEAKY_BUCKET = "leaky_bucket"


class RateLimitScope(str, Enum):
    """Rate limiting scopes."""

    GLOBAL = "global"
    USER = "user"
    IP = "ip"
    ORGANIZATION = "organization"
    API_KEY = "api_key"
    ENDPOINT = "endpoint"
    USER_ENDPOINT = "user_endpoint"
    IP_ENDPOINT = "ip_endpoint"


@dataclass
class RateLimitRule:
    """
    Rate limiting rule definition.
    """

    name: str
    requests: int
    window_seconds: int
    strategy: RateLimitStrategy = RateLimitStrategy.SLIDING_WINDOW
    scope: RateLimitScope = RateLimitScope.USER
    burst_limit: Optional[int] = None
    penalty_seconds: int = 60
    priority: int = 100
    tags: list[str] = None

    def __post_init__(self):
        if self.tags is None:
            self.tags = []
        if self.burst_limit is None:
            self.burst_limit = int(self.requests * 1.5)


@dataclass
class RateLimitResult:
    """
    Result of a rate limit check.
    """

    allowed: bool
    remaining: int
    reset_time: int
    retry_after: Optional[int]
    limit: int
    window: int
    strategy: RateLimitStrategy
    scope: str
    key: str


class RateLimiter:
    """
    Advanced rate limiter with Redis backend.
    """

    def __init__(self, redis_client: Optional[Redis] = None):
        self.settings = settings
        self.redis = redis_client or self._create_redis_client()
        self.rules: dict[str, RateLimitRule] = {}
        self._lock = asyncio.Lock()

    def _create_redis_client(self) -> Redis:
        """Create Redis client with proper configuration."""
        try:
            return redis.from_url(
                self.settings.REDIS_URL,
                encoding="utf-8",
                decode_responses=True,
                socket_connect_timeout=5,
                socket_timeout=5,
                retry_on_timeout=True,
                max_connections=100,
            )
        except Exception as e:
            logger.error(f"Failed to create Redis client: {e}")
            # In production, this should raise an exception
            # For now, we'll use a mock client for development
            return None

    async def add_rule(self, rule: RateLimitRule) -> None:
        """Add a rate limiting rule."""
        async with self._lock:
            self.rules[rule.name] = rule
            logger.info(f"Added rate limit rule: {rule.name}")

    async def remove_rule(self, rule_name: str) -> None:
        """Remove a rate limiting rule."""
        async with self._lock:
            if rule_name in self.rules:
                del self.rules[rule_name]
                logger.info(f"Removed rate limit rule: {rule_name}")

    async def get_rules(self) -> dict[str, RateLimitRule]:
        """Get all rate limiting rules."""
        return self.rules.copy()

    def _generate_key(
        self,
        strategy: RateLimitStrategy,
        scope: RateLimitScope,
        user_id: Optional[str] = None,
        ip_address: Optional[str] = None,
        organization_id: Optional[str] = None,
        api_key: Optional[str] = None,
        endpoint: Optional[str] = None,
        **kwargs,
    ) -> str:
        """Generate Redis key for rate limiting."""
        key_parts = ["rate_limit", strategy.value, scope.value]

        if scope == RateLimitScope.USER and user_id:
            key_parts.append(f"user:{user_id}")
        elif scope == RateLimitScope.IP and ip_address:
            key_parts.append(f"ip:{hashlib.md5(ip_address.encode()).hexdigest()}")
        elif scope == RateLimitScope.ORGANIZATION and organization_id:
            key_parts.append(f"org:{organization_id}")
        elif scope == RateLimitScope.API_KEY and api_key:
            key_parts.append(f"key:{hashlib.md5(api_key.encode()).hexdigest()}")
        elif scope == RateLimitScope.ENDPOINT and endpoint:
            key_parts.append(f"ep:{hashlib.md5(endpoint.encode()).hexdigest()}")
        elif scope == RateLimitScope.USER_ENDPOINT and user_id and endpoint:
            user_hash = hashlib.md5(user_id.encode()).hexdigest()
            ep_hash = hashlib.md5(endpoint.encode()).hexdigest()
            key_parts.append(f"user_ep:{user_hash}:{ep_hash}")
        elif scope == RateLimitScope.IP_ENDPOINT and ip_address and endpoint:
            ip_hash = hashlib.md5(ip_address.encode()).hexdigest()
            ep_hash = hashlib.md5(endpoint.encode()).hexdigest()
            key_parts.append(f"ip_ep:{ip_hash}:{ep_hash}")

        return ":".join(key_parts)

    async def check_rate_limit(
        self,
        rule_name: str,
        user_id: Optional[str] = None,
        ip_address: Optional[str] = None,
        organization_id: Optional[str] = None,
        api_key: Optional[str] = None,
        endpoint: Optional[str] = None,
        **kwargs,
    ) -> RateLimitResult:
        """
        Check if request is allowed under rate limit rules.
        """
        if rule_name not in self.rules:
            logger.warning(f"Rate limit rule not found: {rule_name}")
            return RateLimitResult(
                allowed=True,
                remaining=-1,
                reset_time=0,
                retry_after=None,
                limit=0,
                window=0,
                strategy=RateLimitStrategy.SLIDING_WINDOW,
                scope="unknown",
                key="unknown",
            )

        rule = self.rules[rule_name]
        key = self._generate_key(
            rule.strategy,
            rule.scope,
            user_id,
            ip_address,
            organization_id,
            api_key,
            endpoint,
            **kwargs,
        )

        if not self.redis:
            # Fallback when Redis is not available
            logger.warning("Redis not available, allowing request")
            return RateLimitResult(
                allowed=True,
                remaining=rule.requests,
                reset_time=int(time.time() + rule.window_seconds),
                retry_after=None,
                limit=rule.requests,
                window=rule.window_seconds,
                strategy=rule.strategy,
                scope=rule.scope.value,
                key=key,
            )

        try:
            if rule.strategy == RateLimitStrategy.SLIDING_WINDOW:
                return await self._check_sliding_window(rule, key)
            elif rule.strategy == RateLimitStrategy.TOKEN_BUCKET:
                return await self._check_token_bucket(rule, key)
            elif rule.strategy == RateLimitStrategy.FIXED_WINDOW:
                return await self._check_fixed_window(rule, key)
            elif rule.strategy == RateLimitStrategy.LEAKY_BUCKET:
                return await self._check_leaky_bucket(rule, key)
            else:
                logger.error(f"Unknown rate limit strategy: {rule.strategy}")
                return self._create_allowed_result(rule, key)

        except Exception as e:
            logger.error(f"Error checking rate limit: {e}")
            # Fail open for better availability
            return self._create_allowed_result(rule, key)

    async def _check_sliding_window(
        self, rule: RateLimitRule, key: str
    ) -> RateLimitResult:
        """Check sliding window rate limit."""
        now = time.time()
        window_start = now - rule.window_seconds

        # Remove old entries
        await self.redis.zremrangebyscore(key, 0, window_start)

        # Count current requests
        current_requests = await self.redis.zcard(key)

        if current_requests >= rule.requests:
            # Rate limit exceeded
            oldest_request = await self.redis.zrange(key, 0, 0, withscores=True)
            reset_time = (
                int(oldest_request[0][1] + rule.window_seconds)
                if oldest_request
                else int(now + rule.window_seconds)
            )

            return RateLimitResult(
                allowed=False,
                remaining=0,
                reset_time=reset_time,
                retry_after=rule.penalty_seconds,
                limit=rule.requests,
                window=rule.window_seconds,
                strategy=rule.strategy,
                scope=rule.scope.value,
                key=key,
            )

        # Add current request
        await self.redis.zadd(key, {str(now): now})
        await self.redis.expire(key, rule.window_seconds)

        return RateLimitResult(
            allowed=True,
            remaining=rule.requests - current_requests - 1,
            reset_time=int(now + rule.window_seconds),
            retry_after=None,
            limit=rule.requests,
            window=rule.window_seconds,
            strategy=rule.strategy,
            scope=rule.scope.value,
            key=key,
        )

    async def _check_token_bucket(
        self, rule: RateLimitRule, key: str
    ) -> RateLimitResult:
        """Check token bucket rate limit."""
        now = time.time()

        # Get current bucket state
        bucket_data = await self.redis.hgetall(key)

        if not bucket_data:
            # Initialize bucket
            tokens = rule.requests
            last_refill = now
        else:
            tokens = float(bucket_data.get("tokens", rule.requests))
            last_refill = float(bucket_data.get("last_refill", now))

            # Refill tokens based on time passed
            time_passed = now - last_refill
            tokens_to_add = (time_passed / rule.window_seconds) * rule.requests
            tokens = min(rule.burst_limit, tokens + tokens_to_add)

        if tokens < 1:
            # Rate limit exceeded
            retry_after = int((1 - tokens) * rule.window_seconds / rule.requests)

            return RateLimitResult(
                allowed=False,
                remaining=0,
                reset_time=int(now + retry_after),
                retry_after=max(1, retry_after),
                limit=rule.requests,
                window=rule.window_seconds,
                strategy=rule.strategy,
                scope=rule.scope.value,
                key=key,
            )

        # Consume one token
        tokens -= 1

        # Update bucket state
        await self.redis.hset(key, {"tokens": str(tokens), "last_refill": str(now)})
        await self.redis.expire(key, rule.window_seconds * 2)

        return RateLimitResult(
            allowed=True,
            remaining=int(tokens),
            reset_time=int(now + rule.window_seconds),
            retry_after=None,
            limit=rule.requests,
            window=rule.window_seconds,
            strategy=rule.strategy,
            scope=rule.scope.value,
            key=key,
        )

    async def _check_fixed_window(
        self, rule: RateLimitRule, key: str
    ) -> RateLimitResult:
        """Check fixed window rate limit."""
        now = time.time()
        window_start = int(now // rule.window_seconds) * rule.window_seconds

        # Use a key that includes the window
        window_key = f"{key}:{window_start}"

        current_requests = await self.redis.incr(window_key)

        if current_requests == 1:
            # First request in this window
            await self.redis.expire(window_key, rule.window_seconds + 1)

        if current_requests > rule.requests:
            # Rate limit exceeded
            reset_time = int(window_start + rule.window_seconds)

            return RateLimitResult(
                allowed=False,
                remaining=0,
                reset_time=reset_time,
                retry_after=rule.penalty_seconds,
                limit=rule.requests,
                window=rule.window_seconds,
                strategy=rule.strategy,
                scope=rule.scope.value,
                key=key,
            )

        return RateLimitResult(
            allowed=True,
            remaining=rule.requests - current_requests,
            reset_time=int(window_start + rule.window_seconds),
            retry_after=None,
            limit=rule.requests,
            window=rule.window_seconds,
            strategy=rule.strategy,
            scope=rule.scope.value,
            key=key,
        )

    async def _check_leaky_bucket(
        self, rule: RateLimitRule, key: str
    ) -> RateLimitResult:
        """Check leaky bucket rate limit."""
        now = time.time()

        # Get current bucket state
        bucket_data = await self.redis.hgetall(key)

        if not bucket_data:
            # Initialize bucket
            bucket_size = 0
            last_leak = now
        else:
            bucket_size = float(bucket_data.get("bucket_size", 0))
            last_leak = float(bucket_data.get("last_leak", now))

            # Leak based on time passed
            time_passed = now - last_leak
            leak_rate = rule.requests / rule.window_seconds
            amount_to_leak = time_passed * leak_rate
            bucket_size = max(0, bucket_size - amount_to_leak)

        if bucket_size >= rule.burst_limit:
            # Rate limit exceeded
            retry_after = int(
                (bucket_size - rule.burst_limit + 1)
                * rule.window_seconds
                / rule.requests
            )

            return RateLimitResult(
                allowed=False,
                remaining=0,
                reset_time=int(now + retry_after),
                retry_after=max(1, retry_after),
                limit=rule.requests,
                window=rule.window_seconds,
                strategy=rule.strategy,
                scope=rule.scope.value,
                key=key,
            )

        # Add current request to bucket
        bucket_size += 1

        # Update bucket state
        await self.redis.hset(
            key, {"bucket_size": str(bucket_size), "last_leak": str(now)}
        )
        await self.redis.expire(key, rule.window_seconds * 2)

        return RateLimitResult(
            allowed=True,
            remaining=max(0, int(rule.burst_limit - bucket_size)),
            reset_time=int(now + rule.window_seconds),
            retry_after=None,
            limit=rule.requests,
            window=rule.window_seconds,
            strategy=rule.strategy,
            scope=rule.scope.value,
            key=key,
        )

    def _create_allowed_result(self, rule: RateLimitRule, key: str) -> RateLimitResult:
        """Create a default allowed result for fallback cases."""
        now = time.time()
        return RateLimitResult(
            allowed=True,
            remaining=rule.requests,
            reset_time=int(now + rule.window_seconds),
            retry_after=None,
            limit=rule.requests,
            window=rule.window_seconds,
            strategy=rule.strategy,
            scope=rule.scope.value,
            key=key,
        )

    async def reset_limits(
        self,
        rule_name: Optional[str] = None,
        user_id: Optional[str] = None,
        ip_address: Optional[str] = None,
        **kwargs,
    ) -> int:
        """
        Reset rate limits for given criteria.
        Returns number of keys reset.
        """
        if not self.redis:
            return 0

        pattern = "rate_limit:*"
        keys_to_reset = []

        # Get all keys matching pattern
        cursor = 0
        while True:
            cursor, keys = await self.redis.scan(cursor, match=pattern, count=100)
            keys_to_reset.extend(keys)
            if cursor == 0:
                break

        # Apply filters
        if rule_name or user_id or ip_address:
            filtered_keys = []
            for key in keys_to_reset:
                key_parts = key.split(":")
                if rule_name and len(key_parts) > 1 and key_parts[1] != rule_name:
                    continue
                if (
                    user_id
                    and f"user:{hashlib.md5(user_id.encode()).hexdigest()}" not in key
                ):
                    continue
                if (
                    ip_address
                    and f"ip:{hashlib.md5(ip_address.encode()).hexdigest()}" not in key
                ):
                    continue
                filtered_keys.append(key)
            keys_to_reset = filtered_keys

        # Delete keys
        if keys_to_reset:
            return await self.redis.delete(*keys_to_reset)

        return 0

    async def get_stats(self) -> dict[str, Any]:
        """Get rate limiting statistics."""
        stats = {
            "total_rules": len(self.rules),
            "rules": {},
            "redis_connected": bool(self.redis),
        }

        for name, rule in self.rules.items():
            stats["rules"][name] = {
                "requests": rule.requests,
                "window_seconds": rule.window_seconds,
                "strategy": rule.strategy.value,
                "scope": rule.scope.value,
                "burst_limit": rule.burst_limit,
            }

        return stats


# Global rate limiter instance
_rate_limiter: Optional[RateLimiter] = None


async def get_rate_limiter() -> RateLimiter:
    """Get or create the global rate limiter instance."""
    global _rate_limiter
    if _rate_limiter is None:
        _rate_limiter = RateLimiter()
        await _initialize_default_rules()
    return _rate_limiter


async def _initialize_default_rules():
    """Initialize default rate limiting rules."""
    rate_limiter = await get_rate_limiter()

    # General API limits
    await rate_limiter.add_rule(
        RateLimitRule(
            name="api_general",
            requests=1000,
            window_seconds=3600,  # 1 hour
            strategy=RateLimitStrategy.SLIDING_WINDOW,
            scope=RateLimitScope.USER,
            priority=100,
        )
    )

    # Auth endpoint limits
    await rate_limiter.add_rule(
        RateLimitRule(
            name="auth_login",
            requests=10,
            window_seconds=900,  # 15 minutes
            strategy=RateLimitStrategy.SLIDING_WINDOW,
            scope=RateLimitScope.IP,
            penalty_seconds=300,  # 5 minutes
            priority=90,
        )
    )

    # Password reset limits
    await rate_limiter.add_rule(
        RateLimitRule(
            name="auth_password_reset",
            requests=3,
            window_seconds=3600,  # 1 hour
            strategy=RateLimitStrategy.SLIDING_WINDOW,
            scope=RateLimitScope.USER,
            penalty_seconds=900,  # 15 minutes
            priority=95,
        )
    )

    # Analysis endpoint limits
    await rate_limiter.add_rule(
        RateLimitRule(
            name="analysis_requests",
            requests=50,
            window_seconds=3600,  # 1 hour
            strategy=RateLimitStrategy.TOKEN_BUCKET,
            scope=RateLimitScope.ORGANIZATION,
            priority=80,
        )
    )

    # API key limits
    await rate_limiter.add_rule(
        RateLimitRule(
            name="api_key_requests",
            requests=10000,
            window_seconds=3600,  # 1 hour
            strategy=RateLimitStrategy.TOKEN_BUCKET,
            scope=RateLimitScope.API_KEY,
            priority=70,
        )
    )

    # Global DoS protection
    await rate_limiter.add_rule(
        RateLimitRule(
            name="global_dos_protection",
            requests=100000,
            window_seconds=300,  # 5 minutes
            strategy=RateLimitStrategy.SLIDING_WINDOW,
            scope=RateLimitScope.GLOBAL,
            priority=200,
            penalty_seconds=300,  # 5 minutes
        )
    )
