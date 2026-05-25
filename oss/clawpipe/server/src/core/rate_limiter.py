#!/usr/bin/env python3
"""
FinSavvyAI Rate Limiting
Optimized sliding window rate limiter using deque for O(1) amortized cleanup.
"""

import threading
import time
from collections import defaultdict, deque
from typing import Dict, Tuple


class RateLimiter:
    """Sliding window rate limiter using deque for efficient cleanup."""

    def __init__(self, max_requests: int = 100, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.requests: Dict[str, deque] = defaultdict(deque)
        self._lock = threading.Lock()
        self._last_cleanup = time.monotonic()
        self._cleanup_interval = 300  # Clean stale identifiers every 5 min

    def is_allowed(self, identifier: str) -> Tuple[bool, int]:
        """
        Check if request is allowed.
        Returns: (is_allowed, remaining_requests)
        """
        now = time.monotonic()
        window_start = now - self.window_seconds

        with self._lock:
            window = self.requests[identifier]

            # Efficient cleanup: pop expired entries from the left (oldest first)
            while window and window[0] <= window_start:
                window.popleft()

            # Check limit
            if len(window) >= self.max_requests:
                return False, 0

            # Add current request
            window.append(now)

            # Periodic cleanup of stale identifiers
            if now - self._last_cleanup > self._cleanup_interval:
                self._cleanup_stale(now)

            remaining = self.max_requests - len(window)
            return True, remaining

    def get_remaining(self, identifier: str) -> int:
        """Get remaining requests for identifier."""
        now = time.monotonic()
        window_start = now - self.window_seconds

        with self._lock:
            window = self.requests[identifier]
            while window and window[0] <= window_start:
                window.popleft()
            return max(0, self.max_requests - len(window))

    def _cleanup_stale(self, now: float):
        """Remove identifiers that have no recent requests."""
        window_start = now - self.window_seconds
        stale_keys = [
            key
            for key, window in self.requests.items()
            if not window or window[-1] <= window_start
        ]
        for key in stale_keys:
            del self.requests[key]
        self._last_cleanup = now


def get_client_identifier(request) -> str:
    """Get client identifier for rate limiting.

    Uses a truncated hash of the API key to avoid storing sensitive data.
    """
    import hashlib

    api_key = request.headers.get("Authorization", "").replace("Bearer ", "")
    if api_key:
        # Hash the key so it's not stored in memory or logs
        key_hash = hashlib.sha256(api_key.encode()).hexdigest()[:12]
        return f"key:{key_hash}"

    # Use IP address
    return f"ip:{request.remote}"
