"""
Test suite for Cache Service
"""

import pytest
import asyncio
from unittest.mock import AsyncMock, Mock, patch
from datetime import datetime, timedelta

from app.services.cache_service import (
    cache_service,
    CacheStrategy,
    CacheLevel,
    CacheEntry
)

# Mark all async tests
pytestmark = pytest.mark.asyncio


class TestCacheService:
    """Test cases for Cache Service"""

    @pytest.fixture
    @pytest.mark.asyncio
    async def cache_service_instance(self):
        """Create cache service instance for testing"""
        # Reset the service state
        cache_service.l1_cache.clear()
        cache_service.metrics.hits = 0
        cache_service.metrics.misses = 0
        cache_service.redis_client = None
        cache_service.initialized = False

        # Initialize with mock Redis
        with patch('redis.asyncio.from_url') as mock_redis:
            mock_redis_client = AsyncMock()
            mock_redis_client.ping = AsyncMock()
            mock_redis_client.info = AsyncMock(return_value={'used_memory': 1024})
            mock_redis.return_value = mock_redis_client

            await cache_service.initialize()
            yield cache_service

    @pytest.mark.asyncio
    async def test_cache_initialization(self, cache_service_instance):
        """Test cache service initialization"""
        assert cache_service_instance.initialized is True
        assert len(cache_service_instance.l1_cache) == 0
        assert cache_service_instance.metrics.hits == 0
        assert cache_service_instance.metrics.misses == 0

    @pytest.mark.asyncio
    async def test_set_and_get_l1_cache(self, cache_service_instance):
        """Test L1 (memory) cache set and get operations"""
        key = "test_key"
        value = {"data": "test_value", "number": 42}
        namespace = "test"

        # Set value
        success = await cache_service_instance.set(
            key=key,
            value=value,
            ttl=300,
            namespace=namespace,
            strategy=CacheStrategy.CACHE_ASIDE
        )
        assert success is True

        # Get value
        retrieved_value = await cache_service_instance.get(key=key, namespace=namespace)
        assert retrieved_value == value
        assert cache_service_instance.metrics.hits == 1

    async def test_cache_miss(self, cache_service_instance):
        """Test cache miss scenario"""
        key = "nonexistent_key"
        namespace = "test"

        # Try to get non-existent value
        retrieved_value = await cache_service_instance.get(key=key, namespace=namespace)
        assert retrieved_value is None
        assert cache_service_instance.metrics.misses == 1

    async def test_cache_expiration(self, cache_service_instance):
        """Test cache entry expiration"""
        key = "expiring_key"
        value = "test_value"
        namespace = "test"

        # Set value with very short TTL
        await cache_service_instance.set(
            key=key,
            value=value,
            ttl=1,  # 1 second
            namespace=namespace
        )

        # Get value immediately (should hit)
        retrieved_value = await cache_service_instance.get(key=key, namespace=namespace)
        assert retrieved_value == value

        # Wait for expiration and try again
        await asyncio.sleep(1.1)
        retrieved_value = await cache_service_instance.get(key=key, namespace=namespace)
        assert retrieved_value is None

    async def test_cache_tags_and_invalidation(self, cache_service_instance):
        """Test cache tagging and tag-based invalidation"""
        # Set multiple values with tags
        await cache_service_instance.set(
            key="user_1",
            value={"name": "Alice"},
            namespace="users",
            tags=["user", "active"]
        )

        await cache_service_instance.set(
            key="user_2",
            value={"name": "Bob"},
            namespace="users",
            tags=["user", "inactive"]
        )

        await cache_service_instance.set(
            key="product_1",
            value={"name": "Widget"},
            namespace="products",
            tags=["product", "active"]
        )

        # Verify values are cached
        assert await cache_service_instance.get("user_1", namespace="users") is not None
        assert await cache_service_instance.get("user_2", namespace="users") is not None
        assert await cache_service_instance.get("product_1", namespace="products") is not None

        # Invalidate by tag
        invalidated_count = await cache_service_instance.invalidate_by_tags(["user"])

        # User entries should be invalidated, product should remain
        assert await cache_service_instance.get("user_1", namespace="users") is None
        assert await cache_service_instance.get("user_2", namespace="users") is None
        assert await cache_service_instance.get("product_1", namespace="products") is not None

    async def test_namespace_clearing(self, cache_service_instance):
        """Test clearing cache by namespace"""
        # Set values in different namespaces
        await cache_service_instance.set("key1", "value1", namespace="ns1")
        await cache_service_instance.set("key2", "value2", namespace="ns1")
        await cache_service_instance.set("key3", "value3", namespace="ns2")

        # Clear namespace ns1
        cleared_count = await cache_service_instance.clear_namespace("ns1")
        assert cleared_count == 2

        # Verify ns1 is cleared, ns2 remains
        assert await cache_service_instance.get("key1", namespace="ns1") is None
        assert await cache_service_instance.get("key2", namespace="ns1") is None
        assert await cache_service_instance.get("key3", namespace="ns2") is not None

    async def test_cache_key_generation_with_params(self, cache_service_instance):
        """Test cache key generation with parameters"""
        base_key = "user_data"
        namespace = "api"

        # Set with different parameters
        await cache_service_instance.set(
            base_key, {"data": "user1"}, namespace=namespace, user_id=1
        )
        await cache_service_instance.set(
            base_key, {"data": "user2"}, namespace=namespace, user_id=2
        )

        # Get with matching parameters
        user1_data = await cache_service_instance.get(
            base_key, namespace=namespace, user_id=1
        )
        user2_data = await cache_service_instance.get(
            base_key, namespace=namespace, user_id=2
        )

        assert user1_data == {"data": "user1"}
        assert user2_data == {"data": "user2"}

    async def test_l1_cache_eviction(self, cache_service_instance):
        """Test L1 cache eviction when max size is reached"""
        # Set max cache size to small value for testing
        original_max_size = cache_service_instance.max_l1_size
        cache_service_instance.max_l1_size = 3

        try:
            # Fill cache beyond max size
            for i in range(5):
                await cache_service_instance.set(
                    f"key_{i}", f"value_{i}", namespace="test"
                )
                await asyncio.sleep(0.01)  # Small delay to ensure different access times

            # Cache should have been evicted to stay under max size
            assert len(cache_service_instance.l1_cache) <= cache_service_instance.max_l1_size

            # Older entries should be evicted (LRU)
            assert await cache_service_instance.get("key_0", namespace="test") is None
            assert await cache_service_instance.get("key_1", namespace="test") is None
            assert await cache_service_instance.get("key_4", namespace="test") is not None

        finally:
            cache_service_instance.max_l1_size = original_max_size

    async def test_cache_delete(self, cache_service_instance):
        """Test cache entry deletion"""
        key = "delete_me"
        value = "test_value"
        namespace = "test"

        # Set and verify value exists
        await cache_service_instance.set(key, value, namespace=namespace)
        assert await cache_service_instance.get(key, namespace=namespace) == value

        # Delete and verify removal
        success = await cache_service_instance.delete(key, namespace=namespace)
        assert success is True
        assert await cache_service_instance.get(key, namespace=namespace) is None

    async def test_cache_metrics(self, cache_service_instance):
        """Test cache metrics tracking"""
        # Perform various cache operations
        await cache_service_instance.set("key1", "value1", namespace="test")
        await cache_service_instance.set("key2", "value2", namespace="test")

        # Generate hits and misses
        await cache_service_instance.get("key1", namespace="test")  # Hit
        await cache_service_instance.get("key1", namespace="test")  # Hit
        await cache_service_instance.get("nonexistent", namespace="test")  # Miss

        await cache_service_instance.delete("key2", namespace="test")

        # Get metrics
        metrics = await cache_service_instance.get_metrics()

        assert metrics["hits"] >= 2
        assert metrics["misses"] >= 1
        assert metrics["sets"] >= 2
        assert metrics["deletes"] >= 1
        assert "hit_ratio_percent" in metrics
        assert "l1_cache_size" in metrics

    async def test_cache_health_check(self, cache_service_instance):
        """Test cache service health check"""
        health = await cache_service_instance.health_check()

        assert health["service_name"] == "cache_service"
        assert health["status"] in ["healthy", "degraded", "unhealthy"]
        assert "checks" in health
        assert "metrics" in health
        assert "timestamp" in health

        # Check L1 cache health
        assert "l1_cache" in health["checks"]
        assert health["checks"]["l1_cache"]["status"] == "healthy"

    async def test_cache_strategies(self, cache_service_instance):
        """Test different cache strategies"""
        key = "strategy_test"
        value = "test_value"
        namespace = "test"

        # Test WRITE_THROUGH strategy
        success = await cache_service_instance.set(
            key, value, namespace=namespace, strategy=CacheStrategy.WRITE_THROUGH
        )
        assert success is True

        # Test CACHE_ASIDE strategy
        success = await cache_service_instance.set(
            key + "_aside", value, namespace=namespace, strategy=CacheStrategy.CACHE_ASIDE
        )
        assert success is True

        # Both should be retrievable
        assert await cache_service_instance.get(key, namespace=namespace) == value
        assert await cache_service_instance.get(key + "_aside", namespace=namespace) == value

    async def test_cache_error_handling(self, cache_service_instance):
        """Test cache error handling"""
        # Test with invalid data that might cause serialization issues
        import datetime
        invalid_data = {"timestamp": datetime.datetime.now()}

        # Should handle serialization gracefully
        success = await cache_service_instance.set(
            "invalid_key", invalid_data, namespace="test"
        )
        # Even if it fails, it shouldn't crash
        assert isinstance(success, bool)

    @pytest.mark.asyncio
    async def test_concurrent_cache_operations(self, cache_service_instance):
        """Test concurrent cache operations"""
        async def cache_worker(worker_id: int):
            for i in range(10):
                key = f"worker_{worker_id}_key_{i}"
                value = f"worker_{worker_id}_value_{i}"
                await cache_service_instance.set(key, value, namespace="concurrent")
                retrieved = await cache_service_instance.get(key, namespace="concurrent")
                assert retrieved == value

        # Run multiple workers concurrently
        workers = [cache_worker(i) for i in range(5)]
        await asyncio.gather(*workers)

        # Verify final cache state
        metrics = await cache_service_instance.get_metrics()
        assert metrics["sets"] >= 50  # 5 workers * 10 operations each
        assert metrics["hits"] >= 50

    async def test_cache_cleanup(self, cache_service_instance):
        """Test cache cleanup operations"""
        # Add some data
        await cache_service_instance.set("cleanup_test", "value", namespace="test")
        assert len(cache_service_instance.l1_cache) > 0

        # Cleanup
        await cache_service_instance.cleanup()

        # Verify cleanup
        assert len(cache_service_instance.l1_cache) == 0