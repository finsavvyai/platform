"""
Enhanced Error Handling System

Comprehensive error handling for RAG service with:
- Centralized error handling system
- Custom exception classes
- Error logging and reporting
- User-friendly error responses
- Error recovery strategies
- Error rate monitoring
- Circuit breaker pattern
- Retry mechanisms
"""

import asyncio
import logging
import time
import traceback
import uuid
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List, Callable, Type, Union
from enum import Enum
from dataclasses import dataclass, field
from functools import wraps
import json

from fastapi import Request, HTTPException, Response
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class ErrorSeverity(str, Enum):
    """Error severity levels"""

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class ErrorCategory(str, Enum):
    """Error categories"""

    VALIDATION = "validation"
    PROCESSING = "processing"
    RESOURCE = "resource"
    AUTHENTICATION = "authentication"
    AUTHORIZATION = "authorization"
    RATE_LIMIT = "rate_limit"
    EXTERNAL_SERVICE = "external_service"
    DATABASE = "database"
    NETWORK = "network"
    SYSTEM = "system"
    BUSINESS_LOGIC = "business_logic"
    UNKNOWN = "unknown"


# Custom exception classes
class RAGServiceException(Exception):
    """Base exception for RAG service"""

    def __init__(
        self,
        message: str,
        error_code: Optional[str] = None,
        category: ErrorCategory = ErrorCategory.UNKNOWN,
        severity: ErrorSeverity = ErrorSeverity.MEDIUM,
        details: Optional[Dict[str, Any]] = None,
        cause: Optional[Exception] = None,
        retryable: bool = False,
        user_message: Optional[str] = None,
    ):
        super().__init__(message)
        self.message = message
        self.error_code = error_code or self.__class__.__name__
        self.category = category
        self.severity = severity
        self.details = details or {}
        self.cause = cause
        self.retryable = retryable
        self.user_message = user_message or message
        self.timestamp = datetime.utcnow()
        self.traceback_str = traceback.format_exc() if cause else None


class ValidationException(RAGServiceException):
    """Validation error exception"""

    def __init__(self, message: str, field: Optional[str] = None, **kwargs):
        super().__init__(
            message=message,
            category=ErrorCategory.VALIDATION,
            severity=ErrorSeverity.LOW,
            retryable=False,
            **kwargs,
        )
        self.field = field


class ProcessingException(RAGServiceException):
    """Processing error exception"""

    def __init__(self, message: str, **kwargs):
        super().__init__(
            message=message,
            category=ErrorCategory.PROCESSING,
            severity=ErrorSeverity.MEDIUM,
            retryable=True,
            **kwargs,
        )


class ResourceException(RAGServiceException):
    """Resource error exception"""

    def __init__(self, message: str, resource_type: Optional[str] = None, **kwargs):
        super().__init__(
            message=message,
            category=ErrorCategory.RESOURCE,
            severity=ErrorSeverity.HIGH,
            retryable=False,
            **kwargs,
        )
        self.resource_type = resource_type


class ExternalServiceException(RAGServiceException):
    """External service error exception"""

    def __init__(self, message: str, service_name: Optional[str] = None, **kwargs):
        super().__init__(
            message=message,
            category=ErrorCategory.EXTERNAL_SERVICE,
            severity=ErrorSeverity.HIGH,
            retryable=True,
            **kwargs,
        )
        self.service_name = service_name


class DatabaseException(RAGServiceException):
    """Database error exception"""

    def __init__(self, message: str, **kwargs):
        super().__init__(
            message=message,
            category=ErrorCategory.DATABASE,
            severity=ErrorSeverity.HIGH,
            retryable=True,
            **kwargs,
        )


class RateLimitException(RAGServiceException):
    """Rate limit error exception"""

    def __init__(self, message: str, retry_after: Optional[int] = None, **kwargs):
        super().__init__(
            message=message,
            category=ErrorCategory.RATE_LIMIT,
            severity=ErrorSeverity.MEDIUM,
            retryable=False,
            **kwargs,
        )
        self.retry_after = retry_after


class AuthenticationException(RAGServiceException):
    """Authentication error exception"""

    def __init__(self, message: str, **kwargs):
        super().__init__(
            message=message,
            category=ErrorCategory.AUTHENTICATION,
            severity=ErrorSeverity.MEDIUM,
            retryable=False,
            **kwargs,
        )


class AuthorizationException(RAGServiceException):
    """Authorization error exception"""

    def __init__(self, message: str, **kwargs):
        super().__init__(
            message=message,
            category=ErrorCategory.AUTHORIZATION,
            severity=ErrorSeverity.MEDIUM,
            retryable=False,
            **kwargs,
        )


@dataclass
class ErrorInfo:
    """Error information structure"""

    error_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    message: str = ""
    error_code: str = ""
    category: ErrorCategory = ErrorCategory.UNKNOWN
    severity: ErrorSeverity = ErrorSeverity.MEDIUM
    details: Dict[str, Any] = field(default_factory=dict)
    user_message: str = ""
    timestamp: datetime = field(default_factory=datetime.utcnow)
    request_id: Optional[str] = None
    user_id: Optional[str] = None
    tenant_id: Optional[str] = None
    endpoint: Optional[str] = None
    method: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    retryable: bool = False
    retry_after: Optional[int] = None
    cause: Optional[str] = None
    traceback: Optional[str] = None
    context: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ErrorStats:
    """Error statistics"""

    total_errors: int = 0
    errors_by_category: Dict[ErrorCategory, int] = field(default_factory=dict)
    errors_by_severity: Dict[ErrorSeverity, int] = field(default_factory=dict)
    errors_by_code: Dict[str, int] = field(default_factory=dict)
    error_rate: float = 0.0
    recent_errors: List[ErrorInfo] = field(default_factory=list)
    last_error_time: Optional[datetime] = None
    circuit_breaker_trips: int = 0


class CircuitBreaker:
    """Circuit breaker pattern for external service calls"""

    def __init__(
        self,
        failure_threshold: int = 5,
        recovery_timeout: float = 60.0,
        expected_exception: Type[Exception] = Exception,
    ):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.expected_exception = expected_exception

        self.failure_count = 0
        self.last_failure_time: Optional[float] = None
        self.state = "CLOSED"  # CLOSED, OPEN, HALF_OPEN

    async def call(self, func: Callable, *args, **kwargs):
        """Execute function with circuit breaker protection"""
        if self.state == "OPEN":
            if time.time() - (self.last_failure_time or 0) > self.recovery_timeout:
                self.state = "HALF_OPEN"
                logger.info("Circuit breaker moving to HALF_OPEN state")
            else:
                raise ExternalServiceException(
                    "Circuit breaker is OPEN",
                    service_name="circuit_breaker",
                    retry_after=int(self.recovery_timeout),
                )

        try:
            result = (
                await func(*args, **kwargs)
                if asyncio.iscoroutinefunction(func)
                else func(*args, **kwargs)
            )

            if self.state == "HALF_OPEN":
                self.state = "CLOSED"
                self.failure_count = 0
                logger.info("Circuit breaker moving to CLOSED state")

            return result

        except self.expected_exception as e:
            self.failure_count += 1
            self.last_failure_time = time.time()

            if self.failure_count >= self.failure_threshold:
                self.state = "OPEN"
                logger.warning(
                    f"Circuit breaker moving to OPEN state after {self.failure_count} failures"
                )

            raise e


class RetryManager:
    """Retry management with exponential backoff"""

    def __init__(
        self,
        max_retries: int = 3,
        base_delay: float = 1.0,
        max_delay: float = 60.0,
        exponential_base: float = 2.0,
        jitter: bool = True,
    ):
        self.max_retries = max_retries
        self.base_delay = base_delay
        self.max_delay = max_delay
        self.exponential_base = exponential_base
        self.jitter = jitter

    async def execute_with_retry(
        self,
        func: Callable,
        *args,
        retry_on: Optional[List[Type[Exception]]] = None,
        **kwargs,
    ):
        """Execute function with retry logic"""
        if retry_on is None:
            retry_on = [Exception]

        last_exception = None

        for attempt in range(self.max_retries + 1):
            try:
                result = (
                    await func(*args, **kwargs)
                    if asyncio.iscoroutinefunction(func)
                    else func(*args, **kwargs)
                )
                return result

            except Exception as e:
                last_exception = e

                # Check if exception is retryable
                if not any(isinstance(e, exc_type) for exc_type in retry_on):
                    raise e

                if attempt == self.max_retries:
                    logger.error(
                        f"Function failed after {self.max_retries + 1} attempts: {e}"
                    )
                    raise e

                # Calculate delay
                delay = min(
                    self.base_delay * (self.exponential_base**attempt), self.max_delay
                )

                if self.jitter:
                    import random

                    delay *= 0.5 + random.random() * 0.5

                logger.warning(
                    f"Attempt {attempt + 1} failed, retrying in {delay:.2f}s: {e}"
                )
                await asyncio.sleep(delay)

        raise last_exception


class ErrorHandler:
    """Centralized error handler"""

    def __init__(self):
        self.error_stats = ErrorStats()
        self.circuit_breakers: Dict[str, CircuitBreaker] = {}
        self.retry_managers: Dict[str, RetryManager] = {}
        self.error_callbacks: List[Callable[[ErrorInfo], None]] = []
        self.alert_callbacks: List[Callable[[ErrorInfo], None]] = []

        # Configuration
        self.max_error_history = 1000
        self.error_rate_window_minutes = 60
        self.high_error_rate_threshold = 0.1  # 10%
        self.critical_error_threshold = 5  # 5 critical errors trigger alert

    def handle_exception(
        self,
        exception: Exception,
        request: Optional[Request] = None,
        context: Optional[Dict[str, Any]] = None,
    ) -> ErrorInfo:
        """Handle an exception and create error info"""
        # Convert to RAGServiceException if needed
        if not isinstance(exception, RAGServiceException):
            if isinstance(exception, (HTTPException, StarletteHTTPException)):
                rag_exception = RAGServiceException(
                    message=str(exception.detail)
                    if hasattr(exception, "detail")
                    else str(exception),
                    error_code=f"HTTP_{exception.status_code}",
                    category=ErrorCategory.UNKNOWN,
                    severity=ErrorSeverity.MEDIUM,
                    cause=exception,
                )
            elif isinstance(exception, RequestValidationError):
                rag_exception = ValidationException(
                    message="Validation error",
                    details={"validation_errors": exception.errors()},
                )
            else:
                rag_exception = RAGServiceException(
                    message=str(exception),
                    category=ErrorCategory.UNKNOWN,
                    severity=ErrorSeverity.MEDIUM,
                    cause=exception,
                )
        else:
            rag_exception = exception

        # Create error info
        error_info = ErrorInfo(
            message=rag_exception.message,
            error_code=rag_exception.error_code,
            category=rag_exception.category,
            severity=rag_exception.severity,
            details=rag_exception.details,
            user_message=rag_exception.user_message,
            request_id=getattr(request.state, "request_id", None) if request else None,
            user_id=getattr(request.state, "user_id", None) if request else None,
            tenant_id=getattr(request.state, "tenant_id", None) if request else None,
            endpoint=request.url.path if request else None,
            method=request.method if request else None,
            ip_address=request.client.host if request and request.client else None,
            user_agent=request.headers.get("user-agent") if request else None,
            retryable=rag_exception.retryable,
            retry_after=getattr(rag_exception, "retry_after", None),
            cause=str(rag_exception.cause) if rag_exception.cause else None,
            traceback=rag_exception.traceback_str,
            context=context or {},
        )

        # Update statistics
        self._update_stats(error_info)

        # Log error
        self._log_error(error_info, rag_exception)

        # Trigger callbacks
        self._trigger_callbacks(error_info)

        # Check for alerts
        self._check_alerts(error_info)

        return error_info

    def _update_stats(self, error_info: ErrorInfo) -> None:
        """Update error statistics"""
        self.error_stats.total_errors += 1
        self.error_stats.last_error_time = error_info.timestamp

        # Update category counts
        self.error_stats.errors_by_category[error_info.category] = (
            self.error_stats.errors_by_category.get(error_info.category, 0) + 1
        )

        # Update severity counts
        self.error_stats.errors_by_severity[error_info.severity] = (
            self.error_stats.errors_by_severity.get(error_info.severity, 0) + 1
        )

        # Update error code counts
        self.error_stats.errors_by_code[error_info.error_code] = (
            self.error_stats.errors_by_code.get(error_info.error_code, 0) + 1
        )

        # Add to recent errors
        self.error_stats.recent_errors.append(error_info)

        # Limit recent errors
        if len(self.error_stats.recent_errors) > self.max_error_history:
            self.error_stats.recent_errors = self.error_stats.recent_errors[
                -self.max_error_history :
            ]

        # Calculate error rate
        cutoff_time = datetime.utcnow() - timedelta(
            minutes=self.error_rate_window_minutes
        )
        recent_errors = [
            e for e in self.error_stats.recent_errors if e.timestamp >= cutoff_time
        ]

        # Estimate total requests (this would be tracked in real implementation)
        total_requests = max(len(recent_errors) * 10, 1)  # Rough estimate
        self.error_stats.error_rate = len(recent_errors) / total_requests

    def _log_error(self, error_info: ErrorInfo, exception: RAGServiceException) -> None:
        """Log error with appropriate level"""
        log_data = {
            "error_id": error_info.error_id,
            "error_code": error_info.error_code,
            "category": error_info.category.value,
            "severity": error_info.severity.value,
            "message": error_info.message,
            "request_id": error_info.request_id,
            "user_id": error_info.user_id,
            "endpoint": error_info.endpoint,
            "method": error_info.method,
            "retryable": error_info.retryable,
            "details": error_info.details,
        }

        if error_info.severity == ErrorSeverity.CRITICAL:
            logger.critical(
                f"Critical error: {error_info.message}",
                extra=log_data,
                exc_info=exception,
            )
        elif error_info.severity == ErrorSeverity.HIGH:
            logger.error(
                f"High severity error: {error_info.message}",
                extra=log_data,
                exc_info=exception,
            )
        elif error_info.severity == ErrorSeverity.MEDIUM:
            logger.warning(
                f"Medium severity error: {error_info.message}", extra=log_data
            )
        else:
            logger.info(f"Low severity error: {error_info.message}", extra=log_data)

    def _trigger_callbacks(self, error_info: ErrorInfo) -> None:
        """Trigger error callbacks"""
        for callback in self.error_callbacks:
            try:
                if asyncio.iscoroutinefunction(callback):
                    asyncio.create_task(callback(error_info))
                else:
                    callback(error_info)
            except Exception as e:
                logger.error(f"Error callback failed: {e}")

    def _check_alerts(self, error_info: ErrorInfo) -> None:
        """Check if error should trigger alert"""
        should_alert = False

        # High error rate
        if self.error_stats.error_rate > self.high_error_rate_threshold:
            should_alert = True
            logger.warning(
                f"High error rate detected: {self.error_stats.error_rate:.2%}"
            )

        # Critical errors
        critical_count = self.error_stats.errors_by_severity.get(
            ErrorSeverity.CRITICAL, 0
        )
        if critical_count >= self.critical_error_threshold:
            should_alert = True
            logger.warning(f"High number of critical errors: {critical_count}")

        # Circuit breaker trips
        if self.error_stats.circuit_breaker_trips > 0:
            should_alert = True

        if should_alert:
            self._trigger_alerts(error_info)

    def _trigger_alerts(self, error_info: ErrorInfo) -> None:
        """Trigger alert callbacks"""
        for callback in self.alert_callbacks:
            try:
                if asyncio.iscoroutinefunction(callback):
                    asyncio.create_task(callback(error_info))
                else:
                    callback(error_info)
            except Exception as e:
                logger.error(f"Alert callback failed: {e}")

    def get_circuit_breaker(self, name: str) -> CircuitBreaker:
        """Get or create circuit breaker"""
        if name not in self.circuit_breakers:
            self.circuit_breakers[name] = CircuitBreaker()
        return self.circuit_breakers[name]

    def get_retry_manager(self, name: str = "default") -> RetryManager:
        """Get or create retry manager"""
        if name not in self.retry_managers:
            self.retry_managers[name] = RetryManager()
        return self.retry_managers[name]

    def add_error_callback(self, callback: Callable[[ErrorInfo], None]) -> None:
        """Add error callback"""
        self.error_callbacks.append(callback)

    def add_alert_callback(self, callback: Callable[[ErrorInfo], None]) -> None:
        """Add alert callback"""
        self.alert_callbacks.append(callback)

    def get_error_stats(self) -> ErrorStats:
        """Get current error statistics"""
        return self.error_stats

    def reset_stats(self) -> None:
        """Reset error statistics"""
        self.error_stats = ErrorStats()


# Global error handler instance
_error_handler_instance: Optional[ErrorHandler] = None


def get_error_handler() -> ErrorHandler:
    """Get global error handler instance"""
    global _error_handler_instance
    if _error_handler_instance is None:
        _error_handler_instance = ErrorHandler()
    return _error_handler_instance


# Decorators for error handling
def handle_errors(
    error_code: Optional[str] = None,
    category: ErrorCategory = ErrorCategory.UNKNOWN,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    retryable: bool = False,
    user_message: Optional[str] = None,
    circuit_breaker: Optional[str] = None,
    retry_manager: Optional[str] = None,
):
    """Decorator for automatic error handling"""

    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            error_handler = get_error_handler()

            # Get circuit breaker if specified
            cb = None
            if circuit_breaker:
                cb = error_handler.get_circuit_breaker(circuit_breaker)

            # Get retry manager if specified
            rm = None
            if retry_manager:
                rm = error_handler.get_retry_manager(retry_manager)

            try:
                # Execute with circuit breaker if specified
                if cb:
                    if rm:
                        return await rm.execute_with_retry(
                            cb.call, func, *args, **kwargs
                        )
                    else:
                        return await cb.call(func, *args, **kwargs)
                elif rm:
                    return await rm.execute_with_retry(func, *args, **kwargs)
                else:
                    return (
                        await func(*args, **kwargs)
                        if asyncio.iscoroutinefunction(func)
                        else func(*args, **kwargs)
                    )

            except Exception as e:
                # Convert to RAGServiceException if needed
                if not isinstance(e, RAGServiceException):
                    rag_exception = RAGServiceException(
                        message=str(e),
                        error_code=error_code or func.__name__.upper(),
                        category=category,
                        severity=severity,
                        retryable=retryable,
                        user_message=user_message,
                        cause=e,
                    )
                else:
                    rag_exception = e

                # Handle the exception
                request = kwargs.get("request") or (
                    args[0] if args and isinstance(args[0], Request) else None
                )
                error_info = error_handler.handle_exception(rag_exception, request)

                raise rag_exception

        return wrapper

    return decorator


def setup_error_handlers(app) -> None:
    """Setup FastAPI error handlers"""
    error_handler = get_error_handler()

    @app.exception_handler(RAGServiceException)
    async def rag_service_exception_handler(request: Request, exc: RAGServiceException):
        """Handle RAG service exceptions"""
        error_info = error_handler.handle_exception(exc, request)

        # Determine HTTP status code based on error category
        status_code_map = {
            ErrorCategory.VALIDATION: 422,
            ErrorCategory.AUTHENTICATION: 401,
            ErrorCategory.AUTHORIZATION: 403,
            ErrorCategory.RATE_LIMIT: 429,
            ErrorCategory.RESOURCE: 404,
            ErrorCategory.PROCESSING: 500,
            ErrorCategory.EXTERNAL_SERVICE: 502,
            ErrorCategory.DATABASE: 500,
            ErrorCategory.NETWORK: 503,
            ErrorCategory.SYSTEM: 500,
            ErrorCategory.BUSINESS_LOGIC: 422,
            ErrorCategory.UNKNOWN: 500,
        }

        status_code = status_code_map.get(exc.category, 500)

        # Create response
        response_data = {
            "error": {
                "id": error_info.error_id,
                "code": error_info.error_code,
                "message": exc.user_message,
                "category": error_info.category.value,
                "severity": error_info.severity.value,
                "retryable": exc.retryable,
                "retry_after": getattr(exc, "retry_after", None),
                "details": exc.details if settings.debug else {},
            },
            "timestamp": error_info.timestamp.isoformat(),
            "request_id": error_info.request_id,
        }

        # Add retry-after header for rate limit errors
        headers = {}
        if isinstance(exc, RateLimitException) and exc.retry_after:
            headers["Retry-After"] = str(exc.retry_after)

        return JSONResponse(
            status_code=status_code, content=response_data, headers=headers
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        request: Request, exc: RequestValidationError
    ):
        """Handle validation errors"""
        validation_exception = ValidationException(
            message="Request validation failed",
            details={"validation_errors": exc.errors()},
        )

        return await rag_service_exception_handler(request, validation_exception)

    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException):
        """Handle HTTP exceptions"""
        rag_exception = RAGServiceException(
            message=exc.detail,
            error_code=f"HTTP_{exc.status_code}",
            category=ErrorCategory.UNKNOWN,
            severity=ErrorSeverity.MEDIUM,
        )

        return await rag_service_exception_handler(request, rag_exception)

    @app.exception_handler(Exception)
    async def general_exception_handler(request: Request, exc: Exception):
        """Handle general exceptions"""
        rag_exception = RAGServiceException(
            message="Internal server error",
            error_code="INTERNAL_ERROR",
            category=ErrorCategory.SYSTEM,
            severity=ErrorSeverity.HIGH,
            user_message="An unexpected error occurred. Please try again later.",
            cause=exc,
        )

        return await rag_service_exception_handler(request, rag_exception)

    logger.info("Error handlers configured")


# Utility functions
async def log_error_async(error_info: ErrorInfo) -> None:
    """Async error logging function"""
    # This could integrate with external logging services
    logger.info(f"Error logged: {error_info.error_id} - {error_info.message}")


async def send_alert_async(error_info: ErrorInfo) -> None:
    """Async alert sending function"""
    # This could integrate with alerting systems like PagerDuty, Slack, etc.
    if error_info.severity in [ErrorSeverity.HIGH, ErrorSeverity.CRITICAL]:
        logger.warning(
            f"ALERT: {error_info.severity.value} error - {error_info.message}"
        )


# Initialize error callbacks
def initialize_error_callbacks():
    """Initialize default error callbacks"""
    error_handler = get_error_handler()

    # Add logging callback
    error_handler.add_error_callback(log_error_async)

    # Add alert callback
    error_handler.add_alert_callback(send_alert_async)


# Performance monitoring for errors
def create_error_performance_monitor():
    """Create performance monitoring for errors"""
    from prometheus_client import Counter, Histogram

    # Prometheus metrics
    ERROR_COUNTER = Counter(
        "rag_service_errors_total",
        "Total number of errors",
        ["category", "severity", "error_code"],
    )

    ERROR_DURATION = Histogram(
        "rag_service_error_handling_duration_seconds", "Time spent handling errors"
    )

    return {"error_counter": ERROR_COUNTER, "error_duration": ERROR_DURATION}
