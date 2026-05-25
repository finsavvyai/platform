import uuid
from typing import Optional, Dict, Any, List, Callable
from datetime import datetime, timedelta, timezone
from functools import wraps
import jwt
import redis.asyncio as redis
from fastapi import HTTPException, Request, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
from pydantic import BaseModel
import hashlib
import logging
from dataclasses import dataclass


# Configure logging
logger = logging.getLogger(__name__)
audit_logger = logging.getLogger("auth_audit")


class TokenInfo(BaseModel):
    """Token information extracted from JWT"""

    user_id: str
    tenant_id: str
    email: str
    role: str
    permissions: List[str]
    token_id: str
    device_fingerprint: Optional[str] = None
    session_id: Optional[str] = None
    token_type: str
    expires_at: datetime
    issued_at: datetime
    security_context: Optional[Dict[str, str]] = None


class AuthContext(BaseModel):
    """Authentication context for requests"""

    user_id: str
    tenant_id: str
    email: str
    role: str
    permissions: List[str]
    token_id: str
    device_fingerprint: Optional[str] = None
    session_id: Optional[str] = None
    token_type: str
    expires_at: datetime
    issued_at: datetime
    security_context: Optional[Dict[str, str]] = None
    ip_address: str
    user_agent: str
    request_id: Optional[str] = None
    auth_time: datetime


class AuthenticationError(Exception):
    """Custom authentication error"""

    def __init__(self, message: str, error_type: str = "authentication_failed"):
        self.message = message
        self.error_type = error_type
        super().__init__(message)


class AuthorizationError(Exception):
    """Custom authorization error"""

    def __init__(self, message: str):
        self.message = message
        super().__init__(message)


@dataclass
class AuthConfig:
    """Authentication configuration"""

    jwt_algorithm: str = "RS256"
    jwt_public_key: Optional[str] = None
    jwt_private_key: Optional[str] = None
    jwt_secret_key: Optional[str] = None
    access_token_ttl: int = 3600  # 1 hour
    refresh_token_ttl: int = 2592000  # 30 days
    blacklist_enabled: bool = True
    redis_url: Optional[str] = None
    redis_key_prefix: str = "auth:blacklist:"
    device_tracking_enabled: bool = True
    audit_logging_enabled: bool = True
    rate_limiting_enabled: bool = True
    security_headers_enabled: bool = True
    max_login_attempts: int = 5
    account_lockout_duration: int = 900  # 15 minutes
    session_timeout: int = 86400  # 24 hours


class TokenBlacklistService:
    """Redis-based token blacklist service"""

    def __init__(self, redis_url: str, key_prefix: str = "auth:blacklist:"):
        self.redis_url = redis_url
        self.key_prefix = key_prefix
        self.redis_client: Optional[redis.Redis] = None

    async def initialize(self):
        """Initialize Redis connection"""
        try:
            self.redis_client = redis.from_url(self.redis_url, decode_responses=True)
            await self.redis_client.ping()
            logger.info("Connected to Redis for token blacklist")
        except Exception as e:
            logger.error(f"Failed to connect to Redis: {e}")
            raise

    async def add_to_blacklist(self, token_id: str, expires_at: datetime):
        """Add token to blacklist"""
        if not self.redis_client:
            return

        try:
            key = f"{self.key_prefix}{token_id}"
            ttl = int(
                (
                    expires_at.replace(tzinfo=timezone.utc) - datetime.now(timezone.utc)
                ).total_seconds()
            )
            if ttl > 0:
                await self.redis_client.setex(key, ttl, "1")
                logger.info(f"Added token {token_id} to blacklist")
        except Exception as e:
            logger.error(f"Failed to add token to blacklist: {e}")

    async def is_blacklisted(self, token_id: str) -> bool:
        """Check if token is blacklisted"""
        if not self.redis_client:
            return False

        try:
            key = f"{self.key_prefix}{token_id}"
            result = await self.redis_client.exists(key)
            return result > 0
        except Exception as e:
            logger.error(f"Failed to check blacklist: {e}")
            return False

    async def remove_from_blacklist(self, token_id: str):
        """Remove token from blacklist"""
        if not self.redis_client:
            return

        try:
            key = f"{self.key_prefix}{token_id}"
            await self.redis_client.delete(key)
            logger.info(f"Removed token {token_id} from blacklist")
        except Exception as e:
            logger.error(f"Failed to remove token from blacklist: {e}")

    async def cleanup_expired(self):
        """Clean up expired tokens (Redis handles this automatically with TTL)"""
        pass


class JWTService:
    """JWT token service for Python async services"""

    def __init__(self, config: AuthConfig):
        self.config = config
        self.blacklist_service: Optional[TokenBlacklistService] = None
        self._init_keys()

    def _init_keys(self):
        """Initialize JWT keys"""
        if self.config.jwt_secret_key:
            # For HMAC-based JWT
            self.secret_key = self.config.jwt_secret_key.encode()
            self.algorithm = "HS256"
        elif self.config.jwt_public_key and self.config.jwt_private_key:
            # For RSA-based JWT
            self.public_key = self.config.jwt_public_key.encode()
            self.private_key = self.config.jwt_private_key.encode()
            self.algorithm = self.config.jwt_algorithm
        else:
            raise ValueError(
                "Either secret_key or both public_key and private_key must be provided"
            )

    async def initialize(self):
        """Initialize async components"""
        if self.config.blacklist_enabled and self.config.redis_url:
            self.blacklist_service = TokenBlacklistService(
                self.config.redis_url, self.config.redis_key_prefix
            )
            await self.blacklist_service.initialize()

    def generate_token_pair(
        self,
        user_id: str,
        tenant_id: str,
        email: str,
        role: str,
        permissions: List[str],
        device_fingerprint: Optional[str] = None,
        session_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Generate access and refresh token pair"""
        now = datetime.now(timezone.utc)
        access_token_id = str(uuid.uuid4())
        refresh_token_id = str(uuid.uuid4())

        # Security context
        security_context = {
            "tenant_id": tenant_id,
            "created_by": "jwt_service",
            "version": "1.0",
        }

        # Access token claims
        access_claims = {
            "user_id": user_id,
            "tenant_id": tenant_id,
            "email": email,
            "role": role,
            "permissions": permissions,
            "token_type": "access",
            "jti": access_token_id,
            "device_fingerprint": device_fingerprint,
            "session_id": session_id,
            "iat": int(now.timestamp()),
            "exp": int(
                (now + timedelta(seconds=self.config.access_token_ttl)).timestamp()
            ),
            "nbf": int(now.timestamp()),
            "iss": "sdlc-platform",
            "sub": user_id,
            "aud": ["sdlc-platform"],
            "security_context": security_context,
        }

        # Refresh token claims
        refresh_claims = access_claims.copy()
        refresh_claims.update(
            {
                "token_type": "refresh",
                "jti": refresh_token_id,
                "exp": int(
                    (now + timedelta(seconds=self.config.refresh_token_ttl)).timestamp()
                ),
            }
        )

        # Sign tokens
        if hasattr(self, "secret_key"):
            # HMAC signing
            access_token = jwt.encode(
                access_claims, self.secret_key, algorithm=self.algorithm
            )
            refresh_token = jwt.encode(
                refresh_claims, self.secret_key, algorithm=self.algorithm
            )
        else:
            # RSA signing
            access_token = jwt.encode(
                access_claims, self.private_key, algorithm=self.algorithm
            )
            refresh_token = jwt.encode(
                refresh_claims, self.private_key, algorithm=self.algorithm
            )

        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "expires_at": now + timedelta(seconds=self.config.access_token_ttl),
            "refresh_expires_at": now
            + timedelta(seconds=self.config.refresh_token_ttl),
            "token_type": "Bearer",
        }

    async def validate_token(
        self, token_string: str, expected_type: Optional[str] = None
    ) -> TokenInfo:
        """Validate JWT token and return token information"""
        try:
            # Decode token
            if hasattr(self, "secret_key"):
                payload = jwt.decode(
                    token_string, self.secret_key, algorithms=[self.algorithm]
                )
            else:
                payload = jwt.decode(
                    token_string, self.public_key, algorithms=[self.algorithm]
                )

            # Validate token type
            token_type = payload.get("token_type")
            if expected_type and token_type != expected_type:
                raise AuthenticationError("Invalid token type", "invalid_type")

            # Check if token is blacklisted
            token_id = payload.get("jti")
            if self.blacklist_service and token_id:
                is_blacklisted = await self.blacklist_service.is_blacklisted(token_id)
                if is_blacklisted:
                    raise AuthenticationError("Token has been revoked", "blacklisted")

            # Convert timestamps
            issued_at = datetime.fromtimestamp(payload["iat"], timezone.utc)
            expires_at = datetime.fromtimestamp(payload["exp"], timezone.utc)

            return TokenInfo(
                user_id=payload["user_id"],
                tenant_id=payload["tenant_id"],
                email=payload["email"],
                role=payload["role"],
                permissions=payload.get("permissions", []),
                token_id=token_id,
                device_fingerprint=payload.get("device_fingerprint"),
                session_id=payload.get("session_id"),
                token_type=token_type,
                expires_at=expires_at,
                issued_at=issued_at,
                security_context=payload.get("security_context"),
            )

        except jwt.ExpiredSignatureError:
            raise AuthenticationError("Token has expired", "expired")
        except jwt.InvalidTokenError:
            raise AuthenticationError("Invalid token", "invalid")
        except Exception as e:
            raise AuthenticationError(
                f"Token validation failed: {str(e)}", "validation_failed"
            )

    async def refresh_token(
        self, refresh_token: str, device_fingerprint: Optional[str] = None
    ) -> Dict[str, Any]:
        """Generate new token pair using refresh token"""
        # Validate refresh token
        token_info = await self.validate_token(refresh_token, "refresh")

        # Validate device fingerprint if present
        if token_info.device_fingerprint and device_fingerprint:
            if token_info.device_fingerprint != device_fingerprint:
                raise AuthenticationError(
                    "Device fingerprint mismatch", "device_mismatch"
                )

        # Revoke old refresh token
        if self.blacklist_service:
            await self.blacklist_service.add_to_blacklist(
                token_info.token_id, token_info.expires_at
            )

        # Generate new token pair
        return self.generate_token_pair(
            user_id=token_info.user_id,
            tenant_id=token_info.tenant_id,
            email=token_info.email,
            role=token_info.role,
            permissions=token_info.permissions,
            device_fingerprint=token_info.device_fingerprint,
            session_id=token_info.session_id,
        )

    async def revoke_token(self, token_id: str, expires_at: datetime):
        """Revoke token by adding to blacklist"""
        if self.blacklist_service:
            await self.blacklist_service.add_to_blacklist(token_id, expires_at)


class AsyncAuthenticationMiddleware(BaseHTTPMiddleware):
    """Async authentication middleware for FastAPI/Starlette"""

    def __init__(self, app, config: AuthConfig, jwt_service: JWTService):
        super().__init__(app)
        self.config = config
        self.jwt_service = jwt_service
        self.security = HTTPBearer(auto_error=False)
        self.skip_paths = [
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
        ]

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Process request through authentication middleware"""
        # Skip authentication for specified paths
        if self.should_skip_path(request.url.path):
            return await call_next(request)

        # Add security headers if enabled
        if self.config.security_headers_enabled:
            self.add_security_headers(request)

        # Extract and validate token
        auth_context = None
        try:
            auth_context = await self.authenticate_request(request)
        except AuthenticationError as e:
            return self.handle_authentication_error(request, e)

        # Add auth context to request state
        request.state.auth_context = auth_context

        # Log authentication if enabled
        if self.config.audit_logging_enabled and auth_context:
            await self.log_authentication(auth_context, request)

        # Process request
        response = await call_next(request)

        return response

    def should_skip_path(self, path: str) -> bool:
        """Check if path should skip authentication"""
        for skip_path in self.skip_paths:
            if path.startswith(skip_path):
                return True
        return False

    def add_security_headers(self, request: Request):
        """Add security headers to response"""
        # Note: In Starlette middleware, headers are added to response, not request
        # This is handled in handle_authentication_error and after processing
        pass

    async def authenticate_request(self, request: Request) -> AuthContext:
        """Authenticate request and extract user context"""
        # Extract token from header
        token_string = await self.extract_token(request)
        if not token_string:
            raise AuthenticationError(
                "Authorization header is missing", "missing_token"
            )

        # Validate token
        token_info = await self.jwt_service.validate_token(token_string, "access")

        # Validate device fingerprint if enabled and present
        if self.config.device_tracking_enabled and token_info.device_fingerprint:
            request_fingerprint = self.get_device_fingerprint(request)
            if (
                request_fingerprint
                and request_fingerprint != token_info.device_fingerprint
            ):
                raise AuthenticationError(
                    "Device fingerprint mismatch", "device_mismatch"
                )

        # Create auth context
        auth_context = AuthContext(
            user_id=token_info.user_id,
            tenant_id=token_info.tenant_id,
            email=token_info.email,
            role=token_info.role,
            permissions=token_info.permissions,
            token_id=token_info.token_id,
            device_fingerprint=token_info.device_fingerprint,
            session_id=token_info.session_id,
            token_type=token_info.token_type,
            expires_at=token_info.expires_at,
            issued_at=token_info.issued_at,
            security_context=token_info.security_context,
            ip_address=self.get_client_ip(request),
            user_agent=request.headers.get("user-agent", ""),
            request_id=request.headers.get("x-request-id"),
            auth_time=datetime.now(timezone.utc),
        )

        return auth_context

    async def extract_token(self, request: Request) -> Optional[str]:
        """Extract token from Authorization header"""
        auth_header = request.headers.get("authorization")
        if not auth_header:
            return None

        # Remove "Bearer " prefix
        if auth_header.startswith("Bearer "):
            return auth_header[7:]

        return auth_header

    def get_client_ip(self, request: Request) -> str:
        """Get client IP address"""
        # Check X-Forwarded-For header first
        xff = request.headers.get("x-forwarded-for")
        if xff:
            # Take the first IP in the list
            return xff.split(",")[0].strip()

        # Check X-Real-IP header
        xri = request.headers.get("x-real-ip")
        if xri:
            return xri

        # Fall back to client host
        return request.client.host if request.client else "unknown"

    def get_device_fingerprint(self, request: Request) -> Optional[str]:
        """Create device fingerprint from request"""
        user_agent = request.headers.get("user-agent", "")
        ip = self.get_client_ip(request)

        if user_agent and ip:
            # Create simple hash
            fingerprint_data = f"{user_agent}|{ip}"
            return hashlib.sha256(fingerprint_data.encode()).hexdigest()[:32]

        return None

    async def log_authentication(self, auth_context: AuthContext, request: Request):
        """Log authentication event"""
        logger.info(
            "User authenticated",
            extra={
                "user_id": auth_context.user_id,
                "tenant_id": auth_context.tenant_id,
                "email": auth_context.email,
                "role": auth_context.role,
                "token_id": auth_context.token_id,
                "request_id": auth_context.request_id,
                "path": request.url.path,
                "method": request.method,
                "remote_addr": auth_context.ip_address,
                "user_agent": auth_context.user_agent,
                "auth_time": auth_context.auth_time.isoformat(),
            },
        )

        # Audit log
        if self.config.audit_logging_enabled:
            audit_logger.info(
                "Authentication successful",
                extra={
                    "event_type": "authentication",
                    "user_id": auth_context.user_id,
                    "tenant_id": auth_context.tenant_id,
                    "token_id": auth_context.token_id,
                    "ip_address": auth_context.ip_address,
                    "user_agent": auth_context.user_agent,
                    "resource": request.url.path,
                    "action": request.method,
                    "timestamp": auth_context.auth_time.isoformat(),
                    "success": True,
                },
            )

    def handle_authentication_error(
        self, request: Request, error: AuthenticationError
    ) -> Response:
        """Handle authentication errors"""
        # Log the authentication failure
        logger.warning(
            "Authentication failed",
            extra={
                "error": error.message,
                "error_type": error.error_type,
                "path": request.url.path,
                "method": request.method,
                "remote_addr": self.get_client_ip(request),
                "user_agent": request.headers.get("user-agent", ""),
            },
        )

        # Audit log the failure
        if self.config.audit_logging_enabled:
            audit_logger.warning(
                "Authentication failure",
                extra={
                    "event_type": "authentication_failure",
                    "error": error.message,
                    "error_type": error.error_type,
                    "ip_address": self.get_client_ip(request),
                    "user_agent": request.headers.get("user-agent", ""),
                    "resource": request.url.path,
                    "action": request.method,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "success": False,
                },
            )

        # Return appropriate HTTP status and error
        status_code, error_code = self.map_error_to_response(error.error_type)

        return Response(
            content=self.format_error_response(error_code, error.message),
            status_code=status_code,
            media_type="application/json",
            headers=self.get_security_headers(),
        )

    def map_error_to_response(self, error_type: str) -> tuple[int, str]:
        """Map error type to HTTP status and error code"""
        error_mapping = {
            "expired": (status.HTTP_401_UNAUTHORIZED, "TOKEN_EXPIRED"),
            "invalid": (status.HTTP_401_UNAUTHORIZED, "INVALID_TOKEN"),
            "missing_token": (status.HTTP_401_UNAUTHORIZED, "MISSING_TOKEN"),
            "device_mismatch": (status.HTTP_401_UNAUTHORIZED, "DEVICE_MISMATCH"),
            "blacklisted": (status.HTTP_401_UNAUTHORIZED, "TOKEN_REVOKED"),
            "invalid_type": (status.HTTP_401_UNAUTHORIZED, "INVALID_TOKEN_TYPE"),
        }

        return error_mapping.get(
            error_type, (status.HTTP_401_UNAUTHORIZED, "AUTHENTICATION_FAILED")
        )

    def format_error_response(self, error_code: str, message: str) -> str:
        """Format error response as JSON"""
        import json

        return json.dumps(
            {
                "success": False,
                "error": {
                    "code": error_code,
                    "message": message,
                },
                "meta": {
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                },
            }
        )

    def get_security_headers(self) -> dict:
        """Get security headers for response"""
        if not self.config.security_headers_enabled:
            return {}

        return {
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "DENY",
            "X-XSS-Protection": "1; mode=block",
            "Referrer-Policy": "strict-origin-when-cross-origin",
        }


# Utility functions for FastAPI dependency injection


async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(
        HTTPBearer(auto_error=False)
    ),
) -> AuthContext:
    """FastAPI dependency to get current authenticated user"""
    if not hasattr(request.state, "auth_context") or not request.state.auth_context:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return request.state.auth_context


async def get_current_user_with_permission(required_permission: str):
    """FastAPI dependency factory for permission-based access"""

    async def permission_dependency(
        current_user: AuthContext = Depends(get_current_user),
    ) -> AuthContext:
        if not has_permission(current_user, required_permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return current_user

    return permission_dependency


async def get_current_user_with_role(required_role: str):
    """FastAPI dependency factory for role-based access"""

    async def role_dependency(
        current_user: AuthContext = Depends(get_current_user),
    ) -> AuthContext:
        if not has_role(current_user, required_role):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient privileges",
            )
        return current_user

    return role_dependency


# Utility functions


def has_permission(auth_context: AuthContext, permission: str) -> bool:
    """Check if user has specific permission"""
    # Admin users have all permissions
    if auth_context.role in ["super_admin", "tenant_admin"]:
        return True

    # Check exact permission match or wildcard
    for perm in auth_context.permissions:
        if perm == permission or perm == "*":
            return True

    return False


def has_role(auth_context: AuthContext, role: str) -> bool:
    """Check if user has specific role"""
    return auth_context.role == role


def is_authenticated(request: Request) -> bool:
    """Check if request is authenticated"""
    return (
        hasattr(request.state, "auth_context")
        and request.state.auth_context is not None
    )


def get_tenant_id(request: Request) -> Optional[str]:
    """Get tenant ID from authenticated request"""
    if is_authenticated(request):
        return request.state.auth_context.tenant_id
    return None


def get_user_id(request: Request) -> Optional[str]:
    """Get user ID from authenticated request"""
    if is_authenticated(request):
        return request.state.auth_context.user_id
    return None


# Decorators for protecting routes


def require_permissions(*permissions: str):
    """Decorator to require specific permissions"""

    def decorator(func):
        @wraps(func)
        async def wrapper(request: Request, *args, **kwargs):
            if not is_authenticated(request):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Authentication required",
                )

            auth_context = request.state.auth_context
            for permission in permissions:
                if not has_permission(auth_context, permission):
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail=f"Permission required: {permission}",
                    )

            return await func(request, *args, **kwargs)

        return wrapper

    return decorator


def require_roles(*roles: str):
    """Decorator to require specific roles"""

    def decorator(func):
        @wraps(func)
        async def wrapper(request: Request, *args, **kwargs):
            if not is_authenticated(request):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Authentication required",
                )

            auth_context = request.state.auth_context
            if not any(has_role(auth_context, role) for role in roles):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"One of these roles required: {', '.join(roles)}",
                )

            return await func(request, *args, **kwargs)

        return wrapper

    return decorator


# Example usage in FastAPI app:

"""
from fastapi import FastAPI, Depends
from fastapi.security import HTTPBearer

app = FastAPI()

# Initialize auth components
config = AuthConfig(
    jwt_secret_key="your-secret-key",
    redis_url="redis://localhost:6379",
    audit_logging_enabled=True,
)

jwt_service = JWTService(config)

# Add middleware
app.add_middleware(AsyncAuthenticationMiddleware, config=config, jwt_service=jwt_service)

# Initialize async components
@app.on_event("startup")
async def startup_event():
    await jwt_service.initialize()

# Protected routes
@app.get("/protected")
@require_permissions("documents:read")
async def protected_route(request: Request):
    return {"message": "This is a protected route"}

@app.get("/admin")
@require_roles("admin", "super_admin")
async def admin_route(
    current_user: AuthContext = Depends(get_current_user),
):
    return {"message": "Admin only route", "user": current_user.email}
"""
