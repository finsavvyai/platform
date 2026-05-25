"""
Authentication middleware for UPM API.

Provides JWT token validation, session management,
and authentication requirement enforcement.
"""

import logging
from functools import wraps
from typing import Any, Optional

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

from ..core.config import get_settings
from ..security.auth import TokenError, auth_service

logger = logging.getLogger(__name__)
settings = get_settings()


# HTTP Bearer scheme for token extraction
security = HTTPBearer(auto_error=False)


class AuthenticationMiddleware(BaseHTTPMiddleware):
    """
    Authentication middleware for FastAPI.

    Validates JWT tokens for protected routes and manages
    user session context throughout the request lifecycle.
    """

    def __init__(self, app, excluded_paths: Optional[list] = None):
        super().__init__(app)
        self.excluded_paths = excluded_paths or [
            "/health",
            "/health/",
            "/api/v1/docs",
            "/api/v1/openapi.json",
            "/api/v1/auth/login",
            "/api/v1/auth/refresh",
            "/api/v1/auth/register",
        ]

    async def dispatch(self, request: Request, call_next):
        """Process request with authentication."""

        # Skip authentication for excluded paths
        if self._is_excluded_path(request.url.path):
            return await call_next(request)

        # Get token from Authorization header
        authorization = request.headers.get("authorization")
        if not authorization:
            return self._create_unauthorized_response("Missing authorization header")

        try:
            # Extract token from "Bearer <token>" format
            if not authorization.startswith("Bearer "):
                return self._create_unauthorized_response(
                    "Invalid authorization header format"
                )

            token = authorization.split(" ", 1)[0]

            # Validate token
            token_payload = auth_service.validate_token(token)

            # Store user info in request state
            request.state.user = {
                "id": token_payload["sub"],
                "email": token_payload["email"],
                "permissions": token_payload.get("permissions", []),
            }

            # Process request
            response = await call_next(request)
            return response

        except TokenError as e:
            logger.warning(
                f"Authentication failed: {str(e)} - Path: {request.url.path}"
            )
            return self._create_unauthorized_response(str(e))
        except Exception as e:
            logger.error(f"Authentication error: {str(e)} - Path: {request.url.path}")
            return self._create_unauthorized_response("Authentication error")

    def _is_excluded_path(self, path: str) -> bool:
        """Check if path is excluded from authentication."""
        return any(
            path.startswith(excluded_path) for excluded_path in self.excluded_paths
        )

    def _create_unauthorized_response(self, message: str) -> Response:
        """Create unauthorized response."""
        return Response(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content={
                "error": "Unauthorized",
                "message": message,
                "code": "AUTHENTICATION_REQUIRED",
            },
            headers={"WWW-Authenticate": "Bearer"},
        )


def get_current_user(request: Request) -> dict[str, Any]:
    """
    Get current user from request state.

    Args:
        request: FastAPI request object

    Returns:
        User information dictionary
    """
    if not hasattr(request.state, "user"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return request.state.user


def require_permissions(permissions: list):
    """
    Decorator to require specific permissions.

    Args:
        permissions: List of required permissions
    """

    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Get request from function arguments
            request = None
            for arg in args:
                if isinstance(arg, Request):
                    request = arg
                    break

            # Get request from keyword arguments if not found
            if not request:
                for key, value in kwargs.items():
                    if key == "request" and isinstance(value, Request):
                        request = value
                        break

            if not request:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Request object not found",
                )

            # Get current user
            current_user = get_current_user(request)
            user_permissions = current_user.get("permissions", [])

            # Check if user has all required permissions
            missing_permissions = [
                perm for perm in permissions if perm not in user_permissions
            ]

            if missing_permissions:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Insufficient permissions. Required: {permissions}, Missing: {missing_permissions}",
                )

            return await func(*args, **kwargs)

        return wrapper

    return decorator


def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> Optional[dict[str, Any]]:
    """
    Get current user if authenticated, None otherwise.

    This is a FastAPI dependency that can be used for optional authentication.

    Args:
        credentials: HTTP Bearer credentials

    Returns:
        User information dictionary or None
    """
    if not credentials:
        return None

    try:
        token_payload = auth_service.validate_token(credentials.credentials)
        return {
            "id": token_payload["sub"],
            "email": token_payload["email"],
            "permissions": token_payload.get("permissions", []),
        }
    except TokenError:
        return None


async def get_authenticated_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict[str, Any]:
    """
    Get authenticated user (required).

    This is a FastAPI dependency that enforces authentication.

    Args:
        credentials: HTTP Bearer credentials

    Returns:
        User information dictionary

    Raises:
        HTTPException: If not authenticated
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        token_payload = auth_service.validate_token(credentials.credentials)
        return {
            "id": token_payload["sub"],
            "email": token_payload["email"],
            "permissions": token_payload.get("permissions", []),
        }
    except TokenError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
            headers={"WWW-Authenticate": "Bearer"},
        )


def require_authenticated_user(
    current_user: dict[str, Any] = Depends(get_authenticated_user),
) -> dict[str, Any]:
    """
    Require user to be authenticated (dependency decorator).

    Args:
        current_user: Authenticated user from get_authenticated_user

    Returns:
        User information dictionary
    """
    return current_user


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Security headers middleware for FastAPI.

    Adds security headers to responses for enhanced security.
    """

    def __init__(self, app):
        super().__init__(app)

    async def dispatch(self, request: Request, call_next):
        """Process request and add security headers."""

        response = await call_next(request)

        # Add security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = (
            "max-age=31536000; includeSubDomains"
        )
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: https:; "
            "font-src 'self'; "
            "connect-src 'self'; "
            "frame-ancestors 'none';"
            "object-src 'none';"
            "base-uri 'self';"
            "upgrade-insecure-requests;"
        )
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "interest-cohort=()"

        return response


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Simple rate limiting middleware.

    Implements basic rate limiting by IP address.
    This is a simplified implementation for demonstration purposes.
    """

    def __init__(self, app, requests_per_minute: int = 100):
        super().__init__(app)
        self.requests_per_minute = requests_per_minute
        self.requests: dict[str, list] = {}
        self.logger = logging.getLogger(__name__)

    async def dispatch(self, request: request, call_next):
        """Process request with rate limiting."""

        client_ip = self._get_client_ip(request)
        now = datetime.utcnow()

        # Clean up old entries
        self._cleanup_old_entries(now)

        # Check rate limit
        if client_ip in self.requests:
            recent_requests = [
                req_time
                for req_time in self.requests[client_ip]
                if now - req_time < timedelta(minutes=1)
            ]

            if len(recent_requests) >= self.requests_per_minute:
                self.logger.warning(f"Rate limit exceeded for IP: {client_ip}")
                return Response(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    content={
                        "error": "Too Many Requests",
                        "message": f"Rate limit exceeded. Maximum {self.requests_per_minute} requests per minute.",
                        "code": "RATE_LIMIT_EXCEEDED",
                        "retry_after": 60,
                    },
                )

            self.requests[client_ip].append(now)
        else:
            self.requests[client_ip] = [now]

        response = await call_next(request)
        return response

    def _get_client_ip(self, request: Request) -> str:
        """Get client IP address from request."""
        # Check for forwarded IP headers
        forwarded_for = request.headers.get("x-forwarded-for")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()

        real_ip = request.headers.get("x-real-ip")
        if real_ip:
            return real_ip

        return request.client.host.split(":")[0]

    def _cleanup_old_entries(self, now: datetime):
        """Clean up old rate limiting entries."""
        cutoff = now - timedelta(minutes=5)  # Keep 5 minutes of data

        for ip in list(self.requests.keys()):
            self.requests[ip] = [
                req_time for req_time in self.requests[ip] if req_time > cutoff
            ]

            # Remove empty entries
            if not self.requests[ip]:
                del self.requests[ip]
