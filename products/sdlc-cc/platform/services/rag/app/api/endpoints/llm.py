"""
LLM API Endpoints.

This module provides REST API endpoints for LLM operations including
chat completions, embeddings, provider management, and monitoring.
"""

import logging
import time
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks, status
from fastapi.responses import StreamingResponse

from ...services.llm.llm_manager import (
    LLMManager,
    ProviderConfig,
    ProviderSelectionStrategy,
)
from ...services.llm.cost_tracker import CostTracker
from ...services.llm.response_validator import ResponseValidator
from ...services.llm.llm_monitor import LLMMonitor
from ...config.llm_config import get_llm_config, LLMConfigManager
from ...core.error_handling import handle_api_error
from ..dependencies import get_current_user, get_tenant_id
from ..middleware.rate_limit import rate_limiter
from ..middleware.auth import require_permissions
from ..middleware.audit import audit_endpoint
from ..monitoring.metrics import track_request_metrics

from ..schemas.llm import (
    ChatCompletionRequest,
    ChatCompletionResponse,
    StreamingChunk,
    EmbeddingRequest,
    EmbeddingResponse,
    ProviderInfo,
    ModelInfo,
    HealthCheckResponse,
    CostMetrics,
    BudgetStatus,
    LLMConfiguration,
    MessageRole,
    ChatMessage,
    ChatTool,
)

logger = logging.getLogger(__name__)

# Create router
router = APIRouter(prefix="/llm", tags=["LLM"])

# Global instances (will be initialized on startup)
llm_manager: Optional[LLMManager] = None
cost_tracker: Optional[CostTracker] = None
response_validator: Optional[ResponseValidator] = None
llm_monitor: Optional[LLMMonitor] = None
config_manager: Optional[LLMConfigManager] = None


async def get_llm_manager() -> LLMManager:
    """Get LLM manager instance."""
    global llm_manager
    if llm_manager is None:
        config = await get_llm_config()

        # Convert config to provider configs
        provider_configs = []
        for provider_cfg in config.providers:
            provider_config = ProviderConfig(
                name=provider_cfg.name,
                enabled=provider_cfg.enabled,
                priority=provider_cfg.priority,
                weight=provider_cfg.weight,
                max_requests_per_minute=provider_cfg.max_requests_per_minute,
                max_concurrent_requests=provider_cfg.max_concurrent_requests,
                timeout=provider_cfg.timeout,
                config={
                    "api_key": provider_cfg.api_key,
                    "base_url": provider_cfg.base_url,
                    "organization": provider_cfg.organization,
                    "timeout": provider_cfg.timeout,
                    "max_retries": provider_cfg.max_retries,
                },
            )
            provider_configs.append(provider_config)

        # Initialize manager
        llm_manager = LLMManager(
            providers=provider_configs,
            selection_strategy=ProviderSelectionStrategy(
                config.selection_strategy.value
            ),
            cost_tracker=cost_tracker,
            response_validator=response_validator,
        )

        await llm_manager.initialize()

    return llm_manager


async def get_cost_tracker() -> CostTracker:
    """Get cost tracker instance."""
    global cost_tracker
    if cost_tracker is None:
        config = await get_llm_config()
        cost_tracker = CostTracker(
            redis_url=config.caching.redis_url or "redis://localhost:6379/0",
            default_currency=config.cost.default_currency,
            cost_precision=config.cost.cost_precision,
        )
        await cost_tracker.initialize()

    return cost_tracker


async def get_response_validator() -> ResponseValidator:
    """Get response validator instance."""
    global response_validator
    if response_validator is None:
        config = await get_llm_config()
        response_validator = ResponseValidator(
            enable_content_safety=config.validation.content_safety_enabled,
            enable_pii_detection=config.validation.pii_detection_enabled,
            enable_format_validation=config.validation.format_validation_enabled,
            enable_quality_assessment=config.validation.quality_assessment_enabled,
        )

    return response_validator


async def get_llm_monitor() -> LLMMonitor:
    """Get LLM monitor instance."""
    global llm_monitor
    if llm_monitor is None:
        config = await get_llm_config()
        llm_monitor = LLMMonitor(
            llm_manager=await get_llm_manager(),
            cost_tracker=await get_cost_tracker(),
            enabled=config.monitoring.enabled,
            metrics_interval=config.monitoring.metrics_interval,
        )
        await llm_monitor.initialize()

    return llm_monitor


# Chat Completion Endpoints
@router.post("/chat/completions", response_model=ChatCompletionResponse)
@audit_endpoint("llm.chat.completion")
@rate_limiter("llm:chat", per_minute=60)
@track_request_metrics("llm.chat.completion")
async def create_chat_completion(
    request: ChatCompletionRequest,
    background_tasks: BackgroundTasks,
    current_user: Dict[str, Any] = Depends(get_current_user),
    tenant_id: str = Depends(get_tenant_id),
):
    """
    Create a chat completion.

    This endpoint generates a response to a list of messages using the specified
    or automatically selected LLM provider and model.
    """
    try:
        # Get LLM manager
        manager = await get_llm_manager()

        # Convert request to internal format
        from ...services.llm.base_provider import LLMRequest, LLMMessage

        messages = [
            LLMMessage(
                role=MessageRole(msg.role),
                content=msg.content,
                name=msg.name,
                function_call=msg.function_call,
                tool_calls=msg.tool_calls,
                tool_call_id=msg.tool_call_id,
            )
            for msg in request.messages
        ]

        tools = None
        if request.tools:
            tools = [
                ChatTool(
                    name=tool.name,
                    description=tool.description,
                    parameters=tool.parameters,
                )
                for tool in request.tools
            ]

        internal_request = LLMRequest(
            messages=messages,
            model=request.model or "gpt-3.5-turbo",  # Default model
            max_tokens=request.max_tokens,
            temperature=request.temperature,
            top_p=request.top_p,
            frequency_penalty=request.frequency_penalty,
            presence_penalty=request.presence_penalty,
            stop=request.stop,
            stream=False,
            tools=tools,
            tool_choice=request.tool_choice,
            user=request.user,
            metadata={
                "tenant_id": tenant_id,
                "user_id": current_user.get("sub"),
                "request_id": str(uuid.uuid4()),
                **(request.metadata or {}),
            },
        )

        # Process request
        start_time = time.time()
        response = await manager.complete(internal_request)
        processing_time = (time.time() - start_time) * 1000

        # Convert response to API format
        choices = []
        for choice in response.choices:
            choice_data = {
                "index": choice["index"],
                "finish_reason": choice["finish_reason"],
            }

            if "message" in choice:
                choice_data["message"] = ChatMessage(
                    role=MessageRole(choice["message"]["role"]),
                    content=choice["message"]["content"],
                    name=choice["message"].get("name"),
                    function_call=choice["message"].get("function_call"),
                    tool_calls=choice["message"].get("tool_calls"),
                )

            choices.append(choice_data)

        # Prepare API response
        api_response = ChatCompletionResponse(
            id=response.id,
            object=response.object,
            created=response.created,
            model=response.model,
            choices=choices,
            usage=response.usage,
            provider=response.provider,
            request_id=response.request_id,
            processing_time_ms=processing_time,
            cost=manager.cost_tracker.calculate_cost(response.usage, response.model)
            if manager.cost_tracker
            else None,
        )

        # Add validation results if available
        if manager.response_validator:
            try:
                validation_report = await manager.response_validator.validate_response(
                    response=response,
                    request=internal_request,
                    provider=response.provider,
                )
                api_response.validation = {
                    "is_valid": validation_report.is_valid,
                    "overall_score": validation_report.overall_score,
                    "issues_count": len(validation_report.results),
                    "critical_issues": len(validation_report.critical_issues),
                }
            except Exception as e:
                logger.warning(f"Validation failed: {e}")
                api_response.validation = {
                    "is_valid": True,  # Assume valid if validation fails
                    "error": str(e),
                }

        return api_response

    except Exception as e:
        logger.error(f"Chat completion failed: {e}")
        raise handle_api_error(e, request_id=str(uuid.uuid4()))


@router.post("/chat/completions/stream")
@audit_endpoint("llm.chat.completion.stream")
@rate_limiter("llm:chat:stream", per_minute=30)
@track_request_metrics("llm.chat.completion.stream")
async def create_chat_completion_stream(
    request: ChatCompletionRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    tenant_id: str = Depends(get_tenant_id),
):
    """
    Create a streaming chat completion.

    This endpoint generates a streaming response to a list of messages.
    The response is sent as server-sent events (SSE).
    """
    try:
        # Get LLM manager
        manager = await get_llm_manager()

        # Convert request to internal format
        from ...services.llm.base_provider import LLMRequest, LLMMessage

        messages = [
            LLMMessage(
                role=MessageRole(msg.role),
                content=msg.content,
                name=msg.name,
                function_call=msg.function_call,
                tool_calls=msg.tool_calls,
                tool_call_id=msg.tool_call_id,
            )
            for msg in request.messages
        ]

        internal_request = LLMRequest(
            messages=messages,
            model=request.model or "gpt-3.5-turbo",
            max_tokens=request.max_tokens,
            temperature=request.temperature,
            stream=True,
            user=request.user,
            metadata={
                "tenant_id": tenant_id,
                "user_id": current_user.get("sub"),
                "request_id": str(uuid.uuid4()),
                **(request.metadata or {}),
            },
        )

        async def generate_stream():
            """Generate streaming response."""
            try:
                chunk_id = str(uuid.uuid4())
                created_time = int(time.time())
                accumulated_content = ""

                async for chunk in manager.complete_stream(internal_request):
                    accumulated_content += chunk

                    streaming_chunk = StreamingChunk(
                        id=chunk_id,
                        object="chat.completion.chunk",
                        created=created_time,
                        model=internal_request.model,
                        choices=[
                            {
                                "index": 0,
                                "delta": {"content": chunk},
                            }
                        ],
                        provider="streaming",
                        request_id=internal_request.metadata["request_id"],
                        finished=False,
                    )

                    yield f"data: {streaming_chunk.json()}\n\n"

                # Send final chunk
                final_chunk = StreamingChunk(
                    id=chunk_id,
                    object="chat.completion.chunk",
                    created=created_time,
                    model=internal_request.model,
                    choices=[
                        {
                            "index": 0,
                            "delta": {},
                            "finish_reason": "stop",
                        }
                    ],
                    provider="streaming",
                    request_id=internal_request.metadata["request_id"],
                    finished=True,
                )

                yield f"data: {final_chunk.json()}\n\n"
                yield "data: [DONE]\n\n"

            except Exception as e:
                logger.error(f"Streaming failed: {e}")
                error_chunk = {
                    "error": {
                        "message": str(e),
                        "type": "streaming_error",
                        "code": "streaming_failed",
                    }
                }
                yield f"data: {error_chunk}\n\n"
                yield "data: [DONE]\n\n"

        return StreamingResponse(
            generate_stream(),
            media_type="text/plain",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",  # Disable nginx buffering
            },
        )

    except Exception as e:
        logger.error(f"Streaming chat completion failed: {e}")
        raise handle_api_error(e, request_id=str(uuid.uuid4()))


# Embedding Endpoints
@router.post("/embeddings", response_model=EmbeddingResponse)
@audit_endpoint("llm.embeddings")
@rate_limiter("llm:embeddings", per_minute=100)
@track_request_metrics("llm.embeddings")
async def create_embeddings(
    request: EmbeddingRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
    tenant_id: str = Depends(get_tenant_id),
):
    """
    Create embeddings for input text(s).

    This endpoint generates vector embeddings for the provided text(s) using
    the specified embedding model.
    """
    try:
        # Get LLM manager
        manager = await get_llm_manager()

        # For now, we'll use OpenAI for embeddings
        # In a full implementation, you'd have proper embedding provider selection
        openai_provider = None
        for metrics in manager._providers.values():
            if metrics.provider.name == "openai":
                openai_provider = metrics.provider
                break

        if not openai_provider:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="No embedding provider available",
            )

        start_time = time.time()

        # Normalize input
        if isinstance(request.input, str):
            texts = [request.input]
        else:
            texts = request.input

        # Generate embeddings
        embeddings = await openai_provider.create_embedding(
            texts=texts, model=request.model or "text-embedding-ada-002"
        )

        processing_time = (time.time() - start_time) * 1000

        # Create response
        embedding_data = [
            {
                "object": "embedding",
                "embedding": embedding,
                "index": i,
            }
            for i, embedding in enumerate(embeddings)
        ]

        # Estimate token usage
        total_text = " ".join(texts)
        estimated_tokens = openai_provider.estimate_tokens(total_text)

        usage = {
            "prompt_tokens": estimated_tokens,
            "completion_tokens": 0,
            "total_tokens": estimated_tokens,
        }

        response = EmbeddingResponse(
            object="list",
            data=embedding_data,
            model=request.model or "text-embedding-ada-002",
            provider=openai_provider.name,
            usage=usage,
            request_id=str(uuid.uuid4()),
            processing_time_ms=processing_time,
        )

        # Track cost
        if manager.cost_tracker:
            await manager.cost_tracker.track_usage(
                provider=openai_provider.name,
                model=response.model,
                usage=usage,
                cost=openai_provider.calculate_cost(usage, response.model),
                tenant_id=tenant_id,
                user_id=current_user.get("sub"),
            )

        return response

    except Exception as e:
        logger.error(f"Embedding generation failed: {e}")
        raise handle_api_error(e, request_id=str(uuid.uuid4()))


# Provider Management Endpoints
@router.get("/providers", response_model=List[ProviderInfo])
@require_permissions("llm:providers:read")
async def list_providers():
    """List all LLM providers and their status."""
    try:
        manager = await get_llm_manager()
        provider_status = await manager.get_provider_status()

        providers = []
        for name, status in provider_status.items():
            # Get available models for this provider
            models = []
            try:
                provider_metrics = manager._providers[name]
                provider_models = await provider_metrics.provider.get_models()
                models = [model.name for model in provider_models]
            except Exception:
                pass

            provider_info = ProviderInfo(
                name=name,
                status=status["provider_status"],
                enabled=status["enabled"],
                healthy=status["healthy"],
                can_accept_request=status["can_accept_request"],
                current_requests=status["current_requests"],
                total_requests=status["total_requests"],
                consecutive_failures=status["consecutive_failures"],
                avg_response_time=status["avg_response_time"],
                success_rate=status["success_rate"],
                models=models,
                last_health_check=datetime.fromisoformat(status["last_health_check"])
                if status["last_health_check"]
                else None,
                last_failure_time=datetime.fromisoformat(status["last_failure_time"])
                if status["last_failure_time"]
                else None,
            )
            providers.append(provider_info)

        return providers

    except Exception as e:
        logger.error(f"Failed to list providers: {e}")
        raise handle_api_error(e)


@router.get("/providers/{provider_name}/models", response_model=List[ModelInfo])
@require_permissions("llm:providers:read")
async def list_provider_models(provider_name: str):
    """List available models for a specific provider."""
    try:
        manager = await get_llm_manager()

        # Find provider
        provider_metrics = None
        for metrics in manager._providers.values():
            if metrics.provider.name == provider_name:
                provider_metrics = metrics
                break

        if not provider_metrics:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Provider '{provider_name}' not found",
            )

        # Get models
        models = await provider_metrics.provider.get_models()

        return [
            ModelInfo(
                name=model.name,
                provider=model.provider,
                capabilities=[cap.value for cap in model.capabilities],
                max_tokens=model.max_tokens,
                input_cost_per_1k=model.input_cost_per_1k,
                output_cost_per_1k=model.output_cost_per_1k,
                context_window=model.context_window,
                description=model.description,
                deprecated=model.deprecated,
                streaming_supported=model.streaming_supported,
                function_calling_supported=model.function_calling_supported,
                vision_supported=model.vision_supported,
            )
            for model in models
        ]

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to list provider models: {e}")
        raise handle_api_error(e)


# Cost Tracking Endpoints
@router.get("/cost/metrics", response_model=CostMetrics)
@require_permissions("llm:cost:read")
async def get_cost_metrics(
    tenant_id: Optional[str] = Query(None, description="Tenant ID (admin only)"),
    period: str = Query("daily", description="Time period"),
    start_date: Optional[datetime] = Query(None, description="Start date"),
    end_date: Optional[datetime] = Query(None, description="End date"),
):
    """Get cost metrics for a time period."""
    try:
        tracker = await get_cost_tracker()

        # Convert period string to enum
        from ...services.llm.cost_tracker import TimePeriod

        period_enum = TimePeriod(period)

        metrics = await tracker.get_cost_metrics(
            tenant_id=tenant_id,
            period=period_enum,
            start_date=start_date,
            end_date=end_date,
        )

        return CostMetrics(
            total_cost=float(metrics.total_cost),
            total_tokens=metrics.total_tokens,
            total_requests=metrics.total_requests,
            avg_cost_per_request=float(metrics.avg_cost_per_request),
            avg_tokens_per_request=metrics.avg_tokens_per_request,
            providers={k: float(v) for k, v in metrics.providers.items()},
            models={k: float(v) for k, v in metrics.models.items()},
            period=period,
            timestamp=metrics.timestamp,
        )

    except Exception as e:
        logger.error(f"Failed to get cost metrics: {e}")
        raise handle_api_error(e)


@router.get("/cost/budget", response_model=BudgetStatus)
@require_permissions("llm:cost:read")
async def get_budget_status(tenant_id: str = Query(..., description="Tenant ID")):
    """Get budget status for a tenant."""
    try:
        tracker = await get_cost_tracker()
        status = await tracker.check_budget_status(tenant_id)

        return BudgetStatus(**status)

    except Exception as e:
        logger.error(f"Failed to get budget status: {e}")
        raise handle_api_error(e)


# Health Check Endpoint
@router.get("/health", response_model=HealthCheckResponse)
async def health_check():
    """Check the health of the LLM service."""
    try:
        manager = await get_llm_manager()

        # Get provider statuses
        provider_statuses = await manager.get_provider_status()

        providers = {}
        overall_healthy = True

        for name, status in provider_statuses.items():
            provider_info = ProviderInfo(
                name=name,
                status=status["provider_status"],
                enabled=status["enabled"],
                healthy=status["healthy"],
                can_accept_request=status["can_accept_request"],
                current_requests=status["current_requests"],
                total_requests=status["total_requests"],
                consecutive_failures=status["consecutive_failures"],
                avg_response_time=status["avg_response_time"],
                success_rate=status["success_rate"],
                last_health_check=datetime.fromisoformat(status["last_health_check"])
                if status["last_health_check"]
                else None,
                last_failure_time=datetime.fromisoformat(status["last_failure_time"])
                if status["last_failure_time"]
                else None,
            )
            providers[name] = provider_info

            if not provider_info.healthy:
                overall_healthy = False

        # Determine overall status
        overall_status = "healthy" if overall_healthy else "degraded"

        return HealthCheckResponse(
            status=overall_status,
            timestamp=datetime.now(),
            version="1.0.0",
            uptime_seconds=0.0,  # Would track actual uptime
            providers=providers,
            system={
                "total_providers": len(providers),
                "healthy_providers": len([p for p in providers.values() if p.healthy]),
                "enabled_providers": len([p for p in providers.values() if p.enabled]),
            },
        )

    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return HealthCheckResponse(
            status="unhealthy",
            timestamp=datetime.now(),
            version="1.0.0",
            uptime_seconds=0.0,
            providers={},
            system={"error": str(e)},
        )


# Configuration Endpoints
@router.get("/config", response_model=LLMConfiguration)
@require_permissions("llm:config:read")
async def get_configuration():
    """Get current LLM service configuration."""
    try:
        config = await get_llm_config()

        return LLMConfiguration(
            enabled=config.enabled,
            debug=config.debug,
            log_level=config.log_level.value,
            providers=[
                {
                    "name": p.name,
                    "enabled": p.enabled,
                    "priority": p.priority,
                    "weight": p.weight,
                    "timeout": p.timeout,
                    "max_retries": p.max_retries,
                    "max_requests_per_minute": p.max_requests_per_minute,
                    "max_concurrent_requests": p.max_concurrent_requests,
                    "base_url": p.base_url,
                    "default_model": p.default_model,
                    "supported_models": p.supported_models,
                    "enable_streaming": p.enable_streaming,
                    "enable_function_calling": p.enable_function_calling,
                    "enable_vision": p.enable_vision,
                }
                for p in config.providers
            ],
            selection_strategy=config.selection_strategy,
            max_concurrent_requests=config.max_concurrent_requests,
            request_timeout=config.request_timeout,
            multi_tenant_enabled=config.multi_tenant_enabled,
            tenant_isolation=config.tenant_isolation,
            validation_enabled=config.validation.enabled,
            cost_tracking_enabled=config.cost.enabled,
            monitoring_enabled=config.monitoring.enabled,
            version=config.version,
            last_updated=config.last_updated,
        )

    except Exception as e:
        logger.error(f"Failed to get configuration: {e}")
        raise handle_api_error(e)


# Error handler
@router.exception_handler(Exception)
async def llm_exception_handler(request, exc):
    """Handle LLM-specific exceptions."""
    return handle_api_error(exc, request_id=getattr(request.state, "request_id", None))
