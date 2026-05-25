"""
Authentication endpoints for Universal Dependency Platform.
"""

from datetime import timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from udp.core.config import settings
from udp.core.schemas.auth import Token, UserCreate, UserResponse
from udp.infrastructure.database import get_async_session
from udp.security.auth import authenticate_user, create_access_token, get_current_user
from udp.services.user_service import UserService

router = APIRouter()


@router.post("/login", response_model=Token)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_async_session),
) -> Any:
    """Authenticate user and return access token."""
    user = await authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    }


@router.post("/register", response_model=UserResponse)
async def register(
    user_data: UserCreate, db: AsyncSession = Depends(get_async_session)
) -> Any:
    """Register a new user."""
    user_service = UserService(db)

    # Check if user already exists
    existing_user = await user_service.get_by_email(user_data.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered"
        )

    user = await user_service.create(user_data)
    return user


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user=Depends(get_current_user)) -> Any:
    """Get current user information."""
    return current_user


@router.post("/refresh", response_model=Token)
async def refresh_token(current_user=Depends(get_current_user)) -> Any:
    """Refresh access token."""
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": current_user.email}, expires_delta=access_token_expires
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    }
