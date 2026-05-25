"""
OpenLLMetry / OpenTelemetry GenAI tracing for the SDLC RAG service.

This module wires Traceloop's ``traceloop-sdk`` into the FastAPI app so every
outbound OpenAI / Anthropic / LLM-provider call is auto-instrumented with the
OTel GenAI semantic conventions (``gen_ai.system``, ``gen_ai.request.model``,
``gen_ai.usage.input_tokens``, ``gen_ai.usage.output_tokens``). Traces are
exported via OTLP to the same collector the Go llm-gateway reports to, so the
entire LLM request fan-out can be inspected in a single trace backend.

Configuration (all opt-in; missing vars -> no-op):
    OTEL_ENABLED                  master opt-in flag (true/false)
    OTEL_EXPORTER_OTLP_ENDPOINT   OTLP collector endpoint (http/grpc)
    TRACELOOP_BASE_URL            alternative Traceloop endpoint override
    TRACELOOP_API_KEY             Traceloop cloud API key (optional)
    OTEL_SERVICE_VERSION          optional version label

The module is deliberately tolerant of missing dependencies: if
``traceloop-sdk`` is not installed, ``init_tracing`` logs a warning and falls
back to a no-op so the service can still start (e.g. local dev).
"""

from __future__ import annotations

import logging
import os
from typing import Optional

logger = logging.getLogger(__name__)

_initialized: bool = False
_tracer_provider = None  # type: ignore[var-annotated]


def _env_flag(name: str, default: bool = False) -> bool:
    """Parse a truthy environment variable."""
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def is_tracing_enabled() -> bool:
    """Return True if OTel tracing has been opted into via env vars."""
    return _env_flag("OTEL_ENABLED", default=False)


def _resolve_endpoint() -> Optional[str]:
    """Pick the effective OTLP endpoint from env vars."""
    return (
        os.getenv("TRACELOOP_BASE_URL")
        or os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT")
        or None
    )


def init_tracing(service_name: str = "sdlc-rag") -> bool:
    """
    Initialize OpenLLMetry / OpenTelemetry GenAI tracing.

    Returns True if instrumentation was activated, False if it was skipped
    (disabled by env, missing deps, or initialization error). Safe to call
    multiple times -- subsequent calls are no-ops.

    Args:
        service_name: logical service name reported in ``service.name``
            resource attribute. Defaults to ``"sdlc-rag"``.
    """
    global _initialized, _tracer_provider

    if _initialized:
        return True

    if not is_tracing_enabled():
        logger.info(
            "OpenLLMetry tracing disabled (set OTEL_ENABLED=true to activate)"
        )
        return False

    endpoint = _resolve_endpoint()
    if not endpoint:
        logger.warning(
            "OTEL_ENABLED is set but no OTLP endpoint configured "
            "(set OTEL_EXPORTER_OTLP_ENDPOINT or TRACELOOP_BASE_URL); "
            "skipping tracing init"
        )
        return False

    try:
        from traceloop.sdk import Traceloop  # type: ignore
    except ImportError:
        logger.warning(
            "traceloop-sdk is not installed; run "
            "`pip install traceloop-sdk>=0.30.0` to enable OpenLLMetry tracing"
        )
        return False

    api_key = os.getenv("TRACELOOP_API_KEY")
    disable_batch = _env_flag("OTEL_DISABLE_BATCH", default=False)

    try:
        Traceloop.init(
            app_name=service_name,
            api_endpoint=endpoint,
            api_key=api_key,
            disable_batch=disable_batch,
        )
    except Exception as exc:  # noqa: BLE001 - defensive at startup
        logger.error(
            "Failed to initialize Traceloop/OpenLLMetry tracing: %s", exc
        )
        return False

    _initialized = True
    logger.info(
        "OpenLLMetry tracing initialized service=%s endpoint=%s",
        service_name,
        endpoint,
    )
    return True


def shutdown_tracing() -> None:
    """
    Flush and shut down the tracer provider.

    Call from the FastAPI shutdown hook so spans in the batch exporter get
    flushed before the process exits.
    """
    global _initialized, _tracer_provider

    if not _initialized:
        return

    try:
        from opentelemetry import trace  # type: ignore

        provider = trace.get_tracer_provider()
        shutdown = getattr(provider, "shutdown", None)
        if callable(shutdown):
            shutdown()
    except Exception as exc:  # noqa: BLE001
        logger.warning("Error shutting down OTel tracer provider: %s", exc)
    finally:
        _initialized = False
        _tracer_provider = None
