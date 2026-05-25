"""
Context Assembly Compression

Content compression strategies for reducing token usage.
"""

import re
import logging
from typing import List

from .models import (
    AssemblyRequest,
    ContextChunk,
    CompressionLevel,
)

logger = logging.getLogger(__name__)


async def apply_compression(
    chunks: List[ContextChunk],
    request: AssemblyRequest,
    count_tokens_fn,
) -> List[ContextChunk]:
    """Apply compression to chunks."""
    if request.compression_level == CompressionLevel.NONE:
        return chunks

    try:
        compression_ratio = get_compression_ratio(request.compression_level)
        compressed_chunks = []

        for chunk in chunks:
            compressed_content = await compress_content(
                chunk.processed_content, compression_ratio
            )
            new_token_count = count_tokens_fn(
                compressed_content, request.context_window_type
            )

            compressed_chunk = ContextChunk(
                original_chunk=chunk.original_chunk,
                processed_content=compressed_content,
                token_count=new_token_count,
                importance_score=chunk.importance_score,
                coherence_score=chunk.coherence_score,
                redundancy_score=chunk.redundancy_score,
                citation_info=chunk.citation_info,
                metadata={
                    **chunk.metadata,
                    "compression_applied": True,
                    "original_length": len(chunk.processed_content),
                    "compressed_length": len(compressed_content),
                    "compression_ratio": 1
                    - (len(compressed_content) / len(chunk.processed_content)),
                },
                compression_applied=True,
                truncation_applied=chunk.truncation_applied,
            )
            compressed_chunks.append(compressed_chunk)

        return compressed_chunks

    except Exception as e:
        logger.error(f"Compression failed: {e}")
        return chunks


def get_compression_ratio(compression_level: CompressionLevel) -> float:
    """Get compression ratio for compression level (0-1)."""
    ratios = {
        CompressionLevel.LIGHT: 0.1,
        CompressionLevel.MODERATE: 0.3,
        CompressionLevel.AGGRESSIVE: 0.5,
        CompressionLevel.EXTREME: 0.7,
    }
    return ratios.get(compression_level, 0.0)


async def compress_content(content: str, compression_ratio: float) -> str:
    """Compress content by specified ratio."""
    if compression_ratio <= 0:
        return content

    try:
        sentences = re.split(r"(?<=[.!?])\s+", content.strip())
        sentences = [s.strip() for s in sentences if s.strip()]

        if len(sentences) <= 1:
            return content

        target_sentences = max(
            1, int(len(sentences) * (1 - compression_ratio))
        )

        sentence_scores = []
        for i, sentence in enumerate(sentences):
            score = score_sentence_importance(sentence, i, len(sentences))
            sentence_scores.append((sentence, score))

        sentence_scores.sort(key=lambda x: x[1], reverse=True)
        selected = [s for s, _ in sentence_scores[:target_sentences]]
        selected.sort(key=lambda s: sentences.index(s))

        return " ".join(selected)

    except Exception as e:
        logger.warning(f"Content compression failed: {e}")
        return content


def score_sentence_importance(
    sentence: str, position: int, total_sentences: int
) -> float:
    """Score sentence importance for compression."""
    score = 0.0

    length = len(sentence.split())
    if 10 <= length <= 20:
        score += 0.3
    elif 5 <= length <= 30:
        score += 0.2

    if position == 0 or position == total_sentences - 1:
        score += 0.3
    elif position < 3 or position > total_sentences - 4:
        score += 0.1

    important_words = [
        "important", "significant", "crucial", "essential", "key",
        "main", "primary", "major", "critical", "vital",
    ]
    if any(word in sentence.lower() for word in important_words):
        score += 0.2

    if any(char.isdigit() for char in sentence):
        score += 0.1

    if "?" in sentence or any(
        w in sentence.lower() for w in ["because", "therefore", "thus"]
    ):
        score += 0.1

    return score
