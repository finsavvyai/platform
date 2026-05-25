#!/usr/bin/env python3
"""
Request Tracking and Correlation IDs
"""

import uuid
from typing import Optional
from datetime import datetime


def generate_request_id() -> str:
    """Generate a unique request ID"""
    return f"req-{uuid.uuid4().hex[:16]}"


def get_request_id_from_header(request) -> Optional[str]:
    """Extract request ID from request headers"""
    # Check X-Request-ID header (standard)
    request_id = request.headers.get("X-Request-ID")
    if request_id:
        return request_id
    
    # Check X-Correlation-ID header (alternative)
    request_id = request.headers.get("X-Correlation-ID")
    if request_id:
        return request_id
    
    return None


def set_request_id_header(response, request_id: str):
    """Set request ID in response headers"""
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Correlation-ID"] = request_id

