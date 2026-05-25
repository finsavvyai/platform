"""
LLM API Schemas.

This module contains Pydantic models for LLM API requests, responses,
and related data structures.
"""

import time
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Union

from pydantic import BaseModel, Field, validator


class MessageRole(str, Enum):
    """Message role enumeration."""

    SYSTEM = "system"
    USER = "user"
    ASSISTANT = "assistant"
    FUNCTION = "function"
    TOOL = "tool"


class ProviderStatus(str, Enum):
    """Provider status enumeration."""

    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNAVAILABLE = "unavailable"
    RATE_LIMITED = "rate_limited"
    ERROR = "error"


class SelectionStrategy(str, Enum):
    """Provider selection strategies."""

    PRIORITY = "priority"
    ROUND_ROBIN = "round_robin"
    COST_OPTIMIZED = "cost_optimized"
    PERFORMANCE_OPTIMIZED = "performance_optimized"
    LOAD_BALANCED = "load_balanced"
    HEALTH_AWARE = "health_aware"


# Request Schemas
class ChatMessage(BaseModel):
    """Chat message schema."""

    role: MessageRole = Field(..., description="Message role")
    content: str = Field(..., description="Message content")
    name: Optional[str] = Field(
        None, description="Optional name for function/tool calls"
    )
    function_call: Optional[Dict[str, Any]] = Field(
        None, description="Function call information"
    )
    tool_calls: Optional[List[Dict[str, Any]]] = Field(
        None, description="Tool call information"
    )
    tool_call_id: Optional[str] = Field(None, description="Tool call ID")

    @validator("role", pre=True)
    def validate_role(cls, v):
        """Validate role."""
        if isinstance(v, str):
            return MessageRole(v.lower())
        return v


class ChatTool(BaseModel):
    """Chat tool/function definition."""

    name: str = Field(..., description="Tool name")
    description: str = Field(..., description="Tool description")
    parameters: Dict[str, Any] = Field(..., description="Tool parameters schema")

    class Config:
        schema_extra = {
            "example": {
                "name": "get_weather",
                "description": "Get current weather information",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "location": {"type": "string", "description": "City name"}
                    },
                    "required": ["location"],
                },
            }
        }


class ChatCompletionRequest(BaseModel):
    """Chat completion request schema."""

    messages: List[ChatMessage] = Field(
        ..., description="List of messages in the conversation"
    )
    model: Optional[str] = Field(None, description="Model to use for completion")
    max_tokens: Optional[int] = Field(
        None, ge=1, le=8192, description="Maximum tokens to generate"
    )
    temperature: float = Field(0.7, ge=0.0, le=2.0, description="Sampling temperature")
    top_p: Optional[float] = Field(
        None, ge=0.0, le=1.0, description="Nucleus sampling parameter"
    )
    frequency_penalty: Optional[float] = Field(
        0.0, ge=-2.0, le=2.0, description="Frequency penalty"
    )
    presence_penalty: Optional[float] = Field(
        0.0, ge=-2.0, le=2.0, description="Presence penalty"
    )
    stop: Optional[Union[str, List[str]]] = Field(None, description="Stop sequences")
    stream: bool = Field(False, description="Whether to stream the response")
    tools: Optional[List[ChatTool]] = Field(
        None, description="Available tools/functions"
    )
    tool_choice: Optional[Union[str, Dict[str, Any]]] = Field(
        None, description="Tool choice strategy"
    )
    user: Optional[str] = Field(None, description="User identifier")
    tenant_id: Optional[str] = Field(
        None, description="Tenant identifier for multi-tenancy"
    )
    metadata: Optional[Dict[str, Any]] = Field(None, description="Additional metadata")

    @validator("messages")
    def validate_messages(cls, v):
        """Validate messages list."""
        if not v:
            raise ValueError("Messages list cannot be empty")
        return v

    @validator("temperature")
    def validate_temperature(cls, v):
        """Validate temperature."""
        if not 0.0 <= v <= 2.0:
            raise ValueError("Temperature must be between 0.0 and 2.0")
        return v

    @validator("stop")
    def validate_stop(cls, v):
        """Validate stop sequences."""
        if isinstance(v, str):
            return [v]
        return v


class EmbeddingRequest(BaseModel):
    """Embedding generation request schema."""

    input: Union[str, List[str]] = Field(..., description="Input text(s) to embed")
    model: Optional[str] = Field(None, description="Model to use for embeddings")
    user: Optional[str] = Field(None, description="User identifier")
    tenant_id: Optional[str] = Field(None, description="Tenant identifier")
    metadata: Optional[Dict[str, Any]] = Field(None, description="Additional metadata")


# Response Schemas
class TokenUsage(BaseModel):
    """Token usage information schema."""

    prompt_tokens: int = Field(0, description="Number of prompt tokens")
    completion_tokens: int = Field(0, description="Number of completion tokens")
    total_tokens: int = Field(0, description="Total number of tokens")

    @property
    def cost_estimate(self) -> float:
        """Get estimated cost (placeholder)."""
        return 0.0


class ChatChoice(BaseModel):
    """Chat completion choice schema."""

    index: int = Field(..., description="Choice index")
    message: Optional[ChatMessage] = Field(None, description="Message content")
    finish_reason: Optional[str] = Field(
        None, description="Reason for completion finish"
    )
    delta: Optional[Dict[str, Any]] = Field(
        None, description="Delta for streaming responses"
    )


class ChatCompletionResponse(BaseModel):
    """Chat completion response schema."""

    id: str = Field(..., description="Response ID")
    object: str = Field("chat.completion", description="Object type")
    created: int = Field(..., description="Creation timestamp")
    model: str = Field(..., description="Model used")
    choices: List[ChatChoice] = Field(..., description="Response choices")
    usage: TokenUsage = Field(..., description="Token usage information")
    provider: Optional[str] = Field(None, description="Provider name")
    request_id: Optional[str] = Field(None, description="Request ID for tracking")
    processing_time_ms: Optional[float] = Field(
        None, description="Processing time in milliseconds"
    )
    validation: Optional[Dict[str, Any]] = Field(None, description="Validation results")
    cost: Optional[float] = Field(None, description="Actual cost incurred")

    class Config:
        schema_extra = {
            "example": {
                "id": "chatcmpl-123",
                "object": "chat.completion",
                "created": 1677652288,
                "model": "gpt-3.5-turbo",
                "choices": [
                    {
                        "index": 0,
                        "message": {
                            "role": "assistant",
                            "content": "Hello! How can I help you today?",
                        },
                        "finish_reason": "stop",
                    }
                ],
                "usage": {
                    "prompt_tokens": 9,
                    "completion_tokens": 12,
                    "total_tokens": 21,
                },
                "provider": "openai",
                "cost": 0.000063,
            }
        }


class EmbeddingData(BaseModel):
    """Embedding data schema."""

    object: str = Field("embedding", description="Object type")
    embedding: List[float] = Field(..., description="Embedding vector")
    index: int = Field(..., description="Embedding index")


class EmbeddingResponse(BaseModel):
    """Embedding response schema."""

    object: str = Field("list", description="Object type")
    data: List[EmbeddingData] = Field(..., description="Embedding data")
    model: str = Field(..., description="Model used")
    provider: Optional[str] = Field(None, description="Provider name")
    usage: TokenUsage = Field(..., description="Token usage information")
    request_id: Optional[str] = Field(None, description="Request ID for tracking")
    processing_time_ms: Optional[float] = Field(
        None, description="Processing time in milliseconds"
    )
    cost: Optional[float] = Field(None, description="Actual cost incurred")


class StreamingChunk(BaseModel):
    """Streaming response chunk schema."""

    id: str = Field(..., description="Chunk ID")
    object: str = Field("chat.completion.chunk", description="Object type")
    created: int = Field(..., description="Creation timestamp")
    model: str = Field(..., description="Model used")
    choices: List[ChatChoice] = Field(..., description="Response choices")
    provider: Optional[str] = Field(None, description="Provider name")
    request_id: Optional[str] = Field(None, description="Request ID for tracking")
    finished: bool = Field(False, description="Whether streaming is finished")
    usage: Optional[TokenUsage] = Field(None, description="Final token usage")
    cost: Optional[float] = Field(None, description="Final cost")


# Provider Management Schemas
class ProviderInfo(BaseModel):
    """Provider information schema."""

    name: str = Field(..., description="Provider name")
    status: ProviderStatus = Field(..., description="Provider status")
    enabled: bool = Field(..., description="Whether provider is enabled")
    healthy: bool = Field(..., description="Whether provider is healthy")
    can_accept_request: bool = Field(
        ..., description="Whether provider can accept requests"
    )
    current_requests: int = Field(0, description="Current concurrent requests")
    total_requests: int = Field(0, description="Total requests processed")
    consecutive_failures: int = Field(0, description="Consecutive failures")
    avg_response_time: float = Field(0.0, description="Average response time")
    success_rate: float = Field(0.0, description="Success rate percentage")
    models: List[str] = Field(default_factory=list, description="Available models")
    capabilities: List[str] = Field(
        default_factory=list, description="Provider capabilities"
    )
    last_health_check: Optional[datetime] = Field(
        None, description="Last health check time"
    )
    last_failure_time: Optional[datetime] = Field(None, description="Last failure time")


class ModelInfo(BaseModel):
    """Model information schema."""

    name: str = Field(..., description="Model name")
    provider: str = Field(..., description="Provider name")
    capabilities: List[str] = Field(..., description="Model capabilities")
    max_tokens: int = Field(..., description="Maximum tokens")
    input_cost_per_1k: float = Field(..., description="Input cost per 1K tokens")
    output_cost_per_1k: float = Field(..., description="Output cost per 1K tokens")
    context_window: int = Field(..., description="Context window size")
    description: Optional[str] = Field(None, description="Model description")
    deprecated: bool = Field(False, description="Whether model is deprecated")
    streaming_supported: bool = Field(
        True, description="Whether streaming is supported"
    )
    function_calling_supported: bool = Field(
        False, description="Whether function calling is supported"
    )
    vision_supported: bool = Field(False, description="Whether vision is supported")


# Cost Tracking Schemas
class CostMetrics(BaseModel):
    """Cost metrics schema."""

    total_cost: float = Field(..., description="Total cost")
    total_tokens: int = Field(..., description="Total tokens")
    total_requests: int = Field(..., description="Total requests")
    avg_cost_per_request: float = Field(..., description="Average cost per request")
    avg_tokens_per_request: float = Field(..., description="Average tokens per request")
    providers: Dict[str, float] = Field(..., description="Cost by provider")
    models: Dict[str, float] = Field(..., description="Cost by model")
    period: str = Field(..., description="Time period")
    timestamp: datetime = Field(..., description="Metrics timestamp")


class BudgetStatus(BaseModel):
    """Budget status schema."""

    has_budget: bool = Field(..., description="Whether budget is configured")
    daily_limit: Optional[float] = Field(None, description="Daily spending limit")
    monthly_limit: Optional[float] = Field(None, description="Monthly spending limit")
    daily_spent: float = Field(0.0, description="Daily amount spent")
    monthly_spent: float = Field(0.0, description="Monthly amount spent")
    daily_remaining: Optional[float] = Field(None, description="Daily remaining budget")
    monthly_remaining: Optional[float] = Field(
        None, description="Monthly remaining budget"
    )
    daily_percentage: float = Field(0.0, description="Daily budget usage percentage")
    monthly_percentage: float = Field(
        0.0, description="Monthly budget usage percentage"
    )


class CostAlert(BaseModel):
    """Cost alert schema."""

    id: str = Field(..., description="Alert ID")
    tenant_id: Optional[str] = Field(None, description="Tenant ID")
    alert_type: str = Field(..., description="Alert type")
    message: str = Field(..., description="Alert message")
    severity: str = Field(..., description="Alert severity")
    timestamp: datetime = Field(..., description="Alert timestamp")
    acknowledged: bool = Field(False, description="Whether alert is acknowledged")
    metadata: Dict[str, Any] = Field(
        default_factory=dict, description="Additional metadata"
    )


# Validation Schemas
class ValidationIssue(BaseModel):
    """Validation issue schema."""

    type: str = Field(..., description="Validation type")
    severity: str = Field(..., description="Issue severity")
    is_valid: bool = Field(..., description="Whether validation passed")
    is_critical: bool = Field(False, description="Whether issue is critical")
    confidence: float = Field(..., description="Confidence score")
    message: str = Field(..., description="Issue description")
    details: Dict[str, Any] = Field(
        default_factory=dict, description="Additional details"
    )
    detected_content: Optional[str] = Field(
        None, description="Detected problematic content"
    )
    suggestions: List[str] = Field(
        default_factory=list, description="Remediation suggestions"
    )


class ValidationReport(BaseModel):
    """Validation report schema."""

    response_id: str = Field(..., description="Response ID")
    provider: str = Field(..., description="Provider name")
    model: str = Field(..., description="Model used")
    timestamp: datetime = Field(..., description="Validation timestamp")
    is_valid: bool = Field(..., description="Overall validation result")
    overall_score: float = Field(..., description="Overall quality score")
    processing_time_ms: float = Field(..., description="Processing time")
    issues: List[ValidationIssue] = Field(..., description="Validation issues")

    @property
    def critical_issues(self) -> List[ValidationIssue]:
        """Get critical issues."""
        return [issue for issue in self.issues if issue.severity == "critical"]

    @property
    def errors(self) -> List[ValidationIssue]:
        """Get error-level issues."""
        return [issue for issue in self.issues if issue.severity == "error"]

    @property
    def warnings(self) -> List[ValidationIssue]:
        """Get warning-level issues."""
        return [issue for issue in self.issues if issue.severity == "warning"]


# Monitoring Schemas
class HealthCheckResponse(BaseModel):
    """Health check response schema."""

    status: str = Field(..., description="Overall service status")
    timestamp: datetime = Field(..., description="Check timestamp")
    version: str = Field(..., description="Service version")
    uptime_seconds: float = Field(..., description="Service uptime in seconds")
    providers: Dict[str, ProviderInfo] = Field(..., description="Provider statuses")
    system: Dict[str, Any] = Field(..., description="System information")


class ErrorResponse(BaseModel):
    """Error response schema."""

    error: Dict[str, Any] = Field(..., description="Error details")
    timestamp: datetime = Field(
        default_factory=datetime.now, description="Error timestamp"
    )
    request_id: Optional[str] = Field(None, description="Request ID")

    class Config:
        schema_extra = {
            "example": {
                "error": {
                    "type": "invalid_request_error",
                    "message": "Model 'invalid-model' not found",
                    "code": "model_not_found",
                    "param": "model",
                },
                "timestamp": "2024-01-01T12:00:00Z",
                "request_id": "req_123",
            }
        }


# Configuration Schemas
class ProviderConfiguration(BaseModel):
    """Provider configuration schema."""

    name: str = Field(..., description="Provider name")
    enabled: bool = Field(True, description="Whether provider is enabled")
    priority: int = Field(1, description="Provider priority")
    weight: float = Field(1.0, description="Provider weight for load balancing")
    timeout: int = Field(30, description="Request timeout in seconds")
    max_retries: int = Field(3, description="Maximum retry attempts")
    max_requests_per_minute: Optional[int] = Field(
        None, description="Rate limit per minute"
    )
    max_concurrent_requests: Optional[int] = Field(
        None, description="Maximum concurrent requests"
    )
    api_key: Optional[str] = Field(None, description="API key")
    base_url: Optional[str] = Field(None, description="Base URL")
    default_model: Optional[str] = Field(None, description="Default model")
    supported_models: List[str] = Field(
        default_factory=list, description="Supported models"
    )
    enable_streaming: bool = Field(True, description="Enable streaming")
    enable_function_calling: bool = Field(True, description="Enable function calling")
    enable_vision: bool = Field(False, description="Enable vision capabilities")


class LLMConfiguration(BaseModel):
    """LLM service configuration schema."""

    enabled: bool = Field(True, description="Enable LLM service")
    debug: bool = Field(False, description="Enable debug logging")
    log_level: str = Field("INFO", description="Log level")
    providers: List[ProviderConfiguration] = Field(
        ..., description="Provider configurations"
    )
    selection_strategy: SelectionStrategy = Field(
        SelectionStrategy.PRIORITY, description="Provider selection strategy"
    )
    max_concurrent_requests: int = Field(100, description="Maximum concurrent requests")
    request_timeout: int = Field(60, description="Default request timeout")
    multi_tenant_enabled: bool = Field(True, description="Enable multi-tenancy")
    tenant_isolation: bool = Field(True, description="Enable tenant isolation")
    validation_enabled: bool = Field(True, description="Enable response validation")
    cost_tracking_enabled: bool = Field(True, description="Enable cost tracking")
    monitoring_enabled: bool = Field(True, description="Enable monitoring")
    version: str = Field("1.0.0", description="Configuration version")
    last_updated: datetime = Field(
        default_factory=datetime.now, description="Last update timestamp"
    )


# Analytics Schemas
class UsageAnalytics(BaseModel):
    """Usage analytics schema."""

    period: str = Field(..., description="Time period")
    total_requests: int = Field(..., description="Total requests")
    successful_requests: int = Field(..., description="Successful requests")
    failed_requests: int = Field(..., description="Failed requests")
    success_rate: float = Field(..., description="Success rate percentage")
    avg_response_time: float = Field(..., description="Average response time")
    total_tokens: int = Field(..., description="Total tokens processed")
    total_cost: float = Field(..., description="Total cost")
    requests_by_provider: Dict[str, int] = Field(
        ..., description="Requests by provider"
    )
    requests_by_model: Dict[str, int] = Field(..., description="Requests by model")
    top_users: List[Dict[str, Any]] = Field(..., description="Top users by usage")
    top_tenants: List[Dict[str, Any]] = Field(..., description="Top tenants by usage")
    timestamp: datetime = Field(..., description="Analytics timestamp")


class PerformanceMetrics(BaseModel):
    """Performance metrics schema."""

    provider: str = Field(..., description="Provider name")
    model: str = Field(..., description="Model name")
    timestamp: datetime = Field(..., description="Metrics timestamp")
    response_time_p50: float = Field(..., description="50th percentile response time")
    response_time_p95: float = Field(..., description="95th percentile response time")
    response_time_p99: float = Field(..., description="99th percentile response time")
    throughput: float = Field(..., description="Requests per second")
    error_rate: float = Field(..., description="Error rate percentage")
    timeout_rate: float = Field(..., description="Timeout rate percentage")
    queue_time_avg: float = Field(..., description="Average queue time")
    tokens_per_second: float = Field(..., description="Tokens processed per second")


# Utility Schemas
class PaginationParams(BaseModel):
    """Pagination parameters schema."""

    offset: int = Field(0, ge=0, description="Number of items to skip")
    limit: int = Field(50, ge=1, le=1000, description="Number of items to return")

    @property
    def skip(self) -> int:
        """Get skip value (alias for offset)."""
        return self.offset


class PaginatedResponse(BaseModel):
    """Paginated response schema."""

    items: List[Any] = Field(..., description="Items in current page")
    total: int = Field(..., description="Total number of items")
    offset: int = Field(..., description="Number of items skipped")
    limit: int = Field(..., description="Number of items per page")
    has_next: bool = Field(..., description="Whether there are more items")
    has_prev: bool = Field(..., description="Whether there are previous items")


class TimeFilter(BaseModel):
    """Time filter schema."""

    start_date: Optional[datetime] = Field(None, description="Start date filter")
    end_date: Optional[datetime] = Field(None, description="End date filter")
    period: Optional[str] = Field(
        None, description="Time period (hourly, daily, weekly, monthly)"
    )

    @validator("end_date")
    def validate_date_range(cls, v, values):
        """Validate date range."""
        if v and "start_date" in values and values["start_date"]:
            if v <= values["start_date"]:
                raise ValueError("End date must be after start date")
        return v
