"""
User service for Universal Dependency Platform.
"""

from datetime import UTC
from typing import Optional

from sqlalchemy import or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from udp.core.models.user import User
from udp.core.schemas.auth import UserCreate, UserUpdate


class UserService:
    """User service class."""

    def __init__(self, db: AsyncSession):
        """Initialize user service."""
        self.db = db

    async def create(self, user_data: UserCreate) -> User:
        """Create a new user."""
        from udp.security.auth import get_password_hash

        hashed_password = get_password_hash(user_data.password)

        db_user = User(
            email=user_data.email,
            hashed_password=hashed_password,
            full_name=user_data.full_name,
            is_active=user_data.is_active,
            is_superuser=user_data.is_superuser,
        )

        self.db.add(db_user)
        await self.db.commit()
        await self.db.refresh(db_user)

        return db_user

    async def get(self, user_id: str) -> Optional[User]:
        """Get user by ID."""
        from uuid import UUID

        try:
            user_uuid = UUID(user_id)
        except ValueError:
            return None

        result = await self.db.execute(select(User).where(User.id == user_uuid))
        return result.scalar_one_or_none()

    async def get_by_email(self, email: str) -> Optional[User]:
        """Get user by email."""
        result = await self.db.execute(select(User).where(User.email == email))
        return result.scalar_one_or_none()

    async def list(
        self, skip: int = 0, limit: int = 100, search: Optional[str] = None
    ) -> list[User]:
        """List users with pagination and search."""
        query = select(User)

        if search:
            query = query.where(
                or_(
                    User.email.ilike(f"%{search}%"), User.full_name.ilike(f"%{search}%")
                )
            )

        query = query.offset(skip).limit(limit).order_by(User.created_at.desc())

        result = await self.db.execute(query)
        return result.scalars().all()

    async def update(self, user_id: str, user_data: UserUpdate) -> Optional[User]:
        """Update user."""
        db_user = await self.get(user_id)
        if not db_user:
            return None

        update_data = user_data.dict(exclude_unset=True)

        if "password" in update_data:
            from udp.security.auth import get_password_hash

            update_data["hashed_password"] = get_password_hash(
                update_data.pop("password")
            )

        for field, value in update_data.items():
            setattr(db_user, field, value)

        await self.db.commit()
        await self.db.refresh(db_user)

        return db_user

    async def delete(self, user_id: str) -> bool:
        """Delete user."""
        db_user = await self.get(user_id)
        if not db_user:
            return False

        await self.db.delete(db_user)
        await self.db.commit()

        return True

    async def authenticate(self, email: str, password: str) -> Optional[User]:
        """Authenticate user."""
        from udp.security.auth import verify_password

        user = await self.get_by_email(email)
        if not user:
            return None

        if not verify_password(password, user.hashed_password):
            return None

        return user

    async def update_last_login(self, user_id: str) -> None:
        """Update user's last login timestamp."""
        from datetime import datetime

        db_user = await self.get(user_id)
        if db_user:
            db_user.last_login = datetime.now(UTC)
            await self.db.commit()
