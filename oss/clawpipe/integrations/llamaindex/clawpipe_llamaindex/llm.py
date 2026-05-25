"""ClawPipeLLM — LlamaIndex LLM backed by the ClawPipe gateway."""

from __future__ import annotations

from typing import Any, Generator, Optional, Sequence

import httpx
from llama_index.core.base.llms.types import (
    ChatMessage,
    ChatResponse,
    ChatResponseGen,
    CompletionResponse,
    CompletionResponseGen,
    LLMMetadata,
    MessageRole,
)
from llama_index.core.llms.callbacks import llm_chat_callback, llm_completion_callback
from llama_index.core.llms.custom import CustomLLM

DEFAULT_GATEWAY_URL = "https://api.clawpipe.ai"
DEFAULT_TIMEOUT = 120.0


class ClawPipeLLM(CustomLLM):
    """LlamaIndex LLM that routes prompts through the ClawPipe pipeline.

    Example::

        from clawpipe_llamaindex import ClawPipeLLM

        llm = ClawPipeLLM(api_key="cp_xxx")
        response = llm.complete("Explain recursion")
        print(response.text)
    """

    api_key: str
    gateway_url: str = DEFAULT_GATEWAY_URL
    provider: Optional[str] = None
    model: Optional[str] = None
    max_tokens: Optional[int] = None
    temperature: Optional[float] = None
    enable_booster: bool = True
    enable_cache: bool = True
    context_window: int = 8192
    num_output: int = 512

    @property
    def metadata(self) -> LLMMetadata:
        return LLMMetadata(
            context_window=self.context_window,
            num_output=self.num_output,
            model_name="clawpipe-auto",
            is_chat_model=True,
        )

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    def _build_body(self, prompt: str, **kwargs: Any) -> dict[str, Any]:
        body: dict[str, Any] = {"prompt": prompt}
        provider = kwargs.get("provider", self.provider)
        model = kwargs.get("model", self.model)
        max_tokens = kwargs.get("max_tokens", self.max_tokens)
        temperature = kwargs.get("temperature", self.temperature)
        if provider is not None:
            body["provider"] = provider
        if model is not None:
            body["model"] = model
        if max_tokens is not None:
            body["maxTokens"] = max_tokens
        if temperature is not None:
            body["temperature"] = temperature
        body["enableBooster"] = self.enable_booster
        body["enableCache"] = self.enable_cache
        return body

    def _post(self, prompt: str, **kwargs: Any) -> dict[str, Any]:
        url = f"{self.gateway_url.rstrip('/')}/v1/prompt"
        body = self._build_body(prompt, **kwargs)
        with httpx.Client(timeout=DEFAULT_TIMEOUT) as client:
            response = client.post(url, json=body, headers=self._headers())
            response.raise_for_status()
            return response.json()

    @llm_completion_callback()
    def complete(self, prompt: str, **kwargs: Any) -> CompletionResponse:
        data = self._post(prompt, **kwargs)
        text = data.get("text", "")
        return CompletionResponse(text=text, raw=data)

    @llm_completion_callback()
    def stream_complete(
        self, prompt: str, **kwargs: Any
    ) -> Generator[CompletionResponseGen, None, None]:
        raise NotImplementedError(
            "ClawPipeLLM does not yet support streaming completions. "
            "Streaming support is on the ClawPipe roadmap. "
            "Use complete() for synchronous responses."
        )

    @llm_chat_callback()
    def chat(self, messages: Sequence[ChatMessage], **kwargs: Any) -> ChatResponse:
        prompt = self._messages_to_prompt(messages)
        data = self._post(prompt, **kwargs)
        text = data.get("text", "")
        message = ChatMessage(role=MessageRole.ASSISTANT, content=text)
        return ChatResponse(message=message, raw=data)

    @llm_chat_callback()
    def stream_chat(
        self, messages: Sequence[ChatMessage], **kwargs: Any
    ) -> Generator[ChatResponseGen, None, None]:
        raise NotImplementedError(
            "ClawPipeLLM does not yet support streaming chat. "
            "Streaming support is on the ClawPipe roadmap. "
            "Use chat() for synchronous responses."
        )

    def _messages_to_prompt(self, messages: Sequence[ChatMessage]) -> str:
        parts: list[str] = []
        for msg in messages:
            role = msg.role.value if hasattr(msg.role, "value") else str(msg.role)
            content = msg.content or ""
            parts.append(f"{role}: {content}")
        return "\n".join(parts)
