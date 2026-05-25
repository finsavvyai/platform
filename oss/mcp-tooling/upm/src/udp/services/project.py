"""
Project service for UPM project management.

Manages software projects with their dependencies, configurations,
and project-specific analysis results.
"""

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError

from ..core.models.project import Project, ProjectStatus, ProjectType
from ..core.services import (
    ConflictError,
    ServiceException,
)
from .base import BaseService


class ProjectService(BaseService):
    """
    Service for managing software projects and their configurations.

    Provides CRUD operations for projects, project analysis coordination,
    and project-specific settings management.
    """

    model_class = Project

    async def get_service_dependencies(self) -> dict:
        """Define service dependencies."""
        return {
            "organization_service": "OrganizationService",
            "user_service": "UserService",
        }

    async def create_project(
        self,
        name: str,
        slug: str,
        organization_id: str,
        description: Optional[str] = None,
        repository_url: Optional[str] = None,
        primary_language: Optional[str] = None,
        ecosystem: Optional[str] = None,
        build_system: Optional[str] = None,
        created_by: Optional[uuid.UUID] = None,
    ) -> Project:
        """Create a new project."""
        # Validate organization exists
        organization_service = await self._get_dependency("organization_service")
        organization = await organization_service.get_organization_by_id(
            organization_id
        )

        # Validate slug uniqueness within organization
        if await self.slug_exists(organization_id, slug):
            raise ConflictError(
                f"Project with slug {slug} already exists in this organization"
            )

        # Create project data
        project_data = {
            "name": name,
            "slug": slug,
            "organization_id": organization_id,
            "description": description,
            "repository_url": repository_url,
            "primary_language": primary_language,
            "ecosystem": ecosystem,
            "build_system": build_system,
            "project_type": ProjectType.POLYGLOT.value
            if ecosystem
            else ecosystem.upper(),
            "status": ProjectStatus.ACTIVE.value,
            "created_by": created_by,
        }

        project = await self.create(project_data, created_by)

        # Log project creation
        self._log_operation(
            "create_project",
            {
                "project_id": str(project.id),
                "organization_id": organization_id,
                "name": name,
                "slug": slug,
            },
        )

        return project

    async def get_project_by_id(self, project_id: str) -> Project:
        """Get project by ID."""
        return await self.get_by_id(project_id)

    async def get_project_by_slug(
        self, organization_id: str, slug: str
    ) -> Optional[Project]:
        """Get project by slug within organization."""
        query = select(Project).where(
            Project.organization_id == organization_id,
            Project.slug == slug,
            Project.status == ProjectStatus.ACTIVE.value,
        )
        result = await self._execute_query(query)
        return result.scalar_one_or_none()

    async def update_project(
        self, project_id: str, update_data: dict, updated_by: Optional[uuid.UUID] = None
    ) -> Project:
        """Update project information."""
        project = await self.get_by_id(project_id)

        # Don't allow slug changes through this method
        # Use dedicated method for slug changes to ensure proper validation
        update_data.pop("slug", None)

        project = await self.update(project_id, update_data, updated_by)

        # Log project update
        self._log_operation(
            "update_project",
            {"project_id": project_id, "updated_fields": list(update_data.keys())},
        )

        return project

    async def delete_project(self, project_id: str, deleted_by: uuid.UUID) -> None:
        """Soft delete a project."""
        project = await self.get_by_id(project_id)

        project.status = ProjectStatus.ARCHIVED.value
        project.updated_by = deleted_by

        try:
            await self.db_session.commit()

            # Log project deletion
            self._log_operation(
                "delete_project",
                {"project_id": project_id, "deleted_by": str(deleted_by)},
            )
        except SQLAlchemyError as e:
            await self.db_session.rollback()
            self.logger.error(f"Failed to delete project: {str(e)}")
            raise ServiceException(
                "Failed to delete project",
                error_code="PROJECT_DELETE_ERROR",
                details={"original_error": str(e)},
            )

    async def list_projects(
        self,
        limit: int = 100,
        offset: int = 0,
        organization_id: Optional[str] = None,
        user_id: Optional[str] = None,
        status: Optional[str] = None,
        primary_language: Optional[str] = None,
        ecosystem: Optional[str] = None,
        search: Optional[str] = None,
    ) -> list[Project]:
        """List projects with comprehensive filtering."""
        filters = {}

        if organization_id:
            filters["organization_id"] = organization_id

        if status:
            filters["status"] = status

        if primary_language:
            filters["primary_language"] = primary_language

        if ecosystem:
            filters["ecosystem"] = ecosystem

        if search:
            # Add search for name and description
            filters["search_term"] = f"%{search}%"

        # If user_id is provided, filter by user's organizations
        if user_id and not organization_id:
            user_orgs = await self.get_user_projects(user_id)
            org_ids = [str(org.id) for org in user_orgs]
            if org_ids:
                filters["organization_id__in"] = org_ids

        projects = await self.list_all(limit=limit, offset=offset, filters=filters)
        return projects

    async def get_user_projects(self, user_id: str) -> list[Project]:
        """Get all projects accessible to a user."""

        from ..core.models.organization import OrganizationMember

        # Find organizations where user is an active member
        member_query = select(OrganizationMember.organization_id).where(
            OrganizationMember.user_id == user_id, OrganizationMember.is_active == True
        )
        member_result = await self._execute_query(member_query)
        org_ids = [row[0] for row in member_result.all()]

        if not org_ids:
            return []

        # Get projects for these organizations
        query = select(Project).where(
            Project.organization_id.in_(org_ids),
            Project.status == ProjectStatus.ACTIVE.value,
        )

        result = await self._execute_query(query)
        return result.scalars().all()

    async def get_organization_projects(
        self,
        organization_id: str,
        limit: int = 100,
        offset: int = 0,
        status: Optional[str] = None,
        primary_language: Optional[str] = None,
        ecosystem: Optional[str] = None,
        search: Optional[str] = None,
    ) -> list[Project]:
        """Get all projects for an organization."""
        filters = {"organization_id": organization_id}

        if status:
            filters["status"] = status

        if primary_language:
            filters["primary_language"] = primary_language

        if ecosystem:
            filters["ecosystem"] = ecosystem

        if search:
            filters["search_term"] = f"%{search}%"

        projects = await self.list_all(limit=limit, offset=offset, filters=filters)
        return projects

    async def update_last_analysis(self, project_id: str, analysis_id: str) -> Project:
        """Update project with last analysis information."""
        project = await self.get_by_id(project_id)

        project.last_analysis_at = datetime.utcnow().isoformat()
        project.last_analysis_id = analysis_id
        project.updated_by = project_id  # System updating analysis

        try:
            await self.db_session.commit()
            await self.db_session.refresh(project)

            # Log analysis update
            self._log_operation(
                "update_last_analysis",
                {"project_id": project_id, "analysis_id": analysis_id},
            )

            return project
        except SQLAlchemyError as e:
            await self.db_session.rollback()
            self.logger.error(f"Failed to update last analysis: {str(e)}")
            raise ServiceException(
                "Failed to update last analysis",
                error_code="ANALYSIS_UPDATE_ERROR",
                details={"original_error": str(e)},
            )

    async def slug_exists(
        self, organization_id: str, slug: str, exclude_project_id: Optional[str] = None
    ) -> bool:
        """Check if project slug already exists in organization."""
        query = select(Project).where(
            Project.organization_id == organization_id, Project.slug == slug
        )

        if exclude_project_id:
            try:
                exclude_uuid = uuid.UUID(exclude_project_id)
                query = query.where(Project.id != exclude_uuid)
            except ValueError:
                # Invalid UUID format, exclude by string comparison
                query = query.where(Project.id != exclude_project_id)

        result = await self._execute_query(query)
        return result.scalar_one_or_none() is not None

    async def get_project_settings(self, project_id: str) -> dict:
        """Get project settings as a dictionary."""
        project = await self.get_by_id(project_id)
        return project.get_metadata()

    async def update_project_settings(self, project_id: str, settings: dict) -> Project:
        """Update project settings."""
        project = await self.get_by_id(project_id)
        project.set_metadata(settings)
        project.updated_by = project_id  # Project updating its own settings

        try:
            await self.db_session.commit()
            await self.db_session.refresh(project)

            # Log settings update
            self._log_operation(
                "update_project_settings",
                {"project_id": project_id, "settings_count": len(settings)},
            )

            return project
        except SQLAlchemyError as e:
            await self.db_session.rollback()
            self.logger.error(f"Failed to update project settings: {str(e)}")
            raise ServiceException(
                "Failed to update project settings",
                error_code="PROJECT_SETTINGS_UPDATE_ERROR",
                details={"original_error": str(e)},
            )

    async def get_analysis_config(self, project_id: str) -> dict:
        """Get project analysis configuration."""
        project = await self.get_by_id(project_id)
        return project.get_analysis_config()

    async def update_analysis_config(self, project_id: str, config: dict) -> Project:
        """Update project analysis configuration."""
        project = await self.get_by_id(project_id)
        project.set_analysis_config(config)
        project.updated_by = project_id  # Project updating its own config

        try:
            await self.db_session.commit()
            await self.db_session.refresh(project)

            # Log analysis config update
            self._log_operation(
                "update_analysis_config",
                {"project_id": project_id, "config_keys": list(config.keys())},
            )

            return project
        except SQLAlchemyError as e:
            await self.db_session.rollback()
            self.logger.error(f"Failed to update analysis config: {str(e)}")
            raise ServiceException(
                "Failed to update analysis config",
                error_code="ANALYSIS_CONFIG_UPDATE_ERROR",
                details={"original_error": str(e)},
            )

    async def set_project_tags(self, project_id: str, tags: list) -> Project:
        """Set project tags."""
        project = await self.get_by_id(project_id)
        project.set_metadata({"tags": tags})
        project.updated_by = project_id  # Project updating its own tags

        try:
            await self.db_session.commit()
            await self.db_session.refresh(project)

            # Log tag update
            self._log_operation(
                "set_project_tags", {"project_id": project_id, "tags_count": len(tags)}
            )

            return project
        except SQLAlchemyError as e:
            await self.db_session.rollback()
            self.logger.error(f"Failed to set project tags: {str(e)}")
            raise ServiceException(
                "Failed to set project tags",
                error_code="PROJECT_TAGS_UPDATE_ERROR",
                details={"original_error": str(e)},
            )

    async def add_project_tag(self, project_id: str, tag: str) -> Project:
        """Add a single tag to project."""
        project = await self.get_by_id(project_id)

        current_tags = project.get_metadata().get("tags", [])
        if tag not in current_tags:
            current_tags.append(tag)
            project.set_metadata({"tags": current_tags})
            project.updated_by = project_id

            try:
                await self.db_session.commit()
                await self.db_session.refresh(project)

                # Log tag addition
                self._log_operation(
                    "add_project_tag",
                    {
                        "project_id": project_id,
                        "tag": tag,
                        "total_tags": len(current_tags),
                    },
                )

                return project
            except SQLAlchemyError as e:
                await self.db_session.rollback()
                self.logger.error(f"Failed to add project tag: {str(e)}")
                raise ServiceException(
                    "Failed to add project tag",
                    error_code="PROJECT_TAG_ADD_ERROR",
                    details={"original_error": str(e)},
                )

        return project  # Tag already exists

    async def remove_project_tag(self, project_id: str, tag: str) -> Project:
        """Remove a single tag from project."""
        project = await self.get_by_id(project_id)

        current_tags = project.get_metadata().get("tags", [])
        if tag in current_tags:
            current_tags.remove(tag)
            project.set_metadata({"tags": current_tags})
            project.updated_by = project_id

            try:
                await self.db_session.commit()
                await self.db_session.refresh(project)

                # Log tag removal
                self._log_operation(
                    "remove_project_tag",
                    {
                        "project_id": project_id,
                        "tag": tag,
                        "total_tags": len(current_tags),
                    },
                )

                return project
            except SQLAlchemyError as e:
                await self.db_session.rollback()
                self.logger.error(f"Failed to remove project tag: {str(e)}")
                raise ServiceException(
                    "Failed to remove project tag",
                    error_code="PROJECT_TAG_REMOVE_ERROR",
                    details={"original_error": str(e)},
                )

        return project  # Tag doesn't exist

    async def requires_security_scan(self, project_id: str) -> bool:
        """Check if project requires security scan based on configuration."""
        project = await self.get_by_id(project_id)

        if not project.auto_scan_enabled:
            return False

        if not project.last_analysis_at:
            return True

        try:
            last_analysis = datetime.fromisoformat(project.last_analysis_at)
            frequency = project.analysis_frequency

            if frequency == "hourly":
                return (datetime.utcnow() - last_analysis) > timedelta(hours=1)
            elif frequency == "daily":
                return (datetime.utcnow() - last_analysis) > timedelta(days=1)
            elif frequency == "weekly":
                return (datetime.utcnow() - last_analysis) > timedelta(weeks=1)
            else:  # monthly
                return (datetime.utcnow() - last_analysis) > timedelta(days=30)
        except:
            return True

    async def supports_ecosystem(self, project_id: str, target_ecosystem: str) -> bool:
        """Check if project supports a target ecosystem."""
        project = await self.get_by_id(project_id)

        if not project.ecosystem:
            return True  # Assume polyglot if not specified

        # For now, check direct ecosystem support
        # Future: implement cross-language compatibility matrix
        return project.ecosystem == target_ecosystem

    async def get_project_vulnerability_count(self, project_id: str) -> int:
        """Get total number of vulnerabilities for a project."""
        from sqlalchemy import func

        from ..core.models.vulnerability import ProjectVulnerability

        query = select(func.count(ProjectVulnerability.id)).where(
            ProjectVulnerability.project_id == project_id,
            ProjectVulnerability.status == "open",
        )

        result = await self._execute_query(query)
        return result.scalar()

    async def get_critical_vulnerability_count(self, project_id: str) -> int:
        """Get number of critical vulnerabilities for a project."""
        from sqlalchemy import func

        from ..core.models.vulnerability import (
            ProjectVulnerabilityModel as ProjectVulnerability,
        )
        from ..core.models.vulnerability import Vulnerability

        query = (
            select(func.count(ProjectVulnerability.id))
            .join(ProjectVulnerability.vulnerability)
            .where(
                ProjectVulnerability.project_id == project_id,
                ProjectVulnerability.status == "open",
                Vulnerability.severity == "critical",
            )
        )

        result = await self._execute_query(query)
        return result.scalar()
