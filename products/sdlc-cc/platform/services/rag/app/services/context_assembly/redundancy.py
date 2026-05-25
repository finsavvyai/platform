"""
Context Assembly Redundancy Removal

Strategies for removing duplicate and redundant content from chunks.
"""

import re
import logging
from collections import Counter
from typing import List

from sklearn.metrics.pairwise import cosine_similarity

from .models import AssemblyRequest, ContextChunk, RedundancyStrategy

logger = logging.getLogger(__name__)


async def apply_redundancy_removal(
    chunks: List[ContextChunk],
    request: AssemblyRequest,
    sentence_model=None,
) -> List[ContextChunk]:
    """Apply redundancy removal strategy."""
    if request.redundancy_strategy == RedundancyStrategy.EXACT_DUPLICATE:
        return chunks

    try:
        if request.redundancy_strategy == RedundancyStrategy.EXACT_DUPLICATE:
            return remove_exact_duplicates(chunks)
        elif request.redundancy_strategy == RedundancyStrategy.SEMANTIC_SIMILARITY:
            return await remove_semantic_duplicates(chunks, sentence_model)
        elif request.redundancy_strategy == RedundancyStrategy.OVERLAP_DETECTION:
            return remove_overlapping_content(chunks)
        elif request.redundancy_strategy == RedundancyStrategy.CONCEPTUAL_REDUNDANCY:
            return await remove_conceptual_redundancy(chunks)
        return chunks
    except Exception as e:
        logger.error(f"Redundancy removal failed: {e}")
        return chunks


def remove_exact_duplicates(
    chunks: List[ContextChunk],
) -> List[ContextChunk]:
    """Remove exact duplicate chunks."""
    seen_contents = set()
    deduplicated = []

    for chunk in chunks:
        content_hash = hash(chunk.processed_content)
        if content_hash not in seen_contents:
            seen_contents.add(content_hash)
            deduplicated.append(chunk)

    return deduplicated


async def remove_semantic_duplicates(
    chunks: List[ContextChunk],
    sentence_model=None,
) -> List[ContextChunk]:
    """Remove semantically similar chunks."""
    if not sentence_model:
        return chunks

    try:
        contents = [chunk.processed_content for chunk in chunks]
        embeddings = sentence_model.encode(contents)
        similarity_matrix = cosine_similarity(embeddings)

        deduplicated = []
        removed_indices = set()

        for i, chunk in enumerate(chunks):
            if i in removed_indices:
                continue

            deduplicated.append(chunk)

            for j in range(i + 1, len(chunks)):
                if j not in removed_indices and similarity_matrix[i][j] > 0.8:
                    if chunks[j].importance_score > chunk.importance_score:
                        deduplicated.pop()
                        deduplicated.append(chunks[j])
                    removed_indices.add(j)

        return deduplicated

    except Exception as e:
        logger.error(f"Semantic duplicate removal failed: {e}")
        return chunks


def remove_overlapping_content(
    chunks: List[ContextChunk],
) -> List[ContextChunk]:
    """Remove chunks with overlapping content."""
    deduplicated = []

    for chunk in chunks:
        has_overlap = False

        for existing_chunk in deduplicated:
            overlap_ratio = calculate_content_overlap(
                chunk.processed_content, existing_chunk.processed_content
            )
            if overlap_ratio > 0.7:
                has_overlap = True
                if chunk.importance_score > existing_chunk.importance_score:
                    deduplicated.remove(existing_chunk)
                    deduplicated.append(chunk)
                break

        if not has_overlap:
            deduplicated.append(chunk)

    return deduplicated


def calculate_content_overlap(content1: str, content2: str) -> float:
    """Calculate overlap ratio between two contents (0-1)."""
    sentences1 = set(re.split(r"[.!?]+", content1.strip()))
    sentences2 = set(re.split(r"[.!?]+", content2.strip()))
    sentences1 = {s.strip() for s in sentences1 if s.strip()}
    sentences2 = {s.strip() for s in sentences2 if s.strip()}

    if not sentences1 or not sentences2:
        return 0.0

    intersection = len(sentences1.intersection(sentences2))
    union = len(sentences1.union(sentences2))
    return intersection / union if union > 0 else 0.0


async def remove_conceptual_redundancy(
    chunks: List[ContextChunk],
) -> List[ContextChunk]:
    """Remove conceptually redundant chunks."""
    chunk_concepts = []
    for chunk in chunks:
        concepts = extract_key_concepts(chunk.processed_content)
        chunk_concepts.append((chunk, concepts))

    deduplicated = []
    seen_concepts = set()

    for chunk, concepts in chunk_concepts:
        concept_overlap = len(set(concepts) & seen_concepts)

        if concept_overlap > len(concepts) * 0.5:
            existing_more_important = any(
                ec.importance_score > chunk.importance_score
                for ec in deduplicated
            )
            if existing_more_important:
                continue

        deduplicated.append(chunk)
        seen_concepts.update(concepts)

    return deduplicated


def extract_key_concepts(content: str) -> List[str]:
    """Extract key concepts from content."""
    words = content.lower().split()
    stop_words = {
        "the", "a", "an", "and", "or", "but",
        "in", "on", "at", "to", "for",
    }
    concepts = [w for w in words if w not in stop_words and len(w) > 3]
    concept_freq = Counter(concepts)
    return [concept for concept, _ in concept_freq.most_common(10)]
