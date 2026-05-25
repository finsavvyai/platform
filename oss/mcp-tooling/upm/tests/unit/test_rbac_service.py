"""
Unit tests for RBAC (Role-Based Access Control) Service.

This module tests the core functionality of the RBAC service including
permission checking, role management, and user assignments.
"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select, and_

from src.udp.core.models.rbac import (
    Permission,
    Role,
    UserRoleAssignment,
    ResourcePermission,
    PermissionScope,
    ResourceType,
)
from src.udp.core.models.user import User
from src.udp.core.models.base import BaseModel
from src.udp.services.rbac_service import RBACService
from src.udp.core.services import get_service_registry


@pytest.fixture
async def db_session():
    """Create test database session."""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(BaseModel.metadata.create_all)

    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    session = async_session()

    yield session

    await session.close()
    await engine.dispose()


@pytest.fixture
async def rbac_service(db_session):
    """Create RBAC service instance."""
    return RBACService(db_session)


@pytest.fixture
async def sample_user(db_session):
    """Create sample user for testing."""
    user = User(
        id="test-user-id",
        username="testuser",
        email="test@example.com",
        first_name="Test",
        last_name="User",
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
async def sample_permissions(db_session):
    """Create sample permissions for testing."""
    permissions = [
        Permission(
            id="perm-1",
            name="project:create",
            display_name="Create Projects",
            scope=PermissionScope.PROJECT_CREATE,
            resource_type=ResourceType.PROJECT,
            action="create",
            is_system=True,
        ),
        Permission(
            id="perm-2",
            name="project:read",
            display_name="Read Projects",
            scope=PermissionScope.PROJECT_READ,
            resource_type=ResourceType.PROJECT,
            action="read",
            is_system=True,
        ),
        Permission(
            id="perm-3",
            name="project:update",
            display_name="Update Projects",
            scope=PermissionScope.PROJECT_UPDATE,
            resource_type=ResourceType.PROJECT,
            action="update",
            is_system=True,
        ),
        Permission(
            id="perm-4",
            name="project:delete",
            display_name="Delete Projects",
            scope=PermissionScope.PROJECT_DELETE,
            resource_type=ResourceType.PROJECT,
            action="delete",
            is_system=True,
        ),
    ]

    for perm in permissions:
        db_session.add(perm)

    await db_session.commit()
    return permissions


@pytest.fixture
async def sample_role(db_session, sample_permissions):
    """Create sample role for testing."""
    role = Role(
        id="role-1",
        name="project_manager",
        display_name="Project Manager",
        description="Can manage projects",
        is_system=False,
        priority=10,
        permissions=sample_permissions,
    )
    db_session.add(role)
    await db_session.commit()
    await db_session.refresh(role)
    return role


class TestRBACService:
    """Test cases for RBAC Service."""

    @pytest.mark.asyncio
    async def test_check_permission_with_role_assignment(
        self, db_session, rbac_service, sample_user, sample_role, sample_permissions
    ):
        """Test permission checking with role assignment."""
        # Assign role to user
        assignment = UserRoleAssignment(user_id=sample_user.id, role_id=sample_role.id)
        db_session.add(assignment)
        await db_session.commit()

        # Test permission check
        has_permission = await rbac_service.check_permission(
            user_id=sample_user.id, permission_name="project:create"
        )

        assert has_permission is True

    @pytest.mark.asyncio
    async def test_check_permission_without_assignment(
        self, rbac_service, sample_user, sample_permissions
    ):
        """Test permission checking without role assignment."""
        has_permission = await rbac_service.check_permission(
            user_id=sample_user.id, permission_name="project:create"
        )

        assert has_permission is False

    @pytest.mark.asyncio
    async def test_check_permission_direct_resource_permission(
        self, db_session, rbac_service, sample_user, sample_permissions
    ):
        """Test permission checking with direct resource permission."""
        # Grant direct permission
        resource_perm = ResourcePermission(
            user_id=sample_user.id,
            permission_id=sample_permissions[0].id,
            resource_type=ResourceType.PROJECT,
            resource_id="project-123",
        )
        db_session.add(resource_perm)
        await db_session.commit()

        # Test permission check for specific resource
        has_permission = await rbac_service.check_permission(
            user_id=sample_user.id,
            permission_name="project:create",
            resource_type=ResourceType.PROJECT,
            resource_id="project-123",
        )

        assert has_permission is True

        # Test without resource scope (should be false)
        has_permission_global = await rbac_service.check_permission(
            user_id=sample_user.id, permission_name="project:create"
        )

        assert has_permission_global is False

    @pytest.mark.asyncio
    async def test_get_user_permissions(
        self, db_session, rbac_service, sample_user, sample_role, sample_permissions
    ):
        """Test getting user permissions."""
        # Assign role to user
        assignment = UserRoleAssignment(user_id=sample_user.id, role_id=sample_role.id)
        db_session.add(assignment)
        await db_session.commit()

        # Get user permissions
        permissions = await rbac_service.get_user_permissions(user_id=sample_user.id)

        assert len(permissions) == 4
        assert "project:create" in permissions
        assert "project:read" in permissions
        assert "project:update" in permissions
        assert "project:delete" in permissions

    @pytest.mark.asyncio
    async def test_assign_role(self, rbac_service, sample_user, sample_role):
        """Test assigning role to user."""
        assignment = await rbac_service.assign_role(
            user_id=sample_user.id, role_id=sample_role.id
        )

        assert assignment.user_id == sample_user.id
        assert assignment.role_id == sample_role.id
        assert assignment.is_active is True

    @pytest.mark.asyncio
    async def test_assign_role_with_expiration(
        self, rbac_service, sample_user, sample_role
    ):
        """Test assigning role with expiration date."""
        expires_at = datetime.utcnow() + timedelta(days=7)

        assignment = await rbac_service.assign_role(
            user_id=sample_user.id, role_id=sample_role.id, expires_at=expires_at
        )

        assert assignment.expires_at == expires_at

    @pytest.mark.asyncio
    async def test_revoke_role(
        self, db_session, rbac_service, sample_user, sample_role
    ):
        """Test revoking role from user."""
        # First assign role
        assignment = UserRoleAssignment(user_id=sample_user.id, role_id=sample_role.id)
        db_session.add(assignment)
        await db_session.commit()

        # Then revoke it
        success = await rbac_service.revoke_role(
            user_id=sample_user.id, role_id=sample_role.id
        )

        assert success is True

        # Verify role is inactive
        result = await db_session.execute(
            select(UserRoleAssignment).where(
                and_(
                    UserRoleAssignment.user_id == sample_user.id,
                    UserRoleAssignment.role_id == sample_role.id,
                )
            )
        )
        assignment = result.scalar_one()
        assert assignment.is_active is False

    @pytest.mark.asyncio
    async def test_grant_permission(
        self, db_session, rbac_service, sample_user, sample_permissions
    ):
        """Test granting direct permission to user."""
        resource_permission = await rbac_service.grant_permission(
            user_id=sample_user.id,
            permission_name="project:create",
            resource_type=ResourceType.PROJECT,
            resource_id="project-123",
        )

        assert resource_permission.user_id == sample_user.id
        assert resource_permission.resource_type == ResourceType.PROJECT
        assert resource_permission.resource_id == "project-123"
        assert resource_permission.is_active is True

    @pytest.mark.asyncio
    async def test_create_role(self, db_session, rbac_service, sample_permissions):
        """Test creating a new role."""
        role = await rbac_service.create_role(
            name="developer",
            display_name="Developer",
            description="Can read and update projects",
            permission_names=["project:read", "project:update"],
        )

        assert role.name == "developer"
        assert role.display_name == "Developer"
        assert len(role.permissions) == 2

    @pytest.mark.asyncio
    async def test_create_role_with_inheritance(
        self, db_session, rbac_service, sample_role, sample_permissions
    ):
        """Test creating a role with parent role inheritance."""
        child_role = await rbac_service.create_role(
            name="junior_developer",
            display_name="Junior Developer",
            description="Developer with limited permissions",
            parent_role_id=sample_role.id,
            permission_names=[],  # Will inherit from parent
        )

        assert child_role.parent_role_id == sample_role.id
        assert child_role.name == "junior_developer"

    @pytest.mark.asyncio
    async def test_check_permissions_multiple(
        self, db_session, rbac_service, sample_user, sample_role, sample_permissions
    ):
        """Test checking multiple permissions at once."""
        # Assign role to user
        assignment = UserRoleAssignment(user_id=sample_user.id, role_id=sample_role.id)
        db_session.add(assignment)
        await db_session.commit()

        # Check multiple permissions
        results = await rbac_service.check_permissions(
            user_id=sample_user.id,
            permission_names=["project:create", "project:delete"],
            require_all=False,
        )

        assert results["project:create"] is True
        assert results["project:delete"] is True

    @pytest.mark.asyncio
    async def test_check_permissions_require_all(
        self, db_session, rbac_service, sample_user, sample_role, sample_permissions
    ):
        """Test checking multiple permissions requiring all."""
        # Assign role to user
        assignment = UserRoleAssignment(user_id=sample_user.id, role_id=sample_role.id)
        db_session.add(assignment)
        await db_session.commit()

        # Check requiring all permissions (user has them)
        results = await rbac_service.check_permissions(
            user_id=sample_user.id,
            permission_names=["project:create", "project:read"],
            require_all=True,
        )

        assert results["project:create"] is True
        assert results["project:read"] is True

    @pytest.mark.asyncio
    async def test_expired_role_assignment(
        self, db_session, rbac_service, sample_user, sample_role
    ):
        """Test that expired role assignments are not active."""
        # Create expired assignment
        assignment = UserRoleAssignment(
            user_id=sample_user.id,
            role_id=sample_role.id,
            expires_at=datetime.utcnow() - timedelta(days=1),
            is_active=True,
        )
        db_session.add(assignment)
        await db_session.commit()

        # Check permission (should be false due to expiration)
        has_permission = await rbac_service.check_permission(
            user_id=sample_user.id, permission_name="project:create"
        )

        assert has_permission is False

    @pytest.mark.asyncio
    async def test_role_hierarchy_permissions(
        self, db_session, rbac_service, sample_user, sample_permissions
    ):
        """Test role hierarchy and inherited permissions."""
        # Create parent role with some permissions
        parent_role = Role(
            id="parent-role",
            name="parent_role",
            display_name="Parent Role",
            description="Parent role with basic permissions",
            permissions=sample_permissions[:2],  # create and read
        )
        db_session.add(parent_role)
        await db_session.commit()

        # Create child role with additional permissions
        child_role = Role(
            id="child-role",
            name="child_role",
            display_name="Child Role",
            description="Child role with inherited and additional permissions",
            parent_role_id=parent_role.id,
            permissions=sample_permissions[2:],  # update and delete
        )
        db_session.add(child_role)
        await db_session.commit()

        # Assign child role to user
        assignment = UserRoleAssignment(user_id=sample_user.id, role_id=child_role.id)
        db_session.add(assignment)
        await db_session.commit()

        # User should have all permissions (inherited + direct)
        permissions = await rbac_service.get_user_permissions(user_id=sample_user.id)

        assert len(permissions) == 4
        assert "project:create" in permissions  # inherited
        assert "project:read" in permissions  # inherited
        assert "project:update" in permissions  # direct
        assert "project:delete" in permissions  # direct


class TestPermissionChecker:
    """Test cases for PermissionChecker utility."""

    @pytest.mark.asyncio
    async def test_permission_checker_can_access(
        self, rbac_service, sample_user, sample_role, db_session, sample_permissions
    ):
        """Test PermissionChecker.can_access method."""
        # Assign role to user
        assignment = UserRoleAssignment(user_id=sample_user.id, role_id=sample_role.id)
        db_session.add(assignment)
        await db_session.commit()

        from src.udp.security.permissions import PermissionChecker

        checker = PermissionChecker(rbac_service)

        can_access = await checker.can_access(
            user_id=sample_user.id,
            permission_name="project:create",
            resource_type=ResourceType.PROJECT,
        )

        assert can_access is True

    @pytest.mark.asyncio
    async def test_permission_checker_can_read(
        self, rbac_service, sample_user, sample_role, db_session, sample_permissions
    ):
        """Test PermissionChecker.can_read method."""
        # Assign role to user
        assignment = UserRoleAssignment(user_id=sample_user.id, role_id=sample_role.id)
        db_session.add(assignment)
        await db_session.commit()

        from src.udp.security.permissions import PermissionChecker

        checker = PermissionChecker(rbac_service)

        can_read = await checker.can_read(
            user_id=sample_user.id,
            resource_type=ResourceType.PROJECT,
            resource_id="project-123",
        )

        assert can_read is True


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
