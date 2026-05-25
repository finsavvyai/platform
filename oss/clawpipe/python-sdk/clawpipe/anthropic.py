"""Anthropic SDK drop-in replacement — change ONE import, save 30-50%."""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

try:
    import httpx
except ImportError:  # pragma: no cover
    httpx = None  # type: ignore[assignment]

GATEWAY_URL = "https://api.clawpipe.ai/v1"


@dataclass(frozen=True)
class Usage:
    input_tokens: int = 0
    output_tokens: int = 0


@dataclass(frozen=True)
class ContentBlock:
    type: str = "text"
    text: str = ""


@dataclass(frozen=True)
class Message:
    id: str = ""
    type: str = "message"
    role: str = "assistant"
    content: List[ContentBlock] = field(default_factory=list)
    model: str = ""
    stop_reason: Optional[str] = "end_turn"
    usage: Usage = field(default_factory=Usage)


def _generate_id() -> str:
    return f"msg_{uuid.uuid4().hex[:24]}"


def _infer_provider(model: str) -> str:
    if model.startswith("claude-"):
        return "anthropic"
    if model.startswith(("gpt-", "o1", "o3")):
        return "openai"
    if model.startswith("deepseek"):
        return "deepseek"
    if model.startswith("llama"):
        return "groq"
    if model.startswith("mistral"):
        return "mistral"
    return "anthropic"


class _Messages:
    """Mirrors ``anthropic.resources.messages``."""

    def __init__(self, client: "Anthropic") -> None:
        self._client = client

    def create(
        self,
        *,
        model: str,
        max_tokens: int,
        messages: List[Dict[str, Any]],
        system: Optional[str] = None,
        stream: bool = False,
        **_kwargs: Any,
    ) -> Message:
        if stream:
            raise NotImplementedError(
                "Streaming is not yet supported in the ClawPipe Python SDK. "
                "Use stream=False or follow the ClawPipe roadmap for streaming support."
            )
        return self._client._call(model, max_tokens, messages, system)


class Anthropic:
    """Anthropic-compatible client that routes through ClawPipe."""

    def __init__(
        self,
        *,
        api_key: str,
        project_id: str = "default",
        base_url: Optional[str] = None,
    ) -> None:
        if httpx is None:  # pragma: no cover
            raise ImportError("httpx is required: pip install httpx")
        self._api_key = api_key
        self._project_id = project_id
        self._base_url = (base_url or GATEWAY_URL).rstrip("/")
        self._http = httpx.Client(timeout=120)
        self.messages = _Messages(self)

    def _call(
        self,
        model: str,
        max_tokens: int,
        messages: List[Dict[str, Any]],
        system: Optional[str],
    ) -> Message:
        user_parts = [m["content"] for m in messages if m.get("role") != "system"]
        prompt = "\n".join(str(p) for p in user_parts)

        is_auto = not model or model == "auto"

        body: Dict[str, Any] = {"prompt": prompt, "maxTokens": max_tokens}
        if system:
            body["system"] = system
        if not is_auto:
            body["model"] = model
            body["provider"] = _infer_provider(model)

        resp = self._http.post(
            f"{self._base_url}/prompt",
            json=body,
            headers={
                "Authorization": f"Bearer {self._api_key}",
                "X-Project-Id": self._project_id,
                "Content-Type": "application/json",
            },
        )
        resp.raise_for_status()
        data = resp.json()

        tokens_in = data.get("tokensIn", 0)
        tokens_out = data.get("tokensOut", 0)
        resolved_model = data.get("model", model) or model
        text = data.get("text", "")

        return Message(
            id=_generate_id(),
            type="message",
            role="assistant",
            content=[ContentBlock(type="text", text=text)],
            model=resolved_model,
            stop_reason="end_turn",
            usage=Usage(input_tokens=tokens_in, output_tokens=tokens_out),
        )
