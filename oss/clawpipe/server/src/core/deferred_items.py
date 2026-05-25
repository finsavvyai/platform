#!/usr/bin/env python3
"""
Deferred Sprint Items Tracker

Tracks deferred items from Sprints 4, 5, 7 and provides
stubs/placeholders for future implementation.

Sprint 19 — Task 19.7
"""

import logging
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional

logger = logging.getLogger("finsavvyai.deferred")


class DeferredStatus(Enum):
    DEFERRED = "deferred"
    STUB = "stub"
    PARTIAL = "partial"
    COMPLETED = "completed"


@dataclass
class DeferredItem:
    sprint: int
    task_id: str
    title: str
    description: str
    status: DeferredStatus = DeferredStatus.DEFERRED
    notes: str = ""


# ── Sprint 4: macOS Keychain Integration ─────────────────────────


class KeychainStub:
    """
    Stub for macOS Keychain integration (Sprint 4).
    Falls back to environment variables until native Keychain
    integration is implemented.
    """

    def __init__(self):
        self._fallback_store: Dict[str, str] = {}

    def store_secret(self, key: str, value: str) -> bool:
        """Store a secret (env var fallback)."""
        import os

        os.environ[f"FINSAVVY_{key.upper()}"] = value
        self._fallback_store[key] = value
        logger.info("Secret '%s' stored via env var fallback (Keychain deferred)", key)
        return True

    def get_secret(self, key: str) -> Optional[str]:
        """Retrieve a secret (env var fallback)."""
        import os

        return os.environ.get(f"FINSAVVY_{key.upper()}", self._fallback_store.get(key))

    def delete_secret(self, key: str) -> bool:
        """Delete a secret."""
        import os

        env_key = f"FINSAVVY_{key.upper()}"
        if env_key in os.environ:
            del os.environ[env_key]
        self._fallback_store.pop(key, None)
        return True


# ── Sprint 5: Playwright Browser Automation ──────────────────────


class PlaywrightStub:
    """
    Stub for Playwright-based browser automation (Sprint 5).
    Uses aiohttp-based scraping until Playwright is integrated.
    """

    def __init__(self):
        self._available = False
        try:
            import playwright  # noqa: F401

            self._available = True
        except ImportError:
            logger.info("Playwright not installed; using aiohttp scraping fallback")

    @property
    def available(self) -> bool:
        return self._available

    async def navigate(self, url: str) -> Dict[str, Any]:
        """Navigate to URL (stub — returns guidance)."""
        if not self._available:
            return {
                "status": "stub",
                "message": "Playwright not installed. Install with: pip install playwright && playwright install",
                "fallback": "Use BrowserClient from src/automation/browser_integration.py",
            }
        return {"status": "available", "url": url}

    async def screenshot(self, url: str) -> Optional[bytes]:
        """Take screenshot (stub)."""
        if not self._available:
            return None
        return None


# ── Sprint 7: TestFlight / Distribution ──────────────────────────


class TestFlightStub:
    """
    Stub for TestFlight / app distribution (Sprint 7).
    Provides distribution status tracking.
    """

    def __init__(self):
        self._builds: List[Dict[str, Any]] = []

    def register_build(
        self, version: str, build_number: int, notes: str = ""
    ) -> Dict[str, Any]:
        """Register a build for distribution."""
        build = {
            "version": version,
            "build_number": build_number,
            "notes": notes,
            "status": "pending",
            "distribution": "not_configured",
        }
        self._builds.append(build)
        logger.info(
            "Build %s (%d) registered (TestFlight integration deferred)",
            version,
            build_number,
        )
        return build

    def list_builds(self) -> List[Dict[str, Any]]:
        return list(self._builds)

    def get_distribution_status(self) -> Dict[str, Any]:
        return {
            "provider": "stub",
            "message": "TestFlight integration deferred to future sprint",
            "builds_registered": len(self._builds),
        }


# ── Deferred Items Registry ──────────────────────────────────────

DEFERRED_ITEMS = [
    DeferredItem(
        sprint=4,
        task_id="4.x",
        title="macOS Keychain Integration",
        description="Store API keys and secrets in macOS Keychain instead of env vars",
        status=DeferredStatus.STUB,
        notes="KeychainStub provides env var fallback",
    ),
    DeferredItem(
        sprint=5,
        task_id="5.x",
        title="Playwright Browser Automation",
        description="Use Playwright for full browser automation, screenshots, form filling",
        status=DeferredStatus.STUB,
        notes="PlaywrightStub checks availability; BrowserClient in automation module provides aiohttp fallback",
    ),
    DeferredItem(
        sprint=7,
        task_id="7.x",
        title="TestFlight Distribution",
        description="Automated TestFlight builds and distribution",
        status=DeferredStatus.STUB,
        notes="TestFlightStub provides build registration tracking",
    ),
]


def get_deferred_status() -> Dict[str, Any]:
    """Get status of all deferred items."""
    return {
        "total": len(DEFERRED_ITEMS),
        "items": [
            {
                "sprint": item.sprint,
                "task_id": item.task_id,
                "title": item.title,
                "status": item.status.value,
                "notes": item.notes,
            }
            for item in DEFERRED_ITEMS
        ],
    }
