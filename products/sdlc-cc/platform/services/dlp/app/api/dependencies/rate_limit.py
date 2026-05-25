"""
Rate limiting dependencies for SDLC.ai DLP Service API.

This module provides rate limiting functionality to prevent abuse
and ensure fair usage of the DLP service.
"""

import logging
import time

import aioredis
from fastapi import HTTPException, status

from app.core.config import get_settings

logger = logging.getLogger(__name__)

settings = get_settings()


class RateLimiter:
    """Redis-based rate limiter."""

    def __init__(self):
        self.redis_client = None
        self._initialized = False

    async def _ensure_initialized(self):
        """Ensure Redis client is initialized."""
        if not self._initialized:
            try:
                self.redis_client = await aioredis.from_url(
                    settings.redis_url, encoding="utf-8", decode_responses=True
                )
                self._initialized = True
                logger.info("Rate limiter Redis client initialized")
            except Exception as e:
                logger.error(f"Failed to initialize Redis client: {e}")
                # Fallback to in-memory rate limiting
                self._memory_store: dict[str, list] = {}

    async def check_limit(
        self,
        key: str,
        limit: int = 100,
        window: int = 60,  # seconds
    ):
        """
        Check if the rate limit has been exceeded.

        Args:
            key: Rate limit key (e.g., "scan:tenant123")
            limit: Maximum number of requests allowed
            window: Time window in seconds

        Raises:
            HTTPException: If rate limit is exceeded
        """
        await self._ensure_initialized()

        try:
            current_time = int(time.time())
            window_start = current_time - window

            if self.redis_client:
                # Use Redis for rate limiting
                await self._check_redis_limit(
                    key, limit, window, current_time, window_start
                )
            else:
                # Fallback to in-memory rate limiting
                await self._check_memory_limit(
                    key, limit, window, current_time, window_start
                )

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Rate limiter error: {e}")
            # Fail open - allow the request if rate limiting fails
            pass

    async def _check_redis_limit(
        self, key: str, limit: int, window: int, current_time: int, window_start: int
    ):
        """Check rate limit using Redis."""
        # Remove old entries
        await self.redis_client.zremrangebyscore(key, 0, window_start)

        # Count current requests
        current_requests = await self.redis_client.zcard(key)

        if current_requests >= limit:
            # Get oldest request time for retry-after header
            oldest = await self.redis_client.zrange(key, 0, 0, withscores=True)
            if oldest:
                retry_after = int(oldest[0][1]) + window - current_time
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Rate limit exceeded",
                    headers={"Retry-After": str(max(1, retry_after))},
                )

        # Add current request
        await self.redis_client.zadd(key, {str(current_time): current_time})
        await self.redis_client.expire(key, window)

    async def _check_memory_limit(
        self, key: str, limit: int, window: int, current_time: int, window_start: int
    ):
        """Check rate limit using in-memory store."""
        if key not in self._memory_store:
            self._memory_store[key] = []

        # Remove old entries
        self._memory_store[key] = [
            timestamp
            for timestamp in self._memory_store[key]
            if timestamp > window_start
        ]

        if len(self._memory_store[key]) >= limit:
            # Calculate retry after
            oldest_timestamp = min(self._memory_store[key])
            retry_after = int(oldest_timestamp) + window - current_time
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Rate limit exceeded",
                headers={"Retry-After": str(max(1, retry_after))},
            )

        # Add current request
        self._memory_store[key].append(current_time)

        # Cleanup old entries periodically
        if len(self._memory_store) > 10000:  # Prevent memory leaks
            self._cleanup_memory_store()

    async def _cleanup_memory_store(self):
        """Clean up old entries in memory store."""
        cutoff_time = time.time() - 3600  # Remove entries older than 1 hour

        for key in list(self._memory_store.keys()):
            self._memory_store[key] = [
                timestamp
                for timestamp in self._memory_store[key]
                if timestamp > cutoff_time
            ]

            # Remove empty keys
            if not self._memory_store[key]:
                del self._memory_store[key]

    async def get_usage_stats(self, key: str, window: int = 3600) -> dict[str, int]:
        """Get usage statistics for a key."""
        await self._ensure_initialized()

        try:
            current_time = int(time.time())
            window_start = current_time - window

            if self.redis_client:
                # Use Redis
                await self.redis_client.zremrangebyscore(key, 0, window_start)
                count = await self.redis_client.zcard(key)
            else:
                # Use memory store
                if key in self._memory_store:
                    self._memory_store[key] = [
                        timestamp
                        for timestamp in self._memory_store[key]
                        if timestamp > window_start
                    ]
                    count = len(self._memory_store[key])
                else:
                    count = 0

            return {
                "current_usage": count,
                "window_seconds": window,
                "timestamp": current_time,
            }

        except Exception as e:
            logger.error(f"Failed to get usage stats: {e}")
            return {
                "current_usage": 0,
                "window_seconds": window,
                "timestamp": int(time.time()),
            }


# Global rate limiter instance
rate_limiter = RateLimiter()


# Rate limit configurations
RATE_LIMITS = {
    "scan": {"limit": 100, "window": 60},  # 100 scans per minute
    "batch_scan": {"limit": 10, "window": 60},  # 10 batch scans per minute
    "policy": {"limit": 50, "window": 60},  # 50 policy operations per minute
    "rule": {"limit": 100, "window": 60},  # 100 rule operations per minute
    "pattern": {"limit": 50, "window": 60},  # 50 pattern operations per minute
    "report": {"limit": 20, "window": 60},  # 20 reports per minute
}


async def check_rate_limit(operation: str, identifier: str):
    """
    Check rate limit for a specific operation.

    Args:
        operation: Type of operation (e.g., "scan", "policy")
        identifier: Unique identifier (e.g., tenant ID, user ID)
    """
    if not settings.rate_limit_enabled:
        return

    limit_config = RATE_LIMITS.get(operation, {"limit": 100, "window": 60})
    key = f"{operation}:{identifier}"

    await rate_limiter.check_limit(
        key=key, limit=limit_config["limit"], window=limit_config["window"]
    )
