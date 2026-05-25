"""
UPM security components.

Provides authentication, authorization, and security utilities
for the Universal Dependency Platform.
"""

from .auth import (
    AuthenticationError,
    AuthService,
    SecurityUtils,
    TokenError,
    authenticate_user,
    create_access_token,
    get_current_active_user,
    get_current_superuser,
    get_current_user,
    verify_token,
)

__all__ = [
    # Authentication functions
    "get_current_user",
    "get_current_active_user",
    "get_current_superuser",
    "create_access_token",
    "verify_token",
    "authenticate_user",
    # Authentication classes
    "AuthService",
    "SecurityUtils",
    # Exceptions
    "AuthenticationError",
    "TokenError",
]
