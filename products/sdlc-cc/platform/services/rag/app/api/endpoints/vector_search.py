"""
Vector Search API Endpoints

RESTful API endpoints for vector search operations including semantic search,
hybrid search, advanced filtering, and comprehensive analytics.

Endpoints:
- POST /search - Main search endpoint with all features
- GET /search/suggestions - Get search suggestions
- GET /search/analytics - Get search analytics
- POST /search/click - Record result click events
- GET /search/health - Search service health check
"""

from fastapi import APIRouter, HTTPException, Depends, Query, BackgroundTasks
from fastapi.responses import JSONResponse
from typing import List, Dict, Any, Optional
from datetime import datetime
import asyncio
from pydantic import BaseModel, Field
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from ...middleware.auth import get_current_user
from ...utils.logging import get_logger
from ...services.vector_search_service import (
    VectorSearchService,
    SearchQuery,
    SearchType,
    SearchRanking,
)
from ...services.search_monitoring_service import (
    SearchMonitoringService,
)

logger = get_logger(__name__)
router = APIRouter(prefix="/search", tags=["vector_search"])
limiter = Limiter(key_func=get_remote_address)

# Initialize services
vector_search_service = VectorSearchService()
search_monitoring = SearchMonitoringService()


# Pydantic models for API
class SearchRequest(BaseModel):
    query: str = Field(
        ..., min_length=1, max_length=1000, description="Search query text"
    )
    search_type: SearchType = Field(
        SearchType.HYBRID, description="Type of search to perform"
    )
    ranking: SearchRanking = Field(
        SearchRanking.HYBRID, description="Ranking algorithm to use"
    )
    limit: int = Field(10, ge=1, le=100, description="Number of results to return")
    offset: int = Field(0, ge=0, le=1000, description="Number of results to skip")
    filters: Optional[Dict[str, Any]] = Field(None, description="Search filters")
    include_highlights: bool = Field(
        True, description="Include search result highlights"
    )
    include_explanations: bool = Field(
        False, description="Include ranking explanations"
    )
    min_score: float = Field(0.1, ge=0.0, le=1.0, description="Minimum score threshold")
    include_expired: bool = Field(False, description="Include expired documents")


class SearchResponse(BaseModel):
    results: List[Dict[str, Any]]
    total_count: int
    query: str
    search_time_ms: float
    cache_hit: bool
    ranking_algorithm: str
    filters_applied: bool
    suggestions: Optional[List[str]] = None


class ClickEventRequest(BaseModel):
    search_id: str = Field(..., description="Unique search identifier")
    result_position: int = Field(..., ge=0, description="Position of clicked result")
    document_id: str = Field(..., description="ID of clicked document")
    timestamp: Optional[datetime] = Field(None, description="Click timestamp")


class SearchSuggestionsResponse(BaseModel):
    suggestions: List[str]
    popular_queries: List[Dict[str, Any]]
    recent_searches: List[str]


class SearchAnalyticsResponse(BaseModel):
    summary: Dict[str, Any]
    daily_volume: List[Dict[str, Any]]
    popular_queries: List[Dict[str, Any]]
    search_types: List[Dict[str, Any]]
    zero_results_queries: List[Dict[str, Any]]
    error_analysis: List[Dict[str, Any]]


@router.post("/", response_model=SearchResponse)
@limiter.limit("100/minute")  # 100 searches per minute per IP
async def search(
    request: SearchRequest,
    background_tasks: BackgroundTasks,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Perform vector search with advanced ranking and filtering

    Supports semantic search, keyword search, and hybrid search with multiple
    ranking algorithms. Includes real-time caching, performance monitoring,
    and comprehensive analytics.

    Args:
        request: Search request with all parameters
        background_tasks: FastAPI background tasks
        current_user: Authenticated user from JWT token

    Returns:
        SearchResponse with results and metadata
    """

    tenant_id = current_user["tenant_id"]
    user_id = current_user["user_id"]

    try:
        # Record search start
        search_id = await search_monitoring.record_search_start(
            tenant_id=tenant_id,
            user_id=user_id,
            query_text=request.query,
            search_type=request.search_type.value,
            ranking_algorithm=request.ranking.value,
            client_ip=get_remote_address(
                None
            ),  # Would get from request in real implementation
            session_id=current_user.get("session_id"),
        )

        # Create search query
        search_query = SearchQuery(
            text=request.query,
            tenant_id=tenant_id,
            user_id=user_id,
            search_type=request.search_type,
            ranking=request.ranking,
            limit=request.limit,
            offset=request.offset,
            filters=request.filters,
            include_highlights=request.include_highlights,
            include_explanations=request.include_explanations,
            min_score=request.min_score,
            include_expired=request.include_expired,
        )

        # Check cache first (would use actual cache implementation)
        start_time = asyncio.get_event_loop().time()

        # Perform search
        results = await vector_search_service.search(search_query, user_id)

        # Calculate search time
        search_time = (asyncio.get_event_loop().time() - start_time) * 1000

        # Get suggestions for future searches
        suggestions = await vector_search_service.get_search_suggestions(
            request.query, tenant_id, 5
        )

        # Format results for response
        formatted_results = []
        for result in results:
            result_data = {
                "chunk_id": result.chunk_id,
                "document_id": result.document_id,
                "content": result.content,
                "score": result.score,
                "rank_score": result.rank_score,
                "metadata": result.metadata,
                "document_metadata": result.document_metadata,
                "highlights": result.highlights if request.include_highlights else [],
                "similarity_score": result.similarity_score,
                "authority_score": result.authority_score,
                "recency_score": result.recency_score,
            }

            if request.include_explanations:
                result_data["ranking_explanation"] = result.ranking_explanation

            formatted_results.append(result_data)

        # Determine if this was a cache hit (would check actual cache)
        cache_hit = False  # Placeholder

        # Record search completion in background
        background_tasks.add_task(
            search_monitoring.record_search_completion,
            search_id,
            len(results),
            search_time,
            cache_hit,
            sum(r.similarity_score for r in results) / len(results) if results else 0.0,
            bool(request.filters),
        )

        # Create response
        response = SearchResponse(
            results=formatted_results,
            total_count=len(formatted_results),
            query=request.query,
            search_time_ms=search_time,
            cache_hit=cache_hit,
            ranking_algorithm=request.ranking.value,
            filters_applied=bool(request.filters),
            suggestions=suggestions if suggestions else None,
        )

        return response

    except Exception as e:
        logger.error(f"Search failed: {e}")
        raise HTTPException(status_code=500, detail="Search operation failed")


@router.get("/suggestions", response_model=SearchSuggestionsResponse)
@limiter.limit("50/minute")
async def get_search_suggestions(
    q: str = Query(..., min_length=1, max_length=100, description="Query prefix"),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Get search query suggestions based on partial query

    Provides autocomplete suggestions based on popular queries and
    previous search history.

    Args:
        q: Partial query text
        current_user: Authenticated user

    Returns:
        Search suggestions and related queries
    """

    tenant_id = current_user["tenant_id"]

    try:
        # Get suggestions
        suggestions = await vector_search_service.get_search_suggestions(q, tenant_id)

        # Get popular queries
        analytics = await vector_search_service.get_search_analytics(tenant_id, 7)
        popular_queries = analytics.get("popular_queries", [])[:5]

        # Get recent searches for user (would implement user-specific search history)
        recent_searches = []  # Placeholder

        return SearchSuggestionsResponse(
            suggestions=suggestions,
            popular_queries=popular_queries,
            recent_searches=recent_searches,
        )

    except Exception as e:
        logger.error(f"Failed to get search suggestions: {e}")
        return SearchSuggestionsResponse(
            suggestions=[], popular_queries=[], recent_searches=[]
        )


@router.get("/analytics", response_model=SearchAnalyticsResponse)
async def get_search_analytics(
    days: int = Query(30, ge=1, le=365, description="Number of days for analytics"),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Get comprehensive search analytics dashboard

    Returns detailed analytics including search volume, performance metrics,
    popular queries, and error analysis.

    Args:
        days: Number of days to include in analytics
        current_user: Authenticated user

    Returns:
        Comprehensive search analytics data
    """

    tenant_id = current_user["tenant_id"]

    try:
        analytics_data = await search_monitoring.get_search_analytics_dashboard(
            tenant_id, days
        )

        if not analytics_data:
            raise HTTPException(status_code=404, detail="Analytics data not found")

        return SearchAnalyticsResponse(**analytics_data)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get search analytics: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve analytics")


@router.post("/click")
@limiter.limit("200/minute")  # Higher limit for click events
async def record_result_click(
    request: ClickEventRequest, current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Record search result click event

    Used to track user engagement and improve search relevance.

    Args:
        request: Click event data
        current_user: Authenticated user

    Returns:
        Success confirmation
    """

    current_user["tenant_id"]
    current_user["user_id"]

    try:
        # Validate search_id belongs to user (security check)
        # In production, would verify search_id exists and belongs to user

        await search_monitoring.record_result_click(
            search_id=request.search_id,
            result_position=request.result_position,
            document_id=request.document_id,
            click_timestamp=request.timestamp or datetime.utcnow(),
        )

        return {"status": "success", "message": "Click event recorded"}

    except Exception as e:
        logger.error(f"Failed to record click event: {e}")
        raise HTTPException(status_code=500, detail="Failed to record click")


@router.get("/health")
async def health_check():
    """
    Search service health check

    Returns health status of search components including vector database,
    cache, and monitoring services.

    Returns:
        Health status information
    """

    try:
        # Check vector search service health
        vector_search_healthy = vector_search_service.db_pool is not None

        # Check monitoring service health
        monitoring_healthy = (
            search_monitoring.db_pool is not None
            and search_monitoring.redis is not None
        )

        # Get performance metrics
        real_time_metrics = await search_monitoring.get_real_time_metrics()

        health_status = {
            "status": "healthy"
            if (vector_search_healthy and monitoring_healthy)
            else "unhealthy",
            "timestamp": datetime.utcnow().isoformat(),
            "services": {
                "vector_search": "healthy" if vector_search_healthy else "unhealthy",
                "monitoring": "healthy" if monitoring_healthy else "unhealthy",
            },
            "performance": {
                "avg_duration_ms": real_time_metrics.get("avg_duration_ms", 0),
                "cache_hit_rate": real_time_metrics.get("cache_hit_rate", 0),
                "error_rate": real_time_metrics.get("error_rate", 0),
                "active_searches": real_time_metrics.get("total_searches", 0),
            },
        }

        status_code = 200 if health_status["status"] == "healthy" else 503
        return JSONResponse(content=health_status, status_code=status_code)

    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return JSONResponse(
            content={
                "status": "unhealthy",
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat(),
            },
            status_code=503,
        )


@router.get("/metrics")
async def get_metrics(current_user: Dict[str, Any] = Depends(get_current_user)):
    """
    Get Prometheus metrics for monitoring

    Returns Prometheus-compatible metrics for search service monitoring.
    Only accessible to authenticated users with admin permissions.
    """

    current_user["tenant_id"]

    # Check if user has admin permissions
    if not current_user.get("is_admin", False):
        raise HTTPException(status_code=403, detail="Admin access required")

    try:
        metrics_data = await search_monitoring.get_prometheus_metrics()

        return JSONResponse(content=metrics_data, media_type="text/plain")

    except Exception as e:
        logger.error(f"Failed to get metrics: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve metrics")


@router.get("/popular-queries")
async def get_popular_queries(
    days: int = Query(7, ge=1, le=90, description="Number of days to analyze"),
    limit: int = Query(10, ge=1, le=50, description="Maximum number of queries"),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Get most popular search queries

    Returns the most frequently searched queries for analytics and
    search optimization purposes.

    Args:
        days: Number of days to analyze
        limit: Maximum number of queries to return
        current_user: Authenticated user

    Returns:
        List of popular queries with statistics
    """

    tenant_id = current_user["tenant_id"]

    try:
        analytics = await search_monitoring.get_search_analytics_dashboard(
            tenant_id, days
        )
        popular_queries = analytics.get("popular_queries", [])

        return {
            "popular_queries": popular_queries[:limit],
            "analyzed_days": days,
            "total_searches": analytics.get("summary", {}).get("total_searches", 0),
        }

    except Exception as e:
        logger.error(f"Failed to get popular queries: {e}")
        return {"popular_queries": [], "analyzed_days": days, "total_searches": 0}


# Error handlers
@router.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request, exc):
    """Handle rate limit exceeded errors"""

    logger.warning(f"Rate limit exceeded for IP: {get_remote_address(request)}")

    return JSONResponse(
        status_code=429,
        content={
            "error": "Rate limit exceeded",
            "message": "Too many search requests. Please try again later.",
            "retry_after": str(exc.retry_after),
        },
        headers={"Retry-After": str(exc.retry_after)},
    )


@router.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    """Handle HTTP exceptions"""

    logger.error(f"HTTP exception in search API: {exc.status_code} - {exc.detail}")

    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.detail,
            "status_code": exc.status_code,
            "timestamp": datetime.utcnow().isoformat(),
        },
    )


@router.exception_handler(Exception)
async def general_exception_handler(request, exc):
    """Handle general exceptions"""

    logger.error(f"Unhandled exception in search API: {exc}", exc_info=True)

    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "message": "An unexpected error occurred",
            "timestamp": datetime.utcnow().isoformat(),
        },
    )
