"""
Unit tests for RBAC (Role-Based Access Control) system.

This module contains comprehensive tests for the RBAC models, services,
and permission checking functionality.
"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from src.udp.core.models.rbac import (
    Permission,
    Role,
    UserRoleAssignment,
    ResourcePermission,
    PermissionScope,
    ResourceType,
    RoleTemplate,
)
from src.udp.core.models.user import User
from src.udp.core.models.organization import Organization
from src.udp.services.rbac_service import RBACService
from src.udp.security.permissions import (
    require_permission,
    require_permissions,
    require_role,
    PermissionChecker,
)
from src.udp.core.config import settings


# Test fixtures
@pytest.fixture
async def test_db():
    """Create test database session."""
    # Use SQLite in-memory database for testing
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)

    # Create all tables
    async with engine.begin() as conn:
        await conn.run_sync(BaseModel.metadata.create_all)

    # Create session
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    session = async_session()
    try:
        yield session
    finally:
        await session.close()
        await engine.dispose()


@pytest.fixture
async def test_user(test_db):
    """Create test user."""
    user = User(
        email="test@example.com",
        username="testuser",
        first_name="Test",
        last_name="User",
        is_active=True,
    )
    test_db.add(user)
    await test_db.commit()
    await test_db.refresh(user)
    return user


@pytest.fixture
async def test_organization(test_db):
    """Create test organization."""
    org = Organization(
        name="Test Organization",
        description="Test organization for RBAC tests",
        slug="test-org",
        settings={},
    )
    test_db.add(org)
    await test_db.commit()
    await test_db.refresh(org)
    return org


@pytest.fixture
async def test_permissions(test_db):
    """Create test permissions."""
    permissions = [
        Permission(
            name="organization:read",
            display_name="Read Organization",
            description="Can read organization details",
            scope=PermissionScope.ORG_READ,
            resource_type=ResourceType.ORGANIZATION,
            action="read",
        ),
        Permission(
            name="organization:manage_settings",
            display_name="Manage Organization Settings",
            description="Can manage organization settings",
            scope=PermissionScope.ORG_MANAGE_SETTINGS,
            resource_type=ResourceType.ORGANIZATION,
            action="manage_settings",
        ),
        Permission(
            name="project:create",
            display_name="Create Project",
            description="Can create projects",
            scope=PermissionScope.PROJECT_CREATE,
            resource_type=ResourceType.PROJECT,
            action="create",
        ),
        Permission(
            name="project:read",
            display_name="Read Project",
            description="Can read project details",
            scope=PermissionScope.PROJECT_READ,
            resource_type=ResourceType.PROJECT,
            action="read",
        ),
        Permission(
            name="system:admin",
            display_name="System Administrator",
            description="Full system access",
            scope=PermissionScope.SYSTEM_ADMIN,
            resource_type=ResourceType.SYSTEM,
            action="admin",
        ),
    ]

    for perm in permissions:
        test_db.add(perm)

    await test_db.commit()

    # Refresh to get IDs
    for perm in permissions:
        await test_db.refresh(perm)

    return permissions


@pytest.fixture
async def test_roles(test_db, test_permissions, test_organization):
    """Create test roles."""
    # System admin role with system permission
    system_admin_role = Role(
        name="system_admin",
        display_name="System Administrator",
        description="Full system access",
        is_system=True,
        priority=100,
    )
    system_admin_role.permissions.append(test_permissions[4])  # system:admin

    # Organization admin role
    org_admin_role = Role(
        name="org_admin",
        display_name="Organization Administrator",
        description="Organization administrator",
        organization_id=test_organization.id,
        priority=50,
    )
    org_admin_role.permissions.extend(
        [
            test_permissions[0],  # organization:read
            test_permissions[1],  # organization:manage_settings
        ]
    )

    # Project manager role
    project_manager_role = Role(
        name="project_manager",
        display_name="Project Manager",
        description="Can manage projects",
        organization_id=test_organization.id,
        priority=30,
    )
    project_manager_role.permissions.extend(
        [
            test_permissions[2],  # project:create
            test_permissions[3],  # project:read
        ]
    )

    # User role (basic permissions)
    user_role = Role(
        name="user",
        display_name="User",
        description="Basic user permissions",
        organization_id=test_organization.id,
        priority=10,
    )
    user_role.permissions.append(test_permissions[0])  # organization:read

    roles = [system_admin_role, org_admin_role, project_manager_role, user_role]

    for role in roles:
        test_db.add(role)

    await test_db.commit()

    # Refresh to get IDs
    for role in roles:
        await test_db.refresh(role)

    return roles


@pytest.fixture
async def rbac_service(test_db):
    """Create RBAC service."""
    return RBACService(test_db)


@pytest.fixture
async def permission_checker(rbac_service):
    """Create permission checker."""
    return PermissionChecker(rbac_service)


# Permission model tests
@pytest.mark.asyncio
async def test_permission_creation(test_db):
    """Test permission model creation."""
    permission = Permission(
        name="test:permission",
        display_name="Test Permission",
        description="Test permission for unit tests",
        scope=PermissionScope.PROJECT_READ,
        resource_type=ResourceType.PROJECT,
        action="read",
    )

    test_db.add(permission)
    await test_db.commit()
    await test_db.refresh(permission)

    assert permission.id is not None
    assert permission.name == "test:permission"
    assert permission.display_name == "Test Permission"
    assert permission.scope == PermissionScope.PROJECT_READ
    assert permission.resource_type == ResourceType.PROJECT
    assert permission.action == "read"
    assert permission.is_active is True
    assert permission.is_system is False
    assert permission.created_at is not None
    assert permission.updated_at is not None


# Role model tests
@pytest.mark.asyncio
async def test_role_creation(test_db, test_permissions):
    """Test role model creation."""
    role = Role(
        name="test_role",
        display_name="Test Role",
        description="Test role for unit tests",
        priority=1,
    )
    role.permissions.append(test_permissions[0])  # organization:read

    test_db.add(role)
    await test_db.commit()
    await test_db.refresh(role)

    assert role.id is not None
    assert role.name == "test_role"
    assert role.display_name == "Test Role"
    assert len(role.permissions) == 1
    assert role.permissions[0].name == "organization:read"
    assert role.is_active is True
    assert role.priority == 1


# RBAC Service tests
@pytest.mark.asyncio
async def test_create_role(rbac_service, test_permissions):
    """Test creating a new role."""
    role = await rbac_service.create_role(
        name="test_role",
        display_name="Test Role",
        description="Test role created via service",
        permission_names=["organization:read", "organization:manage_settings"],
    )

    assert role.id is not None
    assert role.name == "test_role"
    assert len(role.permissions) == 2
    assert role.permissions[0].name == "organization:read"
    assert role.permissions[1].name == "organization:manage_settings"


@pytest.mark.asyncio
async def test_create_role_with_existing_name(rbac_service, test_permissions):
    """Test creating role with existing name should fail."""
    # Create first role
    await rbac_service.create_role(
        name="duplicate_role",
        display_name="First Role",
        permission_names=["organization:read"],
    )

    # Try to create role with same name
    with pytest.raises(ValueError, match="Role already exists"):
        await rbac_service.create_role(
            name="duplicate_role",
            display_name="Second Role",
            permission_names=["organization:manage_settings"],
        )


@pytest.mark.asyncio
async def test_assign_role_to_user(rbac_service, test_user, test_roles):
    """Test assigning a role to a user."""
    assignment = await rbac_service.assign_role(
        user_id=test_user.id,
        role_id=test_roles[0].id,  # system_admin role
    )

    assert assignment.id is not None
    assert assignment.user_id == test_user.id
    assert assignment.role_id == test_roles[0].id
    assert assignment.is_active is True
    assert assignment.assigned_at is not None


@pytest.mark.asyncio
async def test_revoke_role_from_user(rbac_service, test_user, test_roles):
    """Test revoking a role from a user."""
    # First assign the role
    await rbac_service.assign_role(user_id=test_user.id, role_id=test_roles[0].id)

    # Then revoke it
    success = await rbac_service.revoke_role(
        user_id=test_user.id, role_id=test_roles[0].id
    )

    assert success is True


@pytest.mark.asyncio
async def test_revoke_nonexistent_role_assignment(rbac_service, test_user, test_roles):
    """Test revoking non-existent role assignment."""
    success = await rbac_service.revoke_role(
        user_id=test_user.id, role_id=test_roles[0].id
    )

    assert success is False


@pytest.mark.asyncio
async def test_check_permission_with_role(rbac_service, test_user, test_roles):
    """Test checking permission via role assignment."""
    # Assign org admin role
    await rbac_service.assign_role(
        user_id=test_user.id,
        role_id=test_roles[1].id,  # org_admin role
    )

    # Check for permission that role has
    has_permission = await rbac_service.check_permission(
        user_id=test_user.id, permission_name="organization:read"
    )

    assert has_permission is True

    # Check for permission that role doesn't have
    has_no_permission = await rbac_service.check_permission(
        user_id=test_user.id, permission_name="system:admin"
    )

    assert has_no_permission is False


@pytest.mark.asyncio
async def test_check_permission_with_direct_grant(rbac_service, test_user):
    """Test checking permission via direct resource permission grant."""
    # Grant direct permission
    resource_permission = await rbac_service.grant_permission(
        user_id=test_user.id,
        permission_name="organization:read",
        resource_type=ResourceType.ORGANIZATION,
        resource_id="test-org-id",
    )

    assert resource_permission.id is not None

    # Check the permission
    has_permission = await rbac_service.check_permission(
        user_id=test_user.id,
        permission_name="organization:read",
        resource_type=ResourceType.ORGANIZATION,
        resource_id="test-org-id",
    )

    assert has_permission is True


@pytest.mark.asyncio
async def test_check_multiple_permissions(rbac_service, test_user, test_roles):
    """Test checking multiple permissions at once."""
    # Assign org admin role
    await rbac_service.assign_role(
        user_id=test_user.id,
        role_id=test_roles[1].id,  # org_admin role
    )

    # Check multiple permissions
    results = await rbac_service.check_permissions(
        user_id=test_user.id,
        permission_names=[
            "organization:read",
            "organization:manage_settings",
            "system:admin",
        ],
    )

    assert results["organization:read"] is True
    assert results["organization:manage_settings"] is True
    assert results["system:admin"] is False


@pytest.mark.asyncio
async def test_get_user_permissions(rbac_service, test_user, test_roles):
    """Test getting all permissions for a user."""
    # Assign org admin role
    await rbac_service.assign_role(
        user_id=test_user.id,
        role_id=test_roles[1].id,  # org_admin role
    )

    # Get user permissions
    permissions = await rbac_service.get_user_permissions(user_id=test_user.id)

    assert "organization:read" in permissions
    assert "organization:manage_settings" in permissions
    assert "system:admin" not in permissions


@pytest.mark.asyncio
async def test_get_user_roles(rbac_service, test_user, test_roles):
    """Test getting all roles for a user."""
    # Assign multiple roles
    await rbac_service.assign_role(
        user_id=test_user.id,
        role_id=test_roles[0].id,  # system_admin role
    )
    await rbac_service.assign_role(
        user_id=test_user.id,
        role_id=test_roles[1].id,  # org_admin role
    )

    # Get user roles
    roles = await rbac_service.get_user_roles(user_id=test_user.id)

    assert len(roles) == 2
    role_names = [role.name for role in roles]
    assert "system_admin" in role_names
    assert "org_admin" in role_names


@pytest.mark.asyncio
async def test_role_permission_inheritance(
    rbac_service, test_user, test_permissions, test_organization
):
    """Test that child roles inherit permissions from parent roles."""
    # Create parent role with some permissions
    parent_role = await rbac_service.create_role(
        name="parent_role",
        display_name="Parent Role",
        description="Parent role with some permissions",
        permission_names=["organization:read"],
    )

    # Create child role inheriting from parent
    child_role = await rbac_service.create_role(
        name="child_role",
        display_name="Child Role",
        description="Child role inheriting from parent",
        parent_role_id=parent_role.id,
        permission_names=["project:read"],  # Child has its own permission too
    )

    # Assign child role to user
    await rbac_service.assign_role(user_id=test_user.id, role_id=child_role.id)

    # User should have both parent and child permissions
    has_parent_permission = await rbac_service.check_permission(
        user_id=test_user.id, permission_name="organization:read"
    )
    has_child_permission = await rbac_service.check_permission(
        user_id=test_user.id, permission_name="project:read"
    )

    assert has_parent_permission is True  # Inherited from parent
    assert has_child_permission is True  # From child itself


@pytest.mark.asyncio
async def test_resource_scoped_role_assignment(
    rbac_service, test_user, test_roles, test_organization
):
    """Test role assignments scoped to specific resources."""
    # Assign role scoped to specific organization
    await rbac_service.assign_role(
        user_id=test_user.id,
        role_id=test_roles[1].id,  # org_admin role
        resource_type=ResourceType.ORGANIZATION,
        resource_id=test_organization.id,
    )

    # Should have permission for that specific organization
    has_permission = await rbac_service.check_permission(
        user_id=test_user.id,
        permission_name="organization:read",
        resource_type=ResourceType.ORGANIZATION,
        resource_id=test_organization.id,
    )
    assert has_permission is True

    # Should not have permission for different organization
    has_no_permission = await rbac_service.check_permission(
        user_id=test_user.id,
        permission_name="organization:read",
        resource_type=ResourceType.ORGANIZATION,
        resource_id="different-org-id",
    )
    assert has_no_permission is False


@pytest.mark.asyncio
async def test_expiring_role_assignment(rbac_service, test_user, test_roles):
    """Test role assignments that expire."""
    # Create assignment that expires in the future
    future_expiry = datetime.utcnow() + timedelta(days=1)
    assignment = await rbac_service.assign_role(
        user_id=test_user.id,
        role_id=test_roles[1].id,  # org_admin role
        expires_at=future_expiry,
    )

    # Should have permission now
    has_permission_now = await rbac_service.check_permission(
        user_id=test_user.id, permission_name="organization:read"
    )
    assert has_permission_now is True

    # Mock expired datetime
    with patch("src.udp.services.rbac_service.datetime") as mock_datetime:
        mock_datetime.utcnow.return_value = datetime.utcnow() + timedelta(days=2)

        # Should not have permission after expiration
        has_permission_expired = await rbac_service.check_permission(
            user_id=test_user.id, permission_name="organization:read"
        )
        assert has_permission_expired is False


# Permission Checker tests
@pytest.mark.asyncio
async def test_permission_checker_can_access(
    permission_checker, test_user, test_roles, rbac_service
):
    """Test PermissionChecker can_access method."""
    # Assign role
    await rbac_service.assign_role(
        user_id=test_user.id,
        role_id=test_roles[1].id,  # org_admin role
    )

    # Test can_access
    can_read = await permission_checker.can_access(
        user_id=test_user.id,
        permission_name="organization:read",
        resource_type=ResourceType.ORGANIZATION,
    )
    can_admin = await permission_checker.can_access(
        user_id=test_user.id, permission_name="system:admin"
    )

    assert can_read is True
    assert can_admin is False


@pytest.mark.asyncio
async def test_permission_checker_convenience_methods(
    permission_checker, test_user, test_roles, rbac_service
):
    """Test PermissionChecker convenience methods."""
    # Assign role
    await rbac_service.assign_role(
        user_id=test_user.id,
        role_id=test_roles[1].id,  # org_admin role
    )

    # Test convenience methods
    can_read = await permission_checker.can_read(
        user_id=test_user.id, resource_type=ResourceType.ORGANIZATION
    )
    can_write = await permission_checker.can_write(
        user_id=test_user.id, resource_type=ResourceType.ORGANIZATION
    )
    can_delete = await permission_checker.can_delete(
        user_id=test_user.id, resource_type=ResourceType.ORGANIZATION
    )
    can_create = await permission_checker.can_create(
        user_id=test_user.id, resource_type=ResourceType.PROJECT
    )

    assert can_read is True  # Has organization:read
    assert can_write is True  # Has organization:manage_settings (considered write)
    assert can_delete is False  # No organization:delete
    assert can_create is False  # No project:create


# Permission Decorator tests (mock-based due to FastAPI context)
@pytest.mark.asyncio
async def test_require_permission_decorator():
    """Test require_permission decorator."""
    from fastapi import HTTPException
    from unittest.mock import Mock

    # Mock RBAC service
    mock_rbac_service = Mock()
    mock_rbac_service.check_permission = AsyncMock(return_value=True)

    # Mock request
    mock_request = Mock()
    mock_request.app.state.services = {"rbac": mock_rbac_service}
    mock_request.path_params = {}
    mock_request.query_params = {}

    # Mock user
    mock_user = Mock()
    mock_user.id = "test-user-id"

    # Create a test function with the decorator
    @require_permission("test:permission")
    async def test_function(request, current_user):
        return "success"

    # Patch get_current_user to return our mock user
    with patch("src.udp.security.permissions.get_current_user", return_value=mock_user):
        result = await test_function(request=mock_request)
        assert result == "success"

        # Verify the permission was checked
        mock_rbac_service.check_permission.assert_called_once_with(
            user_id="test-user-id",
            permission_name="test:permission",
            resource_type=None,
            resource_id=None,
            organization_id=None,
        )


@pytest.mark.asyncio
async def test_require_permission_decorator_denied():
    """Test require_permission decorator when permission is denied."""
    from fastapi import HTTPException
    from unittest.mock import Mock

    # Mock RBAC service that denies permission
    mock_rbac_service = Mock()
    mock_rbac_service.check_permission = AsyncMock(return_value=False)

    # Mock request
    mock_request = Mock()
    mock_request.app.state.services = {"rbac": mock_rbac_service}
    mock_request.path_params = {}
    mock_request.query_params = {}

    # Mock user
    mock_user = Mock()
    mock_user.id = "test-user-id"

    # Create a test function with the decorator
    @require_permission("test:permission")
    async def test_function(request, current_user):
        return "success"

    # Patch get_current_user to return our mock user
    with patch("src.udp.security.permissions.get_current_user", return_value=mock_user):
        with pytest.raises(HTTPException) as exc_info:
            await test_function(request=mock_request)

        assert exc_info.value.status_code == 403
        assert "Permission required" in str(exc_info.value.detail)


# Performance tests
@pytest.mark.asyncio
async def test_permission_caching(rbac_service, test_user, test_roles):
    """Test that permission caching works correctly."""
    # Assign role
    await rbac_service.assign_role(
        user_id=test_user.id,
        role_id=test_roles[1].id,  # org_admin role
    )

    # First check - should hit database
    has_permission_1 = await rbac_service.check_permission(
        user_id=test_user.id, permission_name="organization:read"
    )

    # Second check - should use cache
    has_permission_2 = await rbac_service.check_permission(
        user_id=test_user.id, permission_name="organization:read"
    )

    assert has_permission_1 is True
    assert has_permission_2 is True

    # Verify cache was populated
    cache_key = f"{test_user.id}:::"
    assert cache_key in rbac_service._permission_cache
    assert "organization:read" in rbac_service._permission_cache[cache_key]


@pytest.mark.asyncio
async def test_cache_clearing_on_role_change(rbac_service, test_user, test_roles):
    """Test that cache is cleared when roles change."""
    # Assign role
    await rbac_service.assign_role(
        user_id=test_user.id,
        role_id=test_roles[1].id,  # org_admin role
    )

    # Check permission to populate cache
    await rbac_service.check_permission(
        user_id=test_user.id, permission_name="organization:read"
    )

    # Verify cache is populated
    cache_key = f"{test_user.id}:::"
    assert cache_key in rbac_service._permission_cache

    # Revoke role
    await rbac_service.revoke_role(user_id=test_user.id, role_id=test_roles[1].id)

    # Verify cache was cleared
    assert cache_key not in rbac_service._permission_cache


# Error handling tests
@pytest.mark.asyncio
async def test_permission_check_with_invalid_permission_name(rbac_service, test_user):
    """Test checking permission with invalid permission name."""
    has_permission = await rbac_service.check_permission(
        user_id=test_user.id, permission_name="invalid:permission"
    )

    assert has_permission is False


@pytest.mark.asyncio
async def test_grant_permission_with_nonexistent_permission(rbac_service, test_user):
    """Test granting permission that doesn't exist."""
    with pytest.raises(ValueError, match="Permission not found"):
        await rbac_service.grant_permission(
            user_id=test_user.id,
            permission_name="invalid:permission",
            resource_type=ResourceType.ORGANIZATION,
            resource_id="test-org-id",
        )
