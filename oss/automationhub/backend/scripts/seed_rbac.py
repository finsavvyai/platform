"""
RBAC System Seeding Script

This script initializes the comprehensive Role-Based Access Control system with:
- System permissions for all resource types and actions
- Hierarchical role structure with inheritance
- Default role assignments for initial users
- Sample resource permissions for testing

Author: Claude Code Implementation
Task: 1.1.3 Role-Based Access Control
Updated: 2025-01-06
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_
from sqlalchemy.orm import selectinload

from app.core.database import get_db, Base
from app.models.user import User
from app.models.organization import Organization
from app.models.rbac import (
    Role, Permission, RolePermission, UserRoleAssignment,
    ResourcePermission
)
from app.services.authorization import AuthorizationService

logger = logging.getLogger(__name__)


class RBACSeeder:
    """Comprehensive RBAC system seeder"""

    def __init__(self):
        self.auth_service = AuthorizationService()

    async def seed_all(self):
        """Seed the complete RBAC system"""
        logger.info("Starting RBAC system seeding...")

        async for db in get_db():
            try:
                # Initialize system permissions
                await self._seed_system_permissions(db)
                logger.info("✓ System permissions seeded")

                # Initialize system roles
                await self._seed_system_roles(db)
                logger.info("✓ System roles seeded")

                # Create sample organization
                org = await self._seed_sample_organization(db)
                logger.info("✓ Sample organization created")

                # Create sample users
                users = await self._seed_sample_users(db, org)
                logger.info("✓ Sample users created")

                # Assign roles to sample users
                await self._seed_user_role_assignments(db, users)
                logger.info("✓ User role assignments seeded")

                # Create sample resource permissions
                await self._seed_sample_resource_permissions(db, users)
                logger.info("✓ Sample resource permissions seeded")

                # Verify seeding
                await self._verify_seeding(db)
                logger.info("✓ RBAC seeding verification completed")

                logger.info("🎉 RBAC system seeding completed successfully!")
                break

            except Exception as e:
                logger.error(f"Error during RBAC seeding: {e}")
                raise

    async def _seed_system_permissions(self, db: AsyncSession):
        """Seed comprehensive system permissions"""
        await self.auth_service.initialize_system_permissions(db)

        # Add additional custom permissions for specific features
        custom_permissions = [
            {
                "name": "report:generate",
                "description": "Generate system reports",
                "category": "reporting",
                "action": "create",
                "resource_type": "report",
                "scope": "organization"
            },
            {
                "name": "api_key:create",
                "description": "Create API keys for integration",
                "category": "api_management",
                "action": "create",
                "resource_type": "api_key",
                "scope": "self"
            },
            {
                "name": "api_key:manage",
                "description": "Manage all API keys in organization",
                "category": "api_management",
                "action": "manage",
                "resource_type": "api_key",
                "scope": "organization"
            },
            {
                "name": "webhook:create",
                "description": "Create webhooks for automation",
                "category": "integration",
                "action": "create",
                "resource_type": "webhook",
                "scope": "organization"
            },
            {
                "name": "webhook:manage",
                "description": "Manage all webhooks in organization",
                "category": "integration",
                "action": "manage",
                "resource_type": "webhook",
                "scope": "organization"
            },
            {
                "name": "schedule:create",
                "description": "Create scheduled tasks",
                "category": "automation",
                "action": "create",
                "resource_type": "schedule",
                "scope": "organization"
            },
            {
                "name": "dashboard:custom",
                "description": "Create custom dashboards",
                "category": "monitoring",
                "action": "create",
                "resource_type": "dashboard",
                "scope": "organization"
            },
            {
                "name": "team:manage",
                "description": "Manage teams and team memberships",
                "category": "team_management",
                "action": "manage",
                "resource_type": "team",
                "scope": "organization"
            },
        ]

        for perm_data in custom_permissions:
            # Check if permission exists
            existing = await db.execute(
                select(Permission).where(Permission.name == perm_data["name"])
            )
            if not existing.scalar_one_or_none():
                permission = Permission(
                    name=perm_data["name"],
                    description=perm_data["description"],
                    category=perm_data["category"],
                    action=perm_data["action"],
                    resource_type=perm_data["resource_type"],
                    scope=perm_data["scope"],
                    is_system=False,
                    is_active=True
                )
                db.add(permission)

        await db.commit()

    async def _seed_system_roles(self, db: AsyncSession):
        """Seed comprehensive system roles with hierarchy"""
        await self.auth_service.initialize_system_roles(db)

        # Add additional custom roles
        custom_roles = [
            {
                "name": "auditor",
                "display_name": "Auditor",
                "description": "Auditor with read-only access to all resources",
                "category": "compliance",
                "level": 15,
                "parent_role": "admin",
                "permissions": [
                    "system:audit", "system:monitor",
                    "user:read", "role:read",
                    "workflow:read", "document:read", "agent:read",
                    "organization:read"
                ],
                "metadata": {"compliance_role": True}
            },
            {
                "name": "support",
                "display_name": "Support Agent",
                "description": "Support agent with limited system access",
                "category": "support",
                "level": 25,
                "parent_role": "manager",
                "permissions": [
                    "user:read", "user:update",
                    "organization:read",
                    "workflow:read", "agent:read",
                    "system:monitor"
                ],
                "metadata": {"support_role": True}
            },
            {
                "name": "analyst",
                "display_name": "Business Analyst",
                "description": "Business analyst with reporting access",
                "category": "business",
                "level": 35,
                "parent_role": "developer",
                "permissions": [
                    "user:read",
                    "organization:read",
                    "workflow:read", "document:read", "agent:read",
                    "report:generate",
                    "dashboard:custom"
                ],
                "metadata": {"business_role": True}
            },
        ]

        for role_data in custom_roles:
            # Check if role exists
            existing = await db.execute(
                select(Role).where(Role.name == role_data["name"])
            )
            if not existing.scalar_one_or_none():
                # Get parent role
                parent_role = None
                if "parent_role" in role_data:
                    parent_result = await db.execute(
                        select(Role).where(Role.name == role_data["parent_role"])
                    )
                    parent_role = parent_result.scalar_one_or_none()

                # Create role
                new_role = Role(
                    name=role_data["name"],
                    display_name=role_data.get("display_name"),
                    description=role_data["description"],
                    category=role_data.get("category"),
                    parent_role_id=parent_role.id if parent_role else None,
                    level=role_data.get("level", 0),
                    is_system_role=True,
                    is_assignable=True,
                    role_metadata=role_data.get("metadata", {}),
                    tags=role_data.get("tags", [])
                )
                db.add(new_role)
                await db.flush()

                # Add permissions
                for perm_name in role_data.get("permissions", []):
                    await self._add_permission_to_role(db, new_role.id, perm_name)

        await db.commit()

    async def _seed_sample_organization(self, db: AsyncSession) -> Organization:
        """Create a sample organization for testing"""
        # Check if organization already exists
        existing = await db.execute(
            select(Organization).where(Organization.slug == "demo-organization")
        )
        if existing.scalar_one_or_none():
            result = await db.execute(
                select(Organization).where(Organization.slug == "demo-organization")
            )
            return result.scalar_one()

        organization = Organization(
            name="Demo Organization",
            slug="demo-organization",
            description="Sample organization for RBAC testing and demonstration",
            settings={
                "timezone": "UTC",
                "locale": "en-US",
                "features": {
                    "rbac": True,
                    "audit_logging": True,
                    "api_access": True
                }
            }
        )
        db.add(organization)
        await db.commit()
        await db.refresh(organization)

        return organization

    async def _seed_sample_users(self, db: AsyncSession, org: Organization) -> Dict[str, User]:
        """Create sample users with different roles"""
        users = {}

        sample_users_data = [
            {
                "key": "super_admin",
                "email": "superadmin@demo.com",
                "full_name": "Super Administrator",
                "is_superuser": True,
                "role": "super_admin"
            },
            {
                "key": "admin",
                "email": "admin@demo.com",
                "full_name": "Organization Administrator",
                "role": "admin"
            },
            {
                "key": "manager",
                "email": "manager@demo.com",
                "full_name": "Team Manager",
                "role": "manager"
            },
            {
                "key": "developer",
                "email": "developer@demo.com",
                "full_name": "Software Developer",
                "role": "developer"
            },
            {
                "key": "analyst",
                "email": "analyst@demo.com",
                "full_name": "Business Analyst",
                "role": "analyst"
            },
            {
                "key": "user1",
                "email": "user1@demo.com",
                "full_name": "Regular User One",
                "role": "user"
            },
            {
                "key": "user2",
                "email": "user2@demo.com",
                "full_name": "Regular User Two",
                "role": "user"
            },
            {
                "key": "viewer",
                "email": "viewer@demo.com",
                "full_name": "Read-only User",
                "role": "viewer"
            },
            {
                "key": "auditor",
                "email": "auditor@demo.com",
                "full_name": "Compliance Auditor",
                "role": "auditor"
            },
            {
                "key": "support",
                "email": "support@demo.com",
                "full_name": "Support Agent",
                "role": "support"
            }
        ]

        for user_data in sample_users_data:
            # Check if user already exists
            existing = await db.execute(
                select(User).where(User.email == user_data["email"])
            )
            if existing.scalar_one_or_none():
                result = await db.execute(
                    select(User).where(User.email == user_data["email"])
                )
                user = result.scalar_one()
            else:
                # Create new user
                user = User(
                    email=user_data["email"],
                    full_name=user_data["full_name"],
                    is_active=True,
                    is_verified=True,
                    is_superuser=user_data.get("is_superuser", False),
                    organization_id=org.id,
                    subscription_tier="enterprise",
                    user_metadata={
                        "seeded": True,
                        "demo_role": user_data.get("role")
                    }
                )
                db.add(user)
                await db.flush()

            users[user_data["key"]] = user

        await db.commit()
        return users

    async def _seed_user_role_assignments(self, db: AsyncSession, users: Dict[str, User]):
        """Assign roles to sample users"""
        role_assignments = [
            ("admin", "admin"),
            ("manager", "manager"),
            ("developer", "developer"),
            ("analyst", "analyst"),
            ("user1", "user"),
            ("user2", "user"),
            ("viewer", "viewer"),
            ("auditor", "auditor"),
            ("support", "support"),
        ]

        for user_key, role_name in role_assignments:
            if user_key in users:
                # Check if assignment already exists
                existing = await db.execute(
                    select(UserRoleAssignment).where(
                        UserRoleAssignment.user_id == users[user_key].id,
                        UserRoleAssignment.is_active == True
                    )
                )
                if not existing.scalar_one_or_none():
                    await self.auth_service.assign_role_to_user(
                        db=db,
                        user_id=str(users[user_key].id),
                        role_name=role_name,
                        assigned_by=str(users["super_admin"].id),
                        reason="Initial role assignment during system seeding"
                    )

        await db.commit()

    async def _seed_sample_resource_permissions(self, db: AsyncSession, users: Dict[str, User]):
        """Create sample resource-specific permissions"""
        resource_permissions = [
            # Manager can manage all workflows
            {
                "resource_type": "workflow",
                "resource_id": uuid4(),
                "user_id": users["manager"].id,
                "permission_name": "workflow:manage",
                "reason": "Manager override for workflow management"
            },
            # Developer can deploy infrastructure for specific project
            {
                "resource_type": "infrastructure",
                "resource_id": uuid4(),
                "user_id": users["developer"].id,
                "permission_name": "infrastructure:deploy",
                "reason": "Developer access for project infrastructure"
            },
            # Analyst can generate reports
            {
                "resource_type": "report",
                "resource_id": uuid4(),
                "user_id": users["analyst"].id,
                "permission_name": "report:generate",
                "reason": "Business analyst reporting access"
            },
            # Support can manage API keys
            {
                "resource_type": "api_key",
                "resource_id": uuid4(),
                "user_id": users["support"].id,
                "permission_name": "api_key:manage",
                "reason": "Support agent API key management"
            },
            # User1 can share specific documents
            {
                "resource_type": "document",
                "resource_id": uuid4(),
                "user_id": users["user1"].id,
                "permission_name": "document:share",
                "reason": "User document sharing permissions"
            },
        ]

        for perm_data in resource_permissions:
            await self.auth_service.grant_resource_permission(
                db=db,
                resource_type=perm_data["resource_type"],
                resource_id=str(perm_data["resource_id"]),
                user_id=str(perm_data["user_id"]),
                permission_name=perm_data["permission_name"],
                granted_by=str(users["super_admin"].id),
                reason=perm_data["reason"],
                expires_at=datetime.utcnow() + timedelta(days=90)
            )

        await db.commit()

    async def _verify_seeding(self, db: AsyncSession):
        """Verify that RBAC seeding was successful"""
        # Count permissions
        permission_count = await db.scalar(select(func.count(Permission.id)))
        logger.info(f"✓ Total permissions: {permission_count}")

        # Count roles
        role_count = await db.scalar(select(func.count(Role.id)))
        logger.info(f"✓ Total roles: {role_count}")

        # Count role permissions
        role_perm_count = await db.scalar(select(func.count(RolePermission.id)))
        logger.info(f"✓ Total role-permission assignments: {role_perm_count}")

        # Count user role assignments
        user_role_count = await db.scalar(select(func.count(UserRoleAssignment.id)))
        logger.info(f"✓ Total user-role assignments: {user_role_count}")

        # Count resource permissions
        resource_perm_count = await db.scalar(select(func.count(ResourcePermission.id)))
        logger.info(f"✓ Total resource permissions: {resource_perm_count}")

        # Verify system permissions exist
        system_perms = await db.execute(
            select(Permission).where(Permission.is_system == True)
        )
        system_perm_count = len(system_perms.scalars().all())
        logger.info(f"✓ System permissions: {system_perm_count}")

        # Verify system roles exist
        system_roles = await db.execute(
            select(Role).where(Role.is_system_role == True)
        )
        system_role_count = len(system_roles.scalars().all())
        logger.info(f"✓ System roles: {system_role_count}")

        # Verify role hierarchy
        admin_role = await db.execute(
            select(Role).where(Role.name == "admin")
        )
        admin = admin_role.scalar_one()
        if admin and admin.parent_role_id:
            logger.info("✓ Role hierarchy verified")
        else:
            logger.warning("⚠ Role hierarchy issue detected")

    async def _add_permission_to_role(self, db: AsyncSession, role_id: str, permission_name: str):
        """Helper to add permission to role"""
        perm_result = await db.execute(
            select(Permission).where(Permission.name == permission_name)
        )
        permission = perm_result.scalar_one_or_none()

        if permission:
            # Check if assignment already exists
            existing = await db.execute(
                select(RolePermission).where(
                    RolePermission.role_id == role_id,
                    RolePermission.permission_id == permission.id
                )
            )
            if not existing.scalar_one_or_none():
                role_permission = RolePermission(
                    role_id=role_id,
                    permission_id=permission.id,
                    is_granted=True
                )
                db.add(role_permission)


async def main():
    """Main seeding function"""
    # Configure logging
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    )

    seeder = RBACSeeder()
    await seeder.seed_all()


if __name__ == "__main__":
    asyncio.run(main())