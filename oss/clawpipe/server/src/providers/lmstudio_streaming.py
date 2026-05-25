"""Streaming chat completion logic for LM Studio provider."""

import json
import logging
from typing import AsyncIterator, List, Optional

import httpx

from .base import ChatRequest, StreamChunk

logger = logging.getLogger("finsavvyai.lmstudio")


async def chat_stream(
    base_url: str,
    request: ChatRequest,
) -> AsyncIterator[StreamChunk]:
    """
    Stream chat completion from LM Studio.

    Args:
        base_url: LM Studio API server URL (no trailing slash)
        request: Chat request with messages, model, parameters

    Yields:
        StreamChunk with content deltas

    Raises:
        RuntimeError: If LM Studio is not reachable
    """
    messages = [{"role": m.role, "content": m.content} for m in request.messages]

    payload = {
        "model": request.model,
        "messages": messages,
        "stream": True,
        "temperature": request.temperature,
        "top_p": request.top_p,
    }

    if request.max_tokens:
        payload["max_tokens"] = request.max_tokens
    if request.stop:
        payload["stop"] = request.stop

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream(
                "POST",
                f"{base_url}/v1/chat/completions",
                json=payload,
            ) as resp:
                resp.raise_for_status()

                async for line in resp.aiter_lines():
                    chunk = _parse_sse_line(line)
                    if chunk is not None:
                        yield chunk
                        if chunk.finish_reason:
                            break

    except httpx.ConnectError as e:
        raise RuntimeError(
            f"Cannot connect to LM Studio at {base_url}"
        ) from e


def _parse_sse_line(line: str) -> StreamChunk | None:
    """Parse a single SSE line into a StreamChunk.

    Returns None if the line should be skipped.
    """
    if not line.strip() or not line.startswith("data: "):
        return None

    data_str = line[6:]  # Remove "data: " prefix

    if data_str == "[DONE]":
        return StreamChunk(content="", finish_reason="stop")

    try:
        data = json.loads(data_str)

        if data.get("choices"):
            delta = data["choices"][0].get("delta", {})
            content = delta.get("content", "")

            finish_reason = data["choices"][0].get("finish_reason")
            if finish_reason:
                return StreamChunk(
                    content="",
                    finish_reason=finish_reason,
                )

            if content:
                return StreamChunk(content=content)

    except json.JSONDecodeError:
        logger.warning(f"Failed to parse SSE line: {data_str}")

    return None
