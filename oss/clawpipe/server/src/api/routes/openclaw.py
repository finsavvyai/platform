"""OpenClaw wrapper route: normalizes simplified payloads to chat format."""

import json

from aiohttp import web

from src.core.logger import get_logger

logger = get_logger()


class _RequestBodyOverride(dict):
    """Request proxy that overrides JSON body while preserving request metadata."""

    def __init__(self, original_request, payload):
        super().__init__()
        self._original_request = original_request
        self._payload = payload
        for key, value in original_request.items():
            self[key] = value

    async def json(self):
        return self._payload

    def __getattr__(self, item):
        return getattr(self._original_request, item)


def normalize_openclaw_wrapper_payload(payload):
    """Convert simplified wrapper input into /v1/chat/completions payload."""
    if not isinstance(payload, dict):
        raise ValueError("JSON body must be an object")

    model = payload.get("model") or payload.get("openclaw_model") or "default"
    if not isinstance(model, str) or not model.strip():
        raise ValueError("'model' must be a non-empty string when provided")
    model = model.strip()

    messages = payload.get("messages")
    text = payload.get("text", payload.get("prompt", payload.get("message", "")))
    if text is None:
        text = ""
    if not isinstance(text, str):
        text = str(text)
    text = text.strip()

    role = str(payload.get("role", "user")).strip().lower() or "user"
    if role not in {"system", "user", "assistant", "tool"}:
        role = "user"

    image_urls = []
    for key in ("image_url", "image", "media_url"):
        value = payload.get(key)
        if isinstance(value, str) and value.strip():
            image_urls.append(value.strip())

    for key in ("image_urls", "media_urls"):
        value = payload.get(key)
        if isinstance(value, str) and value.strip():
            image_urls.append(value.strip())
        elif isinstance(value, list):
            for item in value:
                if isinstance(item, str) and item.strip():
                    image_urls.append(item.strip())

    if messages is not None:
        if not isinstance(messages, list) or len(messages) == 0:
            raise ValueError("'messages' must be a non-empty array when provided")
        for index, msg in enumerate(messages):
            if not isinstance(msg, dict):
                raise ValueError(f"Message at index {index} must be an object")
            if "role" not in msg or "content" not in msg:
                raise ValueError(f"Message at index {index} must contain 'role' and 'content'")
    else:
        if not text and not image_urls:
            raise ValueError("Provide one of: 'text', 'prompt', 'message', or 'messages'")

        if image_urls:
            content_parts = []
            if text:
                content_parts.append({"type": "text", "text": text})
            for url in image_urls:
                content_parts.append({"type": "image_url", "image_url": {"url": url}})
            content = content_parts
        else:
            content = text

        messages = [{"role": role, "content": content}]

    chat_payload = {
        "model": model,
        "messages": messages,
        "backend": str(payload.get("backend", "openclaw")).strip().lower() or "openclaw",
        "use_openclaw": bool(payload.get("use_openclaw", True)),
    }

    passthrough_fields = (
        "temperature",
        "max_tokens",
        "top_p",
        "stop",
        "stream",
        "response_format",
        "governance",
        "policy_text",
        "policy_rules",
        "policy",
        "default_effect",
        "resource",
        "governance_action",
        "task_type",
        "action",
    )
    for field in passthrough_fields:
        if field in payload:
            chat_payload[field] = payload[field]

    return chat_payload


def make_openclaw_wrapper_handler(chat_handler):
    """Create an openclaw wrapper handler that delegates to the given chat handler."""

    async def handle_openclaw_wrapper(request):
        request_id = request.get("request_id", "unknown")
        try:
            try:
                payload = await request.json()
            except json.JSONDecodeError:
                return web.json_response(
                    {"error": "Invalid JSON", "message": "Request body must be valid JSON"},
                    status=400,
                )

            try:
                chat_payload = normalize_openclaw_wrapper_payload(payload)
            except ValueError as e:
                return web.json_response(
                    {"error": "Invalid request", "message": str(e)},
                    status=400,
                )

            proxy_request = _RequestBodyOverride(request, chat_payload)
            proxy_request["request_id"] = request_id
            return await chat_handler(proxy_request)
        except Exception as e:
            logger.error(
                "OpenClaw wrapper handler failed",
                request_id=request_id,
                error=str(e),
                error_type=type(e).__name__,
            )
            return web.json_response(
                {
                    "error": "Internal server error",
                    "message": "Failed to process OpenClaw wrapper request",
                    "request_id": request_id,
                },
                status=500,
            )

    return handle_openclaw_wrapper
