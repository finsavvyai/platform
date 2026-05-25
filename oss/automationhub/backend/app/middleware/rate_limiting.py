"""
Rate Limiting Middleware with Redis backend and role-based throttling
"""

import time
import json
from typing import Optional, Dict, Any, Callable
from fastapi import Request, Response, HTTPException, status
from fastapi.responses import JSONResponse
import redis.asyncio as redis
import logging
from datetime import datetime, timedelta

from app.core.config import settings
from app.core.redis import get_redis_client

logger = logging.getLogger(__name__)


class RateLimitExceeded(Exception):
    """Rate limit exceeded exception"""
    def __init__(self, retry_after: int, limit: int, window: int):
        self.retry_after = retry_after
        self.limit = limit
        self.window = window
        super().__init__(f"Rate limit exceeded: {limit} requests per {window} seconds")


class RateLimiter:
    """Redis-based rate limiter with sliding window"""
    
    def __init__(self, redis_client: Optional[redis.Redis] = None):
        self.redis = redis_client or get_redis_client()
        
        # Default rate limits by user role
        self.default_limits = {
            "super_admin": {"requests": 10000, "window": 3600},  # 10k/hour
            "admin": {"requests": 5000, "window": 3600},         # 5k/hour
            "manager": {"requests": 2000, "window": 3600},       # 2k/hour
            "developer": {"requests": 1000, "window": 3600},     # 1k/hour
            "user": {"requests": 500, "window": 3600},           # 500/hour
            "viewer": {"requests": 200, "window": 3600},         # 200/hour
            "anonymous": {"requests": 100, "window": 3600},      # 100/hour for unauthenticated
        }
        
        # Endpoint-specific limits (overrides role limits)
        self.endpoint_limits = {
            "/api/v1/auth/login": {"requests": 10, "window": 300},      # 10 login attempts per 5 min
            "/api/v1/auth/register": {"requests": 5, "window": 3600},   # 5 registrations per hour
            "/api/v1/auth/mfa/verify": {"requests": 5, "window": 300},  # 5 MFA attempts per 5 min
            "/api/v1/workflows/execute": {"requests": 50, "window": 3600}, # 50 workflow executions per hour
            "/api/v1/agents/execute": {"requests": 100, "window": 3600},   # 100 agent executions per hour
        }
    
    async def is_rate_limited(
        self, 
        key: str, 
        limit: int, 
        window: int,
        identifier: str = "request"
    ) -> tuple[bool, Dict[str, Any]]:
        """
        Check if request is rate limited using sliding window algorithm
        Returns (is_limited, info_dict)
        """
        try:
            current_time = int(time.time())
            pipeline = self.redis.pipeline()
            
            # Remove expired entries
            pipeline.zremrangebyscore(key, 0, current_time - window)
            
            # Count current requests in window
            pipeline.zcard(key)
            
            # Add current request
            pipeline.zadd(key, {f"{identifier}:{current_time}": current_time})
            
            # Set expiration
            pipeline.expire(key, window + 1)
            
            results = await pipeline.execute()
            current_count = results[1] + 1  # +1 for the request we just added
            
            if current_count > limit:
                # Remove the request we just added since it's over limit
                await self.redis.zrem(key, f"{identifier}:{current_time}")
                
                # Calculate retry after
                oldest_request = await self.redis.zrange(key, 0, 0, withscores=True)
                if oldest_request:
                    oldest_time = int(oldest_request[0][1])
                    retry_after = window - (current_time - oldest_time)
                else:
                    retry_after = window
                
                return True, {
                    "limited": True,
                    "limit": limit,
                    "remaining": 0,
                    "reset_time": current_time + retry_after,
                    "retry_after": max(1, retry_after)
                }
            
            return False, {
                "limited": False,
                "limit": limit,
                "remaining": limit - current_count,
                "reset_time": current_time + window,
                "retry_after": 0
            }
            
        except Exception as e:
            logger.error(f"Rate limiting error: {e}")
            # Fail open - allow request if Redis is down
            return False, {
                "limited": False,
                "limit": limit,
                "remaining": limit,
                "reset_time": int(time.time()) + window,
                "retry_after": 0
            }
    
    def get_rate_limit_for_user(self, user_role: str, endpoint: str) -> Dict[str, int]:
        """Get rate limit configuration for user role and endpoint"""
        # Check endpoint-specific limits first
        if endpoint in self.endpoint_limits:
            return self.endpoint_limits[endpoint]
        
        # Fall back to role-based limits
        return self.default_limits.get(user_role, self.default_limits["anonymous"])
    
    def get_client_identifier(self, request: Request) -> str:
        """Get client identifier for rate limiting"""
        # Try to get user ID from request state (set by auth middleware)
        user_id = getattr(request.state, "user_id", None)
        if user_id:
            return f"user:{user_id}"
        
        # Fall back to IP address
        client_ip = request.client.host
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            client_ip = forwarded_for.split(",")[0].strip()
        
        return f"ip:{client_ip}"
    
    def get_user_role(self, request: Request) -> str:
        """Get user role from request state"""
        return getattr(request.state, "user_role", "anonymous")


class RateLimitMiddleware:
    """Rate limiting middleware"""
    
    def __init__(self):
        self.rate_limiter = RateLimiter()
    
    async def __call__(self, request: Request, call_next: Callable) -> Response:
        """Process request with rate limiting"""
        
        # Skip rate limiting for health checks and static files
        if self._should_skip_rate_limiting(request):
            return await call_next(request)
        
        try:
            # Get client identifier and user role
            client_id = self.rate_limiter.get_client_identifier(request)
            user_role = self.rate_limiter.get_user_role(request)
            endpoint = request.url.path
            
            # Get rate limit configuration
            rate_config = self.rate_limiter.get_rate_limit_for_user(user_role, endpoint)
            
            # Create rate limit key
            rate_key = f"rate_limit:{client_id}:{endpoint}"
            
            # Check rate limit
            is_limited, rate_info = await self.rate_limiter.is_rate_limited(
                rate_key,
                rate_config["requests"],
                rate_config["window"],
                f"{request.method}:{int(time.time())}"
            )
            
            if is_limited:
                logger.warning(
                    f"Rate limit exceeded for {client_id} on {endpoint}. "
                    f"Limit: {rate_info['limit']}, Retry after: {rate_info['retry_after']}s"
                )
                
                return JSONResponse(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    content={
                        "error": "Rate limit exceeded",
                        "message": f"Too many requests. Try again in {rate_info['retry_after']} seconds.",
                        "retry_after": rate_info["retry_after"]
                    },
                    headers={
                        "X-RateLimit-Limit": str(rate_info["limit"]),
                        "X-RateLimit-Remaining": str(rate_info["remaining"]),
                        "X-RateLimit-Reset": str(rate_info["reset_time"]),
                        "Retry-After": str(rate_info["retry_after"])
                    }
                )
            
            # Process request
            response = await call_next(request)
            
            # Add rate limit headers to response
            response.headers["X-RateLimit-Limit"] = str(rate_info["limit"])
            response.headers["X-RateLimit-Remaining"] = str(rate_info["remaining"])
            response.headers["X-RateLimit-Reset"] = str(rate_info["reset_time"])
            
            return response
            
        except Exception as e:
            logger.error(f"Rate limiting middleware error: {e}")
            # Fail open - continue with request if middleware fails
            return await call_next(request)
    
    def _should_skip_rate_limiting(self, request: Request) -> bool:
        """Check if rate limiting should be skipped for this request"""
        skip_paths = [
            "/health",
            "/metrics",
            "/docs",
            "/redoc",
            "/openapi.json",
            "/favicon.ico"
        ]
        
        return any(request.url.path.startswith(path) for path in skip_paths)


# Decorator for endpoint-specific rate limiting
def rate_limit(requests: int, window: int):
    """Decorator for endpoint-specific rate limiting"""
    def decorator(func):
        func._rate_limit = {"requests": requests, "window": window}
        return func
    return decorator


# Utility functions for manual rate limiting
async def check_rate_limit(
    request: Request,
    key_suffix: str,
    limit: int,
    window: int
) -> None:
    """Manual rate limit check that raises HTTPException if exceeded"""
    rate_limiter = RateLimiter()
    client_id = rate_limiter.get_client_identifier(request)
    rate_key = f"rate_limit:{client_id}:{key_suffix}"
    
    is_limited, rate_info = await rate_limiter.is_rate_limited(
        rate_key, limit, window
    )
    
    if is_limited:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "error": "Rate limit exceeded",
                "retry_after": rate_info["retry_after"]
            },
            headers={
                "Retry-After": str(rate_info["retry_after"])
            }
        )


async def get_rate_limit_status(
    request: Request,
    key_suffix: str,
    limit: int,
    window: int
) -> Dict[str, Any]:
    """Get current rate limit status without incrementing counter"""
    rate_limiter = RateLimiter()
    client_id = rate_limiter.get_client_identifier(request)
    rate_key = f"rate_limit:{client_id}:{key_suffix}"
    
    try:
        current_time = int(time.time())
        
        # Count current requests without adding new one
        await rate_limiter.redis.zremrangebyscore(rate_key, 0, current_time - window)
        current_count = await rate_limiter.redis.zcard(rate_key)
        
        return {
            "limit": limit,
            "remaining": max(0, limit - current_count),
            "reset_time": current_time + window,
            "window": window
        }
        
    except Exception as e:
        logger.error(f"Error getting rate limit status: {e}")
        return {
            "limit": limit,
            "remaining": limit,
            "reset_time": int(time.time()) + window,
            "window": window
        }