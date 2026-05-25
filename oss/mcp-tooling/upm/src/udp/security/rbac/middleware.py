"""
RBAC middleware for FastAPI applications.

This module provides middleware components for integrating RBAC
with FastAPI endpoints, including automatic permission checking
and role-based access control.
"""

from collections.abc import Callable
from typing import Optional

import structlog
from fastapi import HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
from udp.core.models.rbac import ResourceType
from udp.core.models.user import User
from udp.security.auth import get_current_user

from .exceptions import PermissionDeniedError, RBACError
from .rbac_service import RBACService

logger = structlog.get_logger()
security = HTTPBearer(auto_error=False)


class RBACMiddleware(BaseHTTPMiddleware):
    """
    RBAC middleware for FastAPI applications.

    This middleware automatically checks permissions for protected endpoints
    based on endpoint configuration or route patterns.
    """

    def __init__(
        self,
        app,
        rbac_service: RBACService,
        public_paths: Optional[list[str]] = None,
        permission_extractor: Optional[Callable[[Request], dict]] = None,
    ):
        """
        Initialize RBAC middleware.

        Args:
            app: FastAPI application
            rbac_service: RBAC service instance
            public_paths: List of paths that don't require authentication
            permission_extractor: Function to extract permission requirements from request
        """
        super().__init__(app)
        self.rbac_service = rbac_service
        self.public_paths = public_paths or [
            "/health",
            "/metrics",
            "/docs",
            "/openapi.json",
            "/auth/login",
            "/auth/register",
            "/auth/refresh",
        ]
        self.permission_extractor = (
            permission_extractor or self._default_permission_extractor
        )

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """
        Process request through RBAC middleware.

        Args:
            request: Incoming request
            call_next: Next middleware in chain

        Returns:
            HTTP response

        Raises:
            HTTPException: If authentication or authorization fails
        """
        # Check if path is public
        if self._is_public_path(request.url.path):
            return await call_next(request)

        # Get user from token
        user = await self._get_user_from_request(request)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Not authenticated",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Store user in request state
        request.state.user = user

        # Get permission requirements
        permission_req = self.permission_extractor(request)

        # Check permissions if required
        if permission_req:
            db = getattr(request.state, "db", None)
            if not db:
                # Try to get database session from app state
                db = request.app.state.get("db")

            if not db:
                logger.error(
                    "No database session available for permission check",
                    path=request.url.path,
                    user_id=user.id,
                )
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Internal server error",
                )

            try:
                await self._check_permissions(db, user, permission_req, request)
            except PermissionDeniedError as e:
                logger.warning(
                    "Permission denied",
                    user_id=user.id,
                    path=request.url.path,
                    permission=e.permission,
                    resource_type=e.resource_type,
                    resource_id=e.resource_id,
                )
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=str(e),
                )
            except RBACError as e:
                logger.error(
                    "RBAC error during permission check",
                    user_id=user.id,
                    path=request.url.path,
                    error=str(e),
                )
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Authorization error",
                )

        # Continue with request
        return await call_next(request)

    def _is_public_path(self, path: str) -> bool:
        """Check if path is public."""
        # Check exact matches
        if path in self.public_paths:
            return True

        # Check prefix matches
        for public_path in self.public_paths:
            if public_path.endswith("*"):
                if path.startswith(public_path[:-1]):
                    return True

        return False

    async def _get_user_from_request(self, request: Request) -> Optional[User]:
        """Get user from request token."""
        try:
            # Get authorization header
            auth: Optional[HTTPAuthorizationCredentials] = await security(request)
            if not auth:
                return None

            # Get database session
            db = getattr(request.state, "db", None)
            if not db:
                return None

            # Verify token and get user
            user = await get_current_user(db, auth.credentials)
            return user

        except Exception as e:
            logger.debug(
                "Failed to get user from request",
                path=request.url.path,
                error=str(e),
            )
            return None

    def _default_permission_extractor(self, request: Request) -> Optional[dict]:
        """
        Extract permission requirements from request.

        This default implementation extracts permissions from route
        configuration or uses path-based patterns.

        Args:
            request: Incoming request

        Returns:
            Permission requirement dict or None
        """
        # Check if route has RBAC configuration
        if hasattr(request.state, "rbac_requirements"):
            return request.state.rbac_requirements

        # Use path-based permission extraction
        path = request.url.path
        method = request.method

        # Extract resource type and ID from path
        parts = path.strip("/").split("/")
        if len(parts) >= 2:
            resource_type_str = parts[0]
            resource_id = parts[1] if len(parts) > 1 else None

            # Map path parts to resource types
            resource_type_mapping = {
                "projects": ResourceType.PROJECT,
                "users": ResourceType.USER,
                "organizations": ResourceType.ORGANIZATION,
                "dependencies": ResourceType.DEPENDENCY,
                "vulnerabilities": ResourceType.VULNERABILITY,
                "analyses": ResourceType.ANALYSIS,
                "builds": ResourceType.BUILD,
                "repositories": ResourceType.REPOSITORY,
                "policies": ResourceType.POLICY,
                "roles": ResourceType.ROLE,
            }

            resource_type = resource_type_mapping.get(resource_type_str)

            if resource_type:
                # Determine required permission based on HTTP method
                action_mapping = {
                    "GET": "read",
                    "POST": "create",
                    "PUT": "update",
                    "PATCH": "update",
                    "DELETE": "delete",
                }

                action = action_mapping.get(method, "read")

                return {
                    "permission_code": f"{resource_type_str}.{action}",
                    "resource_type": resource_type,
                    "resource_id": resource_id
                    if resource_id
                    and resource_id.replace("-", "").replace("_", "").isalnum()
                    else None,
                }

        return None

    async def _check_permissions(
        self,
        db: AsyncSession,
        user: User,
        permission_req: dict,
        request: Request,
    ) -> None:
        """
        Check if user has required permissions.

        Args:
            db: Database session
            user: User to check
            permission_req: Permission requirement dict
            request: Current request

        Raises:
            PermissionDeniedError: If user doesn't have permission
        """
        permission_code = permission_req.get("permission_code")
        resource_type = permission_req.get("resource_type")
        resource_id = permission_req.get("resource_id")
        organization_id = permission_req.get("organization_id")
        project_id = permission_req.get("project_id")

        # Extract organization/project from request if not provided
        if not organization_id or not project_id:
            # Try to extract from path parameters
            if hasattr(request, "path_params"):
                if not organization_id:
                    organization_id = request.path_params.get("organization_id")
                if not project_id:
                    project_id = request.path_params.get("project_id")

            # Try to extract from query parameters
            if not organization_id:
                organization_id = request.query_params.get("organization_id")
            if not project_id:
                project_id = request.query_params.get("project_id")

        # Check permission
        await self.rbac_service.require_permission(
            db=db,
            user=user,
            permission_code=permission_code,
            resource_type=resource_type,
            resource_id=resource_id,
            organization_id=organization_id,
            project_id=project_id,
        )


class RBACRouteConfig:
    """
    Configuration for RBAC on specific routes.
    """

    def __init__(
        self,
        permissions: Optional[list[str]] = None,
        resource_type: Optional[ResourceType] = None,
        resource_id_param: Optional[str] = None,
        organization_id_param: Optional[str] = None,
        project_id_param: Optional[str] = None,
        require_all: bool = True,
    ):
        """
        Initialize RBAC route configuration.

        Args:
            permissions: List of required permissions
            resource_type: Type of resource
            resource_id_param: Path parameter name for resource ID
            organization_id_param: Path parameter name for organization ID
            project_id_param: Path parameter name for project ID
            require_all: Whether all permissions are required (True) or any (False)
        """
        self.permissions = permissions or []
        self.resource_type = resource_type
        self.resource_id_param = resource_id_param
        self.organization_id_param = organization_id_param
        self.project_id_param = project_id_param
        self.require_all = require_all

    def extract_requirements(self, request: Request) -> Optional[dict]:
        """
        Extract permission requirements from request.

        Args:
            request: Incoming request

        Returns:
            Permission requirement dict
        """
        if not self.permissions:
            return None

        # Extract IDs from path parameters
        resource_id = None
        organization_id = None
        project_id = None

        if hasattr(request, "path_params"):
            if self.resource_id_param:
                resource_id = request.path_params.get(self.resource_id_param)
            if self.organization_id_param:
                organization_id = request.path_params.get(self.organization_id_param)
            if self.project_id_param:
                project_id = request.path_params.get(self.project_id_param)

        # For single permission, return direct requirement
        if len(self.permissions) == 1:
            return {
                "permission_code": self.permissions[0],
                "resource_type": self.resource_type,
                "resource_id": resource_id,
                "organization_id": organization_id,
                "project_id": project_id,
            }

        # For multiple permissions, return list
        return {
            "permissions": self.permissions,
            "resource_type": self.resource_type,
            "resource_id": resource_id,
            "organization_id": organization_id,
            "project_id": project_id,
            "require_all": self.require_all,
        }


def require_permissions(
    permissions: list[str],
    resource_type: Optional[ResourceType] = None,
    resource_id_param: Optional[str] = None,
    organization_id_param: Optional[str] = None,
    project_id_param: Optional[str] = None,
    require_all: bool = True,
):
    """
    Decorator for requiring permissions on FastAPI endpoints.

    This decorator configures RBAC requirements for specific endpoints.

    Args:
        permissions: List of required permission codes
        resource_type: Type of resource
        resource_id_param: Path parameter containing resource ID
        organization_id_param: Path parameter containing organization ID
        project_id_param: Path parameter containing project ID
        require_all: Whether all permissions are required (True) or any (False)

    Returns:
        Decorator function

    Example:
        @app.post("/projects/{project_id}")
        @require_permissions(
            permissions=["project.update"],
            resource_type=ResourceType.PROJECT,
            resource_id_param="project_id",
        )
        async def update_project(project_id: str, ...):
            ...
    """

    def decorator(func):
        # Store RBAC configuration on the function
        func._rbac_config = RBACRouteConfig(
            permissions=permissions,
            resource_type=resource_type,
            resource_id_param=resource_id_param,
            organization_id_param=organization_id_param,
            project_id_param=project_id_param,
            require_all=require_all,
        )
        return func

    return decorator


def require_role(
    role_code: str,
    organization_id_param: Optional[str] = None,
    project_id_param: Optional[str] = None,
):
    """
    Decorator for requiring a specific role.

    This is a convenience decorator for role-based access control.

    Args:
        role_code: Required role code
        organization_id_param: Path parameter containing organization ID
        project_id_param: Path parameter containing project ID

    Returns:
        Decorator function

    Example:
        @app.delete("/projects/{project_id}")
        @require_role("admin", project_id_param="project_id")
        async def delete_project(project_id: str, ...):
            ...
    """

    def decorator(func):
        # Store role requirement on the function
        func._rbac_role_requirement = {
            "role_code": role_code,
            "organization_id_param": organization_id_param,
            "project_id_param": project_id_param,
        }
        return func

    return decorator


def configure_route_rbac(request: Request, func: Callable) -> None:
    """
    Configure RBAC requirements for a route based on function decorators.

    This helper function should be called in route handlers to apply
    RBAC configuration from decorators.

    Args:
        request: Current request
        func: Route handler function
    """
    # Check for permission requirements
    if hasattr(func, "_rbac_config"):
        config = func._rbac_config
        requirements = config.extract_requirements(request)
        if requirements:
            request.state.rbac_requirements = requirements

    # Check for role requirements
    elif hasattr(func, "_rbac_role_requirement"):
        role_req = func._rbac_role_requirement

        # Get IDs from path parameters
        organization_id = None
        project_id = None

        if hasattr(request, "path_params"):
            if role_req.get("organization_id_param"):
                organization_id = request.path_params.get(
                    role_req["organization_id_param"]
                )
            if role_req.get("project_id_param"):
                project_id = request.path_params.get(role_req["project_id_param"])

        # Convert role requirement to permission requirement
        # This is a simplified approach - in practice, you might want to
        # check role hierarchy or use a more sophisticated mechanism
        request.state.rbac_requirements = {
            "permission_code": f"role.{role_req['role_code']}",
            "organization_id": organization_id,
            "project_id": project_id,
        }
