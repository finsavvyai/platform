"""
Observability stubs for metrics and tracing.

This module provides stub implementations for metrics collection and distributed tracing
that can be replaced with actual implementations.
"""

import logging
import time
import uuid
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime
from functools import wraps
from typing import Any, Callable, Dict, List, Optional

logger = logging.getLogger(__name__)


@dataclass
class MetricData:
    """Metric data point."""

    name: str
    value: float
    timestamp: datetime
    tags: Dict[str, str]
    metric_type: str  # counter, gauge, histogram


@dataclass
class SpanData:
    """Trace span data."""

    trace_id: str
    span_id: str
    parent_span_id: Optional[str]
    operation_name: str
    start_time: datetime
    end_time: Optional[datetime]
    duration_ms: Optional[float]
    tags: Dict[str, str]
    logs: List[Dict[str, Any]]
    status: str


class MetricsCollector:
    """Stub metrics collector for Prometheus/monitoring."""

    def __init__(self):
        self._metrics: List[MetricData] = []
        self._counters: Dict[str, float] = {}
        self._gauges: Dict[str, float] = {}
        self._histograms: Dict[str, List[float]] = {}

    def increment_counter(
        self, name: str, value: float = 1.0, tags: Dict[str, str] = None
    ):
        """Increment a counter metric."""
        key = self._make_key(name, tags)
        self._counters[key] = self._counters.get(key, 0.0) + value
        self._metrics.append(
            MetricData(
                name=name,
                value=value,
                timestamp=datetime.utcnow(),
                tags=tags or {},
                metric_type="counter",
            )
        )

    def set_gauge(self, name: str, value: float, tags: Dict[str, str] = None):
        """Set a gauge metric value."""
        key = self._make_key(name, tags)
        self._gauges[key] = value
        self._metrics.append(
            MetricData(
                name=name,
                value=value,
                timestamp=datetime.utcnow(),
                tags=tags or {},
                metric_type="gauge",
            )
        )

    def record_histogram(self, name: str, value: float, tags: Dict[str, str] = None):
        """Record a histogram metric value."""
        key = self._make_key(name, tags)
        if key not in self._histograms:
            self._histograms[key] = []
        self._histograms[key].append(value)
        self._metrics.append(
            MetricData(
                name=name,
                value=value,
                timestamp=datetime.utcnow(),
                tags=tags or {},
                metric_type="histogram",
            )
        )

    def _make_key(self, name: str, tags: Dict[str, str] = None) -> str:
        """Create a unique key for a metric with tags."""
        if not tags:
            return name
        tag_str = ",".join(f"{k}={v}" for k, v in sorted(tags.items()))
        return f"{name}|{tag_str}"

    def get_metrics(self) -> Dict[str, Any]:
        """Get all collected metrics."""
        return {
            "counters": self._counters.copy(),
            "gauges": self._gauges.copy(),
            "histograms": {
                k: {"count": len(v), "sum": sum(v), "avg": sum(v) / len(v) if v else 0}
                for k, v in self._histograms.items()
            },
        }

    def reset(self):
        """Reset all metrics."""
        self._metrics.clear()
        self._counters.clear()
        self._gauges.clear()
        self._histograms.clear()


class Tracer:
    """Stub distributed tracer."""

    def __init__(self, service_name: str):
        self.service_name = service_name
        self._spans: List[SpanData] = []
        self._active_span: Optional[SpanData] = None

    @contextmanager
    def start_span(self, operation_name: str, tags: Dict[str, str] = None):
        """Start a new trace span."""
        parent_span = self._active_span
        span_id = str(uuid.uuid4())
        trace_id = parent_span.trace_id if parent_span else str(uuid.uuid4())

        span = SpanData(
            trace_id=trace_id,
            span_id=span_id,
            parent_span_id=parent_span.span_id if parent_span else None,
            operation_name=operation_name,
            start_time=datetime.utcnow(),
            end_time=None,
            duration_ms=None,
            tags=tags or {},
            logs=[],
            status="started",
        )

        self._active_span = span
        self._spans.append(span)

        try:
            yield span
        finally:
            span.end_time = datetime.utcnow()
            span.duration_ms = (span.end_time - span.start_time).total_seconds() * 1000
            span.status = "completed"
            if parent_span:
                self._active_span = parent_span
            else:
                self._active_span = None

    def get_active_span(self) -> Optional[SpanData]:
        """Get the currently active span."""
        return self._active_span

    def get_spans(self) -> List[SpanData]:
        """Get all recorded spans."""
        return self._spans.copy()

    def reset(self):
        """Reset all spans."""
        self._spans.clear()
        self._active_span = None


def trace(operation_name: str):
    """Decorator for tracing function execution."""

    def decorator(func: Callable):
        @wraps(func)
        def wrapper(*args, **kwargs):
            tracer = get_tracer()
            with tracer.start_span(operation_name):
                return func(*args, **kwargs)

        return wrapper

    return decorator


def timed(operation_name: str = None):
    """Decorator for timing function execution."""

    def decorator(func: Callable):
        @wraps(func)
        def wrapper(*args, **kwargs):
            name = operation_name or f"{func.__module__}.{func.__name__}"
            start = time.time()
            try:
                result = func(*args, **kwargs)
                return result
            finally:
                duration_ms = (time.time() - start) * 1000
                metrics = get_metrics()
                metrics.record_histogram(f"{name}_duration_ms", duration_ms)

        return wrapper

    return decorator


# Global instances
_metrics_collector: Optional[MetricsCollector] = None
_tracer: Optional[Tracer] = None


def get_metrics() -> MetricsCollector:
    """Get the global metrics collector."""
    global _metrics_collector
    if _metrics_collector is None:
        _metrics_collector = MetricsCollector()
    return _metrics_collector


def get_tracer(service_name: str = "rag-service") -> Tracer:
    """Get the global tracer."""
    global _tracer
    if _tracer is None:
        _tracer = Tracer(service_name)
    return _tracer


def init_metrics(service_name: str):
    """Initialize metrics with service name."""
    return get_metrics()


def init_tracer(service_name: str):
    """Initialize tracer with service name."""
    return get_tracer(service_name)


# Convenience functions
def increment_counter(name: str, value: float = 1.0, **tags):
    """Increment a counter metric."""
    metrics = get_metrics()
    metrics.increment_counter(name, value, tags)


def set_gauge(name: str, value: float, **tags):
    """Set a gauge metric value."""
    metrics = get_metrics()
    metrics.set_gauge(name, value, tags)


def record_histogram(name: str, value: float, **tags):
    """Record a histogram metric value."""
    metrics = get_metrics()
    metrics.record_histogram(name, value, tags)
