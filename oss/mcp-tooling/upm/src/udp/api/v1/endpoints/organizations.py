"""
Organization management endpoints for Universal Dependency Platform.
"""

from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from udp.core.schemas.organization import (
    MemberAdd,
    MemberResponse,
    MemberUpdate,
    OrganizationCreate,
    OrganizationResponse,
    OrganizationSettingsUpdate,
    OrganizationUpdate,
)
from udp.core.services import ConflictError, NotFoundError, ValidationError
from udp.infrastructure.database import get_async_session
from udp.security.auth import get_current_user
from udp.services.organization import OrganizationService

router = APIRouter()


def _org_to_response(org) -> dict:
    """Convert an Organization model to response dict."""
    return {
        "id": str(org.id),
        "name": org.name,
        "slug": org.slug,
        "description": org.description,
        "domain": org.domain,
        "website": org.website,
        "logo_url": org.logo_url,
        "status": org.status or "active",
        "is_enterprise": org.is_enterprise if org.is_enterprise is not None else False,
        "subscription_tier": org.subscription_tier,
        "max_users": org.max_users,
        "max_projects": org.max_projects,
        "created_at": org.created_at,
        "updated_at": org.updated_at,
    }


@router.get("/", response_model=list[OrganizationResponse])
async def list_organizations(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_async_session),
    current_user=Depends(get_current_user),
) -> Any:
    """List organizations with filtering and pagination."""
    service = OrganizationService(db)
    orgs = await service.list_organizations(
        limit=limit,
        offset=skip,
        status=status,
        search=search,
    )
    return [_org_to_response(o) for o in orgs]


@router.post("/", response_model=OrganizationResponse, status_code=201)
async def create_organization(
    org_data: OrganizationCreate,
    db: AsyncSession = Depends(get_async_session),
    current_user=Depends(get_current_user),
) -> Any:
    """Create a new organization."""
    service = OrganizationService(db)
    try:
        org = await service.create_organization(
            name=org_data.name,
            slug=org_data.slug,
            owner_user_id=current_user.id,
            description=org_data.description,
            domain=org_data.domain,
            created_by=current_user.id,
        )
    except ConflictError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except ValidationError as e:
        raise HTTPException(status_code=422, detail=str(e))
    return _org_to_response(org)


@router.get("/{organization_id}", response_model=OrganizationResponse)
async def get_organization(
    organization_id: str,
    db: AsyncSession = Depends(get_async_session),
    current_user=Depends(get_current_user),
) -> Any:
    """Get organization by ID."""
    service = OrganizationService(db)
    try:
        org = await service.get_organization_by_id(organization_id)
    except NotFoundError:
        raise HTTPException(status_code=404, detail="Organization not found")
    return _org_to_response(org)


@router.put("/{organization_id}", response_model=OrganizationResponse)
async def update_organization(
    organization_id: str,
    org_data: OrganizationUpdate,
    db: AsyncSession = Depends(get_async_session),
    current_user=Depends(get_current_user),
) -> Any:
    """Update organization information."""
    service = OrganizationService(db)
    update_dict = org_data.model_dump(exclude_unset=True)
    if not update_dict:
        raise HTTPException(status_code=400, detail="No fields to update")
    try:
        org = await service.update_organization(
            organization_id,
            update_dict,
            updated_by=current_user.id if current_user else None,
        )
    except NotFoundError:
        raise HTTPException(status_code=404, detail="Organization not found")
    return _org_to_response(org)


@router.delete("/{organization_id}")
async def delete_organization(
    organization_id: str,
    db: AsyncSession = Depends(get_async_session),
    current_user=Depends(get_current_user),
) -> Any:
    """Delete (deactivate) an organization."""
    service = OrganizationService(db)
    try:
        await service.delete_organization(
            organization_id,
            deleted_by=current_user.id,
        )
    except NotFoundError:
        raise HTTPException(status_code=404, detail="Organization not found")
    return {"message": "Organization deleted successfully"}


@router.get("/{organization_id}/members", response_model=list[MemberResponse])
async def list_members(
    organization_id: str,
    role: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_async_session),
    current_user=Depends(get_current_user),
) -> Any:
    """List organization members."""
    service = OrganizationService(db)
    try:
        members = await service.get_organization_members(
            organization_id=organization_id,
            role=role,
        )
    except NotFoundError:
        raise HTTPException(status_code=404, detail="Organization not found")
    return members


@router.post(
    "/{organization_id}/members", response_model=MemberResponse, status_code=201
)
async def add_member(
    organization_id: str,
    member_data: MemberAdd,
    db: AsyncSession = Depends(get_async_session),
    current_user=Depends(get_current_user),
) -> Any:
    """Add a member to the organization."""
    service = OrganizationService(db)
    try:
        member = await service.add_member(
            organization_id=organization_id,
            user_id=member_data.user_id,
            role=member_data.role,
            invited_by=str(current_user.id),
        )
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ConflictError as e:
        raise HTTPException(status_code=409, detail=str(e))
    return member


@router.put("/{organization_id}/members/{user_id}", response_model=MemberResponse)
async def update_member(
    organization_id: str,
    user_id: str,
    member_data: MemberUpdate,
    db: AsyncSession = Depends(get_async_session),
    current_user=Depends(get_current_user),
) -> Any:
    """Update a member's role."""
    service = OrganizationService(db)
    try:
        member = await service.update_member(
            organization_id=organization_id,
            user_id=user_id,
            role=member_data.role,
            updated_by=str(current_user.id),
        )
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return member


@router.delete("/{organization_id}/members/{user_id}")
async def remove_member(
    organization_id: str,
    user_id: str,
    db: AsyncSession = Depends(get_async_session),
    current_user=Depends(get_current_user),
) -> Any:
    """Remove a member from the organization."""
    service = OrganizationService(db)
    try:
        await service.remove_member(
            organization_id=organization_id,
            user_id=user_id,
            removed_by=str(current_user.id),
        )
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return {"message": "Member removed successfully"}


@router.get("/{organization_id}/settings")
async def get_organization_settings(
    organization_id: str,
    db: AsyncSession = Depends(get_async_session),
    current_user=Depends(get_current_user),
) -> Any:
    """Get organization settings."""
    service = OrganizationService(db)
    try:
        settings = await service.get_organization_settings(organization_id)
    except NotFoundError:
        raise HTTPException(status_code=404, detail="Organization not found")
    return settings


@router.put("/{organization_id}/settings")
async def update_organization_settings(
    organization_id: str,
    settings_data: OrganizationSettingsUpdate,
    db: AsyncSession = Depends(get_async_session),
    current_user=Depends(get_current_user),
) -> Any:
    """Update organization settings."""
    service = OrganizationService(db)
    try:
        org = await service.update_organization_settings(
            organization_id, settings_data.settings
        )
    except NotFoundError:
        raise HTTPException(status_code=404, detail="Organization not found")
    return _org_to_response(org)
