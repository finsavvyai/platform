"""
Role-Based Access Control (RBAC) Service
"""

from typing import List, Dict, Any, Optional, Set
from enum import Enum
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, Column, String, Boolean, DateTime, ForeignKey, Table
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
import logging

from app.core.database import Base
from app.models.user import User

logger = logging.getLogger(__name__)


class Permission(str, Enum):
    """System permissions"""
    # User management
    USER_READ = "user:read"
    USER_WRITE = "user:write"
    USER_DELETE = "user:delete"
    USER_MANAGE = "user:manage"
    
    # Workflow management
    WORKFLOW_READ = "workflow:read"
    WORKFLOW_WRITE = "workflow:write"
    WORKFLOW_DELETE = "workflow:delete"
    WORKFLOW_EXECUTE = "workflow:execute"
    WORKFLOW_MANAGE = "workflow:manage"
    
    # Document management
    DOCUMENT_READ = "document:read"
    DOCUMENT_WRITE = "document:write"
    DOCUMENT_DELETE = "document:delete"
    DOCUMENT_MANAGE = "document:manage"
    
    # Agent management
    AGENT_READ = "agent:read"
    AGENT_WRITE = "agent:write"
    AGENT_DELETE = "agent:delete"
    AGENT_EXECUTE = "agent:execute"
    AGENT_MANAGE = "agent:manage"
    
    # Organization management
    ORG_READ = "organization:read"
    ORG_WRITE = "organization:write"
    ORG_MANAGE = "organization:manage"
    
    # System administration
    SYSTEM_ADMIN = "system:admin"
    SYSTEM_MONITOR = "system:monitor"
    SYSTEM_CONFIG = "system:config"
    
    # Infrastructure management
    INFRA_READ = "infrastructure:read"
    INFRA_WRITE = "infrastructure:write"
    INFRA_DEPLOY = "infrastructure:deploy"
    INFRA_MANAGE = "infrastructure:manage"


# Association table for role-permission many-to-many relationship
role_permissions = Table(
    'role_permissions',
    Base.metadata,
    Column('role_id', UUID(as_uuid=True), ForeignKey('roles.id'), primary_key=True),
    Column('permission', String, primary_key=True)
)

# Association table for user-role many-to-many relationship
user_roles = Table(
    'user_roles',
    Base.metadata,
    Column('user_id', UUID(as_uuid=True), ForeignKey('users.id'), primary_key=True),
    Column('role_id', UUID(as_uuid=True), ForeignKey('roles.id'), primary_key=True)
)


class Role(Base):
    """Role model for RBAC"""
    
    __tablename__ = "roles"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), unique=True, nullable=False)
    description = Column(String(500), nullable=True)
    is_system_role = Column(Boolean, default=False)  # System roles cannot be deleted
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.utcnow())
    updated_at = Column(DateTime, default=lambda: datetime.utcnow(), onupdate=lambda: datetime.utcnow())
    
    # Many-to-many relationship with permissions (stored as strings)
    permissions = relationship(
        "Permission",
        secondary=role_permissions,
        back_populates="roles"
    )
    
    # Many-to-many relationship with users
    users = relationship(
        "User",
        secondary=user_roles,
        back_populates="roles"
    )


class RBACService:
    """Role-Based Access Control service"""
    
    def __init__(self):
        # Define default system roles and their permissions
        self.system_roles = {
            "super_admin": {
                "description": "Super Administrator with full system access",
                "permissions": list(Permission)
            },
            "admin": {
                "description": "Administrator with organization management access",
                "permissions": [
                    Permission.USER_READ, Permission.USER_WRITE, Permission.USER_MANAGE,
                    Permission.WORKFLOW_READ, Permission.WORKFLOW_WRITE, Permission.WORKFLOW_DELETE, Permission.WORKFLOW_MANAGE,
                    Permission.DOCUMENT_READ, Permission.DOCUMENT_WRITE, Permission.DOCUMENT_DELETE, Permission.DOCUMENT_MANAGE,
                    Permission.AGENT_READ, Permission.AGENT_WRITE, Permission.AGENT_DELETE, Permission.AGENT_MANAGE,
                    Permission.ORG_READ, Permission.ORG_WRITE, Permission.ORG_MANAGE,
                    Permission.SYSTEM_MONITOR,
                    Permission.INFRA_READ, Permission.INFRA_WRITE, Permission.INFRA_DEPLOY
                ]
            },
            "manager": {
                "description": "Manager with team and workflow management access",
                "permissions": [
                    Permission.USER_READ, Permission.USER_WRITE,
                    Permission.WORKFLOW_READ, Permission.WORKFLOW_WRITE, Permission.WORKFLOW_EXECUTE, Permission.WORKFLOW_MANAGE,
                    Permission.DOCUMENT_READ, Permission.DOCUMENT_WRITE, Permission.DOCUMENT_DELETE,
                    Permission.AGENT_READ, Permission.AGENT_WRITE, Permission.AGENT_EXECUTE,
                    Permission.ORG_READ,
                    Permission.INFRA_READ
                ]
            },
            "developer": {
                "description": "Developer with workflow and agent development access",
                "permissions": [
                    Permission.USER_READ,
                    Permission.WORKFLOW_READ, Permission.WORKFLOW_WRITE, Permission.WORKFLOW_EXECUTE,
                    Permission.DOCUMENT_READ, Permission.DOCUMENT_WRITE,
                    Permission.AGENT_READ, Permission.AGENT_WRITE, Permission.AGENT_EXECUTE,
                    Permission.ORG_READ,
                    Permission.INFRA_READ, Permission.INFRA_WRITE
                ]
            },
            "user": {
                "description": "Standard user with basic access",
                "permissions": [
                    Permission.USER_READ,
                    Permission.WORKFLOW_READ, Permission.WORKFLOW_EXECUTE,
                    Permission.DOCUMENT_READ, Permission.DOCUMENT_WRITE,
                    Permission.AGENT_READ, Permission.AGENT_EXECUTE,
                    Permission.ORG_READ
                ]
            },
            "viewer": {
                "description": "Read-only access to resources",
                "permissions": [
                    Permission.USER_READ,
                    Permission.WORKFLOW_READ,
                    Permission.DOCUMENT_READ,
                    Permission.AGENT_READ,
                    Permission.ORG_READ,
                    Permission.INFRA_READ
                ]
            }
        }
    
    async def initialize_system_roles(self, db: AsyncSession) -> None:
        """Initialize system roles if they don't exist"""
        try:
            for role_name, role_data in self.system_roles.items():
                # Check if role exists
                result = await db.execute(
                    select(Role).where(Role.name == role_name)
                )
                existing_role = result.scalar_one_or_none()
                
                if not existing_role:
                    # Create new system role
                    new_role = Role(
                        name=role_name,
                        description=role_data["description"],
                        is_system_role=True
                    )
                    db.add(new_role)
                    await db.flush()  # Get the ID
                    
                    # Add permissions
                    for permission in role_data["permissions"]:
                        await db.execute(
                            role_permissions.insert().values(
                                role_id=new_role.id,
                                permission=permission.value
                            )
                        )
                    
                    logger.info(f"Created system role: {role_name}")
                else:
                    # Update existing role permissions if needed
                    await self._update_role_permissions(db, existing_role, role_data["permissions"])
            
            await db.commit()
            logger.info("System roles initialized successfully")
            
        except Exception as e:
            logger.error(f"Error initializing system roles: {e}")
            await db.rollback()
            raise
    
    async def _update_role_permissions(
        self, 
        db: AsyncSession, 
        role: Role, 
        permissions: List[Permission]
    ) -> None:
        """Update role permissions"""
        try:
            # Get current permissions
            result = await db.execute(
                select(role_permissions.c.permission)
                .where(role_permissions.c.role_id == role.id)
            )
            current_permissions = {row[0] for row in result.fetchall()}
            
            # Get target permissions
            target_permissions = {perm.value for perm in permissions}
            
            # Add missing permissions
            for perm in target_permissions - current_permissions:
                await db.execute(
                    role_permissions.insert().values(
                        role_id=role.id,
                        permission=perm
                    )
                )
            
            # Remove extra permissions (only for system roles)
            if role.is_system_role:
                for perm in current_permissions - target_permissions:
                    await db.execute(
                        role_permissions.delete().where(
                            role_permissions.c.role_id == role.id,
                            role_permissions.c.permission == perm
                        )
                    )
            
        except Exception as e:
            logger.error(f"Error updating role permissions: {e}")
            raise
    
    async def assign_role_to_user(
        self, 
        db: AsyncSession, 
        user_id: str, 
        role_name: str
    ) -> bool:
        """Assign a role to a user"""
        try:
            # Get role
            result = await db.execute(
                select(Role).where(Role.name == role_name, Role.is_active == True)
            )
            role = result.scalar_one_or_none()
            
            if not role:
                logger.error(f"Role {role_name} not found")
                return False
            
            # Check if user already has this role
            result = await db.execute(
                select(user_roles).where(
                    user_roles.c.user_id == user_id,
                    user_roles.c.role_id == role.id
                )
            )
            
            if result.fetchone():
                logger.info(f"User {user_id} already has role {role_name}")
                return True
            
            # Assign role
            await db.execute(
                user_roles.insert().values(
                    user_id=user_id,
                    role_id=role.id
                )
            )
            
            await db.commit()
            logger.info(f"Assigned role {role_name} to user {user_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error assigning role {role_name} to user {user_id}: {e}")
            await db.rollback()
            return False
    
    async def remove_role_from_user(
        self, 
        db: AsyncSession, 
        user_id: str, 
        role_name: str
    ) -> bool:
        """Remove a role from a user"""
        try:
            # Get role
            result = await db.execute(
                select(Role).where(Role.name == role_name)
            )
            role = result.scalar_one_or_none()
            
            if not role:
                return False
            
            # Remove role assignment
            result = await db.execute(
                user_roles.delete().where(
                    user_roles.c.user_id == user_id,
                    user_roles.c.role_id == role.id
                )
            )
            
            await db.commit()
            
            if result.rowcount > 0:
                logger.info(f"Removed role {role_name} from user {user_id}")
                return True
            
            return False
            
        except Exception as e:
            logger.error(f"Error removing role {role_name} from user {user_id}: {e}")
            await db.rollback()
            return False
    
    async def get_user_permissions(
        self, 
        db: AsyncSession, 
        user_id: str
    ) -> Set[str]:
        """Get all permissions for a user"""
        try:
            # Get user roles and their permissions
            result = await db.execute(
                select(role_permissions.c.permission)
                .select_from(
                    user_roles.join(role_permissions, user_roles.c.role_id == role_permissions.c.role_id)
                )
                .where(user_roles.c.user_id == user_id)
            )
            
            permissions = {row[0] for row in result.fetchall()}
            
            # Check if user is superuser (has all permissions)
            user_result = await db.execute(
                select(User).where(User.id == user_id)
            )
            user = user_result.scalar_one_or_none()
            
            if user and user.is_superuser:
                permissions.update({perm.value for perm in Permission})
            
            return permissions
            
        except Exception as e:
            logger.error(f"Error getting permissions for user {user_id}: {e}")
            return set()
    
    async def check_permission(
        self, 
        db: AsyncSession, 
        user_id: str, 
        permission: Permission
    ) -> bool:
        """Check if user has a specific permission"""
        try:
            user_permissions = await self.get_user_permissions(db, user_id)
            return permission.value in user_permissions
            
        except Exception as e:
            logger.error(f"Error checking permission {permission} for user {user_id}: {e}")
            return False
    
    async def check_permissions(
        self, 
        db: AsyncSession, 
        user_id: str, 
        permissions: List[Permission],
        require_all: bool = True
    ) -> bool:
        """Check if user has multiple permissions"""
        try:
            user_permissions = await self.get_user_permissions(db, user_id)
            required_perms = {perm.value for perm in permissions}
            
            if require_all:
                return required_perms.issubset(user_permissions)
            else:
                return bool(required_perms.intersection(user_permissions))
            
        except Exception as e:
            logger.error(f"Error checking permissions for user {user_id}: {e}")
            return False
    
    async def get_user_roles(
        self, 
        db: AsyncSession, 
        user_id: str
    ) -> List[Dict[str, Any]]:
        """Get all roles for a user"""
        try:
            result = await db.execute(
                select(Role)
                .select_from(user_roles.join(Role, user_roles.c.role_id == Role.id))
                .where(user_roles.c.user_id == user_id, Role.is_active == True)
            )
            
            roles = result.scalars().all()
            
            return [
                {
                    "id": str(role.id),
                    "name": role.name,
                    "description": role.description,
                    "is_system_role": role.is_system_role
                }
                for role in roles
            ]
            
        except Exception as e:
            logger.error(f"Error getting roles for user {user_id}: {e}")
            return []