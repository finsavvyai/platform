"""
Comprehensive test suite for the embedding generation service.

This module provides extensive tests for all embedding components:
- Multi-provider embedding generation
- Intelligent caching and batch processing
- Cost optimization and provider selection
- Quality validation and similarity scoring
- Metadata tracking and version management
- Error handling and fallback mechanisms
- Performance and integration tests
"""

import asyncio
import pytest
import uuid
from typing import List

import numpy as np

# Test configuration
TEST_CONFIG = {
    "cache": {"ttl_seconds": 3600, "redis_url": None},  # Disable Redis for tests
    "batch_processing": {"batch_size": 10},
    "cost_optimization": {"default_routing_strategy": "balanced"},
    "quality_validation": {"validation_level": "standard"},
    "metadata": {"storage_type": "memory"},
}


class TestEmbeddingService:
    """Test cases for the core embedding service."""

    @pytest.fixture
    async def embedding_service(self):
        """Initialize embedding service for testing."""
        from .embedding_service import EmbeddingService

        service = EmbeddingService(TEST_CONFIG)
        await service.initialize()
        yield service
        # Cleanup

    @pytest.mark.asyncio
    async def test_multi_provider_initialization(self, embedding_service):
        """Test that multiple providers are initialized correctly."""
        providers = embedding_service.providers

        # Should have at least sentence transformers (local) provider
        assert len(providers) >= 1

        # Check provider types
        from .embedding_service import EmbeddingProvider

        assert EmbeddingProvider.SENTENCE_TRANSFORMERS in providers

        # Verify provider health
        status = await embedding_service.get_provider_status()
        assert isinstance(status, dict)

    @pytest.mark.asyncio
    async def test_embedding_generation_request(self, embedding_service):
        """Test basic embedding generation request."""
        from .embedding_service import (
            EmbeddingProvider,
            EmbeddingModel,
            EmbeddingRequest,
        )

        texts = ["Hello world", "This is a test"]
        request = EmbeddingRequest(
            texts=texts,
            provider=EmbeddingProvider.SENTENCE_TRANSFORMERS,
            model=EmbeddingModel.SENTENCE_MINILM_L6_V2,
            tenant_id=uuid.uuid4(),
        )

        response = await embedding_service.generate_embeddings(request)

        # Verify response structure
        assert response.embeddings is not None
        assert len(response.embeddings) == len(texts)
        assert response.dimensions > 0
        assert response.processing_time_ms > 0
        assert response.usage is not None

    @pytest.mark.asyncio
    async def test_caching_functionality(self, embedding_service):
        """Test that caching works correctly."""
        from .embedding_service import (
            EmbeddingProvider,
            EmbeddingModel,
            EmbeddingRequest,
        )

        texts = ["Test caching functionality"]
        tenant_id = uuid.uuid4()

        request = EmbeddingRequest(
            texts=texts,
            provider=EmbeddingProvider.SENTENCE_TRANSFORMERS,
            model=EmbeddingModel.SENTENCE_MINILM_L6_V2,
            tenant_id=tenant_id,
        )

        # First request - should generate embeddings
        response1 = await embedding_service.generate_embeddings(request)
        assert response1.cached_count == 0

        # Second request - should use cache
        response2 = await embedding_service.generate_embeddings(request)
        assert response2.cached_count == len(texts)

        # Verify embeddings are identical
        assert response1.embeddings == response2.embeddings

    @pytest.mark.asyncio
    async def test_fallback_mechanism(self, embedding_service):
        """Test fallback mechanism when primary provider fails."""
        from .embedding_service import (
            EmbeddingProvider,
            EmbeddingModel,
            EmbeddingRequest,
        )

        texts = ["Test fallback mechanism"]
        tenant_id = uuid.uuid4()

        # Mock primary provider to fail
        original_providers = embedding_service.providers.copy()

        # Remove primary providers to test fallback
        if EmbeddingProvider.OPENAI in embedding_service.providers:
            del embedding_service.providers[EmbeddingProvider.OPENAI]

        request = EmbeddingRequest(
            texts=texts,
            provider=EmbeddingProvider.OPENAI,  # This will fail
            model=EmbeddingModel.OPENAI_ADA_002,
            tenant_id=tenant_id,
        )

        # Should fallback to available provider
        response = await embedding_service.generate_embeddings(request)

        assert response.embeddings is not None
        assert len(response.embeddings) == len(texts)

        # Restore providers
        embedding_service.providers = original_providers


class TestBatchEmbeddingProcessor:
    """Test cases for batch embedding processing."""

    @pytest.fixture
    async def batch_processor(self):
        """Initialize batch processor for testing."""
        from .batch_embedding_processor import BatchEmbeddingProcessor, BatchConfig

        config = BatchConfig(
            batch_size=5, max_concurrent_batches=2, progress_reporting_interval=1
        )

        processor = BatchEmbeddingProcessor(config.__dict__)
        await processor.initialize()
        yield processor
        await processor.stop()

    @pytest.mark.asyncio
    async def test_batch_job_submission(self, batch_processor):
        """Test batch job submission and processing."""
        from ..models.document import DocumentChunk
        from .embedding_service import EmbeddingProvider

        # Create test chunks
        chunks = []
        tenant_id = uuid.uuid4()

        for i in range(10):
            chunk = DocumentChunk(
                id=uuid.uuid4(),
                tenant_id=tenant_id,
                document_id=uuid.uuid4(),
                chunk_index=i,
                content=f"Test chunk {i}",
                content_length=len(f"Test chunk {i}"),
            )
            chunks.append(chunk)

        # Submit batch job
        job_id = await batch_processor.submit_job(
            chunks=chunks,
            provider=EmbeddingProvider.SENTENCE_TRANSFORMERS,
            tenant_id=tenant_id,
        )

        assert job_id is not None

        # Wait for processing
        await asyncio.sleep(2)

        # Check job status
        job_status = await batch_processor.get_job_status(job_id)
        assert job_status is not None

        # Check that chunks were processed
        processed_chunks = [chunk for chunk in chunks if chunk.embedding is not None]
        assert len(processed_chunks) > 0

    @pytest.mark.asyncio
    async def test_batch_queue_management(self, batch_processor):
        """Test batch queue management and priority handling."""
        from ..models.document import DocumentChunk
        from .embedding_service import EmbeddingProvider
        from .batch_embedding_processor import BatchPriority

        # Create test chunks
        chunks = []
        tenant_id = uuid.uuid4()

        for i in range(3):
            chunk = DocumentChunk(
                id=uuid.uuid4(),
                tenant_id=tenant_id,
                document_id=uuid.uuid4(),
                chunk_index=i,
                content=f"Priority test chunk {i}",
                content_length=len(f"Priority test chunk {i}"),
            )
            chunks.append(chunk)

        # Submit jobs with different priorities
        await batch_processor.submit_job(
            chunks=[chunks[0]],
            provider=EmbeddingProvider.SENTENCE_TRANSFORMERS,
            priority=BatchPriority.URGENT,
            tenant_id=tenant_id,
        )

        await batch_processor.submit_job(
            chunks=[chunks[1]],
            provider=EmbeddingProvider.SENTENCE_TRANSFORMERS,
            priority=BatchPriority.NORMAL,
            tenant_id=tenant_id,
        )

        # Verify queue information
        queue_info = batch_processor.get_queue_info()
        assert "queue_sizes" in queue_info
        assert "active_jobs" in queue_info


class TestCostOptimizationService:
    """Test cases for cost optimization service."""

    @pytest.fixture
    async def cost_optimizer(self):
        """Initialize cost optimizer for testing."""
        from .cost_optimization_service import CostOptimizationService

        config = {
            "default_routing_strategy": "balanced",
            "performance_weight": 0.4,
            "cost_weight": 0.3,
            "availability_weight": 0.3,
        }

        optimizer = CostOptimizationService(config)
        await optimizer.initialize()
        yield optimizer

    @pytest.mark.asyncio
    async def test_provider_selection(self, cost_optimizer):
        """Test intelligent provider selection."""
        from .cost_optimization_service import RoutingStrategy

        tenant_id = uuid.uuid4()
        estimated_tokens = 1000

        decision = await cost_optimizer.select_optimal_provider(
            tenant_id=tenant_id,
            estimated_tokens=estimated_tokens,
            strategy=RoutingStrategy.COST_OPTIMAL,
        )

        assert decision is not None
        assert decision.selected_provider is not None
        assert decision.selected_model is not None
        assert decision.estimated_cost_usd >= 0
        assert decision.reasoning is not None

    @pytest.mark.asyncio
    async def test_usage_tracking(self, cost_optimizer):
        """Test usage tracking and analytics."""
        from .embedding_service import EmbeddingProvider

        tenant_id = uuid.uuid4()

        # Record usage
        await cost_optimizer.record_usage(
            tenant_id=tenant_id,
            provider=EmbeddingProvider.SENTENCE_TRANSFORMERS,
            model="all-MiniLM-L6-v2",
            tokens_used=100,
            cost_usd=0.0,
            response_time_ms=50.0,
            success=True,
        )

        # Get analytics
        analytics = cost_optimizer.get_cost_analytics(tenant_id=tenant_id)

        assert analytics is not None
        assert "summary" in analytics
        assert analytics["summary"]["total_tokens"] == 100

    @pytest.mark.asyncio
    async def test_budget_management(self, cost_optimizer):
        """Test budget management and enforcement."""
        from .cost_optimization_service import TenantBudget

        tenant_id = uuid.uuid4()
        budget = TenantBudget(
            tenant_id=tenant_id, monthly_budget_usd=10.0, strict_enforcement=True
        )

        cost_optimizer.set_tenant_budget(tenant_id, budget)

        # Test budget constraints
        can_spend = budget.can_spend(5.0)
        assert can_spend is True

        # Record spending
        budget.record_spend(5.0)
        assert budget.current_monthly_spend == 5.0

        # Test budget status
        status = budget.get_budget_status()
        assert status["monthly_remaining"] == 5.0


class TestEmbeddingQualityValidator:
    """Test cases for embedding quality validation."""

    @pytest.fixture
    def quality_validator(self):
        """Initialize quality validator for testing."""
        from .embedding_quality_validator import EmbeddingQualityValidator

        config = {
            "validation_level": "standard",
            "enable_advanced_metrics": True,
        }

        return EmbeddingQualityValidator(config)

    @pytest.mark.asyncio
    async def test_single_embedding_validation(self, quality_validator):
        """Test validation of a single embedding."""
        # Create a test embedding (384 dimensions for MiniLM)
        embedding = np.random.normal(0, 1, 384).tolist()

        report = await quality_validator.validate_embedding(
            embedding=embedding,
            embedding_id="test-embedding-1",
            text="This is a test text for validation",
        )

        assert report is not None
        assert report.embedding_id == "test-embedding-1"
        assert report.overall_score >= 0
        assert report.overall_score <= 1
        assert isinstance(report.validation_passed, bool)
        assert isinstance(report.issues, list)
        assert isinstance(report.recommendations, list)

    @pytest.mark.asyncio
    async def test_batch_validation(self, quality_validator):
        """Test batch validation of multiple embeddings."""
        # Create test embeddings
        embeddings = []
        texts = []

        for i in range(5):
            embedding = np.random.normal(0, 1, 384).tolist()
            text = f"Test text {i} for batch validation"

            embeddings.append(embedding)
            texts.append(text)

        batch_report = await quality_validator.validate_batch(
            embeddings=embeddings, texts=texts
        )

        assert batch_report is not None
        assert batch_report.embedding_count == len(embeddings)
        assert batch_report.avg_quality_score >= 0
        assert batch_report.avg_quality_score <= 1
        assert batch_report.pass_rate >= 0
        assert batch_report.pass_rate <= 1

    @pytest.mark.asyncio
    async def test_similarity_calculation(self, quality_validator):
        """Test similarity calculation between embeddings."""
        # Create two similar embeddings
        base_embedding = np.random.normal(0, 1, 384)
        similar_embedding = base_embedding + np.random.normal(
            0, 0.1, 384
        )  # Small noise

        result = await quality_validator.calculate_similarity(
            embedding1=base_embedding.tolist(), embedding2=similar_embedding.tolist()
        )

        assert result is not None
        assert result.cosine_similarity >= 0
        assert result.cosine_similarity <= 1
        assert result.euclidean_distance >= 0
        assert result.manhattan_distance >= 0
        assert result.similarity_level in [
            "very_high",
            "high",
            "moderate",
            "low",
            "very_low",
        ]

    @pytest.mark.asyncio
    async def test_quality_trends(self, quality_validator):
        """Test quality trend analysis."""
        # Create some mock batch reports
        from .embedding_quality_validator import BatchQualityReport

        reports = []
        for i in range(5):
            # Create mock report
            report = BatchQualityReport(
                batch_id=uuid.uuid4(),
                tenant_id=uuid.uuid4(),
                embedding_count=10,
                avg_quality_score=0.8 + (i * 0.02),  # Improving quality
                min_quality_score=0.7,
                max_quality_score=0.9,
                quality_distribution={"good": 8, "excellent": 2},
                passed_count=10,
                failed_count=0,
                metric_averages={},
                common_issues=[],
                processing_time_ms=1000,
            )
            reports.append(report)

        # Add reports to history
        quality_validator.quality_history.extend(reports)

        # Get trends
        trends = quality_validator.get_quality_trends(days=30)

        assert trends is not None
        assert "period_days" in trends
        assert "total_batches" in trends
        assert "avg_quality_score" in trends
        assert "quality_trend" in trends


class TestEmbeddingMetadataService:
    """Test cases for embedding metadata service."""

    @pytest.fixture
    async def metadata_service(self):
        """Initialize metadata service for testing."""
        from .embedding_metadata_service import EmbeddingMetadataService

        config = {
            "storage_type": "memory",
            "audit_enabled": True,
            "cache_enabled": True,
        }

        return EmbeddingMetadataService(config)

    @pytest.mark.asyncio
    async def test_metadata_creation(self, metadata_service):
        """Test creation of embedding metadata."""
        from ..models.document import DocumentChunk

        # Create test chunk
        chunk = DocumentChunk(
            id=uuid.uuid4(),
            tenant_id=uuid.uuid4(),
            document_id=uuid.uuid4(),
            chunk_index=0,
            content="Test metadata creation",
            content_length=len("Test metadata creation"),
        )

        metadata = await metadata_service.create_metadata(
            chunk=chunk,
            provider="sentence_transformers",
            model="all-MiniLM-L6-v2",
            embedding_dimensions=384,
            generation_cost_usd=0.001,
        )

        assert metadata is not None
        assert metadata.embedding_id is not None
        assert metadata.tenant_id == chunk.tenant_id
        assert metadata.provider == "sentence_transformers"
        assert metadata.model == "all-MiniLM-L6-v2"
        assert metadata.embedding_dimensions == 384

    @pytest.mark.asyncio
    async def test_metadata_retrieval(self, metadata_service):
        """Test retrieval of embedding metadata."""
        from ..models.document import DocumentChunk

        # Create test chunk and metadata
        chunk = DocumentChunk(
            id=uuid.uuid4(),
            tenant_id=uuid.uuid4(),
            document_id=uuid.uuid4(),
            chunk_index=0,
            content="Test metadata retrieval",
            content_length=len("Test metadata retrieval"),
        )

        metadata = await metadata_service.create_metadata(
            chunk=chunk,
            provider="sentence_transformers",
            model="all-MiniLM-L6-v2",
            embedding_dimensions=384,
        )

        # Retrieve metadata
        retrieved_metadata = await metadata_service.get_metadata(metadata.embedding_id)

        assert retrieved_metadata is not None
        assert retrieved_metadata.embedding_id == metadata.embedding_id
        assert retrieved_metadata.provider == metadata.provider
        assert retrieved_metadata.model == metadata.model

    @pytest.mark.asyncio
    async def test_metadata_versioning(self, metadata_service):
        """Test metadata versioning and rollback."""
        from ..models.document import DocumentChunk

        # Create test chunk and metadata
        chunk = DocumentChunk(
            id=uuid.uuid4(),
            tenant_id=uuid.uuid4(),
            document_id=uuid.uuid4(),
            chunk_index=0,
            content="Test metadata versioning",
            content_length=len("Test metadata versioning"),
        )

        metadata = await metadata_service.create_metadata(
            chunk=chunk,
            provider="sentence_transformers",
            model="all-MiniLM-L6-v2",
            embedding_dimensions=384,
        )

        original_version = metadata.version

        # Update metadata
        updated_metadata = await metadata_service.update_metadata(
            embedding_id=metadata.embedding_id,
            updates={"tags": ["updated", "test"]},
            create_version=True,
        )

        assert updated_metadata is not None
        assert updated_metadata.version == original_version + 1

        # Get version history
        versions = await metadata_service.get_versions(metadata.embedding_id)
        assert len(versions) >= 2

    @pytest.mark.asyncio
    async def test_audit_logging(self, metadata_service):
        """Test audit logging functionality."""
        from ..models.document import DocumentChunk

        # Create test chunk and metadata
        chunk = DocumentChunk(
            id=uuid.uuid4(),
            tenant_id=uuid.uuid4(),
            document_id=uuid.uuid4(),
            chunk_index=0,
            content="Test audit logging",
            content_length=len("Test audit logging"),
        )

        metadata = await metadata_service.create_metadata(
            chunk=chunk,
            provider="sentence_transformers",
            model="all-MiniLM-L6-v2",
            embedding_dimensions=384,
        )

        # Get audit log
        audit_log = await metadata_service.get_audit_log(
            tenant_id=chunk.tenant_id, limit=10
        )

        assert len(audit_log) > 0

        # Check that creation was logged
        creation_logs = [
            entry
            for entry in audit_log
            if entry.entity_id == metadata.embedding_id
            and entry.action.value == "created"
        ]
        assert len(creation_logs) > 0


class TestEmbeddingOrchestrator:
    """Test cases for the main embedding orchestrator."""

    @pytest.fixture
    async def orchestrator(self):
        """Initialize orchestrator for testing."""
        from .embedding_orchestrator import EmbeddingServiceOrchestrator

        config = TEST_CONFIG.copy()
        config["enable_fallback"] = True
        config["metrics_enabled"] = True

        orchestrator = EmbeddingServiceOrchestrator(config)
        await orchestrator.initialize()
        yield orchestrator
        await orchestrator.shutdown()

    @pytest.mark.asyncio
    async def test_end_to_end_embedding_generation(self, orchestrator):
        """Test end-to-end embedding generation through orchestrator."""
        from .embedding_orchestrator import EmbeddingGenerationRequest, RoutingStrategy

        texts = ["End-to-end test text 1", "End-to-end test text 2"]
        tenant_id = uuid.uuid4()

        request = EmbeddingGenerationRequest(
            texts=texts,
            tenant_id=tenant_id,
            routing_strategy=RoutingStrategy.BALANCED,
            enable_quality_validation=True,
            min_quality_score=0.5,
        )

        result = await orchestrator.generate_embeddings(request)

        assert result is not None
        assert result.embeddings is not None
        assert len(result.embeddings) == len(texts)
        assert result.provider_used is not None
        assert result.model_used is not None
        assert result.processing_time_ms > 0
        assert result.total_cost_usd >= 0
        assert result.success_rate > 0

    @pytest.mark.asyncio
    async def test_document_chunk_processing(self, orchestrator):
        """Test processing of document chunks."""
        from ..models.document import DocumentChunk

        # Create test chunks
        chunks = []
        tenant_id = uuid.uuid4()

        for i in range(3):
            chunk = DocumentChunk(
                id=uuid.uuid4(),
                tenant_id=tenant_id,
                document_id=uuid.uuid4(),
                chunk_index=i,
                content=f"Test chunk {i} for orchestrator",
                content_length=len(f"Test chunk {i} for orchestrator"),
            )
            chunks.append(chunk)

        # Process chunks
        processed_chunks = await orchestrator.process_document_chunks(
            chunks=chunks, tenant_id=tenant_id
        )

        assert len(processed_chunks) == len(chunks)

        # Check that embeddings were generated
        for chunk in processed_chunks:
            assert chunk.embedding is not None
            assert chunk.embedding_model is not None
            assert chunk.embedding_dimensions > 0
            assert chunk.embedding_status.value == "completed"

    @pytest.mark.asyncio
    async def test_service_health_monitoring(self, orchestrator):
        """Test service health monitoring."""
        status = await orchestrator.get_service_status()

        assert status is not None
        assert "status" in status
        assert "health_checks" in status
        assert "performance" in status
        assert "services" in status

        # Check that health checks were performed
        assert len(status["health_checks"]) > 0

    @pytest.mark.asyncio
    async def test_analytics_and_metrics(self, orchestrator):
        """Test analytics and metrics collection."""
        from .embedding_orchestrator import EmbeddingGenerationRequest

        # Generate some embeddings to create metrics
        texts = ["Analytics test text"]
        tenant_id = uuid.uuid4()

        request = EmbeddingGenerationRequest(
            texts=texts, tenant_id=tenant_id, enable_quality_validation=True
        )

        await orchestrator.generate_embeddings(request)

        # Get analytics
        analytics = await orchestrator.get_analytics(tenant_id=tenant_id)

        assert analytics is not None
        assert "period_days" in analytics
        assert "service_metrics" in analytics
        assert "cost_analytics" in analytics
        assert analytics["service_metrics"]["total_requests"] >= 1


# Integration Tests
class TestIntegration:
    """Integration tests for the complete embedding system."""

    @pytest.mark.asyncio
    async def test_full_pipeline_integration(self):
        """Test the complete pipeline from document to embeddings."""
        # This would test the full integration with the document processing pipeline
        # Mocking external dependencies as needed

        # Initialize orchestrator
        from .embedding_orchestrator import EmbeddingServiceOrchestrator

        orchestrator = EmbeddingServiceOrchestrator(TEST_CONFIG)
        await orchestrator.initialize()

        try:
            # Create test document chunks
            from ..models.document import DocumentChunk

            chunks = []
            tenant_id = uuid.uuid4()
            document_id = uuid.uuid4()

            # Simulate document processing pipeline output
            texts = [
                "This is the first chunk of a document that needs to be processed.",
                "This is the second chunk with different content for testing.",
                "The third chunk contains similar but distinct information.",
            ]

            for i, text in enumerate(texts):
                chunk = DocumentChunk(
                    id=uuid.uuid4(),
                    tenant_id=tenant_id,
                    document_id=document_id,
                    chunk_index=i,
                    content=text,
                    content_length=len(text),
                    metadata={"source": "integration_test"},
                )
                chunks.append(chunk)

            # Process through orchestrator
            processed_chunks = await orchestrator.process_document_chunks(
                chunks=chunks,
                tenant_id=tenant_id,
                enable_quality_validation=True,
                enable_caching=True,
            )

            # Verify results
            assert len(processed_chunks) == len(chunks)

            for chunk in processed_chunks:
                assert chunk.embedding is not None
                assert len(chunk.embedding) > 0
                assert chunk.embedding_model is not None
                assert chunk.embedding_status.value == "completed"

                # Check metadata was updated
                assert "embedding_id" in chunk.metadata
                assert "embedding_provider" in chunk.metadata
                assert "embedding_quality_score" in chunk.metadata

            # Verify similarity between related chunks
            from .embedding_quality_validator import get_quality_validator

            validator = get_quality_validator()

            # Calculate similarity between first and second chunks
            similarity = await validator.calculate_similarity(
                processed_chunks[0].embedding, processed_chunks[1].embedding
            )

            assert similarity.cosine_similarity >= 0
            assert similarity.cosine_similarity <= 1

            # Test caching by processing same chunks again
            cached_chunks = await orchestrator.process_document_chunks(
                chunks=chunks, tenant_id=tenant_id, enable_caching=True
            )

            # Should get same embeddings
            for i, (original, cached) in enumerate(
                zip(processed_chunks, cached_chunks)
            ):
                assert original.embedding == cached.embedding

            logger.info("Full pipeline integration test completed successfully")

        finally:
            await orchestrator.shutdown()


# Performance Tests
class TestPerformance:
    """Performance tests for the embedding system."""

    @pytest.mark.asyncio
    async def test_batch_processing_performance(self):
        """Test batch processing performance with large datasets."""
        from .embedding_orchestrator import EmbeddingServiceOrchestrator

        orchestrator = EmbeddingServiceOrchestrator(TEST_CONFIG)
        await orchestrator.initialize()

        try:
            # Create large batch of chunks
            from ..models.document import DocumentChunk

            chunks = []
            tenant_id = uuid.uuid4()

            batch_size = 100  # Test with 100 chunks

            for i in range(batch_size):
                chunk = DocumentChunk(
                    id=uuid.uuid4(),
                    tenant_id=tenant_id,
                    document_id=uuid.uuid4(),
                    chunk_index=i,
                    content=f"Performance test chunk {i} with content to process.",
                    content_length=50,
                )
                chunks.append(chunk)

            # Measure processing time
            start_time = asyncio.get_event_loop().time()

            processed_chunks = await orchestrator.process_document_chunks(
                chunks=chunks,
                tenant_id=tenant_id,
                batch_processing=True,  # Enable batch processing
            )

            end_time = asyncio.get_event_loop().time()
            processing_time = (end_time - start_time) * 1000  # Convert to ms

            # Verify all chunks were processed
            assert len(processed_chunks) == batch_size

            # Check performance (should process within reasonable time)
            avg_time_per_chunk = processing_time / batch_size
            logger.info(
                f"Processed {batch_size} chunks in {processing_time:.2f}ms "
                f"({avg_time_per_chunk:.2f}ms per chunk)"
            )

            # Performance assertion (adjust threshold based on requirements)
            assert avg_time_per_chunk < 100  # Should be less than 100ms per chunk

            # Verify quality
            success_count = sum(
                1
                for chunk in processed_chunks
                if chunk.embedding_status.value == "completed"
            )

            assert success_count == batch_size

        finally:
            await orchestrator.shutdown()


# Utility functions for testing
def create_test_embedding(dimensions: int = 384) -> List[float]:
    """Create a test embedding with specified dimensions."""
    return np.random.normal(0, 1, dimensions).tolist()


def create_test_chunks(
    count: int = 10, tenant_id: uuid.UUID = None
) -> List[DocumentChunk]:
    """Create test document chunks."""
    from ..models.document import DocumentChunk

    if tenant_id is None:
        tenant_id = uuid.uuid4()

    chunks = []
    for i in range(count):
        chunk = DocumentChunk(
            id=uuid.uuid4(),
            tenant_id=tenant_id,
            document_id=uuid.uuid4(),
            chunk_index=i,
            content=f"Test chunk {i} content for testing purposes.",
            content_length=50,
        )
        chunks.append(chunk)

    return chunks


if __name__ == "__main__":
    # Run tests
    pytest.main([__file__, "-v", "--tb=short"])
