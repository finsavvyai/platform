"""
Dependency management API endpoints.

Core REST API for dependency analysis, resolution,
and management operations with ecosystem adapter integration.
"""

from typing import Any, Optional
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from udp.core.database import get_async_session
from udp.domain.models import EcosystemType
from udp.infrastructure.models import PackageModel
from udp.tools.ecosystems import (
    get_supported_ecosystems,
    get_supported_extensions,
)

logger = structlog.get_logger()
router = APIRouter()


@router.get("/")
async def list_dependencies(
    organization_id: UUID,
    ecosystem: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
    db: AsyncSession = Depends(get_async_session)
) -> dict[str, Any]:
    """
    List dependencies for an organization.

    Args:
        organization_id: Organization ID
        ecosystem: Filter by ecosystem type
        limit: Maximum number of results
        offset: Number of results to skip

    Returns:
        List of dependencies with pagination info
    """
    try:
        query = select(PackageModel).where(
            PackageModel.is_deleted == False
        ).offset(offset).limit(limit)

        if ecosystem:
            try:
                ecosystem_type = EcosystemType(ecosystem)
                query = query.where(PackageModel.ecosystem == ecosystem_type)
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid ecosystem type: {ecosystem}"
                )

        result = await db.execute(query)
        packages = result.scalars().all()

        return {
            "dependencies": [
                {
                    "id": str(pkg.id),
                    "name": pkg.name,
                    "version": pkg.version,
                    "ecosystem": pkg.ecosystem.value,
                    "namespace": pkg.namespace,
                    "description": pkg.description,
                    "license": pkg.license.value,
                    "created_at": pkg.created_at.isoformat(),
                }
                for pkg in packages
            ],
            "total": len(packages),
            "limit": limit,
            "offset": offset,
        }

    except Exception as e:
        logger.error("Failed to list dependencies", error=str(e), exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list dependencies"
        )


@router.get("/ecosystems/supported")
async def get_supported_ecosystems_endpoint() -> dict[str, Any]:
    """
    Get list of supported package ecosystems.

    Returns:
        List of supported ecosystems with their file extensions
    """
    try:
        ecosystems = get_supported_ecosystems()
        extensions = get_supported_extensions()

        return {
            "ecosystems": [
                {
                    "type": ecosystem.value,
                    "name": ecosystem.value.upper(),
                    "description": f"{ecosystem.value.upper()} package ecosystem",
                    "supported_extensions": extensions  # All extensions are supported by all ecosystems for now
                }
                for ecosystem in ecosystems
            ],
            "total": len(ecosystems),
            "total_extensions": len(extensions)
        }

    except Exception as e:
        logger.error("Failed to get supported ecosystems", error=str(e), exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get supported ecosystems"
        )
