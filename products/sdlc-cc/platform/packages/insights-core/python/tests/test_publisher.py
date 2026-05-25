"""Tests for the Python signal publisher."""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone

import pytest

from insights_core import Publisher, Source, SignalEvent


class FakeTransport:
    def __init__(self, fail: bool = False) -> None:
        self.subjects: list[str] = []
        self.fail = fail

    async def publish(self, subject: str, data: bytes) -> None:
        if self.fail:
            raise RuntimeError("boom")
        self.subjects.append(subject)


def _ev() -> SignalEvent:
    now = datetime.now(timezone.utc)
    return SignalEvent(
        id="x", tenant_id="t", source=Source.LLM_GATEWAY,
        event_type="request", occurred_at=now, ingested_at=now,
    )


@pytest.mark.asyncio
async def test_publisher_emits_on_subject() -> None:
    ft = FakeTransport()
    pub = Publisher(ft)
    await pub.start()
    pub.emit(_ev())
    await asyncio.sleep(0.05)
    await pub.stop()
    assert ft.subjects == ["signals.llm_gateway.request"]
    assert pub.stats.published == 1


@pytest.mark.asyncio
async def test_publisher_rejects_missing_fields() -> None:
    pub = Publisher(FakeTransport())
    bad = _ev()
    bad.tenant_id = ""
    with pytest.raises(ValueError):
        pub.emit(bad)


@pytest.mark.asyncio
async def test_publisher_counts_failures() -> None:
    ft = FakeTransport(fail=True)
    pub = Publisher(ft)
    await pub.start()
    pub.emit(_ev())
    await asyncio.sleep(0.05)
    await pub.stop()
    assert pub.stats.failed == 1
