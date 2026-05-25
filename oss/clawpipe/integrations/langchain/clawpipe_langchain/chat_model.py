"""ClawPipeChatModel — LangChain BaseChatModel backed by ClawPipe."""

from __future__ import annotations

from typing import Any, List, Optional

from langchain_core.callbacks import CallbackManagerForLLMRun
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import (
    AIMessage,
    BaseMessage,
    HumanMessage,
    SystemMessage,
)
from langchain_core.outputs import ChatGeneration, ChatResult

from clawpipe_langchain.client import ClawPipeClient, DEFAULT_GATEWAY_URL


def _messages_to_prompt(messages: List[BaseMessage]) -> tuple[Optional[str], str]:
    """Convert LangChain messages into a system string and user prompt.

    Returns (system, prompt) where system may be None.
    """
    system_parts: list[str] = []
    conversation_parts: list[str] = []

    for msg in messages:
        if isinstance(msg, SystemMessage):
            system_parts.append(str(msg.content))
        elif isinstance(msg, HumanMessage):
            conversation_parts.append(f"Human: {msg.content}")
        elif isinstance(msg, AIMessage):
            conversation_parts.append(f"Assistant: {msg.content}")
        else:
            conversation_parts.append(str(msg.content))

    system = "\n".join(system_parts) if system_parts else None
    prompt = "\n".join(conversation_parts) if conversation_parts else ""
    return system, prompt


class ClawPipeChatModel(BaseChatModel):
    """LangChain chat model that routes through ClawPipe pipeline.

    Example::

        from clawpipe_langchain import ClawPipeChatModel
        from langchain_core.messages import HumanMessage

        llm = ClawPipeChatModel(api_key="cp_xxx", project_id="my-app")
        response = llm.invoke([HumanMessage(content="Explain recursion")])
    """

    api_key: str
    project_id: str
    gateway_url: str = DEFAULT_GATEWAY_URL
    provider: Optional[str] = None
    model: Optional[str] = None
    max_tokens: Optional[int] = None
    temperature: Optional[float] = None
    enable_booster: bool = True
    enable_cache: bool = True

    model_config = {"arbitrary_types_allowed": True}

    @property
    def _llm_type(self) -> str:
        return "clawpipe-chat"

    @property
    def _identifying_params(self) -> dict[str, Any]:
        return {
            "gateway_url": self.gateway_url,
            "project_id": self.project_id,
            "provider": self.provider,
            "model": self.model,
            "enable_booster": self.enable_booster,
            "enable_cache": self.enable_cache,
        }

    def _get_client(self) -> ClawPipeClient:
        return ClawPipeClient(
            api_key=self.api_key,
            project_id=self.project_id,
            gateway_url=self.gateway_url,
            enable_booster=self.enable_booster,
            enable_cache=self.enable_cache,
        )

    def _call_kwargs(self) -> dict[str, Any]:
        kwargs: dict[str, Any] = {}
        if self.provider is not None:
            kwargs["provider"] = self.provider
        if self.model is not None:
            kwargs["model"] = self.model
        if self.max_tokens is not None:
            kwargs["max_tokens"] = self.max_tokens
        if self.temperature is not None:
            kwargs["temperature"] = self.temperature
        return kwargs

    def _generate(
        self,
        messages: List[BaseMessage],
        stop: Optional[List[str]] = None,
        run_manager: Optional[CallbackManagerForLLMRun] = None,
        **kwargs: Any,
    ) -> ChatResult:
        system, prompt = _messages_to_prompt(messages)
        client = self._get_client()
        call_kwargs = {**self._call_kwargs(), **kwargs}
        if system is not None:
            call_kwargs["system"] = system
        if stop:
            call_kwargs["stop"] = stop
        data = client.prompt(prompt, **call_kwargs)
        text = data.get("text", "")
        generation = ChatGeneration(message=AIMessage(content=text))
        token_usage = {
            "prompt_tokens": data.get("tokensIn", 0),
            "completion_tokens": data.get("tokensOut", 0),
            "total_tokens": data.get("tokensIn", 0) + data.get("tokensOut", 0),
        }
        return ChatResult(
            generations=[generation],
            llm_output={"token_usage": token_usage},
        )
