"""
Context Assembly Service

Advanced context assembly with token window optimization, smart chunking,
context compression, redundancy removal, and citation-aware assembly.
"""

import asyncio
import logging
import re
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple, Set
from enum import Enum
from dataclasses import dataclass, field
import json
import math
from collections import defaultdict, Counter

import tiktoken
from sentence_transformers import SentenceTransformer
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from app.core.config import get_settings
from app.models.document import DocumentChunk
from app.services.query_understanding_service import QueryAnalysis, QueryIntent

logger = logging.getLogger(__name__)
settings = get_settings()


class AssemblyStrategy(str, Enum):
    """Context assembly strategies"""

    SEQUENTIAL = "sequential"  # Simple sequential assembly
    IMPORTANCE_WEIGHTED = "importance_weighted"  # Weight by importance scores
    DIVERSITY_OPTIMIZED = "diversity_optimized"  # Maximize information diversity
    COHERENCE_FOCUSED = "coherence_focused"  # Prioritize coherent flow
    CITATION_AWARE = "citation_aware"  # Maintain citation integrity
    COMPRESSIVE = "compressive"  # Include compressed summaries
    HIERARCHICAL = "hierarchical"  # Multi-level hierarchical assembly
    ADAPTIVE = "adaptive"  # Adapt to query and content characteristics


class CompressionLevel(str, Enum):
    """Context compression levels"""

    NONE = "none"  # No compression
    LIGHT = "light"  # Light compression (10-20% reduction)
    MODERATE = "moderate"  # Moderate compression (20-40% reduction)
    AGGRESSIVE = "aggressive"  # Aggressive compression (40-60% reduction)
    EXTREME = "extreme"  # Extreme compression (60-80% reduction)


class RedundancyStrategy(str, Enum):
    """Redundancy removal strategies"""

    EXACT_DUPLICATE = "exact_duplicate"  # Remove exact duplicates
    SEMANTIC_SIMILARITY = "semantic_similarity"  # Remove semantically similar content
    OVERLAP_DETECTION = "overlap_detection"  # Remove overlapping content
    CONCEPTUAL_REDUNDANCY = (
        "conceptual_redundancy"  # Remove conceptually redundant info
    )


@dataclass
class AssemblyRequest:
    """Context assembly request"""

    chunks: List[DocumentChunk]
    query_analysis: Optional[QueryAnalysis] = None
    max_tokens: int = 4000
    assembly_strategy: AssemblyStrategy = AssemblyStrategy.ADAPTIVE
    compression_level: CompressionLevel = CompressionLevel.NONE
    redundancy_strategy: RedundancyStrategy = RedundancyStrategy.SEMANTIC_SIMILARITY
    include_citations: bool = True
    preserve_metadata: bool = True
    citation_style: str = "academic"  # academic, numbered, inline
    context_window_type: str = "llm"  # llm, summary, analysis
    user_language: str = "en"
    prioritize_recent: bool = True
    prioritize_authoritative: bool = True
    maintain_coherence: bool = True
    allow_truncation: bool = True
    chunk_separator: str = "\n\n---\n\n"


@dataclass
class ContextChunk:
    """Processed chunk with assembly metadata"""

    original_chunk: DocumentChunk
    processed_content: str
    token_count: int
    importance_score: float
    coherence_score: float
    redundancy_score: float
    citation_info: Dict[str, Any]
    metadata: Dict[str, Any] = field(default_factory=dict)
    compression_applied: bool = False
    truncation_applied: bool = False


@dataclass
class AssemblyResult:
    """Complete context assembly result"""

    assembled_context: str
    context_chunks: List[ContextChunk]
    total_tokens: int
    assembly_strategy: AssemblyStrategy
    compression_level: CompressionLevel
    assembly_time_ms: float
    compression_time_ms: float
    redundancy_removal_time_ms: float
    quality_metrics: Dict[str, float]
    citations: List[Dict[str, Any]]
    truncated_chunks: List[str]
    compression_stats: Dict[str, Any]
    coverage_analysis: Dict[str, Any]
    assembly_metadata: Dict[str, Any]


@dataclass
class ContextWindow:
    """Token-aware context window"""

    content: str
    token_count: int
    chunks_included: List[ContextChunk]
    window_metadata: Dict[str, Any] = field(default_factory=dict)
    overflow_handling: str = "truncate"  # truncate, summarize, compress


class ContextAssemblyService:
    """Advanced context assembly service"""

    def __init__(self):
        # Initialize tokenizers
        self._tokenizers = {}
        self._initialize_tokenizers()

        # Initialize models
        self._sentence_model = None
        self._tfidf_vectorizer = None
        self._initialize_models()

        # Initialize caches
        self._embedding_cache = {}
        self._compression_cache = {}
        self._assembly_cache = {}

        logger.info("Context Assembly Service initialized")

    def _initialize_tokenizers(self) -> None:
        """Initialize tokenizers for different models"""
        try:
            # OpenAI tokenizers
            self._tokenizers["gpt-3.5-turbo"] = tiktoken.get_encoding("cl100k_base")
            self._tokenizers["gpt-4"] = tiktoken.get_encoding("cl100k_base")
            self._tokenizers["claude"] = tiktoken.get_encoding(
                "cl100k_base"
            )  # Approximation

            # Default tokenizer
            self._tokenizers["default"] = tiktoken.get_encoding("cl100k_base")

            logger.info("Tokenizers initialized successfully")

        except Exception as e:
            logger.error(f"Failed to initialize tokenizers: {e}")

    def _initialize_models(self) -> None:
        """Initialize models for processing"""
        try:
            # Sentence transformer for semantic similarity
            self._sentence_model = SentenceTransformer("all-MiniLM-L6-v2")

            # TF-IDF vectorizer for redundancy detection
            self._tfidf_vectorizer = TfidfVectorizer(
                max_features=1000, stop_words="english", ngram_range=(1, 2), min_df=1
            )

            logger.info("Models initialized successfully")

        except Exception as e:
            logger.error(f"Failed to initialize models: {e}")

    async def assemble_context(self, request: AssemblyRequest) -> AssemblyResult:
        """
        Assemble context from document chunks

        Args:
            request: Assembly request parameters

        Returns:
            Complete assembly result
        """
        start_time = datetime.now()

        try:
            # Pre-process chunks
            processed_chunks = await self._preprocess_chunks(request.chunks, request)

            # Apply redundancy removal
            deduplicated_chunks = await self._apply_redundancy_removal(
                processed_chunks, request
            )

            # Apply compression if requested
            compressed_chunks = await self._apply_compression(
                deduplicated_chunks, request
            )

            # Sort chunks based on assembly strategy
            sorted_chunks = self._sort_chunks_by_strategy(compressed_chunks, request)

            # Assemble context within token limits
            assembled_context, context_chunks = await self._assemble_context_window(
                sorted_chunks, request
            )

            # Generate citations if requested
            citations = []
            if request.include_citations:
                citations = self._generate_citations(context_chunks, request)

            # Calculate processing time
            assembly_time = (datetime.now() - start_time).total_seconds() * 1000

            # Calculate quality metrics
            quality_metrics = self._calculate_quality_metrics(context_chunks, request)

            # Analyze coverage
            coverage_analysis = self._analyze_coverage(context_chunks, request)

            # Generate compression stats
            compression_stats = self._calculate_compression_stats(
                processed_chunks, context_chunks, request
            )

            result = AssemblyResult(
                assembled_context=assembled_context,
                context_chunks=context_chunks,
                total_tokens=self._count_tokens(
                    assembled_context, request.context_window_type
                ),
                assembly_strategy=request.assembly_strategy,
                compression_level=request.compression_level,
                assembly_time_ms=assembly_time,
                compression_time_ms=0.0,  # Would track separately
                redundancy_removal_time_ms=0.0,  # Would track separately
                quality_metrics=quality_metrics,
                citations=citations,
                truncated_chunks=[
                    c.original_chunk.id for c in context_chunks if c.truncation_applied
                ],
                compression_stats=compression_stats,
                coverage_analysis=coverage_analysis,
                assembly_metadata={
                    "total_chunks_processed": len(request.chunks),
                    "chunks_included": len(context_chunks),
                    "chunks_removed": len(request.chunks) - len(context_chunks),
                    "avg_chunk_importance": np.mean(
                        [c.importance_score for c in context_chunks]
                    )
                    if context_chunks
                    else 0.0,
                },
            )

            # Cache assembly result
            self._cache_assembly_result(request, result)

            logger.info(
                f"Context assembled: {len(context_chunks)} chunks, "
                f"{result.total_tokens} tokens, strategy={request.assembly_strategy}"
            )

            return result

        except Exception as e:
            logger.error(f"Context assembly failed: {e}")
            return await self._fallback_assembly(request)

    async def _preprocess_chunks(
        self, chunks: List[DocumentChunk], request: AssemblyRequest
    ) -> List[ContextChunk]:
        """
        Pre-process chunks for assembly

        Args:
            chunks: Original document chunks
            request: Assembly request

        Returns:
            Pre-processed context chunks
        """
        processed_chunks = []

        for chunk in chunks:
            # Clean and normalize content
            cleaned_content = self._clean_content(chunk.content)

            # Calculate token count
            token_count = self._count_tokens(
                cleaned_content, request.context_window_type
            )

            # Calculate importance score
            importance_score = self._calculate_importance_score(chunk, request)

            # Calculate coherence score
            coherence_score = self._calculate_coherence_score(cleaned_content)

            # Calculate redundancy score (initial)
            redundancy_score = 1.0  # Will be updated later

            # Prepare citation info
            citation_info = self._prepare_citation_info(chunk, request)

            # Create context chunk
            context_chunk = ContextChunk(
                original_chunk=chunk,
                processed_content=cleaned_content,
                token_count=token_count,
                importance_score=importance_score,
                coherence_score=coherence_score,
                redundancy_score=redundancy_score,
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

    def _clean_content(self, content: str) -> str:
        """
        Clean and normalize content

        Args:
            content: Original content

        Returns:
            Cleaned content
        """
        # Remove extra whitespace
        content = re.sub(r"\s+", " ", content.strip())

        # Remove special characters but keep important punctuation
        content = re.sub(r"[^\w\s\.\,\:\;\-\(\)\[\]\{\}\"\'\?\!\n]", " ", content)

        # Normalize quotes
        content = re.sub(r'["""]', '"', content)
        content = re.sub(r"[" "]", "'", content)

        # Fix spacing around punctuation
        content = re.sub(r"\s+([.,;:!?)])", r"\1", content)
        content = re.sub(r"([(\[])\s+", r"\1", content)
        content = re.sub(r"\s+([)\]])", r"\1", content)

        return content

    def _calculate_importance_score(
        self, chunk: DocumentChunk, request: AssemblyRequest
    ) -> float:
        """
        Calculate importance score for a chunk

        Args:
            chunk: Document chunk
            request: Assembly request

        Returns:
            Importance score (0-1)
        """
        score = 0.5  # Base score

        # Authority boost
        if request.prioritize_authoritative:
            authority_score = self._get_authority_score(chunk)
            score += 0.2 * authority_score

        # Recency boost
        if request.prioritize_recent:
            recency_score = self._get_recency_score(chunk)
            score += 0.1 * recency_score

        # Content length boost (prefer substantial content)
        content_length = len(chunk.content)
        if content_length > 500:
            score += 0.1
        elif content_length > 200:
            score += 0.05

        # Query relevance boost
        if request.query_analysis:
            relevance_score = self._calculate_query_relevance(
                chunk, request.query_analysis
            )
            score += 0.3 * relevance_score

        # Source type boost
        source_type = chunk.metadata.get("source_type", "").lower()
        if source_type in ["academic", "official", "peer_reviewed"]:
            score += 0.15
        elif source_type in ["book", "journal", "report"]:
            score += 0.1

        return min(max(score, 0.0), 1.0)

    def _get_authority_score(self, chunk: DocumentChunk) -> float:
        """
        Get authority score for a chunk

        Args:
            chunk: Document chunk

        Returns:
            Authority score (0-1)
        """
        # Check metadata for authority indicators
        metadata = chunk.metadata or {}

        score = 0.5  # Base score

        # Source type authority
        source_type = metadata.get("source_type", "").lower()
        if source_type == "peer_reviewed":
            score += 0.4
        elif source_type == "academic":
            score += 0.3
        elif source_type == "official":
            score += 0.2

        # Citation count boost
        citation_count = metadata.get("citation_count", 0)
        if citation_count > 100:
            score += 0.2
        elif citation_count > 10:
            score += 0.1

        # Author verification
        if metadata.get("author_verified"):
            score += 0.1

        return min(score, 1.0)

    def _get_recency_score(self, chunk: DocumentChunk) -> float:
        """
        Get recency score for a chunk

        Args:
            chunk: Document chunk

        Returns:
            Recency score (0-1)
        """
        # In a real implementation, would use actual timestamps
        # For now, use metadata or default values
        metadata = chunk.metadata or {}

        # Check if explicitly marked as recent
        if metadata.get("is_recent"):
            return 1.0

        # Check publication year
        year = metadata.get("publication_year")
        if year:
            current_year = datetime.now().year
            age = current_year - year
            if age < 1:
                return 1.0
            elif age < 3:
                return 0.8
            elif age < 5:
                return 0.6
            elif age < 10:
                return 0.4
            else:
                return 0.2

        return 0.5  # Default for unknown age

    def _calculate_query_relevance(
        self, chunk: DocumentChunk, query_analysis: QueryAnalysis
    ) -> float:
        """
        Calculate query relevance for a chunk

        Args:
            chunk: Document chunk
            query_analysis: Query analysis

        Returns:
            Query relevance score (0-1)
        """
        content_lower = chunk.content.lower()
        score = 0.0

        # Keyword matching
        query_keywords = query_analysis.keywords or []
        keyword_matches = sum(
            1 for keyword in query_keywords if keyword.lower() in content_lower
        )
        if query_keywords:
            score += (keyword_matches / len(query_keywords)) * 0.4

        # Entity matching
        query_entities = query_analysis.entities or []
        entity_matches = sum(
            1 for entity in query_entities if entity.text.lower() in content_lower
        )
        if query_entities:
            score += (entity_matches / len(query_entities)) * 0.3

        # Intent-specific matching
        intent = query_analysis.intent
        if intent == QueryIntent.DEFINITION:
            definition_words = ["define", "definition", "meaning", "refers to"]
            if any(word in content_lower for word in definition_words):
                score += 0.2
        elif intent == QueryIntent.PROCEDURAL:
            procedural_words = ["step", "process", "procedure", "method"]
            if any(word in content_lower for word in procedural_words):
                score += 0.2
        elif intent == QueryIntent.COMPARISON:
            comparison_words = ["versus", "compare", "difference", "while"]
            if any(word in content_lower for word in comparison_words):
                score += 0.2

        return min(score, 1.0)

    def _calculate_coherence_score(self, content: str) -> float:
        """
        Calculate coherence score for content

        Args:
            content: Content text

        Returns:
            Coherence score (0-1)
        """
        # Simple coherence metrics
        sentences = re.split(r"[.!?]+", content)
        sentences = [s.strip() for s in sentences if s.strip()]

        if len(sentences) < 2:
            return 0.5

        # Average sentence length
        avg_sentence_length = sum(len(s.split()) for s in sentences) / len(sentences)
        length_score = 1.0 if 10 <= avg_sentence_length <= 25 else 0.5

        # Transition words presence
        transition_words = [
            "however",
            "therefore",
            "moreover",
            "furthermore",
            "consequently",
            "additionally",
            "nevertheless",
            "meanwhile",
            "likewise",
            "similarly",
        ]
        transition_count = sum(
            1 for word in transition_words if word in content.lower()
        )
        transition_score = min(transition_count / len(sentences), 1.0)

        # Coherent flow (simple check for logical connectors)
        connectors = ["because", "since", "so", "thus", "hence", "thereby"]
        connector_count = sum(
            1 for connector in connectors if connector in content.lower()
        )
        connector_score = min(connector_count / len(sentences), 1.0)

        return (length_score + transition_score + connector_score) / 3

    def _prepare_citation_info(
        self, chunk: DocumentChunk, request: AssemblyRequest
    ) -> Dict[str, Any]:
        """
        Prepare citation information for a chunk

        Args:
            chunk: Document chunk
            request: Assembly request

        Returns:
            Citation information dictionary
        """
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

        # Add style-specific formatting
        if request.citation_style == "academic":
            citation_info["formatted"] = self._format_academic_citation(citation_info)
        elif request.citation_style == "numbered":
            citation_info["formatted"] = f"[{chunk.id}]"
        elif request.citation_style == "inline":
            citation_info["formatted"] = (
                f"({metadata.get('author', 'Unknown')}, {metadata.get('publication_year', 'n.d.')})"
            )

        return citation_info

    def _format_academic_citation(self, citation_info: Dict[str, Any]) -> str:
        """
        Format academic style citation

        Args:
            citation_info: Citation information

        Returns:
            Formatted citation string
        """
        author = citation_info.get("author", "Unknown")
        title = citation_info.get("title", "")
        publication_date = citation_info.get("publication_date", "")
        source = citation_info.get("source", "")

        # Simple APA-like format
        citation = f"{author} ({publication_date}). {title}. {source}."

        return citation

    async def _apply_redundancy_removal(
        self, chunks: List[ContextChunk], request: AssemblyRequest
    ) -> List[ContextChunk]:
        """
        Apply redundancy removal strategy

        Args:
            chunks: Pre-processed chunks
            request: Assembly request

        Returns:
            Deduplicated chunks
        """
        if request.redundancy_strategy == RedundancyStrategy.NONE:
            return chunks

        try:
            if request.redundancy_strategy == RedundancyStrategy.EXACT_DUPLICATE:
                return self._remove_exact_duplicates(chunks)
            elif request.redundancy_strategy == RedundancyStrategy.SEMANTIC_SIMILARITY:
                return await self._remove_semantic_duplicates(chunks, request)
            elif request.redundancy_strategy == RedundancyStrategy.OVERLAP_DETECTION:
                return self._remove_overlapping_content(chunks)
            elif (
                request.redundancy_strategy == RedundancyStrategy.CONCEPTUAL_REDUNDANCY
            ):
                return await self._remove_conceptual_redundancy(chunks, request)

            return chunks

        except Exception as e:
            logger.error(f"Redundancy removal failed: {e}")
            return chunks

    def _remove_exact_duplicates(
        self, chunks: List[ContextChunk]
    ) -> List[ContextChunk]:
        """
        Remove exact duplicate chunks

        Args:
            chunks: Input chunks

        Returns:
            Deduplicated chunks
        """
        seen_contents = set()
        deduplicated = []

        for chunk in chunks:
            content_hash = hash(chunk.processed_content)
            if content_hash not in seen_contents:
                seen_contents.add(content_hash)
                deduplicated.append(chunk)

        return deduplicated

    async def _remove_semantic_duplicates(
        self, chunks: List[ContextChunk], request: AssemblyRequest
    ) -> List[ContextChunk]:
        """
        Remove semantically similar chunks

        Args:
            chunks: Input chunks
            request: Assembly request

        Returns:
            Deduplicated chunks
        """
        if not self._sentence_model:
            return chunks

        try:
            # Generate embeddings for all chunks
            contents = [chunk.processed_content for chunk in chunks]
            embeddings = self._sentence_model.encode(contents)

            # Calculate similarity matrix
            similarity_matrix = cosine_similarity(embeddings)

            # Remove similar chunks (keep higher importance)
            deduplicated = []
            removed_indices = set()

            for i, chunk in enumerate(chunks):
                if i in removed_indices:
                    continue

                deduplicated.append(chunk)

                # Mark similar chunks for removal
                for j in range(i + 1, len(chunks)):
                    if j not in removed_indices and similarity_matrix[i][j] > 0.8:
                        # Keep the more important chunk
                        if chunks[j].importance_score > chunk.importance_score:
                            deduplicated.pop()  # Remove current chunk
                            deduplicated.append(chunks[j])  # Add more important one
                        removed_indices.add(j)

            return deduplicated

        except Exception as e:
            logger.error(f"Semantic duplicate removal failed: {e}")
            return chunks

    def _remove_overlapping_content(
        self, chunks: List[ContextChunk]
    ) -> List[ContextChunk]:
        """
        Remove chunks with overlapping content

        Args:
            chunks: Input chunks

        Returns:
            Deduplicated chunks
        """
        deduplicated = []

        for chunk in chunks:
            has_overlap = False

            for existing_chunk in deduplicated:
                # Check for significant overlap
                overlap_ratio = self._calculate_content_overlap(
                    chunk.processed_content, existing_chunk.processed_content
                )

                if overlap_ratio > 0.7:  # 70% overlap threshold
                    has_overlap = True
                    # Keep the more important chunk
                    if chunk.importance_score > existing_chunk.importance_score:
                        deduplicated.remove(existing_chunk)
                        deduplicated.append(chunk)
                    break

            if not has_overlap:
                deduplicated.append(chunk)

        return deduplicated

    def _calculate_content_overlap(self, content1: str, content2: str) -> float:
        """
        Calculate overlap ratio between two contents

        Args:
            content1: First content
            content2: Second content

        Returns:
            Overlap ratio (0-1)
        """
        # Split into sentences
        sentences1 = set(re.split(r"[.!?]+", content1.strip()))
        sentences2 = set(re.split(r"[.!?]+", content2.strip()))

        # Remove empty sentences
        sentences1 = {s.strip() for s in sentences1 if s.strip()}
        sentences2 = {s.strip() for s in sentences2 if s.strip()}

        if not sentences1 or not sentences2:
            return 0.0

        # Calculate Jaccard similarity
        intersection = len(sentences1.intersection(sentences2))
        union = len(sentences1.union(sentences2))

        return intersection / union if union > 0 else 0.0

    async def _remove_conceptual_redundancy(
        self, chunks: List[ContextChunk], request: AssemblyRequest
    ) -> List[ContextChunk]:
        """
        Remove conceptually redundant chunks

        Args:
            chunks: Input chunks
            request: Assembly request

        Returns:
            Deduplicated chunks
        """
        # Extract key concepts from each chunk
        chunk_concepts = []
        for chunk in chunks:
            concepts = self._extract_key_concepts(chunk.processed_content)
            chunk_concepts.append((chunk, concepts))

        # Remove chunks with overlapping concepts
        deduplicated = []
        seen_concepts = set()

        for chunk, concepts in chunk_concepts:
            concept_overlap = len(set(concepts) & seen_concepts)

            # If significant concept overlap and less important, skip
            if concept_overlap > len(concepts) * 0.5:
                # Check if any existing chunk has higher importance
                existing_more_important = any(
                    existing_chunk.importance_score > chunk.importance_score
                    for existing_chunk in deduplicated
                )

                if existing_more_important:
                    continue

            deduplicated.append(chunk)
            seen_concepts.update(concepts)

        return deduplicated

    def _extract_key_concepts(self, content: str) -> List[str]:
        """
        Extract key concepts from content

        Args:
            content: Content text

        Returns:
            List of key concepts
        """
        # Simple concept extraction based on noun phrases and keywords
        words = content.lower().split()

        # Filter out stop words and short words
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
        }
        concepts = [word for word in words if word not in stop_words and len(word) > 3]

        # Return most frequent concepts
        concept_freq = Counter(concepts)
        return [concept for concept, freq in concept_freq.most_common(10)]

    async def _apply_compression(
        self, chunks: List[ContextChunk], request: AssemblyRequest
    ) -> List[ContextChunk]:
        """
        Apply compression to chunks

        Args:
            chunks: Deduplicated chunks
            request: Assembly request

        Returns:
            Compressed chunks
        """
        if request.compression_level == CompressionLevel.NONE:
            return chunks

        try:
            compression_ratio = self._get_compression_ratio(request.compression_level)

            compressed_chunks = []
            for chunk in chunks:
                compressed_content = await self._compress_content(
                    chunk.processed_content, compression_ratio
                )

                # Update token count
                new_token_count = self._count_tokens(
                    compressed_content, request.context_window_type
                )

                # Create compressed chunk
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

    def _get_compression_ratio(self, compression_level: CompressionLevel) -> float:
        """
        Get compression ratio for compression level

        Args:
            compression_level: Compression level

        Returns:
            Compression ratio (0-1)
        """
        ratios = {
            CompressionLevel.LIGHT: 0.1,  # 10% compression
            CompressionLevel.MODERATE: 0.3,  # 30% compression
            CompressionLevel.AGGRESSIVE: 0.5,  # 50% compression
            CompressionLevel.EXTREME: 0.7,  # 70% compression
        }
        return ratios.get(compression_level, 0.0)

    async def _compress_content(self, content: str, compression_ratio: float) -> str:
        """
        Compress content by specified ratio

        Args:
            content: Original content
            compression_ratio: Compression ratio (0-1)

        Returns:
            Compressed content
        """
        if compression_ratio <= 0:
            return content

        try:
            # Split into sentences
            sentences = re.split(r"(?<=[.!?])\s+", content.strip())
            sentences = [s.strip() for s in sentences if s.strip()]

            if len(sentences) <= 1:
                return content

            # Calculate target number of sentences
            target_sentences = max(1, int(len(sentences) * (1 - compression_ratio)))

            # Score sentences by importance
            sentence_scores = []
            for i, sentence in enumerate(sentences):
                score = self._score_sentence_importance(sentence, i, len(sentences))
                sentence_scores.append((sentence, score))

            # Sort by score and select top sentences
            sentence_scores.sort(key=lambda x: x[1], reverse=True)
            selected_sentences = [s for s, _ in sentence_scores[:target_sentences]]

            # Maintain original order
            selected_sentences.sort(key=lambda s: sentences.index(s))

            return " ".join(selected_sentences)

        except Exception as e:
            logger.warning(f"Content compression failed: {e}")
            return content

    def _score_sentence_importance(
        self, sentence: str, position: int, total_sentences: int
    ) -> float:
        """
        Score sentence importance for compression

        Args:
            sentence: Sentence text
            position: Position in text
            total_sentences: Total number of sentences

        Returns:
            Importance score
        """
        score = 0.0

        # Length boost (prefer medium-length sentences)
        length = len(sentence.split())
        if 10 <= length <= 20:
            score += 0.3
        elif 5 <= length <= 30:
            score += 0.2

        # Position boost (beginning and end sentences are often important)
        if position == 0 or position == total_sentences - 1:
            score += 0.3
        elif position < 3 or position > total_sentences - 4:
            score += 0.1

        # Keyword boost
        important_words = [
            "important",
            "significant",
            "crucial",
            "essential",
            "key",
            "main",
            "primary",
            "major",
            "critical",
            "vital",
        ]
        if any(word in sentence.lower() for word in important_words):
            score += 0.2

        # Number/data boost
        if any(char.isdigit() for char in sentence):
            score += 0.1

        # Question/answer boost
        if "?" in sentence or any(
            word in sentence.lower() for word in ["because", "therefore", "thus"]
        ):
            score += 0.1

        return score

    def _sort_chunks_by_strategy(
        self, chunks: List[ContextChunk], request: AssemblyRequest
    ) -> List[ContextChunk]:
        """
        Sort chunks based on assembly strategy

        Args:
            chunks: Input chunks
            request: Assembly request

        Returns:
            Sorted chunks
        """
        if request.assembly_strategy == AssemblyStrategy.SEQUENTIAL:
            return chunks  # Keep original order

        elif request.assembly_strategy == AssemblyStrategy.IMPORTANCE_WEIGHTED:
            return sorted(chunks, key=lambda x: x.importance_score, reverse=True)

        elif request.assembly_strategy == AssemblyStrategy.DIVERSITY_OPTIMIZED:
            return self._sort_by_diversity(chunks)

        elif request.assembly_strategy == AssemblyStrategy.COHERENCE_FOCUSED:
            return sorted(chunks, key=lambda x: x.coherence_score, reverse=True)

        elif request.assembly_strategy == AssemblyStrategy.CITATION_AWARE:
            return self._sort_by_citation_importance(chunks)

        elif request.assembly_strategy == AssemblyStrategy.HIERARCHICAL:
            return self._sort_hierarchically(chunks)

        elif request.assembly_strategy == AssemblyStrategy.ADAPTIVE:
            return self._adaptive_sorting(chunks, request)

        else:
            # Default to importance-weighted
            return sorted(chunks, key=lambda x: x.importance_score, reverse=True)

    def _sort_by_diversity(self, chunks: List[ContextChunk]) -> List[ContextChunk]:
        """
        Sort chunks to maximize diversity

        Args:
            chunks: Input chunks

        Returns:
            Diversity-sorted chunks
        """
        if not chunks:
            return chunks

        sorted_chunks = [chunks[0]]  # Start with most important
        remaining_chunks = chunks[1:]

        while remaining_chunks:
            best_chunk = None
            best_diversity_score = -1

            for chunk in remaining_chunks:
                # Calculate diversity score (minimum similarity to already selected)
                min_similarity = 1.0

                for selected_chunk in sorted_chunks:
                    similarity = self._calculate_content_similarity(
                        chunk.processed_content, selected_chunk.processed_content
                    )
                    min_similarity = min(min_similarity, similarity)

                # Balance importance and diversity
                diversity_score = chunk.importance_score * (1 - min_similarity)

                if diversity_score > best_diversity_score:
                    best_diversity_score = diversity_score
                    best_chunk = chunk

            if best_chunk:
                sorted_chunks.append(best_chunk)
                remaining_chunks.remove(best_chunk)
            else:
                break

        return sorted_chunks

    def _calculate_content_similarity(self, content1: str, content2: str) -> float:
        """
        Calculate similarity between two content pieces

        Args:
            content1: First content
            content2: Second content

        Returns:
            Similarity score (0-1)
        """
        # Simple word overlap similarity
        words1 = set(content1.lower().split())
        words2 = set(content2.lower().split())

        if not words1 or not words2:
            return 0.0

        intersection = len(words1.intersection(words2))
        union = len(words1.union(words2))

        return intersection / union if union > 0 else 0.0

    def _sort_by_citation_importance(
        self, chunks: List[ContextChunk]
    ) -> List[ContextChunk]:
        """
        Sort chunks by citation importance

        Args:
            chunks: Input chunks

        Returns:
            Citation-sorted chunks
        """

        def citation_importance_score(chunk: ContextChunk) -> float:
            citation_info = chunk.citation_info

            score = chunk.importance_score * 0.5

            # Authoritative sources get boost
            source = citation_info.get("source", "").lower()
            if any(term in source for term in ["academic", "journal", "peer"]):
                score += 0.3

            # Recent publications get boost
            pub_date = citation_info.get("publication_date", "")
            if pub_date and "202" in pub_date:  # 2020s
                score += 0.1

            return score

        return sorted(chunks, key=citation_importance_score, reverse=True)

    def _sort_hierarchically(self, chunks: List[ContextChunk]) -> List[ContextChunk]:
        """
        Sort chunks hierarchically (overview first, then details)

        Args:
            chunks: Input chunks

        Returns:
            Hierarchically sorted chunks
        """
        # Classify chunks as overview or detail
        overview_chunks = []
        detail_chunks = []

        for chunk in chunks:
            content = chunk.processed_content.lower()

            # Overview indicators
            overview_indicators = [
                "introduction",
                "overview",
                "summary",
                "background",
                "definition",
                "concept",
                "principle",
                "theory",
            ]

            if any(indicator in content for indicator in overview_indicators):
                overview_chunks.append(chunk)
            else:
                detail_chunks.append(chunk)

        # Sort each group by importance
        overview_chunks.sort(key=lambda x: x.importance_score, reverse=True)
        detail_chunks.sort(key=lambda x: x.importance_score, reverse=True)

        return overview_chunks + detail_chunks

    def _adaptive_sorting(
        self, chunks: List[ContextChunk], request: AssemblyRequest
    ) -> List[ContextChunk]:
        """
        Adaptive sorting based on query and content characteristics

        Args:
            chunks: Input chunks
            request: Assembly request

        Returns:
            Adaptively sorted chunks
        """
        if not request.query_analysis:
            return sorted(chunks, key=lambda x: x.importance_score, reverse=True)

        intent = request.query_analysis.intent

        if intent == QueryIntent.COMPARISON:
            return self._sort_for_comparison(chunks)
        elif intent == QueryIntent.DEFINITION:
            return self._sort_for_definition(chunks)
        elif intent == QueryIntent.PROCEDURAL:
            return self._sort_for_procedural(chunks)
        elif intent == QueryIntent.ANALYSIS:
            return self._sort_for_analysis(chunks)
        else:
            return sorted(chunks, key=lambda x: x.importance_score, reverse=True)

    def _sort_for_comparison(self, chunks: List[ContextChunk]) -> List[ContextChunk]:
        """Sort chunks optimized for comparison queries"""

        # Prioritize chunks with comparative language
        def comparison_score(chunk: ContextChunk) -> float:
            content = chunk.processed_content.lower()
            comparison_words = [
                "versus",
                "compare",
                "difference",
                "while",
                "however",
                "although",
                "whereas",
                "unlike",
                "similar",
                "contrast",
            ]
            comparison_count = sum(1 for word in comparison_words if word in content)

            return chunk.importance_score + (comparison_count * 0.1)

        return sorted(chunks, key=comparison_score, reverse=True)

    def _sort_for_definition(self, chunks: List[ContextChunk]) -> List[ContextChunk]:
        """Sort chunks optimized for definition queries"""

        # Prioritize chunks with definitions and concise content
        def definition_score(chunk: ContextChunk) -> float:
            content = chunk.processed_content.lower()
            definition_words = [
                "define",
                "definition",
                "meaning",
                "refers to",
                "is a",
                "can be defined as",
                "the term",
                "concept",
            ]
            definition_count = sum(1 for word in definition_words if word in content)

            # Boost concise content for definitions
            conciseness_boost = 1.0 if len(content) < 500 else 0.5

            return (
                chunk.importance_score + (definition_count * 0.15) * conciseness_boost
            )

        return sorted(chunks, key=definition_score, reverse=True)

    def _sort_for_procedural(self, chunks: List[ContextChunk]) -> List[ContextChunk]:
        """Sort chunks optimized for procedural queries"""

        # Prioritize chunks with step-by-step content
        def procedural_score(chunk: ContextChunk) -> float:
            content = chunk.processed_content.lower()
            procedural_words = [
                "step",
                "first",
                "then",
                "next",
                "finally",
                "procedure",
                "process",
                "method",
                "how to",
                "guide",
                "instruction",
            ]
            procedural_count = sum(1 for word in procedural_words if word in content)

            # Boost numbered content
            numbered_boost = (
                0.3 if any(f"{i}." in content for i in range(1, 10)) else 0.0
            )

            return chunk.importance_score + (procedural_count * 0.1) + numbered_boost

        return sorted(chunks, key=procedural_score, reverse=True)

    def _sort_for_analysis(self, chunks: List[ContextChunk]) -> List[ContextChunk]:
        """Sort chunks optimized for analysis queries"""

        # Prioritize chunks with analytical language and data
        def analysis_score(chunk: ContextChunk) -> float:
            content = chunk.processed_content.lower()
            analytical_words = [
                "analysis",
                "examine",
                "evaluate",
                "assess",
                "consider",
                "factor",
                "impact",
                "effect",
                "relationship",
                "correlation",
            ]
            analytical_count = sum(1 for word in analytical_words if word in content)

            # Boost data-rich content
            data_indicators = ["%", "$", "data", "statistics", "study", "research"]
            data_count = sum(1 for indicator in data_indicators if indicator in content)

            return (
                chunk.importance_score + (analytical_count * 0.1) + (data_count * 0.05)
            )

        return sorted(chunks, key=analysis_score, reverse=True)

    async def _assemble_context_window(
        self, chunks: List[ContextChunk], request: AssemblyRequest
    ) -> Tuple[str, List[ContextChunk]]:
        """
        Assemble context within token limits

        Args:
            chunks: Sorted chunks
            request: Assembly request

        Returns:
            Tuple of (assembled context, included chunks)
        """
        if not chunks:
            return "", []

        included_chunks = []
        total_tokens = 0
        context_parts = []

        # Add separator if requested
        separator = request.chunk_separator

        for chunk in chunks:
            chunk_tokens = chunk.token_count

            # Check if adding this chunk would exceed token limit
            if total_tokens + chunk_tokens > request.max_tokens:
                if request.allow_truncation and included_chunks:
                    # Try to add truncated version
                    remaining_tokens = request.max_tokens - total_tokens
                    if remaining_tokens > 50:  # Minimum meaningful content
                        truncated_content = self._truncate_content(
                            chunk.processed_content,
                            remaining_tokens,
                            request.context_window_type,
                        )

                        # Create truncated chunk
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

            # Add full chunk
            included_chunks.append(chunk)
            context_parts.append(chunk.processed_content)
            total_tokens += chunk_tokens

            # Stop if we've reached the token limit exactly
            if total_tokens >= request.max_tokens:
                break

        # Assemble final context
        if request.include_citations:
            assembled_context = self._assemble_with_citations(
                context_parts, included_chunks, request
            )
        else:
            assembled_context = separator.join(context_parts)

        return assembled_context, included_chunks

    def _truncate_content(
        self, content: str, max_tokens: int, context_window_type: str
    ) -> str:
        """
        Truncate content to fit within token limit

        Args:
            content: Original content
            max_tokens: Maximum tokens allowed
            context_window_type: Type of context window

        Returns:
            Truncated content
        """
        if not content:
            return content

        # Estimate character to token ratio (rough approximation)
        chars_per_token = 4  # Average characters per token

        max_chars = max_tokens * chars_per_token

        if len(content) <= max_chars:
            return content

        # Try to truncate at sentence boundary
        sentences = re.split(r"(?<=[.!?])\s+", content)
        truncated_sentences = []
        current_length = 0

        for sentence in sentences:
            if (
                current_length + len(sentence) <= max_chars - 50
            ):  # Leave room for truncation indicator
                truncated_sentences.append(sentence)
                current_length += len(sentence) + 1  # +1 for space
            else:
                break

        truncated_content = " ".join(truncated_sentences)

        # Add truncation indicator
        if len(truncated_content) < len(content):
            truncated_content += "..."

        return truncated_content

    def _assemble_with_citations(
        self,
        context_parts: List[str],
        chunks: List[ContextChunk],
        request: AssemblyRequest,
    ) -> str:
        """
        Assemble context with citations

        Args:
            context_parts: Context content parts
            chunks: Included chunks
            request: Assembly request

        Returns:
            Assembled context with citations
        """
        separator = request.chunk_separator
        assembled_parts = []

        for i, (content, chunk) in enumerate(zip(context_parts, chunks)):
            # Add content
            assembled_parts.append(content)

            # Add citation based on style
            citation = chunk.citation_info.get("formatted", f"[{i + 1}]")

            if request.citation_style == "inline":
                # Inline citation at end of content
                if not content.endswith(citation):
                    assembled_parts[-1] += f" {citation}"
            elif request.citation_style == "numbered":
                # Numbered citation on new line
                assembled_parts[-1] += f"\n\n{citation}"
            elif request.citation_style == "academic":
                # Academic citation on new line
                assembled_parts[-1] += f"\n\nSource: {citation}"

            # Add separator except for last part
            if i < len(context_parts) - 1:
                assembled_parts.append(separator)

        return "".join(assembled_parts)

    def _generate_citations(
        self, chunks: List[ContextChunk], request: AssemblyRequest
    ) -> List[Dict[str, Any]]:
        """
        Generate citation list

        Args:
            chunks: Included chunks
            request: Assembly request

        Returns:
            List of citations
        """
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

    def _count_tokens(self, text: str, context_window_type: str) -> int:
        """
        Count tokens in text

        Args:
            text: Text to count tokens for
            context_window_type: Type of context window

        Returns:
            Token count
        """
        if not text:
            return 0

        try:
            # Get appropriate tokenizer
            tokenizer = self._tokenizers.get(
                context_window_type, self._tokenizers["default"]
            )

            # Encode and count
            tokens = tokenizer.encode(text)
            return len(tokens)

        except Exception as e:
            logger.warning(f"Token counting failed: {e}")
            # Fallback to rough estimation
            return len(text) // 4  # Rough estimate of 4 characters per token

    def _calculate_quality_metrics(
        self, chunks: List[ContextChunk], request: AssemblyRequest
    ) -> Dict[str, float]:
        """
        Calculate quality metrics for assembled context

        Args:
            chunks: Included chunks
            request: Assembly request

        Returns:
            Quality metrics dictionary
        """
        if not chunks:
            return {}

        metrics = {}

        # Average importance score
        metrics["avg_importance"] = sum(c.importance_score for c in chunks) / len(
            chunks
        )

        # Average coherence score
        metrics["avg_coherence"] = sum(c.coherence_score for c in chunks) / len(chunks)

        # Content diversity
        if len(chunks) > 1:
            total_similarity = 0
            comparisons = 0

            for i in range(len(chunks)):
                for j in range(i + 1, len(chunks)):
                    similarity = self._calculate_content_similarity(
                        chunks[i].processed_content, chunks[j].processed_content
                    )
                    total_similarity += similarity
                    comparisons += 1

            metrics["content_diversity"] = (
                1 - (total_similarity / comparisons) if comparisons > 0 else 1.0
            )
        else:
            metrics["content_diversity"] = 1.0

        # Authority coverage
        authoritative_chunks = sum(
            1 for c in chunks if self._get_authority_score(c.original_chunk) > 0.7
        )
        metrics["authority_coverage"] = authoritative_chunks / len(chunks)

        # Compression effectiveness
        if request.compression_level != CompressionLevel.NONE:
            compressed_chunks = [c for c in chunks if c.compression_applied]
            if compressed_chunks:
                avg_compression = np.mean(
                    [c.metadata.get("compression_ratio", 0) for c in compressed_chunks]
                )
                metrics["compression_effectiveness"] = avg_compression
            else:
                metrics["compression_effectiveness"] = 0.0
        else:
            metrics["compression_effectiveness"] = 0.0

        # Token utilization
        total_tokens = sum(c.token_count for c in chunks)
        metrics["token_utilization"] = total_tokens / request.max_tokens

        return metrics

    def _analyze_coverage(
        self, chunks: List[ContextChunk], request: AssemblyRequest
    ) -> Dict[str, Any]:
        """
        Analyze coverage of assembled context

        Args:
            chunks: Included chunks
            request: Assembly request

        Returns:
            Coverage analysis dictionary
        """
        analysis = {}

        # Query keyword coverage
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
                analysis["missed_keywords"] = list(query_keywords - covered_keywords)
            else:
                analysis["keyword_coverage"] = 1.0

        # Source diversity
        sources = set(chunk.citation_info.get("source", "Unknown") for chunk in chunks)
        analysis["source_diversity"] = len(sources)
        analysis["unique_sources"] = list(sources)

        # Content type distribution
        content_types = defaultdict(int)
        for chunk in chunks:
            content_type = chunk.metadata.get("chunk_type", "text")
            content_types[content_type] += 1

        analysis["content_type_distribution"] = dict(content_types)

        # Temporal coverage
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

    def _calculate_compression_stats(
        self,
        original_chunks: List[ContextChunk],
        final_chunks: List[ContextChunk],
        request: AssemblyRequest,
    ) -> Dict[str, Any]:
        """
        Calculate compression statistics

        Args:
            original_chunks: Original chunks before compression
            final_chunks: Final chunks after processing
            request: Assembly request

        Returns:
            Compression statistics
        """
        stats = {}

        if request.compression_level == CompressionLevel.NONE:
            stats["compression_applied"] = False
            return stats

        # Calculate size reduction
        original_size = sum(len(c.processed_content) for c in original_chunks)
        final_size = sum(len(c.processed_content) for c in final_chunks)

        if original_size > 0:
            stats["size_reduction_ratio"] = 1 - (final_size / original_size)
            stats["original_size"] = original_size
            stats["final_size"] = final_size
            stats["size_saved"] = original_size - final_size

        # Calculate token reduction
        original_tokens = sum(c.token_count for c in original_chunks)
        final_tokens = sum(c.token_count for c in final_chunks)

        if original_tokens > 0:
            stats["token_reduction_ratio"] = 1 - (final_tokens / original_tokens)
            stats["original_tokens"] = original_tokens
            stats["final_tokens"] = final_tokens
            stats["tokens_saved"] = original_tokens - final_tokens

        # Compression effectiveness
        compressed_chunks = [c for c in final_chunks if c.compression_applied]
        stats["chunks_compressed"] = len(compressed_chunks)
        stats["compression_applied"] = True

        if compressed_chunks:
            compression_ratios = [
                c.metadata.get("compression_ratio", 0) for c in compressed_chunks
            ]
            stats["avg_compression_ratio"] = np.mean(compression_ratios)
            stats["max_compression_ratio"] = max(compression_ratios)
            stats["min_compression_ratio"] = min(compression_ratios)

        return stats

    def _cache_assembly_result(
        self, request: AssemblyRequest, result: AssemblyResult
    ) -> None:
        """
        Cache assembly result for future use

        Args:
            request: Assembly request
            result: Assembly result
        """
        # Create cache key based on content hashes and parameters
        chunk_ids = [chunk.id for chunk in request.chunks]
        cache_key = hash(
            (
                tuple(sorted(chunk_ids)),
                request.assembly_strategy,
                request.compression_level,
                request.max_tokens,
                request.redundancy_strategy,
            )
        )

        # Cache the result
        self._assembly_cache[cache_key] = {
            "result": result,
            "timestamp": datetime.now(),
        }

        # Keep cache size manageable
        if len(self._assembly_cache) > 500:
            oldest_key = min(
                self._assembly_cache.keys(),
                key=lambda k: self._assembly_cache[k]["timestamp"],
            )
            del self._assembly_cache[oldest_key]

    async def _fallback_assembly(self, request: AssemblyRequest) -> AssemblyResult:
        """
        Fallback assembly when main assembly fails

        Args:
            request: Assembly request

        Returns:
            Fallback assembly result
        """
        logger.warning("Using fallback assembly strategy")

        try:
            # Simple sequential assembly without processing
            chunks_content = [chunk.content for chunk in request.chunks]
            assembled_context = request.chunk_separator.join(chunks_content)

            # Truncate if necessary
            if request.allow_truncation:
                current_tokens = self._count_tokens(
                    assembled_context, request.context_window_type
                )
                if current_tokens > request.max_tokens:
                    assembled_context = self._truncate_content(
                        assembled_content,
                        request.max_tokens,
                        request.context_window_type,
                    )

            # Create basic context chunks
            context_chunks = []
            for chunk in request.chunks:
                context_chunk = ContextChunk(
                    original_chunk=chunk,
                    processed_content=chunk.content,
                    token_count=self._count_tokens(
                        chunk.content, request.context_window_type
                    ),
                    importance_score=0.5,
                    coherence_score=0.5,
                    redundancy_score=1.0,
                    citation_info=self._prepare_citation_info(chunk, request),
                    metadata={"fallback": True},
                )
                context_chunks.append(context_chunk)

            return AssemblyResult(
                assembled_context=assembled_context,
                context_chunks=context_chunks[: len(request.chunks)],
                total_tokens=self._count_tokens(
                    assembled_context, request.context_window_type
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
            # Return minimal result
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

    def get_service_metrics(self) -> Dict[str, Any]:
        """
        Get service performance metrics

        Returns:
            Service metrics dictionary
        """
        return {
            "assembly_cache_size": len(self._assembly_cache),
            "compression_cache_size": len(self._compression_cache),
            "tokenizers_loaded": list(self._tokenizers.keys()),
            "sentence_model_loaded": self._sentence_model is not None,
            "supported_strategies": [strategy.value for strategy in AssemblyStrategy],
            "supported_compression_levels": [level.value for level in CompressionLevel],
            "supported_redundancy_strategies": [
                strategy.value for strategy in RedundancyStrategy
            ],
        }
