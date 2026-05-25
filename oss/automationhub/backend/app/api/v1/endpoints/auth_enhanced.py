"""
Enhanced Authentication endpoints with MFA, JWT refresh, and OAuth support
"""

from datetime import timedelta, datetime
from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.core.database import get_db
from app.core.auth import authenticate_user
from app.core.config import settings
from app.schemas.auth import (
    TokenPair, MFASetupResponse, MFAVerifyRequest, EnhancedLoginRequest,
    LoginResponse, RefreshTokenRequest, OAuthCallbackRequest, 
    OAuthProvidersResponse, OAuthAuthorizationResponse, ActiveSessionsResponse,
    UserRolesResponse, AssignRoleRequest, MFAStatusResponse
)
from app.services.jwt_service import JWTService
from app.services.mfa_service import MFAService
from app.services.oauth_service import OAuthService
from app.services.rbac_service import RBACService, Permission
from app.middleware.auth_middleware import get_current_active_user, require_admin
from app.models.user import User

router = APIRouter()

# Initialize services
jwt_service = JWTService()
mfa_service = MFAService()
oauth_service = OAuthService()
rbac_service = RBACService()


@router.post("/login", response_model=TokenPair)
async def enhanced_login(
    request: Request,
    login_data: EnhancedLoginRequest,
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Enhanced login with MFA support and refresh token rotation
    """
    # Authenticate user with email/password
    user = await authenticate_user(db, login_data.email, login_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Inactive user"
        )
    
    # Check if MFA is enabled
    if mfa_service.is_mfa_enabled(user):
        if not login_data.mfa_token:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="MFA token required",
                headers={"X-MFA-Required": "true"}
            )
        
        # Verify MFA token
        if not await mfa_service.verify_mfa_token(user, login_data.mfa_token):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid MFA token"
            )
        
        # Set MFA verification in session
        request.session["mfa_verified"] = True
        request.session["mfa_user_id"] = str(user.id)
        request.session["mfa_verified_at"] = datetime.utcnow().isoformat()
    
    # Create token pair
    access_token, refresh_token = await jwt_service.create_token_pair(
        db, user, login_data.device_info
    )
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        "user_id": str(user.id),
        "mfa_enabled": mfa_service.is_mfa_enabled(user)
    }


@router.post("/refresh", response_model=TokenPair)
async def refresh_token(
    refresh_data: RefreshTokenRequest,
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Refresh access token using refresh token rotation
    """
    result = await jwt_service.refresh_access_token(
        db, refresh_data.refresh_token, refresh_data.device_info
    )
    
    if not result:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token"
        )
    
    access_token, new_refresh_token = result
    
    return {
        "access_token": access_token,
        "refresh_token": new_refresh_token,
        "token_type": "bearer",
        "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    }


@router.post("/logout")
async def logout(
    request: Request,
    refresh_token: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Logout user and revoke refresh token
    """
    # Revoke refresh token
    await jwt_service.revoke_refresh_token(db, refresh_token)
    
    # Clear MFA session
    request.session.pop("mfa_verified", None)
    request.session.pop("mfa_user_id", None)
    request.session.pop("mfa_verified_at", None)
    
    return {"message": "Successfully logged out"}


@router.post("/logout-all")
async def logout_all_sessions(
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Logout from all sessions (revoke all refresh tokens)
    """
    await jwt_service.revoke_all_user_tokens(db, str(current_user.id))
    
    # Clear MFA session
    request.session.clear()
    
    return {"message": "Successfully logged out from all sessions"}


# MFA Endpoints
@router.get("/mfa/status", response_model=MFAStatusResponse)
async def get_mfa_status(
    current_user: User = Depends(get_current_active_user)
) -> Any:
    """
    Get MFA status for current user
    """
    is_enabled = mfa_service.is_mfa_enabled(current_user)
    backup_codes_remaining = None
    
    if is_enabled and current_user.preferences:
        backup_codes = current_user.preferences.get("mfa_backup_codes", [])
        backup_codes_remaining = len(backup_codes)
    
    return {
        "enabled": is_enabled,
        "backup_codes_remaining": backup_codes_remaining
    }


@router.post("/mfa/setup", response_model=MFASetupResponse)
async def setup_mfa(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Setup MFA for current user
    """
    if mfa_service.is_mfa_enabled(current_user):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="MFA is already enabled"
        )
    
    setup_data = await mfa_service.setup_mfa(db, current_user)
    
    return {
        "secret": setup_data["secret"],
        "qr_code": setup_data["qr_code"],
        "backup_codes": setup_data["backup_codes"]
    }


@router.post("/mfa/verify-setup")
async def verify_mfa_setup(
    verify_data: MFAVerifyRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Verify MFA setup with TOTP token
    """
    if await mfa_service.verify_mfa_setup(db, current_user, verify_data.token):
        return {"message": "MFA enabled successfully"}
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid MFA token"
        )


@router.post("/mfa/disable")
async def disable_mfa(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Disable MFA for current user
    """
    if await mfa_service.disable_mfa(db, current_user):
        return {"message": "MFA disabled successfully"}
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to disable MFA"
        )


# OAuth Endpoints
@router.get("/oauth/providers", response_model=OAuthProvidersResponse)
async def get_oauth_providers(
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Get available OAuth providers
    """
    providers = await oauth_service.get_available_providers(db)
    return {"providers": providers}


@router.get("/oauth/{provider}/authorize", response_model=OAuthAuthorizationResponse)
async def oauth_authorize(
    provider: str,
    redirect_uri: str,
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Get OAuth authorization URL
    """
    auth_url = await oauth_service.get_authorization_url(db, provider, redirect_uri)
    
    if not auth_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"OAuth provider {provider} not available"
        )
    
    return {"authorization_url": auth_url}


@router.post("/oauth/callback", response_model=TokenPair)
async def oauth_callback(
    callback_data: OAuthCallbackRequest,
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Handle OAuth callback and create user session
    """
    # Handle OAuth callback
    oauth_result = await oauth_service.handle_callback(
        db, callback_data.provider, callback_data.code, 
        callback_data.state, callback_data.redirect_uri
    )
    
    if not oauth_result:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OAuth authentication failed"
        )
    
    # Find or create user
    user = await oauth_service.find_or_create_user(db, oauth_result)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to create user from OAuth data"
        )
    
    # Create token pair
    access_token, refresh_token = await jwt_service.create_token_pair(db, user)
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        "user_id": str(user.id),
        "mfa_enabled": mfa_service.is_mfa_enabled(user)
    }


# Session Management
@router.get("/sessions", response_model=ActiveSessionsResponse)
async def get_active_sessions(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Get active sessions for current user
    """
    sessions = await jwt_service.get_user_active_sessions(db, str(current_user.id))
    
    session_list = [
        {
            "id": str(session.id),
            "device_info": session.device_info,
            "created_at": session.created_at,
            "last_used": session.last_used,
            "is_current": False  # Could be enhanced to detect current session
        }
        for session in sessions
    ]
    
    return {"sessions": session_list}


# RBAC Endpoints
@router.get("/roles", response_model=UserRolesResponse)
async def get_user_roles(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Get roles and permissions for current user
    """
    roles = await rbac_service.get_user_roles(db, str(current_user.id))
    permissions = await rbac_service.get_user_permissions(db, str(current_user.id))
    
    return {
        "roles": roles,
        "permissions": list(permissions)
    }


@router.post("/admin/assign-role")
async def assign_role(
    role_data: AssignRoleRequest,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Assign role to user (admin only)
    """
    success = await rbac_service.assign_role_to_user(
        db, role_data.user_id, role_data.role_name
    )
    
    if success:
        return {"message": f"Role {role_data.role_name} assigned successfully"}
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to assign role"
        )


@router.delete("/admin/remove-role")
async def remove_role(
    role_data: AssignRoleRequest,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """
    Remove role from user (admin only)
    """
    success = await rbac_service.remove_role_from_user(
        db, role_data.user_id, role_data.role_name
    )
    
    if success:
        return {"message": f"Role {role_data.role_name} removed successfully"}
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to remove role"
        )