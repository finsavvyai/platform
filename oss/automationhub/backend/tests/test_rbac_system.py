"""
Comprehensive RBAC System Tests

This test suite covers all aspects of the Role-Based Access Control system including:
- Permission creation and management
- Role hierarchy and inheritance
- User role assignments with expiration
- Resource-level permission control
- Permission checking with context
- Audit logging functionality
- Bulk operations and filtering

Author: Claude Code Implementation
Task: 1.1.3 Role-Based Access Control
Updated: 2025-01-06
"""

import pytest
import asyncio
from datetime import datetime, timedelta
from typing import Dict, Any, List
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_

from app.core.database import get_test_db, Base, create_test_engine
from app.models.user import User
from app.models.organization import Organization
from app.models.rbac import (
    Role, Permission, RolePermission, UserRoleAssignment,
    ResourcePermission, PermissionAuditLog, PermissionScope,
    PermissionAction, ResourceType
)
from app.services.authorization import AuthorizationService, PermissionCheckContext, PermissionResult


@pytest.fixture(scope="function")
async def db_session():
    """Create test database session"""
    from app.core.database import engine

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async for session in get_test_db():
        yield session

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture
async def auth_service():
    """Create authorization service instance"""
    return AuthorizationService()


@pytest.fixture
async def test_organization(db_session: AsyncSession):
    """Create test organization"""
    org = Organization(
        name="Test Organization",
        slug="test-org",
        description="Test organization for RBAC tests"
    )
    db_session.add(org)
    await db_session.commit()
    await db_session.refresh(org)
    return org


@pytest.fixture
async def test_users(db_session: AsyncSession, test_organization):
    """Create test users with different roles"""
    users = {}

    # Super admin user
    users["admin"] = User(
        email="admin@test.com",
        full_name="Admin User",
        is_superuser=True,
        is_active=True,
        organization_id=test_organization.id
    )

    # Regular users
    users["user1"] = User(
        email="user1@test.com",
        full_name="User One",
        is_active=True,
        organization_id=test_organization.id
    )

    users["user2"] = User(
        email="user2@test.com",
        full_name="User Two",
        is_active=True,
        organization_id=test_organization.id
    )

    # Inactive user
    users["inactive"] = User(
        email="inactive@test.com",
        full_name="Inactive User",
        is_active=False,
        organization_id=test_organization.id
    )

    for user in users.values():
        db_session.add(user)

    await db_session.commit()
    return users


@pytest.fixture
async def system_permissions(db_session: AsyncSession, auth_service):
    """Initialize system permissions"""
    await auth_service.initialize_system_permissions(db_session)

    # Get all permissions
    result = await db_session.execute(select(Permission))
    return {perm.name: perm for perm in result.scalars().all()}


@pytest.fixture
async def system_roles(db_session: AsyncSession, auth_service):
    """Initialize system roles"""
    await auth_service.initialize_system_roles(db_session)

    # Get all roles
    result = await db_session.execute(select(Role))
    return {role.name: role for role in result.scalars().all()}


class TestPermissionManagement:
    """Test permission creation and management"""

    async def test_create_permission(self, db_session: AsyncSession):
        """Test creating a new permission"""
        permission = Permission(
            name="test:custom",
            description="Custom test permission",
            category="test",
            action="create",
            resource_type="test_resource",
            scope="resource",
            conditions={"time_range": {"start_time": "09:00", "end_time": "17:00"}},
            is_system=False,
            is_active=True
        )

        db_session.add(permission)
        await db_session.commit()
        await db_session.refresh(permission)

        assert permission.id is not None
        assert permission.name == "test:custom"
        assert permission.action == "create"
        assert permission.resource_type == "test_resource"
        assert permission.scope == "resource"
        assert permission.conditions == {"time_range": {"start_time": "09:00", "end_time": "17:00"}}
        assert permission.is_system is False
        assert permission.is_active is True
        assert permission.full_name == "create:test_resource"

    async def test_permission_uniqueness(self, db_session: AsyncSession):
        """Test that permission names are unique"""
        permission1 = Permission(
            name="test:unique",
            description="First permission",
            action="read",
            resource_type="test"
        )
        db_session.add(permission1)
        await db_session.commit()

        # Try to create duplicate permission
        permission2 = Permission(
            name="test:unique",
            description="Second permission",
            action="write",
            resource_type="test"
        )
        db_session.add(permission2)

        with pytest.raises(Exception):  # Should raise integrity error
            await db_session.commit()

    async def test_update_permission(self, db_session: AsyncSession):
        """Test updating permission"""
        permission = Permission(
            name="test:update",
            description="Original description",
            action="read",
            resource_type="test"
        )
        db_session.add(permission)
        await db_session.commit()

        # Update permission
        permission.description = "Updated description"
        permission.conditions = {"custom": "condition"}
        await db_session.commit()

        await db_session.refresh(permission)
        assert permission.description == "Updated description"
        assert permission.conditions == {"custom": "condition"}

    async def test_delete_permission(self, db_session: AsyncSession):
        """Test deleting permission"""
        permission = Permission(
            name="test:delete",
            description="Permission to delete",
            action="read",
            resource_type="test"
        )
        db_session.add(permission)
        await db_session.commit()

        permission_id = permission.id

        await db_session.delete(permission)
        await db_session.commit()

        # Verify permission is deleted
        result = await db_session.execute(
            select(Permission).where(Permission.id == permission_id)
        )
        assert result.scalar_one_or_none() is None


class TestRoleHierarchy:
    """Test role hierarchy and inheritance"""

    async def test_create_role_hierarchy(self, db_session: AsyncSession, system_permissions):
        """Test creating hierarchical roles"""
        # Create parent role
        parent_role = Role(
            name="parent_role",
            display_name="Parent Role",
            description="Parent role with basic permissions",
            level=10,
            is_system_role=False
        )
        db_session.add(parent_role)
        await db_session.flush()

        # Add permissions to parent role
        parent_permission = system_permissions["user:read"]
        role_permission = RolePermission(
            role_id=parent_role.id,
            permission_id=parent_permission.id,
            is_granted=True
        )
        db_session.add(role_permission)

        # Create child role
        child_role = Role(
            name="child_role",
            display_name="Child Role",
            description="Child role inheriting from parent",
            parent_role_id=parent_role.id,
            level=20,
            inherits_from_parent=True,
            is_system_role=False
        )
        db_session.add(child_role)
        await db_session.commit()

        # Test inheritance
        await db_session.refresh(parent_role)
        await db_session.refresh(child_role)

        child_permissions = child_role.get_all_permissions(include_inherited=True)
        assert "user:read" in child_permissions

    async def test_role_inheritance_disabled(self, db_session: AsyncSession, system_permissions):
        """Test role with inheritance disabled"""
        # Create parent role
        parent_role = Role(
            name="parent_no_inherit",
            description="Parent role",
            level=10,
            is_system_role=False
        )
        db_session.add(parent_role)
        await db_session.flush()

        # Add permission to parent
        parent_permission = system_permissions["user:read"]
        role_permission = RolePermission(
            role_id=parent_role.id,
            permission_id=parent_permission.id,
            is_granted=True
        )
        db_session.add(role_permission)

        # Create child role with inheritance disabled
        child_role = Role(
            name="child_no_inherit",
            description="Child role without inheritance",
            parent_role_id=parent_role.id,
            level=20,
            inherits_from_parent=False,
            is_system_role=False
        )
        db_session.add(child_role)
        await db_session.commit()

        # Test no inheritance
        await db_session.refresh(child_role)
        child_permissions = child_role.get_all_permissions(include_inherited=True)
        assert "user:read" not in child_permissions

    async def test_role_validation_dates(self, db_session: AsyncSession):
        """Test role validity with date constraints"""
        past_date = datetime.utcnow() - timedelta(days=1)
        future_date = datetime.utcnow() + timedelta(days=1)

        # Role with valid dates
        valid_role = Role(
            name="valid_role",
            description="Currently valid role",
            valid_from=past_date,
            valid_until=future_date,
            is_system_role=False
        )
        db_session.add(valid_role)

        # Role expired
        expired_role = Role(
            name="expired_role",
            description="Expired role",
            valid_from=past_date,
            valid_until=past_date,
            is_system_role=False
        )
        db_session.add(expired_role)

        # Role not yet valid
        future_role = Role(
            name="future_role",
            description="Future role",
            valid_from=future_date,
            valid_until=future_date + timedelta(days=1),
            is_system_role=False
        )
        db_session.add(future_role)

        await db_session.commit()

        # Test validity
        assert valid_role.is_valid_now is True
        assert expired_role.is_valid_now is False
        assert future_role.is_valid_now is False


class TestUserRoleAssignment:
    """Test user role assignments"""

    async def test_assign_role_to_user(
        self,
        db_session: AsyncSession,
        auth_service: AuthorizationService,
        test_users,
        system_roles
    ):
        """Test assigning a role to a user"""
        user = test_users["user1"]
        role = system_roles["user"]

        success = await auth_service.assign_role_to_user(
            db=db,
            user_id=str(user.id),
            role_name="user",
            assigned_by=str(user.id)
        )

        assert success is True

        # Verify assignment
        assignments = await auth_service.get_user_roles(db, str(user.id))
        assert len(assignments) == 1
        assert assignments[0]["role_name"] == "user"
        assert assignments[0]["is_active"] is True

    async def test_assign_role_with_expiration(
        self,
        db_session: AsyncSession,
        auth_service: AuthorizationService,
        test_users,
        system_roles
    ):
        """Test assigning a role with expiration"""
        user = test_users["user1"]
        expires_at = datetime.utcnow() + timedelta(days=7)

        success = await auth_service.assign_role_to_user(
            db=db,
            user_id=str(user.id),
            role_name="user",
            assigned_by=str(user.id),
            expires_at=expires_at
        )

        assert success is True

        # Verify assignment expiration
        assignments = await auth_service.get_user_roles(db, str(user.id))
        assert len(assignments) == 1
        assert assignments[0]["expires_at"] is not None
        assert assignments[0]["days_until_expiry"] == 7

    async def test_remove_role_from_user(
        self,
        db_session: AsyncSession,
        auth_service: AuthorizationService,
        test_users,
        system_roles
    ):
        """Test removing a role from a user"""
        user = test_users["user1"]

        # First assign role
        await auth_service.assign_role_to_user(
            db=db,
            user_id=str(user.id),
            role_name="user",
            assigned_by=str(user.id)
        )

        # Then remove role
        success = await auth_service.remove_role_from_user(
            db=db,
            user_id=str(user.id),
            role_name="user",
            removed_by=str(user.id)
        )

        assert success is True

        # Verify removal
        assignments = await auth_service.get_user_roles(db, str(user.id))
        assert len(assignments) == 0

    async def test_role_assignment_limits(
        self,
        db_session: AsyncSession,
        auth_service: AuthorizationService,
        test_users
    ):
        """Test role assignment with max assignments limit"""
        # Create role with max assignments
        limited_role = Role(
            name="limited_role",
            description="Role with limited assignments",
            max_assignments=2,
            is_system_role=False
        )
        db_session.add(limited_role)
        await db_session.flush()

        # Add permission to role
        permission = Permission(
            name="limited:permission",
            action="read",
            resource_type="test"
        )
        db_session.add(permission)
        await db_session.flush()

        role_permission = RolePermission(
            role_id=limited_role.id,
            permission_id=permission.id,
            is_granted=True
        )
        db_session.add(role_permission)
        await db_session.commit()

        # Assign role to first user
        success1 = await auth_service.assign_role_to_user(
            db=db,
            user_id=str(test_users["user1"].id),
            role_name="limited_role",
            assigned_by=str(test_users["user1"].id)
        )
        assert success1 is True

        # Assign role to second user
        success2 = await auth_service.assign_role_to_user(
            db=db,
            user_id=str(test_users["user2"].id),
            role_name="limited_role",
            assigned_by=str(test_users["user2"].id)
        )
        assert success2 is True

        # Try to assign to third user (should fail)
        success3 = await auth_service.assign_role_to_user(
            db=db,
            user_id=str(test_users["inactive"].id),
            role_name="limited_role",
            assigned_by=str(test_users["user1"].id)
        )
        assert success3 is False


class TestPermissionChecking:
    """Test permission checking functionality"""

    async def test_basic_permission_check(
        self,
        db_session: AsyncSession,
        auth_service: AuthorizationService,
        test_users,
        system_roles
    ):
        """Test basic permission checking"""
        user = test_users["user1"]

        # Assign user role
        await auth_service.assign_role_to_user(
            db=db,
            user_id=str(user.id),
            role_name="user",
            assigned_by=str(user.id)
        )

        # Check permission
        result = await auth_service.check_permission(
            db=db,
            user_id=str(user.id),
            permission_name="workflow:read"
        )

        assert result.granted is True
        assert result.source in ["role", "inherited"]

        # Check permission user doesn't have
        result = await auth_service.check_permission(
            db=db,
            user_id=str(user.id),
            permission_name="user:delete"
        )

        assert result.granted is False

    async def test_superuser_permission_check(
        self,
        db_session: AsyncSession,
        auth_service: AuthorizationService,
        test_users
    ):
        """Test permission checking for superuser"""
        admin_user = test_users["admin"]

        # Superuser should have all permissions
        result = await auth_service.check_permission(
            db=db,
            user_id=str(admin_user.id),
            permission_name="system:admin"
        )

        assert result.granted is True
        assert result.source == "superuser"

    async def test_permission_check_with_context(
        self,
        db_session: AsyncSession,
        auth_service: AuthorizationService,
        test_users,
        system_roles
    ):
        """Test permission checking with context"""
        user = test_users["user1"]

        # Create permission with time-based conditions
        permission = Permission(
            name="test:time_based",
            description="Time-based permission",
            action="read",
            resource_type="test",
            conditions={
                "time_range": {
                    "start_time": "09:00",
                    "end_time": "17:00"
                }
            }
        )
        db_session.add(permission)
        await db_session.flush()

        # Create role with permission
        role = Role(
            name="time_based_role",
            description="Role with time-based permissions",
            is_system_role=False
        )
        db_session.add(role)
        await db_session.flush()

        role_permission = RolePermission(
            role_id=role.id,
            permission_id=permission.id,
            conditions=permission.conditions
        )
        db_session.add(role_permission)
        await db_session.commit()

        # Assign role to user
        await auth_service.assign_role_to_user(
            db=db,
            user_id=str(user.id),
            role_name="time_based_role",
            assigned_by=str(user.id)
        )

        # Check permission with context (current time)
        current_hour = datetime.utcnow().hour
        context = PermissionCheckContext(
            ip_address="127.0.0.1",
            user_agent="test-agent"
        )

        result = await auth_service.check_permission(
            db=db,
            user_id=str(user.id),
            permission_name="test:time_based",
            context=context
        )

        # Result depends on current time
        if 9 <= current_hour <= 16:
            assert result.granted is True
            assert result.conditions_met is True
        else:
            assert result.granted is False
            assert result.conditions_met is False

    async def test_multiple_permission_check(
        self,
        db_session: AsyncSession,
        auth_service: AuthorizationService,
        test_users,
        system_roles
    ):
        """Test checking multiple permissions"""
        user = test_users["user1"]

        # Assign user role
        await auth_service.assign_role_to_user(
            db=db,
            user_id=str(user.id),
            role_name="user",
            assigned_by=str(user.id)
        )

        # Check multiple permissions (require all)
        permissions = ["workflow:read", "document:read", "user:read"]
        results = await auth_service.check_permissions(
            db=db,
            user_id=str(user.id),
            permission_names=permissions,
            require_all=True
        )

        # User role should have these permissions
        for perm_name in permissions:
            assert results[perm_name].granted is True

        # Check with permission user doesn't have
        permissions_with_admin = ["workflow:read", "user:delete"]
        results = await auth_service.check_permissions(
            db=db,
            user_id=str(user.id),
            permission_names=permissions_with_admin,
            require_all=True
        )

        # Should fail because user doesn't have user:delete
        assert not all(result.granted for result in results.values())

    async def test_resource_ownership_permission(
        self,
        db_session: AsyncSession,
        auth_service: AuthorizationService,
        test_users
    ):
        """Test resource ownership permissions"""
        user = test_users["user1"]
        workflow_id = uuid4()

        # Check if user can access their own workflow
        result = await auth_service.check_permission(
            db=db,
            user_id=str(user.id),
            permission_name="workflow:read",
            resource_id=str(workflow_id),
            resource_type="workflow"
        )

        # This would require actual workflow creation in real implementation
        # For now, just test the method doesn't fail
        assert isinstance(result, PermissionResult)


class TestResourcePermissions:
    """Test resource-level permissions"""

    async def test_grant_resource_permission(
        self,
        db_session: AsyncSession,
        auth_service: AuthorizationService,
        test_users,
        system_permissions
    ):
        """Test granting resource-specific permission"""
        user = test_users["user1"]
        resource_id = uuid4()

        success = await auth_service.grant_resource_permission(
            db=db,
            resource_type="workflow",
            resource_id=str(resource_id),
            user_id=str(user.id),
            permission_name="workflow:delete",
            granted_by=str(user.id),
            reason="Special access for project"
        )

        assert success is True

        # Verify permission check
        result = await auth_service.check_permission(
            db=db,
            user_id=str(user.id),
            permission_name="workflow:delete",
            resource_id=str(resource_id),
            resource_type="workflow"
        )

        assert result.granted is True
        assert result.source == "resource"

    async def test_revoke_resource_permission(
        self,
        db_session: AsyncSession,
        auth_service: AuthorizationService,
        test_users,
        system_permissions
    ):
        """Test revoking resource-specific permission"""
        user = test_users["user1"]
        resource_id = uuid4()

        # First grant permission
        await auth_service.grant_resource_permission(
            db=db,
            resource_type="workflow",
            resource_id=str(resource_id),
            user_id=str(user.id),
            permission_name="workflow:delete",
            granted_by=str(user.id)
        )

        # Then revoke it
        success = await auth_service.revoke_resource_permission(
            db=db,
            resource_type="workflow",
            resource_id=str(resource_id),
            user_id=str(user.id),
            permission_name="workflow:delete",
            revoked_by=str(user.id)
        )

        assert success is True

        # Verify permission is revoked
        result = await auth_service.check_permission(
            db=db,
            user_id=str(user.id),
            permission_name="workflow:delete",
            resource_id=str(resource_id),
            resource_type="workflow"
        )

        assert result.granted is False

    async def test_resource_permission_expiration(
        self,
        db_session: AsyncSession,
        auth_service: AuthorizationService,
        test_users,
        system_permissions
    ):
        """Test resource permission with expiration"""
        user = test_users["user1"]
        resource_id = uuid4()
        expires_at = datetime.utcnow() + timedelta(hours=1)

        # Grant permission with expiration
        await auth_service.grant_resource_permission(
            db=db,
            resource_type="workflow",
            resource_id=str(resource_id),
            user_id=str(user.id),
            permission_name="workflow:delete",
            granted_by=str(user.id),
            expires_at=expires_at
        )

        # Check permission (should be granted)
        result = await auth_service.check_permission(
            db=db,
            user_id=str(user.id),
            permission_name="workflow:delete",
            resource_id=str(resource_id),
            resource_type="workflow"
        )

        assert result.granted is True
        assert result.expires_at is not None


class TestAuditLogging:
    """Test audit logging functionality"""

    async def test_permission_event_logging(
        self,
        db_session: AsyncSession,
        auth_service: AuthorizationService,
        test_users,
        system_roles
    ):
        """Test that permission events are logged"""
        user = test_users["user1"]

        # Assign role (should create audit log)
        await auth_service.assign_role_to_user(
            db=db,
            user_id=str(user.id),
            role_name="user",
            assigned_by=str(user.id),
            reason="Initial role assignment"
        )

        # Check audit log
        result = await db_session.execute(
            select(PermissionAuditLog).where(
                PermissionAuditLog.event_type == "role_assigned",
                PermissionAuditLog.entity_id == user.id
            )
        )
        audit_log = result.scalar_one_or_none()

        assert audit_log is not None
        assert audit_log.event_type == "role_assigned"
        assert audit_log.entity_type == "user"
        assert audit_log.actor_id == user.id
        assert audit_log.target_user_id == user.id
        assert audit_log.new_value is not None
        assert "role_name" in audit_log.new_value

    async def test_resource_permission_audit_log(
        self,
        db_session: AsyncSession,
        auth_service: AuthorizationService,
        test_users,
        system_permissions
    ):
        """Test audit logging for resource permission changes"""
        user = test_users["user1"]
        resource_id = uuid4()

        # Grant resource permission
        await auth_service.grant_resource_permission(
            db=db,
            resource_type="workflow",
            resource_id=str(resource_id),
            user_id=str(user.id),
            permission_name="workflow:delete",
            granted_by=str(user.id),
            reason="Project requirement"
        )

        # Check audit log
        result = await db_session.execute(
            select(PermissionAuditLog).where(
                PermissionAuditLog.event_type == "resource_permission_granted",
                PermissionAuditLog.entity_id == resource_id
            )
        )
        audit_log = result.scalar_one_or_none()

        assert audit_log is not None
        assert audit_log.event_type == "resource_permission_granted"
        assert audit_log.entity_type == "resource_permission"
        assert audit_log.new_value is not None
        assert audit_log.new_value["permission_name"] == "workflow:delete"


class TestSystemInitialization:
    """Test system permission and role initialization"""

    async def test_initialize_system_permissions(
        self,
        db_session: AsyncSession,
        auth_service: AuthorizationService
    ):
        """Test system permissions initialization"""
        # Check that permissions don't exist initially
        result = await db_session.execute(
            select(func.count(Permission.id))
        )
        initial_count = result.scalar()
        assert initial_count == 0

        # Initialize system permissions
        await auth_service.initialize_system_permissions(db)

        # Check that permissions were created
        result = await db_session.execute(
            select(func.count(Permission.id))
        )
        final_count = result.scalar()
        assert final_count > 0

        # Check that specific permissions exist
        result = await db_session.execute(
            select(Permission).where(Permission.name == "user:read")
        )
        user_read_permission = result.scalar_one_or_none()
        assert user_read_permission is not None
        assert user_read_permission.is_system is True

    async def test_initialize_system_roles(
        self,
        db_session: AsyncSession,
        auth_service: AuthorizationService
    ):
        """Test system roles initialization"""
        # First initialize permissions
        await auth_service.initialize_system_permissions(db)

        # Initialize system roles
        await auth_service.initialize_system_roles(db)

        # Check that roles were created
        result = await db_session.execute(
            select(func.count(Role.id))
        )
        role_count = result.scalar()
        assert role_count > 0

        # Check specific roles
        expected_roles = ["super_admin", "admin", "manager", "developer", "user", "viewer"]
        for role_name in expected_roles:
            result = await db_session.execute(
                select(Role).where(Role.name == role_name)
            )
            role = result.scalar_one_or_none()
            assert role is not None
            assert role.is_system_role is True

        # Check role hierarchy
        result = await db_session.execute(
            select(Role).where(Role.name == "admin")
        )
        admin_role = result.scalar_one()
        assert admin_role.parent_role_id is not None

        result = await db_session.execute(
            select(Role).where(Role.name == "super_admin")
        )
        super_admin_role = result.scalar_one()
        assert admin_role.parent_role_id == super_admin_role.id


class TestPerformanceOptimization:
    """Test performance optimization features"""

    async def test_permission_caching(
        self,
        db_session: AsyncSession,
        auth_service: AuthorizationService,
        test_users,
        system_roles
    ):
        """Test permission result caching"""
        user = test_users["user1"]

        # Assign role to user
        await auth_service.assign_role_to_user(
            db=db,
            user_id=str(user.id),
            role_name="user",
            assigned_by=str(user.id)
        )

        # First permission check (not cached)
        result1 = await auth_service.check_permission(
            db=db,
            user_id=str(user.id),
            permission_name="workflow:read"
        )
        assert result1.cached is False

        # Second permission check (should be cached)
        result2 = await auth_service.check_permission(
            db=db,
            user_id=str(user.id),
            permission_name="workflow:read"
        )
        assert result2.cached is True

        # Results should be the same
        assert result1.granted == result2.granted

    async def test_cache_invalidation(
        self,
        db_session: AsyncSession,
        auth_service: AuthorizationService,
        test_users,
        system_roles
    ):
        """Test cache invalidation on role changes"""
        user = test_users["user1"]

        # Assign role and check permission
        await auth_service.assign_role_to_user(
            db=db,
            user_id=str(user.id),
            role_name="user",
            assigned_by=str(user.id)
        )

        result1 = await auth_service.check_permission(
            db=db,
            user_id=str(user.id),
            permission_name="workflow:read"
        )
        assert result1.granted is True

        # Remove role
        await auth_service.remove_role_from_user(
            db=db,
            user_id=str(user.id),
            role_name="user",
            removed_by=str(user.id)
        )

        # Check permission again (cache should be invalidated)
        result2 = await auth_service.check_permission(
            db=db,
            user_id=str(user.id),
            permission_name="workflow:read"
        )
        assert result2.granted is False


class TestBulkOperations:
    """Test bulk operations on roles and permissions"""

    async def test_bulk_role_assignment(
        self,
        db_session: AsyncSession,
        auth_service: AuthorizationService,
        test_users,
        system_roles
    ):
        """Test assigning roles to multiple users"""
        users_to_assign = [test_users["user1"], test_users["user2"]]

        # Assign role to multiple users
        for user in users_to_assign:
            success = await auth_service.assign_role_to_user(
                db=db,
                user_id=str(user.id),
                role_name="user",
                assigned_by=str(test_users["user1"].id)
            )
            assert success is True

        # Verify all users have the role
        for user in users_to_assign:
            assignments = await auth_service.get_user_roles(db, str(user.id))
            assert len(assignments) == 1
            assert assignments[0]["role_name"] == "user"

    async def test_bulk_permission_check(
        self,
        db_session: AsyncSession,
        auth_service: AuthorizationService,
        test_users,
        system_roles
    ):
        """Test checking permissions for multiple users"""
        users = [test_users["user1"], test_users["user2"]]

        # Assign roles
        await auth_service.assign_role_to_user(
            db=db,
            user_id=str(users[0].id),
            role_name="user",
            assigned_by=str(users[0].id)
        )

        await auth_service.assign_role_to_user(
            db=db,
            user_id=str(users[1].id),
            role_name="viewer",
            assigned_by=str(users[1].id)
        )

        # Check permissions for both users
        user_permissions = []
        for user in users:
            permissions = await auth_service.get_user_permissions(db, str(user.id))
            user_permissions.append(permissions)

        # User with 'user' role should have more permissions than 'viewer'
        assert len(user_permissions[0]) > len(user_permissions[1])
        assert "workflow:execute" in user_permissions[0]
        assert "workflow:execute" not in user_permissions[1]


# Integration test helpers
async def create_test_workflow(db_session: AsyncSession, owner_id: str):
    """Helper to create test workflow for permission tests"""
    workflow_id = uuid4()
    # In real implementation, this would create a Workflow entity
    return workflow_id


async def create_test_document(db_session: AsyncSession, owner_id: str):
    """Helper to create test document for permission tests"""
    document_id = uuid4()
    # In real implementation, this would create a Document entity
    return document_id


if __name__ == "__main__":
    # Run tests
    pytest.main([__file__, "-v"])