"""Telemetry -- per-request metrics tracking.

Tracks cost, tokens, latency, cache hits, and booster hits.
"""

from __future__ import annotations

import math
import time
from dataclasses import dataclass, field

from .types import TelemetrySnapshot


@dataclass
class RequestRecord:
    """A single recorded request."""

    provider: str
    model: str
    tokens_in: int
    tokens_out: int
    latency_ms: int
    cost_usd: float
    cached: bool
    boosted: bool
    timestamp: float = field(default_factory=time.time)


COST_TABLE: dict[str, float] = {
    "deepseek:deepseek-chat": 0.00014,
    "openai:gpt-4o-mini": 0.00015,
    "anthropic:claude-3-haiku": 0.00025,
    "openai:gpt-4o": 0.0025,
    "anthropic:claude-sonnet-4": 0.003,
    "anthropic:claude-opus-4": 0.015,
    "groq:llama-3.1-70b": 0.00059,
    "mistral:mistral-large": 0.002,
}


class Telemetry:
    """Per-request metrics tracking."""

    def __init__(self, max_records: int = 10_000) -> None:
        self._records: list[RequestRecord] = []
        self._max_records = max_records

    def estimate_cost(
        self, provider: str, model: str, tokens_in: int, tokens_out: int
    ) -> float:
        """Estimate cost in USD for a request."""
        key = f"{provider}:{model}"
        rate = COST_TABLE.get(key, 0.001)
        return ((tokens_in + tokens_out) / 1000) * rate

    def record(self, **kwargs: object) -> None:
        """Record a completed request."""
        if len(self._records) >= self._max_records:
            half = math.ceil(self._max_records * 0.5)
            self._records = self._records[-half:]
        self._records.append(RequestRecord(**kwargs))  # type: ignore[arg-type]

    def snapshot(self) -> TelemetrySnapshot:
        """Get aggregate telemetry snapshot."""
        r = self._records
        if not r:
            return TelemetrySnapshot()

        total_tokens_in = 0
        total_tokens_out = 0
        total_cost_usd = 0.0
        total_latency = 0
        cache_hits = 0
        booster_hits = 0
        model_stats: dict[str, dict[str, float]] = {}

        for rec in r:
            total_tokens_in += rec.tokens_in
            total_tokens_out += rec.tokens_out
            total_cost_usd += rec.cost_usd
            total_latency += rec.latency_ms
            if rec.cached:
                cache_hits += 1
            if rec.boosted:
                booster_hits += 1

            key = f"{rec.provider}:{rec.model}"
            if key not in model_stats:
                model_stats[key] = {"calls": 0, "cost": 0.0}
            model_stats[key]["calls"] += 1
            model_stats[key]["cost"] += rec.cost_usd

        top_models = sorted(
            [{"model": k, **v} for k, v in model_stats.items()],
            key=lambda x: x["calls"],
            reverse=True,
        )[:5]

        hit_rate = f"{(cache_hits / len(r) * 100):.1f}" if r else "0.0"

        return TelemetrySnapshot(
            total_requests=len(r),
            total_tokens_in=total_tokens_in,
            total_tokens_out=total_tokens_out,
            total_cost_usd=round(total_cost_usd, 4),
            total_saved_by_cache=cache_hits,
            total_saved_by_booster=booster_hits,
            avg_latency_ms=round(total_latency / len(r)),
            cache_hit_rate=f"{hit_rate}%",
            top_models=top_models,
        )

    def reset(self) -> None:
        """Reset all telemetry data."""
        self._records.clear()
