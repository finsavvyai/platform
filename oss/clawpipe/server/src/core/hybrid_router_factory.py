#!/usr/bin/env python3
"""
Hybrid Router Factory and CLI

Singleton factory and CLI test entry point for the hybrid router.
"""

import asyncio
import os
from typing import Optional

from src.core.logger import get_logger

logger = get_logger()


def get_hybrid_router() -> "HybridRouter":
    """Get or create hybrid router singleton."""
    from src.core.hybrid_router import HybridRouter

    global _hybrid_router

    if _hybrid_router is None:
        openclaw_enabled = os.environ.get("OPENCLAW_ENABLED", "false").lower() == "true"
        openclaw_url = os.environ.get("OPENCLAW_URL", "http://localhost:11434")
        openclaw_api_key = os.environ.get("OPENCLAW_API_KEY")

        _hybrid_router = HybridRouter(
            openclaw_enabled=openclaw_enabled,
            openclaw_url=openclaw_url,
            openclaw_api_key=openclaw_api_key,
        )
        logger.info("HybridRouter created", enabled=openclaw_enabled)

    return _hybrid_router


_hybrid_router: Optional["HybridRouter"] = None


async def main() -> None:
    """Test hybrid routing."""
    import argparse

    parser = argparse.ArgumentParser(description="FinSavvyAI Hybrid Router Test")
    parser.add_argument("--task", default="chat", help="Task type")
    parser.add_argument("--prompt", default="Hello, FinSavvyAI!", help="Test prompt")
    parser.add_argument("--openclaw", action="store_true", help="Force OpenCLaw backend")
    args = parser.parse_args()

    router = get_hybrid_router()
    logger.info("Hybrid Router Status", available=router.is_available())
    logger.info("Routing test", task=args.task, prompt=args.prompt,
                routed_to=router.route(args.task, args.prompt))

    if args.openclaw:
        result = await router.route_async(task_type=args.task, prompt=args.prompt)
        logger.info("Result", result=str(result))
