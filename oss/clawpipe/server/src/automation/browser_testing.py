#!/usr/bin/env python3
"""
UI testing, research agent, and PDF generation pipelines.

Sprint 15 — Tasks 15.4, 15.6, 15.7
Extracted from browser_integration.py.
"""

import asyncio
import logging
from typing import Any, Dict, List, Optional

from src.automation.browser_client import BrowserClient
from src.automation.scraping_pipeline import WebScrapingPipeline

logger = logging.getLogger("finsavvyai.automation")


class UITestingPipeline:
    """
    Automated UI testing via screenshot comparison (Task 15.4).
    """

    def __init__(self, browser: BrowserClient, scraper: WebScrapingPipeline):
        self.browser = browser
        self.scraper = scraper
        self._baselines: Dict[str, str] = {}

    def set_baseline(self, name: str, screenshot_b64: str) -> None:
        """Store a baseline screenshot for comparison."""
        self._baselines[name] = screenshot_b64

    def get_baseline(self, name: str) -> Optional[str]:
        return self._baselines.get(name)

    async def capture_and_compare(
        self,
        url: str,
        baseline_name: str,
        model: str = "default",
    ) -> Dict[str, Any]:
        """
        Capture current screenshot and compare to baseline using vision.
        """
        await self.browser.navigate(url)
        ss = await self.browser.screenshot(full_page=True)
        current_b64 = ss.get("screenshot", ss.get("data", ""))

        baseline_b64 = self._baselines.get(baseline_name)
        if not baseline_b64:
            return {
                "status": "no_baseline",
                "message": f"No baseline found for '{baseline_name}'",
                "current_screenshot": current_b64[:100] if current_b64 else "",
            }

        result = await self.scraper._analyze_screenshot(
            current_b64,
            (
                "Compare this screenshot to the previous version. "
                "List any visual differences, layout changes, or missing elements."
            ),
            model,
        )

        return {
            "status": "compared",
            "baseline": baseline_name,
            "url": url,
            "differences": result.get("text", ""),
            "has_changes": bool(result.get("text", "").strip()),
        }

    def list_baselines(self) -> List[str]:
        return list(self._baselines.keys())


class ResearchAgent:
    """
    Multi-page research agent: browse multiple pages -> consolidate (Task 15.7).
    """

    def __init__(self, scraper: WebScrapingPipeline):
        self.scraper = scraper

    async def research(
        self,
        urls: List[str],
        topic: str,
        model: str = "default",
        max_concurrent: int = 3,
    ) -> Dict[str, Any]:
        """Research a topic across multiple URLs."""
        semaphore = asyncio.Semaphore(max_concurrent)
        results: List[Dict] = []

        async def _process_url(url: str) -> Dict:
            async with semaphore:
                return await self.scraper.scrape_and_analyze(
                    url,
                    f"Extract information relevant to: {topic}",
                    model,
                )

        tasks = [_process_url(url) for url in urls]
        page_results = await asyncio.gather(*tasks, return_exceptions=True)

        for url, result in zip(urls, page_results):
            if isinstance(result, Exception):
                results.append({"url": url, "error": str(result)})
            else:
                results.append({"url": url, **result})

        return {
            "topic": topic,
            "pages_analyzed": len(urls),
            "results": results,
            "successful": sum(1 for r in results if "error" not in r),
        }


class PDFGenerator:
    """
    PDF generation from web pages via OpenClaw browser (Task 15.6).
    """

    def __init__(self, browser: BrowserClient):
        self.browser = browser

    async def generate_pdf(self, url: str) -> Dict[str, Any]:
        """Navigate to URL and generate PDF."""
        session = await self.browser._get_session()
        payload = {
            "tool": "browser",
            "action": "pdf",
            "params": {"url": url},
        }
        try:
            async with session.post(
                f"{self.browser.openclaw_url}/v1/tools/execute",
                json=payload,
                headers=self.browser._get_headers(),
            ) as resp:
                if resp.status == 200:
                    result = await resp.json()
                    pdf_data = result.get("pdf", result.get("data", ""))
                    return {
                        "status": "generated",
                        "url": url,
                        "pdf_data": pdf_data,
                        "size_bytes": len(pdf_data),
                    }
                return {"error": f"PDF generation failed: HTTP {resp.status}"}
        except Exception as e:
            return {"error": str(e)}
