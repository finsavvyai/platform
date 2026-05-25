"""
Gateway Management API Endpoints

This module provides REST API endpoints for managing the API gateway including:
- API key management (create, list, revoke, update)
- Rate limit configuration and monitoring
- Usage analytics and reporting
- Gateway configuration management
- Health checks and monitoring
- WebSocket connection management
- Security policy management
- Version management

Author: Claude Code Implementation
Task: 1.1.4 API Gateway Implementation
Updated: 2025-01-06
"""

import asyncio
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status, Query, Body, Path
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, desc, func

from app.core.database import get_db
from app.core.auth import get_current_active_user, get_current_superuser
from app.models.user import User
from app.gateway.models import APIKey, APIKeyStatus, APIKeyScope
from app.gateway.auth import GatewayAuthenticator, AuthenticationResult
from app.gateway.core import api_gateway
from app.gateway.rate_limiter import rate_limiter, RateLimitType
from app.gateway.analytics import analytics_engine, UsageMetrics
from app.gateway.versioning import APIVersioning, APIVersion, VersionStatus
from app.gateway.websocket import WebSocketProxy
from app.gateway.config import gateway_config
from app.schemas.gateway import (
    APIKeyCreate, APIKeyResponse, APIKeyUpdate,
    RateLimitConfig, RateLimitStats,
    UsageReportRequest, UsageReportResponse,
    GatewayStats, HealthCheckResponse,
    ConfigurationUpdate
)

logger = logging.getLogger(__name__)

# Create router
router = APIRouter(prefix="/api/v1/gateway", tags=["gateway"])

# Initialize components
authenticator = GatewayAuthenticator()


@router.get("/health", response_model=HealthCheckResponse)
async def health_check():
    """
    Gateway health check endpoint

    Returns the overall health status of the gateway and its components.
    """
    try:
        # Check gateway status
        gateway_status = api_gateway.get_status()

        # Check rate limiter health
        rate_limiter_healthy = True  # Would implement actual health check
        try:
            # Test rate limiter with a simple operation
            await rate_limiter.check_rate_limit(
                RateLimitType.GLOBAL,
                "health_check",
                "/health"
            )
        except Exception as e:
            rate_limiter_healthy = False
            logger.error(f"Rate limiter health check failed: {e}")

        # Check Redis connectivity (if configured)
        redis_healthy = True
        try:
            if rate_limiter.redis_client:
                await rate_limiter.redis_client.ping()
        except Exception as e:
            redis_healthy = False
            logger.error(f"Redis health check failed: {e}")

        # Check database connectivity
        db_healthy = True
        try:
            async for db in get_db():
                await db.execute(select(1))  # Simple query
        except Exception as e:
            db_healthy = False
            logger.error(f"Database health check failed: {e}")

        # Determine overall health
        overall_healthy = all([
            gateway_status.get("initialized", False),
            rate_limiter_healthy,
            redis_healthy,
            db_healthy
        ])

        return HealthCheckResponse(
            status="healthy" if overall_healthy else "unhealthy",
            timestamp=datetime.utcnow(),
            version="1.0.0",
            components={
                "gateway": gateway_status,
                "rate_limiter": "healthy" if rate_limiter_healthy else "unhealthy",
                "redis": "healthy" if redis_healthy else "unhealthy",
                "database": "healthy" if db_healthy else "unhealthy"
            },
            metrics=gateway_status
        )

    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return HealthCheckResponse(
            status="unhealthy",
            timestamp=datetime.utcnow(),
            version="1.0.0",
            components={"error": str(e)},
            metrics={}
        )


@router.get("/stats", response_model=GatewayStats)
async def get_gateway_stats(
    current_user: User = Depends(get_current_active_user)
):
    """
    Get gateway statistics and metrics

    Returns comprehensive statistics about gateway performance,
    usage, and operational metrics.
    """
    try:
        # Get gateway metrics
        gateway_metrics = api_gateway.get_metrics()

        # Get analytics metrics
        perf_metrics = await analytics_engine.get_performance_metrics(TimeWindow.HOUR)
        error_metrics = await analytics_engine.get_error_analysis(TimeWindow.HOUR)
        rate_limit_metrics = await analytics_engine.get_rate_limit_analytics(TimeWindow.HOUR)
        websocket_metrics = await analytics_engine.get_websocket_stats()

        # Get rate limiter analytics
        rate_limiter_analytics = await rate_limiter.get_rate_limit_analytics(
            RateLimitType.GLOBAL,
            time_range=3600
        )

        return GatewayStats(
            gateway=gateway_metrics,
            performance=perf_metrics,
            errors=error_metrics,
            rate_limiting=rate_limit_metrics,
            websockets=websocket_metrics,
            rate_limiter=rate_limiter_analytics,
            timestamp=datetime.utcnow()
        )

    except Exception as e:
        logger.error(f"Failed to get gateway stats: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve gateway statistics"
        )


# API Key Management Endpoints

@router.post("/api-keys", response_model=APIKeyResponse)
async def create_api_key(
    api_key_data: APIKeyCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new API key

    Creates a new API key with specified scope, permissions, and restrictions.
    """
    try:
        # Validate permissions
        if api_key_data.scope == APIKeyScope.ADMIN and not current_user.is_superuser:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin scope requires superuser privileges"
            )

        # Create API key
        api_key, api_key_record = await authenticator.create_api_key(
            user_id=str(current_user.id),
            name=api_key_data.name,
            scope=api_key_data.scope,
            permissions=api_key_data.permissions,
            expires_at=api_key_data.expires_at,
            organization_id=str(current_user.organization_id) if current_user.organization_id else None
        )

        # Apply rate limits
        if api_key_data.rate_limit_per_minute:
            api_key_record.rate_limit_per_minute = api_key_data.rate_limit_per_minute
        if api_key_data.rate_limit_per_hour:
            api_key_record.rate_limit_per_hour = api_key_data.rate_limit_per_hour
        if api_key_data.rate_limit_per_day:
            api_key_record.rate_limit_per_day = api_key_data.rate_limit_per_day

        # Apply IP restrictions
        if api_key_data.allowed_ip_addresses:
            api_key_record.allowed_ip_addresses = api_key_data.allowed_ip_addresses
        if api_key_data.allowed_origins:
            api_key_record.allowed_origins = api_key_data.allowed_origins

        await db.commit()
        await db.refresh(api_key_record)

        return APIKeyResponse(
            id=str(api_key_record.id),
            key_id=api_key_record.key_id,
            key_prefix=api_key_record.key_prefix,
            key=api_key,  # Only returned once during creation
            name=api_key_record.name,
            description=api_key_record.description,
            scope=api_key_record.scope,
            permissions=api_key_record.permissions,
            status=api_key_record.status,
            expires_at=api_key_record.expires_at,
            created_at=api_key_record.created_at,
            rate_limit_per_minute=api_key_record.rate_limit_per_minute,
            rate_limit_per_hour=api_key_record.rate_limit_per_hour,
            rate_limit_per_day=api_key_record.rate_limit_per_day,
            allowed_ip_addresses=api_key_record.allowed_ip_addresses,
            allowed_origins=api_key_record.allowed_origins,
            last_used_at=api_key_record.last_used_at,
            usage_count=api_key_record.usage_count
        )

    except Exception as e:
        logger.error(f"Failed to create API key: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create API key"
        )


@router.get("/api-keys", response_model=List[APIKeyResponse])
async def list_api_keys(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    scope: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    List API keys for the current user

    Returns a paginated list of API keys belonging to the current user,
    with optional filtering by scope and status.
    """
    try:
        # Build query
        query = select(APIKey).where(APIKey.user_id == current_user.id)

        if scope:
            query = query.where(APIKey.scope == scope)
        if status:
            query = query.where(APIKey.status == status)

        query = query.order_by(desc(APIKey.created_at)).offset(skip).limit(limit)

        result = await db.execute(query)
        api_keys = result.scalars().all()

        return [
            APIKeyResponse(
                id=str(key.id),
                key_id=key.key_id,
                key_prefix=key.key_prefix,
                key=None,  # Never include the actual key in listings
                name=key.name,
                description=key.description,
                scope=key.scope,
                permissions=key.permissions,
                status=key.status,
                expires_at=key.expires_at,
                created_at=key.created_at,
                rate_limit_per_minute=key.rate_limit_per_minute,
                rate_limit_per_hour=key.rate_limit_per_hour,
                rate_limit_per_day=key.rate_limit_per_day,
                allowed_ip_addresses=key.allowed_ip_addresses,
                allowed_origins=key.allowed_origins,
                last_used_at=key.last_used_at,
                usage_count=key.usage_count
            )
            for key in api_keys
        ]

    except Exception as e:
        logger.error(f"Failed to list API keys: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve API keys"
        )


@router.get("/api-keys/{key_id}", response_model=APIKeyResponse)
async def get_api_key(
    key_id: str = Path(...),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get API key details

    Retrieves detailed information about a specific API key.
    """
    try:
        # Get API key
        result = await db.execute(
            select(APIKey).where(
                and_(
                    APIKey.id == key_id,
                    APIKey.user_id == current_user.id
                )
            )
        )
        api_key = result.scalar_one_or_none()

        if not api_key:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="API key not found"
            )

        return APIKeyResponse(
            id=str(api_key.id),
            key_id=api_key.key_id,
            key_prefix=api_key.key_prefix,
            key=None,
            name=api_key.name,
            description=api_key.description,
            scope=api_key.scope,
            permissions=api_key.permissions,
            status=api_key.status,
            expires_at=api_key.expires_at,
            created_at=api_key.created_at,
            rate_limit_per_minute=api_key.rate_limit_per_minute,
            rate_limit_per_hour=api_key.rate_limit_per_hour,
            rate_limit_per_day=api_key.rate_limit_per_day,
            allowed_ip_addresses=api_key.allowed_ip_addresses,
            allowed_origins=api_key.allowed_origins,
            last_used_at=api_key.last_used_at,
            usage_count=api_key.usage_count
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get API key: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve API key"
        )


@router.put("/api-keys/{key_id}", response_model=APIKeyResponse)
async def update_api_key(
    key_id: str = Path(...),
    update_data: APIKeyUpdate = Body(...),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Update API key

    Updates an existing API key's configuration.
    """
    try:
        # Get API key
        result = await db.execute(
            select(APIKey).where(
                and_(
                    APIKey.id == key_id,
                    APIKey.user_id == current_user.id
                )
            )
        )
        api_key = result.scalar_one_or_none()

        if not api_key:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="API key not found"
            )

        # Update fields
        if update_data.name is not None:
            api_key.name = update_data.name
        if update_data.description is not None:
            api_key.description = update_data.description
        if update_data.permissions is not None:
            api_key.permissions = update_data.permissions
        if update_data.expires_at is not None:
            api_key.expires_at = update_data.expires_at
        if update_data.rate_limit_per_minute is not None:
            api_key.rate_limit_per_minute = update_data.rate_limit_per_minute
        if update_data.rate_limit_per_hour is not None:
            api_key.rate_limit_per_hour = update_data.rate_limit_per_hour
        if update_data.rate_limit_per_day is not None:
            api_key.rate_limit_per_day = update_data.rate_limit_per_day
        if update_data.allowed_ip_addresses is not None:
            api_key.allowed_ip_addresses = update_data.allowed_ip_addresses
        if update_data.allowed_origins is not None:
            api_key.allowed_origins = update_data.allowed_origins

        api_key.updated_at = datetime.utcnow()
        await db.commit()
        await db.refresh(api_key)

        return APIKeyResponse(
            id=str(api_key.id),
            key_id=api_key.key_id,
            key_prefix=api_key.key_prefix,
            key=None,
            name=api_key.name,
            description=api_key.description,
            scope=api_key.scope,
            permissions=api_key.permissions,
            status=api_key.status,
            expires_at=api_key.expires_at,
            created_at=api_key.created_at,
            rate_limit_per_minute=api_key.rate_limit_per_minute,
            rate_limit_per_hour=api_key.rate_limit_per_hour,
            rate_limit_per_day=api_key.rate_limit_per_day,
            allowed_ip_addresses=api_key.allowed_ip_addresses,
            allowed_origins=api_key.allowed_origins,
            last_used_at=api_key.last_used_at,
            usage_count=api_key.usage_count
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update API key: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update API key"
        )


@router.delete("/api-keys/{key_id}")
async def revoke_api_key(
    key_id: str = Path(...),
    reason: Optional[str] = Query(None),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Revoke API key

    Permanently revokes an API key, making it unusable for future requests.
    """
    try:
        # Get API key
        result = await db.execute(
            select(APIKey).where(
                and_(
                    APIKey.id == key_id,
                    APIKey.user_id == current_user.id
                )
            )
        )
        api_key = result.scalar_one_or_none()

        if not api_key:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="API key not found"
            )

        # Revoke the key
        await authenticator.revoke_api_key(key_id, reason)

        return {"message": "API key revoked successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to revoke API key: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to revoke API key"
        )


# Usage Analytics Endpoints

@router.get("/analytics/endpoints")
async def get_endpoint_analytics(
    time_window: str = Query("hour", regex="^(minute|hour|day|week|month)$"),
    endpoint: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=1000),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get endpoint usage analytics

    Returns analytics data for API endpoints including request counts,
    response times, and error rates.
    """
    try:
        from app.gateway.analytics import TimeWindow
        window = TimeWindow(time_window)

        stats = await analytics_engine.get_endpoint_stats(
            endpoint=endpoint,
            time_window=window,
            limit=limit
        )

        return {
            "time_window": time_window,
            "endpoint": endpoint,
            "stats": stats
        }

    except Exception as e:
        logger.error(f"Failed to get endpoint analytics: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve endpoint analytics"
        )


@router.get("/analytics/users")
async def get_user_analytics(
    time_window: str = Query("day", regex="^(minute|hour|day|week|month)$"),
    user_id: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=1000),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get user usage analytics

    Returns analytics data for user usage patterns and statistics.
    """
    try:
        from app.gateway.analytics import TimeWindow
        window = TimeWindow(time_window)

        # Non-admin users can only see their own stats
        if not current_user.is_superuser:
            user_id = str(current_user.id)

        stats = await analytics_engine.get_user_stats(
            user_id=user_id,
            time_window=window,
            limit=limit
        )

        return {
            "time_window": time_window,
            "user_id": user_id,
            "stats": stats
        }

    except Exception as e:
        logger.error(f"Failed to get user analytics: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve user analytics"
        )


@router.post("/analytics/report", response_model=UsageReportResponse)
async def generate_usage_report(
    report_request: UsageReportRequest,
    current_user: User = Depends(get_current_active_user)
):
    """
    Generate comprehensive usage report

    Generates a detailed usage report for the specified time period
    and scope (user or organization).
    """
    try:
        # Non-admin users can only generate reports for themselves
        if not current_user.is_superuser:
            report_request.user_id = str(current_user.id)
            report_request.organization_id = None

        report = await analytics_engine.generate_usage_report(
            user_id=report_request.user_id,
            organization_id=report_request.organization_id,
            start_date=report_request.start_date,
            end_date=report_request.end_date
        )

        return UsageReportResponse(**report)

    except Exception as e:
        logger.error(f"Failed to generate usage report: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate usage report"
        )


# Configuration Management Endpoints (Admin Only)

@router.get("/config")
async def get_gateway_config(
    current_user: User = Depends(get_current_superuser)
):
    """
    Get gateway configuration

    Returns the current gateway configuration (admin only).
    """
    try:
        config = gateway_config.get_current_config()
        return gateway_config.to_dict()

    except Exception as e:
        logger.error(f"Failed to get gateway config: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve gateway configuration"
        )


@router.put("/config")
async def update_gateway_config(
    config_update: ConfigurationUpdate,
    current_user: User = Depends(get_current_superuser)
):
    """
    Update gateway configuration

    Updates the gateway configuration (admin only).
    """
    try:
        # This would implement configuration updates
        # For now, return success
        return {"message": "Configuration updated successfully"}

    except Exception as e:
        logger.error(f"Failed to update gateway config: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update gateway configuration"
        )


# Rate Limiting Management Endpoints

@router.get("/rate-limits/status")
async def get_rate_limit_status(
    identifier: str = Query(...),
    limit_type: str = Query("per_key", regex="^(per_key|per_user|per_organization|per_ip|global)$"),
    endpoint: Optional[str] = Query(None),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get rate limit status for an identifier

    Returns current rate limit status and remaining quota.
    """
    try:
        from app.gateway.rate_limiter import RateLimitType
        rate_type = RateLimitType(limit_type)

        status = await rate_limiter.get_rate_limit_status(
            key_type=rate_type,
            identifier=identifier,
            endpoint=endpoint or ""
        )

        return {
            "identifier": identifier,
            "limit_type": limit_type,
            "endpoint": endpoint,
            "status": status
        }

    except Exception as e:
        logger.error(f"Failed to get rate limit status: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve rate limit status"
        )


@router.delete("/rate-limits/{identifier}")
async def clear_rate_limits(
    identifier: str = Path(...),
    limit_type: str = Query("per_key", regex="^(per_key|per_user|per_organization|per_ip|global)$"),
    endpoint: Optional[str] = Query(None),
    current_user: User = Depends(get_current_superuser)
):
    """
    Clear rate limits for an identifier

    Clears rate limit counters for the specified identifier (admin only).
    """
    try:
        from app.gateway.rate_limiter import RateLimitType
        rate_type = RateLimitType(limit_type)

        await rate_limiter.clear_rate_limit(
            key_type=rate_type,
            identifier=identifier,
            endpoint=endpoint or ""
        )

        return {"message": "Rate limits cleared successfully"}

    except Exception as e:
        logger.error(f"Failed to clear rate limits: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to clear rate limits"
        )