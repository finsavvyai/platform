"""
RBAC Default Data Migration Script.

This script creates default permissions and roles for the UPM platform.
Run this after database setup to populate the system with basic RBAC data.
"""

import asyncio
import logging
from typing import List, Dict, Any

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from src.udp.core.models.rbac import (
    Permission,
    Role,
    RoleTemplate,
    PermissionScope,
    ResourceType,
)
from src.udp.core.models.user import User
from src.udp.core.models.organization import Organization
from src.udp.infrastructure.database import get_database_manager

logger = logging.getLogger(__name__)


class RBACDefaultsMigration:
    """
    Migration class for creating default RBAC data.

    Creates system permissions, roles, and role templates to provide
    a comprehensive access control foundation for the platform.
    """

    def __init__(self, db: AsyncSession):
        self.db = db
        self.created_permissions: List[Permission] = []
        self.created_roles: List[Role] = []
        self.created_templates: List[RoleTemplate] = []

    async def migrate(self) -> None:
        """Run the complete migration."""
        logger.info("Starting RBAC defaults migration...")

        try:
            await self._create_default_permissions()
            await self._create_system_roles()
            await self._create_role_templates()
            await self._assign_admin_permissions()

            await self.db.commit()
            logger.info("RBAC defaults migration completed successfully")

        except Exception as e:
            await self.db.rollback()
            logger.error(f"RBAC defaults migration failed: {e}")
            raise

    async def _create_default_permissions(self) -> None:
        """Create default system permissions."""
        logger.info("Creating default permissions...")

        permissions = [
            # System permissions
            (
                "system:admin",
                "System Administrator",
                "Full system administration access",
                PermissionScope.SYSTEM_ADMIN,
                ResourceType.SYSTEM,
                "admin",
            ),
            (
                "system:monitor",
                "System Monitor",
                "Can view system metrics and health",
                PermissionScope.SYSTEM_MONITOR,
                ResourceType.SYSTEM,
                "monitor",
            ),
            (
                "system:configure",
                "System Configuration",
                "Can configure system settings",
                PermissionScope.SYSTEM_CONFIGURE,
                ResourceType.SYSTEM,
                "configure",
            ),
            # Organization permissions
            (
                "organization:create",
                "Create Organization",
                "Can create new organizations",
                PermissionScope.ORG_CREATE,
                ResourceType.ORGANIZATION,
                "create",
            ),
            (
                "organization:read",
                "Read Organization",
                "Can view organization details",
                PermissionScope.ORG_READ,
                ResourceType.ORGANIZATION,
                "read",
            ),
            (
                "organization:update",
                "Update Organization",
                "Can update organization settings",
                PermissionScope.ORG_UPDATE,
                ResourceType.ORGANIZATION,
                "update",
            ),
            (
                "organization:delete",
                "Delete Organization",
                "Can delete organizations",
                PermissionScope.ORG_DELETE,
                ResourceType.ORGANIZATION,
                "delete",
            ),
            (
                "organization:manage_members",
                "Manage Organization Members",
                "Can add/remove organization members",
                PermissionScope.ORG_MANAGE_MEMBERS,
                ResourceType.ORGANIZATION,
                "manage_members",
            ),
            (
                "organization:manage_settings",
                "Manage Organization Settings",
                "Can configure organization settings",
                PermissionScope.ORG_MANAGE_SETTINGS,
                ResourceType.ORGANIZATION,
                "manage_settings",
            ),
            (
                "organization:view_analytics",
                "View Organization Analytics",
                "Can view organization analytics and reports",
                PermissionScope.ORG_VIEW_ANALYTICS,
                ResourceType.ORGANIZATION,
                "view_analytics",
            ),
            # Project permissions
            (
                "project:create",
                "Create Project",
                "Can create new projects",
                PermissionScope.PROJECT_CREATE,
                ResourceType.PROJECT,
                "create",
            ),
            (
                "project:read",
                "Read Project",
                "Can view project details",
                PermissionScope.PROJECT_READ,
                ResourceType.PROJECT,
                "read",
            ),
            (
                "project:update",
                "Update Project",
                "Can update project settings",
                PermissionScope.PROJECT_UPDATE,
                ResourceType.PROJECT,
                "update",
            ),
            (
                "project:delete",
                "Delete Project",
                "Can delete projects",
                PermissionScope.PROJECT_DELETE,
                ResourceType.PROJECT,
                "delete",
            ),
            (
                "project:manage_members",
                "Manage Project Members",
                "Can add/remove project members",
                PermissionScope.PROJECT_MANAGE_MEMBERS,
                ResourceType.PROJECT,
                "manage_members",
            ),
            (
                "project:manage_settings",
                "Manage Project Settings",
                "Can configure project settings",
                PermissionScope.PROJECT_MANAGE_SETTINGS,
                ResourceType.PROJECT,
                "manage_settings",
            ),
            (
                "project:run_analysis",
                "Run Project Analysis",
                "Can run dependency analysis on projects",
                PermissionScope.PROJECT_RUN_ANALYSIS,
                ResourceType.PROJECT,
                "run_analysis",
            ),
            (
                "project:view_reports",
                "View Project Reports",
                "Can view project analysis reports",
                PermissionScope.PROJECT_VIEW_REPORTS,
                ResourceType.PROJECT,
                "view_reports",
            ),
            # Package permissions
            (
                "package:create",
                "Create Package",
                "Can create new packages",
                PermissionScope.PACKAGE_CREATE,
                ResourceType.PACKAGE,
                "create",
            ),
            (
                "package:read",
                "Read Package",
                "Can view package details",
                PermissionScope.PACKAGE_READ,
                ResourceType.PACKAGE,
                "read",
            ),
            (
                "package:update",
                "Update Package",
                "Can update package information",
                PermissionScope.PACKAGE_UPDATE,
                ResourceType.PACKAGE,
                "update",
            ),
            (
                "package:delete",
                "Delete Package",
                "Can delete packages",
                PermissionScope.PACKAGE_DELETE,
                ResourceType.PACKAGE,
                "delete",
            ),
            (
                "package:upload",
                "Upload Package",
                "Can upload package files",
                PermissionScope.PACKAGE_UPLOAD,
                ResourceType.PACKAGE,
                "upload",
            ),
            (
                "package:download",
                "Download Package",
                "Can download package files",
                PermissionScope.PACKAGE_DOWNLOAD,
                ResourceType.PACKAGE,
                "download",
            ),
            # Dependency permissions
            (
                "dependency:analyze",
                "Analyze Dependencies",
                "Can run dependency analysis",
                PermissionScope.DEPENDENCY_ANALYZE,
                ResourceType.DEPENDENCY,
                "analyze",
            ),
            (
                "dependency:update",
                "Update Dependencies",
                "Can update dependency information",
                PermissionScope.DEPENDENCY_UPDATE,
                ResourceType.DEPENDENCY,
                "update",
            ),
            (
                "dependency:resolve",
                "Resolve Dependencies",
                "Can resolve dependency conflicts",
                PermissionScope.DEPENDENCY_RESOLVE,
                ResourceType.DEPENDENCY,
                "resolve",
            ),
            # Security permissions
            (
                "security:scan",
                "Security Scan",
                "Can run security scans",
                PermissionScope.SECURITY_SCAN,
                ResourceType.VULNERABILITY,
                "scan",
            ),
            (
                "security:view_vulnerabilities",
                "View Vulnerabilities",
                "Can view security vulnerabilities",
                PermissionScope.SECURITY_VIEW_VULNERABILITIES,
                ResourceType.VULNERABILITY,
                "view",
            ),
            (
                "security:manage_policies",
                "Manage Security Policies",
                "Can configure security policies",
                PermissionScope.SECURITY_MANAGE_POLICIES,
                ResourceType.VULNERABILITY,
                "manage_policies",
            ),
            # Integration permissions
            (
                "integration:create",
                "Create Integration",
                "Can create new integrations",
                PermissionScope.INTEGRATION_CREATE,
                ResourceType.INTEGRATION,
                "create",
            ),
            (
                "integration:read",
                "Read Integration",
                "Can view integration details",
                PermissionScope.INTEGRATION_READ,
                ResourceType.INTEGRATION,
                "read",
            ),
            (
                "integration:update",
                "Update Integration",
                "Can update integration settings",
                PermissionScope.INTEGRATION_UPDATE,
                ResourceType.INTEGRATION,
                "update",
            ),
            (
                "integration:delete",
                "Delete Integration",
                "Can delete integrations",
                PermissionScope.INTEGRATION_DELETE,
                ResourceType.INTEGRATION,
                "delete",
            ),
            (
                "integration:configure",
                "Configure Integration",
                "Can configure integration parameters",
                PermissionScope.INTEGRATION_CONFIGURE,
                ResourceType.INTEGRATION,
                "configure",
            ),
            # User permissions
            (
                "user:create",
                "Create User",
                "Can create new users",
                PermissionScope.USER_CREATE,
                ResourceType.USER,
                "create",
            ),
            (
                "user:read",
                "Read User",
                "Can view user information",
                PermissionScope.USER_READ,
                ResourceType.USER,
                "read",
            ),
            (
                "user:update",
                "Update User",
                "Can update user information",
                PermissionScope.USER_UPDATE,
                ResourceType.USER,
                "update",
            ),
            (
                "user:delete",
                "Delete User",
                "Can delete users",
                PermissionScope.USER_DELETE,
                ResourceType.USER,
                "delete",
            ),
            (
                "user:manage_roles",
                "Manage User Roles",
                "Can manage user role assignments",
                PermissionScope.USER_MANAGE_ROLES,
                ResourceType.USER,
                "manage_roles",
            ),
        ]

        for (
            name,
            display_name,
            description,
            scope,
            resource_type,
            action,
        ) in permissions:
            # Check if permission already exists
            existing = await self.db.execute(
                select(Permission).where(Permission.name == name)
            )
            if existing.scalar_one_or_none():
                logger.debug(f"Permission already exists: {name}")
                continue

            permission = Permission(
                name=name,
                display_name=display_name,
                description=description,
                scope=scope,
                resource_type=resource_type,
                action=action,
                is_system=True,
                is_active=True,
            )

            self.db.add(permission)
            self.created_permissions.append(permission)
            logger.debug(f"Created permission: {name}")

        await self.db.flush()
        logger.info(f"Created {len(self.created_permissions)} default permissions")

    async def _create_system_roles(self) -> None:
        """Create default system roles."""
        logger.info("Creating system roles...")

        # Get all permissions for assignment
        all_permissions = await self.db.execute(
            select(Permission).where(Permission.is_active == True)
        )
        permissions_map = {perm.name: perm for perm in all_permissions.scalars().all()}

        system_roles = [
            {
                "name": "super_admin",
                "display_name": "Super Administrator",
                "description": "Full system access with all permissions",
                "priority": 100,
                "permissions": list(permissions_map.keys()),  # All permissions
            },
            {
                "name": "system_admin",
                "display_name": "System Administrator",
                "description": "System administration and configuration",
                "priority": 90,
                "permissions": [
                    "system:admin",
                    "system:monitor",
                    "system:configure",
                    "organization:create",
                    "organization:read",
                    "organization:update",
                    "user:create",
                    "user:read",
                    "user:update",
                    "user:delete",
                    "user:manage_roles",
                    "integration:create",
                    "integration:read",
                    "integration:update",
                    "integration:delete",
                    "integration:configure",
                ],
            },
            {
                "name": "organization_admin",
                "display_name": "Organization Administrator",
                "description": "Full organization management",
                "priority": 80,
                "permissions": [
                    "organization:read",
                    "organization:update",
                    "organization:manage_members",
                    "organization:manage_settings",
                    "organization:view_analytics",
                    "project:create",
                    "project:read",
                    "project:update",
                    "project:delete",
                    "project:manage_members",
                    "project:manage_settings",
                    "user:create",
                    "user:read",
                    "user:update",
                    "user:manage_roles",
                ],
            },
            {
                "name": "project_manager",
                "display_name": "Project Manager",
                "description": "Project management and oversight",
                "priority": 70,
                "permissions": [
                    "project:create",
                    "project:read",
                    "project:update",
                    "project:delete",
                    "project:manage_members",
                    "project:manage_settings",
                    "project:run_analysis",
                    "project:view_reports",
                    "package:create",
                    "package:read",
                    "package:update",
                    "package:delete",
                    "dependency:analyze",
                    "dependency:update",
                    "dependency:resolve",
                    "security:scan",
                    "security:view_vulnerabilities",
                ],
            },
            {
                "name": "developer",
                "display_name": "Developer",
                "description": "Development and analysis permissions",
                "priority": 60,
                "permissions": [
                    "project:read",
                    "project:run_analysis",
                    "project:view_reports",
                    "package:read",
                    "package:update",
                    "package:download",
                    "dependency:analyze",
                    "dependency:update",
                    "security:scan",
                    "security:view_vulnerabilities",
                    "integration:read",
                    "integration:configure",
                ],
            },
            {
                "name": "security_analyst",
                "display_name": "Security Analyst",
                "description": "Security analysis and vulnerability management",
                "priority": 65,
                "permissions": [
                    "project:read",
                    "project:run_analysis",
                    "project:view_reports",
                    "package:read",
                    "package:download",
                    "dependency:analyze",
                    "security:scan",
                    "security:view_vulnerabilities",
                    "security:manage_policies",
                ],
            },
            {
                "name": "viewer",
                "display_name": "Viewer",
                "description": "Read-only access to resources",
                "priority": 50,
                "permissions": [
                    "organization:read",
                    "organization:view_analytics",
                    "project:read",
                    "project:view_reports",
                    "package:read",
                    "package:download",
                    "dependency:analyze",
                    "security:view_vulnerabilities",
                    "integration:read",
                ],
            },
        ]

        for role_data in system_roles:
            # Check if role already exists
            existing = await self.db.execute(
                select(Role).where(
                    and_(Role.name == role_data["name"], Role.organization_id.is_(None))
                )
            )
            if existing.scalar_one_or_none():
                logger.debug(f"Role already exists: {role_data['name']}")
                continue

            role = Role(
                name=role_data["name"],
                display_name=role_data["display_name"],
                description=role_data["description"],
                is_system=True,
                is_active=True,
                priority=role_data["priority"],
            )

            self.db.add(role)
            await self.db.flush()  # Get role ID

            # Assign permissions
            for perm_name in role_data["permissions"]:
                if perm_name in permissions_map:
                    role.permissions.append(permissions_map[perm_name])
                else:
                    logger.warning(
                        f"Permission not found for role assignment: {perm_name}"
                    )

            self.created_roles.append(role)
            logger.debug(f"Created role: {role_data['name']}")

        await self.db.flush()
        logger.info(f"Created {len(self.created_roles)} system roles")

    async def _create_role_templates(self) -> None:
        """Create role templates for organizations to use."""
        logger.info("Creating role templates...")

        templates = [
            {
                "name": "custom_org_admin",
                "display_name": "Custom Organization Admin",
                "description": "Template for organization administrators",
                "category": "admin",
                "permissions": [
                    "organization:read",
                    "organization:update",
                    "organization:manage_members",
                    "organization:manage_settings",
                    "organization:view_analytics",
                    "project:create",
                    "project:read",
                    "project:update",
                    "project:delete",
                    "project:manage_members",
                    "project:manage_settings",
                    "user:create",
                    "user:read",
                    "user:update",
                    "user:manage_roles",
                ],
            },
            {
                "name": "custom_project_manager",
                "display_name": "Custom Project Manager",
                "description": "Template for project managers",
                "category": "manager",
                "permissions": [
                    "project:create",
                    "project:read",
                    "project:update",
                    "project:delete",
                    "project:manage_members",
                    "project:manage_settings",
                    "project:run_analysis",
                    "project:view_reports",
                    "package:create",
                    "package:read",
                    "package:update",
                    "package:delete",
                    "dependency:analyze",
                    "dependency:update",
                    "dependency:resolve",
                    "security:scan",
                    "security:view_vulnerabilities",
                ],
            },
            {
                "name": "custom_developer",
                "display_name": "Custom Developer",
                "description": "Template for developers",
                "category": "developer",
                "permissions": [
                    "project:read",
                    "project:run_analysis",
                    "project:view_reports",
                    "package:read",
                    "package:update",
                    "package:download",
                    "dependency:analyze",
                    "dependency:update",
                    "security:scan",
                    "security:view_vulnerabilities",
                    "integration:read",
                    "integration:configure",
                ],
            },
            {
                "name": "custom_viewer",
                "display_name": "Custom Viewer",
                "description": "Template for read-only access",
                "category": "viewer",
                "permissions": [
                    "organization:read",
                    "organization:view_analytics",
                    "project:read",
                    "project:view_reports",
                    "package:read",
                    "package:download",
                    "dependency:analyze",
                    "security:view_vulnerabilities",
                    "integration:read",
                ],
            },
        ]

        for template_data in templates:
            # Check if template already exists
            existing = await self.db.execute(
                select(RoleTemplate).where(RoleTemplate.name == template_data["name"])
            )
            if existing.scalar_one_or_none():
                logger.debug(f"Template already exists: {template_data['name']}")
                continue

            template = RoleTemplate(
                name=template_data["name"],
                display_name=template_data["display_name"],
                description=template_data["description"],
                category=template_data["category"],
                permissions=template_data["permissions"],
            )

            self.db.add(template)
            self.created_templates.append(template)
            logger.debug(f"Created template: {template_data['name']}")

        await self.db.flush()
        logger.info(f"Created {len(self.created_templates)} role templates")

    async def _assign_admin_permissions(self) -> None:
        """Assign super admin role to existing admin users."""
        logger.info("Assigning admin permissions to existing users...")

        # Get super admin role
        super_admin_role = await self.db.execute(
            select(Role).where(Role.name == "super_admin")
        )
        admin_role = super_admin_role.scalar_one_or_none()

        if not admin_role:
            logger.warning("Super admin role not found")
            return

        # Find existing admin users (users with is_admin flag or similar)
        admin_users = await self.db.execute(
            select(User).where(
                or_(
                    User.is_admin == True,
                    User.email.like("%admin%"),
                    User.username.like("%admin%"),
                )
            )
        )

        admin_count = 0
        for user in admin_users.scalars().all():
            # Check if user already has this role
            existing_assignment = await self.db.execute(
                select(UserRoleAssignment).where(
                    and_(
                        UserRoleAssignment.user_id == user.id,
                        UserRoleAssignment.role_id == admin_role.id,
                        UserRoleAssignment.resource_type.is_(None),
                        UserRoleAssignment.resource_id.is_(None),
                    )
                )
            )

            if not existing_assignment.scalar_one_or_none():
                assignment = UserRoleAssignment(user_id=user.id, role_id=admin_role.id)
                self.db.add(assignment)
                admin_count += 1
                logger.debug(f"Assigned super admin role to user: {user.username}")

        await self.db.flush()
        logger.info(f"Assigned admin permissions to {admin_count} users")


async def run_migration() -> None:
    """Run the RBAC defaults migration."""
    # Setup logging
    logging.basicConfig(level=logging.INFO)

    # Get database connection
    db_manager = get_database_manager()
    async with db_manager.get_session() as db:
        migration = RBACDefaultsMigration(db)
        await migration.migrate()


if __name__ == "__main__":
    """Run the migration directly."""
    asyncio.run(run_migration())
