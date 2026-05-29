"""
Correlation ID propagation utilities for SDLC.ai platform.
Provides context management and HTTP header injection/extraction for tracing.
"""

import uuid
from contextlib import contextmanager
from contextvars import ContextVar
from typing import Any, Dict, Optional, Tuple
import aiohttp
import asyncio
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware


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


class CorrelationData:
    """Container for correlation data."""

    def __init__(
        self,
        correlation_id: Optional[str] = None,
        trace_id: Optional[str] = None,
        span_id: Optional[str] = None,
        user_id: Optional[str] = None,
        tenant_id: Optional[str] = None,
        request_id: Optional[str] = None,
        session_id: Optional[str] = None,
    ):
        self.correlation_id = correlation_id
        self.trace_id = trace_id
        self.span_id = span_id
        self.user_id = user_id
        self.tenant_id = tenant_id
        self.request_id = request_id
        self.session_id = session_id

    def to_dict(self) -> Dict[str, str]:
        """Convert correlation data to dictionary."""
        result = {}
        if self.correlation_id:
            result["correlation_id"] = self.correlation_id
        if self.trace_id:
            result["trace_id"] = self.trace_id
        if self.span_id:
            result["span_id"] = self.span_id
        if self.user_id:
            result["user_id"] = self.user_id
        if self.tenant_id:
            result["tenant_id"] = self.tenant_id
        if self.request_id:
            result["request_id"] = self.request_id
        if self.session_id:
            result["session_id"] = self.session_id
        return result


# HTTP header constants
class Headers:
    """HTTP header constants for correlation propagation."""

    CORRELATION_ID = "X-Correlation-ID"
    TRACE_ID = "X-Trace-ID"
    SPAN_ID = "X-Span-ID"
    USER_ID = "X-User-ID"
    TENANT_ID = "X-Tenant-ID"
    REQUEST_ID = "X-Request-ID"
    SESSION_ID = "X-Session-ID"


class CorrelationManager:
    """Manages correlation data propagation."""

    @staticmethod
    def get_correlation_data() -> CorrelationData:
        """Extract all correlation data from current context."""
        return CorrelationData(
            correlation_id=correlation_id_var.get(),
            trace_id=trace_id_var.get(),
            span_id=span_id_var.get(),
            user_id=user_id_var.get(),
            tenant_id=tenant_id_var.get(),
            request_id=request_id_var.get(),
            session_id=session_id_var.get(),
        )

    @staticmethod
    def set_correlation_data(data: CorrelationData) -> None:
        """Set correlation data in current context."""
        if data.correlation_id:
            correlation_id_var.set(data.correlation_id)
        if data.trace_id:
            trace_id_var.set(data.trace_id)
        if data.span_id:
            span_id_var.set(data.span_id)
        if data.user_id:
            user_id_var.set(data.user_id)
        if data.tenant_id:
            tenant_id_var.set(data.tenant_id)
        if data.request_id:
            request_id_var.set(data.request_id)
        if data.session_id:
            session_id_var.set(data.session_id)

    @staticmethod
    def extract_from_request(request: Request) -> CorrelationData:
        """Extract correlation data from HTTP request headers."""
        data = CorrelationData()

        # Get correlation ID from header or generate new one
        correlation_id = request.headers.get(Headers.CORRELATION_ID)
        if correlation_id:
            data.correlation_id = correlation_id
        else:
            data.correlation_id = str(uuid.uuid4())

        # Extract other headers
        data.trace_id = request.headers.get(Headers.TRACE_ID)
        data.span_id = request.headers.get(Headers.SPAN_ID)
        data.user_id = request.headers.get(Headers.USER_ID)
        data.tenant_id = request.headers.get(Headers.TENANT_ID)
        data.request_id = request.headers.get(Headers.REQUEST_ID)
        data.session_id = request.headers.get(Headers.SESSION_ID)

        return data

    @staticmethod
    def inject_into_response(response: Response, data: CorrelationData) -> None:
        """Inject correlation data into HTTP response headers."""
        if data.correlation_id:
            response.headers[Headers.CORRELATION_ID] = data.correlation_id
        if data.trace_id:
            response.headers[Headers.TRACE_ID] = data.trace_id
        if data.span_id:
            response.headers[Headers.SPAN_ID] = data.span_id
        if data.user_id:
            response.headers[Headers.USER_ID] = data.user_id
        if data.tenant_id:
            response.headers[Headers.TENANT_ID] = data.tenant_id
        if data.request_id:
            response.headers[Headers.REQUEST_ID] = data.request_id
        if data.session_id:
            response.headers[Headers.SESSION_ID] = data.session_id


class CorrelationMiddleware(BaseHTTPMiddleware):
    """FastAPI middleware for correlation propagation."""

    async def dispatch(self, request: Request, call_next):
        # Extract correlation data from request
        data = CorrelationManager.extract_from_request(request)

        # Set correlation data in context
        CorrelationManager.set_correlation_data(data)

        # Call next middleware/handler
        response = await call_next(request)

        # Inject correlation data into response
        CorrelationManager.inject_into_response(response, data)

        return response


class CorrelationHTTPClient:
    """HTTP client with automatic correlation propagation."""

    def __init__(self, session: Optional[aiohttp.ClientSession] = None):
        self.session = session

    async def request(self, method: str, url: str, **kwargs) -> aiohttp.ClientResponse:
        """Make HTTP request with correlation propagation."""
        # Get current correlation data
        data = CorrelationManager.get_correlation_data()

        # Prepare headers
        headers = kwargs.get("headers", {})

        # Inject correlation data into headers
        if data.correlation_id:
            headers[Headers.CORRELATION_ID] = data.correlation_id
        if data.trace_id:
            headers[Headers.TRACE_ID] = data.trace_id
        if data.span_id:
            headers[Headers.SPAN_ID] = data.span_id
        if data.user_id:
            headers[Headers.USER_ID] = data.user_id
        if data.tenant_id:
            headers[Headers.TENANT_ID] = data.tenant_id
        if data.request_id:
            headers[Headers.REQUEST_ID] = data.request_id
        if data.session_id:
            headers[Headers.SESSION_ID] = data.session_id

        kwargs["headers"] = headers

        # Create session if not provided
        close_session = False
        if self.session is None:
            self.session = aiohttp.ClientSession()
            close_session = True

        try:
            return await self.session.request(method, url, **kwargs)
        finally:
            if close_session:
                await self.session.close()

    async def get(self, url: str, **kwargs) -> aiohttp.ClientResponse:
        """Make GET request with correlation propagation."""
        return await self.request("GET", url, **kwargs)

    async def post(self, url: str, **kwargs) -> aiohttp.ClientResponse:
        """Make POST request with correlation propagation."""
        return await self.request("POST", url, **kwargs)

    async def put(self, url: str, **kwargs) -> aiohttp.ClientResponse:
        """Make PUT request with correlation propagation."""
        return await self.request("PUT", url, **kwargs)

    async def delete(self, url: str, **kwargs) -> aiohttp.ClientResponse:
        """Make DELETE request with correlation propagation."""
        return await self.request("DELETE", url, **kwargs)

    async def patch(self, url: str, **kwargs) -> aiohttp.ClientResponse:
        """Make PATCH request with correlation propagation."""
        return await self.request("PATCH", url, **kwargs)


# Context management functions
def with_correlation_id(correlation_id: Optional[str] = None) -> ContextVar:
    """Set correlation ID in context."""
    if correlation_id is None:
        correlation_id = str(uuid.uuid4())
    return correlation_id_var.set(correlation_id)


def with_trace_data(trace_id: str, span_id: str) -> Tuple[ContextVar, ContextVar]:
    """Set trace data in context."""
    return trace_id_var.set(trace_id), span_id_var.set(span_id)


def with_user_data(user_id: str, tenant_id: str) -> Tuple[ContextVar, ContextVar]:
    """Set user data in context."""
    return user_id_var.set(user_id), tenant_id_var.set(tenant_id)


def with_request_data(
    request_id: str, session_id: Optional[str] = None
) -> Tuple[ContextVar, Optional[ContextVar]]:
    """Set request data in context."""
    request_token = request_id_var.set(request_id)
    session_token = session_id_var.set(session_id) if session_id else None
    return request_token, session_token


def get_correlation_id() -> Optional[str]:
    """Get correlation ID from context."""
    return correlation_id_var.get()


def get_trace_id() -> Optional[str]:
    """Get trace ID from context."""
    return trace_id_var.get()


def get_span_id() -> Optional[str]:
    """Get span ID from context."""
    return span_id_var.get()


def get_user_id() -> Optional[str]:
    """Get user ID from context."""
    return user_id_var.get()


def get_tenant_id() -> Optional[str]:
    """Get tenant ID from context."""
    return tenant_id_var.get()


def get_request_id() -> Optional[str]:
    """Get request ID from context."""
    return request_id_var.get()


def get_session_id() -> Optional[str]:
    """Get session ID from context."""
    return session_id_var.get()


@contextmanager
def correlation_context(
    correlation_id: Optional[str] = None,
    trace_id: Optional[str] = None,
    span_id: Optional[str] = None,
    user_id: Optional[str] = None,
    tenant_id: Optional[str] = None,
    request_id: Optional[str] = None,
    session_id: Optional[str] = None,
):
    """Context manager for setting correlation data."""
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

        yield CorrelationManager.get_correlation_data()

    finally:
        # Reset context variables
        for token in tokens:
            if hasattr(token, "reset"):
                token.reset()


async def async_correlation_context(
    correlation_id: Optional[str] = None,
    trace_id: Optional[str] = None,
    span_id: Optional[str] = None,
    user_id: Optional[str] = None,
    tenant_id: Optional[str] = None,
    request_id: Optional[str] = None,
    session_id: Optional[str] = None,
):
    """Async context manager for setting correlation data."""
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

        yield CorrelationManager.get_correlation_data()

    finally:
        # Reset context variables
        for token in tokens:
            if hasattr(token, "reset"):
                token.reset()


class CorrelationContextDecorator:
    """Decorator for adding correlation context to functions."""

    def __init__(
        self,
        correlation_id: Optional[str] = None,
        trace_id: Optional[str] = None,
        span_id: Optional[str] = None,
        user_id: Optional[str] = None,
        tenant_id: Optional[str] = None,
        request_id: Optional[str] = None,
        session_id: Optional[str] = None,
    ):
        self.correlation_id = correlation_id
        self.trace_id = trace_id
        self.span_id = span_id
        self.user_id = user_id
        self.tenant_id = tenant_id
        self.request_id = request_id
        self.session_id = session_id

    def __call__(self, func):
        """Decorator for adding correlation context."""
        if asyncio.iscoroutinefunction(func):

            async def async_wrapper(*args, **kwargs):
                async with async_correlation_context(
                    self.correlation_id,
                    self.trace_id,
                    self.span_id,
                    self.user_id,
                    self.tenant_id,
                    self.request_id,
                    self.session_id,
                ):
                    return await func(*args, **kwargs)

            return async_wrapper
        else:

            def sync_wrapper(*args, **kwargs):
                with correlation_context(
                    self.correlation_id,
                    self.trace_id,
                    self.span_id,
                    self.user_id,
                    self.tenant_id,
                    self.request_id,
                    self.session_id,
                ):
                    return func(*args, **kwargs)

            return sync_wrapper


# Convenience decorator
def with_correlation(
    correlation_id: Optional[str] = None,
    trace_id: Optional[str] = None,
    span_id: Optional[str] = None,
    user_id: Optional[str] = None,
    tenant_id: Optional[str] = None,
    request_id: Optional[str] = None,
    session_id: Optional[str] = None,
):
    """Decorator for adding correlation context to functions."""
    return CorrelationContextDecorator(
        correlation_id=correlation_id,
        trace_id=trace_id,
        span_id=span_id,
        user_id=user_id,
        tenant_id=tenant_id,
        request_id=request_id,
        session_id=session_id,
    )


# Global HTTP client instance
_global_http_client: Optional[CorrelationHTTPClient] = None


def get_http_client() -> CorrelationHTTPClient:
    """Get the global correlation HTTP client."""
    global _global_http_client
    if _global_http_client is None:
        _global_http_client = CorrelationHTTPClient()
    return _global_http_client


def configure_http_client(session: Optional[aiohttp.ClientSession] = None):
    """Configure the global correlation HTTP client."""
    global _global_http_client
    _global_http_client = CorrelationHTTPClient(session)
