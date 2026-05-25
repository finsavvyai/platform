"""
User and authentication models for the RAG service.
"""

import uuid
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, EmailStr, Field, validator
from sqlalchemy import Boolean, Integer, LargeBinary, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, SoftDeleteMixin, TenantMixin, TimestampMixin


class UserRole(str, Enum):
    """User role enumeration."""

    SUPER_ADMIN = "super_admin"
    TENANT_ADMIN = "tenant_admin"
    DATA_SCIENTIST = "data_scientist"
    ANALYST = "analyst"
    VIEWER = "viewer"
    USER = "user"


class DataClassification(str, Enum):
    """Data classification levels."""

    PUBLIC = "public"
    INTERNAL = "internal"
    CONFIDENTIAL = "confidential"
    RESTRICTED = "restricted"


class User(Base, TenantMixin, TimestampMixin, SoftDeleteMixin):
    """User model representing system users."""

    __tablename__ = "users"

    # Primary key
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True,
    )

    # Authentication fields
    email: Mapped[str] = mapped_column(
        String(255), nullable=False, index=True, comment="User email address"
    )
    password_hash: Mapped[str] = mapped_column(
        String(255), nullable=False, comment="Bcrypt password hash"
    )
    encrypted_password: Mapped[bytes] = mapped_column(
        LargeBinary,
        nullable=False,
        comment="Encrypted password for additional security",
    )

    # Role and permissions
    role: Mapped[UserRole] = mapped_column(
        String(100),
        nullable=False,
        default=UserRole.USER,
        index=True,
        comment="User role in the system",
    )
    permissions: Mapped[List[str]] = mapped_column(
        "permissions", default=list, nullable=False, comment="List of user permissions"
    )

    # Security settings
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
        index=True,
        comment="Whether user account is active",
    )
    mfa_enabled: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        comment="Whether multi-factor authentication is enabled",
    )
    mfa_secret: Mapped[Optional[bytes]] = mapped_column(
        LargeBinary, nullable=True, comment="MFA secret key (encrypted)"
    )
    email_verified: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        comment="Whether email address is verified",
    )
    phone_number: Mapped[Optional[str]] = mapped_column(
        String(20), nullable=True, comment="Phone number for 2FA"
    )
    phone_verified: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        comment="Whether phone number is verified",
    )

    # Security tracking
    failed_login_attempts: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False, comment="Number of failed login attempts"
    )
    locked_until: Mapped[Optional[datetime]] = mapped_column(
        "locked_until",
        nullable=True,
        index=True,
        comment="Timestamp until which account is locked",
    )
    last_login: Mapped[Optional[datetime]] = mapped_column(
        "last_login",
        nullable=True,
        index=True,
        comment="Last successful login timestamp",
    )

    # Profile and preferences
    profile: Mapped[Dict[str, Any]] = mapped_column(
        default=dict, nullable=False, comment="User profile information"
    )
    preferences: Mapped[Dict[str, Any]] = mapped_column(
        default=dict, nullable=False, comment="User preferences"
    )
    metadata: Mapped[Dict[str, Any]] = mapped_column(
        default=dict, nullable=False, comment="Additional metadata"
    )

    # Relationships
    tenant = relationship("Tenant", back_populates="users")
    documents = relationship(
        "Document", back_populates="created_by_user", cascade="all, delete-orphan"
    )
    api_keys = relationship(
        "APIKey", back_populates="user", cascade="all, delete-orphan"
    )
    sessions = relationship(
        "UserSession", back_populates="user", cascade="all, delete-orphan"
    )
    policies = relationship(
        "Policy", back_populates="created_by_user", cascade="all, delete-orphan"
    )

    # Constraints
    __table_args__ = ({"schema": None},)

    def __repr__(self) -> str:
        return f"<User(id={self.id}, email={self.email}, role={self.role})>"

    @property
    def is_locked(self) -> bool:
        """Check if user account is currently locked."""
        return self.locked_until is not None and self.locked_until > datetime.utcnow()

    @property
    def is_admin(self) -> bool:
        """Check if user has administrative privileges."""
        return self.role in [UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN]

    @property
    def is_tenant_admin(self) -> bool:
        """Check if user is a tenant admin."""
        return self.role == UserRole.TENANT_ADMIN

    def has_permission(self, permission: str) -> bool:
        """Check if user has a specific permission."""
        return permission in self.permissions

    def can_access_tenant(self, tenant_id: uuid.UUID) -> bool:
        """Check if user can access the specified tenant."""
        if self.role == UserRole.SUPER_ADMIN:
            return True
        return self.tenant_id == tenant_id

    def can_manage_users(self) -> bool:
        """Check if user can manage other users."""
        return self.role in [UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN]

    def can_create_documents(self) -> bool:
        """Check if user can create documents."""
        return self.role != UserRole.VIEWER

    def can_delete_documents(self) -> bool:
        """Check if user can delete documents."""
        return self.role in [
            UserRole.SUPER_ADMIN,
            UserRole.TENANT_ADMIN,
            UserRole.DATA_SCIENTIST,
        ]

    def can_view_analytics(self) -> bool:
        """Check if user can view analytics."""
        return self.role != UserRole.VIEWER

    def can_manage_policies(self) -> bool:
        """Check if user can manage policies."""
        return self.role in [UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN]

    def lock_account(self, duration_minutes: int = 30) -> None:
        """Lock the user account for the specified duration."""
        from datetime import timedelta

        self.locked_until = datetime.utcnow() + timedelta(minutes=duration_minutes)

    def unlock_account(self) -> None:
        """Unlock the user account."""
        self.locked_until = None
        self.failed_login_attempts = 0

    def increment_failed_login(self) -> None:
        """Increment failed login counter and lock account if needed."""
        self.failed_login_attempts += 1

        # Lock account after 5 failed attempts
        if self.failed_login_attempts >= 5:
            self.lock_account(30)  # Lock for 30 minutes

    def reset_failed_login(self) -> None:
        """Reset failed login counter."""
        self.failed_login_attempts = 0

    def update_last_login(self) -> None:
        """Update the last login timestamp."""
        self.last_login = datetime.utcnow()
        self.reset_failed_login()

    def get_profile_field(self, key: str, default: Any = None) -> Any:
        """Get a specific profile field."""
        return self.profile.get(key, default)

    def set_profile_field(self, key: str, value: Any) -> None:
        """Set a specific profile field."""
        self.profile[key] = value

    def get_preference(self, key: str, default: Any = None) -> Any:
        """Get a specific preference."""
        return self.preferences.get(key, default)

    def set_preference(self, key: str, value: Any) -> None:
        """Set a specific preference."""
        self.preferences[key] = value


class UserSession(Base, TenantMixin, TimestampMixin):
    """User session model for authentication tracking."""

    __tablename__ = "user_sessions"

    # Primary key
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True,
    )

    # Session identifiers
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="User ID",
    )
    session_token: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False, index=True, comment="Session token"
    )
    refresh_token: Mapped[Optional[str]] = mapped_column(
        String(255), unique=True, nullable=True, comment="Refresh token"
    )

    # Session metadata
    ip_address: Mapped[Optional[str]] = mapped_column(
        String(45), nullable=True, comment="IP address of the session"
    )
    user_agent: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True, comment="User agent string"
    )
    device_fingerprint: Mapped[Optional[str]] = mapped_column(
        String(255), nullable=True, index=True, comment="Device fingerprint"
    )

    # Session lifecycle
    expires_at: Mapped[datetime] = mapped_column(
        nullable=False, index=True, comment="Session expiration time"
    )
    last_activity: Mapped[datetime] = mapped_column(
        nullable=False,
        default=datetime.utcnow,
        index=True,
        comment="Last activity timestamp",
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
        index=True,
        comment="Whether session is active",
    )

    # Security and metadata
    security_flags: Mapped[Dict[str, Any]] = mapped_column(
        default=dict, nullable=False, comment="Security flags and metadata"
    )
    metadata: Mapped[Dict[str, Any]] = mapped_column(
        default=dict, nullable=False, comment="Additional session metadata"
    )

    # Relationships
    user = relationship("User", back_populates="sessions")

    def __repr__(self) -> str:
        return f"<UserSession(id={self.id}, user_id={self.user_id}, active={self.is_active})>"

    @property
    def is_expired(self) -> bool:
        """Check if session is expired."""
        return datetime.utcnow() > self.expires_at

    @property
    def is_valid(self) -> bool:
        """Check if session is valid and active."""
        return self.is_active and not self.is_expired

    def update_last_activity(self) -> None:
        """Update the last activity timestamp."""
        self.last_activity = datetime.utcnow()

    def revoke(self) -> None:
        """Revoke the session."""
        self.is_active = False

    def set_security_flag(self, key: str, value: Any) -> None:
        """Set a security flag for the session."""
        self.security_flags[key] = value

    def get_security_flag(self, key: str, default: Any = None) -> Any:
        """Get a security flag from the session."""
        return self.security_flags.get(key, default)


# Pydantic schemas for API
class UserBase(BaseModel):
    """Base user schema."""

    email: EmailStr
    role: UserRole = UserRole.USER
    is_active: bool = True


class UserCreate(UserBase):
    """Schema for creating a user."""

    password: str = Field(..., min_length=8, max_length=128)
    phone_number: Optional[str] = None
    profile: Dict[str, Any] = Field(default_factory=dict)
    preferences: Dict[str, Any] = Field(default_factory=dict)
    permissions: List[str] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)

    @validator("password")
    def validate_password(cls, v):
        """Validate password strength."""
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long")
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(c.islower() for c in v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit")
        return v


class UserUpdate(BaseModel):
    """Schema for updating a user."""

    email: Optional[EmailStr] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None
    mfa_enabled: Optional[bool] = None
    phone_number: Optional[str] = None
    profile: Optional[Dict[str, Any]] = None
    preferences: Optional[Dict[str, Any]] = None
    permissions: Optional[List[str]] = None
    metadata: Optional[Dict[str, Any]] = None


class UserResponse(UserBase):
    """Schema for user response."""

    id: uuid.UUID
    tenant_id: uuid.UUID
    permissions: List[str]
    email_verified: bool
    phone_verified: bool
    mfa_enabled: bool
    failed_login_attempts: int
    locked_until: Optional[datetime]
    last_login: Optional[datetime]
    profile: Dict[str, Any]
    preferences: Dict[str, Any]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class UserListResponse(BaseModel):
    """Schema for user list response."""

    users: List[UserResponse]
    total: int
    page: int
    per_page: int
    has_next: bool
    has_prev: bool


class SessionCreate(BaseModel):
    """Schema for creating a session."""

    user_id: uuid.UUID
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    device_fingerprint: Optional[str] = None
    expires_at: datetime
    metadata: Dict[str, Any] = Field(default_factory=dict)


class SessionResponse(BaseModel):
    """Schema for session response."""

    id: uuid.UUID
    user_id: uuid.UUID
    expires_at: datetime
    last_activity: datetime
    is_active: bool
    ip_address: Optional[str]
    device_fingerprint: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class LoginRequest(BaseModel):
    """Schema for login request."""

    email: EmailStr
    password: str
    mfa_code: Optional[str] = None
    remember_me: bool = False


class LoginResponse(BaseModel):
    """Schema for login response."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserResponse
    session: SessionResponse


class RefreshTokenRequest(BaseModel):
    """Schema for refresh token request."""

    refresh_token: str


class PasswordChangeRequest(BaseModel):
    """Schema for password change request."""

    current_password: str
    new_password: str = Field(..., min_length=8, max_length=128)
