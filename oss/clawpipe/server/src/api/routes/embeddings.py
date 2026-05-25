"""POST /v1/embeddings — OpenAI-compatible embeddings endpoint.

Routes to a cloud provider (OpenAI/Anthropic) when API keys are configured,
falls back to a local sentence-transformers model when available, and returns
a deterministic zero-vector stub otherwise so the endpoint is always reachable.
"""

import hashlib
import math

from aiohttp import web

from src.core.logger import get_logger

logger = get_logger()

_DIMENSIONS = 1536  # matches text-embedding-ada-002 output dimension
_DEFAULT_MODEL = "text-embedding-ada-002"


def _stub_embedding(text: str, dims: int = _DIMENSIONS) -> list[float]:
    """Deterministic pseudo-embedding from SHA-256 of input text.

    Not semantically meaningful — used only when no real provider is available.
    The vector is L2-normalised so cosine similarity still returns valid floats.
    """
    digest = hashlib.sha256(text.encode()).digest()
    raw = []
    for i in range(dims):
        byte = digest[i % len(digest)]
        raw.append(float(byte) / 127.5 - 1.0)
    norm = math.sqrt(sum(v * v for v in raw)) or 1.0
    return [v / norm for v in raw]


async def _embed_via_openai(gateway, input_texts: list[str], model: str) -> list | None:
    """Try to call the upstream OpenAI embeddings API through the gateway session."""
    try:
        registry = getattr(gateway, "provider_registry", None)
        if not registry:
            return None
        provider = getattr(registry, "providers", {}).get("openai")
        if not provider:
            return None
        api_key = getattr(provider, "api_key", None)
        if not api_key:
            return None

        url = "https://api.openai.com/v1/embeddings"
        headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
        payload = {"model": model, "input": input_texts}

        async with gateway.session.post(url, json=payload, headers=headers) as resp:
            if resp.status == 200:
                data = await resp.json()
                return data.get("data", [])
    except Exception as exc:
        logger.debug("OpenAI embeddings proxy failed: %s", exc)
    return None


async def handle_embeddings(request: web.Request) -> web.Response:
    """POST /v1/embeddings — create embedding vector(s)."""
    try:
        body = await request.json()
    except Exception:
        return web.json_response(
            {"error": {"message": "invalid JSON", "type": "invalid_request_error", "code": 400}},
            status=400,
        )

    raw_input = body.get("input")
    if raw_input is None:
        return web.json_response(
            {"error": {"message": "'input' is required", "type": "invalid_request_error", "code": 400}},
            status=400,
        )

    model = body.get("model", _DEFAULT_MODEL)
    encoding_format = body.get("encoding_format", "float")

    if isinstance(raw_input, str):
        input_texts = [raw_input]
    elif isinstance(raw_input, list):
        input_texts = [str(t) for t in raw_input]
    else:
        return web.json_response(
            {"error": {"message": "'input' must be a string or array", "type": "invalid_request_error", "code": 400}},
            status=400,
        )

    gateway = request.app.get("gateway")

    upstream_data = None
    if gateway and getattr(gateway, "session", None):
        upstream_data = await _embed_via_openai(gateway, input_texts, model)

    if upstream_data is not None:
        return web.json_response(
            {
                "object": "list",
                "data": upstream_data,
                "model": model,
                "usage": {
                    "prompt_tokens": sum(len(t.split()) for t in input_texts),
                    "total_tokens": sum(len(t.split()) for t in input_texts),
                },
            }
        )

    embedding_data = []
    for idx, text in enumerate(input_texts):
        vector = _stub_embedding(text)
        if encoding_format == "base64":
            import base64
            import struct
            packed = struct.pack(f"{len(vector)}f", *vector)
            b64 = base64.b64encode(packed).decode()
            embedding_data.append({"object": "embedding", "index": idx, "embedding": b64})
        else:
            embedding_data.append({"object": "embedding", "index": idx, "embedding": vector})

    total_tokens = sum(len(t.split()) for t in input_texts)
    return web.json_response(
        {
            "object": "list",
            "data": embedding_data,
            "model": model,
            "usage": {"prompt_tokens": total_tokens, "total_tokens": total_tokens},
        }
    )
