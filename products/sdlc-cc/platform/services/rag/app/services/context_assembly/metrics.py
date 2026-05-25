"""
Context Assembly Metrics

Quality metrics, coverage analysis, and compression statistics.
"""

import logging
from collections import defaultdict
from typing import List, Dict, Any

import numpy as np

from .models import (
    AssemblyRequest,
    ContextChunk,
    CompressionLevel,
)
from .scoring import get_authority_score

logger = logging.getLogger(__name__)


def calculate_content_similarity(content1: str, content2: str) -> float:
    """Calculate similarity between two content pieces (0-1)."""
    words1 = set(content1.lower().split())
    words2 = set(content2.lower().split())
    if not words1 or not words2:
        return 0.0
    intersection = len(words1.intersection(words2))
    union = len(words1.union(words2))
    return intersection / union if union > 0 else 0.0


def calculate_quality_metrics(
    chunks: List[ContextChunk],
    request: AssemblyRequest,
) -> Dict[str, float]:
    """Calculate quality metrics for assembled context."""
    if not chunks:
        return {}

    metrics = {}
    metrics["avg_importance"] = sum(
        c.importance_score for c in chunks
    ) / len(chunks)
    metrics["avg_coherence"] = sum(
        c.coherence_score for c in chunks
    ) / len(chunks)

    if len(chunks) > 1:
        total_sim = 0
        comparisons = 0
        for i in range(len(chunks)):
            for j in range(i + 1, len(chunks)):
                similarity = calculate_content_similarity(
                    chunks[i].processed_content,
                    chunks[j].processed_content,
                )
                total_sim += similarity
                comparisons += 1
        metrics["content_diversity"] = (
            1 - (total_sim / comparisons) if comparisons > 0 else 1.0
        )
    else:
        metrics["content_diversity"] = 1.0

    authoritative = sum(
        1
        for c in chunks
        if get_authority_score(c.original_chunk) > 0.7
    )
    metrics["authority_coverage"] = authoritative / len(chunks)

    if request.compression_level != CompressionLevel.NONE:
        compressed = [c for c in chunks if c.compression_applied]
        if compressed:
            avg_comp = np.mean(
                [c.metadata.get("compression_ratio", 0) for c in compressed]
            )
            metrics["compression_effectiveness"] = float(avg_comp)
        else:
            metrics["compression_effectiveness"] = 0.0
    else:
        metrics["compression_effectiveness"] = 0.0

    total_tokens = sum(c.token_count for c in chunks)
    metrics["token_utilization"] = total_tokens / request.max_tokens

    return metrics


def analyze_coverage(
    chunks: List[ContextChunk],
    request: AssemblyRequest,
) -> Dict[str, Any]:
    """Analyze coverage of assembled context."""
    analysis: Dict[str, Any] = {}

    if request.query_analysis:
        query_keywords = set(request.query_analysis.keywords or [])
        covered_keywords = set()
        for chunk in chunks:
            content_words = set(chunk.processed_content.lower().split())
            covered_keywords.update(query_keywords.intersection(content_words))
        if query_keywords:
            analysis["keyword_coverage"] = len(covered_keywords) / len(
                query_keywords
            )
            analysis["covered_keywords"] = list(covered_keywords)
            analysis["missed_keywords"] = list(
                query_keywords - covered_keywords
            )
        else:
            analysis["keyword_coverage"] = 1.0

    sources = set(
        chunk.citation_info.get("source", "Unknown") for chunk in chunks
    )
    analysis["source_diversity"] = len(sources)
    analysis["unique_sources"] = list(sources)

    content_types: Dict[str, int] = defaultdict(int)
    for chunk in chunks:
        ct = chunk.metadata.get("chunk_type", "text")
        content_types[ct] += 1
    analysis["content_type_distribution"] = dict(content_types)

    publication_years = []
    for chunk in chunks:
        pub_date = chunk.citation_info.get("publication_date", "")
        if pub_date and pub_date.isdigit():
            publication_years.append(int(pub_date))
    if publication_years:
        analysis["temporal_span"] = {
            "earliest": min(publication_years),
            "latest": max(publication_years),
            "range": max(publication_years) - min(publication_years),
        }

    return analysis


def calculate_compression_stats(
    original_chunks: List[ContextChunk],
    final_chunks: List[ContextChunk],
    request: AssemblyRequest,
) -> Dict[str, Any]:
    """Calculate compression statistics."""
    stats: Dict[str, Any] = {}

    if request.compression_level == CompressionLevel.NONE:
        stats["compression_applied"] = False
        return stats

    original_size = sum(len(c.processed_content) for c in original_chunks)
    final_size = sum(len(c.processed_content) for c in final_chunks)

    if original_size > 0:
        stats["size_reduction_ratio"] = 1 - (final_size / original_size)
        stats["original_size"] = original_size
        stats["final_size"] = final_size
        stats["size_saved"] = original_size - final_size

    original_tokens = sum(c.token_count for c in original_chunks)
    final_tokens = sum(c.token_count for c in final_chunks)

    if original_tokens > 0:
        stats["token_reduction_ratio"] = 1 - (final_tokens / original_tokens)
        stats["original_tokens"] = original_tokens
        stats["final_tokens"] = final_tokens
        stats["tokens_saved"] = original_tokens - final_tokens

    compressed_chunks = [c for c in final_chunks if c.compression_applied]
    stats["chunks_compressed"] = len(compressed_chunks)
    stats["compression_applied"] = True

    if compressed_chunks:
        ratios = [
            c.metadata.get("compression_ratio", 0) for c in compressed_chunks
        ]
        stats["avg_compression_ratio"] = float(np.mean(ratios))
        stats["max_compression_ratio"] = max(ratios)
        stats["min_compression_ratio"] = min(ratios)

    return stats
