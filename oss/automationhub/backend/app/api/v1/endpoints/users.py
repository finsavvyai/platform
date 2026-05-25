"""
User management endpoints
"""

from fastapi import APIRouter, HTTPException, Depends, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List, Optional
import logging
import uuid

from app.core.database import get_db
from app.core.auth import get_current_active_user, require_admin, require_read
from app.models.user import User
from app.schemas.auth import UserResponse, UserUpdate

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/", response_model=List[UserResponse])
async def get_users(
    skip: int = Query(0, ge=0, description="Number of users to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Number of users to return"),
    search: Optional[str] = Query(None, description="Search users by email or name"),
    current_user: User = Depends(require_read),
    db: AsyncSession = Depends(get_db)
):
    """Get all users (requires read permission)"""
    try:
        query = select(User)
        
        # Add search filter if provided
        if search:
            search_filter = f"%{search.lower()}%"
            query = query.where(
                (func.lower(User.email).like(search_filter)) |
                (func.lower(User.full_name).like(search_filter))
            )
        
        # If not admin, only show users from same organization
        if not current_user.is_superuser and current_user.organization_id:
            query = query.where(User.organization_id == current_user.organization_id)
        
        # Apply pagination
        query = query.offset(skip).limit(limit)
        
        result = await db.execute(query)
        users = result.scalars().all()
        
        return [
            UserResponse(
                id=str(user.id),
                email=user.email,
                full_name=user.full_name,
                is_active=user.is_active,
                subscription_tier=user.subscription_tier,
                is_verified=user.is_verified,
                organization_id=str(user.organization_id) if user.organization_id else None,
                created_at=user.created_at,
                last_login=user.last_login
            )
            for user in users
        ]
        
    except Exception as e:
        logger.error(f"Error getting users: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve users"
        )


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: str,
    current_user: User = Depends(require_read),
    db: AsyncSession = Depends(get_db)
):
    """Get user by ID (requires read permission)"""
    try:
        # Validate UUID format
        try:
            user_uuid = uuid.UUID(user_id)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid user ID format"
            )
        
        # Get user
        result = await db.execute(select(User).where(User.id == user_uuid))
        user = result.scalar_one_or_none()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Check permissions - users can view their own profile or admin can view any
        if not current_user.is_superuser and current_user.id != user.id:
            # Non-admin users can only view users from same organization
            if current_user.organization_id != user.organization_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not enough permissions"
                )
        
        return UserResponse(
            id=str(user.id),
            email=user.email,
            full_name=user.full_name,
            is_active=user.is_active,
            subscription_tier=user.subscription_tier,
            is_verified=user.is_verified,
            organization_id=str(user.organization_id) if user.organization_id else None,
            created_at=user.created_at,
            last_login=user.last_login
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting user {user_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve user"
        )


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str,
    user_update: UserUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Update user (users can update themselves, admins can update any user)"""
    try:
        # Validate UUID format
        try:
            user_uuid = uuid.UUID(user_id)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid user ID format"
            )
        
        # Get user to update
        result = await db.execute(select(User).where(User.id == user_uuid))
        user = result.scalar_one_or_none()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Check permissions
        if not current_user.is_superuser and current_user.id != user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions"
            )
        
        # Update user fields
        update_data = user_update.dict(exclude_unset=True)
        
        # Non-admin users cannot change certain fields
        if not current_user.is_superuser:
            restricted_fields = ["is_active", "subscription_tier"]
            for field in restricted_fields:
                if field in update_data:
                    del update_data[field]
        
        for field, value in update_data.items():
            setattr(user, field, value)
        
        await db.commit()
        await db.refresh(user)
        
        logger.info(f"User {user_id} updated by {current_user.email}")
        
        return UserResponse(
            id=str(user.id),
            email=user.email,
            full_name=user.full_name,
            is_active=user.is_active,
            subscription_tier=user.subscription_tier,
            is_verified=user.is_verified,
            organization_id=str(user.organization_id) if user.organization_id else None,
            created_at=user.created_at,
            last_login=user.last_login
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating user {user_id}: {e}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update user"
        )


@router.delete("/{user_id}")
async def delete_user(
    user_id: str,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Delete user (requires admin permission)"""
    try:
        # Validate UUID format
        try:
            user_uuid = uuid.UUID(user_id)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid user ID format"
            )
        
        # Prevent self-deletion
        if current_user.id == user_uuid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete your own account"
            )
        
        # Get user to delete
        result = await db.execute(select(User).where(User.id == user_uuid))
        user = result.scalar_one_or_none()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Soft delete by deactivating the user
        user.is_active = False
        await db.commit()
        
        logger.info(f"User {user_id} deactivated by {current_user.email}")
        
        return {"message": "User deactivated successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting user {user_id}: {e}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete user"
        )