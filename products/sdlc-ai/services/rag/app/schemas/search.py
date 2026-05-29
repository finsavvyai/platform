"""
Pydantic schemas for search API requests and responses
"""

from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict, Any, Union
from datetime import datetime
from enum import Enum


class RankingStrategyEnum(str, Enum):
    """Ranking strategy options"""

    SEMANTIC_ONLY = "semantic_only"
    HYBRID_SEMANTIC_KEYWORD = "hybrid_semantic_keyword"
    PERSONALIZED = "personalized"
    RECENCY_WEIGHTED = "recency_weighted"
    DIVERSITY_WEIGHTED = "diversity_weighted"
    AUTHORITY_WEIGHTED = "authority_weighted"


class SearchModeEnum(str, Enum):
    """Search mode options"""

    FAST = "fast"
    ACCURATE = "accurate"
    BALANCED = "balanced"


class SearchRequest(BaseModel):
    """Search request schema"""

    query: str = Field(
        ..., description="Search query text", min_length=1, max_length=1000
    )
    embedding: Optional[List[float]] = Field(
        None, description="Pre-computed query embedding"
    )
    filters: Optional[Dict[str, Any]] = Field(None, description="Search filters")
    limit: Optional[int] = Field(
        10, description="Maximum number of results", ge=1, le=100
    )
    offset: Optional[int] = Field(0, description="Results offset", ge=0)
    ranking_strategy: Optional[RankingStrategyEnum] = Field(
        RankingStrategyEnum.HYBRID_SEMANTIC_KEYWORD,
        description="Ranking strategy to use",
    )
    search_mode: Optional[SearchModeEnum] = Field(
        SearchModeEnum.BALANCED, description="Search mode (speed vs accuracy)"
    )
    boost_recent: Optional[bool] = Field(True, description="Boost recent documents")
    boost_authority: Optional[bool] = Field(
        True, description="Boost authoritative sources"
    )
    diversity_threshold: Optional[float] = Field(
        0.7, description="Diversity threshold (0-1)", ge=0.0, le=1.0
    )
    include_metadata: Optional[bool] = Field(
        True, description="Include document metadata"
    )
    include_explanations: Optional[bool] = Field(
        False, description="Include ranking explanations"
    )
    context_window_size: Optional[int] = Field(
        4000, description="Context window size in tokens", ge=1000, le=32000
    )
    min_relevance_score: Optional[float] = Field(
        0.0, description="Minimum relevance score", ge=0.0, le=1.0
    )

    @validator("embedding")
    def validate_embedding(cls, v):
        if v is not None:
            if len(v) not in [384, 768, 1536]:  # Common embedding sizes
                raise ValueError("Embedding must be of valid size (384, 768, or 1536)")
        return v

    @validator("filters")
    def validate_filters(cls, v):
        if v is not None:
            # Validate filter structure
            valid_filter_keys = {
                "document_type",
                "source_type",
                "author",
                "date_range",
                "topics",
                "tags",
                "language",
                "min_rating",
                "max_rating",
            }
            for key in v.keys():
                if key not in valid_filter_keys:
                    raise ValueError(f"Invalid filter key: {key}")

            # Validate date_range filter
            if "date_range" in v:
                date_range = v["date_range"]
                if not isinstance(date_range, dict):
                    raise ValueError("date_range must be a dictionary")
                if "start" in date_range:
                    try:
                        datetime.fromisoformat(
                            date_range["start"].replace("Z", "+00:00")
                        )
                    except:
                        raise ValueError("Invalid start date format")
                if "end" in date_range:
                    try:
                        datetime.fromisoformat(date_range["end"].replace("Z", "+00:00"))
                    except:
                        raise ValueError("Invalid end date format")

        return v

    class Config:
        use_enum_values = True
        schema_extra = {
            "example": {
                "query": "machine learning algorithms for text classification",
                "filters": {
                    "document_type": "pdf",
                    "date_range": {
                        "start": "2023-01-01T00:00:00Z",
                        "end": "2024-01-01T00:00:00Z",
                    },
                    "topics": ["machine learning", "nlp"],
                },
                "limit": 10,
                "ranking_strategy": "hybrid_semantic_keyword",
                "boost_recent": True,
                "include_explanations": True,
            }
        }


class SearchResultItem(BaseModel):
    """Single search result item"""

    chunk_id: str = Field(..., description="Chunk ID")
    document_id: str = Field(..., description="Document ID")
    content: str = Field(..., description="Chunk content")
    metadata: Dict[str, Any] = Field(
        default_factory=dict, description="Document metadata"
    )
    score: float = Field(..., description="Final ranking score", ge=0.0, le=1.0)
    rank: int = Field(..., description="Result rank", ge=1)
    highlights: List[str] = Field(default_factory=list, description="Search highlights")
    explanation: Optional[Dict[str, Any]] = Field(
        None, description="Ranking explanation"
    )
    score_breakdown: Dict[str, float] = Field(..., description="Score breakdown")


class SearchMetrics(BaseModel):
    """Search performance metrics"""

    search_time_ms: float = Field(
        ..., description="Vector search time in milliseconds", ge=0.0
    )
    ranking_time_ms: float = Field(
        ..., description="Ranking time in milliseconds", ge=0.0
    )
    total_time_ms: float = Field(..., description="Total time in milliseconds", ge=0.0)
    cache_hit: bool = Field(..., description="Whether the result was served from cache")
    index_type: str = Field(..., description="Type of index used")
    query_complexity: str = Field(..., description="Query complexity level")
    average_score: float = Field(
        ..., description="Average relevance score", ge=0.0, le=1.0
    )
    score_distribution: Dict[str, int] = Field(..., description="Score distribution")


class SearchResponse(BaseModel):
    """Search response schema"""

    success: bool = Field(True, description="Request success status")
    data: Dict[str, Any] = Field(..., description="Search results data")
    meta: Dict[str, Any] = Field(..., description="Response metadata")
    metrics: Optional[SearchMetrics] = Field(None, description="Search metrics")

    class Config:
        schema_extra = {
            "example": {
                "success": True,
                "data": {
                    "query": "machine learning",
                    "results": [
                        {
                            "chunk_id": "chunk_123",
                            "document_id": "doc_456",
                            "content": "Machine learning is a subset of artificial intelligence...",
                            "metadata": {
                                "title": "Introduction to Machine Learning",
                                "author": "John Doe",
                                "source_type": "peer_reviewed",
                            },
                            "score": 0.95,
                            "rank": 1,
                            "highlights": [
                                "Machine learning is a subset of artificial intelligence"
                            ],
                            "score_breakdown": {
                                "relevance": 0.92,
                                "semantic": 0.95,
                                "keyword": 0.88,
                                "authority": 0.90,
                                "recency": 0.85,
                                "diversity": 1.0,
                                "personalized": 1.0,
                            },
                        }
                    ],
                    "total_results": 150,
                    "returned_results": 10,
                },
                "meta": {
                    "request_id": "req_1698624000000_1234",
                    "timestamp": "2024-10-29T10:00:00Z",
                    "version": "v1",
                },
                "metrics": {
                    "search_time_ms": 45.5,
                    "ranking_time_ms": 12.3,
                    "total_time_ms": 57.8,
                    "cache_hit": False,
                    "index_type": "vectorize",
                    "query_complexity": "medium",
                    "average_score": 0.82,
                    "score_distribution": {"0.8-1.0": 8, "0.6-0.8": 2},
                },
            }
        }


class SearchAnalyticsSummary(BaseModel):
    """Search analytics summary"""

    total_queries: int = Field(..., description="Total queries", ge=0)
    successful_queries: int = Field(..., description="Successful queries", ge=0)
    failed_queries: int = Field(..., description="Failed queries", ge=0)
    success_rate: float = Field(..., description="Success rate", ge=0.0, le=1.0)
    error_rate: float = Field(..., description="Error rate", ge=0.0, le=1.0)


class SearchAnalyticsPerformance(BaseModel):
    """Search performance metrics"""

    average_search_time_ms: float = Field(
        ..., description="Average search latency", ge=0.0
    )
    p95_search_time_ms: float = Field(
        ..., description="95th percentile latency", ge=0.0
    )
    p99_search_time_ms: float = Field(
        ..., description="99th percentile latency", ge=0.0
    )
    cache_hit_rate: float = Field(..., description="Cache hit rate", ge=0.0, le=1.0)
    average_relevance_score: float = Field(
        ..., description="Average relevance score", ge=0.0, le=1.0
    )
    concurrent_peak: int = Field(..., description="Peak concurrent queries", ge=0)


class SearchAnalyticsInsights(BaseModel):
    """Search analytics insights"""

    top_queries: List[Dict[str, Union[str, int]]] = Field(
        ..., description="Top search queries"
    )
    ranking_strategy_usage: Dict[str, int] = Field(
        ..., description="Ranking strategy usage"
    )
    query_complexity_distribution: Dict[str, int] = Field(
        ..., description="Query complexity distribution"
    )
    index_type_usage: Dict[str, int] = Field(..., description="Index type usage")


class SearchAlert(BaseModel):
    """Search alert information"""

    alert_id: str = Field(..., description="Alert ID")
    severity: str = Field(..., description="Alert severity")
    message: str = Field(..., description="Alert message")
    timestamp: str = Field(..., description="Alert timestamp")
    metric_type: str = Field(..., description="Metric type")
    current_value: Union[float, int, str] = Field(..., description="Current value")
    threshold_value: Union[float, int, str] = Field(..., description="Threshold value")


class SearchAnalyticsData(BaseModel):
    """Search analytics data"""

    time_period: str = Field(..., description="Time period")
    summary: SearchAnalyticsSummary = Field(..., description="Analytics summary")
    performance: SearchAnalyticsPerformance = Field(
        ..., description="Performance metrics"
    )
    insights: SearchAnalyticsInsights = Field(..., description="Analytics insights")
    alerts: List[SearchAlert] = Field(..., description="Active alerts")


class SearchAnalyticsResponse(BaseModel):
    """Search analytics response"""

    success: bool = Field(True, description="Request success status")
    data: SearchAnalyticsData = Field(..., description="Analytics data")
    meta: Dict[str, str] = Field(..., description="Response metadata")


class AlertResolveResponse(BaseModel):
    """Alert resolution response"""

    success: bool = Field(True, description="Request success status")
    data: Dict[str, Union[str, bool]] = Field(..., description="Resolution data")
    meta: Dict[str, str] = Field(..., description="Response metadata")


class RankingStrategyInfo(BaseModel):
    """Ranking strategy information"""

    name: str = Field(..., description="Strategy name")
    description: str = Field(..., description="Strategy description")
    use_cases: List[str] = Field(..., description="Use cases")
    performance: str = Field(..., description="Performance rating")
    accuracy: str = Field(..., description="Accuracy rating")


class RankingStrategiesResponse(BaseModel):
    """Available ranking strategies response"""

    success: bool = Field(True, description="Request success status")
    data: Dict[str, RankingStrategyInfo] = Field(..., description="Strategies data")
    meta: Dict[str, str] = Field(..., description="Response metadata")


class HealthComponent(BaseModel):
    """Health check component"""

    status: str = Field(..., description="Component status")
    type: Optional[str] = Field(None, description="Component type")
    last_updated: Optional[str] = Field(None, description="Last update time")
    hit_rate: Optional[float] = Field(None, description="Cache hit rate")
    average_latency_ms: Optional[float] = Field(None, description="Average latency")
    success_rate: Optional[float] = Field(None, description="Success rate")


class SearchHealthMetrics(BaseModel):
    """Search health metrics"""

    queries_last_hour: int = Field(..., description="Queries in last hour", ge=0)
    average_latency_ms: float = Field(..., description="Average latency", ge=0.0)
    cache_hit_rate: float = Field(..., description="Cache hit rate", ge=0.0, le=1.0)
    active_alerts: int = Field(..., description="Active alerts", ge=0)
    critical_alerts: int = Field(..., description="Critical alerts", ge=0)
    high_alerts: int = Field(..., description="High severity alerts", ge=0)


class SearchHealthData(BaseModel):
    """Search health data"""

    status: str = Field(..., description="Overall status")
    timestamp: str = Field(..., description="Health check timestamp")
    version: str = Field(..., description="Service version")
    components: Dict[str, HealthComponent] = Field(..., description="Component health")
    metrics: SearchHealthMetrics = Field(..., description="Health metrics")


class SearchHealthResponse(BaseModel):
    """Search health check response"""

    success: bool = Field(True, description="Request success status")
    data: SearchHealthData = Field(..., description="Health data")
    meta: Dict[str, str] = Field(..., description="Response metadata")


class ErrorResponse(BaseModel):
    """Error response schema"""

    success: bool = Field(False, description="Request success status")
    error: Dict[str, Any] = Field(..., description="Error details")
    data: Optional[Dict[str, Any]] = Field(None, description="Additional error data")

    class Config:
        schema_extra = {
            "example": {
                "success": False,
                "error": {
                    "code": "SEARCH_FAILED",
                    "message": "Search operation failed",
                    "details": "Vector index temporarily unavailable",
                },
                "data": {"status": "unhealthy", "timestamp": "2024-10-29T10:00:00Z"},
            }
        }
