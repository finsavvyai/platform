"""
Observability System.

Comprehensive observability system with distributed tracing, log aggregation,
APM integration, and performance monitoring for the Universal Dependency Platform.
"""

import logging
import threading
import time
import uuid
from collections import defaultdict, deque
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any, Optional

logger = logging.getLogger(__name__)


@dataclass
class TraceSpan:
    """Distributed tracing span."""
    id: str
    trace_id: str
    parent_id: Optional[str]
    operation_name: str
    start_time: datetime
    end_time: Optional[datetime] = None
    duration: Optional[float] = None
    tags: dict[str, str] = field(default_factory=dict)
    logs: list[dict[str, Any]] = field(default_factory=list)
    status: str = "started"  # "started", "finished", "error"
    error_message: Optional[str] = None


@dataclass
class LogEntry:
    """Structured log entry."""
    id: str
    timestamp: datetime
    level: str
    message: str
    service: str
    trace_id: Optional[str] = None
    span_id: Optional[str] = None
    tags: dict[str, str] = field(default_factory=dict)
    metadata: dict[str, Any] = field(default_factory=dict)
    exception: Optional[str] = None


@dataclass
class PerformanceMetric:
    """Performance metric."""
    name: str
    value: float
    timestamp: datetime
    service: str
    operation: str
    tags: dict[str, str] = field(default_factory=dict)
    metadata: dict[str, Any] = field(default_factory=dict)


class DistributedTracing:
    """Distributed tracing system."""

    def __init__(self):
        self.active_spans: dict[str, TraceSpan] = {}
        self.completed_spans: deque = deque(maxlen=10000)
        self.traces: dict[str, list[TraceSpan]] = defaultdict(list)
        self._lock = threading.Lock()

    def start_span(self, operation_name: str, trace_id: str = None,
                   parent_id: str = None, tags: dict[str, str] = None) -> str:
        """Start a new trace span."""
        span_id = str(uuid.uuid4())

        if not trace_id:
            trace_id = str(uuid.uuid4())

        span = TraceSpan(
            id=span_id,
            trace_id=trace_id,
            parent_id=parent_id,
            operation_name=operation_name,
            start_time=datetime.utcnow(),
            tags=tags or {}
        )

        with self._lock:
            self.active_spans[span_id] = span
            self.traces[trace_id].append(span)

        logger.debug(f"Started span {span_id} for operation {operation_name}")
        return span_id

    def finish_span(self, span_id: str, status: str = "finished",
                   error_message: str = None, tags: dict[str, str] = None):
        """Finish a trace span."""
        with self._lock:
            if span_id not in self.active_spans:
                logger.warning(f"Span {span_id} not found")
                return

            span = self.active_spans[span_id]
            span.end_time = datetime.utcnow()
            span.duration = (span.end_time - span.start_time).total_seconds()
            span.status = status
            span.error_message = error_message

            if tags:
                span.tags.update(tags)

            # Move to completed spans
            self.completed_spans.append(span)
            del self.active_spans[span_id]

        logger.debug(f"Finished span {span_id} with status {status}")

    def add_span_log(self, span_id: str, message: str, level: str = "info",
                    fields: dict[str, Any] = None):
        """Add a log entry to a span."""
        with self._lock:
            if span_id in self.active_spans:
                span = self.active_spans[span_id]
                log_entry = {
                    "timestamp": datetime.utcnow().isoformat(),
                    "level": level,
                    "message": message,
                    "fields": fields or {}
                }
                span.logs.append(log_entry)

    def add_span_tag(self, span_id: str, key: str, value: str):
        """Add a tag to a span."""
        with self._lock:
            if span_id in self.active_spans:
                self.active_spans[span_id].tags[key] = value

    def get_trace(self, trace_id: str) -> list[TraceSpan]:
        """Get all spans for a trace."""
        with self._lock:
            return self.traces.get(trace_id, []).copy()

    def get_span(self, span_id: str) -> Optional[TraceSpan]:
        """Get a specific span."""
        with self._lock:
            if span_id in self.active_spans:
                return self.active_spans[span_id]

            # Search in completed spans
            for span in self.completed_spans:
                if span.id == span_id:
                    return span

            return None

    def get_active_spans(self) -> list[TraceSpan]:
        """Get all active spans."""
        with self._lock:
            return list(self.active_spans.values())

    def get_recent_spans(self, duration_seconds: int = 300) -> list[TraceSpan]:
        """Get recent completed spans."""
        cutoff_time = datetime.utcnow() - timedelta(seconds=duration_seconds)

        with self._lock:
            return [
                span for span in self.completed_spans
                if span.end_time and span.end_time >= cutoff_time
            ]

    def get_trace_statistics(self) -> dict[str, Any]:
        """Get trace statistics."""
        with self._lock:
            active_count = len(self.active_spans)
            completed_count = len(self.completed_spans)
            trace_count = len(self.traces)

            # Calculate average duration
            durations = [span.duration for span in self.completed_spans if span.duration]
            avg_duration = sum(durations) / len(durations) if durations else 0

            # Count by status
            status_counts = defaultdict(int)
            for span in self.completed_spans:
                status_counts[span.status] += 1

            return {
                "active_spans": active_count,
                "completed_spans": completed_count,
                "total_traces": trace_count,
                "average_duration": avg_duration,
                "status_breakdown": dict(status_counts)
            }


class LogAggregator:
    """Log aggregation and processing system."""

    def __init__(self, max_entries: int = 100000):
        self.logs: deque = deque(maxlen=max_entries)
        self.log_levels = ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]
        self.services = set()
        self._lock = threading.Lock()
        self._setup_logging()

    def _setup_logging(self):
        """Setup logging integration."""
        # Add custom log handler
        handler = LogHandler(self)
        handler.setLevel(logging.DEBUG)

        # Add to root logger
        root_logger = logging.getLogger()
        root_logger.addHandler(handler)

    def add_log(self, level: str, message: str, service: str = "unknown",
                trace_id: str = None, span_id: str = None,
                tags: dict[str, str] = None, metadata: dict[str, Any] = None,
                exception: Exception = None):
        """Add a log entry."""
        log_entry = LogEntry(
            id=str(uuid.uuid4()),
            timestamp=datetime.utcnow(),
            level=level.upper(),
            message=message,
            service=service,
            trace_id=trace_id,
            span_id=span_id,
            tags=tags or {},
            metadata=metadata or {},
            exception=str(exception) if exception else None
        )

        with self._lock:
            self.logs.append(log_entry)
            self.services.add(service)

    def get_logs(self, service: str = None, level: str = None,
                trace_id: str = None, duration_seconds: int = 3600) -> list[LogEntry]:
        """Get filtered logs."""
        cutoff_time = datetime.utcnow() - timedelta(seconds=duration_seconds)

        with self._lock:
            filtered_logs = []
            for log in self.logs:
                if log.timestamp < cutoff_time:
                    continue

                if service and log.service != service:
                    continue

                if level and log.level != level.upper():
                    continue

                if trace_id and log.trace_id != trace_id:
                    continue

                filtered_logs.append(log)

        return filtered_logs

    def get_log_statistics(self) -> dict[str, Any]:
        """Get log statistics."""
        with self._lock:
            total_logs = len(self.logs)

            # Count by level
            level_counts = defaultdict(int)
            service_counts = defaultdict(int)

            for log in self.logs:
                level_counts[log.level] += 1
                service_counts[log.service] += 1

            return {
                "total_logs": total_logs,
                "level_breakdown": dict(level_counts),
                "service_breakdown": dict(service_counts),
                "services": list(self.services)
            }

    def search_logs(self, query: str, service: str = None,
                   level: str = None, duration_seconds: int = 3600) -> list[LogEntry]:
        """Search logs by text query."""
        logs = self.get_logs(service, level, duration_seconds=duration_seconds)

        # Simple text search
        query_lower = query.lower()
        matching_logs = []

        for log in logs:
            if (query_lower in log.message.lower() or
                any(query_lower in str(value).lower() for value in log.tags.values()) or
                any(query_lower in str(value).lower() for value in log.metadata.values())):
                matching_logs.append(log)

        return matching_logs


class LogHandler(logging.Handler):
    """Custom log handler for integration with LogAggregator."""

    def __init__(self, aggregator: LogAggregator):
        super().__init__()
        self.aggregator = aggregator

    def emit(self, record):
        """Emit a log record."""
        try:
            # Extract service name from logger name
            service = record.name.split('.')[0] if '.' in record.name else record.name

            # Extract trace and span IDs from record
            trace_id = getattr(record, 'trace_id', None)
            span_id = getattr(record, 'span_id', None)

            # Extract tags and metadata
            tags = getattr(record, 'tags', {})
            metadata = getattr(record, 'metadata', {})

            # Add standard fields
            metadata.update({
                'filename': record.filename,
                'lineno': record.lineno,
                'funcName': record.funcName,
                'module': record.module
            })

            # Handle exceptions
            exception = None
            if record.exc_info:
                exception = self.formatException(record.exc_info)

            self.aggregator.add_log(
                level=record.levelname,
                message=record.getMessage(),
                service=service,
                trace_id=trace_id,
                span_id=span_id,
                tags=tags,
                metadata=metadata,
                exception=exception
            )
        except Exception:
            self.handleError(record)


class APMTracer:
    """Application Performance Monitoring tracer."""

    def __init__(self, tracing: DistributedTracing, log_aggregator: LogAggregator):
        self.tracing = tracing
        self.log_aggregator = log_aggregator
        self.performance_metrics: deque = deque(maxlen=10000)
        self._lock = threading.Lock()

    def trace_function(self, operation_name: str = None, service: str = "unknown"):
        """Decorator for tracing function execution."""
        def decorator(func):
            def wrapper(*args, **kwargs):
                op_name = operation_name or f"{func.__module__}.{func.__name__}"
                span_id = self.tracing.start_span(op_name, tags={"service": service})

                try:
                    start_time = time.time()
                    result = func(*args, **kwargs)
                    duration = time.time() - start_time

                    # Record performance metric
                    self._record_performance_metric(
                        name=f"{op_name}_duration",
                        value=duration,
                        service=service,
                        operation=op_name
                    )

                    self.tracing.finish_span(span_id, "finished")
                    return result

                except Exception as e:
                    duration = time.time() - start_time
                    self.tracing.finish_span(span_id, "error", str(e))
                    self.log_aggregator.add_log(
                        level="ERROR",
                        message=f"Error in {op_name}: {str(e)}",
                        service=service,
                        span_id=span_id,
                        exception=e
                    )
                    raise

            return wrapper
        return decorator

    def trace_async_function(self, operation_name: str = None, service: str = "unknown"):
        """Decorator for tracing async function execution."""
        def decorator(func):
            async def wrapper(*args, **kwargs):
                op_name = operation_name or f"{func.__module__}.{func.__name__}"
                span_id = self.tracing.start_span(op_name, tags={"service": service})

                try:
                    start_time = time.time()
                    result = await func(*args, **kwargs)
                    duration = time.time() - start_time

                    # Record performance metric
                    self._record_performance_metric(
                        name=f"{op_name}_duration",
                        value=duration,
                        service=service,
                        operation=op_name
                    )

                    self.tracing.finish_span(span_id, "finished")
                    return result

                except Exception as e:
                    duration = time.time() - start_time
                    self.tracing.finish_span(span_id, "error", str(e))
                    self.log_aggregator.add_log(
                        level="ERROR",
                        message=f"Error in {op_name}: {str(e)}",
                        service=service,
                        span_id=span_id,
                        exception=e
                    )
                    raise

            return wrapper
        return decorator

    def _record_performance_metric(self, name: str, value: float, service: str, operation: str):
        """Record a performance metric."""
        metric = PerformanceMetric(
            name=name,
            value=value,
            timestamp=datetime.utcnow(),
            service=service,
            operation=operation
        )

        with self._lock:
            self.performance_metrics.append(metric)

    def get_performance_metrics(self, service: str = None, operation: str = None,
                              duration_seconds: int = 3600) -> list[PerformanceMetric]:
        """Get performance metrics."""
        cutoff_time = datetime.utcnow() - timedelta(seconds=duration_seconds)

        with self._lock:
            filtered_metrics = []
            for metric in self.performance_metrics:
                if metric.timestamp < cutoff_time:
                    continue

                if service and metric.service != service:
                    continue

                if operation and metric.operation != operation:
                    continue

                filtered_metrics.append(metric)

        return filtered_metrics

    def get_performance_summary(self, service: str = None, operation: str = None,
                              duration_seconds: int = 3600) -> dict[str, Any]:
        """Get performance summary statistics."""
        metrics = self.get_performance_metrics(service, operation, duration_seconds)

        if not metrics:
            return {}

        values = [metric.value for metric in metrics]

        return {
            "count": len(values),
            "min": min(values),
            "max": max(values),
            "avg": sum(values) / len(values),
            "p95": self._percentile(values, 95),
            "p99": self._percentile(values, 99)
        }

    def _percentile(self, values: list[float], percentile: int) -> float:
        """Calculate percentile of values."""
        if not values:
            return 0.0

        sorted_values = sorted(values)
        index = int((percentile / 100.0) * len(sorted_values))
        return sorted_values[min(index, len(sorted_values) - 1)]


class ObservabilityManager:
    """Main observability management system."""

    def __init__(self):
        self.tracing = DistributedTracing()
        self.log_aggregator = LogAggregator()
        self.apm_tracer = APMTracer(self.tracing, self.log_aggregator)
        self.is_running = False

    async def start(self):
        """Start observability system."""
        self.is_running = True
        logger.info("Started observability system")

    async def stop(self):
        """Stop observability system."""
        self.is_running = False
        logger.info("Stopped observability system")

    def get_observability_summary(self) -> dict[str, Any]:
        """Get comprehensive observability summary."""
        return {
            "tracing": self.tracing.get_trace_statistics(),
            "logging": self.log_aggregator.get_log_statistics(),
            "performance": {
                "total_metrics": len(self.apm_tracer.performance_metrics),
                "recent_metrics": len(self.apm_tracer.get_performance_metrics(duration_seconds=300))
            },
            "system_status": "running" if self.is_running else "stopped"
        }

    def get_service_health(self, service: str) -> dict[str, Any]:
        """Get health information for a specific service."""
        # Get recent logs
        recent_logs = self.log_aggregator.get_logs(service=service, duration_seconds=300)
        error_logs = [log for log in recent_logs if log.level in ["ERROR", "CRITICAL"]]

        # Get performance metrics
        performance_summary = self.apm_tracer.get_performance_summary(service=service, duration_seconds=300)

        # Get active spans
        active_spans = [span for span in self.tracing.get_active_spans()
                       if span.tags.get("service") == service]

        return {
            "service": service,
            "status": "healthy" if len(error_logs) == 0 else "degraded",
            "error_count": len(error_logs),
            "active_operations": len(active_spans),
            "performance": performance_summary,
            "recent_errors": [
                {
                    "timestamp": log.timestamp.isoformat(),
                    "message": log.message,
                    "level": log.level
                }
                for log in error_logs[-5:]  # Last 5 errors
            ]
        }

    def get_trace_analysis(self, trace_id: str) -> dict[str, Any]:
        """Get detailed trace analysis."""
        spans = self.tracing.get_trace(trace_id)

        if not spans:
            return {"error": "Trace not found"}

        # Calculate trace statistics
        total_duration = max(span.duration or 0 for span in spans)
        span_count = len(spans)
        error_count = len([span for span in spans if span.status == "error"])

        # Build span hierarchy
        span_map = {span.id: span for span in spans}
        root_spans = [span for span in spans if not span.parent_id]

        def build_span_tree(span):
            children = [s for s in spans if s.parent_id == span.id]
            return {
                "span": span,
                "children": [build_span_tree(child) for child in children]
            }

        span_tree = [build_span_tree(span) for span in root_spans]

        return {
            "trace_id": trace_id,
            "total_duration": total_duration,
            "span_count": span_count,
            "error_count": error_count,
            "status": "error" if error_count > 0 else "success",
            "span_tree": span_tree,
            "spans": [
                {
                    "id": span.id,
                    "operation": span.operation_name,
                    "duration": span.duration,
                    "status": span.status,
                    "tags": span.tags,
                    "logs": span.logs
                }
                for span in spans
            ]
        }
