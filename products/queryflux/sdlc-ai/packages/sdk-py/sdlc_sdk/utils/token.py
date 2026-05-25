"""
Token utilities for SDLC.ai SDK

Provides JWT token handling and validation.
"""

import time
from typing import Optional, Dict, Any
from datetime import datetime, timezone
from jose import jwt, JWTError, ExpiredSignatureError
import structlog

logger = structlog.get_logger("sdlc_sdk.token")


def decode_token(
    token: str,
    secret: Optional[str] = None,
    algorithms: Optional[list] = None,
    verify: bool = True,
) -> Dict[str, Any]:
    """
    Decode JWT token.

    Args:
        token: JWT token string
        secret: Secret key for verification (if verifying)
        algorithms: List of allowed algorithms
        verify: Whether to verify token signature

    Returns:
        Decoded token payload

    Raises:
        JWTError: If token is invalid
    """
    if algorithms is None:
        algorithms = ["HS256"]

    try:
        if verify and secret:
            payload = jwt.decode(
                token, secret, algorithms=algorithms, options={"verify_signature": True}
            )
        else:
            # Decode without verification
            payload = jwt.decode(token, options={"verify_signature": False})

        return payload
    except ExpiredSignatureError:
        logger.warning("Token has expired")
        raise
    except JWTError as e:
        logger.error("Token decode error", error=str(e))
        raise


def is_token_expired(token: str, leeway: int = 30) -> bool:
    """
    Check if token is expired or about to expire.

    Args:
        token: JWT token string
        leeway: Seconds before expiration to consider expired

    Returns:
        True if token is expired or will expire within leeway
    """
    try:
        payload = decode_token(token, verify=False)

        # Check expiration claim
        exp = payload.get("exp")
        if not exp:
            # No expiration claim, assume not expired
            return False

        # Convert to timestamp
        exp_timestamp = datetime.fromtimestamp(exp, tz=timezone.utc)
        now = datetime.now(tz=timezone.utc)

        # Check if expired within leeway
        return (exp_timestamp - now).total_seconds() <= leeway
    except Exception as e:
        logger.warning("Failed to check token expiration", error=str(e))
        # Assume expired if we can't decode
        return True


def extract_token_info(token: str) -> Dict[str, Any]:
    """
    Extract useful information from token.

    Args:
        token: JWT token string

    Returns:
        Dictionary with token information
    """
    try:
        payload = decode_token(token, verify=False)

        info = {
            "user_id": payload.get("sub"),
            "tenant_id": payload.get("tenant_id"),
            "email": payload.get("email"),
            "roles": payload.get("roles", []),
            "permissions": payload.get("permissions", []),
            "issued_at": payload.get("iat"),
            "expires_at": payload.get("exp"),
            "issuer": payload.get("iss"),
            "audience": payload.get("aud"),
        }

        # Convert timestamps to datetime if present
        if info["issued_at"]:
            info["issued_at"] = datetime.fromtimestamp(
                info["issued_at"], tz=timezone.utc
            )
        if info["expires_at"]:
            info["expires_at"] = datetime.fromtimestamp(
                info["expires_at"], tz=timezone.utc
            )

        return info
    except Exception as e:
        logger.error("Failed to extract token info", error=str(e))
        return {}


def create_token(
    payload: Dict[str, Any],
    secret: str,
    algorithm: str = "HS256",
    expires_in: Optional[int] = None,
    issued_at: Optional[int] = None,
) -> str:
    """
    Create JWT token.

    Args:
        payload: Token payload data
        secret: Secret key for signing
        algorithm: Signing algorithm
        expires_in: Expiration time in seconds
        issued_at: Issued at timestamp (default: now)

    Returns:
        JWT token string
    """
    now = int(time.time())

    # Prepare claims
    claims = {"iat": issued_at or now, **payload}

    # Add expiration if provided
    if expires_in:
        claims["exp"] = now + expires_in

    # Create token
    token = jwt.encode(claims, secret, algorithm=algorithm)

    return token


def refresh_token(
    token: str, secret: str, algorithm: str = "HS256", expires_in: Optional[int] = None
) -> str:
    """
    Refresh token with new expiration.

    Args:
        token: Original JWT token
        secret: Secret key for signing
        algorithm: Signing algorithm
        expires_in: New expiration time in seconds

    Returns:
        New JWT token string
    """
    # Decode original token (without verification for refresh)
    payload = decode_token(token, verify=False)

    # Remove old claims that will be reset
    payload.pop("exp", None)
    payload.pop("iat", None)

    # Create new token
    return create_token(
        payload=payload, secret=secret, algorithm=algorithm, expires_in=expires_in
    )


def validate_token_claims(
    payload: Dict[str, Any],
    required_claims: Optional[list] = None,
    issuer: Optional[str] = None,
    audience: Optional[str] = None,
) -> bool:
    """
    Validate token claims.

    Args:
        payload: Decoded token payload
        required_claims: List of required claim names
        issuer: Expected issuer
        audience: Expected audience

    Returns:
        True if claims are valid
    """
    # Check required claims
    if required_claims:
        for claim in required_claims:
            if claim not in payload:
                logger.error("Missing required claim", claim=claim)
                return False

    # Check issuer
    if issuer and payload.get("iss") != issuer:
        logger.error("Invalid issuer", expected=issuer, actual=payload.get("iss"))
        return False

    # Check audience
    if audience:
        aud = payload.get("aud")
        if isinstance(aud, list):
            if audience not in aud:
                logger.error("Invalid audience", expected=audience, actual=aud)
                return False
        elif aud != audience:
            logger.error("Invalid audience", expected=audience, actual=aud)
            return False

    return True


class TokenManager:
    """
    Manages JWT tokens with automatic refresh.
    """

    def __init__(
        self,
        secret: Optional[str] = None,
        algorithm: str = "HS256",
        refresh_leeway: int = 30,
        on_refresh: Optional[Callable[[str], str]] = None,
    ):
        """
        Initialize token manager.

        Args:
            secret: Secret key for verification
            algorithm: JWT algorithm
            refresh_leeway: Seconds before expiration to refresh
            on_refresh: Callback for token refresh
        """
        self.secret = secret
        self.algorithm = algorithm
        self.refresh_leeway = refresh_leeway
        self.on_refresh = on_refresh
        self._current_token: Optional[str] = None
        self._token_info: Optional[Dict[str, Any]] = None

    def set_token(self, token: str) -> None:
        """Set current token."""
        self._current_token = token
        self._token_info = extract_token_info(token)

    def get_token(self) -> Optional[str]:
        """Get current token, refreshing if needed."""
        if not self._current_token:
            return None

        # Check if token needs refresh
        if self.is_refresh_needed():
            self.refresh()

        return self._current_token

    def is_refresh_needed(self) -> bool:
        """Check if token needs refresh."""
        if not self._current_token:
            return False

        return is_token_expired(self._current_token, self.refresh_leeway)

    def refresh(self) -> bool:
        """
        Refresh the current token.

        Returns:
            True if refresh was successful
        """
        if not self._current_token:
            return False

        try:
            if self.on_refresh:
                # Use custom refresh callback
                new_token = self.on_refresh(self._current_token)
                if new_token:
                    self.set_token(new_token)
                    return True
            elif self.secret:
                # Use built-in refresh
                new_token = refresh_token(
                    self._current_token, self.secret, self.algorithm
                )
                self.set_token(new_token)
                return True
        except Exception as e:
            logger.error("Token refresh failed", error=str(e))

        return False

    def get_user_id(self) -> Optional[str]:
        """Get user ID from token."""
        return self._token_info.get("user_id") if self._token_info else None

    def get_tenant_id(self) -> Optional[str]:
        """Get tenant ID from token."""
        return self._token_info.get("tenant_id") if self._token_info else None

    def get_permissions(self) -> list:
        """Get permissions from token."""
        return self._token_info.get("permissions", []) if self._token_info else []

    def has_permission(self, permission: str) -> bool:
        """Check if token has specific permission."""
        permissions = self.get_permissions()
        return permission in permissions

