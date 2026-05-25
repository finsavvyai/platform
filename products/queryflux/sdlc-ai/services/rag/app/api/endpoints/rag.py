"""
RAG Workflow Endpoints

End-to-end RAG pipeline endpoints for comprehensive document processing and generation.
Handles the complete workflow from query input to contextual response generation with
streaming capabilities, batch processing, and advanced features.
"""

import asyncio
import logging
import time
import uuid
from datetime import datetime
from typing import Dict, Any, Optional, List, AsyncGenerator
from fastapi import APIRouter, HTTPException, Query, Path, Depends, BackgroundTasks
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, validator
import json

from app.core.config import get_settings
from app.core.error_handling import RAGServiceException, ValidationException
from app.services.rag_orchestrator import (
    RAGPipelineOrchestrator,
    PipelineRequest,
    PipelineConfig,
    PipelineResult,
    PipelineStatus,
    StreamingMode,
    StreamingEvent,
)
from app.services.query_understanding_service import RetrievalStrategy
from app.services.context_assembly_service import AssemblyStrategy, CompressionLevel
from app.services.citation_service import CitationStyle

logger = logging.getLogger(__name__)
settings = get_settings()

# Create router
router = APIRouter()


# Request/Response Models
class RAGQueryRequest(BaseModel):
    """Request model for RAG query execution."""

    query: str = Field(
        ..., min_length=1, max_length=2000, description="The query to process"
    )
    config: Optional[Dict[str, Any]] = Field(
        None, description="Pipeline configuration options"
    )
    user_id: Optional[str] = Field(None, description="User ID for personalization")
    tenant_id: Optional[str] = Field(None, description="Tenant ID for multi-tenancy")
    session_id: Optional[str] = Field(None, description="Session ID for context")
    conversation_id: Optional[str] = Field(
        None, description="Conversation ID for context"
    )
    retrieval_strategy: RetrievalStrategy = Field(
        RetrievalStrategy.MULTI_STAGE, description="Retrieval strategy"
    )
    assembly_strategy: AssemblyStrategy = Field(
        AssemblyStrategy.ADAPTIVE, description="Context assembly strategy"
    )
    citation_styles: List[str] = Field(
        default=["APA"], description="Citation styles to use"
    )
    context_window_type: str = Field("llm", description="Context window type")
    metadata: Dict[str, Any] = Field(
        default_factory=dict, description="Additional metadata"
    )

    @validator("query")
    def validate_query(cls, v):
        if not v or not v.strip():
            raise ValueError("Query cannot be empty")
        if len(v) > 2000:
            raise ValueError("Query too long (max 2000 characters)")
        return v.strip()

    @validator("citation_styles")
    def validate_citation_styles(cls, v):
        if not v:
            return ["APA"]
        valid_styles = ["APA", "MLA", "Chicago", "IEEE", "Harvard"]
        for style in v:
            if style not in valid_styles:
                raise ValueError(f"Invalid citation style: {style}")
        return v


class RAGQueryResponse(BaseModel):
    """Response model for RAG query execution."""

    pipeline_id: str = Field(..., description="Unique pipeline execution ID")
    status: str = Field(..., description="Pipeline execution status")
    query: str = Field(..., description="Original query")
    answer: Optional[str] = Field(None, description="Generated answer")
    context: Optional[str] = Field(None, description="Retrieved and assembled context")
    sources: List[Dict[str, Any]] = Field(
        default_factory=list, description="Source citations"
    )
    confidence_score: Optional[float] = Field(
        None, description="Answer confidence score"
    )
    quality_score: Optional[float] = Field(None, description="Response quality score")
    execution_time_ms: Optional[float] = Field(None, description="Total execution time")
    metadata: Dict[str, Any] = Field(
        default_factory=dict, description="Additional metadata"
    )
    timestamp: datetime = Field(..., description="Execution timestamp")


class RAGStreamingResponse(BaseModel):
    """Model for streaming RAG response events."""

    event_type: str = Field(..., description="Type of streaming event")
    pipeline_id: str = Field(..., description="Pipeline execution ID")
    timestamp: datetime = Field(..., description="Event timestamp")
    data: Optional[Dict[str, Any]] = Field(None, description="Event data")
    error: Optional[str] = Field(None, description="Error information")
    progress: Optional[float] = Field(None, description="Progress percentage (0-1)")


class BatchRAGRequest(BaseModel):
    """Request model for batch RAG processing."""

    queries: List[str] = Field(
        ..., min_items=1, max_items=100, description="List of queries to process"
    )
    config: Optional[Dict[str, Any]] = Field(
        None, description="Pipeline configuration options"
    )
    user_id: Optional[str] = Field(None, description="User ID for personalization")
    tenant_id: Optional[str] = Field(None, description="Tenant ID for multi-tenancy")
    session_id: Optional[str] = Field(None, description="Session ID for context")
    parallel_processing: bool = Field(True, description="Process queries in parallel")
    max_concurrent: int = Field(5, description="Maximum concurrent processes")

    @validator("queries")
    def validate_queries(cls, v):
        if not v:
            raise ValueError("Queries list cannot be empty")
        if len(v) > 100:
            raise ValueError("Too many queries (max 100)")
        for i, query in enumerate(v):
            if not query or not query.strip():
                raise ValueError(f"Query {i} cannot be empty")
            if len(query) > 2000:
                raise ValueError(f"Query {i} too long (max 2000 characters)")
        return [q.strip() for q in v]


class PipelineStatusResponse(BaseModel):
    """Response model for pipeline status."""

    pipeline_id: str = Field(..., description="Pipeline execution ID")
    status: str = Field(..., description="Current status")
    progress: Optional[float] = Field(None, description="Progress percentage")
    current_step: Optional[str] = Field(None, description="Current step name")
    execution_time_ms: Optional[float] = Field(
        None, description="Execution time so far"
    )
    estimated_remaining_ms: Optional[float] = Field(
        None, description="Estimated remaining time"
    )
    error: Optional[str] = Field(None, description="Error information")
    metadata: Dict[str, Any] = Field(
        default_factory=dict, description="Additional metadata"
    )


class PipelineMetricsResponse(BaseModel):
    """Response model for pipeline metrics."""

    total_pipelines: int = Field(..., description="Total pipelines executed")
    active_pipelines: int = Field(..., description="Currently active pipelines")
    completed_pipelines: int = Field(..., description="Completed pipelines")
    failed_pipelines: int = Field(..., description="Failed pipelines")
    success_rate: float = Field(..., description="Success rate percentage")
    avg_execution_time_ms: float = Field(..., description="Average execution time")
    avg_quality_score: float = Field(..., description="Average quality score")
    error_rates: Dict[str, float] = Field(..., description="Error rates by step")
    performance_metrics: Dict[str, Any] = Field(..., description="Performance metrics")


# Dependency injection for RAG orchestrator
async def get_rag_orchestrator() -> RAGPipelineOrchestrator:
    """Get RAG orchestrator instance."""
    # In production, this would be properly injected via DI container
    # For now, we'll create a mock/placeholder
    try:
        from app.services.rag_orchestrator import RAGPipelineOrchestrator
        from app.services.query_understanding_service import QueryUnderstandingService
        from app.services.context_retrieval_service import ContextRetrievalService
        from app.services.context_assembly_service import ContextAssemblyService
        from app.services.citation_service import CitationService

        # Initialize services (in production, these would be singletons)
        query_service = QueryUnderstandingService()
        retrieval_service = ContextRetrievalService()
        assembly_service = ContextAssemblyService()
        citation_service = CitationService()

        orchestrator = RAGPipelineOrchestrator(
            query_understanding_service=query_service,
            context_retrieval_service=retrieval_service,
            context_assembly_service=assembly_service,
            citation_service=citation_service,
        )

        return orchestrator
    except Exception as e:
        logger.error(f"Failed to initialize RAG orchestrator: {e}")
        raise HTTPException(status_code=503, detail="RAG service unavailable")


# Main RAG endpoints
@router.post("/query", response_model=RAGQueryResponse, summary="Execute RAG query")
async def execute_rag_query(
    request: RAGQueryRequest,
    orchestrator: RAGPipelineOrchestrator = Depends(get_rag_orchestrator),
) -> RAGQueryResponse:
    """
    Execute a complete RAG pipeline for the given query.

    This endpoint processes the query through the full RAG pipeline:
    1. Query understanding and analysis
    2. Context retrieval from document embeddings
    3. Context assembly and compression
    4. Citation processing
    5. Quality assessment

    Args:
        request: RAG query request with configuration options
        orchestrator: RAG pipeline orchestrator service

    Returns:
        Complete RAG response with answer, context, and metadata
    """
    try:
        # Convert request to pipeline request
        pipeline_config = PipelineConfig(
            enable_query_understanding=True,
            enable_citation_processing=True,
            enable_quality_assessment=True,
            enable_streaming=False,
            enable_caching=True,
            enable_monitoring=True,
            **(request.config or {}),
        )

        # Convert citation style strings to enum
        citation_styles = []
        for style_str in request.citation_styles:
            try:
                citation_styles.append(CitationStyle(style_str))
            except ValueError:
                citation_styles.append(CitationStyle.APA)

        pipeline_request = PipelineRequest(
            query=request.query,
            config=pipeline_config,
            user_id=request.user_id,
            tenant_id=request.tenant_id,
            session_id=request.session_id,
            conversation_id=request.conversation_id,
            context_window_type=request.context_window_type,
            retrieval_strategy=request.retrieval_strategy,
            assembly_strategy=request.assembly_strategy,
            citation_styles=citation_styles,
            metadata=request.metadata,
        )

        # Execute pipeline
        start_time = time.time()
        pipeline_result = await orchestrator.execute_pipeline(pipeline_request)
        execution_time = (time.time() - start_time) * 1000

        # Build response
        response = RAGQueryResponse(
            pipeline_id=pipeline_result.pipeline_id,
            status=pipeline_result.status.value,
            query=request.query,
            answer=pipeline_result.assembly_result.assembled_context
            if pipeline_result.assembly_result
            else None,
            context=pipeline_result.assembly_result.assembled_context
            if pipeline_result.assembly_result
            else None,
            sources=[
                {
                    "id": citation.id,
                    "text": citation.text,
                    "source": citation.metadata.source,
                    "page": citation.metadata.page,
                    "confidence": citation.metadata.confidence,
                    "style": citation.style.value,
                }
                for citation in pipeline_result.citations
            ],
            confidence_score=pipeline_result.quality_assessment.overall_score
            if pipeline_result.quality_assessment
            else None,
            quality_score=pipeline_result.quality_assessment.overall_score
            if pipeline_result.quality_assessment
            else None,
            execution_time_ms=execution_time,
            metadata={
                "pipeline_steps": len(pipeline_result.steps),
                "chunks_retrieved": len(
                    pipeline_result.retrieval_result.selected_chunks
                )
                if pipeline_result.retrieval_result
                else 0,
                "citations_generated": len(pipeline_result.citations),
                "assembly_strategy": pipeline_result.assembly_result.assembly_strategy.value
                if pipeline_result.assembly_result
                else None,
                "retrieval_strategy": pipeline_result.retrieval_result.retrieval_strategy.value
                if pipeline_result.retrieval_result
                else None,
                **pipeline_result.metadata,
            },
            timestamp=datetime.utcnow(),
        )

        return response

    except ValidationException as e:
        raise HTTPException(status_code=422, detail=str(e))
    except RAGServiceException as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.error(f"RAG query execution failed: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/query/stream", summary="Execute RAG query with streaming")
async def execute_rag_query_streaming(
    request: RAGQueryRequest,
    orchestrator: RAGPipelineOrchestrator = Depends(get_rag_orchestrator),
) -> StreamingResponse:
    """
    Execute RAG pipeline with real-time streaming updates.

    This endpoint provides streaming responses during pipeline execution,
    allowing clients to show progress and intermediate results.

    Args:
        request: RAG query request with configuration options
        orchestrator: RAG pipeline orchestrator service

    Returns:
        Streaming response with real-time updates
    """

    async def generate_stream() -> AsyncGenerator[str, None]:
        try:
            # Convert request to pipeline request
            pipeline_config = PipelineConfig(
                enable_query_understanding=True,
                enable_citation_processing=True,
                enable_quality_assessment=True,
                enable_streaming=True,
                streaming_mode=StreamingMode.INTERMEDIATE,
                enable_caching=True,
                enable_monitoring=True,
                **(request.config or {}),
            )

            # Convert citation style strings to enum
            citation_styles = []
            for style_str in request.citation_styles:
                try:
                    citation_styles.append(CitationStyle(style_str))
                except ValueError:
                    citation_styles.append(CitationStyle.APA)

            pipeline_request = PipelineRequest(
                query=request.query,
                config=pipeline_config,
                user_id=request.user_id,
                tenant_id=request.tenant_id,
                session_id=request.session_id,
                conversation_id=request.conversation_id,
                context_window_type=request.context_window_type,
                retrieval_strategy=request.retrieval_strategy,
                assembly_strategy=request.assembly_strategy,
                citation_styles=citation_styles,
                metadata=request.metadata,
            )

            # Execute streaming pipeline
            async for event in orchestrator.execute_pipeline_streaming(
                pipeline_request
            ):
                # Convert event to streaming response
                streaming_response = RAGStreamingResponse(
                    event_type=event.event_type,
                    pipeline_id=event.pipeline_id,
                    timestamp=event.timestamp,
                    data=event.data,
                    error=event.error,
                    progress=_calculate_progress(event.event_type),
                )

                # Send JSON response
                yield f"data: {streaming_response.json()}\n\n"

                # Handle final events
                if event.event_type in ["pipeline_completed", "pipeline_failed"]:
                    yield f"event: {event.event_type}\n\n"
                    yield f"data: {json.dumps({'status': 'completed'})}\n\n"
                    break

        except Exception as e:
            logger.error(f"Streaming RAG execution failed: {e}")
            error_response = RAGStreamingResponse(
                event_type="error",
                pipeline_id="",
                timestamp=datetime.utcnow(),
                error=str(e),
            )
            yield f"data: {error_response.json()}\n\n"
            yield f"event: error\n\n"

    return StreamingResponse(
        generate_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
        },
    )


def _calculate_progress(event_type: str) -> float:
    """Calculate progress percentage based on event type."""
    progress_map = {
        "initiated": 0.0,
        "step_started": 0.1,
        "query_understanding": 0.2,
        "context_retrieval": 0.5,
        "context_assembly": 0.8,
        "citation_processing": 0.9,
        "quality_assessment": 0.95,
        "pipeline_completed": 1.0,
        "pipeline_failed": 1.0,
        "step_completed": 0.1,
        "step_failed": 1.0,
    }
    return progress_map.get(event_type, 0.0)


@router.get(
    "/status/{pipeline_id}",
    response_model=PipelineStatusResponse,
    summary="Get pipeline status",
)
async def get_pipeline_status(
    pipeline_id: str = Path(..., description="Pipeline execution ID"),
    orchestrator: RAGPipelineOrchestrator = Depends(get_rag_orchestrator),
) -> PipelineStatusResponse:
    """
    Get the current status of a running RAG pipeline.

    Args:
        pipeline_id: Unique pipeline execution identifier
        orchestrator: RAG pipeline orchestrator service

    Returns:
        Current pipeline status and progress information
    """
    try:
        pipeline_result = orchestrator.get_pipeline_status(pipeline_id)

        if not pipeline_result:
            raise HTTPException(status_code=404, detail="Pipeline not found")

        # Calculate progress and estimated time
        progress = _calculate_pipeline_progress(pipeline_result)
        current_step = _get_current_step(pipeline_result)
        estimated_remaining = _estimate_remaining_time(pipeline_result)

        return PipelineStatusResponse(
            pipeline_id=pipeline_result.pipeline_id,
            status=pipeline_result.status.value,
            progress=progress,
            current_step=current_step,
            execution_time_ms=pipeline_result.total_duration_ms,
            estimated_remaining_ms=estimated_remaining,
            error=pipeline_result.error,
            metadata={
                "steps_completed": len(
                    [
                        s
                        for s in pipeline_result.steps
                        if s.status == PipelineStatus.COMPLETED
                    ]
                ),
                "total_steps": len(pipeline_result.steps),
                "current_step_index": _get_current_step_index(pipeline_result),
            },
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get pipeline status: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.delete("/cancel/{pipeline_id}", summary="Cancel running pipeline")
async def cancel_pipeline(
    pipeline_id: str = Path(..., description="Pipeline execution ID"),
    orchestrator: RAGPipelineOrchestrator = Depends(get_rag_orchestrator),
) -> Dict[str, Any]:
    """
    Cancel a running RAG pipeline.

    Args:
        pipeline_id: Unique pipeline execution identifier
        orchestrator: RAG pipeline orchestrator service

    Returns:
        Cancellation confirmation
    """
    try:
        success = orchestrator.cancel_pipeline(pipeline_id)

        if not success:
            raise HTTPException(
                status_code=404, detail="Pipeline not found or already completed"
            )

        return {
            "pipeline_id": pipeline_id,
            "status": "cancelled",
            "message": "Pipeline successfully cancelled",
            "timestamp": datetime.utcnow().isoformat(),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to cancel pipeline: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/batch", summary="Execute batch RAG queries")
async def execute_batch_rag_queries(
    request: BatchRAGRequest,
    background_tasks: BackgroundTasks,
    orchestrator: RAGPipelineOrchestrator = Depends(get_rag_orchestrator),
) -> Dict[str, Any]:
    """
    Execute multiple RAG queries in batch.

    This endpoint processes multiple queries efficiently, either in parallel
    or sequentially based on configuration.

    Args:
        request: Batch RAG query request
        background_tasks: FastAPI background tasks
        orchestrator: RAG pipeline orchestrator service

    Returns:
        Batch job information and results
    """
    try:
        batch_id = str(uuid.uuid4())

        # Process batch
        if request.parallel_processing:
            # Process queries in parallel
            results = await _process_parallel_queries(request, orchestrator)
        else:
            # Process queries sequentially
            results = await _process_sequential_queries(request, orchestrator)

        # Calculate batch statistics
        successful_queries = [r for r in results if r.get("status") == "completed"]
        failed_queries = [r for r in results if r.get("status") == "failed"]

        return {
            "batch_id": batch_id,
            "total_queries": len(request.queries),
            "successful_queries": len(successful_queries),
            "failed_queries": len(failed_queries),
            "success_rate": len(successful_queries) / len(request.queries) * 100,
            "total_execution_time_ms": sum(
                r.get("execution_time_ms", 0) for r in results
            ),
            "average_execution_time_ms": sum(
                r.get("execution_time_ms", 0) for r in results
            )
            / len(results),
            "results": results,
            "metadata": {
                "parallel_processing": request.parallel_processing,
                "max_concurrent": request.max_concurrent,
                "timestamp": datetime.utcnow().isoformat(),
            },
        }

    except Exception as e:
        logger.error(f"Batch RAG execution failed: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get(
    "/metrics", response_model=PipelineMetricsResponse, summary="Get pipeline metrics"
)
async def get_pipeline_metrics(
    orchestrator: RAGPipelineOrchestrator = Depends(get_rag_orchestrator),
) -> PipelineMetricsResponse:
    """
    Get comprehensive RAG pipeline performance metrics.

    Args:
        orchestrator: RAG pipeline orchestrator service

    Returns:
        Detailed performance metrics and statistics
    """
    try:
        metrics = orchestrator.get_pipeline_metrics()

        return PipelineMetricsResponse(
            total_pipelines=metrics.get("total_pipelines", 0),
            active_pipelines=metrics.get("active_pipelines", 0),
            completed_pipelines=metrics.get("completed_pipelines", 0),
            failed_pipelines=metrics.get("failed_pipelines", 0),
            success_rate=metrics.get("success_rate", 0) * 100,
            avg_execution_time_ms=metrics.get("avg_duration_ms", 0),
            avg_quality_score=metrics.get("avg_quality", 0),
            error_rates=metrics.get("error_rates", {}),
            performance_metrics=metrics,
        )

    except Exception as e:
        logger.error(f"Failed to get pipeline metrics: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


# Helper functions
async def _process_parallel_queries(
    request: BatchRAGRequest, orchestrator: RAGPipelineOrchestrator
) -> List[Dict[str, Any]]:
    """Process multiple queries in parallel."""
    semaphore = asyncio.Semaphore(request.max_concurrent)

    async def process_single_query(query: str) -> Dict[str, Any]:
        async with semaphore:
            try:
                # Create pipeline request
                pipeline_request = PipelineRequest(
                    query=query,
                    user_id=request.user_id,
                    tenant_id=request.tenant_id,
                    session_id=request.session_id,
                )

                # Execute pipeline
                start_time = time.time()
                result = await orchestrator.execute_pipeline(pipeline_request)
                execution_time = (time.time() - start_time) * 1000

                return {
                    "query": query,
                    "pipeline_id": result.pipeline_id,
                    "status": result.status.value,
                    "answer": result.assembly_result.assembled_context
                    if result.assembly_result
                    else None,
                    "confidence_score": result.quality_assessment.overall_score
                    if result.quality_assessment
                    else None,
                    "execution_time_ms": execution_time,
                    "error": result.error,
                }
            except Exception as e:
                return {
                    "query": query,
                    "status": "failed",
                    "error": str(e),
                    "execution_time_ms": 0,
                }

    # Execute all queries concurrently
    tasks = [process_single_query(query) for query in request.queries]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    # Handle exceptions
    processed_results = []
    for i, result in enumerate(results):
        if isinstance(result, Exception):
            processed_results.append(
                {
                    "query": request.queries[i],
                    "status": "failed",
                    "error": str(result),
                    "execution_time_ms": 0,
                }
            )
        else:
            processed_results.append(result)

    return processed_results


async def _process_sequential_queries(
    request: BatchRAGRequest, orchestrator: RAGPipelineOrchestrator
) -> List[Dict[str, Any]]:
    """Process multiple queries sequentially."""
    results = []

    for query in request.queries:
        try:
            # Create pipeline request
            pipeline_request = PipelineRequest(
                query=query,
                user_id=request.user_id,
                tenant_id=request.tenant_id,
                session_id=request.session_id,
            )

            # Execute pipeline
            start_time = time.time()
            result = await orchestrator.execute_pipeline(pipeline_request)
            execution_time = (time.time() - start_time) * 1000

            results.append(
                {
                    "query": query,
                    "pipeline_id": result.pipeline_id,
                    "status": result.status.value,
                    "answer": result.assembly_result.assembled_context
                    if result.assembly_result
                    else None,
                    "confidence_score": result.quality_assessment.overall_score
                    if result.quality_assessment
                    else None,
                    "execution_time_ms": execution_time,
                    "error": result.error,
                }
            )

        except Exception as e:
            results.append(
                {
                    "query": query,
                    "status": "failed",
                    "error": str(e),
                    "execution_time_ms": 0,
                }
            )

    return results


def _calculate_pipeline_progress(pipeline_result) -> float:
    """Calculate pipeline progress based on completed steps."""
    if not pipeline_result.steps:
        return 0.0

    completed_steps = len(
        [s for s in pipeline_result.steps if s.status == PipelineStatus.COMPLETED]
    )
    total_steps = len(pipeline_result.steps)

    if total_steps == 0:
        return 0.0

    return completed_steps / total_steps


def _get_current_step(pipeline_result) -> Optional[str]:
    """Get the current step name."""
    for step in reversed(pipeline_result.steps):
        if step.status == PipelineStatus.COMPLETED:
            continue
        return step.step_name
    return None


def _get_current_step_index(pipeline_result) -> int:
    """Get the current step index."""
    for i, step in enumerate(pipeline_result.steps):
        if step.status != PipelineStatus.COMPLETED:
            return i
    return len(pipeline_result.steps)


def _estimate_remaining_time(pipeline_result) -> Optional[float]:
    """Estimate remaining time based on current progress."""
    if not pipeline_result.steps or not pipeline_result.total_duration_ms:
        return None

    progress = _calculate_pipeline_progress(pipeline_result)
    if progress <= 0:
        return None

    elapsed_time = pipeline_result.total_duration_ms
    estimated_total = elapsed_time / progress
    remaining = estimated_total - elapsed_time

    return max(0, remaining)
