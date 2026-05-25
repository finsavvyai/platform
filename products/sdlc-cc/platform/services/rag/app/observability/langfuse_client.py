"""
Langfuse client singleton and helpers for RAG LLM tracing.

Opt-in via env vars:
    LANGFUSE_ENABLED       = "true" | "false"  (default: false)
    LANGFUSE_PUBLIC_KEY    = public key from Langfuse project
    LANGFUSE_SECRET_KEY    = secret key from Langfuse project
    LANGFUSE_HOST          = base URL (default: https://cloud.langfuse.com)

If any required var is missing or LANGFUSE_ENABLED is not truthy, helpers
become no-ops so the RAG service continues to run unchanged.
"""

from __future__ import annotations

import logging
import os
import threading
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

_TRUTHY = {"1", "true", "yes", "on", "enabled"}
_DEFAULT_HOST = "https://cloud.langfuse.com"

_client_lock = threading.Lock()
_client_instance: Any = None
_client_checked = False


def is_langfuse_enabled() -> bool:
    """Return True when all required Langfuse env vars are present and enabled."""
    if os.getenv("LANGFUSE_ENABLED", "").strip().lower() not in _TRUTHY:
        return False
    if not os.getenv("LANGFUSE_PUBLIC_KEY"):
        return False
    if not os.getenv("LANGFUSE_SECRET_KEY"):
        return False
    return True


def get_langfuse_client() -> Any:
    """
    Return a cached Langfuse client, or None if disabled / misconfigured.

    Import is lazy so the `langfuse` package is only required when the
    feature is actually enabled.
    """
    global _client_instance, _client_checked

    if _client_checked:
        return _client_instance

    with _client_lock:
        if _client_checked:
            return _client_instance

        _client_checked = True

        if not is_langfuse_enabled():
            logger.debug("Langfuse disabled or not configured; skipping client init")
            _client_instance = None
            return None

        try:
            from langfuse import Langfuse  # type: ignore
        except ImportError:
            logger.warning(
                "LANGFUSE_ENABLED=true but `langfuse` package is not installed. "
                "Run `pip install langfuse>=2.0.0` to enable tracing."
            )
            _client_instance = None
            return None

        try:
            _client_instance = Langfuse(
                public_key=os.getenv("LANGFUSE_PUBLIC_KEY"),
                secret_key=os.getenv("LANGFUSE_SECRET_KEY"),
                host=os.getenv("LANGFUSE_HOST", _DEFAULT_HOST),
            )
            logger.info(
                "Langfuse client initialized (host=%s)",
                os.getenv("LANGFUSE_HOST", _DEFAULT_HOST),
            )
        except Exception as exc:  # pragma: no cover - defensive
            logger.warning("Failed to initialize Langfuse client: %s", exc)
            _client_instance = None

    return _client_instance


def trace_llm_call(
    name: str,
    input: Any,
    output: Any,
    metadata: Optional[Dict[str, Any]] = None,
    user_id: Optional[str] = None,
    tenant_id: Optional[str] = None,
    model: Optional[str] = None,
    usage: Optional[Dict[str, int]] = None,
) -> None:
    """
    Record a single LLM call as a Langfuse trace + generation.

    No-op when Langfuse is disabled. All exceptions are swallowed so
    observability never breaks the RAG pipeline.
    """
    client = get_langfuse_client()
    if client is None:
        return

    meta: Dict[str, Any] = dict(metadata or {})
    if tenant_id:
        meta.setdefault("tenant_id", tenant_id)

    try:
        trace = client.trace(
            name=name,
            user_id=user_id,
            metadata=meta,
            tags=["rag", "llm"] + ([f"tenant:{tenant_id}"] if tenant_id else []),
        )
        trace.generation(
            name=name,
            model=model,
            input=input,
            output=output,
            metadata=meta,
            usage=usage,
        )
    except Exception as exc:  # pragma: no cover - defensive
        logger.debug("Langfuse trace_llm_call failed: %s", exc)


def flush() -> None:
    """Flush any buffered Langfuse events. Safe to call on shutdown."""
    client = get_langfuse_client()
    if client is None:
        return
    try:
        client.flush()
    except Exception as exc:  # pragma: no cover - defensive
        logger.debug("Langfuse flush failed: %s", exc)


def reset_for_tests() -> None:
    """Reset the cached client (used by unit tests)."""
    global _client_instance, _client_checked
    with _client_lock:
        _client_instance = None
        _client_checked = False
