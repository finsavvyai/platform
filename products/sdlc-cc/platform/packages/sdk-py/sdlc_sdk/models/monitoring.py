"""
Monitoring models for SDLC.ai SDK

Provides models for monitoring, metrics, health checks, and audit logs.
"""

from datetime import datetime
from typing import Optional, List, Dict, Any, Literal, Union
from pydantic import Field, validator

from .base import BaseModel, TimestampModel, ListResponseModel


class MetricData(BaseModel):
    """Metric data point model."""

    name: str = Field(..., description="Metric name")
    value: Union[float, int] = Field(..., description="Metric value")
    unit: str = Field("count", description="Metric unit")
    timestamp: datetime = Field(..., description="Metric timestamp")

    # Dimensions/labels
    labels: Dict[str, str] = Field(default_factory=dict, description="Metric labels")

    # Additional metadata
    metadata: Dict[str, Any] = Field(
        default_factory=dict, description="Additional data"
    )


class Metrics(BaseModel):
    """Metrics collection model."""

    tenant_id: str = Field(..., description="Tenant ID")
    period: str = Field(..., description="Metrics period")

    # API metrics
    api_requests: int = Field(0, description="API requests count")
    api_errors: int = Field(0, description="API errors count")
    average_response_time_ms: float = Field(0.0, description="Average response time")
    p95_response_time_ms: float = Field(
        0.0, description="95th percentile response time"
    )
    p99_response_time_ms: float = Field(
        0.0, description="99th percentile response time"
    )

    # User metrics
    active_users: int = Field(0, description="Active users")
    new_users: int = Field(0, description="New users")
    user_sessions: int = Field(0, description="User sessions")

    # Document metrics
    documents_uploaded: int = Field(0, description="Documents uploaded")
    documents_processed: int = Field(0, description="Documents processed")
    storage_used_bytes: int = Field(0, description="Storage used")

    # LLM metrics
    llm_calls: int = Field(0, description="LLM calls")
    llm_tokens_used: int = Field(0, description="LLM tokens used")
    llm_cost: float = Field(0.0, description="LLM cost")

    # RAG metrics
    rag_queries: int = Field(0, description="RAG queries")
    rag_response_time_ms: float = Field(0.0, description="RAG response time")
    rag_satisfaction_score: Optional[float] = Field(
        None, description="RAG satisfaction score"
    )

    # Vector metrics
    vector_searches: int = Field(0, description="Vector searches")
    vector_index_size: int = Field(0, description="Vector index size")
    vector_search_time_ms: float = Field(0.0, description="Vector search time")

    # Error rates
    error_rate: float = Field(0.0, description="Overall error rate")
    error_by_type: Dict[str, int] = Field(
        default_factory=dict, description="Errors by type"
    )

    # Timestamps
    collected_at: datetime = Field(..., description="Collection timestamp")

    @property
    def success_rate(self) -> float:
        """Calculate success rate."""
        if self.api_requests > 0:
            return ((self.api_requests - self.api_errors) / self.api_requests) * 100
        return 100.0


class HealthCheck(BaseModel):
    """Health check response model."""

    status: Literal["healthy", "degraded", "unhealthy"] = Field(
        ..., description="Overall health status"
    )
    timestamp: datetime = Field(..., description="Check timestamp")
    version: str = Field(..., description="Service version")
    uptime_seconds: float = Field(..., description="Service uptime")

    # Component status
    components: Dict[str, "HealthStatus"] = Field(..., description="Component health")

    # Dependencies
    dependencies: Dict[str, "HealthStatus"] = Field(
        default_factory=dict, description="Dependency health"
    )

    # Metrics
    metrics: Dict[str, Any] = Field(default_factory=dict, description="Health metrics")

    # Checks
    checks: List[Dict[str, Any]] = Field(
        default_factory=list, description="Health checks performed"
    )

    @property
    def is_healthy(self) -> bool:
        """Check if service is healthy."""
        return self.status == "healthy"

    @property
    def unhealthy_components(self) -> List[str]:
        """Get list of unhealthy components."""
        return [
            name
            for name, status in self.components.items()
            if status.status != "healthy"
        ]


class HealthStatus(BaseModel):
    """Component health status model."""

    status: Literal["healthy", "degraded", "unhealthy"] = Field(
        ..., description="Component status"
    )
    message: Optional[str] = Field(None, description="Status message")
    details: Dict[str, Any] = Field(default_factory=dict, description="Status details")
    last_check: datetime = Field(..., description="Last check timestamp")
    response_time_ms: Optional[float] = Field(None, description="Response time")

    @property
    def is_healthy(self) -> bool:
        """Check if component is healthy."""
        return self.status == "healthy"


class AuditLog(BaseModel):
    """Audit log entry model."""

    id: str = Field(..., description="Log ID")
    event_type: str = Field(..., description="Event type")
    action: str = Field(..., description="Action performed")

    # Actor
    user_id: Optional[str] = Field(None, description="User ID")
    tenant_id: str = Field(..., description="Tenant ID")
    api_key_id: Optional[str] = Field(None, description="API key ID")

    # Resource
    resource_type: str = Field(..., description="Resource type")
    resource_id: Optional[str] = Field(None, description="Resource ID")
    resource_name: Optional[str] = Field(None, description="Resource name")

    # Details
    description: str = Field(..., description="Event description")
    outcome: Literal["success", "failure", "partial"] = Field(
        ..., description="Event outcome"
    )
    error_message: Optional[str] = Field(None, description="Error message if failed")

    # Request info
    request_id: Optional[str] = Field(None, description="Request ID")
    ip_address: Optional[str] = Field(None, description="IP address")
    user_agent: Optional[str] = Field(None, description="User agent")

    # Changes
    changes: Dict[str, Any] = Field(default_factory=dict, description="Changes made")
    old_values: Dict[str, Any] = Field(
        default_factory=dict, description="Previous values"
    )
    new_values: Dict[str, Any] = Field(default_factory=dict, description="New values")

    # Timing
    timestamp: datetime = Field(..., description="Event timestamp")
    duration_ms: Optional[float] = Field(None, description="Operation duration")

    # Metadata
    metadata: Dict[str, Any] = Field(
        default_factory=dict, description="Additional metadata"
    )
    tags: List[str] = Field(default_factory=list, description="Event tags")

    @property
    def is_failure(self) -> bool:
        """Check if event was a failure."""
        return self.outcome == "failure"


class AuditEvent(BaseModel):
    """Audit event enumeration and definitions."""

    # Authentication events
    AUTH_LOGIN = "auth.login"
    AUTH_LOGOUT = "auth.logout"
    AUTH_TOKEN_REFRESH = "auth.token_refresh"
    AUTH_MFA_CHALLENGE = "auth.mfa_challenge"
    AUTH_PASSWORD_CHANGE = "auth.password_change"
    AUTH_PASSWORD_RESET = "auth.password_reset"

    # User events
    USER_CREATE = "user.create"
    USER_UPDATE = "user.update"
    USER_DELETE = "user.delete"
    USER_ACTIVATE = "user.activate"
    USER_DEACTIVATE = "user.deactivate"
    USER_PERMISSIONS_CHANGE = "user.permissions_change"

    # Tenant events
    TENANT_CREATE = "tenant.create"
    TENANT_UPDATE = "tenant.update"
    TENANT_DELETE = "tenant.delete"
    TENANT_USER_INVITE = "tenant.user_invite"
    TENANT_USER_REMOVE = "tenant.user_remove"

    # Document events
    DOCUMENT_UPLOAD = "document.upload"
    DOCUMENT_UPDATE = "document.update"
    DOCUMENT_DELETE = "document.delete"
    DOCUMENT_ACCESS = "document.access"
    DOCUMENT_DOWNLOAD = "document.download"

    # RAG events
    RAG_QUERY = "rag.query"
    RAG_DOCUMENT_INDEX = "rag.document_index"
    RAG_DOCUMENT_UNINDEX = "rag.document_unindex"

    # Policy events
    POLICY_CREATE = "policy.create"
    POLICY_UPDATE = "policy.update"
    POLICY_DELETE = "policy.delete"
    POLICY_DEPLOY = "policy.deploy"
    POLICY_VIOLATION = "policy.violation"

    # LLM events
    LLM_CHAT = "llm.chat"
    LLM_COMPLETION = "llm.completion"
    LLM_EMBEDDING = "llm.embedding"

    # System events
    SYSTEM_ERROR = "system.error"
    SYSTEM_MAINTENANCE = "system.maintenance"
    SYSTEM_BACKUP = "system.backup"
    SYSTEM_RESTORE = "system.restore"


class PerformanceMetrics(BaseModel):
    """Performance metrics model."""

    # Response times
    average_response_time_ms: float = Field(..., description="Average response time")
    p50_response_time_ms: float = Field(
        ..., description="50th percentile response time"
    )
    p90_response_time_ms: float = Field(
        ..., description="90th percentile response time"
    )
    p95_response_time_ms: float = Field(
        ..., description="95th percentile response time"
    )
    p99_response_time_ms: float = Field(
        ..., description="99th percentile response time"
    )

    # Throughput
    requests_per_second: float = Field(..., description="Requests per second")
    requests_per_minute: float = Field(..., description="Requests per minute")
    requests_per_hour: float = Field(..., description="Requests per hour")

    # Errors
    error_rate: float = Field(..., description="Error rate percentage")
    errors_by_status: Dict[int, int] = Field(
        default_factory=dict, description="Errors by status code"
    )

    # Resources
    cpu_usage_percent: float = Field(..., description="CPU usage percentage")
    memory_usage_mb: float = Field(..., description="Memory usage in MB")
    disk_usage_mb: float = Field(..., description="Disk usage in MB")
    network_io_mb: float = Field(..., description="Network I/O in MB")

    # Database
    db_connections: int = Field(..., description="Database connections")
    db_query_time_ms: float = Field(..., description="Average database query time")
    db_slow_queries: int = Field(..., description="Slow query count")

    # Cache
    cache_hit_rate: float = Field(..., description="Cache hit rate percentage")
    cache_size_mb: float = Field(..., description="Cache size in MB")

    # Timestamps
    collected_at: datetime = Field(..., description="Collection timestamp")
    period_minutes: int = Field(..., description="Collection period in minutes")

    @property
    def is_degraded(self) -> bool:
        """Check if performance is degraded."""
        return (
            self.error_rate > 1.0
            or self.p95_response_time_ms > 1000
            or self.cpu_usage_percent > 80
            or self.memory_usage_mb > 1024
        )


class Alert(BaseModel):
    """Alert model."""

    id: str = Field(..., description="Alert ID")
    name: str = Field(..., description="Alert name")
    description: str = Field(..., description="Alert description")

    # Severity
    severity: Literal["info", "warning", "error", "critical"] = Field(
        ..., description="Alert severity"
    )

    # Status
    status: Literal["open", "acknowledged", "resolved", "suppressed"] = Field(
        "open", description="Alert status"
    )

    # Source
    source: str = Field(..., description="Alert source")
    tenant_id: Optional[str] = Field(None, description="Tenant ID")

    # Timing
    triggered_at: datetime = Field(..., description="Trigger time")
    acknowledged_at: Optional[datetime] = Field(None, description="Acknowledgment time")
    resolved_at: Optional[datetime] = Field(None, description="Resolution time")

    # Details
    metric_name: Optional[str] = Field(None, description="Related metric name")
    threshold: Optional[float] = Field(None, description="Alert threshold")
    current_value: Optional[float] = Field(None, description="Current value")

    # Actions
    acknowledged_by: Optional[str] = Field(None, description="Acknowledged by")
    resolved_by: Optional[str] = Field(None, description="Resolved by")
    resolution_notes: Optional[str] = Field(None, description="Resolution notes")

    # Metadata
    labels: Dict[str, str] = Field(default_factory=dict, description="Alert labels")
    annotations: Dict[str, str] = Field(
        default_factory=dict, description="Alert annotations"
    )

    @property
    def is_active(self) -> bool:
        """Check if alert is active."""
        return self.status in ["open", "acknowledged"]

    @property
    def duration_minutes(self) -> float:
        """Calculate alert duration in minutes."""
        end_time = self.resolved_at or datetime.utcnow()
        return (end_time - self.triggered_at).total_seconds() / 60


class Dashboard(BaseModel):
    """Dashboard configuration model."""

    id: str = Field(..., description="Dashboard ID")
    name: str = Field(..., description="Dashboard name")
    description: Optional[str] = Field(None, description="Dashboard description")
    tenant_id: str = Field(..., description="Tenant ID")

    # Layout
    layout: Dict[str, Any] = Field(..., description="Dashboard layout")
    widgets: List[Dict[str, Any]] = Field(..., description="Dashboard widgets")

    # Settings
    refresh_interval_seconds: int = Field(60, description="Refresh interval")
    time_range: str = Field("1h", description="Default time range")

    # Access
    is_public: bool = Field(False, description="Public dashboard")
    shared_with: List[str] = Field(
        default_factory=list, description="Shared with users/roles"
    )

    # Metadata
    created_by: str = Field(..., description="Creator ID")
    created_at: datetime = Field(..., description="Creation time")
    updated_at: datetime = Field(..., description="Last update time")
    tags: List[str] = Field(default_factory=list, description="Dashboard tags")
