"""
Organization service for UPM multi-tenancy.

Manages organizations, organization members, and organization-level operations.
"""

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError

from ..core.models.organization import (
    Organization,
    OrganizationMember,
    OrganizationRole,
    OrganizationStatus,
)
from ..core.services import (
    ConflictError,
    NotFoundError,
    ServiceException,
)
from .base import BaseService


class OrganizationService(BaseService):
    """
    Service for managing organizations, members, and organization operations.

    Provides CRUD operations for organizations, member management,
    role assignment, and organization-level configurations.
    """

    model_class = Organization

    async def get_service_dependencies(self) -> dict:
        """Define service dependencies."""
        return {}  # OrganizationService has no dependencies

    async def create_organization(
        self,
        name: str,
        slug: str,
        owner_user_id: uuid.UUID,
        description: Optional[str] = None,
        domain: Optional[str] = None,
        created_by: Optional[uuid.UUID] = None,
    ) -> Organization:
        """Create a new organization."""
        # Validate slug uniqueness
        if await self.slug_exists(slug):
            raise ConflictError(f"Organization with slug {slug} already exists")

        # Validate domain uniqueness if provided
        if domain and await self.domain_exists(domain):
            raise ConflictError(f"Domain {domain} is already in use")

        # Create organization data
        org_data = {
            "name": name,
            "slug": slug,
            "description": description,
            "domain": domain,
            "status": OrganizationStatus.ACTIVE.value,
            "created_by": created_by or owner_user_id,
        }

        org = await self.create(org_data, created_by or owner_user_id)

        # Add owner as organization member
        await self.add_member(
            organization_id=str(org.id),
            user_id=str(owner_user_id),
            role=OrganizationRole.OWNER.value,
            invited_by=str(owner_user_id),
        )

        # Log organization creation
        self._log_operation(
            "create_organization",
            {
                "organization_id": str(org.id),
                "name": name,
                "slug": slug,
                "owner_user_id": str(owner_user_id),
            },
        )

        return org

    async def get_organization_by_id(self, organization_id: str) -> Organization:
        """Get organization by ID."""
        return await self.get_by_id(organization_id)

    async def get_organization_by_slug(self, slug: str) -> Optional[Organization]:
        """Get organization by slug."""
        query = select(Organization).where(
            Organization.slug == slug,
            Organization.status == OrganizationStatus.ACTIVE.value,
        )
        result = await self._execute_query(query)
        return result.scalar_one_or_none()

    async def update_organization(
        self,
        organization_id: str,
        update_data: dict,
        updated_by: Optional[uuid.UUID] = None,
    ) -> Organization:
        """Update organization information."""
        org = await self.get_by_id(organization_id)

        # Don't allow slug changes through this method
        # Use dedicated method for slug changes to ensure proper validation
        update_data.pop("slug", None)

        org = await self.update(organization_id, update_data, updated_by)

        # Log organization update
        self._log_operation(
            "update_organization",
            {
                "organization_id": organization_id,
                "updated_fields": list(update_data.keys()),
            },
        )

        return org

    async def delete_organization(
        self, organization_id: str, deleted_by: uuid.UUID
    ) -> None:
        """Soft delete an organization."""
        org = await self.get_by_id(organization_id)

        org.status = OrganizationStatus.INACTIVE.value
        org.updated_by = deleted_by

        try:
            await self.db_session.commit()

            # Log organization deletion
            self._log_operation(
                "delete_organization",
                {"organization_id": organization_id, "deleted_by": str(deleted_by)},
            )
        except SQLAlchemyError as e:
            await self.db_session.rollback()
            self.logger.error(f"Failed to delete organization: {str(e)}")
            raise ServiceException(
                "Failed to delete organization",
                error_code="ORGANIZATION_DELETE_ERROR",
                details={"original_error": str(e)},
            )

    async def list_organizations(
        self,
        limit: int = 100,
        offset: int = 0,
        user_id: Optional[uuid.UUID] = None,
        status: Optional[str] = None,
        search: Optional[str] = None,
    ) -> list[Organization]:
        """List organizations with optional filtering."""
        filters = {}

        if status:
            filters["status"] = status

        if search:
            # Add search for name and slug
            filters["search_term"] = f"%{search}%"

        organizations = await self.list_all(limit=limit, offset=offset, filters=filters)
        return organizations

    async def get_user_organizations(self, user_id: str) -> list[Organization]:
        """Get all organizations for a user."""
        from ..core.models.organization import OrganizationMember

        query = (
            select(Organization)
            .join(
                OrganizationMember,
                Organization.id == OrganizationMember.organization_id,
            )
            .where(
                OrganizationMember.user_id == user_id,
                OrganizationMember.is_active == True,
                Organization.status == OrganizationStatus.ACTIVE.value,
            )
        )

        result = await self._execute_query(query)
        return result.scalars().all()

    async def add_member(
        self,
        organization_id: str,
        user_id: str,
        role: str = OrganizationRole.MEMBER.value,
        permissions: Optional[dict] = None,
        invited_by: Optional[uuid.UUID] = None,
    ) -> OrganizationMember:
        """Add a member to an organization."""
        # Check if user is already a member
        if await self.is_member(organization_id, user_id):
            raise ConflictError("User is already a member of this organization")

        # Create member data
        member_data = {
            "organization_id": organization_id,
            "user_id": user_id,
            "role": role,
            "permissions": permissions or {},
            "is_active": False,  # Will be activated when user accepts
        }

        member = await self._create_organization_member(member_data, invited_by)

        # Log member addition
        self._log_operation(
            "add_member",
            {
                "organization_id": organization_id,
                "user_id": user_id,
                "role": role,
                "invited_by": str(invited_by) if invited_by else None,
            },
        )

        return member

    async def update_member(
        self, organization_id: str, user_id: str, update_data: dict
    ) -> OrganizationMember:
        """Update organization member."""
        from ..core.models.organization import OrganizationMember

        query = select(OrganizationMember).where(
            OrganizationMember.organization_id == organization_id,
            OrganizationMember.user_id == user_id,
        )
        result = await self._execute_query(query)
        member = result.scalar_one_or_none()

        if not member:
            raise NotFoundError(
                f"User {user_id} is not a member of organization {organization_id}"
            )

        member.update_from_dict(update_data)
        member.updated_at = datetime.utcnow().isoformat()

        try:
            await self.db_session.commit()
            await self.db_session.refresh(member)

            # Log member update
            self._log_operation(
                "update_member",
                {
                    "organization_id": organization_id,
                    "user_id": user_id,
                    "updated_fields": list(update_data.keys()),
                },
            )

            return member
        except SQLAlchemyError as e:
            await self.db_session.rollback()
            self.logger.error(f"Failed to update member: {str(e)}")
            raise ServiceException(
                "Failed to update member",
                error_code="MEMBER_UPDATE_ERROR",
                details={"original_error": str(e)},
            )

    async def remove_member(
        self, organization_id: str, user_id: str, removed_by: uuid.UUID
    ) -> None:
        """Remove a member from an organization (soft delete by setting left_at)."""
        from ..core.models.organization import OrganizationMember

        query = select(OrganizationMember).where(
            OrganizationMember.organization_id == organization_id,
            OrganizationMember.user_id == user_id,
        )
        result = await self._execute_query(query)
        member = result.scalar_one_or_none()

        if not member:
            raise NotFoundError(
                f"User {user_id} is not a member of organization {organization_id}"
            )

        member.is_active = False
        member.left_at = datetime.utcnow().isoformat()
        member.updated_by = removed_by

        try:
            await self.db_session.commit()

            # Log member removal
            self._log_operation(
                "remove_member",
                {
                    "organization_id": organization_id,
                    "user_id": user_id,
                    "removed_by": str(removed_by),
                },
            )
        except SQLAlchemyError as e:
            await self.db_session.rollback()
            self.logger.error(f"Failed to remove member: {str(e)}")
            raise ServiceException(
                "Failed to remove member",
                error_code="MEMBER_REMOVE_ERROR",
                details={"original_error": str(e)},
            )

    async def accept_invitation(
        self, organization_id: str, user_id: str
    ) -> OrganizationMember:
        """Accept organization membership invitation."""
        from ..core.models.organization import OrganizationMember

        query = select(OrganizationMember).where(
            OrganizationMember.organization_id == organization_id,
            OrganizationMember.user_id == user_id,
            OrganizationMember.is_active == False,
        )
        result = await self._execute_query(query)
        member = result.scalar_one_or_none()

        if not member:
            raise NotFoundError(
                f"No pending invitation for user {user_id} in organization {organization_id}"
            )

        member.is_active = True
        member.joined_at = datetime.utcnow().isoformat()
        member.updated_by = user_id  # User accepting their own invitation

        try:
            await self.db_session.commit()
            await self.db_session.refresh(member)

            # Log invitation acceptance
            self._log_operation(
                "accept_invitation",
                {"organization_id": organization_id, "user_id": user_id},
            )

            return member
        except SQLAlchemyError as e:
            await self.db_session.rollback()
            self.logger.error(f"Failed to accept invitation: {str(e)}")
            raise ServiceException(
                "Failed to accept invitation",
                error_code="INVITATION_ACCEPT_ERROR",
                details={"original_error": str(e)},
            )

    async def decline_invitation(self, organization_id: str, user_id: str) -> None:
        """Decline organization membership invitation."""
        from ..core.models.organization import OrganizationMember

        query = select(OrganizationMember).where(
            OrganizationMember.organization_id == organization_id,
            OrganizationMember.user_id == user_id,
            OrganizationMember.is_active == False,
        )
        result = await self._execute_query(query)
        member = result.scalar_one_or_none()

        if not member:
            raise NotFoundError(
                f"No pending invitation for user {user_id} in organization {organization_id}"
            )

        member.is_active = False  # Keep as inactive
        member.left_at = datetime.utcnow().isoformat()  # Mark as declined
        member.updated_by = user_id  # User declining their own invitation

        try:
            await self.db_session.commit()

            # Log invitation decline
            self._log_operation(
                "decline_invitation",
                {"organization_id": organization_id, "user_id": user_id},
            )
        except SQLAlchemyError as e:
            await self.db_session.rollback()
            self.logger.error(f"Failed to decline invitation: {str(e)}")
            raise ServiceException(
                "Failed to decline invitation",
                error_code="INVITATION_DECLINE_ERROR",
                details={"original_error": str(e)},
            )

    async def get_organization_members(
        self,
        organization_id: str,
        limit: int = 100,
        offset: int = 0,
        role: Optional[str] = None,
        is_active: Optional[bool] = None,
    ) -> list[OrganizationMember]:
        """Get all members of an organization."""
        from ..core.models.organization import OrganizationMember

        query = select(OrganizationMember).where(
            OrganizationMember.organization_id == organization_id
        )

        if role:
            query = query.where(OrganizationMember.role == role)

        if is_active is not None:
            query = query.where(OrganizationMember.is_active == is_active)

        query = (
            query.limit(limit)
            .offset(offset)
            .order_by(OrganizationMember.invited_at.desc())
        )

        result = await self._execute_query(query)
        return result.scalars().all()

    async def get_member_role(
        self, organization_id: str, user_id: str
    ) -> Optional[str]:
        """Get user's role in an organization."""
        from ..core.models.organization import OrganizationMember

        query = select(OrganizationMember.role).where(
            OrganizationMember.organization_id == organization_id,
            OrganizationMember.user_id == user_id,
            OrganizationMember.is_active == True,
        )
        result = await self._execute_query(query)
        return result.scalar_one_or_none()

    async def has_permission(
        self, organization_id: str, user_id: str, permission: str
    ) -> bool:
        """Check if user has specific permission in organization."""
        member = await self.get_member_by_ids(organization_id, user_id)
        if not member:
            return False

        # Check role-based permissions
        role_permissions = {
            OrganizationRole.OWNER.value: [
                "manage_users",
                "manage_projects",
                "manage_policies",
                "view_reports",
                "manage_billing",
                "delete_organization",
            ],
            OrganizationRole.ADMIN.value: [
                "manage_users",
                "manage_projects",
                "manage_policies",
                "view_reports",
            ],
            OrganizationRole.MEMBER.value: [
                "view_projects",
                "create_projects",
                "view_reports",
            ],
            OrganizationRole.VIEWER.value: ["view_projects", "view_reports"],
        }

        # Check if permission is in role permissions
        if permission in role_permissions.get(member.role, []):
            return True

        # Check custom permissions
        if member.permissions and permission in member.permissions:
            return member.permissions[permission]

        return False

    async def can_add_user(self, organization_id: str) -> bool:
        """Check if organization can add more users."""
        org = await self.get_by_id(organization_id)
        if org.is_enterprise:
            return True

        from ..core.models.organization import OrganizationMember

        query = select(func.count(OrganizationMember.user_id)).where(
            OrganizationMember.organization_id == organization_id,
            OrganizationMember.is_active == True,
        )
        result = await self._execute_query(query)
        current_count = result.scalar()

        return current_count < int(org.max_users)

    async def slug_exists(
        self, slug: str, exclude_org_id: Optional[str] = None
    ) -> bool:
        """Check if organization slug already exists."""
        query = select(Organization).where(Organization.slug == slug)

        if exclude_org_id:
            try:
                exclude_uuid = uuid.UUID(exclude_org_id)
                query = query.where(Organization.id != exclude_uuid)
            except ValueError:
                # Invalid UUID format, exclude by string comparison
                query = query.where(Organization.id != exclude_org_id)

        result = await self._execute_query(query)
        return result.scalar_one_or_none() is not None

    async def domain_exists(
        self, domain: str, exclude_org_id: Optional[str] = None
    ) -> bool:
        """Check if domain already exists."""
        if not domain:
            return False

        query = select(Organization).where(Organization.domain == domain)

        if exclude_org_id:
            try:
                exclude_uuid = uuid.UUID(exclude_org_id)
                query = query.where(Organization.id != exclude_uuid)
            except ValueError:
                # Invalid UUID format, exclude by string comparison
                query = query.where(Organization.id != exclude_org_id)

        result = await self._execute_query(query)
        return result.scalar_one_or_none() is not None

    async def is_member(self, organization_id: str, user_id: str) -> bool:
        """Check if user is a member of organization."""
        from ..core.models.organization import OrganizationMember

        query = select(OrganizationMember).where(
            OrganizationMember.organization_id == organization_id,
            OrganizationMember.user_id == user_id,
            OrganizationMember.is_active == True,
        )
        result = await self._execute_query(query)
        return result.scalar_one_or_none() is not None

    async def get_member_by_ids(
        self, organization_id: str, user_id: str
    ) -> Optional[OrganizationMember]:
        """Get organization member by organization and user IDs."""
        from ..core.models.organization import OrganizationMember

        query = select(OrganizationMember).where(
            OrganizationMember.organization_id == organization_id,
            OrganizationMember.user_id == user_id,
        )
        result = await self._execute_query(query)
        return result.scalar_one_or_none()

    async def get_organization_settings(self, organization_id: str) -> dict:
        """Get organization settings as a dictionary."""
        org = await self.get_by_id(organization_id)
        return org.get_metadata()

    async def update_organization_settings(
        self, organization_id: str, settings: dict
    ) -> Organization:
        """Update organization settings."""
        org = await self.get_by_id(organization_id)
        org.set_metadata(settings)
        org.updated_by = organization_id  # Organization updating its own settings

        try:
            await self.db_session.commit()
            await self.db_session.refresh(org)

            # Log settings update
            self._log_operation(
                "update_organization_settings",
                {"organization_id": organization_id, "settings_count": len(settings)},
            )

            return org
        except SQLAlchemyError as e:
            await self.db_session.rollback()
            self.logger.error(f"Failed to update organization settings: {str(e)}")
            raise ServiceException(
                "Failed to update organization settings",
                error_code="SETTINGS_UPDATE_ERROR",
                details={"original_error": str(e)},
            )

    async def _create_organization_member(
        self, member_data: dict, invited_by: Optional[uuid.UUID] = None
    ) -> OrganizationMember:
        """Helper method to create organization member with proper error handling."""
        from ..core.models.organization import OrganizationMember

        try:
            member = OrganizationMember()
            member.update_from_dict(member_data)

            if invited_by:
                member.invited_by = invited_by

            self.db_session.add(member)
            await self.db_session.commit()
            await self.db_session.refresh(member)
            return member
        except SQLAlchemyError as e:
            await self.db_session.rollback()
            self.logger.error(f"Failed to create organization member: {str(e)}")
            raise ServiceException(
                "Failed to create organization member",
                error_code="MEMBER_CREATE_ERROR",
                details={"original_error": str(e)},
            )

    async def get_active_organizations_count(self, user_id: str) -> int:
        """Get count of active organizations for a user."""
        from sqlalchemy import func

        from ..core.models.organization import OrganizationMember

        query = (
            select(func.count(Organization.id))
            .join(
                OrganizationMember,
                Organization.id == OrganizationMember.organization_id,
            )
            .where(
                OrganizationMember.user_id == user_id,
                OrganizationMember.is_active == True,
                Organization.status == OrganizationStatus.ACTIVE.value,
            )
        )

        result = await self._execute_query(query)
        return result.scalar()
