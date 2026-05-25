"""
Vector Search Service Implementation

Provides advanced vector search capabilities with multiple ranking strategies,
hybrid search, and comprehensive performance monitoring.

Key Features:
- Multiple ranking algorithms (semantic, hybrid, personalized, recency-weighted)
- Cloudflare Vectorize integration with HNSW indexes
- Real-time performance monitoring and analytics
- Advanced filtering and faceted search
- Multi-tenant vector isolation
- Intelligent caching for fast repeated queries
"""

import json
import time
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from dataclasses import dataclass
from enum import Enum
import asyncpg
import numpy as np
from redis.asyncio import Redis

from .config import get_settings
from ..utils.logging import get_logger
from ..utils.metrics import MetricsCollector

logger = get_logger(__name__)
settings = get_settings()
metrics = MetricsCollector()


class SearchRanking(str, Enum):
    SEMANTIC_ONLY = "semantic_only"
    HYBRID = "hybrid"
    PERSONALIZED = "personalized"
    RECENCY_WEIGHTED = "recency_weighted"
    AUTHORITY_WEIGHTED = "authority_weighted"
    DIVERSITY_WEIGHTED = "diversity_weighted"


class SearchType(str, Enum):
    SEMANTIC = "semantic"
    KEYWORD = "keyword"
    HYBRID = "hybrid"


@dataclass
class SearchResult:
    chunk_id: str
    document_id: str
    content: str
    score: float
    rank_score: float
    metadata: Dict[str, Any]
    document_metadata: Dict[str, Any]
    highlights: List[str]
    ranking_explanation: Dict[str, float]
    similarity_score: float
    authority_score: float
    recency_score: float


@dataclass
class SearchQuery:
    text: str
    tenant_id: str
    user_id: Optional[str] = None
    search_type: SearchType = SearchType.HYBRID
    ranking: SearchRanking = SearchRanking.HYBRID
    limit: int = 10
    offset: int = 0
    filters: Optional[Dict[str, Any]] = None
    include_highlights: bool = True
    include_explanations: bool = False
    min_score: float = 0.1
    include_expired: bool = False


class VectorSearchService:
    """Enterprise-grade vector search service with advanced ranking algorithms"""

    def __init__(self):
        self.redis: Optional[Redis] = None
        self.db_pool: Optional[asyncpg.Pool] = None
        self._initialize_services()

    async def _initialize_services(self):
        """Initialize Redis and database connections"""
        try:
            # Initialize Redis for caching
            self.redis = Redis.from_url(
                settings.redis_url, encoding="utf-8", decode_responses=True
            )

            # Initialize asyncpg pool for vector operations
            self.db_pool = await asyncpg.create_pool(
                settings.database_url, min_size=5, max_size=20, command_timeout=60
            )

            logger.info("Vector search service initialized successfully")

        except Exception as e:
            logger.error(f"Failed to initialize vector search service: {e}")
            raise

    async def search(
        self, query: SearchQuery, user_id: Optional[str] = None
    ) -> List[SearchResult]:
        """
        Perform vector search with advanced ranking algorithms

        Args:
            query: Search query with all parameters
            user_id: Optional user ID for personalized ranking

        Returns:
            List of ranked search results
        """
        start_time = time.time()

        try:
            # Generate query embedding
            query_embedding = await self._generate_query_embedding(query.text)

            # Get user preferences for personalization
            user_preferences = {}
            if user_id:
                user_preferences = await self._get_user_preferences(user_id)

            # Perform semantic search
            semantic_results = await self._semantic_search(
                query_embedding, query.tenant_id, query.limit * 3
            )

            # Perform keyword search if hybrid
            keyword_results = []
            if query.search_type in [SearchType.HYBRID, SearchType.KEYWORD]:
                keyword_results = await self._keyword_search(
                    query.text, query.tenant_id, query.limit * 3
                )

            # Combine and rank results
            combined_results = await self._combine_and_rank_results(
                semantic_results,
                keyword_results,
                query,
                query_embedding,
                user_preferences,
            )

            # Apply filters and pagination
            filtered_results = await self._apply_filters_and_pagination(
                combined_results, query
            )

            # Generate highlights and explanations
            final_results = await self._enrich_results(
                filtered_results, query, user_preferences
            )

            # Track search performance
            duration = time.time() - start_time
            metrics.record_search_duration(duration, len(final_results))

            # Cache search results
            await self._cache_search_results(query, final_results)

            return final_results

        except Exception as e:
            logger.error(f"Search failed for query '{query.text}': {e}")
            metrics.record_search_error()
            raise

    async def _semantic_search(
        self, embedding: List[float], tenant_id: str, limit: int
    ) -> List[Dict[str, Any]]:
        """Perform semantic similarity search using pgvector"""

        cache_key = f"semantic_search:{hash(str(embedding[:10]))}:{tenant_id}:{limit}"

        # Try cache first
        cached = await self.redis.get(cache_key)
        if cached:
            return json.loads(cached)

        try:
            async with self.db_pool.acquire() as conn:
                # Use HNSW index for fast approximate nearest neighbor
                query = """
                SELECT
                    dc.id as chunk_id,
                    dc.document_id,
                    dc.content,
                    e.embedding <=> $1 as similarity_score,
                    d.metadata as document_metadata,
                    dc.metadata as chunk_metadata,
                    d.authority_score,
                    d.created_at
                FROM document_chunks dc
                JOIN embeddings e ON dc.embedding_id = e.id
                JOIN documents d ON dc.document_id = d.id
                WHERE dc.tenant_id = $2
                    AND dc.is_deleted = false
                    AND d.is_deleted = false
                ORDER BY e.embedding <=> $1
                LIMIT $3
                """

                results = await conn.fetch(query, np.array(embedding), tenant_id, limit)

                # Convert similarity to score (higher is better)
                formatted_results = []
                for row in results:
                    similarity_score = float(row["similarity_score"])
                    score = 1.0 / (
                        1.0 + similarity_score
                    )  # Convert distance to similarity

                    formatted_results.append(
                        {
                            "chunk_id": row["chunk_id"],
                            "document_id": row["document_id"],
                            "content": row["content"],
                            "similarity_score": similarity_score,
                            "score": score,
                            "document_metadata": json.loads(row["document_metadata"])
                            if row["document_metadata"]
                            else {},
                            "chunk_metadata": json.loads(row["chunk_metadata"])
                            if row["chunk_metadata"]
                            else {},
                            "authority_score": row["authority_score"] or 0.0,
                            "created_at": row["created_at"],
                        }
                    )

                # Cache results for 5 minutes
                await self.redis.setex(
                    cache_key, 300, json.dumps(formatted_results, default=str)
                )

                return formatted_results

        except Exception as e:
            logger.error(f"Semantic search failed: {e}")
            raise

    async def _keyword_search(
        self, query_text: str, tenant_id: str, limit: int
    ) -> List[Dict[str, Any]]:
        """Perform keyword-based search using PostgreSQL full-text search"""

        try:
            async with self.db_pool.acquire() as conn:
                # Use pg_trgm for fuzzy matching and tsvector for full-text search
                query = """
                SELECT
                    dc.id as chunk_id,
                    dc.document_id,
                    dc.content,
                    ts_rank_cd(dc.search_vector, websearch_to_tsquery('english', $1)) as keyword_score,
                    similarity(dc.content, $1) as similarity_score,
                    d.metadata as document_metadata,
                    dc.metadata as chunk_metadata,
                    d.authority_score,
                    d.created_at
                FROM document_chunks dc
                JOIN documents d ON dc.document_id = d.id
                WHERE dc.tenant_id = $2
                    AND dc.is_deleted = false
                    AND d.is_deleted = false
                    AND (dc.search_vector @@ websearch_to_tsquery('english', $1)
                         OR dc.content % $1)
                ORDER BY
                    ts_rank_cd(dc.search_vector, websearch_to_tsquery('english', $1)) DESC,
                    similarity(dc.content, $1) DESC
                LIMIT $3
                """

                results = await conn.fetch(query, query_text, tenant_id, limit)

                formatted_results = []
                for row in results:
                    formatted_results.append(
                        {
                            "chunk_id": row["chunk_id"],
                            "document_id": row["document_id"],
                            "content": row["content"],
                            "keyword_score": row["keyword_score"],
                            "similarity_score": row["similarity_score"],
                            "score": row[
                                "keyword_score"
                            ],  # Use keyword score as primary
                            "document_metadata": json.loads(row["document_metadata"])
                            if row["document_metadata"]
                            else {},
                            "chunk_metadata": json.loads(row["chunk_metadata"])
                            if row["chunk_metadata"]
                            else {},
                            "authority_score": row["authority_score"] or 0.0,
                            "created_at": row["created_at"],
                        }
                    )

                return formatted_results

        except Exception as e:
            logger.error(f"Keyword search failed: {e}")
            raise

    async def _combine_and_rank_results(
        self,
        semantic_results: List[Dict[str, Any]],
        keyword_results: List[Dict[str, Any]],
        query: SearchQuery,
        query_embedding: List[float],
        user_preferences: Dict[str, Any],
    ) -> List[Dict[str, Any]]:
        """Combine semantic and keyword results with advanced ranking algorithms"""

        combined = {}

        # Add semantic results
        for result in semantic_results:
            chunk_id = result["chunk_id"]
            if chunk_id not in combined:
                combined[chunk_id] = result
                combined[chunk_id]["semantic_score"] = result["score"]
                combined[chunk_id]["keyword_score"] = 0.0

        # Add/merge keyword results
        for result in keyword_results:
            chunk_id = result["chunk_id"]
            if chunk_id in combined:
                # Merge with existing result
                combined[chunk_id]["keyword_score"] = result.get(
                    "keyword_score", result["score"]
                )
                # Recombine scores for hybrid search
                combined[chunk_id]["score"] = self._calculate_hybrid_score(
                    combined[chunk_id]["semantic_score"],
                    result.get("keyword_score", result["score"]),
                )
            else:
                # Add new result
                combined[chunk_id] = result
                combined[chunk_id]["semantic_score"] = 0.0
                combined[chunk_id]["keyword_score"] = result.get(
                    "keyword_score", result["score"]
                )

        # Apply ranking algorithm
        for result in combined.values():
            result["rank_score"] = await self._calculate_rank_score(
                result, query, query_embedding, user_preferences
            )

        # Sort by final rank score
        sorted_results = sorted(
            combined.values(), key=lambda x: x["rank_score"], reverse=True
        )

        return sorted_results

    def _calculate_hybrid_score(
        self, semantic_score: float, keyword_score: float
    ) -> float:
        """Calculate combined hybrid score with weighted combination"""
        # 60% semantic, 40% keyword by default
        return 0.6 * semantic_score + 0.4 * keyword_score

    async def _calculate_rank_score(
        self,
        result: Dict[str, Any],
        query: SearchQuery,
        query_embedding: List[float],
        user_preferences: Dict[str, Any],
    ) -> float:
        """Calculate final ranking score based on selected ranking algorithm"""

        base_score = result["score"]

        if query.ranking == SearchRanking.SEMANTIC_ONLY:
            return base_score

        elif query.ranking == SearchRanking.HYBRID:
            return self._calculate_hybrid_ranking(result, query)

        elif query.ranking == SearchRanking.PERSONALIZED:
            return self._calculate_personalized_ranking(result, query, user_preferences)

        elif query.ranking == SearchRanking.RECENCY_WEIGHTED:
            return self._calculate_recency_weighted_score(result)

        elif query.ranking == SearchRanking.AUTHORITY_WEIGHTED:
            return self._calculate_authority_weighted_score(result)

        elif query.ranking == SearchRanking.DIVERSITY_WEIGHTED:
            return self._calculate_diversity_weighted_score(result, query_embedding)

        return base_score

    def _calculate_hybrid_ranking(
        self, result: Dict[str, Any], query: SearchQuery
    ) -> float:
        """Calculate hybrid ranking with multiple factors"""
        base_score = result["score"]

        # Authority boost
        authority_boost = result.get("authority_score", 0.0) * 0.2

        # Recency boost (last 30 days get 20% boost)
        created_at = result.get("created_at")
        recency_boost = 0.0
        if created_at and (datetime.utcnow() - created_at) < timedelta(days=30):
            recency_boost = 0.2

        return base_score + authority_boost + recency_boost

    def _calculate_personalized_ranking(
        self,
        result: Dict[str, Any],
        query: SearchQuery,
        user_preferences: Dict[str, Any],
    ) -> float:
        """Calculate personalized ranking based on user preferences"""

        base_score = result["score"]

        # Personalization based on user's preferred document types
        doc_type = result["document_metadata"].get("document_type")
        if doc_type and doc_type in user_preferences.get("preferred_types", []):
            base_score *= 1.2  # 20% boost for preferred types

        # Personalization based on user's topic preferences
        topics = result["document_metadata"].get("topics", [])
        user_topics = set(user_preferences.get("preferred_topics", []))
        if topics and set(topics) & user_topics:
            base_score *= 1.15  # 15% boost for topic matches

        return base_score

    def _calculate_recency_weighted_score(self, result: Dict[str, Any]) -> float:
        """Calculate score weighted by recency with exponential decay"""

        base_score = result["score"]
        created_at = result.get("created_at")

        if not created_at:
            return base_score

        # Exponential decay: 50% reduction after 6 months
        age_days = (datetime.utcnow() - created_at).days
        decay_factor = np.exp(-age_days / 180)  # Half-life of 180 days

        return base_score * decay_factor

    def _calculate_authority_weighted_score(self, result: Dict[str, Any]) -> float:
        """Calculate score weighted by document authority"""

        base_score = result["score"]
        authority_score = result.get("authority_score", 0.5)

        # Authority can boost score by up to 50%
        authority_boost = authority_score * 0.5

        return base_score * (1 + authority_boost)

    def _calculate_diversity_weighted_score(
        self, result: Dict[str, Any], query_embedding: List[float]
    ) -> float:
        """Calculate score promoting diversity in results"""

        # This would normally compare with previously selected results
        # For now, return base score with small diversity factor
        base_score = result["score"]

        # Add small randomness to promote diversity (in real implementation)
        diversity_factor = np.random.uniform(0.95, 1.05)

        return base_score * diversity_factor

    async def _apply_filters_and_pagination(
        self, results: List[Dict[str, Any]], query: SearchQuery
    ) -> List[Dict[str, Any]]:
        """Apply filters, minimum score threshold, and pagination"""

        filtered = []

        for result in results:
            # Apply minimum score filter
            if result["rank_score"] < query.min_score:
                continue

            # Apply additional filters
            if query.filters:
                if not await self._apply_filters(result, query.filters):
                    continue

            filtered.append(result)

        # Apply pagination
        offset = query.offset
        limit = query.limit
        return filtered[offset : offset + limit]

    async def _apply_filters(
        self, result: Dict[str, Any], filters: Dict[str, Any]
    ) -> bool:
        """Apply search filters to a result"""

        try:
            # Document type filter
            if "document_type" in filters:
                doc_type = result["document_metadata"].get("document_type")
                if doc_type not in filters["document_type"]:
                    return False

            # Source filter
            if "source" in filters:
                source = result["document_metadata"].get("source")
                if source not in filters["source"]:
                    return False

            # Date range filter
            if "date_range" in filters:
                date_range = filters["date_range"]
                created_at = result.get("created_at")
                if created_at:
                    if "start" in date_range and created_at < date_range["start"]:
                        return False
                    if "end" in date_range and created_at > date_range["end"]:
                        return False

            # Topic filter
            if "topics" in filters:
                topics = set(result["document_metadata"].get("topics", []))
                filter_topics = set(filters["topics"])
                if not topics & filter_topics:
                    return False

            # Custom metadata filters
            if "custom_metadata" in filters:
                custom_meta = filters["custom_metadata"]
                doc_meta = result["document_metadata"]
                for key, value in custom_meta.items():
                    if doc_meta.get(key) != value:
                        return False

            return True

        except Exception as e:
            logger.error(f"Filter application failed: {e}")
            return True  # Default to include on filter errors

    async def _enrich_results(
        self,
        results: List[Dict[str, Any]],
        query: SearchQuery,
        user_preferences: Dict[str, Any],
    ) -> List[SearchResult]:
        """Enrich results with highlights, explanations, and metadata"""

        enriched_results = []

        for result in results:
            search_result = SearchResult(
                chunk_id=result["chunk_id"],
                document_id=result["document_id"],
                content=result["content"],
                score=result["score"],
                rank_score=result["rank_score"],
                metadata=result["chunk_metadata"],
                document_metadata=result["document_metadata"],
                highlights=[],
                ranking_explanation={},
                similarity_score=result.get("semantic_score", 0.0),
                authority_score=result.get("authority_score", 0.0),
                recency_score=self._calculate_recency_score(result),
            )

            # Add highlights if requested
            if query.include_highlights:
                search_result.highlights = self._generate_highlights(
                    result["content"], query.text
                )

            # Add ranking explanations if requested
            if query.include_explanations:
                search_result.ranking_explanation = {
                    "semantic_score": result.get("semantic_score", 0.0),
                    "keyword_score": result.get("keyword_score", 0.0),
                    "authority_score": search_result.authority_score,
                    "recency_score": search_result.recency_score,
                    "personalization_factor": self._calculate_personalization_factor(
                        result, user_preferences
                    ),
                }

            enriched_results.append(search_result)

        return enriched_results

    def _generate_highlights(self, content: str, query_text: str) -> List[str]:
        """Generate search highlights within document content"""

        highlights = []
        query_terms = query_text.lower().split()

        # Simple highlighting based on term matching
        # In production, use more sophisticated algorithms
        for term in query_terms:
            if len(term) < 3:  # Skip very short terms
                continue

            # Find context around the term
            term_lower = term.lower()
            content_lower = content.lower()

            if term_lower in content_lower:
                idx = content_lower.find(term_lower)
                start = max(0, idx - 50)
                end = min(len(content), idx + len(term) + 50)
                highlight = f"...{content[start:end]}..."

                if highlight not in highlights:
                    highlights.append(highlight)

        return highlights[:3]  # Return at most 3 highlights

    def _calculate_recency_score(self, result: Dict[str, Any]) -> float:
        """Calculate recency score (0.0 to 1.0)"""

        created_at = result.get("created_at")
        if not created_at:
            return 0.0

        # Normalize to 0.0-1.0 based on age
        age_days = (datetime.utcnow() - created_at).days
        return max(0.0, 1.0 - (age_days / 365))  # Decay over a year

    def _calculate_personalization_factor(
        self, result: Dict[str, Any], user_preferences: Dict[str, Any]
    ) -> float:
        """Calculate personalization factor (0.0 to 1.0)"""

        factor = 1.0

        # Document type preference
        doc_type = result["document_metadata"].get("document_type")
        if doc_type and doc_type in user_preferences.get("preferred_types", []):
            factor += 0.2

        # Topic preference
        topics = result["document_metadata"].get("topics", [])
        user_topics = set(user_preferences.get("preferred_topics", []))
        if topics and set(topics) & user_topics:
            factor += 0.1

        return min(1.0, factor)

    async def _generate_query_embedding(self, query_text: str) -> List[float]:
        """Generate embedding for search query text"""

        try:
            # Use embedding service to generate query embedding
            from .embedding_service import EmbeddingService

            embedding_service = EmbeddingService()

            embedding = await embedding_service.generate_embedding(query_text)
            return embedding

        except Exception as e:
            logger.error(f"Failed to generate query embedding: {e}")
            raise

    async def _get_user_preferences(self, user_id: str) -> Dict[str, Any]:
        """Get user preferences for personalized ranking"""

        try:
            cache_key = f"user_prefs:{user_id}"
            cached = await self.redis.get(cache_key)
            if cached:
                return json.loads(cached)

            # Default preferences
            preferences = {
                "preferred_types": [],
                "preferred_topics": [],
                "preferred_sources": [],
            }

            # Cache for 1 hour
            await self.redis.setex(cache_key, 3600, json.dumps(preferences))
            return preferences

        except Exception as e:
            logger.error(f"Failed to get user preferences: {e}")
            return {}

    async def _cache_search_results(
        self, query: SearchQuery, results: List[SearchResult]
    ) -> None:
        """Cache search results for fast repeated queries"""

        try:
            # Create cache key from query parameters
            query_hash = hash(f"{query.text}:{query.tenant_id}:{query.filters}")
            cache_key = f"search_results:{query_hash}"

            # Cache for 5 minutes
            results_data = [
                {
                    "chunk_id": r.chunk_id,
                    "document_id": r.document_id,
                    "content": r.content,
                    "score": r.score,
                    "rank_score": r.rank_score,
                    "metadata": r.metadata,
                    "document_metadata": r.document_metadata,
                    "highlights": r.highlights,
                }
                for r in results
            ]

            await self.redis.setex(
                cache_key, 300, json.dumps(results_data, default=str)
            )

        except Exception as e:
            logger.error(f"Failed to cache search results: {e}")

    async def get_search_suggestions(
        self, query_prefix: str, tenant_id: str, limit: int = 5
    ) -> List[str]:
        """Get search query suggestions based on prefix"""

        try:
            async with self.db_pool.acquire() as conn:
                # Get popular queries that start with the prefix
                query = """
                SELECT DISTINCT query_text, count
                FROM search_analytics
                WHERE tenant_id = $1
                    AND query_text ILIKE $2
                    AND timestamp > NOW() - INTERVAL '7 days'
                GROUP BY query_text
                ORDER BY count DESC, query_text
                LIMIT $3
                """

                results = await conn.fetch(query, tenant_id, f"{query_prefix}%", limit)

                return [row["query_text"] for row in results]

        except Exception as e:
            logger.error(f"Failed to get search suggestions: {e}")
            return []

    async def record_search_analytics(
        self,
        query: SearchQuery,
        results: List[SearchResult],
        duration: float,
        user_id: Optional[str] = None,
    ) -> None:
        """Record search analytics for monitoring and improvement"""

        try:
            analytics_data = {
                "tenant_id": query.tenant_id,
                "user_id": user_id,
                "query_text": query.text,
                "search_type": query.search_type.value,
                "ranking": query.ranking.value,
                "result_count": len(results),
                "duration_ms": duration * 1000,
                "filters_applied": bool(query.filters),
                "timestamp": datetime.utcnow().isoformat(),
            }

            # Store in analytics table (would normally use timeseries DB)
            async with self.db_pool.acquire() as conn:
                await conn.execute(
                    """
                    INSERT INTO search_analytics
                    (tenant_id, user_id, query_text, search_type, ranking,
                     result_count, duration_ms, filters_applied, timestamp)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                    """,
                    analytics_data["tenant_id"],
                    analytics_data["user_id"],
                    analytics_data["query_text"],
                    analytics_data["search_type"],
                    analytics_data["ranking"],
                    analytics_data["result_count"],
                    analytics_data["duration_ms"],
                    analytics_data["filters_applied"],
                    analytics_data["timestamp"],
                )

            # Update metrics
            metrics.record_search_analytics(analytics_data)

        except Exception as e:
            logger.error(f"Failed to record search analytics: {e}")

    async def get_search_analytics(
        self, tenant_id: str, days: int = 30
    ) -> Dict[str, Any]:
        """Get search analytics dashboard data for tenant"""

        try:
            async with self.db_pool.acquire() as conn:
                # Get popular queries
                popular_queries = await conn.fetch(
                    """
                    SELECT query_text, COUNT(*) as count
                    FROM search_analytics
                    WHERE tenant_id = $1
                        AND timestamp > NOW() - INTERVAL $2 DAY
                    GROUP BY query_text
                    ORDER BY count DESC
                    LIMIT 10
                    """,
                    tenant_id,
                    days,
                )

                # Get search volume over time
                search_volume = await conn.fetch(
                    """
                    SELECT
                        DATE_TRUNC('day', timestamp) as date,
                        COUNT(*) as searches,
                        AVG(duration_ms) as avg_duration
                    FROM search_analytics
                    WHERE tenant_id = $1
                        AND timestamp > NOW() - INTERVAL $2 DAY
                    GROUP BY DATE_TRUNC('day', timestamp)
                    ORDER BY date DESC
                    """,
                    tenant_id,
                    days,
                )

                # Get performance metrics
                performance = await conn.fetchrow(
                    """
                    SELECT
                        AVG(duration_ms) as avg_duration,
                        AVG(result_count) as avg_results,
                        COUNT(*) as total_searches
                    FROM search_analytics
                    WHERE tenant_id = $1
                        AND timestamp > NOW() - INTERVAL $2 DAY
                    """,
                    tenant_id,
                    days,
                )

                return {
                    "popular_queries": [
                        {"query": row["query_text"], "count": row["count"]}
                        for row in popular_queries
                    ],
                    "search_volume": [
                        {
                            "date": row["date"].isoformat(),
                            "searches": row["searches"],
                            "avg_duration": row["avg_duration"],
                        }
                        for row in search_volume
                    ],
                    "performance": {
                        "avg_duration_ms": float(performance["avg_duration"] or 0),
                        "avg_results": float(performance["avg_results"] or 0),
                        "total_searches": performance["total_searches"],
                    },
                }

        except Exception as e:
            logger.error(f"Failed to get search analytics: {e}")
            return {}

    async def close(self):
        """Close database and Redis connections"""

        if self.db_pool:
            await self.db_pool.close()

        if self.redis:
            await self.redis.close()
