"""
Role-Based Access Control (RBAC) module for Universal Dependency Platform.

This module provides enterprise-grade RBAC functionality including:
- Role and permission management
- Resource-based access control
- Permission checking with caching
- Role assignment and management
- Security auditing and logging
"""

from .exceptions import (
    InvalidAssignmentError,
    PermissionDeniedError,
    PermissionNotFoundError,
    RBACError,
    RoleNotFoundError,
)
from .permission_checker import PermissionChecker
from .rbac_service import RBACService

__all__ = [
    "RBACService",
    "PermissionChecker",
    "RBACError",
    "PermissionDeniedError",
    "RoleNotFoundError",
    "PermissionNotFoundError",
    "InvalidAssignmentError",
]
