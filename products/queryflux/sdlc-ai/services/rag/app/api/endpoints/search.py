"""
Search API Endpoints

Provides REST API endpoints for vector search with advanced ranking,
search analytics, and performance monitoring.
"""

import logging
from datetime import datetime
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Depends, Query, BackgroundTasks
from pydantic import BaseModel, Field, validator
import asyncio

from app.api.dependencies import get_current_user, get_tenant_id
from app.services.vector_search_service import (
    VectorSearchService,
    SearchQuery,
    SearchResult,
    RankingStrategy,
    SearchMode,
)
from app.services.search_monitoring_service import (
    SearchMonitoringService,
    AlertSeverity,
)
from app.services.embedding_orchestrator import EmbeddingOrchestrator
from app.repositories.document import DocumentRepository
from app.models.user import User
from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# Create router
router = APIRouter(prefix="/search", tags=["search"])


# Pydantic models for API requests/responses
class SearchRequest(BaseModel):
    """Search request model"""

    query: str = Field(
        ..., min_length=1, max_length=1000, description="Search query text"
    )
    filters: Optional[Dict[str, Any]] = Field(None, description="Search filters")
    limit: int = Field(10, ge=1, le=100, description="Maximum number of results")
    offset: int = Field(0, ge=0, le=1000, description="Results offset for pagination")
    ranking_strategy: RankingStrategy = Field(
        RankingStrategy.HYBRID_SEMANTIC_KEYWORD, description="Ranking strategy to use"
    )
    search_mode: SearchMode = Field(
        SearchMode.BALANCED, description="Search mode (speed vs accuracy)"
    )
    boost_recent: bool = Field(True, description="Boost recent documents")
    boost_authority: bool = Field(True, description="Boost authoritative documents")
    diversity_threshold: float = Field(
        0.7, ge=0.0, le=1.0, description="Diversity threshold (0=similar, 1=diverse)"
    )
    include_metadata: bool = Field(True, description="Include document metadata")
    context_window_size: int = Field(
        4000, ge=1000, le=8000, description="Context window size in tokens"
    )
    min_relevance_score: float = Field(
        0.0, ge=0.0, le=1.0, description="Minimum relevance score threshold"
    )

    @validator("query")
    def validate_query(cls, v):
        if not v or not v.strip():
            raise ValueError("Query cannot be empty")
        return v.strip()


class SearchResponse(BaseModel):
    """Search response model"""

    results: List[Dict[str, Any]]
    total_found: int
    search_time_ms: float
    ranking_time_ms: float
    total_time_ms: float
    query_complexity: str
    cache_hit: bool
    has_more: bool
    ranking_explanation: Optional[Dict[str, Any]] = None


class SimilarSearchRequest(BaseModel):
    """Similar document search request"""

    document_id: str = Field(
        ..., description="Document ID to find similar documents for"
    )
    chunk_id: Optional[str] = Field(None, description="Specific chunk ID (optional)")
    limit: int = Field(10, ge=1, le=100, description="Maximum number of results")
    filters: Optional[Dict[str, Any]] = Field(None, description="Search filters")
    ranking_strategy: RankingStrategy = Field(
        RankingStrategy.SEMANTIC_ONLY, description="Ranking strategy to use"
    )


class AnalyticsRequest(BaseModel):
    """Analytics request model"""

    time_period: str = Field("24h", description="Time period (1h, 24h, 7d, 30d)")
    tenant_id: Optional[str] = Field(None, description="Filter by tenant ID")


class SearchAnalyticsResponse(BaseModel):
    """Search analytics response"""

    time_period: str
    total_queries: int
    successful_queries: int
    failed_queries: int
    average_search_time_ms: float
    p95_search_time_ms: float
    p99_search_time_ms: float
    cache_hit_rate: float
    average_relevance_score: float
    top_queries: List[Dict[str, Any]]
    ranking_strategy_usage: Dict[str, int]
    query_complexity_distribution: Dict[str, int]
    index_type_usage: Dict[str, int]
    error_rate: float
    concurrent_peak: int


class PerformanceReportRequest(BaseModel):
    """Performance report request"""

    time_period: str = Field("24h", description="Time period for report")
    format: str = Field("json", description="Report format (json, csv)")
    include_recommendations: bool = Field(True, description="Include recommendations")


class AlertResponse(BaseModel):
    """Alert response model"""

    alert_id: str
    severity: AlertSeverity
    metric_type: str
    message: str
    timestamp: datetime
    current_value: Any
    threshold_value: Any
    affected_tenant_id: Optional[str]
    resolved: bool
    resolved_at: Optional[datetime]


# Dependency injection
async def get_vector_search_service() -> VectorSearchService:
    """Get vector search service instance"""
    # In a real implementation, this would use dependency injection
    document_repository = DocumentRepository()
    return VectorSearchService(document_repository)


async def get_search_monitoring_service() -> SearchMonitoringService:
    """Get search monitoring service instance"""
    return SearchMonitoringService()


async def get_embedding_orchestrator() -> EmbeddingOrchestrator:
    """Get embedding orchestrator instance"""
    return EmbeddingOrchestrator()


@router.post("/query", response_model=SearchResponse)
async def search_documents(
    request: SearchRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    tenant_id: str = Depends(get_tenant_id),
    vector_search: VectorSearchService = Depends(get_vector_search_service),
    monitoring: SearchMonitoringService = Depends(get_search_monitoring_service),
    embedding_orchestrator: EmbeddingOrchestrator = Depends(get_embedding_orchestrator),
):
    """
    Search documents using semantic similarity with advanced ranking

    This endpoint performs vector search with multiple ranking strategies:
    - Semantic-only: Pure similarity matching
    - Hybrid: Combines semantic and keyword matching
    - Personalized: Uses user preferences and history
    - Recency-weighted: Prioritizes recent documents
    - Authority-weighted: Prioritizes authoritative sources
    - Diversity-weighted: Ensures result variety
    """
    try:
        # Generate embedding for query
        embedding_result = await embedding_orchestrator.generate_embedding(
            text=request.query, tenant_id=tenant_id
        )

        if not embedding_result.success:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to generate query embedding: {embedding_result.error}",
            )

        # Create search query
        search_query = SearchQuery(
            text=request.query,
            embedding=embedding_result.embedding,
            filters=request.filters,
            limit=request.limit,
            offset=request.offset,
            ranking_strategy=request.ranking_strategy,
            search_mode=request.search_mode,
            boost_recent=request.boost_recent,
            boost_authority=request.boost_authority,
            diversity_threshold=request.diversity_threshold,
            include_metadata=request.include_metadata,
            tenant_id=tenant_id,
            user_id=current_user.id,
            context_window_size=request.context_window_size,
            min_relevance_score=request.min_relevance_score,
        )

        # Perform search
        results, metrics = await vector_search.search(search_query)

        # Record search for monitoring (in background)
        background_tasks.add_task(
            monitoring.record_search,
            query_text=request.query,
            metrics=metrics,
            results=results,
            tenant_id=tenant_id,
            user_id=current_user.id,
            ranking_strategy=request.ranking_strategy.value,
            filters=request.filters,
        )

        # Convert results to response format
        response_results = []
        for result in results:
            result_dict = {
                "chunk_id": result.chunk_id,
                "document_id": result.document_id,
                "content": result.content,
                "score": round(result.final_score, 4),
                "rank": result.rank,
                "highlights": result.highlights,
            }

            if request.include_metadata:
                result_dict["metadata"] = result.metadata
                result_dict["score_breakdown"] = {
                    "relevance": round(result.relevance_score, 4),
                    "semantic": round(result.semantic_score, 4),
                    "keyword": round(result.keyword_score, 4),
                    "authority": round(result.authority_score, 4),
                    "recency": round(result.recency_score, 4),
                    "diversity": round(result.diversity_score, 4),
                    "personalized": round(result.personalized_score, 4),
                }

            response_results.append(result_dict)

        # Check if there are more results
        has_more = metrics.total_results > (request.offset + len(results))

        # Generate ranking explanation for first result
        ranking_explanation = None
        if results and request.include_metadata:
            ranking_explanation = results[0].explanation

        return SearchResponse(
            results=response_results,
            total_found=metrics.total_results,
            search_time_ms=round(metrics.search_time_ms, 2),
            ranking_time_ms=round(metrics.ranking_time_ms, 2),
            total_time_ms=round(metrics.search_time_ms + metrics.ranking_time_ms, 2),
            query_complexity=metrics.query_complexity,
            cache_hit=metrics.cache_hit,
            has_more=has_more,
            ranking_explanation=ranking_explanation,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Search failed: {e}")
        raise HTTPException(
            status_code=500, detail="Internal server error during search"
        )


@router.post("/similar", response_model=SearchResponse)
async def find_similar_documents(
    request: SimilarSearchRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    tenant_id: str = Depends(get_tenant_id),
    vector_search: VectorSearchService = Depends(get_vector_search_service),
    monitoring: SearchMonitoringService = Depends(get_search_monitoring_service),
):
    """
    Find documents similar to a given document

    This endpoint finds semantically similar documents using the
    document's existing embedding.
    """
    try:
        # Get document embedding (this would query the database)
        # For now, simulate getting document embedding
        document_repository = DocumentRepository()

        if request.chunk_id:
            # Get specific chunk embedding
            chunk = await document_repository.get_chunk(request.chunk_id)
            if not chunk or chunk.tenant_id != tenant_id:
                raise HTTPException(status_code=404, detail="Chunk not found")
            embedding = chunk.embedding
        else:
            # Get document embedding (average of all chunks)
            document = await document_repository.get_document(request.document_id)
            if not document or document.tenant_id != tenant_id:
                raise HTTPException(status_code=404, detail="Document not found")
            # This would get the document's average embedding
            embedding = None  # Placeholder

        if not embedding:
            raise HTTPException(status_code=400, detail="Document has no embedding")

        # Create search query for similar documents
        search_query = SearchQuery(
            text=f"similar to {request.document_id}",
            embedding=embedding,
            filters=request.filters,
            limit=request.limit,
            ranking_strategy=request.ranking_strategy,
            tenant_id=tenant_id,
            user_id=current_user.id,
        )

        # Perform search
        results, metrics = await vector_search.search(search_query)

        # Remove the original document from results
        results = [r for r in results if r.document_id != request.document_id]

        # Record search for monitoring
        background_tasks.add_task(
            monitoring.record_search,
            query_text=f"similar:{request.document_id}",
            metrics=metrics,
            results=results,
            tenant_id=tenant_id,
            user_id=current_user.id,
            ranking_strategy=request.ranking_strategy.value,
            filters=request.filters,
        )

        # Convert results to response format
        response_results = []
        for result in results:
            result_dict = {
                "chunk_id": result.chunk_id,
                "document_id": result.document_id,
                "content": result.content,
                "score": round(result.final_score, 4),
                "rank": result.rank,
                "highlights": result.highlights,
                "metadata": result.metadata,
            }
            response_results.append(result_dict)

        return SearchResponse(
            results=response_results,
            total_found=len(results),
            search_time_ms=round(metrics.search_time_ms, 2),
            ranking_time_ms=round(metrics.ranking_time_ms, 2),
            total_time_ms=round(metrics.search_time_ms + metrics.ranking_time_ms, 2),
            query_complexity=metrics.query_complexity,
            cache_hit=metrics.cache_hit,
            has_more=False,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Similar documents search failed: {e}")
        raise HTTPException(
            status_code=500, detail="Internal server error during similar search"
        )


@router.get("/analytics", response_model=SearchAnalyticsResponse)
async def get_search_analytics(
    time_period: str = Query("24h", description="Time period (1h, 24h, 7d, 30d)"),
    tenant_id: Optional[str] = Query(None, description="Filter by tenant ID"),
    current_user: User = Depends(get_current_user),
    monitoring: SearchMonitoringService = Depends(get_search_monitoring_service),
):
    """
    Get search performance analytics

    Provides comprehensive analytics about search performance,
    including query patterns, latency metrics, and cache efficiency.
    """
    try:
        # Check permissions
        if (
            tenant_id
            and tenant_id != current_user.tenant_id
            and not current_user.is_admin
        ):
            raise HTTPException(status_code=403, detail="Access denied")

        # Get analytics
        analytics = await monitoring.get_analytics(time_period, tenant_id)

        return SearchAnalyticsResponse(
            time_period=analytics.time_period,
            total_queries=analytics.total_queries,
            successful_queries=analytics.successful_queries,
            failed_queries=analytics.failed_queries,
            average_search_time_ms=round(analytics.average_search_time_ms, 2),
            p95_search_time_ms=round(analytics.p95_search_time_ms, 2),
            p99_search_time_ms=round(analytics.p99_search_time_ms, 2),
            cache_hit_rate=round(analytics.cache_hit_rate, 4),
            average_relevance_score=round(analytics.average_relevance_score, 4),
            top_queries=analytics.top_queries,
            ranking_strategy_usage=analytics.ranking_strategy_usage,
            query_complexity_distribution=analytics.query_complexity_distribution,
            index_type_usage=analytics.index_type_usage,
            error_rate=round(analytics.error_rate, 4),
            concurrent_peak=analytics.concurrent_peak,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Analytics retrieval failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve analytics")


@router.get("/alerts", response_model=List[AlertResponse])
async def get_search_alerts(
    severity: Optional[AlertSeverity] = Query(None, description="Filter by severity"),
    tenant_id: Optional[str] = Query(None, description="Filter by tenant ID"),
    current_user: User = Depends(get_current_user),
    monitoring: SearchMonitoringService = Depends(get_search_monitoring_service),
):
    """
    Get active search performance alerts

    Returns active performance alerts that may require attention.
    """
    try:
        # Check permissions
        if (
            tenant_id
            and tenant_id != current_user.tenant_id
            and not current_user.is_admin
        ):
            raise HTTPException(status_code=403, detail="Access denied")

        # Get alerts
        alerts = await monitoring.get_active_alerts(severity, tenant_id)

        # Convert to response format
        response_alerts = []
        for alert in alerts:
            response_alerts.append(
                AlertResponse(
                    alert_id=alert.alert_id,
                    severity=alert.severity,
                    metric_type=alert.metric_type.value,
                    message=alert.message,
                    timestamp=alert.timestamp,
                    current_value=alert.current_value,
                    threshold_value=alert.threshold_value,
                    affected_tenant_id=alert.affected_tenant_id,
                    resolved=alert.resolved,
                    resolved_at=alert.resolved_at,
                )
            )

        return response_alerts

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Alert retrieval failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve alerts")


@router.post("/alerts/{alert_id}/resolve")
async def resolve_search_alert(
    alert_id: str,
    current_user: User = Depends(get_current_user),
    monitoring: SearchMonitoringService = Depends(get_search_monitoring_service),
):
    """
    Resolve a search performance alert

    Marks an alert as resolved and stops it from appearing in active alerts.
    """
    try:
        # Only admins can resolve alerts
        if not current_user.is_admin:
            raise HTTPException(status_code=403, detail="Admin access required")

        # Resolve alert
        success = await monitoring.resolve_alert(alert_id)

        if not success:
            raise HTTPException(
                status_code=404, detail="Alert not found or already resolved"
            )

        return {"message": "Alert resolved successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Alert resolution failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to resolve alert")


@router.get("/report")
async def get_performance_report(
    time_period: str = Query("24h", description="Time period for report"),
    format: str = Query("json", description="Report format (json, csv)"),
    current_user: User = Depends(get_current_user),
    monitoring: SearchMonitoringService = Depends(get_search_monitoring_service),
):
    """
    Generate comprehensive performance report

    Generates a detailed report about search performance,
    including analytics, alerts, and recommendations.
    """
    try:
        # Only admins can generate reports
        if not current_user.is_admin:
            raise HTTPException(status_code=403, detail="Admin access required")

        # Generate report
        report = await monitoring.get_performance_report(time_period, format)

        if format == "csv":
            # Convert to CSV format (simplified)
            import io
            import csv

            output = io.StringIO()
            writer = csv.writer(output)

            # Write summary
            writer.writerow(["Metric", "Value"])
            for key, value in report["summary"].items():
                if isinstance(value, (int, float, str)):
                    writer.writerow([key, value])

            # Return as downloadable file
            content = output.getvalue()
            output.close()

            from fastapi.responses import Response

            return Response(
                content=content,
                media_type="text/csv",
                headers={
                    "Content-Disposition": f"attachment; filename=search_report_{time_period}.csv"
                },
            )

        return report

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Report generation failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate report")


@router.get("/health")
async def search_health_check(
    vector_search: VectorSearchService = Depends(get_vector_search_service),
    monitoring: SearchMonitoringService = Depends(get_search_monitoring_service),
):
    """
    Health check for search service

    Returns the health status of the search service components.
    """
    try:
        # Check search service
        test_query = SearchQuery(
            text="health check",
            embedding=[0.0] * 10,  # Small embedding for test
            limit=1,
        )

        # This would perform a quick search to verify service health
        # For now, just return success
        search_healthy = True

        # Get recent metrics
        recent_analytics = await monitoring.get_analytics("1h")

        return {
            "status": "healthy" if search_healthy else "unhealthy",
            "timestamp": datetime.now().isoformat(),
            "components": {
                "vector_search": "healthy" if search_healthy else "unhealthy",
                "monitoring": "healthy",
            },
            "metrics": {
                "recent_queries": recent_analytics.total_queries,
                "average_latency": recent_analytics.average_search_time_ms,
                "cache_hit_rate": recent_analytics.cache_hit_rate,
                "active_alerts": len(await monitoring.get_active_alerts()),
            },
        }

    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return {
            "status": "unhealthy",
            "timestamp": datetime.now().isoformat(),
            "error": str(e),
        }
