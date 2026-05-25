"""OpenAI SDK drop-in replacement — change ONE import, save 30-50%."""

from __future__ import annotations

import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

try:
    import httpx
except ImportError:  # pragma: no cover
    httpx = None  # type: ignore[assignment]

GATEWAY_URL = "https://api.clawpipe.ai/v1"


@dataclass(frozen=True)
class ChatCompletionMessage:
    role: str = "assistant"
    content: str = ""
    refusal: Optional[str] = None


@dataclass(frozen=True)
class Choice:
    index: int = 0
    message: ChatCompletionMessage = field(default_factory=ChatCompletionMessage)
    finish_reason: Optional[str] = "stop"
    logprobs: Optional[Any] = None


@dataclass(frozen=True)
class CompletionUsage:
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0


@dataclass(frozen=True)
class ChatCompletion:
    id: str = ""
    object: str = "chat.completion"
    created: int = 0
    model: str = ""
    choices: List[Choice] = field(default_factory=list)
    usage: CompletionUsage = field(default_factory=CompletionUsage)
    system_fingerprint: Optional[str] = None


def _generate_id() -> str:
    return f"chatcmpl-{uuid.uuid4().hex[:24]}"


def _infer_provider(model: str) -> str:
    if model.startswith(("gpt-", "o1", "o3")):
        return "openai"
    if model.startswith("claude-"):
        return "anthropic"
    if model.startswith("deepseek"):
        return "deepseek"
    if model.startswith("llama"):
        return "groq"
    if model.startswith("mistral"):
        return "mistral"
    return "openai"


def _extract_messages(
    messages: List[Dict[str, str]],
) -> tuple[Optional[str], str]:
    system_parts = [m["content"] for m in messages if m["role"] == "system"]
    non_system = [m for m in messages if m["role"] != "system"]
    system = "\n".join(system_parts) if system_parts else None
    prompt = "\n".join(f"{m['role']}: {m['content']}" for m in non_system)
    return system, prompt


class _Completions:
    """Mirrors ``openai.chat.completions``."""

    def __init__(self, client: "OpenAI") -> None:
        self._client = client

    def create(
        self,
        *,
        model: str,
        messages: List[Dict[str, str]],
        max_tokens: Optional[int] = None,
        temperature: Optional[float] = None,
        stream: bool = False,
        **_kwargs: Any,
    ) -> ChatCompletion:
        if stream:
            raise NotImplementedError(
                "Streaming is not yet supported in the ClawPipe Python SDK."
            )
        return self._client._call(model, messages, max_tokens, temperature)


class _Chat:
    """Mirrors ``openai.chat``."""

    def __init__(self, client: "OpenAI") -> None:
        self.completions = _Completions(client)


class OpenAI:
    """OpenAI-compatible client that routes through ClawPipe."""

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
        self.chat = _Chat(self)

    def _call(
        self,
        model: str,
        messages: List[Dict[str, str]],
        max_tokens: Optional[int],
        temperature: Optional[float],
    ) -> ChatCompletion:
        system, prompt = _extract_messages(messages)
        is_auto = not model or model == "auto"

        body: Dict[str, Any] = {"prompt": prompt}
        if system:
            body["system"] = system
        if max_tokens is not None:
            body["maxTokens"] = max_tokens
        if temperature is not None:
            body["temperature"] = temperature
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

        return ChatCompletion(
            id=_generate_id(),
            created=int(time.time()),
            model=resolved_model,
            choices=[
                Choice(
                    index=0,
                    message=ChatCompletionMessage(
                        role="assistant",
                        content=data.get("text", ""),
                    ),
                    finish_reason="stop",
                ),
            ],
            usage=CompletionUsage(
                prompt_tokens=tokens_in,
                completion_tokens=tokens_out,
                total_tokens=tokens_in + tokens_out,
            ),
        )
