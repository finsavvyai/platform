"""
Cache statistics tracking and analysis.

This module provides comprehensive statistics tracking for the embedding cache
with performance metrics and analytical insights.
"""

import time
from collections import defaultdict, deque
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional


class CacheStats:
    """Comprehensive cache statistics tracker."""

    def __init__(
        self,
        history_size: int = 1000,
        performance_window_seconds: int = 3600,  # 1 hour
    ):
        """
        Initialize cache statistics tracker.

        Args:
            history_size: Size of rolling history window
            performance_window_seconds: Performance analysis window
        """
        self.history_size = history_size
        self.performance_window_seconds = performance_window_seconds

        # Basic counters
        self._hits = 0
        self._misses = 0
        self._sets = 0
        self._deletes = 0
        self._errors = 0
        self._batch_hits = 0
        self._batch_misses = 0
        self._batch_sets = 0

        # Performance tracking
        self._hit_times: deque = deque(maxlen=history_size)
        self._miss_times: deque = deque(maxlen=history_size)
        self._set_times: deque = deque(maxlen=history_size)
        self._batch_times: deque = deque(maxlen=history_size)

        # Size tracking
        self._embedding_sizes: deque = deque(maxlen=history_size)
        self._batch_sizes: deque = deque(maxlen=history_size)

        # Provider/model tracking
        self._provider_stats: Dict[str, Dict[str, Any]] = defaultdict(
            lambda: {
                "hits": 0,
                "misses": 0,
                "sets": 0,
                "total_size": 0,
                "avg_response_time": 0.0,
            }
        )

        # Time-based tracking
        self._hourly_stats: Dict[str, Dict[str, int]] = defaultdict(
            lambda: {
                "hits": 0,
                "misses": 0,
                "sets": 0,
                "errors": 0,
            }
        )

        self._start_time = time.time()
        self._last_reset = time.time()

    def record_hit(
        self, response_time_ms: float, provider: Optional[str] = None
    ) -> None:
        """Record a cache hit."""
        self._hits += 1
        self._hit_times.append(response_time_ms)

        if provider:
            self._provider_stats[provider]["hits"] += 1
            self._update_provider_avg_response_time(provider, response_time_ms)

        self._record_hourly_stat("hits")

    def record_miss(
        self, response_time_ms: float, provider: Optional[str] = None
    ) -> None:
        """Record a cache miss."""
        self._misses += 1
        self._miss_times.append(response_time_ms)

        if provider:
            self._provider_stats[provider]["misses"] += 1
            self._update_provider_avg_response_time(provider, response_time_ms)

        self._record_hourly_stat("misses")

    def record_set(
        self,
        response_time_ms: float,
        embedding_size: int,
        provider: Optional[str] = None,
    ) -> None:
        """Record a cache set operation."""
        self._sets += 1
        self._set_times.append(response_time_ms)
        self._embedding_sizes.append(embedding_size)

        if provider:
            self._provider_stats[provider]["sets"] += 1
            self._provider_stats[provider]["total_size"] += embedding_size
            self._update_provider_avg_response_time(provider, response_time_ms)

        self._record_hourly_stat("sets")

    def record_batch_hit(
        self,
        batch_size: int,
        hit_count: int,
        response_time_ms: float,
        provider: Optional[str] = None,
    ) -> None:
        """Record a batch cache hit."""
        self._batch_hits += hit_count
        self._batch_times.append(response_time_ms)
        self._batch_sizes.append(batch_size)

        if provider:
            self._provider_stats[provider]["hits"] += hit_count
            self._update_provider_avg_response_time(provider, response_time_ms)

        # Also record as individual hits for consistency
        for _ in range(hit_count):
            self._record_hourly_stat("hits")

    def record_batch_miss(
        self, batch_size: int, response_time_ms: float, provider: Optional[str] = None
    ) -> None:
        """Record a batch cache miss."""
        self._batch_misses += batch_size
        self._batch_times.append(response_time_ms)
        self._batch_sizes.append(batch_size)

        if provider:
            self._provider_stats[provider]["misses"] += batch_size
            self._update_provider_avg_response_time(provider, response_time_ms)

        # Also record as individual misses for consistency
        for _ in range(batch_size):
            self._record_hourly_stat("misses")

    def record_batch_set(
        self,
        batch_size: int,
        total_size: int,
        response_time_ms: float,
        provider: Optional[str] = None,
    ) -> None:
        """Record a batch cache set operation."""
        self._batch_sets += batch_size
        self._batch_times.append(response_time_ms)
        self._embedding_sizes.append(total_size)

        if provider:
            self._provider_stats[provider]["sets"] += batch_size
            self._provider_stats[provider]["total_size"] += total_size
            self._update_provider_avg_response_time(provider, response_time_ms)

        # Also record as individual sets for consistency
        for _ in range(batch_size):
            self._record_hourly_stat("sets")

    def record_error(self) -> None:
        """Record a cache error."""
        self._errors += 1
        self._record_hourly_stat("errors")

    def _update_provider_avg_response_time(
        self, provider: str, response_time_ms: float
    ) -> None:
        """Update average response time for a provider."""
        provider_stats = self._provider_stats[provider]
        current_avg = provider_stats["avg_response_time"]
        total_requests = provider_stats["hits"] + provider_stats["misses"]

        if total_requests == 1:
            provider_stats["avg_response_time"] = response_time_ms
        else:
            # Rolling average
            provider_stats["avg_response_time"] = (
                current_avg * (total_requests - 1) + response_time_ms
            ) / total_requests

    def _record_hourly_stat(self, stat_type: str) -> None:
        """Record a statistic in the hourly bucket."""
        current_hour = datetime.utcnow().strftime("%Y-%m-%d-%H")
        self._hourly_stats[current_hour][stat_type] += 1

    def get_hit_rate(self) -> float:
        """Get cache hit rate."""
        total_requests = self._hits + self._misses
        return self._hits / total_requests if total_requests > 0 else 0.0

    def get_miss_rate(self) -> float:
        """Get cache miss rate."""
        return 1.0 - self.get_hit_rate()

    def get_error_rate(self) -> float:
        """Get cache error rate."""
        total_operations = self._hits + self._misses + self._sets + self._deletes
        return self._errors / total_operations if total_operations > 0 else 0.0

    def get_average_response_time(self) -> Dict[str, float]:
        """Get average response times by operation type."""
        result = {}

        if self._hit_times:
            result["hit"] = sum(self._hit_times) / len(self._hit_times)

        if self._miss_times:
            result["miss"] = sum(self._miss_times) / len(self._miss_times)

        if self._set_times:
            result["set"] = sum(self._set_times) / len(self._set_times)

        if self._batch_times:
            result["batch"] = sum(self._batch_times) / len(self._batch_times)

        return result

    def get_percentile_response_times(
        self, percentiles: List[int] = None
    ) -> Dict[str, Dict[int, float]]:
        """Get percentile response times by operation type."""
        if percentiles is None:
            percentiles = [50, 90, 95, 99]

        result = {}

        if self._hit_times:
            hit_times_sorted = sorted(self._hit_times)
            result["hit"] = {
                p: hit_times_sorted[int(len(hit_times_sorted) * p / 100)]
                for p in percentiles
            }

        if self._miss_times:
            miss_times_sorted = sorted(self._miss_times)
            result["miss"] = {
                p: miss_times_sorted[int(len(miss_times_sorted) * p / 100)]
                for p in percentiles
            }

        if self._set_times:
            set_times_sorted = sorted(self._set_times)
            result["set"] = {
                p: set_times_sorted[int(len(set_times_sorted) * p / 100)]
                for p in percentiles
            }

        return result

    def get_average_embedding_size(self) -> float:
        """Get average embedding size."""
        if not self._embedding_sizes:
            return 0.0
        return sum(self._embedding_sizes) / len(self._embedding_sizes)

    def get_provider_stats(self) -> Dict[str, Dict[str, Any]]:
        """Get statistics by provider."""
        result = {}

        for provider, stats in self._provider_stats.items():
            total_requests = stats["hits"] + stats["misses"]
            hit_rate = stats["hits"] / total_requests if total_requests > 0 else 0.0

            result[provider] = {
                **stats,
                "hit_rate": hit_rate,
                "total_requests": total_requests,
                "average_embedding_size": (
                    stats["total_size"] / stats["sets"] if stats["sets"] > 0 else 0.0
                ),
            }

        return result

    def get_hourly_stats(self, hours: int = 24) -> Dict[str, Dict[str, int]]:
        """Get hourly statistics for the last N hours."""
        result = {}
        current_time = datetime.utcnow()

        for i in range(hours):
            hour_time = current_time - timedelta(hours=i)
            hour_key = hour_time.strftime("%Y-%m-%d-%H")
            result[hour_key] = dict(self._hourly_stats.get(hour_key, {}))

        return result

    def get_performance_summary(self) -> Dict[str, Any]:
        """Get comprehensive performance summary."""
        current_time = time.time()
        uptime_seconds = current_time - self._start_time

        avg_response_times = self.get_average_response_time()
        percentile_response_times = self.get_percentile_response_times()

        return {
            "uptime_seconds": uptime_seconds,
            "uptime_hours": uptime_seconds / 3600,
            # Basic metrics
            "total_hits": self._hits,
            "total_misses": self._misses,
            "total_sets": self._sets,
            "total_deletes": self._deletes,
            "total_errors": self._errors,
            # Batch metrics
            "total_batch_hits": self._batch_hits,
            "total_batch_misses": self._batch_misses,
            "total_batch_sets": self._batch_sets,
            # Rates
            "hit_rate": self.get_hit_rate(),
            "miss_rate": self.get_miss_rate(),
            "error_rate": self.get_error_rate(),
            # Performance
            "average_response_times_ms": avg_response_times,
            "percentile_response_times_ms": percentile_response_times,
            # Size metrics
            "average_embedding_size": self.get_average_embedding_size(),
            # Provider breakdown
            "provider_stats": self.get_provider_stats(),
            # Request rates
            "requests_per_second": (self._hits + self._misses) / uptime_seconds,
            "sets_per_second": self._sets / uptime_seconds,
            # History metrics
            "recent_hit_rate": self._get_recent_hit_rate(),
            "recent_error_rate": self._get_recent_error_rate(),
        }

    def _get_recent_hit_rate(self, window_size: int = 100) -> float:
        """Get hit rate for recent operations."""
        recent_hits = sum(1 for _ in list(self._hit_times)[-window_size:])
        recent_misses = sum(1 for _ in list(self._miss_times)[-window_size:])

        total_recent = recent_hits + recent_misses
        return recent_hits / total_recent if total_recent > 0 else 0.0

    def _get_recent_error_rate(self, window_size: int = 100) -> float:
        """Get error rate for recent operations."""
        # This is a simplified calculation
        total_operations = (
            len(list(self._hit_times)[-window_size:])
            + len(list(self._miss_times)[-window_size:])
            + len(list(self._set_times)[-window_size:])
        )

        return min(self._errors / max(total_operations, 1), 1.0)

    def reset(self) -> None:
        """Reset all statistics."""
        self._hits = 0
        self._misses = 0
        self._sets = 0
        self._deletes = 0
        self._errors = 0
        self._batch_hits = 0
        self._batch_misses = 0
        self._batch_sets = 0

        self._hit_times.clear()
        self._miss_times.clear()
        self._set_times.clear()
        self._batch_times.clear()
        self._embedding_sizes.clear()
        self._batch_sizes.clear()

        self._provider_stats.clear()
        self._hourly_stats.clear()

        self._start_time = time.time()
        self._last_reset = time.time()

    def to_dict(self) -> Dict[str, Any]:
        """Convert statistics to dictionary."""
        return self.get_performance_summary()

    def export_to_dict(self) -> Dict[str, Any]:
        """Export all raw data for analysis."""
        return {
            "counters": {
                "hits": self._hits,
                "misses": self._misses,
                "sets": self._sets,
                "deletes": self._deletes,
                "errors": self._errors,
                "batch_hits": self._batch_hits,
                "batch_misses": self._batch_misses,
                "batch_sets": self._batch_sets,
            },
            "performance_times": {
                "hit_times": list(self._hit_times),
                "miss_times": list(self._miss_times),
                "set_times": list(self._set_times),
                "batch_times": list(self._batch_times),
            },
            "sizes": {
                "embedding_sizes": list(self._embedding_sizes),
                "batch_sizes": list(self._batch_sizes),
            },
            "provider_stats": dict(self._provider_stats),
            "hourly_stats": dict(self._hourly_stats),
            "metadata": {
                "start_time": self._start_time,
                "last_reset": self._last_reset,
                "history_size": self.history_size,
                "performance_window_seconds": self.performance_window_seconds,
            },
        }
