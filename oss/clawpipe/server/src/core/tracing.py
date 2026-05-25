#!/usr/bin/env python3
"""
FinSavvyAI Distributed Tracing

Lightweight W3C Trace Context propagation for distributed tracing.

Span models live in tracing_spans.py.
"""

import os
from contextlib import contextmanager
from typing import Dict, Optional

from src.core.logger import get_logger, set_correlation_id
from src.core.tracing_spans import (  # noqa: F401
    Span,
    SpanCollector,
    SpanContext,
    generate_span_id,
    generate_trace_id,
    get_span_collector,
)

logger = get_logger("tracing", service="tracing")

# Try to import OpenTelemetry SDK (optional dependency)
_otel_available = False
otel_trace = None
OTLPSpanExporter = None
TracerProvider = None
BatchSpanProcessor = None

try:
    from opentelemetry import trace as otel_trace
    from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
    from opentelemetry.sdk.trace import TracerProvider
    from opentelemetry.sdk.trace.export import BatchSpanProcessor

    _otel_available = True
except ImportError:
    pass


def extract_trace_context(request) -> SpanContext:
    """Extract or create trace context from an incoming HTTP request."""
    traceparent = request.headers.get("traceparent", "")
    ctx = SpanContext.from_traceparent(traceparent)
    if ctx is None:
        ctx = SpanContext(trace_id=generate_trace_id(), span_id=generate_span_id())
    return ctx


def inject_trace_headers(headers: Dict[str, str], context: SpanContext) -> None:
    """Inject W3C traceparent header into outgoing request headers."""
    headers["traceparent"] = context.to_traceparent()


@contextmanager
def start_span(name: str, context: Optional[SpanContext] = None, service: str = "finsavvyai"):
    """Context manager that creates, yields, and finishes a span."""
    if context is None:
        context = SpanContext(trace_id=generate_trace_id(), span_id=generate_span_id())
    span = Span(name=name, context=context, service_name=service)
    set_correlation_id(context.trace_id[:16])
    try:
        yield span
        span.finish("OK")
    except Exception as e:
        span.set_attribute("error.type", type(e).__name__)
        span.set_attribute("error.message", str(e))
        span.finish("ERROR")
        raise


def init_otel_tracing(service_name: str = "finsavvyai") -> None:
    """Initialize OpenTelemetry tracing if the SDK is available."""
    if not _otel_available:
        logger.info("OpenTelemetry SDK not installed, using lightweight tracing only")
        return

    endpoint = os.environ.get("OTEL_EXPORTER_OTLP_ENDPOINT", "localhost:4317")
    try:
        exporter = OTLPSpanExporter(endpoint=endpoint, insecure=True)
        provider = TracerProvider()
        provider.add_span_processor(BatchSpanProcessor(exporter))
        otel_trace.set_tracer_provider(provider)
        logger.info("OpenTelemetry tracing initialized", endpoint=endpoint)
    except Exception as e:
        logger.warning("Failed to initialize OpenTelemetry", error=str(e))
