"""
Enhanced User Model with Comprehensive Authentication Features

This model supports enterprise-grade authentication including:
- Email/password authentication
- OAuth/OIDC integration
- Multi-factor authentication (MFA)
- Session management
- Security monitoring
- Account verification and password reset

Author: Claude Code Implementation
Updated: 2025-01-05
"""

from sqlalchemy import Column, String, Boolean, DateTime, Integer, ForeignKey, Text, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy import JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from sqlalchemy.ext.declarative import declarative_base
import uuid
from datetime import datetime

from app.core.database import Base, JSONType


class User(Base):
    """
    Enhanced User model with comprehensive authentication and security features

    Supports multiple authentication methods, MFA, session management,
    and detailed audit logging for enterprise security requirements.
    """

    __tablename__ = "users"

    # Primary identification
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    username = Column(String(100), unique=True, index=True, nullable=True)  # Optional username
    hashed_password = Column(String(255), nullable=True)  # Null for OAuth-only users
    full_name = Column(String(255), nullable=True)

    # Account status and verification
    is_active = Column(Boolean, default=True, nullable=False)
    is_superuser = Column(Boolean, default=False, nullable=False)
    is_verified = Column(Boolean, default=False, nullable=False)
    is_staff = Column(Boolean, default=False, nullable=False)  # Staff/admin access

    # Authentication methods
    auth_methods = Column(JSONType, default=list)  # ['email_password', 'google', 'microsoft', 'github']
    oauth_providers = Column(JSONType, default=dict)  # Linked OAuth accounts

    # Organization relationship
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=True)
    organization = relationship("Organization", back_populates="users")

    # Referral (viral growth)
    referral_code = Column(String(32), unique=True, nullable=True, index=True)
    referred_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    referred_by = relationship("User", remote_side=[id], foreign_keys=[referred_by_id])

    # Tenant relationship (multi-tenant)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=True, index=True)
    tenant = relationship("Tenant", back_populates="users")

    # Roles and permissions
    role = Column(String(50), default="user")  # user, admin, staff, enterprise_admin
    permissions = Column(JSONType, default=list)  # Granular permissions

    # Subscription and billing
    subscription_tier = Column(String(50), default="free")  # free, pro, enterprise
    usage_limits = Column(JSONType, default=dict)
    billing_info = Column(JSONType, default=dict)

    # Security and authentication preferences
    preferences = Column(JSONType, default=dict)  # MFA settings, notification prefs, etc.
    security_settings = Column(JSONType, default=dict)  # Security preferences

    # Profile information
    avatar_url = Column(String(500), nullable=True)
    bio = Column(Text, nullable=True)
    timezone = Column(String(50), default="UTC")
    language = Column(String(10), default="en")

    # Contact information
    phone_number = Column(String(50), nullable=True)
    phone_verified = Column(Boolean, default=False)

    # Account security
    password_changed_at = Column(DateTime(timezone=True), nullable=True)
    email_verified_at = Column(DateTime(timezone=True), nullable=True)
    two_factor_enabled = Column(Boolean, default=False)
    two_factor_secret = Column(String(255), nullable=True)  # Encrypted TOTP secret

    # Session and device management
    last_login = Column(DateTime(timezone=True), nullable=True)
    last_login_ip = Column(String(45), nullable=True)  # IPv6 compatible
    last_login_device = Column(JSONType, nullable=True)  # Device fingerprint
    login_count = Column(Integer, default=0)

    # Failed login tracking
    failed_login_attempts = Column(Integer, default=0)
    locked_until = Column(DateTime(timezone=True), nullable=True)

    # Email verification tokens
    verification_token = Column(String(255), nullable=True)
    verification_token_expires = Column(DateTime(timezone=True), nullable=True)

    # Password reset tokens
    password_reset_token = Column(String(255), nullable=True)
    password_reset_token_expires = Column(DateTime(timezone=True), nullable=True)

    # API keys and tokens
    api_keys = Column(JSONType, default=list)  # User's API keys
    personal_access_tokens = Column(JSONType, default=list)  # PAT tokens

    # Audit and compliance
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)
    deleted_at = Column(DateTime(timezone=True), nullable=True)  # Soft delete

    # Application-specific data
    app_preferences = Column(JSONType, default=dict)  # App-specific preferences
    notification_settings = Column(JSONType, default=dict)  # Email/push notifications

    # Metadata and analytics
    user_metadata = Column(JSONType, default=dict)  # Additional metadata
    tags = Column(JSONType, default=list)  # User tags for segmentation

    # Relationships
    workflows = relationship("Workflow", back_populates="owner", cascade="all, delete-orphan")
    documents = relationship("Document", back_populates="owner", cascade="all, delete-orphan")
    sessions = relationship("UserSession", back_populates="user", cascade="all, delete-orphan")
    security_events = relationship("SecurityEvent", back_populates="user", cascade="all, delete-orphan")

    # RBAC relationships (disambiguate: UserRoleAssignment has user_id, assigned_by, approved_by -> users.id)
    role_assignments = relationship(
        "app.models.rbac.UserRoleAssignment",
        back_populates="user",
        foreign_keys="app.models.rbac.UserRoleAssignment.user_id",
        cascade="all, delete-orphan",
    )

    # Indexes for performance
    __table_args__ = (
        Index('idx_user_email_active', 'email', 'is_active'),
        Index('idx_user_org_tier', 'organization_id', 'subscription_tier'),
        Index('idx_user_last_login', 'last_login'),
        Index('idx_user_created_at', 'created_at'),
        Index('idx_user_verification', 'is_verified', 'verification_token_expires'),
        Index('idx_user_security', 'locked_until', 'failed_login_attempts'),
    )

    def __repr__(self):
        return f"<User(id={self.id}, email={self.email}, active={self.is_active})>"

    # Properties for convenient access
    @property
    def is_locked(self) -> bool:
        """Check if user account is locked"""
        if self.locked_until:
            return datetime.utcnow() < self.locked_until
        return False

    @property
    def has_password_auth(self) -> bool:
        """Check if user has password authentication enabled"""
        return 'email_password' in (self.auth_methods or []) and self.hashed_password is not None

    @property
    def has_oauth_auth(self) -> bool:
        """Check if user has any OAuth providers linked"""
        return len(self.oauth_providers or {}) > 0

    @property
    def display_name(self) -> str:
        """Get user's display name"""
        return self.full_name or self.email or self.username or "Unknown User"

    @property
    def mfa_enabled(self) -> bool:
        """Check if MFA is enabled for user"""
        return (
            self.two_factor_enabled or
            (self.preferences and self.preferences.get('mfa_enabled', False))
        )

    def get_auth_providers(self) -> list:
        """Get list of authentication providers"""
        providers = []

        if self.has_password_auth:
            providers.append('email_password')

        if self.oauth_providers:
            providers.extend(self.oauth_providers.keys())

        return providers

    def has_permission(self, permission: str) -> bool:
        """Check if user has specific permission"""
        if self.is_superuser:
            return True

        # Check explicit permissions
        if permission in (self.permissions or []):
            return True

        # Check role-based permissions
        role_permissions = {
            'admin': ['read', 'write', 'delete', 'manage_users', 'manage_workflows', 'manage_billing'],
            'staff': ['read', 'write', 'manage_workflows'],
            'user': ['read', 'write', 'create_workflows', 'execute_workflows'],
            'viewer': ['read']
        }

        user_permissions = role_permissions.get(self.role, [])
        return permission in user_permissions

    def get_security_score(self) -> int:
        """Calculate security score (0-100)"""
        score = 0

        # Base score for having verified email
        if self.is_verified:
            score += 20

        # MFA enabled
        if self.mfa_enabled:
            score += 30

        # Password strength (basic check)
        if self.hashed_password and self.password_changed_at:
            days_since_change = (datetime.utcnow() - self.password_changed_at).days
            if days_since_change < 90:
                score += 20
            elif days_since_change < 180:
                score += 10

        # No failed login attempts
        if self.failed_login_attempts == 0:
            score += 15

        # OAuth providers (additional security factor)
        if self.has_oauth_auth:
            score += 15

        return min(score, 100)

    def to_dict(self) -> dict:
        """Convert user to dictionary (excluding sensitive data)"""
        return {
            'id': str(self.id),
            'email': self.email,
            'username': self.username,
            'full_name': self.full_name,
            'display_name': self.display_name,
            'is_active': self.is_active,
            'is_verified': self.is_verified,
            'is_staff': self.is_staff,
            'role': self.role,
            'subscription_tier': self.subscription_tier,
            'avatar_url': self.avatar_url,
            'timezone': self.timezone,
            'language': self.language,
            'auth_methods': self.auth_methods,
            'mfa_enabled': self.mfa_enabled,
            'security_score': self.get_security_score(),
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'last_login': self.last_login.isoformat() if self.last_login else None,
            'organization_id': str(self.organization_id) if self.organization_id else None,
        }


class UserSession(Base):
    """
    User session model for tracking active sessions and devices
    """

    __tablename__ = "user_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    # Session information
    session_token = Column(String(255), unique=True, nullable=False)
    refresh_token_hash = Column(String(255), nullable=False)

    # Device and browser information
    device_info = Column(JSONType, nullable=True)  # User agent, device fingerprint
    ip_address = Column(String(45), nullable=True)  # IPv6 compatible
    location = Column(JSONType, nullable=True)  # Geo-location data

    # Session lifecycle
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    last_accessed = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    is_active = Column(Boolean, default=True)

    # Security flags
    is_suspicious = Column(Boolean, default=False)
    suspicious_reasons = Column(JSONType, default=list)  # Reasons for marking as suspicious

    # Relationships
    user = relationship("User", back_populates="sessions")

    # Indexes
    __table_args__ = (
        Index('idx_session_user', 'user_id', 'is_active'),
        Index('idx_session_token', 'session_token'),
        Index('idx_session_expires', 'expires_at'),
    )

    def __repr__(self):
        return f"<UserSession(id={self.id}, user_id={self.user_id}, active={self.is_active})>"

    @property
    def is_expired(self) -> bool:
        """Check if session is expired"""
        return datetime.utcnow() > self.expires_at

    @property
    def is_valid(self) -> bool:
        """Check if session is valid (active and not expired)"""
        return self.is_active and not self.is_expired


class SecurityEvent(Base):
    """
    Security event model for audit logging and monitoring
    """

    __tablename__ = "security_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    # Event information
    event_type = Column(String(100), nullable=False)  # login, logout, password_change, etc.
    event_category = Column(String(50), nullable=False)  # authentication, authorization, etc.
    severity = Column(String(20), default="info")  # info, warning, error, critical

    # Request information
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(String(500), nullable=True)
    request_id = Column(String(100), nullable=True)

    # Event details
    details = Column(JSONType, default=dict)  # Event-specific details
    event_data = Column(JSONType, default=dict)  # Additional metadata

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    user = relationship("User", back_populates="security_events")

    # Indexes
    __table_args__ = (
        Index('idx_security_user', 'user_id', 'created_at'),
        Index('idx_security_type', 'event_type', 'created_at'),
        Index('idx_security_severity', 'severity', 'created_at'),
        Index('idx_security_ip', 'ip_address', 'created_at'),
    )

    def __repr__(self):
        return f"<SecurityEvent(id={self.id}, type={self.event_type}, user_id={self.user_id})>"