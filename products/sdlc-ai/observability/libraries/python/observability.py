"""
SDLC Platform Observability Library for Python
Provides integrated logging, metrics, and tracing for Python services.
"""

import asyncio
import json
import time
from contextlib import asynccontextmanager
from contextvars import ContextVar
from typing import Any, Dict, Optional, AsyncGenerator, Callable
from functools import wraps
import logging
import uuid
from datetime import datetime

from prometheus_client import Counter, Histogram, Gauge, start_http_server, REGISTRY
from opentelemetry import trace, baggage, context
from opentelemetry.exporter.jaeger.thrift import JaegerExporter
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor
from opentelemetry.propagate import set_global_textmap
from opentelemetry.propagators.b3 import B3MultiFormat
from opentelemetry.sdk.resources import Resource
from opentelemetry.semconv.trace import SpanAttributes

from .structured_logger import (
    StructuredLogger,
    LoggerConfig,
    LogLevel,
    correlation_id_var,
    trace_id_var,
    span_id_var,
    user_id_var,
    tenant_id_var,
    request_id_var,
    session_id_var,
    log_context,
)


class MetricsConfig:
    """Configuration for Prometheus metrics."""

    def __init__(
        self,
        namespace: str = "sdlc",
        subsystem: str = "platform",
        port: int = 8000,
        enable_default_metrics: bool = True,
    ):
        self.namespace = namespace
        self.subsystem = subsystem
        self.port = port
        self.enable_default_metrics = enable_default_metrics


class TracingConfig:
    """Configuration for OpenTelemetry tracing."""

    def __init__(
        self,
        service_name: str = "sdlc-service",
        service_version: str = "1.0.0",
        environment: str = "development",
        enabled: bool = True,
        jaeger_endpoint: str = "http://localhost:14268/api/traces",
        sampling_rate: float = 1.0,
    ):
        self.service_name = service_name
        self.service_version = service_version
        self.environment = environment
        self.enabled = enabled
        self.jaeger_endpoint = jaeger_endpoint
        self.sampling_rate = sampling_rate


class ObservabilityConfig:
    """Configuration for the entire observability stack."""

    def __init__(
        self,
        service_name: str = "sdlc-service",
        service_version: str = "1.0.0",
        environment: str = "development",
        logging_config: Optional[LoggerConfig] = None,
        metrics_config: Optional[MetricsConfig] = None,
        tracing_config: Optional[TracingConfig] = None,
    ):
        self.service_name = service_name
        self.service_version = service_version
        self.environment = environment

        self.logging_config = logging_config or LoggerConfig(
            service=service_name, version=service_version, environment=environment
        )

        self.metrics_config = metrics_config or MetricsConfig()

        self.tracing_config = tracing_config or TracingConfig(
            service_name=service_name,
            service_version=service_version,
            environment=environment,
        )


class BusinessMetrics:
    """Predefined business metrics for SDLC platform."""

    def __init__(self, namespace: str, subsystem: str):
        self.namespace = namespace
        self.subsystem = subsystem

        # HTTP metrics
        self.requests_total = Counter(
            f"{namespace}_{subsystem}_http_requests_total",
            "Total number of HTTP requests",
            ["method", "endpoint", "status_code", "tenant_id", "user_id"],
        )

        self.request_duration = Histogram(
            f"{namespace}_{subsystem}_http_request_duration_seconds",
            "HTTP request duration in seconds",
            ["method", "endpoint", "tenant_id"],
            buckets=[0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0],
        )

        # Error metrics
        self.errors_total = Counter(
            f"{namespace}_{subsystem}_errors_total",
            "Total number of errors",
            ["error_type", "component", "tenant_id"],
        )

        # Authentication metrics
        self.auth_attempts = Counter(
            f"{namespace}_{subsystem}_auth_attempts_total",
            "Total number of authentication attempts",
            ["auth_type", "result", "tenant_id"],
        )

        # Document metrics
        self.documents_processed = Counter(
            f"{namespace}_{subsystem}_documents_processed_total",
            "Total number of documents processed",
            ["operation", "document_type", "tenant_id"],
        )

        self.document_processing_time = Histogram(
            f"{namespace}_{subsystem}_document_processing_duration_seconds",
            "Document processing duration in seconds",
            ["document_type", "operation", "tenant_id"],
            buckets=[0.5, 1.0, 2.5, 5.0, 10.0, 30.0, 60.0],
        )

        # RAG metrics
        self.rag_queries = Counter(
            f"{namespace}_{subsystem}_rag_queries_total",
            "Total number of RAG queries",
            ["query_type", "result_type", "tenant_id"],
        )

        self.rag_query_time = Histogram(
            f"{namespace}_{subsystem}_rag_query_duration_seconds",
            "RAG query duration in seconds",
            ["query_type", "tenant_id"],
            buckets=[0.1, 0.5, 1.0, 2.5, 5.0, 10.0],
        )

        # Vector search metrics
        self.vector_searches = Counter(
            f"{namespace}_{subsystem}_vector_searches_total",
            "Total number of vector searches",
            ["search_type", "index_name", "tenant_id"],
        )

        self.vector_search_time = Histogram(
            f"{namespace}_{subsystem}_vector_search_duration_seconds",
            "Vector search duration in seconds",
            ["search_type", "index_name", "tenant_id"],
            buckets=[0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5],
        )

        # Tenant metrics
        self.active_tenants = Gauge(
            f"{namespace}_{subsystem}_active_tenants",
            "Number of active tenants",
            ["tenant_type"],
        )

        self.tenant_storage = Gauge(
            f"{namespace}_{subsystem}_tenant_storage_bytes",
            "Storage usage per tenant in bytes",
            ["tenant_id", "storage_type"],
        )


class ObservabilityManager:
    """Main observability manager that coordinates logging, metrics, and tracing."""

    def __init__(self, config: ObservabilityConfig):
        self.config = config
        self.logger = StructuredLogger(config.logging_config)
        self.business_metrics = BusinessMetrics(
            config.metrics_config.namespace, config.metrics_config.subsystem
        )
        self.tracer = None
        self._setup_tracing()
        self._setup_metrics()

    def _setup_tracing(self):
        """Setup OpenTelemetry tracing."""
        if not self.config.tracing_config.enabled:
            return

        # Create resource
        resource = Resource.create(
            {
                "service.name": self.config.tracing_config.service_name,
                "service.version": self.config.tracing_config.service_version,
                "deployment.environment": self.config.tracing_config.environment,
            }
        )

        # Create tracer provider
        tracer_provider = TracerProvider(resource=resource)

        # Create and register Jaeger exporter
        jaeger_exporter = JaegerExporter(
            endpoint=self.config.tracing_config.jaeger_endpoint,
            collector_endpoint=self.config.tracing_config.jaeger_endpoint,
        )

        # Add span processor
        span_processor = BatchSpanProcessor(jaeger_exporter)
        tracer_provider.add_span_processor(span_processor)

        # Set global tracer provider
        trace.set_tracer_provider(tracer_provider)

        # Set global propagator
        set_global_textmap(B3MultiFormat())

        # Get tracer
        self.tracer = trace.get_tracer(__name__)

    def _setup_metrics(self):
        """Setup Prometheus metrics."""
        if self.config.metrics_config.port:
            start_http_server(self.config.metrics_config.port)

    def get_logger(self) -> StructuredLogger:
        """Get the structured logger."""
        return self.logger

    def get_tracer(self) -> trace.Tracer:
        """Get the OpenTelemetry tracer."""
        return self.tracer

    def get_business_metrics(self) -> BusinessMetrics:
        """Get business metrics."""
        return self.business_metrics

    @asynccontextmanager
    async def trace_span(
        self,
        name: str,
        attributes: Optional[Dict[str, Any]] = None,
        kind: trace.SpanKind = trace.SpanKind.INTERNAL,
    ) -> AsyncGenerator[trace.Span, None]:
        """Create a traced span with automatic logging and metrics."""
        if not self.tracer:
            yield None
            return

        with self.tracer.start_as_current_span(name, kind=kind) as span:
            if attributes:
                for key, value in attributes.items():
                    span.set_attribute(key, str(value))

            # Log span start
            current_context = context.get_current()
            correlation_id = correlation_id_var.get(current_context)

            self.logger.with_fields(
                span_name=name, span_kind=kind.name, **attributes
            ).info(f"Started span: {name}")

            try:
                yield span
            except Exception as e:
                # Record error in span
                span.record_exception(e)
                span.set_status(trace.Status(trace.StatusCode.ERROR, str(e)))

                # Log error
                self.logger.error(
                    f"Error in span {name}: {str(e)}", error=e, span_name=name
                )

                # Record error metric
                self.business_metrics.errors_total.labels(
                    error_type=type(e).__name__,
                    component=name,
                    tenant_id=tenant_id_var.get(current_context) or "",
                ).inc()

                raise
            else:
                span.set_status(trace.Status(trace.StatusCode.OK))

                # Log span completion
                self.logger.with_fields(span_name=name).info(f"Completed span: {name}")


class ObservabilityMiddleware:
    """ASGI middleware for automatic observability integration."""

    def __init__(self, manager: ObservabilityManager, app):
        self.manager = manager
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        start_time = time.time()

        # Extract correlation headers
        headers = dict(scope.get("headers", []))

        correlation_id = headers.get(b"x-correlation-id", b"").decode()
        if not correlation_id:
            correlation_id = str(uuid.uuid4())

        trace_id = headers.get(b"x-trace-id", b"").decode()
        span_id = headers.get(b"x-span-id", b"").decode()
        user_id = headers.get(b"x-user-id", b"").decode()
        tenant_id = headers.get(b"x-tenant-id", b"").decode()
        request_id = headers.get(b"x-request-id", b"").decode()
        session_id = headers.get(b"x-session-id", b"").decode()

        # Set correlation data in context
        async with log_context(
            correlation_id=correlation_id,
            trace_id=trace_id,
            span_id=span_id,
            user_id=user_id,
            tenant_id=tenant_id,
            request_id=request_id,
            session_id=session_id,
        ):
            # Start tracing span
            async with self.manager.trace_span(
                f"HTTP {scope['method']} {scope['path']}",
                {
                    "http.method": scope["method"],
                    "http.url": scope["path"],
                    "http.scheme": scope.get("scheme", "http"),
                    "http.user_agent": headers.get(b"user-agent", b"").decode(),
                    "http.remote_addr": scope.get("client", ("", ""))[0],
                    "correlation_id": correlation_id,
                    "tenant_id": tenant_id,
                    "user_id": user_id,
                },
                kind=trace.SpanKind.SERVER,
            ) as span:
                # Wrap send to capture status code
                status_code = 200

                async def wrapped_send(message):
                    nonlocal status_code
                    if message["type"] == "http.response.start":
                        status_code = message["status"]

                        # Add correlation headers to response
                        response_headers = message.get("headers", [])
                        response_headers.extend(
                            [
                                (b"x-correlation-id", correlation_id.encode()),
                            ]
                        )
                        if trace_id:
                            response_headers.append((b"x-trace-id", trace_id.encode()))
                        if span_id and span:
                            response_headers.append(
                                (
                                    b"x-span-id",
                                    span.get_span_context()
                                    .span_id.to_bytes(8, "big")
                                    .hex()
                                    .encode(),
                                )
                            )

                        message["headers"] = response_headers

                    await send(message)

                # Log request start
                self.manager.logger.info(
                    f"HTTP request started: {scope['method']} {scope['path']}",
                    method=scope["method"],
                    path=scope["path"],
                    query_string=scope.get("query_string", b"").decode(),
                    user_agent=headers.get(b"user-agent", b"").decode(),
                )

                try:
                    await self.app(scope, receive, wrapped_send)
                except Exception as e:
                    status_code = 500
                    raise
                finally:
                    # Calculate duration
                    duration = time.time() - start_time

                    # Record metrics
                    self.manager.business_metrics.requests_total.labels(
                        method=scope["method"],
                        endpoint=scope["path"],
                        status_code=str(status_code),
                        tenant_id=tenant_id or "",
                        user_id=user_id or "",
                    ).inc()

                    self.manager.business_metrics.request_duration.labels(
                        method=scope["method"],
                        endpoint=scope["path"],
                        tenant_id=tenant_id or "",
                    ).observe(duration)

                    # Add tracing attributes
                    if span:
                        span.set_attribute("http.status_code", status_code)
                        span.set_attribute("http.duration_ms", duration * 1000)

                    # Log request completion
                    log_level = LogLevel.INFO
                    if status_code >= 400:
                        log_level = LogLevel.WARN
                    if status_code >= 500:
                        log_level = LogLevel.ERROR

                    getattr(self.manager.logger, log_level.value.lower())(
                        f"HTTP request completed: {scope['method']} {scope['path']} {status_code}",
                        method=scope["method"],
                        path=scope["path"],
                        status_code=status_code,
                        duration=duration,
                    )


def instrument_fastapi(app, manager: ObservabilityManager):
    """Instrument FastAPI application with observability."""
    # Add observability middleware
    app.add_middleware(ObservabilityMiddleware, manager=manager)

    # Add OpenTelemetry FastAPI instrumentation
    if manager.tracer:
        FastAPIInstrumentor.instrument_app(app)


def instrument_httpx():
    """Instrument HTTPX client with automatic tracing."""
    HTTPXClientInstrumentor().instrument()


def trace_async(name: str, manager: Optional[ObservabilityManager] = None):
    """Decorator for tracing async functions."""

    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            obs_manager = manager or get_global_manager()
            if not obs_manager:
                return await func(*args, **kwargs)

            async with obs_manager.trace_span(name):
                return await func(*args, **kwargs)

        return wrapper

    return decorator


def trace_sync(name: str, manager: Optional[ObservabilityManager] = None):
    """Decorator for tracing sync functions."""

    def decorator(func: Callable):
        @wraps(func)
        def wrapper(*args, **kwargs):
            obs_manager = manager or get_global_manager()
            if not obs_manager:
                return func(*args, **kwargs)

            current_context = context.get_current()

            if obs_manager.tracer:
                with obs_manager.tracer.start_as_current_span(name):
                    return func(*args, **kwargs)
            else:
                return func(*args, **kwargs)

        return wrapper

    return decorator


# Global observability manager instance
_global_manager: Optional[ObservabilityManager] = None


def init_global_observability(config: ObservabilityConfig) -> ObservabilityManager:
    """Initialize global observability manager."""
    global _global_manager
    _global_manager = ObservabilityManager(config)
    return _global_manager


def get_global_manager() -> Optional[ObservabilityManager]:
    """Get global observability manager."""
    return _global_manager


def get_logger() -> StructuredLogger:
    """Get global logger."""
    manager = get_global_manager()
    if manager:
        return manager.get_logger()
    return StructuredLogger(LoggerConfig.default())


def get_tracer() -> Optional[trace.Tracer]:
    """Get global tracer."""
    manager = get_global_manager()
    if manager:
        return manager.get_tracer()
    return None


def get_business_metrics() -> Optional[BusinessMetrics]:
    """Get global business metrics."""
    manager = get_global_manager()
    if manager:
        return manager.get_business_metrics()
    return None
