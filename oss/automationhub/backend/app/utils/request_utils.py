"""
Request utilities for handling HTTP requests and extracting context

Author: Claude Code Implementation
Task: 1.1.3 Role-Based Access Control
Updated: 2025-01-06
"""

from typing import Dict, Any, Optional
from fastapi import Request
from starlette.middleware.base import RequestResponseEndpoint
import json
import logging

logger = logging.getLogger(__name__)


async def get_client_ip(request: Request) -> Optional[str]:
    """Get client IP address from request"""
    # Check for forwarded IP first (common in load balancer setups)
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        # X-Forwarded-For can contain multiple IPs, take the first one
        return forwarded_for.split(",")[0].strip()

    # Check for real IP header
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip.strip()

    # Fall back to client IP
    if request.client:
        return request.client.host

    return None


async def get_request_context(request: Request) -> Dict[str, Any]:
    """Extract additional context from request for permission checks"""
    context = {}

    try:
        # Extract query parameters
        if request.query_params:
            context["query_params"] = dict(request.query_params)

        # Extract path parameters (if available)
        if hasattr(request, "path_params") and request.path_params:
            context["path_params"] = request.path_params

        # Extract headers (excluding sensitive ones)
        excluded_headers = {
            "authorization", "cookie", "x-api-key", "x-forwarded-for",
            "x-real-ip", "user-agent"
        }
        headers = {}
        for key, value in request.headers.items():
            if key.lower() not in excluded_headers:
                headers[key] = value
        if headers:
            context["headers"] = headers

        # Extract request method and path
        context["method"] = request.method
        context["path"] = request.url.path
        context["full_url"] = str(request.url)

        # Time-based context
        from datetime import datetime
        context["timestamp"] = datetime.utcnow().isoformat()
        context["hour_of_day"] = datetime.utcnow().hour
        context["day_of_week"] = datetime.utcnow().weekday()  # 0 = Monday

        # User agent parsing (basic)
        user_agent = request.headers.get("User-Agent", "")
        if user_agent:
            context["user_agent"] = user_agent
            # Basic device detection
            if any(mobile in user_agent.lower() for mobile in ["mobile", "android", "iphone", "ipad"]):
                context["device_type"] = "mobile"
            else:
                context["device_type"] = "desktop"

    except Exception as e:
        logger.error(f"Error extracting request context: {e}")

    return context


def get_pagination_params(
    skip: int = 0,
    limit: int = 100,
    max_limit: int = 1000
) -> tuple[int, int]:
    """Get and validate pagination parameters"""
    # Ensure non-negative skip
    skip = max(0, skip)

    # Ensure reasonable limit
    limit = max(1, min(limit, max_limit))

    return skip, limit


async def extract_json_body(request: Request) -> Dict[str, Any]:
    """Extract and parse JSON body from request"""
    try:
        if request.method in ["POST", "PUT", "PATCH"]:
            body = await request.body()
            if body:
                return json.loads(body.decode())
    except Exception as e:
        logger.error(f"Error extracting JSON body: {e}")
    return {}


def is_api_request(request: Request) -> bool:
    """Check if request is an API request"""
    return request.url.path.startswith("/api/")


def get_request_id(request: Request) -> Optional[str]:
    """Get request ID from headers or generate one"""
    request_id = request.headers.get("X-Request-ID")
    if not request_id:
        # Generate a simple request ID
        import uuid
        request_id = str(uuid.uuid4())[:8]
    return request_id