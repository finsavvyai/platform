"""LM Studio provider - local model inference via LM Studio API."""

import os
import logging
from typing import AsyncIterator, List

import httpx

from .base import (
    BaseProvider,
    ChatRequest,
    ChatResponse,
    ModelInfo,
    StreamChunk,
)
from .lmstudio_streaming import chat_stream as _stream_impl

logger = logging.getLogger("finsavvyai.lmstudio")


class LMStudioProvider(BaseProvider):
    """
    Connect to LM Studio's OpenAI-compatible API server.

    LM Studio runs on http://localhost:1234 by default and provides
    an OpenAI-compatible /v1/chat/completions endpoint.

    Example:
        provider = LMStudioProvider()
        response = await provider.chat(ChatRequest(...))
    """

    name = "lmstudio"

    def __init__(self, base_url: str = ""):
        """
        Initialize LM Studio provider.

        Args:
            base_url: LM Studio API server URL.
                     Defaults to http://localhost:1234
                     Can be set via LMSTUDIO_BASE_URL env var.
        """
        self.base_url = (
            base_url or os.getenv("LMSTUDIO_BASE_URL", "http://localhost:1234")
        ).rstrip("/")

        logger.info(f"LM Studio provider initialized for {self.base_url}")

    async def chat(self, request: ChatRequest) -> ChatResponse:
        """
        Send chat completion request to LM Studio.

        Args:
            request: Chat request with messages, model, parameters

        Returns:
            ChatResponse with generated content and usage stats

        Raises:
            httpx.HTTPError: If request fails
            RuntimeError: If LM Studio is not reachable
        """
        messages = [{"role": m.role, "content": m.content} for m in request.messages]

        payload = {
            "model": request.model,
            "messages": messages,
            "temperature": request.temperature,
            "top_p": request.top_p,
        }

        if request.max_tokens:
            payload["max_tokens"] = request.max_tokens
        if request.stop:
            payload["stop"] = request.stop

        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                resp = await client.post(
                    f"{self.base_url}/v1/chat/completions",
                    json=payload,
                )
                resp.raise_for_status()
                data = resp.json()

        except httpx.ConnectError as e:
            raise RuntimeError(
                f"Cannot connect to LM Studio at {self.base_url}. "
                f"Ensure LM Studio is running with API server enabled."
            ) from e

        choice = data["choices"][0]

        return ChatResponse(
            content=choice["message"]["content"],
            model=data.get("model", request.model),
            provider=self.name,
            usage={
                "prompt_tokens": data.get("usage", {}).get("prompt_tokens", 0),
                "completion_tokens": data.get("usage", {}).get("completion_tokens", 0),
                "total_tokens": data.get("usage", {}).get("total_tokens", 0),
            },
            finish_reason=choice.get("finish_reason", "stop"),
        )

    async def chat_stream(self, request: ChatRequest) -> AsyncIterator[StreamChunk]:
        """
        Stream chat completion from LM Studio.

        Args:
            request: Chat request with messages, model, parameters

        Yields:
            StreamChunk with content deltas
        """
        async for chunk in _stream_impl(self.base_url, request):
            yield chunk

    async def list_models(self) -> List[ModelInfo]:
        """
        List models available in LM Studio.

        Returns:
            List of ModelInfo objects
        """
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(f"{self.base_url}/v1/models")
                resp.raise_for_status()
                data = resp.json()

                return [
                    ModelInfo(
                        id=m["id"],
                        provider=self.name,
                        owned_by="lmstudio",
                    )
                    for m in data.get("data", [])
                ]

        except Exception as e:
            logger.warning(f"Failed to list LM Studio models: {e}")
            return []

    async def health_check(self) -> bool:
        """
        Check if LM Studio API server is running.

        Returns:
            True if LM Studio is reachable
        """
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                resp = await client.get(f"{self.base_url}/v1/models")
                return resp.status_code == 200
        except Exception:
            return False
