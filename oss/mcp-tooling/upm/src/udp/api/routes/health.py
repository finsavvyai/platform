"""
Health check endpoints for monitoring and load balancer health checks.

Enterprise-grade health checks with dependency verification.
"""

import time
from typing import Any

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from udp.core.config import settings
from udp.core.database import get_async_session
from udp.infrastructure.redis import get_redis_client

logger = structlog.get_logger()
router = APIRouter()


@router.get("/")
async def health_check() -> dict[str, Any]:
    """
    Basic health check endpoint.

    Returns basic application health status without dependency checks.
    Used by load balancers for quick health verification.

    Returns:
        Basic health status
    """
    return {
        "status": "healthy",
        "timestamp": time.time(),
        "version": settings.app_version,
        "environment": settings.environment
    }


@router.get("/ready")
async def readiness_check(
    db: AsyncSession = Depends(get_async_session)
) -> dict[str, Any]:
    """
    Readiness check endpoint.

    Verifies that all critical dependencies are available and functioning.
    Used by Kubernetes and other orchestrators to determine if the service
    is ready to receive traffic.

    Args:
        db: Database session

    Returns:
        Detailed readiness status

    Raises:
        HTTPException: If any critical dependency is unavailable
    """
    start_time = time.time()
    checks = {}
    overall_status = "healthy"

    # Database connectivity check
    db_start_time = time.time()
    try:
        result = await db.execute(text("SELECT 1"))
        await result.fetchone()
        checks["database"] = {
            "status": "healthy",
            "response_time_ms": round((time.time() - db_start_time) * 1000, 2)
        }
    except Exception as e:
        logger.error("Database health check failed", error=str(e))
        checks["database"] = {
            "status": "unhealthy",
            "error": str(e)
        }
        overall_status = "unhealthy"

    # Redis connectivity check
    redis_start_time = time.time()
    try:
        redis_client = await get_redis_client()
        await redis_client.ping()
        checks["redis"] = {
            "status": "healthy",
            "response_time_ms": round((time.time() - redis_start_time) * 1000, 2)
        }
    except Exception as e:
        logger.error("Redis health check failed", error=str(e))
        checks["redis"] = {
            "status": "unhealthy",
            "error": str(e)
        }
        overall_status = "unhealthy"

    total_time = round((time.time() - start_time) * 1000, 2)

    response = {
        "status": overall_status,
        "timestamp": time.time(),
        "version": settings.app_version,
        "environment": settings.environment,
        "checks": checks,
        "total_response_time_ms": total_time
    }

    if overall_status == "unhealthy":
        logger.warning("Readiness check failed", response=response)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=response
        )

    return response


@router.get("/live")
async def liveness_check() -> dict[str, Any]:
    """
    Liveness check endpoint.

    Basic application liveness check used by Kubernetes and other orchestrators
    to determine if the application is running and should not be restarted.

    Returns:
        Application liveness status
    """
    return {
        "status": "alive",
        "timestamp": time.time(),
        "uptime_seconds": time.time() - start_time if 'start_time' in globals() else 0
    }


@router.get("/detailed")
async def detailed_health_check(
    db: AsyncSession = Depends(get_async_session)
) -> dict[str, Any]:
    """
    Detailed health check endpoint.

    Comprehensive health check that verifies all system components
    and provides detailed diagnostic information. Used for monitoring
    and debugging purposes.

    Args:
        db: Database session

    Returns:
        Comprehensive health and diagnostic information
    """
    start_time = time.time()
    checks = {}
    overall_status = "healthy"

    # Database detailed check
    db_start_time = time.time()
    try:
        # Test basic connectivity
        await db.execute(text("SELECT 1"))

        # Test table existence (example)
        result = await db.execute(text("SELECT COUNT(*) FROM information_schema.tables"))
        table_count = (await result.fetchone())[0]

        checks["database"] = {
            "status": "healthy",
            "response_time_ms": round((time.time() - db_start_time) * 1000, 2),
            "url": settings.database.url.split("@")[-1] if "@" in settings.database.url else "local",
            "pool_size": settings.database.pool_size,
            "table_count": table_count
        }
    except Exception as e:
        logger.error("Database detailed check failed", error=str(e))
        checks["database"] = {
            "status": "unhealthy",
            "error": str(e),
            "response_time_ms": round((time.time() - db_start_time) * 1000, 2)
        }
        overall_status = "unhealthy"

    # Redis detailed check
    redis_start_time = time.time()
    try:
        redis_client = await get_redis_client()

        # Test connectivity
        await redis_client.ping()

        # Get Redis info
        redis_info = await redis_client.info()

        checks["redis"] = {
            "status": "healthy",
            "response_time_ms": round((time.time() - redis_start_time) * 1000, 2),
            "version": redis_info.get("redis_version"),
            "connected_clients": redis_info.get("connected_clients", 0),
            "used_memory": redis_info.get("used_memory_human"),
            "max_connections": settings.redis.max_connections
        }
    except Exception as e:
        logger.error("Redis detailed check failed", error=str(e))
        checks["redis"] = {
            "status": "unhealthy",
            "error": str(e),
            "response_time_ms": round((time.time() - redis_start_time) * 1000, 2)
        }
        overall_status = "unhealthy"

    # System information
    system_info = {
        "python_version": f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}",
        "platform": sys.platform,
        "architecture": platform.machine(),
        "processor": platform.processor() or "unknown"
    }

    # Configuration validation
    config_status = "healthy"
    config_issues = []

    if not settings.security.secret_key:
        config_issues.append("SECRET_KEY not configured")
        config_status = "warning"

    if settings.is_production and settings.debug:
        config_issues.append("Debug mode enabled in production")
        config_status = "warning"

    checks["configuration"] = {
        "status": config_status,
        "issues": config_issues,
        "environment": settings.environment,
        "debug": settings.debug
    }

    if config_status == "warning" and overall_status == "healthy":
        overall_status = "warning"

    total_time = round((time.time() - start_time) * 1000, 2)

    return {
        "status": overall_status,
        "timestamp": time.time(),
        "version": settings.app_version,
        "environment": settings.environment,
        "checks": checks,
        "system": system_info,
        "total_response_time_ms": total_time
    }


# Add required imports at the top
import platform
import sys

# Track application start time
start_time = time.time()
