#!/usr/bin/env python3
"""
Production Fallback Chain and Health Monitor

Fallback chain (Task 19.5) and connection health monitoring (Task 19.6).
"""

import asyncio
import logging
import time
from typing import Any, Callable, Dict, List, Optional

import aiohttp

logger = logging.getLogger("finsavvyai.production")


class FallbackChain:
    """Fallback chain: OpenClaw -> local -> error with proper degradation."""

    def __init__(self) -> None:
        self._chain: List[Dict[str, Any]] = []

    def add_backend(
        self,
        name: str,
        handler: Callable,
        priority: int = 0,
    ) -> None:
        """Add a backend to the fallback chain."""
        self._chain.append(
            {"name": name, "handler": handler, "priority": priority}
        )
        self._chain.sort(key=lambda x: x["priority"])

    async def execute(self, *args: Any, **kwargs: Any) -> Dict[str, Any]:
        """Execute through the fallback chain."""
        errors: List[Dict[str, str]] = []

        for backend in self._chain:
            try:
                result = backend["handler"](*args, **kwargs)
                if asyncio.iscoroutine(result):
                    result = await result
                return {
                    "backend": backend["name"],
                    "result": result,
                    "fallback_index": self._chain.index(backend),
                    "previous_errors": errors,
                }
            except Exception as e:
                logger.warning(
                    "Fallback %s failed: %s, trying next",
                    backend["name"],
                    e,
                )
                errors.append({"backend": backend["name"], "error": str(e)})

        return {
            "backend": None,
            "result": None,
            "error": "All backends in fallback chain failed",
            "errors": errors,
        }

    def list_chain(self) -> List[Dict]:
        """List backends in the chain."""
        return [{"name": b["name"], "priority": b["priority"]} for b in self._chain]


class ConnectionHealthMonitor:
    """Monitor OpenClaw connection health and expose via /health endpoint."""

    def __init__(
        self,
        openclaw_url: str = "http://localhost:11434",
        check_interval: int = 30,
    ) -> None:
        self.openclaw_url = openclaw_url.rstrip("/")
        self.check_interval = check_interval
        self._last_check: Optional[Dict] = None
        self._history: List[Dict] = []
        self._running = False

    async def check_health(self) -> Dict[str, Any]:
        """Check OpenClaw connection health."""
        try:
            async with aiohttp.ClientSession(
                timeout=aiohttp.ClientTimeout(total=5)
            ) as session:
                start = time.monotonic()
                async with session.get(f"{self.openclaw_url}/health") as resp:
                    latency = (time.monotonic() - start) * 1000
                    result: Dict[str, Any] = {
                        "status": "healthy" if resp.status == 200 else "unhealthy",
                        "http_status": resp.status,
                        "latency_ms": round(latency, 2),
                        "timestamp": time.time(),
                    }
        except Exception as e:
            result = {
                "status": "unreachable",
                "error": str(e),
                "timestamp": time.time(),
            }

        self._last_check = result
        self._history.append(result)
        self._history = self._history[-100:]
        return result

    def get_health_summary(self) -> Dict[str, Any]:
        """Get health summary for /health endpoint integration."""
        if not self._history:
            return {"status": "unknown", "checks": 0}

        healthy = sum(1 for h in self._history if h["status"] == "healthy")
        total = len(self._history)
        latencies = [h["latency_ms"] for h in self._history if "latency_ms" in h]

        return {
            "status": self._last_check.get("status", "unknown")
            if self._last_check
            else "unknown",
            "uptime_pct": round(healthy / total * 100, 1) if total > 0 else 0,
            "checks": total,
            "avg_latency_ms": round(sum(latencies) / len(latencies), 2)
            if latencies
            else 0,
            "last_check": self._last_check,
        }
