"""Non-blocking signal publisher for llm-gateway/dlp/rag/etc."""

from __future__ import annotations

import asyncio
import json
from dataclasses import dataclass
from typing import Protocol

from insights_core.types import SignalEvent


class Transport(Protocol):
    async def publish(self, subject: str, data: bytes) -> None: ...


@dataclass
class Stats:
    published: int = 0
    failed: int = 0
    dropped: int = 0


class Publisher:
    """Fire-and-forget publisher. Emit returns synchronously; actual send runs
    on a background task. Back-pressure drops events to protect the hot path.
    """

    def __init__(self, transport: Transport, *, queue_size: int = 1024) -> None:
        self._transport = transport
        self._queue: asyncio.Queue[tuple[str, bytes]] = asyncio.Queue(maxsize=queue_size)
        self._stats = Stats()
        self._task: asyncio.Task[None] | None = None

    async def start(self) -> None:
        if self._task is None or self._task.done():
            self._task = asyncio.create_task(self._run(), name="insights-publisher")

    async def stop(self) -> None:
        if self._task:
            await self._queue.put(("__stop__", b""))
            await self._task
            self._task = None

    def emit(self, ev: SignalEvent) -> None:
        if not ev.source or not ev.tenant_id:
            raise ValueError("publisher: source and tenant_id required")
        subject = f"signals.{ev.source.value}.{ev.event_type}"
        payload = json.dumps(ev.to_json()).encode()
        try:
            self._queue.put_nowait((subject, payload))
        except asyncio.QueueFull:
            self._stats.dropped += 1

    async def _run(self) -> None:
        while True:
            subject, data = await self._queue.get()
            if subject == "__stop__":
                return
            try:
                await self._transport.publish(subject, data)
                self._stats.published += 1
            except Exception:
                self._stats.failed += 1

    @property
    def stats(self) -> Stats:
        return Stats(
            published=self._stats.published,
            failed=self._stats.failed,
            dropped=self._stats.dropped,
        )
