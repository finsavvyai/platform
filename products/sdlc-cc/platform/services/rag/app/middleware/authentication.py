"""
Authentication middleware for Python services.
Provides async JWT validation and user context injection.
"""

import time
import uuid
from typing import Optional, Dict, Any, List, Callable
from functools import wraps
from datetime import datetime, timezone
import logging

import jwt
from fastapi import HTTPException, Request, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
import redis.asyncio as redis



logger = logging.getLogger(__name__)


class AuthenticationError(Exception):
    """Base authentication error."""

    def __init__(self, message: str, error_code: str = "AUTHENTICATION_ERROR"):
        self.message = message
        self.error_code = error_code
        super().__init__(self.message)


class TokenExpiredError(AuthenticationError):
    """Token has expired."""

    def __init__(self, message: str = "Token has expired"):
        super().__init__(message, "TOKEN_EXPIRED")


class TokenInvalidError(AuthenticationError):
    """Token is invalid."""

    def __init__(self, message: str = "Invalid token"):
        super().__init__(message, "INVALID_TOKEN")


class TokenRevokedError(AuthenticationError):
    """Token has been revoked."""

    def __init__(self, message: str = "Token has been revoked"):
        super().__init__(message, "TOKEN_REVOKED")


class InsufficientPermissionsError(AuthenticationError):
    """User has insufficient permissions."""

    def __init__(self, message: str = "Insufficient permissions"):
        super().__init__(message, "INSUFFICIENT_PERMISSIONS")


class UserContext:
    """User authentication context."""

    def __init__(
        self,
        user_id: uuid.UUID,
        tenant_id: uuid.UUID,
        email: str,
        role: str,
        permissions: List[str],
        token_id: str,
        device_fingerprint: Optional[str] = None,
        session_id: Optional[str] = None,
        token_type: str = "access",
        expires_at: Optional[datetime] = None,
        issued_at: Optional[datetime] = None,
        security_context: Optional[Dict[str, str]] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        request_id: Optional[str] = None,
        auth_time: Optional[datetime] = None,
    ):
        self.user_id = user_id
        self.tenant_id = tenant_id
        self.email = email
        self.role = role
        self.permissions = permissions
        self.token_id = token_id
        self.device_fingerprint = device_fingerprint
        self.session_id = session_id
        self.token_type = token_type
        self.expires_at = expires_at
        self.issued_at = issued_at
        self.security_context = security_context or {}
        self.ip_address = ip_address
        self.user_agent = user_agent
        self.request_id = request_id
        self.auth_time = auth_time or datetime.now(timezone.utc)

    def is_expired(self) -> bool:
        """Check if the authentication context is expired."""
        if self.expires_at is None:
            return False
        return datetime.now(timezone.utc) > self.expires_at

    def has_permission(self, permission: str) -> bool:
        """Check if user has a specific permission."""
        # Admin users have all permissions
        if self.role in ["super_admin", "tenant_admin"]:
            return True

        # Check for exact permission or wildcard
        return permission in self.permissions or "*" in self.permissions

    def has_role(self, role: str) -> bool:
        """Check if user has a specific role."""
        return self.role == role

    def to_dict(self) -> Dict[str, Any]:
        """Convert context to dictionary."""
        return {
            "user_id": str(self.user_id),
            "tenant_id": str(self.tenant_id),
            "email": self.email,
            "role": self.role,
            "permissions": self.permissions,
            "token_id": self.token_id,
            "device_fingerprint": self.device_fingerprint,
            "session_id": self.session_id,
            "token_type": self.token_type,
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "issued_at": self.issued_at.isoformat() if self.issued_at else None,
            "security_context": self.security_context,
            "ip_address": self.ip_address,
            "user_agent": self.user_agent,
            "request_id": self.request_id,
            "auth_time": self.auth_time.isoformat() if self.auth_time else None,
        }


class TokenBlacklistService:
    """Service for managing token blacklisting using Redis."""

    def __init__(self, redis_client: redis.Redis):
        self.redis = redis_client

    async def add_to_blacklist(self, token_id: str, expires_at: datetime) -> None:
        """Add a token to the blacklist."""
        ttl = int((expires_at - datetime.now(timezone.utc)).total_seconds())
        if ttl > 0:
            await self.redis.setex(f"blacklist:{token_id}", ttl, "1")
            logger.info(f"Token {token_id} added to blacklist")

    async def is_blacklisted(self, token_id: str) -> bool:
        """Check if a token is blacklisted."""
        result = await self.redis.exists(f"blacklist:{token_id}")
        return result > 0

    async def remove_from_blacklist(self, token_id: str) -> None:
        """Remove a token from the blacklist."""
        await self.redis.delete(f"blacklist:{token_id}")
        logger.info(f"Token {token_id} removed from blacklist")

    async def cleanup_expired(self) -> None:
        """Clean up expired tokens from blacklist."""
        # Redis handles TTL automatically, so this is a no-op
        pass


class JWTService:
    """JWT token validation service for Python services."""

    def __init__(
        self,
        secret_key: str,
        algorithm: str = "HS256",
        issuer: str = "sdlc-platform",
        blacklist_service: Optional[TokenBlacklistService] = None,
        redis_client: Optional[redis.Redis] = None,
    ):
        self.secret_key = secret_key
        self.algorithm = algorithm
        self.issuer = issuer
        self.blacklist_service = (
            blacklist_service or TokenBlacklistService(redis_client)
            if redis_client
            else None
        )

    def decode_token(self, token: str) -> Dict[str, Any]:
        """Decode and validate JWT token."""
        try:
            payload = jwt.decode(
                token,
                self.secret_key,
                algorithms=[self.algorithm],
                issuer=self.issuer,
                options={
                    "require_iat": True,
                    "require_exp": True,
                    "require_nbf": True,
                },
            )
            return payload
        except jwt.ExpiredSignatureError as e:
            raise TokenExpiredError(str(e))
        except jwt.InvalidTokenError as e:
            raise TokenInvalidError(str(e))
        except Exception as e:
            raise TokenInvalidError(f"Token validation failed: {str(e)}")

    async def validate_token(
        self, token: str, expected_type: str = "access"
    ) -> UserContext:
        """Validate JWT token and return user context."""
        # Decode token
        payload = self.decode_token(token)

        # Validate token type
        token_type = payload.get("token_type")
        if expected_type and token_type != expected_type:
            raise TokenInvalidError(
                f"Invalid token type: expected {expected_type}, got {token_type}"
            )

        # Check if token is blacklisted
        token_id = payload.get("jti")
        if token_id and self.blacklist_service:
            if await self.blacklist_service.is_blacklisted(token_id):
                raise TokenRevokedError("Token has been revoked")

        # Extract user information
        try:
            user_id = uuid.UUID(payload.get("user_id"))
            tenant_id = uuid.UUID(payload.get("tenant_id"))
        except (ValueError, TypeError) as e:
            raise TokenInvalidError(f"Invalid user or tenant ID: {str(e)}")

        email = payload.get("email")
        role = payload.get("role", "user")
        permissions = payload.get("permissions", [])
        device_fingerprint = payload.get("device_fingerprint")
        session_id = payload.get("session_id")

        # Parse timestamps
        expires_at = None
        issued_at = None
        if payload.get("exp"):
            expires_at = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)
        if payload.get("iat"):
            issued_at = datetime.fromtimestamp(payload["iat"], tz=timezone.utc)

        security_context = payload.get("security_context", {})

        return UserContext(
            user_id=user_id,
            tenant_id=tenant_id,
            email=email,
            role=role,
            permissions=permissions,
            token_id=token_id,
            device_fingerprint=device_fingerprint,
            session_id=session_id,
            token_type=token_type,
            expires_at=expires_at,
            issued_at=issued_at,
            security_context=security_context,
        )

    async def revoke_token(self, token_id: str, expires_at: datetime) -> None:
        """Revoke a token by adding it to the blacklist."""
        if self.blacklist_service:
            await self.blacklist_service.add_to_blacklist(token_id, expires_at)


class AuthenticationMiddleware(BaseHTTPMiddleware):
    """Authentication middleware for FastAPI applications."""

    def __init__(
        self,
        app,
        jwt_service: JWTService,
        skip_paths: Optional[List[str]] = None,
        require_auth: bool = True,
        validate_device_fingerprint: bool = True,
        enable_logging: bool = True,
        enable_audit_logging: bool = True,
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
            "/docs",
            "/openapi.json",
            "/redoc",
        ]
        self.require_auth = require_auth
        self.validate_device_fingerprint = validate_device_fingerprint
        self.enable_logging = enable_logging
        self.enable_audit_logging = enable_audit_logging

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Process authentication for incoming requests."""
        # Skip authentication for specified paths
        if self.should_skip_path(request.url.path):
            return await call_next(request)

        # Extract and validate token
        try:
            user_context = await self.authenticate_request(request)

            # Add user context to request state
            request.state.user = user_context

            # Log successful authentication
            if self.enable_logging:
                self.log_authentication(user_context, request, success=True)

            # Audit log
            if self.enable_audit_logging:
                await self.audit_authentication(user_context, request, success=True)

        except AuthenticationError as e:
            # Log failed authentication
            if self.enable_logging:
                self.log_authentication_error(e, request)

            # Audit log
            if self.enable_audit_logging:
                await self.audit_authentication_error(e, request)

            if self.require_auth:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail={
                        "success": False,
                        "error": {"code": e.error_code, "message": e.message},
                        "meta": {"timestamp": datetime.now(timezone.utc).isoformat()},
                    },
                )

        # Process request
        response = await call_next(request)
        return response

    def should_skip_path(self, path: str) -> bool:
        """Check if path should skip authentication."""
        for skip_path in self.skip_paths:
            if path.startswith(skip_path):
                return True
        return False

    async def authenticate_request(self, request: Request) -> UserContext:
        """Extract and validate authentication token."""
        # Extract token from Authorization header
        authorization = request.headers.get("Authorization")
        if not authorization:
            raise AuthenticationError(
                "Authorization header is missing", "MISSING_TOKEN"
            )

        # Parse Bearer token
        parts = authorization.split()
        if len(parts) != 2 or parts[0].lower() != "bearer":
            raise AuthenticationError(
                "Invalid authorization header format", "INVALID_TOKEN_FORMAT"
            )

        token = parts[1]

        # Validate token
        user_context = await self.jwt_service.validate_token(token, "access")

        # Validate device fingerprint if enabled
        if self.validate_device_fingerprint and user_context.device_fingerprint:
            request_fingerprint = self.get_device_fingerprint(request)
            if (
                request_fingerprint
                and request_fingerprint != user_context.device_fingerprint
            ):
                raise AuthenticationError(
                    "Device fingerprint mismatch", "DEVICE_MISMATCH"
                )

        # Add request-specific information
        user_context.ip_address = self.get_client_ip(request)
        user_context.user_agent = request.headers.get("User-Agent")
        user_context.request_id = request.headers.get("X-Request-ID")

        return user_context

    def get_client_ip(self, request: Request) -> str:
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

    def get_device_fingerprint(self, request: Request) -> Optional[str]:
        """Generate device fingerprint from request."""
        user_agent = request.headers.get("User-Agent", "")
        ip = self.get_client_ip(request)

        if user_agent and ip:
            import hashlib
            import base64

            fingerprint = hashlib.sha256(f"{user_agent}|{ip}".encode()).digest()
            return base64.urlsafe_b64encode(fingerprint).decode()

        return None

    def log_authentication(
        self, user_context: UserContext, request: Request, success: bool
    ) -> None:
        """Log authentication attempt."""
        logger.info(
            "Authentication successful",
            extra={
                "user_id": str(user_context.user_id),
                "tenant_id": str(user_context.tenant_id),
                "email": user_context.email,
                "role": user_context.role,
                "token_id": user_context.token_id,
                "request_id": user_context.request_id,
                "path": request.url.path,
                "method": request.method,
                "remote_addr": user_context.ip_address,
                "user_agent": user_context.user_agent,
                "auth_time": user_context.auth_time.isoformat(),
            },
        )

    def log_authentication_error(
        self, error: AuthenticationError, request: Request
    ) -> None:
        """Log authentication error."""
        logger.warning(
            "Authentication failed",
            extra={
                "error": error.message,
                "error_code": error.error_code,
                "path": request.url.path,
                "method": request.method,
                "remote_addr": self.get_client_ip(request),
                "user_agent": request.headers.get("User-Agent"),
                "request_id": request.headers.get("X-Request-ID"),
            },
        )

    async def audit_authentication(
        self, user_context: UserContext, request: Request, success: bool
    ) -> None:
        """Audit log authentication event."""
        # This would integrate with your audit logging system
        # For now, we'll log to the standard logger
        logger.info(
            "Authentication audit log",
            extra={
                "event_type": "authentication",
                "user_id": str(user_context.user_id),
                "tenant_id": str(user_context.tenant_id),
                "token_id": user_context.token_id,
                "ip_address": user_context.ip_address,
                "user_agent": user_context.user_agent,
                "resource": request.url.path,
                "action": request.method,
                "timestamp": user_context.auth_time.isoformat(),
                "success": success,
            },
        )

    async def audit_authentication_error(
        self, error: AuthenticationError, request: Request
    ) -> None:
        """Audit log authentication failure."""
        logger.info(
            "Authentication failure audit log",
            extra={
                "event_type": "authentication_failure",
                "error": error.message,
                "error_code": error.error_code,
                "ip_address": self.get_client_ip(request),
                "user_agent": request.headers.get("User-Agent"),
                "resource": request.url.path,
                "action": request.method,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "success": False,
            },
        )


# Dependency injection functions for FastAPI

security = HTTPBearer(auto_error=False)


async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> UserContext:
    """Get current authenticated user from request."""
    user = getattr(request.state, "user", None)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required"
        )
    return user


async def get_current_user_optional(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> Optional[UserContext]:
    """Get current authenticated user, optional."""
    return getattr(request.state, "user", None)


def require_permissions(*permissions: str):
    """Decorator to require specific permissions."""

    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Find the request argument
            request = None
            for arg in args:
                if isinstance(arg, Request):
                    request = arg
                    break

            if not request:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Request object not found",
                )

            user = getattr(request.state, "user", None)
            if not user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Authentication required",
                )

            # Check permissions
            for permission in permissions:
                if not user.has_permission(permission):
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail=f"Insufficient permissions: {permission} required",
                    )

            return await func(*args, **kwargs)

        return wrapper

    return decorator


def require_roles(*roles: str):
    """Decorator to require specific roles."""

    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Find the request argument
            request = None
            for arg in args:
                if isinstance(arg, Request):
                    request = arg
                    break

            if not request:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Request object not found",
                )

            user = getattr(request.state, "user", None)
            if not user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Authentication required",
                )

            # Check roles
            if not any(user.has_role(role) for role in roles):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Insufficient privileges: one of {roles} required",
                )

            return await func(*args, **kwargs)

        return wrapper

    return decorator


def require_tenant_access(func: Callable) -> Callable:
    """Decorator to validate tenant access."""

    @wraps(func)
    async def wrapper(*args, **kwargs):
        # Find the request argument
        request = None
        for arg in args:
            if isinstance(arg, Request):
                request = arg
                break

        if not request:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Request object not found",
            )

        user = getattr(request.state, "user", None)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required",
            )

        # Extract tenant ID from request
        tenant_id = request.headers.get("X-Tenant-ID") or request.path_params.get(
            "tenant_id"
        )

        if tenant_id:
            try:
                request_tenant_id = uuid.UUID(tenant_id)
                if user.tenant_id != request_tenant_id and user.role != "super_admin":
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Tenant access denied",
                    )
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid tenant ID"
                )

        return await func(*args, **kwargs)

    return wrapper


# Utility functions


def get_user_context(request: Request) -> Optional[UserContext]:
    """Get user context from request."""
    return getattr(request.state, "user", None)


def is_authenticated(request: Request) -> bool:
    """Check if request is authenticated."""
    return hasattr(request.state, "user") and request.state.user is not None


def has_permission(request: Request, permission: str) -> bool:
    """Check if authenticated user has permission."""
    user = get_user_context(request)
    return user.has_permission(permission) if user else False


def has_role(request: Request, role: str) -> bool:
    """Check if authenticated user has role."""
    user = get_user_context(request)
    return user.has_role(role) if user else False


# Rate limiting implementation


class RateLimiter:
    """Rate limiter for authenticated users."""

    def __init__(self, redis_client: redis.Redis):
        self.redis = redis_client

    async def is_allowed(
        self,
        user_id: uuid.UUID,
        limit: int,
        window: int,
        identifier: Optional[str] = None,
    ) -> bool:
        """Check if user is allowed to make a request."""
        key = f"rate_limit:{user_id}"
        if identifier:
            key += f":{identifier}"

        # Use sliding window counter
        current_time = int(time.time())
        window_start = current_time - window

        # Remove old entries
        await self.redis.zremrangebyscore(key, 0, window_start)

        # Count current requests
        current_requests = await self.redis.zcard(key)

        if current_requests >= limit:
            return False

        # Add current request
        await self.redis.zadd(key, {str(current_time): current_time})
        await self.redis.expire(key, window)

        return True


# Factory function for easy setup


async def create_auth_middleware(
    secret_key: str,
    redis_url: Optional[str] = None,
    skip_paths: Optional[List[str]] = None,
    **kwargs,
) -> AuthenticationMiddleware:
    """Create authentication middleware with default configuration."""
    # Create Redis client if URL provided
    redis_client = None
    if redis_url:
        redis_client = redis.from_url(redis_url)

    # Create JWT service
    jwt_service = JWTService(secret_key=secret_key, redis_client=redis_client)

    # Create middleware
    return AuthenticationMiddleware(
        app=None,  # Will be set when used
        jwt_service=jwt_service,
        skip_paths=skip_paths,
        **kwargs,
    )
