from typing import Any
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from udp.infrastructure.repositories.organizations import OrganizationRepository


class OrganizationService:
    """Business logic for organizations."""

    def __init__(self, repo: OrganizationRepository, db: AsyncSession) -> None:
        self.repo = repo
        self.db = db

    @staticmethod
    def serialize(model) -> dict[str, Any]:
        return {
            "id": str(model.id),
            "name": model.name,
            "slug": model.slug,
            "domain": model.domain,
            "industry": model.industry,
            "size": model.size,
            "country": model.country,
            "compliance_frameworks": model.compliance_frameworks or [],
            "allowed_licenses": model.allowed_licenses or [],
            "blocked_licenses": model.blocked_licenses or [],
            "max_vulnerability_score": model.max_vulnerability_score,
            "auto_update_enabled": model.auto_update_enabled,
            "require_approval": model.require_approval,
            "notification_emails": model.notification_emails or [],
            "settings": model.settings or {},
            "created_at": model.created_at.isoformat() if model.created_at else None,
            "updated_at": model.updated_at.isoformat() if model.updated_at else None,
            "is_deleted": model.is_deleted,
        }

    async def list(self, skip: int, limit: int) -> dict[str, Any]:
        total = await self.repo.count(self.db)
        orgs = await self.repo.list(self.db, skip=skip, limit=min(max(limit, 1), 500))
        return {
            "organizations": [self.serialize(o) for o in orgs],
            "total": total,
            "skip": skip,
            "limit": limit,
        }

    async def create(self, data: dict[str, Any]) -> dict[str, Any]:
        name = (data.get("name") or "").strip()
        slug = (data.get("slug") or "").strip()
        if not name or not slug:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="'name' and 'slug' are required")

        # Check uniqueness
        if await self.repo.get_by_slug(self.db, slug):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Organization with slug '{slug}' already exists")

        try:
            org = await self.repo.create(self.db, {
                "name": name,
                "slug": slug,
                "domain": data.get("domain"),
                "industry": data.get("industry"),
                "size": data.get("size"),
                "country": data.get("country"),
                "compliance_frameworks": data.get("compliance_frameworks", []),
                "allowed_licenses": data.get("allowed_licenses", []),
                "blocked_licenses": data.get("blocked_licenses", []),
                "max_vulnerability_score": data.get("max_vulnerability_score", 7.0),
                "auto_update_enabled": data.get("auto_update_enabled", False),
                "require_approval": data.get("require_approval", True),
                "notification_emails": data.get("notification_emails", []),
                "settings": data.get("settings", {}),
            })
        except IntegrityError:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Organization with slug '{slug}' already exists")

        return self.serialize(org)

    async def get(self, organization_id: UUID) -> dict[str, Any]:
        org = await self.repo.get(self.db, organization_id)
        if not org or getattr(org, "is_deleted", False):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")
        return self.serialize(org)

    async def update_settings(self, organization_id: UUID, settings: dict[str, Any]) -> dict[str, Any]:
        if not isinstance(settings, dict):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Settings must be an object")
        org = await self.repo.get(self.db, organization_id)
        if not org or getattr(org, "is_deleted", False):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")
        org = await self.repo.update_settings(self.db, org, settings)
        return {"status": "updated", "organization": self.serialize(org)}

    async def update(self, organization_id: UUID, data: dict[str, Any]) -> dict[str, Any]:
        org = await self.repo.get(self.db, organization_id)
        if not org or getattr(org, "is_deleted", False):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")

        # Handle slug uniqueness if updating
        new_slug = (data.get("slug") or "").strip() if "slug" in data else None
        if new_slug and new_slug != org.slug:
            if await self.repo.get_by_slug(self.db, new_slug):
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Organization with slug '{new_slug}' already exists")

        # Disallow updating immutable fields if any (id)
        data = {k: v for k, v in data.items() if k not in {"id", "created_at"}}

        org = await self.repo.update(self.db, org, data)
        return self.serialize(org)

    async def delete(self, organization_id: UUID) -> dict[str, Any]:
        org = await self.repo.get(self.db, organization_id)
        if not org or getattr(org, "is_deleted", False):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")
        org = await self.repo.soft_delete(self.db, org)
        return {"status": "deleted", "id": str(org.id)}
