"""Chat completion handlers."""

import json
import time
import uuid

from aiohttp import web

from src.api.routes.chat_auth import check_chat_auth
from src.api.routes.chat_provider import route_to_provider
from src.api.routes.chat_validation import find_preferred_worker_url, validate_chat_payload
from src.api.routes.cluster_route import route_to_cluster
from src.core.agent_booster import get_agent_booster
from src.core.logger import get_logger
from src.core.tracing import extract_trace_context

logger = get_logger()


async def handle_chat_completions(request):
    """HTTP route wrapper that resolves gateway from app state."""
    gateway = request.app["gateway"]
    return await handle_chat_completions_for_gateway(gateway, request)


async def handle_chat_completions_for_gateway(gateway, request):
    """POST /v1/chat/completions route implementation."""
    gateway.request_count += 1
    request_id = request.get("request_id", "unknown")
    trace_ctx = extract_trace_context(request)

    auth_error = await check_chat_auth(gateway, request)
    if auth_error:
        return auth_error

    try:
        try:
            data = await request.json()
        except json.JSONDecodeError:
            return web.json_response(
                {"error": "Invalid JSON", "message": "Request body must be valid JSON"},
                status=400,
            )

        messages, model, validation_error = validate_chat_payload(data)
        if validation_error:
            return validation_error

        # Agent Booster: try to handle deterministic requests without LLM
        boosted = get_agent_booster().try_boost(messages)
        if boosted is not None:
            return web.json_response({
                "id": f"chatcmpl-boost-{uuid.uuid4().hex[:8]}",
                "object": "chat.completion",
                "created": int(time.time()),
                "model": model or "agent-booster",
                "choices": [{
                    "index": 0,
                    "message": {"role": "assistant", "content": json.dumps(boosted["result"])},
                    "finish_reason": "stop",
                }],
                "usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
                "boosted": True,
                "pattern": boosted["pattern"],
                "elapsed_ms": boosted["elapsed_ms"],
                "cost": 0.0,
            })

        preferred_worker_url = await find_preferred_worker_url(gateway, model)
        backend_hint = str(data.get("backend", "auto")).strip().lower()
        force_worker_route = backend_hint in {"openclaw", "cluster"}

        if not preferred_worker_url and not force_worker_route:
            try:
                provider_response = await route_to_provider(
                    gateway,
                    request,
                    data,
                    messages,
                    model,
                    request_id,
                )
                if provider_response is not None:
                    return provider_response
            except Exception as exc:
                logger.error(
                    "Cloud provider routing failed",
                    request_id=request_id,
                    error=str(exc),
                    error_type=type(exc).__name__,
                )
                gateway.error_count += 1
                return web.json_response(
                    {"error": "Provider error", "message": str(exc), "request_id": request_id},
                    status=502,
                )

        return await route_to_cluster(
            gateway,
            data,
            messages,
            model,
            preferred_worker_url,
            request_id,
            trace_ctx,
        )
    except Exception as exc:
        logger.error(
            "Unexpected error processing chat completion",
            error=str(exc),
            error_type=type(exc).__name__,
            request_id=request_id,
        )
        return web.json_response(
            {"error": "Internal server error", "message": "An unexpected error occurred"},
            status=500,
        )
