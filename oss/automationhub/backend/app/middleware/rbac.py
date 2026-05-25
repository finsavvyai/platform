"""
Comprehensive Role-Based Access Control (RBAC) Middleware

This middleware provides fine-grained access control with support for:
- Resource-level permission checking
- Dynamic permission evaluation with context
- Permission inheritance and overrides
- Time-based and condition-based access
- Resource ownership verification
- Comprehensive audit logging
- Performance optimization with caching

Author: Claude Code Implementation
Task: 1.1.3 Role-Based Access Control
Updated: 2025-01-06
"""

from typing import Optional, Callable, List, Dict, Any, Union
from functools import wraps
from fastapi import Request, Response, HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.middleware.base import BaseHTTPMiddleware
import logging
import time
from datetime import datetime

from app.core.database import get_db
from app.services.authorization import AuthorizationService, PermissionCheckContext, PermissionResult
from app.services.jwt_service import JWTService
from app.models.user import User
from app.models.rbac import ResourceType, PermissionAction
from app.utils.request_utils import get_client_ip, get_request_context

logger = logging.getLogger(__name__)

# Security scheme
security = HTTPBearer()


class RBACMiddleware(BaseHTTPMiddleware):
    """
    RBAC Middleware for automatic permission checking on API endpoints
    """

    def __init__(self, app, authorization_service: AuthorizationService):
        super().__init__(app)
        self.authorization_service = authorization_service
        self.jwt_service = JWTService()
        self.bypass_patterns = [
            "/health",
            "/metrics",
            "/docs",
            "/openapi.json",
            "/favicon.ico",
            "/static/",
            "/auth/login",
            "/auth/register",
            "/auth/forgot-password",
            "/auth/reset-password",
        ]

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Process request through RBAC middleware"""
        start_time = time.time()

        # Bypass RBAC for certain endpoints
        if self._should_bypass_rbac(request.url.path):
            response = await call_next(request)
            return response

        try:
            # Extract user from JWT token
            user = await self._extract_user_from_request(request)
            if not user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Authentication required",
                    headers={"WWW-Authenticate": "Bearer"},
                )

            # Create permission context
            context = await self._create_permission_context(request, user)

            # Check permissions based on endpoint and method
            permission_result = await self._check_endpoint_permissions(
                request, user, context
            )

            if not permission_result.granted:
                logger.warning(
                    f"Access denied for user {user.id} to {request.method} {request.url.path}: "
                    f"{permission_result.reason}"
                )

                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Access denied: {permission_result.reason}",
                    headers={
                        "X-Permission-Required": permission_result.reason or "Unknown",
                        "X-Permission-Source": permission_result.source or "Unknown",
                    },
                )

            # Add user context to request state
            request.state.user = user
            request.state.permission_context = context
            request.state.permission_result = permission_result

            # Process request
            response = await call_next(request)

            # Add RBAC headers to response
            self._add_rbac_headers(response, permission_result, start_time)

            return response

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"RBAC middleware error: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Internal server error during authorization check"
            )

    def _should_bypass_rbac(self, path: str) -> bool:
        """Check if the path should bypass RBAC checks"""
        for pattern in self.bypass_patterns:
            if path.startswith(pattern):
                return True
        return False

    async def _extract_user_from_request(self, request: Request) -> Optional[User]:
        """Extract user from JWT token in request"""
        try:
            auth_header = request.headers.get("authorization")
            if not auth_header or not auth_header.startswith("Bearer "):
                return None

            token = auth_header.split(" ")[1]
            payload = self.jwt_service.verify_access_token(token)
            user_id: str = payload.get("sub")

            if not user_id:
                return None

            # Get user from database
            db = request.state.db if hasattr(request.state, 'db') else None
            if not db:
                # Get database session from dependency injection
                async for db_session in get_db():
                    db = db_session
                    break

            if not db:
                return None

            from sqlalchemy import select
            result = await db.execute(
                select(User).where(User.id == user_id, User.is_active == True)
            )
            return result.scalar_one_or_none()

        except Exception as e:
            logger.error(f"Error extracting user from request: {e}")
            return None

    async def _create_permission_context(
        self, request: Request, user: User
    ) -> PermissionCheckContext:
        """Create permission check context from request"""
        return PermissionCheckContext(
            request_id=request.headers.get("X-Request-ID"),
            ip_address=get_client_ip(request),
            user_agent=request.headers.get("User-Agent"),
            resource_id=self._extract_resource_id(request),
            resource_type=self._extract_resource_type(request),
            organization_id=str(user.organization_id) if user.organization_id else None,
            additional_data=await get_request_context(request)
        )

    def _extract_resource_id(self, request: Request) -> Optional[str]:
        """Extract resource ID from request path"""
        path_parts = request.url.path.strip("/").split("/")
        # Typical pattern: /api/v1/{resource_type}/{resource_id}
        if len(path_parts) >= 4 and path_parts[0] == "api" and path_parts[1] == "v1":
            return path_parts[3]
        return None

    def _extract_resource_type(self, request: Request) -> Optional[str]:
        """Extract resource type from request path"""
        path_parts = request.url.path.strip("/").split("/")
        # Typical pattern: /api/v1/{resource_type}/{resource_id}
        if len(path_parts) >= 3 and path_parts[0] == "api" and path_parts[1] == "v1":
            resource_type = path_parts[2]
            # Map singular to plural forms
            resource_mapping = {
                "workflow": "workflows",
                "document": "documents",
                "agent": "agents",
                "user": "users",
                "role": "roles",
                "task": "tasks",
                "organization": "organizations",
            }
            return resource_mapping.get(resource_type, resource_type)
        return None

    async def _check_endpoint_permissions(
        self, request: Request, user: User, context: PermissionCheckContext
    ) -> PermissionResult:
        """Check permissions for specific endpoint and method"""
        path = request.url.path
        method = request.method.upper()

        # Superuser bypass
        if user.is_superuser:
            return PermissionResult(granted=True, source="superuser")

        # Get database session
        db = request.state.db if hasattr(request.state, 'db') else None
        if not db:
            async for db_session in get_db():
                db = db_session
                break

        # Define endpoint permission mappings
        permission_mappings = self._get_endpoint_permission_mappings()

        # Find matching permission mapping
        for mapping in permission_mappings:
            if self._path_matches_pattern(path, mapping["path_pattern"]):
                if method in mapping["methods"]:
                    permission_name = mapping["permission"]

                    # Check permission
                    result = await self.authorization_service.check_permission(
                        db,
                        str(user.id),
                        permission_name,
                        context=context,
                        resource_id=context.resource_id,
                        resource_type=context.resource_type
                    )

                    if result.granted:
                        return result
                    else:
                        return PermissionResult(
                            granted=False,
                            reason=f"Missing permission: {permission_name}",
                            source="endpoint_check"
                        )

        # Default: allow read access for authenticated users
        if method in ["GET", "HEAD", "OPTIONS"]:
            return PermissionResult(granted=True, source="default_read_access")

        # Deny by default
        return PermissionResult(
            granted=False,
            reason="No permission mapping found for endpoint",
            source="default_deny"
        )

    def _path_matches_pattern(self, path: str, pattern: str) -> bool:
        """Check if path matches the given pattern"""
        import re

        # Convert pattern to regex
        # Replace {param} with regex pattern
        regex_pattern = pattern.replace(
            "{id}", r"[a-f0-9-]{36}"
        ).replace(
            "**", r".*"
        ).replace(
            "*", r"[^/]*"
        )

        # Add start and end anchors
        regex_pattern = f"^{regex_pattern}$"

        try:
            return bool(re.match(regex_pattern, path))
        except re.error:
            return False

    def _get_endpoint_permission_mappings(self) -> List[Dict[str, Any]]:
        """Get permission mappings for API endpoints"""
        return [
            # User management
            {
                "path_pattern": "/api/v1/users",
                "methods": ["GET"],
                "permission": "user:read"
            },
            {
                "path_pattern": "/api/v1/users/{id}",
                "methods": ["GET"],
                "permission": "user:read"
            },
            {
                "path_pattern": "/api/v1/users",
                "methods": ["POST"],
                "permission": "user:create"
            },
            {
                "path_pattern": "/api/v1/users/{id}",
                "methods": ["PUT", "PATCH"],
                "permission": "user:update"
            },
            {
                "path_pattern": "/api/v1/users/{id}",
                "methods": ["DELETE"],
                "permission": "user:delete"
            },
            {
                "path_pattern": "/api/v1/users/{id}/roles",
                "methods": ["POST"],
                "permission": "role:assign"
            },
            {
                "path_pattern": "/api/v1/users/{id}/roles",
                "methods": ["GET"],
                "permission": "role:read"
            },

            # Role management
            {
                "path_pattern": "/api/v1/roles",
                "methods": ["GET"],
                "permission": "role:read"
            },
            {
                "path_pattern": "/api/v1/roles",
                "methods": ["POST"],
                "permission": "role:create"
            },
            {
                "path_pattern": "/api/v1/roles/{id}",
                "methods": ["GET"],
                "permission": "role:read"
            },
            {
                "path_pattern": "/api/v1/roles/{id}",
                "methods": ["PUT", "PATCH"],
                "permission": "role:update"
            },
            {
                "path_pattern": "/api/v1/roles/{id}",
                "methods": ["DELETE"],
                "permission": "role:delete"
            },

            # Workflow management
            {
                "path_pattern": "/api/v1/workflows",
                "methods": ["GET"],
                "permission": "workflow:read"
            },
            {
                "path_pattern": "/api/v1/workflows",
                "methods": ["POST"],
                "permission": "workflow:create"
            },
            {
                "path_pattern": "/api/v1/workflows/{id}",
                "methods": ["GET"],
                "permission": "workflow:read"
            },
            {
                "path_pattern": "/api/v1/workflows/{id}",
                "methods": ["PUT", "PATCH"],
                "permission": "workflow:update"
            },
            {
                "path_pattern": "/api/v1/workflows/{id}",
                "methods": ["DELETE"],
                "permission": "workflow:delete"
            },
            {
                "path_pattern": "/api/v1/workflows/{id}/execute",
                "methods": ["POST"],
                "permission": "workflow:execute"
            },

            # Document management
            {
                "path_pattern": "/api/v1/documents",
                "methods": ["GET"],
                "permission": "document:read"
            },
            {
                "path_pattern": "/api/v1/documents",
                "methods": ["POST"],
                "permission": "document:create"
            },
            {
                "path_pattern": "/api/v1/documents/{id}",
                "methods": ["GET"],
                "permission": "document:read"
            },
            {
                "path_pattern": "/api/v1/documents/{id}",
                "methods": ["PUT", "PATCH"],
                "permission": "document:update"
            },
            {
                "path_pattern": "/api/v1/documents/{id}",
                "methods": ["DELETE"],
                "permission": "document:delete"
            },
            {
                "path_pattern": "/api/v1/documents/{id}/share",
                "methods": ["POST"],
                "permission": "document:share"
            },

            # Agent management
            {
                "path_pattern": "/api/v1/agents",
                "methods": ["GET"],
                "permission": "agent:read"
            },
            {
                "path_pattern": "/api/v1/agents",
                "methods": ["POST"],
                "permission": "agent:create"
            },
            {
                "path_pattern": "/api/v1/agents/{id}",
                "methods": ["GET"],
                "permission": "agent:read"
            },
            {
                "path_pattern": "/api/v1/agents/{id}",
                "methods": ["PUT", "PATCH"],
                "permission": "agent:update"
            },
            {
                "path_pattern": "/api/v1/agents/{id}",
                "methods": ["DELETE"],
                "permission": "agent:delete"
            },
            {
                "path_pattern": "/api/v1/agents/{id}/execute",
                "methods": ["POST"],
                "permission": "agent:execute"
            },

            # Organization management
            {
                "path_pattern": "/api/v1/organizations",
                "methods": ["GET"],
                "permission": "organization:read"
            },
            {
                "path_pattern": "/api/v1/organizations/{id}",
                "methods": ["GET"],
                "permission": "organization:read"
            },
            {
                "path_pattern": "/api/v1/organizations/{id}",
                "methods": ["PUT", "PATCH"],
                "permission": "organization:update"
            },
            {
                "path_pattern": "/api/v1/organizations/{id}/billing",
                "methods": ["GET", "POST"],
                "permission": "organization:manage"
            },

            # System administration
            {
                "path_pattern": "/api/v1/system/health",
                "methods": ["GET"],
                "permission": "system:monitor"
            },
            {
                "path_pattern": "/api/v1/system/metrics",
                "methods": ["GET"],
                "permission": "system:monitor"
            },
            {
                "path_pattern": "/api/v1/system/config",
                "methods": ["GET", "PUT"],
                "permission": "system:config"
            },
            {
                "path_pattern": "/api/v1/system/audit",
                "methods": ["GET"],
                "permission": "system:audit"
            },

            # Infrastructure management
            {
                "path_pattern": "/api/v1/infrastructure",
                "methods": ["GET"],
                "permission": "infrastructure:read"
            },
            {
                "path_pattern": "/api/v1/infrastructure",
                "methods": ["POST"],
                "permission": "infrastructure:create"
            },
            {
                "path_pattern": "/api/v1/infrastructure/{id}",
                "methods": ["GET"],
                "permission": "infrastructure:read"
            },
            {
                "path_pattern": "/api/v1/infrastructure/{id}",
                "methods": ["PUT", "PATCH"],
                "permission": "infrastructure:update"
            },
            {
                "path_pattern": "/api/v1/infrastructure/{id}",
                "methods": ["DELETE"],
                "permission": "infrastructure:delete"
            },
            {
                "path_pattern": "/api/v1/infrastructure/{id}/deploy",
                "methods": ["POST"],
                "permission": "infrastructure:deploy"
            },
        ]

    def _add_rbac_headers(
        self, response: Response, permission_result: PermissionResult, start_time: float
    ) -> None:
        """Add RBAC-related headers to response"""
        response.headers["X-RBAC-Checked"] = "true"
        response.headers["X-Permission-Source"] = permission_result.source or "unknown"
        response.headers["X-RBAC-Response-Time"] = str(time.time() - start_time)

        if permission_result.cached:
            response.headers["X-Permission-Cached"] = "true"

        if permission_result.expires_at:
            response.headers["X-Permission-Expires-At"] = permission_result.expires_at.isoformat()


class RBACDecorator:
    """
    Decorator-based RBAC for endpoint-level permission checking
    """

    def __init__(self, authorization_service: AuthorizationService):
        self.authorization_service = authorization_service
        self.jwt_service = JWTService()

    def require_permission(
        self,
        permission_name: str,
        resource_id_param: Optional[str] = None,
        resource_type_param: Optional[str] = None,
        require_all: bool = False
    ):
        """
        Decorator to require specific permission for endpoint access

        Args:
            permission_name: Required permission name
            resource_id_param: Path parameter name for resource ID
            resource_type_param: Path parameter name for resource type
            require_all: Whether to require all conditions (for multiple permissions)
        """
        def decorator(func):
            @wraps(func)
            async def wrapper(*args, **kwargs):
                # Extract request and user from function arguments
                request = kwargs.get('request')
                current_user = kwargs.get('current_user')
                db = kwargs.get('db')

                if not request or not current_user:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Authentication required"
                    )

                # Superuser bypass
                if current_user.is_superuser:
                    return await func(*args, **kwargs)

                # Extract resource information
                resource_id = None
                resource_type = None

                if resource_id_param and resource_id_param in kwargs:
                    resource_id = kwargs[resource_id_param]

                if resource_type_param and resource_type_param in kwargs:
                    resource_type = kwargs[resource_type_param]

                # Create permission context
                context = PermissionCheckContext(
                    request_id=request.headers.get("X-Request-ID"),
                    ip_address=request.headers.get("X-Forwarded-For", request.client.host if request.client else None),
                    user_agent=request.headers.get("User-Agent"),
                    resource_id=resource_id,
                    resource_type=resource_type,
                    organization_id=str(current_user.organization_id) if current_user.organization_id else None,
                    additional_data={"path_params": kwargs}
                )

                # Check permission
                permission_result = await self.authorization_service.check_permission(
                    db,
                    str(current_user.id),
                    permission_name,
                    context=context,
                    resource_id=resource_id,
                    resource_type=resource_type
                )

                if not permission_result.granted:
                    logger.warning(
                        f"Access denied for user {current_user.id} to {permission_name}: "
                        f"{permission_result.reason}"
                    )

                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail=f"Access denied: {permission_result.reason}",
                        headers={
                            "X-Permission-Required": permission_name,
                            "X-Permission-Source": permission_result.source or "Unknown",
                        },
                    )

                # Add permission info to request state
                request.state.permission_result = permission_result

                return await func(*args, **kwargs)

            return wrapper
        return decorator

    def require_permissions(
        self,
        permission_names: List[str],
        require_all: bool = True,
        resource_id_param: Optional[str] = None,
        resource_type_param: Optional[str] = None
    ):
        """
        Decorator to require multiple permissions for endpoint access

        Args:
            permission_names: List of required permission names
            require_all: Whether to require all permissions (True) or any (False)
            resource_id_param: Path parameter name for resource ID
            resource_type_param: Path parameter name for resource type
        """
        def decorator(func):
            @wraps(func)
            async def wrapper(*args, **kwargs):
                # Extract request and user from function arguments
                request = kwargs.get('request')
                current_user = kwargs.get('current_user')
                db = kwargs.get('db')

                if not request or not current_user:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Authentication required"
                    )

                # Superuser bypass
                if current_user.is_superuser:
                    return await func(*args, **kwargs)

                # Extract resource information
                resource_id = None
                resource_type = None

                if resource_id_param and resource_id_param in kwargs:
                    resource_id = kwargs[resource_id_param]

                if resource_type_param and resource_type_param in kwargs:
                    resource_type = kwargs[resource_type_param]

                # Create permission context
                context = PermissionCheckContext(
                    request_id=request.headers.get("X-Request-ID"),
                    ip_address=request.headers.get("X-Forwarded-For", request.client.host if request.client else None),
                    user_agent=request.headers.get("User-Agent"),
                    resource_id=resource_id,
                    resource_type=resource_type,
                    organization_id=str(current_user.organization_id) if current_user.organization_id else None,
                    additional_data={"path_params": kwargs}
                )

                # Check permissions
                permission_results = await self.authorization_service.check_permissions(
                    db,
                    str(current_user.id),
                    permission_names,
                    context=context,
                    resource_id=resource_id,
                    resource_type=resource_type,
                    require_all=require_all
                )

                # Check if required permissions are granted
                if require_all:
                    failed_permissions = [
                        perm_name for perm_name, result in permission_results.items()
                        if not result.granted
                    ]
                    if failed_permissions:
                        raise HTTPException(
                            status_code=status.HTTP_403_FORBIDDEN,
                            detail=f"Missing required permissions: {', '.join(failed_permissions)}"
                        )
                else:
                    granted_permissions = [
                        perm_name for perm_name, result in permission_results.items()
                        if result.granted
                    ]
                    if not granted_permissions:
                        raise HTTPException(
                            status_code=status.HTTP_403_FORBIDDEN,
                            detail="None of the required permissions are granted"
                        )

                # Add permission info to request state
                request.state.permission_results = permission_results

                return await func(*args, **kwargs)

            return wrapper
        return decorator

    def require_role(self, role_names: Union[str, List[str]], require_all: bool = True):
        """
        Decorator to require specific role(s) for endpoint access

        Args:
            role_names: Required role name(s)
            require_all: Whether to require all roles (True) or any (False)
        """
        def decorator(func):
            @wraps(func)
            async def wrapper(*args, **kwargs):
                # Extract request and user from function arguments
                request = kwargs.get('request')
                current_user = kwargs.get('current_user')
                db = kwargs.get('db')

                if not request or not current_user:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Authentication required"
                    )

                # Superuser bypass
                if current_user.is_superuser:
                    return await func(*args, **kwargs)

                # Normalize role names
                if isinstance(role_names, str):
                    target_roles = [role_names]
                else:
                    target_roles = role_names

                # Get user's roles
                user_roles = await self.authorization_service.get_user_roles(db, str(current_user.id))
                user_role_names = {role['name'] for role in user_roles}

                # Check if user has required roles
                if require_all:
                    if not all(role_name in user_role_names for role_name in target_roles):
                        missing_roles = [role for role in target_roles if role not in user_role_names]
                        raise HTTPException(
                            status_code=status.HTTP_403_FORBIDDEN,
                            detail=f"Missing required roles: {', '.join(missing_roles)}"
                        )
                else:
                    if not any(role_name in user_role_names for role_name in target_roles):
                        raise HTTPException(
                            status_code=status.HTTP_403_FORBIDDEN,
                            detail=f"Requires one of these roles: {', '.join(target_roles)}"
                        )

                # Add role info to request state
                request.state.user_roles = user_roles

                return await func(*args, **kwargs)

            return wrapper
        return decorator


# Create global instances
authorization_service = AuthorizationService()
rbac_decorator = RBACDecorator(authorization_service)

# Common decorators for frequently used permissions
require_user_read = rbac_decorator.require_permission("user:read")
require_user_manage = rbac_decorator.require_permission("user:manage")
require_role_manage = rbac_decorator.require_permission("role:manage")
require_workflow_read = rbac_decorator.require_permission("workflow:read")
require_workflow_manage = rbac_decorator.require_permission("workflow:manage")
require_workflow_execute = rbac_decorator.require_permission("workflow:execute")
require_document_read = rbac_decorator.require_permission("document:read")
require_document_manage = rbac_decorator.require_permission("document:manage")
require_agent_read = rbac_decorator.require_permission("agent:read")
require_agent_manage = rbac_decorator.require_permission("agent:manage")
require_agent_execute = rbac_decorator.require_permission("agent:execute")
require_system_monitor = rbac_decorator.require_permission("system:monitor")
require_system_config = rbac_decorator.require_permission("system:config")
require_infrastructure_manage = rbac_decorator.require_permission("infrastructure:manage")

# Role-based decorators
require_admin_role = rbac_decorator.require_role(["admin", "super_admin"], require_all=False)
require_manager_role = rbac_decorator.require_role(["manager", "admin", "super_admin"], require_all=False)
require_developer_role = rbac_decorator.require_role(["developer", "manager", "admin", "super_admin"], require_all=False)