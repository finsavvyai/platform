"""Smart Router -- self-learning model selection.

Classifies prompt complexity and routes to the best model
based on cost, quality, and latency weights.
"""

from __future__ import annotations

import math
import re
from dataclasses import dataclass, field
from typing import Literal, Optional

from .types import RouteDecision


@dataclass
class ModelProfile:
    """A model profile with cost/quality/latency metadata."""

    provider: str
    model: str
    cost_per_1k_tokens: float
    avg_latency_ms: int
    quality_score: float
    max_tokens: int


@dataclass
class LearnedWeight:
    """Accumulated learning data for a provider:model pair."""

    total_calls: int
    avg_latency_ms: float
    avg_tokens_out: float
    score: float


TaskComplexity = Literal["simple", "medium", "complex"]

DEFAULT_MODELS: list[ModelProfile] = [
    ModelProfile("deepseek", "deepseek-chat", 0.14, 800, 0.82, 64000),
    ModelProfile("openai", "gpt-4o-mini", 0.15, 600, 0.85, 128000),
    ModelProfile("anthropic", "claude-3-haiku", 0.25, 500, 0.88, 200000),
    ModelProfile("openai", "gpt-4o", 2.5, 1200, 0.94, 128000),
    ModelProfile("anthropic", "claude-sonnet-4", 3.0, 1000, 0.95, 200000),
    ModelProfile("anthropic", "claude-opus-4", 15.0, 2000, 0.99, 200000),
    ModelProfile("groq", "llama-3.1-70b", 0.59, 300, 0.80, 32000),
    ModelProfile("mistral", "mistral-large", 2.0, 900, 0.90, 128000),
]


class Router:
    """Route prompts to the best provider/model."""

    def __init__(self, models: list[ModelProfile] | None = None) -> None:
        self._models = models or list(DEFAULT_MODELS)
        self._weights: dict[str, LearnedWeight] = {}

    def route(
        self,
        prompt: str,
        *,
        model: str | None = None,
        provider: str | None = None,
        task_type: str | None = None,
    ) -> RouteDecision:
        """Route a prompt to the best provider/model."""
        if model and provider:
            return RouteDecision(
                provider=provider, model=model, score=1.0, reason="explicit"
            )

        complexity = self.classify_complexity(prompt)
        candidates = self._rank_candidates(complexity)

        scored: list[dict] = []
        for c in candidates:
            key = f"{c['provider']}:{c['model']}"
            learned = self._weights.get(key)
            bonus = (learned.score - 0.5) * 0.2 if learned else 0.0
            scored.append({**c, "score": c["score"] + bonus})

        scored.sort(key=lambda x: x["score"], reverse=True)
        best = scored[0]

        return RouteDecision(
            provider=best["provider"],
            model=best["model"],
            score=best["score"],
            reason=f"complexity={complexity}",
        )

    def learn(self, route: RouteDecision, latency_ms: float, tokens_out: int) -> None:
        """Record outcome for self-learning."""
        key = f"{route.provider}:{route.model}"
        existing = self._weights.get(key)

        if not existing:
            self._weights[key] = LearnedWeight(
                total_calls=1,
                avg_latency_ms=latency_ms,
                avg_tokens_out=float(tokens_out),
                score=self._compute_score(latency_ms, tokens_out),
            )
            return

        n = existing.total_calls + 1
        existing.avg_latency_ms += (latency_ms - existing.avg_latency_ms) / n
        existing.avg_tokens_out += (tokens_out - existing.avg_tokens_out) / n
        existing.total_calls = n
        existing.score = self._compute_score(existing.avg_latency_ms, existing.avg_tokens_out)

    def get_weights(self) -> dict[str, LearnedWeight]:
        return dict(self._weights)

    @staticmethod
    def classify_complexity(prompt: str) -> TaskComplexity:
        """Classify prompt complexity based on length and structure."""
        tokens = math.ceil(len(prompt) / 4)
        has_code = bool(
            re.search(r"```[\s\S]+```", prompt)
            or re.search(r"function\s|class\s|const\s", prompt)
        )
        has_multi_step = bool(
            re.search(r"\b(then|after that|next|finally|step \d)\b", prompt, re.I)
        )

        if tokens > 2000 or (has_code and has_multi_step):
            return "complex"
        if tokens > 500 or has_code or has_multi_step:
            return "medium"
        return "simple"

    def _rank_candidates(
        self, complexity: TaskComplexity
    ) -> list[dict]:
        cost_w = 0.6 if complexity == "simple" else 0.3 if complexity == "medium" else 0.1
        quality_w = 0.2 if complexity == "simple" else 0.5 if complexity == "medium" else 0.7
        speed_w = 1 - cost_w - quality_w

        results = []
        for m in self._models:
            cost_score = 1 - min(m.cost_per_1k_tokens / 15, 1)
            quality_score = m.quality_score
            speed_score = 1 - min(m.avg_latency_ms / 3000, 1)
            score = cost_w * cost_score + quality_w * quality_score + speed_w * speed_score
            results.append({
                "provider": m.provider,
                "model": m.model,
                "score": score,
            })
        return results

    @staticmethod
    def _compute_score(latency_ms: float, tokens_out: float) -> float:
        latency_score = 1 - min(latency_ms / 5000, 1)
        efficiency_score = min(tokens_out / 1000, 1)
        return latency_score * 0.5 + efficiency_score * 0.5
