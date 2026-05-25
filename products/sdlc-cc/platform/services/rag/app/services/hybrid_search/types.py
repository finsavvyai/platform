"""
Hybrid Search Types

Data models for hybrid search results and configuration.
"""

import os
from dataclasses import dataclass, field
from typing import Any, Dict, Optional


@dataclass
class ScoredResult:
    """A search result with scoring metadata."""

    doc_id: str
    score: float
    content: str
    metadata: Dict[str, Any] = field(default_factory=dict)
    chunk_id: Optional[str] = None
    document_id: Optional[str] = None
    source: str = ""  # "sparse", "dense", or "fused"


@dataclass
class HybridSearchConfig:
    """Configuration for hybrid search behavior.

    Loaded from environment variables with sensible defaults.
    HYBRID_SEARCH_ENABLED: toggle hybrid search on/off
    HYBRID_SEARCH_ALPHA: weight between sparse (0.0) and dense (1.0)
    HYBRID_SEARCH_RRF_K: RRF constant (default 60, per original paper)
    HYBRID_SEARCH_SPARSE_TOP_K_MULTIPLIER: over-fetch factor for sparse
    HYBRID_SEARCH_DENSE_TOP_K_MULTIPLIER: over-fetch factor for dense
    """

    enabled: bool = True
    alpha: float = 0.5
    rrf_k: int = 60
    sparse_top_k_multiplier: int = 3
    dense_top_k_multiplier: int = 3

    @classmethod
    def from_env(cls) -> "HybridSearchConfig":
        """Build config from environment variables."""
        return cls(
            enabled=os.getenv("HYBRID_SEARCH_ENABLED", "true").lower()
            in ("true", "1", "yes"),
            alpha=float(os.getenv("HYBRID_SEARCH_ALPHA", "0.5")),
            rrf_k=int(os.getenv("HYBRID_SEARCH_RRF_K", "60")),
            sparse_top_k_multiplier=int(
                os.getenv("HYBRID_SEARCH_SPARSE_TOP_K_MULTIPLIER", "3")
            ),
            dense_top_k_multiplier=int(
                os.getenv("HYBRID_SEARCH_DENSE_TOP_K_MULTIPLIER", "3")
            ),
        )
