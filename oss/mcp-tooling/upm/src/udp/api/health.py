"""
Health check endpoints for UPM monitoring.

Provides comprehensive health monitoring for database, cache,
external services, and overall system health.
"""

import logging
from datetime import datetime, timedelta
from typing import Any, Optional

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import JSONResponse

from ..core.config import get_settings
from ..infrastructure.database import check_database_health, db_manager

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/health", tags=["health"])
settings = get_settings()


class HealthChecker:
    """
    Health checker with caching and comprehensive monitoring.
    """

    def __init__(self):
        self._cache: dict[str, Any] = {}
        self._cache_timeout = timedelta(seconds=30)
        self._last_check: Optional[datetime] = None

    async def check_overall_health(self) -> dict[str, Any]:
        """
        Perform comprehensive health check.

        Returns:
            Dictionary with overall health status and component details
        """
        # Cache health check results
        now = datetime.utcnow()
        if self._last_check and now - self._last_check < self._cache_timeout:
            return self._cache

        health_status = {
            "status": "healthy",
            "timestamp": now.isoformat(),
            "version": settings.VERSION,
            "environment": settings.ENVIRONMENT,
            "components": {},
            "checks_performed": [],
        }

        # Check database health
        try:
            db_health = await check_database_health()
            health_status["components"]["database"] = db_health
            health_status["checks_performed"].append("database")

            if db_health.get("status") != "healthy":
                health_status["status"] = "degraded"

        except Exception as e:
            logger.error(f"Database health check failed: {str(e)}")
            health_status["components"]["database"] = {
                "status": "unhealthy",
                "error": str(e),
                "timestamp": now.isoformat(),
            }
            health_status["status"] = "unhealthy"
            health_status["checks_performed"].append("database")

        # Check Redis cache if available
        try:
            cache_health = await self._check_redis_health()
            health_status["components"]["cache"] = cache_health
            health_status["checks_performed"].append("cache")

            if cache_health.get("status") != "healthy":
                health_status["status"] = "degraded"

        except Exception as e:
            logger.warning(f"Cache health check failed: {str(e)}")
            health_status["components"]["cache"] = {
                "status": "unhealthy",
                "error": str(e),
                "timestamp": now.isoformat(),
            }
            health_status["checks_performed"].append("cache")

        # Check external services if configured
        try:
            external_health = await self._check_external_services()
            health_status["components"]["external_services"] = external_health
            health_status["checks_performed"].append("external_services")

            if external_health.get("status") != "healthy":
                health_status["status"] = "degraded"

        except Exception as e:
            logger.warning(f"External services health check failed: {str(e)}")
            health_status["components"]["external_services"] = {
                "status": "unhealthy",
                "error": str(e),
                "timestamp": now.isoformat(),
            }
            health_status["checks_performed"].append("external_services")

        # Check system resources
        try:
            system_health = await self._check_system_resources()
            health_status["components"]["system"] = system_health
            health_status["checks_performed"].append("system")

            if system_health.get("status") != "healthy":
                health_status["status"] = "degraded"

        except Exception as e:
            logger.warning(f"System resources health check failed: {str(e)}")
            health_status["components"]["system"] = {
                "status": "unhealthy",
                "error": str(e),
                "timestamp": now.isoformat(),
            }
            health_status["checks_performed"].append("system")

        # Cache results
        self._cache = health_status
        self._last_check = now

        return health_status

    async def _check_redis_health(self) -> dict[str, Any]:
        """Check Redis cache health."""
        try:
            # Try to import Redis
            import redis.asyncio as redis

            # Create Redis client
            redis_client = redis.from_url(
                settings.REDIS_URL,
                socket_connect_timeout=5,
                socket_timeout=5,
                retry_on_timeout=False,
            )

            # Test connection
            pong = await redis_client.ping()

            # Test set/get operations
            test_key = f"health_check_{datetime.utcnow().timestamp()}"
            await redis_client.set(test_key, "test_value", ex=60)
            value = await redis_client.get(test_key)

            # Get Redis info
            info = await redis_client.info()

            await redis_client.close()

            return {
                "status": "healthy",
                "ping_response": pong,
                "set_get_test": "success" if value == b"test_value" else "failed",
                "redis_version": info.get("redis_version"),
                "connected_clients": info.get("connected_clients"),
                "used_memory": info.get("used_memory_human"),
                "timestamp": datetime.utcnow().isoformat(),
            }

        except ImportError:
            return {
                "status": "not_configured",
                "message": "Redis not available",
                "timestamp": datetime.utcnow().isoformat(),
            }
        except Exception as e:
            return {
                "status": "unhealthy",
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat(),
            }

    async def _check_external_services(self) -> dict[str, Any]:
        """Check external service health."""
        external_health = {
            "status": "healthy",
            "services": {},
            "timestamp": datetime.utcnow().isoformat(),
        }

        # Check vulnerability databases
        vuln_dbs = await self._check_vulnerability_databases()
        external_health["services"]["vulnerability_databases"] = vuln_dbs

        # Check package registries
        package_registries = await self._check_package_registries()
        external_health["services"]["package_registries"] = package_registries

        # Determine overall status
        unhealthy_services = [
            name
            for name, health in external_health["services"].items()
            if health.get("status") == "unhealthy"
        ]

        if unhealthy_services:
            external_health["status"] = "unhealthy"
            external_health["unhealthy_services"] = unhealthy_services
        elif any(
            health.get("status") == "degraded"
            for health in external_health["services"].values()
        ):
            external_health["status"] = "degraded"

        return external_health

    async def _check_vulnerability_databases(self) -> dict[str, Any]:
        """Check vulnerability database availability."""
        databases = {}

        # Check NVD
        try:
            import aiohttp

            async with aiohttp.ClientSession(
                timeout=aiohttp.ClientTimeout(total=5)
            ) as session:
                async with session.get(
                    "https://nvd.nist.gov/feeds/json/cve/1.1/nvdcve-1.1-modified.json.gz"
                ) as response:
                    if response.status == 200:
                        databases["nvd"] = {
                            "status": "healthy",
                            "response_time_ms": response.headers.get("X-Response-Time"),
                            "timestamp": datetime.utcnow().isoformat(),
                        }
                    else:
                        databases["nvd"] = {
                            "status": "unhealthy",
                            "status_code": response.status,
                            "timestamp": datetime.utcnow().isoformat(),
                        }
        except Exception as e:
            databases["nvd"] = {
                "status": "unhealthy",
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat(),
            }

        # Check GitHub Advisory
        try:
            import aiohttp

            async with aiohttp.ClientSession(
                timeout=aiohttp.ClientTimeout(total=5)
            ) as session:
                async with session.get("https://api.github.com/advisories") as response:
                    if response.status == 200:
                        databases["github_advisory"] = {
                            "status": "healthy",
                            "response_time_ms": response.headers.get("X-Response-Time"),
                            "timestamp": datetime.utcnow().isoformat(),
                        }
                    else:
                        databases["github_advisory"] = {
                            "status": "unhealthy",
                            "status_code": response.status,
                            "timestamp": datetime.utcnow().isoformat(),
                        }
        except Exception as e:
            databases["github_advisory"] = {
                "status": "unhealthy",
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat(),
            }

        return databases

    async def _check_package_registries(self) -> dict[str, Any]:
        """Check package registry availability."""
        registries = {}

        # Check Maven Central
        try:
            import aiohttp

            async with aiohttp.ClientSession(
                timeout=aiohttp.ClientTimeout(total=5)
            ) as session:
                async with session.get(
                    "https://search.maven.org/solrsearch/select?q=g:org.apache+AND+a:maven&rows=1"
                ) as response:
                    if response.status == 200:
                        registries["maven_central"] = {
                            "status": "healthy",
                            "response_time_ms": response.headers.get("X-Response-Time"),
                            "timestamp": datetime.utcnow().isoformat(),
                        }
                    else:
                        registries["maven_central"] = {
                            "status": "unhealthy",
                            "status_code": response.status,
                            "timestamp": datetime.utcnow().isoformat(),
                        }
        except Exception as e:
            registries["maven_central"] = {
                "status": "unhealthy",
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat(),
            }

        # Check npm registry
        try:
            import aiohttp

            async with aiohttp.ClientSession(
                timeout=aiohttp.ClientTimeout(total=5)
            ) as session:
                async with session.get("https://registry.npmjs.org/npm") as response:
                    if response.status == 200:
                        registries["npm"] = {
                            "status": "healthy",
                            "response_time_ms": response.headers.get("X-Response-Time"),
                            "timestamp": datetime.utcnow().isoformat(),
                        }
                    else:
                        registries["npm"] = {
                            "status": "unhealthy",
                            "status_code": response.status,
                            "timestamp": datetime.utcnow().isoformat(),
                        }
        except Exception as e:
            registries["npm"] = {
                "status": "unhealthy",
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat(),
            }

        return registries

    async def _check_system_resources(self) -> dict[str, Any]:
        """Check system resource health."""
        import psutil

        system_health = {
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat(),
        }

        try:
            # CPU usage
            cpu_percent = psutil.cpu_percent(interval=1)
            system_health["cpu_usage_percent"] = cpu_percent

            # Memory usage
            memory = psutil.virtual_memory()
            system_health["memory"] = {
                "total_gb": round(memory.total / (1024**3), 2),
                "available_gb": round(memory.available / (1024**3), 2),
                "usage_percent": memory.percent,
            }

            # Disk usage
            disk = psutil.disk_usage("/")
            system_health["disk"] = {
                "total_gb": round(disk.total / (1024**3), 2),
                "free_gb": round(disk.free / (1024**3), 2),
                "usage_percent": round((disk.total - disk.free) / disk.total * 100, 2),
            }

            # Process count
            system_health["process_count"] = len(psutil.pids())

            # Check thresholds
            if cpu_percent > 90:
                system_health["status"] = "unhealthy"
            elif cpu_percent > 70:
                system_health["status"] = "degraded"

            if memory.percent > 90:
                system_health["status"] = "unhealthy"
            elif memory.percent > 80:
                system_health["status"] = "degraded"

            if system_health["disk"]["usage_percent"] > 95:
                system_health["status"] = "unhealthy"
            elif system_health["disk"]["usage_percent"] > 85:
                system_health["status"] = "degraded"

        except Exception as e:
            system_health["status"] = "unhealthy"
            system_health["error"] = str(e)

        return system_health


# Global health checker instance
health_checker = HealthChecker()


@router.get("/")
async def health_check() -> dict[str, Any]:
    """
    Basic health check endpoint.

    Returns overall health status without detailed component information.
    """
    try:
        health = await health_checker.check_overall_health()

        # Return simplified health info
        return {
            "status": health["status"],
            "timestamp": health["timestamp"],
            "version": health["version"],
            "environment": health["environment"],
        }

    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "status": "unhealthy",
                "timestamp": datetime.utcnow().isoformat(),
                "error": "Health check service unavailable",
            },
        )


@router.get("/detailed")
async def detailed_health_check() -> dict[str, Any]:
    """
    Detailed health check endpoint.

    Returns comprehensive health information for all components.
    """
    try:
        health = await health_checker.check_overall_health()
        return health

    except Exception as e:
        logger.error(f"Detailed health check failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Health check service unavailable",
        )


@router.get("/database")
async def database_health() -> dict[str, Any]:
    """Database-specific health check."""
    try:
        return await check_database_health()
    except Exception as e:
        logger.error(f"Database health check failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Database health check failed: {str(e)}",
        )


@router.get("/ready")
async def readiness_check() -> dict[str, Any]:
    """
    Readiness check endpoint.

    Returns whether the application is ready to serve requests.
    """
    try:
        health = await health_checker.check_overall_health()

        if health["status"] == "healthy":
            return {
                "status": "ready",
                "timestamp": health["timestamp"],
                "checks": health["checks_performed"],
            }
        else:
            return JSONResponse(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                content={
                    "status": "not_ready",
                    "timestamp": health["timestamp"],
                    "reason": health["status"],
                    "components": health.get("components", {}),
                },
            )

    except Exception as e:
        logger.error(f"Readiness check failed: {str(e)}")
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "status": "not_ready",
                "timestamp": datetime.utcnow().isoformat(),
                "error": "Readiness check failed",
            },
        )


@router.get("/live")
async def liveness_check() -> dict[str, Any]:
    """
    Liveness check endpoint.

    Returns whether the application is alive and responding.
    """
    return {
        "status": "alive",
        "timestamp": datetime.utcnow().isoformat(),
        "version": settings.VERSION,
    }


@router.post("/warmup")
async def warmup_services() -> dict[str, Any]:
    """
    Warm up services and connection pools.

    Pre-initializes connections and caches to improve first-request performance.
    """
    warmup_results = {"timestamp": datetime.utcnow().isoformat(), "services": {}}

    try:
        # Warm up database connection pool
        await db_manager.warm_connection_pool(count=5)
        warmup_results["services"]["database"] = {
            "status": "warmed_up",
            "connections_created": 5,
        }

        # Warm up Redis connections if available
        try:
            import redis.asyncio as redis

            redis_client = redis.from_url(settings.REDIS_URL)
            await redis.ping()
            await redis.close()
            warmup_results["services"]["redis"] = {"status": "warmed_up"}
        except Exception as e:
            warmup_results["services"]["redis"] = {
                "status": "skipped",
                "reason": str(e),
            }

        warmup_results["status"] = "completed"
        logger.info("Service warmup completed successfully")

    except Exception as e:
        warmup_results["status"] = "failed"
        warmup_results["error"] = str(e)
        logger.error(f"Service warmup failed: {str(e)}")

    return warmup_results
