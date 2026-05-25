#!/usr/bin/env python3
"""
FinSavvyAI Heartbeat & Proactive Agent

Top-level orchestrator that ties together health checks, alerts,
scheduled tasks, boot checks, and workspace integration.

Sprint 13 — Tasks 13.1–13.9
"""

import asyncio
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from src.core.boot_checker import BootChecker
from src.core.health_checker import AlertLevel, HealthChecker
from src.core.heartbeat_templates import (
    AGENTS_TEMPLATE,
    BOOT_TEMPLATE,
    HEARTBEAT_TEMPLATE,
)
from src.core.scheduled_reporter import ScheduledReporter
from src.core.wakeup_trigger import WakeupTrigger

# Re-export all public symbols for backward compatibility
__all__ = [
    "HEARTBEAT_TEMPLATE",
    "BOOT_TEMPLATE",
    "AGENTS_TEMPLATE",
    "AlertLevel",
    "HealthChecker",
    "ScheduledReporter",
    "BootChecker",
    "WakeupTrigger",
    "HeartbeatAgent",
]

logger = logging.getLogger("finsavvyai.heartbeat")


class HeartbeatAgent:
    """
    Top-level heartbeat agent that ties everything together.
    Manages health checks, alerts, scheduled tasks, boot checks,
    and workspace integration (Tasks 13.5, 13.6).
    """

    def __init__(
        self,
        cluster_url: str = "http://localhost:8001",
        openclaw_url: str = "http://localhost:11434",
        heartbeat_interval: int = 60,
        agent_id: str = "finsavvy-ai",
    ):
        self.cluster_url = cluster_url
        self.openclaw_url = openclaw_url
        self.heartbeat_interval = heartbeat_interval
        self.agent_id = agent_id

        self.health_checker = HealthChecker(
            cluster_url=cluster_url,
            openclaw_url=openclaw_url,
        )
        self.reporter = ScheduledReporter(self.health_checker)
        self.boot_checker = BootChecker(self.health_checker)
        self.wakeup = WakeupTrigger()

        self._running = False
        self._heartbeat_task: Optional[asyncio.Task] = None
        self._memory: List[Dict] = []

    def render_agents_md(self) -> str:
        """Render AGENTS.md workspace file (Task 13.5)."""
        return AGENTS_TEMPLATE.format(
            agent_id=self.agent_id,
            heartbeat_interval=self.heartbeat_interval,
            latency_threshold=self.health_checker.latency_threshold_ms,
            error_threshold=self.health_checker.error_rate_threshold,
        )

    def render_heartbeat_md(self, check_result: Dict) -> str:
        """Render HEARTBEAT.md from a check result (Task 13.1)."""
        worker = check_result.get("worker", {})
        worker_data = worker.get("data", {})
        alerts = check_result.get("alerts", [])

        worker_summary = f"- Worker: {worker.get('status', 'unknown')} (latency: {worker.get('latency_ms', 0):.0f}ms)"
        model_summary = f"- Loaded models: {worker_data.get('inference_engine', {}).get('models_loaded', 0)}"
        alert_lines = [f"- [{a['level'].upper()}] {a['message']}" for a in alerts]
        alert_summary = "\n".join(alert_lines) if alert_lines else "- No alerts"

        return HEARTBEAT_TEMPLATE.format(
            cluster_id=worker_data.get("node_id", "unknown"),
            timestamp=check_result.get("timestamp", ""),
            status=worker.get("status", "unknown"),
            worker_summary=worker_summary,
            model_summary=model_summary,
            alert_summary=alert_summary,
            uptime=f"{worker_data.get('uptime', 0):.0f}s",
            total_requests=worker_data.get("request_count", 0),
            active_workers="1" if worker["status"] == "healthy" else "0",
            total_workers="1",
        )

    def store_memory(self, summary: str) -> None:
        """Store a conversation summary in memory (Task 13.6)."""
        self._memory.append(
            {
                "summary": summary,
                "timestamp": datetime.utcnow().isoformat(),
            }
        )
        # Keep last 50 memories
        self._memory = self._memory[-50:]

    def get_memory(self) -> List[Dict]:
        return list(self._memory)

    async def _heartbeat_loop(self) -> None:
        """Background heartbeat loop."""
        while self._running:
            try:
                check = await self.health_checker.run_health_check()
                logger.info(
                    "Heartbeat: worker=%s openclaw=%s alerts=%d",
                    check["worker"]["status"],
                    check["openclaw"]["status"],
                    check["alert_count"],
                )
                await self.wakeup.evaluate()
            except Exception as e:
                logger.error("Heartbeat loop error: %s", e)
            await asyncio.sleep(self.heartbeat_interval)

    def start(self) -> None:
        """Start the heartbeat agent."""
        if not self._running:
            self._running = True
            self._heartbeat_task = asyncio.ensure_future(self._heartbeat_loop())
            self.reporter.start()
            logger.info(
                "HeartbeatAgent started (interval=%ds)", self.heartbeat_interval
            )

    def stop(self) -> None:
        """Stop the heartbeat agent."""
        self._running = False
        if self._heartbeat_task and not self._heartbeat_task.done():
            self._heartbeat_task.cancel()
        self.reporter.stop()
        logger.info("HeartbeatAgent stopped")

    async def close(self) -> None:
        self.stop()
        await self.health_checker.close()
