"""
JWT authentication for SDLC.ai SDK

Implements JWT token-based authentication with automatic refresh.
"""

import time
from typing import Optional, Dict, Any, Tuple
import structlog

from .base import BaseAuth
from ..exceptions import AuthenticationError, TokenExpiredError, TokenInvalidError
from ..models.auth import AuthResponse
from ..utils.token import decode_token, is_token_expired, create_token

logger = structlog.get_logger("sdlc_sdk.auth.jwt")


class JWTAuth(BaseAuth):
    """
    JWT token-based authentication.

    Handles JWT tokens with automatic refresh and validation.
    """

    def __init__(
        self,
        token: Optional[str] = None,
        refresh_token: Optional[str] = None,
        secret_key: Optional[str] = None,
        auto_refresh: bool = True,
        refresh_leeway: int = 30,
    ):
        """
        Initialize JWT authentication.

        Args:
            token: Initial JWT token
            refresh_token: Token for refreshing
            secret_key: Secret key for token validation
            auto_refresh: Whether to auto-refresh tokens
            refresh_leeway: Seconds before expiration to refresh
        """
        super().__init__()
        self.token = token
        self.refresh_token = refresh_token
        self.secret_key = secret_key
        self.auto_refresh = auto_refresh
        self.refresh_leeway = refresh_leeway

        if token:
            self.token_manager.set_token(token)

    async def authenticate(self, client) -> Tuple[bool, Optional[Dict[str, Any]]]:
        """
        Authenticate with JWT token.

        Args:
            client: The client instance

        Returns:
            Tuple of (success, auth_data)
        """
        try:
            if not self.token:
                raise AuthenticationError(
                    message="No JWT token provided", code="TOKEN_MISSING"
                )

            # Validate token
            if not self._validate_token(self.token):
                if self.refresh_token and self.auto_refresh:
                    # Try to refresh
                    if await self._refresh_token(client):
                        return await self.authenticate(client)

                raise TokenExpiredError("JWT token is expired")

            # Make validation request to server
            response = await client._request(
                method="GET", endpoint="/auth/validate", headers=self.get_headers()
            )

            if response.status_code == 200:
                data = response.json()
                auth_response = AuthResponse(**data)

                self._authenticated = True
                self._auth_data = data

                # Update token if server provided new one
                if auth_response.token and auth_response.token != self.token:
                    self.token = auth_response.token
                    self.token_manager.set_token(self.token)

                logger.info("JWT authentication successful")
                return True, data
            else:
                # Token rejected by server
                self.invalidate()
                return False, None

        except Exception as e:
            logger.error("JWT authentication error", error=str(e))
            raise AuthenticationError(
                message=f"JWT authentication failed: {str(e)}", code="JWT_AUTH_FAILED"
            )

    def _validate_token(self, token: str) -> bool:
        """
        Validate JWT token.

        Args:
            token: JWT token to validate

        Returns:
            True if token is valid
        """
        try:
            # Decode token
            payload = decode_token(
                token, secret=self.secret_key, verify=bool(self.secret_key)
            )

            # Check expiration
            if is_token_expired(token, self.refresh_leeway):
                return False

            # Check required claims
            required_claims = ["sub", "exp"]
            for claim in required_claims:
                if claim not in payload:
                    logger.error("Missing required JWT claim", claim=claim)
                    return False

            return True

        except Exception as e:
            logger.error("JWT validation error", error=str(e))
            return False

    async def _refresh_token(self, client) -> bool:
        """
        Refresh JWT token using refresh token.

        Args:
            client: The client instance

        Returns:
            True if refresh was successful
        """
        if not self.refresh_token:
            return False

        try:
            response = await client._request(
                method="POST",
                endpoint="/auth/refresh",
                data={"refresh_token": self.refresh_token},
            )

            if response.status_code == 200:
                data = response.json()
                self.token = data.get("access_token") or data.get("token")

                if self.token:
                    self.token_manager.set_token(self.token)

                    # Update refresh token if provided
                    if data.get("refresh_token"):
                        self.refresh_token = data["refresh_token"]

                    logger.info("JWT token refreshed successfully")
                    return True

            logger.error("JWT token refresh failed", response=response.status_code)
            return False

        except Exception as e:
            logger.error("JWT token refresh error", error=str(e))
            return False

    def get_headers(self) -> Dict[str, str]:
        """
        Get authentication headers.

        Returns:
            Dictionary with Bearer token
        """
        headers = {}

        token = self.get_valid_token()
        if token:
            headers["Authorization"] = f"Bearer {token}"

        return headers

    def get_valid_token(self) -> Optional[str]:
        """
        Get valid JWT token, refreshing if needed.

        Returns:
            Valid JWT token or None
        """
        if not self.token:
            return None

        # Check if token needs refresh
        if self.auto_refresh and is_token_expired(self.token, self.refresh_leeway):
            # Can't refresh here without client, but we can check token manager
            token = self.token_manager.get_token()
            if token and token != self.token:
                self.token = token
                return token

        return self.token

    def refresh(self) -> bool:
        """
        Refresh JWT token.

        Note: This requires the refresh token to be valid
        and would typically be called through the client.

        Returns:
            True if refresh is needed
        """
        if self.refresh_token and self.auto_refresh:
            # Indicate that refresh is needed
            return is_token_expired(self.token, self.refresh_leeway)

        return False

    def is_authenticated(self) -> bool:
        """
        Check if authenticated with valid token.

        Returns:
            True if authenticated with valid token
        """
        if not self.token:
            return False

        # Quick check without full validation
        try:
            payload = decode_token(self.token, verify=False)
            exp = payload.get("exp")
            if exp:
                return time.time() < exp - self.refresh_leeway
            return True
        except:
            return False

    def set_token(self, token: str) -> None:
        """
        Set new JWT token.

        Args:
            token: New JWT token
        """
        self.token = token
        self.token_manager.set_token(token)
        self._authenticated = True

    def set_refresh_token(self, refresh_token: str) -> None:
        """
        Set refresh token.

        Args:
            refresh_token: New refresh token
        """
        self.refresh_token = refresh_token

    def get_token_info(self) -> Optional[Dict[str, Any]]:
        """
        Get information about current token.

        Returns:
            Token information dictionary
        """
        if not self.token:
            return None

        try:
            return decode_token(self.token, verify=False)
        except:
            return None
