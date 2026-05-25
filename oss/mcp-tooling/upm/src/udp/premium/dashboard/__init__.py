"""
Premium Dashboard Feature.

Requires: UPM Pro License or higher

This module provides:
- Dashboard with analytics and visualizations
- Dependency graph visualization
- Real-time monitoring via WebSocket
- Custom reports and exports
"""

from fastapi import APIRouter

from ....api.v1.endpoints.analytics_widgets import router as analytics_widgets_router
from ....api.v1.endpoints.dashboard import router as dashboard_router
from ....api.v1.endpoints.dependency_graph import router as dependency_graph_router
from ....api.v1.endpoints.websocket import router as websocket_router
from ....licensing import Feature


def get_router() -> APIRouter:
    """Get the premium dashboard router.

    This router should only be included if the organization
    has a valid license with dashboard features.
    """
    router = APIRouter(prefix="/dashboard", tags=["dashboard"])

    # Include all dashboard-related endpoints
    router.include_router(dashboard_router)
    router.include_router(websocket_router)
    router.include_router(dependency_graph_router)
    router.include_router(analytics_widgets_router)

    return router


def required_features() -> list[Feature]:
    """Get features required for this module."""
    return [
        Feature.DASHBOARD,
        Feature.ANALYTICS,
    ]
