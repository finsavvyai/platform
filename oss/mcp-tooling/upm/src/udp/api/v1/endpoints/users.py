"""
User management endpoints for Universal Dependency Platform.
"""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from udp.core.schemas.auth import UserResponse, UserUpdate
from udp.infrastructure.database import get_async_session
from udp.security.auth import get_current_active_user
from udp.services.user_service import UserService

router = APIRouter()


@router.get("/", response_model=list[UserResponse])
async def list_users(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_async_session),
    current_user=Depends(get_current_active_user),
) -> Any:
    """List users (admin only)."""
    # TODO: Add admin role check
    user_service = UserService(db)

    users = await user_service.list(skip=skip, limit=limit)
    return users


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: str,
    db: AsyncSession = Depends(get_async_session),
    current_user=Depends(get_current_active_user),
) -> Any:
    """Get user by ID."""
    user_service = UserService(db)

    user = await user_service.get(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return user


@router.put("/me", response_model=UserResponse)
async def update_current_user(
    user_data: UserUpdate,
    db: AsyncSession = Depends(get_async_session),
    current_user=Depends(get_current_active_user),
) -> Any:
    """Update current user profile."""
    user_service = UserService(db)

    user = await user_service.update(current_user.id, user_data)
    return user
