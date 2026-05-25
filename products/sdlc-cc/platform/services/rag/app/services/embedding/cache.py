"""
Embedding Cache

Intelligent embedding cache with 24h TTL backed by Redis.
"""

import hashlib
import json
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

logger = logging.getLogger(__name__)

try:
    import redis.asyncio as redis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False


class EmbeddingCache:
    """Intelligent embedding cache with 24h TTL."""

    def __init__(self, config: Dict[str, Any]):
        self.redis_url = config.get("redis_url")
        self.ttl_seconds = config.get("ttl_seconds", 24 * 60 * 60)
        self.max_size = config.get("max_size", 10000)
        self.compression_enabled = config.get("compression_enabled", True)
        self.client = None

    async def initialize(self) -> None:
        if not REDIS_AVAILABLE:
            logger.warning("Redis not available, caching disabled")
            return
        if self.redis_url:
            self.client = redis.from_url(
                self.redis_url, decode_responses=False
            )
            await self.client.ping()
            logger.info("Embedding cache initialized with Redis")
        else:
            logger.warning("Redis URL not provided, caching disabled")

    def _generate_cache_key(
        self, text: str, provider: str, model: str, tenant_id: UUID
    ) -> str:
        content_hash = hashlib.sha256(text.encode()).hexdigest()
        return f"embedding:{tenant_id}:{provider}:{model}:{content_hash}"

    async def get(
        self, text: str, provider: str, model: str, tenant_id: UUID
    ) -> Optional[List[float]]:
        if not self.client:
            return None
        try:
            key = self._generate_cache_key(text, provider, model, tenant_id)
            cached = await self.client.get(key)
            if cached:
                return json.loads(cached).get("embedding")
            return None
        except Exception as e:
            logger.warning(f"Cache get error: {e}")
            return None

    async def set(
        self,
        text: str,
        provider: str,
        model: str,
        tenant_id: UUID,
        embedding: List[float],
        metadata: Dict[str, Any] = None,
    ) -> bool:
        if not self.client:
            return False
        try:
            key = self._generate_cache_key(text, provider, model, tenant_id)
            data = {
                "embedding": embedding,
                "provider": provider,
                "model": model,
                "created_at": datetime.utcnow().isoformat(),
                "metadata": metadata or {},
            }
            await self.client.setex(
                key, self.ttl_seconds, json.dumps(data)
            )
            return True
        except Exception as e:
            logger.warning(f"Cache set error: {e}")
            return False

    async def invalidate_by_model(
        self, provider: str, model: str, tenant_id: UUID
    ) -> int:
        if not self.client:
            return 0
        try:
            pattern = f"embedding:{tenant_id}:{provider}:{model}:*"
            keys = await self.client.keys(pattern)
            if keys:
                deleted = await self.client.delete(*keys)
                logger.info(f"Invalidated {deleted} cache entries")
                return deleted
            return 0
        except Exception as e:
            logger.warning(f"Cache invalidation error: {e}")
            return 0

    async def get_stats(self) -> Dict[str, Any]:
        if not self.client:
            return {"enabled": False}
        try:
            info = await self.client.info("memory")
            return {
                "enabled": True,
                "used_memory": info.get("used_memory_human"),
                "ttl_seconds": self.ttl_seconds,
            }
        except Exception as e:
            return {"enabled": False, "error": str(e)}
