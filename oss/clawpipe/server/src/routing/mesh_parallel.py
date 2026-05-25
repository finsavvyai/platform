"""Parallel execution and consensus merging for mesh routing."""

import asyncio
import time
from collections import Counter
from typing import Any, Callable, Dict, List, Optional

from src.routing.mesh_backend import Backend


async def execute_parallel(
    router: "MeshRoutingStrategies",
    task_fn: Callable,
    backends: Optional[List[Backend]] = None,
    max_concurrent: int = 3,
) -> List[Dict[str, Any]]:
    """Run a task on multiple backends simultaneously."""
    targets = backends or list(router._backends.values())[:max_concurrent]
    semaphore = asyncio.Semaphore(max_concurrent)

    async def _run(backend: Backend) -> Dict:
        async with semaphore:
            start = time.monotonic()
            try:
                result = await task_fn(backend)
                latency = (time.monotonic() - start) * 1000
                backend.record_latency(latency)
                backend.record_success()
                router.circuit_breaker.record_success(backend.backend_id)
                return {
                    "backend_id": backend.backend_id,
                    "result": result,
                    "latency_ms": latency,
                    "status": "success",
                }
            except Exception as e:
                latency = (time.monotonic() - start) * 1000
                backend.record_error()
                router.circuit_breaker.record_failure(backend.backend_id)
                return {
                    "backend_id": backend.backend_id,
                    "error": str(e),
                    "latency_ms": latency,
                    "status": "error",
                }

    results = await asyncio.gather(*[_run(b) for b in targets])
    return list(results)


def merge_results(
    router: "MeshRoutingStrategies",
    results: List[Dict[str, Any]],
    strategy: str = "best_quality",
) -> Dict[str, Any]:
    """Merge results from parallel execution."""
    successful = [r for r in results if r["status"] == "success"]

    if not successful:
        return {"error": "All backends failed", "results": results}

    if strategy == "fastest":
        best = min(successful, key=lambda r: r["latency_ms"])
        return {"selected": best, "strategy": "fastest", "candidates": len(successful)}
    elif strategy == "best_quality":
        for r in successful:
            backend = router._backends.get(r["backend_id"])
            r["_quality"] = backend.avg_quality if backend else 0.5
        best = max(successful, key=lambda r: r["_quality"])
        return {"selected": best, "strategy": "best_quality", "candidates": len(successful)}
    elif strategy == "majority":
        texts = [str(r.get("result", "")) for r in successful]
        most_common = Counter(texts).most_common(1)[0][0]
        best = next(r for r in successful if str(r.get("result", "")) == most_common)
        return {"selected": best, "strategy": "majority", "candidates": len(successful)}

    return {"selected": successful[0], "strategy": "first", "candidates": len(successful)}


async def spawn_sub_agent(
    router: "MeshRoutingStrategies",
    task_fn: Callable,
    backend: Optional[Backend] = None,
) -> Dict[str, Any]:
    """Spawn a sub-agent for a complex sub-task."""
    target = backend or router.select_backend()
    if not target:
        return {"error": "No backend available"}

    start = time.monotonic()
    try:
        result = await task_fn(target)
        latency = (time.monotonic() - start) * 1000
        target.record_latency(latency)
        target.record_success()
        return {
            "backend_id": target.backend_id,
            "result": result,
            "latency_ms": latency,
            "status": "success",
        }
    except Exception as e:
        target.record_error()
        return {
            "backend_id": target.backend_id,
            "error": str(e),
            "status": "error",
        }
