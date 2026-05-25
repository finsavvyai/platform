"""
Enhanced Authentication schemas with comprehensive validation

This module provides Pydantic schemas for all authentication-related operations
including registration, login, MFA, OAuth, session management, and security events.

Author: Claude Code Implementation
Updated: 2025-01-05
"""

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator
from typing import Optional, List, Dict, Any, Union
from datetime import datetime
from enum import Enum
import re

# Enums for type safety
class AuthMethod(str, Enum):
    """Authentication methods"""
    EMAIL_PASSWORD = "email_password"
    GOOGLE = "google"
    MICROSOFT = "microsoft"
    GITHUB = "github"
    SSO = "sso"

class UserRole(str, Enum):
    """User roles"""
    USER = "user"
    ADMIN = "admin"
    STAFF = "staff"
    ENTERPRISE_ADMIN = "enterprise_admin"
    VIEWER = "viewer"

class SubscriptionTier(str, Enum):
    """Subscription tiers"""
    FREE = "free"
    PRO = "pro"
    ENTERPRISE = "enterprise"

class SecurityEventType(str, Enum):
    """Security event types"""
    LOGIN_SUCCESS = "login_success"
    LOGIN_FAILED = "login_failed"
    LOGOUT = "logout"
    PASSWORD_CHANGED = "password_changed"
    PASSWORD_RESET_REQUESTED = "password_reset_requested"
    PASSWORD_RESET_COMPLETED = "password_reset_completed"
    EMAIL_VERIFIED = "email_verified"
    MFA_ENABLED = "mfa_enabled"
    MFA_DISABLED = "mfa_disabled"
    ACCOUNT_LOCKED = "account_locked"
    ACCOUNT_UNLOCKED = "account_unlocked"
    TOKEN_REFRESHED = "token_refreshed"
    TOKEN_REVOKED = "token_revoked"
    SUSPICIOUS_ACTIVITY = "suspicious_activity"
    RATE_LIMIT_EXCEEDED = "rate_limit_exceeded"

class SecuritySeverity(str, Enum):
    """Security event severity levels"""
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


class UserBase(BaseModel):
    """Base user schema with comprehensive validation"""
    email: EmailStr = Field(..., description="User email address")
    username: Optional[str] = Field(None, min_length=3, max_length=50, description="Optional username")
    full_name: Optional[str] = Field(None, max_length=255, description="User's full name")
    is_active: bool = Field(True, description="Whether the user account is active")

    @field_validator('username')
    @classmethod
    def validate_username(cls, v):
        if v is not None:
            # Username validation: alphanumeric, underscores, hyphens only
            if not re.match(r'^[a-zA-Z0-9_-]+$', v):
                raise ValueError('Username can only contain letters, numbers, underscores, and hyphens')
            if v.startswith('_') or v.startswith('-'):
                raise ValueError('Username cannot start with underscore or hyphen')
        return v

    @field_validator('full_name')
    @classmethod
    def validate_full_name(cls, v):
        if v is not None:
            # Remove extra whitespace and validate length
            v = ' '.join(v.split())
            if len(v) < 2:
                raise ValueError('Full name must be at least 2 characters long')
        return v


class UserCreate(UserBase):
    """Enhanced user creation schema with comprehensive validation"""
    password: str = Field(
        ...,
        min_length=8,
        max_length=128,
        description="Password must be at least 8 characters long"
    )
    confirm_password: str = Field(..., description="Confirm password")
    organization_name: Optional[str] = Field(None, max_length=255, description="Organization name")
    accept_terms: bool = Field(..., description="Accept terms of service")
    marketing_consent: bool = Field(False, description="Marketing email consent")

    # Role assignment (for admin use)
    role: UserRole = Field(UserRole.USER, description="User role")
    subscription_tier: SubscriptionTier = Field(SubscriptionTier.FREE, description="Subscription tier")

    @field_validator('password')
    @classmethod
    def validate_password_strength(cls, v):
        """Strong password validation"""
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters long')

        if len(v) > 128:
            raise ValueError('Password cannot exceed 128 characters')

        # Check for at least one uppercase letter
        if not re.search(r'[A-Z]', v):
            raise ValueError('Password must contain at least one uppercase letter')

        # Check for at least one lowercase letter
        if not re.search(r'[a-z]', v):
            raise ValueError('Password must contain at least one lowercase letter')

        # Check for at least one digit
        if not re.search(r'\d', v):
            raise ValueError('Password must contain at least one digit')

        # Check for at least one special character
        if not re.search(r'[!@#$%^&*()_+\-=\[\]{};\'\\:"|<>,./?]', v):
            raise ValueError('Password must contain at least one special character')

        # Check for common weak patterns
        weak_patterns = [
            r'password', r'123456', r'qwerty', r'admin', r'letmein',
            r'welcome', r'monkey', r'dragon', r'football', r'baseball'
        ]

        password_lower = v.lower()
        for pattern in weak_patterns:
            if re.search(pattern, password_lower):
                raise ValueError(f'Password cannot contain common patterns like "{pattern}"')

        return v

    @field_validator('organization_name')
    @classmethod
    def validate_organization_name(cls, v):
        if v is not None:
            v = v.strip()
            if len(v) < 2:
                raise ValueError('Organization name must be at least 2 characters long')
            if len(v) > 255:
                raise ValueError('Organization name cannot exceed 255 characters')
        return v

    @model_validator(mode='after')
    def validate_passwords_match_and_terms(self):
        """Validate password match and terms acceptance"""
        if self.password != self.confirm_password:
            raise ValueError('Passwords do not match')
        if not self.accept_terms:
            raise ValueError('You must accept the terms of service')
        return self


class UserUpdate(BaseModel):
    """User update schema with partial validation"""
    email: Optional[EmailStr] = Field(None, description="New email address")
    username: Optional[str] = Field(None, min_length=3, max_length=50, description="New username")
    full_name: Optional[str] = Field(None, max_length=255, description="New full name")
    is_active: Optional[bool] = Field(None, description="Account status")
    is_verified: Optional[bool] = Field(None, description="Verification status")
    role: Optional[UserRole] = Field(None, description="User role")
    subscription_tier: Optional[SubscriptionTier] = Field(None, description="Subscription tier")
    timezone: Optional[str] = Field(None, description="User timezone")
    language: Optional[str] = Field(None, min_length=2, max_length=10, description="Language code")
    bio: Optional[str] = Field(None, max_length=1000, description="User bio")
    avatar_url: Optional[str] = Field(None, max_length=500, description="Avatar URL")

    # Preferences
    preferences: Optional[Dict[str, Any]] = Field(None, description="User preferences")
    notification_settings: Optional[Dict[str, Any]] = Field(None, description="Notification settings")
    security_settings: Optional[Dict[str, Any]] = Field(None, description="Security settings")

    @field_validator('email')
    @classmethod
    def validate_email_update(cls, v):
        if v is not None:
            # Additional email validation can be added here
            pass
        return v

    @field_validator('timezone')
    @classmethod
    def validate_timezone(cls, v):
        if v is not None:
            # Basic timezone validation
            valid_timezones = ['UTC', 'EST', 'CST', 'MST', 'PST', 'GMT', 'CET', 'JST', 'AEST']
            if v not in valid_timezones and not v.startswith('UTC') and not re.match(r'^[+-]\d{2}:\d{2}$', v):
                # Allow standard timezone format like "UTC+5:30" or "America/New_York"
                pass  # More comprehensive validation can be added
        return v

    @field_validator('avatar_url')
    @classmethod
    def validate_avatar_url(cls, v):
        if v is not None:
            # Basic URL validation
            if not (v.startswith('http://') or v.startswith('https://')):
                raise ValueError('Avatar URL must be a valid HTTP/HTTPS URL')
        return v


class UserResponse(UserBase):
    """Enhanced user response schema with comprehensive user information"""
    id: str = Field(..., description="User ID")
    subscription_tier: SubscriptionTier = Field(..., description="Subscription tier")
    is_verified: bool = Field(..., description="Email verification status")
    is_staff: bool = Field(..., description="Staff status")
    role: UserRole = Field(..., description="User role")
    organization_id: Optional[str] = Field(None, description="Organization ID")

    # Authentication information
    auth_methods: List[AuthMethod] = Field(default_factory=list, description="Available authentication methods")
    mfa_enabled: bool = Field(default=False, description="MFA status")
    has_oauth_auth: bool = Field(default=False, description="OAuth authentication status")

    # Profile information
    avatar_url: Optional[str] = Field(None, description="Avatar URL")
    bio: Optional[str] = Field(None, description="User bio")
    timezone: str = Field("UTC", description="User timezone")
    language: str = Field("en", description="User language")

    # Security information
    security_score: int = Field(default=0, description="Security score (0-100)")
    last_login: Optional[datetime] = Field(None, description="Last login timestamp")
    last_login_ip: Optional[str] = Field(None, description="Last login IP address")
    login_count: int = Field(default=0, description="Total login count")

    # Timestamps
    created_at: datetime = Field(..., description="Account creation timestamp")
    updated_at: Optional[datetime] = Field(None, description="Last update timestamp")
    email_verified_at: Optional[datetime] = Field(None, description="Email verification timestamp")
    password_changed_at: Optional[datetime] = Field(None, description="Last password change timestamp")

    class Config:
        from_attributes = True
        use_enum_values = True


class UserLogin(BaseModel):
    """Basic user login schema"""
    email: EmailStr = Field(..., description="User email address")
    password: str = Field(..., description="User password")


class Token(BaseModel):
    """Token response schema (legacy compatibility)"""
    access_token: str = Field(..., description="JWT access token")
    token_type: str = Field("bearer", description="Token type")
    expires_in: int = Field(..., description="Token expiration time in seconds")
    user: UserResponse = Field(..., description="User information")


class TokenPair(BaseModel):
    """Enhanced token pair response schema with refresh token"""
    access_token: str = Field(..., description="JWT access token")
    refresh_token: str = Field(..., description="Refresh token")
    token_type: str = Field("bearer", description="Token type")
    expires_in: int = Field(..., description="Access token expiration in seconds")
    refresh_expires_in: int = Field(..., description="Refresh token expiration in seconds")
    user_id: Optional[str] = Field(None, description="User ID")
    mfa_enabled: bool = Field(False, description="MFA enabled status")


class TokenData(BaseModel):
    """Token data schema for JWT payload validation"""
    user_id: Optional[str] = Field(None, description="User ID from token")
    email: Optional[str] = Field(None, description="User email from token")
    exp: Optional[int] = Field(None, description="Expiration timestamp")
    iat: Optional[int] = Field(None, description="Issued at timestamp")
    jti: Optional[str] = Field(None, description="JWT ID")


class RefreshTokenRequest(BaseModel):
    """Enhanced refresh token request schema"""
    refresh_token: str = Field(..., description="Refresh token")
    device_info: Optional[str] = Field(None, description="Device information for tracking")
    client_ip: Optional[str] = Field(None, description="Client IP address")

    @field_validator('refresh_token')
    @classmethod
    def validate_refresh_token(cls, v):
        if len(v) < 10:
            raise ValueError('Invalid refresh token format')
        return v


# MFA Schemas
class MFASetupResponse(BaseModel):
    """MFA setup response schema"""
    secret: str
    qr_code: str
    backup_codes: List[str]


class MFAVerifyRequest(BaseModel):
    """MFA verification request schema"""
    token: str = Field(..., min_length=6, max_length=6, description="6-digit TOTP token")


class MFAStatusResponse(BaseModel):
    """MFA status response schema"""
    enabled: bool
    backup_codes_remaining: Optional[int] = None


# OAuth Schemas
class OAuthProvider(BaseModel):
    """OAuth provider schema"""
    name: str
    display_name: str
    is_oidc: bool


class OAuthProvidersResponse(BaseModel):
    """OAuth providers list response"""
    providers: List[OAuthProvider]


class OAuthAuthorizationResponse(BaseModel):
    """OAuth authorization URL response"""
    authorization_url: str


class OAuthCallbackRequest(BaseModel):
    """OAuth callback request schema"""
    provider: str
    code: str
    state: str
    redirect_uri: str


# Enhanced Login Schemas
class EnhancedLoginRequest(BaseModel):
    """Enhanced login request with MFA and device tracking support"""
    email: EmailStr = Field(..., description="User email address")
    password: str = Field(..., min_length=1, description="User password")
    mfa_token: Optional[str] = Field(
        None,
        min_length=6,
        max_length=8,
        description="MFA token or backup code (6-8 characters)"
    )
    device_info: Optional[str] = Field(None, description="Device information for session tracking")
    remember_me: bool = Field(False, description="Remember this device for extended session")
    client_ip: Optional[str] = Field(None, description="Client IP address for security logging")
    user_agent: Optional[str] = Field(None, description="User agent string")

    @field_validator('mfa_token')
    @classmethod
    def validate_mfa_token(cls, v):
        if v is not None:
            # Check if it's a numeric token
            if not v.isdigit():
                # Check if it's a backup code format (XXXX-XXXX)
                if not re.match(r'^[A-Z0-9]{4}-[A-Z0-9]{4}$', v):
                    raise ValueError('MFA token must be numeric or backup code format')
        return v


class LoginResponse(BaseModel):
    """Enhanced login response with comprehensive session information"""
    access_token: str = Field(..., description="JWT access token")
    refresh_token: str = Field(..., description="Refresh token")
    token_type: str = Field("bearer", description="Token type")
    expires_in: int = Field(..., description="Access token expiration in seconds")
    refresh_expires_in: int = Field(..., description="Refresh token expiration in seconds")
    user: UserResponse = Field(..., description="User information")
    mfa_enabled: bool = Field(..., description="MFA enabled status")
    requires_mfa: bool = Field(False, description="MFA required for next step")
    requires_verification: bool = Field(False, description="Email verification required")
    session_id: Optional[str] = Field(None, description="Session ID for tracking")
    security_score: int = Field(default=0, description="User security score")


class AuthenticationError(BaseModel):
    """Authentication error response schema"""
    error: str = Field(..., description="Error type")
    message: str = Field(..., description="Error message")
    error_code: str = Field(..., description="Machine-readable error code")
    retry_after: Optional[int] = Field(None, description="Seconds to wait before retry")
    mfa_required: bool = Field(False, description="MFA is required")
    verification_required: bool = Field(False, description="Email verification required")


# Session Management Schemas
class ActiveSession(BaseModel):
    """Enhanced active session schema with comprehensive device information"""
    id: str = Field(..., description="Session ID")
    session_token: str = Field(..., description="Session token (masked)")
    device_info: Optional[Dict[str, Any]] = Field(None, description="Device and browser information")
    ip_address: Optional[str] = Field(None, description="Session IP address")
    location: Optional[Dict[str, str]] = Field(None, description="Geolocation data")

    # Timestamps
    created_at: datetime = Field(..., description="Session creation timestamp")
    last_accessed: datetime = Field(..., description="Last access timestamp")
    expires_at: datetime = Field(..., description="Session expiration timestamp")

    # Session status
    is_active: bool = Field(..., description="Whether session is active")
    is_current: bool = Field(False, description="Whether this is the current session")
    is_suspicious: bool = Field(False, description="Whether session is flagged as suspicious")

    # Security information
    suspicious_reasons: List[str] = Field(default_factory=list, description="Reasons for suspicious flag")
    risk_score: int = Field(default=0, description="Session risk score")

    class Config:
        from_attributes = True


class ActiveSessionsResponse(BaseModel):
    """Enhanced active sessions response"""
    sessions: List[ActiveSession] = Field(..., description="List of active sessions")
    total: int = Field(..., description="Total number of sessions")
    current_session_id: Optional[str] = Field(None, description="Current session ID")

    # Statistics
    max_sessions_allowed: int = Field(5, description="Maximum sessions allowed")
    can_add_more: bool = Field(True, description="Whether user can add more sessions")


class RevokeSessionRequest(BaseModel):
    """Request to revoke a specific session"""
    session_id: str = Field(..., description="Session ID to revoke")
    reason: Optional[str] = Field(None, description="Reason for revocation")


class SessionManagementSettings(BaseModel):
    """Session management settings"""
    max_concurrent_sessions: int = Field(5, ge=1, le=10, description="Maximum concurrent sessions")
    session_timeout_minutes: int = Field(1440, ge=30, description="Session timeout in minutes")
    require_device_verification: bool = Field(False, description="Require device verification for new sessions")
    auto_revoke_old_sessions: bool = Field(True, description="Automatically revoke oldest sessions when limit reached")
    suspicious_activity_detection: bool = Field(True, description="Enable suspicious activity detection")


class DeviceFingerprint(BaseModel):
    """Device fingerprint for enhanced security"""
    user_agent: str = Field(..., description="User agent string")
    screen_resolution: Optional[str] = Field(None, description="Screen resolution")
    timezone: Optional[str] = Field(None, description="Browser timezone")
    language: Optional[str] = Field(None, description="Browser language")
    platform: Optional[str] = Field(None, description="Platform/OS")
    browser: Optional[str] = Field(None, description="Browser name and version")
    ip_address: str = Field(..., description="Client IP address")

    # Additional fingerprint data
    canvas_fingerprint: Optional[str] = Field(None, description="Canvas fingerprint hash")
    webgl_fingerprint: Optional[str] = Field(None, description="WebGL fingerprint hash")
    fonts: Optional[List[str]] = Field(None, description="Available fonts")

    def calculate_fingerprint_score(self) -> str:
        """Calculate a simple fingerprint score"""
        score = 0
        if self.user_agent:
            score += 1
        if self.screen_resolution:
            score += 1
        if self.timezone:
            score += 1
        if self.language:
            score += 1
        if self.canvas_fingerprint:
            score += 2
        if self.webgl_fingerprint:
            score += 2

        return f"{score}/8"


# Role and Permission Schemas
class RoleResponse(BaseModel):
    """Role response schema"""
    id: str
    name: str
    description: Optional[str]
    is_system_role: bool


class UserRolesResponse(BaseModel):
    """User roles response schema"""
    roles: List[RoleResponse]
    permissions: List[str]


class AssignRoleRequest(BaseModel):
    """Assign role request schema"""
    user_id: str
    role_name: str


# Password Management Schemas
class PasswordReset(BaseModel):
    """Password reset request schema"""
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    """Password reset confirmation schema"""
    token: str
    new_password: str = Field(..., min_length=8)


class ChangePassword(BaseModel):
    """Change password schema"""
    current_password: str
    new_password: str = Field(..., min_length=8)


# Security Event Schemas
class SecurityEvent(BaseModel):
    """Enhanced security event schema with comprehensive audit information"""
    id: str = Field(..., description="Event ID")
    event_type: SecurityEventType = Field(..., description="Type of security event")
    event_category: str = Field(..., description="Event category (authentication, authorization, etc.)")
    severity: SecuritySeverity = Field(..., description="Event severity level")
    user_id: Optional[str] = Field(None, description="User ID if event is user-specific")

    # Request information
    ip_address: Optional[str] = Field(None, description="Client IP address")
    user_agent: Optional[str] = Field(None, description="User agent string")
    request_id: Optional[str] = Field(None, description="Request ID for tracing")

    # Event details
    details: Dict[str, Any] = Field(default_factory=dict, description="Event-specific details")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional metadata")

    # Location information
    country: Optional[str] = Field(None, description="Country from IP geolocation")
    city: Optional[str] = Field(None, description="City from IP geolocation")

    # Timestamps
    timestamp: datetime = Field(..., description="Event timestamp")

    # Risk assessment
    risk_score: int = Field(default=0, description="Risk score (0-100)")
    is_anomalous: bool = Field(default=False, description="Whether event is considered anomalous")

    class Config:
        use_enum_values = True


class SecurityEventCreate(BaseModel):
    """Schema for creating security events"""
    event_type: SecurityEventType = Field(..., description="Type of security event")
    event_category: str = Field(..., description="Event category")
    severity: SecuritySeverity = Field(SecuritySeverity.INFO, description="Event severity")
    user_id: Optional[str] = Field(None, description="User ID")
    ip_address: Optional[str] = Field(None, description="Client IP address")
    user_agent: Optional[str] = Field(None, description="User agent string")
    request_id: Optional[str] = Field(None, description="Request ID")
    details: Dict[str, Any] = Field(default_factory=dict, description="Event details")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional metadata")

    class Config:
        use_enum_values = True


class SecurityEventsResponse(BaseModel):
    """Enhanced security events response with pagination"""
    events: List[SecurityEvent] = Field(..., description="List of security events")
    total: int = Field(..., description="Total number of events")
    page: int = Field(1, description="Current page number")
    per_page: int = Field(20, description="Events per page")
    total_pages: int = Field(..., description="Total number of pages")
    has_next: bool = Field(..., description="Whether there are more pages")
    has_prev: bool = Field(..., description="Whether there are previous pages")

    # Filtering information
    filters: Dict[str, Any] = Field(default_factory=dict, description="Applied filters")

    class Config:
        use_enum_values = True


class SecurityEventQuery(BaseModel):
    """Schema for querying security events"""
    user_id: Optional[str] = Field(None, description="Filter by user ID")
    event_types: Optional[List[SecurityEventType]] = Field(None, description="Filter by event types")
    severity_levels: Optional[List[SecuritySeverity]] = Field(None, description="Filter by severity")
    ip_address: Optional[str] = Field(None, description="Filter by IP address")

    # Date range
    start_date: Optional[datetime] = Field(None, description="Start date for filtering")
    end_date: Optional[datetime] = Field(None, description="End date for filtering")

    # Pagination
    page: int = Field(1, ge=1, description="Page number")
    per_page: int = Field(20, ge=1, le=100, description="Items per page")

    # Sorting
    sort_by: str = Field("timestamp", description="Field to sort by")
    sort_order: str = Field("desc", pattern="^(asc|desc)$", description="Sort order")

    class Config:
        use_enum_values = True


# Alias for backwards compatibility
User = UserResponse