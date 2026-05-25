"""
Tenant Middleware - Multi-tenant request isolation and context
Provides tenant isolation for all API requests and database operations
"""

import uuid
from typing import Optional, Callable, Any
from fastapi import Request, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
from sqlalchemy.orm import Session
from contextvars import ContextVar
import logging

from ..database import get_db
from ..models.tenant import Tenant
from ..services.tenant_service import TenantService

logger = logging.getLogger(__name__)

# Context variables for tenant isolation
tenant_context: ContextVar[Optional[Tenant]] = ContextVar('tenant', default=None)
tenant_id_context: ContextVar[Optional[uuid.UUID]] = ContextVar('tenant_id', default=None)
tenant_slug_context: ContextVar[Optional[str]] = ContextVar('tenant_slug', default=None)

class TenantMiddleware(BaseHTTPMiddleware):
    """
    Middleware to identify and isolate tenant for each request
    Extracts tenant information from subdomain, custom domain, or JWT token
    """

    def __init__(self, app, base_domain: str = "upm.plus"):
        super().__init__(app)
        self.base_domain = base_domain
        self.tenant_service = None

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """
        Process request to identify tenant and set up isolation
        """
        try:
            # Extract tenant from request
            tenant = await self._extract_tenant(request)

            if tenant:
                # Set tenant context
                await self._set_tenant_context(tenant)

                # Add tenant info to request state
                request.state.tenant = tenant
                request.state.tenant_id = tenant.id
                request.state.tenant_slug = tenant.slug

                # Log tenant request
                logger.info(f"Request for tenant: {tenant.slug} from {request.client.host}")

                # Check tenant status
                if not tenant.is_active:
                    logger.warning(f"Inactive tenant access attempt: {tenant.slug}")
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Tenant account is not active"
                    )

                # Check trial expiration
                if tenant.status == 'trial' and tenant.trial_days_remaining == 0:
                    logger.warning(f"Trial expired for tenant: {tenant.slug}")
                    raise HTTPException(
                        status_code=status.HTTP_402_PAYMENT_REQUIRED,
                        detail="Trial period has expired"
                    )

                # Update last activity
                tenant.last_activity_at = None  # Will be set to now in the model
                try:
                    db = next(get_db())
                    tenant_service = TenantService(db)
                    await tenant_service.update_tenant(
                        tenant.id,
                        {'last_activity_at': None},  # Model will set to now
                        None
                    )
                except Exception as e:
                    logger.error(f"Failed to update tenant activity: {str(e)}")
                finally:
                    if 'db' in locals():
                        db.close()

            else:
                # No tenant found - this could be a public endpoint
                logger.debug(f"No tenant identified for request: {request.url}")
                request.state.tenant = None
                request.state.tenant_id = None
                request.state.tenant_slug = None

            # Process request
            response = await call_next(request)

            # Add tenant headers to response
            if tenant:
                response.headers["X-Tenant-ID"] = str(tenant.id)
                response.headers["X-Tenant-Slug"] = tenant.slug
                response.headers["X-Tenant-Status"] = tenant.status

            return response

        except HTTPException:
            # Re-raise HTTP exceptions
            raise
        except Exception as e:
            logger.error(f"Tenant middleware error: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Internal server error during tenant identification"
            )

    async def _extract_tenant(self, request: Request) -> Optional[Tenant]:
        """
        Extract tenant from request using various methods
        """

        # Method 1: Extract from subdomain or custom domain
        tenant = await self._extract_tenant_from_domain(request)

        # Method 2: Extract from JWT token (if domain extraction fails)
        if not tenant:
            tenant = await self._extract_tenant_from_token(request)

        # Method 3: Extract from header (for API calls)
        if not tenant:
            tenant = await self._extract_tenant_from_header(request)

        return tenant

    async def _extract_tenant_from_domain(self, request: Request) -> Optional[Tenant]:
        """
        Extract tenant from request domain/subdomain
        """
        try:
            host = request.headers.get("host", "").lower()

            # Remove port if present
            if ':' in host:
                host = host.split(':')[0]

            # Skip if it's the base domain or localhost
            if host == self.base_domain or host == 'localhost' or host == '127.0.0.1':
                return None

            # Check for custom domain
            if host != f"api.{self.base_domain}" and not host.endswith(f".{self.base_domain}"):
                # This might be a custom domain
                return await self._get_tenant_by_domain(host)

            # Extract subdomain
            if host.endswith(f".{self.base_domain}"):
                subdomain = host.replace(f".{self.base_domain}", "")
                return await self._get_tenant_by_subdomain(subdomain)

            return None

        except Exception as e:
            logger.error(f"Error extracting tenant from domain: {str(e)}")
            return None

    async def _extract_tenant_from_token(self, request: Request) -> Optional[Tenant]:
        """
        Extract tenant from JWT token
        """
        try:
            # Get authorization header
            auth_header = request.headers.get("authorization")
            if not auth_header or not auth_header.startswith("Bearer "):
                return None

            # Extract token
            token = auth_header.split(" ")[1]

            # Decode token and extract tenant_id
            # This would integrate with your JWT decoding logic
            # For now, we'll simulate it
            import jwt
            from ..core.config import settings

            try:
                payload = jwt.decode(
                    token,
                    settings.SECRET_KEY,
                    algorithms=[settings.JWT_ALGORITHM]
                )

                tenant_id = payload.get("tenant_id")
                if tenant_id:
                    return await self._get_tenant_by_id(tenant_id)

            except jwt.PyJWTError:
                logger.debug("Invalid JWT token")
                return None

            return None

        except Exception as e:
            logger.error(f"Error extracting tenant from token: {str(e)}")
            return None

    async def _extract_tenant_from_header(self, request: Request) -> Optional[Tenant]:
        """
        Extract tenant from custom header (for API calls)
        """
        try:
            # Check for tenant header
            tenant_header = request.headers.get("X-Tenant-ID")
            if tenant_header:
                try:
                    tenant_id = uuid.UUID(tenant_header)
                    return await self._get_tenant_by_id(tenant_id)
                except ValueError:
                    logger.debug(f"Invalid tenant ID in header: {tenant_header}")
                    return None

            # Check for tenant slug header
            slug_header = request.headers.get("X-Tenant-Slug")
            if slug_header:
                return await self._get_tenant_by_slug(slug_header)

            return None

        except Exception as e:
            logger.error(f"Error extracting tenant from header: {str(e)}")
            return None

    async def _get_tenant_by_id(self, tenant_id: uuid.UUID) -> Optional[Tenant]:
        """Get tenant by ID"""
        try:
            db = next(get_db())
            tenant_service = TenantService(db)
            tenant = await tenant_service.get_tenant_by_id(tenant_id)
            db.close()
            return tenant
        except Exception as e:
            logger.error(f"Error getting tenant by ID: {str(e)}")
            return None

    async def _get_tenant_by_slug(self, slug: str) -> Optional[Tenant]:
        """Get tenant by slug"""
        try:
            db = next(get_db())
            tenant_service = TenantService(db)
            tenant = await tenant_service.get_tenant_by_slug(slug)
            db.close()
            return tenant
        except Exception as e:
            logger.error(f"Error getting tenant by slug: {str(e)}")
            return None

    async def _get_tenant_by_subdomain(self, subdomain: str) -> Optional[Tenant]:
        """Get tenant by subdomain"""
        try:
            db = next(get_db())
            tenant_service = TenantService(db)
            tenant = await tenant_service.get_tenant_by_subdomain(subdomain)
            db.close()
            return tenant
        except Exception as e:
            logger.error(f"Error getting tenant by subdomain: {str(e)}")
            return None

    async def _get_tenant_by_domain(self, domain: str) -> Optional[Tenant]:
        """Get tenant by custom domain"""
        try:
            db = next(get_db())
            tenant_service = TenantService(db)
            tenant = await tenant_service.get_tenant_by_domain(domain)
            db.close()
            return tenant
        except Exception as e:
            logger.error(f"Error getting tenant by domain: {str(e)}")
            return None

    async def _set_tenant_context(self, tenant: Tenant) -> None:
        """Set tenant context variables"""
        tenant_context.set(tenant)
        tenant_id_context.set(tenant.id)
        tenant_slug_context.set(tenant.slug)


# Helper functions for accessing tenant context
def get_current_tenant() -> Optional[Tenant]:
    """Get current tenant from context"""
    return tenant_context.get()


def get_current_tenant_id() -> Optional[uuid.UUID]:
    """Get current tenant ID from context"""
    return tenant_id_context.get()


def get_current_tenant_slug() -> Optional[str]:
    """Get current tenant slug from context"""
    return tenant_slug_context.get()


def require_tenant() -> Tenant:
    """Require tenant to be present, raise exception if not"""
    tenant = get_current_tenant()
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Tenant identification required"
        )
    return tenant


def require_active_tenant() -> Tenant:
    """Require tenant to be active"""
    tenant = require_tenant()
    if not tenant.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tenant account is not active"
        )
    return tenant


class TenantQueryMixin:
    """
    Mixin for database queries to automatically filter by tenant
    """

    @staticmethod
    def filter_by_tenant(query, tenant_id: Optional[uuid.UUID] = None):
        """Filter query by tenant ID"""
        if tenant_id is None:
            tenant_id = get_current_tenant_id()

        if tenant_id:
            return query.filter(Tenant.id == tenant_id)
        return query


def tenant_required(func: Callable) -> Callable:
    """
    Decorator to require tenant for endpoint
    """
    async def wrapper(*args, **kwargs):
        tenant = get_current_tenant()
        if not tenant:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Tenant identification required"
            )

        if not tenant.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Tenant account is not active"
            )

        return await func(*args, **kwargs)

    return wrapper


def tenant_feature_required(feature_name: str) -> Callable:
    """
    Decorator to require specific tenant feature
    """
    def decorator(func: Callable) -> Callable:
        async def wrapper(*args, **kwargs):
            tenant = require_active_tenant()

            if not tenant.has_feature(feature_name):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Feature '{feature_name}' is not available for your plan"
                )

            return await func(*args, **kwargs)

        return wrapper
    return decorator


def tenant_plan_required(min_plan: str) -> Callable:
    """
    Decorator to require minimum tenant plan
    """
    plan_hierarchy = {
        'free': 0,
        'starter': 1,
        'professional': 2,
        'enterprise': 3
    }

    def decorator(func: Callable) -> Callable:
        async def wrapper(*args, **kwargs):
            tenant = require_active_tenant()

            current_level = plan_hierarchy.get(tenant.plan, 0)
            required_level = plan_hierarchy.get(min_plan, 0)

            if current_level < required_level:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"This feature requires {min_plan} plan or higher"
                )

            return await func(*args, **kwargs)

        return wrapper
    return decorator


class TenantResourceLimiter:
    """
    Middleware for tenant resource limiting
    """

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        # Get request
        request = Request(scope, receive)

        # Check resource limits for API calls
        if request.url.path.startswith("/api/"):
            tenant = get_current_tenant()
            if tenant and not tenant.can_make_api_call():
                from starlette.responses import JSONResponse
                response = JSONResponse(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    content={"detail": "API rate limit exceeded"}
                )
                await response(scope, receive, send)
                return

        # Continue with request
        await self.app(scope, receive, send)