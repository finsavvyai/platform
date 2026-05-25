"""
Default RBAC data for Universal Dependency Platform.

This module provides default roles, permissions, and role templates
that are created during system initialization.
"""


from .rbac import Permission, PermissionScope, ResourceType, Role, RoleTemplate

# System permissions - core platform permissions
SYSTEM_PERMISSIONS = [
    # System administration
    {
        "name": "system:admin",
        "display_name": "System Administrator",
        "description": "Full system administration access",
        "scope": PermissionScope.SYSTEM_ADMIN,
        "resource_type": ResourceType.SYSTEM,
        "action": "admin",
        "is_system": True,
    },
    {
        "name": "system:monitor",
        "display_name": "System Monitor",
        "description": "Can view system metrics and health",
        "scope": PermissionScope.SYSTEM_MONITOR,
        "resource_type": ResourceType.SYSTEM,
        "action": "monitor",
        "is_system": True,
    },
    {
        "name": "system:configure",
        "display_name": "System Configurator",
        "description": "Can configure system settings",
        "scope": PermissionScope.SYSTEM_CONFIGURE,
        "resource_type": ResourceType.SYSTEM,
        "action": "configure",
        "is_system": True,
    },
]

# Organization permissions
ORGANIZATION_PERMISSIONS = [
    {
        "name": "organization:create",
        "display_name": "Create Organizations",
        "description": "Can create new organizations",
        "scope": PermissionScope.ORG_CREATE,
        "resource_type": ResourceType.ORGANIZATION,
        "action": "create",
        "is_system": True,
    },
    {
        "name": "organization:read",
        "display_name": "View Organizations",
        "description": "Can view organization details",
        "scope": PermissionScope.ORG_READ,
        "resource_type": ResourceType.ORGANIZATION,
        "action": "read",
        "is_system": True,
    },
    {
        "name": "organization:update",
        "display_name": "Update Organizations",
        "description": "Can update organization details",
        "scope": PermissionScope.ORG_UPDATE,
        "resource_type": ResourceType.ORGANIZATION,
        "action": "update",
        "is_system": True,
    },
    {
        "name": "organization:delete",
        "display_name": "Delete Organizations",
        "description": "Can delete organizations",
        "scope": PermissionScope.ORG_DELETE,
        "resource_type": ResourceType.ORGANIZATION,
        "action": "delete",
        "is_system": True,
    },
    {
        "name": "organization:manage_members",
        "display_name": "Manage Organization Members",
        "description": "Can add/remove organization members",
        "scope": PermissionScope.ORG_MANAGE_MEMBERS,
        "resource_type": ResourceType.ORGANIZATION,
        "action": "manage_members",
        "is_system": True,
    },
    {
        "name": "organization:manage_settings",
        "display_name": "Manage Organization Settings",
        "description": "Can configure organization settings",
        "scope": PermissionScope.ORG_MANAGE_SETTINGS,
        "resource_type": ResourceType.ORGANIZATION,
        "action": "manage_settings",
        "is_system": True,
    },
    {
        "name": "organization:view_analytics",
        "display_name": "View Organization Analytics",
        "description": "Can view organization analytics and reports",
        "scope": PermissionScope.ORG_VIEW_ANALYTICS,
        "resource_type": ResourceType.ORGANIZATION,
        "action": "view_analytics",
        "is_system": True,
    },
]

# Project permissions
PROJECT_PERMISSIONS = [
    {
        "name": "project:create",
        "display_name": "Create Projects",
        "description": "Can create new projects",
        "scope": PermissionScope.PROJECT_CREATE,
        "resource_type": ResourceType.PROJECT,
        "action": "create",
        "is_system": True,
    },
    {
        "name": "project:read",
        "display_name": "View Projects",
        "description": "Can view project details",
        "scope": PermissionScope.PROJECT_READ,
        "resource_type": ResourceType.PROJECT,
        "action": "read",
        "is_system": True,
    },
    {
        "name": "project:update",
        "display_name": "Update Projects",
        "description": "Can update project details",
        "scope": PermissionScope.PROJECT_UPDATE,
        "resource_type": ResourceType.PROJECT,
        "action": "update",
        "is_system": True,
    },
    {
        "name": "project:delete",
        "display_name": "Delete Projects",
        "description": "Can delete projects",
        "scope": PermissionScope.PROJECT_DELETE,
        "resource_type": ResourceType.PROJECT,
        "action": "delete",
        "is_system": True,
    },
    {
        "name": "project:manage_members",
        "display_name": "Manage Project Members",
        "description": "Can add/remove project members",
        "scope": PermissionScope.PROJECT_MANAGE_MEMBERS,
        "resource_type": ResourceType.PROJECT,
        "action": "manage_members",
        "is_system": True,
    },
    {
        "name": "project:manage_settings",
        "display_name": "Manage Project Settings",
        "description": "Can configure project settings",
        "scope": PermissionScope.PROJECT_MANAGE_SETTINGS,
        "resource_type": ResourceType.PROJECT,
        "action": "manage_settings",
        "is_system": True,
    },
    {
        "name": "project:run_analysis",
        "display_name": "Run Dependency Analysis",
        "description": "Can run dependency analysis on projects",
        "scope": PermissionScope.PROJECT_RUN_ANALYSIS,
        "resource_type": ResourceType.PROJECT,
        "action": "run_analysis",
        "is_system": True,
    },
    {
        "name": "project:view_reports",
        "display_name": "View Project Reports",
        "description": "Can view project analysis reports",
        "scope": PermissionScope.PROJECT_VIEW_REPORTS,
        "resource_type": ResourceType.PROJECT,
        "action": "view_reports",
        "is_system": True,
    },
]

# Package permissions
PACKAGE_PERMISSIONS = [
    {
        "name": "package:create",
        "display_name": "Create Packages",
        "description": "Can create new packages",
        "scope": PermissionScope.PACKAGE_CREATE,
        "resource_type": ResourceType.PACKAGE,
        "action": "create",
        "is_system": True,
    },
    {
        "name": "package:read",
        "display_name": "View Packages",
        "description": "Can view package details",
        "scope": PermissionScope.PACKAGE_READ,
        "resource_type": ResourceType.PACKAGE,
        "action": "read",
        "is_system": True,
    },
    {
        "name": "package:update",
        "display_name": "Update Packages",
        "description": "Can update package details",
        "scope": PermissionScope.PACKAGE_UPDATE,
        "resource_type": ResourceType.PACKAGE,
        "action": "update",
        "is_system": True,
    },
    {
        "name": "package:delete",
        "display_name": "Delete Packages",
        "description": "Can delete packages",
        "scope": PermissionScope.PACKAGE_DELETE,
        "resource_type": ResourceType.PACKAGE,
        "action": "delete",
        "is_system": True,
    },
    {
        "name": "package:upload",
        "display_name": "Upload Packages",
        "description": "Can upload package files",
        "scope": PermissionScope.PACKAGE_UPLOAD,
        "resource_type": ResourceType.PACKAGE,
        "action": "upload",
        "is_system": True,
    },
    {
        "name": "package:download",
        "display_name": "Download Packages",
        "description": "Can download package files",
        "scope": PermissionScope.PACKAGE_DOWNLOAD,
        "resource_type": ResourceType.PACKAGE,
        "action": "download",
        "is_system": True,
    },
]

# Dependency permissions
DEPENDENCY_PERMISSIONS = [
    {
        "name": "dependency:analyze",
        "display_name": "Analyze Dependencies",
        "description": "Can analyze project dependencies",
        "scope": PermissionScope.DEPENDENCY_ANALYZE,
        "resource_type": ResourceType.DEPENDENCY,
        "action": "analyze",
        "is_system": True,
    },
    {
        "name": "dependency:update",
        "display_name": "Update Dependencies",
        "description": "Can update project dependencies",
        "scope": PermissionScope.DEPENDENCY_UPDATE,
        "resource_type": ResourceType.DEPENDENCY,
        "action": "update",
        "is_system": True,
    },
    {
        "name": "dependency:resolve",
        "display_name": "Resolve Dependencies",
        "description": "Can resolve dependency conflicts",
        "scope": PermissionScope.DEPENDENCY_RESOLVE,
        "resource_type": ResourceType.DEPENDENCY,
        "action": "resolve",
        "is_system": True,
    },
]

# Security permissions
SECURITY_PERMISSIONS = [
    {
        "name": "security:scan",
        "display_name": "Run Security Scans",
        "description": "Can run security vulnerability scans",
        "scope": PermissionScope.SECURITY_SCAN,
        "resource_type": ResourceType.VULNERABILITY,
        "action": "scan",
        "is_system": True,
    },
    {
        "name": "security:view_vulnerabilities",
        "display_name": "View Vulnerabilities",
        "description": "Can view security vulnerabilities",
        "scope": PermissionScope.SECURITY_VIEW_VULNERABILITIES,
        "resource_type": ResourceType.VULNERABILITY,
        "action": "view_vulnerabilities",
        "is_system": True,
    },
    {
        "name": "security:manage_policies",
        "display_name": "Manage Security Policies",
        "description": "Can configure security policies",
        "scope": PermissionScope.SECURITY_MANAGE_POLICIES,
        "resource_type": ResourceType.VULNERABILITY,
        "action": "manage_policies",
        "is_system": True,
    },
]

# Integration permissions
INTEGRATION_PERMISSIONS = [
    {
        "name": "integration:create",
        "display_name": "Create Integrations",
        "description": "Can create new integrations",
        "scope": PermissionScope.INTEGRATION_CREATE,
        "resource_type": ResourceType.INTEGRATION,
        "action": "create",
        "is_system": True,
    },
    {
        "name": "integration:read",
        "display_name": "View Integrations",
        "description": "Can view integration details",
        "scope": PermissionScope.INTEGRATION_READ,
        "resource_type": ResourceType.INTEGRATION,
        "action": "read",
        "is_system": True,
    },
    {
        "name": "integration:update",
        "display_name": "Update Integrations",
        "description": "Can update integration configurations",
        "scope": PermissionScope.INTEGRATION_UPDATE,
        "resource_type": ResourceType.INTEGRATION,
        "action": "update",
        "is_system": True,
    },
    {
        "name": "integration:delete",
        "display_name": "Delete Integrations",
        "description": "Can delete integrations",
        "scope": PermissionScope.INTEGRATION_DELETE,
        "resource_type": ResourceType.INTEGRATION,
        "action": "delete",
        "is_system": True,
    },
    {
        "name": "integration:configure",
        "display_name": "Configure Integrations",
        "description": "Can configure integration settings",
        "scope": PermissionScope.INTEGRATION_CONFIGURE,
        "resource_type": ResourceType.INTEGRATION,
        "action": "configure",
        "is_system": True,
    },
]

# User permissions
USER_PERMISSIONS = [
    {
        "name": "user:create",
        "display_name": "Create Users",
        "description": "Can create new user accounts",
        "scope": PermissionScope.USER_CREATE,
        "resource_type": ResourceType.USER,
        "action": "create",
        "is_system": True,
    },
    {
        "name": "user:read",
        "display_name": "View Users",
        "description": "Can view user profiles",
        "scope": PermissionScope.USER_READ,
        "resource_type": ResourceType.USER,
        "action": "read",
        "is_system": True,
    },
    {
        "name": "user:update",
        "display_name": "Update Users",
        "description": "Can update user profiles",
        "scope": PermissionScope.USER_UPDATE,
        "resource_type": ResourceType.USER,
        "action": "update",
        "is_system": True,
    },
    {
        "name": "user:delete",
        "display_name": "Delete Users",
        "description": "Can delete user accounts",
        "scope": PermissionScope.USER_DELETE,
        "resource_type": ResourceType.USER,
        "action": "delete",
        "is_system": True,
    },
    {
        "name": "user:manage_roles",
        "display_name": "Manage User Roles",
        "description": "Can assign and revoke user roles",
        "scope": PermissionScope.USER_MANAGE_ROLES,
        "resource_type": ResourceType.USER,
        "action": "manage_roles",
        "is_system": True,
    },
]

# All permissions combined
ALL_PERMISSIONS = (
    SYSTEM_PERMISSIONS
    + ORGANIZATION_PERMISSIONS
    + PROJECT_PERMISSIONS
    + PACKAGE_PERMISSIONS
    + DEPENDENCY_PERMISSIONS
    + SECURITY_PERMISSIONS
    + INTEGRATION_PERMISSIONS
    + USER_PERMISSIONS
)

# System roles
SYSTEM_ROLES = [
    {
        "name": "system_admin",
        "display_name": "System Administrator",
        "description": "Full system administrator with all permissions",
        "is_system": True,
        "priority": 100,
        "permissions": [
            "system:admin",
            "system:monitor",
            "system:configure",
            "organization:create",
            "organization:read",
            "organization:update",
            "organization:delete",
            "organization:manage_members",
            "organization:manage_settings",
            "organization:view_analytics",
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
            "security:manage_policies",
        ],
    },
    {
        "name": "system_monitor",
        "display_name": "System Monitor",
        "description": "Can monitor system health and metrics",
        "is_system": True,
        "priority": 90,
        "permissions": [
            "system:monitor",
            "organization:read",
            "organization:view_analytics",
            "project:read",
            "project:view_reports",
            "security:view_vulnerabilities",
        ],
    },
]

# Role templates for organizations
ROLE_TEMPLATES = [
    {
        "name": "organization_admin",
        "display_name": "Organization Administrator",
        "description": "Full administrative access within an organization",
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
            "project:run_analysis",
            "project:view_reports",
            "package:create",
            "package:read",
            "package:update",
            "package:delete",
            "package:upload",
            "package:download",
            "dependency:analyze",
            "dependency:update",
            "dependency:resolve",
            "security:scan",
            "security:view_vulnerabilities",
            "integration:create",
            "integration:read",
            "integration:update",
            "integration:delete",
            "integration:configure",
            "user:read",
            "user:manage_roles",
        ],
    },
    {
        "name": "project_manager",
        "display_name": "Project Manager",
        "description": "Can manage projects and team members",
        "category": "manager",
        "permissions": [
            "organization:read",
            "organization:view_analytics",
            "project:create",
            "project:read",
            "project:update",
            "project:delete",
            "project:manage_members",
            "project:manage_settings",
            "project:run_analysis",
            "project:view_reports",
            "package:read",
            "package:download",
            "dependency:analyze",
            "dependency:update",
            "security:scan",
            "security:view_vulnerabilities",
            "integration:read",
            "integration:configure",
            "user:read",
        ],
    },
    {
        "name": "developer",
        "display_name": "Developer",
        "description": "Can work on projects and dependencies",
        "category": "developer",
        "permissions": [
            "organization:read",
            "project:read",
            "project:run_analysis",
            "project:view_reports",
            "package:read",
            "package:download",
            "dependency:analyze",
            "dependency:update",
            "dependency:resolve",
            "security:scan",
            "security:view_vulnerabilities",
            "integration:read",
        ],
    },
    {
        "name": "security_analyst",
        "display_name": "Security Analyst",
        "description": "Focused on security analysis and vulnerability management",
        "category": "security",
        "permissions": [
            "organization:read",
            "organization:view_analytics",
            "project:read",
            "project:view_reports",
            "package:read",
            "dependency:analyze",
            "security:scan",
            "security:view_vulnerabilities",
            "security:manage_policies",
            "integration:read",
        ],
    },
    {
        "name": "viewer",
        "display_name": "Viewer",
        "description": "Read-only access to organization resources",
        "category": "viewer",
        "permissions": [
            "organization:read",
            "organization:view_analytics",
            "project:read",
            "project:view_reports",
            "package:read",
            "package:download",
            "security:view_vulnerabilities",
            "integration:read",
        ],
    },
    {
        "name": "auditor",
        "display_name": "Auditor",
        "description": "Compliance and audit access",
        "category": "auditor",
        "permissions": [
            "organization:read",
            "organization:view_analytics",
            "project:read",
            "project:view_reports",
            "package:read",
            "dependency:analyze",
            "security:view_vulnerabilities",
            "integration:read",
            "user:read",
        ],
    },
]


async def create_default_permissions(db):
    """Create default permissions in the database."""
    logger = logging.getLogger(__name__)

    created_count = 0
    for perm_data in ALL_PERMISSIONS:
        # Check if permission already exists
        existing = await db.execute(
            select(Permission).where(Permission.name == perm_data["name"])
        )
        if existing.scalar_one_or_none():
            continue

        permission = Permission(**perm_data)
        db.add(permission)
        created_count += 1

    await db.commit()
    logger.info(f"Created {created_count} default permissions")


async def create_system_roles(db):
    """Create system roles in the database."""
    logger = logging.getLogger(__name__)

    # Get all permissions by name for easy lookup
    all_permissions_result = await db.execute(select(Permission))
    all_permissions = {
        perm.name: perm for perm in all_permissions_result.scalars().all()
    }

    created_count = 0
    for role_data in SYSTEM_ROLES:
        # Check if role already exists
        existing = await db.execute(
            select(Role).where(
                and_(Role.name == role_data["name"], Role.organization_id.is_(None))
            )
        )
        if existing.scalar_one_or_none():
            continue

        # Get permission objects
        permission_names = role_data.pop("permissions")
        permissions = [
            all_permissions[name]
            for name in permission_names
            if name in all_permissions
        ]

        role = Role(**role_data, permissions=permissions)
        db.add(role)
        created_count += 1

    await db.commit()
    logger.info(f"Created {created_count} system roles")


async def create_role_templates(db):
    """Create role templates in the database."""
    logger = logging.getLogger(__name__)

    created_count = 0
    for template_data in ROLE_TEMPLATES:
        # Check if template already exists
        existing = await db.execute(
            select(RoleTemplate).where(RoleTemplate.name == template_data["name"])
        )
        if existing.scalar_one_or_none():
            continue

        template = RoleTemplate(**template_data)
        db.add(template)
        created_count += 1

    await db.commit()
    logger.info(f"Created {created_count} role templates")


async def initialize_rbac_data(db):
    """Initialize all RBAC data (permissions, roles, templates)."""
    logger = logging.getLogger(__name__)

    try:
        await create_default_permissions(db)
        await create_system_roles(db)
        await create_role_templates(db)
        logger.info("RBAC data initialization completed successfully")
    except Exception as e:
        logger.error(f"Error initializing RBAC data: {e}")
        raise


if __name__ == "__main__":
    import asyncio
    import logging

    from sqlalchemy import select
    from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
    from sqlalchemy.orm import sessionmaker

    from .base import BaseModel

    async def main():
        """Initialize RBAC data for testing."""
        logging.basicConfig(level=logging.INFO)

        # Create test database
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as conn:
            await conn.run_sync(BaseModel.metadata.create_all)

        async_session = sessionmaker(
            engine, class_=AsyncSession, expire_on_commit=False
        )
        async with async_session() as db:
            await initialize_rbac_data(db)

            # Print summary
            perm_count = await db.execute(select(Permission))
            role_count = await db.execute(select(Role))
            template_count = await db.execute(select(RoleTemplate))

            print(f"Created {perm_count.rowcount} permissions")
            print(f"Created {role_count.rowcount} roles")
            print(f"Created {template_count.rowcount} role templates")

    asyncio.run(main())
