"""
Comprehensive Security Middleware for Universal Dependency Platform.

Provides multiple layers of security including rate limiting, request validation,
security headers, threat detection, and comprehensive logging.
"""

import asyncio
import logging
import re
import time
from datetime import datetime
from typing import Any
from urllib.parse import urlparse

from fastapi import Request, Response, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint

from ...core.config import settings
from ...security.rate_limiter import RateLimitResult, get_rate_limiter
from ...security.threat_detector import ThreatDetector

logger = logging.getLogger(__name__)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Middleware to add comprehensive security headers to all responses.
    """

    def __init__(self, app, https_enabled: bool = True):
        super().__init__(app)
        self.https_enabled = https_enabled
        self.settings = settings

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        response = await call_next(request)

        # Add security headers
        security_headers = {
            # Clickjacking protection
            "X-Frame-Options": "DENY",
            # MIME type sniffing protection
            "X-Content-Type-Options": "nosniff",
            # XSS protection
            "X-XSS-Protection": "1; mode=block",
            # Referrer policy
            "Referrer-Policy": "strict-origin-when-cross-origin",
            # Content Security Policy
            "Content-Security-Policy": self._get_csp_header(),
            # Permissions policy (formerly Feature Policy)
            "Permissions-Policy": self._get_permissions_policy(),
            # Strict transport security (HTTPS only)
            **(self._get_hsts_headers() if self.https_enabled else {}),
            # API security headers
            "X-API-Version": "1.0",
            "X-RateLimit-Limit": "1000/hour",
            # Cache control for sensitive endpoints
            **self._get_cache_control_headers(request),
        }

        for header, value in security_headers.items():
            response.headers[header] = value

        return response

    def _get_csp_header(self) -> str:
        """Generate Content Security Policy header."""
        directives = [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "font-src 'self' https://fonts.gstatic.com",
            "img-src 'self' data: https:",
            "connect-src 'self'",
            "frame-ancestors 'none'",
            "base-uri 'self'",
            "form-action 'self'",
        ]
        return "; ".join(directives)

    def _get_permissions_policy(self) -> str:
        """Generate Permissions Policy header."""
        permissions = [
            "geolocation=()",
            "microphone=()",
            "camera=()",
            "payment=()",
            "usb=()",
            "magnetometer=()",
            "gyroscope=()",
            "accelerometer=()",
            "ambient-light-sensor=()",
        ]
        return ", ".join(permissions)

    def _get_hsts_headers(self) -> dict[str, str]:
        """Get HTTP Strict Transport Security headers."""
        if self.settings.ENVIRONMENT == "production":
            return {
                "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload"
            }
        else:
            return {"Strict-Transport-Security": "max-age=300"}

    def _get_cache_control_headers(self, request: Request) -> dict[str, str]:
        """Get cache control headers for sensitive endpoints."""
        sensitive_paths = ["/auth/", "/api/v1/auth/", "/users/me", "/api-keys"]

        if any(path in request.url.path for path in sensitive_paths):
            return {
                "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
                "Pragma": "no-cache",
                "Expires": "0",
            }

        return {}


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Advanced rate limiting middleware with multiple strategies and scopes.
    """

    def __init__(self, app, rate_limiter=None):
        super().__init__(app)
        self.rate_limiter = rate_limiter
        self.threat_detector = ThreatDetector()

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        # Get rate limiter if not provided
        if not self.rate_limiter:
            self.rate_limiter = await get_rate_limiter()

        # Extract request context
        context = await self._extract_context(request)

        # Check for malicious requests first
        threat_score = await self.threat_detector.analyze_request(request, context)
        if threat_score > 0.8:
            logger.warning(
                f"High threat score detected: {threat_score} from {context.get('ip_address')}"
            )
            return self._create_threat_response(threat_score)

        # Apply rate limits
        rate_limit_result = await self._check_rate_limits(request, context)

        if not rate_limit_result.allowed:
            logger.warning(
                f"Rate limit exceeded for {context.get('user_id', context.get('ip_address'))}"
            )
            return self._create_rate_limit_response(rate_limit_result)

        # Process request
        response = await call_next(request)

        # Add rate limit headers
        self._add_rate_limit_headers(response, rate_limit_result)

        return response

    async def _extract_context(self, request: Request) -> dict[str, Any]:
        """Extract context information from request."""
        # Get IP address
        forwarded_for = request.headers.get("X-Forwarded-For")
        real_ip = request.headers.get("X-Real-IP")
        ip_address = forwarded_for.split(",")[0].strip() if forwarded_for else real_ip
        ip_address = ip_address or request.client.host if request.client else "unknown"

        # Get user info
        user_id = getattr(request.state, "user_id", None)
        organization_id = getattr(request.state, "organization_id", None)
        api_key = getattr(request.state, "api_key", None)

        # Get endpoint information
        endpoint_path = self._get_endpoint_path(request)
        method = request.method

        return {
            "ip_address": ip_address,
            "user_id": user_id,
            "organization_id": organization_id,
            "api_key": api_key,
            "endpoint_path": endpoint_path,
            "method": method,
            "user_agent": request.headers.get("User-Agent", ""),
            "referer": request.headers.get("Referer", ""),
        }

    def _get_endpoint_path(self, request: Request) -> str:
        """Get normalized endpoint path for rate limiting."""
        # Remove query parameters
        path = urlparse(str(request.url)).path

        # Normalize path parameters (e.g., /api/v1/projects/123 -> /api/v1/projects/{id})
        path_patterns = [
            r"/api/v1/projects/[^/]+",
            r"/api/v1/organizations/[^/]+",
            r"/api/v1/users/[^/]+",
            r"/api/v1/packages/[^/]+",
            r"/api/v1/dependencies/[^/]+",
            r"/api/v1/vulnerabilities/[^/]+",
            r"/api/v1/workflows/[^/]+",
            r"/api/v1/analyses/[^/]+",
        ]

        normalized_path = path
        for pattern in path_patterns:
            normalized_path = re.sub(
                pattern, pattern.replace(r"[^/]+", "{id}"), normalized_path
            )

        return normalized_path

    async def _check_rate_limits(
        self, request: Request, context: dict[str, Any]
    ) -> RateLimitResult:
        """Check multiple rate limits based on request context."""
        rate_limit_checks = []

        # Define rate limit rules to check based on endpoint
        endpoint_path = context["endpoint_path"]
        method = context["method"]

        # Global DoS protection
        rate_limit_checks.append(
            self.rate_limiter.check_rate_limit("global_dos_protection", **context)
        )

        # User-based limits
        if context["user_id"]:
            rate_limit_checks.append(
                self.rate_limiter.check_rate_limit("api_general", **context)
            )

            # User + endpoint specific limits
            rate_limit_checks.append(
                self.rate_limiter.check_rate_limit(
                    "api_general", endpoint=f"{method}:{endpoint_path}", **context
                )
            )

        # Auth endpoint limits
        if "/auth/" in endpoint_path:
            if "login" in endpoint_path or "token" in endpoint_path:
                rate_limit_checks.append(
                    self.rate_limiter.check_rate_limit("auth_login", **context)
                )
            elif "password-reset" in endpoint_path:
                rate_limit_checks.append(
                    self.rate_limiter.check_rate_limit("auth_password_reset", **context)
                )

        # Analysis endpoint limits
        if "/analysis" in endpoint_path or "/analyses" in endpoint_path:
            rate_limit_checks.append(
                self.rate_limiter.check_rate_limit("analysis_requests", **context)
            )

        # API key limits
        if context["api_key"]:
            rate_limit_checks.append(
                self.rate_limiter.check_rate_limit("api_key_requests", **context)
            )

        # IP-based limits (for unauthenticated requests)
        if not context["user_id"]:
            rate_limit_checks.append(
                self.rate_limiter.check_rate_limit("api_general", **context)
            )

        # Execute all checks and return the most restrictive result
        results = await asyncio.gather(*rate_limit_checks, return_exceptions=True)

        valid_results = [r for r in results if isinstance(r, RateLimitResult)]

        if not valid_results:
            # Fallback to permissive result
            return RateLimitResult(
                allowed=True,
                remaining=1000,
                reset_time=int(time.time() + 3600),
                retry_after=None,
                limit=1000,
                window=3600,
                strategy="sliding_window",
                scope="user",
                key="fallback",
            )

        # Return the most restrictive result (disallowed if any, otherwise lowest remaining)
        disallowed_results = [r for r in valid_results if not r.allowed]
        if disallowed_results:
            return disallowed_results[0]  # Return first disallowed result

        # Return result with lowest remaining count
        return min(valid_results, key=lambda r: r.remaining)

    def _add_rate_limit_headers(self, response: Response, result: RateLimitResult):
        """Add rate limit headers to response."""
        response.headers["X-RateLimit-Limit"] = str(result.limit)
        response.headers["X-RateLimit-Remaining"] = str(result.remaining)
        response.headers["X-RateLimit-Reset"] = str(result.reset_time)
        response.headers["X-RateLimit-Window"] = str(result.window)

        if not result.allowed and result.retry_after:
            response.headers["Retry-After"] = str(result.retry_after)

    def _create_rate_limit_response(self, result: RateLimitResult) -> JSONResponse:
        """Create a rate limit exceeded response."""
        return JSONResponse(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            content={
                "error": "rate_limit_exceeded",
                "message": "Too many requests. Please try again later.",
                "details": {
                    "limit": result.limit,
                    "window": result.window,
                    "reset_time": result.reset_time,
                    "retry_after": result.retry_after,
                },
                "timestamp": datetime.utcnow().isoformat(),
            },
            headers={
                "Retry-After": str(result.retry_after) if result.retry_after else "60",
                "X-RateLimit-Limit": str(result.limit),
                "X-RateLimit-Remaining": "0",
                "X-RateLimit-Reset": str(result.reset_time),
            },
        )

    def _create_threat_response(self, threat_score: float) -> JSONResponse:
        """Create a threat detection response."""
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={
                "error": "threat_detected",
                "message": "Request blocked for security reasons.",
                "details": {
                    "threat_score": round(threat_score, 3),
                    "reason": "Suspicious activity detected",
                },
                "timestamp": datetime.utcnow().isoformat(),
            },
        )


class RequestValidationMiddleware(BaseHTTPMiddleware):
    """
    Middleware for request validation and sanitization.
    """

    def __init__(self, app):
        super().__init__(app)
        self.max_request_size = 10 * 1024 * 1024  # 10MB
        self.blocked_user_agents = self._load_blocked_user_agents()
        self.allowed_origins = self._load_allowed_origins()

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        # Validate request size
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > self.max_request_size:
            return JSONResponse(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                content={
                    "error": "request_too_large",
                    "message": "Request size exceeds limit",
                },
            )

        # Validate User-Agent
        user_agent = request.headers.get("User-Agent", "")
        if self._is_blocked_user_agent(user_agent):
            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content={
                    "error": "blocked_user_agent",
                    "message": "User agent not allowed",
                },
            )

        # Validate Origin for API requests
        origin = request.headers.get("Origin")
        if origin and not self._is_allowed_origin(origin):
            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content={"error": "invalid_origin", "message": "Origin not allowed"},
            )

        # Validate request path
        if not self._is_valid_path(request.url.path):
            return JSONResponse(
                status_code=status.HTTP_404_NOT_FOUND,
                content={"error": "not_found", "message": "Resource not found"},
            )

        # Validate HTTP method
        if not self._is_allowed_method(request.method, request.url.path):
            return JSONResponse(
                status_code=status.HTTP_405_METHOD_NOT_ALLOWED,
                content={
                    "error": "method_not_allowed",
                    "message": "Method not allowed for this endpoint",
                },
            )

        return await call_next(request)

    def _load_blocked_user_agents(self) -> set[str]:
        """Load blocked user agents."""
        return {
            "curl",
            "wget",
            "python-requests",
            "python-urllib3",
            "nmap",
            "sqlmap",
            "nikto",
            "burp",
            "metasploit",
        }

    def _load_allowed_origins(self) -> set[str]:
        """Load allowed origins based on environment."""
        self.settings = settings

        if settings.ENVIRONMENT == "development":
            return {
                "http://localhost:3000",
                "http://localhost:8040",
                "http://127.0.0.1:3000",
            }
        else:
            # Production origins should be configured in settings
            return getattr(settings, "ALLOWED_ORIGINS", set())

    def _is_blocked_user_agent(self, user_agent: str) -> bool:
        """Check if user agent is blocked."""
        user_agent_lower = user_agent.lower()
        return any(blocked in user_agent_lower for blocked in self.blocked_user_agents)

    def _is_allowed_origin(self, origin: str) -> bool:
        """Check if origin is allowed."""
        if not self.allowed_origins:
            return True  # Allow if no restrictions configured

        return origin in self.allowed_origins

    def _is_valid_path(self, path: str) -> bool:
        """Validate request path for security issues."""
        # Check for path traversal attempts
        if "../" in path or "..\\" in path:
            return False

        # Check for suspicious patterns
        suspicious_patterns = [
            r"\.\./",
            r"\.\\",
            r"/etc/",
            r"/var/",
            r"/proc/",
            r"/sys/",
            r"<script",
            r"javascript:",
        ]

        for pattern in suspicious_patterns:
            if re.search(pattern, path, re.IGNORECASE):
                return False

        return True

    def _is_allowed_method(self, method: str, path: str) -> bool:
        """Check if HTTP method is allowed for the path."""
        allowed_methods = {
            "/api/": {"GET", "POST", "PUT", "DELETE", "PATCH"},
            "/auth/": {"POST"},
            "/health": {"GET"},
            "/metrics": {"GET"},
            "/docs": {"GET"},
            "/openapi.json": {"GET"},
        }

        for path_pattern, methods in allowed_methods.items():
            if path.startswith(path_pattern):
                return method in methods

        # Default allow if no specific rule matches
        return method in {"GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"}


class AuditLoggingMiddleware(BaseHTTPMiddleware):
    """
    Middleware for comprehensive audit logging of all requests.
    """

    def __init__(self, app):
        super().__init__(app)
        self.logger = logging.getLogger("audit")
        self.excluded_paths = {"/health", "/metrics", "/docs", "/openapi.json"}

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        start_time = time.time()

        # Extract request context
        context = await self._extract_audit_context(request)

        # Process request
        response = await call_next(request)

        # Calculate processing time
        process_time = time.time() - start_time

        # Log the request/response
        await self._log_request_response(request, response, context, process_time)

        return response

    async def _extract_audit_context(self, request: Request) -> dict[str, Any]:
        """Extract context for audit logging."""
        forwarded_for = request.headers.get("X-Forwarded-For")
        real_ip = request.headers.get("X-Real-IP")
        ip_address = forwarded_for.split(",")[0].strip() if forwarded_for else real_ip
        ip_address = ip_address or request.client.host if request.client else "unknown"

        return {
            "ip_address": ip_address,
            "user_id": getattr(request.state, "user_id", None),
            "organization_id": getattr(request.state, "organization_id", None),
            "api_key": getattr(request.state, "api_key", None),
            "user_agent": request.headers.get("User-Agent", ""),
            "referer": request.headers.get("Referer", ""),
            "request_id": request.headers.get("X-Request-ID"),
        }

    async def _log_request_response(
        self,
        request: Request,
        response: Response,
        context: dict[str, Any],
        process_time: float,
    ):
        """Log request/response for audit purposes."""
        # Skip logging for excluded paths
        if request.url.path in self.excluded_paths:
            return

        log_data = {
            "timestamp": datetime.utcnow().isoformat(),
            "request": {
                "method": request.method,
                "path": request.url.path,
                "query_params": str(request.query_params),
                "headers": dict(request.headers),
            },
            "response": {
                "status_code": response.status_code,
                "headers": dict(response.headers),
            },
            "context": context,
            "process_time_ms": round(process_time * 1000, 2),
        }

        # Log based on response status
        if response.status_code >= 500:
            self.logger.error(f"Server Error: {json.dumps(log_data)}")
        elif response.status_code >= 400:
            self.logger.warning(f"Client Error: {json.dumps(log_data)}")
        else:
            self.logger.info(f"Request: {json.dumps(log_data)}")


class CORSMiddleware(BaseHTTPMiddleware):
    """
    Custom CORS middleware with fine-grained control.
    """

    def __init__(
        self, app, allow_origins: list[str] = None, allow_credentials: bool = True
    ):
        super().__init__(app)
        self.settings = settings
        self.allow_origins = allow_origins or []
        self.allow_credentials = allow_credentials
        self.allow_methods = ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]
        self.allow_headers = [
            "Authorization",
            "Content-Type",
            "X-API-Key",
            "X-Request-ID",
            "X-Client-Version",
        ]

        if settings.ENVIRONMENT == "development":
            self.allow_origins.extend(
                ["http://localhost:3000", "http://localhost:8040"]
            )

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        origin = request.headers.get("Origin")

        # Handle preflight requests
        if request.method == "OPTIONS":
            return await self._handle_preflight(request, origin)

        response = await call_next(request)

        # Add CORS headers if origin is allowed
        if origin and self._is_origin_allowed(origin):
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = str(
                self.allow_credentials
            ).lower()
            response.headers["Access-Control-Expose-Headers"] = ", ".join(
                self.allow_headers
            )

        return response

    async def _handle_preflight(self, request: Request, origin: str) -> Response:
        """Handle CORS preflight request."""
        if not origin or not self._is_origin_allowed(origin):
            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content={"error": "cors_error", "message": "Origin not allowed"},
            )

        response = JSONResponse(
            status_code=status.HTTP_200_OK, content={"message": "CORS preflight"}
        )

        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Methods"] = ", ".join(self.allow_methods)
        response.headers["Access-Control-Allow-Headers"] = ", ".join(self.allow_headers)
        response.headers["Access-Control-Allow-Credentials"] = str(
            self.allow_credentials
        ).lower()
        response.headers["Access-Control-Max-Age"] = "86400"

        return response

    def _is_origin_allowed(self, origin: str) -> bool:
        """Check if origin is allowed."""
        return "*" in self.allow_origins or origin in self.allow_origins
