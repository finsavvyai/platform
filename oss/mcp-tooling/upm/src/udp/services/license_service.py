"""License service for managing organization licenses."""

from __future__ import annotations

import logging
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


async def get_organization_license(
    organization_id: str,
    db: Optional[AsyncSession] = None,
) -> Optional[str]:
    """Get the license key for an organization.

    Args:
        organization_id: The organization ID
        db: Database session (optional)

    Returns:
        The license key or None if not found
    """
    # For now, check environment variable or return demo license
    import os

    # Check for demo license in env
    demo_key = os.getenv("UPM_DEMO_LICENSE")
    if demo_key:
        return demo_key

    # TODO: Query from database when organization.license_key is available
    # from sqlalchemy import select
    # result = await db.execute(
    #     select(Organization.license_key).where(Organization.id == organization_id)
    # )
    # return result.scalar_one_or_none()

    return None


async def save_organization_license(
    organization_id: str,
    license_key: str,
    db: Optional[AsyncSession] = None,
) -> None:
    """Save a license key for an organization.

    Args:
        organization_id: The organization ID
        license_key: The license key to save
        db: Database session (optional)
    """
    # TODO: Save to database when organization.license_key is available
    # from sqlalchemy import update
    # await db.execute(
    #     update(Organization)
    #     .where(Organization.id == organization_id)
    #     .values(license_key=license_key)
    # )
    # await db.commit()

    logger.info(f"License saved for organization {organization_id}")


async def delete_organization_license(
    organization_id: str,
    db: Optional[AsyncSession] = None,
) -> None:
    """Delete the license key for an organization.

    Args:
        organization_id: The organization ID
        db: Database session (optional)
    """
    # TODO: Delete from database when organization.license_key is available
    # from sqlalchemy import update
    # await db.execute(
    #     update(Organization)
    #     .where(Organization.id == organization_id)
    #     .values(license_key=None)
    # )
    # await db.commit()

    logger.info(f"License deleted for organization {organization_id}")


def has_feature(organization_id: str, feature: str) -> bool:
    """Check if an organization has access to a feature.

    Args:
        organization_id: The organization ID
        feature: The feature to check

    Returns:
        True if the feature is available
    """

    # For development, always return True for core features
    # In production, check against license

    return True  # TODO: Implement proper check
