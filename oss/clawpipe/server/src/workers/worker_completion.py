"""Chat completion request handling and local inference."""

import asyncio
import json
import time
from typing import Dict, List

import aiohttp.web

from src.core.logger import get_logger

logger = get_logger()

MODEL_TIMEOUTS = {
    "phi-2": 30, "mistral-7b-instruct": 60, "codellama-7b-instruct": 60,
    "deepseek-coder-6.7b": 60, "starcoder2-7b": 60, "llama-2-7b-chat": 90,
    "llama-3-8b-instruct": 120, "glm-4v-9b": 180, "llava-1.5-7b": 120,
}
DEFAULT_TIMEOUT = 60


def detect_vision_content(messages: List[Dict]) -> bool:
    """Detect if request contains vision/image content (OpenAI or GLM-4V format)."""
    for msg in messages:
        content = msg.get("content", "")
        if isinstance(content, str):
            continue
        if isinstance(content, list):
            for item in content:
                if item.get("type", "") in ("image_url", "image"):
                    return True
    return False


def messages_to_prompt(messages) -> str:
    """Convert OpenAI-style messages to a simple prompt string."""
    return "\n".join(f"{m.get('role', 'user')}: {m.get('content', '')}" for m in messages)


def simulated_response(worker, model, messages):
    """Return a simulated response when no LLM is loaded."""
    return aiohttp.web.json_response({
        "id": f"chatcmpl-{int(time.time())}-{worker.config.worker_id[:8]}",
        "object": "chat.completion",
        "created": int(time.time()),
        "model": model,
        "choices": [{
            "index": 0,
            "message": {
                "role": "assistant",
                "content": (
                    f"[Simulated] Response from {worker.config.worker_name}. "
                    f"No LLM model is loaded. Load a model via POST /models/load "
                    f"to get real inference."
                ),
            },
            "finish_reason": "stop",
        }],
        "usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
        "worker_info": {"node_id": worker.config.worker_id, "simulated": True},
    })


async def complete_response(worker, model, messages, max_tokens, temperature, top_p, stop, timeout):
    """Run non-streaming inference with timeout."""
    try:
        result = await asyncio.wait_for(
            worker.engine.complete_async(
                model_id=model, messages=messages, max_tokens=max_tokens,
                temperature=temperature, top_p=top_p, stop=stop,
            ),
            timeout=timeout,
        )
        response = {
            "id": f"chatcmpl-{int(time.time())}-{worker.config.worker_id[:8]}",
            "object": "chat.completion",
            "created": int(time.time()),
            "model": model,
            "choices": [{
                "index": 0,
                "message": {"role": "assistant", "content": result.text},
                "finish_reason": result.finish_reason,
            }],
            "usage": {
                "prompt_tokens": result.prompt_tokens,
                "completion_tokens": result.completion_tokens,
                "total_tokens": result.total_tokens,
            },
            "worker_info": {
                "node_id": worker.config.worker_id,
                "duration_seconds": result.duration_seconds,
            },
        }
        logger.info("Completion done", model=model, tokens=result.total_tokens, duration=result.duration_seconds)
        return aiohttp.web.json_response(response)
    except asyncio.TimeoutError:
        logger.error("Inference timeout", model=model, timeout=timeout)
        return aiohttp.web.json_response(
            {"error": "Inference timeout", "message": f"Model did not respond within {timeout}s"},
            status=504,
        )


async def stream_response(worker, request, model, messages, max_tokens, temperature, top_p, stop, timeout):
    """Run streaming inference via Server-Sent Events."""
    response = aiohttp.web.StreamResponse(
        status=200,
        headers={
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
    await response.prepare(request)
    request_id = f"chatcmpl-{int(time.time())}-{worker.config.worker_id[:8]}"

    try:
        async for chunk in worker.engine.stream_complete_async(
            model_id=model, messages=messages, max_tokens=max_tokens,
            temperature=temperature, top_p=top_p, stop=stop,
        ):
            sse_data = {
                "id": request_id,
                "object": "chat.completion.chunk",
                "created": int(time.time()),
                "model": model,
                "choices": [{
                    "index": 0,
                    "delta": {"content": chunk["content"]} if chunk["content"] else {},
                    "finish_reason": chunk["finish_reason"],
                }],
            }
            await response.write(f"data: {json.dumps(sse_data)}\n\n".encode())
        await response.write(b"data: [DONE]\n\n")
    except Exception as e:
        logger.error("Streaming error", model=model, error=str(e))
        await response.write(f"data: {json.dumps({'error': str(e)})}\n\n".encode())
    return response


async def handle_completion(request):
    """POST /v1/chat/completions - Route to appropriate backend."""
    from src.workers.worker_openclaw_inference import (
        openclaw_complete_response,
        openclaw_stream_response,
        openclaw_vision_complete_response,
        openclaw_vision_stream_response,
    )

    worker = request.app["worker"]
    try:
        try:
            data = await request.json()
        except json.JSONDecodeError:
            return aiohttp.web.json_response(
                {"error": "Invalid JSON", "message": "Request body must be valid JSON"}, status=400,
            )
        if not isinstance(data, dict):
            return aiohttp.web.json_response(
                {"error": "Invalid request", "message": "Request body must be a JSON object"}, status=400,
            )
        messages = data.get("messages")
        if not isinstance(messages, list) or len(messages) == 0:
            return aiohttp.web.json_response(
                {"error": "Invalid request", "message": "'messages' must be a non-empty array"}, status=400,
            )

        worker.request_count += 1
        model = data.get("model", worker.config.models[0])
        stream = data.get("stream", False)
        max_tokens, temperature = data.get("max_tokens", 512), data.get("temperature", 0.7)
        top_p, stop = data.get("top_p", 0.9), data.get("stop")
        has_vision = detect_vision_content(messages)
        use_openclaw = data.get("use_openclaw", False)
        backend_hint = data.get("backend", "auto")
        timeout = MODEL_TIMEOUTS.get(model, DEFAULT_TIMEOUT)

        if has_vision and worker.openclaw_client:
            if await worker.openclaw_client.is_available():
                if stream:
                    return await openclaw_vision_stream_response(worker, request, model, messages, temperature)
                return await openclaw_vision_complete_response(worker, model, messages, max_tokens, temperature)
            return aiohttp.web.json_response(
                {"error": "Vision unavailable", "message": "OpenCLaw backend required for vision"}, status=503,
            )
        if (use_openclaw or backend_hint == "openclaw") and worker.openclaw_client:
            if await worker.openclaw_client.is_available():
                if stream:
                    return await openclaw_stream_response(worker, request, model, messages, temperature)
                return await openclaw_complete_response(worker, model, messages, max_tokens, temperature)
        if worker.engine.is_model_ready(model):
            if stream:
                return await stream_response(worker, request, model, messages, max_tokens, temperature, top_p, stop, timeout)
            return await complete_response(worker, model, messages, max_tokens, temperature, top_p, stop, timeout)
        return simulated_response(worker, model, messages)
    except Exception as e:
        logger.error("Chat completion error", error=str(e), error_type=type(e).__name__)
        return aiohttp.web.json_response({"error": "Processing failed", "message": "An error occurred"}, status=500)
