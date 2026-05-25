#!/usr/bin/env python3
"""
QuantumBeam Multi-layer Caching Strategy Implementation
Provides intelligent caching across multiple layers with cache warming, invalidation, and analytics.
"""

import os
import sys
import json
import yaml
import time
import logging
import hashlib
import pickle
import redis
import aioredis
import aiocache
from aiocache import cached, RedisCache, SimpleMemoryCache
from typing import Dict, List, Any, Optional, Union, Callable, Tuple
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta
from pathlib import Path
import asyncio
import aiofiles
import aiofiles.os
from functools import wraps
import threading
import statistics
import psutil
import boto3
from botocore.exceptions import ClientError
import mmap

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@dataclass
class CacheConfig:
    """Cache configuration."""
    cache_type: str  # memory, redis, distributed
    ttl: int  # Time to live in seconds
    max_size: int  # Maximum number of items
    eviction_policy: str  # lru, lfu, fifo
    compression: bool
    serialization: str  # pickle, json, msgpack
    key_prefix: str
    namespace: str

@dataclass
class CacheMetrics:
    """Cache performance metrics."""
    hits: int
    misses: int
    sets: int
    deletes: int
    evictions: int
    errors: int
    total_size_bytes: int
    memory_usage_bytes: int
    avg_response_time_ms: float
    hit_rate_percent: float
    timestamp: datetime

class CacheBackend:
    """Base cache backend interface."""

    def __init__(self, config: CacheConfig):
        self.config = config
        self.metrics = CacheMetrics(
            hits=0, misses=0, sets=0, deletes=0,
            evictions=0, errors=0, total_size_bytes=0,
            memory_usage_bytes=0, avg_response_time_ms=0.0,
            hit_rate_percent=0.0, timestamp=datetime.now()
        )
        self._response_times = []

    async def get(self, key: str) -> Optional[Any]:
        """Get value from cache."""
        raise NotImplementedError

    async def set(self, key: str, value: Any, ttl: Optional[int] = None) -> bool:
        """Set value in cache."""
        raise NotImplementedError

    async def delete(self, key: str) -> bool:
        """Delete value from cache."""
        raise NotImplementedError

    async def clear(self, pattern: Optional[str] = None) -> int:
        """Clear cache entries."""
        raise NotImplementedError

    async def exists(self, key: str) -> bool:
        """Check if key exists in cache."""
        raise NotImplementedError

    async def get_stats(self) -> CacheMetrics:
        """Get cache statistics."""
        # Calculate hit rate
        total_requests = self.metrics.hits + self.metrics.misses
        if total_requests > 0:
            self.metrics.hit_rate_percent = (self.metrics.hits / total_requests) * 100

        # Calculate average response time
        if self._response_times:
            self.metrics.avg_response_time_ms = statistics.mean(self._response_times)

        self.metrics.timestamp = datetime.now()
        return self.metrics

    def _record_hit(self):
        """Record a cache hit."""
        self.metrics.hits += 1

    def _record_miss(self):
        """Record a cache miss."""
        self.metrics.misses += 1

    def _record_set(self):
        """Record a cache set."""
        self.metrics.sets += 1

    def _record_delete(self):
        """Record a cache delete."""
        self.metrics.deletes += 1

    def _record_eviction(self):
        """Record a cache eviction."""
        self.metrics.evictions += 1

    def _record_error(self):
        """Record a cache error."""
        self.metrics.errors += 1

    def _record_response_time(self, duration_ms: float):
        """Record response time."""
        self._response_times.append(duration_ms)
        # Keep only last 1000 response times
        if len(self._response_times) > 1000:
            self._response_times = self._response_times[-1000:]

class MemoryCacheBackend(CacheBackend):
    """In-memory cache backend with LRU eviction."""

    def __init__(self, config: CacheConfig):
        super().__init__(config)
        self._cache = {}
        self._access_times = {}
        self._lock = threading.RLock()

    async def get(self, key: str) -> Optional[Any]:
        """Get value from memory cache."""
        start_time = time.time()
        try:
            with self._lock:
                if key in self._cache:
                    self._access_times[key] = time.time()
                    self._record_hit()
                    return self._cache[key]
                else:
                    self._record_miss()
                    return None
        except Exception as e:
            logger.error(f"Memory cache get error: {e}")
            self._record_error()
            return None
        finally:
            duration_ms = (time.time() - start_time) * 1000
            self._record_response_time(duration_ms)

    async def set(self, key: str, value: Any, ttl: Optional[int] = None) -> bool:
        """Set value in memory cache."""
        start_time = time.time()
        try:
            with self._lock:
                # Check if we need to evict
                if len(self._cache) >= self.config.max_size:
                    self._evict_lru()

                self._cache[key] = value
                self._access_times[key] = time.time()
                self._record_set()
                return True
        except Exception as e:
            logger.error(f"Memory cache set error: {e}")
            self._record_error()
            return False
        finally:
            duration_ms = (time.time() - start_time) * 1000
            self._record_response_time(duration_ms)

    async def delete(self, key: str) -> bool:
        """Delete value from memory cache."""
        start_time = time.time()
        try:
            with self._lock:
                if key in self._cache:
                    del self._cache[key]
                    del self._access_times[key]
                    self._record_delete()
                    return True
                return False
        except Exception as e:
            logger.error(f"Memory cache delete error: {e}")
            self._record_error()
            return False
        finally:
            duration_ms = (time.time() - start_time) * 1000
            self._record_response_time(duration_ms)

    async def clear(self, pattern: Optional[str] = None) -> int:
        """Clear memory cache entries."""
        start_time = time.time()
        try:
            with self._lock:
                if pattern:
                    import fnmatch
                    keys_to_remove = [k for k in self._cache.keys() if fnmatch.fnmatch(k, pattern)]
                    for key in keys_to_remove:
                        del self._cache[key]
                        if key in self._access_times:
                            del self._access_times[key]
                    return len(keys_to_remove)
                else:
                    count = len(self._cache)
                    self._cache.clear()
                    self._access_times.clear()
                    return count
        except Exception as e:
            logger.error(f"Memory cache clear error: {e}")
            self._record_error()
            return 0
        finally:
            duration_ms = (time.time() - start_time) * 1000
            self._record_response_time(duration_ms)

    async def exists(self, key: str) -> bool:
        """Check if key exists in memory cache."""
        try:
            with self._lock:
                return key in self._cache
        except Exception as e:
            logger.error(f"Memory cache exists error: {e}")
            self._record_error()
            return False

    def _evict_lru(self):
        """Evict least recently used items."""
        if not self._access_times:
            return

        # Sort by access time and remove oldest
        sorted_keys = sorted(self._access_times.items(), key=lambda x: x[1])
        keys_to_remove = sorted_keys[:max(1, len(self._cache) // 10)]  # Remove 10% oldest

        for key, _ in keys_to_remove:
            if key in self._cache:
                del self._cache[key]
            del self._access_times[key]
            self._record_eviction()

class RedisCacheBackend(CacheBackend):
    """Redis cache backend."""

    def __init__(self, config: CacheConfig):
        super().__init__(config)
        self._redis = None
        self._async_redis = None
        self._initialize_redis()

    def _initialize_redis(self):
        """Initialize Redis connections."""
        try:
            # Synchronous Redis connection
            self._redis = redis.Redis(
                host=os.getenv('REDIS_HOST', 'localhost'),
                port=int(os.getenv('REDIS_PORT', 6379)),
                password=os.getenv('REDIS_PASSWORD'),
                db=int(os.getenv('REDIS_DB', 0)),
                decode_responses=False,  # Keep bytes for proper deserialization
                socket_connect_timeout=5,
                socket_timeout=5,
                retry_on_timeout=True
            )

            # Test connection
            self._redis.ping()
            logger.info("Redis connection established")

        except Exception as e:
            logger.error(f"Failed to initialize Redis: {e}")
            raise

    async def _get_async_redis(self):
        """Get async Redis connection."""
        if not self._async_redis:
            self._async_redis = await aioredis.from_url(
                f"redis://{os.getenv('REDIS_HOST', 'localhost')}:{os.getenv('REDIS_PORT', 6379)}",
                password=os.getenv('REDIS_PASSWORD'),
                db=int(os.getenv('REDIS_DB', 0)),
                encoding=None,  # Keep bytes for proper deserialization
                socket_connect_timeout=5,
                socket_timeout=5
            )
        return self._async_redis

    def _serialize(self, value: Any) -> bytes:
        """Serialize value for storage."""
        if self.config.serialization == 'pickle':
            return pickle.dumps(value)
        elif self.config.serialization == 'json':
            return json.dumps(value).encode('utf-8')
        else:
            raise ValueError(f"Unsupported serialization: {self.config.serialization}")

    def _deserialize(self, data: bytes) -> Any:
        """Deserialize value from storage."""
        if self.config.serialization == 'pickle':
            return pickle.loads(data)
        elif self.config.serialization == 'json':
            return json.loads(data.decode('utf-8'))
        else:
            raise ValueError(f"Unsupported serialization: {self.config.serialization}")

    def _get_key(self, key: str) -> str:
        """Get full key with namespace and prefix."""
        return f"{self.config.namespace}:{self.config.key_prefix}:{key}"

    async def get(self, key: str) -> Optional[Any]:
        """Get value from Redis cache."""
        start_time = time.time()
        try:
            redis_client = await self._get_async_redis()
            full_key = self._get_key(key)
            data = await redis_client.get(full_key)

            if data:
                self._record_hit()
                return self._deserialize(data)
            else:
                self._record_miss()
                return None
        except Exception as e:
            logger.error(f"Redis cache get error: {e}")
            self._record_error()
            return None
        finally:
            duration_ms = (time.time() - start_time) * 1000
            self._record_response_time(duration_ms)

    async def set(self, key: str, value: Any, ttl: Optional[int] = None) -> bool:
        """Set value in Redis cache."""
        start_time = time.time()
        try:
            redis_client = await self._get_async_redis()
            full_key = self._get_key(key)
            data = self._serialize(value)

            ttl = ttl or self.config.ttl
            result = await redis_client.setex(full_key, ttl, data)

            if result:
                self._record_set()
                return True
            return False
        except Exception as e:
            logger.error(f"Redis cache set error: {e}")
            self._record_error()
            return False
        finally:
            duration_ms = (time.time() - start_time) * 1000
            self._record_response_time(duration_ms)

    async def delete(self, key: str) -> bool:
        """Delete value from Redis cache."""
        start_time = time.time()
        try:
            redis_client = await self._get_async_redis()
            full_key = self._get_key(key)
            result = await redis_client.delete(full_key)

            if result > 0:
                self._record_delete()
                return True
            return False
        except Exception as e:
            logger.error(f"Redis cache delete error: {e}")
            self._record_error()
            return False
        finally:
            duration_ms = (time.time() - start_time) * 1000
            self._record_response_time(duration_ms)

    async def clear(self, pattern: Optional[str] = None) -> int:
        """Clear Redis cache entries."""
        start_time = time.time()
        try:
            redis_client = await self._get_async_redis()

            if pattern:
                full_pattern = self._get_key(pattern.replace('*', '*'))
                keys = await redis_client.keys(full_pattern)
                if keys:
                    result = await redis_client.delete(*keys)
                    return result
                return 0
            else:
                # Clear all keys in namespace
                pattern = f"{self.config.namespace}:{self.config.key_prefix}:*"
                keys = await redis_client.keys(pattern)
                if keys:
                    result = await redis_client.delete(*keys)
                    return result
                return 0
        except Exception as e:
            logger.error(f"Redis cache clear error: {e}")
            self._record_error()
            return 0
        finally:
            duration_ms = (time.time() - start_time) * 1000
            self._record_response_time(duration_ms)

    async def exists(self, key: str) -> bool:
        """Check if key exists in Redis cache."""
        try:
            redis_client = await self._get_async_redis()
            full_key = self._get_key(key)
            result = await redis_client.exists(full_key)
            return result > 0
        except Exception as e:
            logger.error(f"Redis cache exists error: {e}")
            self._record_error()
            return False

class DistributedCacheBackend(CacheBackend):
    """Distributed cache backend using Redis as coordinator."""

    def __init__(self, config: CacheConfig):
        super().__init__(config)
        self.local_cache = MemoryCacheBackend(config)
        self.redis_cache = RedisCacheBackend(config)
        self.node_id = f"node_{os.getpid()}_{int(time.time())}"

    async def get(self, key: str) -> Optional[Any]:
        """Get value from distributed cache."""
        start_time = time.time()
        try:
            # Try local cache first
            value = await self.local_cache.get(key)
            if value is not None:
                self._record_hit()
                return value

            # Try Redis cache
            value = await self.redis_cache.get(key)
            if value is not None:
                # Store in local cache for next time
                await self.local_cache.set(key, value, ttl=min(300, self.config.ttl))
                self._record_hit()
                return value
            else:
                self._record_miss()
                return None
        except Exception as e:
            logger.error(f"Distributed cache get error: {e}")
            self._record_error()
            return None
        finally:
            duration_ms = (time.time() - start_time) * 1000
            self._record_response_time(duration_ms)

    async def set(self, key: str, value: Any, ttl: Optional[int] = None) -> bool:
        """Set value in distributed cache."""
        start_time = time.time()
        try:
            # Set in both local and Redis cache
            local_success = await self.local_cache.set(key, value, ttl=min(300, ttl or self.config.ttl))
            redis_success = await self.redis_cache.set(key, value, ttl)

            if local_success and redis_success:
                self._record_set()
                return True
            return False
        except Exception as e:
            logger.error(f"Distributed cache set error: {e}")
            self._record_error()
            return False
        finally:
            duration_ms = (time.time() - start_time) * 1000
            self._record_response_time(duration_ms)

    async def delete(self, key: str) -> bool:
        """Delete value from distributed cache."""
        start_time = time.time()
        try:
            # Delete from both local and Redis cache
            local_success = await self.local_cache.delete(key)
            redis_success = await self.redis_cache.delete(key)

            if local_success or redis_success:
                self._record_delete()
                return True
            return False
        except Exception as e:
            logger.error(f"Distributed cache delete error: {e}")
            self._record_error()
            return False
        finally:
            duration_ms = (time.time() - start_time) * 1000
            self._record_response_time(duration_ms)

    async def clear(self, pattern: Optional[str] = None) -> int:
        """Clear distributed cache entries."""
        start_time = time.time()
        try:
            # Clear both local and Redis cache
            local_count = await self.local_cache.clear(pattern)
            redis_count = await self.redis_cache.clear(pattern)

            total_count = local_count + redis_count
            if total_count > 0:
                self._record_delete()
            return total_count
        except Exception as e:
            logger.error(f"Distributed cache clear error: {e}")
            self._record_error()
            return 0
        finally:
            duration_ms = (time.time() - start_time) * 1000
            self._record_response_time(duration_ms)

    async def exists(self, key: str) -> bool:
        """Check if key exists in distributed cache."""
        try:
            # Check local cache first
            if await self.local_cache.exists(key):
                return True
            # Check Redis cache
            return await self.redis_cache.exists(key)
        except Exception as e:
            logger.error(f"Distributed cache exists error: {e}")
            self._record_error()
            return False

    async def invalidate_local_cache(self, pattern: Optional[str] = None) -> int:
        """Invalidate local cache entries only."""
        return await self.local_cache.clear(pattern)

class CacheWarmer:
    """Cache warming utility for preloading frequently accessed data."""

    def __init__(self, cache_backend: CacheBackend):
        self.cache = cache_backend
        self.warming_jobs = []

    async def warm_cache(self, warming_config: Dict[str, Any]):
        """Warm cache with predefined data."""
        logger.info("Starting cache warming")

        tasks = []

        # Warm user sessions
        if 'user_sessions' in warming_config:
            tasks.append(self._warm_user_sessions(warming_config['user_sessions']))

        # Warm configuration data
        if 'config_data' in warming_config:
            tasks.append(self._warm_config_data(warming_config['config_data']))

        # Warm analytics data
        if 'analytics_data' in warming_config:
            tasks.append(self._warm_analytics_data(warming_config['analytics_data']))

        # Warm transaction data
        if 'transaction_data' in warming_config:
            tasks.append(self._warm_transaction_data(warming_config['transaction_data']))

        # Execute warming tasks concurrently
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

        logger.info("Cache warming completed")

    async def _warm_user_sessions(self, config: Dict[str, Any]):
        """Warm user session cache."""
        try:
            # Mock user session data
            for i in range(config.get('count', 100)):
                user_id = f"user_{i}"
                session_data = {
                    'user_id': user_id,
                    'session_id': f"session_{i}",
                    'last_activity': datetime.now().isoformat(),
                    'preferences': {'theme': 'dark', 'language': 'en'},
                    'permissions': ['read', 'write']
                }
                key = f"session:{user_id}"
                await self.cache.set(key, session_data, ttl=config.get('ttl', 3600))

            logger.info(f"Warmed {config.get('count', 100)} user sessions")
        except Exception as e:
            logger.error(f"Failed to warm user sessions: {e}")

    async def _warm_config_data(self, config: Dict[str, Any]):
        """Warm configuration data cache."""
        try:
            config_files = config.get('files', [
                'app_config', 'feature_flags', 'rate_limits', 'security_settings'
            ])

            for config_file in config_files:
                # Mock configuration data
                config_data = {
                    'version': '1.0.0',
                    'last_updated': datetime.now().isoformat(),
                    'settings': {
                        'max_connections': 100,
                        'timeout': 30,
                        'retry_count': 3
                    }
                }
                key = f"config:{config_file}"
                await self.cache.set(key, config_data, ttl=config.get('ttl', 1800))

            logger.info(f"Warmed {len(config_files)} configuration files")
        except Exception as e:
            logger.error(f"Failed to warm config data: {e}")

    async def _warm_analytics_data(self, config: Dict[str, Any]):
        """Warm analytics data cache."""
        try:
            for i in range(config.get('count', 50)):
                dashboard_id = f"dashboard_{i}"
                analytics_data = {
                    'dashboard_id': dashboard_id,
                    'total_transactions': 10000 + i * 100,
                    'fraud_rate': 0.02 + (i * 0.001),
                    'avg_transaction_amount': 150.50 + (i * 10),
                    'last_updated': datetime.now().isoformat()
                }
                key = f"analytics:{dashboard_id}"
                await self.cache.set(key, analytics_data, ttl=config.get('ttl', 600))

            logger.info(f"Warmed {config.get('count', 50)} analytics dashboards")
        except Exception as e:
            logger.error(f"Failed to warm analytics data: {e}")

    async def _warm_transaction_data(self, config: Dict[str, Any]):
        """Warm transaction data cache."""
        try:
            for i in range(config.get('count', 100)):
                transaction_id = f"txn_{i}"
                transaction_data = {
                    'transaction_id': transaction_id,
                    'amount': 100.0 + (i * 10),
                    'currency': 'USD',
                    'status': 'completed',
                    'timestamp': (datetime.now() - timedelta(minutes=i)).isoformat()
                }
                key = f"transaction:{transaction_id}"
                await self.cache.set(key, transaction_data, ttl=config.get('ttl', 300))

            logger.info(f"Warmed {config.get('count', 100)} transactions")
        except Exception as e:
            logger.error(f"Failed to warm transaction data: {e}")

class CacheInvalidator:
    """Cache invalidation utility."""

    def __init__(self, cache_backend: CacheBackend):
        self.cache = cache_backend

    async def invalidate_by_pattern(self, pattern: str) -> int:
        """Invalidate cache entries by pattern."""
        logger.info(f"Invalidating cache entries matching pattern: {pattern}")
        count = await self.cache.clear(pattern)
        logger.info(f"Invalidated {count} cache entries")
        return count

    async def invalidate_user_cache(self, user_id: str) -> int:
        """Invalidate all cache entries for a specific user."""
        patterns = [
            f"session:{user_id}*",
            f"user_profile:{user_id}*",
            f"user_permissions:{user_id}*",
            f"user_analytics:{user_id}*"
        ]

        total_invalidated = 0
        for pattern in patterns:
            count = await self.cache.clear(pattern)
            total_invalidated += count

        logger.info(f"Invalidated {total_invalidated} cache entries for user {user_id}")
        return total_invalidated

    async def invalidate_config_cache(self, config_type: str) -> int:
        """Invalidate configuration cache."""
        pattern = f"config:{config_type}*"
        count = await self.cache.clear(pattern)
        logger.info(f"Invalidated {count} configuration cache entries")
        return count

    async def invalidate_analytics_cache(self, dashboard_id: str = None) -> int:
        """Invalidate analytics cache."""
        if dashboard_id:
            pattern = f"analytics:{dashboard_id}*"
        else:
            pattern = "analytics:*"

        count = await self.cache.clear(pattern)
        logger.info(f"Invalidated {count} analytics cache entries")
        return count

class CacheManager:
    """Main cache management system."""

    def __init__(self, config_file: str = None):
        self.config_file = config_file or 'cache-config.yaml'
        self.config = self._load_config()
        self.backends = {}
        self.cache_warmer = None
        self.cache_invalidator = None

        self._initialize_backends()

    def _load_config(self) -> Dict[str, Any]:
        """Load cache configuration."""
        config_path = Path(self.config_file)
        if config_path.exists():
            with open(config_path, 'r') as f:
                return yaml.safe_load(f)
        else:
            # Return default configuration
            return {
                'default_backend': 'memory',
                'backends': {
                    'memory': {
                        'cache_type': 'memory',
                        'ttl': 300,
                        'max_size': 10000,
                        'eviction_policy': 'lru',
                        'compression': False,
                        'serialization': 'pickle',
                        'key_prefix': 'qb',
                        'namespace': 'quantumbeam'
                    },
                    'redis': {
                        'cache_type': 'redis',
                        'ttl': 1800,
                        'max_size': 100000,
                        'eviction_policy': 'lru',
                        'compression': True,
                        'serialization': 'pickle',
                        'key_prefix': 'qb',
                        'namespace': 'quantumbeam'
                    },
                    'distributed': {
                        'cache_type': 'distributed',
                        'ttl': 900,
                        'max_size': 50000,
                        'eviction_policy': 'lru',
                        'compression': True,
                        'serialization': 'pickle',
                        'key_prefix': 'qb',
                        'namespace': 'quantumbeam'
                    }
                },
                'strategies': {
                    'user_sessions': 'memory',
                    'api_responses': 'redis',
                    'analytics_data': 'distributed',
                    'config_data': 'redis'
                },
                'warming': {
                    'enabled': True,
                    'schedule': '0 */6 * * *',  # Every 6 hours
                    'user_sessions': {'count': 100, 'ttl': 3600},
                    'config_data': {'ttl': 1800},
                    'analytics_data': {'count': 50, 'ttl': 600},
                    'transaction_data': {'count': 100, 'ttl': 300}
                }
            }

    def _initialize_backends(self):
        """Initialize cache backends."""
        for name, backend_config in self.config['backends'].items():
            config = CacheConfig(**backend_config)

            if config.cache_type == 'memory':
                self.backends[name] = MemoryCacheBackend(config)
            elif config.cache_type == 'redis':
                self.backends[name] = RedisCacheBackend(config)
            elif config.cache_type == 'distributed':
                self.backends[name] = DistributedCacheBackend(config)
            else:
                logger.warning(f"Unknown cache type: {config.cache_type}")
                continue

            logger.info(f"Initialized {name} cache backend ({config.cache_type})")

        # Initialize utilities with default backend
        default_backend_name = self.config.get('default_backend', 'memory')
        default_backend = self.backends.get(default_backend_name)
        if default_backend:
            self.cache_warmer = CacheWarmer(default_backend)
            self.cache_invalidator = CacheInvalidator(default_backend)

    def get_backend(self, strategy: str = None) -> CacheBackend:
        """Get cache backend by strategy name."""
        if strategy:
            backend_name = self.config['strategies'].get(strategy)
            if backend_name and backend_name in self.backends:
                return self.backends[backend_name]

        # Fallback to default backend
        default_backend_name = self.config.get('default_backend', 'memory')
        return self.backends.get(default_backend_name)

    async def get(self, key: str, strategy: str = None) -> Optional[Any]:
        """Get value from cache."""
        backend = self.get_backend(strategy)
        return await backend.get(key)

    async def set(self, key: str, value: Any, ttl: Optional[int] = None,
                  strategy: str = None) -> bool:
        """Set value in cache."""
        backend = self.get_backend(strategy)
        return await backend.set(key, value, ttl)

    async def delete(self, key: str, strategy: str = None) -> bool:
        """Delete value from cache."""
        backend = self.get_backend(strategy)
        return await backend.delete(key)

    async def clear(self, pattern: Optional[str] = None,
                   strategy: str = None) -> int:
        """Clear cache entries."""
        backend = self.get_backend(strategy)
        return await backend.clear(pattern)

    async def exists(self, key: str, strategy: str = None) -> bool:
        """Check if key exists in cache."""
        backend = self.get_backend(strategy)
        return await backend.exists(key)

    async def get_stats(self, strategy: str = None) -> Dict[str, CacheMetrics]:
        """Get cache statistics."""
        if strategy:
            backend = self.get_backend(strategy)
            return {strategy: await backend.get_stats()}
        else:
            stats = {}
            for name, backend in self.backends.items():
                stats[name] = await backend.get_stats()
            return stats

    async def warm_cache(self):
        """Warm cache using configured warming strategy."""
        if self.cache_warmer and self.config.get('warming', {}).get('enabled', True):
            await self.cache_warmer.warm_cache(self.config['warming'])

    async def invalidate_user_cache(self, user_id: str) -> int:
        """Invalidate all cache entries for a user."""
        if self.cache_invalidator:
            return await self.cache_invalidator.invalidate_user_cache(user_id)
        return 0

    async def invalidate_config_cache(self, config_type: str) -> int:
        """Invalidate configuration cache."""
        if self.cache_invalidator:
            return await self.cache_invalidator.invalidate_config_cache(config_type)
        return 0

    async def generate_report(self, output_file: str = None) -> str:
        """Generate cache performance report."""
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')

        if not output_file:
            output_file = f'cache-performance-report-{timestamp}.json'

        # Collect statistics from all backends
        all_stats = await self.get_stats()

        # Calculate overall statistics
        total_hits = sum(stats.hits for stats in all_stats.values())
        total_misses = sum(stats.misses for stats in all_stats.values())
        total_requests = total_hits + total_misses
        overall_hit_rate = (total_hits / total_requests * 100) if total_requests > 0 else 0

        report = {
            'timestamp': datetime.now().isoformat(),
            'overall_statistics': {
                'total_hits': total_hits,
                'total_misses': total_misses,
                'total_requests': total_requests,
                'overall_hit_rate_percent': round(overall_hit_rate, 2),
                'total_size_bytes': sum(stats.total_size_bytes for stats in all_stats.values()),
                'total_memory_usage_bytes': sum(stats.memory_usage_bytes for stats in all_stats.values())
            },
            'backend_statistics': {name: asdict(stats) for name, stats in all_stats.items()},
            'configuration': {
                'default_backend': self.config.get('default_backend'),
                'strategies': self.config.get('strategies', {}),
                'warming_enabled': self.config.get('warming', {}).get('enabled', False)
            }
        }

        # Save report
        with open(output_file, 'w') as f:
            json.dump(report, f, indent=2, default=str)

        logger.info(f"Cache performance report generated: {output_file}")
        return output_file

# Decorator functions for easy caching
def cache(key_template: str, ttl: int = None, strategy: str = None):
    """Cache decorator for functions."""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Generate cache key
            cache_key = key_template.format(*args, **kwargs)

            # Try to get from cache
            cache_manager = CacheManager()
            cached_result = await cache_manager.get(cache_key, strategy)

            if cached_result is not None:
                return cached_result

            # Execute function and cache result
            result = await func(*args, **kwargs)
            await cache_manager.set(cache_key, result, ttl, strategy)

            return result

        return wrapper
    return decorator

def cache_result(key_template: str, ttl: int = None, strategy: str = None):
    """Cache decorator for class methods (includes self)."""
    def decorator(func):
        @wraps(func)
        async def wrapper(self, *args, **kwargs):
            # Generate cache key including class name
            class_name = self.__class__.__name__
            method_name = func.__name__
            cache_key = f"{class_name}:{method_name}:{key_template.format(*args, **kwargs)}"

            # Try to get from cache
            cache_manager = CacheManager()
            cached_result = await cache_manager.get(cache_key, strategy)

            if cached_result is not None:
                return cached_result

            # Execute method and cache result
            result = await func(self, *args, **kwargs)
            await cache_manager.set(cache_key, result, ttl, strategy)

            return result

        return wrapper
    return decorator

def main():
    """Main CLI entry point."""
    parser = argparse.ArgumentParser(description='QuantumBeam Cache Manager')
    parser.add_argument('--config', help='Configuration file path')
    parser.add_argument('--action', choices=['stats', 'warm', 'report', 'clear'], required=True,
                       help='Action to perform')
    parser.add_argument('--backend', help='Cache backend to use')
    parser.add_argument('--pattern', help='Pattern for clear action')
    parser.add_argument('--output', help='Output file for report')
    parser.add_argument('--user-id', help='User ID for cache invalidation')

    args = parser.parse_args()

    async def run_action():
        cache_manager = CacheManager(args.config)

        if args.action == 'stats':
            stats = await cache_manager.get_stats(args.backend)
            for backend_name, backend_stats in stats.items():
                print(f"\n{backend_name} Backend Statistics:")
                print(f"  Hits: {backend_stats.hits}")
                print(f"  Misses: {backend_stats.misses}")
                print(f"  Hit Rate: {backend_stats.hit_rate_percent:.2f}%")
                print(f"  Avg Response Time: {backend_stats.avg_response_time_ms:.2f}ms")
                print(f"  Total Size: {backend_stats.total_size_bytes} bytes")

        elif args.action == 'warm':
            await cache_manager.warm_cache()
            print("Cache warming completed")

        elif args.action == 'report':
            report_file = await cache_manager.generate_report(args.output)
            print(f"Cache report generated: {report_file}")

        elif args.action == 'clear':
            if args.pattern:
                count = await cache_manager.clear(args.pattern, args.backend)
                print(f"Cleared {count} cache entries matching pattern: {args.pattern}")
            else:
                count = await cache_manager.clear(strategy=args.backend)
                print(f"Cleared {count} cache entries")

        elif args.action == 'invalidate':
            if args.user_id:
                count = await cache_manager.invalidate_user_cache(args.user_id)
                print(f"Invalidated {count} cache entries for user {args.user_id}")

    # Run the async action
    asyncio.run(run_action())

if __name__ == '__main__':
    main()