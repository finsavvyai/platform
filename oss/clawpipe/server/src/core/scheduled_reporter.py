#!/usr/bin/env python3
"""
Scheduled reporter for usage reports and cron-like tasks.

Sprint 13 — Tasks 13.4, 13.7
"""

import asyncio
import logging
import time
from datetime import datetime
from typing import Any, Callable, Dict, List, Optional

from src.core.health_checker import HealthChecker

logger = logging.getLogger("finsavvyai.heartbeat")


class ScheduledReporter:
    """
    Generates scheduled reports (Task 13.4) and manages cron-like tasks (Task 13.7).
    """

    def __init__(self, health_checker: HealthChecker):
        self.health_checker = health_checker
        self._tasks: Dict[str, Dict] = {}
        self._running = False
        self._task_handle: Optional[asyncio.Task] = None

    def add_scheduled_task(
        self,
        name: str,
        interval_seconds: int,
        callback: Callable,
        description: str = "",
    ) -> None:
        """Register a recurring task (Task 13.7)."""
        self._tasks[name] = {
            "name": name,
            "interval": interval_seconds,
            "callback": callback,
            "description": description,
            "last_run": None,
            "run_count": 0,
        }

    def remove_task(self, name: str) -> None:
        self._tasks.pop(name, None)

    async def generate_usage_report(self) -> Dict[str, Any]:
        """Generate a usage summary report (Task 13.4)."""
        check = await self.health_checker.run_health_check()
        worker_data = check.get("worker", {}).get("data", {})

        report = {
            "report_type": "usage_summary",
            "generated_at": datetime.utcnow().isoformat(),
            "cluster_status": check["worker"]["status"],
            "openclaw_status": check["openclaw"]["status"],
            "request_count": worker_data.get("request_count", 0),
            "uptime_seconds": worker_data.get("uptime", 0),
            "models_loaded": worker_data.get("inference_engine", {}).get(
                "models_loaded", 0
            ),
            "active_alerts": len(check.get("alerts", [])),
            "worker_latency_ms": check["worker"].get("latency_ms", 0),
        }
        return report

    async def _run_loop(self) -> None:
        """Background loop that runs scheduled tasks."""
        while self._running:
            now = time.time()
            for task in self._tasks.values():
                last = task["last_run"] or 0
                if now - last >= task["interval"]:
                    try:
                        result = task["callback"]()
                        if asyncio.iscoroutine(result):
                            await result
                        task["last_run"] = now
                        task["run_count"] += 1
                    except Exception as e:
                        logger.error("Scheduled task %s failed: %s", task["name"], e)
            await asyncio.sleep(1)

    def start(self) -> None:
        """Start the scheduled task runner."""
        if not self._running:
            self._running = True
            self._task_handle = asyncio.ensure_future(self._run_loop())
            logger.info("Scheduled reporter started with %d tasks", len(self._tasks))

    def stop(self) -> None:
        """Stop the scheduled task runner."""
        self._running = False
        if self._task_handle and not self._task_handle.done():
            self._task_handle.cancel()
        logger.info("Scheduled reporter stopped")

    def list_tasks(self) -> List[Dict]:
        return [
            {
                "name": t["name"],
                "interval": t["interval"],
                "description": t["description"],
                "last_run": t["last_run"],
                "run_count": t["run_count"],
            }
            for t in self._tasks.values()
        ]
