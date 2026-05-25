"""
Context Assembly Preprocessing

Chunk preprocessing, content cleaning, and citation info preparation.
"""

import re
import logging
from typing import List, Dict, Any

from app.models.document import DocumentChunk

from .models import AssemblyRequest, ContextChunk
from .scoring import (
    get_authority_score,
    get_recency_score,
    calculate_query_relevance,
    calculate_coherence_score,
)

logger = logging.getLogger(__name__)


async def preprocess_chunks(
    chunks: List[DocumentChunk],
    request: AssemblyRequest,
    count_tokens_fn,
) -> List[ContextChunk]:
    """Pre-process chunks for assembly."""
    processed_chunks = []

    for chunk in chunks:
        cleaned_content = clean_content(chunk.content)
        token_count = count_tokens_fn(
            cleaned_content, request.context_window_type
        )
        importance_score = calculate_importance_score(chunk, request)
        coherence_score = calculate_coherence_score(cleaned_content)
        citation_info = prepare_citation_info(chunk, request)

        context_chunk = ContextChunk(
            original_chunk=chunk,
            processed_content=cleaned_content,
            token_count=token_count,
            importance_score=importance_score,
            coherence_score=coherence_score,
            redundancy_score=1.0,
            citation_info=citation_info,
            metadata={
                "original_length": len(chunk.content),
                "processed_length": len(cleaned_content),
                "language": request.user_language,
                "chunk_type": chunk.metadata.get("chunk_type", "text"),
            },
        )
        processed_chunks.append(context_chunk)

    logger.info(f"Pre-processed {len(processed_chunks)} chunks")
    return processed_chunks


def clean_content(content: str) -> str:
    """Clean and normalize content."""
    content = re.sub(r"\s+", " ", content.strip())
    content = re.sub(
        r"[^\w\s\.\,\:\;\-\(\)\[\]\{\}\"\'\?\!\n]", " ", content
    )
    content = re.sub(r'["""]', '"', content)
    content = re.sub(r"[" "]", "'", content)
    content = re.sub(r"\s+([.,;:!?)])", r"\1", content)
    content = re.sub(r"([(\[])\s+", r"\1", content)
    content = re.sub(r"\s+([)\]])", r"\1", content)
    return content


def calculate_importance_score(
    chunk: DocumentChunk, request: AssemblyRequest
) -> float:
    """Calculate importance score for a chunk (0-1)."""
    score = 0.5

    if request.prioritize_authoritative:
        score += 0.2 * get_authority_score(chunk)

    if request.prioritize_recent:
        score += 0.1 * get_recency_score(chunk)

    content_length = len(chunk.content)
    if content_length > 500:
        score += 0.1
    elif content_length > 200:
        score += 0.05

    if request.query_analysis:
        relevance = calculate_query_relevance(
            chunk, request.query_analysis
        )
        score += 0.3 * relevance

    source_type = chunk.metadata.get("source_type", "").lower()
    if source_type in ["academic", "official", "peer_reviewed"]:
        score += 0.15
    elif source_type in ["book", "journal", "report"]:
        score += 0.1

    return min(max(score, 0.0), 1.0)


def prepare_citation_info(
    chunk: DocumentChunk, request: AssemblyRequest
) -> Dict[str, Any]:
    """Prepare citation information for a chunk."""
    metadata = chunk.metadata or {}

    citation_info = {
        "chunk_id": chunk.id,
        "document_id": chunk.document_id,
        "source": metadata.get("source", "Unknown"),
        "author": metadata.get("author", "Unknown"),
        "title": metadata.get("title", ""),
        "publication_date": metadata.get("publication_date", ""),
        "url": metadata.get("url", ""),
        "page_number": metadata.get("page_number"),
        "section": metadata.get("section", ""),
        "citation_style": request.citation_style,
    }

    if request.citation_style == "academic":
        author = citation_info.get("author", "Unknown")
        title = citation_info.get("title", "")
        pub_date = citation_info.get("publication_date", "")
        source = citation_info.get("source", "")
        citation_info["formatted"] = (
            f"{author} ({pub_date}). {title}. {source}."
        )
    elif request.citation_style == "numbered":
        citation_info["formatted"] = f"[{chunk.id}]"
    elif request.citation_style == "inline":
        citation_info["formatted"] = (
            f"({metadata.get('author', 'Unknown')}, "
            f"{metadata.get('publication_year', 'n.d.')})"
        )

    return citation_info
