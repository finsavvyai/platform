#!/usr/bin/env python3
"""
Backend models and circuit breaker for the mesh router.

Sprint 17 — Tasks 17.1, 17.9
Extracted from mesh_router.py.
"""

import logging
import time
from collections import deque
from enum import Enum
from typing import Any, Dict, List, Optional

logger = logging.getLogger("finsavvyai.routing")


class BackendType(str, Enum):
    LOCAL = "local"
    OPENCLAW = "openclaw"
    REMOTE = "remote"


class BackendStatus(str, Enum):
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    DOWN = "down"
    CIRCUIT_OPEN = "circuit_open"


class Backend:
    """Represents a single inference backend."""

    def __init__(
        self,
        backend_id: str,
        backend_type: BackendType,
        url: str,
        capabilities: Optional[List[str]] = None,
        cost_per_token: float = 0.0,
    ):
        self.backend_id = backend_id
        self.backend_type = backend_type
        self.url = url
        self.capabilities = capabilities or ["text", "chat"]
        self.cost_per_token = cost_per_token
        self.status = BackendStatus.HEALTHY
        self._latencies: deque = deque(maxlen=50)
        self._quality_scores: deque = deque(maxlen=50)
        self._error_count = 0
        self._success_count = 0
        self._total_cost = 0.0

    def record_latency(self, latency_ms: float) -> None:
        self._latencies.append(latency_ms)

    def record_quality(self, score: float) -> None:
        """Score from 0.0 to 1.0 (Task 17.8)."""
        self._quality_scores.append(score)

    def record_success(self) -> None:
        self._success_count += 1

    def record_error(self) -> None:
        self._error_count += 1

    @property
    def avg_latency(self) -> float:
        return (
            sum(self._latencies) / len(self._latencies)
            if self._latencies
            else float("inf")
        )

    @property
    def avg_quality(self) -> float:
        return (
            sum(self._quality_scores) / len(self._quality_scores)
            if self._quality_scores
            else 0.5
        )

    @property
    def success_rate(self) -> float:
        total = self._success_count + self._error_count
        return self._success_count / total if total > 0 else 1.0

    def has_capability(self, cap: str) -> bool:
        return cap in self.capabilities

    def to_dict(self) -> Dict[str, Any]:
        return {
            "backend_id": self.backend_id,
            "type": self.backend_type.value,
            "url": self.url,
            "status": self.status.value,
            "capabilities": self.capabilities,
            "cost_per_token": self.cost_per_token,
            "avg_latency_ms": (
                round(self.avg_latency, 2) if self._latencies else None
            ),
            "avg_quality": round(self.avg_quality, 3),
            "success_rate": round(self.success_rate, 3),
            "total_requests": self._success_count + self._error_count,
        }


class CircuitBreaker:
    """Per-backend circuit breaker to isolate failures (Task 17.9)."""

    def __init__(
        self,
        failure_threshold: int = 5,
        recovery_timeout: float = 60.0,
    ):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self._failures: Dict[str, int] = {}
        self._open_since: Dict[str, float] = {}

    def record_failure(self, backend_id: str) -> None:
        self._failures[backend_id] = self._failures.get(backend_id, 0) + 1
        if self._failures[backend_id] >= self.failure_threshold:
            self._open_since[backend_id] = time.monotonic()
            logger.warning("Circuit OPEN for backend %s", backend_id)

    def record_success(self, backend_id: str) -> None:
        self._failures[backend_id] = 0
        self._open_since.pop(backend_id, None)

    def is_open(self, backend_id: str) -> bool:
        if backend_id not in self._open_since:
            return False
        elapsed = time.monotonic() - self._open_since[backend_id]
        if elapsed >= self.recovery_timeout:
            return False
        return True

    def is_half_open(self, backend_id: str) -> bool:
        if backend_id not in self._open_since:
            return False
        elapsed = time.monotonic() - self._open_since[backend_id]
        return elapsed >= self.recovery_timeout

    def get_state(self, backend_id: str) -> str:
        if backend_id not in self._open_since:
            return "closed"
        elapsed = time.monotonic() - self._open_since[backend_id]
        if elapsed >= self.recovery_timeout:
            return "half_open"
        return "open"

    def reset(self, backend_id: str) -> None:
        self._failures.pop(backend_id, None)
        self._open_since.pop(backend_id, None)
