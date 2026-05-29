"""
Search Monitoring Service

Provides real-time analytics and monitoring for vector search operations.
Comprehensive metrics collection, performance tracking, and alerting
for search operations.

Key Features:
- Real-time search performance metrics
- Search quality monitoring and analytics
- User behavior tracking and insights
- Automatic alerting for performance issues
- Comprehensive search statistics and reporting
"""

import os
import time
import json
import asyncio
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
from enum import Enum
from collections import defaultdict, deque
import numpy as np
from redis.asyncio import Redis
import asyncpg
from prometheus_client import Counter, Histogram, Gauge, Info, CollectorRegistry

from ..database.core import get_database
from .config import get_settings
from ..utils.logging import get_logger

logger = get_logger(__name__)
settings = get_settings()


class SearchEventType(str, Enum):
    SEARCH_INITIATED = "search_initiated"
    SEARCH_COMPLETED = "search_completed"
    SEARCH_FAILED = "search_failed"
    SEARCH_TIMEOUT = "search_timeout"
    SEARCH_CACHE_HIT = "search_cache_hit"
    SEARCH_CACHE_MISS = "search_cache_miss"
    RESULT_CLICKED = "result_clicked"
    ZERO_RESULTS = "zero_results"
    LOW_QUALITY_RESULTS = "low_quality_results"


@dataclass
class SearchMetrics:
    tenant_id: str
    user_id: Optional[str]
    query_text: str
    search_type: str
    ranking_algorithm: str
    result_count: int
    duration_ms: float
    cache_hit: bool
    avg_similarity_score: float
    filters_applied: bool
    timestamp: datetime
    client_ip: Optional[str]
    user_agent: Optional[str]
    session_id: Optional[str]
    error_type: Optional[str]
    error_message: Optional[str]


@dataclass
class SearchResultMetrics:
    result_position: int
    score: float
    rank_score: float
    similarity_score: float
    authority_score: float
    recency_score: float
    clicked: bool
    dwell_time_ms: Optional[float]
    query_result_interaction: str


class SearchMonitoringService:
    """Comprehensive search monitoring and analytics service"""

    def __init__(self):
        self.redis: Optional[Redis] = None
        self.db_pool: Optional[asyncpg.Pool] = None
        self._prometheus_registry = CollectorRegistry()
        self._initialize_metrics()
        self._initialize_services()

        # Real-time metrics tracking
        self._recent_searches = deque(maxlen=10000)
        self._search_metrics_history = defaultdict(lambda: deque(maxlen=1000))
        self._alert_thresholds = {
            "slow_search_threshold": 2000,  # 2 seconds
            "zero_results_threshold": 0.1,  # 10% threshold
            "low_quality_threshold": 0.3,  # 30% of results below threshold
            "error_rate_threshold": 0.05,  # 5% error rate
        }

    def _initialize_metrics(self):
        """Initialize Prometheus metrics"""

        # Counters
        self.search_total = Counter(
            "search_total",
            "Total search requests",
            ["tenant_id", "search_type", "ranking", "status"],
            registry=self._prometheus_registry,
        )

        self.cache_hits = Counter(
            "search_cache_hits_total",
            "Total cache hits",
            ["tenant_id"],
            registry=self._prometheus_registry,
        )

        self.cache_misses = Counter(
            "search_cache_misses_total",
            "Total cache misses",
            ["tenant_id"],
            registry=self._prometheus_registry,
        )

        self.result_clicks = Counter(
            "search_result_clicks_total",
            "Total result clicks",
            ["tenant_id", "position"],
            registry=self._prometheus_registry,
        )

        # Histograms
        self.search_duration = Histogram(
            "search_duration_seconds",
            "Search request duration",
            ["tenant_id", "search_type"],
            buckets=[0.001, 0.01, 0.05, 0.1, 0.5, 1.0, 2.0, 5.0],
            registry=self._prometheus_registry,
        )

        self.result_score_histogram = Histogram(
            "search_result_scores",
            "Search result scores",
            ["tenant_id", "score_type"],
            buckets=np.linspace(0, 1, 21).tolist(),
            registry=self._prometheus_registry,
        )

        # Gauges
        self.active_searches = Gauge(
            "search_active_requests",
            "Currently active search requests",
            ["tenant_id"],
            registry=self._prometheus_registry,
        )

        self.cache_hit_rate = Gauge(
            "search_cache_hit_rate",
            "Cache hit rate",
            ["tenant_id"],
            registry=self._prometheus_registry,
        )

        self.avg_search_duration = Gauge(
            "search_avg_duration_seconds",
            "Average search duration",
            ["tenant_id"],
            registry=self._prometheus_registry,
        )

        self.zero_results_rate = Gauge(
            "search_zero_results_rate",
            "Rate of searches with zero results",
            ["tenant_id"],
            registry=self._prometheus_registry,
        )

    async def _initialize_services(self):
        """Initialize Redis and database connections"""
        try:
            self.redis = Redis.from_url(
                settings.redis_url, encoding="utf-8", decode_responses=True
            )

            self.db_pool = await asyncpg.create_pool(
                settings.database_url, min_size=5, max_size=20, command_timeout=60
            )

            logger.info("Search monitoring service initialized")

            # Start background tasks
            asyncio.create_task(self._metrics_aggregation_loop())
            asyncio.create_task(self._alert_monitoring_loop())
            asyncio.create_task(self._cleanup_old_data())

        except Exception as e:
            logger.error(f"Failed to initialize search monitoring: {e}")
            raise

    async def record_search_start(
        self,
        tenant_id: str,
        user_id: Optional[str],
        query_text: str,
        search_type: str,
        ranking_algorithm: str,
        client_ip: Optional[str] = None,
        user_agent: Optional[str] = None,
        session_id: Optional[str] = None,
    ) -> str:
        """Record search initiation and return search_id"""

        search_id = f"{tenant_id}:{int(time.time() * 1000000)}"  # Microsecond precision

        start_data = {
            "search_id": search_id,
            "tenant_id": tenant_id,
            "user_id": user_id,
            "query_text": query_text,
            "search_type": search_type,
            "ranking_algorithm": ranking_algorithm,
            "client_ip": client_ip,
            "user_agent": user_agent,
            "session_id": session_id,
            "start_time": time.time(),
        }

        # Store in Redis for tracking
        await self.redis.hset(f"search:{search_id}", mapping=start_data)

        # Set expiration (24 hours)
        await self.redis.expire(f"search:{search_id}", 86400)

        # Increment active searches gauge
        self.active_searches.labels(tenant_id=tenant_id).inc()

        # Record search initiated event
        await self._record_event(
            tenant_id,
            user_id,
            SearchEventType.SEARCH_INITIATED,
            {
                "search_id": search_id,
                "query_length": len(query_text),
                "search_type": search_type,
                "ranking": ranking_algorithm,
            },
        )

        return search_id

    async def record_search_completion(
        self,
        search_id: str,
        result_count: int,
        duration_ms: float,
        cache_hit: bool,
        avg_similarity_score: float,
        filters_applied: bool,
        results_metrics: List[SearchResultMetrics] = None,
    ) -> None:
        """Record successful search completion"""

        try:
            # Get search data from Redis
            search_data = await self.redis.hgetall(f"search:{search_id}")
            if not search_data:
                logger.warning(f"Search data not found for ID: {search_id}")
                return

            tenant_id = search_data["tenant_id"]
            user_id = search_data.get("user_id")
            start_time = float(search_data["start_time"])

            # Create search metrics
            metrics = SearchMetrics(
                tenant_id=tenant_id,
                user_id=user_id,
                query_text=search_data["query_text"],
                search_type=search_data["search_type"],
                ranking_algorithm=search_data["ranking_algorithm"],
                result_count=result_count,
                duration_ms=duration_ms,
                cache_hit=cache_hit,
                avg_similarity_score=avg_similarity_score,
                filters_applied=filters_applied,
                timestamp=datetime.fromtimestamp(start_time + duration_ms / 1000),
                client_ip=search_data.get("client_ip"),
                user_agent=search_data.get("user_agent"),
                session_id=search_data.get("session_id"),
                error_type=None,
                error_message=None,
            )

            # Record in Prometheus
            self.search_total.labels(
                tenant_id=tenant_id,
                search_type=metrics.search_type,
                ranking=metrics.ranking_algorithm,
                status="success",
            ).inc()

            self.search_duration.labels(
                tenant_id=tenant_id, search_type=metrics.search_type
            ).observe(metrics.duration_ms / 1000)

            if cache_hit:
                self.cache_hits.labels(tenant_id=tenant_id).inc()
            else:
                self.cache_misses.labels(tenant_id=tenant_id).inc()

            # Record result scores
            if results_metrics:
                for result in results_metrics:
                    self.result_score_histogram.labels(
                        tenant_id=tenant_id, score_type="similarity"
                    ).observe(result.similarity_score)

                    self.result_score_histogram.labels(
                        tenant_id=tenant_id, score_type="rank"
                    ).observe(result.rank_score)

                    self.result_score_histogram.labels(
                        tenant_id=tenant_id, score_type="authority"
                    ).observe(result.authority_score)

            # Store metrics
            await self._store_metrics(metrics)
            self._recent_searches.append(asdict(metrics))
            self._search_metrics_history[tenant_id].append(asdict(metrics))

            # Decrement active searches gauge
            self.active_searches.labels(tenant_id=tenant_id).dec()

            # Record completion event
            await self._record_event(
                tenant_id,
                user_id,
                SearchEventType.SEARCH_COMPLETED,
                {
                    "search_id": search_id,
                    "result_count": result_count,
                    "duration_ms": duration_ms,
                    "cache_hit": cache_hit,
                    "avg_similarity": avg_similarity_score,
                },
            )

            # Check for zero results
            if result_count == 0:
                await self._record_event(
                    tenant_id,
                    user_id,
                    SearchEventType.ZERO_RESULTS,
                    {"search_id": search_id, "query": metrics.query_text},
                )

            # Check for low quality results
            if avg_similarity_score < 0.3:  # Threshold for low quality
                await self._record_event(
                    tenant_id,
                    user_id,
                    SearchEventType.LOW_QUALITY_RESULTS,
                    {
                        "search_id": search_id,
                        "avg_similarity": avg_similarity_score,
                        "result_count": result_count,
                    },
                )

            logger.info(
                f"Search completed - ID: {search_id}, Duration: {duration_ms}ms, Results: {result_count}"
            )

        except Exception as e:
            logger.error(f"Failed to record search completion: {e}")

    async def record_search_failure(
        self,
        search_id: str,
        error_type: str,
        error_message: str,
        duration_ms: Optional[float] = None,
    ) -> None:
        """Record search failure"""

        try:
            search_data = await self.redis.hgetall(f"search:{search_id}")
            if not search_data:
                return

            tenant_id = search_data["tenant_id"]
            user_id = search_data.get("user_id")
            start_time = float(search_data["start_time"])

            if duration_ms is None:
                duration_ms = (time.time() - start_time) * 1000

            metrics = SearchMetrics(
                tenant_id=tenant_id,
                user_id=user_id,
                query_text=search_data["query_text"],
                search_type=search_data["search_type"],
                ranking_algorithm=search_data["ranking_algorithm"],
                result_count=0,
                duration_ms=duration_ms,
                cache_hit=False,
                avg_similarity_score=0.0,
                filters_applied=False,
                timestamp=datetime.fromtimestamp(start_time + duration_ms / 1000),
                client_ip=search_data.get("client_ip"),
                user_agent=search_data.get("user_agent"),
                session_id=search_data.get("session_id"),
                error_type=error_type,
                error_message=error_message,
            )

            # Record failure metrics
            self.search_total.labels(
                tenant_id=tenant_id,
                search_type=metrics.search_type,
                ranking=metrics.ranking_algorithm,
                status="error",
            ).inc()

            await self._store_metrics(metrics)
            self._recent_searches.append(asdict(metrics))

            # Decrement active searches
            self.active_searches.labels(tenant_id=tenant_id).dec()

            # Record failure event
            await self._record_event(
                tenant_id,
                user_id,
                SearchEventType.SEARCH_FAILED,
                {
                    "search_id": search_id,
                    "error_type": error_type,
                    "error_message": error_message,
                    "duration_ms": duration_ms,
                },
            )

            logger.error(f"Search failed - ID: {search_id}, Error: {error_type}")

        except Exception as e:
            logger.error(f"Failed to record search failure: {e}")

    async def record_result_click(
        self,
        search_id: str,
        result_position: int,
        document_id: str,
        click_timestamp: datetime = None,
    ) -> None:
        """Record result click event"""

        try:
            search_data = await self.redis.hgetall(f"search:{search_id}")
            if not search_data:
                return

            tenant_id = search_data["tenant_id"]
            user_id = search_data.get("user_id")

            if click_timestamp is None:
                click_timestamp = datetime.utcnow()

            # Record click metrics
            self.result_clicks.labels(
                tenant_id=tenant_id, position=result_position
            ).inc()

            # Record click event
            await self._record_event(
                tenant_id,
                user_id,
                SearchEventType.RESULT_CLICKED,
                {
                    "search_id": search_id,
                    "result_position": result_position,
                    "document_id": document_id,
                    "timestamp": click_timestamp.isoformat(),
                },
            )

            logger.info(
                f"Result clicked - Search: {search_id}, Position: {result_position}"
            )

        except Exception as e:
            logger.error(f"Failed to record result click: {e}")

    async def record_search_timeout(self, search_id: str, timeout_ms: float) -> None:
        """Record search timeout"""

        await self.record_search_failure(
            search_id, "timeout", f"Search timed out after {timeout_ms}ms", timeout_ms
        )

    async def get_real_time_metrics(
        self, tenant_id: Optional[str] = None, minutes: int = 60
    ) -> Dict[str, Any]:
        """Get real-time search metrics"""

        end_time = time.time()
        start_time = end_time - (minutes * 60)

        # Filter recent searches
        recent_searches = [
            search
            for search in self._recent_searches
            if search["timestamp"].timestamp() >= start_time
        ]

        if tenant_id:
            recent_searches = [
                search for search in recent_searches if search["tenant_id"] == tenant_id
            ]

        if not recent_searches:
            return {
                "total_searches": 0,
                "avg_duration_ms": 0,
                "cache_hit_rate": 0,
                "error_rate": 0,
                "zero_results_rate": 0,
            }

        total_searches = len(recent_searches)
        successful_searches = [s for s in recent_searches if s["error_type"] is None]

        # Calculate metrics
        avg_duration = (
            np.mean([s["duration_ms"] for s in successful_searches])
            if successful_searches
            else 0
        )
        cache_hits = len([s for s in recent_searches if s["cache_hit"]])
        errors = len([s for s in recent_searches if s["error_type"] is not None])
        zero_results = len([s for s in recent_searches if s["result_count"] == 0])

        return {
            "total_searches": total_searches,
            "avg_duration_ms": avg_duration,
            "cache_hit_rate": cache_hits / total_searches if total_searches > 0 else 0,
            "error_rate": errors / total_searches if total_searches > 0 else 0,
            "zero_results_rate": zero_results / total_searches
            if total_searches > 0
            else 0,
            "successful_searches": len(successful_searches),
            "cache_hits": cache_hits,
            "errors": errors,
            "zero_results": zero_results,
        }

    async def get_search_analytics_dashboard(
        self, tenant_id: str, days: int = 30
    ) -> Dict[str, Any]:
        """Get comprehensive search analytics dashboard"""

        try:
            async with self.db_pool.acquire() as conn:
                # Basic metrics
                basic_metrics = await conn.fetchrow(
                    """
                    SELECT
                        COUNT(*) as total_searches,
                        COUNT(DISTINCT user_id) as unique_users,
                        AVG(duration_ms) as avg_duration_ms,
                        COUNT(CASE WHEN result_count = 0 THEN 1 END) as zero_results,
                        COUNT(CASE WHEN error_type IS NOT NULL THEN 1 END) as errors,
                        COUNT(CASE WHEN cache_hit = true THEN 1 END) as cache_hits
                    FROM search_metrics
                    WHERE tenant_id = $1
                        AND timestamp > NOW() - INTERVAL $2 DAY
                """,
                    tenant_id,
                    days,
                )

                # Daily search volume
                daily_volume = await conn.fetch(
                    """
                    SELECT
                        DATE_TRUNC('day', timestamp) as date,
                        COUNT(*) as searches,
                        AVG(duration_ms) as avg_duration,
                        COUNT(CASE WHEN result_count = 0 THEN 1 END) as zero_results,
                        COUNT(CASE WHEN cache_hit = true THEN 1 END) as cache_hits
                    FROM search_metrics
                    WHERE tenant_id = $1
                        AND timestamp > NOW() - INTERVAL $2 DAY
                    GROUP BY DATE_TRUNC('day', timestamp)
                    ORDER BY date DESC
                """,
                    tenant_id,
                    days,
                )

                # Popular queries
                popular_queries = await conn.fetch(
                    """
                    SELECT query_text, COUNT(*) as count, AVG(duration_ms) as avg_duration
                    FROM search_metrics
                    WHERE tenant_id = $1
                        AND timestamp > NOW() - INTERVAL $2 DAY
                        AND result_count > 0
                    GROUP BY query_text
                    ORDER BY count DESC
                    LIMIT 10
                """,
                    tenant_id,
                    days,
                )

                # Search type distribution
                search_types = await conn.fetch(
                    """
                    SELECT search_type, COUNT(*) as count, AVG(duration_ms) as avg_duration
                    FROM search_metrics
                    WHERE tenant_id = $1
                        AND timestamp > NOW() - INTERVAL $2 DAY
                    GROUP BY search_type
                    ORDER BY count DESC
                """,
                    tenant_id,
                    days,
                )

                # Zero results queries
                zero_results_queries = await conn.fetch(
                    """
                    SELECT query_text, COUNT(*) as count
                    FROM search_metrics
                    WHERE tenant_id = $1
                        AND timestamp > NOW() - INTERVAL $2 DAY
                        AND result_count = 0
                    GROUP BY query_text
                    ORDER BY count DESC
                    LIMIT 10
                """,
                    tenant_id,
                    days,
                )

                # Error analysis
                error_analysis = await conn.fetch(
                    """
                    SELECT error_type, COUNT(*) as count, AVG(duration_ms) as avg_duration
                    FROM search_metrics
                    WHERE tenant_id = $1
                        AND timestamp > NOW() - INTERVAL $2 DAY
                        AND error_type IS NOT NULL
                    GROUP BY error_type
                    ORDER BY count DESC
                """,
                    tenant_id,
                    days,
                )

                return {
                    "summary": {
                        "total_searches": basic_metrics["total_searches"],
                        "unique_users": basic_metrics["unique_users"],
                        "avg_duration_ms": float(basic_metrics["avg_duration_ms"] or 0),
                        "error_rate": float(basic_metrics["errors"] or 0)
                        / float(basic_metrics["total_searches"] or 1),
                        "zero_results_rate": float(basic_metrics["zero_results"] or 0)
                        / float(basic_metrics["total_searches"] or 1),
                        "cache_hit_rate": float(basic_metrics["cache_hits"] or 0)
                        / float(basic_metrics["total_searches"] or 1),
                    },
                    "daily_volume": [
                        {
                            "date": row["date"].isoformat(),
                            "searches": row["searches"],
                            "avg_duration_ms": float(row["avg_duration"] or 0),
                            "zero_results": row["zero_results"],
                            "cache_hits": row["cache_hits"],
                        }
                        for row in daily_volume
                    ],
                    "popular_queries": [
                        {
                            "query": row["query_text"],
                            "count": row["count"],
                            "avg_duration_ms": float(row["avg_duration"] or 0),
                        }
                        for row in popular_queries
                    ],
                    "search_types": [
                        {
                            "type": row["search_type"],
                            "count": row["count"],
                            "avg_duration_ms": float(row["avg_duration"] or 0),
                        }
                        for row in search_types
                    ],
                    "zero_results_queries": [
                        {"query": row["query_text"], "count": row["count"]}
                        for row in zero_results_queries
                    ],
                    "error_analysis": [
                        {
                            "type": row["error_type"],
                            "count": row["count"],
                            "avg_duration_ms": float(row["avg_duration"] or 0),
                        }
                        for row in error_analysis
                    ],
                }

        except Exception as e:
            logger.error(f"Failed to get search analytics dashboard: {e}")
            return {}

    async def _store_metrics(self, metrics: SearchMetrics) -> None:
        """Store search metrics in database"""

        try:
            async with self.db_pool.acquire() as conn:
                await conn.execute(
                    """
                    INSERT INTO search_metrics (
                        tenant_id, user_id, query_text, search_type, ranking_algorithm,
                        result_count, duration_ms, cache_hit, avg_similarity_score,
                        filters_applied, timestamp, client_ip, user_agent, session_id,
                        error_type, error_message
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
                """,
                    *[
                        metrics.tenant_id,
                        metrics.user_id,
                        metrics.query_text,
                        metrics.search_type,
                        metrics.ranking_algorithm,
                        metrics.result_count,
                        metrics.duration_ms,
                        metrics.cache_hit,
                        metrics.avg_similarity_score,
                        metrics.filters_applied,
                        metrics.timestamp,
                        metrics.client_ip,
                        metrics.user_agent,
                        metrics.session_id,
                        metrics.error_type,
                        metrics.error_message,
                    ],
                )

        except Exception as e:
            logger.error(f"Failed to store search metrics: {e}")

    async def _record_event(
        self,
        tenant_id: str,
        user_id: Optional[str],
        event_type: SearchEventType,
        metadata: Dict[str, Any],
    ) -> None:
        """Record search event in event stream"""

        event_data = {
            "tenant_id": tenant_id,
            "user_id": user_id,
            "event_type": event_type.value,
            "metadata": metadata,
            "timestamp": datetime.utcnow().isoformat(),
        }

        try:
            # Store in Redis stream
            await self.redis.xadd("search_events", event_data)

        except Exception as e:
            logger.error(f"Failed to record search event: {e}")

    async def _metrics_aggregation_loop(self):
        """Background task to aggregate metrics periodically"""

        while True:
            try:
                await asyncio.sleep(60)  # Aggregate every minute

                # Calculate and update gauges for each tenant
                for tenant_id, history in self._search_metrics_history.items():
                    if not history:
                        continue

                    recent_history = [
                        search
                        for search in history
                        if search["timestamp"].timestamp()
                        > time.time() - 300  # Last 5 minutes
                    ]

                    if not recent_history:
                        continue

                    # Update cache hit rate
                    cache_hits = len([s for s in recent_history if s["cache_hit"]])
                    cache_hit_rate = cache_hits / len(recent_history)
                    self.cache_hit_rate.labels(tenant_id=tenant_id).set(cache_hit_rate)

                    # Update average duration
                    successful_searches = [
                        s for s in recent_history if s["error_type"] is None
                    ]
                    if successful_searches:
                        avg_duration = np.mean(
                            [s["duration_ms"] for s in successful_searches]
                        )
                        self.avg_search_duration.labels(tenant_id=tenant_id).set(
                            avg_duration / 1000
                        )

                    # Update zero results rate
                    zero_results = len(
                        [s for s in recent_history if s["result_count"] == 0]
                    )
                    zero_results_rate = zero_results / len(recent_history)
                    self.zero_results_rate.labels(tenant_id=tenant_id).set(
                        zero_results_rate
                    )

            except Exception as e:
                logger.error(f"Error in metrics aggregation loop: {e}")

    async def _alert_monitoring_loop(self):
        """Background task to monitor for alert conditions"""

        while True:
            try:
                await asyncio.sleep(30)  # Check every 30 seconds

                # Get real-time metrics for all tenants
                for tenant_id in self._search_metrics_history.keys():
                    metrics = await self.get_real_time_metrics(
                        tenant_id, 5
                    )  # Last 5 minutes

                    if metrics["total_searches"] < 10:  # Skip if too few searches
                        continue

                    # Check for slow searches
                    if (
                        metrics["avg_duration_ms"]
                        > self._alert_thresholds["slow_search_threshold"]
                    ):
                        await self._send_alert(
                            tenant_id,
                            "slow_searches",
                            f"Average search duration is {metrics['avg_duration_ms']:.0f}ms",
                        )

                    # Check for high error rate
                    if (
                        metrics["error_rate"]
                        > self._alert_thresholds["error_rate_threshold"]
                    ):
                        await self._send_alert(
                            tenant_id,
                            "high_error_rate",
                            f"Search error rate is {metrics['error_rate']:.2%}",
                        )

                    # Check for high zero results rate
                    if (
                        metrics["zero_results_rate"]
                        > self._alert_thresholds["zero_results_threshold"]
                    ):
                        await self._send_alert(
                            tenant_id,
                            "high_zero_results_rate",
                            f"Zero results rate is {metrics['zero_results_rate']:.2%}",
                        )

            except Exception as e:
                logger.error(f"Error in alert monitoring loop: {e}")

    async def _cleanup_old_data(self):
        """Background task to clean up old data"""

        while True:
            try:
                await asyncio.sleep(3600)  # Cleanup every hour

                # Clean up old search tracking data
                current_time = time.time()
                cutoff_time = current_time - 86400  # 24 hours

                # Remove old data from recent searches
                self._recent_searches = deque(
                    [
                        search
                        for search in self._recent_searches
                        if search["timestamp"].timestamp() > cutoff_time
                    ],
                    maxlen=10000,
                )

                # Clean up old metrics history
                for tenant_id in list(self._search_metrics_history.keys()):
                    self._search_metrics_history[tenant_id] = deque(
                        [
                            search
                            for search in self._search_metrics_history[tenant_id]
                            if search["timestamp"].timestamp() > cutoff_time
                        ],
                        maxlen=1000,
                    )

                logger.info("Cleaned up old search monitoring data")

            except Exception as e:
                logger.error(f"Error in cleanup loop: {e}")

    async def _send_alert(self, tenant_id: str, alert_type: str, message: str) -> None:
        """Send alert notification"""

        alert_data = {
            "tenant_id": tenant_id,
            "alert_type": alert_type,
            "message": message,
            "timestamp": datetime.utcnow().isoformat(),
            "severity": "warning",  # Could be made dynamic
        }

        try:
            # Store alert in database
            async with self.db_pool.acquire() as conn:
                await conn.execute(
                    """
                    INSERT INTO search_alerts (
                        tenant_id, alert_type, message, timestamp, severity, resolved
                    ) VALUES ($1, $2, $3, $4, 'warning', false)
                """,
                    tenant_id,
                    alert_type,
                    message,
                    alert_data["timestamp"],
                )

            # Publish to Redis channel for real-time notifications
            await self.redis.publish(f"alerts:{tenant_id}", json.dumps(alert_data))

            logger.warning(
                f"Alert sent - Tenant: {tenant_id}, Type: {alert_type}, Message: {message}"
            )

        except Exception as e:
            logger.error(f"Failed to send alert: {e}")

    async def get_prometheus_metrics(self) -> str:
        """Get Prometheus metrics in text format"""

        try:
            from prometheus_client.exposition import generate_latest

            return generate_latest(self._prometheus_registry)

        except Exception as e:
            logger.error(f"Failed to generate Prometheus metrics: {e}")
            return ""

    async def close(self):
        """Close all connections"""

        if self.db_pool:
            await self.db_pool.close()

        if self.redis:
            await self.redis.close()
