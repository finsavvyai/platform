"""
Role-Based Access Control (RBAC) models for Universal Dependency Platform.

This module defines the database models for implementing enterprise-grade
role-based access control with fine-grained permissions and resource-level
access control.
"""

from datetime import datetime
from enum import Enum
from typing import TYPE_CHECKING, List, Optional
from uuid import UUID, uuid4

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Table,
    Text,
    UniqueConstraint,
)
from sqlalchemy import (
    Enum as SQLEnum,
)
from sqlalchemy.dialects.postgresql import UUID as PostgreSQLUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from .base import Base

if TYPE_CHECKING:
    from .organization import Organization
    from .project import Project
    from .user import User


class PermissionScope(str, Enum):
    """Scope levels for permissions."""

    SYSTEM = "system"  # System-wide permissions
    ORGANIZATION = "organization"  # Organization-level permissions
    PROJECT = "project"  # Project-level permissions
    RESOURCE = "resource"  # Specific resource permissions


class ResourceType(str, Enum):
    """Types of resources that can be protected."""

    # System resources
    SYSTEM = "system"
    USER = "user"
    ROLE = "role"
    POLICY = "policy"

    # Organization resources
    ORGANIZATION = "organization"
    ORG_MEMBER = "org_member"

    # Project resources
    PROJECT = "project"
    DEPENDENCY = "dependency"
    VULNERABILITY = "vulnerability"
    ANALYSIS = "analysis"
    BUILD = "build"
    REPOSITORY = "repository"

    # Configuration resources
    CONFIGURATION = "configuration"
    INTEGRATION = "integration"


class Permission(Base):
    """
    Represents a specific permission that can be granted to roles or users.

    Permissions define what actions can be performed on what types of resources.
    """

    __tablename__ = "permissions"

    id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
        index=True,
    )

    # Permission identification
    name: Mapped[str] = mapped_column(
        String(100),
        unique=True,
        nullable=False,
        comment="Unique permission name (e.g., 'project.create', 'vulnerability.view')",
    )

    code: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        nullable=False,
        comment="Short permission code (e.g., 'project_create')",
    )

    description: Mapped[Optional[str]] = mapped_column(
        Text, comment="Detailed description of what this permission allows"
    )

    # Permission scope and resource
    scope: Mapped[PermissionScope] = mapped_column(
        SQLEnum(PermissionScope),
        nullable=False,
        comment="Scope level of this permission",
    )

    resource_type: Mapped[ResourceType] = mapped_column(
        SQLEnum(ResourceType),
        nullable=False,
        comment="Type of resource this permission applies to",
    )

    action: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        comment="Action that can be performed (e.g., 'create', 'read', 'update', 'delete')",
    )

    # Permission properties
    is_system: Mapped[bool] = mapped_column(
        Boolean, default=False, comment="Whether this is a system-level permission"
    )

    is_sensitive: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        comment="Whether this permission grants access to sensitive operations",
    )

    # Metadata
    category: Mapped[Optional[str]] = mapped_column(
        String(50),
        comment="Category for grouping permissions (e.g., 'security', 'admin')",
    )

    extra_metadata: Mapped[Optional[dict]] = mapped_column(
        "metadata",
        JSON,
        default=dict,
        comment="Additional metadata about the permission",
    )

    # Timestamps
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

    # Relationships
    roles: Mapped[List["Role"]] = relationship(
        secondary="role_permissions",
        back_populates="permissions",
    )

    # Indexes
    __table_args__ = (
        Index("idx_permissions_scope", "scope"),
        Index("idx_permissions_resource_type", "resource_type"),
        Index("idx_permissions_action", "action"),
        Index("idx_permissions_category", "category"),
    )

    def __repr__(self) -> str:
        return f"<Permission(name='{self.name}', scope='{self.scope}')>"


class Role(Base):
    """
    Represents a role that can be assigned to users.

    Roles are collections of permissions that define what users assigned
    to the role can do.
    """

    __tablename__ = "roles"

    id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
        index=True,
    )

    # Role identification
    name: Mapped[str] = mapped_column(
        String(100), nullable=False, comment="Human-readable role name"
    )

    code: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        comment="Short role code (e.g., 'admin', 'developer')",
    )

    description: Mapped[Optional[str]] = mapped_column(
        Text, comment="Detailed description of the role"
    )

    # Role properties
    is_system: Mapped[bool] = mapped_column(
        Boolean, default=False, comment="Whether this is a system-defined role"
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, comment="Whether this role is currently active"
    )

    is_privileged: Mapped[bool] = mapped_column(
        Boolean, default=False, comment="Whether this role has elevated privileges"
    )

    # Role hierarchy
    level: Mapped[int] = mapped_column(
        Integer,
        default=0,
        comment="Role level for hierarchy (higher = more privileged)",
    )

    parent_role_id: Mapped[Optional[UUID]] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        ForeignKey("roles.id", ondelete="SET NULL"),
        comment="Parent role for inheritance",
    )

    # Organization context
    organization_id: Mapped[Optional[UUID]] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        comment="Organization this role belongs to (null for system roles)",
    )

    # Metadata
    extra_metadata: Mapped[Optional[dict]] = mapped_column(
        "metadata", JSON, default=dict, comment="Additional role metadata"
    )

    # Timestamps
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

    # Relationships
    permissions: Mapped[List[Permission]] = relationship(
        secondary="role_permissions",
        back_populates="roles",
    )

    user_assignments: Mapped[List["UserRoleAssignment"]] = relationship(
        back_populates="role",
        cascade="all, delete-orphan",
    )

    parent_role: Mapped[Optional["Role"]] = relationship(
        "Role",
        remote_side=[id],
        backref="child_roles",
    )

    organization: Mapped[Optional["Organization"]] = relationship(
        "Organization",
        backref="custom_roles",
    )

    # Constraints
    __table_args__ = (
        UniqueConstraint("organization_id", "code", name="uq_roles_org_code"),
        Index("idx_roles_active", "is_active"),
        Index("idx_roles_system", "is_system"),
        Index("idx_roles_level", "level"),
        Index("idx_roles_organization", "organization_id"),
    )

    def __repr__(self) -> str:
        return f"<Role(name='{self.name}', is_system={self.is_system})>"


class UserRoleAssignment(Base):
    """
    Represents the assignment of a role to a user.

    This model supports scoped role assignments where a user might have
    different roles in different organizations or projects.
    """

    __tablename__ = "user_role_assignments"

    id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
        index=True,
    )

    # Assignment relationships
    user_id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    role_id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        ForeignKey("roles.id", ondelete="CASCADE"),
        nullable=False,
    )

    # Assignment scope
    organization_id: Mapped[Optional[UUID]] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        comment="Organization where this role applies (null for system-wide)",
    )

    project_id: Mapped[Optional[UUID]] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        comment="Project where this role applies (null for organization-wide)",
    )

    # Assignment properties
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, comment="Whether this assignment is currently active"
    )

    expires_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), comment="When this role assignment expires"
    )

    # Assignment tracking
    assigned_by: Mapped[Optional[UUID]] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        comment="User who made this assignment",
    )

    assigned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    reason: Mapped[Optional[str]] = mapped_column(
        Text, comment="Reason for this role assignment"
    )

    # Metadata
    extra_metadata: Mapped[Optional[dict]] = mapped_column(
        "metadata", JSON, default=dict, comment="Additional assignment metadata"
    )

    # Relationships
    user: Mapped["User"] = relationship(
        "User",
        foreign_keys=[user_id],
        back_populates="role_assignments",
    )

    role: Mapped[Role] = relationship(
        "Role",
        back_populates="user_assignments",
    )

    organization: Mapped[Optional["Organization"]] = relationship(
        "Organization",
        foreign_keys=[organization_id],
    )

    project: Mapped[Optional["Project"]] = relationship(
        "Project",
        foreign_keys=[project_id],
    )

    assigned_by_user: Mapped[Optional["User"]] = relationship(
        "User",
        foreign_keys=[assigned_by],
    )

    # Constraints
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "role_id",
            "organization_id",
            "project_id",
            name="uq_user_role_assignment",
        ),
        Index("idx_user_role_assignments_user", "user_id"),
        Index("idx_user_role_assignments_role", "role_id"),
        Index("idx_user_role_assignments_active", "is_active"),
        Index("idx_user_role_assignments_org", "organization_id"),
        Index("idx_user_role_assignments_project", "project_id"),
        Index("idx_user_role_assignments_expires", "expires_at"),
    )

    def __repr__(self) -> str:
        return (
            f"<UserRoleAssignment(user_id='{self.user_id}', "
            f"role_id='{self.role_id}', scope='{self.get_scope()}')>"
        )

    def get_scope(self) -> str:
        """Get a string representation of the assignment scope."""
        if self.project_id:
            return f"project:{self.project_id}"
        elif self.organization_id:
            return f"organization:{self.organization_id}"
        else:
            return "system"


class ResourcePermission(Base):
    """
    Direct permission assignment to a user for a specific resource.

    This allows for fine-grained, resource-specific permissions that
    override or supplement role-based permissions.
    """

    __tablename__ = "resource_permissions"

    id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
        index=True,
    )

    # Permission relationships
    user_id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    permission_id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        ForeignKey("permissions.id", ondelete="CASCADE"),
        nullable=False,
    )

    # Resource identification
    resource_type: Mapped[ResourceType] = mapped_column(
        SQLEnum(ResourceType), nullable=False, comment="Type of resource"
    )

    resource_id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        nullable=False,
        comment="ID of the specific resource",
    )

    # Permission type
    is_granted: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        comment="Whether permission is granted (true) or denied (false)",
    )

    # Permission scope
    organization_id: Mapped[Optional[UUID]] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        comment="Organization context for this permission",
    )

    # Permission tracking
    granted_by: Mapped[Optional[UUID]] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        comment="User who granted this permission",
    )

    granted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    expires_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), comment="When this permission expires"
    )

    # Metadata
    reason: Mapped[Optional[str]] = mapped_column(
        Text, comment="Reason for this permission grant/deny"
    )

    extra_metadata: Mapped[Optional[dict]] = mapped_column(
        "metadata", JSON, default=dict, comment="Additional permission metadata"
    )

    # Relationships
    user: Mapped["User"] = relationship(
        "User",
        back_populates="resource_permissions",
    )

    permission: Mapped[Permission] = relationship(
        "Permission",
    )

    organization: Mapped[Optional["Organization"]] = relationship(
        "Organization",
    )

    granted_by_user: Mapped[Optional["User"]] = relationship(
        "User",
        foreign_keys=[granted_by],
    )

    # Constraints
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "permission_id",
            "resource_type",
            "resource_id",
            name="uq_resource_permission",
        ),
        Index("idx_resource_permissions_user", "user_id"),
        Index("idx_resource_permissions_resource", "resource_type", "resource_id"),
        Index("idx_resource_permissions_permission", "permission_id"),
        Index("idx_resource_permissions_granted", "is_granted"),
        Index("idx_resource_permissions_expires", "expires_at"),
    )

    def __repr__(self) -> str:
        return (
            f"<ResourcePermission(user_id='{self.user_id}', "
            f"resource='{self.resource_type}:{self.resource_id}', "
            f"granted={self.is_granted})>"
        )


class RoleTemplate(Base):
    """
    Predefined role templates for common use cases.

    These templates can be used to quickly create roles with standard
    permission sets for different organizational needs.
    """

    __tablename__ = "role_templates"

    id: Mapped[UUID] = mapped_column(
        PostgreSQLUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
        index=True,
    )

    # Template identification
    name: Mapped[str] = mapped_column(
        String(100), unique=True, nullable=False, comment="Template name"
    )

    code: Mapped[str] = mapped_column(
        String(50), unique=True, nullable=False, comment="Template code"
    )

    description: Mapped[Optional[str]] = mapped_column(
        Text, comment="Template description"
    )

    # Template properties
    category: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        comment="Template category (e.g., 'admin', 'developer', 'viewer')",
    )

    scope: Mapped[PermissionScope] = mapped_column(
        SQLEnum(PermissionScope),
        nullable=False,
        comment="Scope where this template applies",
    )

    is_system: Mapped[bool] = mapped_column(
        Boolean, default=False, comment="Whether this is a system template"
    )

    # Template content
    permissions: Mapped[List[str]] = mapped_column(
        JSON,
        default=list,
        comment="List of permission codes to include in roles created from this template",
    )

    default_settings: Mapped[Optional[dict]] = mapped_column(
        JSON,
        default=dict,
        comment="Default settings for roles created from this template",
    )

    # Metadata
    extra_metadata: Mapped[Optional[dict]] = mapped_column(
        "metadata", JSON, default=dict, comment="Additional template metadata"
    )

    # Timestamps
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

    # Indexes
    __table_args__ = (
        Index("idx_role_templates_category", "category"),
        Index("idx_role_templates_scope", "scope"),
        Index("idx_role_templates_system", "is_system"),
    )

    def __repr__(self) -> str:
        return f"<RoleTemplate(name='{self.name}', category='{self.category}')>"


# Association tables for many-to-many relationships
role_permissions = Table(
    "role_permissions",
    Base.metadata,
    Column(
        "role_id",
        PostgreSQLUUID(as_uuid=True),
        ForeignKey("roles.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "permission_id",
        PostgreSQLUUID(as_uuid=True),
        ForeignKey("permissions.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "created_at",
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    ),
    Index("idx_role_permissions_role", "role_id"),
    Index("idx_role_permissions_permission", "permission_id"),
)
