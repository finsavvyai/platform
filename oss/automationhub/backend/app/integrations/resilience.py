"""
Circuit breaker and rate limiter for external integrations (OpenHands, OpenClaw, MCP).

Keep this file under 200 lines. Use from adapters and webhook handlers.
"""

import asyncio
import logging
import time
from enum import Enum
from typing import Callable, Optional

logger = logging.getLogger(__name__)


class CircuitState(str, Enum):
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"


class CircuitBreaker:
    """Simple circuit breaker: open after failure_threshold failures, cooldown_seconds then half-open."""

    def __init__(
        self,
        name: str,
        failure_threshold: int = 5,
        cooldown_seconds: float = 60.0,
    ):
        self.name = name
        self.failure_threshold = failure_threshold
        self.cooldown_seconds = cooldown_seconds
        self._state = CircuitState.CLOSED
        self._failures = 0
        self._last_failure_time: Optional[float] = None
        self._lock = asyncio.Lock()

    @property
    def state(self) -> CircuitState:
        if self._state != CircuitState.OPEN:
            return self._state
        if self._last_failure_time and (time.monotonic() - self._last_failure_time) >= self.cooldown_seconds:
            self._state = CircuitState.HALF_OPEN
            self._failures = 0
        return self._state

    async def call(self, func: Callable, *args, **kwargs):
        async with self._lock:
            s = self.state
            if s == CircuitState.OPEN:
                raise RuntimeError(f"CircuitBreaker[{self.name}] is open")
        try:
            result = await func(*args, **kwargs)
            async with self._lock:
                if self._state == CircuitState.HALF_OPEN:
                    self._state = CircuitState.CLOSED
                    self._failures = 0
            return result
        except Exception as e:
            async with self._lock:
                self._failures += 1
                self._last_failure_time = time.monotonic()
                if self._failures >= self.failure_threshold:
                    self._state = CircuitState.OPEN
                    logger.warning(f"CircuitBreaker[{self.name}] opened after {self._failures} failures")
            raise


class IntegrationRateLimiter:
    """Per-key rate limiter using in-memory counters (use Redis in multi-instance)."""

    def __init__(self, name: str, max_requests: int, window_seconds: int):
        self.name = name
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._counts: dict[str, list[float]] = {}
        self._lock = asyncio.Lock()

    async def is_allowed(self, key: str) -> bool:
        now = time.monotonic()
        cutoff = now - self.window_seconds
        async with self._lock:
            if key not in self._counts:
                self._counts[key] = []
            self._counts[key] = [t for t in self._counts[key] if t > cutoff]
            if len(self._counts[key]) >= self.max_requests:
                return False
            self._counts[key].append(now)
            return True

    async def check_and_raise(self, key: str) -> None:
        if not await self.is_allowed(key):
            raise RuntimeError(
                f"Rate limit exceeded for {self.name} key={key} "
                f"(max {self.max_requests} per {self.window_seconds}s)"
            )
