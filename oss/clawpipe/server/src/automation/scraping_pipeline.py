#!/usr/bin/env python3
"""
Web scraping pipeline and URL-to-knowledge ingestion.

Sprint 15 — Tasks 15.2, 15.3
Extracted from browser_integration.py.
"""

import logging
import time
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

from src.automation.browser_client import BrowserClient

logger = logging.getLogger("finsavvyai.automation")


class WebScrapingPipeline:
    """
    Web scraping pipeline: browse -> screenshot -> vision -> extract (Task 15.2).
    """

    def __init__(
        self,
        browser: BrowserClient,
        openclaw_url: str = "http://localhost:11434",
        api_key: Optional[str] = None,
    ):
        self.browser = browser
        self.openclaw_url = openclaw_url.rstrip("/")
        self.api_key = api_key

    async def scrape_and_analyze(
        self,
        url: str,
        prompt: str = "Extract the main content from this page",
        model: str = "default",
    ) -> Dict[str, Any]:
        """Full pipeline: navigate -> screenshot -> vision analysis."""
        nav_result = await self.browser.navigate(url)
        if "error" in nav_result:
            return {
                "error": f"Navigation failed: {nav_result['error']}",
                "step": "navigate",
            }

        ss_result = await self.browser.screenshot()
        if "error" in ss_result:
            return {
                "error": f"Screenshot failed: {ss_result['error']}",
                "step": "screenshot",
            }

        screenshot_b64 = ss_result.get("screenshot", ss_result.get("data", ""))
        vision_result = await self._analyze_screenshot(
            screenshot_b64, prompt, model
        )

        return {
            "url": url,
            "navigation": nav_result,
            "screenshot_size": len(screenshot_b64) if screenshot_b64 else 0,
            "analysis": vision_result,
        }

    async def _analyze_screenshot(
        self, screenshot_b64: str, prompt: str, model: str
    ) -> Dict[str, Any]:
        """Send screenshot to vision endpoint for analysis."""
        if not screenshot_b64:
            return {"error": "No screenshot data"}

        session = await self.browser._get_session()
        image_url = (
            f"data:image/png;base64,{screenshot_b64}"
            if not screenshot_b64.startswith("data:")
            else screenshot_b64
        )

        payload = {
            "model": model,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": {"url": image_url}},
                    ],
                }
            ],
            "max_tokens": 2048,
        }

        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["X-API-Key"] = self.api_key

        try:
            async with session.post(
                f"{self.openclaw_url}/v1/chat/completions",
                json=payload,
                headers=headers,
            ) as resp:
                if resp.status == 200:
                    result = await resp.json()
                    text = ""
                    choices = result.get("choices", [])
                    if choices:
                        text = choices[0].get("message", {}).get("content", "")
                    return {"text": text}
                return {"error": f"Vision analysis failed: HTTP {resp.status}"}
        except Exception as e:
            return {"error": str(e)}


class URLKnowledgeIngester:
    """
    URL-to-knowledge ingestion: fetch page -> summarize -> store (Task 15.3).
    """

    def __init__(self, browser: BrowserClient, scraper: WebScrapingPipeline):
        self.browser = browser
        self.scraper = scraper
        self._knowledge_store: List[Dict[str, Any]] = []

    async def ingest(
        self, url: str, model: str = "default"
    ) -> Dict[str, Any]:
        """Fetch a page, summarize its content, and store as knowledge."""
        content = await self.browser.get_page_content(url)
        if "error" in content:
            result = await self.scraper.scrape_and_analyze(
                url, "Summarize the main content of this page", model
            )
            summary = result.get("analysis", {}).get("text", "")
        else:
            summary = content.get("text", content.get("content", ""))

        entry = {
            "url": url,
            "domain": urlparse(url).netloc,
            "summary": summary[:2000],
            "ingested_at": time.time(),
        }
        self._knowledge_store.append(entry)
        return entry

    def search_knowledge(self, query: str) -> List[Dict]:
        """Simple keyword search over ingested knowledge."""
        query_lower = query.lower()
        return [
            e
            for e in self._knowledge_store
            if query_lower in e.get("summary", "").lower()
            or query_lower in e.get("url", "").lower()
        ]

    def get_all_knowledge(self) -> List[Dict]:
        return list(self._knowledge_store)

    def clear_knowledge(self) -> None:
        self._knowledge_store.clear()
