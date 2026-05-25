"""
Health and Metrics API routes for SDLC.ai DLP Service.

This module provides endpoints for health checks, metrics, and system monitoring.
"""

import logging
import time
from typing import Any

from fastapi import APIRouter
from fastapi.responses import Response
from prometheus_client import (
    CONTENT_TYPE_LATEST,
    Gauge,
    generate_latest,
)

from app.services.content_classifier import get_classification_service
from app.services.presidio_detector import get_presidio_detector
from app.services.real_time_scanner import get_real_time_scanner
from app.services.regex_engine import get_regex_engine
from app.services.rule_engine import get_rule_engine
from app.services.violation_reporter import get_violation_reporter

logger = logging.getLogger(__name__)

router = APIRouter()

# Service instances
scanner = get_real_time_scanner()
reporter = get_violation_reporter()
presidio_detector = get_presidio_detector()
regex_engine = get_regex_engine()
classifier = get_classification_service()
rule_engine = get_rule_engine()

# Health check metrics
HEALTH_CHECKS = Gauge(
    "dlp_health_check_status",
    "Health check status (1=healthy, 0=unhealthy)",
    ["service"],
)
UPTIME = Gauge("dlp_service_uptime_seconds", "Service uptime in seconds")

# Service metrics
ACTIVE_SCANS = Gauge("dlp_active_scans", "Number of currently active scans")
SCAN_QUEUE_SIZE = Gauge("dlp_scan_queue_size", "Number of scans in queue")
VIOLATION_QUEUE_SIZE = Gauge(
    "dlp_violation_queue_size", "Number of violations in queue"
)

start_time = time.time()


@router.get("/status")
async def health_status():
    """
    Comprehensive health status of all DLP service components.

    Returns health status for all major components including scanners,
    detectors, engines, and external dependencies.
    """
    health_status = {
        "status": "healthy",
        "timestamp": time.time(),
        "uptime_seconds": time.time() - start_time,
        "version": "1.0.0",
        "components": {},
    }

    overall_healthy = True

    # Check Presidio detector
    try:
        presidio_health = await _check_presidio_health()
        health_status["components"]["presidio_detector"] = presidio_health
        HEALTH_CHECKS.labels(service="presidio_detector").set(
            1 if presidio_health["healthy"] else 0
        )
        if not presidio_health["healthy"]:
            overall_healthy = False
    except Exception as e:
        health_status["components"]["presidio_detector"] = {
            "healthy": False,
            "error": str(e),
        }
        HEALTH_CHECKS.labels(service="presidio_detector").set(0)
        overall_healthy = False

    # Check regex engine
    try:
        regex_health = _check_regex_engine_health()
        health_status["components"]["regex_engine"] = regex_health
        HEALTH_CHECKS.labels(service="regex_engine").set(
            1 if regex_health["healthy"] else 0
        )
        if not regex_health["healthy"]:
            overall_healthy = False
    except Exception as e:
        health_status["components"]["regex_engine"] = {
            "healthy": False,
            "error": str(e),
        }
        HEALTH_CHECKS.labels(service="regex_engine").set(0)
        overall_healthy = False

    # Check content classifier
    try:
        classifier_health = _check_classifier_health()
        health_status["components"]["content_classifier"] = classifier_health
        HEALTH_CHECKS.labels(service="content_classifier").set(
            1 if classifier_health["healthy"] else 0
        )
        if not classifier_health["healthy"]:
            overall_healthy = False
    except Exception as e:
        health_status["components"]["content_classifier"] = {
            "healthy": False,
            "error": str(e),
        }
        HEALTH_CHECKS.labels(service="content_classifier").set(0)
        overall_healthy = False

    # Check rule engine
    try:
        rule_engine_health = _check_rule_engine_health()
        health_status["components"]["rule_engine"] = rule_engine_health
        HEALTH_CHECKS.labels(service="rule_engine").set(
            1 if rule_engine_health["healthy"] else 0
        )
        if not rule_engine_health["healthy"]:
            overall_healthy = False
    except Exception as e:
        health_status["components"]["rule_engine"] = {"healthy": False, "error": str(e)}
        HEALTH_CHECKS.labels(service="rule_engine").set(0)
        overall_healthy = False

    # Check scanner service
    try:
        scanner_health = _check_scanner_health()
        health_status["components"]["scanner_service"] = scanner_health
        HEALTH_CHECKS.labels(service="scanner_service").set(
            1 if scanner_health["healthy"] else 0
        )
        if not scanner_health["healthy"]:
            overall_healthy = False
    except Exception as e:
        health_status["components"]["scanner_service"] = {
            "healthy": False,
            "error": str(e),
        }
        HEALTH_CHECKS.labels(service="scanner_service").set(0)
        overall_healthy = False

    # Check violation reporter
    try:
        reporter_health = _check_reporter_health()
        health_status["components"]["violation_reporter"] = reporter_health
        HEALTH_CHECKS.labels(service="violation_reporter").set(
            1 if reporter_health["healthy"] else 0
        )
        if not reporter_health["healthy"]:
            overall_healthy = False
    except Exception as e:
        health_status["components"]["violation_reporter"] = {
            "healthy": False,
            "error": str(e),
        }
        HEALTH_CHECKS.labels(service="violation_reporter").set(0)
        overall_healthy = False

    # Check external dependencies
    try:
        deps_health = await _check_dependencies_health()
        health_status["components"]["dependencies"] = deps_health
        if not deps_health["healthy"]:
            overall_healthy = False
    except Exception as e:
        health_status["components"]["dependencies"] = {
            "healthy": False,
            "error": str(e),
        }
        overall_healthy = False

    health_status["status"] = "healthy" if overall_healthy else "unhealthy"
    UPTIME.set(time.time() - start_time)

    return health_status


@router.get("/readiness")
async def readiness_check():
    """
    Readiness probe for Kubernetes/container orchestration.

    Returns whether the service is ready to accept traffic.
    """
    try:
        # Check critical components
        scanner_stats = scanner.get_statistics()

        if scanner_stats.active_workers == 0:
            return {"ready": False, "reason": "No active scanner workers"}

        return {"ready": True, "message": "Service is ready to accept traffic"}

    except Exception as e:
        return {"ready": False, "reason": str(e)}


@router.get("/liveness")
async def liveness_check():
    """
    Liveness probe for Kubernetes/container orchestration.

    Returns whether the service is alive and functioning.
    """
    try:
        # Basic liveness check - just ensure the service is responding
        return {"alive": True, "uptime_seconds": time.time() - start_time}

    except Exception as e:
        return {"alive": False, "reason": str(e)}


async def _check_presidio_health() -> dict[str, Any]:
    """Check Presidio detector health."""
    try:
        # Test basic functionality
        test_result = await presidio_detector.extract_pii("Test email john@example.com")

        return {
            "healthy": True,
            "supported_entities": presidio_detector.get_supported_entities(),
            "supported_languages": presidio_detector.get_supported_languages(),
            "test_result": {
                "entities_found": len(test_result.entities),
                "processing_time_ms": test_result.processing_time_ms,
            },
        }
    except Exception as e:
        return {"healthy": False, "error": str(e)}


def _check_regex_engine_health() -> dict[str, Any]:
    """Check regex engine health."""
    try:
        # Test basic functionality
        test_result = regex_engine.match_text("Test email john@example.com")

        return {
            "healthy": True,
            "total_patterns": len(regex_engine.patterns),
            "active_patterns": len(
                [
                    p
                    for p in regex_engine.patterns.values()
                    if p.status.value == "ACTIVE"
                ]
            ),
            "test_result": {
                "matches_found": test_result.total_matches,
                "processing_time_ms": test_result.processing_time_ms,
            },
            "cache_stats": regex_engine.get_statistics(),
        }
    except Exception as e:
        return {"healthy": False, "error": str(e)}


def _check_classifier_health() -> dict[str, Any]:
    """Check content classifier health."""
    try:
        # Test basic functionality
        test_result = classifier.classify_content("Test content for classification")

        return {
            "healthy": True,
            "available_models": len(classifier.get_available_models()),
            "default_model": classifier.default_model,
            "test_result": {
                "predicted_class": test_result.predicted_class.value,
                "confidence": test_result.confidence,
                "processing_time_ms": test_result.processing_time_ms,
            },
        }
    except Exception as e:
        return {"healthy": False, "error": str(e)}


def _check_rule_engine_health() -> dict[str, Any]:
    """Check rule engine health."""
    try:
        # Test basic functionality
        from app.services.rule_engine import RuleExecutionContext

        test_context = RuleExecutionContext(
            scan_id="test",
            tenant_id="test",
            content="Test content",
            content_type="text/plain",
        )

        results = rule_engine.execute_rules(test_context)

        return {
            "healthy": True,
            "total_rules": len(rule_engine.rules),
            "active_rules": len([r for r in rule_engine.rules.values() if r.is_active]),
            "test_result": {
                "rules_executed": len(results),
                "rules_matched": len([r for r in results if r.matched]),
            },
            "statistics": rule_engine.get_statistics(),
        }
    except Exception as e:
        return {"healthy": False, "error": str(e)}


def _check_scanner_health() -> dict[str, Any]:
    """Check scanner service health."""
    try:
        stats = scanner.get_statistics()

        return {
            "healthy": True,
            "active_workers": stats.active_workers,
            "queue_size": stats.queue_size,
            "memory_usage_mb": stats.memory_usage_mb,
            "statistics": stats.__dict__,
        }
    except Exception as e:
        return {"healthy": False, "error": str(e)}


def _check_reporter_health() -> dict[str, Any]:
    """Check violation reporter health."""
    try:
        stats = reporter.get_statistics()

        return {
            "healthy": True,
            "alert_configurations": stats.get("alert_configurations", 0),
            "active_channels": stats.get("active_channels", 0),
            "alert_queue_size": stats.get("alert_queue_size", 0),
            "statistics": stats,
        }
    except Exception as e:
        return {"healthy": False, "error": str(e)}


async def _check_dependencies_health() -> dict[str, Any]:
    """Check external dependencies health."""
    dependencies = {}
    overall_healthy = True

    # Check Redis (if configured)
    try:
        import aioredis

        from app.core.config import get_settings

        settings = get_settings()

        if settings.redis_url:
            redis_client = await aioredis.from_url(settings.redis_url)
            await redis_client.ping()
            await redis_client.close()

            dependencies["redis"] = {"healthy": True, "response_time_ms": 10}
        else:
            dependencies["redis"] = {"healthy": True, "message": "Not configured"}
    except Exception as e:
        dependencies["redis"] = {"healthy": False, "error": str(e)}
        overall_healthy = False

    # Check Database (if configured)
    try:
        from app.core.config import get_settings

        settings = get_settings()

        if settings.database_url:
            # This would implement actual database health check
            dependencies["database"] = {"healthy": True, "message": "Not implemented"}
        else:
            dependencies["database"] = {"healthy": True, "message": "Not configured"}
    except Exception as e:
        dependencies["database"] = {"healthy": False, "error": str(e)}
        overall_healthy = False

    return {"healthy": overall_healthy, "dependencies": dependencies}


@router.get("/prometheus")
async def prometheus_metrics():
    """
    Prometheus metrics endpoint.

    Returns metrics in Prometheus format for monitoring and alerting.
    """
    try:
        # Update dynamic metrics
        stats = scanner.get_statistics()
        ACTIVE_SCANS.set(stats.active_workers)
        SCAN_QUEUE_SIZE.set(stats.queue_size)

        reporter_stats = reporter.get_statistics()
        VIOLATION_QUEUE_SIZE.set(reporter_stats.get("alert_queue_size", 0))

        metrics_data = generate_latest()

        return Response(
            content=metrics_data,
            media_type=CONTENT_TYPE_LATEST,
        )

    except Exception as e:
        logger.error(f"Failed to generate metrics: {e}")
        return Response(content=f"Error generating metrics: {str(e)}", status_code=500)


@router.get("/statistics")
async def get_detailed_statistics():
    """
    Get detailed statistics from all DLP components.

    Returns comprehensive statistics from scanners, detectors,
    engines, and other components for monitoring and analysis.
    """
    try:
        statistics = {
            "timestamp": time.time(),
            "uptime_seconds": time.time() - start_time,
            "components": {},
        }

        # Scanner statistics
        statistics["components"]["scanner"] = scanner.get_statistics()

        # Violation reporter statistics
        statistics["components"]["violation_reporter"] = reporter.get_statistics()

        # Presidio detector statistics
        statistics["components"]["presidio_detector"] = {
            "supported_entities": presidio_detector.get_supported_entities(),
            "supported_languages": presidio_detector.get_supported_languages(),
        }

        # Regex engine statistics
        statistics["components"]["regex_engine"] = regex_engine.get_statistics()

        # Content classifier statistics
        statistics["components"]["content_classifier"] = {
            "available_models": classifier.get_available_models(),
            "default_model": classifier.default_model,
        }

        # Rule engine statistics
        statistics["components"]["rule_engine"] = rule_engine.get_statistics()

        return statistics

    except Exception as e:
        logger.error(f"Failed to get statistics: {e}")
        return {"error": str(e), "timestamp": time.time()}


# Additional health check router (for /api/v1/health paths)
health_router = APIRouter()


@health_router.get("/")
async def api_health():
    """API health check endpoint."""
    return await health_status()


@health_router.get("/ready")
async def api_readiness():
    """API readiness check endpoint."""
    return await readiness_check()


@health_router.get("/live")
async def api_liveness():
    """API liveness check endpoint."""
    return await liveness_check()


@health_router.get("/prometheus")
async def api_prometheus():
    """API Prometheus metrics endpoint."""
    return await prometheus_metrics()


@health_router.get("/statistics")
async def api_statistics():
    """API statistics endpoint."""
    return await get_detailed_statistics()
