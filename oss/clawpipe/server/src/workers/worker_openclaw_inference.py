"""OpenCLaw inference handlers (text and vision, complete and streaming)."""

import asyncio
import json
import time

import aiohttp.web

from src.core.logger import get_logger
from src.workers.worker_completion import messages_to_prompt

logger = get_logger()


async def openclaw_complete_response(worker, model, messages, max_tokens, temperature):
    """Run non-streaming inference via OpenCLaw."""
    try:
        prompt = messages_to_prompt(messages)
        result = await asyncio.wait_for(
            worker.openclaw_client.complete(
                prompt=prompt, model=model, max_tokens=max_tokens, temperature=temperature,
            ),
            timeout=30,
        )
        if "error" in result:
            logger.error("OpenCLaw completion error", error=result["error"])
            return aiohttp.web.json_response(
                {"error": "OpenCLaw inference failed", "message": result.get("error", "Unknown error")},
                status=502,
            )
        response_text = result.get("text", "")
        logger.info("OpenCLaw completion done", model=model, response_length=len(response_text))
        return aiohttp.web.json_response({
            "id": f"chatcmpl-{int(time.time())}-{worker.config.worker_id[:8]}",
            "object": "chat.completion",
            "created": int(time.time()),
            "model": model,
            "choices": [{"index": 0, "message": {"role": "assistant", "content": response_text}, "finish_reason": "stop"}],
            "usage": {
                "prompt_tokens": len(str(messages)),
                "completion_tokens": len(response_text),
                "total_tokens": len(str(messages)) + len(response_text),
            },
            "worker_info": {"node_id": worker.config.worker_id, "backend": "openclaw", "openclaw_url": worker.config.openclaw_url},
        })
    except asyncio.TimeoutError:
        logger.error("OpenCLaw inference timeout")
        return aiohttp.web.json_response(
            {"error": "OpenCLaw timeout", "message": "OpenCLaw did not respond in time"}, status=504,
        )


async def _stream_sse(worker, response, request_id, model, chunk_iter):
    """Shared SSE streaming helper for OpenCLaw responses."""
    try:
        async for chunk in chunk_iter:
            sse_data = {
                "id": request_id,
                "object": "chat.completion.chunk",
                "created": int(time.time()),
                "model": model,
                "choices": [{"index": 0, "delta": {"content": chunk}, "finish_reason": None}],
            }
            await response.write(f"data: {json.dumps(sse_data)}\n\n".encode())
        final = {
            "id": request_id,
            "object": "chat.completion.chunk",
            "created": int(time.time()),
            "model": model,
            "choices": [{"index": 0, "delta": {}, "finish_reason": "stop"}],
        }
        await response.write(f"data: {json.dumps(final)}\n\n".encode())
        await response.write(b"data: [DONE]\n\n")
    except Exception as e:
        logger.error("OpenCLaw streaming error", error=str(e))
        await response.write(f"data: {json.dumps({'error': str(e)})}\n\n".encode())
    return response


async def _prepare_stream(request):
    """Create and prepare an SSE stream response."""
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
    return response


async def openclaw_stream_response(worker, request, model, messages, temperature):
    """Run streaming inference via OpenCLaw."""
    response = await _prepare_stream(request)
    request_id = f"chatcmpl-{int(time.time())}-{worker.config.worker_id[:8]}"
    chunk_iter = worker.openclaw_client.stream_chat(messages=messages, model=model, temperature=temperature)
    return await _stream_sse(worker, response, request_id, model, chunk_iter)


async def openclaw_vision_complete_response(worker, model, messages, max_tokens, temperature):
    """Run non-streaming vision inference via OpenCLaw."""
    try:
        result = await asyncio.wait_for(
            worker.openclaw_client.complete_vision(
                messages=messages, model=model, max_tokens=max_tokens, temperature=temperature,
            ),
            timeout=60,
        )
        if "error" in result:
            logger.error("OpenCLaw vision completion error", error=result["error"])
            return aiohttp.web.json_response(
                {"error": "OpenCLaw vision inference failed", "message": result.get("error", "Unknown error")},
                status=502,
            )
        response_text = result.get("text", "")
        logger.info("OpenCLaw vision completion done", model=model, response_length=len(response_text))
        return aiohttp.web.json_response({
            "id": f"chatcmpl-{int(time.time())}-{worker.config.worker_id[:8]}",
            "object": "chat.completion",
            "created": int(time.time()),
            "model": model,
            "choices": [{"index": 0, "message": {"role": "assistant", "content": response_text}, "finish_reason": "stop"}],
            "usage": {
                "prompt_tokens": len(str(messages)),
                "completion_tokens": len(response_text),
                "total_tokens": len(str(messages)) + len(response_text),
            },
            "worker_info": {
                "node_id": worker.config.worker_id, "backend": "openclaw",
                "backend_type": "vision", "openclaw_url": worker.config.openclaw_url,
            },
        })
    except asyncio.TimeoutError:
        logger.error("OpenCLaw vision inference timeout")
        return aiohttp.web.json_response(
            {"error": "OpenCLaw timeout", "message": "OpenCLaw vision did not respond in time"}, status=504,
        )


async def openclaw_vision_stream_response(worker, request, model, messages, temperature):
    """Run streaming vision inference via OpenCLaw."""
    response = await _prepare_stream(request)
    request_id = f"chatcmpl-{int(time.time())}-{worker.config.worker_id[:8]}"
    chunk_iter = worker.openclaw_client.stream_chat_vision(messages=messages, model=model, temperature=temperature)
    return await _stream_sse(worker, response, request_id, model, chunk_iter)
