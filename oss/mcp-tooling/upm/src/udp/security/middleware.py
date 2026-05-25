"""
Security middleware for Universal Dependency Platform.
"""

import time
from collections.abc import Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from udp.monitoring.logging_config import get_logger

logger = get_logger(__name__)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security headers to all responses."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Add security headers."""
        response = await call_next(request)

        # Security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = (
            "max-age=31536000; includeSubDomains"
        )
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = (
            "geolocation=(), microphone=(), camera=()"
        )

        return response


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Basic rate limiting middleware."""

    def __init__(self, app, calls: int = 100, period: int = 60):
        """Initialize rate limiter."""
        super().__init__(app)
        self.calls = calls
        self.period = period
        self.clients = {}

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Apply rate limiting."""
        client_ip = request.client.host
        now = time.time()

        # Clean old entries
        cutoff = now - self.period
        self.clients = {
            ip: requests
            for ip, requests in self.clients.items()
            if any(req_time > cutoff for req_time in requests)
        }

        # Check current client
        if client_ip not in self.clients:
            self.clients[client_ip] = []

        # Remove old requests for this client
        self.clients[client_ip] = [
            req_time for req_time in self.clients[client_ip] if req_time > cutoff
        ]

        # Check if over limit
        if len(self.clients[client_ip]) >= self.calls:
            logger.warning(
                "Rate limit exceeded",
                client_ip=client_ip,
                requests_count=len(self.clients[client_ip]),
            )
            return Response(
                content="Rate limit exceeded",
                status_code=429,
                headers={"Retry-After": str(self.period)},
            )

        # Add current request
        self.clients[client_ip].append(now)

        return await call_next(request)


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Request logging middleware."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Log request details."""
        start_time = time.time()

        # Log request
        logger.info(
            "Incoming request",
            method=request.method,
            url=str(request.url),
            client_ip=request.client.host,
            user_agent=request.headers.get("user-agent", ""),
        )

        response = await call_next(request)

        # Calculate processing time
        process_time = time.time() - start_time

        # Log response
        logger.info(
            "Request completed",
            method=request.method,
            url=str(request.url),
            status_code=response.status_code,
            process_time=f"{process_time:.4f}s",
        )

        # Add timing header
        response.headers["X-Process-Time"] = str(process_time)

        return response


class ContentSizeLimitMiddleware(BaseHTTPMiddleware):
    """Content size limiting middleware."""

    def __init__(self, app, max_size: int = 10 * 1024 * 1024):  # 10MB default
        """Initialize content size limiter."""
        super().__init__(app)
        self.max_size = max_size

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Check content size."""
        content_length = request.headers.get("content-length")

        if content_length:
            try:
                size = int(content_length)
                if size > self.max_size:
                    logger.warning(
                        "Request too large",
                        content_length=size,
                        max_size=self.max_size,
                        client_ip=request.client.host,
                    )
                    return Response(content="Request entity too large", status_code=413)
            except ValueError:
                pass

        return await call_next(request)
