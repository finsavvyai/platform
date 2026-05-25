"""Webhook deduplication — prevents replay attacks and duplicate processing."""

import logging
import time
import uuid
from collections import OrderedDict

logger = logging.getLogger("finsavvyai.channels.webhook")


class WebhookDedup:
    """TTL-based deduplication of webhook deliveries.

    Uses an OrderedDict for O(1) lookup and efficient TTL cleanup.
    """

    def __init__(self, max_size: int = 10000, ttl_seconds: float = 300.0):
        self._seen: OrderedDict[str, float] = OrderedDict()
        self.max_size = max_size
        self.ttl_seconds = ttl_seconds

    def is_duplicate(self, webhook_id: str) -> bool:
        """Check if a webhook ID has been seen recently.

        Returns True if duplicate (should be rejected).
        Returns False if new (should be processed).
        """
        self._cleanup_expired()

        if webhook_id in self._seen:
            logger.warning("Duplicate webhook rejected: %s", webhook_id)
            return True

        # Evict oldest if at capacity
        while len(self._seen) >= self.max_size:
            self._seen.popitem(last=False)

        self._seen[webhook_id] = time.time()
        return False

    def _cleanup_expired(self) -> None:
        """Remove entries older than TTL."""
        cutoff = time.time() - self.ttl_seconds
        # OrderedDict is ordered by insertion, so pop from front
        while self._seen:
            oldest_key = next(iter(self._seen))
            if self._seen[oldest_key] < cutoff:
                self._seen.popitem(last=False)
            else:
                break

    def generate_idempotency_key(self) -> str:
        """Generate a unique idempotency key for outbound responses."""
        return f"idem-{uuid.uuid4().hex[:16]}"

    @property
    def size(self) -> int:
        """Return the number of tracked webhook IDs."""
        return len(self._seen)

    def clear(self) -> None:
        """Remove all tracked webhook IDs."""
        self._seen.clear()
