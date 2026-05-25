"""OpenAI provider - real API integration."""

import os
from typing import AsyncIterator, List

from openai import AsyncOpenAI

from .base import (
    BaseProvider,
    ChatRequest,
    ChatResponse,
    ModelInfo,
    StreamChunk,
)


class OpenAIProvider(BaseProvider):
    name = "openai"

    def __init__(self, api_key: str = ""):
        self.api_key = api_key or os.getenv("OPENAI_API_KEY", "")
        self.client = AsyncOpenAI(api_key=self.api_key) if self.api_key else None

    async def chat(self, request: ChatRequest) -> ChatResponse:
        if not self.client:
            raise RuntimeError("OpenAI API key not configured")

        messages = [{"role": m.role, "content": m.content} for m in request.messages]
        kwargs = {
            "model": request.model,
            "messages": messages,
            "temperature": request.temperature,
            "top_p": request.top_p,
        }
        if request.max_tokens:
            kwargs["max_tokens"] = request.max_tokens
        if request.stop:
            kwargs["stop"] = request.stop

        resp = await self.client.chat.completions.create(**kwargs)
        choice = resp.choices[0]

        return ChatResponse(
            content=choice.message.content or "",
            model=resp.model,
            provider=self.name,
            usage={
                "prompt_tokens": resp.usage.prompt_tokens if resp.usage else 0,
                "completion_tokens": resp.usage.completion_tokens if resp.usage else 0,
                "total_tokens": resp.usage.total_tokens if resp.usage else 0,
            },
            finish_reason=choice.finish_reason or "stop",
        )

    async def chat_stream(self, request: ChatRequest) -> AsyncIterator[StreamChunk]:
        if not self.client:
            raise RuntimeError("OpenAI API key not configured")

        messages = [{"role": m.role, "content": m.content} for m in request.messages]
        kwargs = {
            "model": request.model,
            "messages": messages,
            "temperature": request.temperature,
            "top_p": request.top_p,
            "stream": True,
        }
        if request.max_tokens:
            kwargs["max_tokens"] = request.max_tokens
        if request.stop:
            kwargs["stop"] = request.stop

        stream = await self.client.chat.completions.create(**kwargs)
        async for chunk in stream:
            delta = chunk.choices[0].delta if chunk.choices else None
            if delta and delta.content:
                yield StreamChunk(content=delta.content)
            if chunk.choices and chunk.choices[0].finish_reason:
                yield StreamChunk(
                    content="", finish_reason=chunk.choices[0].finish_reason
                )

    async def list_models(self) -> List[ModelInfo]:
        if not self.client:
            return []
        try:
            resp = await self.client.models.list()
            return [
                ModelInfo(id=m.id, provider=self.name, owned_by=m.owned_by or "openai")
                for m in resp.data
                if m.id.startswith(("gpt-", "o1", "o3", "o4"))
            ]
        except Exception:
            return [
                ModelInfo(id="gpt-4o", provider=self.name, owned_by="openai"),
                ModelInfo(id="gpt-4o-mini", provider=self.name, owned_by="openai"),
                ModelInfo(id="gpt-4-turbo", provider=self.name, owned_by="openai"),
            ]

    async def health_check(self) -> bool:
        if not self.client:
            return False
        try:
            await self.client.models.list()
            return True
        except Exception:
            return False
