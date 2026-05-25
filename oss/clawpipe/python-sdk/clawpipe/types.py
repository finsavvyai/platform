"""Shared types for the ClawPipe Python SDK."""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class ClawPipeConfig(BaseModel):
    """Configuration for the ClawPipe client."""

    api_key: str
    project_id: str
    gateway_url: str = "https://api.clawpipe.ai/v1"
    cache_ttl_ms: int = 300_000
    enable_booster: bool = True
    enable_packer: bool = True
    enable_cache: bool = True


class PromptOptions(BaseModel):
    """Options passed alongside a prompt."""

    system: Optional[str] = None
    max_tokens: Optional[int] = None
    temperature: Optional[float] = None
    model: Optional[str] = None
    provider: Optional[str] = None
    task_type: Optional[str] = None


class PipelineMeta(BaseModel):
    """Metadata about how the pipeline processed a request."""

    boosted: bool = False
    cached: bool = False
    packed: bool = False
    context_savings: str = "0%"
    route: str = ""
    model: str = ""
    latency_ms: int = 0
    tokens_in: int = 0
    tokens_out: int = 0
    estimated_cost_usd: float = 0.0


class PipelineResult(BaseModel):
    """Result returned by the pipeline."""

    text: str
    meta: PipelineMeta


class GatewayResponse(BaseModel):
    """Response from the ClawPipe gateway."""

    text: str
    tokens_in: int = Field(alias="tokensIn", default=0)
    tokens_out: int = Field(alias="tokensOut", default=0)
    latency_ms: int = Field(alias="latencyMs", default=0)

    model_config = {"populate_by_name": True}


class TelemetrySnapshot(BaseModel):
    """Aggregate telemetry stats."""

    total_requests: int = 0
    total_tokens_in: int = 0
    total_tokens_out: int = 0
    total_cost_usd: float = 0.0
    total_saved_by_cache: int = 0
    total_saved_by_booster: int = 0
    avg_latency_ms: int = 0
    cache_hit_rate: str = "0.0%"
    top_models: list[dict[str, object]] = Field(default_factory=list)


class RouteDecision(BaseModel):
    """Routing decision from the smart router."""

    provider: str
    model: str
    score: float
    reason: str
