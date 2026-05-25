#!/usr/bin/env python3
"""
Tracing Span Models

SpanContext, Span, and SpanCollector for distributed tracing.
"""

import random
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Dict, List, Optional


def _random_hex(length: int) -> str:
    return "".join(f"{random.getrandbits(8):02x}" for _ in range(length))


def generate_trace_id() -> str:
    """Generate a 32-hex-char (128-bit) trace ID."""
    return _random_hex(16)


def generate_span_id() -> str:
    """Generate a 16-hex-char (64-bit) span ID."""
    return _random_hex(8)


@dataclass
class SpanContext:
    """Minimal span context compatible with W3C Trace Context."""

    trace_id: str
    span_id: str
    parent_span_id: Optional[str] = None
    sampled: bool = True

    def to_traceparent(self) -> str:
        flags = "01" if self.sampled else "00"
        return f"00-{self.trace_id}-{self.span_id}-{flags}"

    @classmethod
    def from_traceparent(cls, header: str) -> Optional["SpanContext"]:
        """Parse a W3C traceparent header."""
        if not header:
            return None
        parts = header.strip().split("-")
        if len(parts) != 4 or parts[0] != "00":
            return None
        try:
            trace_id = parts[1]
            parent_span_id = parts[2]
            sampled = parts[3] == "01"
            if len(trace_id) != 32 or len(parent_span_id) != 16:
                return None
            return cls(trace_id=trace_id, span_id=generate_span_id(),
                       parent_span_id=parent_span_id, sampled=sampled)
        except (IndexError, ValueError):
            return None


@dataclass
class Span:
    """A lightweight trace span."""

    name: str
    context: SpanContext
    service_name: str = "finsavvyai"
    start_time: float = field(default_factory=time.time)
    end_time: Optional[float] = None
    attributes: Dict[str, str] = field(default_factory=dict)
    events: List[Dict] = field(default_factory=list)
    status: str = "OK"

    @property
    def duration_ms(self) -> float:
        end = self.end_time or time.time()
        return (end - self.start_time) * 1000

    def set_attribute(self, key: str, value: str) -> None:
        self.attributes[key] = str(value)

    def add_event(self, name: str, attributes: Optional[Dict] = None) -> None:
        self.events.append({
            "name": name,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "attributes": attributes or {},
        })

    def finish(self, status: str = "OK") -> None:
        self.end_time = time.time()
        self.status = status
        _span_collector.record(self)


class SpanCollector:
    """Collects finished spans for export or inspection."""

    def __init__(self, max_spans: int = 5000):
        self._spans: List[Dict] = []
        self._max = max_spans

    def record(self, span: Span) -> None:
        entry = {
            "trace_id": span.context.trace_id, "span_id": span.context.span_id,
            "parent_span_id": span.context.parent_span_id,
            "name": span.name, "service": span.service_name,
            "start_time": datetime.fromtimestamp(span.start_time, tz=timezone.utc).isoformat(),
            "duration_ms": span.duration_ms, "status": span.status,
            "attributes": span.attributes, "events": span.events,
        }
        self._spans.append(entry)
        if len(self._spans) > self._max:
            self._spans = self._spans[-self._max:]

    def get_recent(self, limit: int = 100) -> List[Dict]:
        return self._spans[-limit:]

    def get_by_trace(self, trace_id: str) -> List[Dict]:
        return [s for s in self._spans if s["trace_id"] == trace_id]

    def clear(self) -> None:
        self._spans.clear()


_span_collector = SpanCollector()


def get_span_collector() -> SpanCollector:
    return _span_collector
