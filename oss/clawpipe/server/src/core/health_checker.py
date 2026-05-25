#!/usr/bin/env python3
"""
Health checker for cluster components with alert generation.

Sprint 13 — Tasks 13.2, 13.3
"""

import logging
import time
from datetime import datetime
from typing import Any, Dict, List, Optional

import aiohttp

logger = logging.getLogger("finsavvyai.heartbeat")


class AlertLevel:
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


class HealthChecker:
    """
    Checks cluster component health and generates alerts (Tasks 13.2, 13.3).
    """

    def __init__(
        self,
        cluster_url: str = "http://localhost:8001",
        openclaw_url: str = "http://localhost:11434",
        latency_threshold_ms: float = 5000.0,
        error_rate_threshold: float = 10.0,
    ):
        self.cluster_url = cluster_url.rstrip("/")
        self.openclaw_url = openclaw_url.rstrip("/")
        self.latency_threshold_ms = latency_threshold_ms
        self.error_rate_threshold = error_rate_threshold
        self._session: Optional[aiohttp.ClientSession] = None
        self._last_check: Optional[Dict] = None
        self._alerts: List[Dict] = []

    async def _get_session(self) -> aiohttp.ClientSession:
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession(
                timeout=aiohttp.ClientTimeout(total=10),
            )
        return self._session

    async def check_worker_health(self) -> Dict[str, Any]:
        """Check worker node health endpoint."""
        session = await self._get_session()
        try:
            start = time.monotonic()
            async with session.get(f"{self.cluster_url}/health") as resp:
                latency_ms = (time.monotonic() - start) * 1000
                if resp.status == 200:
                    data = await resp.json()
                    data["latency_ms"] = latency_ms
                    return {"status": "healthy", "data": data, "latency_ms": latency_ms}
                else:
                    return {
                        "status": "unhealthy",
                        "http_status": resp.status,
                        "latency_ms": latency_ms,
                    }
        except Exception as e:
            return {"status": "down", "error": str(e)}

    async def check_openclaw_health(self) -> Dict[str, Any]:
        """Check OpenClaw gateway health."""
        session = await self._get_session()
        try:
            start = time.monotonic()
            async with session.get(f"{self.openclaw_url}/health") as resp:
                latency_ms = (time.monotonic() - start) * 1000
                if resp.status == 200:
                    return {"status": "healthy", "latency_ms": latency_ms}
                else:
                    return {"status": "unhealthy", "http_status": resp.status}
        except Exception as e:
            return {"status": "unavailable", "error": str(e)}

    async def run_health_check(self) -> Dict[str, Any]:
        """Run full health check and generate alerts (Task 13.2)."""
        worker = await self.check_worker_health()
        openclaw = await self.check_openclaw_health()
        alerts = []

        # Worker down alert (Task 13.3)
        if worker["status"] == "down":
            alerts.append(
                {
                    "level": AlertLevel.CRITICAL,
                    "source": "worker",
                    "message": f"Worker is DOWN: {worker.get('error', 'unknown')}",
                    "timestamp": datetime.utcnow().isoformat(),
                }
            )
        elif worker["status"] == "unhealthy":
            alerts.append(
                {
                    "level": AlertLevel.WARNING,
                    "source": "worker",
                    "message": f"Worker unhealthy: HTTP {worker.get('http_status')}",
                    "timestamp": datetime.utcnow().isoformat(),
                }
            )

        # High latency alert
        latency = worker.get("latency_ms", 0)
        if latency > self.latency_threshold_ms and worker["status"] != "down":
            alerts.append(
                {
                    "level": AlertLevel.WARNING,
                    "source": "worker",
                    "message": f"High latency: {latency:.0f}ms (threshold: {self.latency_threshold_ms}ms)",
                    "timestamp": datetime.utcnow().isoformat(),
                }
            )

        # OpenClaw unavailable
        if openclaw["status"] == "unavailable":
            alerts.append(
                {
                    "level": AlertLevel.WARNING,
                    "source": "openclaw",
                    "message": f"OpenClaw unavailable: {openclaw.get('error', 'unknown')}",
                    "timestamp": datetime.utcnow().isoformat(),
                }
            )

        self._alerts.extend(alerts)
        # Keep only last 100 alerts
        self._alerts = self._alerts[-100:]

        result = {
            "timestamp": datetime.utcnow().isoformat(),
            "worker": worker,
            "openclaw": openclaw,
            "alerts": alerts,
            "alert_count": len(alerts),
        }
        self._last_check = result
        return result

    def get_alerts(self, level: Optional[str] = None) -> List[Dict]:
        if level:
            return [a for a in self._alerts if a["level"] == level]
        return list(self._alerts)

    def clear_alerts(self) -> None:
        self._alerts.clear()

    @property
    def last_check(self) -> Optional[Dict]:
        return self._last_check

    async def close(self) -> None:
        if self._session and not self._session.closed:
            await self._session.close()
