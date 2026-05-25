#!/usr/bin/env python3
"""Retry logic with exponential backoff for skill execution."""

import asyncio
import logging
from typing import Any, Callable, Dict, Optional

logger = logging.getLogger("finsavvyai.skills")

DEFAULT_MAX_RETRIES = 3
DEFAULT_BASE_DELAY = 1.0
DEFAULT_MAX_DELAY = 30.0
DEFAULT_TIMEOUT = 60.0


async def execute_with_retry(
    handler: Callable,
    params: Dict[str, Any],
    max_retries: int = DEFAULT_MAX_RETRIES,
    base_delay: float = DEFAULT_BASE_DELAY,
    max_delay: float = DEFAULT_MAX_DELAY,
    timeout: float = DEFAULT_TIMEOUT,
    skill_id: str = "",
) -> Dict[str, Any]:
    """Execute a handler with exponential backoff retry.

    Args:
        handler: Async callable to execute
        params: Parameters to pass to the handler
        max_retries: Maximum number of retry attempts
        base_delay: Initial delay between retries in seconds
        max_delay: Maximum delay between retries
        timeout: Per-attempt timeout in seconds
        skill_id: Skill identifier for logging

    Returns:
        Handler result dict, or error dict on failure
    """
    last_error: Optional[Exception] = None

    for attempt in range(max_retries + 1):
        try:
            result = await asyncio.wait_for(
                handler(params),
                timeout=timeout,
            )
            if attempt > 0:
                logger.info(
                    "Skill %s succeeded on attempt %d",
                    skill_id, attempt + 1,
                )
            return result
        except asyncio.TimeoutError:
            last_error = TimeoutError(
                f"Skill {skill_id} timed out after {timeout}s"
            )
            logger.warning(
                "Skill %s attempt %d timed out after %ss",
                skill_id, attempt + 1, timeout,
            )
        except Exception as e:
            last_error = e
            logger.warning(
                "Skill %s attempt %d failed: %s",
                skill_id, attempt + 1, e,
            )

        if attempt < max_retries:
            delay = min(base_delay * (2 ** attempt), max_delay)
            logger.info(
                "Retrying skill %s in %.1fs (attempt %d/%d)",
                skill_id, delay, attempt + 2, max_retries + 1,
            )
            await asyncio.sleep(delay)

    return {
        "error": str(last_error),
        "status": "max_retries_exceeded",
        "skill_id": skill_id,
        "attempts": max_retries + 1,
    }
