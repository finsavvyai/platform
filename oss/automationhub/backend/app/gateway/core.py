"""
Core API Gateway Implementation

This module provides the main API gateway functionality including:
- Request routing and forwarding
- Authentication and authorization integration
- Rate limiting enforcement
- Request/response transformation
- API versioning support
- WebSocket proxy functionality
- Monitoring and analytics
- Error handling and fallback strategies

Author: Claude Code Implementation
Task: 1.1.4 API Gateway Implementation
Updated: 2025-01-06
"""

import asyncio
import json
import time
import uuid
import logging
from typing import Dict, List, Any, Optional, Tuple, Union, Callable
from datetime import datetime, timedelta
from dataclasses import asdict
import hashlib
import secrets
import httpx

from fastapi import Request, Response, HTTPException, status, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from fastapi.middleware.base import BaseHTTPMiddleware
from starlette.middleware.base import RequestResponseEndpoint
from starlette.types import ASGIApp

from app.core.config import settings
from app.gateway.config import gateway_config, GatewayPolicyConfig
from app.gateway.rate_limiter import rate_limiter, RateLimitType, RateLimitResult
from app.gateway.auth import GatewayAuthenticator
from app.gateway.transformer import RequestTransformer, ResponseTransformer
from app.gateway.versioning import APIVersioning
from app.gateway.websocket import WebSocketProxy
from app.gateway.models import APIKey, APIUsageLog, RateLimitType as RateLimitTypeEnum

logger = logging.getLogger(__name__)


class GatewayMetrics:
    """Gateway metrics and analytics collector"""

    def __init__(self):
        self.request_count = 0
        self.error_count = 0
        self.rate_limit_count = 0
        self.auth_failure_count = 0
        self.total_response_time = 0.0
        self.start_time = datetime.utcnow()

    def record_request(self, response_time: float, status_code: int, rate_limited: bool = False, auth_failed: bool = False):
        """Record request metrics"""
        self.request_count += 1
        self.total_response_time += response_time

        if status_code >= 400:
            self.error_count += 1

        if rate_limited:
            self.rate_limit_count += 1

        if auth_failed:
            self.auth_failure_count += 1

    def get_metrics(self) -> Dict[str, Any]:
        """Get current metrics"""
        uptime = datetime.utcnow() - self.start_time
        avg_response_time = self.total_response_time / self.request_count if self.request_count > 0 else 0

        return {
            "uptime_seconds": uptime.total_seconds(),
            "total_requests": self.request_count,
            "error_rate": (self.error_count / self.request_count * 100) if self.request_count > 0 else 0,
            "rate_limit_rate": (self.rate_limit_count / self.request_count * 100) if self.request_count > 0 else 0,
            "auth_failure_rate": (self.auth_failure_count / self.request_count * 100) if self.request_count > 0 else 0,
            "average_response_time_ms": avg_response_time * 1000,
            "requests_per_second": self.request_count / uptime.total_seconds() if uptime.total_seconds() > 0 else 0,
        }


class APIGateway:
    """
    Main API Gateway implementation
    """

    def __init__(self):
        self.config: Optional[GatewayPolicyConfig] = None
        self.authenticator: Optional[GatewayAuthenticator] = None
        self.request_transformer: Optional[RequestTransformer] = None
        self.response_transformer: Optional[ResponseTransformer] = None
        self.versioning: Optional[APIVersioning] = None
        self.websocket_proxy: Optional[WebSocketProxy] = None
        self.metrics = GatewayMetrics()
        self.http_client: Optional[httpx.AsyncClient] = None
        self._initialized = False
        self._shutdown_event = asyncio.Event()

    async def initialize(self):
        """Initialize API gateway components"""
        if self._initialized:
            return

        try:
            # Initialize configuration
            await gateway_config.initialize()
            self.config = gateway_config.get_current_config()

            # Initialize components
            await rate_limiter.initialize()
            self.authenticator = GatewayAuthenticator()
            self.request_transformer = RequestTransformer(self.config)
            self.response_transformer = ResponseTransformer(self.config)
            self.versioning = APIVersioning(self.config)
            self.websocket_proxy = WebSocketProxy(self.config)

            # Initialize HTTP client for upstream requests
            self.http_client = httpx.AsyncClient(
                timeout=httpx.Timeout(30.0),
                limits=httpx.Limits(max_keepalive_connections=100, max_connections=1000)
            )

            self._initialized = True
            logger.info("API Gateway initialized successfully")

        except Exception as e:
            logger.error(f"Failed to initialize API Gateway: {e}")
            raise

    async def shutdown(self):
        """Shutdown API gateway and cleanup resources"""
        self._shutdown_event.set()

        if self.http_client:
            await self.http_client.aclose()

        await rate_limiter.shutdown()
        self._initialized = False
        logger.info("API Gateway shutdown complete")

    async def process_request(
        self,
        request: Request,
        call_next: RequestResponseEndpoint
    ) -> Response:
        """
        Process incoming request through the gateway pipeline

        Pipeline stages:
        1. Request validation and preprocessing
        2. Authentication and authorization
        3. Rate limiting
        4. Request transformation
        5. API versioning
        6. Upstream request
        7. Response transformation
        8. Metrics and logging
        """
        if not self._initialized:
            await self.initialize()

        start_time = time.time()
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id
        request.state.start_time = start_time

        try:
            # Store original request for logging
            original_request = {
                "method": request.method,
                "url": str(request.url),
                "headers": dict(request.headers),
                "client": request.client.host if request.client else None
            }

            # 1. Request validation and preprocessing
            await self._validate_request(request)

            # 2. Authentication and authorization
            auth_result = await self._authenticate_request(request)

            # 3. Rate limiting
            rate_limit_result = await self._apply_rate_limiting(request, auth_result)

            if not rate_limit_result.allowed:
                await self._log_request(
                    request, None, start_time, rate_limited=True,
                    auth_result=auth_result, rate_limit_result=rate_limit_result
                )
                return self._create_rate_limit_response(rate_limit_result)

            # 4. Request transformation
            transformed_request = await self._transform_request(request)

            # 5. API versioning (if applicable)
            versioned_request = await self._apply_versioning(transformed_request)

            # 6. Process request through FastAPI application
            response = await call_next(versioned_request)

            # 7. Response transformation
            transformed_response = await self._transform_response(request, response)

            # 8. Add gateway headers and metrics
            await self._finalize_response(request, transformed_response, auth_result, rate_limit_result)

            # 9. Log request and update metrics
            response_time = time.time() - start_time
            await self._log_request(
                request, transformed_response, start_time,
                auth_result=auth_result, rate_limit_result=rate_limit_result
            )
            self.metrics.record_request(response_time, transformed_response.status_code)

            return transformed_response

        except HTTPException as e:
            # Handle known HTTP exceptions
            response_time = time.time() - start_time
            response = JSONResponse(
                status_code=e.status_code,
                content={
                    "error": e.detail,
                    "request_id": request_id,
                    "timestamp": datetime.utcnow().isoformat()
                }
            )
            await self._log_request(request, response, start_time, error=str(e.detail))
            self.metrics.record_request(response_time, e.status_code, auth_failed=e.status_code == 401)
            return response

        except Exception as e:
            # Handle unexpected errors
            response_time = time.time() - start_time
            logger.error(f"Gateway error for request {request_id}: {e}", exc_info=True)

            response = JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={
                    "error": "Internal server error",
                    "request_id": request_id,
                    "timestamp": datetime.utcnow().isoformat()
                }
            )
            await self._log_request(request, response, start_time, error=str(e))
            self.metrics.record_request(response_time, 500)
            return response

    async def _validate_request(self, request: Request):
        """Validate incoming request"""
        # Check request size
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > settings.MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="Request entity too large"
            )

        # Check required headers
        if not request.headers.get("user-agent"):
            request.headers.mutablecopy()["user-agent"] = "API-Gateway-Client"

    async def _authenticate_request(self, request: Request) -> Dict[str, Any]:
        """Authenticate and authorize request"""
        if not self.authenticator:
            return {"authenticated": False, "reason": "Authenticator not initialized"}

        try:
            auth_result = await self.authenticator.authenticate(request)
            request.state.auth_result = auth_result
            return auth_result

        except Exception as e:
            logger.error(f"Authentication failed: {e}")
            return {"authenticated": False, "reason": str(e)}

    async def _apply_rate_limiting(
        self,
        request: Request,
        auth_result: Dict[str, Any]
    ) -> RateLimitResult:
        """Apply rate limiting to request"""
        if not self.config.enable_rate_limiting:
            return RateLimitResult(
                allowed=True,
                remaining=999999,
                reset_time=datetime.utcnow() + timedelta(minutes=1),
                limit=999999,
                window_start=datetime.utcnow()
            )

        try:
            # Determine rate limit key and configuration
            if auth_result.get("api_key"):
                key_type = RateLimitType.PER_KEY
                identifier = auth_result["api_key"]
                config_name = auth_result.get("tier", "default")
            elif auth_result.get("user_id"):
                key_type = RateLimitType.PER_USER
                identifier = auth_result["user_id"]
                config_name = auth_result.get("tier", "default")
            else:
                key_type = RateLimitType.PER_IP
                identifier = request.client.host if request.client else "unknown"
                config_name = "default"

            endpoint = request.url.path

            # Check rate limit
            result = await rate_limiter.check_rate_limit(
                key_type=key_type,
                identifier=identifier,
                endpoint=endpoint,
                config_name=config_name
            )

            request.state.rate_limit_result = result
            return result

        except Exception as e:
            logger.error(f"Rate limiting failed: {e}")
            # Fail open
            return RateLimitResult(
                allowed=True,
                remaining=999999,
                reset_time=datetime.utcnow() + timedelta(minutes=1),
                limit=999999,
                window_start=datetime.utcnow()
            )

    async def _transform_request(self, request: Request) -> Request:
        """Transform request according to rules"""
        if not self.request_transformer or not self.config.enable_request_transformation:
            return request

        try:
            return await self.request_transformer.transform(request)
        except Exception as e:
            logger.error(f"Request transformation failed: {e}")
            return request

    async def _apply_versioning(self, request: Request) -> Request:
        """Apply API versioning"""
        if not self.versioning or not self.config.enable_api_versioning:
            return request

        try:
            return await self.versioning.process_request(request)
        except Exception as e:
            logger.error(f"API versioning failed: {e}")
            return request

    async def _transform_response(self, request: Request, response: Response) -> Response:
        """Transform response according to rules"""
        if not self.response_transformer or not self.config.enable_response_transformation:
            return response

        try:
            return await self.response_transformer.transform(request, response)
        except Exception as e:
            logger.error(f"Response transformation failed: {e}")
            return response

    async def _finalize_response(
        self,
        request: Request,
        response: Response,
        auth_result: Dict[str, Any],
        rate_limit_result: RateLimitResult
    ):
        """Add gateway headers and finalize response"""
        # Add gateway identification headers
        response.headers["X-Gateway-Request-ID"] = getattr(request.state, "request_id", "")
        response.headers["X-Gateway-Version"] = "1.0.0"
        response.headers["X-Gateway-Timestamp"] = datetime.utcnow().isoformat()

        # Add rate limiting headers
        if rate_limit_result:
            response.headers["X-RateLimit-Limit"] = str(rate_limit_result.limit)
            response.headers["X-RateLimit-Remaining"] = str(rate_limit_result.remaining)
            response.headers["X-RateLimit-Reset"] = str(int(rate_limit_result.reset_time.timestamp()))

        # Add authentication info headers
        if auth_result.get("authenticated"):
            response.headers["X-Authenticated-User"] = str(auth_result.get("user_id", ""))
            response.headers["X-Auth-Method"] = auth_result.get("method", "unknown")

        # Add CORS headers
        await self._add_cors_headers(request, response)

        # Add security headers
        await self._add_security_headers(response)

    async def _add_cors_headers(self, request: Request, response: Response):
        """Add CORS headers to response"""
        cors_config = self.config.cors

        origin = request.headers.get("origin")
        if origin and (cors_config.allow_origins == ["*"] or origin in cors_config.allow_origins):
            response.headers["Access-Control-Allow-Origin"] = origin

        response.headers["Access-Control-Allow-Methods"] = ", ".join(cors_config.allow_methods)
        response.headers["Access-Control-Allow-Headers"] = ", ".join(cors_config.allow_headers)
        response.headers["Access-Control-Max-Age"] = str(cors_config.max_age)

        if cors_config.allow_credentials:
            response.headers["Access-Control-Allow-Credentials"] = "true"

        if cors_config.expose_headers:
            response.headers["Access-Control-Expose-Headers"] = ", ".join(cors_config.expose_headers)

    async def _add_security_headers(self, response: Response):
        """Add security headers to response"""
        security_config = self.config.security_headers

        if security_config.enable_hsts:
            hsts_value = f"max-age={security_config.hsts_max_age}"
            if security_config.hsts_include_subdomains:
                hsts_value += "; includeSubDomains"
            if security_config.hsts_preload:
                hsts_value += "; preload"
            response.headers["Strict-Transport-Security"] = hsts_value

        if security_config.enable_csp:
            csp_header = "Content-Security-Policy-Report-Only" if security_config.enable_content_security_policy_report_only else "Content-Security-Policy"
            response.headers[csp_header] = security_config.csp_policy

        if security_config.enable_x_frame_options:
            response.headers["X-Frame-Options"] = security_config.x_frame_options

        if security_config.enable_x_content_type_options:
            response.headers["X-Content-Type-Options"] = "nosniff"

        if security_config.enable_x_xss_protection:
            response.headers["X-XSS-Protection"] = "1; mode=block"

        if security_config.enable_referrer_policy:
            response.headers["Referrer-Policy"] = security_config.referrer_policy

    def _create_rate_limit_response(self, rate_limit_result: RateLimitResult) -> JSONResponse:
        """Create rate limit exceeded response"""
        headers = {}
        if rate_limit_result.retry_after:
            headers["Retry-After"] = str(rate_limit_result.retry_after)

        return JSONResponse(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            content={
                "error": "Rate limit exceeded",
                "limit": rate_limit_result.limit,
                "reset_time": rate_limit_result.reset_time.isoformat(),
                "retry_after": rate_limit_result.retry_after
            },
            headers=headers
        )

    async def _log_request(
        self,
        request: Request,
        response: Optional[Response],
        start_time: float,
        error: Optional[str] = None,
        rate_limited: bool = False,
        auth_result: Optional[Dict[str, Any]] = None,
        rate_limit_result: Optional[RateLimitResult] = None
    ):
        """Log request details and metrics"""
        try:
            response_time = (time.time() - start_time) * 1000  # Convert to milliseconds

            log_data = {
                "request_id": getattr(request.state, "request_id", ""),
                "timestamp": datetime.utcnow().isoformat(),
                "method": request.method,
                "url": str(request.url),
                "path": request.url.path,
                "query_params": str(request.url.query),
                "user_agent": request.headers.get("user-agent", ""),
                "ip_address": request.client.host if request.client else "unknown",
                "origin": request.headers.get("origin", ""),
                "response_time_ms": response_time,
                "rate_limited": rate_limited,
                "error": error
            }

            if response:
                log_data.update({
                    "status_code": response.status_code,
                    "response_size": len(response.body) if hasattr(response, 'body') else 0
                })

            if auth_result:
                log_data.update({
                    "authenticated": auth_result.get("authenticated", False),
                    "user_id": auth_result.get("user_id"),
                    "api_key_id": auth_result.get("api_key_id"),
                    "tier": auth_result.get("tier")
                })

            if rate_limit_result:
                log_data.update({
                    "rate_limit_remaining": rate_limit_result.remaining,
                    "rate_limit_limit": rate_limit_result.limit
                })

            # Log at appropriate level based on status
            if response and response.status_code >= 500:
                logger.error(f"Gateway request failed: {json.dumps(log_data)}")
            elif response and response.status_code >= 400:
                logger.warning(f"Gateway request error: {json.dumps(log_data)}")
            elif rate_limited:
                logger.info(f"Gateway request rate limited: {json.dumps(log_data)}")
            else:
                logger.info(f"Gateway request: {json.dumps(log_data)}")

        except Exception as e:
            logger.error(f"Failed to log request: {e}")

    async def process_websocket(self, websocket: WebSocket, endpoint: str):
        """Process WebSocket connection through the gateway"""
        if not self.websocket_proxy or not self.config.enable_websocket_proxy:
            raise HTTPException(
                status_code=status.HTTP_501_NOT_IMPLEMENTED,
                detail="WebSocket proxy not enabled"
            )

        return await self.websocket_proxy.handle_connection(websocket, endpoint)

    def get_metrics(self) -> Dict[str, Any]:
        """Get gateway metrics"""
        return self.metrics.get_metrics()

    def get_status(self) -> Dict[str, Any]:
        """Get gateway status"""
        return {
            "initialized": self._initialized,
            "uptime": self.metrics.get_metrics()["uptime_seconds"],
            "total_requests": self.metrics.request_count,
            "error_rate": self.metrics.get_metrics()["error_rate"],
            "average_response_time_ms": self.metrics.get_metrics()["average_response_time_ms"],
            "rate_limiting_enabled": self.config.enable_rate_limiting if self.config else False,
            "authentication_enabled": self.config.authentication.require_api_key if self.config else False,
            "versioning_enabled": self.config.enable_api_versioning if self.config else False,
        }


# Global gateway instance
api_gateway = APIGateway()