"""
Usage Tracking Middleware

Tracks API usage for billing and analytics purposes.
"""

import logging
import time
import uuid
from datetime import datetime, timezone
from typing import Callable

from fastapi import Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.services.billing_service import BillingService, UsageMetric
from app.core.redis import redis_client

logger = logging.getLogger(__name__)


class UsageTrackingMiddleware:
    """Middleware to track API usage for billing"""

    def __init__(self):
        self.redis_client = None

    async def __call__(self, request: Request, call_next: Callable) -> Response:
        """Track request usage"""
        start_time = time.time()
        request_id = str(uuid.uuid4())

        # Skip tracking for health checks and static files
        if self._should_skip_tracking(request):
            return await call_next(request)

        # Get user from request state (set by auth middleware)
        user = getattr(request.state, "user", None)
        if not user:
            return await call_next(request)

        try:
            # Track API request
            await self._track_api_request(user.id, request, request_id)

            # Process request
            response = await call_next(request)

            # Calculate response time
            response_time_ms = (time.time() - start_time) * 1000

            # Track response
            await self._track_response(
                user.id, request, response, request_id, response_time_ms
            )

            return response

        except Exception as e:
            logger.error(f"Usage tracking error: {e}")
            # Continue even if tracking fails
            return await call_next(request)

    def _should_skip_tracking(self, request: Request) -> bool:
        """Check if request should skip tracking"""
        skip_paths = [
            "/health",
            "/metrics",
            "/docs",
            "/redoc",
            "/openapi.json",
            "/favicon.ico"
        ]
        return any(request.url.path.startswith(path) for path in skip_paths)

    async def _track_api_request(
        self, user_id: uuid.UUID, request: Request, request_id: str
    ):
        """Track API request"""
        try:
            # Increment API request counter
            now = datetime.now(timezone.utc)
            period_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            key = f"usage:{user_id}:{UsageMetric.API_REQUESTS.value}:{period_start.isoformat()}"

            await redis_client.incr(key)
            await redis_client.expire(key, 86400 * 32)  # Expire after billing period

        except Exception as e:
            logger.warning(f"Failed to track API request: {e}")

    async def _track_response(
        self,
        user_id: uuid.UUID,
        request: Request,
        response: Response,
        request_id: str,
        response_time_ms: float
    ):
        """Track response metrics"""
        try:
            # Track specific metrics based on endpoint
            endpoint = request.url.path

            if "/workflows" in endpoint and request.method == "POST":
                # Track workflow execution
                await self._track_metric(user_id, UsageMetric.WORKFLOW_EXECUTIONS, 1)

            elif "/browser" in endpoint and "/sessions" in endpoint:
                # Track browser session
                await self._track_metric(user_id, UsageMetric.BROWSER_SESSIONS, 1)

            elif "/agents" in endpoint and "/execute" in endpoint:
                # Track agent execution
                await self._track_metric(user_id, UsageMetric.AGENT_EXECUTIONS, 1)

            elif "/documents" in endpoint and "/process" in endpoint:
                # Track document processing
                await self._track_metric(user_id, UsageMetric.DOCUMENT_PROCESSING, 1)

        except Exception as e:
            logger.warning(f"Failed to track response: {e}")

    async def _track_metric(
        self, user_id: uuid.UUID, metric: UsageMetric, quantity: int
    ):
        """Track a specific usage metric"""
        try:
            now = datetime.now(timezone.utc)
            period_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            key = f"usage:{user_id}:{metric.value}:{period_start.isoformat()}"

            # Use incr with amount parameter
            for _ in range(quantity):
                await redis_client.incr(key)
            await redis_client.expire(key, 86400 * 32)

        except Exception as e:
            logger.warning(f"Failed to track metric {metric.value}: {e}")


# Global middleware instance
usage_tracking_middleware = UsageTrackingMiddleware()

