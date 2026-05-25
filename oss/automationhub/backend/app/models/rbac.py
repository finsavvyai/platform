"""
Comprehensive Role-Based Access Control (RBAC) Database Models

This module implements enterprise-grade RBAC with support for:
- Hierarchical role structure with inheritance
- Granular permission system with resource-based access
- Time-based and condition-based permissions
- Role assignment with expiration and audit trails
- Permission overrides and conflict resolution
- Resource ownership considerations
- Advanced caching and performance optimization

Author: Claude Code Implementation
Task: 1.1.3 Role-Based Access Control
Updated: 2025-01-06
"""

from sqlalchemy import Column, String, Boolean, DateTime, Integer, ForeignKey, Text, Index, CheckConstraint, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy import JSON, and_, or_
from app.core.database import JSONType
from sqlalchemy.orm import relationship, joinedload, selectinload
from sqlalchemy.sql import func
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.ext.hybrid import hybrid_property
import uuid
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Set
from enum import Enum
import logging

from app.core.database import Base

logger = logging.getLogger(__name__)

# Check if roles table already exists to avoid duplicate definition
if "roles" in Base.metadata.tables:
    # Table already exists, remove it to allow redefinition
    Base.metadata.remove(Base.metadata.tables["roles"])


class PermissionScope(str, Enum):
    """Permission scope levels"""
    SYSTEM = "system"
    ORGANIZATION = "organization"
    TEAM = "team"
    RESOURCE = "resource"
    SELF = "self"


class PermissionAction(str, Enum):
    """Permission action types"""
    CREATE = "create"
    READ = "read"
    UPDATE = "update"
    DELETE = "delete"
    EXECUTE = "execute"
    MANAGE = "manage"
    APPROVE = "approve"
    EXPORT = "export"
    IMPORT = "import"
    SHARE = "share"


class ResourceType(str, Enum):
    """Resource types for permissions"""
    USER = "user"
    ROLE = "role"
    WORKFLOW = "workflow"
    DOCUMENT = "document"
    AGENT = "agent"
    TASK = "task"
    ORGANIZATION = "organization"
    TEAM = "team"
    SYSTEM = "system"
    INFRASTRUCTURE = "infrastructure"
    API_KEY = "api_key"
    AUDIT_LOG = "audit_log"
    REPORT = "report"
    DASHBOARD = "dashboard"
    INTEGRATION = "integration"
    WEBHOOK = "webhook"
    SCHEDULE = "schedule"


class Permission(Base):
    """
    Enhanced Permission model with granular, resource-based permissions
    """

    __tablename__ = "permissions"

    # Primary identification
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    name = Column(String(200), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)
    category = Column(String(100), nullable=True, index=True)  # For grouping permissions

    # Permission structure
    action = Column(String(50), nullable=False)  # PermissionAction enum
    resource_type = Column(String(50), nullable=False)  # ResourceType enum
    scope = Column(String(20), default=PermissionScope.RESOURCE)  # PermissionScope enum

    # Permission constraints
    conditions = Column(JSONType, default=dict)  # Conditions for permission (time-based, location-based, etc.)
    constraints = Column(JSONType, default=dict)  # Resource constraints (ownership, team-based, etc.)

    # System permissions
    is_system = Column(Boolean, default=False, nullable=False)  # System permissions cannot be deleted
    is_sensitive = Column(Boolean, default=False, nullable=False)  # Sensitive permissions require additional approval

    # Status and lifecycle
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)

    # Indexes for performance
    __table_args__ = (
        Index('idx_permission_action_resource', 'action', 'resource_type'),
        Index('idx_permission_category_scope', 'category', 'scope'),
        Index('idx_permission_active_system', 'is_active', 'is_system'),
        CheckConstraint("action IN ('create', 'read', 'update', 'delete', 'execute', 'manage', 'approve', 'export', 'import', 'share')", name='check_action'),
        CheckConstraint("scope IN ('system', 'organization', 'team', 'resource', 'self')", name='check_scope'),
    )

    def __repr__(self):
        return f"<Permission(id={self.id}, name={self.name}, action={self.action}, resource={self.resource_type})>"

    @property
    def full_name(self) -> str:
        """Get full permission name"""
        return f"{self.action}:{self.resource_type}"

    def to_dict(self) -> dict:
        """Convert permission to dictionary"""
        return {
            'id': str(self.id),
            'name': self.name,
            'description': self.description,
            'category': self.category,
            'action': self.action,
            'resource_type': self.resource_type,
            'scope': self.scope,
            'conditions': self.conditions,
            'constraints': self.constraints,
            'is_system': self.is_system,
            'is_sensitive': self.is_sensitive,
            'is_active': self.is_active,
            'full_name': self.full_name,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }


class Role(Base):
    """
    Enhanced Role model with hierarchical structure and advanced features
    """

    __tablename__ = "roles"

    # Primary identification
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    name = Column(String(100), unique=True, nullable=False, index=True)
    display_name = Column(String(200), nullable=True)
    description = Column(Text, nullable=True)
    category = Column(String(50), nullable=True, index=True)  # admin, user, custom, etc.

    # Role hierarchy
    parent_role_id = Column(UUID(as_uuid=True), ForeignKey("roles.id"), nullable=True)
    level = Column(Integer, default=0, nullable=False)  # Hierarchy level (0 = highest)
    inherits_from_parent = Column(Boolean, default=True, nullable=False)  # Inherit permissions from parent

    # Role constraints and privileges
    is_system_role = Column(Boolean, default=False, nullable=False)  # System roles cannot be deleted
    is_active = Column(Boolean, default=True, nullable=False)
    is_assignable = Column(Boolean, default=True, nullable=False)  # Can be assigned to users
    max_assignments = Column(Integer, nullable=True)  # Maximum number of users that can have this role

    # Time-based restrictions
    valid_from = Column(DateTime(timezone=True), nullable=True)  # Role validity start
    valid_until = Column(DateTime(timezone=True), nullable=True)  # Role validity end

    # Organization and scope
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=True)
    scope_constraints = Column(JSONType, default=dict)  # Role scope limitations

    # Metadata
    role_metadata = Column(JSONType, default=dict)
    tags = Column(ARRAY(String), default=list)

    # Audit and lifecycle
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    # Relationships
    parent_role = relationship("Role", remote_side=[id], back_populates="child_roles")
    child_roles = relationship("Role", back_populates="parent_role")
    permissions = relationship("RolePermission", back_populates="role", cascade="all, delete-orphan")
    user_assignments = relationship("UserRoleAssignment", back_populates="role", cascade="all, delete-orphan")

    # Indexes and constraints
    __table_args__ = (
        Index('idx_role_name_active', 'name', 'is_active'),
        Index('idx_role_category_level', 'category', 'level'),
        Index('idx_role_parent_level', 'parent_role_id', 'level'),
        Index('idx_role_system_assignable', 'is_system_role', 'is_assignable'),
        Index('idx_role_validity', 'valid_from', 'valid_until'),
        UniqueConstraint('organization_id', 'name', name='uq_role_org_name'),
        CheckConstraint("level >= 0", name='check_level_non_negative'),
    )

    def __repr__(self):
        return f"<Role(id={self.id}, name={self.name}, level={self.level}, active={self.is_active})>"

    @hybrid_property
    def is_valid_now(self) -> bool:
        """Check if role is currently valid"""
        now = datetime.utcnow()
        if self.valid_from and now < self.valid_from:
            return False
        if self.valid_until and now > self.valid_until:
            return False
        return True

    @is_valid_now.expression
    def is_valid_now(cls):
        now = func.now()
        return and_(
            or_(cls.valid_from.is_(None), cls.valid_from <= now),
            or_(cls.valid_until.is_(None), cls.valid_until >= now)
        )

    def get_all_permissions(self, include_inherited: bool = True) -> Set[str]:
        """Get all permissions for this role including inherited ones"""
        permissions = set()

        # Direct permissions
        for role_perm in self.permissions:
            if role_perm.permission and role_perm.permission.is_active:
                permissions.add(role_perm.permission.name)

        # Inherited permissions
        if include_inherited and self.inherits_from_parent and self.parent_role:
            parent_permissions = self.parent_role.get_all_permissions(include_inherited=True)
            permissions.update(parent_permissions)

        return permissions

    def to_dict(self, include_permissions: bool = False) -> dict:
        """Convert role to dictionary"""
        data = {
            'id': str(self.id),
            'name': self.name,
            'display_name': self.display_name,
            'description': self.description,
            'category': self.category,
            'level': self.level,
            'parent_role_id': str(self.parent_role_id) if self.parent_role_id else None,
            'inherits_from_parent': self.inherits_from_parent,
            'is_system_role': self.is_system_role,
            'is_active': self.is_active,
            'is_assignable': self.is_assignable,
            'max_assignments': self.max_assignments,
            'valid_from': self.valid_from.isoformat() if self.valid_from else None,
            'valid_until': self.valid_until.isoformat() if self.valid_until else None,
            'organization_id': str(self.organization_id) if self.organization_id else None,
            'scope_constraints': self.scope_constraints,
            'metadata': self.role_metadata,
            'tags': self.tags,
            'is_valid_now': self.is_valid_now,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'created_by': str(self.created_by) if self.created_by else None,
        }

        if include_permissions:
            data['permissions'] = [perm.permission.name for perm in self.permissions if perm.permission and perm.permission.is_active]
            data['inherited_permissions'] = list(self.get_all_permissions(include_inherited=True) - data['permissions'])

        return data


class RolePermission(Base):
    """
    Association model for Role-Permission many-to-many relationship with enhanced features
    """

    __tablename__ = "role_permissions"

    # Composite primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    role_id = Column(UUID(as_uuid=True), ForeignKey("roles.id"), nullable=False)
    permission_id = Column(UUID(as_uuid=True), ForeignKey("permissions.id"), nullable=False)

    # Permission overrides and constraints
    is_granted = Column(Boolean, default=True, nullable=False)  # Can be used to deny specific permissions
    conditions = Column(JSONType, default=dict)  # Role-specific conditions for this permission
    constraints = Column(JSONType, default=dict)  # Role-specific constraints for this permission

    # Audit and lifecycle
    assigned_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    assigned_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)  # Permission assignment expiration
    reason = Column(Text, nullable=True)  # Reason for assignment

    # Relationships
    role = relationship("Role", back_populates="permissions")
    permission = relationship("Permission")

    # Indexes and constraints
    __table_args__ = (
        Index('idx_role_perm_role_granted', 'role_id', 'is_granted'),
        Index('idx_role_perm_permission_granted', 'permission_id', 'is_granted'),
        Index('idx_role_perm_expires', 'expires_at'),
        Index('idx_role_perm_assigned', 'assigned_at', 'assigned_by'),
        UniqueConstraint('role_id', 'permission_id', name='uq_role_permission'),
    )

    def __repr__(self):
        return f"<RolePermission(role_id={self.role_id}, permission_id={self.permission_id}, granted={self.is_granted})>"

    @property
    def is_valid(self) -> bool:
        """Check if permission assignment is currently valid"""
        if self.expires_at and datetime.utcnow() > self.expires_at:
            return False
        return True

    def to_dict(self) -> dict:
        """Convert role permission to dictionary"""
        return {
            'id': str(self.id),
            'role_id': str(self.role_id),
            'permission_id': str(self.permission_id),
            'permission_name': self.permission.name if self.permission else None,
            'is_granted': self.is_granted,
            'conditions': self.conditions,
            'constraints': self.constraints,
            'assigned_at': self.assigned_at.isoformat() if self.assigned_at else None,
            'assigned_by': str(self.assigned_by) if self.assigned_by else None,
            'expires_at': self.expires_at.isoformat() if self.expires_at else None,
            'reason': self.reason,
            'is_valid': self.is_valid,
        }


class UserRoleAssignment(Base):
    """
    Enhanced User-Role assignment model with advanced features
    """

    __tablename__ = "user_role_assignments"

    # Composite identification
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    role_id = Column(UUID(as_uuid=True), ForeignKey("roles.id"), nullable=False)

    # Assignment metadata
    assigned_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    assigned_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Assignment lifecycle
    expires_at = Column(DateTime(timezone=True), nullable=True)  # Assignment expiration
    is_active = Column(Boolean, default=True, nullable=False)

    # Context and constraints
    context = Column(JSONType, default=dict)  # Assignment context (project, team, etc.)
    scope_constraints = Column(JSONType, default=dict)  # User-specific scope limitations
    conditions = Column(JSONType, default=dict)  # User-specific conditions

    # Approval and audit
    approved_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    reason = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)

    # Relationships (user_id is the main FK for the assignment; assigned_by/approved_by are other User FKs)
    user = relationship("app.models.user.User", back_populates="role_assignments", foreign_keys=[user_id])
    role = relationship("Role", back_populates="user_assignments")
    assigner = relationship("app.models.user.User", foreign_keys=[assigned_by])
    approver = relationship("app.models.user.User", foreign_keys=[approved_by])

    # Indexes and constraints
    __table_args__ = (
        Index('idx_user_role_user', 'user_id', 'is_active'),
        Index('idx_user_role_role', 'role_id', 'is_active'),
        Index('idx_user_role_expires', 'expires_at', 'is_active'),
        Index('idx_user_role_assigned', 'assigned_at', 'assigned_by'),
        Index('idx_user_role_approver', 'approved_by', 'approved_at'),
        UniqueConstraint('user_id', 'role_id', name='uq_user_role'),
    )

    def __repr__(self):
        return f"<UserRoleAssignment(user_id={self.user_id}, role_id={self.role_id}, active={self.is_active})>"

    @property
    def is_valid(self) -> bool:
        """Check if role assignment is currently valid"""
        if not self.is_active:
            return False
        if self.expires_at and datetime.utcnow() > self.expires_at:
            return False
        if not self.role.is_valid_now:
            return False
        return True

    @property
    def days_until_expiry(self) -> Optional[int]:
        """Get days until assignment expires"""
        if not self.expires_at:
            return None
        delta = self.expires_at - datetime.utcnow()
        return max(0, delta.days)

    def to_dict(self) -> dict:
        """Convert user role assignment to dictionary"""
        return {
            'id': str(self.id),
            'user_id': str(self.user_id),
            'role_id': str(self.role_id),
            'role_name': self.role.name if self.role else None,
            'assigned_by': str(self.assigned_by) if self.assigned_by else None,
            'assigned_at': self.assigned_at.isoformat() if self.assigned_at else None,
            'expires_at': self.expires_at.isoformat() if self.expires_at else None,
            'is_active': self.is_active,
            'is_valid': self.is_valid,
            'context': self.context,
            'scope_constraints': self.scope_constraints,
            'conditions': self.conditions,
            'approved_by': str(self.approved_by) if self.approved_by else None,
            'approved_at': self.approved_at.isoformat() if self.approved_at else None,
            'reason': self.reason,
            'notes': self.notes,
            'days_until_expiry': self.days_until_expiry,
        }


class ResourcePermission(Base):
    """
    Resource-specific permission model for fine-grained access control
    """

    __tablename__ = "resource_permissions"

    # Primary identification
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Resource identification
    resource_type = Column(String(50), nullable=False)
    resource_id = Column(UUID(as_uuid=True), nullable=False)

    # User/Role identification
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    role_id = Column(UUID(as_uuid=True), ForeignKey("roles.id"), nullable=True)

    # Permission details
    permission_id = Column(UUID(as_uuid=True), ForeignKey("permissions.id"), nullable=False)
    is_granted = Column(Boolean, default=True, nullable=False)

    # Permission constraints
    conditions = Column(JSONType, default=dict)
    constraints = Column(JSONType, default=dict)

    # Audit and lifecycle
    granted_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    granted_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    reason = Column(Text, nullable=True)

    # Relationships (user_id vs granted_by both reference users)
    user = relationship("app.models.user.User", foreign_keys=[user_id])
    role = relationship("Role")
    permission = relationship("Permission")
    granter = relationship("app.models.user.User", foreign_keys=[granted_by])

    # Indexes and constraints
    __table_args__ = (
        Index('idx_resource_perm_resource', 'resource_type', 'resource_id'),
        Index('idx_resource_perm_user', 'user_id', 'is_granted'),
        Index('idx_resource_perm_role', 'role_id', 'is_granted'),
        Index('idx_resource_perm_permission', 'permission_id', 'is_granted'),
        Index('idx_resource_perm_expires', 'expires_at'),
        Index('idx_resource_perm_granted', 'granted_at', 'granted_by'),
        CheckConstraint("(user_id IS NOT NULL) OR (role_id IS NOT NULL)", name='check_user_or_role'),
    )

    def __repr__(self):
        return f"<ResourcePermission(resource={self.resource_type}:{self.resource_id}, granted={self.is_granted})>"

    @property
    def is_valid(self) -> bool:
        """Check if resource permission is currently valid"""
        if self.expires_at and datetime.utcnow() > self.expires_at:
            return False
        return True

    def to_dict(self) -> dict:
        """Convert resource permission to dictionary"""
        return {
            'id': str(self.id),
            'resource_type': self.resource_type,
            'resource_id': str(self.resource_id),
            'user_id': str(self.user_id) if self.user_id else None,
            'role_id': str(self.role_id) if self.role_id else None,
            'permission_id': str(self.permission_id),
            'permission_name': self.permission.name if self.permission else None,
            'is_granted': self.is_granted,
            'conditions': self.conditions,
            'constraints': self.constraints,
            'granted_by': str(self.granted_by) if self.granted_by else None,
            'granted_at': self.granted_at.isoformat() if self.granted_at else None,
            'expires_at': self.expires_at.isoformat() if self.expires_at else None,
            'reason': self.reason,
            'is_valid': self.is_valid,
        }


class PermissionAuditLog(Base):
    """
    Audit log for all permission and role changes
    """

    __tablename__ = "permission_audit_logs"

    # Primary identification
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Event information
    event_type = Column(String(100), nullable=False)  # role_assigned, permission_granted, etc.
    entity_type = Column(String(50), nullable=False)  # user, role, permission
    entity_id = Column(UUID(as_uuid=True), nullable=False)

    # User information
    actor_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    target_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    # Event details
    old_value = Column(JSONType, nullable=True)
    new_value = Column(JSONType, nullable=True)
    audit_metadata = Column(JSONType, default=dict)

    # Request context
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(String(500), nullable=True)
    request_id = Column(String(100), nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    actor = relationship("app.models.user.User", foreign_keys=[actor_id])
    target_user = relationship("app.models.user.User", foreign_keys=[target_user_id])

    # Indexes
    __table_args__ = (
        Index('idx_audit_entity', 'entity_type', 'entity_id', 'created_at'),
        Index('idx_audit_actor', 'actor_id', 'created_at'),
        Index('idx_audit_target_user', 'target_user_id', 'created_at'),
        Index('idx_audit_event_type', 'event_type', 'created_at'),
        Index('idx_audit_ip', 'ip_address', 'created_at'),
    )

    def __repr__(self):
        return f"<PermissionAuditLog(id={self.id}, event={self.event_type}, entity={self.entity_type}:{self.entity_id})>"

    def to_dict(self) -> dict:
        """Convert audit log to dictionary"""
        return {
            'id': str(self.id),
            'event_type': self.event_type,
            'entity_type': self.entity_type,
            'entity_id': str(self.entity_id),
            'actor_id': str(self.actor_id) if self.actor_id else None,
            'target_user_id': str(self.target_user_id) if self.target_user_id else None,
            'old_value': self.old_value,
            'new_value': self.new_value,
            'metadata': self.audit_metadata,
            'ip_address': self.ip_address,
            'user_agent': self.user_agent,
            'request_id': self.request_id,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }