"""
Context Packer - Chunk deduplication.

Removes near-duplicate chunks using sequence similarity matching.
"""

import logging
from difflib import SequenceMatcher
from typing import List

logger = logging.getLogger(__name__)


def deduplicate_chunks(
    chunks: List[str],
    similarity_threshold: float = 0.9,
) -> List[str]:
    """
    Remove near-duplicate chunks using sequence similarity.

    Keeps the first occurrence when two chunks exceed the
    similarity threshold.
    """
    if len(chunks) <= 1:
        return list(chunks)

    kept: List[str] = []
    for chunk in chunks:
        is_duplicate = False
        for existing in kept:
            similarity = _text_similarity(chunk, existing)
            if similarity >= similarity_threshold:
                is_duplicate = True
                break
        if not is_duplicate:
            kept.append(chunk)

    removed = len(chunks) - len(kept)
    if removed > 0:
        logger.info(
            f"Deduplicated {removed}/{len(chunks)} chunks "
            f"(threshold={similarity_threshold})"
        )

    return kept


def _text_similarity(a: str, b: str) -> float:
    """Calculate similarity ratio between two texts."""
    if not a or not b:
        return 0.0
    # Use truncated comparison for performance on large texts
    max_compare = 2000
    a_trunc = a[:max_compare]
    b_trunc = b[:max_compare]
    return SequenceMatcher(None, a_trunc, b_trunc).ratio()
