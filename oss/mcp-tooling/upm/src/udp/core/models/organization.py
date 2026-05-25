"""
Organization model for UPM multi-tenancy.

Represents organizations with users, projects, and settings.
Supports hierarchical organizations and role-based access control.
"""

from datetime import datetime
from enum import Enum
from typing import List, Optional

from sqlalchemy import Boolean, Column, String, ForeignKey, Index, JSON, Table
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from .base import BaseModel
# from .user import User  # Import will be added when circular dependency is resolved


class OrganizationStatus(str, Enum):
    """Organization account status."""

    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"


class OrganizationRole(str, Enum):
    """Organization member roles."""

    OWNER = "owner"
    ADMIN = "admin"
    MEMBER = "member"
    VIEWER = "viewer"


# Association table for organization membership
organization_members = Table(
    "organization_members",
    BaseModel.metadata,
    Column(
        "organization_id",
        UUID(as_uuid=True),
        ForeignKey("organizations.id"),
        primary_key=True,
    ),
    Column("user_id", UUID(as_uuid=True), ForeignKey("users.id"), primary_key=True),
    Column("role", String(50), nullable=False, default=OrganizationRole.MEMBER),
    Column(
        "invited_at",
        String(50),
        nullable=False,
        default=lambda: datetime.utcnow().isoformat(),
    ),
    Column("joined_at", String(50), nullable=True),
    Column("left_at", String(50), nullable=True),
    Column("permissions", JSON, default=dict),
    Index("idx_org_members_org_role", "organization_id", "role"),
    Index("idx_org_members_user_status", "user_id", "role"),
)


class Organization(BaseModel):
    """
    Organization model for multi-tenant architecture.

    Organizations contain users, projects, and provide the primary
    scope for access control and resource isolation.
    """

    __tablename__ = "organizations"

    # Basic information
    name = Column(String(255), nullable=False, comment="Organization name")

    slug = Column(
        String(100),
        unique=True,
        nullable=False,
        index=True,
        comment="URL-friendly organization identifier",
    )

    description = Column(
        String(1000), nullable=True, comment="Organization description"
    )

    # Domain and branding
    domain = Column(
        String(255),
        nullable=True,
        unique=True,
        index=True,
        comment="Primary domain for SSO",
    )

    website = Column(String(500), nullable=True, comment="Organization website")

    logo_url = Column(String(500), nullable=True, comment="Organization logo URL")

    # Status and limits
    status = Column(
        String(50),
        default=OrganizationStatus.ACTIVE,
        nullable=False,
        comment="Organization status",
    )

    # Enterprise features
    is_enterprise = Column(
        Boolean,
        default=False,
        nullable=False,
        comment="Whether organization has enterprise features",
    )

    # Configuration and settings
    settings = Column(JSON, default=dict, comment="Organization-specific settings")

    # Subscription and billing
    subscription_tier = Column(
        String(50), default="free", nullable=False, comment="Subscription tier"
    )

    subscription_expires_at = Column(
        String(50), nullable=True, comment="Subscription expiration date"
    )

    # Limits
    max_users = Column(
        String(10), default="10", nullable=False, comment="Maximum number of users"
    )

    max_projects = Column(
        String(10), default="50", nullable=False, comment="Maximum number of projects"
    )

    # Audit fields
    created_by = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
        comment="User who created the organization",
    )

    # Indexes
    __table_args__ = (
        Index("idx_organizations_status_domain", "status", "domain"),
        Index("idx_organizations_slug_status", "slug", "status"),
    )

    # Relationships - will be added as models are implemented
    # created_by_user = relationship("User", foreign_keys=[created_by], post_update=True)

    # members = relationship(
    #     "OrganizationMember",
    #     back_populates="organization",
    #     cascade="all, delete-orphan",
    # )

    # projects = relationship(
    #     "Project", back_populates="organization", cascade="all, delete-orphan"
    # )

    # policies = relationship(
    #     "Policy", back_populates="organization", cascade="all, delete-orphan"
    # )

    # custom_roles = relationship(
    #     "Role", back_populates="organization", cascade="all, delete-orphan"
    # )

    # New relationships with additional models
    # repositories = relationship(
    #     "Repository", back_populates="organization", cascade="all, delete-orphan"
    # )

    # environments = relationship(
    #     "Environment", back_populates="organization", cascade="all, delete-orphan"
    # )

    # compliance_rules = relationship(
    #     "ComplianceRule", back_populates="organization", cascade="all, delete-orphan"
    # )

    # compliance_reports = relationship(
    #     "ComplianceReport", back_populates="organization", cascade="all, delete-orphan"
    # )

    @property
    def is_active(self) -> bool:
        """Check if organization is active."""
        return self.status == OrganizationStatus.ACTIVE

    @property
    def is_subscription_active(self) -> bool:
        """Check if subscription is active."""
        if not self.subscription_expires_at:
            return self.subscription_tier == "free"

        try:
            expires_at = datetime.fromisoformat(self.subscription_expires_at)
            return datetime.utcnow() < expires_at
        except:
            return False

    def can_add_user(self, current_user_count: int) -> bool:
        """Check if organization can add more users."""
        if self.is_enterprise:
            return True
        return current_user_count < int(self.max_users)

    def can_add_project(self, current_project_count: int) -> bool:
        """Check if organization can add more projects."""
        if self.is_enterprise:
            return True
        return current_project_count < int(self.max_projects)

    def get_setting(self, key: str, default=None):
        """Get organization setting."""
        if not self.settings:
            return default
        return self.settings.get(key, default)

    def set_setting(self, key: str, value):
        """Set organization setting."""
        if not self.settings:
            self.settings = {}
        self.settings[key] = value

    def __repr__(self):
        return f"<Organization(id={self.id}, name={self.name}, slug={self.slug})>"


class OrganizationMember(BaseModel):
    """
    Organization member model representing user membership in organizations.

    This model manages the relationship between users and organizations,
    including roles, permissions, and membership status.
    """

    __tablename__ = "organization_memberships"

    # Relationships
    organization_id = Column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id"),
        nullable=False,
        comment="Organization ID",
    )

    user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, comment="User ID"
    )

    # Membership details
    role = Column(
        String(50),
        nullable=False,
        default=OrganizationRole.MEMBER,
        comment="User role within the organization",
    )

    permissions = Column(
        JSON, default=dict, comment="Additional permissions beyond role defaults"
    )

    # Timestamps
    invited_at = Column(
        String(50),
        nullable=False,
        default=lambda: datetime.utcnow().isoformat(),
        comment="When user was invited to organization",
    )

    joined_at = Column(
        String(50), nullable=True, comment="When user joined the organization"
    )

    left_at = Column(
        String(50),
        nullable=True,
        comment="When user left the organization (if applicable)",
    )

    # Status
    is_active = Column(
        Boolean,
        default=True,
        nullable=False,
        comment="Whether membership is currently active",
    )

    # Indexes
    __table_args__ = (
        Index("idx_org_members_org_user", "organization_id", "user_id"),
        Index("idx_org_members_role_active", "role", "is_active"),
    )

    # Relationships - will be added as models are implemented
    # organization = relationship("Organization", back_populates="members")

    # user = relationship("User", back_populates="organization_memberships")

    @property
    def has_joined(self) -> bool:
        """Check if user has accepted invitation and joined."""
        return self.joined_at is not None and self.left_at is None

    @property
    def membership_duration(self) -> Optional[int]:
        """Get membership duration in days."""
        if not self.joined_at:
            return None

        try:
            start = datetime.fromisoformat(self.joined_at)
            end = (
                datetime.fromisoformat(self.left_at)
                if self.left_at
                else datetime.utcnow()
            )
            return (end - start).days
        except:
            return None

    def has_permission(self, permission: str) -> bool:
        """Check if member has specific permission."""
        # Owners have all permissions
        if self.role == OrganizationRole.OWNER:
            return True

        # Check custom permissions
        if self.permissions and permission in self.permissions:
            return self.permissions[permission]

        # Role-based permissions
        role_permissions = {
            OrganizationRole.ADMIN: [
                "manage_users",
                "manage_projects",
                "manage_policies",
                "view_reports",
                "manage_billing",
            ],
            OrganizationRole.MEMBER: [
                "view_projects",
                "create_projects",
                "view_reports",
            ],
            OrganizationRole.VIEWER: ["view_projects", "view_reports"],
        }

        return permission in role_permissions.get(self.role, [])

    def __repr__(self):
        return f"<OrganizationMember(org_id={self.organization_id}, user_id={self.user_id}, role={self.role})>"
