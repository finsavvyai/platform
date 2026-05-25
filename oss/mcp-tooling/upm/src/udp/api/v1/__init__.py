"""
API v1 router for Universal Dependency Platform (Core - Open Source).

The core UPM platform is open source and free.
Premium features (Dashboard, AI Agents, Advanced Analytics) require a license.
"""

import logging
from importlib import import_module

from fastapi import APIRouter

logger = logging.getLogger(__name__)

api_router = APIRouter()

# ============================================================================
# CORE ENDPOINTS (Open Source / Free)
# ============================================================================
# These endpoints are available to all users without a paid license.

_core_endpoints = [
    # Authentication & Users
    ("auth", "/auth", ["authentication"]),
    ("users", "/users", ["users"]),
    # Core Entities
    ("projects", "/projects", ["projects"]),
    ("organizations", "/organizations", ["organizations"]),
    ("dependencies", "/dependencies", ["dependencies"]),
    # Security & Compliance (Core)
    ("security", "/security", ["security"]),
    ("sbom", "/sbom", ["sbom"]),
    ("compliance", "/compliance", ["compliance"]),
    # Workflows & Remediation
    ("workflows", "/workflows", ["workflows"]),
    ("remediation", "/remediation", ["remediation"]),
    # Recommendations (Basic)
    ("recommendations", "/recommendations", ["recommendations"]),
    # Architecture & Policies
    ("architecture", "", ["architecture"]),
    ("policies", "/policies", ["policies"]),
    # Vulnerability Scanning
    ("vulnerability_scan", "/vulnerability-scan", ["vulnerability-scan"]),
    # OpenClaw Integration
    ("openclaw", "/openclaw", ["openclaw"]),
]

for module_name, prefix, tags in _core_endpoints:
    try:
        mod = import_module(f"udp.api.v1.endpoints.{module_name}")
        kwargs = {"tags": tags}
        if prefix:
            kwargs["prefix"] = prefix
        api_router.include_router(mod.router, **kwargs)
        logger.debug(f"Loaded core endpoint: {module_name}")
    except Exception as e:
        logger.warning(f"Skipping core endpoint module '{module_name}': {e}")


# ============================================================================
# PREMIUM ENDPOINTS (Require License)
# ============================================================================
# These endpoints require a valid UPM Enterprise license.
# They are NOT included in the open source core.

# Dashboard & Analytics (Premium Feature)
# - Requires: UPM Dashboard License
# - Endpoints: /dashboard, /widgets, /dependency-graph, /ws

# AI Agents / OpenClaw (Premium Feature)
# - Requires: UPM AI License
# - Endpoints: /openclaw, /ai-agents

# Advanced Security (Premium Feature)
# - Requires: UPM Enterprise License
# - Endpoints: /advanced-security


def include_premium_router(
    router: APIRouter, prefix: str = "", tags: list = None
) -> None:
    """Include a premium router (only if valid license exists).

    This function is called by the licensing module when a valid license is verified.
    """
    if tags:
        api_router.include_router(router, prefix=prefix, tags=tags)
    else:
        api_router.include_router(router, prefix=prefix)
    logger.info(f"Loaded premium endpoint: {prefix or 'root'}")


# ============================================================================
# LICENSE CHECK
# ============================================================================


def get_premium_status() -> dict:
    """Get status of premium features.

    Returns dict with:
    - dashboard: bool - whether dashboard is licensed
    - ai_agents: bool - whether AI agents are licensed
    - enterprise: bool - whether enterprise features are licensed
    - license_key: str | None - current license key
    - expires: str | None - license expiration
    """
    # This will be implemented by the licensing module
    # For now, return default (no premium features)
    return {
        "dashboard": False,
        "ai_agents": False,
        "enterprise": False,
        "license_key": None,
        "expires": None,
    }
