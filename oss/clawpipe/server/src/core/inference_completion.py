#!/usr/bin/env python3
"""
Inference Engine Completion

Chat completion (blocking, async, streaming) and health/status queries.
"""

import asyncio
import logging
import time
from typing import AsyncIterator, Dict, List, Optional

from src.core.inference_models import InferenceResult, LoadedModel, ModelStatus

logger = logging.getLogger("finsavvyai.inference")


def complete(
    model_id: str,
    messages: List[Dict[str, str]],
    models: Dict[str, LoadedModel],
    lock: object,
    max_tokens: int = 512,
    temperature: float = 0.7,
    top_p: float = 0.9,
    stop: Optional[List[str]] = None,
) -> InferenceResult:
    """Run chat completion (blocking)."""
    with lock:
        loaded = models.get(model_id)
        if loaded is None:
            raise ValueError(f"Model {model_id} not loaded")
        if loaded.status != ModelStatus.READY:
            raise ValueError(
                f"Model {model_id} not ready (status={loaded.status.value})"
            )

    with loaded.lock:
        start = time.time()

        response = loaded.llm.create_chat_completion(
            messages=messages,
            max_tokens=max_tokens,
            temperature=temperature,
            top_p=top_p,
            stop=stop,
        )

        duration = time.time() - start

        choice = response["choices"][0]
        usage = response.get("usage", {})

        prompt_tokens = usage.get("prompt_tokens", 0)
        completion_tokens = usage.get("completion_tokens", 0)

        loaded.request_count += 1
        loaded.total_tokens_generated += completion_tokens
        loaded.last_used = time.time()

        return InferenceResult(
            text=choice["message"]["content"],
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=prompt_tokens + completion_tokens,
            finish_reason=choice.get("finish_reason", "stop"),
            model_id=model_id,
            duration_seconds=round(duration, 3),
        )


def stream_complete(
    model_id: str,
    messages: List[Dict[str, str]],
    models: Dict[str, LoadedModel],
    lock: object,
    max_tokens: int = 512,
    temperature: float = 0.7,
    top_p: float = 0.9,
    stop: Optional[List[str]] = None,
):
    """Run streaming chat completion (blocking generator)."""
    with lock:
        loaded = models.get(model_id)
        if loaded is None:
            raise ValueError(f"Model {model_id} not loaded")
        if loaded.status != ModelStatus.READY:
            raise ValueError(
                f"Model {model_id} not ready (status={loaded.status.value})"
            )

    with loaded.lock:
        loaded.request_count += 1
        loaded.last_used = time.time()

        stream = loaded.llm.create_chat_completion(
            messages=messages,
            max_tokens=max_tokens,
            temperature=temperature,
            top_p=top_p,
            stop=stop,
            stream=True,
        )

        total_tokens = 0
        for chunk in stream:
            delta = chunk["choices"][0].get("delta", {})
            content = delta.get("content", "")
            finish_reason = chunk["choices"][0].get("finish_reason")

            if content:
                total_tokens += 1

            yield {
                "content": content,
                "finish_reason": finish_reason,
                "model_id": model_id,
            }

            if finish_reason:
                break

        loaded.total_tokens_generated += total_tokens


async def stream_complete_async(
    engine: "InferenceEngine",
    model_id: str,
    messages: List[Dict[str, str]],
    max_tokens: int = 512,
    temperature: float = 0.7,
    top_p: float = 0.9,
    stop: Optional[List[str]] = None,
) -> AsyncIterator[Dict]:
    """Run streaming chat completion asynchronously."""
    loop = asyncio.get_event_loop()
    queue: asyncio.Queue = asyncio.Queue()

    def _run_stream() -> None:
        try:
            for chunk in engine.stream_complete(
                model_id, messages, max_tokens, temperature, top_p, stop
            ):
                asyncio.run_coroutine_threadsafe(queue.put(chunk), loop)
        except Exception as e:
            asyncio.run_coroutine_threadsafe(
                queue.put({"error": str(e), "finish_reason": "error"}), loop
            )
        finally:
            asyncio.run_coroutine_threadsafe(queue.put(None), loop)

    loop.run_in_executor(None, _run_stream)

    while True:
        chunk = await queue.get()
        if chunk is None:
            break
        if "error" in chunk:
            raise RuntimeError(chunk["error"])
        yield chunk
