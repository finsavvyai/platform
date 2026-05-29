"""
Authentication dependencies for SDLC.ai DLP Service API.

This module provides authentication and authorization dependencies for API endpoints,
including JWT token validation and tenant isolation.
"""

import logging
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from datetime import datetime, timedelta

from app.core.config import get_settings

logger = logging.getLogger(__name__)

settings = get_settings()
security = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> dict:
    """
    Get the current authenticated user from JWT token.

    This dependency validates the JWT token and extracts user information.
    In a production environment, this would integrate with your identity provider.
    """
    if settings.bypass_auth_for_testing:
        # Mock user for testing
        return {
            "id": "test-user-id",
            "email": "test@example.com",
            "name": "Test User",
            "roles": ["user"],
            "tenant_id": "default",
        }

    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        # Decode JWT token
        payload = jwt.decode(
            credentials.credentials,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
        )

        # Check token expiration
        exp = payload.get("exp")
        if exp and datetime.fromtimestamp(exp) < datetime.utcnow():
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has expired",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Extract user information
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: missing user ID",
            )

        return {
            "id": user_id,
            "email": payload.get("email"),
            "name": payload.get("name"),
            "roles": payload.get("roles", []),
            "tenant_id": payload.get("tenant_id"),
        }

    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_current_tenant(current_user: dict = Depends(get_current_user)) -> str:
    """
    Get the current tenant ID from the authenticated user.

    This dependency extracts the tenant ID from the authenticated user
    and validates tenant access permissions.
    """
    tenant_id = current_user.get("tenant_id")

    if not tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is not associated with a tenant",
        )

    # In a production environment, you might want to validate that the tenant
    # is active and has access to the DLP service

    return tenant_id


async def require_admin_role(current_user: dict = Depends(get_current_user)) -> dict:
    """
    Require admin role for the current user.

    This dependency checks if the current user has admin privileges.
    """
    user_roles = current_user.get("roles", [])

    if "admin" not in user_roles and "super_admin" not in user_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required",
        )

    return current_user


async def validate_tenant_access(
    tenant_id: str, current_user: dict = Depends(get_current_user)
) -> dict:
    """
    Validate that the current user has access to the specified tenant.

    This dependency validates tenant access permissions for cross-tenant operations.
    """
    user_tenant_id = current_user.get("tenant_id")

    # Allow access if user is in the same tenant
    if user_tenant_id == tenant_id:
        return current_user

    # Allow cross-tenant access for admin users
    user_roles = current_user.get("roles", [])
    if any(role in ["admin", "super_admin"] for role in user_roles):
        logger.info(
            f"Admin user {current_user['id']} accessing cross-tenant {tenant_id}"
        )
        return current_user

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Access denied to tenant",
    )


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create a JWT access token.

    This utility function creates JWT tokens for authentication.
    """
    to_encode = data.copy()

    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(
            minutes=settings.jwt_access_token_expire_minutes
        )

    to_encode.update({"exp": expire})

    encoded_jwt = jwt.encode(
        to_encode, settings.jwt_secret_key, algorithm=settings.jwt_algorithm
    )

    return encoded_jwt
