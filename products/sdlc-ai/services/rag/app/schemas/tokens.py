"""
Token Management Schemas.

This module provides comprehensive Pydantic schemas for token management,
cost tracking, budgeting, and billing operations.
"""

from datetime import datetime, timedelta
from decimal import Decimal
from typing import Any, Dict, List, Optional, Union
from enum import Enum

from pydantic import BaseModel, Field, validator


class TokenType(str, Enum):
    """Token types for different operations."""

    PROMPT = "prompt"
    COMPLETION = "completion"
    FUNCTION_CALL = "function_call"
    VISION = "vision"
    EMBEDDING = "embedding"
    TRANSCRIPTION = "transcription"
    TRANSLATION = "translation"


class ProviderType(str, Enum):
    """LLM provider types."""

    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    AZURE_OPENAI = "azure_openai"
    HUGGING_FACE = "hugging_face"
    COHERE = "cohere"
    GOOGLE = "google"
    MISTRAL = "mistrall"
    CUSTOM = "custom"


class TimePeriod(str, Enum):
    """Time periods for analysis."""

    HOURLY = "hourly"
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    YEARLY = "yearly"


class AlertSeverity(str, Enum):
    """Alert severity levels."""

    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


class BudgetStatus(str, Enum):
    """Budget status types."""

    ACTIVE = "active"
    EXHAUSTED = "exhausted"
    WARNING = "warning"
    SUSPENDED = "suspended"
    EXPIRED = "expired"


# Request/Response Schemas


class TokenUsageRequest(BaseModel):
    """Token usage tracking request."""

    provider: ProviderType
    model: str
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    cached_tokens: int = 0
    function_call_tokens: int = 0
    vision_tokens: int = 0

    # Request metadata
    tenant_id: Optional[str] = None
    user_id: Optional[str] = None
    request_id: Optional[str] = None
    session_id: Optional[str] = None
    operation_type: str = "chat_completion"
    request_duration_ms: Optional[int] = None
    success: bool = True
    error_code: Optional[str] = None
    error_message: Optional[str] = None

    # Additional metadata
    metadata: Dict[str, Any] = Field(default_factory=dict)
    tags: List[str] = Field(default_factory=list)
    region: Optional[str] = None

    @validator("prompt_tokens", "completion_tokens", "total_tokens")
    def validate_tokens(cls, v):
        if v < 0:
            raise ValueError("Token counts must be non-negative")
        return v

    @validator("total_tokens")
    def validate_total_tokens(cls, v, values):
        if "prompt_tokens" in values and "completion_tokens" in values:
            expected = values["prompt_tokens"] + values["completion_tokens"]
            if v != expected:
                raise ValueError(
                    f"total_tokens ({v}) must equal prompt_tokens + completion_tokens ({expected})"
                )
        return v


class TokenUsageResponse(BaseModel):
    """Token usage tracking response."""

    id: str
    timestamp: datetime

    # Usage data
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    cached_tokens: int
    function_call_tokens: int
    vision_tokens: int

    # Cost data
    input_cost: Decimal
    output_cost: Decimal
    total_cost: Decimal
    currency: str = "USD"

    # Status
    success: bool
    processed_at: datetime


class TokenEstimateRequest(BaseModel):
    """Token estimation request."""

    text: str
    provider: ProviderType = ProviderType.OPENAI
    model: str = "gpt-3.5-turbo"

    class Config:
        schema_extra = {
            "example": {
                "text": "Hello, how are you today?",
                "provider": "openai",
                "model": "gpt-3.5-turbo",
            }
        }


class TokenEstimateResponse(BaseModel):
    """Token estimation response."""

    estimated_tokens: int
    provider: ProviderType
    model: str
    confidence: float = 0.8
    method_used: str = "character_based"


# Pricing Schemas


class TokenPricing(BaseModel):
    """Token pricing configuration."""

    provider: ProviderType
    model: str
    input_token_price: Decimal  # Price per 1K input tokens
    output_token_price: Decimal  # Price per 1K output tokens
    currency: str = "USD"
    effective_date: datetime

    # Optional tier pricing
    tier_quantities: Optional[Dict[str, int]] = None
    tier_input_prices: Optional[Dict[str, Decimal]] = None
    tier_output_prices: Optional[Dict[str, Decimal]] = None

    # Model limits
    context_window: Optional[int] = None
    max_output_tokens: Optional[int] = None

    @validator("input_token_price", "output_token_price")
    def validate_prices(cls, v):
        if v < 0:
            raise ValueError("Prices must be non-negative")
        return v


class PricingUpdateRequest(BaseModel):
    """Pricing update request."""

    input_token_price: Optional[Decimal] = None
    output_token_price: Optional[Decimal] = None
    currency: Optional[str] = None
    tier_quantities: Optional[Dict[str, int]] = None
    tier_input_prices: Optional[Dict[str, Decimal]] = None
    tier_output_prices: Optional[Dict[str, Decimal]] = None
    context_window: Optional[int] = None
    max_output_tokens: Optional[int] = None

    @validator("input_token_price", "output_token_price")
    def validate_prices(cls, v):
        if v is not None and v < 0:
            raise ValueError("Prices must be non-negative")
        return v


# Quota Schemas


class TokenQuota(BaseModel):
    """Token quota configuration."""

    tenant_id: str
    quota_type: str  # hourly, daily, weekly, monthly, yearly
    user_id: Optional[str] = None

    # Limits
    prompt_token_limit: Optional[int] = None
    completion_token_limit: Optional[int] = None
    total_token_limit: Optional[int] = None
    cost_limit: Optional[Decimal] = None

    # Current usage
    prompt_tokens_used: int = 0
    completion_tokens_used: int = 0
    total_tokens_used: int = 0
    cost_used: Decimal = Decimal("0")

    # Settings
    enabled: bool = True
    warn_threshold: float = 0.8  # Warn at 80% usage
    hard_limit: bool = True
    auto_renew: bool = False

    # Time period
    start_date: datetime
    end_date: Optional[datetime] = None
    reset_interval: Optional[timedelta] = None

    @validator("warn_threshold")
    def validate_warn_threshold(cls, v):
        if not 0 <= v <= 1:
            raise ValueError("warn_threshold must be between 0 and 1")
        return v

    def usage_percentage(self, metric: str = "total_tokens") -> float:
        """Calculate usage percentage for a metric."""
        limits = {
            "prompt_tokens": self.prompt_token_limit,
            "completion_tokens": self.completion_token_limit,
            "total_tokens": self.total_token_limit,
            "cost": float(self.cost_limit) if self.cost_limit else None,
        }

        used = {
            "prompt_tokens": self.prompt_tokens_used,
            "completion_tokens": self.completion_tokens_used,
            "total_tokens": self.total_tokens_used,
            "cost": float(self.cost_used),
        }

        limit = limits.get(metric)
        if limit is None or limit == 0:
            return 0.0

        return min(100.0, (used[metric] / limit) * 100.0)


class QuotaCreateRequest(BaseModel):
    """Quota creation request."""

    tenant_id: str
    quota_type: str
    user_id: Optional[str] = None

    # Limits
    prompt_token_limit: Optional[int] = None
    completion_token_limit: Optional[int] = None
    total_token_limit: Optional[int] = None
    cost_limit: Optional[Decimal] = None

    # Settings
    enabled: bool = True
    warn_threshold: float = 0.8
    hard_limit: bool = True
    auto_renew: bool = False

    # Time period
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    reset_interval_seconds: Optional[int] = None

    @validator("warn_threshold")
    def validate_warn_threshold(cls, v):
        if not 0 <= v <= 1:
            raise ValueError("warn_threshold must be between 0 and 1")
        return v

    @validator("prompt_token_limit", "completion_token_limit", "total_token_limit")
    def validate_limits(cls, v):
        if v is not None and v < 0:
            raise ValueError("Token limits must be non-negative")
        return v

    @validator("cost_limit")
    def validate_cost_limit(cls, v):
        if v is not None and v < 0:
            raise ValueError("Cost limit must be non-negative")
        return v


class QuotaUpdateRequest(BaseModel):
    """Quota update request."""

    prompt_token_limit: Optional[int] = None
    completion_token_limit: Optional[int] = None
    total_token_limit: Optional[int] = None
    cost_limit: Optional[Decimal] = None

    enabled: Optional[bool] = None
    warn_threshold: Optional[float] = None
    hard_limit: Optional[bool] = None
    auto_renew: Optional[bool] = None

    end_date: Optional[datetime] = None
    reset_interval_seconds: Optional[int] = None


# Budget Schemas


class BudgetLimit(BaseModel):
    """Budget limit configuration."""

    budget_type: str
    amount: Decimal
    currency: str = "USD"
    token_limit: Optional[int] = None
    request_limit: Optional[int] = None

    # Time period
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None

    # Usage tracking
    amount_used: Decimal = Decimal("0")
    tokens_used: int = 0
    requests_used: int = 0

    # Settings
    enabled: bool = True
    soft_limit: bool = False
    warn_threshold: float = 0.8
    critical_threshold: float = 0.95

    @validator("amount")
    def validate_amount(cls, v):
        if v <= 0:
            raise ValueError("Budget amount must be positive")
        return v

    @validator("warn_threshold", "critical_threshold")
    def validate_thresholds(cls, v):
        if not 0 <= v <= 1:
            raise ValueError("Thresholds must be between 0 and 1")
        return v


class BudgetPolicy(BaseModel):
    """Budget enforcement policy."""

    tenant_id: str
    name: str
    description: Optional[str] = None

    # Budget limits
    limits: List[BudgetLimit] = []

    # Enforcement actions
    warning_action: str = "notification"
    critical_action: str = "throttle"
    exhausted_action: str = "block"

    # Escalation settings
    escalation_enabled: bool = False
    escalation_emails: List[str] = []
    escalation_webhooks: List[str] = []

    # Throttling settings
    throttle_rate_limit: Optional[int] = None
    throttle_token_limit: Optional[int] = None

    # Notification settings
    notification_channels: List[str] = []
    notification_cooldown: int = 300

    # Metadata
    created_at: datetime
    updated_at: datetime
    created_by: Optional[str] = None
    tags: List[str] = []


# Analytics Schemas


class TokenMetrics(BaseModel):
    """Token usage metrics."""

    total_tokens: int = 0
    prompt_tokens: int = 0
    completion_tokens: int = 0
    cached_tokens: int = 0
    function_call_tokens: int = 0
    vision_tokens: int = 0

    total_cost: Decimal = Decimal("0")
    input_cost: Decimal = Decimal("0")
    output_cost: Decimal = Decimal("0")

    total_requests: int = 0
    successful_requests: int = 0
    failed_requests: int = 0
    avg_request_duration_ms: float = 0.0

    provider_breakdown: Dict[str, Dict[str, Union[int, float, Decimal]]] = {}
    model_breakdown: Dict[str, Dict[str, Union[int, float, Decimal]]] = {}
    operation_breakdown: Dict[str, Dict[str, Union[int, float, Decimal]]] = {}

    period: str = "daily"
    start_time: datetime
    end_time: datetime

    class Config:
        arbitrary_types_allowed = True


class UsageAnalyticsRequest(BaseModel):
    """Usage analytics request."""

    tenant_id: Optional[str] = None
    user_id: Optional[str] = None
    period: TimePeriod = TimePeriod.DAILY
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None

    # Options
    include_forecasts: bool = True
    include_patterns: bool = True
    include_attribution: bool = True
    include_comparisons: bool = True


class CostOptimizationRequest(BaseModel):
    """Cost optimization request."""

    tenant_id: str
    operation_type: str = "chat_completion"
    estimated_tokens: Optional[int] = None
    preferred_quality: str = "standard"  # low, standard, high
    max_response_time_ms: Optional[int] = None
    current_provider: Optional[ProviderType] = None
    current_model: Optional[str] = None
    request_id: Optional[str] = None
    user_id: Optional[str] = None


class CostOptimizationResponse(BaseModel):
    """Cost optimization response."""

    request_id: Optional[str]
    tenant_id: str

    # Recommendation
    recommended_provider: Optional[ProviderType]
    recommended_model: Optional[str]
    alternative_options: List[Dict[str, Any]] = []

    # Cost analysis
    estimated_cost_savings: Decimal
    cost_difference_percentage: float

    # Performance analysis
    performance_impact: str  # positive, neutral, negative
    response_time_impact_ms: float

    # Confidence and reasoning
    confidence_score: float
    reasoning: List[str]
    applicable_rules: List[str]

    # Metadata
    generated_at: datetime
    expires_at: Optional[datetime]


# Alert Schemas


class AlertRequest(BaseModel):
    """Alert creation request."""

    alert_type: str
    tenant_id: str
    title: str
    message: str
    severity: AlertSeverity = AlertSeverity.WARNING
    context: Optional[Dict[str, Any]] = None
    metrics: Optional[Dict[str, Union[str, int, float, Decimal]]] = None
    correlation_id: Optional[str] = None
    tags: Optional[List[str]] = None


class AlertResponse(BaseModel):
    """Alert response."""

    id: str
    rule_id: str
    tenant_id: str
    alert_type: str
    severity: AlertSeverity
    status: str

    title: str
    message: str
    description: str

    context: Dict[str, Any]
    metrics: Dict[str, Union[str, int, float, Decimal]]

    triggered_at: datetime
    acknowledged_at: Optional[datetime]
    resolved_at: Optional[datetime]

    acknowledged_by: Optional[str]
    resolved_by: Optional[str]
    resolution_notes: Optional[str]

    notifications_sent: List[Dict[str, Any]]
    escalation_count: int

    tags: List[str]
    correlation_id: Optional[str]


class AlertRule(BaseModel):
    """Alert rule configuration."""

    name: str
    description: Optional[str] = None
    enabled: bool = True

    # Rule conditions
    tenant_ids: List[str] = []
    alert_types: List[str] = []
    severity_threshold: Optional[AlertSeverity] = None

    # Conditions
    budget_threshold_percentage: Optional[float] = None
    cost_increase_percentage: Optional[float] = None
    usage_spike_multiplier: Optional[float] = None
    anomaly_detection_sensitivity: float = 2.0

    # Notification settings
    notification_channels: List[str] = []
    notification_emails: List[str] = []
    notification_webhooks: List[str] = []
    notification_slack_channels: List[str] = []

    # Suppression and deduplication
    cooldown_minutes: int = 60
    suppression_rules: List[str] = []
    deduplication_window_minutes: int = 15

    # Escalation settings
    escalation_enabled: bool = False
    escalation_channels: List[str] = []
    escalation_delay_minutes: int = 30
    max_escalations: int = 3

    # Metadata
    created_at: datetime
    created_by: Optional[str] = None
    tags: List[str] = []
    priority: int = 0


# Billing Schemas


class InvoiceItem(BaseModel):
    """Invoice line item."""

    description: str
    quantity: int
    unit_price: Decimal
    total_price: Decimal

    # Item details
    provider: Optional[str] = None
    model: Optional[str] = None
    token_type: Optional[str] = None
    usage_period: Optional[str] = None


class Invoice(BaseModel):
    """Invoice model."""

    id: str
    tenant_id: str
    invoice_number: str

    # Invoice details
    currency: str = "USD"
    subtotal: Decimal
    tax_amount: Decimal = Decimal("0")
    total_amount: Decimal

    # Period
    billing_period_start: datetime
    billing_period_end: datetime
    due_date: datetime

    # Status
    status: str  # draft, sent, paid, overdue, cancelled
    paid_at: Optional[datetime] = None

    # Items
    items: List[InvoiceItem] = []

    # Contact information
    billing_email: Optional[str] = None
    billing_address: Optional[Dict[str, str]] = None

    # Metadata
    created_at: datetime
    updated_at: datetime
    notes: Optional[str] = None


class BillingSummary(BaseModel):
    """Billing summary for a period."""

    tenant_id: str
    period: str
    start_date: datetime
    end_date: datetime

    # Cost breakdown
    total_cost: Decimal
    usage_cost: Decimal
    fixed_fees: Decimal
    discounts: Decimal
    taxes: Decimal

    # Usage metrics
    total_tokens: int
    total_requests: int

    # Provider breakdown
    provider_costs: Dict[str, Decimal]

    # Status
    invoice_generated: bool = False
    invoice_id: Optional[str] = None
    payment_status: str = "pending"


# Configuration Schemas


class ProviderConfig(BaseModel):
    """Provider configuration."""

    name: ProviderType
    enabled: bool = True
    priority: int = 1
    timeout: int = 30
    max_retries: int = 3

    # API settings
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    organization: Optional[str] = None

    # Model settings
    default_model: Optional[str] = None
    supported_models: List[str] = []

    # Rate limiting
    max_requests_per_minute: Optional[int] = None
    max_concurrent_requests: Optional[int] = None


class TokenSystemConfig(BaseModel):
    """Token system configuration."""

    # General settings
    enabled: bool = True
    default_currency: str = "USD"
    cost_precision: int = 6

    # Provider configurations
    providers: List[ProviderConfig] = []

    # Budget and alerts
    default_daily_limit: Optional[float] = None
    default_monthly_limit: Optional[float] = None
    budget_alerts_enabled: bool = True

    # Analytics settings
    analytics_retention_days: int = 90
    report_generation_enabled: bool = True

    # Monitoring settings
    monitoring_enabled: bool = True
    metrics_interval: int = 60

    # Security settings
    audit_logging_enabled: bool = True
    data_encryption_enabled: bool = True

    # Configuration metadata
    version: str = "1.0.0"
    last_updated: datetime
    updated_by: Optional[str] = None


# Response Wrapper Schemas


class APIResponse(BaseModel):
    """Standard API response wrapper."""

    success: bool
    message: str
    data: Optional[Any] = None
    errors: Optional[List[str]] = None
    metadata: Optional[Dict[str, Any]] = None


class PaginatedResponse(BaseModel):
    """Paginated response wrapper."""

    success: bool
    message: str
    data: List[Any]
    pagination: Dict[str, Any]
    metadata: Optional[Dict[str, Any]] = None


# Error Schemas


class ErrorResponse(BaseModel):
    """Error response model."""

    error: str
    message: str
    details: Optional[Dict[str, Any]] = None
    timestamp: datetime = Field(default_factory=datetime.now)
    request_id: Optional[str] = None


class ValidationError(BaseModel):
    """Validation error details."""

    field: str
    message: str
    value: Any


class ValidationErrorResponse(BaseModel):
    """Validation error response."""

    error: str = "validation_error"
    message: str = "Request validation failed"
    validation_errors: List[ValidationError]
    timestamp: datetime = Field(default_factory=datetime.now)
    request_id: Optional[str] = None
