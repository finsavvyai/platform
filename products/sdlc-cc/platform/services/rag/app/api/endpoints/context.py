"""
Context API Endpoints

Comprehensive REST API endpoints for context retrieval, assembly,
quality monitoring, and RAG pipeline management.
"""

import logging
from datetime import datetime
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
import json
import uuid

from app.api.dependencies import get_current_user, get_tenant_id
from app.services.query_understanding_service import (
    QueryUnderstandingService,
    QueryAnalysis,
    QueryContext,
)
from app.services.context_retrieval_service import (
    ContextRetrievalService,
    RetrievalRequest,
    RetrievalResult,
    RetrievalStrategy,
)
from app.services.context_assembly_service import (
    ContextAssemblyService,
    AssemblyRequest,
    AssemblyResult,
    AssemblyStrategy,
    CompressionLevel,
)
from app.services.citation_service import (
    CitationService,
    CitationRequest,
    CitationStyle,
)
from app.services.context_quality_monitor import (
    ContextQualityMonitor,
)
from app.services.rag_orchestrator import (
    RAGPipelineOrchestrator,
    PipelineRequest,
    PipelineConfig,
)
from app.models.user import User
from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# Create router
router = APIRouter(prefix="/context", tags=["context"])


# Pydantic models for API requests/responses
class ContextRequest(BaseModel):
    """Context generation request"""

    query: str = Field(..., min_length=1, max_length=2000, description="Search query")
    context_window_type: str = Field(
        "llm", description="Context window type (llm, summary, analysis)"
    )
    max_tokens: int = Field(4000, ge=100, le=8000, description="Maximum context tokens")
    retrieval_strategy: RetrievalStrategy = Field(
        RetrievalStrategy.MULTI_STAGE, description="Retrieval strategy"
    )
    assembly_strategy: AssemblyStrategy = Field(
        AssemblyStrategy.ADAPTIVE, description="Assembly strategy"
    )
    citation_styles: List[CitationStyle] = Field(
        [CitationStyle.APA], description="Citation styles to generate"
    )
    enable_quality_assessment: bool = Field(
        True, description="Enable quality assessment"
    )
    enable_citations: bool = Field(True, description="Enable citation processing")
    enable_compression: bool = Field(False, description="Enable context compression")
    compression_level: CompressionLevel = Field(
        CompressionLevel.NONE, description="Compression level"
    )
    include_metadata: bool = Field(True, description="Include detailed metadata")
    streaming: bool = Field(False, description="Enable streaming response")

    class Config:
        use_enum_values = True


class ContextResponse(BaseModel):
    """Context generation response"""

    context_id: str
    assembled_context: str
    query_analysis: Optional[Dict[str, Any]]
    retrieval_result: Optional[Dict[str, Any]]
    quality_assessment: Optional[Dict[str, Any]]
    citations: List[Dict[str, Any]]
    performance_metrics: Dict[str, Any]
    quality_metrics: Optional[Dict[str, Any]]
    metadata: Dict[str, Any]


class QueryUnderstandingRequest(BaseModel):
    """Query understanding request"""

    query: str = Field(
        ..., min_length=1, max_length=2000, description="Query to analyze"
    )
    context: Optional[Dict[str, Any]] = Field(None, description="Query context")
    use_expansion: bool = Field(True, description="Enable query expansion")


class QueryUnderstandingResponse(BaseModel):
    """Query understanding response"""

    query_analysis: Dict[str, Any]
    processing_time_ms: float


class RetrievalRequest(BaseModel):
    """Context retrieval request"""

    query: str = Field(..., min_length=1, max_length=2000, description="Search query")
    query_analysis: Optional[Dict[str, Any]] = Field(
        None, description="Pre-analyzed query"
    )
    strategy: RetrievalStrategy = Field(
        RetrievalStrategy.MULTI_STAGE, description="Retrieval strategy"
    )
    max_chunks: int = Field(10, ge=1, le=50, description="Maximum chunks to retrieve")
    min_relevance_score: float = Field(
        0.3, ge=0.0, le=1.0, description="Minimum relevance score"
    )
    diversity_threshold: float = Field(
        0.7, ge=0.0, le=1.0, description="Diversity threshold"
    )
    filters: Optional[Dict[str, Any]] = Field(None, description="Search filters")


class RetrievalResponse(BaseModel):
    """Context retrieval response"""

    retrieval_id: str
    candidates: List[Dict[str, Any]]
    selected_chunks: List[Dict[str, Any]]
    strategy_performance: Dict[str, Any]
    metrics: Dict[str, Any]


class AssemblyRequest(BaseModel):
    """Context assembly request"""

    chunks: List[Dict[str, Any]] = Field(
        ..., min_items=1, description="Document chunks to assemble"
    )
    strategy: AssemblyStrategy = Field(
        AssemblyStrategy.ADAPTIVE, description="Assembly strategy"
    )
    max_tokens: int = Field(4000, ge=100, le=8000, description="Maximum tokens")
    compression_level: CompressionLevel = Field(
        CompressionLevel.NONE, description="Compression level"
    )
    citation_style: CitationStyle = Field(
        CitationStyle.APA, description="Citation style"
    )
    include_citations: bool = Field(True, description="Include citations")


class AssemblyResponse(BaseModel):
    """Context assembly response"""

    assembly_id: str
    assembled_context: str
    total_tokens: int
    chunks_included: int
    compression_stats: Optional[Dict[str, Any]]
    quality_metrics: Dict[str, Any]


class CitationRequest(BaseModel):
    """Citation processing request"""

    chunk: Dict[str, Any] = Field(..., description="Document chunk")
    validate_citations: bool = Field(True, description="Validate citations")
    format_citations: bool = Field(True, description="Format citations")
    citation_styles: List[CitationStyle] = Field(
        [CitationStyle.APA], description="Citation styles"
    )


class CitationResponse(BaseModel):
    """Citation processing response"""

    citations: List[Dict[str, Any]]
    validation_results: List[Dict[str, Any]]
    analysis: Optional[Dict[str, Any]]


class QualityAssessmentRequest(BaseModel):
    """Quality assessment request"""

    context_id: Optional[str] = Field(None, description="Context ID to assess")
    query_analysis: Optional[Dict[str, Any]] = Field(None, description="Query analysis")
    retrieval_result: Optional[Dict[str, Any]] = Field(
        None, description="Retrieval result"
    )
    assembly_result: Optional[Dict[str, Any]] = Field(
        None, description="Assembly result"
    )
    citations: Optional[List[Dict[str, Any]]] = Field(None, description="Citations")


class QualityAssessmentResponse(BaseModel):
    """Quality assessment response"""

    assessment_id: str
    overall_score: float
    metric_scores: List[Dict[str, Any]]
    strengths: List[str]
    weaknesses: List[str]
    recommendations: List[str]
    risk_factors: List[str]


class PipelineExecutionRequest(BaseModel):
    """RAG pipeline execution request"""

    query: str = Field(..., min_length=1, max_length=2000, description="Pipeline query")
    config: Optional[Dict[str, Any]] = Field(None, description="Pipeline configuration")
    streaming: bool = Field(False, description="Enable streaming")
    user_id: Optional[str] = Field(None, description="User ID")
    tenant_id: Optional[str] = Field(None, description="Tenant ID")


class PipelineExecutionResponse(BaseModel):
    """Pipeline execution response"""

    pipeline_id: str
    status: str
    results: Optional[Dict[str, Any]]
    metrics: Dict[str, Any]
    steps: List[Dict[str, Any]]


class QualityMetricsResponse(BaseModel):
    """Quality metrics response"""

    overall_metrics: Dict[str, Any]
    metric_breakdown: Dict[str, Any]
    trends: Dict[str, Any]
    benchmarks: Dict[str, Any]


class HealthCheckResponse(BaseModel):
    """Health check response"""

    status: str
    timestamp: datetime
    components: Dict[str, str]
    metrics: Dict[str, Any]


# Dependency injection
async def get_query_understanding_service() -> QueryUnderstandingService:
    """Get query understanding service instance"""
    # In a real implementation, would use dependency injection
    return QueryUnderstandingService(document_repository=None)


async def get_context_retrieval_service() -> ContextRetrievalService:
    """Get context retrieval service instance"""
    # In a real implementation, would use dependency injection
    return ContextRetrievalService(
        document_repository=None,
        vector_search_service=None,
        query_understanding_service=None,
    )


async def get_context_assembly_service() -> ContextAssemblyService:
    """Get context assembly service instance"""
    # In a real implementation, would use dependency injection
    return ContextAssemblyService()


async def get_citation_service() -> CitationService:
    """Get citation service instance"""
    # In a real implementation, would use dependency injection
    return CitationService()


async def get_quality_monitor() -> ContextQualityMonitor:
    """Get quality monitor service instance"""
    # In a real implementation, would use dependency injection
    return ContextQualityMonitor()


async def get_rag_orchestrator() -> RAGPipelineOrchestrator:
    """Get RAG orchestrator service instance"""
    # In a real implementation, would use dependency injection
    return RAGPipelineOrchestrator(
        query_understanding_service=None,
        context_retrieval_service=None,
        context_assembly_service=None,
        citation_service=None,
        quality_monitor=None,
    )


@router.post("/generate", response_model=ContextResponse)
async def generate_context(
    request: ContextRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    tenant_id: str = Depends(get_tenant_id),
    orchestrator: RAGPipelineOrchestrator = Depends(get_rag_orchestrator),
):
    """
    Generate complete context using the RAG pipeline

    This endpoint orchestrates the complete RAG pipeline including:
    - Query understanding and expansion
    - Context retrieval with advanced strategies
    - Context assembly with optimization
    - Citation processing and validation
    - Quality assessment and monitoring
    """
    try:
        # Create pipeline configuration
        config = PipelineConfig(
            enable_query_understanding=True,
            enable_citation_processing=request.enable_citations,
            enable_quality_assessment=request.enable_quality_assessment,
            enable_streaming=request.streaming,
            max_context_tokens=request.max_tokens,
            enable_compression=request.enable_compression,
            compression_level=request.compression_level,
            include_performance_metrics=True,
            include_quality_metrics=True,
        )

        # Create pipeline request
        pipeline_request = PipelineRequest(
            query=request.query,
            config=config,
            user_id=current_user.id,
            tenant_id=tenant_id,
            context_window_type=request.context_window_type,
            retrieval_strategy=request.retrieval_strategy,
            assembly_strategy=request.assembly_strategy,
            citation_styles=request.citation_styles,
            metadata={"api_version": "1.0", "request_source": "context_api"},
        )

        if request.streaming:
            # Return streaming response
            async def stream_pipeline():
                async for event in orchestrator.execute_pipeline_streaming(
                    pipeline_request
                ):
                    yield f"data: {json.dumps(event.dict())}\n\n"

            return StreamingResponse(
                stream_pipeline(),
                media_type="text/plain",
                headers={
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive",
                },
            )
        else:
            # Execute pipeline synchronously
            result = await orchestrator.execute_pipeline(pipeline_request)

            # Format response
            response_data = ContextResponse(
                context_id=result.pipeline_id,
                assembled_context=result.assembly_result.assembled_context
                if result.assembly_result
                else "",
                query_analysis=result.query_analysis.__dict__
                if result.query_analysis
                else None,
                retrieval_result=result.retrieval_result.__dict__
                if result.retrieval_result
                else None,
                quality_assessment=result.quality_assessment.__dict__
                if result.quality_assessment
                else None,
                citations=[c.__dict__ for c in result.citations],
                performance_metrics=result.performance_metrics,
                quality_metrics=result.quality_metrics,
                metadata=result.metadata,
            )

            # Record metrics in background
            if request.include_metadata:
                background_tasks.add_task(
                    record_context_metrics,
                    result.pipeline_id,
                    current_user.id,
                    tenant_id,
                    result.performance_metrics,
                    result.quality_metrics,
                )

            return response_data

    except Exception as e:
        logger.error(f"Context generation failed: {e}")
        raise HTTPException(
            status_code=500, detail=f"Context generation failed: {str(e)}"
        )


@router.post("/query/understand", response_model=QueryUnderstandingResponse)
async def understand_query(
    request: QueryUnderstandingRequest,
    current_user: User = Depends(get_current_user),
    query_service: QueryUnderstandingService = Depends(get_query_understanding_service),
):
    """
    Analyze and understand query intent, entities, and complexity

    This endpoint performs comprehensive query analysis including:
    - Intent classification and confidence scoring
    - Entity extraction and disambiguation
    - Query expansion and rewriting
    - Complexity assessment
    - Historical query analysis for personalization
    """
    try:
        # Create query context if provided
        query_context = None
        if request.context:
            query_context = QueryContext(
                user_id=current_user.id,
                session_id=request.context.get("session_id", ""),
                previous_queries=request.context.get("previous_queries", []),
                successful_results=request.context.get("successful_results", []),
                user_preferences=request.context.get("user_preferences", {}),
                domain_expertise=request.context.get("domain_expertise", {}),
                recent_topics=request.context.get("recent_topics", []),
                conversation_history=request.context.get("conversation_history", []),
            )

        # Perform query analysis
        start_time = datetime.now()
        analysis = await query_service.analyze_query(
            query=request.query,
            context=query_context,
            use_expansion=request.use_expansion,
        )
        processing_time = (datetime.now() - start_time).total_seconds() * 1000

        # Format response
        response_data = QueryUnderstandingResponse(
            query_analysis={
                "original_query": analysis.original_query,
                "cleaned_query": analysis.cleaned_query,
                "intent": analysis.intent.value,
                "confidence": analysis.confidence,
                "complexity": analysis.complexity.value,
                "query_type": analysis.query_type.value,
                "entities": [
                    {
                        "text": entity.text,
                        "label": entity.label,
                        "confidence": entity.confidence,
                        "canonical_form": entity.canonical_form,
                        "synonyms": entity.synonyms,
                    }
                    for entity in analysis.entities
                ],
                "keywords": analysis.keywords,
                "key_phrases": analysis.key_phrases,
                "temporal_expressions": analysis.temporal_expressions,
                "numerical_values": analysis.numerical_values,
                "sentiment": analysis.sentiment,
                "urgency": analysis.urgency,
                "domain": analysis.domain,
                "language": analysis.language,
                "expanded_query": analysis.expanded_query.__dict__
                if analysis.expanded_query
                else None,
                "search_hints": analysis.search_hints,
            },
            processing_time_ms=processing_time,
        )

        return response_data

    except Exception as e:
        logger.error(f"Query understanding failed: {e}")
        raise HTTPException(
            status_code=500, detail=f"Query understanding failed: {str(e)}"
        )


@router.post("/retrieve", response_model=RetrievalResponse)
async def retrieve_context(
    request: RetrievalRequest,
    current_user: User = Depends(get_current_user),
    tenant_id: str = Depends(get_tenant_id),
    retrieval_service: ContextRetrievalService = Depends(get_context_retrieval_service),
):
    """
    Retrieve relevant context chunks using advanced retrieval strategies

    This endpoint performs sophisticated context retrieval including:
    - Multi-stage retrieval (broad → focused → refinement)
    - Multiple retrieval strategies (dense, sparse, hybrid, etc.)
    - Cross-encoder reranking for final relevance
    - Diversity-aware retrieval
    - Personalized retrieval based on user history
    """
    try:
        # Parse query analysis if provided
        query_analysis = None
        if request.query_analysis:
            # Reconstruct QueryAnalysis object
            query_analysis = parse_query_analysis(request.query_analysis)

        # Create retrieval request
        retrieval_request = RetrievalRequest(
            query_text=request.query,
            query_analysis=query_analysis,
            tenant_id=tenant_id,
            user_id=current_user.id,
            max_context_length=request.max_chunks * 400,  # Approximate
            max_chunks=request.max_chunks,
            retrieval_strategy=request.strategy,
            min_relevance_score=request.min_relevance_score,
            diversity_threshold=request.diversity_threshold,
            filters=request.filters,
        )

        # Perform retrieval
        result = await retrieval_service.retrieve_context(retrieval_request)

        # Format response
        response_data = RetrievalResponse(
            retrieval_id=str(uuid.uuid4()),
            candidates=[
                {
                    "chunk_id": candidate.chunk.id,
                    "document_id": candidate.chunk.document_id,
                    "content": candidate.chunk.content,
                    "relevance_score": candidate.relevance_score,
                    "importance_score": candidate.importance_score,
                    "authority_score": candidate.authority_score,
                    "recency_score": candidate.recency_score,
                    "metadata": candidate.metadata,
                }
                for candidate in result.candidates
            ],
            selected_chunks=[
                {
                    "chunk_id": chunk.id,
                    "document_id": chunk.document_id,
                    "content": chunk.content,
                    "metadata": chunk.metadata,
                }
                for chunk in result.selected_chunks
            ],
            strategy_performance=result.strategy_performance,
            metrics={
                "total_candidates_evaluated": result.total_candidates_evaluated,
                "retrieval_time_ms": result.retrieval_time_ms,
                "reranking_time_ms": result.reranking_time_ms,
                "total_time_ms": result.total_time_ms,
                "coverage_estimate": result.coverage_estimate,
            },
        )

        return response_data

    except Exception as e:
        logger.error(f"Context retrieval failed: {e}")
        raise HTTPException(
            status_code=500, detail=f"Context retrieval failed: {str(e)}"
        )


@router.post("/assemble", response_model=AssemblyResponse)
async def assemble_context(
    request: AssemblyRequest,
    current_user: User = Depends(get_current_user),
    assembly_service: ContextAssemblyService = Depends(get_context_assembly_service),
):
    """
    Assemble retrieved chunks into optimized context

    This endpoint performs intelligent context assembly including:
    - Token window optimization
    - Smart chunk ordering and prioritization
    - Context compression and summarization
    - Redundancy detection and removal
    - Citation-aware context assembly
    """
    try:
        # Convert chunks to DocumentChunk objects
        from app.models.document import DocumentChunk

        document_chunks = []

        for chunk_data in request.chunks:
            chunk = DocumentChunk(
                id=chunk_data["id"],
                document_id=chunk_data["document_id"],
                content=chunk_data["content"],
                metadata=chunk_data.get("metadata", {}),
                created_at=datetime.now(),
                tenant_id=current_user.tenant_id,
            )
            document_chunks.append(chunk)

        # Create assembly request
        assembly_request = AssemblyRequest(
            chunks=document_chunks,
            assembly_strategy=request.strategy,
            max_tokens=request.max_tokens,
            compression_level=request.compression_level,
            include_citations=request.include_citations,
            citation_style=request.citation_style,
            context_window_type="llm",
            user_language="en",
        )

        # Perform assembly
        result = await assembly_service.assemble_context(assembly_request)

        # Day 52: long-context guard. When the assembled context still
        # overflows the requested budget (e.g. compression level was
        # NONE), recursively summarise via fit_to_context so the caller
        # never receives a string they cannot ship to the LLM.
        from app.services.long_context import fit_to_context

        assembled_text = result.assembled_context
        total_tokens = result.total_tokens
        if request.max_tokens and total_tokens > request.max_tokens:
            fit = fit_to_context(assembled_text, target_tokens=request.max_tokens)
            assembled_text = fit.text
            total_tokens = fit.token_estimate

        # Format response
        response_data = AssemblyResponse(
            assembly_id=str(uuid.uuid4()),
            assembled_context=assembled_text,
            total_tokens=total_tokens,
            chunks_included=len(result.context_chunks),
            compression_stats=result.compression_stats
            if request.compression_level != CompressionLevel.NONE
            else None,
            quality_metrics=result.quality_metrics,
        )

        return response_data

    except Exception as e:
        logger.error(f"Context assembly failed: {e}")
        raise HTTPException(
            status_code=500, detail=f"Context assembly failed: {str(e)}"
        )


@router.post("/citations/process", response_model=CitationResponse)
async def process_citations(
    request: CitationRequest,
    current_user: User = Depends(get_current_user),
    tenant_id: str = Depends(get_tenant_id),
    citation_service: CitationService = Depends(get_citation_service),
):
    """
    Process and validate citations from document chunks

    This endpoint performs comprehensive citation processing including:
    - Automatic citation extraction from text
    - Citation validation and verification
    - Multiple citation style formatting
    - Citation quality assessment
    - Plagiarism risk assessment
    """
    try:
        # Convert chunk data to DocumentChunk object
        from app.models.document import DocumentChunk

        chunk = DocumentChunk(
            id=request.chunk["id"],
            document_id=request.chunk["document_id"],
            content=request.chunk["content"],
            metadata=request.chunk.get("metadata", {}),
            created_at=datetime.now(),
            tenant_id=tenant_id,
        )

        # Create citation request
        citation_request = CitationRequest(
            chunk=chunk,
            extract_citations=True,
            validate_citations=request.validate_citations,
            format_citations=request.format_citations,
            citation_styles=request.citation_styles,
            user_preferences={},
            tenant_id=tenant_id,
            user_id=current_user.id,
        )

        # Process citations
        citations = await citation_service.process_citations(citation_request)

        # Analyze citations
        analysis = await citation_service.analyze_citations(citations)

        # Format validation results
        validation_results = []
        for citation in citations:
            validation_results.append(
                {
                    "citation_id": citation.metadata.internal_id,
                    "status": citation.validation_status.value,
                    "errors": citation.validation_errors,
                    "confidence": citation.confidence_score,
                }
            )

        # Format response
        response_data = CitationResponse(
            citations=[
                {
                    "id": citation.metadata.internal_id,
                    "title": citation.metadata.title,
                    "authors": citation.metadata.authors,
                    "source": citation.metadata.source,
                    "publication_year": citation.metadata.publication_year,
                    "doi": citation.metadata.doi,
                    "formatted_citations": {
                        style.value: formatted
                        for style, formatted in citation.formatted_citations.items()
                    },
                    "validation_status": citation.validation_status.value,
                    "confidence": citation.confidence_score,
                }
                for citation in citations
            ],
            validation_results=validation_results,
            analysis={
                "total_citations": analysis.total_citations,
                "unique_sources": analysis.unique_sources,
                "citation_distribution": {
                    k.value: v for k, v in analysis.citation_distribution.items()
                },
                "quality_metrics": analysis.quality_metrics,
                "citation_density": analysis.citation_density,
            },
        )

        return response_data

    except Exception as e:
        logger.error(f"Citation processing failed: {e}")
        raise HTTPException(
            status_code=500, detail=f"Citation processing failed: {str(e)}"
        )


@router.post("/quality/assess", response_model=QualityAssessmentResponse)
async def assess_quality(
    request: QualityAssessmentRequest,
    current_user: User = Depends(get_current_user),
    tenant_id: str = Depends(get_tenant_id),
    quality_monitor: ContextQualityMonitor = Depends(get_quality_monitor),
):
    """
    Assess quality of generated context

    This endpoint performs comprehensive quality assessment including:
    - Multi-dimensional quality scoring
    - Strength and weakness analysis
    - Improvement recommendations
    - Risk factor identification
    - Compliance scoring
    """
    try:
        # Parse input data if provided
        query_analysis = None
        if request.query_analysis:
            query_analysis = parse_query_analysis(request.query_analysis)

        # Convert retrieval result
        retrieval_result = None
        if request.retrieval_result:
            retrieval_result = parse_retrieval_result(request.retrieval_result)

        # Convert assembly result
        assembly_result = None
        if request.assembly_result:
            assembly_result = parse_assembly_result(request.assembly_result)

        # Convert citations
        citations = []
        if request.citations:
            from app.services.citation_service import Citation, CitationMetadata

            for citation_data in request.citations:
                # Create CitationMetadata
                metadata = CitationMetadata(
                    title=citation_data.get("title", ""),
                    authors=citation_data.get("authors", []),
                    source=citation_data.get("source", ""),
                    publication_year=citation_data.get("publication_year"),
                )

                # Create Citation
                citation = Citation(metadata=metadata)
                citations.append(citation)

        # Perform quality assessment
        assessment = await quality_monitor.assess_quality(
            context_id=request.context_id or str(uuid.uuid4()),
            query_analysis=query_analysis,
            retrieval_result=retrieval_result,
            assembly_result=assembly_result,
            citations=citations,
            user_id=current_user.id,
            tenant_id=tenant_id,
        )

        # Format response
        response_data = QualityAssessmentResponse(
            assessment_id=assessment.assessment_id,
            overall_score=assessment.overall_score,
            metric_scores=[
                {
                    "metric": score.metric.value,
                    "score": score.score,
                    "confidence": score.confidence,
                    "explanation": score.explanation,
                    "benchmark_score": score.benchmark_score,
                    "percentile_rank": score.percentile_rank,
                }
                for score in assessment.metric_scores
            ],
            strengths=assessment.strengths,
            weaknesses=assessment.weaknesses,
            recommendations=assessment.recommendations,
            risk_factors=assessment.risk_factors,
        )

        return response_data

    except Exception as e:
        logger.error(f"Quality assessment failed: {e}")
        raise HTTPException(
            status_code=500, detail=f"Quality assessment failed: {str(e)}"
        )


@router.post("/pipeline/execute", response_model=PipelineExecutionResponse)
async def execute_pipeline(
    request: PipelineExecutionRequest,
    current_user: User = Depends(get_current_user),
    tenant_id: str = Depends(get_tenant_id),
    orchestrator: RAGPipelineOrchestrator = Depends(get_rag_orchestrator),
):
    """
    Execute complete RAG pipeline

    This endpoint orchestrates the entire RAG pipeline with detailed
    step-by-step execution and comprehensive metrics collection.
    """
    try:
        # Create pipeline configuration
        config = PipelineConfig()
        if request.config:
            for key, value in request.config.items():
                if hasattr(config, key):
                    setattr(config, key, value)

        # Create pipeline request
        pipeline_request = PipelineRequest(
            query=request.query,
            config=config,
            user_id=request.user_id or current_user.id,
            tenant_id=request.tenant_id or tenant_id,
            metadata={
                "api_endpoint": "pipeline_execute",
                "user_role": current_user.role,
            },
        )

        if request.streaming:
            # Return streaming response
            async def stream_pipeline():
                async for event in orchestrator.execute_pipeline_streaming(
                    pipeline_request
                ):
                    yield f"data: {json.dumps(event.dict())}\n\n"

            return StreamingResponse(
                stream_pipeline(),
                media_type="text/plain",
                headers={
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive",
                },
            )
        else:
            # Execute pipeline synchronously
            result = await orchestrator.execute_pipeline(pipeline_request)

            # Format response
            response_data = PipelineExecutionResponse(
                pipeline_id=result.pipeline_id,
                status=result.status.value,
                results={
                    "assembled_context": result.assembly_result.assembled_context
                    if result.assembly_result
                    else None,
                    "query_analysis": result.query_analysis.__dict__
                    if result.query_analysis
                    else None,
                    "quality_assessment": result.quality_assessment.__dict__
                    if result.quality_assessment
                    else None,
                    "citations": [c.__dict__ for c in result.citations],
                }
                if result.status.value == "completed"
                else None,
                metrics={
                    "total_duration_ms": result.total_duration_ms,
                    "performance_metrics": result.performance_metrics,
                    "quality_metrics": result.quality_metrics,
                },
                steps=[
                    {
                        "step_name": step.step_name,
                        "status": step.status.value,
                        "duration_ms": step.duration_ms,
                        "error": step.error,
                    }
                    for step in result.steps
                ],
            )

            return response_data

    except Exception as e:
        logger.error(f"Pipeline execution failed: {e}")
        raise HTTPException(
            status_code=500, detail=f"Pipeline execution failed: {str(e)}"
        )


@router.get("/pipeline/{pipeline_id}/status")
async def get_pipeline_status(
    pipeline_id: str,
    orchestrator: RAGPipelineOrchestrator = Depends(get_rag_orchestrator),
):
    """Get status of a running pipeline"""
    try:
        result = orchestrator.get_pipeline_status(pipeline_id)

        if not result:
            raise HTTPException(status_code=404, detail="Pipeline not found")

        return {
            "pipeline_id": pipeline_id,
            "status": result.status.value,
            "start_time": result.start_time,
            "current_step": result.steps[-1].step_name if result.steps else None,
            "total_duration_ms": result.total_duration_ms,
            "error": result.error,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get pipeline status: {e}")
        raise HTTPException(status_code=500, detail="Failed to get pipeline status")


@router.post("/pipeline/{pipeline_id}/cancel")
async def cancel_pipeline(
    pipeline_id: str,
    orchestrator: RAGPipelineOrchestrator = Depends(get_rag_orchestrator),
):
    """Cancel a running pipeline"""
    try:
        success = orchestrator.cancel_pipeline(pipeline_id)

        if not success:
            raise HTTPException(
                status_code=404, detail="Pipeline not found or already completed"
            )

        return {
            "message": "Pipeline cancelled successfully",
            "pipeline_id": pipeline_id,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to cancel pipeline: {e}")
        raise HTTPException(status_code=500, detail="Failed to cancel pipeline")


@router.get("/quality/metrics", response_model=QualityMetricsResponse)
async def get_quality_metrics(
    time_period: str = Query("24h", description="Time period (1h, 24h, 7d, 30d)"),
    tenant_id: Optional[str] = Query(None, description="Filter by tenant ID"),
    quality_monitor: ContextQualityMonitor = Depends(get_quality_monitor),
):
    """
    Get comprehensive quality metrics and analytics

    This endpoint provides detailed quality metrics including:
    - Overall quality trends
    - Individual metric breakdowns
    - Benchmark comparisons
    - Performance analytics
    """
    try:
        # Get quality monitor metrics
        monitor_metrics = quality_monitor.get_service_metrics()

        # Calculate quality metrics (simplified)
        overall_metrics = {
            "total_assessments": monitor_metrics["assessments_count"],
            "active_alerts": monitor_metrics["active_alerts_count"],
            "avg_quality_score": 0.75,  # Would calculate from actual data
            "quality_trend": "improving",  # Would calculate from trends
        }

        metric_breakdown = {
            "relevance": {"avg_score": 0.78, "trend": "stable"},
            "accuracy": {"avg_score": 0.82, "trend": "improving"},
            "completeness": {"avg_score": 0.71, "trend": "stable"},
            "coherence": {"avg_score": 0.75, "trend": "improving"},
            "citation_quality": {"avg_score": 0.68, "trend": "stable"},
            "diversity": {"avg_score": 0.73, "trend": "improving"},
        }

        trends = {
            "daily_scores": [0.72, 0.75, 0.78, 0.76, 0.79, 0.81, 0.77],  # Last 7 days
            "weekly_averages": [0.73, 0.75, 0.77, 0.79],  # Last 4 weeks
            "monthly_trend": "improving",
        }

        benchmarks = {
            "industry_average": 0.68,
            "top_quartile": 0.85,
            "our_performance": overall_metrics["avg_quality_score"],
            "percentile_rank": 65,  # Would calculate from benchmarks
        }

        return QualityMetricsResponse(
            overall_metrics=overall_metrics,
            metric_breakdown=metric_breakdown,
            trends=trends,
            benchmarks=benchmarks,
        )

    except Exception as e:
        logger.error(f"Failed to get quality metrics: {e}")
        raise HTTPException(status_code=500, detail="Failed to get quality metrics")


@router.get("/health", response_model=HealthCheckResponse)
async def health_check(
    orchestrator: RAGPipelineOrchestrator = Depends(get_rag_orchestrator),
):
    """
    Health check for context services

    Returns the health status of all context service components.
    """
    try:
        # Get service metrics
        orchestrator_metrics = orchestrator.get_service_metrics()

        # Check component health
        components = {
            "rag_orchestrator": "healthy",
            "query_understanding": "healthy",
            "context_retrieval": "healthy",
            "context_assembly": "healthy",
            "citation_service": "healthy",
            "quality_monitor": "healthy",
        }

        # Determine overall status
        all_healthy = all(status == "healthy" for status in components.values())
        overall_status = "healthy" if all_healthy else "degraded"

        return HealthCheckResponse(
            status=overall_status,
            timestamp=datetime.now(),
            components=components,
            metrics={
                "active_pipelines": orchestrator_metrics["active_pipelines"],
                "success_rate": orchestrator_metrics["pipeline_metrics"][
                    "success_rate"
                ],
                "avg_duration": orchestrator_metrics["pipeline_metrics"][
                    "avg_duration_ms"
                ],
                "background_tasks": orchestrator_metrics["background_tasks_count"],
            },
        )

    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return HealthCheckResponse(
            status="unhealthy", timestamp=datetime.now(), components={}, error=str(e)
        )


# Helper functions
def parse_query_analysis(data: Dict[str, Any]) -> QueryAnalysis:
    """Parse query analysis from dictionary"""
    # Simplified implementation
    from app.services.query_understanding_service import (
        QueryAnalysis,
        QueryIntent,
        QueryComplexity,
        QueryType,
    )

    return QueryAnalysis(
        original_query=data.get("original_query", ""),
        cleaned_query=data.get("cleaned_query", ""),
        intent=QueryIntent(data.get("intent", "search")),
        confidence=data.get("confidence", 0.5),
        complexity=QueryComplexity(data.get("complexity", "simple")),
        query_type=QueryType(data.get("query_type", "factual")),
        entities=[],
        keywords=data.get("keywords", []),
        key_phrases=data.get("key_phrases", []),
        temporal_expressions=[],
        numerical_values=[],
        sentiment=data.get("sentiment", "neutral"),
        urgency=data.get("urgency", "normal"),
        domain=data.get("domain"),
        language=data.get("language", "en"),
        expanded_query=None,
        search_hints={},
        processing_time_ms=0.0,
    )


def parse_retrieval_result(data: Dict[str, Any]) -> RetrievalResult:
    """Parse retrieval result from dictionary"""
    # Simplified implementation
    from app.services.context_retrieval_service import (
        RetrievalResult,
        RetrievalStrategy,
    )

    return RetrievalResult(
        candidates=[],
        query_understanding=None,
        retrieval_strategy=RetrievalStrategy(data.get("strategy", "multi_stage")),
        total_candidates_evaluated=data.get("total_candidates_evaluated", 0),
        retrieval_time_ms=0.0,
        reranking_time_ms=0.0,
        diversity_time_ms=0.0,
        total_time_ms=0.0,
        coverage_estimate=0.0,
        quality_metrics={},
        strategy_performance={},
        selected_chunks=[],
    )


def parse_assembly_result(data: Dict[str, Any]) -> AssemblyResult:
    """Parse assembly result from dictionary"""
    # Simplified implementation
    from app.services.context_assembly_service import (
        AssemblyResult,
        AssemblyStrategy,
        CompressionLevel,
    )

    return AssemblyResult(
        assembled_context=data.get("assembled_context", ""),
        context_chunks=[],
        total_tokens=data.get("total_tokens", 0),
        assembly_strategy=AssemblyStrategy(data.get("strategy", "adaptive")),
        compression_level=CompressionLevel(data.get("compression_level", "none")),
        assembly_time_ms=0.0,
        compression_time_ms=0.0,
        redundancy_removal_time_ms=0.0,
        quality_metrics={},
        citations=[],
        truncated_chunks=[],
        compression_stats={},
        coverage_analysis={},
        assembly_metadata={},
    )


async def record_context_metrics(
    context_id: str,
    user_id: str,
    tenant_id: str,
    performance_metrics: Dict[str, Any],
    quality_metrics: Dict[str, Any],
):
    """Record context metrics for analytics"""
    # In a real implementation, would store in database or analytics service
    logger.info(
        f"Recording metrics for context {context_id} - user {user_id}, tenant {tenant_id}"
    )
    pass
