"""
User service for UPM authentication and authorization.

Manages user accounts, authentication, and user-related operations.
"""

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError

from ..core.models.organization import OrganizationMember
from ..core.models.user import User, UserStatus
from ..core.services import (
    ConflictError,
    ServiceException,
    ValidationError,
)
from .base import BaseService


class UserService(BaseService):
    """
    Service for managing user accounts, authentication, and user operations.

    Provides CRUD operations for users, password management, and
    user authentication and authorization functionality.
    """

    model_class = User

    async def get_service_dependencies(self) -> dict:
        """Define service dependencies."""
        return {}  # UserService has no dependencies

    async def create_user(
        self,
        email: str,
        username: str,
        password: str,
        name: Optional[str] = None,
        created_by: Optional[uuid.UUID] = None,
    ) -> User:
        """Create a new user account."""
        # Validate user doesn't already exist
        if await self.user_exists(email=email):
            raise ConflictError(f"User with email {email} already exists")

        if await self.username_exists(username=username):
            raise ConflictError(f"Username {username} is already taken")

        # Create user data
        user_data = {
            "email": email,
            "username": username,
            "name": name,
            "status": UserStatus.PENDING.value,
            "created_by": created_by,
        }

        user = await self.create(user_data, created_by)
        user.set_password(password)

        # Log user creation
        self._log_operation(
            "create_user",
            {"user_id": str(user.id), "email": email, "username": username},
        )

        return user

    async def authenticate_user(self, email: str, password: str) -> User:
        """Authenticate user with email and password."""
        # Find user by email
        query = select(User).where(
            User.email == email, User.status == UserStatus.ACTIVE.value
        )
        result = await self._execute_query(query)
        user = result.scalar_one_or_none()

        if not user:
            raise ValidationError("Invalid email or password")

        # Check if account is locked
        if user.is_locked:
            # Check if lock has expired
            if user.account_locked_until:
                lock_until = datetime.fromisoformat(user.account_locked_until)
                if datetime.utcnow() < lock_until:
                    raise ValidationError(
                        "Account is temporarily locked. Please try again later."
                    )
                else:
                    # Lock expired, reset attempts
                    user.reset_failed_logins()
            else:
                raise ValidationError(
                    "Account is temporarily locked. Please contact support."
                )

        # Verify password
        if not user.check_password(password):
            # Record failed login attempt
            user.record_failed_login()

            # Check if this triggers account lock
            if user.is_locked:
                try:
                    await self.db_session.commit()
                except SQLAlchemyError:
                    await self.db_session.rollback()
                raise ValidationError(
                    "Too many failed login attempts. Account locked for 15 minutes."
                )

            raise ValidationError("Invalid email or password")

        # Reset failed login attempts on successful login
        user.reset_failed_logins()

        # Update last login timestamp
        user.last_login_at = datetime.utcnow().isoformat()

        try:
            await self.db_session.commit()
            await self.db_session.refresh(user)

            # Log successful authentication
            self._log_operation(
                "user_login", {"user_id": str(user.id), "email": user.email}
            )

            return user
        except SQLAlchemyError as e:
            await self.db_session.rollback()
            self.logger.error(f"Failed to update user login: {str(e)}")
            raise ServiceException(
                "Failed to update user login",
                error_code="LOGIN_UPDATE_ERROR",
                details={"original_error": str(e)},
            )

    async def get_user_by_id(self, user_id: str) -> User:
        """Get user by ID."""
        return await self.get_by_id(user_id)

    async def get_user_by_email(self, email: str) -> Optional[User]:
        """Get user by email address."""
        query = select(User).where(User.email == email)
        result = await self._execute_query(query)
        return result.scalar_one_or_none()

    async def get_user_by_username(self, username: str) -> Optional[User]:
        """Get user by username."""
        query = select(User).where(User.username == username)
        result = await self._execute_query(query)
        return result.scalar_one_or_none()

    async def update_user(
        self, user_id: str, update_data: dict, updated_by: Optional[uuid.UUID] = None
    ) -> User:
        """Update user information."""
        user = await self.get_by_id(user_id)

        # Don't allow email/username changes through this method
        # Use dedicated methods for those to ensure proper validation
        update_data.pop("email", None)
        update_data.pop("username", None)

        user = await self.update(user_id, update_data, updated_by)

        # Log user update
        self._log_operation(
            "update_user",
            {"user_id": user_id, "updated_fields": list(update_data.keys())},
        )

        return user

    async def change_password(
        self, user_id: str, current_password: str, new_password: str
    ) -> User:
        """Change user password with current password verification."""
        user = await self.get_by_id(user_id)

        # Verify current password
        if not user.check_password(current_password):
            raise ValidationError("Current password is incorrect")

        # Set new password
        user.set_password(new_password)
        user.updated_by = user_id  # User changing own password

        try:
            await self.db_session.commit()
            await self.db_session.refresh(user)

            # Log password change
            self._log_operation("change_password", {"user_id": user_id})

            return user
        except SQLAlchemyError as e:
            await self.db_session.rollback()
            self.logger.error(f"Failed to change password: {str(e)}")
            raise ServiceException(
                "Failed to change password",
                error_code="PASSWORD_CHANGE_ERROR",
                details={"original_error": str(e)},
            )

    async def reset_password(self, user_id: str) -> str:
        """Reset user password and return temporary password."""
        user = await self.get_by_id(user_id)

        # Generate temporary password
        import secrets
        import string

        temp_password = "".join(
            secrets.choice(string.ascii_letters + string.digits) for _ in range(12)
        )

        user.set_password(temp_password)
        user.updated_by = user_id

        # Clear failed login attempts
        user.reset_failed_logins()

        try:
            await self.db_session.commit()
            await self.db_session.refresh(user)

            # Log password reset
            self._log_operation("reset_password", {"user_id": user_id})

            return temp_password
        except SQLAlchemyError as e:
            await self.db_session.rollback()
            self.logger.error(f"Failed to reset password: {str(e)}")
            raise ServiceException(
                "Failed to reset password",
                error_code="PASSWORD_RESET_ERROR",
                details={"original_error": str(e)},
            )

    async def deactivate_user(self, user_id: str, deactivated_by: uuid.UUID) -> User:
        """Deactivate a user account."""
        user = await self.get_by_id(user_id)

        user.status = UserStatus.INACTIVE.value
        user.updated_by = deactivated_by

        try:
            await self.db_session.commit()
            await self.db_session.refresh(user)

            # Log user deactivation
            self._log_operation(
                "deactivate_user",
                {"user_id": user_id, "deactivated_by": str(deactivated_by)},
            )

            return user
        except SQLAlchemyError as e:
            await self.db_session.rollback()
            self.logger.error(f"Failed to deactivate user: {str(e)}")
            raise ServiceException(
                "Failed to deactivate user",
                error_code="USER_DEACTIVATION_ERROR",
                details={"original_error": str(e)},
            )

    async def activate_user(self, user_id: str, activated_by: uuid.UUID) -> User:
        """Activate a user account."""
        user = await self.get_by_id(user_id)

        user.status = UserStatus.ACTIVE.value
        user.updated_by = activated_by

        try:
            await self.db_session.commit()
            await self.db_session.refresh(user)

            # Log user activation
            self._log_operation(
                "activate_user", {"user_id": user_id, "activated_by": str(activated_by)}
            )

            return user
        except SQLAlchemyError as e:
            await self.db_session.rollback()
            self.logger.error(f"Failed to activate user: {str(e)}")
            raise ServiceException(
                "Failed to activate user",
                error_code="USER_ACTIVATION_ERROR",
                details={"original_error": str(e)},
            )

    async def verify_user_email(self, user_id: str) -> User:
        """Mark user email as verified."""
        user = await self.get_by_id(user_id)

        user.is_verified = True
        user.updated_by = user_id

        try:
            await self.db_session.commit()
            await self.db_session.refresh(user)

            # Log email verification
            self._log_operation("verify_email", {"user_id": user_id})

            return user
        except SQLAlchemyError as e:
            await self.db_session.rollback()
            self.logger.error(f"Failed to verify email: {str(e)}")
            raise ServiceException(
                "Failed to verify email",
                error_code="EMAIL_VERIFICATION_ERROR",
                details={"original_error": str(e)},
            )

    async def list_users(
        self,
        limit: int = 100,
        offset: int = 0,
        status: Optional[str] = None,
        search: Optional[str] = None,
    ) -> list[User]:
        """List users with optional filtering and search."""
        filters = {}

        if status:
            filters["status"] = status

        if search:
            # Add search for email and username
            filters["search_term"] = f"%{search}%"

        users = await self.list_all(limit=limit, offset=offset, filters=filters)
        return users

    async def get_user_organizations(self, user_id: str) -> list[OrganizationMember]:
        """Get all organization memberships for a user."""
        from ..core.models.organization import OrganizationMember

        query = select(OrganizationMember).where(
            OrganizationMember.user_id == user_id, OrganizationMember.is_active == True
        )
        result = await self._execute_query(query)
        return result.scalars().all()

    async def user_exists(
        self, email: str, exclude_user_id: Optional[str] = None
    ) -> bool:
        """Check if user with email already exists."""
        query = select(User).where(User.email == email)

        if exclude_user_id:
            try:
                exclude_uuid = uuid.UUID(exclude_user_id)
                query = query.where(User.id != exclude_uuid)
            except ValueError:
                # Invalid UUID format, exclude by string comparison
                query = query.where(User.id != exclude_user_id)

        result = await self._execute_query(query)
        return result.scalar_one_or_none() is not None

    async def username_exists(
        self, username: str, exclude_user_id: Optional[str] = None
    ) -> bool:
        """Check if username already exists."""
        query = select(User).where(User.username == username)

        if exclude_user_id:
            try:
                exclude_uuid = uuid.UUID(exclude_user_id)
                query = query.where(User.id != exclude_uuid)
            except ValueError:
                # Invalid UUID format, exclude by string comparison
                query = query.where(User.id != exclude_user_id)

        result = await self._execute_query(query)
        return result.scalar_one_or_none() is not None

    async def get_active_users_count(
        self, organization_id: Optional[str] = None
    ) -> int:
        """Get count of active users."""
        from sqlalchemy import func

        query = select(func.count(User.id)).where(
            User.status == UserStatus.ACTIVE.value
        )

        result = await self._execute_query(query)
        return result.scalar()

    async def unlock_user_account(self, user_id: str) -> User:
        """Unlock a user account."""
        user = await self.get_by_id(user_id)

        user.reset_failed_logins()

        try:
            await self.db_session.commit()
            await self.db_session.refresh(user)

            # Log account unlock
            self._log_operation("unlock_account", {"user_id": user_id})

            return user
        except SQLAlchemyError as e:
            await self.db_session.rollback()
            self.logger.error(f"Failed to unlock account: {str(e)}")
            raise ServiceException(
                "Failed to unlock account",
                error_code="ACCOUNT_UNLOCK_ERROR",
                details={"original_error": str(e)},
            )

    async def check_password_change_requirement(self, user_id: str) -> bool:
        """Check if user needs to change password."""
        user = await self.get_by_id(user_id)
        return user.requires_password_change
