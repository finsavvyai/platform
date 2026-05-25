"""
Permission system for Universal Dependency Platform.
"""

from enum import Enum

from fastapi import HTTPException, status


class Permission(str, Enum):
    """Permission enumeration."""

    # User permissions
    READ_OWN_PROFILE = "read_own_profile"
    UPDATE_OWN_PROFILE = "update_own_profile"

    # Dependency permissions
    READ_DEPENDENCIES = "read_dependencies"
    CREATE_DEPENDENCIES = "create_dependencies"
    UPDATE_DEPENDENCIES = "update_dependencies"
    DELETE_DEPENDENCIES = "delete_dependencies"
    ANALYZE_DEPENDENCIES = "analyze_dependencies"

    # Workflow permissions
    READ_WORKFLOWS = "read_workflows"
    CREATE_WORKFLOWS = "create_workflows"
    UPDATE_WORKFLOWS = "update_workflows"
    DELETE_WORKFLOWS = "delete_workflows"
    EXECUTE_WORKFLOWS = "execute_workflows"

    # Admin permissions
    READ_ALL_USERS = "read_all_users"
    UPDATE_ALL_USERS = "update_all_users"
    DELETE_USERS = "delete_users"
    MANAGE_SYSTEM = "manage_system"
    VIEW_ANALYTICS = "view_analytics"


class Role(str, Enum):
    """Role enumeration."""

    USER = "user"
    ADMIN = "admin"
    SUPER_ADMIN = "super_admin"


# Role permissions mapping
ROLE_PERMISSIONS: dict[Role, set[Permission]] = {
    Role.USER: {
        Permission.READ_OWN_PROFILE,
        Permission.UPDATE_OWN_PROFILE,
        Permission.READ_DEPENDENCIES,
        Permission.CREATE_DEPENDENCIES,
        Permission.UPDATE_DEPENDENCIES,
        Permission.DELETE_DEPENDENCIES,
        Permission.ANALYZE_DEPENDENCIES,
        Permission.READ_WORKFLOWS,
        Permission.CREATE_WORKFLOWS,
        Permission.UPDATE_WORKFLOWS,
        Permission.DELETE_WORKFLOWS,
        Permission.EXECUTE_WORKFLOWS,
    },
    Role.ADMIN: {
        Permission.READ_OWN_PROFILE,
        Permission.UPDATE_OWN_PROFILE,
        Permission.READ_DEPENDENCIES,
        Permission.CREATE_DEPENDENCIES,
        Permission.UPDATE_DEPENDENCIES,
        Permission.DELETE_DEPENDENCIES,
        Permission.ANALYZE_DEPENDENCIES,
        Permission.READ_WORKFLOWS,
        Permission.CREATE_WORKFLOWS,
        Permission.UPDATE_WORKFLOWS,
        Permission.DELETE_WORKFLOWS,
        Permission.EXECUTE_WORKFLOWS,
        Permission.READ_ALL_USERS,
        Permission.VIEW_ANALYTICS,
    },
    Role.SUPER_ADMIN: set(Permission),  # All permissions
}


class PermissionChecker:
    """Permission checker utility."""

    def __init__(self, required_permissions: list[Permission]):
        """Initialize with required permissions."""
        self.required_permissions = required_permissions

    def __call__(self, user_permissions: set[Permission]) -> bool:
        """Check if user has required permissions."""
        return all(perm in user_permissions for perm in self.required_permissions)


def require_permissions(permissions: list[Permission]):
    """Decorator to require specific permissions."""

    def decorator(func):
        async def wrapper(*args, **kwargs):
            # Get current user from kwargs or args
            current_user = None
            for key, value in kwargs.items():
                if key == "current_user":
                    current_user = value
                    break

            if not current_user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Authentication required",
                )

            user_permissions = get_user_permissions(current_user)
            checker = PermissionChecker(permissions)

            if not checker(user_permissions):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Insufficient permissions",
                )

            return await func(*args, **kwargs)

        return wrapper

    return decorator


def get_user_permissions(user) -> set[Permission]:
    """Get permissions for a user based on their role."""
    role = Role(user.role) if hasattr(user, "role") else Role.USER
    return ROLE_PERMISSIONS.get(role, set())


def has_permission(user, permission: Permission) -> bool:
    """Check if user has a specific permission."""
    user_permissions = get_user_permissions(user)
    return permission in user_permissions


def has_any_permission(user, permissions: list[Permission]) -> bool:
    """Check if user has any of the specified permissions."""
    user_permissions = get_user_permissions(user)
    return any(perm in user_permissions for perm in permissions)


def has_all_permissions(user, permissions: list[Permission]) -> bool:
    """Check if user has all of the specified permissions."""
    user_permissions = get_user_permissions(user)
    return all(perm in user_permissions for perm in permissions)


class ResourceOwner:
    """Resource ownership checker."""

    @staticmethod
    def is_owner(user, resource) -> bool:
        """Check if user owns the resource."""
        if hasattr(user, "id") and hasattr(resource, "created_by"):
            return str(user.id) == str(resource.created_by)
        return False

    @staticmethod
    def can_access(user, resource, required_permission: Permission) -> bool:
        """Check if user can access resource based on ownership and permissions."""
        # Super admins can access everything
        if has_permission(user, Permission.MANAGE_SYSTEM):
            return True

        # Check if user is the owner
        if ResourceOwner.is_owner(user, resource):
            return True

        # Otherwise, check specific permissions
        return has_permission(user, required_permission)
