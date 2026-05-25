"""
Tenant Administration API Endpoints
Comprehensive tenant management, user administration, and billing endpoints
"""

from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.tenant import Tenant
from app.models.user import User
from app.services.tenant_admin_service import TenantAdminService
from app.services.tenant_service import TenantService
from app.schemas.tenant import (
    TenantCreate, TenantUpdate, TenantResponse, TenantListResponse,
    UserCreate, UserUpdate, UserResponse, UserListResponse,
    TenantMetricsResponse, BulkTenantUpdateRequest
)
from app.core.deps import get_current_user, require_superuser
from app.core.security import get_password_hash
from app.middleware.tenant import tenant_context

router = APIRouter()

@router.post("/tenants", response_model=TenantResponse, status_code=201)
async def create_tenant(
    tenant_data: TenantCreate,
    admin_user_data: UserCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_superuser)
):
    """
    Create a new tenant with initial admin user

    Requires superuser privileges
    """
    try:
        tenant_service = TenantAdminService(db)

        # Create tenant with admin
        tenant, admin_user = await tenant_service.create_tenant_with_admin(
            tenant_data.dict(),
            admin_user_data.dict(),
            created_by=current_user.id
        )

        # Schedule background tasks for tenant setup
        background_tasks.add_task(
            _setup_new_tenant_resources,
            tenant.id,
            admin_user.id
        )

        return TenantResponse.from_orm(tenant)

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create tenant: {str(e)}")

@router.get("/tenants", response_model=TenantListResponse)
async def list_tenants(
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(50, ge=1, le=100, description="Results per page"),
    status: Optional[str] = Query(None, description="Filter by status"),
    plan: Optional[str] = Query(None, description="Filter by plan"),
    tier: Optional[str] = Query(None, description="Filter by tier"),
    search: Optional[str] = Query(None, description="Search query"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_superuser)
):
    """
    List tenants with optional filtering and search

    Requires superuser privileges
    """
    try:
        tenant_service = TenantAdminService(db)

        if search:
            # Use search functionality
            filters = {}
            if status:
                filters["status"] = status
            if plan:
                filters["plan"] = plan
            if tier:
                filters["tier"] = tier

            result = await tenant_service.search_tenants(
                query=search,
                filters=filters,
                page=page,
                limit=limit
            )
        else:
            # Use regular list with filters
            result = await tenant_service.get_tenants(
                page=page,
                limit=limit,
                status=status,
                plan=plan,
                tier=tier
            )

        return TenantListResponse(
            tenants=[TenantResponse.from_orm(tenant) for tenant in result["tenants"]],
            pagination=result["pagination"]
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list tenants: {str(e)}")

@router.get("/tenants/{tenant_id}", response_model=TenantResponse)
async def get_tenant(
    tenant_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_superuser)
):
    """
    Get tenant details by ID

    Requires superuser privileges
    """
    try:
        tenant_service = TenantService(db)
        tenant = await tenant_service.get_tenant_by_id(tenant_id)

        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant not found")

        return TenantResponse.from_orm(tenant)

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get tenant: {str(e)}")

@router.put("/tenants/{tenant_id}", response_model=TenantResponse)
async def update_tenant(
    tenant_id: str,
    updates: TenantUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_superuser)
):
    """
    Update tenant configuration

    Requires superuser privileges
    """
    try:
        tenant_service = TenantAdminService(db)

        tenant = await tenant_service.update_tenant_configuration(
            tenant_id,
            updates.dict(exclude_unset=True),
            updated_by=current_user.id
        )

        return TenantResponse.from_orm(tenant)

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update tenant: {str(e)}")

@router.post("/tenants/{tenant_id}/suspend", response_model=TenantResponse)
async def suspend_tenant(
    tenant_id: str,
    suspension_data: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(require_superuser)
):
    """
    Suspend a tenant

    Requires superuser privileges
    """
    try:
        tenant_service = TenantAdminService(db)

        tenant = await tenant_service.suspend_tenant(
            tenant_id,
            reason=suspension_data.get("reason", "No reason provided"),
            suspended_by=current_user.id,
            effective_date=datetime.fromisoformat(suspension_data["effective_date"]) if suspension_data.get("effective_date") else None
        )

        return TenantResponse.from_orm(tenant)

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to suspend tenant: {str(e)}")

@router.post("/tenants/{tenant_id}/reactivate", response_model=TenantResponse)
async def reactivate_tenant(
    tenant_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_superuser)
):
    """
    Reactivate a suspended tenant

    Requires superuser privileges
    """
    try:
        tenant_service = TenantAdminService(db)

        tenant = await tenant_service.reactivate_tenant(
            tenant_id,
            reactivated_by=current_user.id
        )

        return TenantResponse.from_orm(tenant)

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to reactivate tenant: {str(e)}")

@router.delete("/tenants/{tenant_id}", status_code=204)
async def delete_tenant(
    tenant_id: str,
    deletion_data: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(require_superuser)
):
    """
    Delete a tenant (soft or hard delete)

    Requires superuser privileges
    WARNING: Hard delete is irreversible
    """
    try:
        tenant_service = TenantAdminService(db)

        success = await tenant_service.delete_tenant(
            tenant_id,
            reason=deletion_data.get("reason", "No reason provided"),
            deleted_by=current_user.id,
            soft_delete=deletion_data.get("soft_delete", True)
        )

        if not success:
            raise HTTPException(status_code=500, detail="Failed to delete tenant")

        return None

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete tenant: {str(e)}")

@router.post("/tenants/bulk-update", response_model=List[TenantResponse])
async def bulk_update_tenants(
    bulk_request: BulkTenantUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_superuser)
):
    """
    Bulk update multiple tenants

    Requires superuser privileges
    """
    try:
        tenant_service = TenantAdminService(db)

        updated_tenants = await tenant_service.bulk_update_tenants(
            bulk_request.tenant_ids,
            bulk_request.updates.dict(exclude_unset=True),
            updated_by=current_user.id
        )

        return [TenantResponse.from_orm(tenant) for tenant in updated_tenants]

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to bulk update tenants: {str(e)}")

# User Management Endpoints

@router.get("/tenants/{tenant_id}/users", response_model=UserListResponse)
async def get_tenant_users(
    tenant_id: str,
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(50, ge=1, le=100, description="Results per page"),
    include_inactive: bool = Query(False, description="Include inactive users"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_superuser)
):
    """
    Get users for a specific tenant

    Requires superuser privileges
    """
    try:
        tenant_service = TenantAdminService(db)

        result = await tenant_service.get_tenant_users(
            tenant_id,
            include_inactive=include_inactive,
            page=page,
            limit=limit
        )

        return UserListResponse(
            users=[UserResponse.from_orm(user) for user in result["users"]],
            pagination=result["pagination"]
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get tenant users: {str(e)}")

@router.post("/tenants/{tenant_id}/users", response_model=UserResponse, status_code=201)
async def add_user_to_tenant(
    tenant_id: str,
    user_data: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_superuser)
):
    """
    Add a new user to a tenant

    Requires superuser privileges
    """
    try:
        tenant_service = TenantAdminService(db)

        user = await tenant_service.add_user_to_tenant(
            tenant_id,
            user_data.dict(),
            added_by=current_user.id
        )

        return UserResponse.from_orm(user)

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to add user to tenant: {str(e)}")

@router.delete("/tenants/{tenant_id}/users/{user_id}", status_code=204)
async def remove_user_from_tenant(
    tenant_id: str,
    user_id: str,
    removal_data: Optional[Dict[str, Any]] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_superuser)
):
    """
    Remove a user from a tenant

    Requires superuser privileges
    """
    try:
        tenant_service = TenantAdminService(db)

        success = await tenant_service.remove_user_from_tenant(
            tenant_id,
            user_id,
            reason=removal_data.get("reason") if removal_data else None,
            removed_by=current_user.id
        )

        if not success:
            raise HTTPException(status_code=500, detail="Failed to remove user from tenant")

        return None

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to remove user from tenant: {str(e)}")

# Metrics and Monitoring Endpoints

@router.get("/tenants/{tenant_id}/metrics", response_model=TenantMetricsResponse)
async def get_tenant_metrics(
    tenant_id: str,
    start_date: Optional[str] = Query(None, description="Start date (ISO format)"),
    end_date: Optional[str] = Query(None, description="End date (ISO format)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_superuser)
):
    """
    Get comprehensive usage metrics for a tenant

    Requires superuser privileges
    """
    try:
        tenant_service = TenantAdminService(db)

        # Parse dates
        parsed_start_date = None
        parsed_end_date = None

        if start_date:
            parsed_start_date = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
        if end_date:
            parsed_end_date = datetime.fromisoformat(end_date.replace('Z', '+00:00'))

        metrics = await tenant_service.get_tenant_usage_metrics(
            tenant_id,
            start_date=parsed_start_date,
            end_date=parsed_end_date
        )

        return TenantMetricsResponse(**metrics)

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get tenant metrics: {str(e)}")

@router.get("/tenants/{tenant_id}/health")
async def get_tenant_health(
    tenant_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_superuser)
):
    """
    Get tenant health status

    Requires superuser privileges
    """
    try:
        tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant not found")

        # Check various health indicators
        health_status = {
            "tenant_id": tenant_id,
            "status": tenant.status,
            "overall_health": "healthy",
            "checks": {
                "tenant_status": tenant.status == "active",
                "billing_status": not tenant.billing_issues,
                "resource_usage": tenant.current_user_count <= tenant.max_users,
                "storage_usage": True,  # Would check actual storage
                "api_status": True,  # Would check API health
            },
            "last_activity": tenant.last_activity_at.isoformat() if tenant.last_activity_at else None,
            "created_at": tenant.created_at.isoformat(),
            "updated_at": tenant.updated_at.isoformat() if tenant.updated_at else None
        }

        # Determine overall health
        if not all(health_status["checks"].values()):
            health_status["overall_health"] = "degraded"

        return health_status

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get tenant health: {str(e)}")

# Billing and Usage Endpoints

@router.get("/tenants/{tenant_id}/billing")
async def get_tenant_billing_info(
    tenant_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_superuser)
):
    """
    Get tenant billing information and usage

    Requires superuser privileges
    """
    try:
        tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant not found")

        # Get current billing period
        now = datetime.now(timezone.utc)
        current_month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        # Calculate usage metrics
        user_count = db.query(User).filter(
            and_(
                User.tenant_id == tenant_id,
                User.is_active == True
            )
        ).count()

        billing_info = {
            "tenant_id": tenant_id,
            "plan": tenant.plan,
            "tier": tenant.tier,
            "monthly_cost": float(tenant.current_monthly_cost or 0),
            "billing_email": tenant.billing_email,
            "billing_address": tenant.billing_address,
            "payment_method": "invoice",  # Would get from payment system
            "current_period": {
                "start": current_month_start.isoformat(),
                "end": (current_month_start + timedelta(days=32)).replace(day=1).isoformat()
            },
            "usage": {
                "users": {
                    "current": user_count,
                    "limit": tenant.max_users,
                    "percentage": (user_count / tenant.max_users) * 100
                },
                "workflows": {
                    "current": 0,  # Would get from workflow service
                    "limit": tenant.max_workflows,
                    "percentage": 0
                },
                "storage": {
                    "current_gb": 0,  # Would get from storage service
                    "limit_gb": tenant.storage_quota_gb,
                    "percentage": 0
                }
            },
            "billing_issues": tenant.billing_issues,
            "auto_renew_enabled": tenant.auto_renew_enabled,
            "next_billing_date": (current_month_start + timedelta(days=32)).replace(day=1).isoformat()
        }

        return billing_info

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get billing info: {str(e)}")

@router.post("/tenants/{tenant_id}/billing/invoice")
async def generate_tenant_invoice(
    tenant_id: str,
    invoice_data: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(require_superuser)
):
    """
    Generate invoice for tenant

    Requires superuser privileges
    """
    try:
        # This would integrate with actual billing system
        # For now, just return a mock response

        invoice = {
            "invoice_id": f"inv_{tenant_id[:8]}_{datetime.now().strftime('%Y%m%d%H%M%S')}",
            "tenant_id": tenant_id,
            "amount": invoice_data.get("amount", 0),
            "due_date": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(),
            "status": "draft",
            "line_items": invoice_data.get("line_items", []),
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "generated_by": str(current_user.id)
        }

        return invoice

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate invoice: {str(e)}")

# Background task helper

async def _setup_new_tenant_resources(tenant_id: str, admin_user_id: str):
    """
    Background task to set up resources for a new tenant
    """
    # This would include:
    # - Creating default workflows
    # - Setting up initial data
    # - Configuring default permissions
    # - Sending welcome emails
    # - etc.
    pass