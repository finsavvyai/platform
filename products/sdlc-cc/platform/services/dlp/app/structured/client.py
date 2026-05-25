"""Instructor-backed LLM client wrapper for the DLP service.

Mirrors ``services/rag/app/structured/client.py`` so both services share the
same operational shape: a singleton :class:`StructuredLLMClient` toggled by
``STRUCTURED_OUTPUTS_ENABLED``, with provider selected by
``STRUCTURED_LLM_PROVIDER``.
"""

from __future__ import annotations

import logging
import os
import threading
from dataclasses import dataclass
from typing import Any, TypeVar

from pydantic import BaseModel

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)

_ENABLED_ENV = "STRUCTURED_OUTPUTS_ENABLED"
_PROVIDER_ENV = "STRUCTURED_LLM_PROVIDER"
_MODEL_ENV = "STRUCTURED_LLM_MODEL"
_DEFAULT_OPENAI_MODEL = "gpt-4o-mini"
_DEFAULT_ANTHROPIC_MODEL = "claude-3-5-sonnet-latest"


def is_structured_enabled() -> bool:
    """Return True when structured outputs are globally enabled."""
    return os.getenv(_ENABLED_ENV, "false").lower() in {"1", "true", "yes", "on"}


@dataclass
class StructuredLLMClient:
    """Adapter around an `instructor`-patched provider client."""

    provider: str
    model: str
    client: Any

    def create(
        self,
        *,
        response_model: type[T],
        messages: list[dict],
        max_tokens: int = 1024,
        temperature: float = 0.0,
        max_retries: int = 2,
        model: str | None = None,
    ) -> T:
        """Request a validated structured completion."""
        chosen_model = model or self.model
        return self.client.chat.completions.create(
            model=chosen_model,
            response_model=response_model,
            messages=messages,
            max_retries=max_retries,
            temperature=temperature,
            max_tokens=max_tokens,
        )


_singleton_lock = threading.Lock()
_singleton: StructuredLLMClient | None = None


def _build_openai_client() -> StructuredLLMClient:
    import instructor  # type: ignore
    from openai import OpenAI  # type: ignore

    base = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    patched = instructor.from_openai(base)
    model = os.getenv(_MODEL_ENV, _DEFAULT_OPENAI_MODEL)
    return StructuredLLMClient(provider="openai", model=model, client=patched)


def _build_anthropic_client() -> StructuredLLMClient:
    import instructor  # type: ignore
    from anthropic import Anthropic  # type: ignore

    base = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    patched = instructor.from_anthropic(base)
    model = os.getenv(_MODEL_ENV, _DEFAULT_ANTHROPIC_MODEL)
    return StructuredLLMClient(provider="anthropic", model=model, client=patched)


def get_structured_client() -> StructuredLLMClient | None:
    """Return the singleton structured client or None when disabled."""
    global _singleton

    if not is_structured_enabled():
        return None

    if _singleton is not None:
        return _singleton

    with _singleton_lock:
        if _singleton is not None:
            return _singleton

        provider = os.getenv(_PROVIDER_ENV, "openai").strip().lower()
        try:
            if provider == "anthropic":
                _singleton = _build_anthropic_client()
            else:
                _singleton = _build_openai_client()
            logger.info(
                "DLP structured LLM client ready: provider=%s model=%s",
                _singleton.provider,
                _singleton.model,
            )
        except Exception as exc:  # pragma: no cover - defensive
            logger.warning("Failed to build DLP structured client: %s", exc)
            _singleton = None
    return _singleton


def reset_structured_client() -> None:
    """Drop the cached singleton. Intended for tests."""
    global _singleton
    with _singleton_lock:
        _singleton = None
