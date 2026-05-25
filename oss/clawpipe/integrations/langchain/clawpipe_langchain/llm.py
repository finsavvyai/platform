"""ClawPipeLLM — LangChain BaseLLM backed by the ClawPipe gateway."""

from __future__ import annotations

from typing import Any, List, Optional

from langchain_core.callbacks import CallbackManagerForLLMRun
from langchain_core.language_models.llms import BaseLLM
from langchain_core.outputs import Generation, LLMResult

from clawpipe_langchain.client import ClawPipeClient, DEFAULT_GATEWAY_URL


class ClawPipeLLM(BaseLLM):
    """LangChain LLM that routes prompts through the ClawPipe pipeline.

    Example::

        from clawpipe_langchain import ClawPipeLLM

        llm = ClawPipeLLM(api_key="cp_xxx", project_id="my-app")
        result = llm.invoke("Explain recursion")
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
        return "clawpipe"

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

    def _call(
        self,
        prompt: str,
        stop: Optional[List[str]] = None,
        run_manager: Optional[CallbackManagerForLLMRun] = None,
        **kwargs: Any,
    ) -> str:
        client = self._get_client()
        call_kwargs = {**self._call_kwargs(), **kwargs}
        if stop:
            call_kwargs["stop"] = stop
        data = client.prompt(prompt, **call_kwargs)
        return data.get("text", "")

    def _generate(
        self,
        prompts: List[str],
        stop: Optional[List[str]] = None,
        run_manager: Optional[CallbackManagerForLLMRun] = None,
        **kwargs: Any,
    ) -> LLMResult:
        generations: List[List[Generation]] = []
        for prompt in prompts:
            text = self._call(prompt, stop=stop, run_manager=run_manager, **kwargs)
            generations.append([Generation(text=text)])
        return LLMResult(generations=generations)
