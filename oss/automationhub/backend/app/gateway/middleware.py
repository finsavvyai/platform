"""
Gateway Middleware Implementation

This module provides comprehensive middleware for the API gateway including:
- Request/response processing pipeline
- Security headers injection
- CORS handling
- Request logging and monitoring
- IP filtering and access control
- DDoS protection
- Content security policies
- Rate limiting middleware
- Compression middleware
- Cache control

Author: Claude Code Implementation
Task: 1.1.4 API Gateway Implementation
Updated: 2025-01-06
"""

import time
import logging
import asyncio
from typing import Dict, List, Any, Optional, Callable, Set
from datetime import datetime, timedelta
from collections import defaultdict, deque
import ipaddress
import re

from fastapi import Request, Response, HTTPException, status
from fastapi.middleware.base import BaseHTTPMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import RequestResponseEndpoint
from starlette.types import ASGIApp

from app.gateway.config import gateway_config, GatewayPolicyConfig
from app.gateway.core import api_gateway
from app.gateway.rate_limiter import rate_limiter, RateLimitType
from app.gateway.auth import GatewayAuthenticator

logger = logging.getLogger(__name__)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Security headers middleware for enhanced security
    """

    def __init__(self, app: ASGIApp, config: Optional[GatewayPolicyConfig] = None):
        super().__init__(app)
        self.config = config or gateway_config.get_current_config()

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        response = await call_next(request)

        # Add security headers based on configuration
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

        # Additional security headers
        response.headers["X-Content-Security-Policy"] = security_config.csp_policy
        response.headers["X-WebKit-CSP"] = security_config.csp_policy
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"

        # Remove information leakage headers
        response.headers.pop("Server", None)
        response.headers.pop("X-Powered-By", None)

        return response


class CORSMiddleware(BaseHTTPMiddleware):
    """
    Enhanced CORS middleware with configurable policies
    """

    def __init__(self, app: ASGIApp, config: Optional[GatewayPolicyConfig] = None):
        super().__init__(app)
        self.config = config or gateway_config.get_current_config()
        self.cors_config = self.config.cors

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        # Handle preflight requests
        if request.method == "OPTIONS":
            return await self._handle_preflight(request)

        response = await call_next(request)

        # Add CORS headers to actual response
        self._add_cors_headers(request, response)

        return response

    async def _handle_preflight(self, request: Request) -> Response:
        """Handle CORS preflight requests"""
        origin = request.headers.get("origin")

        # Check if origin is allowed
        if not self._is_origin_allowed(origin):
            return Response(
                content="CORS policy violation",
                status_code=status.HTTP_403_FORBIDDEN
            )

        # Create preflight response
        response = Response()
        self._add_cors_headers(request, response)

        # Add preflight-specific headers
        response.headers["Access-Control-Allow-Methods"] = ", ".join(self.cors_config.allow_methods)
        response.headers["Access-Control-Allow-Headers"] = ", ".join(self.cors_config.allow_headers)
        response.headers["Access-Control-Max-Age"] = str(self.cors_config.max_age)

        return response

    def _add_cors_headers(self, request: Request, response: Response):
        """Add CORS headers to response"""
        origin = request.headers.get("origin")

        if origin and self._is_origin_allowed(origin):
            response.headers["Access-Control-Allow-Origin"] = origin

            if self.cors_config.allow_credentials:
                response.headers["Access-Control-Allow-Credentials"] = "true"

            if self.cors_config.expose_headers:
                response.headers["Access-Control-Expose-Headers"] = ", ".join(self.cors_config.expose_headers)

    def _is_origin_allowed(self, origin: Optional[str]) -> bool:
        """Check if origin is allowed"""
        if not origin:
            return False

        if "*" in self.cors_config.allow_origins:
            return True

        return origin in self.cors_config.allow_origins


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Rate limiting middleware with configurable policies
    """

    def __init__(self, app: ASGIApp, config: Optional[GatewayPolicyConfig] = None):
        super().__init__(app)
        self.config = config or gateway_config.get_current_config()
        self.authenticator = GatewayAuthenticator()

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        if not self.config.enable_rate_limiting:
            return await call_next(request)

        try:
            # Get client IP
            client_ip = self._get_client_ip(request)

            # Get authentication result for user-specific rate limiting
            auth_result = await self._get_auth_result(request)

            # Apply rate limits based on authentication
            await self._apply_rate_limits(request, client_ip, auth_result)

            # Process request
            response = await call_next(request)

            return response

        except HTTPException as e:
            if e.status_code == status.HTTP_429_TOO_MANY_REQUESTS:
                return e
            raise
        except Exception as e:
            logger.error(f"Rate limiting middleware error: {e}")
            return await call_next(request)  # Fail open

    def _get_client_ip(self, request: Request) -> str:
        """Get client IP address considering proxies"""
        # Check for forwarded headers
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()

        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip

        return request.client.host if request.client else "unknown"

    async def _get_auth_result(self, request: Request) -> Optional[Dict[str, Any]]:
        """Get authentication result for rate limiting"""
        try:
            auth_result = await self.authenticator.authenticate(request)
            if auth_result.authenticated:
                return {
                    "user_id": auth_result.user_id,
                    "api_key_id": auth_result.api_key_id,
                    "organization_id": auth_result.organization_id,
                    "tier": auth_result.tier
                }
        except Exception:
            pass

        return None

    async def _apply_rate_limits(self, request: Request, client_ip: str, auth_result: Optional[Dict[str, Any]]):
        """Apply appropriate rate limits"""
        endpoint = request.url.path

        # Global rate limiting
        if self.config.rate_limiting.global_limits:
            await self._check_rate_limit(
                RateLimitType.GLOBAL,
                "global",
                endpoint,
                self.config.rate_limiting.global_limits
            )

        # IP-based rate limiting
        if self.config.rate_limiting.ip_based_limits:
            await self._check_rate_limit(
                RateLimitType.PER_IP,
                client_ip,
                endpoint,
                self.config.rate_limiting.default_limits
            )

        # User-based rate limiting
        if auth_result and self.config.rate_limiting.user_based_limits:
            await self._check_rate_limit(
                RateLimitType.PER_USER,
                auth_result["user_id"],
                endpoint,
                self.config.rate_limiting.tier_limits.get(
                    auth_result["tier"],
                    self.config.rate_limiting.default_limits
                )
            )

        # Organization-based rate limiting
        if auth_result and auth_result.get("organization_id") and self.config.rate_limiting.organization_based_limits:
            await self._check_rate_limit(
                RateLimitType.PER_ORGANIZATION,
                auth_result["organization_id"],
                endpoint,
                self.config.rate_limiting.default_limits
            )

    async def _check_rate_limit(self, limit_type: RateLimitType, identifier: str, endpoint: str, limits: Dict[str, int]):
        """Check specific rate limit"""
        result = await rate_limiter.check_rate_limit(
            key_type=limit_type,
            identifier=identifier,
            endpoint=endpoint
        )

        if not result.allowed:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Rate limit exceeded",
                headers={
                    "X-RateLimit-Limit": str(result.limit),
                    "X-RateLimit-Remaining": str(result.remaining),
                    "X-RateLimit-Reset": str(int(result.reset_time.timestamp())),
                    "Retry-After": str(result.retry_after) if result.retry_after else None
                }
            )


class IPFilterMiddleware(BaseHTTPMiddleware):
    """
    IP filtering middleware for access control
    """

    def __init__(self, app: ASGIApp, config: Optional[GatewayPolicyConfig] = None):
        super().__init__(app)
        self.config = config or gateway_config.get_current_config()
        self.blocked_ips: Set[str] = set()
        self.allowed_ips: Set[str] = set()
        self._load_ip_lists()

    def _load_ip_lists(self):
        """Load IP allow/block lists"""
        # This would typically load from configuration or database
        # For now, using empty lists
        pass

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        if not self.config.enable_ip_whitelisting:
            return await call_next(request)

        client_ip = self._get_client_ip(request)

        # Check if IP is blocked
        if self._is_ip_blocked(client_ip):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )

        # Check if IP is allowed (if whitelist is configured)
        if self.allowed_ips and not self._is_ip_allowed(client_ip):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )

        return await call_next(request)

    def _get_client_ip(self, request: Request) -> str:
        """Get client IP address"""
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()

        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip

        return request.client.host if request.client else "unknown"

    def _is_ip_blocked(self, ip: str) -> bool:
        """Check if IP is blocked"""
        try:
            ip_obj = ipaddress.ip_address(ip)

            # Check exact matches
            if ip in self.blocked_ips:
                return True

            # Check CIDR blocks (if implemented)
            # This would require storing CIDR ranges instead of exact IPs

        except ValueError:
            # Invalid IP address
            return True

        return False

    def _is_ip_allowed(self, ip: str) -> bool:
        """Check if IP is allowed"""
        if not self.allowed_ips:
            return True  # No whitelist configured

        try:
            ipaddress.ip_address(ip)  # Validate IP format
            return ip in self.allowed_ips
        except ValueError:
            return False

    def block_ip(self, ip: str):
        """Block an IP address"""
        self.blocked_ips.add(ip)
        logger.info(f"Blocked IP: {ip}")

    def allow_ip(self, ip: str):
        """Allow an IP address"""
        self.allowed_ips.add(ip)
        logger.info(f"Allowed IP: {ip}")

    def unblock_ip(self, ip: str):
        """Unblock an IP address"""
        self.blocked_ips.discard(ip)
        logger.info(f"Unblocked IP: {ip}")

    def remove_allowed_ip(self, ip: str):
        """Remove IP from allowlist"""
        self.allowed_ips.discard(ip)
        logger.info(f"Removed allowed IP: {ip}")


class DDoSProtectionMiddleware(BaseHTTPMiddleware):
    """
    DDoS protection middleware with connection tracking
    """

    def __init__(self, app: ASGIApp, config: Optional[GatewayPolicyConfig] = None):
        super().__init__(app)
        self.config = config or gateway_config.get_current_config()
        self.connection_tracker: Dict[str, deque] = defaultdict(lambda: deque(maxlen=1000))
        self.suspicious_ips: Dict[str, datetime] = {}

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        client_ip = self._get_client_ip(request)
        current_time = datetime.utcnow()

        # Track connection
        self.connection_tracker[client_ip].append(current_time)

        # Clean old connections (older than 1 minute)
        cutoff_time = current_time - timedelta(minutes=1)
        while (self.connection_tracker[client_ip] and
               self.connection_tracker[client_ip][0] < cutoff_time):
            self.connection_tracker[client_ip].popleft()

        # Check connection rate
        connection_count = len(self.connection_tracker[client_ip])
        if connection_count > 1000:  # Configurable threshold
            await self._handle_suspicious_activity(client_ip, f"High connection rate: {connection_count}/min")

        # Check if IP is in suspicious list
        if client_ip in self.suspicious_ips:
            block_duration = timedelta(minutes=30)
            if current_time - self.suspicious_ips[client_ip] < block_duration:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Request rate too high"
                )
            else:
                del self.suspicious_ips[client_ip]

        return await call_next(request)

    def _get_client_ip(self, request: Request) -> str:
        """Get client IP address"""
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()

        return request.client.host if request.client else "unknown"

    async def _handle_suspicious_activity(self, client_ip: str, reason: str):
        """Handle suspicious activity"""
        logger.warning(f"Suspicious activity from {client_ip}: {reason}")
        self.suspicious_ips[client_ip] = datetime.utcnow()


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """
    Request logging middleware for monitoring and analytics
    """

    def __init__(self, app: ASGIApp, config: Optional[GatewayPolicyConfig] = None):
        super().__init__(app)
        self.config = config or gateway_config.get_current_config()
        self.monitoring_config = self.config.monitoring

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        if not self.monitoring_config.enable_request_logging:
            return await call_next(request)

        start_time = time.time()
        request_id = getattr(request.state, "request_id", "")

        try:
            # Log request
            if self.monitoring_config.enable_request_logging:
                await self._log_request(request, request_id)

            # Process request
            response = await call_next(request)

            # Calculate response time
            process_time = time.time() - start_time

            # Log response
            if self.monitoring_config.enable_response_logging:
                await self._log_response(request, response, request_id, process_time)

            # Add timing header
            response.headers["X-Process-Time"] = f"{process_time:.4f}"

            return response

        except Exception as e:
            process_time = time.time() - start_time
            logger.error(f"Request processing error: {e}", exc_info=True)

            # Log error
            await self._log_error(request, request_id, str(e), process_time)

            # Re-raise the exception
            raise

    async def _log_request(self, request: Request, request_id: str):
        """Log incoming request"""
        try:
            log_data = {
                "type": "request",
                "request_id": request_id,
                "timestamp": datetime.utcnow().isoformat(),
                "method": request.method,
                "url": str(request.url),
                "path": request.url.path,
                "query_params": dict(request.query_params),
                "headers": self._sanitize_headers(dict(request.headers)),
                "client_ip": request.client.host if request.client else "unknown",
                "user_agent": request.headers.get("user-agent", "")
            }

            logger.info(f"Gateway request: {log_data}")

        except Exception as e:
            logger.error(f"Request logging error: {e}")

    async def _log_response(self, request: Request, response: Response, request_id: str, process_time: float):
        """Log outgoing response"""
        try:
            log_data = {
                "type": "response",
                "request_id": request_id,
                "timestamp": datetime.utcnow().isoformat(),
                "status_code": response.status_code,
                "process_time_ms": process_time * 1000,
                "response_size": len(response.body) if hasattr(response, 'body') else 0,
                "headers": dict(response.headers)
            }

            level = logger.info if response.status_code < 400 else logger.warning
            level(f"Gateway response: {log_data}")

        except Exception as e:
            logger.error(f"Response logging error: {e}")

    async def _log_error(self, request: Request, request_id: str, error: str, process_time: float):
        """Log request error"""
        try:
            log_data = {
                "type": "error",
                "request_id": request_id,
                "timestamp": datetime.utcnow().isoformat(),
                "method": request.method,
                "url": str(request.url),
                "error": error,
                "process_time_ms": process_time * 1000
            }

            logger.error(f"Gateway error: {log_data}")

        except Exception as e:
            logger.error(f"Error logging error: {e}")

    def _sanitize_headers(self, headers: Dict[str, str]) -> Dict[str, str]:
        """Sanitize headers for logging"""
        sensitive_headers = {
            "authorization", "x-api-key", "cookie", "set-cookie",
            "x-auth-token", "x-forwarded-for"
        }

        sanitized = {}
        for key, value in headers.items():
            if key.lower() in sensitive_headers:
                sanitized[key] = "***REDACTED***"
            elif len(str(value)) > self.monitoring_config.log_header_size_limit:
                sanitized[key] = str(value)[:self.monitoring_config.log_header_size_limit] + "..."
            else:
                sanitized[key] = value

        return sanitized


class CompressionMiddleware(BaseHTTPMiddleware):
    """
    Response compression middleware
    """

    def __init__(self, app: ASGIApp, min_size: int = 1024):
        super().__init__(app)
        self.min_size = min_size

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        response = await call_next(request)

        # Check if response should be compressed
        if self._should_compress(request, response):
            response = await self._compress_response(response)

        return response

    def _should_compress(self, request: Request, response: Response) -> bool:
        """Check if response should be compressed"""
        # Check if client accepts compression
        accept_encoding = request.headers.get("accept-encoding", "")
        if "gzip" not in accept_encoding.lower():
            return False

        # Check response size (simplified - would need actual response body)
        content_type = response.headers.get("content-type", "")

        # Don't compress already compressed content
        if any(ct in content_type.lower() for ct in ["image/", "video/", "audio/", "application/zip", "application/gzip"]):
            return False

        return True

    async def _compress_response(self, response: Response) -> Response:
        """Compress response (simplified implementation)"""
        # This is a placeholder - actual compression would require
        # access to response body and compression libraries
        response.headers["Content-Encoding"] = "gzip"
        return response


class GatewayMiddleware:
    """
    Combined gateway middleware that applies all security and processing features
    """

    def __init__(self, app: ASGIApp, config: Optional[GatewayPolicyConfig] = None):
        self.config = config or gateway_config.get_current_config()

        # Apply middleware in order
        app = SecurityHeadersMiddleware(app, self.config)
        app = RequestLoggingMiddleware(app, self.config)

        if self.config.enable_rate_limiting:
            app = RateLimitMiddleware(app, self.config)

        if self.config.enable_ip_whitelisting:
            app = IPFilterMiddleware(app, self.config)

        # Add DDoS protection for production
        if self.config.security_level in ["high", "critical"]:
            app = DDoSProtectionMiddleware(app, self.config)

        app = CORSMiddleware(app, self.config)
        app = CompressionMiddleware(app)

        self.app = app

    async def __call__(self, scope, receive, send):
        """ASGI callable"""
        return await self.app(scope, receive, send)