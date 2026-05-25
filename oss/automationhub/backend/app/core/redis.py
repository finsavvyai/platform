"""
Redis client configuration and utilities
"""

import redis.asyncio as redis
from typing import Optional, Any, Dict
import json
import pickle
import logging
from datetime import timedelta

from app.core.config import settings

logger = logging.getLogger(__name__)


class RedisClient:
    """Redis client wrapper with utility methods"""
    
    def __init__(self):
        self.redis: Optional[redis.Redis] = None
        self._connected = False
    
    async def connect(self):
        """Connect to Redis"""
        try:
            self.redis = redis.from_url(
                settings.REDIS_URL,
                encoding="utf-8",
                decode_responses=True,
                socket_connect_timeout=5,
                socket_keepalive=True,
                socket_keepalive_options={},
                health_check_interval=30
            )
            
            # Test connection
            await self.redis.ping()
            self._connected = True
            logger.info("Redis connection established")
            
        except Exception as e:
            logger.error(f"Failed to connect to Redis: {e}")
            raise
    
    async def disconnect(self):
        """Disconnect from Redis"""
        if self.redis:
            await self.redis.close()
            self._connected = False
            logger.info("Redis connection closed")
    
    async def ping(self):
        """Ping Redis server"""
        if not self.redis:
            await self.connect()
        return await self.redis.ping()
    
    async def set(
        self, 
        key: str, 
        value: Any, 
        expire: Optional[int] = None,
        serialize: bool = True
    ) -> bool:
        """Set a key-value pair"""
        if not self.redis:
            await self.connect()
        
        if serialize:
            if isinstance(value, (dict, list)):
                value = json.dumps(value)
            elif not isinstance(value, (str, int, float, bool)):
                value = pickle.dumps(value)
        
        return await self.redis.set(key, value, ex=expire)
    
    async def get(
        self, 
        key: str, 
        deserialize: bool = True,
        default: Any = None
    ) -> Any:
        """Get a value by key"""
        if not self.redis:
            await self.connect()
        
        value = await self.redis.get(key)
        if value is None:
            return default
        
        if deserialize:
            try:
                # Try JSON first
                return json.loads(value)
            except (json.JSONDecodeError, TypeError):
                try:
                    # Try pickle
                    return pickle.loads(value)
                except (pickle.PickleError, TypeError):
                    # Return as string
                    return value
        
        return value
    
    async def delete(self, *keys: str) -> int:
        """Delete one or more keys"""
        if not self.redis:
            await self.connect()
        return await self.redis.delete(*keys)
    
    async def exists(self, key: str) -> bool:
        """Check if key exists"""
        if not self.redis:
            await self.connect()
        return bool(await self.redis.exists(key))
    
    async def expire(self, key: str, seconds: int) -> bool:
        """Set expiration for a key"""
        if not self.redis:
            await self.connect()
        return await self.redis.expire(key, seconds)
    
    async def ttl(self, key: str) -> int:
        """Get time to live for a key"""
        if not self.redis:
            await self.connect()
        return await self.redis.ttl(key)
    
    async def incr(self, key: str, amount: int = 1) -> int:
        """Increment a key"""
        if not self.redis:
            await self.connect()
        return await self.redis.incr(key, amount)
    
    async def decr(self, key: str, amount: int = 1) -> int:
        """Decrement a key"""
        if not self.redis:
            await self.connect()
        return await self.redis.decr(key, amount)
    
    async def hset(self, name: str, mapping: Dict[str, Any]) -> int:
        """Set hash fields"""
        if not self.redis:
            await self.connect()
        
        # Serialize complex values
        serialized_mapping = {}
        for k, v in mapping.items():
            if isinstance(v, (dict, list)):
                serialized_mapping[k] = json.dumps(v)
            else:
                serialized_mapping[k] = str(v)
        
        return await self.redis.hset(name, mapping=serialized_mapping)
    
    async def hget(self, name: str, key: str, deserialize: bool = True) -> Any:
        """Get hash field"""
        if not self.redis:
            await self.connect()
        
        value = await self.redis.hget(name, key)
        if value is None:
            return None
        
        if deserialize:
            try:
                return json.loads(value)
            except (json.JSONDecodeError, TypeError):
                return value
        
        return value
    
    async def hgetall(self, name: str, deserialize: bool = True) -> Dict[str, Any]:
        """Get all hash fields"""
        if not self.redis:
            await self.connect()
        
        data = await self.redis.hgetall(name)
        if not deserialize:
            return data
        
        # Deserialize values
        result = {}
        for k, v in data.items():
            try:
                result[k] = json.loads(v)
            except (json.JSONDecodeError, TypeError):
                result[k] = v
        
        return result
    
    async def hdel(self, name: str, *keys: str) -> int:
        """Delete hash fields"""
        if not self.redis:
            await self.connect()
        return await self.redis.hdel(name, *keys)
    
    async def lpush(self, name: str, *values: Any) -> int:
        """Push values to list (left)"""
        if not self.redis:
            await self.connect()
        
        serialized_values = []
        for value in values:
            if isinstance(value, (dict, list)):
                serialized_values.append(json.dumps(value))
            else:
                serialized_values.append(str(value))
        
        return await self.redis.lpush(name, *serialized_values)
    
    async def rpop(self, name: str, deserialize: bool = True) -> Any:
        """Pop value from list (right)"""
        if not self.redis:
            await self.connect()
        
        value = await self.redis.rpop(name)
        if value is None:
            return None
        
        if deserialize:
            try:
                return json.loads(value)
            except (json.JSONDecodeError, TypeError):
                return value
        
        return value
    
    async def llen(self, name: str) -> int:
        """Get list length"""
        if not self.redis:
            await self.connect()
        return await self.redis.llen(name)
    
    async def close(self):
        """Close Redis connection"""
        await self.disconnect()


# Global Redis client instance
redis_client = RedisClient()