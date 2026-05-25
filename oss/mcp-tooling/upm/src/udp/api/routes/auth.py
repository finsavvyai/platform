"""
Authentication API endpoints.

Provides user authentication, token management, and session handling
endpoints for the UPM platform.
"""

from typing import Any, Optional

import structlog
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field, validator
from udp.core.models.user import User
from udp.security.auth import AuthenticationError, TokenError, auth_service
from udp.security.rbac import get_current_user

logger = structlog.get_logger()
router = APIRouter(prefix="/auth", tags=["authentication"])
security = HTTPBearer(auto_error=False)


# Request/Response Schemas
class LoginRequest(BaseModel):
    """Login request schema."""

    email: str = Field(..., description="User email address")
    password: str = Field(..., min_length=1, description="User password")
    remember_me: bool = Field(False, description="Remember me for extended session")

    @validator("email")
    def validate_email(cls, v):
        """Validate email format."""
        if not v or "@" not in v:
            raise ValueError("Invalid email format")
        return v.lower().strip()


class LoginResponse(BaseModel):
    """Login response schema."""

    user: dict[str, Any] = Field(..., description="User information")
    access_token: str = Field(..., description="JWT access token")
    refresh_token: str = Field(..., description="JWT refresh token")
    session_id: str = Field(..., description="Session identifier")
    token_type: str = Field(..., description="Token type (Bearer)")
    expires_in: int = Field(..., description="Token expiration in seconds")
    permissions: list = Field(..., description="User permissions")


class RefreshTokenRequest(BaseModel):
    """Refresh token request schema."""

    refresh_token: str = Field(..., description="JWT refresh token")


class RefreshTokenResponse(BaseModel):
    """Refresh token response schema."""

    access_token: str = Field(..., description="New JWT access token")
    refresh_token: str = Field(..., description="New JWT refresh token")
    token_type: str = Field(..., description="Token type (Bearer)")
    expires_in: int = Field(..., description="Token expiration in seconds")


class SessionInfo(BaseModel):
    """Session information schema."""

    session_id: str = Field(..., description="Session ID")
    created_at: str = Field(..., description="Session creation time")
    last_accessed: str = Field(..., description="Last access time")
    ip_address: Optional[str] = Field(None, description="IP address")
    user_agent: Optional[str] = Field(None, description="User agent")
    current: bool = Field(False, description="Is this the current session")


class SessionsResponse(BaseModel):
    """User sessions response schema."""

    sessions: list[SessionInfo] = Field(..., description="List of user sessions")
    total: int = Field(..., description="Total number of sessions")


# Authentication Endpoints


@router.post("/login", response_model=LoginResponse, status_code=status.HTTP_200_OK)
async def login(login_data: LoginRequest, request: Request) -> LoginResponse:
    """
    Authenticate user and return tokens.

    Authenticates user with email and password, returns JWT tokens
    and creates a session for tracking.
    """
    try:
        # Get client information
        ip_address = request.client.host if request.client else None
        user_agent = request.headers.get("user-agent")

        # Authenticate user
        result = await auth_service.authenticate_user(
            email=login_data.email,
            password=login_data.password,
            ip_address=ip_address,
            user_agent=user_agent,
        )

        logger.info("User logged in successfully", email=login_data.email)

        return LoginResponse(**result)

    except AuthenticationError as e:
        logger.warning("Authentication failed", email=login_data.email, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception as e:
        logger.error("Login failed unexpectedly", email=login_data.email, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication service unavailable",
        )


@router.post(
    "/refresh", response_model=RefreshTokenResponse, status_code=status.HTTP_200_OK
)
async def refresh_token(refresh_data: RefreshTokenRequest) -> RefreshTokenResponse:
    """
    Refresh JWT access token.

    Uses a valid refresh token to generate new access and refresh tokens.
    """
    try:
        result = await auth_service.refresh_token(refresh_data.refresh_token)

        logger.info("Token refreshed successfully")
        return RefreshTokenResponse(**result)

    except TokenError as e:
        logger.warning("Token refresh failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception as e:
        logger.error("Token refresh failed unexpectedly", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Token refresh service unavailable",
        )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    authorization: Optional[HTTPAuthorizationCredentials] = Depends(security),
    session_id: Optional[str] = None,
) -> None:
    """
    Logout user and invalidate session.

    Invalidates the current session and optional refresh token.
    """
    try:
        # Extract session ID from token if not provided
        if not session_id and authorization and authorization.credentials:
            try:
                payload = await auth_service.validate_token(authorization.credentials)
                # For now, we'll need to implement session extraction properly
                # This is a simplified version
            except Exception:
                pass

        if session_id:
            success = await auth_service.logout_user(session_id)
            if success:
                logger.info("User logged out successfully", session_id=session_id)
            else:
                logger.warning("Session not found during logout", session_id=session_id)

    except Exception as e:
        logger.error("Logout failed unexpectedly", error=str(e))
        # Don't raise error for logout failures to avoid user frustration


@router.post("/logout-all", status_code=status.HTTP_204_NO_CONTENT)
async def logout_all_sessions(current_user: User = Depends(get_current_user)) -> None:
    """
    Logout user from all sessions.

    Invalidates all active sessions for the authenticated user.
    """
    try:
        deleted_count = await auth_service.logout_user_all_sessions(
            str(current_user.id)
        )
        logger.info(
            "User logged out from all sessions",
            user_id=str(current_user.id),
            deleted_count=deleted_count,
        )

    except Exception as e:
        logger.error(
            "Logout all sessions failed", user_id=str(current_user.id), error=str(e)
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to logout from all sessions",
        )


@router.get("/me")
async def get_current_user_info(
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """
    Get current authenticated user information.

    Returns details about the currently authenticated user.
    """
    try:
        return {
            "id": str(current_user.id),
            "email": current_user.email,
            "username": current_user.username,
            "name": current_user.name,
            "status": current_user.status,
            "created_at": current_user.created_at.isoformat()
            if current_user.created_at
            else None,
            "last_login_at": current_user.last_login_at,
            "is_locked": current_user.is_locked,
            "failed_login_attempts": current_user.failed_login_attempts,
        }

    except Exception as e:
        logger.error(
            "Failed to get user info", user_id=str(current_user.id), error=str(e)
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve user information",
        )
