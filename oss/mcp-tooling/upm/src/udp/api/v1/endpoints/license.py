"""License management API endpoints.

Handles license validation and feature checking for premium UPM features.
"""

from __future__ import annotations

import logging
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from ....core.models.user import User
from ....infrastructure.database import get_async_session
from ....licensing import (
    Feature,
    LicenseCheckRequest,
    LicenseCheckResponse,
    LicenseTier,
    get_license_manager,
)
from ....security.auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/license", tags=["license"])


class LicenseStatusResponse(BaseModel):
    """Response with current license status."""

    has_license: bool
    tier: Optional[LicenseTier] = None
    features: list[str] = []
    organization: Optional[str] = None
    seats: Optional[int] = None
    expires_at: Optional[str] = None
    days_until_expiry: Optional[int] = None


class LicenseActivateRequest(BaseModel):
    """Request to activate a license."""

    license_key: str = Field(..., description="The license key to activate")


class FeatureCheckResponse(BaseModel):
    """Response for feature availability check."""

    feature: str
    available: bool
    requires_tier: Optional[str] = None


@router.get("/status", response_model=LicenseStatusResponse)
async def get_license_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
) -> LicenseStatusResponse:
    """Get current license status for the organization.

    Returns information about the active license and available features.
    """
    # Get license from organization settings
    # For now, return default (no license)
    from ....services.license_service import get_organization_license

    license_key = await get_organization_license(current_user.organization_id)

    if not license_key:
        return LicenseStatusResponse(
            has_license=False,
            features=[],
        )

    manager = get_license_manager()
    license_obj = manager.validate_license(license_key)

    if not license_obj:
        return LicenseStatusResponse(
            has_license=False,
            features=[],
        )

    return LicenseStatusResponse(
        has_license=True,
        tier=license_obj.tier,
        features=[f.value for f in license_obj.features],
        organization=license_obj.organization,
        seats=license_obj.seats,
        expires_at=license_obj.expires_at.isoformat()
        if license_obj.expires_at
        else None,
        days_until_expiry=license_obj.days_until_expiry(),
    )


@router.post("/activate", status_code=status.HTTP_200_OK)
async def activate_license(
    request: LicenseActivateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
) -> LicenseStatusResponse:
    """Activate a license key for the organization.

    Validates and activates the provided license key.
    """
    manager = get_license_manager()
    license_obj = manager.validate_license(request.license_key)

    if not license_obj:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired license key",
        )

    # Save license to organization
    from ....services.license_service import save_organization_license

    await save_organization_license(current_user.organization_id, request.license_key)

    logger.info(
        f"License activated for organization {current_user.organization_id}: {license_obj.tier.value}"
    )

    return LicenseStatusResponse(
        has_license=True,
        tier=license_obj.tier,
        features=[f.value for f in license_obj.features],
        organization=license_obj.organization,
        seats=license_obj.seats,
        expires_at=license_obj.expires_at.isoformat()
        if license_obj.expires_at
        else None,
        days_until_expiry=license_obj.days_until_expiry(),
    )


@router.post("/validate", response_model=LicenseCheckResponse)
async def validate_license(
    request: LicenseCheckRequest,
) -> LicenseCheckResponse:
    """Validate a license key.

    Checks if a license key is valid and returns its details.
    Does not require authentication - used for license verification.
    """
    manager = get_license_manager()
    license_obj = manager.validate_license(request.license_key)

    if not license_obj:
        return LicenseCheckResponse(
            valid=False,
            error="Invalid or expired license key",
        )

    # Check specific feature if requested
    if request.feature:
        has_feature = request.feature in license_obj.features
        if not has_feature:
            # Find which tier has this feature
            required_tier = None
            for tier, features in manager.TIER_FEATURES.items():
                if request.feature in features:
                    required_tier = tier.value
                    break

            return LicenseCheckResponse(
                valid=True,
                tier=license_obj.tier,
                features=[f.value for f in license_obj.features],
                organization=license_obj.organization,
                seats=license_obj.seats,
                expires_at=license_obj.expires_at,
                error=f"Feature '{request.feature}' requires {required_tier} tier or higher",
            )

    return LicenseCheckResponse(
        valid=True,
        tier=license_obj.tier,
        features=[f.value for f in license_obj.features],
        organization=license_obj.organization,
        seats=license_obj.seats,
        expires_at=license_obj.expires_at,
    )


@router.get("/features", response_model=list[FeatureCheckResponse])
async def get_available_features(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
) -> list[FeatureCheckResponse]:
    """Get list of all features and their availability."""

    # Get organization license
    from ....services.license_service import get_organization_license

    license_key = await get_organization_license(current_user.organization_id)

    manager = get_license_manager()
    license_obj = manager.validate_license(license_key) if license_key else None

    available_features = license_obj.features if license_obj else []

    responses = []
    for feature in Feature:
        available = feature in available_features

        # Find minimum tier
        requires_tier = None
        for tier, features in manager.TIER_FEATURES.items():
            if feature in features:
                requires_tier = tier.value
                break

        responses.append(
            FeatureCheckResponse(
                feature=feature.value,
                available=available,
                requires_tier=requires_tier,
            )
        )

    return responses


@router.get("/tiers")
async def get_tier_info() -> dict[str, Any]:
    """Get information about available license tiers and their features.

    Returns pricing and feature comparison for all tiers.
    """
    return {
        "tiers": [
            {
                "id": "community",
                "name": "Community",
                "price": 0,
                "description": "Free, open source dependency management",
                "features": [
                    "Core dependency scanning",
                    "Vulnerability detection (OSV, NVD)",
                    "SBOM generation",
                    "Basic policy enforcement",
                    "CLI tools",
                    "Community support",
                ],
            },
            {
                "id": "pro",
                "name": "Pro",
                "price": 49,
                "price_per": "user/month",
                "description": "For development teams needing visibility",
                "features": [
                    "Everything in Community",
                    "Dashboard with analytics",
                    "Dependency graph visualization",
                    "Custom reports",
                    "Email notifications",
                    "Slack integration",
                    "Business hours support",
                ],
            },
            {
                "id": "business",
                "name": "Business",
                "price": 149,
                "price_per": "user/month",
                "description": "For organizations needing intelligent remediation",
                "features": [
                    "Everything in Pro",
                    "OpenClaw AI vulnerability detection",
                    "Predictive analytics",
                    "Smart remediation suggestions",
                    "Real-time monitoring",
                    "API access",
                    "SAML SSO",
                    "Priority support",
                ],
            },
            {
                "id": "enterprise",
                "name": "Enterprise",
                "price": "Custom",
                "description": "For large organizations with advanced requirements",
                "features": [
                    "Everything in Business",
                    "Unlimited seats",
                    "LDAP/AD integration",
                    "Advanced RBAC",
                    "Audit logs",
                    "On-premise deployment",
                    "Custom SLA",
                    "Dedicated support",
                ],
            },
        ],
        "feature_matrix": {
            "dashboard": ["pro", "business", "enterprise"],
            "analytics": ["pro", "business", "enterprise"],
            "dependency_graph": ["pro", "business", "enterprise"],
            "custom_reports": ["pro", "business", "enterprise"],
            "ai_agents": ["business", "enterprise"],
            "openclaw": ["business", "enterprise"],
            "predictive_analytics": ["business", "enterprise"],
            "smart_remediation": ["business", "enterprise"],
            "realtime_monitoring": ["business", "enterprise"],
            "sso": ["business", "enterprise"],
            "ldap": ["enterprise"],
            "audit_logs": ["enterprise"],
            "rbac": ["enterprise"],
            "api_access": ["business", "enterprise"],
            "priority_support": ["business", "enterprise"],
            "on_premise": ["enterprise"],
        },
    }


@router.post("/deactivate")
async def deactivate_license(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
) -> dict[str, str]:
    """Deactivate the current license for the organization.

    Requires admin privileges.
    """
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can deactivate licenses",
        )

    from ....services.license_service import delete_organization_license

    await delete_organization_license(current_user.organization_id)

    logger.info(f"License deactivated for organization {current_user.organization_id}")

    return {"message": "License deactivated successfully"}
