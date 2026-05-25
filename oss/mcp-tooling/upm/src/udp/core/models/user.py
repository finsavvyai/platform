"""
User model for Universal Dependency Platform.
"""

import enum
from datetime import datetime
from typing import TYPE_CHECKING, Optional
from uuid import UUID


class UserStatus(str, enum.Enum):
    """User account status."""

    ACTIVE = "active"
    INACTIVE = "inactive"
    PENDING = "pending"
    SUSPENDED = "suspended"


from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID as PostgreSQLUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from .base import Base

if TYPE_CHECKING:
    from .organization import OrganizationMember
    from .rbac import ResourcePermission, Role, UserRoleAssignment


class User(Base):
    """User model with RBAC support."""

    __tablename__ = "users"

    # Primary key
    id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        primary_key=True,
        index=True,
    )

    # User information
    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        index=True,
        nullable=False,
    )

    hashed_password: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    full_name: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
    )

    # User status
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )

    is_superuser: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    # Legacy role field (deprecated, use RBAC instead)
    role: Mapped[str] = mapped_column(
        String(50),
        default="user",
        nullable=False,
        comment="Legacy role field - use RBAC system instead",
    )

    # User preferences
    preferences: Mapped[Optional[dict]] = mapped_column(
        JSON,
        default=dict,
        comment="User preferences and settings",
    )

    # Authentication tracking
    last_login: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    email_verified: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    email_verified_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Security settings
    mfa_enabled: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    mfa_secret: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
    )

    # Account locking
    failed_login_attempts: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )

    locked_until: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Password management
    password_changed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    password_reset_token: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
    )

    password_reset_expires: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Profile information
    avatar_url: Mapped[Optional[str]] = mapped_column(
        String(500),
        nullable=True,
    )

    bio: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )

    timezone: Mapped[str] = mapped_column(
        String(50),
        default="UTC",
        nullable=False,
    )

    locale: Mapped[str] = mapped_column(
        String(10),
        default="en-US",
        nullable=False,
    )

    # Audit fields
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    created_by: Mapped[Optional[UUID]] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Relationships
    role_assignments: Mapped[list["UserRoleAssignment"]] = relationship(
        "UserRoleAssignment",
        back_populates="user",
        cascade="all, delete-orphan",
    )

    resource_permissions: Mapped[list["ResourcePermission"]] = relationship(
        "ResourcePermission",
        back_populates="user",
        cascade="all, delete-orphan",
    )

    created_users: Mapped[list["User"]] = relationship(
        "User",
        remote_side=[id],
        backref="created_by_user",
    )

    # Organization memberships
    organization_memberships: Mapped[list["OrganizationMember"]] = relationship(
        "OrganizationMember",
        back_populates="user",
        cascade="all, delete-orphan",
    )

    # Other relationships will be added as models are implemented
    # dependencies = relationship("Dependency", back_populates="created_by_user")
    # workflows = relationship("Workflow", back_populates="created_by_user")
    # workflow_executions = relationship("WorkflowExecution", back_populates="started_by_user")

    def __repr__(self) -> str:
        return f"<User(email='{self.email}', is_active={self.is_active})>"

    def has_permission(self, permission_code: str) -> bool:
        """
        Check if user has a specific permission.

        This is a convenience method that should be used carefully.
        For production code, use the RBACService.check_permission method
        which provides proper caching and performance optimization.
        """
        # For now, just check superuser status
        # The actual implementation will be in the RBAC service
        return self.is_superuser

    def get_roles(
        self, organization_id: Optional[UUID] = None, project_id: Optional[UUID] = None
    ) -> list["Role"]:
        """
        Get user roles for a specific scope.

        This is a convenience method. For production code, use the RBAC service.
        """
        roles = []
        for assignment in self.role_assignments:
            if not assignment.is_active:
                continue

            # Check if assignment has expired
            if assignment.expires_at and assignment.expires_at < datetime.utcnow():
                continue

            # Check scope matching
            if project_id and assignment.project_id == project_id:
                roles.append(assignment.role)
            elif organization_id and assignment.organization_id == organization_id:
                roles.append(assignment.role)
            elif (
                not project_id
                and not organization_id
                and not assignment.organization_id
            ):
                # System-wide role
                roles.append(assignment.role)

        return roles
