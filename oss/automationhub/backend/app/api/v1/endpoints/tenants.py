"""
Tenant API Endpoints
REST API for tenant management and operations
"""

from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr, validator
import uuid
import logging

from ...database import get_db
from ...models.tenant import Tenant
from ...services.tenant_service import TenantService
from ...middleware.tenant import get_current_tenant, require_active_tenant, tenant_required
from ...middleware.tenant import get_current_tenant_id, get_current_tenant_slug

logger = logging.getLogger(__name__)

router = APIRouter()

# Pydantic Models for Request/Response
class TenantBase(BaseModel):
    name: str
    display_name: str
    email: EmailStr
    subdomain: str
    description: Optional[str] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    company_size: Optional[str] = None
    industry: Optional[str] = None
    billing_email: Optional[EmailStr] = None

    @validator('name')
    def validate_name(cls, v):
        if not v or len(v.strip()) < 2:
            raise ValueError('Name must be at least 2 characters long')
        return v.strip()

    @validator('subdomain')
    def validate_subdomain(cls, v):
        import re
        if not v or not re.match(r'^[a-z0-9]+(-[a-z0-9]+)*$', v):
            raise ValueError('Subdomain must contain only lowercase letters, numbers, and hyphens')
        if len(v) < 3 or len(v) > 50:
            raise ValueError('Subdomain must be between 3 and 50 characters')
        return v.lower()

    @validator('company_size')
    def validate_company_size(cls, v):
        if v:
            valid_sizes = ['startup', 'small', 'medium', 'large', 'enterprise']
            if v not in valid_sizes:
                raise ValueError(f'Company size must be one of: {valid_sizes}')
        return v

class TenantCreate(TenantBase):
    plan: str = "starter"
    tier: str = "basic"

    @validator('plan')
    def validate_plan(cls, v):
        valid_plans = ['free', 'starter', 'professional', 'enterprise']
        if v not in valid_plans:
            raise ValueError(f'Plan must be one of: {valid_plans}')
        return v

    @validator('tier')
    def validate_tier(cls, v):
        valid_tiers = ['basic', 'professional', 'enterprise', 'custom']
        if v not in valid_tiers:
            raise ValueError(f'Tier must be one of: {valid_tiers}')
        return v

class TenantUpdate(BaseModel):
    display_name: Optional[str] = None
    description: Optional[str] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    company_size: Optional[str] = None
    industry: Optional[str] = None
    billing_email: Optional[EmailStr] = None
    settings: Optional[Dict[str, Any]] = None
    preferences: Optional[Dict[str, Any]] = None

class TenantResponse(BaseModel):
    id: str
    slug: str
    name: str
    display_name: str
    description: Optional[str]
    email: str
    phone: Optional[str]
    website: Optional[str]
    subdomain: str
    domain: Optional[str]
    status: str
    tier: str
    plan: str
    created_at: datetime
    updated_at: datetime
    subscription_status: str
    is_active: bool
    is_trial: bool
    trial_days_remaining: Optional[int]
    usage_percentages: Dict[str, float]
    is_over_limits: Dict[str, bool]

    class Config:
        from_attributes = True

class TenantDetailedResponse(TenantResponse):
    max_users: int
    max_storage_gb: int
    max_api_calls_per_month: int
    max_workflows: int
    max_agents: int
    current_users: int
    current_storage_gb: int
    current_api_calls_month: int
    current_workflows: int
    current_agents: int
    features: Optional[Dict[str, Any]]
    settings: Optional[Dict[str, Any]]

    class Config:
        from_attributes = True

class TenantUsageResponse(BaseModel):
    tenant: TenantDetailedResponse
    period: Dict[str, Any]
    current_usage: Dict[str, int]
    limits: Dict[str, int]
    usage_percentages: Dict[str, float]
    analytics: Dict[str, Any]

class TenantConfigurationRequest(BaseModel):
    category: str
    key: str
    value: Any
    description: Optional[str] = None
    is_encrypted: bool = False

class TenantPlanChange(BaseModel):
    new_plan: str
    new_tier: str

    @validator('new_plan')
    def validate_new_plan(cls, v):
        valid_plans = ['free', 'starter', 'professional', 'enterprise']
        if v not in valid_plans:
            raise ValueError(f'Plan must be one of: {valid_plans}')
        return v

    @validator('new_tier')
    def validate_new_tier(cls, v):
        valid_tiers = ['basic', 'professional', 'enterprise', 'custom']
        if v not in valid_tiers:
            raise ValueError(f'Tier must be one of: {valid_tiers}')
        return v

# Public Endpoints (No tenant required)
@router.post("/public/register", response_model=TenantResponse, status_code=status.HTTP_201_CREATED)
async def register_tenant(
    tenant_data: TenantCreate,
    db: Session = Depends(get_db)
):
    """Register a new tenant (public endpoint)"""
    try:
        tenant_service = TenantService(db)
        tenant = await tenant_service.create_tenant(**tenant_data.dict())
        return TenantResponse.from_orm(tenant)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating tenant: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create tenant"
        )

@router.get("/public/check-availability", response_model=Dict[str, bool])
async def check_availability(
    subdomain: str = Query(...),
    email: Optional[str] = Query(None),
    domain: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Check availability of subdomain, email, or domain"""
    try:
        tenant_service = TenantService(db)
        result = {}

        if subdomain:
            existing_tenant = await tenant_service.get_tenant_by_subdomain(subdomain)
            result["subdomain"] = existing_tenant is None

        if email:
            existing_tenant = await tenant_service.get_tenant_by_email(email)
            result["email"] = existing_tenant is None

        if domain:
            existing_tenant = await tenant_service.get_tenant_by_domain(domain)
            result["domain"] = existing_tenant is None

        return result

    except Exception as e:
        logger.error(f"Error checking availability: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to check availability"
        )

# Tenant-specific endpoints (require tenant context)
@router.get("/me", response_model=TenantDetailedResponse)
@tenant_required
async def get_current_tenant_info():
    """Get current tenant information"""
    tenant = get_current_tenant()
    return TenantDetailedResponse.from_orm(tenant)

@router.put("/me", response_model=TenantResponse)
@tenant_required
async def update_current_tenant(
    update_data: TenantUpdate,
    db: Session = Depends(get_db)
):
    """Update current tenant information"""
    try:
        tenant_service = TenantService(db)
        tenant_id = get_current_tenant_id()
        tenant = await tenant_service.update_tenant(tenant_id, update_data.dict(exclude_unset=True))
        return TenantResponse.from_orm(tenant)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating tenant: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update tenant"
        )

@router.get("/usage", response_model=TenantUsageResponse)
@tenant_required
async def get_tenant_usage(
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db)
):
    """Get tenant usage analytics"""
    try:
        tenant_service = TenantService(db)
        tenant_id = get_current_tenant_id()
        usage_data = await tenant_service.get_usage_analytics(tenant_id, days)
        return TenantUsageResponse(**usage_data)
    except Exception as e:
        logger.error(f"Error getting tenant usage: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get usage data"
        )

@router.get("/configuration", response_model=Dict[str, Any])
@tenant_required
async def get_tenant_configuration(
    category: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Get tenant configuration"""
    try:
        tenant_service = TenantService(db)
        tenant_id = get_current_tenant_id()
        config = await tenant_service.get_tenant_configuration(tenant_id, category)
        return config
    except Exception as e:
        logger.error(f"Error getting tenant configuration: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get configuration"
        )

@router.post("/configuration", response_model=Dict[str, Any])
@tenant_required
async def update_tenant_configuration(
    config_data: TenantConfigurationRequest,
    db: Session = Depends(get_db)
):
    """Update tenant configuration"""
    try:
        tenant_service = TenantService(db)
        tenant_id = get_current_tenant_id()
        config = await tenant_service.update_tenant_configuration(
            tenant_id,
            config_data.category,
            config_data.key,
            config_data.value,
            config_data.description,
            config_data.is_encrypted
        )
        return {"message": "Configuration updated successfully", "config": config.to_dict()}
    except Exception as e:
        logger.error(f"Error updating tenant configuration: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update configuration"
        )

@router.post("/change-plan", response_model=TenantResponse)
@tenant_required
async def change_tenant_plan(
    plan_data: TenantPlanChange,
    db: Session = Depends(get_db)
):
    """Change tenant subscription plan"""
    try:
        tenant_service = TenantService(db)
        tenant_id = get_current_tenant_id()
        tenant = await tenant_service.change_tenant_plan(
            tenant_id,
            plan_data.new_plan,
            plan_data.new_tier
        )
        return TenantResponse.from_orm(tenant)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error changing tenant plan: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to change plan"
        )

@router.get("/limits", response_model=Dict[str, Any])
@tenant_required
async def get_tenant_limits():
    """Get current tenant resource limits and usage"""
    tenant = get_current_tenant()
    return {
        "limits": {
            "max_users": tenant.max_users,
            "max_storage_gb": tenant.max_storage_gb,
            "max_api_calls_per_month": tenant.max_api_calls_per_month,
            "max_workflows": tenant.max_workflows,
            "max_agents": tenant.max_agents
        },
        "current_usage": {
            "users": tenant.current_users,
            "storage_gb": tenant.current_storage_gb,
            "api_calls_month": tenant.current_api_calls_month,
            "workflows": tenant.current_workflows,
            "agents": tenant.current_agents
        },
        "usage_percentages": {
            "users": tenant.user_usage_percentage,
            "storage": tenant.storage_usage_percentage,
            "api_calls": tenant.api_usage_percentage
        },
        "is_over_limits": tenant.is_over_limits
    }

@router.get("/features", response_model=Dict[str, Any])
@tenant_required
async def get_tenant_features():
    """Get tenant available features"""
    tenant = get_current_tenant()
    return {
        "enabled_features": tenant.features or {},
        "beta_features": tenant.beta_features or {},
        "plan_features": {
            "basic_features": True,
            "api_access": True,
            "custom_integrations": tenant.tier in ['professional', 'enterprise'],
            "white_labeling": tenant.tier == 'enterprise',
            "advanced_analytics": tenant.tier in ['professional', 'enterprise']
        }
    }

@router.post("/increment-usage", response_model=Dict[str, Any])
@tenant_required
async def increment_usage(
    metric: str = Query(...),
    amount: int = Query(1, ge=1),
    db: Session = Depends(get_db)
):
    """Increment tenant usage metric"""
    try:
        tenant_service = TenantService(db)
        tenant_id = get_current_tenant_id()

        # Check if tenant can consume additional resources
        can_consume, limit_info = await tenant_service.check_resource_limits(tenant_id, metric, amount)

        if not can_consume:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={
                    "message": f"Resource limit exceeded for {metric}",
                    "limit_info": limit_info
                }
            )

        # Increment usage
        success = await tenant_service.increment_usage(tenant_id, metric, amount)

        if success:
            return {
                "message": f"Usage incremented for {metric}",
                "metric": metric,
                "amount": amount,
                "limit_info": limit_info
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to increment usage"
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error incrementing usage: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to increment usage"
        )

# Admin endpoints (require admin privileges)
@router.get("/admin/tenants", response_model=List[TenantResponse])
async def list_tenants(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[str] = Query(None),
    tier: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """List tenants (admin only)"""
    try:
        tenant_service = TenantService(db)
        tenants = await tenant_service.list_tenants(skip, limit, status, tier, search)
        return [TenantResponse.from_orm(tenant) for tenant in tenants]
    except Exception as e:
        logger.error(f"Error listing tenants: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list tenants"
        )

@router.get("/admin/tenants/count", response_model=Dict[str, int])
async def count_tenants(
    status: Optional[str] = Query(None),
    tier: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Count tenants (admin only)"""
    try:
        tenant_service = TenantService(db)
        count = await tenant_service.count_tenants(status, tier, search)
        return {"count": count}
    except Exception as e:
        logger.error(f"Error counting tenants: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to count tenants"
        )

@router.get("/admin/tenants/{tenant_id}", response_model=TenantDetailedResponse)
async def get_tenant_by_id_admin(
    tenant_id: uuid.UUID,
    db: Session = Depends(get_db)
):
    """Get tenant by ID (admin only)"""
    try:
        tenant_service = TenantService(db)
        tenant = await tenant_service.get_tenant_by_id(tenant_id)
        if not tenant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Tenant not found"
            )
        return TenantDetailedResponse.from_orm(tenant)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting tenant: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get tenant"
        )

@router.put("/admin/tenants/{tenant_id}", response_model=TenantResponse)
async def update_tenant_admin(
    tenant_id: uuid.UUID,
    update_data: TenantUpdate,
    db: Session = Depends(get_db)
):
    """Update tenant (admin only)"""
    try:
        tenant_service = TenantService(db)
        tenant = await tenant_service.update_tenant(tenant_id, update_data.dict(exclude_unset=True))
        return TenantResponse.from_orm(tenant)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating tenant: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update tenant"
        )

@router.post("/admin/tenants/{tenant_id}/suspend", response_model=TenantResponse)
async def suspend_tenant_admin(
    tenant_id: uuid.UUID,
    reason: str,
    db: Session = Depends(get_db)
):
    """Suspend tenant (admin only)"""
    try:
        tenant_service = TenantService(db)
        tenant = await tenant_service.suspend_tenant(tenant_id, reason)
        return TenantResponse.from_orm(tenant)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error suspending tenant: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to suspend tenant"
        )

@router.post("/admin/tenants/{tenant_id}/activate", response_model=TenantResponse)
async def activate_tenant_admin(
    tenant_id: uuid.UUID,
    db: Session = Depends(get_db)
):
    """Activate tenant (admin only)"""
    try:
        tenant_service = TenantService(db)
        tenant = await tenant_service.activate_tenant(tenant_id)
        return TenantResponse.from_orm(tenant)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error activating tenant: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to activate tenant"
        )

@router.post("/admin/tenants/{tenant_id}/change-plan", response_model=TenantResponse)
async def change_tenant_plan_admin(
    tenant_id: uuid.UUID,
    plan_data: TenantPlanChange,
    db: Session = Depends(get_db)
):
    """Change tenant plan (admin only)"""
    try:
        tenant_service = TenantService(db)
        tenant = await tenant_service.change_tenant_plan(
            tenant_id,
            plan_data.new_plan,
            plan_data.new_tier
        )
        return TenantResponse.from_orm(tenant)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error changing tenant plan: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to change plan"
        )