"""
FinSavvyAI Vision Rate Limiter

Token-bucket rate limiter combined with concurrency semaphore
for OpenClaw vision API calls.
"""

import asyncio
import logging
import time
from contextlib import asynccontextmanager
from typing import Tuple

logger = logging.getLogger("finsavvyai.vision_rate_limiter")


class VisionRateLimiter:
    """Rate limiter for OpenClaw vision API calls.

    Combines a token-bucket rate limiter (requests per second) with an
    asyncio.Semaphore for concurrent-request limiting.
    """

    def __init__(
        self,
        rate: float = 5.0,
        max_concurrent: int = 5,
    ):
        self.rate = rate
        self.max_concurrent = max_concurrent
        self._tokens = rate
        self._last_update = time.monotonic()
        self._lock = asyncio.Lock()
        self._semaphore = asyncio.Semaphore(max_concurrent)
        self._total_acquired = 0
        self._total_rejected = 0

    async def acquire(self) -> None:
        """Wait until a rate-limit token is available, then consume it."""
        async with self._lock:
            now = time.monotonic()
            elapsed = now - self._last_update
            self._tokens = min(self.rate, self._tokens + elapsed * self.rate)
            self._last_update = now

            while self._tokens < 1.0:
                wait = (1.0 - self._tokens) / self.rate
                await asyncio.sleep(wait)
                now = time.monotonic()
                elapsed = now - self._last_update
                self._tokens = min(self.rate, self._tokens + elapsed * self.rate)
                self._last_update = now

            self._tokens -= 1.0
            self._total_acquired += 1

    def try_acquire(self) -> Tuple[bool, float]:
        """Non-blocking check. Returns (allowed, wait_seconds)."""
        now = time.monotonic()
        elapsed = now - self._last_update
        tokens = min(self.rate, self._tokens + elapsed * self.rate)
        if tokens >= 1.0:
            return True, 0.0
        wait = (1.0 - tokens) / self.rate
        return False, wait

    @asynccontextmanager
    async def throttle(self):
        """Context manager: acquires rate-limit token + semaphore slot."""
        await self.acquire()
        async with self._semaphore:
            yield

    def get_stats(self) -> dict:
        """Return rate-limiter statistics."""
        return {
            "rate": self.rate,
            "max_concurrent": self.max_concurrent,
            "tokens_available": round(self._tokens, 2),
            "total_acquired": self._total_acquired,
            "total_rejected": self._total_rejected,
        }
