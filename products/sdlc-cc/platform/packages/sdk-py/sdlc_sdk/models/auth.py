"""
Authentication models for SDLC.ai SDK

Provides models for authentication requests and responses.
"""

from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any, Literal
from pydantic import Field, validator, EmailStr

from .base import BaseModel, TimestampModel, SuccessResponse


class TokenInfo(BaseModel):
    """JWT token information."""

    access_token: str = Field(..., description="Access token")
    token_type: str = Field("Bearer", description="Token type")
    expires_in: int = Field(..., description="Token expiration in seconds")
    refresh_token: Optional[str] = Field(None, description="Refresh token")
    scope: Optional[str] = Field(None, description="Token scope")

    @property
    def expires_at(self) -> datetime:
        """Calculate expiration datetime."""
        return datetime.utcnow() + timedelta(seconds=self.expires_in)


class LoginRequest(BaseModel):
    """Login request model."""

    email: EmailStr = Field(..., description="User email")
    password: str = Field(..., min_length=8, description="User password")
    tenant_id: Optional[str] = Field(None, description="Tenant ID")
    remember_me: bool = Field(False, description="Remember me")
    mfa_code: Optional[str] = Field(None, description="MFA code if required")


class LoginResponse(BaseModel):
    """Login response model."""

    user: "User" = Field(..., description="User information")
    token: TokenInfo = Field(..., description="Token information")
    tenant: Optional["Tenant"] = Field(None, description="Tenant information")
    permissions: List[str] = Field(default_factory=list, description="User permissions")
    session_id: str = Field(..., description="Session ID")


class AuthResponse(BaseModel):
    """Authentication response model."""

    authenticated: bool = Field(..., description="Authentication status")
    user: Optional["User"] = Field(None, description="User information")
    token: Optional[str] = Field(None, description="JWT token")
    expires_at: Optional[datetime] = Field(None, description="Token expiration")
    permissions: List[str] = Field(default_factory=list, description="User permissions")
    tenant_id: Optional[str] = Field(None, description="Active tenant ID")
    roles: List[str] = Field(default_factory=list, description="User roles")


class OAuthTokenRequest(BaseModel):
    """OAuth token request model."""

    grant_type: Literal["authorization_code", "client_credentials", "refresh_token"] = (
        Field(..., description="Grant type")
    )
    client_id: str = Field(..., description="OAuth client ID")
    client_secret: str = Field(..., description="OAuth client secret")
    code: Optional[str] = Field(None, description="Authorization code")
    redirect_uri: Optional[str] = Field(None, description="Redirect URI")
    refresh_token: Optional[str] = Field(None, description="Refresh token")
    scope: Optional[str] = Field(None, description="Requested scope")


class OAuthTokenResponse(BaseModel):
    """OAuth token response model."""

    access_token: str = Field(..., description="Access token")
    token_type: str = Field("Bearer", description="Token type")
    expires_in: int = Field(..., description="Expires in seconds")
    refresh_token: Optional[str] = Field(None, description="Refresh token")
    scope: Optional[str] = Field(None, description="Granted scope")
    id_token: Optional[str] = Field(None, description="ID token")


class MFAChallenge(BaseModel):
    """MFA challenge model."""

    challenge_id: str = Field(..., description="Challenge ID")
    methods: List[str] = Field(..., description="Available MFA methods")
    expires_at: datetime = Field(..., description="Challenge expiration")
    attempts_remaining: int = Field(..., ge=0, description="Remaining attempts")


class MFAVerification(BaseModel):
    """MFA verification model."""

    challenge_id: str = Field(..., description="Challenge ID")
    method: str = Field(..., description="MFA method used")
    code: str = Field(..., description="Verification code")
    trust_device: bool = Field(False, description="Trust this device")


class APIKeyCreate(BaseModel):
    """API key creation request."""

    name: str = Field(..., description="API key name")
    description: Optional[str] = Field(None, description="API key description")
    permissions: List[str] = Field(default_factory=list, description="Key permissions")
    expires_at: Optional[datetime] = Field(None, description="Key expiration")
    ip_whitelist: Optional[List[str]] = Field(None, description="Allowed IP addresses")


class APIKeyResponse(BaseModel):
    """API key response model."""

    id: str = Field(..., description="API key ID")
    name: str = Field(..., description="API key name")
    api_key: str = Field(..., description="API key value (shown only on creation)")
    prefix: str = Field(..., description="API key prefix")
    permissions: List[str] = Field(..., description="Key permissions")
    created_at: datetime = Field(..., description="Creation time")
    expires_at: Optional[datetime] = Field(None, description="Expiration time")
    last_used_at: Optional[datetime] = Field(None, description="Last used time")
    is_active: bool = Field(True, description="Active status")


class SessionInfo(BaseModel):
    """Session information model."""

    id: str = Field(..., description="Session ID")
    user_id: str = Field(..., description="User ID")
    tenant_id: Optional[str] = Field(None, description="Tenant ID")
    created_at: datetime = Field(..., description="Session creation")
    last_activity: datetime = Field(..., description="Last activity")
    expires_at: datetime = Field(..., description="Session expiration")
    ip_address: str = Field(..., description="IP address")
    user_agent: str = Field(..., description="User agent")
    is_active: bool = Field(True, description="Session status")


class PasswordResetRequest(BaseModel):
    """Password reset request model."""

    email: EmailStr = Field(..., description="User email")
    tenant_id: Optional[str] = Field(None, description="Tenant ID")


class PasswordResetConfirm(BaseModel):
    """Password reset confirmation model."""

    token: str = Field(..., description="Reset token")
    new_password: str = Field(..., min_length=8, description="New password")
    confirm_password: str = Field(..., min_length=8, description="Confirm password")

    @validator("confirm_password")
    def passwords_match(cls, v, values):
        """Validate passwords match."""
        if "new_password" in values and v != values["new_password"]:
            raise ValueError("Passwords do not match")
        return v


class PasswordChange(BaseModel):
    """Password change model."""

    current_password: str = Field(..., description="Current password")
    new_password: str = Field(..., min_length=8, description="New password")
    confirm_password: str = Field(..., min_length=8, description="Confirm password")

    @validator("confirm_password")
    def passwords_match(cls, v, values):
        """Validate passwords match."""
        if "new_password" in values and v != values["new_password"]:
            raise ValueError("Passwords do not match")
        return v


# Import to avoid circular dependencies
from .user import User
from .tenant import Tenant
