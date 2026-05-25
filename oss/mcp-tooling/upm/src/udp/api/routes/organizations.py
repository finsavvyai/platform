"""
Organization management API endpoints.

REST API for enterprise organization configuration,
settings, and multi-tenant management.
"""

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from udp.api.routes.dependencies import (
    require_permission,
)
from udp.api.schemas.organizations import (
    OrganizationCreate,
    OrganizationListResponse,
    OrganizationResponse,
    OrganizationSettingsUpdate,
    OrganizationUpdate,
    SettingsUpdateResponse,
)
from udp.core.database import get_async_session
from udp.infrastructure.repositories.organizations import OrganizationRepository
from udp.security.permissions import ORG_ADMIN, ORG_READ, ORG_WRITE
from udp.services.organizations import OrganizationService

router = APIRouter()


def get_org_service(db: AsyncSession = Depends(get_async_session)) -> OrganizationService:
    """Dependency provider for organization service."""
    return OrganizationService(OrganizationRepository(), db)


@router.get("/", response_model=OrganizationListResponse)
async def list_organizations(
    skip: int = 0,
    limit: int = 100,
    service: OrganizationService = Depends(get_org_service),
    current_user = Depends(require_permission(ORG_READ))
) -> dict[str, Any]:
    """List all organizations with pagination."""
    if limit is None or limit <= 0:
        limit = 100
    return await service.list(skip=skip, limit=limit)


@router.post("/", status_code=status.HTTP_201_CREATED, response_model=OrganizationResponse)
async def create_organization(
    organization_data: OrganizationCreate,
    service: OrganizationService = Depends(get_org_service),
    current_user = Depends(require_permission(ORG_ADMIN))
) -> dict[str, Any]:
    """Create a new organization."""
    return await service.create(organization_data.model_dump())


@router.get("/{organization_id}", response_model=OrganizationResponse)
async def get_organization(
    organization_id: UUID,
    service: OrganizationService = Depends(get_org_service),
    current_user = Depends(require_permission(ORG_READ))
) -> dict[str, Any]:
    """Get organization details by ID. Non-admins can only access their org."""
    org = await service.get(organization_id)
    if getattr(current_user, "role", None) != "admin" and str(org["id"]) != str(getattr(current_user, "organization_id", "")):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    return org


@router.put("/{organization_id}/settings", response_model=SettingsUpdateResponse)
async def update_organization_settings(
    organization_id: UUID,
    settings_data: OrganizationSettingsUpdate,
    service: OrganizationService = Depends(get_org_service),
    current_user = Depends(require_permission(ORG_WRITE))
) -> dict[str, Any]:
    """Update organization settings by merging provided keys."""
    return await service.update_settings(organization_id, settings_data.model_dump())


@router.put("/{organization_id}", response_model=OrganizationResponse)
async def update_organization(
    organization_id: UUID,
    update_data: OrganizationUpdate,
    service: OrganizationService = Depends(get_org_service),
    current_user = Depends(require_permission(ORG_WRITE))
) -> dict[str, Any]:
    """Update organization fields (e.g., name, slug, domain)."""
    return await service.update(organization_id, update_data.model_dump(exclude_unset=True))


@router.delete("/{organization_id}")
async def delete_organization(
    organization_id: UUID,
    service: OrganizationService = Depends(get_org_service),
    current_user = Depends(require_permission(ORG_ADMIN))
) -> dict[str, Any]:
    """Soft-delete an organization."""
    return await service.delete(organization_id)
