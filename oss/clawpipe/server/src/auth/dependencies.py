"""FastAPI dependency injection for authentication."""

from datetime import datetime, timedelta, timezone
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from src.api.settings import get_settings
from src.auth.models import User
from src.auth.store import get_user_by_id

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token", auto_error=False)


def _jwt_secret() -> str:
    settings = get_settings()
    if settings.jwt_secret:
        return settings.jwt_secret
    raise RuntimeError("JWT secret is not configured")


def decode_token(token: str) -> dict:
    """Decode and validate JWT token."""
    settings = get_settings()
    try:
        payload = jwt.decode(token, _jwt_secret(), algorithms=[settings.jwt_algorithm])
        return payload
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )


def encode_token(
    user_id: str,
    username: str,
    expires_delta: timedelta | None = None,
) -> str:
    """Create JWT token for user."""
    settings = get_settings()
    if expires_delta is None:
        expires_delta = timedelta(minutes=settings.jwt_expiry_minutes)

    expire = datetime.now(timezone.utc) + expires_delta
    payload = {"sub": user_id, "username": username, "exp": expire}
    token = jwt.encode(payload, _jwt_secret(), algorithm=settings.jwt_algorithm)
    return token


async def get_current_user(token: Annotated[str | None, Depends(oauth2_scheme)]) -> User:
    """Extract current user from JWT token in Authorization header."""
    settings = get_settings()
    if not settings.auth_enabled:
        return User(
            id="anonymous",
            username="anonymous",
            email="anonymous@localhost",
            is_active=True,
        )
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    payload = decode_token(token)
    user_id: str = payload.get("sub")
    username: str = payload.get("username")

    if user_id is None or username is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    user = get_user_by_id(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found for token",
        )

    return User(
        id=user["id"],
        username=user["username"],
        email=user["email"],
        full_name=user.get("full_name"),
        is_active=user.get("is_active", True),
    )
