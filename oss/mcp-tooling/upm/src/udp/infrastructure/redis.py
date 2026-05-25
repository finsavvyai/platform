"""
Redis client configuration and connection management.

Enterprise-grade Redis setup with connection pooling,
health checks, and comprehensive error handling.
"""

from typing import Optional

import redis.asyncio as redis
import structlog
from udp.core.config import settings

logger = structlog.get_logger()

# Global Redis client
redis_client: Optional[redis.Redis] = None


async def init_redis() -> None:
    """
    Initialize Redis connection pool.

    Sets up the global Redis client with appropriate configuration
    for connection pooling and error handling.
    """
    global redis_client

    try:
        redis_url = settings.REDIS_URL
        logger.info(
            "Initializing Redis connection",
            url=redis_url.split("@")[-1] if "@" in redis_url else redis_url,
        )

        redis_client = redis.from_url(
            redis_url,
            max_connections=20,
            retry_on_timeout=True,
            socket_timeout=5,
            decode_responses=True,
            health_check_interval=30,
        )

        # Test connection
        await redis_client.ping()

        logger.info("Redis connection initialized successfully")

    except Exception as e:
        logger.error("Failed to initialize Redis", error=str(e), exc_info=True)
        raise


async def get_redis_client() -> redis.Redis:
    """
    Get Redis client instance.

    Returns:
        Redis client instance

    Raises:
        RuntimeError: If Redis is not initialized
    """
    if redis_client is None:
        raise RuntimeError("Redis not initialized. Call init_redis() first.")

    return redis_client


async def close_redis() -> None:
    """
    Close Redis connections.

    Cleanup function to properly close all Redis connections.
    """
    global redis_client

    if redis_client:
        logger.info("Closing Redis connections")
        await redis_client.aclose()
        redis_client = None
        logger.info("Redis connections closed")


async def check_redis_health() -> bool:
    """
    Check Redis connectivity.

    Returns:
        bool: True if Redis is healthy, False otherwise
    """
    if not redis_client:
        return False

    try:
        await redis_client.ping()
        return True
    except Exception as e:
        logger.error("Redis health check failed", error=str(e))
        return False
