#!/usr/bin/env python3
"""
Metrics Collection and Export

Production-grade metrics system with Prometheus-compatible export.
Supports counters, gauges, histograms, and summaries with labels.

Prometheus formatting lives in metrics_prometheus.py.
"""

import threading
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Optional, Tuple

from src.core.metrics_prometheus import (
    METRIC_DEFINITIONS,  # noqa: F401 - re-export
    export_prometheus_format as _export_prometheus,
    label_key as _label_key,
)


@dataclass
class Metric:
    """Single metric data point."""

    name: str
    value: float
    timestamp: float
    labels: Dict[str, str] = field(default_factory=dict)


class MetricsCollector:
    """Collects and stores metrics with Prometheus-compatible export."""

    METRIC_DEFINITIONS = METRIC_DEFINITIONS

    def __init__(self) -> None:
        self.counters: Dict[Tuple[str, str], float] = defaultdict(float)
        self.counter_labels: Dict[Tuple[str, str], Dict[str, str]] = {}

        self.gauges: Dict[Tuple[str, str], float] = {}
        self.gauge_labels: Dict[Tuple[str, str], Dict[str, str]] = {}

        self.histograms: Dict[Tuple[str, str], List[float]] = defaultdict(list)
        self.histogram_labels: Dict[Tuple[str, str], Dict[str, str]] = {}

        self._lock = threading.Lock()

    def increment(
        self, name: str, value: float = 1.0, labels: Optional[Dict[str, str]] = None
    ) -> None:
        """Increment a counter."""
        lk = _label_key(labels)
        key = (name, lk)
        with self._lock:
            self.counters[key] += value
            if labels:
                self.counter_labels[key] = labels

    def set_gauge(
        self, name: str, value: float, labels: Optional[Dict[str, str]] = None
    ) -> None:
        """Set a gauge value."""
        lk = _label_key(labels)
        key = (name, lk)
        with self._lock:
            self.gauges[key] = value
            if labels:
                self.gauge_labels[key] = labels

    def record_histogram(
        self, name: str, value: float, labels: Optional[Dict[str, str]] = None
    ) -> None:
        """Record a histogram value."""
        lk = _label_key(labels)
        key = (name, lk)
        with self._lock:
            self.histograms[key].append(value)
            if len(self.histograms[key]) > 1000:
                self.histograms[key] = self.histograms[key][-1000:]
            if labels:
                self.histogram_labels[key] = labels

    def record_timing(
        self, name: str, duration: float, labels: Optional[Dict[str, str]] = None
    ) -> None:
        """Record a timing metric (alias for histogram)."""
        self.record_histogram(name, duration, labels)

    # -- Query helpers --

    def get_counters(self) -> Dict[str, float]:
        """Get all counter values."""
        with self._lock:
            result: Dict[str, float] = {}
            for (name, lk), value in self.counters.items():
                if lk:
                    result[f"{name}{{{lk}}}"] = value
                else:
                    result[name] = value
            return result

    def get_gauges(self) -> Dict[str, float]:
        """Get all gauge values."""
        with self._lock:
            result: Dict[str, float] = {}
            for (name, lk), value in self.gauges.items():
                if lk:
                    result[f"{name}{{{lk}}}"] = value
                else:
                    result[name] = value
            return result

    def get_histogram_stats(self, name: str) -> Optional[Dict[str, float]]:
        """Get statistics for a histogram."""
        with self._lock:
            all_values: List[float] = []
            for (n, _lk), vals in self.histograms.items():
                if n == name:
                    all_values.extend(vals)

            if not all_values:
                return None

        sorted_values = sorted(all_values)
        n = len(sorted_values)

        return {
            "count": n,
            "min": sorted_values[0],
            "max": sorted_values[-1],
            "sum": sum(all_values),
            "avg": sum(all_values) / n,
            "p50": sorted_values[n // 2] if n > 0 else 0,
            "p95": sorted_values[int(n * 0.95)] if n > 1 else sorted_values[0],
            "p99": sorted_values[int(n * 0.99)] if n > 1 else sorted_values[0],
        }

    def get_all_metrics(self) -> Dict:
        """Get all metrics in a structured format (JSON-friendly)."""
        with self._lock:
            histogram_names = {n for (n, _lk) in self.histograms.keys()}

        histograms: Dict = {}
        for name in histogram_names:
            histograms[name] = self.get_histogram_stats(name)

        return {
            "counters": self.get_counters(),
            "gauges": self.get_gauges(),
            "histograms": histograms,
            "timestamp": datetime.now().isoformat(),
        }

    def export_prometheus_format(self) -> str:
        """Export metrics in Prometheus text exposition format (v0.0.4)."""
        with self._lock:
            counters_snap = dict(self.counters)
            counter_labels_snap = dict(self.counter_labels)
            gauges_snap = dict(self.gauges)
            gauge_labels_snap = dict(self.gauge_labels)
            histograms_snap = {k: list(v) for k, v in self.histograms.items()}
            histogram_labels_snap = dict(self.histogram_labels)

        return _export_prometheus(
            counters_snap,
            counter_labels_snap,
            gauges_snap,
            gauge_labels_snap,
            histograms_snap,
            histogram_labels_snap,
        )

    def reset(self) -> None:
        """Reset all metrics."""
        with self._lock:
            self.counters.clear()
            self.counter_labels.clear()
            self.gauges.clear()
            self.gauge_labels.clear()
            self.histograms.clear()
            self.histogram_labels.clear()


# Global metrics collector instance
_metrics_collector: Optional[MetricsCollector] = None


def get_metrics_collector() -> MetricsCollector:
    """Get or create global metrics collector."""
    global _metrics_collector
    if _metrics_collector is None:
        _metrics_collector = MetricsCollector()
    return _metrics_collector
