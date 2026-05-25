"""
JWT Manager for the RAG service.

This module provides JWT token generation, validation, and management
functionality with secure token handling and blacklisting support.
"""

import base64
import hashlib
import time
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

import jwt
from fastapi import HTTPException, status
from loguru import logger

from ..core.config import get_settings


class TokenValidationError(Exception):
    """Token validation error."""

    def __init__(self, message: str, error_type: str = "invalid"):
        self.message = message
        self.error_type = error_type
        super().__init__(self.message)


class JWTManager:
    """JWT Token Manager with secure generation and validation."""

    def __init__(self, settings=None):
        """Initialize JWT Manager."""
        self.settings = settings or get_settings()
        self.secret_key = self.settings.secret_key
        self.algorithm = self.settings.algorithm
        self.access_token_expire_minutes = self.settings.access_token_expire_minutes
        self.refresh_token_expire_days = self.settings.refresh_token_expire_days
        self.issuer = "sdlc-rag-service"

        # Token blacklist (in production, use Redis)
        self._blacklist: Dict[str, float] = {}  # token_id -> expiry_time

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
        """
        Generate a new access and refresh token pair.

        Args:
            user_id: User ID
            tenant_id: Tenant ID
            email: User email
            role: User role
            permissions: User permissions list
            device_fingerprint: Device fingerprint for security
            session_id: Session ID for tracking

        Returns:
            Dictionary containing access_token, refresh_token, and metadata
        """
        now = datetime.utcnow()

        # Generate unique token IDs
        access_token_id = self._generate_token_id()
        refresh_token_id = self._generate_token_id()

        # Create security context
        security_context = {
            "tenant_id": tenant_id,
            "created_by": "jwt_manager",
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
            "iat": now,
            "exp": now + timedelta(minutes=self.access_token_expire_minutes),
            "nbf": now,
            "iss": self.issuer,
            "sub": user_id,
            "aud": [self.issuer],
            "security_context": security_context,
        }

        # Refresh token claims
        refresh_claims = {
            "user_id": user_id,
            "tenant_id": tenant_id,
            "email": email,
            "role": role,
            "permissions": permissions,
            "token_type": "refresh",
            "jti": refresh_token_id,
            "device_fingerprint": device_fingerprint,
            "session_id": session_id,
            "iat": now,
            "exp": now + timedelta(days=self.refresh_token_expire_days),
            "nbf": now,
            "iss": self.issuer,
            "sub": user_id,
            "aud": [self.issuer],
            "security_context": security_context,
        }

        # Generate tokens
        access_token = self._encode_token(access_claims)
        refresh_token = self._encode_token(refresh_claims)

        token_pair = {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "Bearer",
            "expires_in": self.access_token_expire_minutes * 60,
            "expires_at": access_claims["exp"].isoformat(),
            "refresh_expires_in": self.refresh_token_expire_days * 24 * 3600,
            "refresh_expires_at": refresh_claims["exp"].isoformat(),
        }

        logger.info(
            f"Generated token pair for user {user_id}, tenant {tenant_id}",
            extra={
                "user_id": user_id,
                "tenant_id": tenant_id,
                "access_token_id": access_token_id,
                "refresh_token_id": refresh_token_id,
            },
        )

        return token_pair

    def validate_token(
        self, token: str, expected_type: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Validate a JWT token and return its claims.

        Args:
            token: JWT token string
            expected_type: Expected token type ("access" or "refresh")

        Returns:
            Token claims dictionary

        Raises:
            TokenValidationError: If token is invalid
        """
        try:
            # Decode and verify token
            claims = self._decode_token(token)

            # Validate token type if specified
            if expected_type and claims.get("token_type") != expected_type:
                raise TokenValidationError(
                    f"Invalid token type. Expected {expected_type}, got {claims.get('token_type')}",
                    "invalid_type",
                )

            # Check if token is blacklisted
            token_id = claims.get("jti")
            if token_id and self.is_token_blacklisted(token_id):
                raise TokenValidationError("Token has been revoked", "blacklisted")

            return claims

        except jwt.ExpiredSignatureError:
            raise TokenValidationError("Token has expired", "expired")
        except jwt.InvalidTokenError as e:
            raise TokenValidationError(f"Invalid token: {str(e)}", "invalid")
        except Exception as e:
            logger.error(f"Unexpected error validating token: {str(e)}")
            raise TokenValidationError("Token validation failed", "invalid")

    def refresh_token(
        self, refresh_token: str, device_fingerprint: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Refresh an access token using a valid refresh token.

        Args:
            refresh_token: Refresh token string
            device_fingerprint: Current device fingerprint for validation

        Returns:
            New token pair dictionary

        Raises:
            TokenValidationError: If refresh token is invalid
        """
        # Validate refresh token
        claims = self.validate_token(refresh_token, "refresh")

        # Validate device fingerprint if present
        stored_fingerprint = claims.get("device_fingerprint")
        if (
            stored_fingerprint
            and device_fingerprint
            and stored_fingerprint != device_fingerprint
        ):
            logger.warning(
                "Device fingerprint mismatch during token refresh",
                extra={
                    "stored_fingerprint": stored_fingerprint,
                    "provided_fingerprint": device_fingerprint,
                    "user_id": claims.get("user_id"),
                },
            )
            raise TokenValidationError("Device fingerprint mismatch", "device_mismatch")

        # Revoke the old refresh token
        self.revoke_token(claims.get("jti"))

        # Generate new token pair
        return self.generate_token_pair(
            user_id=claims["user_id"],
            tenant_id=claims["tenant_id"],
            email=claims["email"],
            role=claims["role"],
            permissions=claims.get("permissions", []),
            device_fingerprint=claims.get("device_fingerprint"),
            session_id=claims.get("session_id"),
        )

    def revoke_token(self, token_id: str) -> None:
        """
        Revoke a token by adding it to the blacklist.

        Args:
            token_id: JWT ID (jti) of the token to revoke
        """
        if not token_id:
            return

        # Add to blacklist with expiry time
        # In production, store in Redis with TTL
        self._blacklist[token_id] = time.time() + (
            self.refresh_token_expire_days * 24 * 3600
        )

        logger.info(f"Token {token_id} revoked")

    def revoke_user_tokens(self, user_id: str) -> int:
        """
        Revoke all tokens for a user (simplified implementation).

        Args:
            user_id: User ID whose tokens to revoke

        Returns:
            Number of tokens revoked
        """
        # This is a simplified implementation
        # In production, you would need to track user->token mappings
        revoked_count = 0

        # Remove expired tokens from blacklist
        self._cleanup_blacklist()

        logger.info(f"User token revocation requested for user {user_id}")
        return revoked_count

    def is_token_blacklisted(self, token_id: str) -> bool:
        """
        Check if a token is blacklisted.

        Args:
            token_id: JWT ID (jti) to check

        Returns:
            True if token is blacklisted
        """
        if not token_id:
            return False

        # Check blacklist and clean up expired entries
        self._cleanup_blacklist()
        return token_id in self._blacklist

    def get_token_info(self, token: str) -> Dict[str, Any]:
        """
        Get token information without full validation.

        Args:
            token: JWT token string

        Returns:
            Token information dictionary
        """
        try:
            # Decode without verification to get basic info
            unverified_claims = jwt.decode(token, options={"verify_signature": False})

            return {
                "token_id": unverified_claims.get("jti"),
                "user_id": unverified_claims.get("user_id"),
                "tenant_id": unverified_claims.get("tenant_id"),
                "email": unverified_claims.get("email"),
                "role": unverified_claims.get("role"),
                "token_type": unverified_claims.get("token_type"),
                "issued_at": unverified_claims.get("iat"),
                "expires_at": unverified_claims.get("exp"),
                "issuer": unverified_claims.get("iss"),
            }
        except Exception as e:
            logger.error(f"Failed to get token info: {str(e)}")
            return {}

    def _encode_token(self, claims: Dict[str, Any]) -> str:
        """Encode claims into JWT token."""
        return jwt.encode(claims, self.secret_key, algorithm=self.algorithm)

    def _decode_token(self, token: str) -> Dict[str, Any]:
        """Decode and verify JWT token."""
        return jwt.decode(
            token,
            self.secret_key,
            algorithms=[self.algorithm],
            audience=self.issuer,
            issuer=self.issuer,
        )

    def _generate_token_id(self) -> str:
        """Generate a unique token ID."""
        import uuid

        return str(uuid.uuid4())

    def _cleanup_blacklist(self) -> None:
        """Remove expired tokens from blacklist."""
        current_time = time.time()
        expired_tokens = [
            token_id
            for token_id, expiry_time in self._blacklist.items()
            if expiry_time <= current_time
        ]

        for token_id in expired_tokens:
            del self._blacklist[token_id]


class AuthenticationManager:
    """High-level authentication manager."""

    def __init__(self, jwt_manager: Optional[JWTManager] = None):
        """Initialize authentication manager."""
        self.jwt_manager = jwt_manager or JWTManager()

    def authenticate_token(
        self, token: str, expected_type: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Authenticate a token and return user context.

        Args:
            token: JWT token string
            expected_type: Expected token type

        Returns:
            User context dictionary

        Raises:
            HTTPException: If authentication fails
        """
        try:
            claims = self.jwt_manager.validate_token(token, expected_type)

            # Extract user context
            user_context = {
                "user_id": claims.get("user_id"),
                "tenant_id": claims.get("tenant_id"),
                "email": claims.get("email"),
                "role": claims.get("role"),
                "permissions": claims.get("permissions", []),
                "token_id": claims.get("jti"),
                "device_fingerprint": claims.get("device_fingerprint"),
                "session_id": claims.get("session_id"),
                "token_type": claims.get("token_type"),
                "expires_at": claims.get("exp"),
                "issued_at": claims.get("iat"),
                "security_context": claims.get("security_context", {}),
            }

            return user_context

        except TokenValidationError as e:
            logger.warning(
                f"Token authentication failed: {e.message}",
                extra={"error_type": e.error_type},
            )

            # Return appropriate HTTP status
            status_code = status.HTTP_401_UNAUTHORIZED
            if e.error_type == "expired":
                status_code = status.HTTP_401_UNAUTHORIZED
            elif e.error_type == "device_mismatch":
                status_code = status.HTTP_401_UNAUTHORIZED
            elif e.error_type == "blacklisted":
                status_code = status.HTTP_401_UNAUTHORIZED

            raise HTTPException(
                status_code=status_code,
                detail={
                    "error": e.error_type,
                    "message": e.message,
                },
            )

    def refresh_access_token(
        self, refresh_token: str, device_fingerprint: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Refresh an access token.

        Args:
            refresh_token: Refresh token string
            device_fingerprint: Current device fingerprint

        Returns:
            New token pair

        Raises:
            HTTPException: If refresh fails
        """
        try:
            return self.jwt_manager.refresh_token(refresh_token, device_fingerprint)
        except TokenValidationError as e:
            logger.warning(
                f"Token refresh failed: {e.message}",
                extra={"error_type": e.error_type},
            )

            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={
                    "error": e.error_type,
                    "message": e.message,
                },
            )

    def logout(self, token: str) -> None:
        """
        Logout by revoking the token.

        Args:
            token: JWT token to revoke
        """
        try:
            # Get token info to extract token ID
            token_info = self.jwt_manager.get_token_info(token)
            token_id = token_info.get("token_id")

            if token_id:
                self.jwt_manager.revoke_token(token_id)
                logger.info(f"User logged out, token {token_id} revoked")

        except Exception as e:
            logger.error(f"Error during logout: {str(e)}")

    def logout_all_devices(self, token: str) -> int:
        """
        Logout from all devices by revoking all user tokens.

        Args:
            token: Current user token

        Returns:
            Number of tokens revoked
        """
        try:
            # Get user ID from token
            token_info = self.jwt_manager.get_token_info(token)
            user_id = token_info.get("user_id")

            if user_id:
                revoked_count = self.jwt_manager.revoke_user_tokens(user_id)
                logger.info(
                    f"User {user_id} logged out from all devices, {revoked_count} tokens revoked"
                )
                return revoked_count

        except Exception as e:
            logger.error(f"Error during logout all devices: {str(e)}")

        return 0


def hash_device_fingerprint(fingerprint: str) -> str:
    """
    Create a secure hash of device fingerprint.

    Args:
        fingerprint: Device fingerprint string

    Returns:
        Hashed fingerprint
    """
    return base64.urlsafe_b64encode(
        hashlib.sha256(fingerprint.encode()).digest()
    ).decode()


def extract_token_from_header(authorization: str) -> str:
    """
    Extract JWT token from Authorization header.

    Args:
        authorization: Authorization header value

    Returns:
        JWT token string

    Raises:
        HTTPException: If header is invalid
    """
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error": "missing_token",
                "message": "Authorization header is missing",
            },
        )

    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error": "invalid_token_format",
                "message": "Invalid authorization header format. Expected 'Bearer <token>'",
            },
        )

    return parts[1]


# Utility functions for token validation
def verify_token_type(claims: Dict[str, Any], expected_type: str) -> bool:
    """Verify token type matches expected type."""
    return claims.get("token_type") == expected_type


def verify_tenant_access(claims: Dict[str, Any], required_tenant_id: str) -> bool:
    """Verify user has access to the specified tenant."""
    user_tenant_id = claims.get("tenant_id")
    user_role = claims.get("role")

    # Super admins can access any tenant
    if user_role == "super_admin":
        return True

    # Users can only access their own tenant
    return user_tenant_id == required_tenant_id


def verify_permissions(claims: Dict[str, Any], required_permissions: List[str]) -> bool:
    """Verify user has required permissions."""
    user_role = claims.get("role")
    user_permissions = claims.get("permissions", [])

    # Admin users have all permissions
    if user_role in ["super_admin", "tenant_admin"]:
        return True

    # Check for exact permission matches
    for required_perm in required_permissions:
        if required_perm not in user_permissions and "*" not in user_permissions:
            return False

    return True


# Global instance
_jwt_manager: Optional[JWTManager] = None
_auth_manager: Optional[AuthenticationManager] = None


def get_jwt_manager() -> JWTManager:
    """Get global JWT manager instance."""
    global _jwt_manager
    if _jwt_manager is None:
        _jwt_manager = JWTManager()
    return _jwt_manager


def get_auth_manager() -> AuthenticationManager:
    """Get global authentication manager instance."""
    global _auth_manager
    if _auth_manager is None:
        _auth_manager = AuthenticationManager()
    return _auth_manager
