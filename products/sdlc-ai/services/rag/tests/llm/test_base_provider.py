"""
Tests for LLM Base Provider.

This module contains unit tests for the base LLM provider functionality.
"""

import pytest
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock

from app.services.llm.base_provider import (
    BaseLLMProvider,
    LLMRequest,
    LLMResponse,
    LLMMessage,
    TokenUsage,
    ModelInfo,
    ModelCapability,
    ProviderStatus,
    ProviderError,
    RateLimitError,
    ModelNotFoundError,
    AuthenticationError,
    InvalidRequestError,
    APIConnectionError,
    TimeoutError,
    ProviderFactory,
    MessageRole,
)


class MockLLMProvider(BaseLLMProvider):
    """Mock LLM provider for testing."""

    def __init__(self, name: str = "mock", config: dict = None):
        super().__init__(name, config or {})
        self._initialize_called = False
        self._cleanup_called = False
        self._health_status = ProviderStatus.HEALTHY

    @property
    def supported_models(self) -> list:
        return [
            ModelInfo(
                name="mock-model",
                provider="mock",
                capabilities=[ModelCapability.TEXT_GENERATION],
                max_tokens=1000,
                input_cost_per_1k=0.001,
                output_cost_per_1k=0.002,
                context_window=4000,
            )
        ]

    @property
    def default_model(self) -> str:
        return "mock-model"

    async def initialize(self) -> None:
        self._initialize_called = True

    async def cleanup(self) -> None:
        self._cleanup_called = True

    async def health_check(self) -> ProviderStatus:
        return self._health_status

    async def get_models(self, force_refresh: bool = False) -> list:
        return self.supported_models

    async def complete(self, request: LLMRequest) -> LLMResponse:
        return LLMResponse(
            id="test-response",
            model=request.model,
            choices=[
                {
                    "index": 0,
                    "message": {"role": "assistant", "content": "Mock response"},
                    "finish_reason": "stop",
                }
            ],
            usage=TokenUsage(prompt_tokens=10, completion_tokens=5, total_tokens=15),
        )

    async def complete_stream(self, request):
        yield "Mock"
        yield " "
        yield "response"

    def estimate_tokens(self, text: str, model: str = None) -> int:
        return len(text) // 4

    def calculate_cost(self, usage: TokenUsage, model: str) -> float:
        return (usage.total_tokens / 1000) * 0.001


class TestBaseLLMProvider:
    """Test cases for BaseLLMProvider."""

    def test_provider_initialization(self):
        """Test provider initialization."""
        config = {"timeout": 60, "max_retries": 5}
        provider = MockLLMProvider("test", config)

        assert provider.name == "test"
        assert provider.config == config
        assert provider.metrics.request_count == 0
        assert provider.metrics.status == ProviderStatus.HEALTHY

    def test_supported_models(self):
        """Test supported models property."""
        provider = MockLLMProvider()
        models = provider.supported_models

        assert len(models) == 1
        assert models[0].name == "mock-model"
        assert ModelCapability.TEXT_GENERATION in models[0].capabilities

    def test_default_model(self):
        """Test default model property."""
        provider = MockLLMProvider()
        assert provider.default_model == "mock-model"

    @pytest.mark.asyncio
    async def test_initialize(self):
        """Test provider initialization."""
        provider = MockLLMProvider()
        await provider.initialize()

        assert provider._initialize_called is True

    @pytest.mark.asyncio
    async def test_cleanup(self):
        """Test provider cleanup."""
        provider = MockLLMProvider()
        await provider.cleanup()

        assert provider._cleanup_called is True

    @pytest.mark.asyncio
    async def test_health_check(self):
        """Test health check."""
        provider = MockLLMProvider()
        status = await provider.health_check()

        assert status == ProviderStatus.HEALTHY

    @pytest.mark.asyncio
    async def test_get_models(self):
        """Test getting models."""
        provider = MockLLMProvider()
        models = await provider.get_models()

        assert len(models) == 1
        assert models[0].name == "mock-model"

    @pytest.mark.asyncio
    async def test_complete(self):
        """Test completion."""
        provider = MockLLMProvider()
        request = LLMRequest(
            messages=[LLMMessage(role=MessageRole.USER, content="Hello")],
            model="mock-model",
        )

        response = await provider.complete(request)

        assert response.model == "mock-model"
        assert response.content == "Mock response"
        assert response.usage.total_tokens == 15

    @pytest.mark.asyncio
    async def test_complete_stream(self):
        """Test streaming completion."""
        provider = MockLLMProvider()
        request = LLMRequest(
            messages=[LLMMessage(role=MessageRole.USER, content="Hello")],
            model="mock-model",
            stream=True,
        )

        chunks = []
        async for chunk in provider.complete_stream(request):
            chunks.append(chunk)

        assert "".join(chunks) == "Mock response"

    def test_estimate_tokens(self):
        """Test token estimation."""
        provider = MockLLMProvider()
        tokens = provider.estimate_tokens("This is a test message")

        assert tokens == 5  # 21 characters // 4

    def test_calculate_cost(self):
        """Test cost calculation."""
        provider = MockLLMProvider()
        usage = TokenUsage(prompt_tokens=10, completion_tokens=5, total_tokens=15)
        cost = provider.calculate_cost(usage, "mock-model")

        assert cost == 0.015  # 15 tokens * $0.001 per 1k tokens

    def test_get_model_info(self):
        """Test getting model info."""
        provider = MockLLMProvider()
        model_info = provider.get_model_info("mock-model")

        assert model_info is not None
        assert model_info.name == "mock-model"
        assert model_info.provider == "mock"

    def test_get_model_info_not_found(self):
        """Test getting model info for non-existent model."""
        provider = MockLLMProvider()
        model_info = provider.get_model_info("non-existent")

        assert model_info is None

    def test_supports_capability(self):
        """Test capability support checking."""
        provider = MockLLMProvider()

        assert provider.supports_capability(ModelCapability.TEXT_GENERATION)
        assert not provider.supports_capability(ModelCapability.VISION)

    def test_supports_capability_with_model(self):
        """Test capability support checking for specific model."""
        provider = MockLLMProvider()

        assert provider.supports_capability(
            ModelCapability.TEXT_GENERATION, "mock-model"
        )
        assert not provider.supports_capability(ModelCapability.VISION, "mock-model")

    def test_get_cost_estimate(self):
        """Test cost estimation."""
        provider = MockLLMProvider()
        request = LLMRequest(
            messages=[
                LLMMessage(role=MessageRole.USER, content="Hello world"),
                LLMMessage(role=MessageRole.ASSISTANT, content="Hi there!"),
            ],
            model="mock-model",
            max_tokens=100,
        )

        estimate = provider.get_cost_estimate(request)

        assert estimate > 0
        assert isinstance(estimate, float)

    def test_update_metrics_success(self):
        """Test metrics update on success."""
        provider = MockLLMProvider()

        provider.update_metrics(True, 1.0, 15, 0.015)

        assert provider.metrics.request_count == 1
        assert provider.metrics.success_count == 1
        assert provider.metrics.error_count == 0
        assert provider.metrics.avg_response_time == 1.0
        assert provider.metrics.total_cost == 0.015

    def test_update_metrics_failure(self):
        """Test metrics update on failure."""
        provider = MockLLMProvider()

        provider.update_metrics(False, 2.0)

        assert provider.metrics.request_count == 1
        assert provider.metrics.success_count == 0
        assert provider.metrics.error_count == 1
        assert provider.metrics.avg_response_time == 2.0
        assert provider.metrics.status == ProviderStatus.ERROR

    def test_validate_request_valid(self):
        """Test valid request validation."""
        provider = MockLLMProvider()
        request = LLMRequest(
            messages=[LLMMessage(role=MessageRole.USER, content="Hello")],
            model="mock-model",
        )

        # Should not raise exception
        await provider.validate_request(request)

    @pytest.mark.asyncio
    async def test_validate_request_empty_messages(self):
        """Test validation with empty messages."""
        provider = MockLLMProvider()
        request = LLMRequest(messages=[], model="mock-model")

        with pytest.raises(ValueError, match="Messages list cannot be empty"):
            await provider.validate_request(request)

    @pytest.mark.asyncio
    async def test_validate_request_unsupported_model(self):
        """Test validation with unsupported model."""
        provider = MockLLMProvider()
        request = LLMRequest(
            messages=[LLMMessage(role=MessageRole.USER, content="Hello")],
            model="unsupported-model",
        )

        with pytest.raises(ValueError, match="Model 'unsupported-model' not supported"):
            await provider.validate_request(request)

    @pytest.mark.asyncio
    async def test_validate_request_max_tokens_exceeded(self):
        """Test validation with max_tokens exceeded."""
        provider = MockLLMProvider()
        request = LLMRequest(
            messages=[LLMMessage(role=MessageRole.USER, content="Hello")],
            model="mock-model",
            max_tokens=2000,  # Exceeds model limit of 1000
        )

        with pytest.raises(ValueError, match="max_tokens.*exceeds model limit"):
            await provider.validate_request(request)

    def test_context_manager(self):
        """Test async context manager."""
        async with MockLLMProvider() as provider:
            assert provider._initialize_called is True
        assert provider._cleanup_called is True


class TestProviderFactory:
    """Test cases for ProviderFactory."""

    def test_register_provider(self):
        """Test provider registration."""
        # Clear any existing registrations
        ProviderFactory._providers.clear()

        ProviderFactory.register("mock", MockLLMProvider)

        assert "mock" in ProviderFactory._providers
        assert ProviderFactory._providers["mock"] == MockLLMProvider

    def test_create_provider(self):
        """Test provider creation."""
        # Clear and register provider
        ProviderFactory._providers.clear()
        ProviderFactory.register("mock", MockLLMProvider)

        config = {"timeout": 60}
        provider = ProviderFactory.create("mock", config)

        assert isinstance(provider, MockLLMProvider)
        assert provider.name == "mock"
        assert provider.config == config

    def test_create_unknown_provider(self):
        """Test creating unknown provider."""
        # Clear providers
        ProviderFactory._providers.clear()

        with pytest.raises(ValueError, match="Unknown provider: unknown"):
            ProviderFactory.create("unknown", {})

    def test_get_available_providers(self):
        """Test getting available providers."""
        # Clear and register providers
        ProviderFactory._providers.clear()
        ProviderFactory.register("mock", MockLLMProvider)

        providers = ProviderFactory.get_available_providers()

        assert "mock" in providers
        assert len(providers) == 1


class TestProviderErrors:
    """Test cases for provider error classes."""

    def test_provider_error(self):
        """Test ProviderError."""
        error = ProviderError("Test error", provider="test")

        assert str(error) == "Test error"
        assert error.provider == "test"
        assert error.code is None
        assert error.retryable is False

    def test_rate_limit_error(self):
        """Test RateLimitError."""
        error = RateLimitError("Rate limited", provider="test", retry_after=60)

        assert error.provider == "test"
        assert error.retry_after == 60
        assert error.retryable is True

    def test_model_not_found_error(self):
        """Test ModelNotFoundError."""
        error = ModelNotFoundError("Model not found", provider="test", model="gpt-4")

        assert error.provider == "test"
        assert error.model == "gpt-4"
        assert error.retryable is False

    def test_authentication_error(self):
        """Test AuthenticationError."""
        error = AuthenticationError("Auth failed", provider="test")

        assert error.provider == "test"
        assert error.retryable is False

    def test_invalid_request_error(self):
        """Test InvalidRequestError."""
        error = InvalidRequestError("Invalid request", provider="test", param="model")

        assert error.provider == "test"
        assert error.param == "model"
        assert error.retryable is False

    def test_api_connection_error(self):
        """Test APIConnectionError."""
        error = APIConnectionError("Connection failed", provider="test")

        assert error.provider == "test"
        assert error.retryable is True

    def test_timeout_error(self):
        """Test TimeoutError."""
        error = TimeoutError("Request timeout", provider="test", timeout=30)

        assert error.provider == "test"
        assert error.timeout == 30
        assert error.retryable is True


class TestLLMMessage:
    """Test cases for LLMMessage."""

    def test_message_creation(self):
        """Test message creation."""
        message = LLMMessage(
            role=MessageRole.USER, content="Hello world", name="test_user"
        )

        assert message.role == MessageRole.USER
        assert message.content == "Hello world"
        assert message.name == "test_user"

    def test_message_role_validation(self):
        """Test message role validation."""
        message = LLMMessage(role="user", content="Test")

        assert message.role == MessageRole.USER

    def test_message_with_function_call(self):
        """Test message with function call."""
        function_call = {"name": "test_function", "arguments": '{"param": "value"}'}

        message = LLMMessage(
            role=MessageRole.ASSISTANT, content="", function_call=function_call
        )

        assert message.function_call == function_call


class TestLLMRequest:
    """Test cases for LLMRequest."""

    def test_request_creation(self):
        """Test request creation."""
        messages = [LLMMessage(role=MessageRole.USER, content="Hello")]

        request = LLMRequest(
            messages=messages, model="gpt-3.5-turbo", temperature=0.7, max_tokens=100
        )

        assert request.messages == messages
        assert request.model == "gpt-3.5-turbo"
        assert request.temperature == 0.7
        assert request.max_tokens == 100
        assert request.stream is False

    def test_request_validation_empty_messages(self):
        """Test request validation with empty messages."""
        with pytest.raises(ValueError, match="Messages list cannot be empty"):
            LLMRequest(messages=[], model="gpt-3.5-turbo")

    def test_request_validation_temperature_range(self):
        """Test temperature validation."""
        messages = [LLMMessage(role=MessageRole.USER, content="Hello")]

        with pytest.raises(ValueError, match="Temperature must be between 0.0 and 2.0"):
            LLMRequest(messages=messages, model="gpt-3.5-turbo", temperature=3.0)

        with pytest.raises(ValueError, match="Temperature must be between 0.0 and 2.0"):
            LLMRequest(messages=messages, model="gpt-3.5-turbo", temperature=-1.0)

    def test_request_with_tools(self):
        """Test request with tools."""
        messages = [LLMMessage(role=MessageRole.USER, content="Hello")]
        tools = [
            {
                "name": "test_tool",
                "description": "Test tool",
                "parameters": {"type": "object", "properties": {}},
            }
        ]

        request = LLMRequest(
            messages=messages, model="gpt-3.5-turbo", tools=tools, tool_choice="auto"
        )

        assert request.tools == tools
        assert request.tool_choice == "auto"


class TestTokenUsage:
    """Test cases for TokenUsage."""

    def test_token_usage_creation(self):
        """Test token usage creation."""
        usage = TokenUsage(prompt_tokens=10, completion_tokens=5, total_tokens=15)

        assert usage.prompt_tokens == 10
        assert usage.completion_tokens == 5
        assert usage.total_tokens == 15
        assert usage.cost_estimate == 0.0


class TestLLMResponse:
    """Test cases for LLMResponse."""

    def test_response_creation(self):
        """Test response creation."""
        choices = [
            {
                "index": 0,
                "message": {"role": "assistant", "content": "Hello!"},
                "finish_reason": "stop",
            }
        ]

        usage = TokenUsage(prompt_tokens=5, completion_tokens=2, total_tokens=7)

        response = LLMResponse(
            id="test-response", model="gpt-3.5-turbo", choices=choices, usage=usage
        )

        assert response.id == "test-response"
        assert response.model == "gpt-3.5-turbo"
        assert response.choices == choices
        assert response.usage == usage

    def test_response_content_property(self):
        """Test response content property."""
        choices = [
            {
                "index": 0,
                "message": {"role": "assistant", "content": "Hello world!"},
                "finish_reason": "stop",
            }
        ]

        response = LLMResponse(
            id="test-response",
            model="gpt-3.5-turbo",
            choices=choices,
            usage=TokenUsage(),
        )

        assert response.content == "Hello world!"

    def test_response_content_property_no_content(self):
        """Test response content property with no content."""
        choices = [{"index": 0, "text": "Hello world!", "finish_reason": "stop"}]

        response = LLMResponse(
            id="test-response",
            model="gpt-3.5-turbo",
            choices=choices,
            usage=TokenUsage(),
        )

        assert response.content == "Hello world!"

    def test_response_content_property_empty(self):
        """Test response content property with empty choices."""
        response = LLMResponse(
            id="test-response", model="gpt-3.5-turbo", choices=[], usage=TokenUsage()
        )

        assert response.content is None

    def test_response_first_choice_property(self):
        """Test response first choice property."""
        choices = [
            {"index": 0, "message": {"content": "First"}, "finish_reason": "stop"},
            {"index": 1, "message": {"content": "Second"}, "finish_reason": "stop"},
        ]

        response = LLMResponse(
            id="test-response",
            model="gpt-3.5-turbo",
            choices=choices,
            usage=TokenUsage(),
        )

        assert response.first_choice == choices[0]

    def test_response_first_choice_property_empty(self):
        """Test response first choice property with empty choices."""
        response = LLMResponse(
            id="test-response", model="gpt-3.5-turbo", choices=[], usage=TokenUsage()
        )

        assert response.first_choice is None
