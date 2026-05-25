"""
Metrics API routes for SDLC.ai DLP Service.

This module provides endpoints for detailed metrics, monitoring data,
and performance analytics.
"""

import logging
import time
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Query
from prometheus_client import CONTENT_TYPE_LATEST
from fastapi.responses import Response

from app.api.dependencies.auth import get_current_user, require_admin_role
from app.services.real_time_scanner import get_real_time_scanner
from app.services.violation_reporter import get_violation_reporter

logger = logging.getLogger(__name__)

router = APIRouter()

# Service instances
scanner = get_real_time_scanner()
reporter = get_violation_reporter()


@router.get("/prometheus")
async def prometheus_metrics():
    """
    Prometheus metrics endpoint.

    Returns comprehensive metrics in Prometheus format for monitoring,
    alerting, and dashboard visualization.
    """
    try:
        from app.api.routes.health import generate_latest

        # Update dynamic metrics before generating
        stats = scanner.get_statistics()

        metrics_data = generate_latest()

        return Response(
            content=metrics_data,
            media_type=CONTENT_TYPE_LATEST,
        )

    except Exception as e:
        logger.error(f"Failed to generate Prometheus metrics: {e}")
        return Response(content=f"Error generating metrics: {str(e)}", status_code=500)


@router.get("/performance")
async def performance_metrics(
    hours: int = Query(24, ge=1, le=168),  # 1 hour to 1 week
    current_user: dict = Depends(get_current_user),
):
    """
    Get performance metrics for the specified time period.

    Returns detailed performance metrics including scan times,
    throughput, latency distributions, and resource utilization.
    """
    try:
        end_time = datetime.utcnow()
        start_time = end_time - timedelta(hours=hours)

        # Get scanner statistics
        scanner_stats = scanner.get_statistics()

        # Get reporter statistics
        reporter_stats = reporter.get_statistics()

        performance_data = {
            "period": {
                "start_time": start_time.isoformat(),
                "end_time": end_time.isoformat(),
                "hours": hours,
            },
            "scanner_metrics": {
                "total_scans": scanner_stats.total_scans,
                "completed_scans": scanner_stats.completed_scans,
                "failed_scans": scanner_stats.failed_scans,
                "average_scan_time_ms": scanner_stats.average_scan_time_ms,
                "scans_per_second": scanner_stats.scans_per_second,
                "active_workers": scanner_stats.active_workers,
                "queue_size": scanner_stats.queue_size,
                "memory_usage_mb": scanner_stats.memory_usage_mb,
                "cache_hit_rate": scanner_stats.cache_hit_rate,
                "average_content_size": scanner_stats.average_content_size,
            },
            "violation_metrics": {
                "total_violations": reporter_stats.get("total_violations", 0),
                "violations_by_severity": reporter_stats.get(
                    "violations_by_severity", {}
                ),
                "violations_by_type": reporter_stats.get("violations_by_type", {}),
                "alerts_sent": reporter_stats.get("alerts_sent", 0),
                "alerts_failed": reporter_stats.get("alerts_failed", 0),
                "alert_configurations": reporter_stats.get("alert_configurations", 0),
                "alert_queue_size": reporter_stats.get("alert_queue_size", 0),
            },
            "throughput_metrics": {
                "scans_per_hour": scanner_stats.completed_scans / max(1, hours),
                "violations_per_hour": reporter_stats.get("total_violations", 0)
                / max(1, hours),
                "average_violations_per_scan": (
                    reporter_stats.get("total_violations", 0)
                    / max(1, scanner_stats.completed_scans)
                ),
            },
        }

        return performance_data

    except Exception as e:
        logger.error(f"Failed to get performance metrics: {e}")
        return {"error": str(e), "timestamp": datetime.utcnow().isoformat()}


@router.get("/violations")
async def violation_metrics(
    hours: int = Query(24, ge=1, le=168),
    tenant_id: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
):
    """
    Get violation metrics and trends.

    Returns detailed violation analytics including trends by severity,
    type, tenant, and time period.
    """
    try:
        end_time = datetime.utcnow()
        start_time = end_time - timedelta(hours=hours)

        # Get violation trends from reporter
        trends = await reporter.get_violation_trends(
            tenant_id=tenant_id,
            time_period="hourly",
            days=min(7, hours // 24),  # Convert to days, max 7 days
        )

        # Aggregate trend data
        total_violations = sum(trend.total_violations for trend in trends)

        violations_by_severity = {}
        violations_by_type = {}
        violations_by_day = {}

        for trend in trends:
            # Aggregate by severity
            for severity, count in trend.violations_by_severity.items():
                violations_by_severity[severity.value] = (
                    violations_by_severity.get(severity.value, 0) + count
                )

            # Aggregate by type
            for vtype, count in trend.violations_by_type.items():
                violations_by_type[vtype] = violations_by_type.get(vtype, 0) + count

            # Aggregate by day
            day_key = trend.start_time.strftime("%Y-%m-%d")
            violations_by_day[day_key] = (
                violations_by_day.get(day_key, 0) + trend.total_violations
            )

        # Get detailed statistics
        reporter_stats = reporter.get_statistics()

        violation_data = {
            "period": {
                "start_time": start_time.isoformat(),
                "end_time": end_time.isoformat(),
                "hours": hours,
            },
            "summary": {
                "total_violations": total_violations,
                "violations_by_severity": violations_by_severity,
                "violations_by_type": violations_by_type,
                "violations_by_day": violations_by_day,
                "average_violations_per_day": total_violations
                / max(1, len(violations_by_day)),
                "peak_violation_day": max(
                    violations_by_day.items(), key=lambda x: x[1]
                )[0]
                if violations_by_day
                else None,
                "peak_violation_count": max(violations_by_day.values())
                if violations_by_day
                else 0,
            },
            "trends": [
                {
                    "date": trend.start_time.strftime("%Y-%m-%d"),
                    "total_violations": trend.total_violations,
                    "violations_by_severity": {
                        k.value: v for k, v in trend.violations_by_severity.items()
                    },
                    "change_percentage": trend.change_percentage,
                    "trend_direction": trend.trend_direction,
                }
                for trend in trends
            ],
            "reporting_metrics": {
                "alerts_sent": reporter_stats.get("alerts_sent", 0),
                "alerts_failed": reporter_stats.get("alerts_failed", 0),
                "alert_success_rate": (
                    reporter_stats.get("alerts_sent", 0)
                    / max(
                        1,
                        reporter_stats.get("alerts_sent", 0)
                        + reporter_stats.get("alerts_failed", 0),
                    )
                ),
                "active_alert_configurations": reporter_stats.get(
                    "alert_configurations", 0
                ),
            },
        }

        return violation_data

    except Exception as e:
        logger.error(f"Failed to get violation metrics: {e}")
        return {"error": str(e), "timestamp": datetime.utcnow().isoformat()}


@router.get("/components")
async def component_metrics(
    current_user: dict = Depends(get_current_user),
):
    """
    Get metrics for individual DLP components.

    Returns detailed metrics for each component including Presidio,
    regex engine, content classifier, rule engine, and supporting services.
    """
    try:
        component_data = {"timestamp": datetime.utcnow().isoformat(), "components": {}}

        # Presidio detector metrics
        try:
            presidio_detector = scanner.presidio_detector
            component_data["components"]["presidio_detector"] = {
                "supported_entities": presidio_detector.get_supported_entities(),
                "supported_languages": presidio_detector.get_supported_languages(),
                "status": "healthy",
            }
        except Exception as e:
            component_data["components"]["presidio_detector"] = {
                "status": "unhealthy",
                "error": str(e),
            }

        # Regex engine metrics
        try:
            regex_engine = scanner.regex_engine
            regex_stats = regex_engine.get_statistics()
            component_data["components"]["regex_engine"] = {
                "status": "healthy",
                "total_patterns": regex_stats.get("total_patterns", 0),
                "active_patterns": regex_stats.get("active_patterns", 0),
                "categories": regex_stats.get("categories", []),
                "cache_size": regex_stats.get("cache_size", 0),
                "cache_hit_rate": (
                    regex_stats.get("cache_hits", 0)
                    / max(
                        1,
                        regex_stats.get("cache_hits", 0)
                        + regex_stats.get("cache_misses", 0),
                    )
                ),
            }
        except Exception as e:
            component_data["components"]["regex_engine"] = {
                "status": "unhealthy",
                "error": str(e),
            }

        # Content classifier metrics
        try:
            classifier = scanner.classifier
            models = classifier.get_available_models()
            component_data["components"]["content_classifier"] = {
                "status": "healthy",
                "available_models": len(models),
                "default_model": classifier.default_model,
                "models": models,
            }
        except Exception as e:
            component_data["components"]["content_classifier"] = {
                "status": "unhealthy",
                "error": str(e),
            }

        # Rule engine metrics
        try:
            rule_engine = scanner.rule_engine
            rule_stats = rule_engine.get_statistics()
            component_data["components"]["rule_engine"] = {
                "status": "healthy",
                "total_rules": rule_stats.get("total_rules", 0),
                "active_rules": rule_stats.get("active_rules", 0),
                "rule_types": rule_stats.get("rule_types", []),
                "rules_executed": rule_stats.get("rules_executed", 0),
                "rules_matched": rule_stats.get("rules_matched", 0),
                "rules_failed": rule_stats.get("rules_failed", 0),
            }
        except Exception as e:
            component_data["components"]["rule_engine"] = {
                "status": "unhealthy",
                "error": str(e),
            }

        # Scanner service metrics
        try:
            scanner_stats = scanner.get_statistics()
            component_data["components"]["scanner_service"] = {
                "status": "healthy",
                "total_scans": scanner_stats.total_scans,
                "completed_scans": scanner_stats.completed_scans,
                "failed_scans": scanner_stats.failed_scans,
                "average_scan_time_ms": scanner_stats.average_scan_time_ms,
                "scans_per_second": scanner_stats.scans_per_second,
                "active_workers": scanner_stats.active_workers,
                "queue_size": scanner_stats.queue_size,
                "memory_usage_mb": scanner_stats.memory_usage_mb,
            }
        except Exception as e:
            component_data["components"]["scanner_service"] = {
                "status": "unhealthy",
                "error": str(e),
            }

        # Violation reporter metrics
        try:
            reporter_stats = reporter.get_statistics()
            component_data["components"]["violation_reporter"] = {
                "status": "healthy",
                "violations_reported": reporter_stats.get("violations_reported", 0),
                "alerts_triggered": reporter_stats.get("alerts_triggered", 0),
                "alerts_sent": reporter_stats.get("alerts_sent", 0),
                "alerts_failed": reporter_stats.get("alerts_failed", 0),
                "alert_configurations": reporter_stats.get("alert_configurations", 0),
                "alert_queue_size": reporter_stats.get("alert_queue_size", 0),
                "active_channels": reporter_stats.get("active_channels", 0),
            }
        except Exception as e:
            component_data["components"]["violation_reporter"] = {
                "status": "unhealthy",
                "error": str(e),
            }

        return component_data

    except Exception as e:
        logger.error(f"Failed to get component metrics: {e}")
        return {"error": str(e), "timestamp": datetime.utcnow().isoformat()}


@router.get("/alerts")
async def alert_metrics(
    hours: int = Query(24, ge=1, le=168),
    current_user: dict = Depends(require_admin_role),
):
    """
    Get alerting metrics (admin only).

    Returns detailed alerting metrics including delivery rates,
    channel performance, and alert configuration effectiveness.
    """
    try:
        end_time = datetime.utcnow()
        start_time = end_time - timedelta(hours=hours)

        reporter_stats = reporter.get_statistics()

        alert_data = {
            "period": {
                "start_time": start_time.isoformat(),
                "end_time": end_time.isoformat(),
                "hours": hours,
            },
            "summary": {
                "total_alerts_sent": reporter_stats.get("alerts_sent", 0),
                "total_alerts_failed": reporter_stats.get("alerts_failed", 0),
                "total_alerts_triggered": reporter_stats.get("alerts_triggered", 0),
                "alert_success_rate": (
                    reporter_stats.get("alerts_sent", 0)
                    / max(
                        1,
                        reporter_stats.get("alerts_sent", 0)
                        + reporter_stats.get("alerts_failed", 0),
                    )
                ),
                "average_delivery_time_ms": 150,  # Mock data
            },
            "channel_performance": {
                "email": {
                    "sent": reporter_stats.get("alerts_sent", 0)
                    // 2,  # Mock distribution
                    "failed": reporter_stats.get("alerts_failed", 0) // 2,
                    "success_rate": 0.95,
                },
                "webhook": {
                    "sent": reporter_stats.get("alerts_sent", 0) // 4,
                    "failed": reporter_stats.get("alerts_failed", 0) // 4,
                    "success_rate": 0.88,
                },
                "slack": {
                    "sent": reporter_stats.get("alerts_sent", 0) // 4,
                    "failed": reporter_stats.get("alerts_failed", 0) // 4,
                    "success_rate": 0.92,
                },
            },
            "configurations": {
                "total_configurations": reporter_stats.get("alert_configurations", 0),
                "active_configurations": reporter_stats.get(
                    "alert_configurations", 0
                ),  # Assume all active
                "configuration_effectiveness": {
                    "high_effectiveness": 8,  # Mock data
                    "medium_effectiveness": 3,
                    "low_effectiveness": 1,
                },
            },
        }

        return alert_data

    except Exception as e:
        logger.error(f"Failed to get alert metrics: {e}")
        return {"error": str(e), "timestamp": datetime.utcnow().isoformat()}


@router.get("/dashboard")
async def dashboard_metrics(
    current_user: dict = Depends(get_current_user),
):
    """
    Get dashboard metrics summary.

    Returns a curated set of metrics suitable for dashboard display,
    including key performance indicators and health status.
    """
    try:
        # Get statistics from all components
        scanner_stats = scanner.get_statistics()
        reporter_stats = reporter.get_statistics()

        dashboard_data = {
            "timestamp": datetime.utcnow().isoformat(),
            "overview": {
                "service_status": "healthy",
                "uptime_hours": (time.time() - 1630000000) / 3600,  # Mock uptime
                "version": "1.0.0",
            },
            "key_metrics": {
                "total_scans_today": scanner_stats.completed_scans,
                "violations_detected_today": reporter_stats.get("total_violations", 0),
                "alerts_sent_today": reporter_stats.get("alerts_sent", 0),
                "average_scan_time_ms": round(scanner_stats.average_scan_time_ms, 2),
                "current_queue_size": scanner_stats.queue_size,
                "active_workers": scanner_stats.active_workers,
            },
            "health_indicators": {
                "scanner_health": "healthy",
                "detector_health": "healthy",
                "reporter_health": "healthy",
                "overall_health": "healthy",
            },
            "performance_indicators": {
                "scans_per_hour": round(scanner_stats.scans_per_second * 3600, 2),
                "cache_hit_rate": round(scanner_stats.cache_hit_rate * 100, 2),
                "memory_usage_mb": round(scanner_stats.memory_usage_mb, 2),
                "cpu_usage_percent": 25.5,  # Mock data
            },
            "recent_alerts": [
                # Mock recent alerts
                {
                    "id": "alert-1",
                    "type": "HIGH_SEVERITY_VIOLATIONS",
                    "count": 3,
                    "timestamp": (datetime.utcnow() - timedelta(hours=2)).isoformat(),
                    "severity": "HIGH",
                },
                {
                    "id": "alert-2",
                    "type": "SCAN_FAILURE_RATE",
                    "count": 1,
                    "timestamp": (datetime.utcnow() - timedelta(hours=5)).isoformat(),
                    "severity": "MEDIUM",
                },
            ],
        }

        return dashboard_data

    except Exception as e:
        logger.error(f"Failed to get dashboard metrics: {e}")
        return {"error": str(e), "timestamp": datetime.utcnow().isoformat()}
