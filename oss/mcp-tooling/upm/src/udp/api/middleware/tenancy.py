"""
Multi-Tenant Middleware for FastAPI.

Provides tenant isolation, quota enforcement, and usage tracking
for all API requests across the Universal Dependency Platform.
"""

import logging
import time
from collections.abc import Callable
from typing import Optional
from uuid import UUID

from fastapi import HTTPException, Request, Response, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from udp.core.tenancy import tenant_manager

logger = logging.getLogger(__name__)


class TenantIsolationMiddleware(BaseHTTPMiddleware):
    """Middleware for enforcing tenant isolation and quota limits."""

    def __init__(self, app, exclude_paths: Optional[list] = None):
        super().__init__(app)
        self.exclude_paths = exclude_paths or [
            "/health/",
            "/docs",
            "/redoc",
            "/openapi.json",
            "/metrics"
        ]

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Process request with tenant isolation and quota enforcement."""
        start_time = time.time()

        # Skip tenant checks for excluded paths
        if self._should_skip_tenant_check(request):
            return await call_next(request)

        try:
            # Extract organization and user information
            organization_id, user_id = await self._extract_tenant_info(request)

            if not organization_id:
                return JSONResponse(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    content={"error": "Organization ID required"}
                )

            # Check tenant configuration
            tenant_config = await tenant_manager.get_tenant_config(organization_id)
            if not tenant_config:
                return JSONResponse(
                    status_code=status.HTTP_403_FORBIDDEN,
                    content={"error": "Invalid organization or tenant not initialized"}
                )

            # Check API quota
            if not await self._check_api_quota(organization_id, tenant_config):
                return JSONResponse(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    content={
                        "error": "API quota exceeded",
                        "retry_after": 3600  # 1 hour
                    }
                )

            # Enforce tenant isolation
            if not await self._enforce_tenant_isolation(
                organization_id, user_id, request
            ):
                return JSONResponse(
                    status_code=status.HTTP_403_FORBIDDEN,
                    content={"error": "Access denied - tenant isolation violation"}
                )

            # Add tenant context to request state
            request.state.organization_id = organization_id
            request.state.user_id = user_id
            request.state.tenant_config = tenant_config
            request.state.tenant_tier = tenant_config.tier

            # Process request
            response = await call_next(request)

            # Record usage metrics
            await self._record_usage_metrics(
                organization_id, request, response, time.time() - start_time
            )

            # Add tenant headers to response
            response.headers["X-Tenant-ID"] = str(organization_id)
            response.headers["X-Tenant-Tier"] = tenant_config.tier.value

            return response

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Tenant middleware error: {e}", exc_info=True)
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={"error": "Internal server error"}
            )

    def _should_skip_tenant_check(self, request: Request) -> bool:
        """Check if request should skip tenant validation."""
        path = request.url.path

        # Skip for excluded paths
        for exclude_path in self.exclude_paths:
            if path.startswith(exclude_path):
                return True

        # Skip for OPTIONS requests (CORS preflight)
        if request.method == "OPTIONS":
            return True

        return False

    async def _extract_tenant_info(self, request: Request) -> tuple[Optional[UUID], Optional[UUID]]:
        """Extract organization and user information from request."""
        organization_id = None
        user_id = None

        try:
            # Try to get from headers first
            org_header = request.headers.get("X-Organization-ID")
            if org_header:
                organization_id = UUID(org_header)

            user_header = request.headers.get("X-User-ID")
            if user_header:
                user_id = UUID(user_header)

            # Try to get from query parameters
            if not organization_id:
                org_param = request.query_params.get("organization_id")
                if org_param:
                    organization_id = UUID(org_param)

            # Try to get from path parameters
            if not organization_id and "organization_id" in request.path_params:
                organization_id = UUID(request.path_params["organization_id"])

            # In production, this would also:
            # 1. Validate JWT tokens
            # 2. Check user permissions
            # 3. Verify organization membership

        except (ValueError, TypeError) as e:
            logger.warning(f"Invalid tenant info in request: {e}")

        return organization_id, user_id

    async def _check_api_quota(
        self,
        organization_id: UUID,
        tenant_config
    ) -> bool:
        """Check if organization has API quota available."""
        try:
            # Check hourly quota
            hourly_quota_ok = await tenant_manager.check_quota(
                organization_id, "api_requests", 1
            )

            if not hourly_quota_ok:
                logger.warning(f"Hourly API quota exceeded for organization {organization_id}")
                return False

            # Check daily quota
            daily_quota_ok = await tenant_manager.check_quota(
                organization_id, "api_requests_daily", 1
            )

            if not daily_quota_ok:
                logger.warning(f"Daily API quota exceeded for organization {organization_id}")
                return False

            return True

        except Exception as e:
            logger.error(f"Failed to check API quota: {e}")
            return False

    async def _enforce_tenant_isolation(
        self,
        organization_id: UUID,
        user_id: Optional[UUID],
        request: Request
    ) -> bool:
        """Enforce tenant isolation for the request."""
        try:
            # Determine resource type from request path
            resource_type = self._get_resource_type_from_path(request.url.path)

            # Extract resource ID if present
            resource_id = None
            if "id" in request.path_params:
                try:
                    resource_id = UUID(request.path_params["id"])
                except (ValueError, TypeError):
                    pass

            # Enforce isolation
            return await tenant_manager.enforce_tenant_isolation(
                organization_id, user_id or UUID("00000000-0000-0000-0000-000000000000"),
                resource_type, resource_id
            )

        except Exception as e:
            logger.error(f"Failed to enforce tenant isolation: {e}")
            return False

    async def _record_usage_metrics(
        self,
        organization_id: UUID,
        request: Request,
        response: Response,
        duration: float
    ):
        """Record usage metrics for the request."""
        try:
            # Record API request
            await tenant_manager.record_usage(
                organization_id, "api_request", 1
            )

            # Record failed request if applicable
            if response.status_code >= 400:
                await tenant_manager.record_usage(
                    organization_id, "api_request_failure", 1
                )

            # Record specific resource usage based on endpoint
            resource_type = self._get_resource_type_from_path(request.url.path)
            if resource_type:
                await tenant_manager.record_usage(
                    organization_id, resource_type, 1
                )

            logger.debug(
                f"Recorded usage for organization {organization_id}: "
                f"{request.method} {request.url.path} - {response.status_code} "
                f"({duration:.3f}s)"
            )

        except Exception as e:
            logger.error(f"Failed to record usage metrics: {e}")

    def _get_resource_type_from_path(self, path: str) -> Optional[str]:
        """Determine resource type from request path."""
        if "/workflows/" in path:
            return "workflow_execution"
        elif "/dependencies/" in path:
            return "dependency_analysis"
        elif "/marketplace/" in path:
            return "marketplace_access"
        elif "/analytics/" in path:
            return "analytics_access"
        elif "/policies/" in path:
            return "policy_management"
        elif "/organizations/" in path:
            return "organization_management"
        elif "/reporting/" in path:
            return "reporting_access"
        else:
            return None


class TenantContextMiddleware(BaseHTTPMiddleware):
    """Middleware for adding tenant context to requests."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Add tenant context to request state."""
        try:
            # Initialize tenant context
            request.state.tenant_context = {
                "organization_id": getattr(request.state, "organization_id", None),
                "user_id": getattr(request.state, "user_id", None),
                "tenant_config": getattr(request.state, "tenant_config", None),
                "tenant_tier": getattr(request.state, "tenant_tier", None),
                "request_start_time": time.time()
            }

            response = await call_next(request)

            # Add tenant context to response headers
            if hasattr(request.state, "organization_id"):
                response.headers["X-Tenant-Context"] = "active"

            return response

        except Exception as e:
            logger.error(f"Tenant context middleware error: {e}", exc_info=True)
            return await call_next(request)


class QuotaEnforcementMiddleware(BaseHTTPMiddleware):
    """Middleware for enforcing resource quotas."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Enforce quotas before processing request."""
        try:
            # Skip quota enforcement for certain paths
            if self._should_skip_quota_check(request):
                return await call_next(request)

            organization_id = getattr(request.state, "organization_id", None)
            if not organization_id:
                return await call_next(request)

            # Check quotas based on request type
            quota_ok = await self._check_request_quotas(organization_id, request)
            if not quota_ok:
                return JSONResponse(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    content={
                        "error": "Resource quota exceeded",
                        "retry_after": 3600
                    }
                )

            return await call_next(request)

        except Exception as e:
            logger.error(f"Quota enforcement middleware error: {e}", exc_info=True)
            return await call_next(request)

    def _should_skip_quota_check(self, request: Request) -> bool:
        """Check if request should skip quota validation."""
        skip_paths = ["/health/", "/docs", "/redoc", "/openapi.json", "/metrics"]
        return any(request.url.path.startswith(path) for path in skip_paths)

    async def _check_request_quotas(
        self,
        organization_id: UUID,
        request: Request
    ) -> bool:
        """Check quotas for specific request types."""
        try:
            path = request.url.path
            method = request.method

            # Check workflow execution quota
            if "/workflows/" in path and method == "POST":
                return await tenant_manager.check_quota(
                    organization_id, "workflow_execution", 1
                )

            # Check dependency analysis quota
            elif "/dependencies/analyze" in path and method == "POST":
                return await tenant_manager.check_quota(
                    organization_id, "dependency_analysis", 1
                )

            # Check marketplace purchase quota
            elif "/marketplace/" in path and "purchase" in path and method == "POST":
                return await tenant_manager.check_quota(
                    organization_id, "marketplace_purchase", 1
                )

            # Check security scan quota
            elif "/security/scan" in path and method == "POST":
                return await tenant_manager.check_quota(
                    organization_id, "security_scan", 1
                )

            # Default: allow request
            return True

        except Exception as e:
            logger.error(f"Failed to check request quotas: {e}")
            return False
