"""OpenHands provider - bridges chat requests to OpenHands REST API."""

import json
import os
from typing import AsyncIterator, Dict, List

import httpx

from .base import (
    BaseProvider,
    ChatRequest,
    ChatResponse,
    ModelInfo,
    StreamChunk,
)


class OpenHandsProvider(BaseProvider):
    name = "openhands"

    def __init__(self, base_url: str = "", api_key: str = ""):
        self.base_url = (
            base_url or os.getenv("OPENHANDS_BASE_URL", "http://localhost:8000")
        ).rstrip("/")
        self.api_key = api_key or os.getenv("OPENHANDS_API_KEY", "")
        self.execute_path = os.getenv("OPENHANDS_EXECUTE_PATH", "/api/execute")
        self.health_path = os.getenv("OPENHANDS_HEALTH_PATH", "/health")
        self.default_model = os.getenv("OPENHANDS_DEFAULT_MODEL", "openhands/default")
        raw_models = os.getenv("OPENHANDS_MODELS", self.default_model)
        self.models = [m.strip() for m in raw_models.split(",") if m.strip()]
        self.task_type = os.getenv("OPENHANDS_TASK_TYPE", "chat_completion")
        self.timeout_seconds = float(os.getenv("OPENHANDS_TIMEOUT_SECONDS", "180"))
        self.auth_header = os.getenv("OPENHANDS_AUTH_HEADER", "Authorization").strip()

    def _headers(self) -> Dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            if self.auth_header.lower() == "authorization":
                headers["Authorization"] = f"Bearer {self.api_key}"
            else:
                headers[self.auth_header] = self.api_key
        return headers

    @staticmethod
    def _serialize_content(content) -> str:
        if isinstance(content, str):
            return content
        try:
            return json.dumps(content, ensure_ascii=False)
        except TypeError:
            return str(content)

    def _build_prompt(self, request: ChatRequest) -> str:
        lines: List[str] = []
        for message in request.messages:
            role = message.role.upper()
            content = self._serialize_content(message.content)
            lines.append(f"{role}: {content}")
        lines.append("ASSISTANT:")
        return "\n".join(lines)

    async def chat(self, request: ChatRequest) -> ChatResponse:
        prompt = self._build_prompt(request)
        payload = {
            "taskType": self.task_type,
            "context": {
                "messages": [
                    {"role": m.role, "content": self._serialize_content(m.content)}
                    for m in request.messages
                ],
                "temperature": request.temperature,
                "max_tokens": request.max_tokens,
                "top_p": request.top_p,
                "stop": request.stop,
                "model": request.model or self.default_model,
            },
            "prompt": prompt,
            "config": {"llm": request.model or self.default_model},
        }

        async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
            resp = await client.post(
                f"{self.base_url}{self.execute_path}",
                json=payload,
                headers=self._headers(),
            )
            resp.raise_for_status()
            data = resp.json()

        if isinstance(data, dict) and data.get("success") is False:
            error = data.get("error", "OpenHands execution failed")
            raise RuntimeError(error)

        result = ""
        usage = {}
        if isinstance(data, dict):
            data_payload = data.get("data", {})
            if isinstance(data_payload, dict):
                result = str(
                    data_payload.get("result")
                    or data_payload.get("raw")
                    or data_payload.get("output")
                    or ""
                )
                if isinstance(data_payload.get("usage"), dict):
                    usage = data_payload["usage"]
            if not result:
                result = str(data.get("result") or data.get("output") or "")
        if not result:
            result = str(data)

        return ChatResponse(
            content=result,
            model=request.model or self.default_model,
            provider=self.name,
            usage=usage,
            finish_reason="stop",
        )

    async def chat_stream(self, request: ChatRequest) -> AsyncIterator[StreamChunk]:
        """Stream chat response, splitting into word-level chunks."""
        response = await self.chat(request)
        if response.content:
            words = response.content.split(" ")
            for i, word in enumerate(words):
                suffix = " " if i < len(words) - 1 else ""
                yield StreamChunk(content=word + suffix)
        yield StreamChunk(content="", finish_reason="stop")

    async def list_models(self) -> List[ModelInfo]:
        return [
            ModelInfo(id=model_id, provider=self.name, owned_by="openhands")
            for model_id in self.models
        ]

    async def health_check(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(
                    f"{self.base_url}{self.health_path}",
                    headers=self._headers(),
                )
                return response.status_code == 200
        except Exception:
            return False
