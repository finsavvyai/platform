"""
Tests for Context Assembly Service with Token Window Optimization and Compression
"""

import pytest
import asyncio
import numpy as np
from datetime import datetime, timedelta
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from typing import List, Dict, Any

from app.services.context_assembly_service import (
    ContextAssemblyService,
    AssemblyStrategy,
    AssemblyRequest,
    AssemblyResult,
    AssemblyMetrics,
    ContextChunk,
    CompressionLevel,
    RedundancyStrategy,
)
from app.services.query_understanding_service import QueryAnalysis, QueryIntent
from app.models.document import DocumentChunk


@pytest.fixture
def context_assembly_service():
    """Context assembly service instance"""
    return ContextAssemblyService()


@pytest.fixture
def sample_chunks():
    """Sample document chunks for testing"""
    chunks = []

    # Create chunks with varying content and metadata
    topics = [
        "artificial intelligence",
        "machine learning",
        "deep learning",
        "neural networks",
    ]
    sources = ["peer_reviewed", "internal_document", "blog_post", "news_article"]

    for i in range(15):
        topic = topics[i % len(topics)]
        source = sources[i % len(sources)]

        # Create some overlapping content for redundancy testing
        base_content = f"This is about {topic}. "
        if i % 3 == 0:
            content = (
                base_content
                + "It involves advanced algorithms and data processing. " * 5
            )
        elif i % 3 == 1:
            content = (
                base_content
                + "It uses statistical methods and computational power. " * 5
            )
        else:
            content = (
                base_content
                + "It represents a significant advancement in technology. " * 5
            )

        chunk = DocumentChunk(
            id=f"chunk_{i}",
            document_id=f"doc_{i % 4}",
            content=content,
            chunk_index=i,
            start_pos=i * 200,
            end_pos=(i + 1) * 200,
            token_count=100 + (i * 10),
            metadata={
                "source_type": source,
                "topic": topic,
                "citation_count": i * 3,
                "rating": 3.5 + (i % 2) * 0.5,
                "date": datetime.now() - timedelta(days=i),
                "author": f"author_{i % 4}",
                "importance_score": 0.5 + (i * 0.05),
            },
            embedding=np.random.rand(384).tolist(),
            created_at=datetime.now() - timedelta(hours=i),
        )
        chunks.append(chunk)

    return chunks


@pytest.fixture
def sample_query_analysis():
    """Sample query analysis"""
    return QueryAnalysis(
        original_query="Explain deep learning architectures",
        cleaned_query="deep learning architectures",
        intent=QueryIntent.EXPLANATION,
        entities=[{"text": "deep learning", "type": "TOPIC", "confidence": 0.95}],
        keywords=["deep", "learning", "architectures"],
        context=None,
        expanded_queries=["neural network architectures", "deep learning models"],
        sentiment="neutral",
        confidence=0.92,
    )


class TestContextAssemblyService:
    """Test cases for ContextAssemblyService"""

    @pytest.mark.asyncio
    async def test_sequential_assembly(self, context_assembly_service, sample_chunks):
        """Test sequential assembly strategy"""
        # Setup
        request = AssemblyRequest(
            chunks=sample_chunks[:10],
            assembly_strategy=AssemblyStrategy.SEQUENTIAL,
            max_tokens=1000,
        )

        # Execute
        result = await context_assembly_service.assemble_context(request)

        # Verify
        assert isinstance(result, AssemblyResult)
        assert result.assembly_strategy == AssemblyStrategy.SEQUENTIAL
        assert result.total_tokens <= request.max_tokens
        assert len(result.context_chunks) > 0
        assert result.assembled_context != ""

        # Check that chunks are in original order
        original_order = [c.chunk.chunk_index for c in result.context_chunks]
        assert original_order == sorted(original_order)

    @pytest.mark.asyncio
    async def test_importance_weighted_assembly(
        self, context_assembly_service, sample_chunks
    ):
        """Test importance-weighted assembly strategy"""
        # Setup
        request = AssemblyRequest(
            chunks=sample_chunks,
            assembly_strategy=AssemblyStrategy.IMPORTANCE_WEIGHTED,
            max_tokens=1200,
            prioritize_recent=True,
            prioritize_authoritative=True,
        )

        # Execute
        result = await context_assembly_service.assemble_context(request)

        # Verify
        assert isinstance(result, AssemblyResult)
        assert result.assembly_strategy == AssemblyStrategy.IMPORTANCE_WEIGHTED

        # Check that chunks are sorted by importance
        importance_scores = [c.importance_score for c in result.context_chunks]
        assert importance_scores == sorted(importance_scores, reverse=True)

        # Verify importance scores were calculated
        for context_chunk in result.context_chunks:
            assert context_chunk.importance_score > 0

    @pytest.mark.asyncio
    async def test_diversity_optimized_assembly(
        self, context_assembly_service, sample_chunks
    ):
        """Test diversity-optimized assembly strategy"""
        # Setup
        request = AssemblyRequest(
            chunks=sample_chunks,
            assembly_strategy=AssemblyStrategy.DIVERSITY_OPTIMIZED,
            max_tokens=1500,
        )

        # Execute
        result = await context_assembly_service.assemble_context(request)

        # Verify
        assert isinstance(result, AssemblyResult)
        assert result.assembly_strategy == AssemblyStrategy.DIVERSITY_OPTIMIZED

        # Check diversity scores
        diversity_scores = [c.diversity_score for c in result.context_chunks]
        assert all(score >= 0 for score in diversity_scores)

        # Verify high diversity
        assert result.metrics.diversity_score > 0.5

    @pytest.mark.asyncio
    async def test_coherence_focused_assembly(
        self, context_assembly_service, sample_chunks
    ):
        """Test coherence-focused assembly strategy"""
        # Setup
        request = AssemblyRequest(
            chunks=sample_chunks,
            assembly_strategy=AssemblyStrategy.COHERENCE_FOCUSED,
            max_tokens=1000,
            maintain_coherence=True,
        )

        # Execute
        result = await context_assembly_service.assemble_context(request)

        # Verify
        assert isinstance(result, AssemblyResult)
        assert result.assembly_strategy == AssemblyStrategy.COHERENCE_FOCUSED

        # Check coherence scores
        coherence_scores = [c.coherence_score for c in result.context_chunks]
        assert all(score >= 0 for score in coherence_scores)

        # Verify high average coherence
        avg_coherence = sum(coherence_scores) / len(coherence_scores)
        assert avg_coherence > 0.6

    @pytest.mark.asyncio
    async def test_citation_aware_assembly(
        self, context_assembly_service, sample_chunks
    ):
        """Test citation-aware assembly strategy"""
        # Setup
        request = AssemblyRequest(
            chunks=sample_chunks,
            assembly_strategy=AssemblyStrategy.CITATION_AWARE,
            max_tokens=1200,
            include_citations=True,
            citation_style="academic",
        )

        # Execute
        result = await context_assembly_service.assemble_context(request)

        # Verify
        assert isinstance(result, AssemblyResult)
        assert result.assembly_strategy == AssemblyStrategy.CITATION_AWARE

        # Check citations are included
        for context_chunk in result.context_chunks:
            assert "citation_info" in context_chunk.citation_info
            assert len(context_chunk.citation_info) > 0

        # Verify citations in assembled text
        assert "[Source:" in result.assembled_context

    @pytest.mark.asyncio
    async def test_compressive_assembly(self, context_assembly_service, sample_chunks):
        """Test compressive assembly strategy"""
        # Setup
        request = AssemblyRequest(
            chunks=sample_chunks,
            assembly_strategy=AssemblyStrategy.COMPRESSIVE,
            max_tokens=800,
            compression_level=CompressionLevel.MODERATE,
        )

        # Execute
        result = await context_assembly_service.assemble_context(request)

        # Verify
        assert isinstance(result, AssemblyResult)
        assert result.assembly_strategy == AssemblyStrategy.COMPRESSIVE

        # Check compression was applied
        assert result.metrics.compression_ratio > 0
        assert result.metrics.compression_ratio < 1.0  # Less than original

        # Verify compressed content maintains key information
        assert len(result.assembled_context) > 0

    @pytest.mark.asyncio
    async def test_hierarchical_assembly(self, context_assembly_service, sample_chunks):
        """Test hierarchical assembly strategy"""
        # Setup
        request = AssemblyRequest(
            chunks=sample_chunks,
            assembly_strategy=AssemblyStrategy.HIERARCHICAL,
            max_tokens=1500,
        )

        # Execute
        result = await context_assembly_service.assemble_context(request)

        # Verify
        assert isinstance(result, AssemblyResult)
        assert result.assembly_strategy == AssemblyStrategy.HIERARCHICAL

        # Check hierarchical structure
        assert "## " in result.assembled_context  # Markdown headers

        # Verify multi-level organization
        assert result.metrics.hierarchy_levels > 1

    @pytest.mark.asyncio
    async def test_adaptive_assembly(
        self, context_assembly_service, sample_chunks, sample_query_analysis
    ):
        """Test adaptive assembly strategy"""
        # Setup
        request = AssemblyRequest(
            chunks=sample_chunks,
            query_analysis=sample_query_analysis,
            assembly_strategy=AssemblyStrategy.ADAPTIVE,
            max_tokens=1200,
        )

        # Execute
        result = await context_assembly_service.assemble_context(request)

        # Verify
        assert isinstance(result, AssemblyResult)
        assert result.assembly_strategy == AssemblyStrategy.ADAPTIVE

        # Check that strategy was adapted based on query
        assert result.metrics.selected_strategy != AssemblyStrategy.ADAPTIVE
        assert result.metrics.adaptation_reason is not None

    @pytest.mark.asyncio
    async def test_redundancy_removal_exact_duplicates(
        self, context_assembly_service, sample_chunks
    ):
        """Test removal of exact duplicate content"""
        # Create chunks with exact duplicates
        duplicate_chunks = sample_chunks[:5]
        for i in range(2):
            # Add exact duplicates
            duplicate_chunk = DocumentChunk(
                id=f"dup_chunk_{i}",
                document_id="doc_dup",
                content=sample_chunks[0].content,  # Exact duplicate
                chunk_index=100 + i,
                token_count=100,
                metadata={"duplicate": True},
            )
            duplicate_chunks.append(duplicate_chunk)

        request = AssemblyRequest(
            chunks=duplicate_chunks,
            assembly_strategy=AssemblyStrategy.SEQUENTIAL,
            max_tokens=1000,
            redundancy_strategy=RedundancyStrategy.EXACT_DUPLICATE,
        )

        # Execute
        result = await context_assembly_service.assemble_context(request)

        # Verify duplicates were removed
        unique_contents = set(c.original_chunk.content for c in result.context_chunks)
        assert len(unique_contents) == len(result.context_chunks)

    @pytest.mark.asyncio
    async def test_redundancy_removal_semantic_similarity(
        self, context_assembly_service, sample_chunks
    ):
        """Test removal of semantically similar content"""
        # Create chunks with semantically similar content
        similar_chunks = sample_chunks[:5]
        for i in range(2):
            # Add semantically similar chunks
            similar_chunk = DocumentChunk(
                id=f"sim_chunk_{i}",
                document_id="doc_sim",
                content="This discusses artificial intelligence and machine learning using advanced algorithms.",  # Similar meaning
                chunk_index=200 + i,
                token_count=100,
                metadata={"similar": True},
                embedding=sample_chunks[
                    0
                ].embedding,  # Same embedding for high similarity
            )
            similar_chunks.append(similar_chunk)

        request = AssemblyRequest(
            chunks=similar_chunks,
            assembly_strategy=AssemblyStrategy.DIVERSITY_OPTIMIZED,
            max_tokens=1000,
            redundancy_strategy=RedundancyStrategy.SEMANTIC_SIMILARITY,
        )

        # Execute
        result = await context_assembly_service.assemble_context(request)

        # Verify semantic redundancy was handled
        redundancy_scores = [c.redundancy_score for c in result.context_chunks]
        assert all(
            score <= 0.8 for score in redundancy_scores
        )  # Should filter high redundancy

    @pytest.mark.asyncio
    async def test_token_window_optimization(
        self, context_assembly_service, sample_chunks
    ):
        """Test token window optimization"""
        # Setup with very small token limit
        request = AssemblyRequest(
            chunks=sample_chunks,
            assembly_strategy=AssemblyStrategy.IMPORTANCE_WEIGHTED,
            max_tokens=200,  # Very small limit
            allow_truncation=True,
        )

        # Execute
        result = await context_assembly_service.assemble_context(request)

        # Verify token constraint is respected
        assert result.total_tokens <= request.max_tokens

        # Verify most important content is prioritized
        if len(result.context_chunks) > 1:
            assert (
                result.context_chunks[0].importance_score
                >= result.context_chunks[1].importance_score
            )

    @pytest.mark.asyncio
    async def test_context_compression_light(
        self, context_assembly_service, sample_chunks
    ):
        """Test light compression level"""
        # Setup
        original_tokens = sum(c.token_count for c in sample_chunks[:5])

        request = AssemblyRequest(
            chunks=sample_chunks[:5],
            assembly_strategy=AssemblyStrategy.COMPRESSIVE,
            max_tokens=original_tokens,
            compression_level=CompressionLevel.LIGHT,
        )

        # Execute
        result = await context_assembly_service.assemble_context(request)

        # Verify light compression (10-20% reduction)
        assert result.metrics.compression_ratio >= 0.8
        assert result.metrics.compression_ratio <= 0.9

    @pytest.mark.asyncio
    async def test_context_compression_aggressive(
        self, context_assembly_service, sample_chunks
    ):
        """Test aggressive compression level"""
        # Setup
        original_tokens = sum(c.token_count for c in sample_chunks[:5])

        request = AssemblyRequest(
            chunks=sample_chunks[:5],
            assembly_strategy=AssemblyStrategy.COMPRESSIVE,
            max_tokens=int(original_tokens * 0.5),  # Target 50% of original
            compression_level=CompressionLevel.AGGRESSIVE,
        )

        # Execute
        result = await context_assembly_service.assemble_context(request)

        # Verify aggressive compression (40-60% reduction)
        assert result.metrics.compression_ratio >= 0.4
        assert result.metrics.compression_ratio <= 0.6

    @pytest.mark.asyncio
    async def test_metadata_preservation(self, context_assembly_service, sample_chunks):
        """Test preservation of chunk metadata"""
        # Setup
        request = AssemblyRequest(
            chunks=sample_chunks,
            assembly_strategy=AssemblyStrategy.SEQUENTIAL,
            max_tokens=2000,
            preserve_metadata=True,
        )

        # Execute
        result = await context_assembly_service.assemble_context(request)

        # Verify metadata is preserved
        for context_chunk in result.context_chunks:
            assert context_chunk.metadata is not None
            assert "source_type" in context_chunk.metadata
            assert "topic" in context_chunk.metadata
            assert "author" in context_chunk.metadata

    @pytest.mark.asyncio
    async def test_chunk_separator_customization(
        self, context_assembly_service, sample_chunks
    ):
        """Test custom chunk separators"""
        # Setup
        custom_separator = "\n--- DOCUMENT BREAK ---\n"
        request = AssemblyRequest(
            chunks=sample_chunks[:3],
            assembly_strategy=AssemblyStrategy.SEQUENTIAL,
            max_tokens=1000,
            chunk_separator=custom_separator,
        )

        # Execute
        result = await context_assembly_service.assemble_context(request)

        # Verify custom separator is used
        assert custom_separator in result.assembled_context
        assert (
            result.assembled_context.count(custom_separator)
            == len(result.context_chunks) - 1
        )

    @pytest.mark.asyncio
    async def test_multilingual_support(self, context_assembly_service, sample_chunks):
        """Test multilingual context assembly"""
        # Create chunks in different languages
        multilingual_chunks = []
        languages = ["en", "es", "fr", "de"]

        for i, lang in enumerate(languages):
            content = {
                "en": "This is about machine learning in English",
                "es": "Esto es sobre aprendizaje automático en español",
                "fr": "Ceci concerne l'apprentissage automatique en français",
                "de": "Dies befasst sich mit maschinellem Lernen auf Deutsch",
            }[lang]

            chunk = DocumentChunk(
                id=f"chunk_{i}",
                document_id=f"doc_{i}",
                content=content,
                chunk_index=i,
                token_count=20,
                metadata={"language": lang},
            )
            multilingual_chunks.append(chunk)

        request = AssemblyRequest(
            chunks=multilingual_chunks,
            assembly_strategy=AssemblyStrategy.SEQUENTIAL,
            max_tokens=500,
            user_language="en",
        )

        # Execute
        result = await context_assembly_service.assemble_context(request)

        # Verify multilingual support
        assert len(result.context_chunks) == len(multilingual_chunks)
        for context_chunk in result.context_chunks:
            assert "language" in context_chunk.metadata

    @pytest.mark.asyncio
    async def test_error_handling_invalid_chunks(self, context_assembly_service):
        """Test error handling with invalid chunks"""
        # Create invalid chunks
        invalid_chunks = [
            None,  # None chunk
            DocumentChunk(id="", content=""),  # Empty chunk
        ]

        request = AssemblyRequest(
            chunks=invalid_chunks,
            assembly_strategy=AssemblyStrategy.SEQUENTIAL,
            max_tokens=1000,
        )

        # Execute
        result = await context_assembly_service.assemble_context(request)

        # Verify graceful handling
        assert isinstance(result, AssemblyResult)
        assert len(result.context_chunks) == 0  # Invalid chunks filtered out
        assert result.metrics.errors_handled > 0

    @pytest.mark.asyncio
    async def test_performance_metrics_collection(
        self, context_assembly_service, sample_chunks
    ):
        """Test comprehensive performance metrics collection"""
        # Setup
        request = AssemblyRequest(
            chunks=sample_chunks,
            assembly_strategy=AssemblyStrategy.ADAPTIVE,
            max_tokens=1500,
            collect_metrics=True,
        )

        # Execute
        result = await context_assembly_service.assemble_context(request)

        # Verify comprehensive metrics
        assert result.metrics is not None
        assert result.metrics.assembly_time > 0
        assert result.metrics.total_tokens > 0
        assert result.metrics.chunks_processed == len(sample_chunks)
        assert result.metrics.chunks_included > 0
        assert result.metrics.average_chunk_size > 0
        assert hasattr(result.metrics, "compression_ratio")
        assert hasattr(result.metrics, "diversity_score")
        assert hasattr(result.metrics, "coherence_score")

    @pytest.mark.asyncio
    async def test_empty_chunks_list(self, context_assembly_service):
        """Test assembly with empty chunks list"""
        # Setup
        request = AssemblyRequest(
            chunks=[],
            assembly_strategy=AssemblyStrategy.SEQUENTIAL,
            max_tokens=1000,
        )

        # Execute
        result = await context_assembly_service.assemble_context(request)

        # Verify
        assert isinstance(result, AssemblyResult)
        assert len(result.context_chunks) == 0
        assert result.assembled_context == ""
        assert result.total_tokens == 0

    @pytest.mark.asyncio
    async def test_single_chunk_assembly(self, context_assembly_service, sample_chunks):
        """Test assembly with single chunk"""
        # Setup
        request = AssemblyRequest(
            chunks=[sample_chunks[0]],
            assembly_strategy=AssemblyStrategy.SEQUENTIAL,
            max_tokens=1000,
        )

        # Execute
        result = await context_assembly_service.assemble_context(request)

        # Verify
        assert isinstance(result, AssemblyResult)
        assert len(result.context_chunks) == 1
        assert result.assembled_context == sample_chunks[0].content

    @pytest.mark.asyncio
    async def test_async_batch_assembly(self, context_assembly_service, sample_chunks):
        """Test async batch assembly for multiple requests"""
        # Setup
        requests = [
            AssemblyRequest(
                chunks=sample_chunks[i * 3 : (i + 1) * 3],
                assembly_strategy=AssemblyStrategy.SEQUENTIAL,
                max_tokens=500,
            )
            for i in range(3)
        ]

        # Execute batch assembly
        results = await context_assembly_service.batch_assemble_context(requests)

        # Verify
        assert len(results) == 3
        for result in results:
            assert isinstance(result, AssemblyResult)
            assert len(result.context_chunks) <= 3
            assert result.total_tokens <= 500

    def test_assembly_request_validation(self):
        """Test assembly request validation"""
        # Valid request
        valid_request = AssemblyRequest(
            chunks=[
                DocumentChunk(id="1", content="test", chunk_index=0, token_count=10)
            ],
            max_tokens=1000,
        )
        assert valid_request.is_valid()

        # Invalid request - no chunks
        invalid_request = AssemblyRequest(
            chunks=[],
            max_tokens=1000,
        )
        assert not invalid_request.is_valid()

        # Invalid request - negative max_tokens
        invalid_request2 = AssemblyRequest(
            chunks=[
                DocumentChunk(id="1", content="test", chunk_index=0, token_count=10)
            ],
            max_tokens=-1,
        )
        assert not invalid_request2.is_valid()

    @pytest.mark.asyncio
    async def test_citation_style_numbered(
        self, context_assembly_service, sample_chunks
    ):
        """Test numbered citation style"""
        # Setup
        request = AssemblyRequest(
            chunks=sample_chunks[:3],
            assembly_strategy=AssemblyStrategy.CITATION_AWARE,
            max_tokens=1000,
            include_citations=True,
            citation_style="numbered",
        )

        # Execute
        result = await context_assembly_service.assemble_context(request)

        # Verify numbered citations
        assert "[1]" in result.assembled_context
        assert "[2]" in result.assembled_context
        assert "[3]" in result.assembled_context

    @pytest.mark.asyncio
    async def test_citation_style_inline(self, context_assembly_service, sample_chunks):
        """Test inline citation style"""
        # Setup
        request = AssemblyRequest(
            chunks=sample_chunks[:3],
            assembly_strategy=AssemblyStrategy.CITATION_AWARE,
            max_tokens=1000,
            include_citations=True,
            citation_style="inline",
        )

        # Execute
        result = await context_assembly_service.assemble_context(request)

        # Verify inline citations
        assert "(Source:" in result.assembled_context

    @pytest.mark.asyncio
    async def test_context_window_types(self, context_assembly_service, sample_chunks):
        """Test different context window types"""
        # Test LLM context window
        request_llm = AssemblyRequest(
            chunks=sample_chunks,
            assembly_strategy=AssemblyStrategy.SEQUENTIAL,
            max_tokens=4000,
            context_window_type="llm",
        )

        result_llm = await context_assembly_service.assemble_context(request_llm)
        assert result_llm.context_window_type == "llm"

        # Test summary context window
        request_summary = AssemblyRequest(
            chunks=sample_chunks,
            assembly_strategy=AssemblyStrategy.COMPRESSIVE,
            max_tokens=1000,
            context_window_type="summary",
        )

        result_summary = await context_assembly_service.assemble_context(
            request_summary
        )
        assert result_summary.context_window_type == "summary"

        # Test analysis context window
        request_analysis = AssemblyRequest(
            chunks=sample_chunks,
            assembly_strategy=AssemblyStrategy.IMPORTANCE_WEIGHTED,
            max_tokens=2000,
            context_window_type="analysis",
        )

        result_analysis = await context_assembly_service.assemble_context(
            request_analysis
        )
        assert result_analysis.context_window_type == "analysis"
