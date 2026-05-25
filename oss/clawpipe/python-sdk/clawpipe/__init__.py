"""ClawPipe SDK -- The intelligent AI pipeline.

Booster -> Packer -> Cache -> Router -> Gateway -> Learn.
"""

from __future__ import annotations

import asyncio
import time
from typing import Any, Optional

from .booster import Booster
from .cache import Cache
from .gateway import Gateway, GatewayConfig, GatewayError
from .packer import Packer
from .router import Router
from .telemetry import Telemetry
from .types import (
    ClawPipeConfig,
    PipelineMeta,
    PipelineResult,
    PromptOptions,
    RouteDecision,
    TelemetrySnapshot,
)

__all__ = [
    "ClawPipe",
    "ClawPipeConfig",
    "PipelineMeta",
    "PipelineResult",
    "PromptOptions",
    "RouteDecision",
    "TelemetrySnapshot",
    "GatewayError",
]

DEFAULT_GATEWAY = "https://api.clawpipe.ai/v1"


class ClawPipe:
    """ClawPipe client -- runs the full pipeline on every prompt."""

    def __init__(self, config: ClawPipeConfig) -> None:
        self._booster = Booster()
        self._packer = Packer()
        self._cache = Cache(ttl_ms=config.cache_ttl_ms)
        self._router = Router()
        self._gateway = Gateway(
            GatewayConfig(
                gateway_url=config.gateway_url,
                api_key=config.api_key,
                project_id=config.project_id,
            )
        )
        self._telemetry = Telemetry()
        self._enable_booster = config.enable_booster
        self._enable_packer = config.enable_packer
        self._enable_cache = config.enable_cache

    async def prompt(
        self,
        input_text: str,
        *,
        system: str | None = None,
        max_tokens: int | None = None,
        temperature: float | None = None,
        model: str | None = None,
        provider: str | None = None,
    ) -> PipelineResult:
        """Send a prompt through the full pipeline."""
        start = time.time()
        meta = PipelineMeta()
        options: dict[str, Any] = {}
        if system:
            options["system"] = system
        if max_tokens is not None:
            options["max_tokens"] = max_tokens
        if temperature is not None:
            options["temperature"] = temperature

        # Stage 1: Booster
        if self._enable_booster:
            boosted = self._booster.try_resolve(input_text)
            if boosted is not None:
                meta.boosted = True
                return self._finalize(boosted, meta, start, True)

        # Stage 2: Packer
        packed = input_text
        if self._enable_packer:
            result = self._packer.pack(input_text, system)
            packed = result.packed
            meta.packed = True
            meta.context_savings = result.savings

        # Stage 3: Cache
        if self._enable_cache:
            cache_key = self._cache.key(packed, options)
            cached = self._cache.get(cache_key)
            if cached is not None:
                meta.cached = True
                return self._finalize(cached, meta, start, False)

        # Stage 4: Router
        route = self._router.route(packed, model=model, provider=provider)
        meta.route = route.provider
        meta.model = route.model

        # Stage 5: Gateway call
        response = await self._gateway.call(packed, options, route)
        meta.tokens_in = response.tokens_in
        meta.tokens_out = response.tokens_out
        self._router.learn(route, response.latency_ms, response.tokens_out)

        if self._enable_cache:
            self._cache.set(self._cache.key(packed, options), response.text)

        return self._finalize(response.text, meta, start, False)

    def prompt_sync(
        self,
        input_text: str,
        **kwargs: Any,
    ) -> PipelineResult:
        """Synchronous wrapper around prompt()."""
        return asyncio.run(self.prompt(input_text, **kwargs))

    def stats(self) -> TelemetrySnapshot:
        """Get aggregate telemetry snapshot."""
        return self._telemetry.snapshot()

    def _finalize(
        self,
        text: str,
        meta: PipelineMeta,
        start: float,
        is_boosted: bool,
    ) -> PipelineResult:
        meta.latency_ms = int((time.time() - start) * 1000)
        cost = self._telemetry.estimate_cost(
            meta.route, meta.model, meta.tokens_in, meta.tokens_out
        )
        meta.estimated_cost_usd = 0.0 if (is_boosted or meta.cached) else cost
        self._telemetry.record(
            provider=meta.route,
            model=meta.model,
            tokens_in=meta.tokens_in,
            tokens_out=meta.tokens_out,
            latency_ms=meta.latency_ms,
            cost_usd=meta.estimated_cost_usd,
            cached=meta.cached,
            boosted=meta.boosted,
        )
        return PipelineResult(text=text, meta=meta)
