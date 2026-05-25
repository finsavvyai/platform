"""
Tests for LLM Manager.

This module contains unit tests for the LLM manager functionality including
provider selection, failover, and load balancing.
"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.llm.llm_manager import (
    LLMManager,
    ProviderConfig,
    ProviderMetrics,
    ProviderSelectionStrategy,
    ProviderStatus,
)
from app.services.llm.base_provider import (
    BaseLLMProvider,
    LLMRequest,
    LLMResponse,
    LLMMessage,
    TokenUsage,
    ModelInfo,
    ModelCapability,
    MessageRole,
    ProviderError,
    RateLimitError,
)
from app.services.llm.cost_tracker import CostTracker
from app.services.llm.response_validator import (
    ResponseValidator,
    ValidationReport,
)


class MockLLMProvider(BaseLLMProvider):
    """Mock LLM provider for testing."""

    def __init__(
        self,
        name: str,
        config: dict = None,
        should_fail: bool = False,
        fail_type: str = "general",
    ):
        super().__init__(name, config or {})
        self.should_fail = should_fail
        self.fail_type = fail_type
        self._health_status = ProviderStatus.HEALTHY
        self._request_count = 0

    @property
    def supported_models(self):
        return [
            ModelInfo(
                name="mock-model",
                provider=self.name,
                capabilities=[ModelCapability.TEXT_GENERATION],
                max_tokens=1000,
                input_cost_per_1k=0.001,
                output_cost_per_1k=0.002,
                context_window=4000,
            )
        ]

    @property
    def default_model(self):
        return "mock-model"

    async def initialize(self):
        pass

    async def cleanup(self):
        pass

    async def health_check(self):
        return self._health_status

    async def get_models(self, force_refresh=False):
        return self.supported_models

    async def complete(self, request: LLMRequest) -> LLMResponse:
        self._request_count += 1

        if self.should_fail:
            if self.fail_type == "rate_limit":
                raise RateLimitError("Rate limited", provider=self.name)
            elif self.fail_type == "model_not_found":
                from app.services.llm.base_provider import ModelNotFoundError

                raise ModelNotFoundError("Model not found", provider=self.name)
            else:
                raise ProviderError("General error", provider=self.name)

        return LLMResponse(
            id=f"response-{self.name}-{self._request_count}",
            model=request.model,
            choices=[
                {
                    "index": 0,
                    "message": {
                        "role": "assistant",
                        "content": f"Response from {self.name}",
                    },
                    "finish_reason": "stop",
                }
            ],
            usage=TokenUsage(prompt_tokens=10, completion_tokens=5, total_tokens=15),
        )

    async def complete_stream(self, request):
        if self.should_fail:
            raise ProviderError("Stream error", provider=self.name)

        yield f"Stream from {self.name}"

    def estimate_tokens(self, text: str, model: str = None):
        return len(text) // 4

    def calculate_cost(self, usage: TokenUsage, model: str):
        return (usage.total_tokens / 1000) * 0.001


class TestLLMManager:
    """Test cases for LLMManager."""

    @pytest.fixture
    def provider_configs(self):
        """Create provider configurations for testing."""
        return [
            ProviderConfig(
                name="provider1",
                enabled=True,
                priority=1,
                weight=1.0,
                max_requests_per_minute=100,
                max_concurrent_requests=10,
                config={},
            ),
            ProviderConfig(
                name="provider2",
                enabled=True,
                priority=2,
                weight=2.0,
                max_requests_per_minute=50,
                max_concurrent_requests=5,
                config={},
            ),
            ProviderConfig(
                name="provider3",
                enabled=False,  # Disabled provider
                priority=3,
                weight=1.0,
                config={},
            ),
        ]

    @pytest.fixture
    def mock_cost_tracker(self):
        """Create mock cost tracker."""
        tracker = MagicMock(spec=CostTracker)
        tracker.track_usage = AsyncMock()
        return tracker

    @pytest.fixture
    def mock_response_validator(self):
        """Create mock response validator."""
        validator = MagicMock(spec=ResponseValidator)
        validator.validate_response = AsyncMock(
            return_value=ValidationReport(
                response_id="test",
                provider="test",
                model="test",
                timestamp=datetime.now(),
                is_valid=True,
                overall_score=1.0,
                results=[],
                processing_time_ms=100.0,
            )
        )
        return validator

    @pytest.fixture
    def llm_manager(self, provider_configs, mock_cost_tracker, mock_response_validator):
        """Create LLM manager instance."""
        # Mock ProviderFactory.create
        with patch(
            "app.services.llm.llm_manager.ProviderFactory.create"
        ) as mock_create:

            def create_provider(name, config):
                return MockLLMProvider(name, config)

            mock_create.side_effect = create_provider

            manager = LLMManager(
                providers=provider_configs,
                cost_tracker=mock_cost_tracker,
                response_validator=mock_response_validator,
                selection_strategy=ProviderSelectionStrategy.PRIORITY,
            )

            return manager

    @pytest.mark.asyncio
    async def test_manager_initialization(self, llm_manager):
        """Test manager initialization."""
        await llm_manager.initialize()

        assert llm_manager._initialized is True
        assert len(llm_manager._providers) == 2  # Only enabled providers
        assert "provider1" in llm_manager._providers
        assert "provider2" in llm_manager._providers
        assert "provider3" not in llm_manager._providers  # Disabled

    @pytest.mark.asyncio
    async def test_manager_cleanup(self, llm_manager):
        """Test manager cleanup."""
        await llm_manager.initialize()
        await llm_manager.cleanup()

        assert llm_manager._initialized is False
        assert llm_manager._health_check_task is None

    @pytest.mark.asyncio
    async def test_complete_request_success(self, llm_manager):
        """Test successful request completion."""
        await llm_manager.initialize()

        request = LLMRequest(
            messages=[LLMMessage(role=MessageRole.USER, content="Hello")],
            model="mock-model",
        )

        response = await llm_manager.complete(request)

        assert response.model == "mock-model"
        assert "provider1" in response.content or "provider2" in response.content
        assert response.usage.total_tokens == 15

    @pytest.mark.asyncio
    async def test_complete_request_failover(self, llm_manager):
        """Test failover when primary provider fails."""
        await llm_manager.initialize()

        # Make provider1 fail
        provider1_metrics = llm_manager._providers["provider1"]
        provider1_metrics.provider.should_fail = True

        request = LLMRequest(
            messages=[LLMMessage(role=MessageRole.USER, content="Hello")],
            model="mock-model",
        )

        response = await llm_manager.complete(request)

        # Should have used provider2
        assert "provider2" in response.content
        assert provider1_metrics.consecutive_failures > 0

    @pytest.mark.asyncio
    async def test_complete_request_all_providers_fail(self, llm_manager):
        """Test behavior when all providers fail."""
        await llm_manager.initialize()

        # Make all providers fail
        for metrics in llm_manager._providers.values():
            metrics.provider.should_fail = True

        request = LLMRequest(
            messages=[LLMMessage(role=MessageRole.USER, content="Hello")],
            model="mock-model",
        )

        with pytest.raises(ProviderError):
            await llm_manager.complete(request)

    @pytest.mark.asyncio
    async def test_complete_stream_request(self, llm_manager):
        """Test streaming request completion."""
        await llm_manager.initialize()

        request = LLMRequest(
            messages=[LLMMessage(role=MessageRole.USER, content="Hello")],
            model="mock-model",
        )

        chunks = []
        async for chunk in llm_manager.complete_stream(request):
            chunks.append(chunk)

        assert len(chunks) > 0
        assert any("provider1" in chunk or "provider2" in chunk for chunk in chunks)

    @pytest.mark.asyncio
    async def test_provider_status(self, llm_manager):
        """Test getting provider status."""
        await llm_manager.initialize()

        status = await llm_manager.get_provider_status()

        assert len(status) == 2
        assert "provider1" in status
        assert "provider2" in status

        for provider_name, provider_status in status.items():
            assert "enabled" in provider_status
            assert "healthy" in provider_status
            assert "current_requests" in provider_status
            assert "total_requests" in provider_status

    @pytest.mark.asyncio
    async def test_get_available_models(self, llm_manager):
        """Test getting available models."""
        await llm_manager.initialize()

        models = await llm_manager.get_available_models()

        assert len(models) >= 1
        assert "provider1" in models
        assert "provider2" in models

        for provider_name, model_list in models.items():
            assert isinstance(model_list, list)
            assert len(model_list) > 0

    @pytest.mark.asyncio
    async def test_priority_selection_strategy(
        self, provider_configs, mock_cost_tracker, mock_response_validator
    ):
        """Test priority-based provider selection."""
        with patch(
            "app.services.llm.llm_manager.ProviderFactory.create"
        ) as mock_create:

            def create_provider(name, config):
                return MockLLMProvider(name, config)

            mock_create.side_effect = create_provider

            manager = LLMManager(
                providers=provider_configs,
                cost_tracker=mock_cost_tracker,
                response_validator=mock_response_validator,
                selection_strategy=ProviderSelectionStrategy.PRIORITY,
            )

            await manager.initialize()

            request = LLMRequest(
                messages=[LLMMessage(role=MessageRole.USER, content="Hello")],
                model="mock-model",
            )

            response = await manager.complete(request)

            # Should use provider1 (priority 1)
            assert "provider1" in response.content

    @pytest.mark.asyncio
    async def test_round_robin_selection_strategy(
        self, provider_configs, mock_cost_tracker, mock_response_validator
    ):
        """Test round-robin provider selection."""
        with patch(
            "app.services.llm.llm_manager.ProviderFactory.create"
        ) as mock_create:

            def create_provider(name, config):
                return MockLLMProvider(name, config)

            mock_create.side_effect = create_provider

            manager = LLMManager(
                providers=provider_configs,
                cost_tracker=mock_cost_tracker,
                response_validator=mock_response_validator,
                selection_strategy=ProviderSelectionStrategy.ROUND_ROBIN,
            )

            await manager.initialize()

            request = LLMRequest(
                messages=[LLMMessage(role=MessageRole.USER, content="Hello")],
                model="mock-model",
            )

            # Make multiple requests
            responses = []
            for _ in range(4):
                response = await manager.complete(request)
                responses.append(response)

            # Should have used both providers
            providers_used = set()
            for response in responses:
                if "provider1" in response.content:
                    providers_used.add("provider1")
                elif "provider2" in response.content:
                    providers_used.add("provider2")

            assert len(providers_used) == 2

    @pytest.mark.asyncio
    async def test_rate_limiting(self, llm_manager):
        """Test rate limiting behavior."""
        await llm_manager.initialize()

        # Set very low rate limit
        for metrics in llm_manager._providers.values():
            metrics.config.max_requests_per_minute = 1

        request = LLMRequest(
            messages=[LLMMessage(role=MessageRole.USER, content="Hello")],
            model="mock-model",
        )

        # First request should succeed
        response1 = await llm_manager.complete(request)
        assert response1 is not None

        # Second request should fail with rate limit error from same provider
        # but succeed with failover to other provider
        response2 = await llm_manager.complete(request)
        assert response2 is not None

    @pytest.mark.asyncio
    async def test_concurrent_request_limiting(self, llm_manager):
        """Test concurrent request limiting."""
        await llm_manager.initialize()

        # Set very low concurrent limit
        for metrics in llm_manager._providers.values():
            metrics.config.max_concurrent_requests = 1

        request = LLMRequest(
            messages=[LLMMessage(role=MessageRole.USER, content="Hello")],
            model="mock-model",
        )

        # Make concurrent requests
        import asyncio

        async def make_request():
            return await llm_manager.complete(request)

        # Start multiple requests concurrently
        tasks = [make_request() for _ in range(3)]
        responses = await asyncio.gather(*tasks, return_exceptions=True)

        # All should succeed eventually due to failover
        successful_responses = [r for r in responses if isinstance(r, LLMResponse)]
        assert len(successful_responses) == 3

    @pytest.mark.asyncio
    async def test_cost_tracking_integration(self, llm_manager, mock_cost_tracker):
        """Test cost tracking integration."""
        await llm_manager.initialize()

        request = LLMRequest(
            messages=[LLMMessage(role=MessageRole.USER, content="Hello")],
            model="mock-model",
            metadata={"tenant_id": "test-tenant"},
        )

        await llm_manager.complete(request)

        # Verify cost tracking was called
        mock_cost_tracker.track_usage.assert_called_once()
        call_args = mock_cost_tracker.track_usage.call_args

        assert call_args[1]["provider"] in ["provider1", "provider2"]
        assert call_args[1]["model"] == "mock-model"
        assert call_args[1]["tenant_id"] == "test-tenant"

    @pytest.mark.asyncio
    async def test_response_validation_integration(
        self, llm_manager, mock_response_validator
    ):
        """Test response validation integration."""
        await llm_manager.initialize()

        request = LLMRequest(
            messages=[LLMMessage(role=MessageRole.USER, content="Hello")],
            model="mock-model",
        )

        await llm_manager.complete(request)

        # Verify validation was called
        mock_response_validator.validate_response.assert_called_once()

    @pytest.mark.asyncio
    async def test_health_check_loop(self, llm_manager):
        """Test health check loop."""
        await llm_manager.initialize()

        # Simulate health check execution
        await llm_manager._perform_health_checks()

        # All providers should still be healthy
        for metrics in llm_manager._providers.values():
            assert metrics.is_healthy

    @pytest.mark.asyncio
    async def test_circuit_breaker(self, llm_manager):
        """Test circuit breaker functionality."""
        await llm_manager.initialize()

        provider1_metrics = llm_manager._providers["provider1"]

        # Simulate multiple failures
        for _ in range(5):
            provider1_metrics.record_failure()

        # Provider should now be unhealthy
        assert not provider1_metrics.is_healthy

        # Request should use provider2
        request = LLMRequest(
            messages=[LLMMessage(role=MessageRole.USER, content="Hello")],
            model="mock-model",
        )

        response = await llm_manager.complete(request)
        assert "provider2" in response.content

    def test_provider_metrics_can_accept_request(self):
        """Test provider metrics can_accept_request logic."""
        config = ProviderConfig(
            name="test",
            enabled=True,
            max_concurrent_requests=2,
            max_requests_per_minute=10,
        )

        provider = MockLLMProvider("test")
        metrics = ProviderMetrics(provider=provider, config=config)

        # Initially should accept requests
        assert metrics.can_accept_request is True

        # Test concurrent request limit
        metrics.current_requests = 2
        assert metrics.can_accept_request is False

        # Reset and test rate limit
        metrics.current_requests = 0
        metrics.request_times.extend(
            [
                datetime.now() - timedelta(seconds=30),
                datetime.now() - timedelta(seconds=30),
                datetime.now() - timedelta(seconds=30),
            ]
        )

        # Should still accept if under rate limit
        assert metrics.can_accept_request is True

        # Add more requests to exceed rate limit
        for _ in range(8):
            metrics.request_times.append(datetime.now() - timedelta(seconds=10))

        # Should now be rate limited
        assert metrics.can_accept_request is False

    def test_provider_metrics_avg_response_time(self):
        """Test average response time calculation."""
        provider = MockLLMProvider("test")
        metrics = ProviderMetrics(provider=provider, config=ProviderConfig("test"))

        # Initially should be 0
        assert metrics.avg_response_time == 0.0

        # Add some request times
        base_time = datetime.now()
        metrics.request_times.extend(
            [
                base_time,
                base_time + timedelta(seconds=1),
                base_time + timedelta(seconds=2),
                base_time + timedelta(seconds=3),
            ]
        )

        # Should calculate average
        expected_avg = 1.5  # (1+2+3)/3
        assert abs(metrics.avg_response_time - expected_avg) < 0.1

    def test_provider_metrics_success_rate(self):
        """Test success rate calculation."""
        provider = MockLLMProvider("test")
        metrics = ProviderMetrics(provider=provider, config=ProviderConfig("test"))

        # Initially should be 0
        assert metrics.success_rate == 0.0

        # Add some successful requests
        metrics.provider.metrics.success_count = 8
        metrics.provider.metrics.request_count = 10

        assert metrics.success_rate == 80.0

    @pytest.mark.asyncio
    async def test_context_manager(self, llm_manager):
        """Test async context manager."""
        async with llm_manager as manager:
            assert manager._initialized is True

        assert manager._initialized is False
