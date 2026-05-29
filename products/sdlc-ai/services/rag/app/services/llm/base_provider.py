"""
Base LLM Provider Abstraction.

This module provides the abstract base class and common interfaces for all LLM providers,
ensuring consistent behavior and capabilities across different AI models and services.
"""

import abc
import asyncio
import time
import uuid
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Union, AsyncGenerator, Callable

from pydantic import BaseModel, Field, validator


class ProviderStatus(Enum):
    """Provider status enumeration."""

    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNAVAILABLE = "unavailable"
    RATE_LIMITED = "rate_limited"
    ERROR = "error"


class ModelCapability(Enum):
    """Model capability enumeration."""

    TEXT_GENERATION = "text_generation"
    CODE_GENERATION = "code_generation"
    STREAMING = "streaming"
    FUNCTION_CALLING = "function_calling"
    VISION = "vision"
    EMBEDDINGS = "embeddings"
    TOOL_USE = "tool_use"


class MessageRole(Enum):
    """Message role enumeration."""

    SYSTEM = "system"
    USER = "user"
    ASSISTANT = "assistant"
    FUNCTION = "function"
    TOOL = "tool"


class TokenUsage(BaseModel):
    """Token usage information."""

    prompt_tokens: int = Field(default=0, description="Number of prompt tokens")
    completion_tokens: int = Field(default=0, description="Number of completion tokens")
    total_tokens: int = Field(default=0, description="Total number of tokens")

    @property
    def cost_estimate(self) -> float:
        """Get estimated cost (to be overridden by providers)."""
        return 0.0


class LLMMessage(BaseModel):
    """LLM message model."""

    role: MessageRole = Field(description="Message role")
    content: str = Field(description="Message content")
    name: Optional[str] = Field(
        default=None, description="Optional name for function/tool calls"
    )
    function_call: Optional[Dict[str, Any]] = Field(
        default=None, description="Function call information"
    )
    tool_calls: Optional[List[Dict[str, Any]]] = Field(
        default=None, description="Tool call information"
    )
    tool_call_id: Optional[str] = Field(default=None, description="Tool call ID")

    @validator("role", pre=True)
    def validate_role(cls, v):
        """Validate role."""
        if isinstance(v, str):
            return MessageRole(v.lower())
        return v


class LLMTool(BaseModel):
    """LLM tool/function definition."""

    name: str = Field(description="Tool name")
    description: str = Field(description="Tool description")
    parameters: Dict[str, Any] = Field(description="Tool parameters schema")
    function: Optional[Callable] = Field(
        default=None, description="Actual function to call (internal use)"
    )


class LLMRequest(BaseModel):
    """LLM request model."""

    messages: List[LLMMessage] = Field(description="List of messages")
    model: str = Field(description="Model name")
    max_tokens: Optional[int] = Field(
        default=None, description="Maximum tokens to generate"
    )
    temperature: float = Field(
        default=0.7, ge=0.0, le=2.0, description="Sampling temperature"
    )
    top_p: Optional[float] = Field(
        default=None, ge=0.0, le=1.0, description="Nucleus sampling parameter"
    )
    frequency_penalty: Optional[float] = Field(
        default=0.0, ge=-2.0, le=2.0, description="Frequency penalty"
    )
    presence_penalty: Optional[float] = Field(
        default=0.0, ge=-2.0, le=2.0, description="Presence penalty"
    )
    stop: Optional[Union[str, List[str]]] = Field(
        default=None, description="Stop sequences"
    )
    stream: bool = Field(default=False, description="Whether to stream responses")
    tools: Optional[List[LLMTool]] = Field(
        default=None, description="Available tools/functions"
    )
    tool_choice: Optional[Union[str, Dict[str, Any]]] = Field(
        default=None, description="Tool choice strategy"
    )
    user: Optional[str] = Field(default=None, description="User identifier")
    metadata: Optional[Dict[str, Any]] = Field(
        default=None, description="Additional metadata"
    )

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


class LLMResponse(BaseModel):
    """LLM response model."""

    id: str = Field(
        default_factory=lambda: str(uuid.uuid4()), description="Response ID"
    )
    object: str = Field(default="chat.completion", description="Object type")
    created: int = Field(
        default_factory=lambda: int(time.time()), description="Creation timestamp"
    )
    model: str = Field(description="Model used")
    choices: List[Dict[str, Any]] = Field(description="Response choices")
    usage: TokenUsage = Field(description="Token usage information")
    finish_reason: Optional[str] = Field(
        default=None, description="Reason for completion finish"
    )
    provider: Optional[str] = Field(default=None, description="Provider name")
    request_id: Optional[str] = Field(
        default=None, description="Request ID for tracking"
    )
    metadata: Optional[Dict[str, Any]] = Field(
        default=None, description="Additional metadata"
    )

    @property
    def content(self) -> Optional[str]:
        """Get the primary response content."""
        if self.choices and len(self.choices) > 0:
            choice = self.choices[0]
            if "message" in choice:
                return choice["message"].get("content")
            elif "text" in choice:
                return choice["text"]
        return None

    @property
    def first_choice(self) -> Optional[Dict[str, Any]]:
        """Get the first choice."""
        return self.choices[0] if self.choices else None


class LLMError(BaseModel):
    """LLM error model."""

    type: str = Field(description="Error type")
    message: str = Field(description="Error message")
    code: Optional[str] = Field(default=None, description="Error code")
    param: Optional[str] = Field(
        default=None, description="Parameter that caused error"
    )
    provider: Optional[str] = Field(default=None, description="Provider name")
    request_id: Optional[str] = Field(default=None, description="Request ID")
    retryable: bool = Field(default=False, description="Whether error is retryable")
    timestamp: datetime = Field(
        default_factory=datetime.now, description="Error timestamp"
    )


class ModelInfo(BaseModel):
    """Model information."""

    name: str = Field(description="Model name")
    provider: str = Field(description="Provider name")
    capabilities: List[ModelCapability] = Field(description="Model capabilities")
    max_tokens: int = Field(description="Maximum tokens")
    input_cost_per_1k: float = Field(description="Input cost per 1K tokens")
    output_cost_per_1k: float = Field(description="Output cost per 1K tokens")
    context_window: int = Field(description="Context window size")
    description: Optional[str] = Field(default=None, description="Model description")
    deprecated: bool = Field(default=False, description="Whether model is deprecated")
    streaming_supported: bool = Field(
        default=True, description="Whether streaming is supported"
    )
    function_calling_supported: bool = Field(
        default=False, description="Whether function calling is supported"
    )
    vision_supported: bool = Field(
        default=False, description="Whether vision is supported"
    )


class ProviderMetrics(BaseModel):
    """Provider performance metrics."""

    request_count: int = Field(default=0, description="Total request count")
    success_count: int = Field(default=0, description="Successful request count")
    error_count: int = Field(default=0, description="Error count")
    avg_response_time: float = Field(
        default=0.0, description="Average response time in seconds"
    )
    avg_tokens_per_request: float = Field(
        default=0.0, description="Average tokens per request"
    )
    total_cost: float = Field(default=0.0, description="Total cost incurred")
    last_request_time: Optional[datetime] = Field(
        default=None, description="Last request timestamp"
    )
    last_error_time: Optional[datetime] = Field(
        default=None, description="Last error timestamp"
    )
    status: ProviderStatus = Field(
        default=ProviderStatus.HEALTHY, description="Provider status"
    )
    uptime_percentage: float = Field(default=100.0, description="Uptime percentage")

    @property
    def success_rate(self) -> float:
        """Calculate success rate."""
        if self.request_count == 0:
            return 0.0
        return (self.success_count / self.request_count) * 100


class BaseLLMProvider(abc.ABC):
    """Abstract base class for LLM providers."""

    def __init__(self, name: str, config: Dict[str, Any]):
        """Initialize provider."""
        self.name = name
        self.config = config
        self.metrics = ProviderMetrics()
        self._models_cache: Optional[List[ModelInfo]] = None
        self._models_cache_time: Optional[float] = None
        self._models_cache_ttl = 300  # 5 minutes

    @property
    @abc.abstractmethod
    def supported_models(self) -> List[ModelInfo]:
        """Get list of supported models."""
        pass

    @property
    @abc.abstractmethod
    def default_model(self) -> str:
        """Get default model name."""
        pass

    @abc.abstractmethod
    async def initialize(self) -> None:
        """Initialize provider (e.g., validate API keys, set up clients)."""
        pass

    @abc.abstractmethod
    async def cleanup(self) -> None:
        """Clean up provider resources."""
        pass

    @abc.abstractmethod
    async def health_check(self) -> ProviderStatus:
        """Check provider health."""
        pass

    @abc.abstractmethod
    async def get_models(self, force_refresh: bool = False) -> List[ModelInfo]:
        """Get available models."""
        pass

    @abc.abstractmethod
    async def complete(self, request: LLMRequest) -> LLMResponse:
        """Complete a chat request."""
        pass

    @abc.abstractmethod
    async def complete_stream(self, request: LLMRequest) -> AsyncGenerator[str, None]:
        """Complete a chat request with streaming."""
        pass

    @abc.abstractmethod
    def estimate_tokens(self, text: str, model: str = None) -> int:
        """Estimate token count for text."""
        pass

    @abc.abstractmethod
    def calculate_cost(self, usage: TokenUsage, model: str) -> float:
        """Calculate cost for token usage."""
        pass

    async def validate_request(self, request: LLMRequest) -> None:
        """Validate request before sending."""
        if not request.messages:
            raise ValueError("Messages list cannot be empty")

        # Validate model
        models = await self.get_models()
        model_names = [model.name for model in models]
        if request.model not in model_names:
            raise ValueError(
                f"Model '{request.model}' not supported by provider '{self.name}'"
            )

        # Validate max_tokens
        model_info = next((m for m in models if m.name == request.model), None)
        if model_info and request.max_tokens:
            if request.max_tokens > model_info.max_tokens:
                raise ValueError(
                    f"max_tokens ({request.max_tokens}) exceeds model limit ({model_info.max_tokens})"
                )

    def update_metrics(
        self, success: bool, response_time: float, tokens: int = 0, cost: float = 0.0
    ) -> None:
        """Update provider metrics."""
        self.metrics.request_count += 1
        self.metrics.last_request_time = datetime.now()

        if success:
            self.metrics.success_count += 1
            self.metrics.total_cost += cost
        else:
            self.metrics.error_count += 1
            self.metrics.last_error_time = datetime.now()
            self.metrics.status = ProviderStatus.ERROR

        # Update rolling averages
        if self.metrics.request_count > 0:
            total_time = self.metrics.avg_response_time * (
                self.metrics.request_count - 1
            )
            self.metrics.avg_response_time = (
                total_time + response_time
            ) / self.metrics.request_count

            total_tokens = self.metrics.avg_tokens_per_request * (
                self.metrics.request_count - 1
            )
            self.metrics.avg_tokens_per_request = (
                total_tokens + tokens
            ) / self.metrics.request_count

        # Update success rate and status
        success_rate = self.metrics.success_rate
        if success_rate >= 95:
            self.metrics.status = ProviderStatus.HEALTHY
        elif success_rate >= 80:
            self.metrics.status = ProviderStatus.DEGRADED
        else:
            self.metrics.status = ProviderStatus.ERROR

    def get_model_info(self, model_name: str) -> Optional[ModelInfo]:
        """Get model information by name."""
        for model in self.supported_models:
            if model.name == model_name:
                return model
        return None

    def supports_capability(
        self, capability: ModelCapability, model: str = None
    ) -> bool:
        """Check if provider/model supports a capability."""
        if model:
            model_info = self.get_model_info(model)
            if model_info:
                return capability in model_info.capabilities
            return False

        # Check if any model supports the capability
        return any(capability in model.capabilities for model in self.supported_models)

    def get_cost_estimate(self, request: LLMRequest) -> float:
        """Get cost estimate for request."""
        # Estimate input tokens
        input_text = "\n".join([msg.content for msg in request.messages])
        input_tokens = self.estimate_tokens(input_text, request.model)

        # Estimate output tokens (rough estimate based on max_tokens or average)
        output_tokens = request.max_tokens or 150  # Default estimate

        # Calculate cost
        model_info = self.get_model_info(request.model)
        if not model_info:
            return 0.0

        input_cost = (input_tokens / 1000) * model_info.input_cost_per_1k
        output_cost = (output_tokens / 1000) * model_info.output_cost_per_1k

        return input_cost + output_cost

    async def __aenter__(self):
        """Async context manager entry."""
        await self.initialize()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        await self.cleanup()

    def __repr__(self):
        """String representation."""
        return f"{self.__class__.__name__}(name='{self.name}', status='{self.metrics.status.value}')"


class ProviderError(Exception):
    """Provider-specific error."""

    def __init__(
        self,
        message: str,
        provider: str = None,
        code: str = None,
        retryable: bool = False,
    ):
        super().__init__(message)
        self.provider = provider
        self.code = code
        self.retryable = retryable


class RateLimitError(ProviderError):
    """Rate limit exceeded error."""

    def __init__(self, message: str, provider: str = None, retry_after: int = None):
        super().__init__(
            message, provider=provider, code="rate_limit_exceeded", retryable=True
        )
        self.retry_after = retry_after


class QuotaExceededError(ProviderError):
    """Quota exceeded error."""

    def __init__(self, message: str, provider: str = None):
        super().__init__(
            message, provider=provider, code="quota_exceeded", retryable=False
        )


class ModelNotFoundError(ProviderError):
    """Model not found error."""

    def __init__(self, message: str, provider: str = None, model: str = None):
        super().__init__(
            message, provider=provider, code="model_not_found", retryable=False
        )
        self.model = model


class AuthenticationError(ProviderError):
    """Authentication error."""

    def __init__(self, message: str, provider: str = None):
        super().__init__(
            message, provider=provider, code="authentication_error", retryable=False
        )


class InvalidRequestError(ProviderError):
    """Invalid request error."""

    def __init__(self, message: str, provider: str = None, param: str = None):
        super().__init__(
            message, provider=provider, code="invalid_request", retryable=False
        )
        self.param = param


class APIConnectionError(ProviderError):
    """API connection error."""

    def __init__(self, message: str, provider: str = None):
        super().__init__(
            message, provider=provider, code="connection_error", retryable=True
        )


class TimeoutError(ProviderError):
    """Request timeout error."""

    def __init__(self, message: str, provider: str = None, timeout: int = None):
        super().__init__(message, provider=provider, code="timeout", retryable=True)
        self.timeout = timeout


# Utility functions
def retry_on_error(
    max_retries: int = 3,
    base_delay: float = 1.0,
    max_delay: float = 60.0,
    backoff_factor: float = 2.0,
    retryable_errors: List[type] = None,
):
    """Decorator for retrying provider calls on specific errors."""
    if retryable_errors is None:
        retryable_errors = [
            RateLimitError,
            APIConnectionError,
            TimeoutError,
        ]

    def decorator(func):
        async def wrapper(*args, **kwargs):
            last_error = None

            for attempt in range(max_retries + 1):
                try:
                    return await func(*args, **kwargs)
                except Exception as e:
                    last_error = e

                    # Check if error is retryable
                    if not any(
                        isinstance(e, error_type) for error_type in retryable_errors
                    ):
                        raise

                    # Don't retry on last attempt
                    if attempt == max_retries:
                        raise

                    # Calculate delay
                    delay = min(base_delay * (backoff_factor**attempt), max_delay)

                    # Add jitter for rate limit errors
                    if isinstance(e, RateLimitError) and e.retry_after:
                        delay = max(delay, e.retry_after)

                    await asyncio.sleep(delay)

            # This should never be reached
            raise last_error

        return wrapper

    return decorator


# Provider factory interface
class ProviderFactory:
    """Factory for creating provider instances."""

    _providers: Dict[str, type] = {}

    @classmethod
    def register(cls, name: str, provider_class: type):
        """Register a provider class."""
        cls._providers[name] = provider_class

    @classmethod
    def create(cls, name: str, config: Dict[str, Any]) -> BaseLLMProvider:
        """Create a provider instance."""
        if name not in cls._providers:
            raise ValueError(f"Unknown provider: {name}")

        return cls._providers[name](name, config)

    @classmethod
    def get_available_providers(cls) -> List[str]:
        """Get list of available provider names."""
        return list(cls._providers.keys())
