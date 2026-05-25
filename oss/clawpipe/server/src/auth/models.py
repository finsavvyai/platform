"""Pydantic models for authentication."""

from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class TokenRequest(BaseModel):
    """OAuth2 password flow token request."""

    username: str = Field(..., description="Username or email address")
    password: str = Field(..., description="Password")


class RegisterRequest(BaseModel):
    """User registration request."""

    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(..., min_length=8)
    full_name: Optional[str] = Field(None, max_length=200)


class TokenResponse(BaseModel):
    """OAuth2 token response."""

    access_token: str
    token_type: str = "bearer"
    expires_in: int = Field(default=3600, description="Seconds until expiry")


class User(BaseModel):
    """User model returned from protected endpoints."""

    id: str
    username: str
    email: str
    full_name: Optional[str] = None
    is_active: bool = True

    model_config = {"from_attributes": True}
