"""
Agent Booster: Fast PII Detection Metrics.

Tracks fast-path vs LLM-path usage ratio, detection latency,
and per-pattern hit rates for observability.
"""

import logging
import threading
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class BoosterMetricsSnapshot:
    """Point-in-time snapshot of Agent Booster metrics."""

    fast_path_count: int = 0
    llm_fallback_count: int = 0
    total_requests: int = 0
    fast_path_ratio: float = 0.0
    avg_fast_path_latency_us: float = 0.0
    avg_llm_fallback_latency_us: float = 0.0
    pattern_hit_counts: dict[str, int] = field(default_factory=dict)
    errors: int = 0


class BoosterMetrics:
    """Thread-safe metrics collector for Agent Booster."""

    def __init__(self):
        self._lock = threading.Lock()
        self._fast_path_count = 0
        self._llm_fallback_count = 0
        self._fast_path_total_us = 0.0
        self._llm_fallback_total_us = 0.0
        self._pattern_hits: dict[str, int] = defaultdict(int)
        self._errors = 0

    def record_fast_path(
        self, latency_us: float, patterns_matched: list[str]
    ) -> None:
        """Record a successful fast-path detection."""
        with self._lock:
            self._fast_path_count += 1
            self._fast_path_total_us += latency_us
            for pattern in patterns_matched:
                self._pattern_hits[pattern] += 1

    def record_llm_fallback(self, latency_us: float) -> None:
        """Record a fallback to LLM-based detection."""
        with self._lock:
            self._llm_fallback_count += 1
            self._llm_fallback_total_us += latency_us

    def record_error(self) -> None:
        """Record a detection error."""
        with self._lock:
            self._errors += 1

    def snapshot(self) -> BoosterMetricsSnapshot:
        """Get a point-in-time metrics snapshot."""
        with self._lock:
            total = self._fast_path_count + self._llm_fallback_count
            ratio = (
                self._fast_path_count / total if total > 0 else 0.0
            )
            avg_fast = (
                self._fast_path_total_us / self._fast_path_count
                if self._fast_path_count > 0
                else 0.0
            )
            avg_llm = (
                self._llm_fallback_total_us / self._llm_fallback_count
                if self._llm_fallback_count > 0
                else 0.0
            )
            return BoosterMetricsSnapshot(
                fast_path_count=self._fast_path_count,
                llm_fallback_count=self._llm_fallback_count,
                total_requests=total,
                fast_path_ratio=ratio,
                avg_fast_path_latency_us=avg_fast,
                avg_llm_fallback_latency_us=avg_llm,
                pattern_hit_counts=dict(self._pattern_hits),
                errors=self._errors,
            )

    def reset(self) -> None:
        """Reset all metrics counters."""
        with self._lock:
            self._fast_path_count = 0
            self._llm_fallback_count = 0
            self._fast_path_total_us = 0.0
            self._llm_fallback_total_us = 0.0
            self._pattern_hits.clear()
            self._errors = 0

    def to_dict(self) -> dict[str, Any]:
        """Export metrics as a dictionary for API responses."""
        snap = self.snapshot()
        return {
            "agent_booster": {
                "fast_path_count": snap.fast_path_count,
                "llm_fallback_count": snap.llm_fallback_count,
                "total_requests": snap.total_requests,
                "fast_path_ratio": round(snap.fast_path_ratio, 4),
                "avg_fast_path_latency_us": round(
                    snap.avg_fast_path_latency_us, 2
                ),
                "avg_llm_fallback_latency_us": round(
                    snap.avg_llm_fallback_latency_us, 2
                ),
                "pattern_hit_counts": snap.pattern_hit_counts,
                "errors": snap.errors,
            }
        }
