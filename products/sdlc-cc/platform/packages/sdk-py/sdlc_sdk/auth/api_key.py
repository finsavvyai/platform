"""
API Key authentication for SDLC.ai SDK

Implements authentication using API keys.
"""

from typing import Any, Optional

import structlog

from ..exceptions import AuthenticationError
from ..models.auth import AuthResponse
from .base import BaseAuth

logger = structlog.get_logger("sdlc_sdk.auth.api_key")


class APIKeyAuth(BaseAuth):
    """
    Authentication using API key.

    This is the simplest authentication method where an API key
    is sent in the Authorization header.
    """

    def __init__(self, api_key: str, header_name: str = "X-API-Key"):
        """
        Initialize API key authentication.

        Args:
            api_key: The API key
            header_name: Header name for the key (default: X-API-Key)
        """
        super().__init__()
        self.api_key = api_key
        self.header_name = header_name

    async def authenticate(self, client) -> tuple[bool, Optional[dict[str, Any]]]:
        """
        Authenticate with API key.

        For API key auth, this is a simple validation call.

        Args:
            client: The client instance

        Returns:
            Tuple of (success, auth_data)
        """
        try:
            # Make a validation request to check if API key is valid
            response = await client._request(
                method="GET", endpoint="/auth/validate", headers=self.get_headers()
            )

            if response.status_code == 200:
                data = response.json()
                auth_response = AuthResponse(**data)

                self._authenticated = True
                self._auth_data = data

                # Store token if provided
                if auth_response.token:
                    self.token_manager.set_token(auth_response.token)

                logger.info("API key authentication successful")
                return True, data
            else:
                logger.error(
                    "API key validation failed", status_code=response.status_code
                )
                return False, None

        except Exception as e:
            logger.error("API key authentication error", error=str(e))
            raise AuthenticationError(
                message=f"API key authentication failed: {str(e)}",
                code="API_KEY_AUTH_FAILED",
            )

    def get_headers(self) -> dict[str, str]:
        """
        Get authentication headers.

        Returns:
            Dictionary with API key header
        """
        headers = {}

        # Check if we have a JWT token to use instead
        if self.token_manager.get_token():
            headers["Authorization"] = f"Bearer {self.token_manager.get_token()}"
        else:
            # Use API key
            headers[self.header_name] = self.api_key

        return headers

    def refresh(self) -> bool:
        """
        Refresh authentication.

        For API key auth, refresh is not needed but we can
        validate the key is still valid.

        Returns:
            Always True for API key auth
        """
        # API keys don't expire, so refresh is not needed
        return True

    def is_authenticated(self) -> bool:
        """
        Check if authenticated.

        Returns:
            True if API key is set
        """
        return self._authenticated or bool(self.api_key)
