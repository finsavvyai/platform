"""
Prometheus metrics collector for SDLC.ai platform.
Provides comprehensive metrics collection with business and technical KPIs.
"""

import time
import psutil
from contextlib import contextmanager
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Union, Callable
from functools import wraps
from prometheus_client import (
    Counter,
    Gauge,
    Histogram,
    Summary,
    CollectorRegistry,
    generate_latest,
    CONTENT_TYPE_LATEST,
    push_to_gateway,
    start_http_server,
    pushadd_to_gateway,
)
from prometheus_client.core import REGISTRY
from prometheus_client.exposition import MetricsHandler
from http.server import HTTPServer
from threading import Thread
import logging


class MetricType:
    """Metric types for Prometheus."""

    COUNTER = "counter"
    GAUGE = "gauge"
    HISTOGRAM = "histogram"
    SUMMARY = "summary"


@dataclass
class MetricsConfig:
    """Configuration for metrics collector."""

    namespace: str = "sdlc"
    subsystem: str = "platform"
    port: int = 9090
    path: str = "/metrics"
    common_labels: List[str] = field(
        default_factory=lambda: [
            "service",
            "version",
            "environment",
            "tenant_id",
            "user_id",
            "correlation_id",
            "trace_id",
        ]
    )
    buckets: List[float] = field(
        default_factory=lambda: [
            0.005,
            0.01,
            0.025,
            0.05,
            0.1,
            0.25,
            0.5,
            1.0,
            2.5,
            5.0,
            10.0,
        ]
    )
    objectives: Dict[float, float] = field(
        default_factory=lambda: {0.5: 0.05, 0.9: 0.01, 0.95: 0.005, 0.99: 0.001}
    )
    enable_histogram: bool = True
    enable_summary: bool = True
    push_gateway: Optional[str] = None
    push_interval: int = 30


class MetricsCollector:
    """Prometheus metrics collector with business and technical metrics."""

    def __init__(self, config: Optional[MetricsConfig] = None):
        self.config = config or MetricsConfig()
        self.registry = CollectorRegistry()
        self.metrics: Dict[str, Union[Counter, Gauge, Histogram, Summary]] = {}
        self.http_server: Optional[HTTPServer] = None
        self.server_thread: Optional[Thread] = None
        self._setup_default_metrics()

    def _setup_default_metrics(self):
        """Setup default Python metrics."""
        from prometheus_client import ProcessCollector, PythonCollector

        # Register process metrics
        self.registry.register(ProcessCollector(registry=self.registry))
        # Register Python metrics
        self.registry.register(PythonCollector(registry=self.registry))

    def _get_full_name(self, name: str) -> str:
        """Get fully qualified metric name."""
        if self.config.subsystem:
            return f"{self.config.namespace}_{self.config.subsystem}_{name}"
        return f"{self.config.namespace}_{name}"

    def counter(
        self, name: str, documentation: str, labelnames: Optional[List[str]] = None
    ) -> Counter:
        """Create and register a counter metric."""
        full_name = self._get_full_name(name)

        if full_name in self.metrics:
            raise ValueError(f"Metric {full_name} already registered")

        counter = Counter(
            name=name,
            documentation=documentation,
            labelnames=labelnames or [],
            registry=self.registry,
        )

        self.metrics[full_name] = counter
        return counter

    def gauge(
        self, name: str, documentation: str, labelnames: Optional[List[str]] = None
    ) -> Gauge:
        """Create and register a gauge metric."""
        full_name = self._get_full_name(name)

        if full_name in self.metrics:
            raise ValueError(f"Metric {full_name} already registered")

        gauge = Gauge(
            name=name,
            documentation=documentation,
            labelnames=labelnames or [],
            registry=self.registry,
        )

        self.metrics[full_name] = gauge
        return gauge

    def histogram(
        self,
        name: str,
        documentation: str,
        buckets: Optional[List[float]] = None,
        labelnames: Optional[List[str]] = None,
    ) -> Histogram:
        """Create and register a histogram metric."""
        full_name = self._get_full_name(name)

        if full_name in self.metrics:
            raise ValueError(f"Metric {full_name} already registered")

        histogram = Histogram(
            name=name,
            documentation=documentation,
            buckets=buckets or self.config.buckets,
            labelnames=labelnames or [],
            registry=self.registry,
        )

        self.metrics[full_name] = histogram
        return histogram

    def summary(
        self,
        name: str,
        documentation: str,
        objectives: Optional[Dict[float, float]] = None,
        labelnames: Optional[List[str]] = None,
    ) -> Summary:
        """Create and register a summary metric."""
        full_name = self._get_full_name(name)

        if full_name in self.metrics:
            raise ValueError(f"Metric {full_name} already registered")

        summary = Summary(
            name=name,
            documentation=documentation,
            objectives=objectives or self.config.objectives,
            labelnames=labelnames or [],
            registry=self.registry,
        )

        self.metrics[full_name] = summary
        return summary

    def get_metric(
        self, name: str
    ) -> Optional[Union[Counter, Gauge, Histogram, Summary]]:
        """Get a registered metric by name."""
        full_name = self._get_full_name(name)
        return self.metrics.get(full_name)

    def start_server(self) -> None:
        """Start HTTP server for metrics exposure."""
        if self.http_server:
            return

        # Start Prometheus HTTP server
        start_http_server(self.config.port, registry=self.registry)
        logging.info(f"Metrics server started on port {self.config.port}")

    def stop_server(self) -> None:
        """Stop the HTTP server."""
        if self.http_server:
            self.http_server.shutdown()
            self.http_server = None
            if self.server_thread:
                self.server_thread.join()
                self.server_thread = None

    def push_to_gateway(
        self, job_name: str, grouping_key: Optional[Dict[str, str]] = None
    ) -> None:
        """Push metrics to Prometheus push gateway."""
        if not self.config.push_gateway:
            raise ValueError("Push gateway not configured")

        push_to_gateway(
            self.config.push_gateway,
            job=job_name,
            registry=self.registry,
            grouping_key=grouping_key,
        )

    def generate_latest(self) -> str:
        """Generate the latest metrics for exposition."""
        return generate_latest(self.registry).decode("utf-8")


class BusinessMetrics:
    """Standard business metrics for SDLC.ai platform."""

    def __init__(self, collector: MetricsCollector):
        self.collector = collector
        self._setup_metrics()

    def _setup_metrics(self):
        """Setup all business metrics."""
        # HTTP metrics
        self.requests_total = self.collector.counter(
            "http_requests_total",
            "Total number of HTTP requests",
            ["method", "endpoint", "status_code"] + self.collector.config.common_labels,
        )

        self.request_duration = self.collector.histogram(
            "http_request_duration_seconds",
            "HTTP request duration in seconds",
            self.collector.config.buckets,
            ["method", "endpoint"] + self.collector.config.common_labels,
        )

        self.response_size = self.collector.histogram(
            "http_response_size_bytes",
            "HTTP response size in bytes",
            [100, 1000, 10000, 100000, 1000000, 10000000],
            ["method", "endpoint"] + self.collector.config.common_labels,
        )

        self.active_connections = self.collector.gauge(
            "active_connections",
            "Number of active connections",
            self.collector.config.common_labels,
        )

        # Error metrics
        self.errors_total = self.collector.counter(
            "errors_total",
            "Total number of errors",
            ["error_type", "component"] + self.collector.config.common_labels,
        )

        self.error_rate = self.collector.gauge(
            "error_rate",
            "Error rate per minute",
            ["error_type", "component"] + self.collector.config.common_labels,
        )

        # Authentication metrics
        self.auth_attempts = self.collector.counter(
            "auth_attempts_total",
            "Total number of authentication attempts",
            ["auth_type", "result"] + self.collector.config.common_labels,
        )

        self.auth_successes = self.collector.counter(
            "auth_successes_total",
            "Total number of successful authentications",
            ["auth_type"] + self.collector.config.common_labels,
        )

        self.auth_failures = self.collector.counter(
            "auth_failures_total",
            "Total number of failed authentications",
            ["auth_type", "failure_reason"] + self.collector.config.common_labels,
        )

        # Document metrics
        self.documents_total = self.collector.counter(
            "documents_total",
            "Total number of documents processed",
            ["operation", "document_type"] + self.collector.config.common_labels,
        )

        self.document_size = self.collector.histogram(
            "document_size_bytes",
            "Document size in bytes",
            [1000, 10000, 100000, 1000000, 10000000, 100000000],
            ["document_type"] + self.collector.config.common_labels,
        )

        self.document_processing_time = self.collector.histogram(
            "document_processing_duration_seconds",
            "Document processing duration in seconds",
            self.collector.config.buckets,
            ["document_type", "operation"] + self.collector.config.common_labels,
        )

        # RAG metrics
        self.rag_queries_total = self.collector.counter(
            "rag_queries_total",
            "Total number of RAG queries",
            ["query_type", "result_type"] + self.collector.config.common_labels,
        )

        self.rag_query_time = self.collector.histogram(
            "rag_query_duration_seconds",
            "RAG query duration in seconds",
            self.collector.config.buckets,
            ["query_type"] + self.collector.config.common_labels,
        )

        self.rag_retrieved_docs = self.collector.histogram(
            "rag_retrieved_documents_count",
            "Number of documents retrieved in RAG queries",
            [1, 5, 10, 25, 50, 100],
            ["query_type"] + self.collector.config.common_labels,
        )

        # Vector database metrics
        self.vector_searches_total = self.collector.counter(
            "vector_searches_total",
            "Total number of vector searches",
            ["search_type", "index_name"] + self.collector.config.common_labels,
        )

        self.vector_search_time = self.collector.histogram(
            "vector_search_duration_seconds",
            "Vector search duration in seconds",
            self.collector.config.buckets,
            ["search_type", "index_name"] + self.collector.config.common_labels,
        )

        self.vector_index_size = self.collector.gauge(
            "vector_index_size",
            "Size of vector index in number of vectors",
            ["index_name"] + self.collector.config.common_labels,
        )

        # Tenant metrics
        self.active_tenants = self.collector.gauge(
            "active_tenants", "Number of active tenants", ["tenant_type"]
        )

        self.tenant_requests = self.collector.counter(
            "tenant_requests_total",
            "Total number of requests per tenant",
            ["tenant_id", "endpoint"] + self.collector.config.common_labels,
        )

        self.tenant_storage = self.collector.gauge(
            "tenant_storage_bytes",
            "Storage usage per tenant in bytes",
            ["tenant_id", "storage_type"] + self.collector.config.common_labels,
        )

        # System metrics
        self.cpu_usage = self.collector.gauge(
            "cpu_usage_percent",
            "CPU usage percentage",
            ["core"] + self.collector.config.common_labels,
        )

        self.memory_usage = self.collector.gauge(
            "memory_usage_bytes",
            "Memory usage in bytes",
            ["memory_type"] + self.collector.config.common_labels,
        )

        self.disk_usage = self.collector.gauge(
            "disk_usage_bytes",
            "Disk usage in bytes",
            ["mount_point"] + self.collector.config.common_labels,
        )

        self.network_io = self.collector.counter(
            "network_io_bytes_total",
            "Network I/O in bytes",
            ["direction", "interface"] + self.collector.config.common_labels,
        )


class SystemMetricsCollector:
    """Collects system-level metrics."""

    def __init__(self, business_metrics: BusinessMetrics, update_interval: int = 30):
        self.business_metrics = business_metrics
        self.update_interval = update_interval
        self._running = False
        self._thread: Optional[Thread] = None

    def start(self):
        """Start collecting system metrics."""
        if self._running:
            return

        self._running = True
        self._thread = Thread(target=self._collect_loop, daemon=True)
        self._thread.start()
        logging.info("System metrics collector started")

    def stop(self):
        """Stop collecting system metrics."""
        self._running = False
        if self._thread:
            self._thread.join()
        logging.info("System metrics collector stopped")

    def _collect_loop(self):
        """Main collection loop."""
        while self._running:
            try:
                self._collect_metrics()
                time.sleep(self.update_interval)
            except Exception as e:
                logging.error(f"Error collecting system metrics: {e}")

    def _collect_metrics(self):
        """Collect all system metrics."""
        # CPU metrics
        cpu_percent = psutil.cpu_percent(interval=1)
        for i, percent in enumerate(psutil.cpu_percent(percpu=True, interval=1)):
            self.business_metrics.cpu_usage.labels(core=str(i)).set(percent)

        # Memory metrics
        memory = psutil.virtual_memory()
        self.business_metrics.memory_usage.labels(memory_type="total").set(memory.total)
        self.business_metrics.memory_usage.labels(memory_type="available").set(
            memory.available
        )
        self.business_metrics.memory_usage.labels(memory_type="used").set(memory.used)
        self.business_metrics.memory_usage.labels(memory_type="percent").set(
            memory.percent
        )

        # Disk metrics
        for partition in psutil.disk_partitions():
            if partition.mountpoint:
                try:
                    usage = psutil.disk_usage(partition.mountpoint)
                    self.business_metrics.disk_usage.labels(
                        mount_point=partition.mountpoint
                    ).set(usage.used)
                except PermissionError:
                    continue

        # Network I/O metrics
        net_io = psutil.net_io_counters()
        self.business_metrics.network_io.labels(
            direction="sent", interface="total"
        )._value._value = net_io.bytes_sent
        self.business_metrics.network_io.labels(
            direction="recv", interface="total"
        )._value._value = net_io.bytes_recv


class MetricsMiddleware:
    """Middleware for automatic HTTP request metrics collection."""

    def __init__(self, business_metrics: BusinessMetrics):
        self.business_metrics = business_metrics

    def __call__(self, app):
        """WSGI middleware for collecting HTTP metrics."""

        def middleware(environ, start_response):
            start_time = time.time()

            # Capture original start_response
            captured_status = [None]

            def new_start_response(status, headers, exc_info=None):
                captured_status[0] = status
                return start_response(status, headers, exc_info)

            # Process request
            response = app(environ, new_start_response)

            # Calculate metrics
            duration = time.time() - start_time
            method = environ.get("REQUEST_METHOD", "unknown")
            path = environ.get("PATH_INFO", "unknown")
            status_code = (
                captured_status[0].split()[0] if captured_status[0] else "unknown"
            )

            # Record metrics
            self.business_metrics.requests_total.labels(
                method=method, endpoint=path, status_code=status_code
            ).inc()

            self.business_metrics.request_duration.labels(
                method=method, endpoint=path
            ).observe(duration)

            # Get response size if available
            if hasattr(response, "__len__"):
                response_size = len(response)
                self.business_metrics.response_size.labels(
                    method=method, endpoint=path
                ).observe(response_size)

            return response

        return middleware


# Decorators for automatic metrics collection
def track_time(metric: Histogram, labels: Optional[Dict[str, str]] = None):
    """Decorator to automatically track function execution time."""

    def decorator(func: Callable):
        @wraps(func)
        def wrapper(*args, **kwargs):
            start_time = time.time()
            try:
                result = func(*args, **kwargs)
                return result
            finally:
                duration = time.time() - start_time
                if labels:
                    metric.labels(**labels).observe(duration)
                else:
                    metric.observe(duration)

        return wrapper

    return decorator


def track_calls(metric: Counter, labels: Optional[Dict[str, str]] = None):
    """Decorator to automatically track function calls."""

    def decorator(func: Callable):
        @wraps(func)
        def wrapper(*args, **kwargs):
            if labels:
                metric.labels(**labels).inc()
            else:
                metric.inc()
            return func(*args, **kwargs)

        return wrapper

    return decorator


def track_errors(
    metric: Counter,
    error_type: str = "general",
    labels: Optional[Dict[str, str]] = None,
):
    """Decorator to automatically track function errors."""

    def decorator(func: Callable):
        @wraps(func)
        def wrapper(*args, **kwargs):
            try:
                return func(*args, **kwargs)
            except Exception as e:
                error_labels = {"error_type": error_type, "component": func.__name__}
                if labels:
                    error_labels.update(labels)
                metric.labels(**error_labels).inc()
                raise

        return wrapper

    return decorator


@contextmanager
def track_duration(metric: Histogram, labels: Optional[Dict[str, str]] = None):
    """Context manager for tracking operation duration."""
    start_time = time.time()
    try:
        yield
    finally:
        duration = time.time() - start_time
        if labels:
            metric.labels(**labels).observe(duration)
        else:
            metric.observe(duration)


@contextmanager
def track_operation(
    counter: Counter, histogram: Histogram, labels: Optional[Dict[str, str]] = None
):
    """Context manager for tracking both counter and histogram."""
    start_time = time.time()
    try:
        yield
    finally:
        duration = time.time() - start_time
        if labels:
            counter.labels(**labels).inc()
            histogram.labels(**labels).observe(duration)
        else:
            counter.inc()
            histogram.observe(duration)


# Global metrics collector instance
_global_collector: Optional[MetricsCollector] = None
_global_business_metrics: Optional[BusinessMetrics] = None


def get_metrics_collector() -> MetricsCollector:
    """Get the global metrics collector instance."""
    global _global_collector
    if _global_collector is None:
        _global_collector = MetricsCollector()
    return _global_collector


def get_business_metrics() -> BusinessMetrics:
    """Get the global business metrics instance."""
    global _global_business_metrics
    if _global_business_metrics is None:
        _global_business_metrics = BusinessMetrics(get_metrics_collector())
    return _global_business_metrics


def configure_metrics(config: MetricsConfig):
    """Configure the global metrics collector."""
    global _global_collector, _global_business_metrics
    _global_collector = MetricsCollector(config)
    _global_business_metrics = BusinessMetrics(_global_collector)
