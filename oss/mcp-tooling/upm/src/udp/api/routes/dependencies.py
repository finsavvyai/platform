"""
API Route Dependencies.

Authentication and authorization dependencies using JWT (HS256 by default),
plus common helpers for role/permission enforcement and org scoping.
"""

import logging
from typing import Any, Optional
from uuid import UUID

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient
from sqlalchemy.ext.asyncio import AsyncSession
from udp.core.config import settings
from udp.core.database import get_async_session
from udp.domain.models import Organization, User

logger = logging.getLogger(__name__)

# Security scheme
security = HTTPBearer(auto_error=False)


def _decode_jwt(token: str) -> dict[str, Any]:
    """Decode HS256 or RS256 JWT. If JWKS URL provided or algorithm is RS*, verify via JWKS."""
    alg = (settings.security.algorithm or "HS256").upper()
    audience = settings.security.audience
    issuer = settings.security.issuer

    try:
        if settings.security.jwks_url or alg.startswith("RS"):
            if not settings.security.jwks_url:
                raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="JWKS URL not configured")
            jwks_client = PyJWKClient(settings.security.jwks_url)
            signing_key = jwks_client.get_signing_key_from_jwt(token)
            payload = jwt.decode(
                token,
                signing_key.key,
                algorithms=[alg],
                audience=audience,
                issuer=issuer,
                options={"require": ["sub", "exp"], "verify_signature": True, "verify_exp": True},
            )
        else:
            payload = jwt.decode(
                token,
                settings.security.secret_key,
                algorithms=[alg],
                audience=audience,
                issuer=issuer,
                options={"require": ["sub", "exp"], "verify_signature": True, "verify_exp": True},
            )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    except jwt.InvalidAudienceError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid audience")
    except jwt.InvalidIssuerError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid issuer")
    except Exception as e:
        logger.warning("Invalid token", error=str(e))
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> User:
    """Validate JWT Bearer token and return current user."""
    if not credentials or not credentials.credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")

    claims = _decode_jwt(credentials.credentials)

    # Extract user fields
    try:
        user_id = UUID(claims.get("sub"))
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid subject")

    email = claims.get("email") or "user@example.com"
    name = claims.get("name") or "User"
    role = claims.get("role") or claims.get("roles", "user")
    org_claim = claims.get("org") or claims.get("organization_id")
    organization_id = UUID(org_claim) if org_claim else None
    permissions: list[str] = claims.get("permissions", [])

    user = User(
        id=user_id,
        email=email,
        name=name,
        role=role,
        organization_id=organization_id,
        is_active=True,
        preferences={"permissions": permissions},
    )

    logger.info("Authenticated user", email=user.email, role=user.role)
    return user


async def get_current_organization(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session)
) -> Organization:
    """
    Get current user's organization.

    Args:
        current_user: Current authenticated user
        db: Database session

    Returns:
        Current user's organization

    Raises:
        HTTPException: If organization not found
    """
    # Placeholder: in a real system, fetch from DB by ID
    if not current_user.organization_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")

    organization = Organization(
        id=current_user.organization_id,
        name="Organization",
        slug="org",
        domain=None,
        industry=None,
        size=None,
        country="US",
        compliance_frameworks=set(),
        allowed_licenses=set(),
        blocked_licenses=set(),
        max_vulnerability_score=7.0,
        auto_update_enabled=False,
        require_approval=True,
        notification_emails=[],
        settings={},
    )
    logger.info("Resolved current organization", organization_id=str(organization.id))
    return organization


async def get_optional_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> Optional[User]:
    """
    Get current authenticated user if available (optional).

    Args:
        credentials: HTTP Bearer token credentials

    Returns:
        Current authenticated user or None
    """
    if not credentials:
        return None

    try:
        return await get_current_user(credentials)
    except HTTPException:
        return None


def require_permission(permission: str):
    """
    Decorator to require specific permission for a route.

    Args:
        permission: Required permission

    Returns:
        Dependency function
    """
    async def permission_dependency(
        current_user: User = Depends(get_current_user)
    ) -> User:
        perms = current_user.preferences.get("permissions", []) if current_user and current_user.preferences else []
        if permission not in perms and current_user.role != "admin":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"Permission '{permission}' required")
        logger.info("Permission verified", permission=permission, user=current_user.email)
        return current_user

    return permission_dependency


def require_role(role: str):
    """
    Decorator to require specific role for a route.

    Args:
        role: Required role

    Returns:
        Dependency function
    """
    async def role_dependency(
        current_user: User = Depends(get_current_user)
    ) -> User:
        if current_user.role != role and current_user.role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{role}' required"
            )

        logger.info(f"Role '{role}' verified for user {current_user.email}")
        return current_user

    return role_dependency
