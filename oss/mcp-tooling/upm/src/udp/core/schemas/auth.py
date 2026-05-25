"""
Authentication schemas for Universal Dependency Platform.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, validator


class UserBase(BaseModel):
    """Base user schema."""

    email: EmailStr = Field(..., description="User email address")
    full_name: Optional[str] = Field(None, max_length=255, description="Full name")
    is_active: bool = Field(True, description="Whether the user is active")
    is_superuser: bool = Field(False, description="Whether the user is a superuser")


class UserCreate(UserBase):
    """User creation schema."""

    password: str = Field(
        ..., min_length=8, max_length=128, description="User password"
    )

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
    """User update schema."""

    email: Optional[EmailStr] = Field(None, description="User email address")
    full_name: Optional[str] = Field(None, max_length=255, description="Full name")
    is_active: Optional[bool] = Field(None, description="Whether the user is active")
    password: Optional[str] = Field(
        None, min_length=8, max_length=128, description="User password"
    )


class UserResponse(UserBase):
    """User response schema."""

    id: str = Field(..., description="User ID")
    created_at: datetime = Field(..., description="Creation timestamp")
    updated_at: datetime = Field(..., description="Last update timestamp")
    last_login: Optional[datetime] = Field(None, description="Last login timestamp")

    class Config:
        from_attributes = True


class Token(BaseModel):
    """Token response schema."""

    access_token: str = Field(..., description="Access token")
    token_type: str = Field("bearer", description="Token type")
    expires_in: int = Field(..., description="Token expiration time in seconds")
    refresh_token: Optional[str] = Field(None, description="Refresh token")


class TokenData(BaseModel):
    """Token data schema."""

    email: Optional[str] = None


class LoginRequest(BaseModel):
    """Login request schema."""

    username: str = Field(..., description="Username or email")
    password: str = Field(..., description="Password")


class PasswordReset(BaseModel):
    """Password reset schema."""

    email: EmailStr = Field(..., description="User email address")


class PasswordResetConfirm(BaseModel):
    """Password reset confirmation schema."""

    token: str = Field(..., description="Reset token")
    password: str = Field(..., min_length=8, max_length=128, description="New password")
