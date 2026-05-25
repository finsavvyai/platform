"""
Multi-Cloud Infrastructure Orchestration API Endpoints
REST API for managing multi-cloud providers and resources
"""

import asyncio
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func

from app.api.v1.deps import get_current_user, get_db_session, get_tenant_id
from app.database import get_db
from app.models.user import User
from app.models.multi_cloud import (
    MultiCloudProvider, CloudResource, CloudDeployment, CloudCostTracker,
    CloudSecurityPolicy, CloudResourceGroup, CloudTemplate
)
from app.schemas.multi_cloud import (
    MultiCloudProviderCreate, MultiCloudProviderUpdate, MultiCloudProviderResponse,
    CloudResourceCreate, CloudResourceUpdate, CloudResourceResponse,
    CloudDeploymentCreate, CloudDeploymentUpdate, CloudDeploymentResponse,
    CloudCostTrackerCreate, CloudCostTrackerResponse,
    CloudSecurityPolicyCreate, CloudSecurityPolicyUpdate, CloudSecurityPolicyResponse,
    CloudTemplateCreate, CloudTemplateUpdate, CloudTemplateResponse,
    CloudResourceGroupCreate, CloudResourceGroupUpdate, CloudResourceGroupResponse,
    ResourceMetricsRequest, ResourceMetricsResponse,
    CostTrackingRequest, CostTrackingResponse,
    OptimizationAnalysisResponse, HealthCheckResponse
)
from app.services.multi_cloud_service import multi_cloud_service
from app.services.cloudflare_service import CloudflareService
from app.core.permissions import require_permission
from app.core.exceptions import ValidationError, NotFoundError, PermissionError
from app.utils.audit import log_action

router = APIRouter()


# Provider Management Endpoints
@router.post("/providers", response_model=MultiCloudProviderResponse, status_code=status.HTTP_201_CREATED)
async def create_provider(
    provider_data: MultiCloudProviderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: UUID = Depends(get_tenant_id)
):
    """Create a new multi-cloud provider"""
    try:
        # Check if provider name already exists for tenant
        existing_provider = db.query(MultiCloudProvider).filter(
            and_(
                MultiCloudProvider.tenant_id == tenant_id,
                MultiCloudProvider.name == provider_data.name
            )
        ).first()

        if existing_provider:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Provider '{provider_data.name}' already exists"
            )

        # Create provider
        provider = MultiCloudProvider(
            tenant_id=tenant_id,
            **provider_data.dict()
        )

        db.add(provider)
        db.commit()
        db.refresh(provider)

        # Test provider connection
        connection_success = await multi_cloud_service.initialize_provider(str(provider.id))

        if connection_success:
            provider.is_connected = True
            provider.last_connection_test = datetime.now(timezone.utc)
            provider.health_status = "healthy"
            db.commit()

        # Log action
        await log_action(
            user_id=str(current_user.id),
            tenant_id=str(tenant_id),
            action="create_cloud_provider",
            resource_id=str(provider.id),
            resource_type="multi_cloud_provider",
            details={"provider_name": provider.name, "provider_type": provider.provider_type}
        )

        return provider

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create provider: {str(e)}"
        )


@router.get("/providers", response_model=List[MultiCloudProviderResponse])
async def list_providers(
    provider_type: Optional[str] = Query(None, description="Filter by provider type"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of records"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: UUID = Depends(get_tenant_id)
):
    """List multi-cloud providers"""
    try:
        query = db.query(MultiCloudProvider).filter(MultiCloudProvider.tenant_id == tenant_id)

        if provider_type:
            query = query.filter(MultiCloudProvider.provider_type == provider_type)

        if is_active is not None:
            query = query.filter(MultiCloudProvider.is_active == is_active)

        providers = query.offset(skip).limit(limit).all()
        return providers

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list providers: {str(e)}"
        )


@router.get("/providers/{provider_id}", response_model=MultiCloudProviderResponse)
async def get_provider(
    provider_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: UUID = Depends(get_tenant_id)
):
    """Get a specific provider"""
    try:
        provider = db.query(MultiCloudProvider).filter(
            and_(
                MultiCloudProvider.id == provider_id,
                MultiCloudProvider.tenant_id == tenant_id
            )
        ).first()

        if not provider:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Provider not found"
            )

        return provider

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get provider: {str(e)}"
        )


@router.put("/providers/{provider_id}", response_model=MultiCloudProviderResponse)
async def update_provider(
    provider_id: UUID,
    provider_data: MultiCloudProviderUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: UUID = Depends(get_tenant_id)
):
    """Update a provider"""
    try:
        provider = db.query(MultiCloudProvider).filter(
            and_(
                MultiCloudProvider.id == provider_id,
                MultiCloudProvider.tenant_id == tenant_id
            )
        ).first()

        if not provider:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Provider not found"
            )

        # Update provider
        update_data = provider_data.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(provider, field, value)

        provider.updated_at = datetime.now(timezone.utc)
        provider.updated_by = current_user.id
        db.commit()

        # Re-initialize connection if credentials changed
        if 'credentials' in update_data:
            await multi_cloud_service.initialize_provider(str(provider.id))

        # Log action
        await log_action(
            user_id=str(current_user.id),
            tenant_id=str(tenant_id),
            action="update_cloud_provider",
            resource_id=str(provider.id),
            resource_type="multi_cloud_provider",
            details={"updated_fields": list(update_data.keys())}
        )

        return provider

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update provider: {str(e)}"
        )


@router.delete("/providers/{provider_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_provider(
    provider_id: UUID,
    force: bool = Query(False, description="Force deletion"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: UUID = Depends(get_tenant_id)
):
    """Delete a provider"""
    try:
        provider = db.query(MultiCloudProvider).filter(
            and_(
                MultiCloudProvider.id == provider_id,
                MultiCloudProvider.tenant_id == tenant_id
            )
        ).first()

        if not provider:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Provider not found"
            )

        # Check for existing resources
        resource_count = db.query(CloudResource).filter(
            CloudResource.provider_id == provider_id
        ).count()

        if resource_count > 0 and not force:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Provider has {resource_count} resources. Use force=true to delete anyway."
            )

        # Delete provider (cascade delete will handle resources if force=true)
        db.delete(provider)
        db.commit()

        # Log action
        await log_action(
            user_id=str(current_user.id),
            tenant_id=str(tenant_id),
            action="delete_cloud_provider",
            resource_id=str(provider.id),
            resource_type="multi_cloud_provider",
            details={"provider_name": provider.name, "force_delete": force}
        )

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete provider: {str(e)}"
        )


@router.post("/providers/{provider_id}/test-connection")
async def test_provider_connection(
    provider_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: UUID = Depends(get_tenant_id)
):
    """Test connection to a provider"""
    try:
        provider = db.query(MultiCloudProvider).filter(
            and_(
                MultiCloudProvider.id == provider_id,
                MultiCloudProvider.tenant_id == tenant_id
            )
        ).first()

        if not provider:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Provider not found"
            )

        # Test connection
        connection_success = await multi_cloud_service.initialize_provider(str(provider.id))

        # Update provider status
        if connection_success:
            provider.is_connected = True
            provider.last_connection_test = datetime.now(timezone.utc)
            provider.health_status = "healthy"
            provider.connection_error = None
        else:
            provider.is_connected = False
            provider.health_status = "unhealthy"
            provider.connection_error = "Connection test failed"

        provider.updated_at = datetime.now(timezone.utc)
        db.commit()

        return {
            "provider_id": str(provider_id),
            "connection_status": "success" if connection_success else "failed",
            "last_test": provider.last_connection_test,
            "health_status": provider.health_status,
            "error_message": provider.connection_error
        }

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to test provider connection: {str(e)}"
        )


# Resource Management Endpoints
@router.post("/resources", response_model=CloudResourceResponse, status_code=status.HTTP_201_CREATED)
async def deploy_resource(
    resource_data: CloudResourceCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: UUID = Depends(get_tenant_id)
):
    """Deploy a new cloud resource"""
    try:
        # Validate provider exists and belongs to tenant
        provider = db.query(MultiCloudProvider).filter(
            and_(
                MultiCloudProvider.id == resource_data.provider_id,
                MultiCloudProvider.tenant_id == tenant_id
            )
        ).first()

        if not provider:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Provider not found"
            )

        # Create deployment record
        deployment = CloudDeployment(
            tenant_id=tenant_id,
            provider_id=resource_data.provider_id,
            name=f"Deploy {resource_data.name}",
            deployment_type="infrastructure",
            resources=[resource_data.dict()],
            status="in_progress",
            created_by=current_user.id
        )

        db.add(deployment)
        db.commit()
        db.refresh(deployment)

        # Deploy resource asynchronously
        background_tasks.add_task(
            deploy_resource_background,
            str(deployment.id),
            str(resource_data.provider_id),
            resource_data.dict(),
            str(current_user.id),
            str(tenant_id)
        )

        # Log action
        await log_action(
            user_id=str(current_user.id),
            tenant_id=str(tenant_id),
            action="deploy_cloud_resource",
            resource_id=str(deployment.id),
            resource_type="cloud_deployment",
            details={"resource_name": resource_data.name, "resource_type": resource_data.type}
        )

        return {
            "id": deployment.id,
            "tenant_id": tenant_id,
            "provider_id": resource_data.provider_id,
            "deployment_id": deployment.id,
            "name": resource_data.name,
            "type": resource_data.type,
            "status": "creating",
            "created_at": deployment.created_at,
            "created_by": current_user.id
        }

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to deploy resource: {str(e)}"
        )


async def deploy_resource_background(
    deployment_id: str,
    provider_id: str,
    resource_config: Dict[str, Any],
    user_id: str,
    tenant_id: str
):
    """Background task for resource deployment"""
    try:
        result = await multi_cloud_service.deploy_resource(
            deployment_id,
            provider_id,
            resource_config
        )

        # Log successful deployment
        await log_action(
            user_id=user_id,
            tenant_id=tenant_id,
            action="resource_deployment_completed",
            resource_id=deployment_id,
            resource_type="cloud_deployment",
            details={"resource_name": resource_config.get('name'), "result": result}
        )

    except Exception as e:
        # Log failed deployment
        await log_action(
            user_id=user_id,
            tenant_id=tenant_id,
            action="resource_deployment_failed",
            resource_id=deployment_id,
            resource_type="cloud_deployment",
            details={"resource_name": resource_config.get('name'), "error": str(e)}
        )


@router.get("/resources", response_model=List[CloudResourceResponse])
async def list_resources(
    provider_id: Optional[UUID] = Query(None, description="Filter by provider"),
    resource_type: Optional[str] = Query(None, description="Filter by resource type"),
    status: Optional[str] = Query(None, description="Filter by status"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of records"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: UUID = Depends(get_tenant_id)
):
    """List cloud resources"""
    try:
        query = db.query(CloudResource).filter(CloudResource.tenant_id == tenant_id)

        if provider_id:
            query = query.filter(CloudResource.provider_id == provider_id)

        if resource_type:
            query = query.filter(CloudResource.type == resource_type)

        if status:
            query = query.filter(CloudResource.status == status)

        resources = query.offset(skip).limit(limit).all()
        return resources

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list resources: {str(e)}"
        )


@router.get("/resources/{resource_id}", response_model=CloudResourceResponse)
async def get_resource(
    resource_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: UUID = Depends(get_tenant_id)
):
    """Get a specific resource"""
    try:
        resource = db.query(CloudResource).filter(
            and_(
                CloudResource.id == resource_id,
                CloudResource.tenant_id == tenant_id
            )
        ).first()

        if not resource:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Resource not found"
            )

        return resource

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get resource: {str(e)}"
        )


@router.put("/resources/{resource_id}", response_model=CloudResourceResponse)
async def update_resource(
    resource_id: UUID,
    resource_data: CloudResourceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: UUID = Depends(get_tenant_id)
):
    """Update a resource configuration"""
    try:
        resource = db.query(CloudResource).filter(
            and_(
                CloudResource.id == resource_id,
                CloudResource.tenant_id == tenant_id
            )
        ).first()

        if not resource:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Resource not found"
            )

        # Update resource
        update_data = resource_data.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(resource, field, value)

        resource.updated_at = datetime.now(timezone.utc)
        resource.updated_by = current_user.id
        db.commit()

        # Log action
        await log_action(
            user_id=str(current_user.id),
            tenant_id=str(tenant_id),
            action="update_cloud_resource",
            resource_id=str(resource_id),
            resource_type="cloud_resource",
            details={"updated_fields": list(update_data.keys())}
        )

        return resource

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update resource: {str(e)}"
        )


@router.delete("/resources/{resource_id}")
async def delete_resource(
    resource_id: UUID,
    force: bool = Query(False, description="Force deletion"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: UUID = Depends(get_tenant_id)
):
    """Delete a cloud resource"""
    try:
        resource = db.query(CloudResource).filter(
            and_(
                CloudResource.id == resource_id,
                CloudResource.tenant_id == tenant_id
            )
        ).first()

        if not resource:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Resource not found"
            )

        # Delete resource from provider
        delete_result = await multi_cloud_service.delete_resource(
            str(resource_id), force=force
        )

        # Update resource status
        resource.status = "deleted"
        resource.deleted_at = datetime.now(timezone.utc)
        resource.updated_by = current_user.id
        db.commit()

        # Log action
        await log_action(
            user_id=str(current_user.id),
            tenant_id=str(tenant_id),
            action="delete_cloud_resource",
            resource_id=str(resource_id),
            resource_type="cloud_resource",
            details={"resource_name": resource.name, "force_delete": force}
        )

        return {
            "resource_id": str(resource_id),
            "status": "deleted",
            "delete_result": delete_result
        }

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete resource: {str(e)}"
        )


@router.get("/resources/{resource_id}/metrics", response_model=ResourceMetricsResponse)
async def get_resource_metrics(
    resource_id: UUID,
    metrics_request: ResourceMetricsRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: UUID = Depends(get_tenant_id)
):
    """Get metrics for a specific resource"""
    try:
        resource = db.query(CloudResource).filter(
            and_(
                CloudResource.id == resource_id,
                CloudResource.tenant_id == tenant_id
            )
        ).first()

        if not resource:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Resource not found"
            )

        metrics_data = await multi_cloud_service.get_resource_metrics(
            str(resource_id),
            metrics_request.time_range,
            metrics_request.metrics
        )

        return metrics_data

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get resource metrics: {str(e)}"
        )


# Deployment Management Endpoints
@router.post("/deployments", response_model=CloudDeploymentResponse, status_code=status.HTTP_201_CREATED)
async def create_deployment_plan(
    deployment_data: CloudDeploymentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: UUID = Depends(get_tenant_id)
):
    """Create a deployment plan"""
    try:
        # Validate provider
        provider = db.query(MultiCloudProvider).filter(
            and_(
                MultiCloudProvider.id == deployment_data.provider_id,
                MultiCloudProvider.tenant_id == tenant_id
            )
        ).first()

        if not provider:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Provider not found"
            )

        # Create deployment plan
        plan_result = await multi_cloud_service.create_deployment_plan(
            str(tenant_id),
            deployment_data.name,
            deployment_data.resources,
            deployment_data.dependencies
        )

        # Get deployment record
        deployment = db.query(CloudDeployment).filter(
            CloudDeployment.id == plan_result['deployment_id']
        ).first()

        # Log action
        await log_action(
            user_id=str(current_user.id),
            tenant_id=str(tenant_id),
            action="create_deployment_plan",
            resource_id=plan_result['deployment_id'],
            resource_type="cloud_deployment",
            details={"deployment_name": deployment_data.name, "resource_count": len(deployment_data.resources)}
        )

        return deployment

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create deployment plan: {str(e)}"
        )


@router.get("/deployments", response_model=List[CloudDeploymentResponse])
async def list_deployments(
    provider_id: Optional[UUID] = Query(None, description="Filter by provider"),
    status: Optional[str] = Query(None, description="Filter by deployment status"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of records"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: UUID = Depends(get_tenant_id)
):
    """List cloud deployments"""
    try:
        query = db.query(CloudDeployment).filter(CloudDeployment.tenant_id == tenant_id)

        if provider_id:
            query = query.filter(CloudDeployment.provider_id == provider_id)

        if status:
            query = query.filter(CloudDeployment.status == status)

        deployments = query.offset(skip).limit(limit).all()
        return deployments

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list deployments: {str(e)}"
        )


@router.get("/deployments/{deployment_id}", response_model=CloudDeploymentResponse)
async def get_deployment(
    deployment_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: UUID = Depends(get_tenant_id)
):
    """Get a specific deployment"""
    try:
        deployment = db.query(CloudDeployment).filter(
            and_(
                CloudDeployment.id == deployment_id,
                CloudDeployment.tenant_id == tenant_id
            )
        ).first()

        if not deployment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Deployment not found"
            )

        return deployment

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get deployment: {str(e)}"
        )


@router.post("/deployments/{deployment_id}/execute")
async def execute_deployment_plan(
    deployment_id: UUID,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: UUID = Depends(get_tenant_id)
):
    """Execute a deployment plan"""
    try:
        deployment = db.query(CloudDeployment).filter(
            and_(
                CloudDeployment.id == deployment_id,
                CloudDeployment.tenant_id == tenant_id
            )
        ).first()

        if not deployment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Deployment not found"
            )

        if deployment.status != "pending":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Deployment is in {deployment.status} status and cannot be executed"
            )

        # Execute deployment asynchronously
        background_tasks.add_task(
            execute_deployment_background,
            str(deployment_id),
            str(current_user.id),
            str(tenant_id)
        )

        # Update deployment status
        deployment.status = "in_progress"
        deployment.started_at = datetime.now(timezone.utc)
        db.commit()

        # Log action
        await log_action(
            user_id=str(current_user.id),
            tenant_id=str(tenant_id),
            action="execute_deployment",
            resource_id=str(deployment_id),
            resource_type="cloud_deployment",
            details={"deployment_name": deployment.name}
        )

        return {
            "deployment_id": str(deployment_id),
            "status": "executing",
            "message": "Deployment execution started"
        }

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to execute deployment: {str(e)}"
        )


async def execute_deployment_background(
    deployment_id: str,
    user_id: str,
    tenant_id: str
):
    """Background task for deployment execution"""
    try:
        result = await multi_cloud_service.execute_deployment_plan(deployment_id)

        # Log deployment completion
        await log_action(
            user_id=user_id,
            tenant_id=tenant_id,
            action="deployment_execution_completed",
            resource_id=deployment_id,
            resource_type="cloud_deployment",
            details={
                "status": result["status"],
                "success_count": result["success_count"],
                "total_count": result["total_count"]
            }
        )

    except Exception as e:
        # Log deployment failure
        await log_action(
            user_id=user_id,
            tenant_id=tenant_id,
            action="deployment_execution_failed",
            resource_id=deployment_id,
            resource_type="cloud_deployment",
            details={"error": str(e)}
        )


# Cost Tracking Endpoints
@router.get("/costs", response_model=CostTrackingResponse)
async def get_cost_tracking(
    cost_request: CostTrackingRequest,
    current_user: User = Depends(get_current_user),
    tenant_id: UUID = Depends(get_tenant_id)
):
    """Get cost tracking data"""
    try:
        cost_data = await multi_cloud_service.get_cost_tracking(
            tenant_id=cost_request.tenant_id or tenant_id,
            cost_request.provider_id,
            cost_request.time_range
        )

        return cost_data

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get cost tracking data: {str(e)}"
        )


# Optimization Endpoints
@router.get("/optimization/analyze", response_model=OptimizationAnalysisResponse)
async def analyze_optimization(
    optimization_type: str = Query("cost", description="Type of optimization: cost, performance, security"),
    current_user: User = Depends(get_current_user),
    tenant_id: UUID = Depends(get_tenant_id)
):
    """Analyze resources for optimization opportunities"""
    try:
        recommendations = await multi_cloud_service.optimize_resources(
            str(tenant_id),
            optimization_type
        )

        # Process recommendations into response format
        total_savings = sum(
            r.get('potential_savings', 0) for r in recommendations
            if isinstance(r.get('potential_savings'), (int, float))
        )

        recommendations_by_priority = {}
        recommendations_by_type = {}

        for rec in recommendations:
            priority = rec.get('priority', 'medium')
            rec_type = rec.get('type', 'unknown')

            recommendations_by_priority[priority] = recommendations_by_priority.get(priority, 0) + 1
            recommendations_by_type[rec_type] = recommendations_by_type.get(rec_type, 0) + 1

        return OptimizationAnalysisResponse(
            tenant_id=tenant_id,
            analysis_type=optimization_type,
            total_recommendations=len(recommendations),
            potential_monthly_savings=total_savings,
            recommendations_by_priority=recommendations_by_priority,
            recommendations_by_type=recommendations_by_type,
            recommendations=recommendations
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to analyze optimizations: {str(e)}"
        )


# Health Check Endpoints
@router.get("/health", response_model=HealthCheckResponse)
async def get_multi_cloud_health(
    current_user: User = Depends(get_current_user),
    tenant_id: UUID = Depends(get_tenant_id)
):
    """Get health status of all cloud providers"""
    try:
        # Get all providers for tenant
        async with get_db_session() as db:
            providers = db.query(MultiCloudProvider).filter(
                MultiCloudProvider.tenant_id == tenant_id
            ).all()

        # Test each provider
        provider_checks = []
        healthy_count = 0
        unhealthy_count = 0

        for provider in providers:
            try:
                # Initialize provider and test connection
                connection_success = await multi_cloud_service.initialize_provider(str(provider.id))

                provider_check = {
                    "provider_id": str(provider.id),
                    "provider_name": provider.name,
                    "provider_type": provider.provider_type,
                    "status": "healthy" if connection_success else "unhealthy",
                    "last_check": datetime.now(timezone.utc),
                    "response_time_ms": None,  # Would implement timing in real service
                    "error_message": None if connection_success else "Connection failed",
                    "metrics": {}
                }

                if connection_success:
                    healthy_count += 1
                else:
                    unhealthy_count += 1

            except Exception as e:
                provider_check = {
                    "provider_id": str(provider.id),
                    "provider_name": provider.name,
                    "provider_type": provider.provider_type,
                    "status": "error",
                    "last_check": datetime.now(timezone.utc),
                    "response_time_ms": None,
                    "error_message": str(e),
                    "metrics": {}
                }
                unhealthy_count += 1

            provider_checks.append(provider_check)

        # Determine overall status
        total_providers = len(providers)
        overall_status = "healthy" if healthy_count == total_providers else "degraded" if healthy_count > 0 else "unhealthy"

        return HealthCheckResponse(
            overall_status=overall_status,
            total_providers=total_providers,
            healthy_providers=healthy_count,
            unhealthy_providers=unhealthy_count,
            provider_checks=provider_checks,
            timestamp=datetime.now(timezone.utc)
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get health status: {str(e)}"
        )


# Security Policy Endpoints (placeholder implementations)
@router.post("/security-policies", response_model=CloudSecurityPolicyResponse, status_code=status.HTTP_201_CREATED)
async def create_security_policy(
    policy_data: CloudSecurityPolicyCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: UUID = Depends(get_tenant_id)
):
    """Create a security policy"""
    # Implementation would go here
    pass


@router.get("/security-policies", response_model=List[CloudSecurityPolicyResponse])
async def list_security_policies(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: UUID = Depends(get_tenant_id)
):
    """List security policies"""
    # Implementation would go here
    pass


# Template Endpoints (placeholder implementations)
@router.post("/templates", response_model=CloudTemplateResponse, status_code=status.HTTP_201_CREATED)
async def create_template(
    template_data: CloudTemplateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: UUID = Depends(get_tenant_id)
):
    """Create an infrastructure template"""
    # Implementation would go here
    pass


@router.get("/templates", response_model=List[CloudTemplateResponse])
async def list_templates(
    template_type: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: UUID = Depends(get_tenant_id)
):
    """List infrastructure templates"""
    # Implementation would go here
    pass


# Resource Group Endpoints (placeholder implementations)
@router.post("/resource-groups", response_model=CloudResourceGroupResponse, status_code=status.HTTP_201_CREATED)
async def create_resource_group(
    group_data: CloudResourceGroupCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: UUID = Depends(get_tenant_id)
):
    """Create a resource group"""
    # Implementation would go here
    pass


@router.get("/resource-groups", response_model=List[CloudResourceGroupResponse])
async def list_resource_groups(
    group_type: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: UUID = Depends(get_tenant_id)
):
    """List resource groups"""
    # Implementation would go here
    pass