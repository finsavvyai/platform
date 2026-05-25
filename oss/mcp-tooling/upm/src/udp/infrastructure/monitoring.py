"""
Monitoring and observability setup for Universal Dependency Platform.

Enterprise-grade monitoring with Prometheus metrics, OpenTelemetry tracing,
and comprehensive health checks.
"""

import time

import structlog
from prometheus_client import Counter, Gauge, Histogram, Info
from udp.core.config import settings

logger = structlog.get_logger()

# Prometheus metrics
HTTP_REQUESTS_TOTAL = Counter(
    "udp_http_requests_total",
    "Total HTTP requests",
    ["method", "endpoint", "status_code"]
)

HTTP_REQUEST_DURATION = Histogram(
    "udp_http_request_duration_seconds",
    "HTTP request duration in seconds",
    ["method", "endpoint"]
)

DEPENDENCY_ANALYSES_TOTAL = Counter(
    "udp_dependency_analyses_total",
    "Total dependency analyses performed",
    ["organization", "ecosystem", "status"]
)

VULNERABILITY_SCANS_TOTAL = Counter(
    "udp_vulnerability_scans_total",
    "Total vulnerability scans performed",
    ["organization", "severity"]
)

WORKFLOW_EXECUTIONS_TOTAL = Counter(
    "udp_workflow_executions_total",
    "Total workflow executions",
    ["workflow_type", "status", "organization"]
)

WORKFLOW_DURATION = Histogram(
    "udp_workflow_duration_seconds",
    "Workflow execution duration in seconds",
    ["workflow_type", "organization"]
)

ACTIVE_WORKFLOWS = Gauge(
    "udp_active_workflows",
    "Number of currently active workflows",
    ["workflow_type", "organization"]
)

DATABASE_CONNECTIONS = Gauge(
    "udp_database_connections_active",
    "Number of active database connections"
)

REDIS_CONNECTIONS = Gauge(
    "udp_redis_connections_active",
    "Number of active Redis connections"
)

PACKAGE_REGISTRY_REQUESTS = Counter(
    "udp_package_registry_requests_total",
    "Total package registry requests",
    ["registry", "status"]
)

PACKAGE_REGISTRY_DURATION = Histogram(
    "udp_package_registry_request_duration_seconds",
    "Package registry request duration",
    ["registry"]
)

POLICY_EVALUATIONS_TOTAL = Counter(
    "udp_policy_evaluations_total",
    "Total policy evaluations",
    ["organization", "policy_type", "action"]
)

APPROVAL_REQUESTS_TOTAL = Counter(
    "udp_approval_requests_total",
    "Total approval requests",
    ["organization", "approval_type", "status"]
)

APPROVAL_DURATION = Histogram(
    "udp_approval_duration_seconds",
    "Time taken for approvals",
    ["organization", "approval_type"]
)

# Application info
APP_INFO = Info(
    "udp_app_info",
    "Application information"
)

# System metrics
SYSTEM_HEALTH = Gauge(
    "udp_system_health",
    "System health status (1=healthy, 0=unhealthy)",
    ["component"]
)


def setup_monitoring() -> None:
    """
    Initialize monitoring and observability.

    Sets up Prometheus metrics, OpenTelemetry tracing, and
    application-specific metrics collection.
    """
    logger.info("Setting up monitoring and observability")

    # Set application info
    APP_INFO.info({
        "version": settings.app_version,
        "environment": settings.environment,
        "app_name": settings.app_name.lower().replace(" ", "_")
    })

    # Initialize system health metrics
    SYSTEM_HEALTH.labels(component="database").set(0)
    SYSTEM_HEALTH.labels(component="redis").set(0)
    SYSTEM_HEALTH.labels(component="application").set(1)

    logger.info("Monitoring setup complete")


def record_http_request(method: str, endpoint: str, status_code: int, duration: float) -> None:
    """
    Record HTTP request metrics.

    Args:
        method: HTTP method
        endpoint: Request endpoint
        status_code: HTTP status code
        duration: Request duration in seconds
    """
    HTTP_REQUESTS_TOTAL.labels(
        method=method,
        endpoint=endpoint,
        status_code=status_code
    ).inc()

    HTTP_REQUEST_DURATION.labels(
        method=method,
        endpoint=endpoint
    ).observe(duration)


def record_dependency_analysis(organization: str, ecosystem: str, status: str) -> None:
    """
    Record dependency analysis metrics.

    Args:
        organization: Organization identifier
        ecosystem: Package ecosystem
        status: Analysis status (success/failure)
    """
    DEPENDENCY_ANALYSES_TOTAL.labels(
        organization=organization,
        ecosystem=ecosystem,
        status=status
    ).inc()


def record_vulnerability_scan(organization: str, severity: str) -> None:
    """
    Record vulnerability scan metrics.

    Args:
        organization: Organization identifier
        severity: Vulnerability severity
    """
    VULNERABILITY_SCANS_TOTAL.labels(
        organization=organization,
        severity=severity
    ).inc()


def record_workflow_execution(workflow_type: str, organization: str, status: str, duration: float = None) -> None:
    """
    Record workflow execution metrics.

    Args:
        workflow_type: Type of workflow
        organization: Organization identifier
        status: Workflow status
        duration: Execution duration in seconds (optional)
    """
    WORKFLOW_EXECUTIONS_TOTAL.labels(
        workflow_type=workflow_type,
        status=status,
        organization=organization
    ).inc()

    if duration is not None:
        WORKFLOW_DURATION.labels(
            workflow_type=workflow_type,
            organization=organization
        ).observe(duration)


def update_active_workflows(workflow_type: str, organization: str, count: int) -> None:
    """
    Update active workflow count.

    Args:
        workflow_type: Type of workflow
        organization: Organization identifier
        count: Current count of active workflows
    """
    ACTIVE_WORKFLOWS.labels(
        workflow_type=workflow_type,
        organization=organization
    ).set(count)


def record_registry_request(registry: str, status: str, duration: float) -> None:
    """
    Record package registry request metrics.

    Args:
        registry: Registry name (npm, pypi, etc.)
        status: Request status (success/failure)
        duration: Request duration in seconds
    """
    PACKAGE_REGISTRY_REQUESTS.labels(
        registry=registry,
        status=status
    ).inc()

    PACKAGE_REGISTRY_DURATION.labels(registry=registry).observe(duration)


def record_policy_evaluation(organization: str, policy_type: str, action: str) -> None:
    """
    Record policy evaluation metrics.

    Args:
        organization: Organization identifier
        policy_type: Type of policy
        action: Policy action taken
    """
    POLICY_EVALUATIONS_TOTAL.labels(
        organization=organization,
        policy_type=policy_type,
        action=action
    ).inc()


def record_approval_request(organization: str, approval_type: str, status: str, duration: float = None) -> None:
    """
    Record approval request metrics.

    Args:
        organization: Organization identifier
        approval_type: Type of approval
        status: Approval status
        duration: Approval duration in seconds (optional)
    """
    APPROVAL_REQUESTS_TOTAL.labels(
        organization=organization,
        approval_type=approval_type,
        status=status
    ).inc()

    if duration is not None:
        APPROVAL_DURATION.labels(
            organization=organization,
            approval_type=approval_type
        ).observe(duration)


def update_database_connections(count: int) -> None:
    """
    Update database connection count.

    Args:
        count: Current number of active connections
    """
    DATABASE_CONNECTIONS.set(count)


def update_redis_connections(count: int) -> None:
    """
    Update Redis connection count.

    Args:
        count: Current number of active connections
    """
    REDIS_CONNECTIONS.set(count)


def update_system_health(component: str, healthy: bool) -> None:
    """
    Update system health status.

    Args:
        component: System component name
        healthy: Health status (True=healthy, False=unhealthy)
    """
    SYSTEM_HEALTH.labels(component=component).set(1 if healthy else 0)


# Context manager for timing operations
class timer:
    """Context manager for timing operations and recording metrics."""

    def __init__(self, metric_recorder, *args, **kwargs):
        self.metric_recorder = metric_recorder
        self.args = args
        self.kwargs = kwargs
        self.start_time = None

    def __enter__(self):
        self.start_time = time.time()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        duration = time.time() - self.start_time
        self.metric_recorder(*self.args, duration=duration, **self.kwargs)
