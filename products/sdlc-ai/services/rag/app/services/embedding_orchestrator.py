"""
Main embedding service orchestrator that integrates all embedding components.

This module provides the main entry point for embedding generation, coordinating:
- Multi-provider embedding generation
- Intelligent caching and batch processing
- Cost optimization and provider selection
- Quality validation and similarity scoring
- Metadata tracking and version management
- Fallback mechanisms and error handling
- Performance monitoring and metrics
"""

import asyncio
import logging
import time
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple, Union
from uuid import UUID, uuid4

from ..core.config import get_settings
from ..models.document import DocumentChunk, DocumentStatus
from .embedding_service import (
    EmbeddingProvider,
    EmbeddingModel,
    EmbeddingRequest,
    EmbeddingResponse,
    get_embedding_service,
)
from .batch_embedding_processor import (
    BatchEmbeddingProcessor,
    BatchPriority,
    get_batch_processor,
)
from .cost_optimization_service import (
    CostOptimizationService,
    RoutingStrategy,
    get_cost_optimization_service,
)
from .embedding_quality_validator import (
    EmbeddingQualityValidator,
    get_quality_validator,
)
from .embedding_metadata_service import EmbeddingMetadataService, get_metadata_service

logger = logging.getLogger(__name__)


class ServiceStatus(str, Enum):
    """Service status enumeration."""

    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"
    INITIALIZING = "initializing"
    DISABLED = "disabled"


@dataclass
class EmbeddingGenerationRequest:
    """Request for embedding generation."""

    texts: List[str]
    tenant_id: UUID
    user_id: Optional[UUID] = None
    document_id: Optional[UUID] = None
    chunks: Optional[List[DocumentChunk]] = None

    # Provider selection
    preferred_provider: Optional[EmbeddingProvider] = None
    preferred_model: Optional[str] = None
    routing_strategy: RoutingStrategy = RoutingStrategy.BALANCED

    # Quality and performance
    enable_quality_validation: bool = True
    min_quality_score: float = 0.6
    enable_caching: bool = True
    enable_batch_processing: bool = True

    # Metadata
    metadata: Dict[str, Any] = field(default_factory=dict)
    tags: List[str] = field(default_factory=list)

    # Priority and processing
    priority: BatchPriority = BatchPriority.NORMAL
    batch_processing: bool = False

    def __post_init__(self):
        """Validate request after initialization."""
        if not self.texts:
            raise ValueError("At least one text is required")

        if self.chunks and len(self.chunks) != len(self.texts):
            raise ValueError("Number of chunks must match number of texts")


@dataclass
class EmbeddingGenerationResult:
    """Result of embedding generation."""

    request_id: UUID
    embeddings: List[List[float]]
    metadata_list: List[Dict[str, Any]]
    provider_used: EmbeddingProvider
    model_used: str

    # Performance metrics
    processing_time_ms: int
    cache_hit_rate: float
    quality_scores: List[float]

    # Cost information
    total_cost_usd: float
    cost_breakdown: Dict[str, float]

    # Quality and validation
    all_passed_quality: bool
    quality_report: Optional[Dict[str, Any]] = None

    # Batch processing info
    batch_job_id: Optional[UUID] = None

    # Errors and warnings
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)

    @property
    def success_rate(self) -> float:
        """Calculate success rate."""
        if not self.embeddings:
            return 0.0
        return (len(self.embeddings) - len(self.errors)) / len(self.embeddings)

    @property
    def avg_quality_score(self) -> float:
        """Calculate average quality score."""
        if not self.quality_scores:
            return 0.0
        return sum(self.quality_scores) / len(self.quality_scores)


class EmbeddingServiceOrchestrator:
    """
    Main orchestrator for embedding generation services.

    This service coordinates all embedding-related functionality:
    - Provider selection and cost optimization
    - Intelligent caching and batch processing
    - Quality validation and similarity scoring
    - Metadata tracking and version management
    - Error handling and fallback mechanisms
    - Performance monitoring and metrics
    """

    def __init__(self, config: Dict[str, Any] = None):
        """Initialize the orchestrator."""
        self.settings = get_settings()
        self.config = config or {}

        # Service components
        self.embedding_service = None
        self.batch_processor = None
        self.cost_optimizer = None
        self.quality_validator = None
        self.metadata_service = None

        # Service status
        self._status = ServiceStatus.INITIALIZING
        self._initialization_time = datetime.utcnow()
        self._health_checks: Dict[str, bool] = {}

        # Configuration
        self.enable_fallback = self.config.get("enable_fallback", True)
        self.max_retries = self.config.get("max_retries", 3)
        self.retry_delay = self.config.get("retry_delay", 1.0)

        # Performance monitoring
        self._request_count = 0
        self._error_count = 0
        self._total_processing_time = 0
        self._total_cost = 0.0

        # Metrics collection
        self.metrics_enabled = self.config.get("metrics_enabled", True)
        self.metrics_history: List[Dict[str, Any]] = []
        self.max_metrics_history = self.config.get("max_metrics_history", 1000)

    async def initialize(self) -> None:
        """Initialize all service components."""
        logger.info("Initializing embedding service orchestrator...")

        try:
            # Initialize core services
            self.embedding_service = await get_embedding_service()
            self.batch_processor = await get_batch_processor()
            self.cost_optimizer = await get_cost_optimization_service()
            self.quality_validator = get_quality_validator()
            self.metadata_service = get_metadata_service()

            # Perform health checks
            await self._perform_health_checks()

            # Update status
            self._status = ServiceStatus.HEALTHY
            logger.info("Embedding service orchestrator initialized successfully")

        except Exception as e:
            logger.error(f"Failed to initialize orchestrator: {str(e)}")
            self._status = ServiceStatus.UNHEALTHY
            raise

    async def _perform_health_checks(self) -> None:
        """Perform health checks on all services."""
        health_checks = {}

        # Check embedding service
        try:
            provider_status = await self.embedding_service.get_provider_status()
            health_checks["embedding_service"] = any(
                status.get("healthy", False) for status in provider_status.values()
            )
        except Exception as e:
            logger.warning(f"Embedding service health check failed: {str(e)}")
            health_checks["embedding_service"] = False

        # Check batch processor
        try:
            queue_info = self.batch_processor.get_queue_info()
            health_checks["batch_processor"] = True
        except Exception as e:
            logger.warning(f"Batch processor health check failed: {str(e)}")
            health_checks["batch_processor"] = False

        # Check cost optimizer
        try:
            provider_rankings = self.cost_optimizer.get_provider_rankings()
            health_checks["cost_optimizer"] = len(provider_rankings) > 0
        except Exception as e:
            logger.warning(f"Cost optimizer health check failed: {str(e)}")
            health_checks["cost_optimizer"] = False

        # Check quality validator
        try:
            # Simple validation test
            test_embedding = [0.1] * 384
            quality_report = await self.quality_validator.validate_embedding(
                test_embedding
            )
            health_checks["quality_validator"] = (
                quality_report.validation_passed or len(quality_report.issues) == 0
            )
        except Exception as e:
            logger.warning(f"Quality validator health check failed: {str(e)}")
            health_checks["quality_validator"] = False

        # Check metadata service
        try:
            stats = self.metadata_service.get_statistics()
            health_checks["metadata_service"] = True
        except Exception as e:
            logger.warning(f"Metadata service health check failed: {str(e)}")
            health_checks["metadata_service"] = False

        self._health_checks = health_checks

        # Determine overall status
        healthy_count = sum(health_checks.values())
        total_count = len(health_checks)

        if healthy_count == total_count:
            self._status = ServiceStatus.HEALTHY
        elif healthy_count >= total_count * 0.7:
            self._status = ServiceStatus.DEGRADED
        else:
            self._status = ServiceStatus.UNHEALTHY

        logger.info(
            f"Health checks completed: {healthy_count}/{total_count} services healthy"
        )

    async def generate_embeddings(
        self, request: EmbeddingGenerationRequest
    ) -> EmbeddingGenerationResult:
        """
        Generate embeddings with full orchestration.

        Args:
            request: Embedding generation request

        Returns:
            Generation result with embeddings and metadata
        """
        request_id = uuid4()
        start_time = time.time()

        logger.info(f"Starting embedding generation request {request_id}")

        try:
            # Validate request
            await self._validate_request(request)

            # Determine optimal provider
            provider_decision = await self._select_provider(request)

            # Prepare embedding request
            embedding_request = EmbeddingRequest(
                texts=request.texts,
                provider=provider_decision.selected_provider,
                model=EmbeddingModel(provider_decision.selected_model),
                tenant_id=request.tenant_id,
                user_id=request.user_id,
                batch_id=request_id,
                priority=10 if request.priority == BatchPriority.URGENT else 5,
                metadata=request.metadata,
            )

            # Generate embeddings
            embedding_response = await self.embedding_service.generate_embeddings(
                embedding_request
            )

            # Quality validation
            quality_scores = []
            quality_issues = []
            all_passed_quality = True

            if request.enable_quality_validation:
                quality_scores = await self._validate_embeddings_quality(
                    embedding_response.embeddings, request.texts
                )
                all_passed_quality = all(
                    score >= request.min_quality_score for score in quality_scores
                )

                if not all_passed_quality:
                    quality_issues = [
                        f"Embedding {i} quality score {score:.3f} below threshold {request.min_quality_score}"
                        for i, score in enumerate(quality_scores)
                        if score < request.min_quality_score
                    ]

            # Create metadata for each embedding
            metadata_list = []
            chunks = request.chunks or [None] * len(request.texts)

            for i, (text, embedding, chunk) in enumerate(
                zip(request.texts, embedding_response.embeddings, chunks)
            ):
                if chunk:
                    # Use existing chunk
                    metadata = await self._create_metadata_for_chunk(
                        chunk,
                        provider_decision.selected_provider,
                        provider_decision.selected_model,
                        embedding,
                        quality_scores[i] if quality_scores else None,
                    )
                else:
                    # Create synthetic metadata
                    metadata = await self._create_synthetic_metadata(
                        text,
                        provider_decision.selected_provider,
                        provider_decision.selected_model,
                        embedding,
                        request,
                        i,
                        quality_scores[i] if quality_scores else None,
                    )

                metadata_list.append(metadata.to_dict())

            # Record usage for cost optimization
            await self._record_usage(request, embedding_response, provider_decision)

            # Calculate processing time
            processing_time_ms = int((time.time() - start_time) * 1000)

            # Update metrics
            await self._update_metrics(
                request_id, processing_time_ms, embedding_response.cost_estimate_usd
            )

            # Create result
            result = EmbeddingGenerationResult(
                request_id=request_id,
                embeddings=embedding_response.embeddings,
                metadata_list=metadata_list,
                provider_used=provider_decision.selected_provider,
                model_used=provider_decision.selected_model,
                processing_time_ms=processing_time_ms,
                cache_hit_rate=embedding_response.cached_count / len(request.texts),
                quality_scores=quality_scores,
                total_cost_usd=embedding_response.cost_estimate_usd,
                cost_breakdown={
                    "generation_cost": embedding_response.cost_estimate_usd,
                    "quality_validation_cost": 0.0,  # Would be calculated if quality validation has costs
                },
                all_passed_quality=all_passed_quality,
                errors=quality_issues,
                warnings=[],  # Could add warnings for various conditions
            )

            logger.info(
                f"Completed embedding generation request {request_id} "
                f"in {processing_time_ms}ms with cost ${result.total_cost_usd:.6f}"
            )

            return result

        except Exception as e:
            logger.error(
                f"Error in embedding generation request {request_id}: {str(e)}"
            )

            processing_time_ms = int((time.time() - start_time) * 1000)
            await self._update_metrics(request_id, processing_time_ms, 0.0, error=True)

            # Return error result
            return EmbeddingGenerationResult(
                request_id=request_id,
                embeddings=[],
                metadata_list=[],
                provider_used=EmbeddingProvider.SENTENCE_TRANSFORMERS,  # Default
                model_used="unknown",
                processing_time_ms=processing_time_ms,
                cache_hit_rate=0.0,
                quality_scores=[],
                total_cost_usd=0.0,
                cost_breakdown={},
                all_passed_quality=False,
                errors=[str(e)],
            )

    async def process_document_chunks(
        self,
        chunks: List[DocumentChunk],
        tenant_id: UUID,
        user_id: Optional[UUID] = None,
        **kwargs,
    ) -> List[DocumentChunk]:
        """
        Process document chunks with embedding generation.
        This is the main integration point with the document processing pipeline.
        """
        if not chunks:
            return []

        # Extract texts from chunks
        texts = [chunk.content for chunk in chunks]

        # Create request
        request = EmbeddingGenerationRequest(
            texts=texts,
            tenant_id=tenant_id,
            user_id=user_id,
            document_id=chunks[0].document_id if chunks else None,
            chunks=chunks,
            batch_processing=len(chunks) > 10,  # Use batch processing for larger sets
            **kwargs,
        )

        # Generate embeddings
        result = await self.generate_embeddings(request)

        # Update chunks with embeddings and metadata
        for i, (chunk, embedding, metadata) in enumerate(
            zip(chunks, result.embeddings, result.metadata_list)
        ):
            if i < len(result.embeddings):
                chunk.embedding = embedding
                chunk.embedding_model = result.model_used
                chunk.embedding_dimensions = len(embedding)
                chunk.embedding_status = DocumentStatus.COMPLETED

                # Add metadata to chunk
                chunk.metadata.update(
                    {
                        "embedding_id": metadata.get("embedding_id"),
                        "embedding_provider": result.provider_used.value,
                        "embedding_quality_score": result.quality_scores[i]
                        if i < len(result.quality_scores)
                        else None,
                        "embedding_cost_usd": result.total_cost_usd / len(chunks),
                        "processing_time_ms": result.processing_time_ms // len(chunks),
                    }
                )
            else:
                chunk.embedding_status = DocumentStatus.FAILED
                chunk.metadata["embedding_error"] = "Embedding not generated"

        return chunks

    async def submit_batch_job(
        self,
        chunks: List[DocumentChunk],
        tenant_id: UUID,
        user_id: Optional[UUID] = None,
        **kwargs,
    ) -> UUID:
        """Submit a batch processing job."""
        # Use the batch processor directly
        priority = BatchPriority(kwargs.get("priority", "normal"))
        provider = EmbeddingProvider(kwargs.get("provider", "sentence_transformers"))
        model = kwargs.get("model", "all-MiniLM-L6-v2")

        job_id = await self.batch_processor.submit_job(
            chunks=chunks,
            provider=provider,
            model=model,
            priority=priority,
            tenant_id=tenant_id,
            user_id=user_id,
            **kwargs,
        )

        logger.info(f"Submitted batch job {job_id} with {len(chunks)} chunks")
        return job_id

    async def get_batch_job_status(self, job_id: UUID) -> Optional[Dict[str, Any]]:
        """Get status of a batch job."""
        return await self.batch_processor.get_job_metrics(job_id)

    async def _validate_request(self, request: EmbeddingGenerationRequest) -> None:
        """Validate embedding generation request."""
        if not request.texts:
            raise ValueError("No texts provided")

        # Check text length limits
        max_text_length = self.config.get("max_text_length", 8000)
        for i, text in enumerate(request.texts):
            if len(text) > max_text_length * 4:  # Rough token estimate
                raise ValueError(f"Text {i} too long: {len(text)} characters")

        # Validate quality score threshold
        if not 0 <= request.min_quality_score <= 1:
            raise ValueError("Quality score threshold must be between 0 and 1")

    async def _select_provider(self, request: EmbeddingGenerationRequest) -> Any:
        """Select optimal provider using cost optimization service."""
        # Estimate tokens (rough approximation)
        total_chars = sum(len(text) for text in request.texts)
        estimated_tokens = total_chars // 4

        # Select provider
        decision = await self.cost_optimizer.select_optimal_provider(
            tenant_id=request.tenant_id,
            estimated_tokens=estimated_tokens,
            strategy=request.routing_strategy,
            preferred_providers=[request.preferred_provider]
            if request.preferred_provider
            else None,
        )

        return decision

    async def _validate_embeddings_quality(
        self, embeddings: List[List[float]], texts: List[str]
    ) -> List[float]:
        """Validate quality of embeddings."""
        quality_scores = []

        for embedding, text in zip(embeddings, texts):
            try:
                report = await self.quality_validator.validate_embedding(
                    embedding=embedding, text=text
                )
                quality_scores.append(report.overall_score)
            except Exception as e:
                logger.warning(f"Quality validation failed: {str(e)}")
                quality_scores.append(0.5)  # Default score

        return quality_scores

    async def _create_metadata_for_chunk(
        self,
        chunk: DocumentChunk,
        provider: EmbeddingProvider,
        model: str,
        embedding: List[float],
        quality_score: Optional[float],
    ) -> Any:
        """Create metadata for existing chunk."""
        return await self.metadata_service.create_metadata(
            chunk=chunk,
            provider=provider.value,
            model=model,
            embedding_dimensions=len(embedding),
            quality_score=quality_score,
        )

    async def _create_synthetic_metadata(
        self,
        text: str,
        provider: EmbeddingProvider,
        model: str,
        embedding: List[float],
        request: EmbeddingGenerationRequest,
        index: int,
        quality_score: Optional[float],
    ) -> Any:
        """Create synthetic metadata for text without chunk."""
        # Create a synthetic chunk object
        from ..models.document import DocumentChunk

        synthetic_chunk = DocumentChunk(
            id=uuid4(),
            tenant_id=request.tenant_id,
            document_id=request.document_id,
            chunk_index=index,
            content=text,
            content_length=len(text),
        )

        return await self.metadata_service.create_metadata(
            chunk=synthetic_chunk,
            provider=provider.value,
            model=model,
            embedding_dimensions=len(embedding),
            quality_score=quality_score,
            custom_attributes=request.metadata,
        )

    async def _record_usage(
        self,
        request: EmbeddingGenerationRequest,
        response: EmbeddingResponse,
        provider_decision: Any,
    ) -> None:
        """Record usage for cost optimization and analytics."""
        # Estimate tokens
        total_chars = sum(len(text) for text in request.texts)
        estimated_tokens = total_chars // 4

        await self.cost_optimizer.record_usage(
            tenant_id=request.tenant_id,
            provider=provider_decision.selected_provider,
            model=provider_decision.selected_model,
            tokens_used=estimated_tokens,
            cost_usd=response.cost_estimate_usd,
            response_time_ms=response.processing_time_ms,
            success=True,
            cache_hit=response.cached_count > 0,
        )

    async def _update_metrics(
        self,
        request_id: UUID,
        processing_time_ms: int,
        cost_usd: float,
        error: bool = False,
    ) -> None:
        """Update service metrics."""
        if not self.metrics_enabled:
            return

        self._request_count += 1
        if error:
            self._error_count += 1

        self._total_processing_time += processing_time_ms
        self._total_cost += cost_usd

        # Record metrics entry
        metrics_entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "request_id": str(request_id),
            "processing_time_ms": processing_time_ms,
            "cost_usd": cost_usd,
            "error": error,
        }

        self.metrics_history.append(metrics_entry)

        # Maintain history size
        if len(self.metrics_history) > self.max_metrics_history:
            self.metrics_history = self.metrics_history[-self.max_metrics_history :]

    async def get_service_status(self) -> Dict[str, Any]:
        """Get comprehensive service status."""
        await self._perform_health_checks()

        # Calculate performance metrics
        avg_processing_time = (
            self._total_processing_time / self._request_count
            if self._request_count > 0
            else 0
        )

        error_rate = (
            self._error_count / self._request_count if self._request_count > 0 else 0
        )

        uptime = datetime.utcnow() - self._initialization_time

        return {
            "status": self._status.value,
            "uptime_seconds": int(uptime.total_seconds()),
            "health_checks": self._health_checks,
            "performance": {
                "total_requests": self._request_count,
                "error_count": self._error_count,
                "error_rate": error_rate,
                "avg_processing_time_ms": avg_processing_time,
                "total_cost_usd": self._total_cost,
            },
            "services": {
                "embedding_service": {
                    "status": "healthy"
                    if self._health_checks.get("embedding_service", False)
                    else "unhealthy",
                    "providers": len(self.embedding_service.providers)
                    if self.embedding_service
                    else 0,
                },
                "batch_processor": {
                    "status": "healthy"
                    if self._health_checks.get("batch_processor", False)
                    else "unhealthy",
                    "queue_info": self.batch_processor.get_queue_info()
                    if self.batch_processor
                    else {},
                },
                "cost_optimizer": {
                    "status": "healthy"
                    if self._health_checks.get("cost_optimizer", False)
                    else "unhealthy",
                    "provider_rankings": len(
                        self.cost_optimizer.get_provider_rankings()
                    )
                    if self.cost_optimizer
                    else 0,
                },
                "quality_validator": {
                    "status": "healthy"
                    if self._health_checks.get("quality_validator", False)
                    else "unhealthy",
                },
                "metadata_service": {
                    "status": "healthy"
                    if self._health_checks.get("metadata_service", False)
                    else "unhealthy",
                },
            },
        }

    async def get_analytics(
        self, tenant_id: Optional[UUID] = None, days: int = 30
    ) -> Dict[str, Any]:
        """Get comprehensive analytics."""
        # Get analytics from various services
        cost_analytics = self.cost_optimizer.get_cost_analytics(tenant_id)
        quality_trends = self.quality_validator.get_quality_trends(tenant_id, days)
        metadata_stats = self.metadata_service.get_statistics(tenant_id)

        # Get recent metrics
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        recent_metrics = [
            metric
            for metric in self.metrics_history
            if datetime.fromisoformat(metric["timestamp"]) >= cutoff_date
        ]

        # Calculate service metrics
        if recent_metrics:
            total_requests = len(recent_metrics)
            total_errors = sum(1 for m in recent_metrics if m["error"])
            avg_processing_time = (
                sum(m["processing_time_ms"] for m in recent_metrics) / total_requests
            )
            total_cost = sum(m["cost_usd"] for m in recent_metrics)
        else:
            total_requests = 0
            total_errors = 0
            avg_processing_time = 0
            total_cost = 0

        return {
            "period_days": days,
            "tenant_id": str(tenant_id) if tenant_id else "all",
            "service_metrics": {
                "total_requests": total_requests,
                "error_count": total_errors,
                "error_rate": total_errors / total_requests
                if total_requests > 0
                else 0,
                "avg_processing_time_ms": avg_processing_time,
                "total_cost_usd": total_cost,
            },
            "cost_analytics": cost_analytics,
            "quality_trends": quality_trends,
            "metadata_statistics": metadata_stats,
        }

    async def shutdown(self) -> None:
        """Shutdown the orchestrator and all services."""
        logger.info("Shutting down embedding service orchestrator...")

        try:
            if self.batch_processor:
                await self.batch_processor.stop()

            self._status = ServiceStatus.DISABLED
            logger.info("Embedding service orchestrator shutdown completed")

        except Exception as e:
            logger.error(f"Error during shutdown: {str(e)}")


# Global instance
_orchestrator: Optional[EmbeddingServiceOrchestrator] = None


async def get_embedding_orchestrator() -> EmbeddingServiceOrchestrator:
    """Get global embedding orchestrator instance."""
    global _orchestrator

    if _orchestrator is None:
        _orchestrator = EmbeddingServiceOrchestrator()
        await _orchestrator.initialize()

    return _orchestrator


# Convenience functions
async def generate_embeddings_for_texts(
    texts: List[str], tenant_id: UUID, user_id: Optional[UUID] = None, **kwargs
) -> EmbeddingGenerationResult:
    """Generate embeddings for a list of texts."""
    orchestrator = await get_embedding_orchestrator()

    request = EmbeddingGenerationRequest(
        texts=texts, tenant_id=tenant_id, user_id=user_id, **kwargs
    )

    return await orchestrator.generate_embeddings(request)


async def process_chunks_with_embeddings(
    chunks: List[DocumentChunk],
    tenant_id: UUID,
    user_id: Optional[UUID] = None,
    **kwargs,
) -> List[DocumentChunk]:
    """Process document chunks with embedding generation."""
    orchestrator = await get_embedding_orchestrator()
    return await orchestrator.process_document_chunks(
        chunks, tenant_id, user_id, **kwargs
    )
