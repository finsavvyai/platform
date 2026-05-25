"""
OpenClaw Marketplace Monitor

Continuously monitors ClawHub marketplace for new and updated skills,
providing real-time security alerts for the OpenClaw ecosystem.
"""

import asyncio
import logging
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Optional

from ..services.openclaw_scanner import OpenClawScanner, ScanResult

try:
    from ..monitoring.workflow_logger import log_event
except ImportError:

    async def log_event(event_name: str, payload: dict[str, Any]) -> None:
        logging.getLogger(__name__).info(
            "OpenClaw monitor event: %s payload=%s", event_name, payload
        )


logger = logging.getLogger(__name__)


@dataclass
class MonitoredSkill:
    """A skill being monitored."""

    id: str
    name: str
    url: str
    last_check: Optional[datetime] = None
    last_version: Optional[str] = None
    current_hash: Optional[str] = None
    status: str = "monitoring"  # monitoring, updated, vulnerable, blocked


@dataclass
class MonitorAlert:
    """Alert generated for a monitored skill."""

    skill_id: str
    skill_name: str
    alert_type: str  # new_version, vulnerability, policy_violation, malicious_hash
    severity: str  # critical, high, medium, low
    message: str
    scan_result: Optional[ScanResult] = None
    timestamp: datetime = field(default_factory=datetime.utcnow)
    acknowledged: bool = False


class OpenClawMarketplaceMonitor:
    """
    Monitor ClawHub marketplace for security events.

    Features:
    - Track skill updates
    - Scan new/updated skills automatically
    - Generate alerts for vulnerabilities
    - Support webhooks for notifications
    - Maintain monitoring history
    """

    def __init__(
        self, check_interval_seconds: int = 300, max_concurrent_scans: int = 5
    ):
        """
        Initialize the marketplace monitor.

        Args:
            check_interval_seconds: How often to check for updates
            max_concurrent_scans: Maximum concurrent scans
        """
        self.scanner = OpenClawScanner()
        self.check_interval = check_interval_seconds
        self.max_concurrent = max_concurrent_scans

        self.monitored_skills: dict[str, MonitoredSkill] = {}
        self.alerts: list[MonitorAlert] = []

        self._running = False
        self._task: Optional[asyncio.Task] = None

        # Webhook callbacks
        self._webhooks: list[str] = []

        # Event callbacks
        self._callbacks: dict[str, list[Callable]] = {
            "skill_updated": [],
            "vulnerability_found": [],
            "policy_violation": [],
            "malicious_detected": [],
        }

    async def start(self) -> None:
        """Start the background monitoring task."""
        if self._running:
            logger.warning("Monitor is already running")
            return

        self._running = True
        self._task = asyncio.create_task(self._monitor_loop())

        await log_event(
            "openclaw_monitor_started",
            {
                "interval_seconds": self.check_interval,
                "monitored_skills": len(self.monitored_skills),
            },
        )

        logger.info(
            f"Started OpenClaw marketplace monitor (interval: {self.check_interval}s)"
        )

    async def stop(self) -> None:
        """Stop the background monitoring task."""
        if not self._running:
            return

        self._running = False

        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass

        await log_event(
            "openclaw_monitor_stopped", {"monitored_skills": len(self.monitored_skills)}
        )

        logger.info("Stopped OpenClaw marketplace monitor")

    async def _monitor_loop(self) -> None:
        """Main monitoring loop."""
        while self._running:
            try:
                await self._check_all_skills()
            except Exception as e:
                logger.error(f"Error in monitor loop: {e}", exc_info=True)

            # Wait for next interval
            await asyncio.sleep(self.check_interval)

    async def _check_all_skills(self) -> None:
        """Check all monitored skills for updates."""
        if not self.monitored_skills:
            return

        # Process skills in batches to limit concurrent scans
        skill_items = list(self.monitored_skills.items())
        batch_size = self.max_concurrent

        for i in range(0, len(skill_items), batch_size):
            batch = skill_items[i : i + batch_size]

            tasks = [
                self._check_skill_update(skill_id, skill) for skill_id, skill in batch
            ]

            await asyncio.gather(*tasks, return_exceptions=True)

    async def _check_skill_update(self, skill_id: str, skill: MonitoredSkill) -> None:
        """Check if a skill has been updated and scan if so."""
        try:
            # Check for update (placeholder - would check ClawHub API)
            has_update, new_version = await self._check_clawhub_update(skill)

            if has_update:
                logger.info(f"Skill {skill.name} updated to {new_version}")

                # Scan the updated skill
                result = await self.scanner.scan_and_store(skill.url)

                # Update monitored skill
                skill.last_check = datetime.utcnow()
                skill.last_version = new_version
                skill.status = "updated"

                # Generate alerts based on scan results
                await self._generate_alerts(skill, result)

                # Trigger callbacks
                await self._trigger_callbacks("skill_updated", skill, result)

        except Exception as e:
            logger.error(f"Error checking skill {skill_id}: {e}")

    async def _check_clawhub_update(
        self, skill: MonitoredSkill
    ) -> tuple[bool, Optional[str]]:
        """
        Check ClawHub API for skill updates.

        Returns:
            (has_update, new_version)
        """
        import aiohttp

        # ClawHub API endpoint
        api_url = f"https://api.clawhub.ai/v1/skills/{skill.id}"

        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    api_url, timeout=aiohttp.ClientTimeout(total=10)
                ) as resp:
                    if resp.status != 200:
                        return False, None

                    data = await resp.json()
                    latest_version = data.get("version")
                    updated_at = data.get("updated_at")

                    # Check if version changed
                    if latest_version != skill.last_version:
                        return True, latest_version

                    # Check if recently updated (within last hour)
                    if updated_at:
                        updated_dt = datetime.fromisoformat(updated_at)
                        if skill.last_check and updated_dt > skill.last_check:
                            return True, latest_version

            return False, None

        except Exception as e:
            logger.warning(f"Error checking ClawHub for skill {skill.id}: {e}")
            return False, None

    async def _generate_alerts(self, skill: MonitoredSkill, result: ScanResult) -> None:
        """Generate alerts based on scan results."""
        alerts_created = []

        # Check for critical risk score
        if result.risk_score >= 75:
            alert = MonitorAlert(
                skill_id=skill.id,
                skill_name=skill.name,
                alert_type="vulnerability",
                severity="critical",
                message=f"Skill has critical risk score: {result.risk_score}/100",
                scan_result=result,
            )
            alerts_created.append(alert)

        # Check for critical vulnerabilities
        for vuln in result.vulnerabilities:
            if vuln.severity == "critical":
                alert = MonitorAlert(
                    skill_id=skill.id,
                    skill_name=skill.name,
                    alert_type="vulnerability",
                    severity="critical",
                    message=f"Critical vulnerability: {vuln.title}",
                    scan_result=result,
                )
                alerts_created.append(alert)

        # Check for critical policy violations
        for violation in result.policy_violations:
            if violation.severity == "critical":
                alert = MonitorAlert(
                    skill_id=skill.id,
                    skill_name=skill.name,
                    alert_type="policy_violation",
                    severity="critical",
                    message=f"Policy violation: {violation.description}",
                    scan_result=result,
                )
                alerts_created.append(alert)

        # Add alerts to list
        self.alerts.extend(alerts_created)

        # Send webhooks
        for webhook_url in self._webhooks:
            await self._send_alert_webhook(webhook_url, alerts_created)

        # Trigger callbacks
        for alert in alerts_created:
            if alert.alert_type == "vulnerability":
                await self._trigger_callbacks("vulnerability_found", skill, alert)
            elif alert.alert_type == "policy_violation":
                await self._trigger_callbacks("policy_violation", skill, alert)

        # Log alerts
        await log_event(
            "openclaw_alerts_generated",
            {"skill_id": skill.id, "alert_count": len(alerts_created)},
        )

    async def _send_alert_webhook(
        self, webhook_url: str, alerts: list[MonitorAlert]
    ) -> None:
        """Send alerts via webhook."""
        import aiohttp

        payload = {
            "event": "openclaw_alerts",
            "timestamp": datetime.utcnow().isoformat(),
            "alerts": [
                {
                    "skill_id": a.skill_id,
                    "skill_name": a.skill_name,
                    "type": a.alert_type,
                    "severity": a.severity,
                    "message": a.message,
                    "risk_score": a.scan_result.risk_score if a.scan_result else None,
                }
                for a in alerts
            ],
        }

        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    webhook_url, json=payload, timeout=aiohttp.ClientTimeout(total=10)
                ) as resp:
                    if resp.status not in [200, 201, 202]:
                        logger.warning(f"Webhook failed: {webhook_url} - {resp.status}")
        except Exception as e:
            logger.error(f"Error sending webhook: {e}")

    def add_skill(self, skill_id: str, skill_name: str, skill_url: str) -> None:
        """Add a skill to monitoring."""
        self.monitored_skills[skill_id] = MonitoredSkill(
            id=skill_id, name=skill_name, url=skill_url
        )

        logger.info(f"Added skill to monitoring: {skill_name} ({skill_id})")

    def remove_skill(self, skill_id: str) -> bool:
        """Remove a skill from monitoring."""
        if skill_id in self.monitored_skills:
            del self.monitored_skills[skill_id]
            logger.info(f"Removed skill from monitoring: {skill_id}")
            return True
        return False

    def add_webhook(self, webhook_url: str) -> None:
        """Add a webhook URL for alert notifications."""
        if webhook_url not in self._webhooks:
            self._webhooks.append(webhook_url)
            logger.info(f"Added webhook: {webhook_url}")

    def remove_webhook(self, webhook_url: str) -> bool:
        """Remove a webhook URL."""
        if webhook_url in self._webhooks:
            self._webhooks.remove(webhook_url)
            logger.info(f"Removed webhook: {webhook_url}")
            return True
        return False

    def on(self, event: str, callback: Callable) -> None:
        """Register a callback for an event."""
        if event in self._callbacks:
            self._callbacks[event].append(callback)

    async def _trigger_callbacks(self, event: str, *args) -> None:
        """Trigger all callbacks for an event."""
        for callback in self._callbacks.get(event, []):
            try:
                if asyncio.iscoroutinefunction(callback):
                    await callback(*args)
                else:
                    callback(*args)
            except Exception as e:
                logger.error(f"Error in callback for {event}: {e}")

    def get_monitored_skills(self) -> list[dict[str, Any]]:
        """Get list of monitored skills."""
        return [
            {
                "id": skill.id,
                "name": skill.name,
                "url": skill.url,
                "last_check": skill.last_check.isoformat()
                if skill.last_check
                else None,
                "last_version": skill.last_version,
                "status": skill.status,
            }
            for skill in self.monitored_skills.values()
        ]

    def get_alerts(
        self,
        limit: int = 100,
        severity: Optional[str] = None,
        acknowledged: Optional[bool] = None,
    ) -> list[dict[str, Any]]:
        """Get list of alerts with optional filtering."""
        alerts = self.alerts

        if severity:
            alerts = [a for a in alerts if a.severity == severity]

        if acknowledged is not None:
            alerts = [a for a in alerts if a.acknowledged == acknowledged]

        # Sort by timestamp descending
        alerts = sorted(alerts, key=lambda a: a.timestamp, reverse=True)

        # Apply limit
        alerts = alerts[:limit]

        return [
            {
                "skill_id": a.skill_id,
                "skill_name": a.skill_name,
                "type": a.alert_type,
                "severity": a.severity,
                "message": a.message,
                "timestamp": a.timestamp.isoformat(),
                "acknowledged": a.acknowledged,
                "risk_score": a.scan_result.risk_score if a.scan_result else None,
            }
            for a in alerts
        ]

    async def acknowledge_alert(self, alert_index: int) -> bool:
        """Acknowledge an alert."""
        if 0 <= alert_index < len(self.alerts):
            self.alerts[alert_index].acknowledged = True
            return True
        return False

    def get_statistics(self) -> dict[str, Any]:
        """Get monitoring statistics."""
        total_alerts = len(self.alerts)
        unacknowledged = len([a for a in self.alerts if not a.acknowledged])

        by_severity = {
            "critical": len([a for a in self.alerts if a.severity == "critical"]),
            "high": len([a for a in self.alerts if a.severity == "high"]),
            "medium": len([a for a in self.alerts if a.severity == "medium"]),
            "low": len([a for a in self.alerts if a.severity == "low"]),
        }

        by_type = {
            "vulnerability": len(
                [a for a in self.alerts if a.alert_type == "vulnerability"]
            ),
            "policy_violation": len(
                [a for a in self.alerts if a.alert_type == "policy_violation"]
            ),
            "malicious_detected": len(
                [a for a in self.alerts if a.alert_type == "malicious_hash"]
            ),
        }

        return {
            "monitored_skills": len(self.monitored_skills),
            "total_alerts": total_alerts,
            "unacknowledged_alerts": unacknowledged,
            "by_severity": by_severity,
            "by_type": by_type,
            "webhooks_configured": len(self._webhooks),
            "is_running": self._running,
        }

    async def scan_marketplace(
        self, limit: int = 100, category: Optional[str] = None
    ) -> list[ScanResult]:
        """
        Scan skills from ClawHub marketplace.

        Useful for initial marketplace assessment.
        """
        # Fetch skills from ClawHub
        skills = await self._fetch_marketplace_skills(limit, category)

        # Scan in batches
        results = []
        for i in range(0, len(skills), self.max_concurrent):
            batch = skills[i : i + self.max_concurrent]

            tasks = [self.scanner.scan_and_store(skill["url"]) for skill in batch]

            batch_results = await asyncio.gather(*tasks, return_exceptions=True)

            for result in batch_results:
                if isinstance(result, ScanResult):
                    results.append(result)

            # Brief pause between batches
            await asyncio.sleep(1)

        # Generate summary report
        await log_event(
            "openclaw_marketplace_scan_completed",
            {
                "skills_scanned": len(skills),
                "vulnerabilities_found": sum(len(r.vulnerabilities) for r in results),
                "high_risk_skills": sum(1 for r in results if r.risk_score >= 50),
            },
        )

        return results

    async def _fetch_marketplace_skills(
        self, limit: int, category: Optional[str]
    ) -> list[dict[str, Any]]:
        """Fetch skills from ClawHub marketplace."""
        import aiohttp

        skills = []

        # ClawHub marketplace API
        api_url = "https://api.clawhub.ai/v1/skills"
        params = {"limit": limit}
        if category:
            params["category"] = category

        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(api_url, params=params) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        skills = data.get("skills", [])
        except Exception as e:
            logger.error(f"Error fetching marketplace skills: {e}")

        return skills


# Singleton instance
_monitor_instance: Optional[OpenClawMarketplaceMonitor] = None


def get_marketplace_monitor() -> OpenClawMarketplaceMonitor:
    """Get the singleton marketplace monitor instance."""
    global _monitor_instance
    if _monitor_instance is None:
        _monitor_instance = OpenClawMarketplaceMonitor()
    return _monitor_instance
