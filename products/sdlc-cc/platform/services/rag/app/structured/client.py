"""Instructor-backed LLM client wrapper for structured outputs.

The wrapper exposes a tiny surface: :func:`get_structured_client` returns a
singleton :class:`StructuredLLMClient` that selects OpenAI or Anthropic based
on the ``STRUCTURED_LLM_PROVIDER`` env var. The feature is opt-in via
``STRUCTURED_OUTPUTS_ENABLED`` so it can ship dark.
"""

from __future__ import annotations

import logging
import os
import threading
from dataclasses import dataclass
from typing import Any, Optional, Type, TypeVar

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
    """Thin adapter around an `instructor`-patched provider client.

    Callers invoke :meth:`create` with a Pydantic ``response_model``; the
    underlying ``instructor`` client performs validation/retries and returns a
    parsed instance, never a raw string.
    """

    provider: str
    model: str
    client: Any  # instructor-wrapped openai or anthropic client

    def create(
        self,
        *,
        response_model: Type[T],
        messages: list[dict],
        max_tokens: int = 1024,
        temperature: float = 0.0,
        max_retries: int = 2,
        model: Optional[str] = None,
    ) -> T:
        """Request a structured completion validated against ``response_model``."""
        chosen_model = model or self.model
        kwargs: dict[str, Any] = {
            "model": chosen_model,
            "response_model": response_model,
            "messages": messages,
            "max_retries": max_retries,
            "temperature": temperature,
        }
        # Anthropic requires an explicit max_tokens; OpenAI tolerates it too.
        kwargs["max_tokens"] = max_tokens
        return self.client.chat.completions.create(**kwargs)


_singleton_lock = threading.Lock()
_singleton: Optional[StructuredLLMClient] = None


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


def get_structured_client() -> Optional[StructuredLLMClient]:
    """Return the singleton structured client or None when disabled.

    Returns ``None`` if the feature flag is off, if the selected provider
    library isn't installed, or if construction fails. Callers should fall
    back to the legacy (string parsing) path in that case.
    """
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
                "Structured LLM client ready: provider=%s model=%s",
                _singleton.provider,
                _singleton.model,
            )
        except Exception as exc:  # pragma: no cover - defensive
            logger.warning("Failed to build structured LLM client: %s", exc)
            _singleton = None
    return _singleton


def reset_structured_client() -> None:
    """Drop the cached singleton. Intended for tests."""
    global _singleton
    with _singleton_lock:
        _singleton = None
