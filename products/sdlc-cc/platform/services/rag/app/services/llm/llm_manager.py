"""
LLM Manager - Central orchestration for multiple LLM providers.

This module provides intelligent routing, failover, load balancing,
and provider management for all LLM operations.
"""

import asyncio
import logging
import time
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional, AsyncGenerator
from dataclasses import dataclass
from collections import deque

from .base_provider import (
    BaseLLMProvider,
    LLMRequest,
    LLMResponse,
    LLMError,
    ProviderStatus,
    ModelCapability,
    ProviderFactory,
    RateLimitError,
    ModelNotFoundError,
)
from .cost_tracker import CostTracker
from .response_validator import ResponseValidator

try:
    from app.observability.langfuse_client import trace_llm_call
except Exception:  # pragma: no cover - observability is optional
    def trace_llm_call(*_args, **_kwargs) -> None:  # type: ignore
        return None

logger = logging.getLogger(__name__)


class ProviderSelectionStrategy(Enum):
    """Provider selection strategies."""

    PRIORITY = "priority"  # Use providers in priority order
    ROUND_ROBIN = "round_robin"  # Rotate through providers
    COST_OPTIMIZED = "cost_optimized"  # Choose cheapest available
    PERFORMANCE_OPTIMIZED = "performance_optimized"  # Choose fastest
    LOAD_BALANCED = "load_balanced"  # Distribute load evenly
    HEALTH_AWARE = "health_aware"  # Prioritize healthy providers


@dataclass
class ProviderConfig:
    """Provider configuration."""

    name: str
    enabled: bool = True
    priority: int = 1
    weight: float = 1.0
    max_requests_per_minute: Optional[int] = None
    max_concurrent_requests: Optional[int] = None
    timeout_seconds: int = 30
    config: Dict[str, Any] = None

    def __post_init__(self):
        if self.config is None:
            self.config = {}


@dataclass
class ProviderMetrics:
    """Extended provider metrics for the manager."""

    provider: BaseLLMProvider
    config: ProviderConfig
    last_health_check: Optional[datetime] = None
    last_failure_time: Optional[datetime] = None
    consecutive_failures: int = 0
    current_requests: int = 0
    total_requests: int = 0
    request_times: deque = None  # Recent request times for performance tracking
    rate_limit_reset_time: Optional[datetime] = None

    def __post_init__(self):
        if self.request_times is None:
            self.request_times = deque(maxlen=100)  # Keep last 100 request times

    @property
    def is_healthy(self) -> bool:
        """Check if provider is considered healthy."""
        if self.provider.metrics.status == ProviderStatus.UNAVAILABLE:
            return False

        # Check if provider has been failing too much
        if self.consecutive_failures >= 3:
            return False

        # Check if provider is rate limited
        if self.provider.metrics.status == ProviderStatus.RATE_LIMITED:
            if (
                self.rate_limit_reset_time
                and datetime.now() < self.rate_limit_reset_time
            ):
                return False

        return True

    @property
    def can_accept_request(self) -> bool:
        """Check if provider can accept new requests."""
        if not self.is_healthy:
            return False

        if not self.config.enabled:
            return False

        # Check concurrent request limit
        if (
            self.config.max_concurrent_requests
            and self.current_requests >= self.config.max_concurrent_requests
        ):
            return False

        # Check rate limit
        if self.config.max_requests_per_minute:
            current_time = datetime.now()
            one_minute_ago = current_time - timedelta(minutes=1)

            # Count requests in the last minute
            recent_requests = sum(1 for rt in self.request_times if rt > one_minute_ago)

            if recent_requests >= self.config.max_requests_per_minute:
                return False

        return True

    @property
    def avg_response_time(self) -> float:
        """Calculate average response time."""
        if not self.request_times:
            return 0.0

        if len(self.request_times) < 2:
            return 0.0

        times = list(self.request_times)
        total_time = sum(
            (times[i] - times[i - 1]).total_seconds() for i in range(1, len(times))
        )
        return total_time / (len(times) - 1)

    def add_request_time(self) -> None:
        """Add a request timestamp."""
        self.request_times.append(datetime.now())

    def record_failure(self) -> None:
        """Record a failure."""
        self.last_failure_time = datetime.now()
        self.consecutive_failures += 1

    def record_success(self) -> None:
        """Record a success."""
        self.consecutive_failures = 0
        self.total_requests += 1


class LLMManager:
    """Central manager for LLM providers with intelligent routing."""

    def __init__(
        self,
        providers: List[ProviderConfig],
        cost_tracker: Optional[CostTracker] = None,
        response_validator: Optional[ResponseValidator] = None,
        selection_strategy: ProviderSelectionStrategy = ProviderSelectionStrategy.PRIORITY,
        health_check_interval: int = 60,  # seconds
        circuit_breaker_threshold: int = 5,  # consecutive failures
        circuit_breaker_timeout: int = 300,  # seconds
    ):
        """Initialize LLM Manager."""
        self.providers_config = {config.name: config for config in providers}
        self.selection_strategy = selection_strategy
        self.health_check_interval = health_check_interval
        self.circuit_breaker_threshold = circuit_breaker_threshold
        self.circuit_breaker_timeout = circuit_breaker_timeout

        self.cost_tracker = cost_tracker
        self.response_validator = response_validator

        # Provider management
        self._providers: Dict[str, ProviderMetrics] = {}
        self._round_robin_index = 0
        self._health_check_task: Optional[asyncio.Task] = None
        self._lock = asyncio.Lock()

        # Initialize providers
        self._initialized = False

    async def initialize(self) -> None:
        """Initialize all providers and start health monitoring."""
        async with self._lock:
            if self._initialized:
                return

            logger.info("Initializing LLM Manager...")

            # Create and initialize providers
            for config in self.providers_config.values():
                try:
                    provider = ProviderFactory.create(config.name, config.config)
                    await provider.initialize()

                    metrics = ProviderMetrics(provider=provider, config=config)

                    self._providers[config.name] = metrics
                    logger.info(f"Initialized provider: {config.name}")

                except Exception as e:
                    logger.error(f"Failed to initialize provider {config.name}: {e}")
                    continue

            if not self._providers:
                raise RuntimeError("No providers could be initialized")

            # Start health monitoring
            self._health_check_task = asyncio.create_task(self._health_check_loop())

            self._initialized = True
            logger.info(
                f"LLM Manager initialized with {len(self._providers)} providers"
            )

    async def cleanup(self) -> None:
        """Clean up all providers and stop monitoring."""
        async with self._lock:
            if not self._initialized:
                return

            logger.info("Cleaning up LLM Manager...")

            # Stop health monitoring
            if self._health_check_task:
                self._health_check_task.cancel()
                try:
                    await self._health_check_task
                except asyncio.CancelledError:
                    pass

            # Clean up providers
            for metrics in self._providers.values():
                try:
                    await metrics.provider.cleanup()
                except Exception as e:
                    logger.error(
                        f"Error cleaning up provider {metrics.provider.name}: {e}"
                    )

            self._providers.clear()
            self._initialized = False
            logger.info("LLM Manager cleaned up")

    async def complete(self, request: LLMRequest) -> LLMResponse:
        """Complete a request with intelligent provider selection."""
        if not self._initialized:
            await self.initialize()

        start_time = time.time()
        last_error = None

        # Get available providers for this request
        available_providers = await self._get_available_providers(request)

        if not available_providers:
            raise LLMError("No providers available for request")

        # Select provider based on strategy
        for provider_metrics in self._select_providers(available_providers, request):
            try:
                logger.debug(
                    f"Attempting request with provider: {provider_metrics.provider.name}"
                )

                # Increment concurrent requests
                provider_metrics.current_requests += 1
                provider_metrics.add_request_time()

                try:
                    # Make request
                    response = await provider_metrics.provider.complete(request)

                    # Record success
                    provider_metrics.record_success()

                    # Track cost if available
                    if self.cost_tracker:
                        await self.cost_tracker.track_usage(
                            provider=provider_metrics.provider.name,
                            model=request.model,
                            usage=response.usage,
                            cost=provider_metrics.provider.calculate_cost(
                                response.usage, request.model
                            ),
                            tenant_id=request.metadata.get("tenant_id")
                            if request.metadata
                            else None,
                        )

                    # Validate response if validator is available
                    if self.response_validator:
                        validation_result = (
                            await self.response_validator.validate_response(
                                response=response,
                                request=request,
                                provider=provider_metrics.provider.name,
                            )
                        )

                        if not validation_result.is_valid:
                            logger.warning(
                                f"Response validation failed for provider {provider_metrics.provider.name}: {validation_result.reason}"
                            )
                            # Continue to next provider for critical validation failures
                            if validation_result.is_critical:
                                raise LLMError(
                                    f"Response validation failed: {validation_result.reason}"
                                )

                    logger.info(
                        f"Request completed successfully with provider: {provider_metrics.provider.name}"
                    )

                    # Langfuse observability (no-op if disabled)
                    try:
                        req_meta = request.metadata or {}
                        trace_llm_call(
                            name=f"rag.llm.{provider_metrics.provider.name}",
                            input=getattr(request, "messages", None)
                            or getattr(request, "prompt", None),
                            output=getattr(response, "content", None)
                            or getattr(response, "text", None),
                            metadata={
                                "provider": provider_metrics.provider.name,
                                "model": request.model,
                                "latency_ms": int((time.time() - start_time) * 1000),
                            },
                            user_id=req_meta.get("user_id"),
                            tenant_id=req_meta.get("tenant_id"),
                            model=request.model,
                            usage=getattr(response, "usage", None),
                        )
                    except Exception as trace_exc:  # pragma: no cover - defensive
                        logger.debug("Langfuse tracing skipped: %s", trace_exc)

                    return response

                except Exception as e:
                    last_error = e
                    logger.warning(
                        f"Request failed with provider {provider_metrics.provider.name}: {e}"
                    )

                    # Record failure
                    provider_metrics.record_failure()

                    # Check if we should retry with another provider
                    if self._should_retry(e, provider_metrics):
                        continue
                    else:
                        raise

                finally:
                    # Decrement concurrent requests
                    provider_metrics.current_requests -= 1

            except Exception as e:
                last_error = e
                logger.warning(
                    f"Provider selection failed for {provider_metrics.provider.name}: {e}"
                )
                continue

        # All providers failed
        logger.error("All providers failed for request")
        if last_error:
            raise last_error
        else:
            raise LLMError("All providers failed")

    async def complete_stream(self, request: LLMRequest) -> AsyncGenerator[str, None]:
        """Complete a streaming request with intelligent provider selection."""
        if not self._initialized:
            await self.initialize()

        # Get available providers for this request
        available_providers = await self._get_available_providers(request)

        if not available_providers:
            raise LLMError("No providers available for streaming request")

        # Select provider based on strategy (try first available for streaming)
        for provider_metrics in self._select_providers(available_providers, request):
            try:
                logger.debug(
                    f"Attempting streaming request with provider: {provider_metrics.provider.name}"
                )

                # Increment concurrent requests
                provider_metrics.current_requests += 1
                provider_metrics.add_request_time()

                try:
                    # Stream response
                    async for chunk in provider_metrics.provider.complete_stream(
                        request
                    ):
                        yield chunk

                    # Record success
                    provider_metrics.record_success()

                    # Track estimated cost for streaming
                    if self.cost_tracker:
                        # Estimate cost based on tokens (rough estimate)
                        estimated_tokens = provider_metrics.provider.estimate_tokens(
                            "".join(chunk for chunk in ""), request.model
                        )
                        await self.cost_tracker.track_usage(
                            provider=provider_metrics.provider.name,
                            model=request.model,
                            estimated_tokens=estimated_tokens,
                            tenant_id=request.metadata.get("tenant_id")
                            if request.metadata
                            else None,
                        )

                    logger.info(
                        f"Streaming request completed with provider: {provider_metrics.provider.name}"
                    )
                    return

                except Exception as e:
                    logger.warning(
                        f"Streaming request failed with provider {provider_metrics.provider.name}: {e}"
                    )

                    # Record failure
                    provider_metrics.record_failure()

                    # For streaming, we typically don't retry with other providers
                    # as the stream has already started
                    raise

                finally:
                    # Decrement concurrent requests
                    provider_metrics.current_requests -= 1

            except Exception as e:
                logger.error(
                    f"Streaming provider selection failed for {provider_metrics.provider.name}: {e}"
                )
                raise

        raise LLMError("No providers available for streaming request")

    async def get_provider_status(self) -> Dict[str, Dict[str, Any]]:
        """Get status of all providers."""
        if not self._initialized:
            await self.initialize()

        status = {}
        for name, metrics in self._providers.items():
            status[name] = {
                "enabled": metrics.config.enabled,
                "healthy": metrics.is_healthy,
                "can_accept_request": metrics.can_accept_request,
                "current_requests": metrics.current_requests,
                "total_requests": metrics.total_requests,
                "consecutive_failures": metrics.consecutive_failures,
                "avg_response_time": metrics.avg_response_time,
                "provider_status": metrics.provider.metrics.status.value,
                "success_rate": metrics.provider.metrics.success_rate,
                "last_health_check": metrics.last_health_check.isoformat()
                if metrics.last_health_check
                else None,
                "last_failure_time": metrics.last_failure_time.isoformat()
                if metrics.last_failure_time
                else None,
            }

        return status

    async def get_available_models(self) -> Dict[str, List[str]]:
        """Get available models grouped by provider."""
        if not self._initialized:
            await self.initialize()

        models = {}
        for name, metrics in self._providers.items():
            if metrics.is_healthy:
                try:
                    provider_models = await metrics.provider.get_models()
                    models[name] = [model.name for model in provider_models]
                except Exception as e:
                    logger.error(f"Failed to get models from provider {name}: {e}")
                    models[name] = []

        return models

    async def _get_available_providers(
        self, request: LLMRequest
    ) -> List[ProviderMetrics]:
        """Get list of providers that can handle the request."""
        available = []

        for metrics in self._providers.values():
            # Check if provider can accept requests
            if not metrics.can_accept_request:
                continue

            # Check if provider supports the requested model
            try:
                models = await metrics.provider.get_models()
                model_names = [model.name for model in models]
                if request.model not in model_names:
                    continue
            except Exception as e:
                logger.warning(
                    f"Failed to check models for provider {metrics.provider.name}: {e}"
                )
                continue

            # Check if provider supports required capabilities
            if request.tools and not metrics.provider.supports_capability(
                ModelCapability.TOOL_USE, request.model
            ):
                continue

            available.append(metrics)

        return available

    def _select_providers(
        self, available_providers: List[ProviderMetrics], request: LLMRequest
    ) -> List[ProviderMetrics]:
        """Select providers based on the configured strategy."""
        if not available_providers:
            return []

        if self.selection_strategy == ProviderSelectionStrategy.PRIORITY:
            return sorted(
                available_providers, key=lambda m: (m.config.priority, -m.config.weight)
            )

        elif self.selection_strategy == ProviderSelectionStrategy.ROUND_ROBIN:
            # Simple round-robin
            providers = sorted(available_providers, key=lambda m: m.config.priority)
            index = self._round_robin_index % len(providers)
            self._round_robin_index += 1
            return [providers[index]] + [
                p for i, p in enumerate(providers) if i != index
            ]

        elif self.selection_strategy == ProviderSelectionStrategy.COST_OPTIMIZED:
            # Sort by estimated cost (cheapest first)
            return sorted(
                available_providers, key=lambda m: m.provider.get_cost_estimate(request)
            )

        elif self.selection_strategy == ProviderSelectionStrategy.PERFORMANCE_OPTIMIZED:
            # Sort by average response time (fastest first)
            return sorted(available_providers, key=lambda m: m.avg_response_time)

        elif self.selection_strategy == ProviderSelectionStrategy.LOAD_BALANCED:
            # Sort by current load (least busy first)
            return sorted(available_providers, key=lambda m: m.current_requests)

        elif self.selection_strategy == ProviderSelectionStrategy.HEALTH_AWARE:
            # Sort by health status and success rate
            return sorted(
                available_providers,
                key=lambda m: (
                    -m.provider.metrics.success_rate,
                    m.consecutive_failures,
                    m.current_requests,
                ),
            )

        else:
            # Default to priority
            return sorted(
                available_providers, key=lambda m: (m.config.priority, -m.config.weight)
            )

    def _should_retry(
        self, error: Exception, provider_metrics: ProviderMetrics
    ) -> bool:
        """Determine if a request should be retried with another provider."""
        # Don't retry for certain error types
        if isinstance(error, ModelNotFoundError):
            return False

        if isinstance(error, RateLimitError):
            # Don't retry if rate limited, wait for reset
            return False

        # Retry for other errors
        return True

    async def _health_check_loop(self) -> None:
        """Background health checking loop."""
        while True:
            try:
                await asyncio.sleep(self.health_check_interval)
                await self._perform_health_checks()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Health check loop error: {e}")

    async def _perform_health_checks(self) -> None:
        """Perform health checks on all providers."""
        current_time = datetime.now()

        for metrics in self._providers.values():
            try:
                status = await metrics.provider.health_check()
                metrics.last_health_check = current_time

                # Reset consecutive failures on successful health check
                if status in [ProviderStatus.HEALTHY, ProviderStatus.DEGRADED]:
                    if metrics.consecutive_failures > 0:
                        logger.info(f"Provider {metrics.provider.name} recovered")
                    metrics.consecutive_failures = 0

                logger.debug(
                    f"Health check for {metrics.provider.name}: {status.value}"
                )

            except Exception as e:
                logger.error(
                    f"Health check failed for provider {metrics.provider.name}: {e}"
                )
                metrics.record_failure()
                metrics.last_health_check = current_time

    async def __aenter__(self):
        """Async context manager entry."""
        await self.initialize()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        await self.cleanup()
