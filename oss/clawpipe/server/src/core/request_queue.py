#!/usr/bin/env python3
"""
Request Queue for High Load Scenarios
Provides queuing and throttling with O(log N) priority insertion via heapq.
"""

import asyncio
import heapq
import logging
import time
from dataclasses import dataclass, field
from typing import Any, Callable, Optional

logger = logging.getLogger("finsavvyai.request_queue")

# Counter for stable sort ordering when priorities are equal
_counter = 0


@dataclass(order=True)
class QueuedRequest:
    """Represents a queued request in the priority heap.

    Heap is a min-heap, so we negate priority (higher priority = lower value).
    The counter ensures FIFO ordering for equal priorities.
    """

    sort_key: tuple = field(init=False, repr=False)
    request_id: str = field(compare=False)
    handler: Callable = field(compare=False)
    args: tuple = field(compare=False)
    kwargs: dict = field(compare=False)
    queued_at: float = field(compare=False)
    priority: int = field(default=0, compare=False)

    def __post_init__(self):
        global _counter
        _counter += 1
        self.sort_key = (-self.priority, _counter)


class RequestQueue:
    """Queue for managing request processing with O(log N) priority insertion."""

    def __init__(self, max_size: int = 1000, max_concurrent: int = 10):
        self.max_size = max_size
        self.max_concurrent = max_concurrent
        self._heap: list = []
        self.active_requests = 0
        self.processed_count = 0
        self.rejected_count = 0
        self._lock = asyncio.Lock()
        self._processing = False
        self._processor_task: Optional[asyncio.Task] = None

    async def enqueue(
        self, request_id: str, handler: Callable, *args, priority: int = 0, **kwargs
    ) -> bool:
        """Add a request to the queue. O(log N) insertion."""
        async with self._lock:
            if len(self._heap) >= self.max_size:
                self.rejected_count += 1
                return False

            queued_request = QueuedRequest(
                request_id=request_id,
                handler=handler,
                args=args,
                kwargs=kwargs,
                queued_at=time.time(),
                priority=priority,
            )

            heapq.heappush(self._heap, queued_request)

            # Start processor if not running
            if not self._processing:
                self._processing = True
                self._processor_task = asyncio.create_task(self._process_queue())

            return True

    async def _process_queue(self):
        """Process queued requests."""
        while True:
            async with self._lock:
                # Check if we can process more requests
                if self.active_requests >= self.max_concurrent:
                    await asyncio.sleep(0.1)
                    continue

                # Check if queue is empty
                if not self._heap:
                    self._processing = False
                    break

                # Get highest priority request (O(log N))
                queued_request = heapq.heappop(self._heap)
                self.active_requests += 1

            # Process request outside lock
            try:
                if asyncio.iscoroutinefunction(queued_request.handler):
                    await queued_request.handler(
                        *queued_request.args, **queued_request.kwargs
                    )
                else:
                    queued_request.handler(
                        *queued_request.args, **queued_request.kwargs
                    )

                self.processed_count += 1
            except Exception as e:
                logger.error(
                    "Error processing queued request %s: %s",
                    queued_request.request_id,
                    e,
                    exc_info=True,
                )
            finally:
                async with self._lock:
                    self.active_requests -= 1

    def get_stats(self) -> dict:
        """Get queue statistics."""
        return {
            "queue_size": len(self._heap),
            "active_requests": self.active_requests,
            "processed_count": self.processed_count,
            "rejected_count": self.rejected_count,
            "max_size": self.max_size,
            "max_concurrent": self.max_concurrent,
        }

    async def wait_for_slot(self, timeout: float = 30.0) -> bool:
        """Wait for an available processing slot."""
        start_time = time.time()
        while time.time() - start_time < timeout:
            async with self._lock:
                if self.active_requests < self.max_concurrent:
                    return True
            await asyncio.sleep(0.1)
        return False
