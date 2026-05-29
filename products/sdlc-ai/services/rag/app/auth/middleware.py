"""
Authentication middleware for FastAPI applications.

This module provides authentication middleware for FastAPI applications
with JWT token validation, user context injection, and security features.
"""

from typing import Optional, List, Callable
from fastapi import HTTPException, Request, Response, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
import time
from loguru import logger

from .jwt_manager import (
    AuthenticationManager,
    TokenValidationError,
    get_auth_manager,
    extract_token_from_header,
    hash_device_fingerprint,
    verify_tenant_access,
    verify_permissions,
)


class AuthenticationMiddleware(BaseHTTPMiddleware):
    """
    Authentication middleware for FastAPI applications.

    This middleware validates JWT tokens and injects user context
    into the request state for downstream use.
    """

    def __init__(
        self,
        app,
        auth_manager: Optional[AuthenticationManager] = None,
        skip_paths: Optional[List[str]] = None,
        skip_path_prefixes: Optional[List[str]] = None,
        require_authentication: bool = True,
        enable_logging: bool = True,
        enable_audit_logging: bool = True,
        **kwargs,
    ):
        """
        Initialize authentication middleware.

        Args:
            app: FastAPI application instance
            auth_manager: Authentication manager instance
            skip_paths: List of exact paths to skip authentication
            skip_path_prefixes: List of path prefixes to skip authentication
            require_authentication: Whether to require authentication
            enable_logging: Enable detailed authentication logging
            enable_audit_logging: Enable audit logging
        """
        super().__init__(app, **kwargs)

        self.auth_manager = auth_manager or get_auth_manager()
        self.skip_paths = skip_paths or [
            "/health",
            "/healthz",
            "/metrics",
            "/docs",
            "/redoc",
            "/openapi.json",
            "/api/v1/auth/login",
            "/api/v1/auth/register",
            "/api/v1/auth/refresh",
            "/api/v1/auth/forgot-password",
            "/api/v1/auth/reset-password",
        ]
        self.skip_path_prefixes = skip_path_prefixes or ["/static", "/favicon"]
        self.require_authentication = require_authentication
        self.enable_logging = enable_logging
        self.enable_audit_logging = enable_audit_logging

        # HTTP Bearer security scheme for token extraction
        self.security = HTTPBearer(auto_error=False)

    async def dispatch(self, request: Request, call_next):
        """
        Process request through authentication middleware.

        Args:
            request: Incoming request
            call_next: Next middleware in chain

        Returns:
            Response from next middleware
        """
        # Skip authentication for specified paths
        if self._should_skip_path(request.url.path):
            return await call_next(request)

        # Add security headers
        self._add_security_headers(request)

        # Extract and validate token
        try:
            user_context = await self._authenticate_request(request)

            # Add user context to request state
            request.state.user = user_context
            request.state.user_id = user_context.get("user_id")
            request.state.tenant_id = user_context.get("tenant_id")
            request.state.role = user_context.get("role")
            request.state.permissions = user_context.get("permissions", [])

            # Log authentication if enabled
            if self.enable_logging:
                self._log_authentication(user_context, request)

            # Audit log if enabled
            if self.enable_audit_logging:
                self._audit_authentication(user_context, request, success=True)

        except TokenValidationError as e:
            # Log authentication failure
            if self.enable_logging:
                self._log_authentication_failure(e, request)

            # Audit log the failure
            if self.enable_audit_logging:
                self._audit_authentication_failure(e, request)

            # Return appropriate error response
            return self._create_error_response(e)

        except Exception as e:
            logger.error(f"Unexpected authentication error: {str(e)}")

            if self.enable_logging:
                logger.error(
                    "Unexpected authentication error",
                    extra={
                        "error": str(e),
                        "path": request.url.path,
                        "method": request.method,
                        "client_ip": self._get_client_ip(request),
                    },
                )

            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={
                    "success": False,
                    "error": {
                        "code": "AUTHENTICATION_ERROR",
                        "message": "Authentication failed",
                    },
                    "meta": {
                        "timestamp": time.time(),
                    },
                },
            )

        # Continue with request processing
        response = await call_next(request)

        # Add authentication headers to response
        self._add_auth_headers(response, user_context)

        return response

    def _should_skip_path(self, path: str) -> bool:
        """Check if path should be skipped from authentication."""
        # Check exact matches
        if path in self.skip_paths:
            return True

        # Check prefix matches
        for prefix in self.skip_path_prefixes:
            if path.startswith(prefix):
                return True

        return False

    def _add_security_headers(self, request: Request):
        """Add security headers to request processing."""
        # This would be handled by response headers in real implementation
        pass

    def _add_auth_headers(self, response: Response, user_context: dict):
        """Add authentication-related headers to response."""
        # Add user context headers (optional, for debugging)
        if hasattr(response, "headers"):
            response.headers["X-User-ID"] = user_context.get("user_id", "")
            response.headers["X-Tenant-ID"] = user_context.get("tenant_id", "")

    async def _authenticate_request(self, request: Request) -> dict:
        """Authenticate the request and return user context."""
        # Extract token from Authorization header
        authorization = request.headers.get("Authorization")
        if not authorization:
            raise TokenValidationError(
                "Authorization header is missing", "missing_token"
            )

        token = extract_token_from_header(authorization)

        # Get device fingerprint for validation
        device_fingerprint = self._get_device_fingerprint(request)

        # Validate token
        user_context = self.auth_manager.authenticate_token(token, "access")

        # Validate device fingerprint if present in token
        stored_fingerprint = user_context.get("device_fingerprint")
        if stored_fingerprint and device_fingerprint:
            if device_fingerprint != stored_fingerprint:
                logger.warning(
                    "Device fingerprint mismatch",
                    extra={
                        "stored": stored_fingerprint,
                        "provided": device_fingerprint,
                        "user_id": user_context.get("user_id"),
                    },
                )
                raise TokenValidationError(
                    "Device fingerprint mismatch", "device_mismatch"
                )

        # Add request metadata to user context
        user_context.update(
            {
                "request_ip": self._get_client_ip(request),
                "request_user_agent": request.headers.get("User-Agent", ""),
                "request_method": request.method,
                "request_path": request.url.path,
                "auth_time": time.time(),
            }
        )

        return user_context

    def _get_device_fingerprint(self, request: Request) -> Optional[str]:
        """Generate device fingerprint from request."""
        user_agent = request.headers.get("User-Agent", "")
        ip_address = self._get_client_ip(request)

        if user_agent and ip_address:
            return hash_device_fingerprint(f"{user_agent}|{ip_address}")

        return None

    def _get_client_ip(self, request: Request) -> str:
        """Get client IP address from request."""
        # Check X-Forwarded-For header first
        xff = request.headers.get("X-Forwarded-For")
        if xff:
            # Take the first IP in the list
            return xff.split(",")[0].strip()

        # Check X-Real-IP header
        xri = request.headers.get("X-Real-IP")
        if xri:
            return xri

        # Fall back to client IP
        return request.client.host if request.client else "unknown"

    def _log_authentication(self, user_context: dict, request: Request):
        """Log successful authentication."""
        logger.info(
            "User authenticated",
            extra={
                "user_id": user_context.get("user_id"),
                "tenant_id": user_context.get("tenant_id"),
                "email": user_context.get("email"),
                "role": user_context.get("role"),
                "token_id": user_context.get("token_id"),
                "request_path": request.url.path,
                "request_method": request.method,
                "client_ip": self._get_client_ip(request),
                "user_agent": request.headers.get("User-Agent", ""),
                "auth_time": user_context.get("auth_time"),
            },
        )

    def _log_authentication_failure(
        self, error: TokenValidationError, request: Request
    ):
        """Log authentication failure."""
        logger.warning(
            f"Authentication failed: {error.message}",
            extra={
                "error_type": error.error_type,
                "path": request.url.path,
                "method": request.method,
                "client_ip": self._get_client_ip(request),
                "user_agent": request.headers.get("User-Agent", ""),
            },
        )

    def _audit_authentication(
        self, user_context: dict, request: Request, success: bool
    ):
        """Audit log authentication event."""
        logger.info(
            "Authentication audit log",
            extra={
                "event_type": "authentication",
                "success": success,
                "user_id": user_context.get("user_id"),
                "tenant_id": user_context.get("tenant_id"),
                "token_id": user_context.get("token_id"),
                "ip_address": self._get_client_ip(request),
                "user_agent": request.headers.get("User-Agent", ""),
                "resource": request.url.path,
                "action": request.method,
                "timestamp": time.time(),
            },
        )

    def _audit_authentication_failure(
        self, error: TokenValidationError, request: Request
    ):
        """Audit log authentication failure."""
        logger.info(
            "Authentication failure audit log",
            extra={
                "event_type": "authentication_failure",
                "success": False,
                "error_type": error.error_type,
                "error_message": error.message,
                "ip_address": self._get_client_ip(request),
                "user_agent": request.headers.get("User-Agent", ""),
                "resource": request.url.path,
                "action": request.method,
                "timestamp": time.time(),
            },
        )

    def _create_error_response(self, error: TokenValidationError) -> JSONResponse:
        """Create error response for authentication failure."""
        # Determine appropriate status code
        status_code = status.HTTP_401_UNAUTHORIZED
        if error.error_type == "expired":
            status_code = status.HTTP_401_UNAUTHORIZED
        elif error.error_type == "device_mismatch":
            status_code = status.HTTP_401_UNAUTHORIZED
        elif error.error_type == "blacklisted":
            status_code = status.HTTP_401_UNAUTHORIZED

        return JSONResponse(
            status_code=status_code,
            content={
                "success": False,
                "error": {
                    "code": error.error_type.upper(),
                    "message": error.message,
                },
                "meta": {
                    "timestamp": time.time(),
                },
            },
        )


# Dependency functions for FastAPI
def get_current_user(request: Request) -> dict:
    """
    Get current authenticated user from request state.

    Args:
        request: FastAPI request object

    Returns:
        User context dictionary

    Raises:
        HTTPException: If user is not authenticated
    """
    if not hasattr(request.state, "user"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error": "NOT_AUTHENTICATED",
                "message": "Authentication required",
            },
        )

    return request.state.user


def get_current_user_id(request: Request) -> str:
    """Get current user ID from request state."""
    if not hasattr(request.state, "user_id"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error": "NOT_AUTHENTICATED",
                "message": "Authentication required",
            },
        )

    return request.state.user_id


def get_current_tenant_id(request: Request) -> str:
    """Get current tenant ID from request state."""
    if not hasattr(request.state, "tenant_id"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error": "NOT_AUTHENTICATED",
                "message": "Authentication required",
            },
        )

    return request.state.tenant_id


def get_current_role(request: Request) -> str:
    """Get current user role from request state."""
    if not hasattr(request.state, "role"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error": "NOT_AUTHENTICATED",
                "message": "Authentication required",
            },
        )

    return request.state.role


def get_current_permissions(request: Request) -> List[str]:
    """Get current user permissions from request state."""
    if not hasattr(request.state, "permissions"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error": "NOT_AUTHENTICATED",
                "message": "Authentication required",
            },
        )

    return request.state.permissions


def require_permissions(required_permissions: List[str]):
    """
    Create a dependency that requires specific permissions.

    Args:
        required_permissions: List of required permissions

    Returns:
        Dependency function
    """

    def permission_dependency(request: Request) -> dict:
        user = get_current_user(request)

        if not verify_permissions(user, required_permissions):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error": "INSUFFICIENT_PERMISSIONS",
                    "message": f"Required permissions: {required_permissions}",
                },
            )

        return user

    return permission_dependency


def require_role(required_role: str):
    """
    Create a dependency that requires a specific role.

    Args:
        required_role: Required role

    Returns:
        Dependency function
    """

    def role_dependency(request: Request) -> dict:
        user = get_current_user(request)
        user_role = user.get("role")

        if user_role != required_role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error": "INSUFFICIENT_ROLE",
                    "message": f"Required role: {required_role}",
                },
            )

        return user

    return role_dependency


def require_any_role(required_roles: List[str]):
    """
    Create a dependency that requires any of the specified roles.

    Args:
        required_roles: List of acceptable roles

    Returns:
        Dependency function
    """

    def role_dependency(request: Request) -> dict:
        user = get_current_user(request)
        user_role = user.get("role")

        if user_role not in required_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error": "INSUFFICIENT_ROLE",
                    "message": f"Required one of roles: {required_roles}",
                },
            )

        return user

    return role_dependency


def require_tenant_access(required_tenant_id: str):
    """
    Create a dependency that requires access to a specific tenant.

    Args:
        required_tenant_id: Required tenant ID

    Returns:
        Dependency function
    """

    def tenant_dependency(request: Request) -> dict:
        user = get_current_user(request)

        if not verify_tenant_access(user, required_tenant_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error": "TENANT_ACCESS_DENIED",
                    "message": "Access denied to tenant",
                },
            )

        return user

    return tenant_dependency


def optional_authentication():
    """
    Create a dependency that optionally gets user context.

    Returns:
        Dependency function that returns user context or None
    """

    def optional_dependency(request: Request) -> Optional[dict]:
        if hasattr(request.state, "user"):
            return request.state.user
        return None

    return optional_dependency


# Security scheme for OpenAPI documentation
security_scheme = {
    "bearerAuth": {
        "type": "http",
        "scheme": "bearer",
        "bearerFormat": "JWT",
        "description": "Enter your JWT token",
    }
}


# Utility functions for middleware configuration
def create_auth_middleware(
    skip_paths: Optional[List[str]] = None,
    skip_path_prefixes: Optional[List[str]] = None,
    require_authentication: bool = True,
    enable_logging: bool = True,
    enable_audit_logging: bool = True,
):
    """
    Factory function to create authentication middleware.

    Args:
        skip_paths: List of exact paths to skip authentication
        skip_path_prefixes: List of path prefixes to skip authentication
        require_authentication: Whether to require authentication
        enable_logging: Enable detailed authentication logging
        enable_audit_logging: Enable audit logging

    Returns:
        Authentication middleware class
    """

    def middleware_factory(app):
        return AuthenticationMiddleware(
            app=app,
            skip_paths=skip_paths,
            skip_path_prefixes=skip_path_prefixes,
            require_authentication=require_authentication,
            enable_logging=enable_logging,
            enable_audit_logging=enable_audit_logging,
        )

    return middleware_factory


# Common middleware configurations
def get_default_auth_middleware():
    """Get default authentication middleware configuration."""
    return create_auth_middleware(
        skip_paths=[
            "/health",
            "/healthz",
            "/metrics",
            "/docs",
            "/redoc",
            "/openapi.json",
            "/api/v1/auth/login",
            "/api/v1/auth/register",
            "/api/v1/auth/refresh",
        ],
        require_authentication=True,
        enable_logging=True,
        enable_audit_logging=True,
    )


def get_optional_auth_middleware():
    """Get optional authentication middleware configuration."""
    return create_auth_middleware(
        skip_paths=[
            "/health",
            "/healthz",
            "/metrics",
            "/docs",
            "/redoc",
            "/openapi.json",
        ],
        require_authentication=False,
        enable_logging=True,
        enable_audit_logging=True,
    )
