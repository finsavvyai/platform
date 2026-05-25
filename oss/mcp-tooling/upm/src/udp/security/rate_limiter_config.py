"""
Default rate limiting configuration for Universal Dependency Platform.

Pre-configured rate limiting rules for different API endpoints and user types.
"""

import logging

from .rate_limiter import RateLimitRule, RateLimitScope, RateLimitStrategy

logger = logging.getLogger(__name__)


def get_default_rate_limit_rules() -> list[RateLimitRule]:
    """
    Get default rate limiting rules for the platform.

    Returns:
        List of pre-configured rate limit rules
    """
    rules = [
        # Global DoS protection
        RateLimitRule(
            name="global_dos_protection",
            requests=1000,
            window_seconds=60,
            strategy=RateLimitStrategy.SLIDING_WINDOW,
            scope=RateLimitScope.GLOBAL,
            burst_limit=1500,
            tags=["security", "dos"],
        ),
        # General API limits
        RateLimitRule(
            name="api_general",
            requests=500,
            window_seconds=3600,  # 1 hour
            strategy=RateLimitStrategy.SLIDING_WINDOW,
            scope=RateLimitScope.USER,
            burst_limit=600,
            tags=["api", "general"],
        ),
        # Authentication limits
        RateLimitRule(
            name="auth_login",
            requests=5,
            window_seconds=300,  # 5 minutes
            strategy=RateLimitStrategy.SLIDING_WINDOW,
            scope=RateLimitScope.IP,
            burst_limit=8,
            penalty_seconds=300,  # 5 minute penalty
            tags=["auth", "login"],
        ),
        RateLimitRule(
            name="auth_password_reset",
            requests=3,
            window_seconds=3600,  # 1 hour
            strategy=RateLimitStrategy.FIXED_WINDOW,
            scope=RateLimitScope.EMAIL,
            burst_limit=5,
            penalty_seconds=900,  # 15 minute penalty
            tags=["auth", "password_reset"],
        ),
        RateLimitRule(
            name="auth_registration",
            requests=5,
            window_seconds=3600,  # 1 hour
            strategy=RateLimitStrategy.FIXED_WINDOW,
            scope=RateLimitScope.IP,
            burst_limit=8,
            tags=["auth", "registration"],
        ),
        # API key limits
        RateLimitRule(
            name="api_key_requests",
            requests=2000,
            window_seconds=3600,  # 1 hour
            strategy=RateLimitStrategy.SLIDING_WINDOW,
            scope=RateLimitScope.API_KEY,
            burst_limit=2500,
            tags=["api_key", "general"],
        ),
        # Analysis requests (resource intensive)
        RateLimitRule(
            name="analysis_requests",
            requests=10,
            window_seconds=3600,  # 1 hour
            strategy=RateLimitStrategy.TOKEN_BUCKET,
            scope=RateLimitScope.USER,
            burst_limit=15,
            tags=["analysis", "resource_intensive"],
        ),
        # Vulnerability scanning requests
        RateLimitRule(
            name="vulnerability_scan_requests",
            requests=20,
            window_seconds=3600,  # 1 hour
            strategy=RateLimitStrategy.TOKEN_BUCKET,
            scope=RateLimitScope.USER,
            burst_limit=25,
            tags=["security", "scanning"],
        ),
        # Project management limits
        RateLimitRule(
            name="project_management",
            requests=100,
            window_seconds=3600,  # 1 hour
            strategy=RateLimitStrategy.SLIDING_WINDOW,
            scope=RateLimitScope.USER,
            burst_limit=120,
            tags=["project", "management"],
        ),
        # Organization limits
        RateLimitRule(
            name="organization_requests",
            requests=5000,
            window_seconds=3600,  # 1 hour
            strategy=RateLimitStrategy.SLIDING_WINDOW,
            scope=RateLimitScope.ORGANIZATION,
            burst_limit=6000,
            tags=["organization", "shared"],
        ),
        # Endpoint-specific limits
        RateLimitRule(
            name="endpoint_sensitive_operations",
            requests=50,
            window_seconds=3600,  # 1 hour
            strategy=RateLimitStrategy.SLIDING_WINDOW,
            scope=RateLimitScope.USER_ENDPOINT,
            burst_limit=60,
            tags=["sensitive", "operations"],
        ),
        # Upload limits
        RateLimitRule(
            name="file_upload_requests",
            requests=20,
            window_seconds=3600,  # 1 hour
            strategy=RateLimitStrategy.TOKEN_BUCKET,
            scope=RateLimitScope.USER,
            burst_limit=25,
            tags=["upload", "file"],
        ),
        # Export/download limits
        RateLimitRule(
            name="export_requests",
            requests=30,
            window_seconds=3600,  # 1 hour
            strategy=RateLimitStrategy.TOKEN_BUCKET,
            scope=RateLimitScope.USER,
            burst_limit=35,
            tags=["export", "download"],
        ),
        # API documentation limits
        RateLimitRule(
            name="api_documentation",
            requests=200,
            window_seconds=3600,  # 1 hour
            strategy=RateLimitStrategy.SLIDING_WINDOW,
            scope=RateLimitScope.IP,
            burst_limit=250,
            tags=["documentation", "public"],
        ),
        # Health check limits (very permissive)
        RateLimitRule(
            name="health_checks",
            requests=10000,
            window_seconds=60,  # 1 minute
            strategy=RateLimitStrategy.SLIDING_WINDOW,
            scope=RateLimitScope.IP,
            burst_limit=15000,
            tags=["health", "monitoring"],
        ),
        # WebSocket connection limits
        RateLimitRule(
            name="websocket_connections",
            requests=50,
            window_seconds=3600,  # 1 hour
            strategy=RateLimitStrategy.FIXED_WINDOW,
            scope=RateLimitScope.USER,
            burst_limit=60,
            tags=["websocket", "realtime"],
        ),
    ]

    return rules


def get_rate_limit_rule_mapping() -> dict[str, list[str]]:
    """
    Get mapping of endpoints to applicable rate limit rules.

    Returns:
        Dictionary mapping endpoint patterns to rule names
    """
    mapping = {
        # Authentication endpoints
        r"/auth/login": ["auth_login", "global_dos_protection"],
        r"/auth/register": ["auth_registration", "global_dos_protection"],
        r"/auth/password-reset": ["auth_password_reset", "global_dos_protection"],
        r"/auth/refresh": ["auth_login", "global_dos_protection"],
        r"/auth/logout": ["auth_login", "global_dos_protection"],
        # API documentation
        r"/docs": ["api_documentation", "global_dos_protection"],
        r"/openapi\.json": ["api_documentation", "global_dos_protection"],
        r"/redoc": ["api_documentation", "global_dos_protection"],
        # Health and monitoring
        r"/health": ["health_checks"],
        r"/metrics": ["health_checks"],
        r"/status": ["health_checks"],
        # Analysis endpoints
        r"/api/v1/analysis": [
            "analysis_requests",
            "api_general",
            "global_dos_protection",
        ],
        r"/api/v1/analyses": [
            "analysis_requests",
            "api_general",
            "global_dos_protection",
        ],
        r"/api/v1/scan": [
            "vulnerability_scan_requests",
            "api_general",
            "global_dos_protection",
        ],
        # Project management
        r"/api/v1/projects": [
            "project_management",
            "api_general",
            "global_dos_protection",
        ],
        r"/api/v1/projects/.*/dependencies": [
            "analysis_requests",
            "api_general",
            "global_dos_protection",
        ],
        # Organizations
        r"/api/v1/organizations": [
            "organization_requests",
            "api_general",
            "global_dos_protection",
        ],
        # Upload and export
        r"/api/v1/upload": [
            "file_upload_requests",
            "api_general",
            "global_dos_protection",
        ],
        r"/api/v1/export": ["export_requests", "api_general", "global_dos_protection"],
        r"/api/v1/download": [
            "export_requests",
            "api_general",
            "global_dos_protection",
        ],
        # WebSocket
        r"/ws": ["websocket_connections", "global_dos_protection"],
        # Default API endpoints
        r"/api/v1/.*": ["api_general", "global_dos_protection"],
    }

    return mapping


def initialize_rate_limiter(rate_limiter) -> None:
    """
    Initialize rate limiter with default rules.

    Args:
        rate_limiter: Rate limiter instance to configure
    """
    try:
        rules = get_default_rate_limit_rules()

        for rule in rules:
            asyncio.create_task(rate_limiter.add_rule(rule))

        logger.info(f"Initialized rate limiter with {len(rules)} default rules")

    except Exception as e:
        logger.error(f"Failed to initialize rate limiter: {str(e)}")


# Rate limit rule definitions for easy access
RATE_LIMIT_RULES = {
    "GLOBAL_DOS_PROTECTION": "global_dos_protection",
    "API_GENERAL": "api_general",
    "AUTH_LOGIN": "auth_login",
    "AUTH_PASSWORD_RESET": "auth_password_reset",
    "AUTH_REGISTRATION": "auth_registration",
    "API_KEY_REQUESTS": "api_key_requests",
    "ANALYSIS_REQUESTS": "analysis_requests",
    "VULNERABILITY_SCAN_REQUESTS": "vulnerability_scan_requests",
    "PROJECT_MANAGEMENT": "project_management",
    "ORGANIZATION_REQUESTS": "organization_requests",
    "ENDPOINT_SENSITIVE_OPERATIONS": "endpoint_sensitive_operations",
    "FILE_UPLOAD_REQUESTS": "file_upload_requests",
    "EXPORT_REQUESTS": "export_requests",
    "API_DOCUMENTATION": "api_documentation",
    "HEALTH_CHECKS": "health_checks",
    "WEBSOCKET_CONNECTIONS": "websocket_connections",
}
