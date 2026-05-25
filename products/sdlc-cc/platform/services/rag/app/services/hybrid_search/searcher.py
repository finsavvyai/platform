"""
Hybrid Searcher

Combines sparse (TF-IDF / BM25-style) and dense (pgvector cosine similarity)
search using Reciprocal Rank Fusion for better retrieval quality.
"""

import logging
import time
from typing import Dict, List, Optional

from .fusion import reciprocal_rank_fusion
from .sparse import sparse_search
from .types import HybridSearchConfig, ScoredResult

logger = logging.getLogger(__name__)


class HybridSearcher:
    """Combines sparse keyword search with dense vector search via RRF."""

    def __init__(self, config: Optional[HybridSearchConfig] = None):
        self.config = config or HybridSearchConfig.from_env()

    async def search(
        self,
        query: str,
        dense_results: List[ScoredResult],
        corpus_chunks: Optional[List[Dict]] = None,
        top_k: int = 10,
        alpha: Optional[float] = None,
    ) -> List[ScoredResult]:
        """Run hybrid search combining sparse + dense, fused with RRF.

        Args:
            query: the user query string.
            dense_results: pre-computed dense (embedding) search results.
            corpus_chunks: optional list of dicts with 'doc_id', 'content',
                           'metadata' for sparse search. When None, sparse
                           search is skipped and only dense results are used.
            top_k: number of final results to return.
            alpha: weight override (0.0 = sparse only, 1.0 = dense only).
                   Falls back to ``self.config.alpha``.

        Returns:
            Fused and re-ranked list of ``ScoredResult``.
        """
        effective_alpha = alpha if alpha is not None else self.config.alpha
        start = time.monotonic()

        # Sparse search over provided corpus chunks
        sparse_results: List[ScoredResult] = []
        if corpus_chunks and effective_alpha < 1.0:
            sparse_top_k = top_k * self.config.sparse_top_k_multiplier
            sparse_results = sparse_search(query, corpus_chunks, sparse_top_k)

        # Dense results are passed in (already computed by pgvector)
        dense_top = dense_results[: top_k * self.config.dense_top_k_multiplier]

        # Fuse with RRF
        fused = reciprocal_rank_fusion(
            [sparse_results, dense_top],
            k=self.config.rrf_k,
            weights=[1.0 - effective_alpha, effective_alpha],
        )

        elapsed_ms = (time.monotonic() - start) * 1000
        logger.debug(
            "Hybrid search completed in %.1fms — sparse=%d dense=%d fused=%d",
            elapsed_ms,
            len(sparse_results),
            len(dense_top),
            len(fused),
        )

        return fused[:top_k]
