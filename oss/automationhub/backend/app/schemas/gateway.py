"""
Gateway API Schemas

This module contains Pydantic schemas for the API gateway endpoints including:
- API key management schemas
- Rate limiting schemas
- Analytics and reporting schemas
- Configuration management schemas
- Health check and monitoring schemas

Author: Claude Code Implementation
Task: 1.1.4 API Gateway Implementation
Updated: 2025-01-06
"""

from typing import Dict, List, Any, Optional, Union
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field, field_validator, model_validator, HttpUrl


class APIKeyScope(str, Enum):
    """API key scope options"""
    READ_ONLY = "read_only"
    READ_WRITE = "read_write"
    ADMIN = "admin"
    WORKFLOW_EXECUTE = "workflow_execute"
    DOCUMENT_ACCESS = "document_access"
    AGENT_CONTROL = "agent_control"
    INFRASTRUCTURE_MANAGE = "infrastructure_manage"
    SYSTEM_MONITOR = "system_monitor"


class APIKeyStatus(str, Enum):
    """API key status options"""
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"
    EXPIRED = "expired"
    REVOKED = "revoked"


# API Key Management Schemas

class APIKeyBase(BaseModel):
    """Base API key schema"""
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    scope: APIKeyScope
    permissions: List[str] = Field(default_factory=list)
    expires_at: Optional[datetime] = None
    rate_limit_per_minute: Optional[int] = Field(None, ge=1)
    rate_limit_per_hour: Optional[int] = Field(None, ge=1)
    rate_limit_per_day: Optional[int] = Field(None, ge=1)
    allowed_ip_addresses: List[str] = Field(default_factory=list)
    allowed_origins: List[str] = Field(default_factory=list)

    @field_validator('allowed_ip_addresses')
    @classmethod
    def validate_ip_addresses(cls, v):
        """Validate IP address format"""
        import ipaddress
        for ip in v:
            try:
                ipaddress.ip_address(ip)
            except ValueError:
                raise ValueError(f"Invalid IP address: {ip}")
        return v

    @field_validator('allowed_origins')
    @classmethod
    def validate_origins(cls, v):
        """Validate origin URLs"""
        for origin in v:
            if not origin.startswith(('http://', 'https://')):
                raise ValueError(f"Invalid origin URL: {origin}")
        return v


class APIKeyCreate(APIKeyBase):
    """Schema for creating API keys"""
    pass


class APIKeyUpdate(BaseModel):
    """Schema for updating API keys"""
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    permissions: Optional[List[str]] = None
    expires_at: Optional[datetime] = None
    rate_limit_per_minute: Optional[int] = Field(None, ge=1)
    rate_limit_per_hour: Optional[int] = Field(None, ge=1)
    rate_limit_per_day: Optional[int] = Field(None, ge=1)
    allowed_ip_addresses: Optional[List[str]] = None
    allowed_origins: Optional[List[str]] = None

    @field_validator('allowed_ip_addresses')
    @classmethod
    def validate_ip_addresses(cls, v):
        if v is not None:
            import ipaddress
            for ip in v:
                try:
                    ipaddress.ip_address(ip)
                except ValueError:
                    raise ValueError(f"Invalid IP address: {ip}")
        return v

    @field_validator('allowed_origins')
    @classmethod
    def validate_origins(cls, v):
        if v is not None:
            for origin in v:
                if not origin.startswith(('http://', 'https://')):
                    raise ValueError(f"Invalid origin URL: {origin}")
        return v


class APIKeyResponse(BaseModel):
    """Schema for API key responses"""
    id: str
    key_id: str
    key_prefix: str
    key: Optional[str] = None  # Only included during creation
    name: str
    description: Optional[str]
    scope: str
    permissions: List[str]
    status: str
    expires_at: Optional[datetime]
    created_at: datetime
    rate_limit_per_minute: Optional[int]
    rate_limit_per_hour: Optional[int]
    rate_limit_per_day: Optional[int]
    allowed_ip_addresses: List[str]
    allowed_origins: List[str]
    last_used_at: Optional[datetime]
    usage_count: int

    class Config:
        from_attributes = True


# Rate Limiting Schemas

class RateLimitConfig(BaseModel):
    """Rate limit configuration schema"""
    requests_per_minute: int = Field(..., ge=1)
    requests_per_hour: int = Field(..., ge=1)
    requests_per_day: int = Field(..., ge=1)
    burst_size: Optional[int] = Field(None, ge=1)
    algorithm: str = Field(default="sliding_window")
    penalty_factor: float = Field(default=1.0, ge=0.0)


class RateLimitStats(BaseModel):
    """Rate limit statistics schema"""
    identifier: str
    limit_type: str
    endpoint: Optional[str]
    limit: int
    remaining: int
    used: int
    reset_time: datetime
    algorithm: str
    retry_after: Optional[int]


class RateLimitPolicy(BaseModel):
    """Rate limit policy schema"""
    name: str
    description: Optional[str]
    default_limits: RateLimitConfig
    tier_limits: Dict[str, RateLimitConfig]
    endpoint_limits: Dict[str, RateLimitConfig]
    enabled: bool = True


# Analytics Schemas

class TimeWindow(str, Enum):
    """Time window options for analytics"""
    MINUTE = "minute"
    HOUR = "hour"
    DAY = "day"
    WEEK = "week"
    MONTH = "month"


class EndpointStats(BaseModel):
    """Endpoint statistics schema"""
    endpoint: str
    method: str
    total_requests: int
    avg_response_time_ms: float
    total_bytes_sent: int
    error_rate: float
    rate_limit_hits: int
    last_access: Optional[datetime]


class UserStats(BaseModel):
    """User statistics schema"""
    user_id: str
    total_requests: int
    unique_endpoints: int
    avg_response_time_ms: float
    total_bytes: int
    last_activity: Optional[datetime]


class ErrorAnalysis(BaseModel):
    """Error analysis schema"""
    time_window: str
    period: Dict[str, str]
    errors_by_status: List[Dict[str, Any]]
    top_error_messages: List[Dict[str, Any]]


class PerformanceMetrics(BaseModel):
    """Performance metrics schema"""
    time_window: str
    period: Dict[str, str]
    total_requests: int
    avg_response_time_ms: float
    min_response_time_ms: float
    max_response_time_ms: float
    error_rate: float
    throughput_rps: float
    total_bytes_transferred: int


class WebSocketStats(BaseModel):
    """WebSocket statistics schema"""
    active_connections: int
    total_connections_today: int
    average_connection_duration_seconds: float


class UsageReportRequest(BaseModel):
    """Usage report request schema"""
    user_id: Optional[str] = None
    organization_id: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    include_charts: bool = False
    format: str = Field(default="json", pattern="^(json|csv|pdf)$")

    @model_validator(mode='after')
    def validate_date_range(self):
        if self.end_date and self.start_date:
            if self.end_date <= self.start_date:
                raise ValueError('end_date must be after start_date')
        return self


class UsageReportResponse(BaseModel):
    """Usage report response schema"""
    report_period: Dict[str, str]
    summary: Dict[str, Any]
    endpoints: List[EndpointStats]
    users: List[UserStats]
    errors: ErrorAnalysis
    rate_limiting: Dict[str, Any]
    websockets: WebSocketStats
    generated_at: str


# Configuration Schemas

class CORSConfig(BaseModel):
    """CORS configuration schema"""
    allow_origins: List[str] = Field(default_factory=lambda: ["*"])
    allow_methods: List[str] = Field(default_factory=lambda: ["GET", "POST", "PUT", "DELETE", "OPTIONS"])
    allow_headers: List[str] = Field(default_factory=lambda: ["*"])
    allow_credentials: bool = True
    expose_headers: List[str] = Field(default_factory=list)
    max_age: int = Field(default=600)


class SecurityHeadersConfig(BaseModel):
    """Security headers configuration schema"""
    enable_hsts: bool = True
    hsts_max_age: int = Field(default=31536000)
    hsts_include_subdomains: bool = True
    hsts_preload: bool = False
    enable_csp: bool = True
    csp_policy: str = Field(default="default-src 'self'")
    enable_x_frame_options: bool = True
    x_frame_options: str = Field(default="DENY")
    enable_x_content_type_options: bool = True
    enable_x_xss_protection: bool = True
    enable_referrer_policy: bool = True
    referrer_policy: str = Field(default="strict-origin-when-cross-origin")


class MonitoringConfig(BaseModel):
    """Monitoring configuration schema"""
    enable_request_logging: bool = True
    enable_response_logging: bool = False
    enable_performance_metrics: bool = True
    enable_error_tracking: bool = True
    log_body_size_limit: int = Field(default=1024)
    log_header_size_limit: int = Field(default=2048)
    sampling_rate: float = Field(default=1.0, ge=0.0, le=1.0)
    sensitive_fields: List[str] = Field(default_factory=lambda: [
        "password", "token", "api_key", "secret", "authorization"
    ])


class GatewayPolicyConfig(BaseModel):
    """Gateway policy configuration schema"""
    security_level: str = Field(default="medium")
    cors: CORSConfig = Field(default_factory=CORSConfig)
    security_headers: SecurityHeadersConfig = Field(default_factory=SecurityHeadersConfig)
    monitoring: MonitoringConfig = Field(default_factory=MonitoringConfig)
    enable_websocket_proxy: bool = True
    enable_api_versioning: bool = True
    enable_request_transformation: bool = True
    enable_response_transformation: bool = True
    enable_ip_whitelisting: bool = True
    enable_rate_limiting: bool = True


class ConfigurationUpdate(BaseModel):
    """Configuration update schema"""
    security_level: Optional[str] = None
    cors: Optional[CORSConfig] = None
    security_headers: Optional[SecurityHeadersConfig] = None
    monitoring: Optional[MonitoringConfig] = None
    enable_websocket_proxy: Optional[bool] = None
    enable_api_versioning: Optional[bool] = None
    enable_request_transformation: Optional[bool] = None
    enable_response_transformation: Optional[bool] = None
    enable_ip_whitelisting: Optional[bool] = None
    enable_rate_limiting: Optional[bool] = None


# Health Check Schemas

class ComponentStatus(BaseModel):
    """Component status schema"""
    status: str
    last_check: Optional[datetime] = None
    error_message: Optional[str] = None
    metrics: Dict[str, Any] = Field(default_factory=dict)


class HealthCheckResponse(BaseModel):
    """Health check response schema"""
    status: str
    timestamp: datetime
    version: str
    components: Dict[str, Any]
    metrics: Dict[str, Any]


class GatewayStats(BaseModel):
    """Gateway statistics schema"""
    gateway: Dict[str, Any]
    performance: PerformanceMetrics
    errors: ErrorAnalysis
    rate_limiting: Dict[str, Any]
    websockets: WebSocketStats
    rate_limiter: Dict[str, Any]
    timestamp: datetime


# Alert Schemas

class AlertSeverity(str, Enum):
    """Alert severity levels"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class Alert(BaseModel):
    """Alert schema"""
    id: str
    type: str
    severity: AlertSeverity
    message: str
    value: Union[float, int, str]
    threshold: Union[float, int, str]
    timestamp: datetime
    resolved: bool = False
    resolved_at: Optional[datetime] = None


class AlertThresholds(BaseModel):
    """Alert thresholds configuration"""
    error_rate_threshold: float = Field(default=0.05, ge=0.0, le=1.0)
    response_time_threshold: float = Field(default=5000.0, ge=0.0)
    rate_limit_threshold: int = Field(default=100, ge=1)
    throughput_threshold: int = Field(default=10000, ge=1)
    memory_usage_threshold: float = Field(default=0.8, ge=0.0, le=1.0)
    cpu_usage_threshold: float = Field(default=0.8, ge=0.0, le=1.0)


# Version Management Schemas

class APIVersionInfo(BaseModel):
    """API version information schema"""
    version: str
    status: str
    introduced_at: datetime
    deprecated_at: Optional[datetime]
    sunset_at: Optional[datetime]
    description: str
    breaking_changes: List[str]
    features: Dict[str, bool]


class VersionPolicy(BaseModel):
    """Version policy schema"""
    default_version: str = Field(default="v1")
    supported_versions: List[str] = Field(default_factory=lambda: ["v1"])
    deprecated_versions: List[str] = Field(default_factory=list)
    sunset_versions: List[str] = Field(default_factory=list)
    versioning_strategy: str = Field(default="url_path")
    enforce_version: bool = True
    allow_unversioned: bool = False
    grace_period_days: int = Field(default=90)


# WebSocket Schemas

class WebSocketConnectionInfo(BaseModel):
    """WebSocket connection information schema"""
    connection_id: str
    user_id: str
    endpoint: str
    connected_at: datetime
    last_activity_at: datetime
    message_count: int
    bytes_sent: int
    bytes_received: int
    ip_address: str
    user_agent: str
    is_active: bool


class WebSocketConfig(BaseModel):
    """WebSocket configuration schema"""
    endpoint: str
    target_service: str
    target_url: HttpUrl
    allowed_origins: List[str] = Field(default_factory=list)
    max_connections_per_user: int = Field(default=100, ge=1)
    max_message_size: int = Field(default=1024 * 1024, ge=1)
    heartbeat_interval: int = Field(default=30, ge=1)
    heartbeat_timeout: int = Field(default=90, ge=1)
    enable_compression: bool = True
    enable_metrics: bool = True
    auth_required: bool = True


# Security Schemas

class SecurityContext(BaseModel):
    """Security context schema"""
    request_id: str
    ip_address: str
    user_agent: str
    origin: Optional[str]
    timestamp: datetime
    risk_score: float = Field(default=0.0, ge=0.0, le=1.0)
    security_flags: List[str] = Field(default_factory=list)


class AuthenticationResult(BaseModel):
    """Authentication result schema"""
    authenticated: bool
    user_id: Optional[str] = None
    api_key_id: Optional[str] = None
    organization_id: Optional[str] = None
    tier: str = "default"
    permissions: List[str] = Field(default_factory=list)
    method: str = "none"
    expires_at: Optional[datetime] = None
    rate_limit_multiplier: float = Field(default=1.0, ge=0.0)
    metadata: Dict[str, Any] = Field(default_factory=dict)


# Transform Schemas

class TransformationRule(BaseModel):
    """Transformation rule schema"""
    name: str
    type: str
    enabled: bool = True
    priority: int = Field(default=100)
    conditions: Dict[str, Any] = Field(default_factory=dict)
    config: Dict[str, Any] = Field(default_factory=dict)
    target_content_types: List[str] = Field(default_factory=list)
    exclude_content_types: List[str] = Field(default_factory=list)


class TransformationConfig(BaseModel):
    """Transformation configuration schema"""
    request_rules: List[TransformationRule] = Field(default_factory=list)
    response_rules: List[TransformationRule] = Field(default_factory=list)
    enable_request_sanitization: bool = True
    enable_response_filtering: bool = True
    enable_data_masking: bool = True
    sensitive_fields: List[str] = Field(default_factory=lambda: [
        "password", "token", "api_key", "secret", "authorization"
    ])