"""
Error Recovery Middleware for RAG Service

Comprehensive error handling and recovery middleware with:
- Automatic retry with exponential backoff
- Circuit breaker pattern implementation
- Graceful degradation strategies
- Error classification and handling
- Performance optimization under error conditions
- Real-time error monitoring and alerting
"""

import asyncio
import logging
import time
import traceback
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List, Callable, Union, Type
from enum import Enum
from dataclasses import dataclass, field
from collections import defaultdict, deque
import json
import uuid

from fastapi import Request, Response, HTTPException, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

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
    """Error categories for classification"""

    VALIDATION = "validation"
    AUTHENTICATION = "authentication"
    AUTHORIZATION = "authorization"
    RATE_LIMIT = "rate_limit"
    RESOURCE_UNAVAILABLE = "resource_unavailable"
    TIMEOUT = "timeout"
    PROCESSING = "processing"
    EXTERNAL_SERVICE = "external_service"
    DATABASE = "database"
    NETWORK = "network"
    SYSTEM = "system"
    UNKNOWN = "unknown"


class RecoveryAction(str, Enum):
    """Recovery actions for errors"""

    NONE = "none"
    RETRY = "retry"
    FALLBACK = "fallback"
    DEGRADE = "degrade"
    CIRCUIT_BREAK = "circuit_break"
    ESCALATE = "escalate"
    LOG_AND_CONTINUE = "log_and_continue"


@dataclass
class ErrorConfig:
    """Configuration for error handling"""

    # Retry configuration
    max_retries: int = 3
    retry_delay_seconds: float = 1.0
    retry_backoff_multiplier: float = 2.0
    max_retry_delay_seconds: float = 60.0

    # Circuit breaker configuration
    circuit_breaker_threshold: int = 5
    circuit_breaker_timeout_seconds: int = 60
    circuit_breaker_half_open_max_calls: int = 3

    # Fallback configuration
    enable_fallback: bool = True
    fallback_cache_ttl_seconds: int = 300

    # Degradation configuration
    enable_degradation: bool = True
    degradation_threshold_error_rate: float = 0.1
    degradation_min_requests: int = 100

    # Monitoring configuration
    enable_monitoring: bool = True
    error_alert_threshold: int = 10
    error_alert_window_seconds: int = 60


@dataclass
class ErrorContext:
    """Context information for an error"""

    request_id: str
    timestamp: datetime
    endpoint: str
    method: str
    user_id: Optional[str] = None
    tenant_id: Optional[str] = None
    session_id: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    request_size_bytes: Optional[int] = None
    processing_time_ms: Optional[float] = None


@dataclass
class ClassifiedError:
    """Classified error with recovery information"""

    error: Exception
    category: ErrorCategory
    severity: ErrorSeverity
    recovery_action: RecoveryAction
    context: ErrorContext
    retry_count: int = 0
    circuit_breaker_tripped: bool = False
    fallback_used: bool = False
    metadata: Dict[str, Any] = field(default_factory=dict)


class CircuitBreaker:
    """Circuit breaker implementation for error recovery"""

    def __init__(
        self,
        name: str,
        failure_threshold: int = 5,
        timeout_seconds: int = 60,
        half_open_max_calls: int = 3,
    ):
        self.name = name
        self.failure_threshold = failure_threshold
        self.timeout_seconds = timeout_seconds
        self.half_open_max_calls = half_open_max_calls

        # Circuit breaker state
        self.failure_count = 0
        self.last_failure_time: Optional[datetime] = None
        self.state = "closed"  # closed, open, half_open
        self.half_open_calls = 0

        # Metrics
        self.total_calls = 0
        self.successful_calls = 0
        self.failed_calls = 0

        self._lock = asyncio.Lock()

    async def call(self, func: Callable, *args, **kwargs) -> Any:
        """Execute function with circuit breaker protection"""
        async with self._lock:
            if self.state == "open":
                if self._should_attempt_reset():
                    self.state = "half_open"
                    self.half_open_calls = 0
                    logger.info(
                        f"Circuit breaker '{self.name}' entering half-open state"
                    )
                else:
                    raise Exception(f"Circuit breaker '{self.name}' is open")

            if self.state == "half_open":
                if self.half_open_calls >= self.half_open_max_calls:
                    raise Exception(
                        f"Circuit breaker '{self.name}' half-open limit exceeded"
                    )

        try:
            # Execute the function
            if asyncio.iscoroutinefunction(func):
                result = await func(*args, **kwargs)
            else:
                result = func(*args, **kwargs)

            # Record success
            async with self._lock:
                self._record_success()

            return result

        except Exception as e:
            # Record failure
            async with self._lock:
                self._record_failure()

            raise e

    def _should_attempt_reset(self) -> bool:
        """Check if circuit breaker should attempt reset"""
        if not self.last_failure_time:
            return True

        return datetime.now() - self.last_failure_time > timedelta(
            seconds=self.timeout_seconds
        )

    def _record_success(self) -> None:
        """Record successful call"""
        self.total_calls += 1
        self.successful_calls += 1

        if self.state == "half_open":
            self.half_open_calls += 1
            if self.half_open_calls >= self.half_open_max_calls:
                self.state = "closed"
                self.failure_count = 0
                logger.info(f"Circuit breaker '{self.name}' closed again")

    def _record_failure(self) -> None:
        """Record failed call"""
        self.total_calls += 1
        self.failed_calls += 1
        self.failure_count += 1
        self.last_failure_time = datetime.now()

        if self.state == "half_open":
            self.state = "open"
            logger.warning(f"Circuit breaker '{self.name}' opened from half-open")
        elif self.failure_count >= self.failure_threshold:
            self.state = "open"
            logger.warning(f"Circuit breaker '{self.name}' opened due to failures")

    def get_state(self) -> Dict[str, Any]:
        """Get circuit breaker state"""
        return {
            "name": self.name,
            "state": self.state,
            "failure_count": self.failure_count,
            "total_calls": self.total_calls,
            "success_rate": (
                self.successful_calls / self.total_calls if self.total_calls > 0 else 0
            ),
            "last_failure_time": self.last_failure_time.isoformat()
            if self.last_failure_time
            else None,
        }


class ErrorClassifier:
    """Classify errors and determine recovery actions"""

    def __init__(self):
        # Error classification rules
        self.classification_rules = {
            # Validation errors
            ValueError: (ErrorCategory.VALIDATION, ErrorSeverity.LOW),
            TypeError: (ErrorCategory.VALIDATION, ErrorSeverity.LOW),
            pydantic.ValidationError: (ErrorCategory.VALIDATION, ErrorSeverity.LOW),
            # Authentication errors
            jwt.InvalidTokenError: (ErrorCategory.AUTHENTICATION, ErrorSeverity.MEDIUM),
            jwt.ExpiredSignatureError: (
                ErrorCategory.AUTHENTICATION,
                ErrorSeverity.MEDIUM,
            ),
            # Authorization errors
            PermissionError: (ErrorCategory.AUTHORIZATION, ErrorSeverity.MEDIUM),
            # Rate limiting
            RateLimitError: (ErrorCategory.RATE_LIMIT, ErrorSeverity.MEDIUM),
            # Resource errors
            FileNotFoundError: (ErrorCategory.RESOURCE_UNAVAILABLE, ErrorSeverity.HIGH),
            ModelNotFoundError: (
                ErrorCategory.RESOURCE_UNAVAILABLE,
                ErrorSeverity.HIGH,
            ),
            # Timeout errors
            asyncio.TimeoutError: (ErrorCategory.TIMEOUT, ErrorSeverity.HIGH),
            TimeoutError: (ErrorCategory.TIMEOUT, ErrorSeverity.HIGH),
            # External service errors
            httpx.ConnectError: (ErrorCategory.EXTERNAL_SERVICE, ErrorSeverity.HIGH),
            httpx.TimeoutException: (
                ErrorCategory.EXTERNAL_SERVICE,
                ErrorSeverity.HIGH,
            ),
            httpx.HTTPStatusError: (
                ErrorCategory.EXTERNAL_SERVICE,
                ErrorSeverity.MEDIUM,
            ),
            # Database errors
            asyncpg.PostgresError: (ErrorCategory.DATABASE, ErrorSeverity.CRITICAL),
            sqlalchemy.exc.SQLAlchemyError: (
                ErrorCategory.DATABASE,
                ErrorSeverity.CRITICAL,
            ),
            # Network errors
            ConnectionError: (ErrorCategory.NETWORK, ErrorSeverity.HIGH),
            ConnectionResetError: (ErrorCategory.NETWORK, ErrorSeverity.HIGH),
            # System errors
            MemoryError: (ErrorCategory.SYSTEM, ErrorSeverity.CRITICAL),
            OSError: (ErrorCategory.SYSTEM, ErrorSeverity.HIGH),
        }

        # Recovery action rules
        self.recovery_rules = {
            # Validation errors - no recovery
            ErrorCategory.VALIDATION: RecoveryAction.NONE,
            # Auth errors - escalate
            ErrorCategory.AUTHENTICATION: RecoveryAction.ESCALATE,
            ErrorCategory.AUTHORIZATION: RecoveryAction.ESCALATE,
            # Rate limiting - retry with backoff
            ErrorCategory.RATE_LIMIT: RecoveryAction.RETRY,
            # Resource unavailable - fallback or retry
            ErrorCategory.RESOURCE_UNAVAILABLE: RecoveryAction.FALLBACK,
            # Timeout - retry with circuit breaker
            ErrorCategory.TIMEOUT: RecoveryAction.RETRY,
            # Processing errors - degrade
            ErrorCategory.PROCESSING: RecoveryAction.DEGRADE,
            # External service errors - circuit breaker
            ErrorCategory.EXTERNAL_SERVICE: RecoveryAction.CIRCUIT_BREAK,
            # Database errors - circuit breaker
            ErrorCategory.DATABASE: RecoveryAction.CIRCUIT_BREAK,
            # Network errors - retry
            ErrorCategory.NETWORK: RecoveryAction.RETRY,
            # System errors - escalate
            ErrorCategory.SYSTEM: RecoveryAction.ESCALATE,
            # Unknown - log and continue
            ErrorCategory.UNKNOWN: RecoveryAction.LOG_AND_CONTINUE,
        }

    def classify_error(
        self, error: Exception, context: ErrorContext
    ) -> ClassifiedError:
        """Classify an error and determine recovery action"""
        error_type = type(error)

        # Find matching classification rule
        category = ErrorCategory.UNKNOWN
        severity = ErrorSeverity.MEDIUM

        for error_class, (cat, sev) in self.classification_rules.items():
            if issubclass(error_type, error_class):
                category = cat
                severity = sev
                break

        # Determine recovery action
        recovery_action = self.recovery_rules.get(
            category, RecoveryAction.LOG_AND_CONTINUE
        )

        # Special handling for HTTP exceptions
        if isinstance(error, HTTPException):
            if error.status_code == 429:
                category = ErrorCategory.RATE_LIMIT
                recovery_action = RecoveryAction.RETRY
            elif error.status_code == 401:
                category = ErrorCategory.AUTHENTICATION
                recovery_action = RecoveryAction.ESCALATE
            elif error.status_code == 403:
                category = ErrorCategory.AUTHORIZATION
                recovery_action = RecoveryAction.ESCALATE
            elif error.status_code == 404:
                category = ErrorCategory.RESOURCE_UNAVAILABLE
                recovery_action = RecoveryAction.FALLBACK
            elif 500 <= error.status_code < 600:
                category = ErrorCategory.EXTERNAL_SERVICE
                recovery_action = RecoveryAction.CIRCUIT_BREAK

        # Adjust severity based on context
        if context.endpoint.startswith("/health") or context.endpoint.startswith(
            "/metrics"
        ):
            severity = ErrorSeverity.LOW

        return ClassifiedError(
            error=error,
            category=category,
            severity=severity,
            recovery_action=recovery_action,
            context=context,
            metadata={
                "error_type": error_type.__name__,
                "error_message": str(error),
                "traceback": traceback.format_exc(),
            },
        )


class FallbackCache:
    """Cache for fallback responses"""

    def __init__(self, ttl_seconds: int = 300):
        self.ttl_seconds = ttl_seconds
        self._cache: Dict[str, Dict[str, Any]] = {}
        self._lock = asyncio.Lock()

    async def get(self, key: str) -> Optional[Any]:
        """Get cached fallback response"""
        async with self._lock:
            if key in self._cache:
                entry = self._cache[key]
                if datetime.now() - entry["timestamp"] < timedelta(
                    seconds=self.ttl_seconds
                ):
                    return entry["data"]
                else:
                    del self._cache[key]
        return None

    async def set(self, key: str, data: Any) -> None:
        """Cache fallback response"""
        async with self._lock:
            self._cache[key] = {
                "data": data,
                "timestamp": datetime.now(),
            }

    async def clear(self) -> None:
        """Clear cache"""
        async with self._lock:
            self._cache.clear()


class ErrorRecoveryMiddleware(BaseHTTPMiddleware):
    """Error recovery middleware for RAG service"""

    def __init__(
        self,
        app: ASGIApp,
        config: Optional[ErrorConfig] = None,
    ):
        super().__init__(app)
        self.config = config or ErrorConfig()
        self.classifier = ErrorClassifier()
        self.fallback_cache = FallbackCache(
            ttl_seconds=self.config.fallback_cache_ttl_seconds
        )

        # Circuit breakers for different components
        self.circuit_breakers: Dict[str, CircuitBreaker] = {}

        # Error metrics
        self.error_counts: Dict[str, deque] = defaultdict(lambda: deque(maxlen=1000))
        self.error_rates: Dict[str, float] = defaultdict(float)

        # Degradation state
        self.degradation_active = False
        self.degradation_start_time: Optional[datetime] = None

        logger.info("Error Recovery Middleware initialized")

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Process request with error recovery"""
        # Create error context
        context = ErrorContext(
            request_id=request.headers.get("X-Request-ID", str(uuid.uuid4())),
            timestamp=datetime.now(),
            endpoint=request.url.path,
            method=request.method,
            user_id=request.headers.get("X-User-ID"),
            tenant_id=request.headers.get("X-Tenant-ID"),
            session_id=request.headers.get("X-Session-ID"),
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("User-Agent"),
            request_size_bytes=request.headers.get("Content-Length"),
        )

        start_time = time.time()

        try:
            # Process request
            response = await self._process_with_recovery(request, call_next, context)

            # Update processing time
            context.processing_time_ms = (time.time() - start_time) * 1000

            return response

        except Exception as e:
            # Calculate processing time
            context.processing_time_ms = (time.time() - start_time) * 1000

            # Classify error
            classified_error = self.classifier.classify_error(e, context)

            # Record error
            await self._record_error(classified_error)

            # Handle error based on recovery action
            return await self._handle_error(classified_error, request, call_next)

    async def _process_with_recovery(
        self, request: Request, call_next: Callable, context: ErrorContext
    ) -> Response:
        """Process request with recovery mechanisms"""
        # Check if degradation is active
        if self.degradation_active and self.config.enable_degradation:
            return await self._handle_degraded_request(request, context)

        # Process with retry logic
        last_exception = None
        for attempt in range(self.config.max_retries + 1):
            try:
                # Add retry attempt to context metadata
                context.metadata = {"retry_attempt": attempt}

                # Process request
                response = await call_next(request)

                # Check for error status codes
                if response.status_code >= 400:
                    # Convert to HTTPException for classification
                    raise HTTPException(
                        status_code=response.status_code,
                        detail="Request failed with error status",
                    )

                return response

            except Exception as e:
                last_exception = e

                # Classify error
                classified_error = self.classifier.classify_error(e, context)
                classified_error.retry_count = attempt

                # Check if we should retry
                if attempt < self.config.max_retries and self._should_retry(
                    classified_error
                ):
                    # Calculate delay with exponential backoff
                    delay = self.config.retry_delay_seconds * (
                        self.config.retry_backoff_multiplier**attempt
                    )
                    delay = min(delay, self.config.max_retry_delay_seconds)

                    logger.warning(
                        f"Request {context.request_id} failed (attempt {attempt + 1}), "
                        f"retrying in {delay:.2f}s: {e}"
                    )

                    await asyncio.sleep(delay)
                    continue
                else:
                    # No more retries, raise the last exception
                    raise last_exception

    async def _handle_error(
        self, error: ClassifiedError, request: Request, call_next: Callable
    ) -> Response:
        """Handle classified error with appropriate recovery action"""
        logger.error(
            f"Error in request {error.context.request_id}: "
            f"{error.category.value} - {error.severity.value} - {error.error}"
        )

        # Handle based on recovery action
        if error.recovery_action == RecoveryAction.FALLBACK:
            return await self._handle_fallback(error, request)

        elif error.recovery_action == RecoveryAction.DEGRADE:
            return await self._handle_degradation(error, request)

        elif error.recovery_action == RecoveryAction.CIRCUIT_BREAK:
            return await self._handle_circuit_breaker(error, request)

        elif error.recovery_action == RecoveryAction.ESCALATE:
            return await self._handle_escalation(error)

        elif error.recovery_action == RecoveryAction.RETRY:
            # Retry is handled in _process_with_recovery
            return self._create_error_response(error)

        else:  # NONE or LOG_AND_CONTINUE
            return self._create_error_response(error)

    async def _handle_fallback(
        self, error: ClassifiedError, request: Request
    ) -> Response:
        """Handle fallback recovery action"""
        # Check for cached fallback
        cache_key = f"{request.method}:{request.url.path}"
        cached_response = await self.fallback_cache.get(cache_key)

        if cached_response:
            logger.info(f"Using cached fallback for request {error.context.request_id}")
            error.fallback_used = True
            return JSONResponse(
                status_code=200,
                content={
                    "success": True,
                    "data": cached_response,
                    "fallback": True,
                    "message": "Using cached response due to service unavailability",
                },
            )

        # Generate fallback response
        fallback_response = await self._generate_fallback_response(request, error)

        # Cache the fallback response
        await self.fallback_cache.set(cache_key, fallback_response)

        error.fallback_used = True

        return JSONResponse(
            status_code=200,
            content={
                "success": True,
                "data": fallback_response,
                "fallback": True,
                "message": "Generated fallback response",
            },
        )

    async def _generate_fallback_response(
        self, request: Request, error: ClassifiedError
    ) -> Dict[str, Any]:
        """Generate fallback response based on request"""
        endpoint = request.url.path

        if endpoint.startswith("/rag/query"):
            return {
                "pipeline_id": str(uuid.uuid4()),
                "status": "completed",
                "answer": "I'm sorry, I'm currently experiencing technical difficulties. "
                "Please try again later.",
                "context": None,
                "sources": [],
                "confidence_score": 0.0,
                "quality_score": 0.0,
                "execution_time_ms": 0,
                "fallback": True,
            }

        elif endpoint.startswith("/search"):
            return {
                "results": [],
                "total": 0,
                "page": 1,
                "per_page": 10,
                "fallback": True,
                "message": "Search temporarily unavailable",
            }

        elif endpoint.startswith("/documents"):
            return {
                "documents": [],
                "total": 0,
                "fallback": True,
                "message": "Document service temporarily unavailable",
            }

        else:
            return {
                "status": "service_unavailable",
                "message": "Service temporarily unavailable",
                "fallback": True,
            }

    async def _handle_degradation(
        self, error: ClassifiedError, request: Request
    ) -> Response:
        """Handle degradation recovery action"""
        if not self.degradation_active:
            self.degradation_active = True
            self.degradation_start_time = datetime.now()
            logger.warning("Service degradation activated")

        # Return degraded response
        return JSONResponse(
            status_code=200,
            content={
                "success": True,
                "data": await self._generate_degraded_response(request, error),
                "degraded": True,
                "message": "Service running in degraded mode",
            },
        )

    async def _generate_degraded_response(
        self, request: Request, error: ClassifiedError
    ) -> Dict[str, Any]:
        """Generate degraded response with reduced functionality"""
        endpoint = request.url.path

        if endpoint.startswith("/rag/query"):
            # Simplified RAG response without context retrieval
            return {
                "pipeline_id": str(uuid.uuid4()),
                "status": "completed",
                "answer": "I'm operating in degraded mode with limited functionality. "
                "I can provide basic assistance but cannot access documents at the moment.",
                "context": None,
                "sources": [],
                "confidence_score": 0.3,
                "quality_score": 0.3,
                "execution_time_ms": 100,
                "degraded": True,
            }

        else:
            # For other endpoints, try fallback
            return await self._generate_fallback_response(request, error)

    async def _handle_degraded_request(
        self, request: Request, context: ErrorContext
    ) -> Response:
        """Handle request during degradation"""
        return JSONResponse(
            status_code=503,
            content={
                "success": False,
                "error": {
                    "code": "SERVICE_DEGRADED",
                    "message": "Service is currently running in degraded mode",
                    "degraded": True,
                },
                "meta": {
                    "request_id": context.request_id,
                    "timestamp": context.timestamp.isoformat(),
                },
            },
        )

    async def _handle_circuit_breaker(
        self, error: ClassifiedError, request: Request
    ) -> Response:
        """Handle circuit breaker recovery action"""
        # Get or create circuit breaker for the error source
        source = self._get_error_source(error)
        if source not in self.circuit_breakers:
            self.circuit_breakers[source] = CircuitBreaker(
                name=source,
                failure_threshold=self.config.circuit_breaker_threshold,
                timeout_seconds=self.config.circuit_breaker_timeout_seconds,
            )

        circuit_breaker = self.circuit_breakers[source]

        # Check if circuit is open
        if circuit_breaker.state == "open":
            error.circuit_breaker_tripped = True
            return JSONResponse(
                status_code=503,
                content={
                    "success": False,
                    "error": {
                        "code": "CIRCUIT_BREAKER_OPEN",
                        "message": f"Service '{source}' is temporarily unavailable",
                        "circuit_breaker": True,
                    },
                    "meta": {
                        "request_id": error.context.request_id,
                        "timestamp": error.context.timestamp.isoformat(),
                    },
                },
            )

        # Otherwise, return standard error response
        return self._create_error_response(error)

    async def _handle_escalation(self, error: ClassifiedError) -> Response:
        """Handle escalation recovery action"""
        # Log critical error
        logger.critical(
            f"Critical error requiring escalation: {error.context.request_id} - {error.error}"
        )

        # In production, this would trigger alerts, notifications, etc.
        # For now, return error response
        return self._create_error_response(error)

    def _create_error_response(self, error: ClassifiedError) -> Response:
        """Create standardized error response"""
        status_code = self._get_status_code_for_error(error)

        return JSONResponse(
            status_code=status_code,
            content={
                "success": False,
                "error": {
                    "code": error.category.value.upper(),
                    "message": str(error.error),
                    "category": error.category.value,
                    "severity": error.severity.value,
                    "recovery_action": error.recovery_action.value,
                    "retry_count": error.retry_count,
                    "circuit_breaker_tripped": error.circuit_breaker_tripped,
                    "fallback_used": error.fallback_used,
                },
                "meta": {
                    "request_id": error.context.request_id,
                    "timestamp": error.context.timestamp.isoformat(),
                    "processing_time_ms": error.context.processing_time_ms,
                },
            },
        )

    def _get_status_code_for_error(self, error: ClassifiedError) -> int:
        """Get appropriate HTTP status code for error"""
        if isinstance(error.error, HTTPException):
            return error.error.status_code

        status_map = {
            ErrorCategory.VALIDATION: 422,
            ErrorCategory.AUTHENTICATION: 401,
            ErrorCategory.AUTHORIZATION: 403,
            ErrorCategory.RATE_LIMIT: 429,
            ErrorCategory.RESOURCE_UNAVAILABLE: 404,
            ErrorCategory.TIMEOUT: 504,
            ErrorCategory.PROCESSING: 500,
            ErrorCategory.EXTERNAL_SERVICE: 502,
            ErrorCategory.DATABASE: 503,
            ErrorCategory.NETWORK: 503,
            ErrorCategory.SYSTEM: 500,
            ErrorCategory.UNKNOWN: 500,
        }

        return status_map.get(error.category, 500)

    def _get_error_source(self, error: ClassifiedError) -> str:
        """Get error source for circuit breaker"""
        # Extract source from error or context
        if "database" in str(error.error).lower():
            return "database"
        elif (
            "openai" in str(error.error).lower()
            or "anthropic" in str(error.error).lower()
        ):
            return "llm_provider"
        elif "redis" in str(error.error).lower():
            return "cache"
        elif "timeout" in str(error.error).lower():
            return "timeout"
        else:
            return "general"

    def _should_retry(self, error: ClassifiedError) -> bool:
        """Determine if error should be retried"""
        # Don't retry validation errors
        if error.category == ErrorCategory.VALIDATION:
            return False

        # Don't retry authentication/authorization errors
        if error.category in [
            ErrorCategory.AUTHENTICATION,
            ErrorCategory.AUTHORIZATION,
        ]:
            return False

        # Retry for transient errors
        if error.category in [
            ErrorCategory.RATE_LIMIT,
            ErrorCategory.TIMEOUT,
            ErrorCategory.NETWORK,
            ErrorCategory.EXTERNAL_SERVICE,
        ]:
            return True

        # Check for specific error types
        if isinstance(
            error.error, (ConnectionError, TimeoutError, asyncio.TimeoutError)
        ):
            return True

        return False

    async def _record_error(self, error: ClassifiedError) -> None:
        """Record error for metrics and monitoring"""
        if not self.config.enable_monitoring:
            return

        # Record error count
        key = f"{error.category.value}:{error.severity.value}"
        self.error_counts[key].append(error.context.timestamp)

        # Calculate error rate
        recent_errors = [
            t
            for t in self.error_counts[key]
            if error.context.timestamp - t < timedelta(minutes=5)
        ]
        self.error_rates[key] = len(recent_errors) / 300  # per second

        # Check for alert threshold
        if len(recent_errors) >= self.config.error_alert_threshold:
            await self._trigger_error_alert(error)

        # Check for degradation
        await self._check_degradation_threshold()

    async def _trigger_error_alert(self, error: ClassifiedError) -> None:
        """Trigger error alert"""
        logger.warning(
            f"Error alert triggered: {error.category.value} errors exceeded threshold"
        )
        # In production, this would send alerts to monitoring systems

    async def _check_degradation_threshold(self) -> None:
        """Check if service should enter degradation mode"""
        if not self.config.enable_degradation:
            return

        # Calculate total error rate
        total_errors = sum(len(errors) for errors in self.error_counts.values())
        if total_errors < self.config.degradation_min_requests:
            return

        total_error_rate = sum(self.error_rates.values())

        # Check if error rate exceeds threshold
        if total_error_rate > self.config.degradation_threshold_error_rate:
            if not self.degradation_active:
                self.degradation_active = True
                self.degradation_start_time = datetime.now()
                logger.warning(
                    f"Service degradation activated due to high error rate: {total_error_rate:.2%}"
                )
        else:
            # Check if we can exit degradation mode
            if (
                self.degradation_active
                and self.degradation_start_time
                and datetime.now() - self.degradation_start_time > timedelta(minutes=5)
            ):
                self.degradation_active = False
                self.degradation_start_time = None
                logger.info("Service degradation deactivated")

    async def get_error_metrics(self) -> Dict[str, Any]:
        """Get error metrics"""
        return {
            "error_counts": {k: len(v) for k, v in self.error_counts.items()},
            "error_rates": dict(self.error_rates),
            "degradation_active": self.degradation_active,
            "degradation_start_time": self.degradation_start_time.isoformat()
            if self.degradation_start_time
            else None,
            "circuit_breakers": {
                name: cb.get_state() for name, cb in self.circuit_breakers.items()
            },
            "fallback_cache_size": len(self.fallback_cache._cache),
        }
