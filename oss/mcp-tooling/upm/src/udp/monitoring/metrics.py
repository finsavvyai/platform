"""
Metrics Collection and Export System.

Comprehensive metrics collection, aggregation, and export system with
Prometheus integration, custom metrics, and time series database support.
"""

import logging
import statistics
import threading
import time
from collections import defaultdict, deque
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any, Union

logger = logging.getLogger(__name__)


@dataclass
class MetricPoint:
    """Individual metric data point."""
    name: str
    value: Union[float, int, str]
    timestamp: datetime
    tags: dict[str, str] = field(default_factory=dict)
    labels: dict[str, str] = field(default_factory=dict)


@dataclass
class TimeSeriesData:
    """Time series data container."""
    name: str
    points: list[MetricPoint]
    aggregation_type: str = "none"  # "sum", "avg", "min", "max", "count"


class MetricsCollector:
    """Central metrics collection system."""

    def __init__(self, retention_period: int = 3600):
        self.retention_period = retention_period
        self.metrics: dict[str, deque] = defaultdict(lambda: deque(maxlen=10000))
        self.counters: dict[str, float] = defaultdict(float)
        self.gauges: dict[str, float] = defaultdict(float)
        self.histograms: dict[str, list[float]] = defaultdict(list)
        self.timers: dict[str, list[float]] = defaultdict(list)
        self._lock = threading.Lock()
        self._start_time = time.time()

    def increment_counter(self, name: str, value: float = 1.0, tags: dict[str, str] = None):
        """Increment a counter metric."""
        with self._lock:
            self.counters[name] += value
            self._record_metric(name, self.counters[name], "counter", tags or {})

    def set_gauge(self, name: str, value: float, tags: dict[str, str] = None):
        """Set a gauge metric value."""
        with self._lock:
            self.gauges[name] = value
            self._record_metric(name, value, "gauge", tags or {})

    def record_histogram(self, name: str, value: float, tags: dict[str, str] = None):
        """Record a histogram value."""
        with self._lock:
            self.histograms[name].append(value)
            # Keep only recent values
            if len(self.histograms[name]) > 1000:
                self.histograms[name] = self.histograms[name][-1000:]
            self._record_metric(name, value, "histogram", tags or {})

    def record_timer(self, name: str, duration: float, tags: dict[str, str] = None):
        """Record a timer value."""
        with self._lock:
            self.timers[name].append(duration)
            # Keep only recent values
            if len(self.timers[name]) > 1000:
                self.timers[name] = self.timers[name][-1000:]
            self._record_metric(name, duration, "timer", tags or {})

    def record_custom_metric(self, name: str, value: Union[float, int, str],
                           metric_type: str = "gauge", tags: dict[str, str] = None):
        """Record a custom metric."""
        with self._lock:
            self._record_metric(name, value, metric_type, tags or {})

    def _record_metric(self, name: str, value: Union[float, int, str],
                      metric_type: str, tags: dict[str, str]):
        """Record a metric point."""
        point = MetricPoint(
            name=name,
            value=value,
            timestamp=datetime.utcnow(),
            tags=tags,
            labels={"type": metric_type}
        )

        self.metrics[name].append(point)

    def get_metric(self, name: str, duration_seconds: int = 300) -> list[MetricPoint]:
        """Get metric data for the specified duration."""
        cutoff_time = datetime.utcnow() - timedelta(seconds=duration_seconds)

        with self._lock:
            return [point for point in self.metrics[name] if point.timestamp >= cutoff_time]

    def get_counter_value(self, name: str) -> float:
        """Get current counter value."""
        with self._lock:
            return self.counters.get(name, 0.0)

    def get_gauge_value(self, name: str) -> float:
        """Get current gauge value."""
        with self._lock:
            return self.gauges.get(name, 0.0)

    def get_histogram_stats(self, name: str) -> dict[str, float]:
        """Get histogram statistics."""
        with self._lock:
            values = self.histograms.get(name, [])
            if not values:
                return {}

            return {
                "count": len(values),
                "sum": sum(values),
                "min": min(values),
                "max": max(values),
                "avg": statistics.mean(values),
                "median": statistics.median(values),
                "p95": self._percentile(values, 95),
                "p99": self._percentile(values, 99)
            }

    def get_timer_stats(self, name: str) -> dict[str, float]:
        """Get timer statistics."""
        with self._lock:
            values = self.timers.get(name, [])
            if not values:
                return {}

            return {
                "count": len(values),
                "sum": sum(values),
                "min": min(values),
                "max": max(values),
                "avg": statistics.mean(values),
                "median": statistics.median(values),
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

    def get_all_metrics(self) -> dict[str, Any]:
        """Get all metrics data."""
        with self._lock:
            return {
                "counters": dict(self.counters),
                "gauges": dict(self.gauges),
                "histogram_stats": {
                    name: self.get_histogram_stats(name)
                    for name in self.histograms.keys()
                },
                "timer_stats": {
                    name: self.get_timer_stats(name)
                    for name in self.timers.keys()
                },
                "uptime": time.time() - self._start_time
            }

    def clear_old_metrics(self):
        """Clear old metrics beyond retention period."""
        cutoff_time = datetime.utcnow() - timedelta(seconds=self.retention_period)

        with self._lock:
            for name in list(self.metrics.keys()):
                # Remove old points
                self.metrics[name] = deque(
                    [point for point in self.metrics[name] if point.timestamp >= cutoff_time],
                    maxlen=10000
                )

                # Remove empty metrics
                if not self.metrics[name]:
                    del self.metrics[name]


class PrometheusExporter:
    """Prometheus metrics exporter."""

    def __init__(self, metrics_collector: MetricsCollector):
        self.metrics_collector = metrics_collector

    def export_metrics(self) -> str:
        """Export metrics in Prometheus format."""
        try:
            lines = []

            # Export counters
            for name, value in self.metrics_collector.counters.items():
                lines.append(f"# TYPE {name} counter")
                lines.append(f"{name} {value}")

            # Export gauges
            for name, value in self.metrics_collector.gauges.items():
                lines.append(f"# TYPE {name} gauge")
                lines.append(f"{name} {value}")

            # Export histogram stats
            for name, stats in self.metrics_collector.get_all_metrics()["histogram_stats"].items():
                if stats:
                    lines.append(f"# TYPE {name}_count counter")
                    lines.append(f"{name}_count {stats['count']}")

                    lines.append(f"# TYPE {name}_sum counter")
                    lines.append(f"{name}_sum {stats['sum']}")

                    lines.append(f"# TYPE {name}_avg gauge")
                    lines.append(f"{name}_avg {stats['avg']}")

                    lines.append(f"# TYPE {name}_min gauge")
                    lines.append(f"{name}_min {stats['min']}")

                    lines.append(f"# TYPE {name}_max gauge")
                    lines.append(f"{name}_max {stats['max']}")

                    lines.append(f"# TYPE {name}_p95 gauge")
                    lines.append(f"{name}_p95 {stats['p95']}")

                    lines.append(f"# TYPE {name}_p99 gauge")
                    lines.append(f"{name}_p99 {stats['p99']}")

            # Export timer stats
            for name, stats in self.metrics_collector.get_all_metrics()["timer_stats"].items():
                if stats:
                    lines.append(f"# TYPE {name}_duration_count counter")
                    lines.append(f"{name}_duration_count {stats['count']}")

                    lines.append(f"# TYPE {name}_duration_sum counter")
                    lines.append(f"{name}_duration_sum {stats['sum']}")

                    lines.append(f"# TYPE {name}_duration_avg gauge")
                    lines.append(f"{name}_duration_avg {stats['avg']}")

                    lines.append(f"# TYPE {name}_duration_p95 gauge")
                    lines.append(f"{name}_duration_p95 {stats['p95']}")

                    lines.append(f"# TYPE {name}_duration_p99 gauge")
                    lines.append(f"{name}_duration_p99 {stats['p99']}")

            # Add timestamp
            lines.append(f"# Timestamp: {datetime.utcnow().isoformat()}")

            return "\n".join(lines)

        except Exception as e:
            logger.error(f"Error exporting Prometheus metrics: {e}", exc_info=True)
            return f"# Error exporting metrics: {e}"


class CustomMetrics:
    """Custom application-specific metrics."""

    def __init__(self, metrics_collector: MetricsCollector):
        self.collector = metrics_collector
        self._setup_custom_metrics()

    def _setup_custom_metrics(self):
        """Setup custom metrics."""
        # API metrics
        self.collector.set_gauge("udp_api_requests_total", 0)
        self.collector.set_gauge("udp_api_requests_active", 0)
        self.collector.set_gauge("udp_api_requests_failed", 0)

        # Dependency metrics
        self.collector.set_gauge("udp_dependencies_total", 0)
        self.collector.set_gauge("udp_dependencies_vulnerable", 0)
        self.collector.set_gauge("udp_dependencies_outdated", 0)
        self.collector.set_gauge("udp_dependencies_conflicts", 0)

        # Security metrics
        self.collector.set_gauge("udp_security_vulnerabilities_total", 0)
        self.collector.set_gauge("udp_security_policy_violations", 0)
        self.collector.set_gauge("udp_security_license_violations", 0)

        # Performance metrics
        self.collector.set_gauge("udp_performance_response_time_avg", 0)
        self.collector.set_gauge("udp_performance_throughput", 0)
        self.collector.set_gauge("udp_performance_error_rate", 0)

        # ML metrics
        self.collector.set_gauge("udp_ml_predictions_total", 0)
        self.collector.set_gauge("udp_ml_model_accuracy", 0)
        self.collector.set_gauge("udp_ml_training_time", 0)

        logger.info("Custom metrics initialized")

    def record_api_request(self, endpoint: str, method: str, status_code: int, duration: float):
        """Record API request metrics."""
        tags = {
            "endpoint": endpoint,
            "method": method,
            "status_code": str(status_code)
        }

        self.collector.increment_counter("udp_api_requests_total", 1, tags)
        self.collector.record_timer("udp_api_request_duration", duration, tags)

        if status_code >= 400:
            self.collector.increment_counter("udp_api_requests_failed", 1, tags)

    def record_dependency_scan(self, ecosystem: str, total_deps: int, vulnerable: int, outdated: int):
        """Record dependency scan metrics."""
        tags = {"ecosystem": ecosystem}

        self.collector.set_gauge("udp_dependencies_total", total_deps, tags)
        self.collector.set_gauge("udp_dependencies_vulnerable", vulnerable, tags)
        self.collector.set_gauge("udp_dependencies_outdated", outdated, tags)

    def record_security_event(self, event_type: str, severity: str):
        """Record security event metrics."""
        tags = {
            "event_type": event_type,
            "severity": severity
        }

        self.collector.increment_counter("udp_security_events_total", 1, tags)

        if event_type == "vulnerability":
            self.collector.increment_counter("udp_security_vulnerabilities_total", 1, tags)
        elif event_type == "policy_violation":
            self.collector.increment_counter("udp_security_policy_violations", 1, tags)
        elif event_type == "license_violation":
            self.collector.increment_counter("udp_security_license_violations", 1, tags)

    def record_ml_prediction(self, model_name: str, prediction_type: str, accuracy: float, duration: float):
        """Record ML prediction metrics."""
        tags = {
            "model": model_name,
            "type": prediction_type
        }

        self.collector.increment_counter("udp_ml_predictions_total", 1, tags)
        self.collector.set_gauge("udp_ml_model_accuracy", accuracy, tags)
        self.collector.record_timer("udp_ml_prediction_duration", duration, tags)

    def record_workflow_execution(self, workflow_type: str, status: str, duration: float):
        """Record workflow execution metrics."""
        tags = {
            "workflow_type": workflow_type,
            "status": status
        }

        self.collector.increment_counter("udp_workflows_total", 1, tags)
        self.collector.record_timer("udp_workflow_duration", duration, tags)

    def record_alert(self, alert_type: str, severity: str, channel: str):
        """Record alert metrics."""
        tags = {
            "alert_type": alert_type,
            "severity": severity,
            "channel": channel
        }

        self.collector.increment_counter("udp_alerts_total", 1, tags)


class MetricsAggregator:
    """Metrics aggregation and analysis."""

    def __init__(self, metrics_collector: MetricsCollector):
        self.collector = metrics_collector
        self.aggregation_rules = {}

    def add_aggregation_rule(self, name: str, source_metrics: list[str],
                           aggregation_type: str, interval_seconds: int = 60):
        """Add an aggregation rule."""
        self.aggregation_rules[name] = {
            "source_metrics": source_metrics,
            "aggregation_type": aggregation_type,
            "interval_seconds": interval_seconds,
            "last_aggregation": datetime.utcnow()
        }

    def aggregate_metrics(self) -> dict[str, float]:
        """Perform metric aggregation."""
        aggregated = {}

        for rule_name, rule in self.aggregation_rules.items():
            try:
                # Check if it's time to aggregate
                now = datetime.utcnow()
                time_since_last = (now - rule["last_aggregation"]).total_seconds()

                if time_since_last >= rule["interval_seconds"]:
                    # Get source metrics
                    source_data = []
                    for metric_name in rule["source_metrics"]:
                        points = self.collector.get_metric(metric_name, rule["interval_seconds"])
                        values = [point.value for point in points if isinstance(point.value, (int, float))]
                        source_data.extend(values)

                    # Perform aggregation
                    if source_data:
                        if rule["aggregation_type"] == "sum":
                            aggregated[rule_name] = sum(source_data)
                        elif rule["aggregation_type"] == "avg":
                            aggregated[rule_name] = statistics.mean(source_data)
                        elif rule["aggregation_type"] == "min":
                            aggregated[rule_name] = min(source_data)
                        elif rule["aggregation_type"] == "max":
                            aggregated[rule_name] = max(source_data)
                        elif rule["aggregation_type"] == "count":
                            aggregated[rule_name] = len(source_data)

                    # Update last aggregation time
                    rule["last_aggregation"] = now

            except Exception as e:
                logger.error(f"Error aggregating metrics for rule {rule_name}: {e}")

        return aggregated

    def get_metric_trends(self, metric_name: str, duration_seconds: int = 3600) -> dict[str, float]:
        """Get metric trends and statistics."""
        try:
            points = self.collector.get_metric(metric_name, duration_seconds)
            values = [point.value for point in points if isinstance(point.value, (int, float))]

            if not values:
                return {}

            # Calculate trends
            if len(values) >= 2:
                # Linear trend
                x = list(range(len(values)))
                slope = self._calculate_slope(x, values)

                # Rate of change
                rate_of_change = (values[-1] - values[0]) / len(values) if len(values) > 1 else 0

                return {
                    "count": len(values),
                    "min": min(values),
                    "max": max(values),
                    "avg": statistics.mean(values),
                    "median": statistics.median(values),
                    "std": statistics.stdev(values) if len(values) > 1 else 0,
                    "slope": slope,
                    "rate_of_change": rate_of_change,
                    "first_value": values[0],
                    "last_value": values[-1]
                }
            else:
                return {
                    "count": len(values),
                    "value": values[0] if values else 0
                }

        except Exception as e:
            logger.error(f"Error calculating trends for {metric_name}: {e}")
            return {}

    def _calculate_slope(self, x: list[int], y: list[float]) -> float:
        """Calculate linear regression slope."""
        try:
            n = len(x)
            sum_x = sum(x)
            sum_y = sum(y)
            sum_xy = sum(x[i] * y[i] for i in range(n))
            sum_x2 = sum(x[i] ** 2 for i in range(n))

            slope = (n * sum_xy - sum_x * sum_y) / (n * sum_x2 - sum_x ** 2)
            return slope
        except:
            return 0.0


class TimeSeriesDB:
    """Time series database interface."""

    def __init__(self, metrics_collector: MetricsCollector):
        self.collector = metrics_collector
        self.time_series_data: dict[str, TimeSeriesData] = {}

    def store_metric(self, name: str, value: Union[float, int, str],
                    tags: dict[str, str] = None, aggregation_type: str = "none"):
        """Store a metric in time series format."""
        point = MetricPoint(
            name=name,
            value=value,
            timestamp=datetime.utcnow(),
            tags=tags or {}
        )

        if name not in self.time_series_data:
            self.time_series_data[name] = TimeSeriesData(
                name=name,
                points=[],
                aggregation_type=aggregation_type
            )

        self.time_series_data[name].points.append(point)

        # Keep only recent points
        if len(self.time_series_data[name].points) > 10000:
            self.time_series_data[name].points = self.time_series_data[name].points[-10000:]

    def query_metrics(self, name: str, start_time: datetime, end_time: datetime,
                     tags: dict[str, str] = None) -> list[MetricPoint]:
        """Query metrics from time series database."""
        if name not in self.time_series_data:
            return []

        points = self.time_series_data[name].points

        # Filter by time range
        filtered_points = [
            point for point in points
            if start_time <= point.timestamp <= end_time
        ]

        # Filter by tags
        if tags:
            filtered_points = [
                point for point in filtered_points
                if all(point.tags.get(key) == value for key, value in tags.items())
            ]

        return filtered_points

    def aggregate_time_series(self, name: str, start_time: datetime, end_time: datetime,
                            aggregation_type: str, interval_seconds: int = 60) -> list[dict[str, Any]]:
        """Aggregate time series data."""
        points = self.query_metrics(name, start_time, end_time)

        if not points:
            return []

        # Group points by time intervals
        intervals = {}
        for point in points:
            # Round timestamp to interval
            interval_start = point.timestamp.replace(
                second=(point.timestamp.second // interval_seconds) * interval_seconds,
                microsecond=0
            )

            if interval_start not in intervals:
                intervals[interval_start] = []
            intervals[interval_start].append(point)

        # Aggregate each interval
        aggregated = []
        for interval_start, interval_points in intervals.items():
            values = [point.value for point in interval_points if isinstance(point.value, (int, float))]

            if values:
                if aggregation_type == "sum":
                    value = sum(values)
                elif aggregation_type == "avg":
                    value = statistics.mean(values)
                elif aggregation_type == "min":
                    value = min(values)
                elif aggregation_type == "max":
                    value = max(values)
                elif aggregation_type == "count":
                    value = len(values)
                else:
                    value = values[-1]  # Last value

                aggregated.append({
                    "timestamp": interval_start,
                    "value": value,
                    "count": len(values)
                })

        return sorted(aggregated, key=lambda x: x["timestamp"])

    def get_metric_summary(self, name: str, duration_seconds: int = 3600) -> dict[str, Any]:
        """Get metric summary statistics."""
        end_time = datetime.utcnow()
        start_time = end_time - timedelta(seconds=duration_seconds)

        points = self.query_metrics(name, start_time, end_time)
        values = [point.value for point in points if isinstance(point.value, (int, float))]

        if not values:
            return {"count": 0}

        return {
            "count": len(values),
            "min": min(values),
            "max": max(values),
            "avg": statistics.mean(values),
            "median": statistics.median(values),
            "std": statistics.stdev(values) if len(values) > 1 else 0,
            "first_timestamp": points[0].timestamp if points else None,
            "last_timestamp": points[-1].timestamp if points else None
        }
