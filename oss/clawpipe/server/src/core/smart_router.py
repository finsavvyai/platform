"""Smart Router — self-learning model selection with outcome tracking."""

import logging
import time
from collections import defaultdict
from typing import Any, Dict, List, Optional, Tuple

from src.core.provider_registry import ProviderRegistry, get_registry
from src.providers.base import BaseProvider

logger = logging.getLogger("finsavvyai.smart_router")


class OutcomeRecord:
    """Tracks success/failure/latency for a provider+model combo."""

    __slots__ = ("successes", "failures", "total_latency_ms", "last_used")

    def __init__(self) -> None:
        self.successes: int = 0
        self.failures: int = 0
        self.total_latency_ms: float = 0.0
        self.last_used: float = 0.0

    @property
    def total(self) -> int:
        return self.successes + self.failures

    @property
    def success_rate(self) -> float:
        return self.successes / self.total if self.total else 0.5

    @property
    def avg_latency_ms(self) -> float:
        return self.total_latency_ms / self.total if self.total else 1000.0

    def record(self, success: bool, latency_ms: float) -> None:
        if success:
            self.successes += 1
        else:
            self.failures += 1
        self.total_latency_ms += latency_ms
        self.last_used = time.monotonic()


class SmartRouter:
    """Self-learning router that improves provider selection over time.

    Scores each provider by: success_rate * (1 / normalized_latency).
    Falls back to the static chain on cold start (< 10 observations).
    """

    COLD_START_THRESHOLD = 10

    def __init__(self, registry: Optional[ProviderRegistry] = None) -> None:
        self._registry = registry or get_registry()
        self._outcomes: Dict[str, OutcomeRecord] = defaultdict(OutcomeRecord)

    def _outcome_key(self, provider_name: str, model: str) -> str:
        return f"{provider_name}:{model}"

    def select_provider(self, model: str) -> Optional[BaseProvider]:
        """Select the best provider for a model based on learned outcomes."""
        chain = self._registry.resolve_provider_chain(model)
        if not chain:
            return None

        # Cold start: use static chain order
        scored = []
        for provider in chain:
            key = self._outcome_key(provider.name, model)
            record = self._outcomes.get(key)
            if record is None or record.total < self.COLD_START_THRESHOLD:
                return chain[0]  # Not enough data, use primary
            scored.append((provider, self._score(record)))

        scored.sort(key=lambda x: x[1], reverse=True)
        best = scored[0][0]
        logger.debug(
            "Smart route",
            model=model,
            provider=best.name,
            score=round(scored[0][1], 3),
        )
        return best

    def select_provider_chain(self, model: str) -> List[BaseProvider]:
        """Return providers ordered by learned performance."""
        chain = self._registry.resolve_provider_chain(model)
        if not chain:
            return []

        scored = []
        for provider in chain:
            key = self._outcome_key(provider.name, model)
            record = self._outcomes.get(key)
            score = self._score(record) if record else 0.5
            scored.append((provider, score))

        scored.sort(key=lambda x: x[1], reverse=True)
        return [p for p, _ in scored]

    def _score(self, record: OutcomeRecord) -> float:
        """Score = success_rate * speed_factor. Higher is better."""
        speed_factor = 1.0 / (1.0 + record.avg_latency_ms / 1000.0)
        return record.success_rate * speed_factor

    def record_outcome(
        self,
        provider_name: str,
        model: str,
        success: bool,
        latency_ms: float,
    ) -> None:
        """Record the outcome of a request for learning."""
        key = self._outcome_key(provider_name, model)
        self._outcomes[key].record(success, latency_ms)

    @property
    def stats(self) -> Dict[str, Any]:
        result = {}
        for key, record in self._outcomes.items():
            result[key] = {
                "total": record.total,
                "success_rate": round(record.success_rate, 3),
                "avg_latency_ms": round(record.avg_latency_ms, 1),
                "score": round(self._score(record), 3),
            }
        return result


# Singleton
_router: Optional[SmartRouter] = None


def get_smart_router() -> SmartRouter:
    """Get or create the singleton SmartRouter."""
    global _router
    if _router is None:
        _router = SmartRouter()
    return _router
