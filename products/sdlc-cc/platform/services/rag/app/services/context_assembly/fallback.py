"""
Context Assembly Fallback

Fallback assembly strategy when main assembly fails.
"""

import logging

from .models import (
    AssemblyRequest,
    AssemblyResult,
    AssemblyStrategy,
    CompressionLevel,
    ContextChunk,
)
from .assembly import truncate_content
from .preprocessing import prepare_citation_info

logger = logging.getLogger(__name__)


async def fallback_assembly(
    request: AssemblyRequest, count_tokens_fn
) -> AssemblyResult:
    """Fallback assembly when main assembly fails."""
    logger.warning("Using fallback assembly strategy")
    try:
        chunks_content = [c.content for c in request.chunks]
        assembled = request.chunk_separator.join(chunks_content)

        if request.allow_truncation:
            cur = count_tokens_fn(assembled, request.context_window_type)
            if cur > request.max_tokens:
                assembled = truncate_content(
                    assembled,
                    request.max_tokens,
                    request.context_window_type,
                )

        ctx_chunks = [
            ContextChunk(
                original_chunk=c,
                processed_content=c.content,
                token_count=count_tokens_fn(
                    c.content, request.context_window_type
                ),
                importance_score=0.5,
                coherence_score=0.5,
                redundancy_score=1.0,
                citation_info=prepare_citation_info(c, request),
                metadata={"fallback": True},
            )
            for c in request.chunks
        ]

        return AssemblyResult(
            assembled_context=assembled,
            context_chunks=ctx_chunks,
            total_tokens=count_tokens_fn(
                assembled, request.context_window_type
            ),
            assembly_strategy=AssemblyStrategy.SEQUENTIAL,
            compression_level=CompressionLevel.NONE,
            assembly_time_ms=0.0,
            compression_time_ms=0.0,
            redundancy_removal_time_ms=0.0,
            quality_metrics={"fallback_used": True},
            citations=[],
            truncated_chunks=[],
            compression_stats={"fallback": True},
            coverage_analysis={"fallback": True},
            assembly_metadata={"fallback": True},
        )

    except Exception as e:
        logger.error(f"Fallback assembly failed: {e}")
        return AssemblyResult(
            assembled_context="",
            context_chunks=[],
            total_tokens=0,
            assembly_strategy=AssemblyStrategy.SEQUENTIAL,
            compression_level=CompressionLevel.NONE,
            assembly_time_ms=0.0,
            compression_time_ms=0.0,
            redundancy_removal_time_ms=0.0,
            quality_metrics={"error": str(e)},
            citations=[],
            truncated_chunks=[],
            compression_stats={"error": True},
            coverage_analysis={"error": True},
            assembly_metadata={"error": True},
        )
