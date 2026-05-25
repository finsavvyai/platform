"""
Context Assembly Window

Token-aware context window assembly with citation integration.
"""

import re
import logging
from typing import List, Dict, Any, Tuple

from .models import AssemblyRequest, ContextChunk

logger = logging.getLogger(__name__)


async def assemble_context_window(
    chunks: List[ContextChunk],
    request: AssemblyRequest,
    count_tokens_fn,
) -> Tuple[str, List[ContextChunk]]:
    """Assemble context within token limits."""
    if not chunks:
        return "", []

    included_chunks = []
    total_tokens = 0
    context_parts = []
    separator = request.chunk_separator

    for chunk in chunks:
        chunk_tokens = chunk.token_count

        if total_tokens + chunk_tokens > request.max_tokens:
            if request.allow_truncation and included_chunks:
                remaining_tokens = request.max_tokens - total_tokens
                if remaining_tokens > 50:
                    truncated_content = truncate_content(
                        chunk.processed_content,
                        remaining_tokens,
                        request.context_window_type,
                    )
                    truncated_chunk = ContextChunk(
                        original_chunk=chunk.original_chunk,
                        processed_content=truncated_content,
                        token_count=remaining_tokens,
                        importance_score=chunk.importance_score,
                        coherence_score=chunk.coherence_score,
                        redundancy_score=chunk.redundancy_score,
                        citation_info=chunk.citation_info,
                        metadata={**chunk.metadata, "truncated": True},
                        compression_applied=chunk.compression_applied,
                        truncation_applied=True,
                    )
                    included_chunks.append(truncated_chunk)
                    context_parts.append(truncated_content)
                    total_tokens += remaining_tokens
            break

        included_chunks.append(chunk)
        context_parts.append(chunk.processed_content)
        total_tokens += chunk_tokens

        if total_tokens >= request.max_tokens:
            break

    if request.include_citations:
        assembled = assemble_with_citations(
            context_parts, included_chunks, request
        )
    else:
        assembled = separator.join(context_parts)

    return assembled, included_chunks


def truncate_content(
    content: str, max_tokens: int, context_window_type: str
) -> str:
    """Truncate content to fit within token limit."""
    if not content:
        return content

    chars_per_token = 4
    max_chars = max_tokens * chars_per_token

    if len(content) <= max_chars:
        return content

    sentences = re.split(r"(?<=[.!?])\s+", content)
    truncated_sentences = []
    current_length = 0

    for sentence in sentences:
        if current_length + len(sentence) <= max_chars - 50:
            truncated_sentences.append(sentence)
            current_length += len(sentence) + 1
        else:
            break

    truncated = " ".join(truncated_sentences)
    if len(truncated) < len(content):
        truncated += "..."

    return truncated


def assemble_with_citations(
    context_parts: List[str],
    chunks: List[ContextChunk],
    request: AssemblyRequest,
) -> str:
    """Assemble context with citations."""
    separator = request.chunk_separator
    assembled_parts = []

    for i, (content, chunk) in enumerate(zip(context_parts, chunks)):
        assembled_parts.append(content)
        citation = chunk.citation_info.get("formatted", f"[{i + 1}]")

        if request.citation_style == "inline":
            if not content.endswith(citation):
                assembled_parts[-1] += f" {citation}"
        elif request.citation_style == "numbered":
            assembled_parts[-1] += f"\n\n{citation}"
        elif request.citation_style == "academic":
            assembled_parts[-1] += f"\n\nSource: {citation}"

        if i < len(context_parts) - 1:
            assembled_parts.append(separator)

    return "".join(assembled_parts)


def generate_citations(
    chunks: List[ContextChunk], request: AssemblyRequest
) -> List[Dict[str, Any]]:
    """Generate citation list."""
    citations = []
    for i, chunk in enumerate(chunks):
        citation = {
            "id": i + 1,
            "chunk_id": chunk.original_chunk.id,
            "document_id": chunk.original_chunk.document_id,
            "formatted": chunk.citation_info.get("formatted", f"[{i + 1}]"),
            "metadata": chunk.citation_info,
        }
        citations.append(citation)
    return citations
