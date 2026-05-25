"""
Multi-Tenant API Routes.

Provides REST API endpoints for tenant management, quota monitoring,
usage analytics, and organization administration.
"""

import logging
from datetime import datetime, timedelta
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from udp.api.routes.dependencies import get_current_organization, get_current_user
from udp.core.tenancy import (
    TenantTier,
    UsageMetrics,
    tenant_manager,
)
from udp.domain.models import Organization, User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/tenancy", tags=["tenancy"])


# Request/Response Models
class TenantConfigRequest(BaseModel):
    """Request model for updating tenant configuration."""
    tier: Optional[TenantTier] = None
    features: Optional[dict[str, bool]] = None
    settings: Optional[dict[str, Any]] = None
    compliance_frameworks: Optional[list[str]] = None
    security_requirements: Optional[dict[str, Any]] = None
    webhook_endpoints: Optional[list[str]] = None
    custom_domain: Optional[str] = None
    branding_enabled: Optional[bool] = None


class TenantConfigResponse(BaseModel):
    """Response model for tenant configuration."""
    organization_id: str
    tier: str
    quotas: dict[str, Any]
    features: dict[str, bool]
    settings: dict[str, Any]
    compliance_frameworks: list[str]
    security_requirements: dict[str, Any]
    webhook_endpoints: list[str]
    custom_domain: Optional[str]
    branding_enabled: bool
    created_at: str
    updated_at: str


class UsageMetricsResponse(BaseModel):
    """Response model for usage metrics."""
    organization_id: str
    period_start: str
    period_end: str
    workflows_executed: int
    workflows_failed: int
    total_workflow_duration_minutes: float
    analyses_performed: int
    dependencies_analyzed: int
    storage_used_gb: float
    api_requests_made: int
    api_requests_failed: int
    marketplace_purchases: int
    security_scans_performed: int
    estimated_cost: float
    quota_utilization_percentage: float


class QuotaStatusResponse(BaseModel):
    """Response model for quota status."""
    organization_id: str
    tier: str
    quotas: dict[str, Any]
    current_usage: dict[str, Any]
    utilization_percentages: dict[str, float]
    quota_warnings: list[str]
    quota_exceeded: list[str]


class TenantTierResponse(BaseModel):
    """Response model for tenant tier information."""
    tier: str
    name: str
    description: str
    quotas: dict[str, Any]
    features: dict[str, bool]
    pricing: dict[str, Any]


# API Endpoints
@router.get("/config", response_model=TenantConfigResponse)
async def get_tenant_config(
    current_user: User = Depends(get_current_user),
    current_org: Organization = Depends(get_current_organization)
):
    """
    Get tenant configuration for the current organization.

    Args:
        current_user: Current authenticated user
        current_org: Current organization

    Returns:
        Tenant configuration details
    """
    try:
        logger.info(f"Getting tenant config for organization {current_org.id}")

        config = await tenant_manager.get_tenant_config(current_org.id)
        if not config:
            # Initialize tenant if not exists
            config = await tenant_manager.initialize_tenant(current_org)

        return TenantConfigResponse(
            organization_id=str(config.organization_id),
            tier=config.tier.value,
            quotas=config.quotas.dict(),
            features=config.features,
            settings=config.settings,
            compliance_frameworks=list(config.compliance_frameworks),
            security_requirements=config.security_requirements,
            webhook_endpoints=config.webhook_endpoints,
            custom_domain=config.custom_domain,
            branding_enabled=config.branding_enabled,
            created_at=datetime.utcnow().isoformat(),
            updated_at=datetime.utcnow().isoformat()
        )

    except Exception as e:
        logger.error(f"Failed to get tenant config: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get tenant configuration: {str(e)}"
        )


@router.put("/config", response_model=TenantConfigResponse)
async def update_tenant_config(
    request: TenantConfigRequest,
    current_user: User = Depends(get_current_user),
    current_org: Organization = Depends(get_current_organization)
):
    """
    Update tenant configuration for the current organization.

    Args:
        request: Configuration update request
        current_user: Current authenticated user
        current_org: Current organization

    Returns:
        Updated tenant configuration
    """
    try:
        logger.info(f"Updating tenant config for organization {current_org.id}")

        # Prepare updates
        updates = {}
        if request.tier is not None:
            updates["tier"] = request.tier
        if request.features is not None:
            updates["features"] = request.features
        if request.settings is not None:
            updates["settings"] = request.settings
        if request.compliance_frameworks is not None:
            updates["compliance_frameworks"] = set(request.compliance_frameworks)
        if request.security_requirements is not None:
            updates["security_requirements"] = request.security_requirements
        if request.webhook_endpoints is not None:
            updates["webhook_endpoints"] = request.webhook_endpoints
        if request.custom_domain is not None:
            updates["custom_domain"] = request.custom_domain
        if request.branding_enabled is not None:
            updates["branding_enabled"] = request.branding_enabled

        # Update configuration
        config = await tenant_manager.update_tenant_config(current_org.id, updates)

        return TenantConfigResponse(
            organization_id=str(config.organization_id),
            tier=config.tier.value,
            quotas=config.quotas.dict(),
            features=config.features,
            settings=config.settings,
            compliance_frameworks=list(config.compliance_frameworks),
            security_requirements=config.security_requirements,
            webhook_endpoints=config.webhook_endpoints,
            custom_domain=config.custom_domain,
            branding_enabled=config.branding_enabled,
            created_at=datetime.utcnow().isoformat(),
            updated_at=datetime.utcnow().isoformat()
        )

    except Exception as e:
        logger.error(f"Failed to update tenant config: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update tenant configuration: {str(e)}"
        )


@router.get("/usage", response_model=UsageMetricsResponse)
async def get_usage_metrics(
    period_days: int = Query(30, ge=1, le=365, description="Number of days to include in metrics"),
    current_user: User = Depends(get_current_user),
    current_org: Organization = Depends(get_current_organization)
):
    """
    Get usage metrics for the current organization.

    Args:
        period_days: Number of days to include in metrics
        current_user: Current authenticated user
        current_org: Current organization

    Returns:
        Usage metrics for the specified period
    """
    try:
        logger.info(f"Getting usage metrics for organization {current_org.id}")

        metrics = await tenant_manager.get_usage_metrics(current_org.id)
        if not metrics:
            # Initialize metrics if not exists
            config = await tenant_manager.get_tenant_config(current_org.id)
            if not config:
                config = await tenant_manager.initialize_tenant(current_org)

            # Create empty metrics
            metrics = UsageMetrics(
                organization_id=current_org.id,
                period_start=datetime.utcnow() - timedelta(days=period_days),
                period_end=datetime.utcnow()
            )

        return UsageMetricsResponse(
            organization_id=str(metrics.organization_id),
            period_start=metrics.period_start.isoformat(),
            period_end=metrics.period_end.isoformat(),
            workflows_executed=metrics.workflows_executed,
            workflows_failed=metrics.workflows_failed,
            total_workflow_duration_minutes=metrics.total_workflow_duration_minutes,
            analyses_performed=metrics.analyses_performed,
            dependencies_analyzed=metrics.dependencies_analyzed,
            storage_used_gb=metrics.storage_used_gb,
            api_requests_made=metrics.api_requests_made,
            api_requests_failed=metrics.api_requests_failed,
            marketplace_purchases=metrics.marketplace_purchases,
            security_scans_performed=metrics.security_scans_performed,
            estimated_cost=metrics.estimated_cost,
            quota_utilization_percentage=metrics.quota_utilization_percentage
        )

    except Exception as e:
        logger.error(f"Failed to get usage metrics: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get usage metrics: {str(e)}"
        )


@router.get("/quotas", response_model=QuotaStatusResponse)
async def get_quota_status(
    current_user: User = Depends(get_current_user),
    current_org: Organization = Depends(get_current_organization)
):
    """
    Get quota status for the current organization.

    Args:
        current_user: Current authenticated user
        current_org: Current organization

    Returns:
        Quota status and utilization information
    """
    try:
        logger.info(f"Getting quota status for organization {current_org.id}")

        config = await tenant_manager.get_tenant_config(current_org.id)
        if not config:
            config = await tenant_manager.initialize_tenant(current_org)

        metrics = await tenant_manager.get_usage_metrics(current_org.id)
        if not metrics:
            metrics = UsageMetrics(
                organization_id=current_org.id,
                period_start=datetime.utcnow() - timedelta(days=30),
                period_end=datetime.utcnow()
            )

        # Calculate utilization percentages
        utilization = {
            "workflows": min(metrics.workflows_executed / config.quotas.max_workflows_per_month * 100, 100),
            "analyses": min(metrics.analyses_performed / config.quotas.max_analyses_per_month * 100, 100),
            "storage": min(metrics.storage_used_gb / config.quotas.max_storage_gb * 100, 100),
            "api_requests": min(metrics.api_requests_made / config.quotas.max_api_requests_per_day * 100, 100),
            "marketplace_purchases": min(metrics.marketplace_purchases / config.quotas.max_marketplace_purchases_per_month * 100, 100)
        }

        # Identify quota warnings and exceeded quotas
        warnings = []
        exceeded = []

        for resource, percentage in utilization.items():
            if percentage >= 100:
                exceeded.append(resource)
            elif percentage >= 80:
                warnings.append(f"{resource} quota at {percentage:.1f}%")

        return QuotaStatusResponse(
            organization_id=str(current_org.id),
            tier=config.tier.value,
            quotas=config.quotas.dict(),
            current_usage=metrics.dict(),
            utilization_percentages=utilization,
            quota_warnings=warnings,
            quota_exceeded=exceeded
        )

    except Exception as e:
        logger.error(f"Failed to get quota status: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get quota status: {str(e)}"
        )


@router.get("/tiers", response_model=list[TenantTierResponse])
async def get_available_tiers():
    """
    Get available tenant tiers and their features.

    Returns:
        List of available tenant tiers with features and pricing
    """
    try:
        tiers = []

        for tier in TenantTier:
            if tier == TenantTier.CUSTOM:
                continue  # Skip custom tier for public listing

            quotas = tenant_manager._get_quotas_for_tier(tier)
            features = tenant_manager._get_features_for_tier(tier)

            # Mock pricing information
            pricing = {
                "monthly": self._get_tier_pricing(tier, "monthly"),
                "yearly": self._get_tier_pricing(tier, "yearly"),
                "currency": "USD"
            }

            tiers.append(TenantTierResponse(
                tier=tier.value,
                name=tier.value.replace("_", " ").title(),
                description=self._get_tier_description(tier),
                quotas=quotas.dict(),
                features=features,
                pricing=pricing
            ))

        return tiers

    except Exception as e:
        logger.error(f"Failed to get available tiers: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get available tiers: {str(e)}"
        )


@router.post("/initialize")
async def initialize_tenant(
    tier: TenantTier = Query(TenantTier.STANDARD, description="Initial tier for the organization"),
    current_user: User = Depends(get_current_user),
    current_org: Organization = Depends(get_current_organization)
):
    """
    Initialize tenant configuration for a new organization.

    Args:
        tier: Initial subscription tier
        current_user: Current authenticated user
        current_org: Current organization

    Returns:
        Initialization result
    """
    try:
        logger.info(f"Initializing tenant for organization {current_org.id} with tier {tier}")

        # Check if tenant already exists
        existing_config = await tenant_manager.get_tenant_config(current_org.id)
        if existing_config:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Tenant already initialized for this organization"
            )

        # Initialize tenant
        config = await tenant_manager.initialize_tenant(current_org, tier)

        return {
            "status": "success",
            "message": "Tenant initialized successfully",
            "organization_id": str(config.organization_id),
            "tier": config.tier.value,
            "features": config.features,
            "quotas": config.quotas.dict()
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to initialize tenant: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to initialize tenant: {str(e)}"
        )


def _get_tier_pricing(tier: TenantTier, billing_cycle: str) -> float:
    """Get pricing for a tier and billing cycle."""
    pricing = {
        TenantTier.FREE: {"monthly": 0.0, "yearly": 0.0},
        TenantTier.STANDARD: {"monthly": 99.0, "yearly": 990.0},
        TenantTier.PREMIUM: {"monthly": 299.0, "yearly": 2990.0},
        TenantTier.ENTERPRISE: {"monthly": 999.0, "yearly": 9990.0}
    }

    return pricing.get(tier, {}).get(billing_cycle, 0.0)


def _get_tier_description(tier: TenantTier) -> str:
    """Get description for a tenant tier."""
    descriptions = {
        TenantTier.FREE: "Perfect for individual developers and small projects",
        TenantTier.STANDARD: "Ideal for small to medium teams with basic compliance needs",
        TenantTier.PREMIUM: "Advanced features for growing organizations with complex requirements",
        TenantTier.ENTERPRISE: "Full-featured solution for large enterprises with custom needs"
    }

    return descriptions.get(tier, "Custom tier with tailored features and pricing")
