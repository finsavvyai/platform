"""Authentication routes: login and registration."""

import logging
import secrets
from typing import Annotated

import bcrypt
from fastapi import APIRouter, Depends, HTTPException, status

from src.auth.dependencies import encode_token, get_current_user
from src.auth.models import RegisterRequest, TokenRequest, TokenResponse, User
from src.auth.store import get_user_by_email, get_user_by_login, get_user_by_username, save_user

logger = logging.getLogger("finsavvyai.auth")

router = APIRouter(prefix="/auth", tags=["auth"])


def hash_password(password: str) -> str:
    """Hash password using bcrypt."""
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=12)).decode()


def verify_password(password: str, hashed: str) -> bool:
    """Verify password against bcrypt hash."""
    return bcrypt.checkpw(password.encode(), hashed.encode())


@router.post("/token", response_model=TokenResponse)
async def login(request: TokenRequest) -> TokenResponse:
    """OAuth2 password flow endpoint.

    POST /auth/token
    Returns JWT access token if credentials are valid.
    """
    user = get_user_by_login(request.username)
    if not user or not verify_password(request.password, user["password_hash"]):
        logger.warning("Failed login attempt for username: %s", request.username)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    token = encode_token(user["id"], user["username"])
    logger.info("User %s logged in successfully", user["username"])
    return TokenResponse(access_token=token, token_type="bearer", expires_in=3600)


@router.post("/register", response_model=TokenResponse)
async def register(request: RegisterRequest) -> TokenResponse:
    """Register a new user account.

    POST /auth/register
    Returns JWT access token for newly created user.
    """
    if get_user_by_username(request.username):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Username {request.username} already exists",
        )

    if get_user_by_email(request.email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Email {request.email} already registered",
        )

    user_id = f"user_{secrets.token_hex(6)}"
    user = {
        "id": user_id,
        "username": request.username,
        "email": request.email,
        "full_name": request.full_name,
        "password_hash": hash_password(request.password),
        "is_active": True,
    }
    save_user(user)

    token = encode_token(user_id, request.username)
    logger.info("New user registered: %s", request.username)
    return TokenResponse(access_token=token, token_type="bearer", expires_in=3600)


@router.get("/me", response_model=User)
async def get_me(current_user: Annotated[User, Depends(get_current_user)]) -> User:
    """Get current user profile from token.

    GET /auth/me
    Requires valid Bearer token in Authorization header.
    """
    return current_user
