"""
OAuth 2.0 authentication for SDLC.ai SDK

Implements OAuth 2.0 authorization code flow and client credentials flow.
"""

import time
import urllib.parse
from typing import Optional, Dict, Any, Tuple
import structlog

from .base import BaseAuth
from ..exceptions import AuthenticationError, TokenExpiredError
from ..models.auth import AuthResponse, OAuthTokenResponse

logger = structlog.get_logger("sdlc_sdk.auth.oauth")


class OAuthAuth(BaseAuth):
    """
    OAuth 2.0 authentication.

    Supports both authorization code flow (for user authentication)
    and client credentials flow (for service-to-service authentication).
    """

    def __init__(
        self,
        client_id: str,
        client_secret: str,
        token_url: Optional[str] = None,
        redirect_uri: Optional[str] = None,
        scope: Optional[str] = None,
        flow: str = "client_credentials",
    ):
        """
        Initialize OAuth authentication.

        Args:
            client_id: OAuth client ID
            client_secret: OAuth client secret
            token_url: Token endpoint URL
            redirect_uri: Redirect URI (for auth code flow)
            scope: OAuth scope
            flow: OAuth flow type (client_credentials or authorization_code)
        """
        super().__init__()
        self.client_id = client_id
        self.client_secret = client_secret
        self.token_url = token_url or "/oauth/token"
        self.redirect_uri = redirect_uri
        self.scope = scope or "read write"
        self.flow = flow
        self.access_token: Optional[str] = None
        self.refresh_token: Optional[str] = None
        self.expires_at: Optional[float] = None

    async def authenticate(self, client) -> Tuple[bool, Optional[Dict[str, Any]]]:
        """
        Authenticate using OAuth flow.

        Args:
            client: The client instance

        Returns:
            Tuple of (success, auth_data)
        """
        try:
            if self.flow == "client_credentials":
                return await self._client_credentials_flow(client)
            elif self.flow == "authorization_code":
                return await self._authorization_code_flow(client)
            else:
                raise AuthenticationError(
                    message=f"Unsupported OAuth flow: {self.flow}",
                    code="UNSUPPORTED_OAUTH_FLOW",
                )
        except Exception as e:
            logger.error("OAuth authentication error", error=str(e))
            raise AuthenticationError(
                message=f"OAuth authentication failed: {str(e)}",
                code="OAUTH_AUTH_FAILED",
            )

    async def _client_credentials_flow(
        self, client
    ) -> Tuple[bool, Optional[Dict[str, Any]]]:
        """
        OAuth client credentials flow.

        Args:
            client: The client instance

        Returns:
            Tuple of (success, auth_data)
        """
        data = {
            "grant_type": "client_credentials",
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "scope": self.scope,
        }

        response = await client._request(
            method="POST",
            endpoint=self.token_url,
            data=data,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )

        if response.status_code == 200:
            token_data = response.json()
            self._store_token_data(token_data)

            # Get user info with the token
            auth_response = await self._get_user_info(client)

            self._authenticated = True
            self._auth_data = auth_response.dict() if auth_response else token_data

            logger.info("OAuth client credentials authentication successful")
            return True, self._auth_data
        else:
            error_data = response.json()
            raise AuthenticationError(
                message=error_data.get(
                    "error_description", "OAuth token request failed"
                ),
                code=error_data.get("error", "OAUTH_TOKEN_ERROR"),
            )

    async def _authorization_code_flow(
        self, client
    ) -> Tuple[bool, Optional[Dict[str, Any]]]:
        """
        OAuth authorization code flow.

        For SDK usage, this assumes we already have an authorization code.

        Args:
            client: The client instance

        Returns:
            Tuple of (success, auth_data)
        """
        # This would typically involve:
        # 1. Redirecting user to authorization endpoint
        # 2. Receiving authorization code via redirect
        # 3. Exchanging code for tokens

        # For SDK, we expect the code to be provided
        auth_code = getattr(self, "_auth_code", None)
        if not auth_code:
            raise AuthenticationError(
                message="Authorization code required for authorization code flow",
                code="AUTH_CODE_REQUIRED",
            )

        data = {
            "grant_type": "authorization_code",
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "code": auth_code,
            "redirect_uri": self.redirect_uri,
        }

        response = await client._request(
            method="POST",
            endpoint=self.token_url,
            data=data,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )

        if response.status_code == 200:
            token_data = response.json()
            self._store_token_data(token_data)

            # Get user info
            auth_response = await self._get_user_info(client)

            self._authenticated = True
            self._auth_data = auth_response.dict() if auth_response else token_data

            logger.info("OAuth authorization code authentication successful")
            return True, self._auth_data
        else:
            error_data = response.json()
            raise AuthenticationError(
                message=error_data.get(
                    "error_description", "OAuth token exchange failed"
                ),
                code=error_data.get("error", "OAUTH_EXCHANGE_ERROR"),
            )

    async def _get_user_info(self, client) -> Optional[AuthResponse]:
        """
        Get user information with the access token.

        Args:
            client: The client instance

        Returns:
            AuthResponse or None
        """
        try:
            response = await client._request(
                method="GET", endpoint="/auth/me", headers=self.get_headers()
            )

            if response.status_code == 200:
                data = response.json()
                return AuthResponse(**data)
        except Exception as e:
            logger.warning("Failed to get user info", error=str(e))

        return None

    def _store_token_data(self, token_data: Dict[str, Any]) -> None:
        """Store OAuth token data."""
        self.access_token = token_data.get("access_token")
        self.refresh_token = token_data.get("refresh_token")

        # Calculate expiration
        expires_in = token_data.get("expires_in")
        if expires_in:
            self.expires_at = time.time() + expires_in

        # Store in token manager
        if self.access_token:
            self.token_manager.set_token(self.access_token)

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
        Get valid access token, refreshing if needed.

        Returns:
            Valid access token or None
        """
        # Check if token is expired
        if self.access_token and self.expires_at:
            if time.time() >= self.expires_at - 300:  # 5 minutes buffer
                if self.refresh_token:
                    # Try to refresh
                    if self._refresh_token():
                        return self.access_token
                else:
                    # No refresh token, token is expired
                    self.access_token = None
                    raise TokenExpiredError(
                        "OAuth token has expired and cannot be refreshed"
                    )

        return self.access_token

    def refresh(self) -> bool:
        """
        Refresh OAuth tokens.

        Returns:
            True if refresh was successful
        """
        if self.refresh_token:
            return self._refresh_token()

        # For client credentials, just re-authenticate
        return False

    def _refresh_token(self) -> bool:
        """
        Refresh OAuth access token using refresh token.

        Returns:
            True if refresh was successful
        """
        if not self.refresh_token:
            return False

        try:
            # This should be called through the client
            # For now, return False to indicate refresh needed
            logger.info("OAuth token refresh required")
            return False
        except Exception as e:
            logger.error("OAuth token refresh failed", error=str(e))
            return False

    def is_authenticated(self) -> bool:
        """
        Check if authenticated with valid token.

        Returns:
            True if authenticated with valid token
        """
        if not self.access_token:
            return False

        # Check expiration
        if self.expires_at and time.time() >= self.expires_at - 300:
            return False

        return self._authenticated

    def set_authorization_code(self, code: str) -> None:
        """
        Set authorization code for authorization code flow.

        Args:
            code: Authorization code from OAuth provider
        """
        self._auth_code = code

    def get_authorization_url(self, state: Optional[str] = None) -> str:
        """
        Get authorization URL for authorization code flow.

        Args:
            state: Optional state parameter

        Returns:
            Authorization URL
        """
        params = {
            "response_type": "code",
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri,
            "scope": self.scope,
        }

        if state:
            params["state"] = state

        auth_url = "/oauth/authorize"  # This should be configured
        return f"{auth_url}?{urllib.parse.urlencode(params)}"
