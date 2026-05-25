#!/usr/bin/env python3
"""
Mesh router with routing strategies and parallel execution.

Sprint 17 — Tasks 17.1-17.8
Extracted from mesh_router.py.
"""

import logging
from enum import Enum
from typing import Any, Callable, Dict, List, Optional

from src.routing.mesh_backend import Backend, BackendStatus, CircuitBreaker
from src.routing.mesh_parallel import (
    execute_parallel as _execute_parallel,
    merge_results as _merge_results,
    spawn_sub_agent as _spawn_sub_agent,
)

logger = logging.getLogger("finsavvyai.routing")


class RoutingStrategy(str, Enum):
    COST_AWARE = "cost_aware"   # Task 17.4
    LATENCY = "latency"         # Task 17.5
    CAPABILITY = "capability"   # Task 17.6
    QUALITY = "quality"         # Task 17.8
    ROUND_ROBIN = "round_robin"


class MeshRouter:
    """Routes requests across multiple backends."""

    def __init__(
        self,
        default_strategy: RoutingStrategy = RoutingStrategy.LATENCY,
    ):
        self.default_strategy = default_strategy
        self._backends: Dict[str, Backend] = {}
        self.circuit_breaker = CircuitBreaker()
        self._rr_index = 0

    # ── Backend management ────────────────────────────────────

    def add_backend(self, backend: Backend) -> None:
        self._backends[backend.backend_id] = backend
        logger.info(
            "Backend added: %s (%s)",
            backend.backend_id, backend.backend_type.value,
        )

    def remove_backend(self, backend_id: str) -> None:
        self._backends.pop(backend_id, None)

    def get_backend(self, backend_id: str) -> Optional[Backend]:
        return self._backends.get(backend_id)

    def list_backends(self) -> List[Dict]:
        return [b.to_dict() for b in self._backends.values()]

    def get_available_backends(
        self, required_capability: Optional[str] = None
    ) -> List[Backend]:
        """Get backends that are available and match capability."""
        available = []
        for b in self._backends.values():
            if self.circuit_breaker.is_open(b.backend_id):
                continue
            if b.status == BackendStatus.DOWN:
                continue
            if required_capability and not b.has_capability(required_capability):
                continue
            available.append(b)
        return available

    # ── Route selection ───────────────────────────────────────

    def select_backend(
        self,
        strategy: Optional[RoutingStrategy] = None,
        required_capability: Optional[str] = None,
    ) -> Optional[Backend]:
        """Select the best backend using the given strategy."""
        strat = strategy or self.default_strategy
        available = self.get_available_backends(required_capability)

        if not available:
            return None

        if strat == RoutingStrategy.COST_AWARE:
            return min(available, key=lambda b: b.cost_per_token)
        elif strat == RoutingStrategy.LATENCY:
            return min(available, key=lambda b: b.avg_latency)
        elif strat == RoutingStrategy.CAPABILITY:
            return self._route_capability(available, required_capability)
        elif strat == RoutingStrategy.QUALITY:
            return max(available, key=lambda b: b.avg_quality)
        elif strat == RoutingStrategy.ROUND_ROBIN:
            return self._route_round_robin(available)
        return available[0]

    def _route_capability(
        self, backends: List[Backend], cap: Optional[str]
    ) -> Backend:
        """Match task requirements to model strengths (Task 17.6)."""
        if cap:
            matching = [b for b in backends if b.has_capability(cap)]
            if matching:
                return min(matching, key=lambda b: b.avg_latency)
        return min(backends, key=lambda b: b.avg_latency)

    def _route_round_robin(self, backends: List[Backend]) -> Backend:
        idx = self._rr_index % len(backends)
        self._rr_index += 1
        return backends[idx]

    async def execute_parallel(
        self, task_fn: Callable, backends: Optional[List[Backend]] = None, max_concurrent: int = 3,
    ) -> List[Dict[str, Any]]:
        """Run a task on multiple backends simultaneously."""
        return await _execute_parallel(self, task_fn, backends, max_concurrent)

    def merge_results(self, results: List[Dict[str, Any]], strategy: str = "best_quality") -> Dict[str, Any]:
        """Merge results from parallel execution."""
        return _merge_results(self, results, strategy)

    async def spawn_sub_agent(self, task_fn: Callable, backend: Optional[Backend] = None) -> Dict[str, Any]:
        """Spawn a sub-agent for a complex sub-task."""
        return await _spawn_sub_agent(self, task_fn, backend)
