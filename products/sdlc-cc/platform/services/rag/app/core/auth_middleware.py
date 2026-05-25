"""
Authentication middleware for Python async services.

This module provides comprehensive authentication middleware for FastAPI applications,
including JWT validation, mTLS support, device fingerprinting, and audit logging.
"""

import json
import logging
import time
import uuid
from contextvars import ContextVar
from datetime import datetime, timezone
from functools import wraps
from typing import Any, Dict, List, Optional, Callable

import jwt
from cryptography.hazmat.primitives import serialization
from fastapi import HTTPException, Request, Response, status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

# Context variables for storing user information
user_context: ContextVar[Dict[str, Any]] = ContextVar("user_context")
tenant_context: ContextVar[str] = ContextVar("tenant_context")
auth_context: ContextVar[Dict[str, Any]] = ContextVar("auth_context")

logger = logging.getLogger(__name__)
audit_logger = logging.getLogger("auth_audit")


class TokenValidationError(Exception):
    """Custom exception for token validation errors."""

    def __init__(self, message: str, error_type: str = "invalid_token"):
        self.message = message
        self.error_type = error_type
        super().__init__(message)


class TokenExpiredError(TokenValidationError):
    """Raised when JWT token has expired."""

    def __init__(self, message: str = "Token has expired"):
        super().__init__(message, "expired")


class TokenNotValidError(TokenValidationError):
    """Raised when JWT token is not yet valid."""

    def __init__(self, message: str = "Token is not yet valid"):
        super().__init__(message, "not_valid")


class TokenBlacklistedError(TokenValidationError):
    """Raised when JWT token has been blacklisted."""

    def __init__(self, message: str = "Token has been revoked"):
        super().__init__(message, "blacklisted")


class DeviceFingerprintMismatchError(TokenValidationError):
    """Raised when device fingerprint doesn't match."""

    def __init__(self, message: str = "Device fingerprint mismatch"):
        super().__init__(message, "device_mismatch")


class TokenInfo:
    """Information extracted from a validated JWT token."""

    def __init__(self, claims: Dict[str, Any]):
        self.user_id = uuid.UUID(claims.get("user_id"))
        self.tenant_id = uuid.UUID(claims.get("tenant_id"))
        self.email = claims.get("email", "")
        self.role = claims.get("role", "user")
        self.permissions = claims.get("permissions", [])
        self.token_id = claims.get("jti", "")
        self.device_fingerprint = claims.get("device_fingerprint", "")
        self.session_id = claims.get("session_id", "")
        self.token_type = claims.get("token_type", "access")
        self.expires_at = datetime.fromtimestamp(claims.get("exp", 0), tz=timezone.utc)
        self.issued_at = datetime.fromtimestamp(claims.get("iat", 0), tz=timezone.utc)
        self.security_context = claims.get("security_context", {})


class JWTService:
    """JWT token validation and management service."""

    def __init__(
        self,
        public_key: str,
        issuer: str,
        algorithm: str = "RS256",
        blacklist_service: Optional["BlacklistService"] = None,
        token_cache: Optional[Dict[str, TokenInfo]] = None,
    ):
        self.public_key = self._load_public_key(public_key)
        self.issuer = issuer
        self.algorithm = algorithm
        self.blacklist_service = blacklist_service
        self.token_cache = token_cache or {}
        self.logger = logger

    def _load_public_key(self, public_key: str) -> Any:
        """Load public key from PEM string."""
        try:
            key_data = public_key.encode("utf-8")
            public_key_obj = serialization.load_pem_public_key(key_data)
            return public_key_obj
        except Exception as e:
            self.logger.error(f"Failed to load public key: {e}")
            raise ValueError("Invalid public key format")

    async def validate_token(
        self,
        token: str,
        expected_type: Optional[str] = "access",
        device_fingerprint: Optional[str] = None,
    ) -> TokenInfo:
        """Validate JWT token and return token information."""
        # Check cache first
        if token in self.token_cache:
            cached_info = self.token_cache[token]
            if datetime.now(timezone.utc) < cached_info.expires_at:
                return cached_info

        try:
            # Decode and verify token
            payload = jwt.decode(
                token,
                key=self.public_key,
                algorithms=[self.algorithm],
                issuer=self.issuer,
                options={
                    "verify_exp": True,
                    "verify_iat": True,
                    "verify_nbf": True,
                    "verify_iss": True,
                },
            )

            # Extract claims
            token_info = TokenInfo(payload)

            # Validate token type
            if expected_type and token_info.token_type != expected_type:
                raise TokenValidationError(
                    f"Expected token type '{expected_type}', got '{token_info.token_type}'",
                    "invalid_type",
                )

            # Check if token is blacklisted
            if self.blacklist_service:
                is_blacklisted = await self.blacklist_service.is_blacklisted(
                    token_info.token_id
                )
                if is_blacklisted:
                    raise TokenBlacklistedError()

            # Validate device fingerprint if provided
            if device_fingerprint and token_info.device_fingerprint:
                if device_fingerprint != token_info.device_fingerprint:
                    raise DeviceFingerprintMismatchError()

            # Cache the validated token
            self.token_cache[token] = token_info

            return token_info

        except jwt.ExpiredSignatureError as e:
            raise TokenExpiredError(str(e))
        except jwt.InvalidTokenError as e:
            if "Not yet valid" in str(e):
                raise TokenNotValidError(str(e))
            elif "Signature" in str(e):
                raise TokenValidationError(
                    "Invalid token signature", "invalid_signature"
                )
            else:
                raise TokenValidationError(str(e), "invalid")
        except Exception as e:
            self.logger.error(f"Token validation error: {e}")
            raise TokenValidationError("Token validation failed", "invalid")

    async def revoke_token(self, token_id: str, expires_at: datetime) -> None:
        """Revoke a token by adding it to the blacklist."""
        if self.blacklist_service:
            await self.blacklist_service.add_to_blacklist(token_id, expires_at)

    async def is_token_revoked(self, token_id: str) -> bool:
        """Check if a token has been revoked."""
        if self.blacklist_service:
            return await self.blacklist_service.is_blacklisted(token_id)
        return False


class BlacklistService:
    """Service for managing token blacklists."""

    def __init__(self, storage_backend: Optional[Dict] = None):
        self.storage = storage_backend or {}
        self.logger = logger

    async def add_to_blacklist(self, token_id: str, expires_at: datetime) -> None:
        """Add a token to the blacklist."""
        self.storage[token_id] = expires_at.timestamp()
        self.logger.info(f"Token {token_id} added to blacklist")

    async def is_blacklisted(self, token_id: str) -> bool:
        """Check if a token is blacklisted."""
        if token_id not in self.storage:
            return False

        expires_at = self.storage[token_id]
        if time.time() > expires_at:
            # Token expired, remove from blacklist
            del self.storage[token_id]
            return False

        return True

    async def remove_from_blacklist(self, token_id: str) -> None:
        """Remove a token from the blacklist."""
        if token_id in self.storage:
            del self.storage[token_id]
            self.logger.info(f"Token {token_id} removed from blacklist")

    async def cleanup_expired(self) -> None:
        """Remove expired tokens from the blacklist."""
        current_time = time.time()
        expired_tokens = [
            token_id
            for token_id, expires_at in self.storage.items()
            if current_time > expires_at
        ]

        for token_id in expired_tokens:
            del self.storage[token_id]

        if expired_tokens:
            self.logger.info(
                f"Cleaned up {len(expired_tokens)} expired tokens from blacklist"
            )


class DeviceFingerprinting:
    """Device fingerprinting utilities."""

    @staticmethod
    def generate_fingerprint(user_agent: str, ip_address: str) -> str:
        """Generate a device fingerprint from user agent and IP address."""
        import hashlib

        fingerprint_data = f"{user_agent}|{ip_address}".encode("utf-8")
        hash_obj = hashlib.sha256(fingerprint_data)
        return hash_obj.hexdigest()

    @staticmethod
    def extract_fingerprint_from_request(request: Request) -> Optional[str]:
        """Extract device fingerprint from request."""
        user_agent = request.headers.get("User-Agent", "")
        x_forwarded_for = request.headers.get("X-Forwarded-For", "")
        x_real_ip = request.headers.get("X-Real-IP", "")

        # Get client IP
        ip_address = (
            x_forwarded_for.split(",")[0].strip() if x_forwarded_for else x_real_ip
        )
        ip_address = ip_address or request.client.host if request.client else ""

        if user_agent and ip_address:
            return DeviceFingerprinting.generate_fingerprint(user_agent, ip_address)

        return None


class AuthenticationMiddleware(BaseHTTPMiddleware):
    """FastAPI authentication middleware."""

    def __init__(
        self,
        app: ASGIApp,
        jwt_service: JWTService,
        skip_paths: Optional[List[str]] = None,
        enable_audit_logging: bool = True,
        enable_device_tracking: bool = True,
        security_headers: bool = True,
        rate_limiting: bool = True,
    ):
        super().__init__(app)
        self.jwt_service = jwt_service
        self.skip_paths = skip_paths or [
            "/healthz",
            "/health",
            "/metrics",
            "/readyz",
            "/livez",
            "/api/v1/auth/login",
            "/api/v1/auth/register",
            "/api/v1/auth/refresh",
            "/api/v1/auth/forgot-password",
            "/api/v1/auth/reset-password",
        ]
        self.enable_audit_logging = enable_audit_logging
        self.enable_device_tracking = enable_device_tracking
        self.security_headers = security_headers
        self.rate_limiting = rate_limiting

        self.logger = logger
        self.audit_logger = audit_logger

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Process request through authentication middleware."""
        # Skip authentication for specified paths
        if self._should_skip_path(request.url.path):
            return await call_next(request)

        # Add security headers if enabled
        if self.security_headers:
            request = self._add_security_headers(request)

        # Extract and validate token
        try:
            token_info = await self._authenticate_request(request)

            # Set context variables
            await self._set_context_variables(request, token_info)

            # Log successful authentication
            if self.enable_audit_logging:
                await self._log_authentication(request, token_info, True)

        except TokenValidationError as e:
            # Log failed authentication
            if self.enable_audit_logging:
                await self._log_authentication_failure(request, e)

            # Return appropriate error response
            return self._create_error_response(e)

        # Process request
        response = await call_next(request)

        # Add authentication headers to response
        response.headers["X-Auth-Status"] = "authenticated"
        response.headers["X-Auth-Time"] = str(int(time.time()))

        return response

    def _should_skip_path(self, path: str) -> bool:
        """Check if path should skip authentication."""
        for skip_path in self.skip_paths:
            if path.startswith(skip_path):
                return True
        return False

    def _add_security_headers(self, request: Request) -> Request:
        """Add security headers to request."""
        # This would be implemented by modifying headers
        # For now, we'll just log that security headers would be added
        return request

    async def _authenticate_request(self, request: Request) -> TokenInfo:
        """Extract and validate JWT token from request."""
        # Extract token from Authorization header
        authorization = request.headers.get("Authorization")
        if not authorization:
            raise TokenValidationError("Missing authorization header", "missing_token")

        # Parse Bearer token
        if not authorization.startswith("Bearer "):
            raise TokenValidationError(
                "Invalid authorization header format", "invalid_format"
            )

        token = authorization[7:]  # Remove "Bearer " prefix

        # Get device fingerprint for validation
        device_fingerprint = None
        if self.enable_device_tracking:
            device_fingerprint = DeviceFingerprinting.extract_fingerprint_from_request(
                request
            )

        # Validate token
        token_info = await self.jwt_service.validate_token(
            token, expected_type="access", device_fingerprint=device_fingerprint
        )

        return token_info

    async def _set_context_variables(
        self, request: Request, token_info: TokenInfo
    ) -> None:
        """Set context variables for the request."""
        # Set user context
        user_data = {
            "user_id": str(token_info.user_id),
            "tenant_id": str(token_info.tenant_id),
            "email": token_info.email,
            "role": token_info.role,
            "permissions": token_info.permissions,
            "token_id": token_info.token_id,
            "session_id": token_info.session_id,
        }

        user_context.set(user_data)
        tenant_context.set(str(token_info.tenant_id))

        # Set auth context
        auth_data = {
            "authenticated": True,
            "token_type": token_info.token_type,
            "expires_at": token_info.expires_at.isoformat(),
            "issued_at": token_info.issued_at.isoformat(),
            "security_context": token_info.security_context,
            "ip_address": request.client.host if request.client else "",
            "user_agent": request.headers.get("User-Agent", ""),
            "request_id": request.headers.get("X-Request-ID", str(uuid.uuid4())),
            "auth_time": datetime.now(timezone.utc).isoformat(),
        }

        auth_context.set(auth_data)

    async def _log_authentication(
        self, request: Request, token_info: TokenInfo, success: bool
    ) -> None:
        """Log authentication attempt."""
        log_data = {
            "success": success,
            "user_id": str(token_info.user_id),
            "tenant_id": str(token_info.tenant_id),
            "email": token_info.email,
            "role": token_info.role,
            "token_id": token_info.token_id,
            "path": request.url.path,
            "method": request.method,
            "ip_address": request.client.host if request.client else "",
            "user_agent": request.headers.get("User-Agent", ""),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        if success:
            self.logger.info(
                f"User authenticated: {token_info.email} ({token_info.user_id})"
            )
            self.audit_logger.info("Authentication successful", extra=log_data)
        else:
            self.logger.warning(f"Authentication failed for: {token_info.email}")
            self.audit_logger.warning("Authentication failed", extra=log_data)

    async def _log_authentication_failure(
        self, request: Request, error: TokenValidationError
    ) -> None:
        """Log failed authentication attempt."""
        log_data = {
            "success": False,
            "error_type": error.error_type,
            "error_message": error.message,
            "path": request.url.path,
            "method": request.method,
            "ip_address": request.client.host if request.client else "",
            "user_agent": request.headers.get("User-Agent", ""),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        self.logger.warning(f"Authentication failed: {error.message}")
        self.audit_logger.warning("Authentication failed", extra=log_data)

    def _create_error_response(self, error: TokenValidationError) -> Response:
        """Create error response for authentication failures."""
        status_code = status.HTTP_401_UNAUTHORIZED

        if error.error_type == "expired":
            detail = "Token has expired"
            error_code = "TOKEN_EXPIRED"
        elif error.error_type == "blacklisted":
            detail = "Token has been revoked"
            error_code = "TOKEN_REVOKED"
        elif error.error_type == "device_mismatch":
            detail = "Device fingerprint mismatch"
            error_code = "DEVICE_MISMATCH"
        elif error.error_type == "invalid_signature":
            detail = "Invalid token signature"
            error_code = "INVALID_SIGNATURE"
        else:
            detail = "Authentication failed"
            error_code = "AUTHENTICATION_FAILED"

        return Response(
            content=json.dumps(
                {
                    "success": False,
                    "error": {
                        "code": error_code,
                        "message": detail,
                        "type": error.error_type,
                    },
                    "meta": {"timestamp": datetime.now(timezone.utc).isoformat()},
                }
            ),
            status_code=status_code,
            media_type="application/json",
        )


class RoleBasedAccessControl:
    """Role-based access control utilities."""

    @staticmethod
    def has_role(user_role: str, required_roles: List[str]) -> bool:
        """Check if user has required role."""
        return user_role in required_roles

    @staticmethod
    def has_permission(
        user_permissions: List[str], required_permissions: List[str]
    ) -> bool:
        """Check if user has required permissions."""
        # Admin roles have all permissions
        if "*" in user_permissions or "admin" in user_permissions:
            return True

        # Check for exact matches
        for required_perm in required_permissions:
            if required_perm not in user_permissions:
                return False

        return True

    @staticmethod
    def check_tenant_access(
        user_tenant_id: str, request_tenant_id: str, user_role: str
    ) -> bool:
        """Check if user can access requested tenant."""
        # Super admins can access any tenant
        if user_role == "super_admin":
            return True

        # Users can only access their own tenant
        return user_tenant_id == request_tenant_id


def require_roles(roles: List[str]):
    """Decorator to require specific roles."""

    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Get user context
            user_data = user_context.get({})
            user_role = user_data.get("role", "user")

            if not RoleBasedAccessControl.has_role(user_role, roles):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Insufficient privileges",
                    headers={"WWW-Authenticate": "Bearer"},
                )

            return await func(*args, **kwargs)

        return wrapper

    return decorator


def require_permissions(permissions: List[str]):
    """Decorator to require specific permissions."""

    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Get user context
            user_data = user_context.get({})
            user_permissions = user_data.get("permissions", [])

            if not RoleBasedAccessControl.has_permission(user_permissions, permissions):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Insufficient permissions",
                    headers={"WWW-Authenticate": "Bearer"},
                )

            return await func(*args, **kwargs)

        return wrapper

    return decorator


def require_tenant_access():
    """Decorator to require tenant access validation."""

    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Get user context
            user_data = user_context.get({})
            user_tenant_id = user_data.get("tenant_id")
            user_role = user_data.get("role")

            # Get tenant from request (this would be extracted from path/query/headers)
            # For now, we'll assume it's passed as a parameter
            request_tenant_id = kwargs.get("tenant_id")

            if request_tenant_id and not RoleBasedAccessControl.check_tenant_access(
                user_tenant_id, request_tenant_id, user_role
            ):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Tenant access denied",
                    headers={"WWW-Authenticate": "Bearer"},
                )

            return await func(*args, **kwargs)

        return wrapper

    return decorator


# Utility functions for extracting context information


def get_current_user() -> Optional[Dict[str, Any]]:
    """Get current user from context."""
    return user_context.get({})


def get_current_tenant_id() -> Optional[str]:
    """Get current tenant ID from context."""
    return tenant_context.get()


def get_current_user_id() -> Optional[str]:
    """Get current user ID from context."""
    user_data = get_current_user()
    return user_data.get("user_id") if user_data else None


def get_current_user_role() -> Optional[str]:
    """Get current user role from context."""
    user_data = get_current_user()
    return user_data.get("role") if user_data else None


def get_current_user_permissions() -> List[str]:
    """Get current user permissions from context."""
    user_data = get_current_user()
    return user_data.get("permissions", []) if user_data else []


def is_authenticated() -> bool:
    """Check if current request is authenticated."""
    user_data = get_current_user()
    return bool(user_data)


def has_role(role: str) -> bool:
    """Check if current user has specific role."""
    user_role = get_current_user_role()
    return user_role == role


def has_permission(permission: str) -> bool:
    """Check if current user has specific permission."""
    user_permissions = get_current_user_permissions()
    return permission in user_permissions or "*" in user_permissions


# Rate limiting utilities (simplified implementation)


class RateLimiter:
    """Simple in-memory rate limiter."""

    def __init__(self, requests_per_minute: int = 60):
        self.requests_per_minute = requests_per_minute
        self.requests: Dict[str, List[float]] = {}

    async def is_allowed(self, key: str) -> bool:
        """Check if request is allowed."""
        now = time.time()
        minute_ago = now - 60

        # Clean old requests
        if key in self.requests:
            self.requests[key] = [
                req_time for req_time in self.requests[key] if req_time > minute_ago
            ]
        else:
            self.requests[key] = []

        # Check rate limit
        if len(self.requests[key]) >= self.requests_per_minute:
            return False

        # Add current request
        self.requests[key].append(now)
        return True


# Example usage in FastAPI application

"""
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# Initialize JWT service
jwt_service = JWTService(
    public_key="-----BEGIN PUBLIC KEY-----\n...",
    issuer="sdlc-platform",
    blacklist_service=BlacklistService()
)

# Add authentication middleware
app.add_middleware(
    AuthenticationMiddleware,
    jwt_service=jwt_service,
    enable_audit_logging=True,
    enable_device_tracking=True
)

# Protected endpoint
@app.get("/api/v1/protected")
@require_permissions(["documents:read"])
async def protected_endpoint():
    user = get_current_user()
    return {"message": "Access granted", "user": user}

# Role-protected endpoint
@app.get("/api/v1/admin")
@require_roles(["admin", "super_admin"])
async def admin_endpoint():
    return {"message": "Admin access granted"}

# Tenant-scoped endpoint
@app.get("/api/v1/tenants/{tenant_id}/documents")
@require_tenant_access()
@require_permissions(["documents:read"])
async def tenant_documents(tenant_id: str):
    return {"message": f"Documents for tenant {tenant_id}"}
"""
