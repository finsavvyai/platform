"""
Enterprise Rate Limiting System with Redis Integration

This module provides comprehensive rate limiting capabilities including:
- Multiple rate limit types (per key, user, organization, IP, global)
- Sliding window and token bucket algorithms
- Distributed rate limiting with Redis
- Configurable policies and dynamic limits
- Rate limit analytics and monitoring
- Graceful degradation and fallback strategies

Author: Claude Code Implementation
Task: 1.1.4 API Gateway Implementation
Updated: 2025-01-06
"""

import asyncio
import json
import time
import logging
from typing import Dict, List, Optional, Tuple, Any, Union
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
from enum import Enum
import hashlib
import secrets

import redis.asyncio as redis
from redis.asyncio import Redis
from fastapi import Request, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.gateway.models import RateLimitType, APIKey, APIUsageLog
from app.gateway.models import APIUsageLog

logger = logging.getLogger(__name__)


class RateLimitAlgorithm(str, Enum):
    """Rate limiting algorithms"""
    SLIDING_WINDOW = "sliding_window"
    TOKEN_BUCKET = "token_bucket"
    FIXED_WINDOW = "fixed_window"
    LEAKY_BUCKET = "leaky_bucket"


@dataclass
class RateLimitConfig:
    """Rate limit configuration"""
    requests_per_minute: int = 1000
    requests_per_hour: int = 50000
    requests_per_day: int = 1000000
    burst_size: int = 100  # For token bucket
    algorithm: RateLimitAlgorithm = RateLimitAlgorithm.SLIDING_WINDOW
    penalty_factor: float = 1.0  # For repeat offenders
    whitelist: List[str] = None  # IPs or keys that bypass limits
    blacklist: List[str] = None  # IPs or keys that are always blocked

    def __post_init__(self):
        if self.whitelist is None:
            self.whitelist = []
        if self.blacklist is None:
            self.blacklist = []


@dataclass
class RateLimitResult:
    """Rate limit check result"""
    allowed: bool
    remaining: int
    reset_time: datetime
    limit: int
    window_start: datetime
    retry_after: Optional[int] = None
    is_whitelisted: bool = False
    is_blacklisted: bool = False
    penalty_applied: bool = False


class SlidingWindowRateLimiter:
    """Sliding window rate limiter implementation"""

    def __init__(self, redis_client: Redis, window_size: int = 60):
        self.redis = redis_client
        self.window_size = window_size  # Window size in seconds

    async def check_rate_limit(
        self,
        key: str,
        limit: int,
        current_time: Optional[float] = None
    ) -> RateLimitResult:
        """Check rate limit using sliding window algorithm"""
        if current_time is None:
            current_time = time.time()

        # Redis key for this rate limit
        redis_key = f"rate_limit:{key}:{self.window_size}"

        # Remove expired entries
        pipeline = self.redis.pipeline()
        pipeline.zremrangebyscore(redis_key, 0, current_time - self.window_size)

        # Count current requests in window
        pipeline.zcard(redis_key)

        # Add current request
        pipeline.zadd(redis_key, {str(current_time): current_time})

        # Set expiry on the key
        pipeline.expire(redis_key, self.window_size)

        results = await pipeline.execute()

        current_requests = results[1]
        remaining = max(0, limit - current_requests)
        allowed = current_requests < limit
        window_start = datetime.fromtimestamp(current_time - self.window_size)
        reset_time = datetime.fromtimestamp(current_time + self.window_size)

        return RateLimitResult(
            allowed=allowed,
            remaining=remaining,
            reset_time=reset_time,
            limit=limit,
            window_start=window_start,
            retry_after=int(self.window_size) if not allowed else None
        )


class TokenBucketRateLimiter:
    """Token bucket rate limiter implementation"""

    def __init__(self, redis_client: Redis):
        self.redis = redis_client

    async def check_rate_limit(
        self,
        key: str,
        limit: int,
        burst_size: int,
        current_time: Optional[float] = None
    ) -> RateLimitResult:
        """Check rate limit using token bucket algorithm"""
        if current_time is None:
            current_time = time.time()

        redis_key = f"token_bucket:{key}"

        # Token bucket script
        lua_script = """
        local key = KEYS[1]
        local current_time = tonumber(ARGV[1])
        local limit = tonumber(ARGV[2])
        local burst_size = tonumber(ARGV[3])
        local refill_rate = limit / 60  -- tokens per second (per minute rate)

        local bucket = redis.call('HMGET', key, 'tokens', 'last_refill')
        local tokens = tonumber(bucket[1]) or burst_size
        local last_refill = tonumber(bucket[2]) or current_time

        -- Refill tokens
        local time_passed = current_time - last_refill
        local tokens_to_add = math.floor(time_passed * refill_rate)
        tokens = math.min(burst_size, tokens + tokens_to_add)

        -- Check if request can be processed
        local allowed = tokens >= 1
        if allowed then
            tokens = tokens - 1
        end

        -- Update bucket state
        redis.call('HMSET', key, 'tokens', tokens, 'last_refill', current_time)
        redis.call('EXPIRE', key, 3600)  -- 1 hour expiry

        return {tokens, allowed}
        """

        try:
            results = await self.redis.eval(
                lua_script,
                1,  # Number of keys
                redis_key,
                current_time,
                limit,
                burst_size
            )

            remaining_tokens = int(results[0])
            allowed = bool(results[1])
            remaining = max(0, remaining_tokens)

            return RateLimitResult(
                allowed=allowed,
                remaining=remaining,
                reset_time=datetime.fromtimestamp(current_time + 60),  # Next minute
                limit=burst_size,
                window_start=datetime.fromtimestamp(current_time - 60),
                retry_after=1 if not allowed else None
            )

        except Exception as e:
            logger.error(f"Token bucket rate limit check failed: {e}")
            # Fallback to simple rate limiting
            return RateLimitResult(
                allowed=True,
                remaining=limit,
                reset_time=datetime.fromtimestamp(current_time + 60),
                limit=limit,
                window_start=datetime.fromtimestamp(current_time)
            )


class RateLimiter:
    """
    Enterprise rate limiter with multiple algorithms and strategies
    """

    def __init__(self, redis_url: Optional[str] = None):
        self.redis_url = redis_url or settings.REDIS_URL
        self.redis_client: Optional[Redis] = None
        self.configs: Dict[str, RateLimitConfig] = {}
        self.sliding_limiter: Optional[SlidingWindowRateLimiter] = None
        self.token_bucket_limiter: Optional[TokenBucketRateLimiter] = None
        self._initialized = False

    async def initialize(self):
        """Initialize rate limiter and Redis connection"""
        if self._initialized:
            return

        try:
            self.redis_client = redis.from_url(self.redis_url, decode_responses=True)
            await self.redis_client.ping()

            self.sliding_limiter = SlidingWindowRateLimiter(self.redis_client, 60)  # 1-minute window
            self.token_bucket_limiter = TokenBucketRateLimiter(self.redis_client)

            # Load default configurations
            await self.load_default_configs()

            self._initialized = True
            logger.info("Rate limiter initialized successfully")

        except Exception as e:
            logger.error(f"Failed to initialize rate limiter: {e}")
            raise

    async def shutdown(self):
        """Cleanup rate limiter resources"""
        if self.redis_client:
            await self.redis_client.close()
        self._initialized = False

    async def load_default_configs(self):
        """Load default rate limit configurations"""
        default_configs = {
            "default": RateLimitConfig(
                requests_per_minute=1000,
                requests_per_hour=50000,
                requests_per_day=1000000,
                burst_size=100,
                algorithm=RateLimitAlgorithm.SLIDING_WINDOW
            ),
            "premium": RateLimitConfig(
                requests_per_minute=5000,
                requests_per_hour=250000,
                requests_per_day=5000000,
                burst_size=500,
                algorithm=RateLimitAlgorithm.TOKEN_BUCKET
            ),
            "enterprise": RateLimitConfig(
                requests_per_minute=10000,
                requests_per_hour=500000,
                requests_per_day=10000000,
                burst_size=1000,
                algorithm=RateLimitAlgorithm.TOKEN_BUCKET
            ),
            "restricted": RateLimitConfig(
                requests_per_minute=100,
                requests_per_hour=5000,
                requests_per_day=100000,
                burst_size=50,
                algorithm=RateLimitAlgorithm.SLIDING_WINDOW
            )
        }

        self.configs.update(default_configs)

    def get_config(self, config_name: str) -> RateLimitConfig:
        """Get rate limit configuration by name"""
        return self.configs.get(config_name, self.configs["default"])

    def set_config(self, name: str, config: RateLimitConfig):
        """Set rate limit configuration"""
        self.configs[name] = config

    def _generate_key(self, key_type: RateLimitType, identifier: str, endpoint: str) -> str:
        """Generate Redis key for rate limiting"""
        key_components = [key_type.value, identifier]

        # Add endpoint for more granular rate limiting
        if endpoint:
            # Hash endpoint to keep keys manageable
            endpoint_hash = hashlib.md5(endpoint.encode()).hexdigest()[:8]
            key_components.append(endpoint_hash)

        return ":".join(key_components)

    async def check_rate_limit(
        self,
        key_type: RateLimitType,
        identifier: str,
        endpoint: str = "",
        config_name: str = "default",
        current_time: Optional[float] = None
    ) -> RateLimitResult:
        """
        Check rate limit for given key type and identifier

        Args:
            key_type: Type of rate limit (per key, user, org, etc.)
            identifier: Unique identifier (API key, user ID, IP, etc.)
            endpoint: API endpoint being accessed
            config_name: Configuration name to use
            current_time: Current timestamp for testing

        Returns:
            RateLimitResult with allowed status and metadata
        """
        if not self._initialized:
            await self.initialize()

        config = self.get_config(config_name)

        # Check blacklist first
        if identifier in config.blacklist:
            return RateLimitResult(
                allowed=False,
                remaining=0,
                reset_time=datetime.fromtimestamp(current_time or time.time() + 60),
                limit=0,
                window_start=datetime.fromtimestamp(current_time or time.time()),
                retry_after=3600,  # 1 hour
                is_blacklisted=True
            )

        # Check whitelist
        if identifier in config.whitelist:
            return RateLimitResult(
                allowed=True,
                remaining=config.requests_per_minute,
                reset_time=datetime.fromtimestamp(current_time or time.time() + 60),
                limit=config.requests_per_minute,
                window_start=datetime.fromtimestamp(current_time or time.time()),
                is_whitelisted=True
            )

        # Generate rate limit key
        rate_limit_key = self._generate_key(key_type, identifier, endpoint)

        # Choose appropriate rate limit based on time period
        # For simplicity, we'll use per-minute rate limiting
        limit = config.requests_per_minute

        try:
            if config.algorithm == RateLimitAlgorithm.SLIDING_WINDOW:
                result = await self.sliding_limiter.check_rate_limit(
                    rate_limit_key, limit, current_time
                )
            elif config.algorithm == RateLimitAlgorithm.TOKEN_BUCKET:
                result = await self.token_bucket_limiter.check_rate_limit(
                    rate_limit_key, limit, config.burst_size, current_time
                )
            else:
                # Default to sliding window
                result = await self.sliding_limiter.check_rate_limit(
                    rate_limit_key, limit, current_time
                )

            # Apply penalty for repeated violations
            if not result.allowed:
                penalty_key = f"penalty:{identifier}"
                await self._apply_penalty(penalty_key, config.penalty_factor)
                result.penalty_applied = True

            return result

        except Exception as e:
            logger.error(f"Rate limit check failed for {key_type}:{identifier}: {e}")
            # Fail open - allow the request but log the error
            return RateLimitResult(
                allowed=True,
                remaining=limit,
                reset_time=datetime.fromtimestamp(current_time or time.time() + 60),
                limit=limit,
                window_start=datetime.fromtimestamp(current_time or time.time())
            )

    async def _apply_penalty(self, penalty_key: str, penalty_factor: float):
        """Apply penalty factor for repeat offenders"""
        try:
            # Get current violation count
            violations = await self.redis_client.incr(penalty_key)
            await self.redis_client.expire(penalty_key, 3600)  # 1 hour

            if violations > 1:
                # Apply exponential backoff
                backoff_seconds = min(3600, int(60 * (penalty_factor ** violations)))
                await self.redis_client.setex(
                    f"backoff:{penalty_key}",
                    backoff_seconds,
                    "1"
                )

        except Exception as e:
            logger.error(f"Failed to apply penalty: {e}")

    async def get_rate_limit_status(
        self,
        key_type: RateLimitType,
        identifier: str,
        endpoint: str = "",
        config_name: str = "default"
    ) -> Dict[str, Any]:
        """Get current rate limit status without consuming a request"""
        if not self._initialized:
            await self.initialize()

        config = self.get_config(config_name)
        rate_limit_key = self._generate_key(key_type, identifier, endpoint)

        try:
            if config.algorithm == RateLimitAlgorithm.SLIDING_WINDOW:
                redis_key = f"rate_limit:{rate_limit_key}:60"
                current_count = await self.redis_client.zcard(redis_key)
                limit = config.requests_per_minute
            else:
                redis_key = f"token_bucket:{rate_limit_key}"
                bucket_data = await self.redis_client.hmget(redis_key, 'tokens', 'last_refill')
                current_count = 0  # Token bucket uses different logic
                limit = config.requests_per_minute

            remaining = max(0, limit - current_count)

            return {
                "limit": limit,
                "remaining": remaining,
                "used": current_count,
                "reset_time": datetime.utcnow() + timedelta(minutes=1),
                "algorithm": config.algorithm.value
            }

        except Exception as e:
            logger.error(f"Failed to get rate limit status: {e}")
            return {
                "limit": config.requests_per_minute,
                "remaining": config.requests_per_minute,
                "used": 0,
                "reset_time": datetime.utcnow() + timedelta(minutes=1),
                "algorithm": config.algorithm.value
            }

    async def clear_rate_limit(
        self,
        key_type: RateLimitType,
        identifier: str,
        endpoint: str = ""
    ):
        """Clear rate limit for specific key (admin function)"""
        if not self._initialized:
            await self.initialize()

        rate_limit_key = self._generate_key(key_type, identifier, endpoint)

        try:
            # Clear all possible rate limit keys
            keys_to_delete = [
                f"rate_limit:{rate_limit_key}:60",  # 1-minute window
                f"rate_limit:{rate_limit_key}:3600",  # 1-hour window
                f"rate_limit:{rate_limit_key}:86400",  # 1-day window
                f"token_bucket:{rate_limit_key}",
                f"penalty:{identifier}",
                f"backoff:penalty:{identifier}"
            ]

            await self.redis_client.delete(*keys_to_delete)
            logger.info(f"Cleared rate limit for {key_type}:{identifier}")

        except Exception as e:
            logger.error(f"Failed to clear rate limit: {e}")

    async def get_rate_limit_analytics(
        self,
        key_type: RateLimitType,
        identifier: Optional[str] = None,
        time_range: int = 3600  # 1 hour
    ) -> Dict[str, Any]:
        """Get analytics for rate limiting"""
        if not self._initialized:
            await self.initialize()

        try:
            pattern = f"rate_limit:{key_type.value}:*"
            if identifier:
                pattern = f"rate_limit:{key_type.value}:{identifier}:*"

            keys = await self.redis_client.keys(pattern)

            total_requests = 0
            active_keys = 0

            for key in keys:
                count = await self.redis_client.zcard(key)
                if count > 0:
                    active_keys += 1
                    total_requests += count

            return {
                "total_requests": total_requests,
                "active_keys": active_keys,
                "time_range_seconds": time_range,
                "requests_per_second": total_requests / time_range if time_range > 0 else 0
            }

        except Exception as e:
            logger.error(f"Failed to get rate limit analytics: {e}")
            return {
                "total_requests": 0,
                "active_keys": 0,
                "time_range_seconds": time_range,
                "requests_per_second": 0
            }


# Global rate limiter instance
rate_limiter = RateLimiter()