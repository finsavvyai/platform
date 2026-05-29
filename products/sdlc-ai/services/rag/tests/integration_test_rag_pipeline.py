"""
Integration Tests for Complete RAG Pipeline
Tests the integration of Context Retrieval, Assembly, Quality Monitoring,
Query Understanding, and Citation Services
"""

import pytest
import asyncio
import numpy as np
from datetime import datetime, timedelta
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from typing import List, Dict, Any

from app.services.context_retrieval_service import (
    ContextRetrievalService,
    RetrievalRequest,
    RetrievalStrategy,
)
from app.services.context_assembly_service import (
    ContextAssemblyService,
    AssemblyRequest,
    AssemblyStrategy,
)
from app.services.context_quality_monitor import ContextQualityMonitor
from app.services.query_understanding_service import QueryUnderstandingService
from app.services.citation_service import CitationService
from app.services.rag_orchestrator import RAGOrchestrator
from app.models.document import DocumentChunk
from app.repositories.document import DocumentRepository


@pytest.fixture
def mock_document_repository():
    """Mock document repository"""
    repo = AsyncMock(spec=DocumentRepository)
    return repo


@pytest.fixture
def rag_pipeline_components(mock_document_repository):
    """Initialize all RAG pipeline components"""
    query_understanding = QueryUnderstandingService()
    context_retrieval = ContextRetrievalService(
        document_repository=mock_document_repository,
        vector_search_service=AsyncMock(),
        query_understanding_service=query_understanding,
    )
    context_assembly = ContextAssemblyService()
    quality_monitor = ContextQualityMonitor()
    citation_service = CitationService()

    return {
        "query_understanding": query_understanding,
        "context_retrieval": context_retrieval,
        "context_assembly": context_assembly,
        "quality_monitor": quality_monitor,
        "citation_service": citation_service,
    }


@pytest.fixture
def sample_document_chunks():
    """Sample document chunks for integration testing"""
    chunks = []
    topics = [
        "transformer architecture",
        "attention mechanisms",
        "BERT model",
        "GPT models",
        "language model applications",
    ]

    sources = [
        {
            "title": "Attention Is All You Need",
            "authors": ["Vaswani, A.", "Shazeer, N.", "Parmar, N."],
            "year": 2017,
            "venue": "NeurIPS",
            "doi": "10.5555/3295222.3295349",
        },
        {
            "title": "BERT: Pre-training of Deep Bidirectional Transformers",
            "authors": ["Devlin, J.", "Chang, M.W.", "Lee, K."],
            "year": 2018,
            "venue": "NAACL",
            "arxiv": "1810.04805",
        },
    ]

    for i in range(20):
        topic = topics[i % len(topics)]
        source = sources[i % len(sources)]

        # Create content with embedded citations
        content = f"""
        This section discusses {topic} in detail.
        According to the seminal work by {source["authors"][0]} et al. [Source:{i + 1}],
        {topic} revolutionized natural language processing.

        The key innovations include self-attention mechanisms [Source:{i + 1}],
        which allow the model to capture long-range dependencies.
        Building on this foundation, subsequent models like BERT [Source:{2}]
        demonstrated the power of pre-training on large text corpora.

        Practical applications of {topic} include machine translation,
        text summarization, and question answering systems.
        The impact on the field has been transformative [Source:{i + 1}].
        """

        chunk = DocumentChunk(
            id=f"chunk_{i}",
            document_id=f"doc_{i % 2}",
            content=content,
            chunk_index=i,
            start_pos=i * 800,
            end_pos=(i + 1) * 800,
            token_count=200,
            metadata={
                "source_type": "academic",
                "topic": topic,
                "citation_info": source,
                "has_citations": True,
                "citation_count": 3,
                "date": datetime.now() - timedelta(days=i),
                "author": source["authors"][0],
                "rating": 4.5 + (i % 2) * 0.3,
                "readability_score": 75 + (i % 5) * 2,
            },
            embedding=np.random.rand(384).tolist(),
            created_at=datetime.now() - timedelta(hours=i),
        )
        chunks.append(chunk)

    return chunks


@pytest.fixture
def rag_orchestrator(rag_pipeline_components):
    """RAG orchestrator instance"""
    return RAGOrchestrator(**rag_pipeline_components)


class TestRAGPipelineIntegration:
    """Integration tests for complete RAG pipeline"""

    @pytest.mark.asyncio
    async def test_end_to_end_rag_pipeline(
        self, rag_orchestrator, sample_document_chunks
    ):
        """Test complete end-to-end RAG pipeline"""
        # Setup
        query = "How do attention mechanisms work in transformer models?"

        # Mock vector search results
        with patch.object(
            rag_orchestrator.vector_search_service, "search"
        ) as mock_search:
            mock_search.return_value = Mock(
                results=sample_document_chunks[:10],
                total_found=100,
                search_time=0.05,
            )

            # Execute
            response = await rag_orchestrator.process_query(
                query=query,
                max_context_tokens=2000,
                assembly_strategy=AssemblyStrategy.IMPORTANCE_WEIGHTED,
                retrieval_strategy=RetrievalStrategy.HYBRID_FUSION,
            )

            # Verify complete pipeline execution
            assert response is not None
            assert response.query == query
            assert response.context is not None
            assert len(response.context) > 0
            assert response.citations is not None
            assert len(response.citations) > 0
            assert response.quality_assessment is not None
            assert response.query_analysis is not None

    @pytest.mark.asyncio
    async def test_query_understanding_integration(
        self, rag_pipeline_components, sample_document_chunks
    ):
        """Test query understanding service integration"""
        # Setup
        query_understanding = rag_pipeline_components["query_understanding"]

        # Test complex query
        query = "Compare and contrast the performance of BERT versus GPT-3 on question answering tasks"

        # Execute
        analysis = await query_understanding.analyze_query(query)

        # Verify
        assert analysis is not None
        assert analysis.original_query == query
        assert analysis.intent is not None
        assert len(analysis.entities) > 0
        assert len(analysis.keywords) > 0
        assert analysis.complexity in ["medium", "high"]

        # Test query expansion
        expanded = await query_understanding.expand_query(
            query, context_chunks=sample_document_chunks[:5]
        )
        assert len(expanded.expanded_queries) > 0

    @pytest.mark.asyncio
    async def test_context_retrieval_integration(
        self, rag_pipeline_components, sample_document_chunks
    ):
        """Test context retrieval service integration"""
        # Setup
        context_retrieval = rag_pipeline_components["context_retrieval"]
        query_understanding = rag_pipeline_components["query_understanding"]

        # First understand the query
        query_analysis = await query_understanding.analyze_query(
            "What are the key innovations in transformer architecture?"
        )

        # Setup retrieval request
        request = RetrievalRequest(
            query=query_analysis.cleaned_query,
            query_analysis=query_analysis,
            strategy=RetrievalStrategy.MULTI_STAGE,
            max_results=10,
        )

        # Mock search results
        with patch.object(
            context_retrieval.vector_search_service, "search"
        ) as mock_search:
            mock_search.return_value = Mock(
                results=sample_document_chunks[:10],
                total_found=50,
            )

            # Execute
            result = await context_retrieval.retrieve_context(request)

            # Verify
            assert result is not None
            assert len(result.results) > 0
            assert result.strategy_used == RetrievalStrategy.MULTI_STAGE
            assert len(result.stages) > 0

    @pytest.mark.asyncio
    async def test_context_assembly_integration(
        self, rag_pipeline_components, sample_document_chunks
    ):
        """Test context assembly service integration"""
        # Setup
        context_assembly = rag_pipeline_components["context_assembly"]

        # Create assembly request
        request = AssemblyRequest(
            chunks=sample_document_chunks[:8],
            assembly_strategy=AssemblyStrategy.DIVERSITY_OPTIMIZED,
            max_tokens=1500,
            include_citations=True,
            citation_style="academic",
        )

        # Execute
        result = await context_assembly.assemble_context(request)

        # Verify
        assert result is not None
        assert result.total_tokens <= request.max_tokens
        assert len(result.context_chunks) > 0
        assert result.assembled_context != ""

        # Verify citations are included
        assert "[Source:" in result.assembled_context

        # Verify metrics
        assert result.metrics is not None
        assert result.metrics.assembly_time > 0
        assert result.metrics.chunks_processed == 8

    @pytest.mark.asyncio
    async def test_quality_monitoring_integration(
        self, rag_pipeline_components, sample_document_chunks
    ):
        """Test quality monitoring service integration"""
        # Setup
        quality_monitor = rag_pipeline_components["quality_monitor"]

        # Execute quality assessment
        assessment = await quality_monitor.assess_context_quality(
            chunks=sample_document_chunks[:10],
            query="transformer architecture and attention mechanisms",
            dimensions=[
                "relevance",
                "accuracy",
                "completeness",
                "clarity",
                "authority",
                "diversity",
            ],
        )

        # Verify
        assert assessment is not None
        assert assessment.overall_score is not None
        assert 0 <= assessment.overall_score <= 1
        assert len(assessment.dimension_scores) > 0

        # Check specific dimensions
        assert "relevance" in assessment.dimension_scores
        assert "accuracy" in assessment.dimension_scores

        # Verify assessment time
        assert assessment.assessment_time is not None

    @pytest.mark.asyncio
    async def test_citation_service_integration(
        self, rag_pipeline_components, sample_document_chunks
    ):
        """Test citation service integration"""
        # Setup
        citation_service = rag_pipeline_components["citation_service"]

        # Extract citations from content
        chunk = sample_document_chunks[0]
        citations = await citation_service.extract_citations(chunk.content)

        # Verify
        assert isinstance(citations, list)
        assert len(citations) > 0

        # Test citation formatting
        if citations:
            formatted = await citation_service.format_citation(
                citations[0], style="APA"
            )
            assert isinstance(formatted, str)
            assert len(formatted) > 0

        # Test citation tracking
        tracker = await citation_service.track_citations(sample_document_chunks[:5])
        assert tracker is not None
        assert tracker.total_citations > 0

    @pytest.mark.asyncio
    async def test_pipeline_error_handling(self, rag_orchestrator):
        """Test error handling in the pipeline"""
        # Setup
        query = "test query"

        # Mock service failure
        with patch.object(
            rag_orchestrator.vector_search_service, "search"
        ) as mock_search:
            mock_search.side_effect = Exception("Service unavailable")

            # Execute
            response = await rag_orchestrator.process_query(
                query=query,
                fallback_enabled=True,
            )

            # Verify graceful fallback
            assert response is not None
            assert response.error is not None
            assert response.context == "" or len(response.context) == 0

    @pytest.mark.asyncio
    async def test_pipeline_performance(self, rag_orchestrator, sample_document_chunks):
        """Test pipeline performance metrics"""
        # Setup
        query = "Explain the attention mechanism in transformers"

        # Mock search results
        with patch.object(
            rag_orchestrator.vector_search_service, "search"
        ) as mock_search:
            mock_search.return_value = Mock(
                results=sample_document_chunks[:10],
                total_found=100,
                search_time=0.05,
            )

            # Execute with performance tracking
            start_time = datetime.now()
            response = await rag_orchestrator.process_query(
                query=query,
                collect_metrics=True,
            )
            end_time = datetime.now()

            # Verify performance
            assert response is not None
            assert response.metrics is not None
            assert response.metrics.total_processing_time > 0
            assert (
                response.metrics.total_processing_time < 1.0
            )  # Should be under 1 second

            # Verify stage timings
            assert hasattr(response.metrics, "query_understanding_time")
            assert hasattr(response.metrics, "retrieval_time")
            assert hasattr(response.metrics, "assembly_time")
            assert hasattr(response.metrics, "quality_assessment_time")

    @pytest.mark.asyncio
    async def test_concurrent_query_processing(
        self, rag_orchestrator, sample_document_chunks
    ):
        """Test concurrent processing of multiple queries"""
        # Setup
        queries = [
            "What is self-attention?",
            "How does BERT work?",
            "Compare GPT-3 and BERT",
            "Applications of transformers",
        ]

        # Mock search results
        with patch.object(
            rag_orchestrator.vector_search_service, "search"
        ) as mock_search:
            mock_search.return_value = Mock(
                results=sample_document_chunks[:5],
                total_found=50,
                search_time=0.03,
            )

            # Execute concurrent processing
            tasks = [rag_orchestrator.process_query(query=query) for query in queries]
            responses = await asyncio.gather(*tasks)

            # Verify
            assert len(responses) == len(queries)
            for i, response in enumerate(responses):
                assert response is not None
                assert response.query == queries[i]
                assert response.context is not None

    @pytest.mark.asyncio
    async def test_pipeline_customization(
        self, rag_orchestrator, sample_document_chunks
    ):
        """Test pipeline customization options"""
        # Setup
        query = "Deep learning architectures"

        # Mock search results
        with patch.object(
            rag_orchestrator.vector_search_service, "search"
        ) as mock_search:
            mock_search.return_value = Mock(
                results=sample_document_chunks[:10],
                total_found=100,
                search_time=0.05,
            )

            # Execute with custom settings
            response = await rag_orchestrator.process_query(
                query=query,
                max_context_tokens=1000,
                retrieval_strategy=RetrievalStrategy.DENSE_ONLY,
                assembly_strategy=AssemblyStrategy.COHERENCE_FOCUSED,
                quality_thresholds={
                    "relevance": 0.7,
                    "accuracy": 0.8,
                },
                include_raw_results=True,
            )

            # Verify custom settings applied
            assert response is not None
            assert len(response.context) <= 1000 * 4  # Approximate token to char ratio
            assert response.raw_results is not None
            assert len(response.raw_results) > 0

    @pytest.mark.asyncio
    async def test_multilingual_pipeline(
        self, rag_orchestrator, sample_document_chunks
    ):
        """Test multilingual query processing"""
        # Setup
        query = "¿Qué es el aprendizaje automático?"

        # Mock search results
        with patch.object(
            rag_orchestrator.vector_search_service, "search"
        ) as mock_search:
            mock_search.return_value = Mock(
                results=sample_document_chunks[:5],
                total_found=50,
                search_time=0.05,
            )

            # Execute
            response = await rag_orchestrator.process_query(
                query=query,
                language="es",
            )

            # Verify multilingual support
            assert response is not None
            assert response.detected_language == "es"
            assert response.translated_query is not None

    @pytest.mark.asyncio
    async def test_pipeline_caching(self, rag_orchestrator, sample_document_chunks):
        """Test pipeline caching functionality"""
        # Setup
        query = "Transformer architecture details"

        # Mock search results
        with patch.object(
            rag_orchestrator.vector_search_service, "search"
        ) as mock_search:
            mock_search.return_value = Mock(
                results=sample_document_chunks[:5],
                total_found=50,
                search_time=0.05,
            )

            # Enable caching
            rag_orchestrator.enable_cache(ttl=3600)

            # First query
            start_time = datetime.now()
            response1 = await rag_orchestrator.process_query(query=query)
            first_time = (datetime.now() - start_time).total_seconds()

            # Second query (should use cache)
            start_time = datetime.now()
            response2 = await rag_orchestrator.process_query(query=query)
            second_time = (datetime.now() - start_time).total_seconds()

            # Verify caching worked
            assert response1.query == response2.query
            assert second_time < first_time  # Should be faster with cache

    @pytest.mark.asyncio
    async def test_pipeline_quality_thresholds(
        self, rag_orchestrator, sample_document_chunks
    ):
        """Test pipeline quality threshold enforcement"""
        # Setup
        query = "Test quality thresholds"

        # Create low-quality mock results
        low_quality_chunks = sample_document_chunks[:5]
        for chunk in low_quality_chunks:
            chunk.metadata["quality_level"] = "low"
            chunk.metadata["rating"] = 1.0

        # Mock search results
        with patch.object(
            rag_orchestrator.vector_search_service, "search"
        ) as mock_search:
            mock_search.return_value = Mock(
                results=low_quality_chunks,
                total_found=50,
                search_time=0.05,
            )

            # Execute with high quality thresholds
            response = await rag_orchestrator.process_query(
                query=query,
                quality_thresholds={
                    "relevance": 0.8,
                    "accuracy": 0.9,
                },
                enforce_thresholds=True,
            )

            # Verify quality enforcement
            assert response is not None
            if response.quality_assessment:
                # Should trigger warning or fallback for low quality
                assert response.quality_assessment.overall_score < 0.8
                assert response.quality_warnings is not None
                assert len(response.quality_warnings) > 0

    @pytest.mark.asyncio
    async def test_pipeline_moderation(self, rag_orchestrator, sample_document_chunks):
        """Test content moderation in pipeline"""
        # Setup
        query = "Inappropriate content test"

        # Mock search results with potentially sensitive content
        sensitive_chunks = sample_document_chunks[:5]
        for chunk in sensitive_chunks:
            chunk.content += (
                " This contains sensitive information that should be moderated."
            )

        # Mock search results
        with patch.object(
            rag_orchestrator.vector_search_service, "search"
        ) as mock_search:
            mock_search.return_value = Mock(
                results=sensitive_chunks,
                total_found=50,
                search_time=0.05,
            )

            # Execute with moderation enabled
            response = await rag_orchestrator.process_query(
                query=query,
                enable_moderation=True,
            )

            # Verify moderation
            assert response is not None
            if response.moderation_results:
                assert response.moderation_results.flagged is True
                assert response.moderated_content is not None
                assert len(response.moderated_content) < len(response.context)

    def test_pipeline_configuration_validation(self, rag_orchestrator):
        """Test pipeline configuration validation"""
        # Valid configuration
        valid_config = {
            "max_context_tokens": 4000,
            "retrieval_strategy": "hybrid_fusion",
            "assembly_strategy": "importance_weighted",
            "quality_thresholds": {"relevance": 0.7},
        }

        assert rag_orchestrator.validate_config(valid_config)

        # Invalid configuration
        invalid_config = {
            "max_context_tokens": -1,  # Invalid
            "retrieval_strategy": "invalid_strategy",
            "assembly_strategy": "invalid_strategy",
        }

        assert not rag_orchestrator.validate_config(invalid_config)

    @pytest.mark.asyncio
    async def test_pipeline_health_check(self, rag_orchestrator):
        """Test pipeline health check"""
        # Execute health check
        health = await rag_orchestrator.health_check()

        # Verify
        assert isinstance(health, dict)
        assert "status" in health
        assert "services" in health
        assert "timestamp" in health

        # Check service statuses
        services = health["services"]
        assert "query_understanding" in services
        assert "context_retrieval" in services
        assert "context_assembly" in services
        assert "quality_monitor" in services
        assert "citation_service" in services

    @pytest.mark.asyncio
    async def test_pipeline_metrics_collection(
        self, rag_orchestrator, sample_document_chunks
    ):
        """Test comprehensive metrics collection"""
        # Setup
        query = "Metrics collection test"

        # Mock search results
        with patch.object(
            rag_orchestrator.vector_search_service, "search"
        ) as mock_search:
            mock_search.return_value = Mock(
                results=sample_document_chunks[:5],
                total_found=50,
                search_time=0.05,
            )

            # Execute with detailed metrics
            response = await rag_orchestrator.process_query(
                query=query,
                collect_detailed_metrics=True,
            )

            # Verify comprehensive metrics
            assert response is not None
            assert response.metrics is not None

            metrics = response.metrics
            assert hasattr(metrics, "query_understanding_time")
            assert hasattr(metrics, "retrieval_time")
            assert hasattr(metrics, "assembly_time")
            assert hasattr(metrics, "quality_assessment_time")
            assert hasattr(metrics, "citation_processing_time")
            assert hasattr(metrics, "total_processing_time")
            assert hasattr(metrics, "memory_usage")
            assert hasattr(metrics, "cache_hits")
            assert hasattr(metrics, "cache_misses")
