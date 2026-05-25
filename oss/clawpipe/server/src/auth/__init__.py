"""FinSavvyAI Authentication Module

FastAPI auth integration with OAuth2 password flow and JWT tokens.
"""

from src.auth.dependencies import get_current_user, oauth2_scheme
from src.auth.models import RegisterRequest, TokenRequest, TokenResponse, User

__all__ = [
    "get_current_user",
    "oauth2_scheme",
    "RegisterRequest",
    "TokenRequest",
    "TokenResponse",
    "User",
]
