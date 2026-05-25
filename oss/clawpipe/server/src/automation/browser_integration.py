#!/usr/bin/env python3
"""
FinSavvyAI Browser & Automation Integration — re-export hub.

Backward-compatible module that re-exports all public symbols from:
  - browser_client: BrowserClient
  - scraping_pipeline: WebScrapingPipeline, URLKnowledgeIngester
  - browser_testing: UITestingPipeline, ResearchAgent, PDFGenerator
"""

from src.automation.browser_client import BrowserClient
from src.automation.browser_testing import (
    PDFGenerator,
    ResearchAgent,
    UITestingPipeline,
)
from src.automation.scraping_pipeline import (
    URLKnowledgeIngester,
    WebScrapingPipeline,
)

__all__ = [
    "BrowserClient",
    "WebScrapingPipeline",
    "URLKnowledgeIngester",
    "UITestingPipeline",
    "ResearchAgent",
    "PDFGenerator",
]
