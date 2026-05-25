"""
Reciprocal Rank Fusion (RRF)

Merges multiple ranked result lists into a single list using the RRF
algorithm: score = sum( weight_i / (k + rank_i) ).

Reference: Cormack, Clarke, Buettcher (2009) — "Reciprocal Rank Fusion
outperforms Condorcet and individual Rank Learning Methods".
"""

from collections import defaultdict
from typing import Dict, List, Optional

from .types import ScoredResult


def reciprocal_rank_fusion(
    results_lists: List[List[ScoredResult]],
    k: int = 60,
    weights: Optional[List[float]] = None,
) -> List[ScoredResult]:
    """Merge multiple ranked lists using Reciprocal Rank Fusion.

    Args:
        results_lists: list of ranked result lists to fuse.
        k: RRF constant (default 60 per original paper).
        weights: optional per-list weights. Defaults to equal weighting.

    Returns:
        Merged results sorted by descending RRF score.
    """
    if not results_lists:
        return []

    effective_weights = weights or [1.0] * len(results_lists)
    if len(effective_weights) != len(results_lists):
        effective_weights = [1.0] * len(results_lists)

    fused_scores: Dict[str, float] = defaultdict(float)
    result_map: Dict[str, ScoredResult] = {}

    for list_idx, result_list in enumerate(results_lists):
        w = effective_weights[list_idx]
        for rank, result in enumerate(result_list, start=1):
            key = result.chunk_id or result.doc_id
            fused_scores[key] += w / (k + rank)
            # Retain the result instance with the highest original score
            if key not in result_map or result.score > result_map[key].score:
                result_map[key] = result

    fused: List[ScoredResult] = []
    for key, rrf_score in fused_scores.items():
        original = result_map[key]
        fused.append(
            ScoredResult(
                doc_id=original.doc_id,
                score=rrf_score,
                content=original.content,
                metadata=original.metadata,
                chunk_id=original.chunk_id,
                document_id=original.document_id,
                source="fused",
            )
        )

    fused.sort(key=lambda r: r.score, reverse=True)
    return fused
