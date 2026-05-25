"""
Access Control Management System.

Provides enterprise-grade access control, role-based permissions,
and authorization mechanisms for the Universal Dependency Platform.
"""

import logging
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Any, Optional
from uuid import UUID

logger = logging.getLogger(__name__)


class PermissionType(str, Enum):
    """Types of permissions."""
    READ = "read"
    WRITE = "write"
    DELETE = "delete"
    EXECUTE = "execute"
    ADMIN = "admin"
    APPROVE = "approve"
    AUDIT = "audit"


class ResourceType(str, Enum):
    """Types of resources that can be protected."""
    ORGANIZATION = "organization"
    WORKFLOW = "workflow"
    DEPENDENCY = "dependency"
    POLICY = "policy"
    USER = "user"
    AUDIT_LOG = "audit_log"
    COMPLIANCE_REPORT = "compliance_report"
    SECURITY_POLICY = "security_policy"
    API_ENDPOINT = "api_endpoint"


class RoleType(str, Enum):
    """Types of roles."""
    SUPER_ADMIN = "super_admin"
    ORG_ADMIN = "org_admin"
    SECURITY_ADMIN = "security_admin"
    COMPLIANCE_OFFICER = "compliance_officer"
    DEVELOPER = "developer"
    AUDITOR = "auditor"
    VIEWER = "viewer"
    CUSTOM = "custom"


@dataclass
class Permission:
    """Individual permission definition."""
    id: str
    name: str
    description: str
    resource_type: ResourceType
    permission_type: PermissionType
    conditions: Optional[dict[str, Any]] = None


@dataclass
class Role:
    """Role definition with permissions."""
    id: str
    name: str
    description: str
    role_type: RoleType
    permissions: list[Permission]
    organization_id: Optional[UUID] = None
    created_at: datetime = None
    updated_at: datetime = None


@dataclass
class AccessControlEntry:
    """Access control entry for a user-resource combination."""
    user_id: str
    resource_type: ResourceType
    resource_id: str
    permissions: list[PermissionType]
    granted_by: str
    granted_at: datetime
    expires_at: Optional[datetime] = None
    conditions: Optional[dict[str, Any]] = None


@dataclass
class AccessDecision:
    """Result of an access control decision."""
    allowed: bool
    reason: str
    required_permissions: list[PermissionType]
    granted_permissions: list[PermissionType]
    missing_permissions: list[PermissionType]
    conditions_met: bool
    expires_at: Optional[datetime] = None


class AccessControlManager:
    """Enterprise access control management system."""

    def __init__(self):
        self.roles: dict[str, Role] = {}
        self.permissions: dict[str, Permission] = {}
        self.access_entries: list[AccessControlEntry] = []
        self.user_roles: dict[str, list[str]] = {}  # user_id -> role_ids
        self._load_default_permissions()
        self._load_default_roles()

    def create_permission(
        self,
        permission: Permission
    ) -> bool:
        """
        Create a new permission.

        Args:
            permission: Permission definition

        Returns:
            True if permission was created successfully
        """
        try:
            logger.info(f"Creating permission: {permission.name}")

            # Validate permission
            if not self._validate_permission(permission):
                logger.error(f"Invalid permission: {permission.name}")
                return False

            # Store permission
            self.permissions[permission.id] = permission

            logger.info(f"Successfully created permission: {permission.name}")
            return True

        except Exception as e:
            logger.error(f"Failed to create permission: {e}", exc_info=True)
            return False

    def create_role(
        self,
        role: Role,
        organization_id: Optional[UUID] = None
    ) -> bool:
        """
        Create a new role.

        Args:
            role: Role definition
            organization_id: Organization context (optional)

        Returns:
            True if role was created successfully
        """
        try:
            logger.info(f"Creating role: {role.name}")

            # Validate role
            if not self._validate_role(role):
                logger.error(f"Invalid role: {role.name}")
                return False

            # Set timestamps
            now = datetime.utcnow()
            role.created_at = now
            role.updated_at = now
            role.organization_id = organization_id

            # Store role
            self.roles[role.id] = role

            logger.info(f"Successfully created role: {role.name}")
            return True

        except Exception as e:
            logger.error(f"Failed to create role: {e}", exc_info=True)
            return False

    def assign_role_to_user(
        self,
        user_id: str,
        role_id: str,
        organization_id: Optional[UUID] = None
    ) -> bool:
        """
        Assign a role to a user.

        Args:
            user_id: ID of the user
            role_id: ID of the role to assign
            organization_id: Organization context (optional)

        Returns:
            True if role was assigned successfully
        """
        try:
            logger.info(f"Assigning role {role_id} to user {user_id}")

            # Check if role exists
            if role_id not in self.roles:
                logger.error(f"Role not found: {role_id}")
                return False

            role = self.roles[role_id]

            # Check organization context if role is organization-specific
            if role.organization_id and role.organization_id != organization_id:
                logger.error(f"Role {role_id} is not available for organization {organization_id}")
                return False

            # Assign role
            if user_id not in self.user_roles:
                self.user_roles[user_id] = []

            if role_id not in self.user_roles[user_id]:
                self.user_roles[user_id].append(role_id)

            logger.info(f"Successfully assigned role {role_id} to user {user_id}")
            return True

        except Exception as e:
            logger.error(f"Failed to assign role: {e}", exc_info=True)
            return False

    def revoke_role_from_user(
        self,
        user_id: str,
        role_id: str
    ) -> bool:
        """
        Revoke a role from a user.

        Args:
            user_id: ID of the user
            role_id: ID of the role to revoke

        Returns:
            True if role was revoked successfully
        """
        try:
            logger.info(f"Revoking role {role_id} from user {user_id}")

            if user_id in self.user_roles and role_id in self.user_roles[user_id]:
                self.user_roles[user_id].remove(role_id)
                logger.info(f"Successfully revoked role {role_id} from user {user_id}")
                return True
            else:
                logger.warning(f"User {user_id} does not have role {role_id}")
                return False

        except Exception as e:
            logger.error(f"Failed to revoke role: {e}", exc_info=True)
            return False

    def grant_access(
        self,
        user_id: str,
        resource_type: ResourceType,
        resource_id: str,
        permissions: list[PermissionType],
        granted_by: str,
        expires_at: Optional[datetime] = None,
        conditions: Optional[dict[str, Any]] = None
    ) -> bool:
        """
        Grant direct access to a resource.

        Args:
            user_id: ID of the user
            resource_type: Type of resource
            resource_id: ID of the resource
            permissions: List of permissions to grant
            granted_by: ID of the user granting access
            expires_at: Optional expiration time
            conditions: Optional access conditions

        Returns:
            True if access was granted successfully
        """
        try:
            logger.info(f"Granting access to {resource_type.value}:{resource_id} for user {user_id}")

            # Create access control entry
            entry = AccessControlEntry(
                user_id=user_id,
                resource_type=resource_type,
                resource_id=resource_id,
                permissions=permissions,
                granted_by=granted_by,
                granted_at=datetime.utcnow(),
                expires_at=expires_at,
                conditions=conditions
            )

            # Store entry
            self.access_entries.append(entry)

            logger.info(f"Successfully granted access to {resource_type.value}:{resource_id} for user {user_id}")
            return True

        except Exception as e:
            logger.error(f"Failed to grant access: {e}", exc_info=True)
            return False

    def revoke_access(
        self,
        user_id: str,
        resource_type: ResourceType,
        resource_id: str
    ) -> bool:
        """
        Revoke direct access to a resource.

        Args:
            user_id: ID of the user
            resource_type: Type of resource
            resource_id: ID of the resource

        Returns:
            True if access was revoked successfully
        """
        try:
            logger.info(f"Revoking access to {resource_type.value}:{resource_id} for user {user_id}")

            # Remove matching entries
            original_count = len(self.access_entries)
            self.access_entries = [
                entry for entry in self.access_entries
                if not (entry.user_id == user_id and
                       entry.resource_type == resource_type and
                       entry.resource_id == resource_id)
            ]

            removed_count = original_count - len(self.access_entries)
            logger.info(f"Successfully revoked {removed_count} access entries for user {user_id}")
            return removed_count > 0

        except Exception as e:
            logger.error(f"Failed to revoke access: {e}", exc_info=True)
            return False

    def check_access(
        self,
        user_id: str,
        resource_type: ResourceType,
        resource_id: str,
        required_permission: PermissionType,
        context: Optional[dict[str, Any]] = None
    ) -> AccessDecision:
        """
        Check if a user has access to a resource.

        Args:
            user_id: ID of the user
            resource_type: Type of resource
            resource_id: ID of the resource
            required_permission: Permission required
            context: Optional context for conditional access

        Returns:
            Access decision with details
        """
        try:
            logger.debug(f"Checking access for user {user_id} to {resource_type.value}:{resource_id}")

            # Get user's roles
            user_role_ids = self.user_roles.get(user_id, [])
            user_roles = [self.roles[role_id] for role_id in user_role_ids if role_id in self.roles]

            # Get direct access entries
            direct_entries = [
                entry for entry in self.access_entries
                if (entry.user_id == user_id and
                    entry.resource_type == resource_type and
                    entry.resource_id == resource_id and
                    (not entry.expires_at or entry.expires_at > datetime.utcnow()))
            ]

            # Collect all permissions
            granted_permissions = set()

            # Add permissions from roles
            for role in user_roles:
                for permission in role.permissions:
                    if (permission.resource_type == resource_type and
                        permission.permission_type == required_permission):
                        granted_permissions.add(permission.permission_type)

            # Add direct permissions
            for entry in direct_entries:
                if required_permission in entry.permissions:
                    granted_permissions.add(required_permission)

            # Check if access is allowed
            allowed = required_permission in granted_permissions

            # Check conditions if any
            conditions_met = True
            if direct_entries:
                for entry in direct_entries:
                    if entry.conditions and not self._evaluate_conditions(entry.conditions, context):
                        conditions_met = False
                        break

            # Determine reason
            if allowed and conditions_met:
                reason = "Access granted"
            elif not allowed:
                reason = f"User lacks required permission: {required_permission.value}"
            else:
                reason = "Access conditions not met"

            # Get expiration time
            expires_at = None
            if direct_entries:
                expires_at = min(entry.expires_at for entry in direct_entries if entry.expires_at)

            decision = AccessDecision(
                allowed=allowed and conditions_met,
                reason=reason,
                required_permissions=[required_permission],
                granted_permissions=list(granted_permissions),
                missing_permissions=[required_permission] if not allowed else [],
                conditions_met=conditions_met,
                expires_at=expires_at
            )

            logger.debug(f"Access decision for user {user_id}: {decision.allowed} - {decision.reason}")
            return decision

        except Exception as e:
            logger.error(f"Failed to check access: {e}", exc_info=True)
            return AccessDecision(
                allowed=False,
                reason=f"Access check failed: {str(e)}",
                required_permissions=[required_permission],
                granted_permissions=[],
                missing_permissions=[required_permission],
                conditions_met=False
            )

    def get_user_permissions(
        self,
        user_id: str,
        resource_type: Optional[ResourceType] = None
    ) -> list[Permission]:
        """Get all permissions for a user."""
        try:
            permissions = []

            # Get permissions from roles
            user_role_ids = self.user_roles.get(user_id, [])
            for role_id in user_role_ids:
                if role_id in self.roles:
                    role = self.roles[role_id]
                    for permission in role.permissions:
                        if not resource_type or permission.resource_type == resource_type:
                            permissions.append(permission)

            # Get direct permissions
            direct_entries = [
                entry for entry in self.access_entries
                if (entry.user_id == user_id and
                    (not resource_type or entry.resource_type == resource_type) and
                    (not entry.expires_at or entry.expires_at > datetime.utcnow()))
            ]

            for entry in direct_entries:
                for perm_type in entry.permissions:
                    # Create permission object for direct access
                    permission = Permission(
                        id=f"direct_{entry.resource_type.value}_{entry.resource_id}_{perm_type.value}",
                        name=f"Direct {perm_type.value} access to {entry.resource_type.value}",
                        description=f"Direct {perm_type.value} permission for {entry.resource_type.value}:{entry.resource_id}",
                        resource_type=entry.resource_type,
                        permission_type=perm_type,
                        conditions=entry.conditions
                    )
                    permissions.append(permission)

            return permissions

        except Exception as e:
            logger.error(f"Failed to get user permissions: {e}", exc_info=True)
            return []

    def get_user_roles(self, user_id: str) -> list[Role]:
        """Get all roles for a user."""
        try:
            user_role_ids = self.user_roles.get(user_id, [])
            return [self.roles[role_id] for role_id in user_role_ids if role_id in self.roles]
        except Exception as e:
            logger.error(f"Failed to get user roles: {e}", exc_info=True)
            return []

    def list_roles(
        self,
        organization_id: Optional[UUID] = None,
        role_type: Optional[RoleType] = None
    ) -> list[Role]:
        """List roles with optional filtering."""
        try:
            roles = []
            for role in self.roles.values():
                if organization_id and role.organization_id != organization_id:
                    continue
                if role_type and role.role_type != role_type:
                    continue
                roles.append(role)
            return roles
        except Exception as e:
            logger.error(f"Failed to list roles: {e}", exc_info=True)
            return []

    def _validate_permission(self, permission: Permission) -> bool:
        """Validate a permission definition."""
        try:
            # Check required fields
            if not permission.id or not permission.name or not permission.description:
                return False

            # Check resource type
            if permission.resource_type not in ResourceType:
                return False

            # Check permission type
            if permission.permission_type not in PermissionType:
                return False

            return True

        except Exception as e:
            logger.error(f"Permission validation failed: {e}")
            return False

    def _validate_role(self, role: Role) -> bool:
        """Validate a role definition."""
        try:
            # Check required fields
            if not role.id or not role.name or not role.description:
                return False

            # Check role type
            if role.role_type not in RoleType:
                return False

            # Check permissions
            for permission in role.permissions:
                if not self._validate_permission(permission):
                    return False

            return True

        except Exception as e:
            logger.error(f"Role validation failed: {e}")
            return False

    def _evaluate_conditions(
        self,
        conditions: dict[str, Any],
        context: Optional[dict[str, Any]]
    ) -> bool:
        """Evaluate access conditions."""
        try:
            if not context:
                return True

            # Simple condition evaluation
            for key, expected_value in conditions.items():
                actual_value = context.get(key)
                if actual_value != expected_value:
                    return False

            return True

        except Exception as e:
            logger.error(f"Failed to evaluate conditions: {e}")
            return False

    def _load_default_permissions(self):
        """Load default permissions."""
        default_permissions = [
            Permission(
                id="read_organization",
                name="Read Organization",
                description="Read organization information",
                resource_type=ResourceType.ORGANIZATION,
                permission_type=PermissionType.READ
            ),
            Permission(
                id="write_organization",
                name="Write Organization",
                description="Modify organization settings",
                resource_type=ResourceType.ORGANIZATION,
                permission_type=PermissionType.WRITE
            ),
            Permission(
                id="admin_organization",
                name="Admin Organization",
                description="Full administrative access to organization",
                resource_type=ResourceType.ORGANIZATION,
                permission_type=PermissionType.ADMIN
            ),
            Permission(
                id="read_workflow",
                name="Read Workflow",
                description="View workflow information",
                resource_type=ResourceType.WORKFLOW,
                permission_type=PermissionType.READ
            ),
            Permission(
                id="write_workflow",
                name="Write Workflow",
                description="Create and modify workflows",
                resource_type=ResourceType.WORKFLOW,
                permission_type=PermissionType.WRITE
            ),
            Permission(
                id="execute_workflow",
                name="Execute Workflow",
                description="Execute workflows",
                resource_type=ResourceType.WORKFLOW,
                permission_type=PermissionType.EXECUTE
            ),
            Permission(
                id="read_audit_log",
                name="Read Audit Log",
                description="View audit logs",
                resource_type=ResourceType.AUDIT_LOG,
                permission_type=PermissionType.READ
            ),
            Permission(
                id="audit_audit_log",
                name="Audit Audit Log",
                description="Full audit log access",
                resource_type=ResourceType.AUDIT_LOG,
                permission_type=PermissionType.AUDIT
            )
        ]

        for permission in default_permissions:
            self.permissions[permission.id] = permission

    def _load_default_roles(self):
        """Load default roles."""
        default_roles = [
            Role(
                id="super_admin",
                name="Super Administrator",
                description="Full system access",
                role_type=RoleType.SUPER_ADMIN,
                permissions=list(self.permissions.values())
            ),
            Role(
                id="org_admin",
                name="Organization Administrator",
                description="Full organization access",
                role_type=RoleType.ORG_ADMIN,
                permissions=[
                    self.permissions["read_organization"],
                    self.permissions["write_organization"],
                    self.permissions["admin_organization"],
                    self.permissions["read_workflow"],
                    self.permissions["write_workflow"],
                    self.permissions["execute_workflow"]
                ]
            ),
            Role(
                id="developer",
                name="Developer",
                description="Developer access to workflows and dependencies",
                role_type=RoleType.DEVELOPER,
                permissions=[
                    self.permissions["read_organization"],
                    self.permissions["read_workflow"],
                    self.permissions["write_workflow"],
                    self.permissions["execute_workflow"]
                ]
            ),
            Role(
                id="auditor",
                name="Auditor",
                description="Audit and compliance access",
                role_type=RoleType.AUDITOR,
                permissions=[
                    self.permissions["read_organization"],
                    self.permissions["read_workflow"],
                    self.permissions["read_audit_log"],
                    self.permissions["audit_audit_log"]
                ]
            ),
            Role(
                id="viewer",
                name="Viewer",
                description="Read-only access",
                role_type=RoleType.VIEWER,
                permissions=[
                    self.permissions["read_organization"],
                    self.permissions["read_workflow"]
                ]
            )
        ]

        for role in default_roles:
            self.roles[role.id] = role
