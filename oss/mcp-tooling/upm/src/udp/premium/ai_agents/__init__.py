"""
Premium AI Agents Feature (OpenClaw).

Requires: UPM Business License or higher

This module provides:
- OpenClaw intelligent vulnerability detection
- AI-powered remediation suggestions
- Predictive analytics
- Smart dependency updates
"""

from fastapi import APIRouter

from ....api.v1.endpoints.openclaw import router as openclaw_router
from ....licensing import Feature


def get_router() -> APIRouter:
    """Get the premium AI agents router.

    This router should only be included if the organization
    has a valid license with AI agent features.
    """
    router = APIRouter(prefix="/ai-agents", tags=["ai-agents"])

    # Include all AI agent endpoints
    router.include_router(openclaw_router)

    return router


def required_features() -> list[Feature]:
    """Get features required for this module."""
    return [
        Feature.AI_AGENTS,
        Feature.OPENCLAW,
    ]
