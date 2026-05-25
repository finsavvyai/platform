"""
Re-export security utilities for backward compatibility.

Consumers import from udp.core.security; actual implementations
live in udp.security.auth and udp.security.rbac.
"""

from udp.security.auth import (
    AuthenticationError,
    TokenError,
    authenticate_user,
    create_access_token,
    get_current_active_user,
    get_current_superuser,
    get_current_user,
    verify_token,
)
from udp.security.rbac.decorators import require_permission

__all__ = [
    "get_current_user",
    "get_current_active_user",
    "get_current_superuser",
    "create_access_token",
    "verify_token",
    "authenticate_user",
    "require_permission",
    "AuthenticationError",
    "TokenError",
]
