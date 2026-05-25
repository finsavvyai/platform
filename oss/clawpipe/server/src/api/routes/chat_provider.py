"""Cloud/OpenHands provider routing for chat requests."""

import json
import os
import time
import uuid

from aiohttp import web

from src.api.routes.governance_gate import evaluate_request_governance
from src.core.context_packing import get_context_packer
from src.core.logger import get_logger
from src.core.metrics import get_metrics_collector
from src.core.reasoning_bank import get_reasoning_bank
from src.core.smart_router import get_smart_router

logger = get_logger()
metrics = get_metrics_collector()

try:
    from src.providers.base import ChatMessage, ChatRequest

    PROVIDERS_AVAILABLE = True
except ImportError:
    PROVIDERS_AVAILABLE = False


async def route_to_provider(gateway, request, data, messages, model, request_id):
    """Route chat completion to a direct provider when available."""
    if not gateway.provider_registry or not PROVIDERS_AVAILABLE:
        return None

    backend_hint = str(data.get("backend", "auto")).strip().lower()
    if backend_hint in {"openclaw", "cluster"}:
        return None

    provider = None
    provider_model = model
    if backend_hint == "openhands":
        provider = gateway.provider_registry.get_provider("openhands")
        provider_model = model or os.getenv("OPENHANDS_DEFAULT_MODEL", "openhands/default")
        if not provider:
            return web.json_response(
                {
                    "error": "OpenHands unavailable",
                    "message": "backend='openhands' was requested but provider is not configured",
                    "request_id": request_id,
                },
                status=503,
            )
    elif model:
        provider = gateway.provider_registry.resolve_provider(model)

    if not provider:
        return None

    logger.info(
        f"Direct provider: {provider.name} for model {provider_model}",
        request_id=request_id,
    )
    governance_report = None
    if data.get("governance") or provider.name == "openhands":
        blocked, governance_report = evaluate_request_governance(
            data=data,
            messages=messages,
            request_id=request_id,
            provider_name=provider.name,
        )
        if blocked is not None:
            return blocked

    # Context Packing: trim redundant content before sending to provider
    packer = get_context_packer()
    packed_messages = packer.pack(messages)
    chat_messages = [ChatMessage(role=m["role"], content=m.get("content", "")) for m in packed_messages]
    chat_req = ChatRequest(
        messages=chat_messages,
        model=provider_model,
        temperature=data.get("temperature", 0.7),
        max_tokens=data.get("max_tokens"),
        stream=data.get("stream", False),
        top_p=data.get("top_p", 1.0),
        stop=data.get("stop"),
        tools=data.get("tools"),
        tool_choice=data.get("tool_choice"),
    )

    if chat_req.stream:
        return await _stream_provider_response(
            request, provider, provider_model, chat_req, request_id
        )

    # ReasoningBank: check cache before calling provider
    bank = get_reasoning_bank()
    temperature = data.get("temperature", 0.7)
    cached = bank.get(provider_model, packed_messages, temperature)
    if cached is not None:
        cached["request_id"] = request_id
        cached["cached"] = True
        metrics.increment("completions_cache_hit")
        return web.json_response(cached)

    # Smart Router: use learned outcomes to order provider chain
    smart = get_smart_router()
    if backend_hint not in {"openhands"} and gateway.provider_registry:
        providers_to_try = smart.select_provider_chain(provider_model)
        if not providers_to_try:
            # Fall back to registry's static chain
            chain = gateway.provider_registry.resolve_provider_chain(provider_model)
            providers_to_try = chain if chain else [provider]
    else:
        providers_to_try = [provider]

    last_error = None
    result = None
    used_provider = None
    for try_provider in providers_to_try:
        t0 = time.monotonic()
        try:
            result = await try_provider.chat(chat_req)
            latency_ms = (time.monotonic() - t0) * 1000
            smart.record_outcome(try_provider.name, provider_model, True, latency_ms)
            used_provider = try_provider
            break
        except Exception as exc:
            latency_ms = (time.monotonic() - t0) * 1000
            smart.record_outcome(try_provider.name, provider_model, False, latency_ms)
            logger.warning(
                "Provider %s failed for model %s: %s",
                try_provider.name, provider_model, exc,
                request_id=request_id,
            )
            last_error = exc
            continue

    if result is None:
        return web.json_response(
            {
                "error": "All providers failed",
                "message": str(last_error) if last_error else "No provider available",
                "request_id": request_id,
            },
            status=502,
        )

    response_data = {
        "id": f"chatcmpl-{uuid.uuid4().hex[:12]}",
        "object": "chat.completion",
        "created": int(time.time()),
        "model": result.model,
        "choices": [
            {
                "index": 0,
                "message": {"role": "assistant", "content": result.content},
                "finish_reason": result.finish_reason,
            }
        ],
        "usage": result.usage,
        "provider": result.provider,
        "request_id": request_id,
    }
    trace_id = getattr(result, "trace_id", "")
    if trace_id and isinstance(trace_id, str):
        response_data["trace_id"] = trace_id
    if governance_report:
        response_data["governance"] = governance_report

    # Cache the response in ReasoningBank
    bank.put(provider_model, packed_messages, temperature, response_data)

    metrics.increment("completions_success")
    return web.json_response(response_data)


async def _stream_provider_response(request, provider, provider_model, chat_req, request_id):
    response = web.StreamResponse(
        status=200,
        headers={
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Request-ID": request_id,
        },
    )
    await response.prepare(request)
    chunk_id = f"chatcmpl-{uuid.uuid4().hex[:12]}"
    async for chunk in provider.chat_stream(chat_req):
        payload = {
            "id": chunk_id,
            "object": "chat.completion.chunk",
            "model": provider_model,
            "choices": [
                {
                    "index": 0,
                    "delta": {"content": chunk.content} if chunk.content else {},
                    "finish_reason": chunk.finish_reason,
                }
            ],
        }
        await response.write(f"data: {json.dumps(payload)}\n\n".encode())
    await response.write(b"data: [DONE]\n\n")
    return response
