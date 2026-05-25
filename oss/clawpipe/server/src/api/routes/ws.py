"""WebSocket endpoint for real-time streaming chat completions."""

import json
import time
import uuid
from typing import Any, Dict

import aiohttp
from aiohttp import web

from src.core.logger import get_logger
from src.core.metrics import get_metrics_collector

logger = get_logger()
metrics = get_metrics_collector()

try:
    from src.providers.base import ChatMessage, ChatRequest

    PROVIDERS_AVAILABLE = True
except ImportError:
    PROVIDERS_AVAILABLE = False


def _make_error(request_id: str, message: str, code: str = "invalid_request") -> Dict:
    """Build an OpenAI-compatible error envelope."""
    return {
        "error": {"type": code, "message": message, "code": code},
        "request_id": request_id,
    }


def _validate_ws_payload(data: Any) -> tuple:
    """Validate incoming WS message. Returns (messages, model, request_id, error_dict)."""
    if not isinstance(data, dict):
        return None, None, None, "Payload must be a JSON object"

    request_id = data.get("request_id", f"ws-{uuid.uuid4().hex[:12]}")

    if "messages" not in data:
        return None, None, request_id, "Missing 'messages' field"

    messages = data["messages"]
    if not isinstance(messages, list) or not messages:
        return None, None, request_id, "'messages' must be a non-empty array"

    for idx, msg in enumerate(messages):
        if not isinstance(msg, dict) or "role" not in msg or "content" not in msg:
            return None, None, request_id, f"Message at index {idx} invalid"

    model = data.get("model")
    if model is not None and not isinstance(model, str):
        return None, None, request_id, "'model' must be a string"

    return messages, model, request_id, None


async def _stream_to_ws(
    ws: web.WebSocketResponse,
    provider,
    chat_req: "ChatRequest",
    model: str,
    request_id: str,
) -> None:
    """Stream provider chunks as JSON messages over the WebSocket."""
    chunk_id = f"chatcmpl-{uuid.uuid4().hex[:12]}"
    async for chunk in provider.chat_stream(chat_req):
        payload = {
            "id": chunk_id,
            "object": "chat.completion.chunk",
            "created": int(time.time()),
            "model": model,
            "request_id": request_id,
            "choices": [
                {
                    "index": 0,
                    "delta": {"content": chunk.content} if chunk.content else {},
                    "finish_reason": chunk.finish_reason,
                }
            ],
        }
        await ws.send_json(payload)
    await ws.send_json({"request_id": request_id, "done": True})


async def _handle_ws_message(
    ws: web.WebSocketResponse,
    raw: str,
    gateway,
) -> None:
    """Process a single inbound WebSocket message."""
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        await ws.send_json(_make_error("unknown", "Invalid JSON"))
        return

    messages, model, request_id, err = _validate_ws_payload(data)
    if err:
        await ws.send_json(_make_error(request_id or "unknown", err))
        return

    if not PROVIDERS_AVAILABLE or not gateway.provider_registry:
        await ws.send_json(_make_error(request_id, "No providers available", "server_error"))
        return

    provider = gateway.provider_registry.resolve_provider(model) if model else None
    if not provider:
        providers = list(gateway.provider_registry._providers.values())
        provider = providers[0] if providers else None

    if not provider:
        await ws.send_json(_make_error(request_id, "No provider found", "server_error"))
        return

    provider_model = model or "default"
    chat_messages = [ChatMessage(role=m["role"], content=m.get("content", "")) for m in messages]
    chat_req = ChatRequest(
        messages=chat_messages,
        model=provider_model,
        temperature=data.get("temperature", 0.7),
        max_tokens=data.get("max_tokens"),
        stream=True,
        top_p=data.get("top_p", 1.0),
        stop=data.get("stop"),
    )

    try:
        await _stream_to_ws(ws, provider, chat_req, provider_model, request_id)
        metrics.increment("ws_completions_success")
    except Exception as exc:
        logger.error("WS stream error", request_id=request_id, error=str(exc))
        await ws.send_json(_make_error(request_id, f"Stream error: {exc}", "server_error"))


async def handle_ws_chat(request: web.Request) -> web.WebSocketResponse:
    """WebSocket handler for /v1/ws/chat/completions."""
    ws = web.WebSocketResponse()
    await ws.prepare(request)

    gateway = request.app["gateway"]
    logger.info("WebSocket client connected")
    metrics.increment("ws_connections")

    try:
        async for msg in ws:
            if msg.type == aiohttp.WSMsgType.TEXT:
                await _handle_ws_message(ws, msg.data, gateway)
            elif msg.type == aiohttp.WSMsgType.ERROR:
                logger.error("WebSocket error: %s", ws.exception())
    finally:
        logger.info("WebSocket client disconnected")
        metrics.increment("ws_disconnections")

    return ws
