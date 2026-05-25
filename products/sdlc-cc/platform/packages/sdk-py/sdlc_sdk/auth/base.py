"""
Base authentication class for SDLC.ai SDK

Provides the interface that all authentication methods must implement.
"""

from abc import ABC, abstractmethod
from typing import Any, Optional

import structlog

from ..utils.token import TokenManager

logger = structlog.get_logger("sdlc_sdk.auth")


class BaseAuth(ABC):
    """
    Abstract base class for authentication methods.

    All authentication implementations must inherit from this class
    and implement the required methods.
    """

    def __init__(self):
        self.token_manager = TokenManager()
        self._authenticated = False
        self._auth_data: Optional[dict[str, Any]] = None

    @abstractmethod
    async def authenticate(self, client) -> tuple[bool, Optional[dict[str, Any]]]:
        """
        Perform authentication with the API.

        Args:
            client: The client instance

        Returns:
            Tuple of (success, auth_data)
        """
        pass

    @abstractmethod
    def get_headers(self) -> dict[str, str]:
        """
        Get authentication headers for API requests.

        Returns:
            Dictionary of headers
        """
        pass

    @abstractmethod
    def refresh(self) -> bool:
        """
        Refresh authentication tokens.

        Returns:
            True if refresh was successful
        """
        pass

    @abstractmethod
    def is_authenticated(self) -> bool:
        """
        Check if currently authenticated.

        Returns:
            True if authenticated
        """
        pass

    def invalidate(self) -> None:
        """Invalidate current authentication."""
        self._authenticated = False
        self._auth_data = None
        self.token_manager.set_token(None)

    def get_token(self) -> Optional[str]:
        """Get current authentication token."""
        return self.token_manager.get_token()

    def get_user_id(self) -> Optional[str]:
        """Get authenticated user ID."""
        return self.token_manager.get_user_id()

    def get_tenant_id(self) -> Optional[str]:
        """Get authenticated tenant ID."""
        return self.token_manager.get_tenant_id()

    def get_permissions(self) -> list:
        """Get user permissions."""
        return self.token_manager.get_permissions()

    def has_permission(self, permission: str) -> bool:
        """Check if user has specific permission."""
        return self.token_manager.has_permission(permission)
