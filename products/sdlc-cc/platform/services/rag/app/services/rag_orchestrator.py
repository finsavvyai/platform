"""
RAG Pipeline Orchestrator

End-to-end coordination and monitoring of the complete RAG pipeline
with performance optimization, error handling, and streaming capabilities.
"""

import asyncio
import logging
from datetime import datetime
from typing import List, Dict, Any, Optional, Set, AsyncGenerator
from enum import Enum
from dataclasses import dataclass, field
import uuid
from collections import defaultdict
import traceback

from app.core.config import get_settings
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
    Citation,
    CitationStyle,
)
from app.services.context_quality_monitor import (
    ContextQualityMonitor,
    QualityAssessment,
)

logger = logging.getLogger(__name__)
settings = get_settings()


class PipelineStatus(str, Enum):
    """Pipeline execution status"""

    INITIATED = "initiated"
    QUERY_UNDERSTANDING = "query_understanding"
    CONTEXT_RETRIEVAL = "context_retrieval"
    CONTEXT_ASSEMBLY = "context_assembly"
    CITATION_PROCESSING = "citation_processing"
    QUALITY_ASSESSMENT = "quality_assessment"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class StreamingMode(str, Enum):
    """Streaming modes for pipeline execution"""

    NONE = "none"  # No streaming, return complete result
    INTERMEDIATE = "intermediate"  # Stream intermediate results
    FINAL_ONLY = "final_only"  # Stream only final result
    FULL = "full"  # Stream all steps and results


@dataclass
class PipelineConfig:
    """Configuration for RAG pipeline execution"""

    # Pipeline settings
    enable_query_understanding: bool = True
    enable_citation_processing: bool = True
    enable_quality_assessment: bool = True
    enable_streaming: bool = False
    streaming_mode: StreamingMode = StreamingMode.NONE

    # Performance settings
    max_execution_time_ms: int = 10000  # 10 seconds
    max_parallel_tasks: int = 4
    enable_caching: bool = True
    enable_monitoring: bool = True

    # Quality settings
    min_quality_threshold: float = 0.5
    enable_auto_retry: bool = True
    max_retry_attempts: int = 2

    # Output settings
    include_debug_info: bool = False
    include_performance_metrics: bool = True
    include_quality_metrics: bool = True
    include_intermediate_results: bool = False

    # Personalization
    enable_personalization: bool = True
    user_context: Optional[QueryContext] = None

    # Optimization
    enable_compression: bool = False
    compression_level: CompressionLevel = CompressionLevel.NONE
    max_context_tokens: int = 4000


@dataclass
class PipelineRequest:
    """Request for RAG pipeline execution"""

    query: str
    config: Optional[PipelineConfig] = None
    user_id: Optional[str] = None
    tenant_id: Optional[str] = None
    session_id: Optional[str] = None
    conversation_id: Optional[str] = None
    context_window_type: str = "llm"
    retrieval_strategy: RetrievalStrategy = RetrievalStrategy.MULTI_STAGE
    assembly_strategy: AssemblyStrategy = AssemblyStrategy.ADAPTIVE
    citation_styles: List[CitationStyle] = field(
        default_factory=lambda: [CitationStyle.APA]
    )
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class PipelineStep:
    """Individual pipeline step information"""

    step_name: str
    status: PipelineStatus
    start_time: datetime
    end_time: Optional[datetime] = None
    duration_ms: Optional[float] = None
    input_data: Optional[Dict[str, Any]] = None
    output_data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    metrics: Dict[str, Any] = field(default_factory=dict)


@dataclass
class PipelineResult:
    """Complete pipeline execution result"""

    pipeline_id: str
    request: PipelineRequest
    status: PipelineStatus
    start_time: datetime
    end_time: Optional[datetime] = None
    total_duration_ms: Optional[float] = None

    # Results
    query_analysis: Optional[QueryAnalysis] = None
    retrieval_result: Optional[RetrievalResult] = None
    assembly_result: Optional[AssemblyResult] = None
    citations: List[Citation] = field(default_factory=list)
    quality_assessment: Optional[QualityAssessment] = None

    # Pipeline steps
    steps: List[PipelineStep] = field(default_factory=list)

    # Performance metrics
    performance_metrics: Dict[str, Any] = field(default_factory=dict)
    quality_metrics: Dict[str, Any] = field(default_factory=dict)

    # Error information
    error: Optional[str] = None
    error_traceback: Optional[str] = None

    # Additional metadata
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class StreamingEvent:
    """Streaming event for real-time pipeline updates"""

    event_id: str
    pipeline_id: str
    event_type: str  # step_started, step_completed, step_failed, pipeline_completed, pipeline_failed
    timestamp: datetime
    step_name: Optional[str] = None
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


class RAGPipelineOrchestrator:
    """End-to-end RAG pipeline orchestrator"""

    def __init__(
        self,
        query_understanding_service: QueryUnderstandingService,
        context_retrieval_service: ContextRetrievalService,
        context_assembly_service: ContextAssemblyService,
        citation_service: CitationService,
        quality_monitor: Optional[ContextQualityMonitor] = None,
    ):
        self.query_understanding_service = query_understanding_service
        self.context_retrieval_service = context_retrieval_service
        self.context_assembly_service = context_assembly_service
        self.citation_service = citation_service
        self.quality_monitor = quality_monitor or ContextQualityMonitor()

        # Pipeline state
        self._active_pipelines: Dict[str, PipelineResult] = {}
        self._pipeline_history: List[PipelineResult] = []
        self._streaming_subscribers: Dict[str, Set[asyncio.Queue]] = defaultdict(set)

        # Performance monitoring
        self._performance_metrics: Dict[str, List[float]] = defaultdict(list)
        self._error_rates: Dict[str, List[float]] = defaultdict(list)

        # Background tasks
        self._background_tasks: Set[asyncio.Task] = set()

        logger.info("RAG Pipeline Orchestrator initialized")

    async def execute_pipeline(self, request: PipelineRequest) -> PipelineResult:
        """
        Execute the complete RAG pipeline

        Args:
            request: Pipeline execution request

        Returns:
            Complete pipeline result
        """
        pipeline_id = str(uuid.uuid4())
        start_time = datetime.now()

        # Initialize pipeline result
        pipeline_result = PipelineResult(
            pipeline_id=pipeline_id,
            request=request,
            status=PipelineStatus.INITIATED,
            start_time=start_time,
        )

        # Store active pipeline
        self._active_pipelines[pipeline_id] = pipeline_result

        try:
            # Set up configuration
            config = request.config or PipelineConfig()

            # Initialize query context
            query_context = self._initialize_query_context(request, config)

            # Execute pipeline steps
            if config.enable_query_understanding:
                await self._execute_query_understanding(
                    pipeline_result, request, query_context
                )

            await self._execute_context_retrieval(
                pipeline_result, request, query_context
            )
            await self._execute_context_assembly(pipeline_result, request)

            if config.enable_citation_processing:
                await self._execute_citation_processing(pipeline_result, request)

            if config.enable_quality_assessment:
                await self._execute_quality_assessment(pipeline_result, request)

            # Mark as completed
            pipeline_result.status = PipelineStatus.COMPLETED
            pipeline_result.end_time = datetime.now()
            pipeline_result.total_duration_ms = (
                pipeline_result.end_time - pipeline_result.start_time
            ).total_seconds() * 1000

            # Calculate final metrics
            self._calculate_final_metrics(pipeline_result)

            # Move to history
            self._pipeline_history.append(pipeline_result)
            if pipeline_id in self._active_pipelines:
                del self._active_pipelines[pipeline_id]

            # Cleanup old history (keep last 1000)
            if len(self._pipeline_history) > 1000:
                self._pipeline_history = self._pipeline_history[-1000:]

            # Publish completion event
            await self._publish_streaming_event(
                StreamingEvent(
                    event_id=str(uuid.uuid4()),
                    pipeline_id=pipeline_id,
                    event_type="pipeline_completed",
                    timestamp=datetime.now(),
                    data={
                        "total_duration_ms": pipeline_result.total_duration_ms,
                        "status": pipeline_result.status.value,
                        "final_quality": pipeline_result.quality_assessment.overall_score
                        if pipeline_result.quality_assessment
                        else None,
                    },
                )
            )

            logger.info(
                f"Pipeline {pipeline_id} completed successfully in {pipeline_result.total_duration_ms:.2f}ms"
            )

            return pipeline_result

        except Exception as e:
            # Handle pipeline failure
            pipeline_result.status = PipelineStatus.FAILED
            pipeline_result.error = str(e)
            pipeline_result.error_traceback = traceback.format_exc()
            pipeline_result.end_time = datetime.now()
            pipeline_result.total_duration_ms = (
                pipeline_result.end_time - pipeline_result.start_time
            ).total_seconds() * 1000

            # Record error metrics
            self._record_error_metrics(pipeline_result)

            # Move to history
            self._pipeline_history.append(pipeline_result)
            if pipeline_id in self._active_pipelines:
                del self._active_pipelines[pipeline_id]

            # Publish failure event
            await self._publish_streaming_event(
                StreamingEvent(
                    event_id=str(uuid.uuid4()),
                    pipeline_id=pipeline_id,
                    event_type="pipeline_failed",
                    timestamp=datetime.now(),
                    error=str(e),
                )
            )

            logger.error(f"Pipeline {pipeline_id} failed: {e}")

            return pipeline_result

    async def execute_pipeline_streaming(
        self, request: PipelineRequest
    ) -> AsyncGenerator[StreamingEvent, None]:
        """
        Execute pipeline with streaming updates

        Args:
            request: Pipeline execution request

        Yields:
            Streaming events during pipeline execution
        """
        pipeline_id = str(uuid.uuid4())
        datetime.now()

        # Set up streaming
        if not request.config:
            request.config = PipelineConfig()
        request.config.enable_streaming = True

        # Create event queue
        event_queue = asyncio.Queue()
        self._streaming_subscribers[pipeline_id].add(event_queue)

        try:
            # Start pipeline in background
            pipeline_task = asyncio.create_task(self.execute_pipeline(request))
            self._background_tasks.add(pipeline_task)

            # Stream events
            while True:
                try:
                    event = await asyncio.wait_for(event_queue.get(), timeout=1.0)
                    yield event

                    if event.event_type in ["pipeline_completed", "pipeline_failed"]:
                        break

                except asyncio.TimeoutError:
                    # Check if pipeline is still running
                    if pipeline_task.done():
                        break
                    continue

            # Get final result
            await pipeline_task
            self._background_tasks.discard(pipeline_task)

        except Exception as e:
            logger.error(f"Streaming pipeline execution failed: {e}")
            yield StreamingEvent(
                event_id=str(uuid.uuid4()),
                pipeline_id=pipeline_id,
                event_type="pipeline_failed",
                timestamp=datetime.now(),
                error=str(e),
            )

        finally:
            # Cleanup
            self._streaming_subscribers[pipeline_id].discard(event_queue)
            if not self._streaming_subscribers[pipeline_id]:
                del self._streaming_subscribers[pipeline_id]

    def _initialize_query_context(
        self, request: PipelineRequest, config: PipelineConfig
    ) -> Optional[QueryContext]:
        """Initialize query context for personalization"""
        if not config.enable_personalization:
            return None

        # Build query context from request
        context = QueryContext(
            user_id=request.user_id or "",
            session_id=request.session_id or "",
            previous_queries=self._get_recent_queries(request.user_id),
            successful_results=self._get_recent_successes(request.user_id),
            user_preferences=self._get_user_preferences(request.user_id),
            domain_expertise=self._get_user_expertise(request.user_id),
            recent_topics=self._get_recent_topics(request.user_id),
            conversation_history=self._get_conversation_history(
                request.conversation_id
            ),
        )

        return context

    async def _execute_query_understanding(
        self,
        pipeline_result: PipelineResult,
        request: PipelineRequest,
        query_context: Optional[QueryContext],
    ) -> None:
        """Execute query understanding step"""
        step = PipelineStep(
            step_name="query_understanding",
            status=PipelineStatus.QUERY_UNDERSTANDING,
            start_time=datetime.now(),
            input_data={"query": request.query, "context": query_context},
        )

        await self._publish_streaming_event(
            StreamingEvent(
                event_id=str(uuid.uuid4()),
                pipeline_id=pipeline_result.pipeline_id,
                event_type="step_started",
                timestamp=datetime.now(),
                step_name="query_understanding",
            )
        )

        try:
            # Perform query analysis
            query_analysis = await self.query_understanding_service.analyze_query(
                query=request.query, context=query_context, use_expansion=True
            )

            # Store result
            pipeline_result.query_analysis = query_analysis
            step.output_data = {"query_analysis": query_analysis}
            step.status = PipelineStatus.COMPLETED

            # Add to pipeline steps
            pipeline_result.steps.append(step)

            # Publish completion
            await self._publish_streaming_event(
                StreamingEvent(
                    event_id=str(uuid.uuid4()),
                    pipeline_id=pipeline_result.pipeline_id,
                    event_type="step_completed",
                    timestamp=datetime.now(),
                    step_name="query_understanding",
                    data={
                        "intent": query_analysis.intent.value,
                        "complexity": query_analysis.complexity.value,
                        "entities_count": len(query_analysis.entities),
                        "keywords_count": len(query_analysis.keywords),
                    },
                )
            )

        except Exception as e:
            step.error = str(e)
            step.status = PipelineStatus.FAILED
            pipeline_result.steps.append(step)

            await self._publish_streaming_event(
                StreamingEvent(
                    event_id=str(uuid.uuid4()),
                    pipeline_id=pipeline_result.pipeline_id,
                    event_type="step_failed",
                    timestamp=datetime.now(),
                    step_name="query_understanding",
                    error=str(e),
                )
            )

            raise

        finally:
            step.end_time = datetime.now()
            step.duration_ms = (step.end_time - step.start_time).total_seconds() * 1000

    async def _execute_context_retrieval(
        self,
        pipeline_result: PipelineResult,
        request: PipelineRequest,
        query_context: Optional[QueryContext],
    ) -> None:
        """Execute context retrieval step"""
        step = PipelineStep(
            step_name="context_retrieval",
            status=PipelineStatus.CONTEXT_RETRIEVAL,
            start_time=datetime.now(),
            input_data={
                "strategy": request.retrieval_strategy,
                "query_analysis": pipeline_result.query_analysis,
                "context": query_context,
            },
        )

        await self._publish_streaming_event(
            StreamingEvent(
                event_id=str(uuid.uuid4()),
                pipeline_id=pipeline_result.pipeline_id,
                event_type="step_started",
                timestamp=datetime.now(),
                step_name="context_retrieval",
            )
        )

        try:
            # Create retrieval request
            retrieval_request = RetrievalRequest(
                query_text=request.query,
                query_analysis=pipeline_result.query_analysis,
                user_context=query_context,
                tenant_id=request.tenant_id,
                user_id=request.user_id,
                max_context_length=request.config.max_context_tokens
                if request.config
                else 4000,
                retrieval_strategy=request.retrieval_strategy,
                personalization_enabled=request.config.enable_personalization
                if request.config
                else True,
            )

            # Perform retrieval
            retrieval_result = await self.context_retrieval_service.retrieve_context(
                retrieval_request
            )

            # Store result
            pipeline_result.retrieval_result = retrieval_result
            step.output_data = {"retrieval_result": retrieval_result}
            step.status = PipelineStatus.COMPLETED

            # Add to pipeline steps
            pipeline_result.steps.append(step)

            # Publish completion
            await self._publish_streaming_event(
                StreamingEvent(
                    event_id=str(uuid.uuid4()),
                    pipeline_id=pipeline_result.pipeline_id,
                    event_type="step_completed",
                    timestamp=datetime.now(),
                    step_name="context_retrieval",
                    data={
                        "candidates_count": len(retrieval_result.candidates),
                        "selected_chunks": len(retrieval_result.selected_chunks),
                        "strategy": retrieval_result.retrieval_strategy.value,
                        "total_time_ms": retrieval_result.total_time_ms,
                    },
                )
            )

        except Exception as e:
            step.error = str(e)
            step.status = PipelineStatus.FAILED
            pipeline_result.steps.append(step)

            await self._publish_streaming_event(
                StreamingEvent(
                    event_id=str(uuid.uuid4()),
                    pipeline_id=pipeline_result.pipeline_id,
                    event_type="step_failed",
                    timestamp=datetime.now(),
                    step_name="context_retrieval",
                    error=str(e),
                )
            )

            raise

        finally:
            step.end_time = datetime.now()
            step.duration_ms = (step.end_time - step.start_time).total_seconds() * 1000

    async def _execute_context_assembly(
        self, pipeline_result: PipelineResult, request: PipelineRequest
    ) -> None:
        """Execute context assembly step"""
        step = PipelineStep(
            step_name="context_assembly",
            status=PipelineStatus.CONTEXT_ASSEMBLY,
            start_time=datetime.now(),
            input_data={
                "chunks": pipeline_result.retrieval_result.selected_chunks,
                "strategy": request.assembly_strategy,
                "query_analysis": pipeline_result.query_analysis,
            },
        )

        await self._publish_streaming_event(
            StreamingEvent(
                event_id=str(uuid.uuid4()),
                pipeline_id=pipeline_result.pipeline_id,
                event_type="step_started",
                timestamp=datetime.now(),
                step_name="context_assembly",
            )
        )

        try:
            # Create assembly request
            assembly_request = AssemblyRequest(
                chunks=pipeline_result.retrieval_result.selected_chunks,
                query_analysis=pipeline_result.query_analysis,
                max_tokens=request.config.max_context_tokens
                if request.config
                else 4000,
                assembly_strategy=request.assembly_strategy,
                compression_level=request.config.compression_level
                if request.config
                else CompressionLevel.NONE,
                include_citations=request.config.enable_citation_processing
                if request.config
                else True,
                citation_style=request.citation_styles[0].value
                if request.citation_styles
                else "apa",
                context_window_type=request.context_window_type,
            )

            # Perform assembly
            assembly_result = await self.context_assembly_service.assemble_context(
                assembly_request
            )

            # Store result
            pipeline_result.assembly_result = assembly_result
            step.output_data = {"assembly_result": assembly_result}
            step.status = PipelineStatus.COMPLETED

            # Add to pipeline steps
            pipeline_result.steps.append(step)

            # Publish completion
            await self._publish_streaming_event(
                StreamingEvent(
                    event_id=str(uuid.uuid4()),
                    pipeline_id=pipeline_result.pipeline_id,
                    event_type="step_completed",
                    timestamp=datetime.now(),
                    step_name="context_assembly",
                    data={
                        "total_tokens": assembly_result.total_tokens,
                        "chunks_included": len(assembly_result.context_chunks),
                        "strategy": assembly_result.assembly_strategy.value,
                        "assembly_time_ms": assembly_result.assembly_time_ms,
                    },
                )
            )

        except Exception as e:
            step.error = str(e)
            step.status = PipelineStatus.FAILED
            pipeline_result.steps.append(step)

            await self._publish_streaming_event(
                StreamingEvent(
                    event_id=str(uuid.uuid4()),
                    pipeline_id=pipeline_result.pipeline_id,
                    event_type="step_failed",
                    timestamp=datetime.now(),
                    step_name="context_assembly",
                    error=str(e),
                )
            )

            raise

        finally:
            step.end_time = datetime.now()
            step.duration_ms = (step.end_time - step.start_time).total_seconds() * 1000

    async def _execute_citation_processing(
        self, pipeline_result: PipelineResult, request: PipelineRequest
    ) -> None:
        """Execute citation processing step"""
        step = PipelineStep(
            step_name="citation_processing",
            status=PipelineStatus.CITATION_PROCESSING,
            start_time=datetime.now(),
            input_data={
                "context_chunks": pipeline_result.assembly_result.context_chunks,
                "citation_styles": request.citation_styles,
            },
        )

        await self._publish_streaming_event(
            StreamingEvent(
                event_id=str(uuid.uuid4()),
                pipeline_id=pipeline_result.pipeline_id,
                event_type="step_started",
                timestamp=datetime.now(),
                step_name="citation_processing",
            )
        )

        try:
            # Process citations for each chunk
            all_citations = []

            for chunk in pipeline_result.assembly_result.context_chunks:
                citation_request = CitationRequest(
                    chunk=chunk.original_chunk,
                    extract_citations=True,
                    validate_citations=True,
                    format_citations=True,
                    citation_styles=request.citation_styles,
                    user_id=request.user_id,
                    tenant_id=request.tenant_id,
                )

                citations = await self.citation_service.process_citations(
                    citation_request
                )
                all_citations.extend(citations)

            # Remove duplicates
            unique_citations = self.citation_service._remove_duplicate_citations(
                all_citations
            )

            # Store result
            pipeline_result.citations = unique_citations
            step.output_data = {"citations": unique_citations}
            step.status = PipelineStatus.COMPLETED

            # Add to pipeline steps
            pipeline_result.steps.append(step)

            # Publish completion
            await self._publish_streaming_event(
                StreamingEvent(
                    event_id=str(uuid.uuid4()),
                    pipeline_id=pipeline_result.pipeline_id,
                    event_type="step_completed",
                    timestamp=datetime.now(),
                    step_name="citation_processing",
                    data={
                        "total_citations": len(unique_citations),
                        "unique_sources": len(
                            set(
                                c.metadata.source
                                for c in unique_citations
                                if c.metadata.source
                            )
                        ),
                    },
                )
            )

        except Exception as e:
            step.error = str(e)
            step.status = PipelineStatus.FAILED
            pipeline_result.steps.append(step)

            await self._publish_streaming_event(
                StreamingEvent(
                    event_id=str(uuid.uuid4()),
                    pipeline_id=pipeline_result.pipeline_id,
                    event_type="step_failed",
                    timestamp=datetime.now(),
                    step_name="citation_processing",
                    error=str(e),
                )
            )

            raise

        finally:
            step.end_time = datetime.now()
            step.duration_ms = (step.end_time - step.start_time).total_seconds() * 1000

    async def _execute_quality_assessment(
        self, pipeline_result: PipelineResult, request: PipelineRequest
    ) -> None:
        """Execute quality assessment step"""
        step = PipelineStep(
            step_name="quality_assessment",
            status=PipelineStatus.QUALITY_ASSESSMENT,
            start_time=datetime.now(),
            input_data={
                "query_analysis": pipeline_result.query_analysis,
                "retrieval_result": pipeline_result.retrieval_result,
                "assembly_result": pipeline_result.assembly_result,
                "citations": pipeline_result.citations,
            },
        )

        await self._publish_streaming_event(
            StreamingEvent(
                event_id=str(uuid.uuid4()),
                pipeline_id=pipeline_result.pipeline_id,
                event_type="step_started",
                timestamp=datetime.now(),
                step_name="quality_assessment",
            )
        )

        try:
            # Perform quality assessment
            quality_assessment = await self.quality_monitor.assess_quality(
                context_id=pipeline_result.pipeline_id,
                query_analysis=pipeline_result.query_analysis,
                retrieval_result=pipeline_result.retrieval_result,
                assembly_result=pipeline_result.assembly_result,
                citations=pipeline_result.citations,
                user_id=request.user_id,
                tenant_id=request.tenant_id,
            )

            # Check quality threshold
            config = request.config or PipelineConfig()
            if quality_assessment.overall_score < config.min_quality_threshold:
                if config.enable_auto_retry:
                    # Could implement retry logic here
                    logger.warning(
                        f"Quality score {quality_assessment.overall_score:.3f} below threshold {config.min_quality_threshold}"
                    )

            # Store result
            pipeline_result.quality_assessment = quality_assessment
            step.output_data = {"quality_assessment": quality_assessment}
            step.status = PipelineStatus.COMPLETED

            # Add to pipeline steps
            pipeline_result.steps.append(step)

            # Publish completion
            await self._publish_streaming_event(
                StreamingEvent(
                    event_id=str(uuid.uuid4()),
                    pipeline_id=pipeline_result.pipeline_id,
                    event_type="step_completed",
                    timestamp=datetime.now(),
                    step_name="quality_assessment",
                    data={
                        "overall_score": quality_assessment.overall_score,
                        "metrics_count": len(quality_assessment.metric_scores),
                        "strengths_count": len(quality_assessment.strengths),
                        "weaknesses_count": len(quality_assessment.weaknesses),
                    },
                )
            )

        except Exception as e:
            step.error = str(e)
            step.status = PipelineStatus.FAILED
            pipeline_result.steps.append(step)

            await self._publish_streaming_event(
                StreamingEvent(
                    event_id=str(uuid.uuid4()),
                    pipeline_id=pipeline_result.pipeline_id,
                    event_type="step_failed",
                    timestamp=datetime.now(),
                    step_name="quality_assessment",
                    error=str(e),
                )
            )

            raise

        finally:
            step.end_time = datetime.now()
            step.duration_ms = (step.end_time - step.start_time).total_seconds() * 1000

    def _calculate_final_metrics(self, pipeline_result: PipelineResult) -> None:
        """Calculate final performance and quality metrics"""
        # Performance metrics
        step_durations = [
            step.duration_ms for step in pipeline_result.steps if step.duration_ms
        ]
        if step_durations:
            pipeline_result.performance_metrics = {
                "total_steps": len(pipeline_result.steps),
                "step_durations": {
                    step.step_name: step.duration_ms for step in pipeline_result.steps
                },
                "avg_step_duration": sum(step_durations) / len(step_durations),
                "max_step_duration": max(step_durations),
                "min_step_duration": min(step_durations),
                "steps_completed": sum(
                    1
                    for step in pipeline_result.steps
                    if step.status == PipelineStatus.COMPLETED
                ),
                "steps_failed": sum(
                    1
                    for step in pipeline_result.steps
                    if step.status == PipelineStatus.FAILED
                ),
            }

        # Quality metrics
        if pipeline_result.quality_assessment:
            pipeline_result.quality_metrics = {
                "overall_score": pipeline_result.quality_assessment.overall_score,
                "metric_scores": {
                    score.metric.value: score.score
                    for score in pipeline_result.quality_assessment.metric_scores
                },
                "strengths": pipeline_result.quality_assessment.strengths,
                "weaknesses": pipeline_result.quality_assessment.weaknesses,
                "recommendations": pipeline_result.quality_assessment.recommendations,
                "compliance_score": pipeline_result.quality_assessment.compliance_score,
                "user_satisfaction_prediction": pipeline_result.quality_assessment.user_satisfaction_prediction,
            }

        # Content metrics
        if pipeline_result.assembly_result:
            pipeline_result.metadata.update(
                {
                    "total_tokens": pipeline_result.assembly_result.total_tokens,
                    "chunks_included": len(
                        pipeline_result.assembly_result.context_chunks
                    ),
                    "citations_generated": len(pipeline_result.citations),
                    "assembly_strategy": pipeline_result.assembly_result.assembly_strategy.value,
                    "retrieval_strategy": pipeline_result.retrieval_result.retrieval_strategy.value
                    if pipeline_result.retrieval_result
                    else None,
                }
            )

    def _record_error_metrics(self, pipeline_result: PipelineResult) -> None:
        """Record error metrics for monitoring"""
        failed_step = None
        for step in pipeline_result.steps:
            if step.status == PipelineStatus.FAILED:
                failed_step = step.step_name
                break

        if failed_step:
            self._error_rates[failed_step].append(1.0)
        else:
            self._error_rates["pipeline"].append(1.0)

        # Keep only recent error rates
        for key in list(self._error_rates.keys()):
            if len(self._error_rates[key]) > 100:
                self._error_rates[key] = self._error_rates[key][-100:]

    async def _publish_streaming_event(self, event: StreamingEvent) -> None:
        """Publish streaming event to subscribers"""
        if event.pipeline_id in self._streaming_subscribers:
            for queue in self._streaming_subscribers[event.pipeline_id]:
                try:
                    queue.put_nowait(event)
                except asyncio.QueueFull:
                    logger.warning(
                        f"Failed to publish event to full queue for pipeline {event.pipeline_id}"
                    )

    # Helper methods for query context
    def _get_recent_queries(self, user_id: Optional[str]) -> List[str]:
        """Get recent queries for user"""
        # Simplified implementation
        return []

    def _get_recent_successes(self, user_id: Optional[str]) -> List[Dict[str, Any]]:
        """Get recent successful results for user"""
        # Simplified implementation
        return []

    def _get_user_preferences(self, user_id: Optional[str]) -> Dict[str, Any]:
        """Get user preferences"""
        # Simplified implementation
        return {}

    def _get_user_expertise(self, user_id: Optional[str]) -> Dict[str, float]:
        """Get user domain expertise"""
        # Simplified implementation
        return {}

    def _get_recent_topics(self, user_id: Optional[str]) -> List[str]:
        """Get recent topics for user"""
        # Simplified implementation
        return []

    def _get_conversation_history(
        self, conversation_id: Optional[str]
    ) -> List[Dict[str, Any]]:
        """Get conversation history"""
        # Simplified implementation
        return []

    def get_pipeline_status(self, pipeline_id: str) -> Optional[PipelineResult]:
        """Get status of a running pipeline"""
        return self._active_pipelines.get(pipeline_id)

    def cancel_pipeline(self, pipeline_id: str) -> bool:
        """Cancel a running pipeline"""
        if pipeline_id in self._active_pipelines:
            pipeline = self._active_pipelines[pipeline_id]
            pipeline.status = PipelineStatus.CANCELLED
            pipeline.end_time = datetime.now()
            pipeline.total_duration_ms = (
                pipeline.end_time - pipeline.start_time
            ).total_seconds() * 1000

            # Move to history
            self._pipeline_history.append(pipeline)
            del self._active_pipelines[pipeline_id]

            return True
        return False

    def get_pipeline_metrics(self) -> Dict[str, Any]:
        """Get overall pipeline performance metrics"""
        if not self._pipeline_history:
            return {}

        # Calculate metrics from history
        completed_pipelines = [
            p for p in self._pipeline_history if p.status == PipelineStatus.COMPLETED
        ]
        failed_pipelines = [
            p for p in self._pipeline_history if p.status == PipelineStatus.FAILED
        ]

        # Performance metrics
        if completed_pipelines:
            durations = [
                p.total_duration_ms for p in completed_pipelines if p.total_duration_ms
            ]
            avg_duration = sum(durations) / len(durations) if durations else 0

            quality_scores = [
                p.quality_assessment.overall_score
                for p in completed_pipelines
                if p.quality_assessment
            ]
            avg_quality = (
                sum(quality_scores) / len(quality_scores) if quality_scores else 0
            )
        else:
            avg_duration = 0
            avg_quality = 0

        return {
            "total_pipelines": len(self._pipeline_history),
            "completed_pipelines": len(completed_pipelines),
            "failed_pipelines": len(failed_pipelines),
            "active_pipelines": len(self._active_pipelines),
            "success_rate": len(completed_pipelines) / len(self._pipeline_history)
            if self._pipeline_history
            else 0,
            "avg_duration_ms": avg_duration,
            "avg_quality_score": avg_quality,
            "error_rates": {
                key: sum(values) / len(values) if values else 0
                for key, values in self._error_rates.items()
            },
            "background_tasks": len(self._background_tasks),
        }

    def cleanup_background_tasks(self) -> None:
        """Clean up completed background tasks"""
        completed_tasks = {task for task in self._background_tasks if task.done()}
        self._background_tasks -= completed_tasks

        for task in completed_tasks:
            try:
                task.result()  # Check for exceptions
            except Exception as e:
                logger.error(f"Background task failed: {e}")

    def get_service_metrics(self) -> Dict[str, Any]:
        """Get orchestrator service metrics"""
        return {
            "active_pipelines": len(self._active_pipelines),
            "pipeline_history_size": len(self._pipeline_history),
            "streaming_subscribers": sum(
                len(queues) for queues in self._streaming_subscribers.values()
            ),
            "background_tasks_count": len(self._background_tasks),
            "pipeline_metrics": self.get_pipeline_metrics(),
            "error_rates": dict(self._error_rates),
        }
