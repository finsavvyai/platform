"""
Structured logging implementation for SDLC.ai platform.
Provides JSON-formatted logging with correlation ID support and sensitive data redaction.
"""

import json
import logging
import os
import sys
import time
import traceback
import uuid
from contextlib import contextmanager
from contextvars import ContextVar
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Union
from pathlib import Path

from pythonjsonlogger import jsonlogger


class LogLevel(Enum):
    """Log levels for structured logging."""

    DEBUG = "debug"
    INFO = "info"
    WARN = "warn"
    ERROR = "error"
    FATAL = "fatal"
    CRITICAL = "critical"


class ErrorInfo:
    """Detailed error information for structured logging."""

    def __init__(
        self,
        error_type: str,
        message: str,
        stack_trace: Optional[str] = None,
        cause: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
    ):
        self.error_type = error_type
        self.message = message
        self.stack_trace = stack_trace
        self.cause = cause
        self.details = details or {}


class FieldRedactor:
    """Handles sensitive data redaction in log fields."""

    def __init__(self, sensitive_fields: Optional[List[str]] = None):
        self.sensitive_fields = set(field.lower() for field in (sensitive_fields or []))
        self.default_sensitive = {
            "password",
            "token",
            "secret",
            "key",
            "auth",
            "credential",
            "bearer",
            "api_key",
            "access_token",
        }
        self.sensitive_fields.update(self.default_sensitive)

    def redact(self, data: Any) -> Any:
        """Recursively redact sensitive fields from data."""
        if isinstance(data, dict):
            redacted = {}
            for key, value in data.items():
                if self._is_sensitive(key):
                    redacted[key] = "***REDACTED***"
                else:
                    redacted[key] = self.redact(value)
            return redacted
        elif isinstance(data, list):
            return [self.redact(item) for item in data]
        else:
            return data

    def _is_sensitive(self, field_name: str) -> bool:
        """Check if a field name indicates sensitive data."""
        field_lower = field_name.lower()
        return any(sensitive in field_lower for sensitive in self.sensitive_fields)


class LogEntry:
    """Structured log entry with correlation support."""

    def __init__(
        self,
        level: LogLevel,
        message: str,
        service: str,
        version: Optional[str] = None,
        timestamp: Optional[datetime] = None,
        trace_id: Optional[str] = None,
        span_id: Optional[str] = None,
        correlation_id: Optional[str] = None,
        user_id: Optional[str] = None,
        tenant_id: Optional[str] = None,
        request_id: Optional[str] = None,
        session_id: Optional[str] = None,
        source: Optional[str] = None,
        function: Optional[str] = None,
        file: Optional[str] = None,
        line: Optional[int] = None,
        duration: Optional[float] = None,
        error: Optional[ErrorInfo] = None,
        metadata: Optional[Dict[str, Any]] = None,
        tags: Optional[List[str]] = None,
    ):
        self.timestamp = timestamp or datetime.utcnow()
        self.level = level
        self.message = message
        self.service = service
        self.version = version
        self.trace_id = trace_id
        self.span_id = span_id
        self.correlation_id = correlation_id
        self.user_id = user_id
        self.tenant_id = tenant_id
        self.request_id = request_id
        self.session_id = session_id
        self.source = source
        self.function = function
        self.file = file
        self.line = line
        self.duration = duration
        self.error = error
        self.metadata = metadata or {}
        self.tags = tags or []

    def to_dict(self) -> Dict[str, Any]:
        """Convert log entry to dictionary for JSON serialization."""
        result = {
            "timestamp": self.timestamp.isoformat(),
            "level": self.level.value,
            "message": self.message,
            "service": self.service,
            "correlation_id": self.correlation_id,
            "trace_id": self.trace_id,
            "span_id": self.span_id,
            "user_id": self.user_id,
            "tenant_id": self.tenant_id,
            "request_id": self.request_id,
            "session_id": self.session_id,
            "metadata": self.metadata,
            "tags": self.tags,
        }

        # Add optional fields only if they have values
        if self.version:
            result["version"] = self.version
        if self.source:
            result["source"] = self.source
        if self.function:
            result["function"] = self.function
        if self.file:
            result["file"] = self.file
        if self.line:
            result["line"] = self.line
        if self.duration:
            result["duration"] = self.duration
        if self.error:
            result["error"] = {
                "type": self.error.error_type,
                "message": self.error.message,
                "stack_trace": self.error.stack_trace,
                "cause": self.error.cause,
                "details": self.error.details,
            }

        return result


# Context variables for correlation data
correlation_id_var: ContextVar[Optional[str]] = ContextVar(
    "correlation_id", default=None
)
trace_id_var: ContextVar[Optional[str]] = ContextVar("trace_id", default=None)
span_id_var: ContextVar[Optional[str]] = ContextVar("span_id", default=None)
user_id_var: ContextVar[Optional[str]] = ContextVar("user_id", default=None)
tenant_id_var: ContextVar[Optional[str]] = ContextVar("tenant_id", default=None)
request_id_var: ContextVar[Optional[str]] = ContextVar("request_id", default=None)
session_id_var: ContextVar[Optional[str]] = ContextVar("session_id", default=None)


class LoggerConfig:
    """Configuration for structured logger."""

    def __init__(
        self,
        service: str,
        version: str = "1.0.0",
        environment: str = "development",
        level: str = "info",
        format_type: str = "json",
        output: str = "stdout",
        file_path: Optional[str] = None,
        max_size_mb: int = 100,
        max_backups: int = 5,
        max_age_days: int = 30,
        compress: bool = True,
        enable_tracing: bool = True,
        redact_fields: Optional[List[str]] = None,
    ):
        self.service = service
        self.version = version
        self.environment = environment
        self.level = level
        self.format_type = format_type
        self.output = output
        self.file_path = file_path
        self.max_size_mb = max_size_mb
        self.max_backups = max_backups
        self.max_age_days = max_age_days
        self.compress = compress
        self.enable_tracing = enable_tracing
        self.redact_fields = redact_fields or []

    @classmethod
    def default(cls) -> "LoggerConfig":
        """Create default logger configuration."""
        return cls(
            service="sdlc-platform",
            version="1.0.0",
            environment="development",
            level="info",
            format_type="json",
            output="stdout",
            max_size_mb=100,
            max_backups=5,
            max_age_days=30,
            compress=True,
            enable_tracing=True,
            redact_fields=[
                "password",
                "token",
                "secret",
                "key",
                "auth",
                "credential",
                "bearer",
                "api_key",
                "access_token",
            ],
        )


class StructuredLogger:
    """Structured logger with correlation support and sensitive data redaction."""

    def __init__(self, config: LoggerConfig):
        self.config = config
        self.redactor = FieldRedactor(config.redact_fields)
        self._setup_logger()

    def _setup_logger(self):
        """Setup the underlying Python logger."""
        self.logger = logging.getLogger(f"{self.config.service}-structured")
        self.logger.setLevel(getattr(logging, self.config.level.upper()))

        # Clear existing handlers
        self.logger.handlers.clear()

        # Create formatter
        if self.config.format_type == "json":
            formatter = jsonlogger.JsonFormatter(
                "%(asctime)s %(name)s %(levelname)s %(message)s"
            )
        else:
            formatter = logging.Formatter(
                "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
            )

        # Create handler
        if self.config.output == "file" and self.config.file_path:
            # Ensure log directory exists
            log_dir = Path(self.config.file_path).parent
            log_dir.mkdir(parents=True, exist_ok=True)

            from logging.handlers import RotatingFileHandler

            handler = RotatingFileHandler(
                self.config.file_path,
                maxBytes=self.config.max_size_mb * 1024 * 1024,
                backupCount=self.config.max_backups,
            )
        else:
            handler = logging.StreamHandler(sys.stdout)

        handler.setFormatter(formatter)
        self.logger.addHandler(handler)

    def _get_caller_info(self) -> tuple[Optional[str], Optional[str], Optional[int]]:
        """Get caller information for logging."""
        import inspect

        frame = inspect.currentframe()
        try:
            # Go up the call stack to find the actual caller
            caller_frame = frame.f_back.f_back
            if caller_frame:
                function = caller_frame.f_code.co_name
                file = caller_frame.f_code.co_filename
                line = caller_frame.f_lineno
                return function, file, line
        finally:
            del frame
        return None, None, None

    def _create_log_entry(self, level: LogLevel, message: str, **kwargs) -> LogEntry:
        """Create a log entry with correlation data from context."""
        function, file, line = self._get_caller_info()

        return LogEntry(
            level=level,
            message=message,
            service=self.config.service,
            version=self.config.version,
            trace_id=trace_id_var.get(),
            span_id=span_id_var.get(),
            correlation_id=correlation_id_var.get(),
            user_id=user_id_var.get(),
            tenant_id=tenant_id_var.get(),
            request_id=request_id_var.get(),
            session_id=session_id_var.get(),
            function=function,
            file=file,
            line=line,
            **kwargs,
        )

    def _log(self, entry: LogEntry):
        """Log the entry using the underlying logger."""
        log_data = entry.to_dict()

        # Apply redaction to metadata
        if entry.metadata:
            log_data["metadata"] = self.redactor.redact(entry.metadata)

        # Use appropriate logging level
        if entry.level == LogLevel.DEBUG:
            self.logger.debug(json.dumps(log_data))
        elif entry.level == LogLevel.INFO:
            self.logger.info(json.dumps(log_data))
        elif entry.level == LogLevel.WARN:
            self.logger.warning(json.dumps(log_data))
        elif entry.level == LogLevel.ERROR:
            self.logger.error(json.dumps(log_data))
        elif entry.level == LogLevel.FATAL or entry.level == LogLevel.CRITICAL:
            self.logger.critical(json.dumps(log_data))

    def debug(self, message: str, **kwargs):
        """Log a debug message."""
        entry = self._create_log_entry(LogLevel.DEBUG, message, **kwargs)
        self._log(entry)

    def info(self, message: str, **kwargs):
        """Log an info message."""
        entry = self._create_log_entry(LogLevel.INFO, message, **kwargs)
        self._log(entry)

    def warn(self, message: str, **kwargs):
        """Log a warning message."""
        entry = self._create_log_entry(LogLevel.WARN, message, **kwargs)
        self._log(entry)

    def error(self, message: str, error: Optional[Exception] = None, **kwargs):
        """Log an error message."""
        error_info = None
        if error:
            error_info = ErrorInfo(
                error_type=type(error).__name__,
                message=str(error),
                stack_trace=traceback.format_exc(),
                details=kwargs.pop("error_details", None),
            )

        entry = self._create_log_entry(
            LogLevel.ERROR, message, error=error_info, **kwargs
        )
        self._log(entry)

    def fatal(self, message: str, error: Optional[Exception] = None, **kwargs):
        """Log a fatal message."""
        error_info = None
        if error:
            error_info = ErrorInfo(
                error_type=type(error).__name__,
                message=str(error),
                stack_trace=traceback.format_exc(),
                details=kwargs.pop("error_details", None),
            )

        entry = self._create_log_entry(
            LogLevel.FATAL, message, error=error_info, **kwargs
        )
        self._log(entry)

    def critical(self, message: str, error: Optional[Exception] = None, **kwargs):
        """Log a critical message."""
        error_info = None
        if error:
            error_info = ErrorInfo(
                error_type=type(error).__name__,
                message=str(error),
                stack_trace=traceback.format_exc(),
                details=kwargs.pop("error_details", None),
            )

        entry = self._create_log_entry(
            LogLevel.CRITICAL, message, error=error_info, **kwargs
        )
        self._log(entry)

    def with_fields(self, **fields) -> "FieldLogger":
        """Create a logger with pre-configured fields."""
        return FieldLogger(self, fields)


class FieldLogger:
    """Logger wrapper with pre-configured fields."""

    def __init__(self, logger: StructuredLogger, fields: Dict[str, Any]):
        self.logger = logger
        self.fields = fields

    def _merge_fields(self, **kwargs) -> Dict[str, Any]:
        """Merge pre-configured fields with call-time fields."""
        merged = self.fields.copy()
        merged.update(kwargs)
        return merged

    def debug(self, message: str, **kwargs):
        """Log a debug message with pre-configured fields."""
        self.logger.debug(message, **self._merge_fields(**kwargs))

    def info(self, message: str, **kwargs):
        """Log an info message with pre-configured fields."""
        self.logger.info(message, **self._merge_fields(**kwargs))

    def warn(self, message: str, **kwargs):
        """Log a warning message with pre-configured fields."""
        self.logger.warn(message, **self._merge_fields(**kwargs))

    def error(self, message: str, error: Optional[Exception] = None, **kwargs):
        """Log an error message with pre-configured fields."""
        self.logger.error(message, error=error, **self._merge_fields(**kwargs))

    def fatal(self, message: str, error: Optional[Exception] = None, **kwargs):
        """Log a fatal message with pre-configured fields."""
        self.logger.fatal(message, error=error, **self._merge_fields(**kwargs))

    def critical(self, message: str, error: Optional[Exception] = None, **kwargs):
        """Log a critical message with pre-configured fields."""
        self.logger.critical(message, error=error, **self._merge_fields(**kwargs))


# Context management functions
def with_correlation_id(correlation_id: Optional[str] = None) -> ContextVar:
    """Set correlation ID in context."""
    if correlation_id is None:
        correlation_id = str(uuid.uuid4())
    return correlation_id_var.set(correlation_id)


def with_trace_data(trace_id: str, span_id: str) -> tuple[ContextVar, ContextVar]:
    """Set trace data in context."""
    return trace_id_var.set(trace_id), span_id_var.set(span_id)


def with_user_data(user_id: str, tenant_id: str) -> tuple[ContextVar, ContextVar]:
    """Set user data in context."""
    return user_id_var.set(user_id), tenant_id_var.set(tenant_id)


def with_request_data(
    request_id: str, session_id: Optional[str] = None
) -> tuple[ContextVar, Optional[ContextVar]]:
    """Set request data in context."""
    request_token = request_id_var.set(request_id)
    session_token = session_id_var.set(session_id) if session_id else None
    return request_token, session_token


# Context manager for logging operations
@contextmanager
def log_context(
    correlation_id: Optional[str] = None,
    trace_id: Optional[str] = None,
    span_id: Optional[str] = None,
    user_id: Optional[str] = None,
    tenant_id: Optional[str] = None,
    request_id: Optional[str] = None,
    session_id: Optional[str] = None,
):
    """Context manager for setting logging context."""
    tokens = []

    try:
        if correlation_id:
            tokens.append(with_correlation_id(correlation_id))
        if trace_id and span_id:
            trace_token, span_token = with_trace_data(trace_id, span_id)
            tokens.extend([trace_token, span_token])
        if user_id and tenant_id:
            user_token, tenant_token = with_user_data(user_id, tenant_id)
            tokens.extend([user_token, tenant_token])
        if request_id:
            request_token, session_token = with_request_data(request_id, session_id)
            tokens.append(request_token)
            if session_token:
                tokens.append(session_token)

        yield

    finally:
        # Reset context variables
        for token in tokens:
            if hasattr(token, "reset"):
                token.reset()


# Global logger instance
_global_logger: Optional[StructuredLogger] = None


def get_logger() -> StructuredLogger:
    """Get the global structured logger instance."""
    global _global_logger
    if _global_logger is None:
        _global_logger = StructuredLogger(LoggerConfig.default())
    return _global_logger


def configure_logger(config: LoggerConfig):
    """Configure the global structured logger."""
    global _global_logger
    _global_logger = StructuredLogger(config)


# Convenience functions using global logger
def debug(message: str, **kwargs):
    """Log a debug message using the global logger."""
    get_logger().debug(message, **kwargs)


def info(message: str, **kwargs):
    """Log an info message using the global logger."""
    get_logger().info(message, **kwargs)


def warn(message: str, **kwargs):
    """Log a warning message using the global logger."""
    get_logger().warn(message, **kwargs)


def error(message: str, error: Optional[Exception] = None, **kwargs):
    """Log an error message using the global logger."""
    get_logger().error(message, error=error, **kwargs)


def fatal(message: str, error: Optional[Exception] = None, **kwargs):
    """Log a fatal message using the global logger."""
    get_logger().fatal(message, error=error, **kwargs)


def critical(message: str, error: Optional[Exception] = None, **kwargs):
    """Log a critical message using the global logger."""
    get_logger().critical(message, error=error, **kwargs)
