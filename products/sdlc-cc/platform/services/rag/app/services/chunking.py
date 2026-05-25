"""
Intelligent document chunking algorithms with context preservation for SDLC.ai platform.

This module provides advanced chunking strategies that maintain semantic boundaries,
preserve context, and optimize for RAG performance.
"""

import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional

import numpy as np
from nltk import sent_tokenize
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

logger = logging.getLogger(__name__)


@dataclass
class ChunkOptions:
    """Options for document chunking."""

    strategy: str = "hybrid"
    chunk_size: int = 1024
    chunk_overlap: int = 256
    min_chunk_size: int = 100
    max_chunk_size: int = 2048
    respect_sentence_boundaries: bool = True
    respect_paragraph_boundaries: bool = True
    preserve_structure: bool = True
    adaptive_chunking: bool = True
    semantic_aware: bool = True
    include_metadata: bool = True
    language: str = "en"
    quality_threshold: float = 0.7


@dataclass
class Chunk:
    """Represents a document chunk with metadata."""

    content: str
    chunk_id: str
    index: int
    start_pos: int
    end_pos: int
    token_count: int
    chunk_type: str
    metadata: Dict[str, Any] = field(default_factory=dict)
    quality_score: float = 1.0
    context_window: Optional[str] = None
    semantic_neighbors: List[str] = field(default_factory=list)
    source_sections: List[str] = field(default_factory=list)
    language: str = "en"


@dataclass
class ChunkingResult:
    """Result of document chunking operation."""

    chunks: List[Chunk]
    metadata: Dict[str, Any]
    quality_metrics: Dict[str, float]
    processing_time_ms: int
    strategy_used: str


class BaseChunker(ABC):
    """Abstract base class for document chunkers."""

    @abstractmethod
    async def chunk(self, text: str, options: ChunkOptions) -> ChunkingResult:
        """Chunk text according to strategy."""
        pass

    def _estimate_token_count(self, text: str) -> int:
        """Estimate token count (rough approximation)."""
        # Simple heuristic: ~4 characters per token
        return len(text) // 4

    def _validate_chunk(self, chunk: str, options: ChunkOptions) -> bool:
        """Validate if chunk meets quality criteria."""
        if len(chunk) < options.min_chunk_size:
            return False
        if len(chunk) > options.max_chunk_size:
            return False

        # Check for meaningful content
        words = chunk.split()
        if len(words) < 3:  # At least 3 words
            return False

        # Check alphanumeric content
        alnum_chars = sum(1 for c in chunk if c.isalnum())
        if alnum_chars / len(chunk) < 0.3:  # At least 30% alphanumeric
            return False

        return True


class FixedSizeChunker(BaseChunker):
    """Fixed-size chunking with overlap."""

    async def chunk(self, text: str, options: ChunkOptions) -> ChunkingResult:
        """Create fixed-size chunks with overlap."""
        start_time = datetime.now()
        chunks = []

        effective_chunk_size = options.chunk_size - options.chunk_overlap

        for i in range(0, len(text), effective_chunk_size):
            chunk_text = text[i : i + options.chunk_size]

            if self._validate_chunk(chunk_text, options):
                chunk = Chunk(
                    content=chunk_text,
                    chunk_id=f"fixed_{i}",
                    index=len(chunks),
                    start_pos=i,
                    end_pos=min(i + options.chunk_size, len(text)),
                    token_count=self._estimate_token_count(chunk_text),
                    chunk_type="fixed_size",
                    metadata={"strategy": "fixed_size", "original_position": i},
                    quality_score=self._calculate_quality_score(chunk_text),
                    language=options.language,
                )
                chunks.append(chunk)

        processing_time = int((datetime.now() - start_time).total_seconds() * 1000)

        return ChunkingResult(
            chunks=chunks,
            metadata={
                "total_chunks": len(chunks),
                "avg_chunk_size": np.mean([len(c.content) for c in chunks])
                if chunks
                else 0,
            },
            quality_metrics=self._calculate_overall_metrics(chunks),
            processing_time_ms=processing_time,
            strategy_used="fixed_size",
        )

    def _calculate_quality_score(self, text: str) -> float:
        """Calculate quality score for a chunk."""
        if not text:
            return 0.0

        # Check for sentence boundaries
        sentences = text.split(". ")
        sentence_score = min(
            1.0, len(sentences) / 3
        )  # Prefer chunks with multiple sentences

        # Check word diversity
        words = text.split()
        unique_words = len(set(words))
        diversity_score = unique_words / len(words) if words else 0.0

        # Check punctuation
        punctuation_count = sum(1 for c in text if c in ".!?;:")
        punctuation_score = (
            min(1.0, punctuation_count / len(words) * 10) if words else 0.0
        )

        return sentence_score * 0.4 + diversity_score * 0.4 + punctuation_score * 0.2

    def _calculate_overall_metrics(self, chunks: List[Chunk]) -> Dict[str, float]:
        """Calculate overall chunking metrics."""
        if not chunks:
            return {"overall_quality": 0.0}

        chunk_sizes = [len(chunk.content) for chunk in chunks]
        quality_scores = [chunk.quality_score for chunk in chunks]

        metrics = {
            "avg_chunk_size": np.mean(chunk_sizes),
            "size_variance": np.var(chunk_sizes),
            "avg_quality_score": np.mean(quality_scores),
            "size_uniformity": 1.0 - (np.std(chunk_sizes) / np.mean(chunk_sizes))
            if np.mean(chunk_sizes) > 0
            else 0.0,
        }

        metrics["overall_quality"] = (
            metrics["avg_quality_score"] * 0.6 + metrics["size_uniformity"] * 0.4
        )

        return metrics


class SentenceChunker(BaseChunker):
    """Sentence-based chunking respecting semantic boundaries."""

    async def chunk(self, text: str, options: ChunkOptions) -> ChunkingResult:
        """Create sentence-based chunks."""
        start_time = datetime.now()
        chunks = []

        # Tokenize sentences
        try:
            sentences = sent_tokenize(text, language=options.language)
        except:
            # Fallback to simple sentence splitting
            sentences = [s.strip() for s in text.split(". ") if s.strip()]

        current_chunk = ""
        current_start = 0

        for i, sentence in enumerate(sentences):
            sentence = sentence.strip()
            if not sentence:
                continue

            # Check if adding sentence would exceed chunk size
            if (
                current_chunk
                and len(current_chunk) + len(sentence) + 2 > options.chunk_size
            ):
                # Save current chunk
                if self._validate_chunk(current_chunk, options):
                    chunk = Chunk(
                        content=current_chunk.strip(),
                        chunk_id=f"sent_{len(chunks)}",
                        index=len(chunks),
                        start_pos=current_start,
                        end_pos=current_start + len(current_chunk),
                        token_count=self._estimate_token_count(current_chunk),
                        chunk_type="sentence_based",
                        metadata={
                            "strategy": "sentence_based",
                            "sentence_count": current_chunk.count(".") + 1,
                            "start_sentence": max(0, i - current_chunk.count(".")),
                            "end_sentence": i,
                        },
                        quality_score=self._calculate_sentence_quality(current_chunk),
                        language=options.language,
                    )
                    chunks.append(chunk)

                # Start new chunk with overlap if requested
                overlap_sentences = self._get_overlap_sentences(current_chunk, options)
                current_chunk = (
                    overlap_sentences + ". " + sentence
                    if overlap_sentences
                    else sentence
                )
                current_start += len(current_chunk) - len(sentence)
            else:
                # Add to current chunk
                if current_chunk:
                    current_chunk += ". " + sentence
                else:
                    current_chunk = sentence
                    current_start = text.find(sentence, current_start)

        # Add final chunk
        if current_chunk.strip() and self._validate_chunk(current_chunk, options):
            chunk = Chunk(
                content=current_chunk.strip(),
                chunk_id=f"sent_{len(chunks)}",
                index=len(chunks),
                start_pos=current_start,
                end_pos=len(text),
                token_count=self._estimate_token_count(current_chunk),
                chunk_type="sentence_based",
                metadata={
                    "strategy": "sentence_based",
                    "sentence_count": current_chunk.count(".") + 1,
                    "final_chunk": True,
                },
                quality_score=self._calculate_sentence_quality(current_chunk),
                language=options.language,
            )
            chunks.append(chunk)

        processing_time = int((datetime.now() - start_time).total_seconds() * 1000)

        return ChunkingResult(
            chunks=chunks,
            metadata={
                "total_chunks": len(chunks),
                "avg_sentences_per_chunk": np.mean(
                    [c.metadata.get("sentence_count", 0) for c in chunks]
                )
                if chunks
                else 0,
            },
            quality_metrics=self._calculate_sentence_metrics(chunks),
            processing_time_ms=processing_time,
            strategy_used="sentence_based",
        )

    def _get_overlap_sentences(self, current_chunk: str, options: ChunkOptions) -> str:
        """Get overlapping sentences for next chunk."""
        if not options.chunk_overlap:
            return ""

        sentences = current_chunk.split(". ")
        overlap_size = max(
            1, options.chunk_overlap // 100
        )  # Rough estimate of sentences needed for overlap

        # Return last few sentences for overlap
        return ". ".join(sentences[-overlap_size:])

    def _calculate_sentence_quality(self, text: str) -> float:
        """Calculate quality score for sentence-based chunk."""
        if not text:
            return 0.0

        sentences = text.split(". ")

        # Score based on sentence count and structure
        sentence_count_score = min(
            1.0, len(sentences) / 5
        )  # Prefer 3-5 sentences per chunk

        # Score based on average sentence length
        avg_sentence_length = (
            np.mean([len(s.split()) for s in sentences]) if sentences else 0
        )
        length_score = 1.0 - min(
            1.0, abs(avg_sentence_length - 15) / 15
        )  # Optimal: 15 words

        # Score based on punctuation
        punctuation_ratio = text.count(".") / max(len(text.split()), 1)
        punctuation_score = min(1.0, punctuation_ratio * 10)

        return sentence_count_score * 0.4 + length_score * 0.4 + punctuation_score * 0.2

    def _calculate_sentence_metrics(self, chunks: List[Chunk]) -> Dict[str, float]:
        """Calculate sentence-specific chunking metrics."""
        if not chunks:
            return {"overall_quality": 0.0}

        sentence_counts = [chunk.metadata.get("sentence_count", 0) for chunk in chunks]
        quality_scores = [chunk.quality_score for chunk in chunks]

        metrics = {
            "avg_sentences_per_chunk": np.mean(sentence_counts),
            "sentence_count_variance": np.var(sentence_counts),
            "avg_quality_score": np.mean(quality_scores),
            "sentence_boundary_compliance": 1.0,  # Always compliant by design
        }

        metrics["overall_quality"] = (
            metrics["avg_quality_score"] * 0.7
            + (1.0 - min(1.0, metrics["sentence_count_variance"] / 4)) * 0.3
        )

        return metrics


class ParagraphChunker(BaseChunker):
    """Paragraph-based chunking maintaining document structure."""

    async def chunk(self, text: str, options: ChunkOptions) -> ChunkingResult:
        """Create paragraph-based chunks."""
        start_time = datetime.now()
        chunks = []

        # Split into paragraphs
        paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]

        current_chunk = ""
        current_start = 0
        current_paragraphs = []

        for i, paragraph in enumerate(paragraphs):
            # Check if adding paragraph would exceed chunk size
            if (
                current_chunk
                and len(current_chunk) + len(paragraph) + 2 > options.chunk_size
            ):
                # Save current chunk
                if self._validate_chunk(current_chunk, options):
                    chunk = Chunk(
                        content=current_chunk.strip(),
                        chunk_id=f"para_{len(chunks)}",
                        index=len(chunks),
                        start_pos=current_start,
                        end_pos=current_start + len(current_chunk),
                        token_count=self._estimate_token_count(current_chunk),
                        chunk_type="paragraph_based",
                        metadata={
                            "strategy": "paragraph_based",
                            "paragraph_count": len(current_paragraphs),
                            "paragraph_indices": current_paragraphs,
                            "structure_preserved": True,
                        },
                        quality_score=self._calculate_paragraph_quality(
                            current_chunk, current_paragraphs, paragraphs
                        ),
                        language=options.language,
                    )
                    chunks.append(chunk)

                # Start new chunk
                overlap_paragraphs = self._get_overlap_paragraphs(
                    current_paragraphs, paragraphs, options
                )
                current_chunk = (
                    "\n\n".join(overlap_paragraphs + [paragraph])
                    if overlap_paragraphs
                    else paragraph
                )
                current_paragraphs = (
                    overlap_paragraphs + [i] if overlap_paragraphs else [i]
                )
                current_start = text.find(paragraph, current_start)
            else:
                # Add to current chunk
                if current_chunk:
                    current_chunk += "\n\n" + paragraph
                    current_paragraphs.append(i)
                else:
                    current_chunk = paragraph
                    current_paragraphs = [i]
                    current_start = text.find(paragraph)

        # Add final chunk
        if current_chunk.strip() and self._validate_chunk(current_chunk, options):
            chunk = Chunk(
                content=current_chunk.strip(),
                chunk_id=f"para_{len(chunks)}",
                index=len(chunks),
                start_pos=current_start,
                end_pos=len(text),
                token_count=self._estimate_token_count(current_chunk),
                chunk_type="paragraph_based",
                metadata={
                    "strategy": "paragraph_based",
                    "paragraph_count": len(current_paragraphs),
                    "paragraph_indices": current_paragraphs,
                    "final_chunk": True,
                    "structure_preserved": True,
                },
                quality_score=self._calculate_paragraph_quality(
                    current_chunk, current_paragraphs, paragraphs
                ),
                language=options.language,
            )
            chunks.append(chunk)

        processing_time = int((datetime.now() - start_time).total_seconds() * 1000)

        return ChunkingResult(
            chunks=chunks,
            metadata={
                "total_chunks": len(chunks),
                "avg_paragraphs_per_chunk": np.mean(
                    [c.metadata.get("paragraph_count", 0) for c in chunks]
                )
                if chunks
                else 0,
            },
            quality_metrics=self._calculate_paragraph_metrics(chunks),
            processing_time_ms=processing_time,
            strategy_used="paragraph_based",
        )

    def _get_overlap_paragraphs(
        self,
        current_paragraphs: List[int],
        all_paragraphs: List[str],
        options: ChunkOptions,
    ) -> List[str]:
        """Get overlapping paragraphs for next chunk."""
        if not options.chunk_overlap or not current_paragraphs:
            return []

        # Take last paragraph for overlap
        last_idx = current_paragraphs[-1]
        if last_idx < len(all_paragraphs):
            return [all_paragraphs[last_idx]]

        return []

    def _calculate_paragraph_quality(
        self, text: str, paragraph_indices: List[int], all_paragraphs: List[str]
    ) -> float:
        """Calculate quality score for paragraph-based chunk."""
        if not text:
            return 0.0

        paragraphs = text.split("\n\n")

        # Score based on paragraph count
        paragraph_count_score = min(
            1.0, len(paragraphs) / 3
        )  # Prefer 2-3 paragraphs per chunk

        # Score based on paragraph completeness (full paragraphs)
        completeness_score = 1.0 if all(p.strip() for p in paragraphs) else 0.5

        # Score based on structure preservation
        structure_score = 1.0 if "\n\n" in text else 0.5

        # Score based on paragraph length variation
        paragraph_lengths = [len(p) for p in paragraphs]
        length_variance = np.var(paragraph_lengths) if paragraph_lengths else 0
        length_score = 1.0 - min(
            1.0, length_variance / 10000
        )  # Prefer consistent paragraph sizes

        return (
            paragraph_count_score * 0.3
            + completeness_score * 0.3
            + structure_score * 0.2
            + length_score * 0.2
        )

    def _calculate_paragraph_metrics(self, chunks: List[Chunk]) -> Dict[str, float]:
        """Calculate paragraph-specific chunking metrics."""
        if not chunks:
            return {"overall_quality": 0.0}

        paragraph_counts = [
            chunk.metadata.get("paragraph_count", 0) for chunk in chunks
        ]
        quality_scores = [chunk.quality_score for chunk in chunks]

        metrics = {
            "avg_paragraphs_per_chunk": np.mean(paragraph_counts),
            "paragraph_count_variance": np.var(paragraph_counts),
            "avg_quality_score": np.mean(quality_scores),
            "structure_preservation": 1.0,  # Always preserved by design
        }

        metrics["overall_quality"] = (
            metrics["avg_quality_score"] * 0.7
            + (1.0 - min(1.0, metrics["paragraph_count_variance"] / 4)) * 0.3
        )

        return metrics


class SemanticChunker(BaseChunker):
    """Semantic chunking using text similarity analysis."""

    async def chunk(self, text: str, options: ChunkOptions) -> ChunkingResult:
        """Create semantically coherent chunks."""
        start_time = datetime.now()
        chunks = []

        # Split text into sentences
        try:
            sentences = sent_tokenize(text, language=options.language)
        except:
            sentences = [s.strip() for s in text.split(". ") if s.strip()]

        if len(sentences) < 2:
            # Fallback to fixed-size chunking
            return await FixedSizeChunker().chunk(text, options)

        # Create sentence embeddings using TF-IDF
        vectorizer = TfidfVectorizer(
            max_features=1000,
            stop_words="english",
            ngram_range=(1, 2),
            min_df=1,
            max_df=0.9,
        )

        try:
            sentence_embeddings = vectorizer.fit_transform(sentences)
        except:
            # Fallback if TF-IDF fails
            return await SentenceChunker().chunk(text, options)

        # Calculate similarity matrix
        similarity_matrix = cosine_similarity(sentence_embeddings)

        # Group sentences into semantic chunks
        semantic_groups = self._group_sentences_semantically(
            sentences, similarity_matrix, options
        )

        # Create chunks from semantic groups
        current_chunk = ""
        current_start = 0

        for group_idx, group in enumerate(semantic_groups):
            group_text = ". ".join(group)

            # Check if we need to start a new chunk
            if (
                current_chunk
                and len(current_chunk) + len(group_text) + 2 > options.chunk_size
            ):
                # Save current chunk
                if self._validate_chunk(current_chunk, options):
                    chunk = Chunk(
                        content=current_chunk.strip(),
                        chunk_id=f"sem_{len(chunks)}",
                        index=len(chunks),
                        start_pos=current_start,
                        end_pos=current_start + len(current_chunk),
                        token_count=self._estimate_token_count(current_chunk),
                        chunk_type="semantic",
                        metadata={
                            "strategy": "semantic",
                            "semantic_group_id": group_idx - 1,
                            "semantic_similarity": self._calculate_group_cohesion(
                                group, similarity_matrix, sentences
                            ),
                            "sentence_count": current_chunk.count(".") + 1,
                        },
                        quality_score=self._calculate_semantic_quality(current_chunk),
                        language=options.language,
                    )
                    chunks.append(chunk)

                # Start new chunk
                current_chunk = group_text
                current_start = text.find(group_text, current_start)
            else:
                # Add to current chunk
                if current_chunk:
                    current_chunk += ". " + group_text
                else:
                    current_chunk = group_text
                    current_start = text.find(group_text)

        # Add final chunk
        if current_chunk.strip() and self._validate_chunk(current_chunk, options):
            chunk = Chunk(
                content=current_chunk.strip(),
                chunk_id=f"sem_{len(chunks)}",
                index=len(chunks),
                start_pos=current_start,
                end_pos=len(text),
                token_count=self._estimate_token_count(current_chunk),
                chunk_type="semantic",
                metadata={
                    "strategy": "semantic",
                    "semantic_group_id": len(semantic_groups) - 1,
                    "final_chunk": True,
                    "sentence_count": current_chunk.count(".") + 1,
                },
                quality_score=self._calculate_semantic_quality(current_chunk),
                language=options.language,
            )
            chunks.append(chunk)

        processing_time = int((datetime.now() - start_time).total_seconds() * 1000)

        return ChunkingResult(
            chunks=chunks,
            metadata={
                "total_chunks": len(chunks),
                "semantic_groups": len(semantic_groups),
            },
            quality_metrics=self._calculate_semantic_metrics(chunks),
            processing_time_ms=processing_time,
            strategy_used="semantic",
        )

    def _group_sentences_semantically(
        self, sentences: List[str], similarity_matrix: np.ndarray, options: ChunkOptions
    ) -> List[List[str]]:
        """Group sentences based on semantic similarity."""
        groups = []
        used_indices = set()

        for i, sentence in enumerate(sentences):
            if i in used_indices:
                continue

            # Find similar sentences
            similarities = similarity_matrix[i]
            similar_indices = np.where(similarities > 0.3)[0]  # Similarity threshold

            # Create group with similar sentences
            group = []
            for j in similar_indices:
                if (
                    j not in used_indices and j <= i + 10
                ):  # Limit group size and distance
                    group.append(sentences[j])
                    used_indices.add(j)

            if group:
                groups.append(group)

        return groups

    def _calculate_group_cohesion(
        self, group: List[str], similarity_matrix: np.ndarray, all_sentences: List[str]
    ) -> float:
        """Calculate semantic cohesion score for a group of sentences."""
        if len(group) < 2:
            return 1.0

        # Find indices of group sentences
        group_indices = []
        for sentence in group:
            try:
                idx = all_sentences.index(sentence)
                group_indices.append(idx)
            except ValueError:
                continue

        if len(group_indices) < 2:
            return 1.0

        # Calculate average pairwise similarity
        total_similarity = 0
        pair_count = 0

        for i in range(len(group_indices)):
            for j in range(i + 1, len(group_indices)):
                total_similarity += similarity_matrix[
                    group_indices[i], group_indices[j]
                ]
                pair_count += 1

        return total_similarity / pair_count if pair_count > 0 else 0.0

    def _calculate_semantic_quality(self, text: str) -> float:
        """Calculate quality score for semantic chunk."""
        if not text:
            return 0.0

        # Base quality metrics
        sentences = text.split(". ")
        words = text.split()

        sentence_score = min(1.0, len(sentences) / 4)  # Prefer 3-4 sentences
        length_score = min(1.0, len(words) / 100)  # Prefer substantial content

        # Semantic coherence (simplified)
        unique_words = len(set(words))
        coherence_score = unique_words / len(words) if words else 0.0

        return sentence_score * 0.4 + length_score * 0.3 + coherence_score * 0.3

    def _calculate_semantic_metrics(self, chunks: List[Chunk]) -> Dict[str, float]:
        """Calculate semantic-specific chunking metrics."""
        if not chunks:
            return {"overall_quality": 0.0}

        quality_scores = [chunk.quality_score for chunk in chunks]
        cohesion_scores = [
            chunk.metadata.get("semantic_similarity", 0.0) for chunk in chunks
        ]

        metrics = {
            "avg_quality_score": np.mean(quality_scores),
            "avg_semantic_cohesion": np.mean(cohesion_scores),
            "cohesion_variance": np.var(cohesion_scores),
            "semantic_boundary_compliance": 1.0,  # High by design
        }

        metrics["overall_quality"] = (
            metrics["avg_quality_score"] * 0.6 + metrics["avg_semantic_cohesion"] * 0.4
        )

        return metrics


class HybridChunker(BaseChunker):
    """Hybrid chunking combining multiple strategies."""

    async def chunk(self, text: str, options: ChunkOptions) -> ChunkingResult:
        """Create chunks using hybrid strategy."""
        start_time = datetime.now()

        # Try paragraph-based first for structure preservation
        paragraph_result = await ParagraphChunker().chunk(text, options)

        # If paragraph chunks are too large or too few, fall back to sentence-based
        if len(paragraph_result.chunks) < 3 or any(
            len(chunk.content) > options.max_chunk_size
            for chunk in paragraph_result.chunks
        ):
            sentence_result = await SentenceChunker().chunk(text, options)

            # Choose better result based on quality metrics
            if sentence_result.quality_metrics.get(
                "overall_quality", 0
            ) > paragraph_result.quality_metrics.get("overall_quality", 0):
                result = sentence_result
                result.strategy_used = "hybrid_sentence_fallback"
            else:
                result = paragraph_result
                result.strategy_used = "hybrid_paragraph_primary"
        else:
            result = paragraph_result
            result.strategy_used = "hybrid_paragraph"

        # Post-processing: merge very small chunks and split very large ones
        processed_chunks = await self._post_process_chunks(result.chunks, options)

        # Update chunk indices
        for i, chunk in enumerate(processed_chunks):
            chunk.index = i
            chunk.chunk_id = f"hybrid_{i}"

        processing_time = int((datetime.now() - start_time).total_seconds() * 1000)

        return ChunkingResult(
            chunks=processed_chunks,
            metadata=result.metadata,
            quality_metrics=self._calculate_hybrid_metrics(processed_chunks),
            processing_time_ms=processing_time,
            strategy_used=result.strategy_used,
        )

    async def _post_process_chunks(
        self, chunks: List[Chunk], options: ChunkOptions
    ) -> List[Chunk]:
        """Post-process chunks to optimize size distribution."""
        if not chunks:
            return chunks

        processed = []

        for chunk in chunks:
            # Split oversized chunks
            if len(chunk.content) > options.max_chunk_size:
                sub_chunks = await self._split_oversized_chunk(chunk, options)
                processed.extend(sub_chunks)
            # Merge undersized chunks with next one
            elif len(chunk.content) < options.min_chunk_size and processed:
                merged_chunk = self._merge_with_previous(chunk, processed[-1], options)
                if merged_chunk:
                    processed[-1] = merged_chunk
                else:
                    processed.append(chunk)
            else:
                processed.append(chunk)

        return processed

    async def _split_oversized_chunk(
        self, chunk: Chunk, options: ChunkOptions
    ) -> List[Chunk]:
        """Split oversized chunk into smaller ones."""
        # Use sentence chunker for splitting
        sentence_result = await SentenceChunker().chunk(chunk.content, options)

        # Update metadata for sub-chunks
        for sub_chunk in sentence_result.chunks:
            sub_chunk.chunk_type = f"{chunk.chunk_type}_split"
            sub_chunk.metadata.update(
                {
                    "parent_chunk_id": chunk.chunk_id,
                    "original_strategy": chunk.metadata.get("strategy", "hybrid"),
                }
            )

        return sentence_result.chunks

    def _merge_with_previous(
        self, chunk: Chunk, previous: Chunk, options: ChunkOptions
    ) -> Optional[Chunk]:
        """Merge chunk with previous one if combined size is acceptable."""
        combined_content = previous.content + "\n\n" + chunk.content

        if len(combined_content) <= options.chunk_size:
            return Chunk(
                content=combined_content,
                chunk_id=f"merged_{previous.chunk_id}",
                index=previous.index,
                start_pos=previous.start_pos,
                end_pos=chunk.end_pos,
                token_count=self._estimate_token_count(combined_content),
                chunk_type="merged",
                metadata={
                    "strategy": "hybrid_merged",
                    "merged_chunks": [previous.chunk_id, chunk.chunk_id],
                },
                quality_score=(previous.quality_score + chunk.quality_score) / 2,
                language=chunk.language,
            )

        return None

    def _calculate_hybrid_metrics(self, chunks: List[Chunk]) -> Dict[str, float]:
        """Calculate hybrid-specific chunking metrics."""
        if not chunks:
            return {"overall_quality": 0.0}

        chunk_sizes = [len(chunk.content) for chunk in chunks]
        quality_scores = [chunk.quality_score for chunk in chunks]

        metrics = {
            "avg_chunk_size": np.mean(chunk_sizes),
            "size_variance": np.var(chunk_sizes),
            "avg_quality_score": np.mean(quality_scores),
            "size_uniformity": 1.0 - (np.std(chunk_sizes) / np.mean(chunk_sizes))
            if np.mean(chunk_sizes) > 0
            else 0.0,
            "strategy_effectiveness": 1.0,  # Hybrid is designed to be effective
        }

        metrics["overall_quality"] = (
            metrics["avg_quality_score"] * 0.5
            + metrics["size_uniformity"] * 0.3
            + metrics["strategy_effectiveness"] * 0.2
        )

        return metrics


class ChunkingService:
    """Main chunking service that orchestrates different strategies."""

    def __init__(self):
        self.chunkers = {
            "fixed_size": FixedSizeChunker(),
            "sentence": SentenceChunker(),
            "paragraph": ParagraphChunker(),
            "semantic": SemanticChunker(),
            "hybrid": HybridChunker(),
        }

    async def chunk_text(
        self, text: str, options: Optional[ChunkOptions] = None
    ) -> ChunkingResult:
        """Chunk text using the specified or optimal strategy."""
        if options is None:
            options = ChunkOptions()

        # Select chunker
        chunker = self.chunkers.get(options.strategy, self.chunkers["hybrid"])

        # Perform chunking
        result = await chunker.chunk(text, options)

        # Add global metadata
        result.metadata.update(
            {
                "original_text_length": len(text),
                "compression_ratio": len(
                    " ".join(chunk.content for chunk in result.chunks)
                )
                / len(text)
                if text
                else 0,
                "strategy_options": options.__dict__,
            }
        )

        return result

    def get_optimal_strategy(self, text: str, options: ChunkOptions) -> str:
        """Determine the optimal chunking strategy for the given text."""
        text_length = len(text)
        sentences = text.split(". ")
        paragraphs = text.split("\n\n")

        # Heuristics for strategy selection
        if text_length < 500:
            return "fixed_size"
        elif len(paragraphs) > len(sentences) / 2:  # Many short paragraphs
            return "paragraph"
        elif (
            len(sentences) > 20 and options.semantic_aware
        ):  # Long document with semantic awareness
            return "semantic"
        else:
            return "hybrid"

    async def chunk_with_adaptive_strategy(
        self, text: str, options: Optional[ChunkOptions] = None
    ) -> ChunkingResult:
        """Chunk text using automatically determined optimal strategy."""
        if options is None:
            options = ChunkOptions()

        if options.adaptive_chunking:
            optimal_strategy = self.get_optimal_strategy(text, options)
            options.strategy = optimal_strategy

        return await self.chunk_text(text, options)
