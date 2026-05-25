"""POST /v1/completions — legacy text completions shim.

Wraps the prompt as a user chat message and delegates to the chat completions
handler, then unwraps the response into legacy completions format.
"""

import json
import time
import uuid

from aiohttp import web

from src.api.routes.chat import handle_chat_completions_for_gateway
from src.core.logger import get_logger

logger = get_logger()


async def handle_completions(request: web.Request) -> web.Response:
    """POST /v1/completions — maps legacy prompt to chat completions."""
    try:
        body = await request.json()
    except Exception:
        return web.json_response(
            {"error": {"message": "invalid JSON", "type": "invalid_request_error", "code": 400}},
            status=400,
        )

    prompt = body.get("prompt")
    if prompt is None:
        return web.json_response(
            {"error": {"message": "'prompt' is required", "type": "invalid_request_error", "code": 400}},
            status=400,
        )

    if isinstance(prompt, list):
        text = "\n".join(str(p) for p in prompt)
    else:
        text = str(prompt)

    chat_body = {
        "model": body.get("model", "gpt-3.5-turbo"),
        "messages": [{"role": "user", "content": text}],
        "max_tokens": body.get("max_tokens"),
        "temperature": body.get("temperature"),
        "stream": body.get("stream", False),
        "stop": body.get("stop"),
    }
    chat_body = {k: v for k, v in chat_body.items() if v is not None}

    class _WrappedRequest:
        """Minimal request shim that replaces the JSON body with a rewritten chat payload."""

        def __init__(self, orig, new_body: bytes):
            self._orig = orig
            self._body = new_body
            self.app = orig.app
            self.headers = orig.headers
            self.method = orig.method
            self.path = orig.path
            self.rel_url = orig.rel_url

        async def json(self):
            return json.loads(self._body)

        def get(self, key, default=None):
            return self._orig.get(key, default)

        def __getitem__(self, key):
            return self._orig[key]

        def __contains__(self, key):
            return key in self._orig

        def __getattr__(self, name):
            return getattr(self._orig, name)

    gateway = request.app.get("gateway")
    wrapped = _WrappedRequest(request, json.dumps(chat_body).encode())

    chat_resp = await handle_chat_completions_for_gateway(gateway, wrapped)

    if chat_resp.status != 200:
        return chat_resp

    try:
        chat_data = json.loads(chat_resp.body)
    except Exception:
        return chat_resp

    choices = []
    for choice in chat_data.get("choices", []):
        content = choice.get("message", {}).get("content", "")
        choices.append(
            {
                "text": content,
                "index": choice.get("index", 0),
                "logprobs": None,
                "finish_reason": choice.get("finish_reason", "stop"),
            }
        )

    completion_id = f"cmpl-{uuid.uuid4().hex[:24]}"
    return web.json_response(
        {
            "id": completion_id,
            "object": "text_completion",
            "created": int(time.time()),
            "model": chat_data.get("model", chat_body["model"]),
            "choices": choices,
            "usage": chat_data.get("usage", {}),
        }
    )
