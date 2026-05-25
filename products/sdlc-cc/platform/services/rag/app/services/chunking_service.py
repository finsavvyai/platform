"""
Intelligent document chunking algorithms with context preservation for SDLC.ai platform.

This module provides advanced chunking strategies that maintain semantic coherence,
preserve context boundaries, and optimize for RAG performance.
"""

import logging
import re
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional

import nltk
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np

from .document_processor import ChunkingStrategy, ProcessingOptions

logger = logging.getLogger(__name__)


@dataclass
class ChunkBoundary:
    """Represents a boundary between document sections."""

    start_position: int
    end_position: int
    boundary_type: str  # 'sentence', 'paragraph', 'section', 'semantic'
    confidence: float
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ContextualChunk:
    """Enhanced chunk with context information."""

    index: int
    content: str
    start_position: int
    end_position: int
    chunk_type: str
    language: str

    # Context information
    preceding_context: str = ""
    following_context: str = ""
    section_title: str = ""
    hierarchical_level: int = 0

    # Semantic information
    embedding: Optional[List[float]] = None
    topic_keywords: List[str] = field(default_factory=list)
    semantic_coherence: float = 0.0

    # Metadata
    source_metadata: Dict[str, Any] = field(default_factory=dict)
    quality_metrics: Dict[str, float] = field(default_factory=dict)


class IntelligentChunker:
    """Intelligent document chunking with context preservation."""

    def __init__(self):
        self.sentence_model = None
        self.load_sentence_model()

        self.chunking_strategies = {
            ChunkingStrategy.FIXED_SIZE: self._chunk_fixed_size,
            ChunkingStrategy.SENTENCE_BASED: self._chunk_sentence_based,
            ChunkingStrategy.PARAGRAPH_BASED: self._chunk_paragraph_based,
            ChunkingStrategy.SEMANTIC: self._chunk_semantic,
            ChunkingStrategy.HYBRID: self._chunk_hybrid_intelligent,
        }

    def load_sentence_model(self):
        """Load sentence transformer model for semantic analysis."""
        try:
            self.sentence_model = SentenceTransformer("all-MiniLM-L6-v2")
        except Exception as e:
            logger.warning(f"Failed to load sentence model: {e}")
            self.sentence_model = None

    async def create_chunks(
        self,
        text: str,
        options: ProcessingOptions,
        document_metadata: Optional[Dict[str, Any]] = None,
    ) -> List[ContextualChunk]:
        """
        Create intelligent chunks from document text.

        Args:
            text: Document text to chunk
            options: Processing options including chunking strategy
            document_metadata: Optional document metadata for context

        Returns:
            List of contextual chunks
        """
        if not text or not text.strip():
            return []

        start_time = datetime.now()

        try:
            # Select chunking strategy
            chunker = self.chunking_strategies.get(
                options.chunking_strategy, self._chunk_hybrid_intelligent
            )

            # Detect boundaries
            boundaries = self._detect_boundaries(text)

            # Create chunks using selected strategy
            raw_chunks = chunker(text, options, boundaries)

            # Enhance chunks with context
            contextual_chunks = self._enhance_chunks_with_context(
                raw_chunks, text, options, document_metadata
            )

            # Calculate semantic coherence
            if self.sentence_model:
                contextual_chunks = self._calculate_semantic_coherence(
                    contextual_chunks
                )

            # Apply quality filtering
            filtered_chunks = self._filter_chunks_by_quality(contextual_chunks, options)

            # Optimize chunk boundaries for context
            optimized_chunks = self._optimize_chunk_boundaries(
                filtered_chunks, text, options
            )

            logger.info(
                f"Created {len(optimized_chunks)} chunks in {(datetime.now() - start_time).total_seconds():.2f}s"
            )

            return optimized_chunks

        except Exception as e:
            logger.error(f"Chunking failed: {e}")
            # Fallback to simple fixed-size chunking
            return self._fallback_chunking(text, options)

    def _detect_boundaries(self, text: str) -> List[ChunkBoundary]:
        """Detect various types of boundaries in the text."""
        boundaries = []

        # Sentence boundaries
        sentences = nltk.sent_tokenize(text)
        position = 0
        for sentence in sentences:
            start_pos = text.find(sentence, position)
            end_pos = start_pos + len(sentence)
            boundaries.append(
                ChunkBoundary(
                    start_position=start_pos,
                    end_position=end_pos,
                    boundary_type="sentence",
                    confidence=0.9,
                )
            )
            position = end_pos

        # Paragraph boundaries
        paragraphs = text.split("\n\n")
        position = 0
        for paragraph in paragraphs:
            if paragraph.strip():
                start_pos = text.find(paragraph, position)
                end_pos = start_pos + len(paragraph)
                boundaries.append(
                    ChunkBoundary(
                        start_position=start_pos,
                        end_position=end_pos,
                        boundary_type="paragraph",
                        confidence=0.95,
                    )
                )
                position = end_pos

        # Section boundaries (headings)
        import re

        heading_pattern = r"^(#{1,6}\s+.+|^[A-Z][A-Z\s]+$|^\d+\.\s+.+)"
        for match in re.finditer(heading_pattern, text, re.MULTILINE):
            boundaries.append(
                ChunkBoundary(
                    start_position=match.start(),
                    end_position=match.end(),
                    boundary_type="section",
                    confidence=0.98,
                    metadata={"heading_text": match.group().strip()},
                )
            )

        # Sort boundaries by position
        boundaries.sort(key=lambda b: b.start_position)

        return boundaries

    def _chunk_fixed_size(
        self, text: str, options: ProcessingOptions, boundaries: List[ChunkBoundary]
    ) -> List[Dict[str, Any]]:
        """Create fixed-size chunks with boundary awareness."""
        chunks = []
        position = 0

        while position < len(text):
            # Calculate chunk end position
            chunk_end = min(position + options.chunk_size, len(text))

            # Find nearest boundary to adjust chunk end
            best_boundary = self._find_nearest_boundary(
                boundaries, position, chunk_end, "sentence"
            )

            if (
                best_boundary
                and best_boundary.end_position > position + options.min_chunk_size
            ):
                chunk_end = best_boundary.end_position

            # Create chunk
            chunk_text = text[position:chunk_end]
            if len(chunk_text.strip()) >= options.min_chunk_size:
                chunks.append(
                    {
                        "index": len(chunks),
                        "content": chunk_text,
                        "start_position": position,
                        "end_position": chunk_end,
                        "chunk_type": "fixed_size",
                    }
                )

            # Calculate next position with overlap
            position = max(position + 1, chunk_end - options.chunk_overlap)

        return chunks

    def _chunk_sentence_based(
        self, text: str, options: ProcessingOptions, boundaries: List[ChunkBoundary]
    ) -> List[Dict[str, Any]]:
        """Create sentence-based chunks with context preservation."""
        chunks = []
        sentence_boundaries = [b for b in boundaries if b.boundary_type == "sentence"]

        current_chunk_sentences = []
        current_length = 0

        for i, boundary in enumerate(sentence_boundaries):
            sentence_text = text[boundary.start_position : boundary.end_position]
            sentence_length = len(sentence_text)

            # Check if adding sentence would exceed chunk size
            if (
                current_length + sentence_length > options.chunk_size
                and current_chunk_sentences
                and current_length >= options.min_chunk_size
            ):
                # Create chunk from accumulated sentences
                chunk_text = " ".join(current_chunk_sentences)
                start_pos = current_chunk_sentences[0] if current_chunk_sentences else 0
                end_pos = start_pos + len(chunk_text)

                chunks.append(
                    {
                        "index": len(chunks),
                        "content": chunk_text,
                        "start_position": start_pos,
                        "end_position": end_pos,
                        "chunk_type": "sentence_based",
                        "sentence_count": len(current_chunk_sentences),
                    }
                )

                # Start new chunk with overlap
                overlap_sentences = self._create_sentence_overlap(
                    current_chunk_sentences, options.chunk_overlap
                )
                current_chunk_sentences = overlap_sentences + [sentence_text]
                current_length = sum(len(s) for s in current_chunk_sentences)
            else:
                current_chunk_sentences.append(sentence_text)
                current_length += sentence_length

        # Add final chunk
        if current_chunk_sentences and current_length >= options.min_chunk_size:
            chunk_text = " ".join(current_chunk_sentences)
            chunks.append(
                {
                    "index": len(chunks),
                    "content": chunk_text,
                    "start_position": 0,  # Will be calculated accurately
                    "end_position": len(chunk_text),
                    "chunk_type": "sentence_based",
                    "sentence_count": len(current_chunk_sentences),
                }
            )

        return chunks

    def _chunk_paragraph_based(
        self, text: str, options: ProcessingOptions, boundaries: List[ChunkBoundary]
    ) -> List[Dict[str, Any]]:
        """Create paragraph-based chunks preserving paragraph integrity."""
        chunks = []
        paragraph_boundaries = [b for b in boundaries if b.boundary_type == "paragraph"]

        current_chunk_paragraphs = []
        current_length = 0

        for boundary in paragraph_boundaries:
            paragraph_text = text[boundary.start_position : boundary.end_position]
            paragraph_length = len(paragraph_text)

            # Check if adding paragraph would exceed chunk size
            if (
                current_length + paragraph_length + 2 > options.chunk_size
                and current_chunk_paragraphs
                and current_length >= options.min_chunk_size
            ):
                # Create chunk from accumulated paragraphs
                chunk_text = "\n\n".join(current_chunk_paragraphs)
                chunks.append(
                    {
                        "index": len(chunks),
                        "content": chunk_text,
                        "start_position": 0,  # Will be calculated
                        "end_position": len(chunk_text),
                        "chunk_type": "paragraph_based",
                        "paragraph_count": len(current_chunk_paragraphs),
                    }
                )

                # Start new chunk
                current_chunk_paragraphs = [paragraph_text]
                current_length = paragraph_length
            else:
                current_chunk_paragraphs.append(paragraph_text)
                current_length += paragraph_length + 2  # +2 for \n\n

        # Add final chunk
        if current_chunk_paragraphs and current_length >= options.min_chunk_size:
            chunk_text = "\n\n".join(current_chunk_paragraphs)
            chunks.append(
                {
                    "index": len(chunks),
                    "content": chunk_text,
                    "start_position": 0,
                    "end_position": len(chunk_text),
                    "chunk_type": "paragraph_based",
                    "paragraph_count": len(current_chunk_paragraphs),
                }
            )

        return chunks

    def _chunk_semantic(
        self, text: str, options: ProcessingOptions, boundaries: List[ChunkBoundary]
    ) -> List[Dict[str, Any]]:
        """Create semantic chunks based on content similarity."""
        if not self.sentence_model:
            logger.warning(
                "Sentence model not available, falling back to sentence-based chunking"
            )
            return self._chunk_sentence_based(text, options, boundaries)

        # Extract sentences
        sentence_boundaries = [b for b in boundaries if b.boundary_type == "sentence"]
        sentences = [
            text[b.start_position : b.end_position] for b in sentence_boundaries
        ]

        if len(sentences) < 2:
            return self._chunk_sentence_based(text, options, boundaries)

        # Generate sentence embeddings
        sentence_embeddings = self.sentence_model.encode(sentences)

        # Calculate similarity matrix
        similarity_matrix = cosine_similarity(sentence_embeddings)

        # Find semantic boundaries (low similarity points)
        semantic_boundaries = self._find_semantic_boundaries(
            similarity_matrix, sentences
        )

        # Create chunks based on semantic boundaries
        chunks = []
        chunk_start = 0

        for boundary_pos in semantic_boundaries:
            if boundary_pos > chunk_start + 1:  # Ensure chunk has at least 2 sentences
                chunk_sentences = sentences[chunk_start : boundary_pos + 1]
                chunk_text = " ".join(chunk_sentences)

                if len(chunk_text) >= options.min_chunk_size:
                    chunks.append(
                        {
                            "index": len(chunks),
                            "content": chunk_text,
                            "start_position": sentence_boundaries[
                                chunk_start
                            ].start_position,
                            "end_position": sentence_boundaries[
                                boundary_pos
                            ].end_position,
                            "chunk_type": "semantic",
                            "sentence_count": len(chunk_sentences),
                            "semantic_boundary": True,
                        }
                    )

                    # Check chunk size and split if necessary
                    if len(chunk_text) > options.max_chunk_size:
                        chunks.extend(
                            self._split_large_chunk(
                                chunk_text,
                                options,
                                sentence_boundaries[chunk_start : boundary_pos + 1],
                            )
                        )
                        chunks.pop()  # Remove the large chunk that was just added

                chunk_start = boundary_pos + 1

        # Add remaining sentences
        if chunk_start < len(sentences):
            chunk_sentences = sentences[chunk_start:]
            chunk_text = " ".join(chunk_sentences)

            if len(chunk_text) >= options.min_chunk_size:
                chunks.append(
                    {
                        "index": len(chunks),
                        "content": chunk_text,
                        "start_position": sentence_boundaries[
                            chunk_start
                        ].start_position,
                        "end_position": sentence_boundaries[-1].end_position,
                        "chunk_type": "semantic",
                        "sentence_count": len(chunk_sentences),
                    }
                )

        return chunks

    def _chunk_hybrid_intelligent(
        self, text: str, options: ProcessingOptions, boundaries: List[ChunkBoundary]
    ) -> List[Dict[str, Any]]:
        """Create hybrid chunks using multiple strategies."""
        # Start with paragraph-based chunking for structure
        paragraph_chunks = self._chunk_paragraph_based(text, options, boundaries)

        # Enhance with semantic analysis if available
        if self.sentence_model and len(paragraph_chunks) > 1:
            enhanced_chunks = self._enhance_with_semantic_analysis(
                paragraph_chunks, text, options
            )
        else:
            enhanced_chunks = paragraph_chunks

        # Apply intelligent boundary optimization
        optimized_chunks = self._optimize_chunk_boundaries_intelligent(
            enhanced_chunks, text, options
        )

        return optimized_chunks

    def _find_nearest_boundary(
        self,
        boundaries: List[ChunkBoundary],
        start_pos: int,
        end_pos: int,
        boundary_type: str,
    ) -> Optional[ChunkBoundary]:
        """Find the nearest boundary of a specific type within a range."""
        relevant_boundaries = [
            b for b in boundaries if b.boundary_type == boundary_type
        ]

        best_boundary = None
        min_distance = float("inf")

        for boundary in relevant_boundaries:
            if start_pos < boundary.end_position <= end_pos:
                distance = end_pos - boundary.end_position
                if distance < min_distance:
                    min_distance = distance
                    best_boundary = boundary

        return best_boundary

    def _create_sentence_overlap(
        self, sentences: List[str], overlap_size: int
    ) -> List[str]:
        """Create overlap sentences for context preservation."""
        overlap_sentences = []
        current_length = 0

        # Take sentences from the end of the previous chunk for overlap
        for sentence in reversed(sentences):
            sentence_length = len(sentence)
            if current_length + sentence_length <= overlap_size:
                overlap_sentences.insert(0, sentence)
                current_length += sentence_length
            else:
                break

        return overlap_sentences

    def _find_semantic_boundaries(
        self, similarity_matrix: np.ndarray, sentences: List[str]
    ) -> List[int]:
        """Find semantic boundaries based on similarity drops."""
        boundaries = []

        for i in range(len(sentences) - 1):
            # Calculate average similarity before and after this point
            if i == 0:
                continue

            prev_similarity = np.mean(similarity_matrix[i - 1, :i])
            next_similarity = (
                np.mean(similarity_matrix[i, i + 1 :]) if i < len(sentences) - 1 else 0
            )

            # If there's a significant drop in similarity, mark as boundary
            similarity_drop = prev_similarity - next_similarity
            if similarity_drop > 0.3:  # Threshold for semantic boundary
                boundaries.append(i)

        return boundaries

    def _split_large_chunk(
        self,
        chunk_text: str,
        options: ProcessingOptions,
        sentence_boundaries: List[ChunkBoundary],
    ) -> List[Dict[str, Any]]:
        """Split a large chunk into smaller ones."""
        splits = []
        current_split = ""
        current_length = 0

        for boundary in sentence_boundaries:
            sentence_text = chunk_text[boundary.start_position : boundary.end_position]
            sentence_length = len(sentence_text)

            if current_length + sentence_length > options.chunk_size and current_split:
                splits.append(
                    {
                        "index": len(splits),
                        "content": current_split.strip(),
                        "chunk_type": "semantic_split",
                    }
                )
                current_split = sentence_text
                current_length = sentence_length
            else:
                current_split += " " + sentence_text if current_split else sentence_text
                current_length += sentence_length

        # Add final split
        if current_split:
            splits.append(
                {
                    "index": len(splits),
                    "content": current_split.strip(),
                    "chunk_type": "semantic_split",
                }
            )

        return splits

    def _enhance_with_semantic_analysis(
        self, chunks: List[Dict[str, Any]], text: str, options: ProcessingOptions
    ) -> List[Dict[str, Any]]:
        """Enhance chunks with semantic analysis."""
        enhanced_chunks = []

        for chunk in chunks:
            # Split chunk into sentences for analysis
            sentences = nltk.sent_tokenize(chunk["content"])

            if len(sentences) <= 1:
                enhanced_chunks.append(chunk)
                continue

            # Generate embeddings for sentences
            sentence_embeddings = self.sentence_model.encode(sentences)

            # Calculate semantic coherence
            coherence_score = self._calculate_chunk_coherence(sentence_embeddings)

            # Extract keywords
            keywords = self._extract_keywords(chunk["content"])

            # Enhanced chunk
            enhanced_chunk = chunk.copy()
            enhanced_chunk.update(
                {
                    "semantic_coherence": coherence_score,
                    "keywords": keywords,
                    "sentence_embeddings": sentence_embeddings.tolist(),
                }
            )

            enhanced_chunks.append(enhanced_chunk)

        return enhanced_chunks

    def _calculate_chunk_coherence(self, embeddings: np.ndarray) -> float:
        """Calculate semantic coherence score for a chunk."""
        if len(embeddings) < 2:
            return 1.0

        # Calculate pairwise similarities
        similarity_matrix = cosine_similarity(embeddings)

        # Average similarity excluding self-similarities
        mask = ~np.eye(similarity_matrix.shape[0], dtype=bool)
        avg_similarity = np.mean(similarity_matrix[mask])

        return avg_similarity

    def _extract_keywords(self, text: str, max_keywords: int = 10) -> List[str]:
        """Extract keywords from text using simple frequency analysis."""
        # Simple keyword extraction based on word frequency
        words = text.lower().split()

        # Filter out common stop words (simplified list)
        stop_words = {
            "the",
            "a",
            "an",
            "and",
            "or",
            "but",
            "in",
            "on",
            "at",
            "to",
            "for",
            "of",
            "with",
            "by",
        }
        filtered_words = [
            word
            for word in words
            if word.isalpha() and len(word) > 3 and word not in stop_words
        ]

        # Count word frequencies
        word_freq = {}
        for word in filtered_words:
            word_freq[word] = word_freq.get(word, 0) + 1

        # Sort by frequency and return top keywords
        sorted_words = sorted(word_freq.items(), key=lambda x: x[1], reverse=True)
        return [word for word, freq in sorted_words[:max_keywords]]

    def _optimize_chunk_boundaries_intelligent(
        self, chunks: List[Dict[str, Any]], text: str, options: ProcessingOptions
    ) -> List[Dict[str, Any]]:
        """Intelligently optimize chunk boundaries for context preservation."""
        if len(chunks) <= 1:
            return chunks

        optimized_chunks = []

        for i, chunk in enumerate(chunks):
            optimized_chunk = chunk.copy()

            # Add context from adjacent chunks
            context_size = min(100, options.chunk_overlap // 2)

            # Preceding context
            if i > 0:
                prev_chunk = chunks[i - 1]["content"]
                preceding_context = (
                    prev_chunk[-context_size:]
                    if len(prev_chunk) > context_size
                    else prev_chunk
                )
                optimized_chunk["preceding_context"] = preceding_context

            # Following context
            if i < len(chunks) - 1:
                next_chunk = chunks[i + 1]["content"]
                following_context = (
                    next_chunk[:context_size]
                    if len(next_chunk) > context_size
                    else next_chunk
                )
                optimized_chunk["following_context"] = following_context

            # Detect section titles
            section_title = self._detect_section_title(chunk["content"])
            if section_title:
                optimized_chunk["section_title"] = section_title
                optimized_chunk["hierarchical_level"] = (
                    self._estimate_hierarchical_level(section_title)
                )

            optimized_chunks.append(optimized_chunk)

        return optimized_chunks

    def _detect_section_title(self, text: str) -> Optional[str]:
        """Detect if chunk starts with a section title."""
        lines = text.split("\n")
        first_line = lines[0].strip() if lines else ""

        # Check for heading patterns
        if len(first_line) < 100 and (
            first_line.isupper()
            or re.match(r"^#{1,6}\s+", first_line)
            or re.match(r"^\d+\.", first_line)
        ):
            return first_line

        return None

    def _estimate_hierarchical_level(self, title: str) -> int:
        """Estimate hierarchical level of a section title."""
        if title.startswith("#"):
            return title.count("#")
        elif re.match(r"^\d+\.", title):
            return len(title.split(".")) - 1
        elif title.isupper():
            return 1
        else:
            return 3

    def _enhance_chunks_with_context(
        self,
        raw_chunks: List[Dict[str, Any]],
        text: str,
        options: ProcessingOptions,
        document_metadata: Optional[Dict[str, Any]] = None,
    ) -> List[ContextualChunk]:
        """Enhance raw chunks with contextual information."""
        contextual_chunks = []

        for chunk_data in raw_chunks:
            chunk = ContextualChunk(
                index=chunk_data["index"],
                content=chunk_data["content"],
                start_position=chunk_data.get("start_position", 0),
                end_position=chunk_data.get("end_position", len(chunk_data["content"])),
                chunk_type=chunk_data.get("chunk_type", "unknown"),
                language=document_metadata.get("language", "en")
                if document_metadata
                else "en",
                semantic_coherence=chunk_data.get("semantic_coherence", 0.0),
                topic_keywords=chunk_data.get("keywords", []),
                source_metadata=document_metadata or {},
            )

            contextual_chunks.append(chunk)

        return contextual_chunks

    def _calculate_semantic_coherence(
        self, chunks: List[ContextualChunk]
    ) -> List[ContextualChunk]:
        """Calculate semantic coherence for chunks."""
        if not self.sentence_model:
            return chunks

        for chunk in chunks:
            try:
                # Split into sentences and calculate coherence
                sentences = nltk.sent_tokenize(chunk.content)
                if len(sentences) > 1:
                    embeddings = self.sentence_model.encode(sentences)
                    chunk.semantic_coherence = self._calculate_chunk_coherence(
                        embeddings
                    )
                else:
                    chunk.semantic_coherence = 1.0
            except Exception as e:
                logger.warning(f"Failed to calculate semantic coherence: {e}")
                chunk.semantic_coherence = 0.5

        return chunks

    def _filter_chunks_by_quality(
        self, chunks: List[ContextualChunk], options: ProcessingOptions
    ) -> List[ContextualChunk]:
        """Filter chunks based on quality metrics."""
        filtered_chunks = []

        for chunk in chunks:
            # Size filters
            if len(chunk.content) < options.min_chunk_size:
                continue

            if len(chunk.content) > options.max_chunk_size:
                # Could split here, but for now skip
                continue

            # Coherence filter
            if chunk.semantic_coherence < 0.3:  # Low coherence threshold
                continue

            # Content quality check
            words = chunk.content.split()
            if len(words) < 3:  # Too few words
                continue

            # Calculate quality metrics
            chunk.quality_metrics = self._calculate_chunk_quality_metrics(chunk)

            filtered_chunks.append(chunk)

        return filtered_chunks

    def _calculate_chunk_quality_metrics(
        self, chunk: ContextualChunk
    ) -> Dict[str, float]:
        """Calculate quality metrics for a chunk."""
        words = chunk.content.split()
        sentences = nltk.sent_tokenize(chunk.content)

        # Basic metrics
        word_count = len(words)
        sentence_count = len(sentences)
        avg_sentence_length = word_count / sentence_count if sentence_count > 0 else 0

        # Content metrics
        alphanumeric_chars = sum(1 for c in chunk.content if c.isalnum())
        content_ratio = alphanumeric_chars / len(chunk.content) if chunk.content else 0

        # Unique word ratio
        unique_words = len(set(words))
        unique_ratio = unique_words / word_count if word_count > 0 else 0

        return {
            "word_count": word_count,
            "sentence_count": sentence_count,
            "avg_sentence_length": avg_sentence_length,
            "content_ratio": content_ratio,
            "unique_word_ratio": unique_ratio,
            "overall_quality": (
                min(1.0, word_count / 50) * 0.3  # Content volume
                + min(1.0, avg_sentence_length / 15) * 0.3  # Sentence quality
                + content_ratio * 0.2  # Content cleanliness
                + unique_ratio * 0.2  # Content diversity
            ),
        }

    def _optimize_chunk_boundaries(
        self, chunks: List[ContextualChunk], text: str, options: ProcessingOptions
    ) -> List[ContextualChunk]:
        """Final optimization of chunk boundaries."""
        # Sort chunks by position
        chunks.sort(key=lambda c: c.start_position)

        # Ensure no gaps and proper overlap
        optimized_chunks = []

        for i, chunk in enumerate(chunks):
            # Adjust boundaries to ensure overlap
            if (
                i > 0
                and chunk.start_position - chunks[i - 1].end_position
                < options.chunk_overlap
            ):
                # Increase overlap
                chunk.preceding_context = text[
                    max(
                        0, chunk.start_position - options.chunk_overlap
                    ) : chunk.start_position
                ]

            # Add following context
            if i < len(chunks) - 1:
                context_end = min(len(text), chunk.end_position + options.chunk_overlap)
                chunk.following_context = text[chunk.end_position : context_end]

            optimized_chunks.append(chunk)

        return optimized_chunks

    def _fallback_chunking(
        self, text: str, options: ProcessingOptions
    ) -> List[ContextualChunk]:
        """Fallback chunking method for error recovery."""
        chunks = []
        position = 0

        while position < len(text):
            chunk_end = min(position + options.chunk_size, len(text))
            chunk_text = text[position:chunk_end]

            if len(chunk_text.strip()) >= options.min_chunk_size:
                chunk = ContextualChunk(
                    index=len(chunks),
                    content=chunk_text,
                    start_position=position,
                    end_position=chunk_end,
                    chunk_type="fallback",
                    language="en",
                )
                chunks.append(chunk)

            position = chunk_end - options.chunk_overlap

        return chunks
