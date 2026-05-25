"""
Structured Workflow Event Logger for Universal Dependency Platform.

Provides structured logging for all workflow lifecycle events with
Prometheus metrics integration and analytics service hooks.
"""

import logging
import time
from contextlib import asynccontextmanager
from typing import Any, Optional

from prometheus_client import Counter, Gauge, Histogram

logger = logging.getLogger(__name__)

# ── Prometheus Metrics ──────────────────────────────────────────

WORKFLOW_STARTED = Counter(
    "udp_workflow_started_total",
    "Total workflows started",
    ["workflow_type"],
)
WORKFLOW_COMPLETED = Counter(
    "udp_workflow_completed_total",
    "Total workflows completed",
    ["workflow_type", "status"],
)
WORKFLOW_DURATION = Histogram(
    "udp_workflow_duration_seconds",
    "Workflow execution duration in seconds",
    ["workflow_type"],
    buckets=[0.1, 0.5, 1, 2, 5, 10, 30, 60, 120, 300, 600],
)
WORKFLOW_STEP_DURATION = Histogram(
    "udp_workflow_step_duration_seconds",
    "Workflow step execution duration in seconds",
    ["workflow_type", "step_name"],
    buckets=[0.05, 0.1, 0.5, 1, 2, 5, 10, 30, 60],
)
WORKFLOW_ERRORS = Counter(
    "udp_workflow_errors_total",
    "Total workflow errors",
    ["workflow_type", "error_type"],
)
WORKFLOW_ACTIVE = Gauge(
    "udp_workflow_active_count",
    "Number of currently active workflows",
    ["workflow_type"],
)

# Security scan metrics
SECURITY_SCAN_TOTAL = Counter(
    "udp_security_scan_total",
    "Total security scans performed",
    ["ecosystem"],
)
SECURITY_SCAN_DURATION = Histogram(
    "udp_security_scan_duration_seconds",
    "Security scan duration in seconds",
    ["ecosystem"],
    buckets=[0.5, 1, 2, 5, 10, 30, 60, 120],
)
VULNERABILITIES_FOUND = Counter(
    "udp_vulnerabilities_found_total",
    "Total vulnerabilities found",
    ["severity", "ecosystem"],
)
POLICY_VIOLATIONS = Counter(
    "udp_policy_violations_total",
    "Total policy violations detected",
    ["severity", "policy_type"],
)


class WorkflowEventLogger:
    """
    Structured event logger for workflow lifecycle events.

    Emits structured log entries and updates Prometheus metrics
    for all workflow events. Optionally integrates with the
    AnalyticsService for trend analysis.
    """

    def __init__(self, analytics_service=None):
        """
        Args:
            analytics_service: Optional AnalyticsService instance for recording
                             events for trend analysis and dashboards.
        """
        self._analytics = analytics_service

    # ── Workflow Lifecycle Events ────────────────────────────────

    def workflow_started(
        self,
        workflow_id: str,
        workflow_type: str,
        project_id: str,
        metadata: Optional[dict[str, Any]] = None,
    ) -> None:
        """Log workflow start event."""
        logger.info(
            "Workflow started",
            extra={
                "event": "workflow_started",
                "workflow_id": workflow_id,
                "workflow_type": workflow_type,
                "project_id": project_id,
                **(metadata or {}),
            },
        )
        WORKFLOW_STARTED.labels(workflow_type=workflow_type).inc()
        WORKFLOW_ACTIVE.labels(workflow_type=workflow_type).inc()

    def workflow_completed(
        self,
        workflow_id: str,
        workflow_type: str,
        project_id: str,
        duration_ms: float,
        result_summary: Optional[dict[str, Any]] = None,
    ) -> None:
        """Log workflow completion event."""
        logger.info(
            "Workflow completed",
            extra={
                "event": "workflow_completed",
                "workflow_id": workflow_id,
                "workflow_type": workflow_type,
                "project_id": project_id,
                "duration_ms": duration_ms,
                **(result_summary or {}),
            },
        )
        WORKFLOW_COMPLETED.labels(workflow_type=workflow_type, status="completed").inc()
        WORKFLOW_DURATION.labels(workflow_type=workflow_type).observe(
            duration_ms / 1000
        )
        WORKFLOW_ACTIVE.labels(workflow_type=workflow_type).dec()

        if self._analytics:
            self._analytics.record_workflow_event(
                workflow_id=workflow_id,
                workflow_type=workflow_type,
                event_type="workflow_completed",
                duration_ms=duration_ms,
                status="completed",
                metadata=result_summary,
            )

    def workflow_failed(
        self,
        workflow_id: str,
        workflow_type: str,
        project_id: str,
        duration_ms: float,
        error: str,
        error_type: str = "unknown",
    ) -> None:
        """Log workflow failure event."""
        logger.error(
            "Workflow failed",
            extra={
                "event": "workflow_failed",
                "workflow_id": workflow_id,
                "workflow_type": workflow_type,
                "project_id": project_id,
                "duration_ms": duration_ms,
                "error": error,
                "error_type": error_type,
            },
        )
        WORKFLOW_COMPLETED.labels(workflow_type=workflow_type, status="failed").inc()
        WORKFLOW_DURATION.labels(workflow_type=workflow_type).observe(
            duration_ms / 1000
        )
        WORKFLOW_ERRORS.labels(workflow_type=workflow_type, error_type=error_type).inc()
        WORKFLOW_ACTIVE.labels(workflow_type=workflow_type).dec()

        if self._analytics:
            self._analytics.record_workflow_event(
                workflow_id=workflow_id,
                workflow_type=workflow_type,
                event_type="workflow_failed",
                duration_ms=duration_ms,
                status="failed",
                metadata={"error": error, "error_type": error_type},
            )

    # ── Step Lifecycle Events ────────────────────────────────────

    def step_started(
        self,
        workflow_id: str,
        workflow_type: str,
        step_name: str,
        metadata: Optional[dict[str, Any]] = None,
    ) -> None:
        """Log step start event."""
        logger.info(
            "Workflow step started",
            extra={
                "event": "step_started",
                "workflow_id": workflow_id,
                "workflow_type": workflow_type,
                "step_name": step_name,
                **(metadata or {}),
            },
        )

    def step_completed(
        self,
        workflow_id: str,
        workflow_type: str,
        step_name: str,
        duration_ms: float,
        metadata: Optional[dict[str, Any]] = None,
    ) -> None:
        """Log step completion event."""
        logger.info(
            "Workflow step completed",
            extra={
                "event": "step_completed",
                "workflow_id": workflow_id,
                "workflow_type": workflow_type,
                "step_name": step_name,
                "duration_ms": duration_ms,
                **(metadata or {}),
            },
        )
        WORKFLOW_STEP_DURATION.labels(
            workflow_type=workflow_type, step_name=step_name
        ).observe(duration_ms / 1000)

        if self._analytics:
            self._analytics.record_workflow_event(
                workflow_id=workflow_id,
                workflow_type=workflow_type,
                event_type="step_completed",
                step_name=step_name,
                duration_ms=duration_ms,
                status="completed",
                metadata=metadata,
            )

    def step_failed(
        self,
        workflow_id: str,
        workflow_type: str,
        step_name: str,
        duration_ms: float,
        error: str,
    ) -> None:
        """Log step failure event."""
        logger.error(
            "Workflow step failed",
            extra={
                "event": "step_failed",
                "workflow_id": workflow_id,
                "workflow_type": workflow_type,
                "step_name": step_name,
                "duration_ms": duration_ms,
                "error": error,
            },
        )
        WORKFLOW_STEP_DURATION.labels(
            workflow_type=workflow_type, step_name=step_name
        ).observe(duration_ms / 1000)
        WORKFLOW_ERRORS.labels(
            workflow_type=workflow_type, error_type="step_failure"
        ).inc()

    # ── Security Scan Events ─────────────────────────────────────

    def scan_started(
        self,
        project_id: str,
        ecosystem: str,
        package_count: int,
    ) -> None:
        """Log security scan start."""
        logger.info(
            "Security scan started",
            extra={
                "event": "scan_started",
                "project_id": project_id,
                "ecosystem": ecosystem,
                "package_count": package_count,
            },
        )
        SECURITY_SCAN_TOTAL.labels(ecosystem=ecosystem).inc()

    def scan_completed(
        self,
        project_id: str,
        ecosystem: str,
        duration_ms: float,
        total_vulns: int,
        severity_counts: dict[str, int],
    ) -> None:
        """Log security scan completion with results."""
        logger.info(
            "Security scan completed",
            extra={
                "event": "scan_completed",
                "project_id": project_id,
                "ecosystem": ecosystem,
                "duration_ms": duration_ms,
                "total_vulnerabilities": total_vulns,
                **{f"vuln_{k}": v for k, v in severity_counts.items()},
            },
        )
        SECURITY_SCAN_DURATION.labels(ecosystem=ecosystem).observe(duration_ms / 1000)
        for severity, count in severity_counts.items():
            VULNERABILITIES_FOUND.labels(severity=severity, ecosystem=ecosystem).inc(
                count
            )

        if self._analytics:
            for severity, count in severity_counts.items():
                for _ in range(count):
                    self._analytics.record_security_event(
                        event_type="vulnerability_discovered",
                        severity=severity,
                        ecosystem=ecosystem,
                    )

    def vulnerability_found(
        self,
        vuln_id: str,
        severity: str,
        package_name: str,
        ecosystem: str,
        cvss_score: Optional[float] = None,
    ) -> None:
        """Log individual vulnerability discovery."""
        logger.warning(
            "Vulnerability found",
            extra={
                "event": "vulnerability_found",
                "vulnerability_id": vuln_id,
                "severity": severity,
                "package_name": package_name,
                "ecosystem": ecosystem,
                "cvss_score": cvss_score,
            },
        )

    # ── Policy Events ────────────────────────────────────────────

    def policy_violation(
        self,
        policy_name: str,
        policy_type: str,
        severity: str,
        package_name: str,
        description: str,
    ) -> None:
        """Log policy violation detection."""
        logger.warning(
            "Policy violation detected",
            extra={
                "event": "policy_violation",
                "policy_name": policy_name,
                "policy_type": policy_type,
                "severity": severity,
                "package_name": package_name,
                "description": description,
            },
        )
        POLICY_VIOLATIONS.labels(severity=severity, policy_type=policy_type).inc()

        if self._analytics:
            self._analytics.record_security_event(
                event_type="policy_violation",
                severity=severity,
                package_name=package_name,
                metadata={"policy_name": policy_name, "policy_type": policy_type},
            )

    # ── Context Managers ─────────────────────────────────────────

    @asynccontextmanager
    async def track_workflow(
        self,
        workflow_id: str,
        workflow_type: str,
        project_id: str,
    ):
        """Context manager to track workflow execution with timing."""
        self.workflow_started(workflow_id, workflow_type, project_id)
        start = time.monotonic()
        try:
            yield
            duration_ms = (time.monotonic() - start) * 1000
            self.workflow_completed(workflow_id, workflow_type, project_id, duration_ms)
        except Exception as e:
            duration_ms = (time.monotonic() - start) * 1000
            self.workflow_failed(
                workflow_id,
                workflow_type,
                project_id,
                duration_ms,
                str(e),
                type(e).__name__,
            )
            raise

    @asynccontextmanager
    async def track_step(
        self,
        workflow_id: str,
        workflow_type: str,
        step_name: str,
    ):
        """Context manager to track step execution with timing."""
        self.step_started(workflow_id, workflow_type, step_name)
        start = time.monotonic()
        try:
            yield
            duration_ms = (time.monotonic() - start) * 1000
            self.step_completed(workflow_id, workflow_type, step_name, duration_ms)
        except Exception as e:
            duration_ms = (time.monotonic() - start) * 1000
            self.step_failed(
                workflow_id,
                workflow_type,
                step_name,
                duration_ms,
                str(e),
            )
            raise


# Global singleton for convenience
_default_logger: Optional[WorkflowEventLogger] = None


def get_workflow_logger(analytics_service=None) -> WorkflowEventLogger:
    """Get or create the global workflow event logger."""
    global _default_logger
    if _default_logger is None:
        _default_logger = WorkflowEventLogger(analytics_service)
    return _default_logger
