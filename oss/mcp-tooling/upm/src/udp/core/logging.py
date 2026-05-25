"""
Structured logging configuration for Universal Dependency Platform.

Enterprise-grade logging with structured JSON output, security filtering,
and comprehensive observability integration.
"""

import logging
import sys

import structlog
from structlog.dev import ConsoleRenderer
from structlog.processors import (
    StackInfoRenderer,
    TimeStamper,
    add_log_level,
    format_exc_info,
)
from structlog.stdlib import (
    LoggerFactory,
    PositionalArgumentsFormatter,
    add_log_level,
    add_logger_name,
)
from udp.core.config import settings


def setup_logging() -> None:
    """
    Configure structured logging for the application.

    Sets up structlog with appropriate processors for the environment,
    including JSON formatting for production and human-readable output
    for development.
    """

    # Configure standard library logging
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=getattr(logging, settings.logging.level)
    )

    # Security-aware log processor that filters sensitive data
    def filter_sensitive_data(logger, method_name, event_dict):
        """Remove sensitive data from logs."""
        sensitive_keys = {
            'password', 'token', 'secret', 'key', 'authorization',
            'cookie', 'session', 'api_key', 'access_token', 'refresh_token'
        }

        def clean_dict(data):
            if isinstance(data, dict):
                return {
                    k: "[REDACTED]" if any(sensitive in k.lower() for sensitive in sensitive_keys) else clean_dict(v)
                    for k, v in data.items()
                }
            elif isinstance(data, (list, tuple)):
                return [clean_dict(item) for item in data]
            return data

        return clean_dict(event_dict)

    # Add request ID processor
    def add_request_id(logger, method_name, event_dict):
        """Add request ID to log entries if available."""
        # This would be populated by middleware
        import contextvars
        request_id_var = contextvars.ContextVar('request_id', default=None)
        request_id = request_id_var.get()
        if request_id:
            event_dict['request_id'] = request_id
        return event_dict

    # Common processors
    processors = [
        filter_sensitive_data,
        add_request_id,
        add_log_level,
        add_logger_name,
        PositionalArgumentsFormatter(),
        TimeStamper(fmt="iso"),
        StackInfoRenderer(),
        format_exc_info,
    ]

    # Environment-specific processors
    if settings.is_production or settings.logging.json_logs:
        # JSON logging for production
        processors.append(structlog.processors.JSONRenderer())
    else:
        # Human-readable logging for development
        processors.append(
            ConsoleRenderer(
                colors=True,
                exception_formatter=structlog.dev.plain_traceback,
            )
        )

    # Configure structlog
    structlog.configure(
        processors=processors,
        wrapper_class=structlog.stdlib.BoundLogger,
        logger_factory=LoggerFactory(),
        context_class=dict,
        cache_logger_on_first_use=True,
    )

    # Set up specific logger levels
    logging.getLogger("uvicorn").setLevel(logging.INFO)
    logging.getLogger("uvicorn.access").setLevel(logging.INFO)
    logging.getLogger("sqlalchemy.engine").setLevel(
        logging.INFO if settings.database.echo else logging.WARNING
    )
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("asyncio").setLevel(logging.WARNING)


def get_logger(name: str = None) -> structlog.BoundLogger:
    """
    Get a structured logger instance.

    Args:
        name: Logger name (defaults to caller's module)

    Returns:
        Configured structlog instance
    """
    return structlog.get_logger(name)
