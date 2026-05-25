from typing import Any, Optional
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from udp.infrastructure.models import OrganizationModel


class OrganizationRepository:
    """Data access for organizations."""

    async def count(self, db: AsyncSession) -> int:
        result = await db.execute(
            select(func.count()).select_from(OrganizationModel).where(OrganizationModel.is_deleted == False)  # noqa: E712
        )
        return int(result.scalar() or 0)

    async def list(self, db: AsyncSession, skip: int, limit: int) -> list[OrganizationModel]:
        result = await db.execute(
            select(OrganizationModel)
            .where(OrganizationModel.is_deleted == False)  # noqa: E712
            .order_by(OrganizationModel.created_at.desc())
            .offset(max(skip, 0))
            .limit(limit)
        )
        return list(result.scalars().all())

    async def get(self, db: AsyncSession, organization_id: UUID) -> Optional[OrganizationModel]:
        return await db.get(OrganizationModel, organization_id)

    async def get_by_slug(self, db: AsyncSession, slug: str) -> Optional[OrganizationModel]:
        result = await db.execute(select(OrganizationModel).where(OrganizationModel.slug == slug))
        return result.scalars().first()

    async def create(self, db: AsyncSession, data: dict[str, Any]) -> OrganizationModel:
        org = OrganizationModel(**data)
        db.add(org)
        await db.commit()
        await db.refresh(org)
        return org

    async def update_settings(self, db: AsyncSession, org: OrganizationModel, settings: dict[str, Any]) -> OrganizationModel:
        current = org.settings or {}
        current.update(settings)
        org.settings = current
        await db.commit()
        await db.refresh(org)
        return org

    async def update(self, db: AsyncSession, org: OrganizationModel, data: dict[str, Any]) -> OrganizationModel:
        for key, value in data.items():
            if hasattr(org, key):
                setattr(org, key, value)
        await db.commit()
        await db.refresh(org)
        return org

    async def soft_delete(self, db: AsyncSession, org: OrganizationModel) -> OrganizationModel:
        org.is_deleted = True
        await db.commit()
        await db.refresh(org)
        return org
