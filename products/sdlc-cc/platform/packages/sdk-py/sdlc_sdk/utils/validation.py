"""
Validation utilities for SDLC.ai SDK

Provides input validation and sanitization functions.
"""

import html
import re
from typing import Any, Optional
from urllib.parse import urlparse

import structlog

logger = structlog.get_logger("sdlc_sdk.validation")

# Regex patterns
EMAIL_REGEX = re.compile(
    r"^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$"
)
URL_REGEX = re.compile(
    r"^https?://(?:[-\w.])+(?:[:\d]+)?(?:/(?:[\w/_.])*(?:\?(?:[\w&=%.])*)?(?:#(?:\w*))?)?$"
)

# SQL injection patterns
SQL_INJECTION_PATTERNS = [
    r"(\b(UNION|SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)",
    r"(--|#|\/\*|\*\/)",
    r"(\bOR\b\s+\d+\s*=\s*\d+)",
    r"(\bAND\b\s+\d+\s*=\s*\d+)",
    r"(\'\s*OR\s*\'.*\'.*=.*)",
    r"(\"\s*OR\s*\".*\".*=.*)",
]

# XSS patterns
XSS_PATTERNS = [
    r"<script[^>]*>.*?</script>",
    r"javascript:",
    r"on\w+\s*=",
    r"<iframe[^>]*>",
    r"<object[^>]*>",
    r"<embed[^>]*>",
    r"<link[^>]*>",
    r"<meta[^>]*>",
]


def validate_email(email: str) -> bool:
    """
    Validate email address format.

    Args:
        email: Email address to validate

    Returns:
        True if valid, False otherwise
    """
    if not email or not isinstance(email, str):
        return False

    return bool(EMAIL_REGEX.fullmatch(email.strip()))


def validate_url(url: str, require_https: bool = True) -> bool:
    """
    Validate URL format.

    Args:
        url: URL to validate
        require_https: Whether to require HTTPS

    Returns:
        True if valid, False otherwise
    """
    if not url or not isinstance(url, str):
        return False

    try:
        parsed = urlparse(url.strip())

        if require_https and parsed.scheme != "https":
            return False

        if parsed.scheme not in ["http", "https"]:
            return False

        if not parsed.netloc:
            return False

        return bool(URL_REGEX.fullmatch(url.strip()))
    except Exception:
        return False


def sanitize_input(input_data: Any) -> Any:
    """
    Sanitize input data to prevent injection attacks.

    Args:
        input_data: Input data to sanitize

    Returns:
        Sanitized data
    """
    if input_data is None:
        return None

    if isinstance(input_data, str):
        # HTML escape
        sanitized = html.escape(input_data)

        # Remove potential SQL injection
        for pattern in SQL_INJECTION_PATTERNS:
            sanitized = re.sub(pattern, "", sanitized, flags=re.IGNORECASE)

        # Remove potential XSS
        for pattern in XSS_PATTERNS:
            sanitized = re.sub(pattern, "", sanitized, flags=re.IGNORECASE | re.DOTALL)

        return sanitized

    elif isinstance(input_data, dict):
        return {k: sanitize_input(v) for k, v in input_data.items()}

    elif isinstance(input_data, list):
        return [sanitize_input(item) for item in input_data]

    return input_data


def validate_tenant_id(tenant_id: str) -> bool:
    """
    Validate tenant ID format.

    Args:
        tenant_id: Tenant ID to validate

    Returns:
        True if valid, False otherwise
    """
    if not tenant_id or not isinstance(tenant_id, str):
        return False

    # Tenant ID should be alphanumeric with optional hyphens
    pattern = r"^[a-zA-Z0-9][a-zA-Z0-9\-]*[a-zA-Z0-9]$"
    return bool(re.fullmatch(pattern, tenant_id.strip()))


def validate_document_name(name: str) -> bool:
    """
    Validate document name.

    Args:
        name: Document name to validate

    Returns:
        True if valid, False otherwise
    """
    if not name or not isinstance(name, str):
        return False

    # Remove path traversal attempts
    if ".." in name or name.startswith("/"):
        return False

    # Check length
    if len(name) > 255:
        return False

    # Check for valid characters
    pattern = r"^[a-zA-Z0-9._\-\s]+$"
    return bool(re.fullmatch(pattern, name))


def validate_api_key(api_key: str) -> bool:
    """
    Validate API key format.

    Args:
        api_key: API key to validate

    Returns:
        True if valid, False otherwise
    """
    if not api_key or not isinstance(api_key, str):
        return False

    # API key should be at least 32 characters
    if len(api_key) < 32:
        return False

    # API key should be alphanumeric with optional underscores and hyphens
    pattern = r"^[a-zA-Z0-9_\-]+$"
    return bool(re.fullmatch(pattern, api_key))


def validate_query_params(params: dict[str, Any]) -> dict[str, Any]:
    """
    Validate and sanitize query parameters.

    Args:
        params: Query parameters dictionary

    Returns:
        Validated and sanitized parameters
    """
    validated = {}

    for key, value in params.items():
        # Validate key
        if not isinstance(key, str) or not key:
            continue

        # Skip invalid keys
        if key.startswith("__") or "." in key:
            continue

        # Sanitize value
        if isinstance(value, (str, int, float, bool)):
            validated[key] = sanitize_input(value)
        elif isinstance(value, list):
            validated[key] = [
                sanitize_input(item) for item in value[:100]
            ]  # Limit list size
        elif isinstance(value, dict):
            validated[key] = {
                k: sanitize_input(v) for k, v in value.items()[:50]
            }  # Limit dict size

    return validated


def validate_file_upload(
    filename: str,
    content_type: str,
    size: int,
    max_size: int = 100 * 1024 * 1024,  # 100MB default
) -> tuple[bool, Optional[str]]:
    """
    Validate file upload parameters.

    Args:
        filename: Uploaded file name
        content_type: MIME content type
        size: File size in bytes
        max_size: Maximum allowed file size

    Returns:
        Tuple of (is_valid, error_message)
    """
    # Validate filename
    if not filename or not isinstance(filename, str):
        return False, "Invalid filename"

    # Check for path traversal
    if ".." in filename or "/" in filename or "\\" in filename:
        return False, "Invalid filename - path traversal not allowed"

    # Check file extension
    allowed_extensions = [
        ".txt",
        ".pdf",
        ".doc",
        ".docx",
        ".xls",
        ".xlsx",
        ".ppt",
        ".pptx",
        ".csv",
        ".json",
        ".xml",
        ".html",
        ".md",
        ".rtf",
        ".odt",
        ".ods",
        ".odp",
    ]

    ext = filename.lower().split(".")[-1]
    if f".{ext}" not in allowed_extensions:
        return False, f"File type .{ext} not allowed"

    # Validate content type
    allowed_types = [
        "text/plain",
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-powerpoint",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "text/csv",
        "application/json",
        "text/xml",
        "text/html",
        "text/markdown",
        "application/rtf",
    ]

    if content_type not in allowed_types:
        return False, f"Content type {content_type} not allowed"

    # Check file size
    if size > max_size:
        return False, f"File size exceeds maximum of {max_size} bytes"

    if size <= 0:
        return False, "File is empty"

    return True, None
