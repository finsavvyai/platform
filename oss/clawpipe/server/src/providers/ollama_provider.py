"""Ollama provider - local model inference via Ollama API."""

import os
from typing import AsyncIterator, List

import httpx

from .base import (
    BaseProvider,
    ChatRequest,
    ChatResponse,
    ModelInfo,
    StreamChunk,
)


class OllamaProvider(BaseProvider):
    name = "ollama"

    def __init__(self, base_url: str = ""):
        self.base_url = (
            base_url or os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
        ).rstrip("/")

    async def chat(self, request: ChatRequest) -> ChatResponse:
        messages = [{"role": m.role, "content": m.content} for m in request.messages]

        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(
                f"{self.base_url}/api/chat",
                json={
                    "model": request.model,
                    "messages": messages,
                    "stream": False,
                    "options": {
                        "temperature": request.temperature,
                        "top_p": request.top_p,
                        **(
                            {"num_predict": request.max_tokens}
                            if request.max_tokens
                            else {}
                        ),
                        **({"stop": request.stop} if request.stop else {}),
                    },
                },
            )
            resp.raise_for_status()
            data = resp.json()

        return ChatResponse(
            content=data.get("message", {}).get("content", ""),
            model=data.get("model", request.model),
            provider=self.name,
            usage={
                "prompt_tokens": data.get("prompt_eval_count", 0),
                "completion_tokens": data.get("eval_count", 0),
                "total_tokens": data.get("prompt_eval_count", 0)
                + data.get("eval_count", 0),
            },
            finish_reason="stop",
        )

    async def chat_stream(self, request: ChatRequest) -> AsyncIterator[StreamChunk]:
        messages = [{"role": m.role, "content": m.content} for m in request.messages]

        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream(
                "POST",
                f"{self.base_url}/api/chat",
                json={
                    "model": request.model,
                    "messages": messages,
                    "stream": True,
                    "options": {
                        "temperature": request.temperature,
                        "top_p": request.top_p,
                        **(
                            {"num_predict": request.max_tokens}
                            if request.max_tokens
                            else {}
                        ),
                        **({"stop": request.stop} if request.stop else {}),
                    },
                },
            ) as resp:
                import json

                async for line in resp.aiter_lines():
                    if not line.strip():
                        continue
                    data = json.loads(line)
                    if data.get("done"):
                        yield StreamChunk(content="", finish_reason="stop")
                        break
                    content = data.get("message", {}).get("content", "")
                    if content:
                        yield StreamChunk(content=content)

    async def list_models(self) -> List[ModelInfo]:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(f"{self.base_url}/api/tags")
                resp.raise_for_status()
                data = resp.json()
                return [
                    ModelInfo(
                        id=m["name"],
                        provider=self.name,
                        owned_by="ollama",
                    )
                    for m in data.get("models", [])
                ]
        except Exception:
            return []

    async def health_check(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                resp = await client.get(f"{self.base_url}/api/tags")
                return resp.status_code == 200
        except Exception:
            return False
