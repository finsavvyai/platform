"""
Context Packer - Token-budget packing and pipeline orchestration.

Merges small chunks, enforces token budgets, and orchestrates
the full compress -> deduplicate -> pack pipeline.
"""

import logging
from typing import Callable, List, Optional

from .config import PackingConfig
from .compress import compress_chunk, estimate_tokens
from .dedup import deduplicate_chunks

logger = logging.getLogger(__name__)


def pack_context(
    chunks: List[str],
    max_tokens: int = 4096,
    token_fn: Optional[Callable[[str], int]] = None,
) -> List[str]:
    """
    Pack chunks into token-efficient groups.

    Merges small chunks together and enforces the token budget.
    Returns a list of packed chunk strings.
    """
    if not chunks:
        return []

    count_tokens = token_fn or estimate_tokens

    packed: List[str] = []
    current_group: List[str] = []
    current_tokens = 0

    for chunk in chunks:
        chunk_tokens = count_tokens(chunk)

        # Skip empty chunks
        if chunk_tokens == 0:
            continue

        # If single chunk exceeds budget, truncate it
        if chunk_tokens > max_tokens:
            if current_group:
                packed.append("\n\n".join(current_group))
                current_group = []
                current_tokens = 0
            truncated = _truncate_to_tokens(
                chunk, max_tokens, count_tokens
            )
            packed.append(truncated)
            continue

        # Check if adding this chunk would exceed budget
        separator_tokens = count_tokens("\n\n") if current_group else 0
        if current_tokens + separator_tokens + chunk_tokens > max_tokens:
            if current_group:
                packed.append("\n\n".join(current_group))
            current_group = [chunk]
            current_tokens = chunk_tokens
        else:
            current_group.append(chunk)
            current_tokens += separator_tokens + chunk_tokens

    # Flush remaining group
    if current_group:
        packed.append("\n\n".join(current_group))

    return packed


def _truncate_to_tokens(
    text: str,
    max_tokens: int,
    count_tokens: Callable[[str], int],
) -> str:
    """Truncate text to fit within token budget."""
    if count_tokens(text) <= max_tokens:
        return text

    # Binary search for the right length
    low, high = 0, len(text)
    while low < high:
        mid = (low + high + 1) // 2
        if count_tokens(text[:mid]) <= max_tokens:
            low = mid
        else:
            high = mid - 1

    return text[:low]


def pack_and_compress(
    chunks: List[str],
    config: Optional[PackingConfig] = None,
    token_fn: Optional[Callable[[str], int]] = None,
) -> List[str]:
    """
    Full context packing pipeline: compress, deduplicate, pack.

    This is the main entry point for integrating context packing
    into the RAG pipeline.
    """
    if config is None:
        config = PackingConfig.from_env()

    if not config.enabled:
        return list(chunks)

    if not chunks:
        return []

    count_tokens = token_fn or estimate_tokens

    # Step 1: Compress each chunk
    compressed = [compress_chunk(c) for c in chunks]
    compressed = [c for c in compressed if c]

    # Step 2: Deduplicate
    deduped = deduplicate_chunks(
        compressed, config.similarity_threshold
    )

    # Step 3: Pack into token-budget groups
    packed = pack_context(
        deduped, config.max_tokens, count_tokens
    )

    # Log savings
    original_tokens = sum(count_tokens(c) for c in chunks)
    packed_tokens = sum(count_tokens(c) for c in packed)
    if original_tokens > 0:
        savings = (1 - packed_tokens / original_tokens) * 100
        logger.info(
            f"Context packing: {original_tokens} -> {packed_tokens} "
            f"tokens ({savings:.1f}% savings)"
        )

    return packed
