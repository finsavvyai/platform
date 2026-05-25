"""
Enhanced Authentication endpoints with comprehensive MFA support

This module provides complete authentication functionality including:
- User registration and login
- Multi-factor authentication (TOTP, SMS, backup codes)
- MFA setup and management
- Session management
- Password management
- Security event logging

Author: Claude Code Implementation
Updated: 2025-01-06
"""

from fastapi import APIRouter, HTTPException, Depends, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
import logging
import uuid

from app.core.database import get_db
from app.core.config import settings
from app.core.auth import (
    authenticate_user,
    create_access_token,
    get_current_active_user,
    get_password_hash
)
from app.models.user import User
from app.models.organization import Organization
from app.services.mfa_service import MFAService
from app.schemas.auth import (
    UserCreate,
    UserResponse,
    Token,
    ChangePassword,
    MFAVerifyRequest,
    MFASetupResponse,
    MFAStatusResponse
)

router = APIRouter()
logger = logging.getLogger(__name__)

# Initialize MFA service
mfa_service = MFAService()


def get_client_info(request: Request) -> Dict[str, Any]:
    """Extract client information for security logging"""
    return {
        'ip_address': request.client.host if request.client else None,
        'user_agent': request.headers.get('User-Agent'),
        'request_id': request.headers.get('X-Request-ID'),
    }


@router.post("/register", response_model=UserResponse)
async def register(
    user_data: UserCreate,
    db: AsyncSession = Depends(get_db)
):
    """Register a new user"""
    try:
        # Check if user already exists
        result = await db.execute(select(User).where(User.email == user_data.email))
        existing_user = result.scalar_one_or_none()
        
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
        
        # Create organization if provided
        organization_id = None
        if user_data.organization_name:
            # Check if organization exists
            org_result = await db.execute(
                select(Organization).where(Organization.name == user_data.organization_name)
            )
            organization = org_result.scalar_one_or_none()
            
            if not organization:
                # Create new organization
                organization = Organization(
                    id=uuid.uuid4(),
                    name=user_data.organization_name,
                    domain=f"{user_data.organization_name.lower().replace(' ', '-')}.local",
                    subscription_plan="free"
                )
                db.add(organization)
                await db.flush()  # Get the ID
            
            organization_id = organization.id
        
        # Create new user
        hashed_password = get_password_hash(user_data.password)
        new_user = User(
            id=uuid.uuid4(),
            email=user_data.email,
            hashed_password=hashed_password,
            full_name=user_data.full_name,
            organization_id=organization_id,
            is_active=True,
            is_verified=False,  # Email verification can be added later
            subscription_tier="free"
        )
        
        db.add(new_user)
        await db.commit()
        await db.refresh(new_user)
        
        logger.info(f"New user registered: {user_data.email}")
        
        return UserResponse(
            id=str(new_user.id),
            email=new_user.email,
            full_name=new_user.full_name,
            is_active=new_user.is_active,
            subscription_tier=new_user.subscription_tier,
            is_verified=new_user.is_verified,
            organization_id=str(new_user.organization_id) if new_user.organization_id else None,
            created_at=new_user.created_at,
            last_login=new_user.last_login
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Registration error: {e}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Registration failed"
        )


@router.post("/login", response_model=Token)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
    mfa_token: Optional[str] = None,
    request: Request = None
):
    """
    Enhanced login user endpoint with MFA support

    Supports multiple authentication flows:
    - Standard password authentication
    - Password + TOTP token
    - Password + backup code
    """
    try:
        client_info = get_client_info(request) if request else {}

        # Authenticate user with password
        user = await authenticate_user(db, form_data.username, form_data.password)

        if not user:
            logger.warning(f"Login failed for {form_data.username} - invalid credentials")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Check if MFA is enabled for the user
        if mfa_service.is_mfa_enabled(user):
            if not mfa_token:
                logger.info(f"MFA required for user {user.email}")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="MFA token required",
                    headers={
                        "WWW-Authenticate": "Bearer",
                        "X-MFA-Required": "true"
                    },
                )

            # Verify MFA token
            mfa_result = await mfa_service.verify_mfa_token(user, mfa_token, context="login")

            if not mfa_result['success']:
                logger.warning(f"MFA verification failed for user {user.email}")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail=mfa_result.get('error', 'Invalid MFA token'),
                    headers={"WWW-Authenticate": "Bearer"},
                )

            logger.info(f"MFA verification successful for user {user.email}")

        # Check if MFA should be enforced
        should_enforce, reason = mfa_service.should_enforce_mfa(user)
        if should_enforce:
            logger.info(f"MFA enforcement triggered for user {user.email}: {reason}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=reason,
                headers={
                    "WWW-Authenticate": "Bearer",
                    "X-MFA-Required": "true",
                    "X-MFA-Enforcement": reason
                },
            )

        # Update user login information
        user.last_login = datetime.utcnow()
        user.last_login_ip = client_info.get('ip_address')
        user.login_count = (user.login_count or 0) + 1

        # Create access token
        access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": str(user.id)},
            expires_delta=access_token_expires
        )

        logger.info(f"User logged in successfully: {user.email}")

        return Token(
            access_token=access_token,
            token_type="bearer",
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
            user=UserResponse(
                id=str(user.id),
                email=user.email,
                full_name=user.full_name,
                is_active=user.is_active,
                subscription_tier=user.subscription_tier,
                is_verified=user.is_verified,
                organization_id=str(user.organization_id) if user.organization_id else None,
                created_at=user.created_at,
                last_login=user.last_login
            )
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Login failed"
        )


@router.post("/logout")
async def logout(current_user: User = Depends(get_current_active_user)):
    """Logout user (invalidate token on client side)"""
    # Note: JWT tokens are stateless, so we can't invalidate them server-side
    # without maintaining a blacklist. For now, we rely on client-side token removal.
    # In a production system, you might want to implement token blacklisting.
    
    logger.info(f"User logged out: {current_user.email}")
    return {"message": "Successfully logged out"}


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_active_user)):
    """Get current user information"""
    return UserResponse(
        id=str(current_user.id),
        email=current_user.email,
        full_name=current_user.full_name,
        is_active=current_user.is_active,
        subscription_tier=current_user.subscription_tier,
        is_verified=current_user.is_verified,
        organization_id=str(current_user.organization_id) if current_user.organization_id else None,
        created_at=current_user.created_at,
        last_login=current_user.last_login
    )


@router.post("/change-password")
async def change_password(
    password_data: ChangePassword,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Change user password"""
    try:
        from app.core.auth import verify_password

        # Verify current password
        if not verify_password(password_data.current_password, current_user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Incorrect current password"
            )

        # Update password
        current_user.hashed_password = get_password_hash(password_data.new_password)
        await db.commit()

        logger.info(f"Password changed for user: {current_user.email}")
        return {"message": "Password changed successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Password change error: {e}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Password change failed"
        )


# ===== MFA ENDPOINTS =====

@router.post("/mfa/setup-totp", response_model=MFASetupResponse)
async def setup_totp_mfa(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Setup TOTP-based MFA for the current user"""
    try:
        result = await mfa_service.setup_totp_mfa(db, current_user)
        return MFASetupResponse(**result)

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"TOTP MFA setup error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to setup TOTP MFA"
        )


@router.post("/mfa/setup-sms")
async def setup_sms_mfa(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Setup SMS-based MFA for the current user"""
    try:
        result = await mfa_service.setup_sms_mfa(db, current_user)
        return result

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"SMS MFA setup error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to setup SMS MFA"
        )


@router.post("/mfa/verify")
async def verify_mfa_setup(
    verification_data: MFAVerifyRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Verify MFA setup and enable it for the user"""
    try:
        result = await mfa_service.verify_mfa_setup(
            db, current_user, verification_data.token
        )

        if result['success']:
            await db.commit()
            return result
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=result.get('error', 'Verification failed')
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"MFA verification error: {e}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="MFA verification failed"
        )


@router.post("/mfa/disable")
async def disable_mfa(
    password: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Disable MFA for the current user (requires password confirmation)"""
    try:
        result = await mfa_service.disable_mfa(db, current_user, password)

        if result['success']:
            await db.commit()
            return result
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=result.get('error', 'Failed to disable MFA')
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"MFA disable error: {e}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to disable MFA"
        )


@router.get("/mfa/status", response_model=MFAStatusResponse)
async def get_mfa_status(
    current_user: User = Depends(get_current_active_user)
):
    """Get current user's MFA status"""
    try:
        status = mfa_service.get_mfa_status(current_user)
        return MFAStatusResponse(**status)

    except Exception as e:
        logger.error(f"MFA status error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get MFA status"
        )


@router.post("/mfa/regenerate-backup-codes")
async def regenerate_backup_codes(
    password: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Regenerate backup codes for MFA recovery"""
    try:
        # Verify password for security
        from app.core.auth import verify_password
        if not verify_password(password, current_user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid password"
            )

        result = await mfa_service.regenerate_backup_codes(db, current_user)

        if result['success']:
            await db.commit()
            return result
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=result.get('error', 'Failed to regenerate backup codes')
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Backup codes regeneration error: {e}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to regenerate backup codes"
        )


@router.post("/mfa/send-sms-code")
async def send_sms_verification_code(
    current_user: User = Depends(get_current_active_user)
):
    """Send SMS verification code for MFA"""
    try:
        result = await mfa_service.send_sms_code(current_user)

        if result['success']:
            return result
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=result.get('error', 'Failed to send SMS code')
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"SMS code sending error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send SMS verification code"
        )


@router.post("/mfa/verify-token")
async def verify_mfa_token(
    token: str,
    current_user: User = Depends(get_current_active_user),
    context: str = "verification"
):
    """
    Verify an MFA token (TOTP or backup code)

    This endpoint can be used for:
    - Testing MFA setup
    - Account recovery
    - Administrative verification
    """
    try:
        result = await mfa_service.verify_mfa_token(current_user, token, context)

        if result['success']:
            return result
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=result.get('error', 'Invalid MFA token')
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"MFA token verification error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to verify MFA token"
        )


@router.get("/mfa/enforcement-policy")
async def get_mfa_enforcement_policy(
    current_user: User = Depends(get_current_active_user)
):
    """Get MFA enforcement policy for the current user"""
    try:
        should_enforce, reason = mfa_service.should_enforce_mfa(current_user)

        return {
            "user_id": str(current_user.id),
            "role": current_user.role,
            "mfa_enabled": mfa_service.is_mfa_enabled(current_user),
            "should_enforce": should_enforce,
            "enforcement_reason": reason if should_enforce else None,
            "mfa_method": mfa_service.get_mfa_method(current_user)
        }

    except Exception as e:
        logger.error(f"MFA enforcement policy error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get MFA enforcement policy"
        )


@router.get("/mfa/statistics")
async def get_mfa_statistics(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get MFA usage statistics (admin only)

    This endpoint provides comprehensive MFA adoption and usage statistics
    for administrative reporting and compliance monitoring.
    """
    try:
        # Check if user has admin privileges
        if not current_user.is_staff and not current_user.is_superuser:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin privileges required"
            )

        statistics = await mfa_service.get_mfa_statistics(db)
        return statistics

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"MFA statistics error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get MFA statistics"
        )