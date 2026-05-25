#!/usr/bin/env python3
"""
Streaming channel forwarding for FinSavvyAI.

Handles SSE-based streaming completion forwarding
to OpenClaw channels.

Sprint 12 — Task 12.4
Extracted from channel_adapter.py.
"""

import json
import logging
from typing import Any, AsyncGenerator, Dict

import aiohttp

logger = logging.getLogger("finsavvyai.channels")


async def forward_streaming(
    session: aiohttp.ClientSession,
    cluster_url: str,
    completion_body: Dict[str, Any],
    headers: Dict[str, str],
) -> AsyncGenerator[str, None]:
    """Forward a streaming completion request and yield text chunks."""
    completion_body["stream"] = True
    try:
        async with session.post(
            f"{cluster_url}/v1/chat/completions",
            json=completion_body,
            headers=headers,
        ) as resp:
            async for line in resp.content:
                line_str = line.decode("utf-8").strip()
                if not line_str or line_str == "data: [DONE]":
                    continue
                if line_str.startswith("data: "):
                    data_str = line_str[6:]
                    try:
                        chunk = json.loads(data_str)
                        delta = (
                            chunk.get("choices", [{}])[0]
                            .get("delta", {})
                            .get("content", "")
                        )
                        if delta:
                            yield delta
                    except (json.JSONDecodeError, IndexError):
                        pass
    except Exception as e:
        logger.error("Streaming forward error: %s", e)
        yield f"[Error: {e}]"
