"""
RBAC-related exceptions for Universal Dependency Platform.
"""


class RBACError(Exception):
    """Base exception for RBAC-related errors."""

    pass


class PermissionDeniedError(RBACError):
    """Raised when a user doesn't have the required permission."""

    def __init__(
        self,
        message: str,
        user_id: str = None,
        permission: str = None,
        resource_type: str = None,
        resource_id: str = None,
    ):
        self.user_id = user_id
        self.permission = permission
        self.resource_type = resource_type
        self.resource_id = resource_id
        super().__init__(message)


class RoleNotFoundError(RBACError):
    """Raised when a requested role is not found."""

    def __init__(self, role_id: str = None, role_code: str = None):
        self.role_id = role_id
        self.role_code = role_code
        message = "Role not found"
        if role_id:
            message += f" with ID: {role_id}"
        elif role_code:
            message += f" with code: {role_code}"
        super().__init__(message)


class PermissionNotFoundError(RBACError):
    """Raised when a requested permission is not found."""

    def __init__(self, permission_id: str = None, permission_code: str = None):
        self.permission_id = permission_id
        self.permission_code = permission_code
        message = "Permission not found"
        if permission_id:
            message += f" with ID: {permission_id}"
        elif permission_code:
            message += f" with code: {permission_code}"
        super().__init__(message)


class InvalidAssignmentError(RBACError):
    """Raised when a role assignment is invalid."""

    def __init__(self, message: str, user_id: str = None, role_id: str = None):
        self.user_id = user_id
        self.role_id = role_id
        super().__init__(message)


class InvalidResourceError(RBACError):
    """Raised when a resource reference is invalid."""

    def __init__(self, resource_type: str, resource_id: str):
        self.resource_type = resource_type
        self.resource_id = resource_id
        super().__init__(f"Invalid resource: {resource_type}:{resource_id}")


class RoleAssignmentExpiredError(RBACError):
    """Raised when attempting to use an expired role assignment."""

    def __init__(self, assignment_id: str, expires_at: str):
        self.assignment_id = assignment_id
        self.expires_at = expires_at
        super().__init__(f"Role assignment {assignment_id} expired at {expires_at}")


class InsufficientPrivilegeError(RBACError):
    """Raised when a user doesn't have sufficient privilege for an operation."""

    def __init__(self, required_level: int, current_level: int):
        self.required_level = required_level
        self.current_level = current_level
        super().__init__(
            f"Insufficient privilege. Required level: {required_level}, "
            f"Current level: {current_level}"
        )
