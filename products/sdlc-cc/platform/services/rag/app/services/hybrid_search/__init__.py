"""
Hybrid Search with Reciprocal Rank Fusion (RRF)

Combines sparse (BM25/TF-IDF keyword) and dense (pgvector embedding)
search for higher retrieval quality than either method alone.
"""

from .types import ScoredResult, HybridSearchConfig
from .searcher import HybridSearcher
from .fusion import reciprocal_rank_fusion
from .sparse import sparse_search

__all__ = [
    "ScoredResult",
    "HybridSearchConfig",
    "HybridSearcher",
    "reciprocal_rank_fusion",
    "sparse_search",
]
