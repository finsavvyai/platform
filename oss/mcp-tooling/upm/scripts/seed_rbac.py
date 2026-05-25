"""
RBAC seeding script.

This script creates initial permissions, roles, and role templates
for the Universal Dependency Platform.
"""

import asyncio
import sys
from datetime import datetime
from pathlib import Path
from uuid import uuid4

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root / "src"))

from sqlalchemy.ext.asyncio import AsyncSession
from udp.infrastructure.database import get_async_session
from udp.core.models.rbac import (
    Permission,
    Role,
    RoleTemplate,
    PermissionScope,
    ResourceType,
)
from udp.security.rbac.rbac_service import RBACService

# Define initial permissions
INITIAL_PERMISSIONS = [
    # System permissions
    (
        "system.admin",
        "system.admin",
        "Full system administration",
        PermissionScope.SYSTEM,
        ResourceType.SYSTEM,
        "admin",
        True,
        True,
        "admin",
    ),
    (
        "system.monitor",
        "system.monitor",
        "Monitor system health",
        PermissionScope.SYSTEM,
        ResourceType.SYSTEM,
        "read",
        True,
        False,
        "monitoring",
    ),
    # User management permissions
    (
        "user.create",
        "user.create",
        "Create new users",
        PermissionScope.SYSTEM,
        ResourceType.USER,
        "create",
        False,
        True,
        "admin",
    ),
    (
        "user.read",
        "user.read",
        "View user information",
        PermissionScope.SYSTEM,
        ResourceType.USER,
        "read",
        False,
        False,
        "user",
    ),
    (
        "user.update",
        "user.update",
        "Update user information",
        PermissionScope.SYSTEM,
        ResourceType.USER,
        "update",
        False,
        True,
        "admin",
    ),
    (
        "user.delete",
        "user.delete",
        "Delete users",
        PermissionScope.SYSTEM,
        ResourceType.USER,
        "delete",
        False,
        True,
        "admin",
    ),
    (
        "user.list",
        "user.list",
        "List all users",
        PermissionScope.SYSTEM,
        ResourceType.USER,
        "read",
        False,
        False,
        "admin",
    ),
    # Organization permissions
    (
        "organization.create",
        "organization.create",
        "Create organizations",
        PermissionScope.SYSTEM,
        ResourceType.ORGANIZATION,
        "create",
        False,
        True,
        "admin",
    ),
    (
        "organization.read",
        "organization.read",
        "View organization details",
        PermissionScope.ORGANIZATION,
        ResourceType.ORGANIZATION,
        "read",
        False,
        False,
        "organization",
    ),
    (
        "organization.update",
        "organization.update",
        "Update organization details",
        PermissionScope.ORGANIZATION,
        ResourceType.ORGANIZATION,
        "update",
        False,
        True,
        "organization",
    ),
    (
        "organization.delete",
        "organization.delete",
        "Delete organizations",
        PermissionScope.SYSTEM,
        ResourceType.ORGANIZATION,
        "delete",
        False,
        True,
        "admin",
    ),
    (
        "organization.manage_members",
        "organization.manage_members",
        "Manage organization members",
        PermissionScope.ORGANIZATION,
        ResourceType.ORG_MEMBER,
        "update",
        False,
        True,
        "organization",
    ),
    # Project permissions
    (
        "project.create",
        "project.create",
        "Create projects",
        PermissionScope.ORGANIZATION,
        ResourceType.PROJECT,
        "create",
        False,
        False,
        "project",
    ),
    (
        "project.read",
        "project.read",
        "View project details",
        PermissionScope.PROJECT,
        ResourceType.PROJECT,
        "read",
        False,
        False,
        "project",
    ),
    (
        "project.update",
        "project.update",
        "Update project details",
        PermissionScope.PROJECT,
        ResourceType.PROJECT,
        "update",
        False,
        False,
        "project",
    ),
    (
        "project.delete",
        "project.delete",
        "Delete projects",
        PermissionScope.PROJECT,
        ResourceType.PROJECT,
        "delete",
        False,
        True,
        "project",
    ),
    (
        "project.list",
        "project.list",
        "List projects in organization",
        PermissionScope.ORGANIZATION,
        ResourceType.PROJECT,
        "read",
        False,
        False,
        "project",
    ),
    # Dependency permissions
    (
        "dependency.create",
        "dependency.create",
        "Add dependencies",
        PermissionScope.PROJECT,
        ResourceType.DEPENDENCY,
        "create",
        False,
        False,
        "dependency",
    ),
    (
        "dependency.read",
        "dependency.read",
        "View dependencies",
        PermissionScope.PROJECT,
        ResourceType.DEPENDENCY,
        "read",
        False,
        False,
        "dependency",
    ),
    (
        "dependency.update",
        "dependency.update",
        "Update dependencies",
        PermissionScope.PROJECT,
        ResourceType.DEPENDENCY,
        "update",
        False,
        False,
        "dependency",
    ),
    (
        "dependency.delete",
        "dependency.delete",
        "Remove dependencies",
        PermissionScope.PROJECT,
        ResourceType.DEPENDENCY,
        "delete",
        False,
        True,
        "dependency",
    ),
    (
        "dependency.analyze",
        "dependency.analyze",
        "Run dependency analysis",
        PermissionScope.PROJECT,
        ResourceType.DEPENDENCY,
        "read",
        False,
        False,
        "dependency",
    ),
    # Vulnerability permissions
    (
        "vulnerability.read",
        "vulnerability.read",
        "View vulnerability reports",
        PermissionScope.PROJECT,
        ResourceType.VULNERABILITY,
        "read",
        False,
        False,
        "security",
    ),
    (
        "vulnerability.update",
        "vulnerability.update",
        "Update vulnerability status",
        PermissionScope.PROJECT,
        ResourceType.VULNERABILITY,
        "update",
        False,
        True,
        "security",
    ),
    (
        "vulnerability.resolve",
        "vulnerability.resolve",
        "Mark vulnerabilities as resolved",
        PermissionScope.PROJECT,
        ResourceType.VULNERABILITY,
        "update",
        False,
        False,
        "security",
    ),
    (
        "vulnerability.ignore",
        "vulnerability.ignore",
        "Ignore vulnerabilities",
        PermissionScope.PROJECT,
        ResourceType.VULNERABILITY,
        "update",
        False,
        True,
        "security",
    ),
    # Analysis permissions
    (
        "analysis.run",
        "analysis.run",
        "Run security analysis",
        PermissionScope.PROJECT,
        ResourceType.ANALYSIS,
        "create",
        False,
        False,
        "analysis",
    ),
    (
        "analysis.read",
        "analysis.read",
        "View analysis results",
        PermissionScope.PROJECT,
        ResourceType.ANALYSIS,
        "read",
        False,
        False,
        "analysis",
    ),
    (
        "analysis.delete",
        "analysis.delete",
        "Delete analysis results",
        PermissionScope.PROJECT,
        ResourceType.ANALYSIS,
        "delete",
        False,
        True,
        "analysis",
    ),
    # Policy permissions
    (
        "policy.create",
        "policy.create",
        "Create security policies",
        PermissionScope.ORGANIZATION,
        ResourceType.POLICY,
        "create",
        False,
        True,
        "policy",
    ),
    (
        "policy.read",
        "policy.read",
        "View security policies",
        PermissionScope.ORGANIZATION,
        ResourceType.POLICY,
        "read",
        False,
        False,
        "policy",
    ),
    (
        "policy.update",
        "policy.update",
        "Update security policies",
        PermissionScope.ORGANIZATION,
        ResourceType.POLICY,
        "update",
        False,
        True,
        "policy",
    ),
    (
        "policy.delete",
        "policy.delete",
        "Delete security policies",
        PermissionScope.ORGANIZATION,
        ResourceType.POLICY,
        "delete",
        False,
        True,
        "policy",
    ),
    (
        "policy.evaluate",
        "policy.evaluate",
        "Evaluate policies against projects",
        PermissionScope.PROJECT,
        ResourceType.POLICY,
        "read",
        False,
        False,
        "policy",
    ),
    # Build permissions
    (
        "build.create",
        "build.create",
        "Trigger builds",
        PermissionScope.PROJECT,
        ResourceType.BUILD,
        "create",
        False,
        False,
        "build",
    ),
    (
        "build.read",
        "build.read",
        "View build history",
        PermissionScope.PROJECT,
        ResourceType.BUILD,
        "read",
        False,
        False,
        "build",
    ),
    (
        "build.delete",
        "build.delete",
        "Delete build records",
        PermissionScope.PROJECT,
        ResourceType.BUILD,
        "delete",
        False,
        True,
        "build",
    ),
    # Repository permissions
    (
        "repository.create",
        "repository.create",
        "Connect repositories",
        PermissionScope.PROJECT,
        ResourceType.REPOSITORY,
        "create",
        False,
        False,
        "repository",
    ),
    (
        "repository.read",
        "repository.read",
        "View repository details",
        PermissionScope.PROJECT,
        ResourceType.REPOSITORY,
        "read",
        False,
        False,
        "repository",
    ),
    (
        "repository.update",
        "repository.update",
        "Update repository settings",
        PermissionScope.PROJECT,
        ResourceType.REPOSITORY,
        "update",
        False,
        False,
        "repository",
    ),
    (
        "repository.delete",
        "repository.delete",
        "Remove repository connections",
        PermissionScope.PROJECT,
        ResourceType.REPOSITORY,
        "delete",
        False,
        True,
        "repository",
    ),
    (
        "repository.scan",
        "repository.scan",
        "Scan repository for dependencies",
        PermissionScope.PROJECT,
        ResourceType.REPOSITORY,
        "read",
        False,
        False,
        "repository",
    ),
    # RBAC management permissions
    (
        "permission.create",
        "permission.create",
        "Create permissions",
        PermissionScope.SYSTEM,
        ResourceType.PERMISSION,
        "create",
        True,
        True,
        "admin",
    ),
    (
        "permission.read",
        "permission.read",
        "View permissions",
        PermissionScope.SYSTEM,
        ResourceType.PERMISSION,
        "read",
        True,
        False,
        "admin",
    ),
    (
        "permission.update",
        "permission.update",
        "Update permissions",
        PermissionScope.SYSTEM,
        ResourceType.PERMISSION,
        "update",
        True,
        True,
        "admin",
    ),
    (
        "permission.delete",
        "permission.delete",
        "Delete permissions",
        PermissionScope.SYSTEM,
        ResourceType.PERMISSION,
        "delete",
        True,
        True,
        "admin",
    ),
    (
        "role.create",
        "role.create",
        "Create roles",
        PermissionScope.ORGANIZATION,
        ResourceType.ROLE,
        "create",
        False,
        True,
        "admin",
    ),
    (
        "role.read",
        "role.read",
        "View roles",
        PermissionScope.ORGANIZATION,
        ResourceType.ROLE,
        "read",
        False,
        False,
        "admin",
    ),
    (
        "role.update",
        "role.update",
        "Update roles",
        PermissionScope.ORGANIZATION,
        ResourceType.ROLE,
        "update",
        False,
        True,
        "admin",
    ),
    (
        "role.delete",
        "role.delete",
        "Delete roles",
        PermissionScope.ORGANIZATION,
        ResourceType.ROLE,
        "delete",
        False,
        True,
        "admin",
    ),
    (
        "assignment.create",
        "assignment.create",
        "Assign roles to users",
        PermissionScope.ORGANIZATION,
        ResourceType.ROLE,
        "update",
        False,
        True,
        "admin",
    ),
    (
        "assignment.read",
        "assignment.read",
        "View role assignments",
        PermissionScope.ORGANIZATION,
        ResourceType.ROLE,
        "read",
        False,
        False,
        "admin",
    ),
    (
        "assignment.update",
        "assignment.update",
        "Update role assignments",
        PermissionScope.ORGANIZATION,
        ResourceType.ROLE,
        "update",
        False,
        True,
        "admin",
    ),
    (
        "assignment.delete",
        "assignment.delete",
        "Remove role assignments",
        PermissionScope.ORGANIZATION,
        ResourceType.ROLE,
        "delete",
        False,
        True,
        "admin",
    ),
    (
        "resource_permission.grant",
        "resource_permission.grant",
        "Grant resource permissions",
        PermissionScope.PROJECT,
        ResourceType.PROJECT,
        "update",
        False,
        True,
        "admin",
    ),
    (
        "resource_permission.revoke",
        "resource_permission.revoke",
        "Revoke resource permissions",
        PermissionScope.PROJECT,
        ResourceType.PROJECT,
        "update",
        False,
        True,
        "admin",
    ),
    (
        "template.read",
        "template.read",
        "View role templates",
        PermissionScope.SYSTEM,
        ResourceType.ROLE,
        "read",
        True,
        False,
        "admin",
    ),
]

# Define initial roles
INITIAL_ROLES = [
    # System roles
    (
        "superuser",
        "Super User",
        "Full system access with all privileges",
        True,
        True,
        True,
        100,
        None,
        None,
    ),
    (
        "admin",
        "Administrator",
        "System administrator with full access",
        True,
        True,
        True,
        90,
        None,
        None,
    ),
    # Organization roles
    (
        "org_owner",
        "Organization Owner",
        "Owner of the organization with full control",
        False,
        True,
        True,
        80,
        None,
        None,
    ),
    (
        "org_admin",
        "Organization Admin",
        "Organization administrator",
        False,
        True,
        True,
        70,
        None,
        None,
    ),
    (
        "org_member",
        "Organization Member",
        "Regular organization member",
        False,
        True,
        False,
        30,
        None,
        None,
    ),
    # Project roles
    (
        "project_owner",
        "Project Owner",
        "Owner of the project",
        False,
        True,
        True,
        60,
        None,
        None,
    ),
    (
        "project_admin",
        "Project Admin",
        "Project administrator",
        False,
        True,
        True,
        50,
        None,
        None,
    ),
    (
        "developer",
        "Developer",
        "Developer with project access",
        False,
        True,
        False,
        40,
        None,
        None,
    ),
    (
        "analyst",
        "Security Analyst",
        "Security analyst role",
        False,
        True,
        False,
        45,
        None,
        None,
    ),
    (
        "viewer",
        "Viewer",
        "Read-only access to projects",
        False,
        True,
        False,
        20,
        None,
        None,
    ),
]

# Define role templates
INITIAL_TEMPLATES = [
    # System templates
    {
        "name": "Super User Template",
        "code": "superuser_template",
        "description": "Template for super user role with all system permissions",
        "category": "system",
        "scope": PermissionScope.SYSTEM,
        "is_system": True,
        "permissions": ["system.admin", "system.monitor"],
    },
    {
        "name": "Administrator Template",
        "code": "admin_template",
        "description": "Template for administrator role",
        "category": "system",
        "scope": PermissionScope.SYSTEM,
        "is_system": True,
        "permissions": [
            "user.create",
            "user.read",
            "user.update",
            "user.delete",
            "user.list",
            "organization.create",
            "organization.read",
            "permission.read",
            "role.read",
            "assignment.read",
            "template.read",
        ],
    },
    # Organization templates
    {
        "name": "Organization Owner Template",
        "code": "org_owner_template",
        "description": "Template for organization owners",
        "category": "organization",
        "scope": PermissionScope.ORGANIZATION,
        "is_system": True,
        "permissions": [
            "organization.update",
            "organization.delete",
            "organization.manage_members",
            "project.create",
            "project.list",
            "policy.create",
            "policy.read",
            "policy.update",
            "policy.delete",
            "role.create",
            "role.read",
            "role.update",
            "role.delete",
            "assignment.create",
            "assignment.read",
            "assignment.update",
            "assignment.delete",
        ],
    },
    {
        "name": "Organization Admin Template",
        "code": "org_admin_template",
        "description": "Template for organization administrators",
        "category": "organization",
        "scope": PermissionScope.ORGANIZATION,
        "is_system": True,
        "permissions": [
            "organization.update",
            "organization.manage_members",
            "project.create",
            "project.list",
            "policy.read",
            "policy.update",
            "role.read",
            "role.update",
            "assignment.read",
            "assignment.update",
        ],
    },
    {
        "name": "Organization Member Template",
        "code": "org_member_template",
        "description": "Template for organization members",
        "category": "organization",
        "scope": PermissionScope.ORGANIZATION,
        "is_system": True,
        "permissions": [
            "organization.read",
            "project.list",
            "policy.read",
        ],
    },
    # Project templates
    {
        "name": "Project Owner Template",
        "code": "project_owner_template",
        "description": "Template for project owners",
        "category": "project",
        "scope": PermissionScope.PROJECT,
        "is_system": True,
        "permissions": [
            "project.update",
            "project.delete",
            "dependency.create",
            "dependency.read",
            "dependency.update",
            "dependency.delete",
            "dependency.analyze",
            "vulnerability.read",
            "vulnerability.update",
            "vulnerability.resolve",
            "vulnerability.ignore",
            "analysis.run",
            "analysis.read",
            "analysis.delete",
            "policy.evaluate",
            "build.create",
            "build.read",
            "build.delete",
            "repository.create",
            "repository.read",
            "repository.update",
            "repository.delete",
            "repository.scan",
            "resource_permission.grant",
            "resource_permission.revoke",
        ],
    },
    {
        "name": "Developer Template",
        "code": "developer_template",
        "description": "Template for developers",
        "category": "project",
        "scope": PermissionScope.PROJECT,
        "is_system": True,
        "permissions": [
            "project.read",
            "dependency.create",
            "dependency.read",
            "dependency.update",
            "dependency.analyze",
            "vulnerability.read",
            "vulnerability.resolve",
            "analysis.run",
            "analysis.read",
            "build.create",
            "build.read",
            "repository.read",
            "repository.scan",
        ],
    },
    {
        "name": "Security Analyst Template",
        "code": "analyst_template",
        "description": "Template for security analysts",
        "category": "project",
        "scope": PermissionScope.PROJECT,
        "is_system": True,
        "permissions": [
            "project.read",
            "dependency.read",
            "dependency.analyze",
            "vulnerability.read",
            "vulnerability.update",
            "vulnerability.resolve",
            "analysis.run",
            "analysis.read",
            "policy.evaluate",
            "repository.read",
            "repository.scan",
        ],
    },
    {
        "name": "Viewer Template",
        "code": "viewer_template",
        "description": "Template for read-only viewers",
        "category": "project",
        "scope": PermissionScope.PROJECT,
        "is_system": True,
        "permissions": [
            "project.read",
            "dependency.read",
            "vulnerability.read",
            "analysis.read",
            "build.read",
            "repository.read",
            "policy.read",
        ],
    },
]

# Role permission mappings
ROLE_PERMISSIONS = {
    "superuser": [
        # Superuser gets all permissions
        *[p[1] for p in INITIAL_PERMISSIONS],
    ],
    "admin": [
        "system.monitor",
        "user.create",
        "user.read",
        "user.update",
        "user.delete",
        "user.list",
        "organization.create",
        "organization.read",
        "organization.update",
        "permission.read",
        "role.read",
        "assignment.read",
        "template.read",
        "project.create",
        "project.read",
        "project.update",
        "project.delete",
        "dependency.read",
        "dependency.update",
        "dependency.delete",
        "vulnerability.read",
        "vulnerability.update",
        "analysis.read",
        "analysis.delete",
        "policy.read",
        "policy.update",
        "policy.delete",
        "build.read",
        "build.delete",
        "repository.read",
        "repository.update",
        "repository.delete",
    ],
    "org_owner": [
        "organization.read",
        "organization.update",
        "organization.manage_members",
        "project.create",
        "project.read",
        "project.update",
        "project.delete",
        "project.list",
        "dependency.read",
        "dependency.update",
        "dependency.delete",
        "vulnerability.read",
        "vulnerability.update",
        "vulnerability.resolve",
        "analysis.run",
        "analysis.read",
        "analysis.delete",
        "policy.create",
        "policy.read",
        "policy.update",
        "policy.delete",
        "policy.evaluate",
        "build.create",
        "build.read",
        "build.delete",
        "repository.create",
        "repository.read",
        "repository.update",
        "repository.delete",
        "repository.scan",
        "role.create",
        "role.read",
        "role.update",
        "role.delete",
        "assignment.create",
        "assignment.read",
        "assignment.update",
        "assignment.delete",
        "resource_permission.grant",
        "resource_permission.revoke",
    ],
    "org_admin": [
        "organization.read",
        "organization.update",
        "organization.manage_members",
        "project.create",
        "project.read",
        "project.update",
        "project.list",
        "dependency.read",
        "dependency.update",
        "vulnerability.read",
        "vulnerability.update",
        "analysis.run",
        "analysis.read",
        "policy.read",
        "policy.update",
        "policy.evaluate",
        "build.read",
        "repository.read",
        "repository.update",
        "repository.scan",
        "role.read",
        "role.update",
        "assignment.read",
        "assignment.update",
    ],
    "org_member": [
        "organization.read",
        "project.list",
        "policy.read",
    ],
    "project_owner": [
        "project.read",
        "project.update",
        "project.delete",
        "dependency.create",
        "dependency.read",
        "dependency.update",
        "dependency.delete",
        "dependency.analyze",
        "vulnerability.read",
        "vulnerability.update",
        "vulnerability.resolve",
        "vulnerability.ignore",
        "analysis.run",
        "analysis.read",
        "analysis.delete",
        "policy.evaluate",
        "build.create",
        "build.read",
        "build.delete",
        "repository.create",
        "repository.read",
        "repository.update",
        "repository.delete",
        "repository.scan",
        "resource_permission.grant",
        "resource_permission.revoke",
    ],
    "project_admin": [
        "project.read",
        "project.update",
        "dependency.create",
        "dependency.read",
        "dependency.update",
        "dependency.analyze",
        "vulnerability.read",
        "vulnerability.update",
        "vulnerability.resolve",
        "analysis.run",
        "analysis.read",
        "policy.evaluate",
        "build.create",
        "build.read",
        "repository.read",
        "repository.update",
        "repository.scan",
    ],
    "developer": [
        "project.read",
        "dependency.create",
        "dependency.read",
        "dependency.update",
        "dependency.analyze",
        "vulnerability.read",
        "vulnerability.resolve",
        "analysis.run",
        "analysis.read",
        "build.create",
        "build.read",
        "repository.read",
        "repository.scan",
    ],
    "analyst": [
        "project.read",
        "dependency.read",
        "dependency.analyze",
        "vulnerability.read",
        "vulnerability.update",
        "vulnerability.resolve",
        "analysis.run",
        "analysis.read",
        "policy.evaluate",
        "repository.read",
        "repository.scan",
    ],
    "viewer": [
        "project.read",
        "dependency.read",
        "vulnerability.read",
        "analysis.read",
        "build.read",
        "repository.read",
        "policy.read",
    ],
}


async def seed_permissions(db: AsyncSession, rbac_service: RBACService) -> dict:
    """Create initial permissions."""
    print("Creating permissions...")
    permission_ids = {}

    for perm_data in INITIAL_PERMISSIONS:
        try:
            permission = await rbac_service.create_permission(
                db=db,
                name=perm_data[0],
                code=perm_data[1],
                scope=perm_data[2],
                resource_type=perm_data[3],
                action=perm_data[4],
                description=perm_data[5] if len(perm_data) > 5 else None,
                is_system=perm_data[6] if len(perm_data) > 6 else False,
                is_sensitive=perm_data[7] if len(perm_data) > 7 else False,
                category=perm_data[8] if len(perm_data) > 8 else None,
            )
            permission_ids[perm_data[1]] = permission.id
            print(f"  ✓ Created permission: {perm_data[1]}")
        except Exception as e:
            if "already exists" in str(e):
                print(f"  ⚠ Permission already exists: {perm_data[1]}")
                # Get existing permission
                existing = await rbac_service.get_permission(db, code=perm_data[1])
                if existing:
                    permission_ids[perm_data[1]] = existing.id
            else:
                print(f"  ✗ Failed to create permission {perm_data[1]}: {e}")

    return permission_ids


async def seed_roles(db: AsyncSession, rbac_service: RBACService) -> dict:
    """Create initial roles."""
    print("\nCreating roles...")
    role_ids = {}

    for role_data in INITIAL_ROLES:
        try:
            role = await rbac_service.create_role(
                db=db,
                name=role_data[0],
                code=role_data[1],
                description=role_data[2],
                is_system=role_data[3],
                is_active=True,
                is_privileged=role_data[4],
                level=role_data[5],
                parent_role_id=role_data[6],
                organization_id=role_data[7],
                permission_codes=ROLE_PERMISSIONS.get(role_data[1], []),
            )
            role_ids[role_data[1]] = role.id
            print(
                f"  ✓ Created role: {role_data[1]} with {len(ROLE_PERMISSIONS.get(role_data[1], []))} permissions"
            )
        except Exception as e:
            if "already exists" in str(e):
                print(f"  ⚠ Role already exists: {role_data[1]}")
                # Get existing role
                existing = await rbac_service.get_role(db, code=role_data[1])
                if existing:
                    role_ids[role_data[1]] = existing.id
            else:
                print(f"  ✗ Failed to create role {role_data[1]}: {e}")

    return role_ids


async def seed_templates(db: AsyncSession, rbac_service: RBACService) -> dict:
    """Create role templates."""
    print("\nCreating role templates...")
    template_ids = {}

    for template_data in INITIAL_TEMPLATES:
        try:
            template = RoleTemplate(
                name=template_data["name"],
                code=template_data["code"],
                description=template_data["description"],
                category=template_data["category"],
                scope=template_data["scope"],
                is_system=template_data["is_system"],
                permissions=template_data["permissions"],
                default_settings={},
                metadata={},
            )

            db.add(template)
            await db.commit()
            await db.refresh(template)

            template_ids[template_data["code"]] = template.id
            print(f"  ✓ Created template: {template_data['code']}")
        except Exception as e:
            if "already exists" in str(e):
                print(f"  ⚠ Template already exists: {template_data['code']}")
            else:
                print(f"  ✗ Failed to create template {template_data['code']}: {e}")

    return template_ids


async def main():
    """Main seeding function."""
    print("🌱 Seeding RBAC data for Universal Dependency Platform")
    print("=" * 60)

    # Initialize RBAC service
    rbac_service = RBACService()

    async for db in get_async_session():
        try:
            # Seed permissions
            permission_ids = await seed_permissions(db, rbac_service)

            # Seed roles
            role_ids = await seed_roles(db, rbac_service)

            # Seed templates
            template_ids = await seed_templates(db, rbac_service)

            print("\n" + "=" * 60)
            print("✅ RBAC seeding completed successfully!")
            print(f"   Created {len(permission_ids)} permissions")
            print(f"   Created {len(role_ids)} roles")
            print(f"   Created {len(template_ids)} templates")

        except Exception as e:
            print(f"\n❌ Seeding failed: {e}")
            import traceback

            traceback.print_exc()
            await db.rollback()
        finally:
            await db.close()


if __name__ == "__main__":
    asyncio.run(main())
