"""Anthropic provider - real API integration."""

import os
from typing import AsyncIterator, List

import anthropic

from .base import (
    BaseProvider,
    ChatRequest,
    ChatResponse,
    ModelInfo,
    StreamChunk,
)


class AnthropicProvider(BaseProvider):
    name = "anthropic"

    def __init__(self, api_key: str = ""):
        self.api_key = api_key or os.getenv("ANTHROPIC_API_KEY", "")
        self.client = (
            anthropic.AsyncAnthropic(api_key=self.api_key) if self.api_key else None
        )

    async def chat(self, request: ChatRequest) -> ChatResponse:
        if not self.client:
            raise RuntimeError("Anthropic API key not configured")

        # Anthropic uses system as a separate param
        system_msg = ""
        messages = []
        for m in request.messages:
            if m.role == "system":
                system_msg = m.content
            else:
                messages.append({"role": m.role, "content": m.content})

        kwargs = {
            "model": request.model,
            "messages": messages,
            "temperature": request.temperature,
            "top_p": request.top_p,
            "max_tokens": request.max_tokens or 4096,
        }
        if system_msg:
            kwargs["system"] = system_msg
        if request.stop:
            kwargs["stop_sequences"] = request.stop

        resp = await self.client.messages.create(**kwargs)

        content = ""
        for block in resp.content:
            if block.type == "text":
                content += block.text

        return ChatResponse(
            content=content,
            model=resp.model,
            provider=self.name,
            usage={
                "prompt_tokens": resp.usage.input_tokens,
                "completion_tokens": resp.usage.output_tokens,
                "total_tokens": resp.usage.input_tokens + resp.usage.output_tokens,
            },
            finish_reason=resp.stop_reason or "stop",
        )

    async def chat_stream(self, request: ChatRequest) -> AsyncIterator[StreamChunk]:
        if not self.client:
            raise RuntimeError("Anthropic API key not configured")

        system_msg = ""
        messages = []
        for m in request.messages:
            if m.role == "system":
                system_msg = m.content
            else:
                messages.append({"role": m.role, "content": m.content})

        kwargs = {
            "model": request.model,
            "messages": messages,
            "temperature": request.temperature,
            "top_p": request.top_p,
            "max_tokens": request.max_tokens or 4096,
            "stream": True,
        }
        if system_msg:
            kwargs["system"] = system_msg
        if request.stop:
            kwargs["stop_sequences"] = request.stop

        async with self.client.messages.stream(**kwargs) as stream:
            async for text in stream.text_stream:
                yield StreamChunk(content=text)
            yield StreamChunk(content="", finish_reason="stop")

    async def list_models(self) -> List[ModelInfo]:
        return [
            ModelInfo(
                id="claude-sonnet-4-5-20250929",
                provider=self.name,
                owned_by="anthropic",
            ),
            ModelInfo(id="claude-opus-4-6", provider=self.name, owned_by="anthropic"),
            ModelInfo(
                id="claude-haiku-4-5-20251001", provider=self.name, owned_by="anthropic"
            ),
        ]

    async def health_check(self) -> bool:
        if not self.client:
            return False
        try:
            # Minimal request to verify connectivity
            await self.client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=1,
                messages=[{"role": "user", "content": "hi"}],
            )
            return True
        except anthropic.AuthenticationError:
            return False
        except Exception:
            return True  # API reachable, might be rate limited
