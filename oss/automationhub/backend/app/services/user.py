"""
User service for business logic
"""

from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime
import uuid
import logging

from app.models.user import User
from app.schemas.auth import UserCreate, UserUpdate
from app.core.security import get_password_hash, verify_password
from app.core.logging import LoggerMixin

logger = logging.getLogger(__name__)


class UserService(LoggerMixin):
    """User service for managing user operations"""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def create(self, user_data: UserCreate) -> User:
        """Create a new user"""
        # Validate password confirmation
        if user_data.password != user_data.confirm_password:
            raise ValueError("Passwords do not match")
        
        # Hash password
        hashed_password = get_password_hash(user_data.password)
        
        # Create user
        user = User(
            email=user_data.email,
            full_name=user_data.full_name,
            hashed_password=hashed_password,
            is_active=user_data.is_active
        )
        
        self.db.add(user)
        await self.db.commit()
        await self.db.refresh(user)
        
        self.log_event("User created", user_id=str(user.id), email=user.email)
        return user
    
    async def get(self, user_id: str) -> Optional[User]:
        """Get user by ID"""
        try:
            user_uuid = uuid.UUID(user_id)
            result = await self.db.execute(
                select(User).where(User.id == user_uuid)
            )
            return result.scalar_one_or_none()
        except (ValueError, TypeError):
            return None
    
    async def get_by_email(self, email: str) -> Optional[User]:
        """Get user by email"""
        result = await self.db.execute(
            select(User).where(User.email == email)
        )
        return result.scalar_one_or_none()
    
    async def get_multi(self, skip: int = 0, limit: int = 100) -> List[User]:
        """Get multiple users"""
        result = await self.db.execute(
            select(User).offset(skip).limit(limit)
        )
        return result.scalars().all()
    
    async def update(self, user_id: str, user_data: UserUpdate) -> Optional[User]:
        """Update user"""
        user = await self.get(user_id)
        if not user:
            return None
        
        update_data = user_data.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(user, field, value)
        
        await self.db.commit()
        await self.db.refresh(user)
        
        self.log_event("User updated", user_id=str(user.id), fields=list(update_data.keys()))
        return user
    
    async def delete(self, user_id: str) -> bool:
        """Delete user"""
        user = await self.get(user_id)
        if not user:
            return False
        
        await self.db.delete(user)
        await self.db.commit()
        
        self.log_event("User deleted", user_id=user_id)
        return True
    
    async def authenticate(self, email: str, password: str) -> Optional[User]:
        """Authenticate user with email and password"""
        user = await self.get_by_email(email)
        if not user:
            return None
        
        if not verify_password(password, user.hashed_password):
            return None
        
        return user
    
    async def update_last_login(self, user_id: str) -> None:
        """Update user's last login timestamp"""
        user = await self.get(user_id)
        if user:
            user.last_login = datetime.utcnow()
            await self.db.commit()
    
    async def is_active(self, user_id: str) -> bool:
        """Check if user is active"""
        user = await self.get(user_id)
        return user.is_active if user else False
    
    async def is_superuser(self, user_id: str) -> bool:
        """Check if user is superuser"""
        user = await self.get(user_id)
        return user.is_superuser if user else False