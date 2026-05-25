"""
Logging utilities for SDLC.ai SDK

Provides structured logging with request tracing and performance metrics.
"""

import time
import uuid
from functools import wraps
from typing import Any, Callable, Optional

import structlog

# Configure structlog
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.processors.JSONRenderer(),
    ],
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    wrapper_class=structlog.stdlib.BoundLogger,
    cache_logger_on_first_use=True,
)

# Global request context
_request_context = {}


def get_logger(name: str) -> structlog.BoundLogger:
    """
    Get a structured logger with context.

    Args:
        name: Logger name

    Returns:
        Bound logger instance
    """
    logger = structlog.get_logger(name)

    # Add request context if available
    if _request_context:
        logger = logger.bind(**_request_context)

    return logger


def set_request_context(
    request_id: Optional[str] = None,
    user_id: Optional[str] = None,
    tenant_id: Optional[str] = None,
    **kwargs,
) -> str:
    """
    Set request context for logging.

    Args:
        request_id: Unique request ID (generated if not provided)
        user_id: User ID making the request
        tenant_id: Tenant ID for the request
        **kwargs: Additional context

    Returns:
        Request ID
    """
    if not request_id:
        request_id = str(uuid.uuid4())

    _request_context.update(
        {"request_id": request_id, "user_id": user_id, "tenant_id": tenant_id, **kwargs}
    )

    return request_id


def clear_request_context() -> None:
    """Clear request context."""
    _request_context.clear()


def log_request(
    method: str,
    url: str,
    headers: Optional[dict[str, Any]] = None,
    params: Optional[dict[str, Any]] = None,
    **kwargs,
) -> None:
    """
    Log HTTP request details.

    Args:
        method: HTTP method
        url: Request URL
        headers: Request headers
        params: Request parameters
        **kwargs: Additional logging context
    """
    logger = get_logger("sdlc_sdk.http")

    # Sanitize sensitive headers
    safe_headers = {}
    if headers:
        for key, value in headers.items():
            if key.lower() in ["authorization", "x-api-key", "cookie"]:
                safe_headers[key] = "***REDACTED***"
            else:
                safe_headers[key] = value

    logger.info(
        "HTTP request",
        method=method,
        url=url,
        headers=safe_headers,
        params=params,
        **kwargs,
    )


def log_response(
    status_code: int,
    response_time: float,
    size: Optional[int] = None,
    headers: Optional[dict[str, Any]] = None,
    **kwargs,
) -> None:
    """
    Log HTTP response details.

    Args:
        status_code: HTTP status code
        response_time: Response time in milliseconds
        size: Response size in bytes
        headers: Response headers
        **kwargs: Additional logging context
    """
    logger = get_logger("sdlc_sdk.http")

    logger.info(
        "HTTP response",
        status_code=status_code,
        response_time_ms=response_time,
        size_bytes=size,
        headers=headers,
        **kwargs,
    )


def log_performance(
    operation: str,
    duration: float,
    success: bool = True,
    metadata: Optional[dict[str, Any]] = None,
) -> None:
    """
    Log performance metrics.

    Args:
        operation: Operation name
        duration: Duration in milliseconds
        success: Whether operation was successful
        metadata: Additional metadata
    """
    logger = get_logger("sdlc_sdk.performance")

    log_data = {
        "operation": operation,
        "duration_ms": duration,
        "success": success,
        **(metadata or {}),
    }

    if success:
        logger.info("Operation completed", **log_data)
    else:
        logger.error("Operation failed", **log_data)


def with_logging(operation_name: Optional[str] = None):
    """
    Decorator to add logging to functions.

    Args:
        operation_name: Name for the operation (uses function name if not provided)
    """

    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs):
            op_name = operation_name or f"{func.__module__}.{func.__name__}"
            logger = get_logger("sdlc_sdk.function")

            start_time = time.time()

            logger.debug(
                "Function started",
                operation=op_name,
                args_count=len(args),
                kwargs_keys=list(kwargs.keys()),
            )

            try:
                result = func(*args, **kwargs)
                duration = (time.time() - start_time) * 1000

                logger.info(
                    "Function completed", operation=op_name, duration_ms=duration
                )

                return result
            except Exception as e:
                duration = (time.time() - start_time) * 1000

                logger.error(
                    "Function failed",
                    operation=op_name,
                    duration_ms=duration,
                    error=str(e),
                    error_type=type(e).__name__,
                )

                raise

        return wrapper

    return decorator


async def with_async_logging(operation_name: Optional[str] = None):
    """
    Decorator to add logging to async functions.

    Args:
        operation_name: Name for the operation (uses function name if not provided)
    """

    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs):
            op_name = operation_name or f"{func.__module__}.{func.__name__}"
            logger = get_logger("sdlc_sdk.function")

            start_time = time.time()

            logger.debug(
                "Async function started",
                operation=op_name,
                args_count=len(args),
                kwargs_keys=list(kwargs.keys()),
            )

            try:
                result = await func(*args, **kwargs)
                duration = (time.time() - start_time) * 1000

                logger.info(
                    "Async function completed", operation=op_name, duration_ms=duration
                )

                return result
            except Exception as e:
                duration = (time.time() - start_time) * 1000

                logger.error(
                    "Async function failed",
                    operation=op_name,
                    duration_ms=duration,
                    error=str(e),
                    error_type=type(e).__name__,
                )

                raise

        return wrapper

    return decorator


def log_security_event(
    event_type: str,
    severity: str = "INFO",
    user_id: Optional[str] = None,
    tenant_id: Optional[str] = None,
    details: Optional[dict[str, Any]] = None,
) -> None:
    """
    Log security-related events.

    Args:
        event_type: Type of security event
        severity: Event severity (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        user_id: User ID involved
        tenant_id: Tenant ID involved
        details: Event details
    """
    logger = get_logger("sdlc_sdk.security")

    log_data = {
        "event_type": event_type,
        "severity": severity,
        "user_id": user_id,
        "tenant_id": tenant_id,
        **(details or {}),
    }

    # Always log security events at INFO level or higher
    if severity.upper() in ["ERROR", "CRITICAL"]:
        logger.error("Security event", **log_data)
    else:
        logger.info("Security event", **log_data)


def log_api_error(error: Exception, request_id: Optional[str] = None, **kwargs) -> None:
    """
    Log API errors with context.

    Args:
        error: Exception that occurred
        request_id: Request ID
        **kwargs: Additional context
    """
    logger = get_logger("sdlc_sdk.error")

    log_data = {
        "error_type": type(error).__name__,
        "error_message": str(error),
        "request_id": request_id,
        **kwargs,
    }

    # Add exception-specific fields
    if hasattr(error, "code"):
        log_data["error_code"] = error.code
    if hasattr(error, "status_code"):
        log_data["status_code"] = error.status_code
    if hasattr(error, "details"):
        log_data["error_details"] = error.details

    logger.error("API error occurred", **log_data)
