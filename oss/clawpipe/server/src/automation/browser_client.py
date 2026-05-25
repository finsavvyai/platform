#!/usr/bin/env python3
"""
Browser client for OpenClaw browser tool calls.

Routes browser commands to the OpenClaw API which controls a
headless browser (Chrome/Playwright/Puppeteer) on the gateway.

Sprint 15 — Task 15.1, 15.5, 15.9
Extracted from browser_integration.py.
"""

import logging
from typing import Any, Dict, Optional

import aiohttp

logger = logging.getLogger("finsavvyai.automation")


class BrowserClient:
    """
    Client for OpenClaw browser tool calls (Task 15.1).

    Routes browser commands to the OpenClaw API which controls a
    headless browser on the gateway.
    """

    def __init__(
        self,
        openclaw_url: str = "http://localhost:11434",
        api_key: Optional[str] = None,
        timeout: int = 60,
    ):
        self.openclaw_url = openclaw_url.rstrip("/")
        self.api_key = api_key
        self.timeout = timeout
        self._session: Optional[aiohttp.ClientSession] = None
        self._cookies: Dict[str, Dict[str, str]] = {}

    async def _get_session(self) -> aiohttp.ClientSession:
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession(
                timeout=aiohttp.ClientTimeout(total=self.timeout),
            )
        return self._session

    def _get_headers(self) -> Dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["X-API-Key"] = self.api_key
        return headers

    async def navigate(self, url: str, wait_for: str = "load") -> Dict[str, Any]:
        """Navigate to a URL via OpenClaw browser (Task 15.1)."""
        session = await self._get_session()
        payload = {
            "tool": "browser",
            "action": "navigate",
            "params": {"url": url, "wait_for": wait_for},
        }
        try:
            async with session.post(
                f"{self.openclaw_url}/v1/tools/execute",
                json=payload,
                headers=self._get_headers(),
            ) as resp:
                if resp.status == 200:
                    return await resp.json()
                return {"error": f"Navigate failed: HTTP {resp.status}"}
        except Exception as e:
            return {"error": str(e)}

    async def screenshot(
        self, url: Optional[str] = None, full_page: bool = False
    ) -> Dict[str, Any]:
        """Take a screenshot of the current or given page (Task 15.4)."""
        session = await self._get_session()
        payload = {
            "tool": "browser",
            "action": "screenshot",
            "params": {"full_page": full_page},
        }
        if url:
            payload["params"]["url"] = url
        try:
            async with session.post(
                f"{self.openclaw_url}/v1/tools/execute",
                json=payload,
                headers=self._get_headers(),
            ) as resp:
                if resp.status == 200:
                    return await resp.json()
                return {"error": f"Screenshot failed: HTTP {resp.status}"}
        except Exception as e:
            return {"error": str(e)}

    async def get_page_content(self, url: Optional[str] = None) -> Dict[str, Any]:
        """Get page text content / DOM snapshot (Task 15.8)."""
        session = await self._get_session()
        payload = {
            "tool": "browser",
            "action": "get_content",
            "params": {},
        }
        if url:
            payload["params"]["url"] = url
        try:
            async with session.post(
                f"{self.openclaw_url}/v1/tools/execute",
                json=payload,
                headers=self._get_headers(),
            ) as resp:
                if resp.status == 200:
                    return await resp.json()
                return {"error": f"Content fetch failed: HTTP {resp.status}"}
        except Exception as e:
            return {"error": str(e)}

    async def fill_form(self, selector: str, value: str) -> Dict[str, Any]:
        """Fill a form field (Task 15.5)."""
        session = await self._get_session()
        payload = {
            "tool": "browser",
            "action": "fill",
            "params": {"selector": selector, "value": value},
        }
        try:
            async with session.post(
                f"{self.openclaw_url}/v1/tools/execute",
                json=payload,
                headers=self._get_headers(),
            ) as resp:
                if resp.status == 200:
                    return await resp.json()
                return {"error": f"Fill failed: HTTP {resp.status}"}
        except Exception as e:
            return {"error": str(e)}

    async def click(self, selector: str) -> Dict[str, Any]:
        """Click an element (Task 15.5)."""
        session = await self._get_session()
        payload = {
            "tool": "browser",
            "action": "click",
            "params": {"selector": selector},
        }
        try:
            async with session.post(
                f"{self.openclaw_url}/v1/tools/execute",
                json=payload,
                headers=self._get_headers(),
            ) as resp:
                if resp.status == 200:
                    return await resp.json()
                return {"error": f"Click failed: HTTP {resp.status}"}
        except Exception as e:
            return {"error": str(e)}

    # ── Cookie/session persistence (Task 15.9) ────────────────

    def save_cookies(self, domain: str, cookies: Dict[str, str]) -> None:
        """Store cookies for a domain."""
        self._cookies[domain] = cookies

    def get_cookies(self, domain: str) -> Dict[str, str]:
        return self._cookies.get(domain, {})

    def clear_cookies(self, domain: Optional[str] = None) -> None:
        if domain:
            self._cookies.pop(domain, None)
        else:
            self._cookies.clear()

    async def close(self) -> None:
        if self._session and not self._session.closed:
            await self._session.close()
