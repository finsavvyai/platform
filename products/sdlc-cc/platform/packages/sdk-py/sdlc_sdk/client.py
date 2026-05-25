"""
Main SDLC.ai SDK client implementation

Provides both synchronous and asynchronous client implementations
with comprehensive API coverage and enterprise-grade security.
"""

import asyncio
from typing import Any, Optional, Union

import httpx

from .auth.api_key import APIKeyAuth
from .auth.base import BaseAuth
from .config import Config
from .exceptions import (
    NetworkError,
    SDLCError,
    TimeoutError,
    exception_from_response,
)
from .utils.logging import (
    clear_request_context,
    get_logger,
    log_api_error,
    log_request,
    log_response,
    set_request_context,
)
from .utils.retry import RetryState, retry_with_backoff
from .utils.streaming import stream_download, stream_upload

logger = get_logger("sdlc_sdk.client")


class BaseClient:
    """Base client with shared functionality."""

    def __init__(
        self, config: Optional[Config] = None, auth: Optional[BaseAuth] = None, **kwargs
    ):
        """
        Initialize base client.

        Args:
            config: Client configuration
            auth: Authentication method
            **kwargs: Additional configuration options
        """
        self.config = config or Config()
        self.auth = auth or APIKeyAuth(api_key=self.config.api_key)

        # Update config with kwargs
        if kwargs:
            self.config.update(**kwargs)

        # Request session
        self._session: Optional[httpx.Client] = None
        self._closed = False

        # Retry state
        self._retry_state = RetryState(
            max_retries=self.config.retry.max_retries,
            base_delay=self.config.retry.retry_backoff,
            max_delay=self.config.retry.retry_backoff_max,
            jitter=self.config.retry.retry_jitter,
        )

        logger.info("SDLC.ai client initialized", base_url=self.config.base_url)

    def _create_session(self) -> httpx.Client:
        """Create HTTP session with configuration."""
        httpx_config = self.config.get_httpx_config()

        # Add SSL context for mTLS if needed
        if hasattr(self.auth, "get_ssl_context"):
            httpx_config["verify"] = self.auth.get_ssl_context()

        session = httpx.Client(**httpx_config)

        # Add event hooks for logging
        session.event_hooks = {
            "request": [self._log_request],
            "response": [self._log_response],
        }

        return session

    def _log_request(self, request: httpx.Request):
        """Log outgoing request."""
        log_request(
            method=request.method,
            url=str(request.url),
            headers=dict(request.headers),
            params=dict(request.url.params) if request.url.params else None,
        )

    def _log_response(self, response: httpx.Response):
        """Log incoming response."""
        response_time = (
            response.elapsed.total_seconds() * 1000 if response.elapsed else None
        )

        log_response(
            status_code=response.status_code,
            response_time=response_time or 0,
            size=len(response.content),
            headers=dict(response.headers),
        )

    def _build_url(self, endpoint: str) -> str:
        """Build full URL from endpoint."""
        if endpoint.startswith("/"):
            endpoint = endpoint[1:]

        return f"{self.config.base_url}/{self.config.api_version}/{endpoint}"

    def _prepare_request(
        self,
        method: str,
        endpoint: str,
        params: Optional[dict[str, Any]] = None,
        data: Optional[Union[dict[str, Any], str]] = None,
        json: Optional[dict[str, Any]] = None,
        files: Optional[dict[str, Any]] = None,
        headers: Optional[dict[str, str]] = None,
        **kwargs,
    ) -> tuple[str, dict[str, Any], dict[str, Any], Optional[Any]]:
        """Prepare request parameters."""
        # Build URL
        url = self._build_url(endpoint)

        # Prepare headers
        request_headers = {}

        # Add authentication headers
        if self.auth.is_authenticated():
            auth_headers = self.auth.get_headers()
            request_headers.update(auth_headers)

        # Add custom headers
        if headers:
            request_headers.update(headers)

        # Set content type
        if json:
            request_headers["Content-Type"] = "application/json"
        elif data and isinstance(data, dict):
            request_headers["Content-Type"] = "application/x-www-form-urlencoded"
        elif files:
            # Let httpx handle multipart content-type
            request_headers.pop("Content-Type", None)

        # Prepare body
        body = None
        if json:
            body = json
        elif data:
            if isinstance(data, dict):
                # Form encode
                body = data
            else:
                # Raw string
                body = data
        elif files:
            body = files

        return url, request_headers, params or {}, body

    @property
    def session(self) -> httpx.Client:
        """Get or create HTTP session."""
        if self._session is None or self._session.is_closed:
            self._session = self._create_session()
        return self._session

    def close(self) -> None:
        """Close the client and clean up resources."""
        if self._session and not self._session.is_closed:
            self._session.close()
        self._closed = True
        logger.info("SDLC.ai client closed")

    def __enter__(self):
        """Context manager entry."""
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit."""
        self.close()

    def __del__(self):
        """Destructor."""
        self.close()


class SDLCClient(BaseClient):
    """
    Synchronous SDLC.ai client.

    Provides comprehensive API coverage with enterprise-grade security
    and performance optimizations.
    """

    def __init__(
        self, config: Optional[Config] = None, auth: Optional[BaseAuth] = None, **kwargs
    ):
        """
        Initialize synchronous client.

        Args:
            config: Client configuration
            auth: Authentication method
            **kwargs: Additional configuration options
        """
        super().__init__(config=config, auth=auth, **kwargs)

        # Import sub-clients lazily to avoid circular imports
        from .documents import DocumentsClient
        from .llm import LLMClient
        from .monitoring import MonitoringClient
        from .policies import PoliciesClient
        from .rag import RAGClient
        from .tenants import TenantsClient
        from .users import UsersClient
        from .vector import VectorClient

        # Initialize sub-clients
        self.users = UsersClient(self)
        self.tenants = TenantsClient(self)
        self.documents = DocumentsClient(self)
        self.rag = RAGClient(self)
        self.vector = VectorClient(self)
        self.policies = PoliciesClient(self)
        self.llm = LLMClient(self)
        self.monitoring = MonitoringClient(self)

    def _request(
        self,
        method: str,
        endpoint: str,
        params: Optional[dict[str, Any]] = None,
        data: Optional[Union[dict[str, Any], str]] = None,
        json: Optional[dict[str, Any]] = None,
        files: Optional[dict[str, Any]] = None,
        headers: Optional[dict[str, str]] = None,
        retry: Optional[bool] = None,
        **kwargs,
    ) -> httpx.Response:
        """
        Make HTTP request with retry logic.

        Args:
            method: HTTP method
            endpoint: API endpoint
            params: Query parameters
            data: Request body (form or string)
            json: Request body (JSON)
            files: Files to upload
            headers: Additional headers
            retry: Whether to retry on failure
            **kwargs: Additional request options

        Returns:
            HTTP response

        Raises:
            SDLCError: On API errors
        """
        if self._closed:
            raise SDLCError("Client has been closed")

        # Set request context
        request_id = set_request_context()

        # Prepare request
        url, request_headers, request_params, body = self._prepare_request(
            method=method,
            endpoint=endpoint,
            params=params,
            data=data,
            json=json,
            files=files,
            headers=headers,
        )

        # Determine retry behavior
        should_retry = retry if retry is not None else self.config.auto_retry

        # Request wrapper for retry
        def make_request():
            try:
                response = self.session.request(
                    method=method,
                    url=url,
                    params=request_params,
                    json=body if isinstance(body, dict) and method != "GET" else None,
                    data=body
                    if not isinstance(body, dict) or method == "GET"
                    else None,
                    files=files,
                    headers=request_headers,
                    timeout=(self.config.connect_timeout, self.config.read_timeout),
                    **kwargs,
                )

                # Check for errors
                if response.is_error:
                    error = exception_from_response(
                        status_code=response.status_code,
                        response_data=response.json() if response.content else None,
                        request_id=request_id,
                    )
                    log_api_error(error, request_id=request_id)
                    raise error

                return response

            except httpx.TimeoutException:
                raise TimeoutError(
                    message="Request timed out",
                    timeout=self.config.read_timeout,
                    request_id=request_id,
                )
            except httpx.NetworkError as e:
                raise NetworkError(
                    message="Network error occurred",
                    underlying_error=e,
                    request_id=request_id,
                )

        # Execute with retry
        if should_retry:
            retry_decorator = retry_with_backoff(
                max_retries=self.config.retry.max_retries,
                backoff_factor=self.config.retry.retry_backoff,
                backoff_max=self.config.retry.retry_backoff_max,
                jitter=self.config.retry.retry_jitter,
            )
            make_request = retry_decorator(make_request)

        try:
            return make_request()
        finally:
            clear_request_context()

    def get(
        self, endpoint: str, params: Optional[dict[str, Any]] = None, **kwargs
    ) -> httpx.Response:
        """Make GET request."""
        return self._request("GET", endpoint, params=params, **kwargs)

    def post(
        self,
        endpoint: str,
        data: Optional[Union[dict[str, Any], str]] = None,
        json: Optional[dict[str, Any]] = None,
        **kwargs,
    ) -> httpx.Response:
        """Make POST request."""
        return self._request("POST", endpoint, data=data, json=json, **kwargs)

    def put(
        self,
        endpoint: str,
        data: Optional[Union[dict[str, Any], str]] = None,
        json: Optional[dict[str, Any]] = None,
        **kwargs,
    ) -> httpx.Response:
        """Make PUT request."""
        return self._request("PUT", endpoint, data=data, json=json, **kwargs)

    def patch(
        self,
        endpoint: str,
        data: Optional[Union[dict[str, Any], str]] = None,
        json: Optional[dict[str, Any]] = None,
        **kwargs,
    ) -> httpx.Response:
        """Make PATCH request."""
        return self._request("PATCH", endpoint, data=data, json=json, **kwargs)

    def delete(self, endpoint: str, **kwargs) -> httpx.Response:
        """Make DELETE request."""
        return self._request("DELETE", endpoint, **kwargs)

    def upload_file(
        self,
        endpoint: str,
        file_path: str,
        field_name: str = "file",
        data: Optional[dict[str, Any]] = None,
        on_progress: Optional[callable] = None,
        **kwargs,
    ) -> httpx.Response:
        """
        Upload file with progress tracking.

        Args:
            endpoint: Upload endpoint
            file_path: Path to file
            field_name: Form field name
            data: Additional form data
            on_progress: Progress callback
            **kwargs: Additional request options

        Returns:
            HTTP response
        """
        with open(file_path, "rb") as f:
            # Create streaming upload
            file_stream = stream_upload(f, on_progress=on_progress)

            files = {field_name: (file_path, file_stream)}

            return self.post(endpoint=endpoint, files=files, data=data, **kwargs)

    def download_file(
        self,
        endpoint: str,
        file_path: str,
        on_progress: Optional[callable] = None,
        **kwargs,
    ) -> None:
        """
        Download file with progress tracking.

        Args:
            endpoint: Download endpoint
            file_path: Path to save file
            on_progress: Progress callback
            **kwargs: Additional request options
        """
        response = self.get(endpoint, stream=True, **kwargs)

        with open(file_path, "wb") as f:
            for chunk in stream_download(response, on_progress=on_progress):
                f.write(chunk)

    def authenticate(self) -> bool:
        """
        Perform authentication.

        Returns:
            True if authentication successful
        """
        try:
            success, _ = asyncio.run(self.auth.authenticate(self))
            return success
        except Exception as e:
            logger.error("Authentication failed", error=str(e))
            return False

    def is_authenticated(self) -> bool:
        """Check if client is authenticated."""
        return self.auth.is_authenticated()

    def get_user_info(self) -> Optional[dict[str, Any]]:
        """
        Get current user information.

        Returns:
            User information or None
        """
        if not self.is_authenticated():
            return None

        response = self.get("/auth/me")
        return response.json() if response.status_code == 200 else None


class AsyncSDLCClient(BaseClient):
    """
    Asynchronous SDLC.ai client.

    Provides comprehensive API coverage with async/await support
    for high-performance applications.
    """

    def __init__(
        self, config: Optional[Config] = None, auth: Optional[BaseAuth] = None, **kwargs
    ):
        """
        Initialize asynchronous client.

        Args:
            config: Client configuration
            auth: Authentication method
            **kwargs: Additional configuration options
        """
        super().__init__(config=config, auth=auth, **kwargs)

        # Import async sub-clients lazily
        from .documents import AsyncDocumentsClient
        from .llm import AsyncLLMClient
        from .monitoring import AsyncMonitoringClient
        from .policies import AsyncPoliciesClient
        from .rag import AsyncRAGClient
        from .tenants import AsyncTenantsClient
        from .users import AsyncUsersClient
        from .vector import AsyncVectorClient

        # Initialize async sub-clients
        self.users = AsyncUsersClient(self)
        self.tenants = AsyncTenantsClient(self)
        self.documents = AsyncDocumentsClient(self)
        self.rag = AsyncRAGClient(self)
        self.vector = AsyncVectorClient(self)
        self.policies = AsyncPoliciesClient(self)
        self.llm = AsyncLLMClient(self)
        self.monitoring = AsyncMonitoringClient(self)

    def _create_session(self) -> httpx.AsyncClient:
        """Create async HTTP session."""
        httpx_config = self.config.get_httpx_config()

        # Add SSL context for mTLS if needed
        if hasattr(self.auth, "get_ssl_context"):
            httpx_config["verify"] = self.auth.get_ssl_context()

        session = httpx.AsyncClient(**httpx_config)

        # Add event hooks for logging
        session.event_hooks = {
            "request": [self._log_request],
            "response": [self._log_response],
        }

        return session

    @property
    def session(self) -> httpx.AsyncClient:
        """Get or create async HTTP session."""
        if self._session is None or self._session.is_closed:
            self._session = self._create_session()
        return self._session

    async def close(self) -> None:
        """Close the async client."""
        if self._session and not self._session.is_closed:
            await self._session.aclose()
        self._closed = True
        logger.info("SDLC.ai async client closed")

    async def __aenter__(self):
        """Async context manager entry."""
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        await self.close()

    async def _request(
        self,
        method: str,
        endpoint: str,
        params: Optional[dict[str, Any]] = None,
        data: Optional[Union[dict[str, Any], str]] = None,
        json: Optional[dict[str, Any]] = None,
        files: Optional[dict[str, Any]] = None,
        headers: Optional[dict[str, str]] = None,
        retry: Optional[bool] = None,
        **kwargs,
    ) -> httpx.Response:
        """
        Make async HTTP request with retry logic.

        Args:
            method: HTTP method
            endpoint: API endpoint
            params: Query parameters
            data: Request body
            json: JSON request body
            files: Files to upload
            headers: Additional headers
            retry: Whether to retry on failure
            **kwargs: Additional request options

        Returns:
            HTTP response

        Raises:
            SDLCError: On API errors
        """
        if self._closed:
            raise SDLCError("Client has been closed")

        # Set request context
        request_id = set_request_context()

        # Prepare request
        url, request_headers, request_params, body = self._prepare_request(
            method=method,
            endpoint=endpoint,
            params=params,
            data=data,
            json=json,
            files=files,
            headers=headers,
        )

        # Determine retry behavior
        should_retry = retry if retry is not None else self.config.auto_retry

        # Request wrapper for retry
        async def make_request():
            try:
                response = await self.session.request(
                    method=method,
                    url=url,
                    params=request_params,
                    json=body if isinstance(body, dict) and method != "GET" else None,
                    data=body
                    if not isinstance(body, dict) or method == "GET"
                    else None,
                    files=files,
                    headers=request_headers,
                    timeout=(self.config.connect_timeout, self.config.read_timeout),
                    **kwargs,
                )

                # Check for errors
                if response.is_error:
                    error = exception_from_response(
                        status_code=response.status_code,
                        response_data=response.json() if response.content else None,
                        request_id=request_id,
                    )
                    log_api_error(error, request_id=request_id)
                    raise error

                return response

            except httpx.TimeoutException:
                raise TimeoutError(
                    message="Request timed out",
                    timeout=self.config.read_timeout,
                    request_id=request_id,
                )
            except httpx.NetworkError as e:
                raise NetworkError(
                    message="Network error occurred",
                    underlying_error=e,
                    request_id=request_id,
                )

        # Execute with retry
        if should_retry:
            from .utils.retry import async_retry_with_backoff

            retry_decorator = async_retry_with_backoff(
                max_retries=self.config.retry.max_retries,
                backoff_factor=self.config.retry.retry_backoff,
                backoff_max=self.config.retry.retry_backoff_max,
                jitter=self.config.retry.retry_jitter,
            )
            make_request = retry_decorator(make_request)

        try:
            return await make_request()
        finally:
            clear_request_context()

    # HTTP method wrappers
    async def get(
        self, endpoint: str, params: Optional[dict[str, Any]] = None, **kwargs
    ) -> httpx.Response:
        """Make async GET request."""
        return await self._request("GET", endpoint, params=params, **kwargs)

    async def post(
        self,
        endpoint: str,
        data: Optional[Union[dict[str, Any], str]] = None,
        json: Optional[dict[str, Any]] = None,
        **kwargs,
    ) -> httpx.Response:
        """Make async POST request."""
        return await self._request("POST", endpoint, data=data, json=json, **kwargs)

    async def put(
        self,
        endpoint: str,
        data: Optional[Union[dict[str, Any], str]] = None,
        json: Optional[dict[str, Any]] = None,
        **kwargs,
    ) -> httpx.Response:
        """Make async PUT request."""
        return await self._request("PUT", endpoint, data=data, json=json, **kwargs)

    async def patch(
        self,
        endpoint: str,
        data: Optional[Union[dict[str, Any], str]] = None,
        json: Optional[dict[str, Any]] = None,
        **kwargs,
    ) -> httpx.Response:
        """Make async PATCH request."""
        return await self._request("PATCH", endpoint, data=data, json=json, **kwargs)

    async def delete(self, endpoint: str, **kwargs) -> httpx.Response:
        """Make async DELETE request."""
        return await self._request("DELETE", endpoint, **kwargs)

    async def upload_file(
        self,
        endpoint: str,
        file_path: str,
        field_name: str = "file",
        data: Optional[dict[str, Any]] = None,
        on_progress: Optional[callable] = None,
        **kwargs,
    ) -> httpx.Response:
        """
        Upload file asynchronously with progress tracking.

        Args:
            endpoint: Upload endpoint
            file_path: Path to file
            field_name: Form field name
            data: Additional form data
            on_progress: Progress callback
            **kwargs: Additional request options

        Returns:
            HTTP response
        """
        import aiofiles

        async with aiofiles.open(file_path, "rb") as f:
            file_data = await f.read()

            from .utils.streaming import async_stream_upload

            file_stream = async_stream_upload(file_data, on_progress=on_progress)

            files = {field_name: (file_path, file_stream)}

            return await self.post(endpoint=endpoint, files=files, data=data, **kwargs)

    async def download_file(
        self,
        endpoint: str,
        file_path: str,
        on_progress: Optional[callable] = None,
        **kwargs,
    ) -> None:
        """
        Download file asynchronously with progress tracking.

        Args:
            endpoint: Download endpoint
            file_path: Path to save file
            on_progress: Progress callback
            **kwargs: Additional request options
        """
        import aiofiles

        response = await self.get(endpoint, **kwargs)

        from .utils.streaming import async_stream_download

        async with aiofiles.open(file_path, "wb") as f:
            async for chunk in async_stream_download(response, on_progress=on_progress):
                await f.write(chunk)

    async def authenticate(self) -> bool:
        """
        Perform async authentication.

        Returns:
            True if authentication successful
        """
        try:
            success, _ = await self.auth.authenticate(self)
            return success
        except Exception as e:
            logger.error("Async authentication failed", error=str(e))
            return False

    def is_authenticated(self) -> bool:
        """Check if client is authenticated."""
        return self.auth.is_authenticated()

    async def get_user_info(self) -> Optional[dict[str, Any]]:
        """
        Get current user information asynchronously.

        Returns:
            User information or None
        """
        if not self.is_authenticated():
            return None

        response = await self.get("/auth/me")
        return response.json() if response.status_code == 200 else None

    # Batch operations
    async def batch_request(
        self, requests: List[dict[str, Any]], max_concurrency: int = 10
    ) -> List[httpx.Response]:
        """
        Execute multiple requests concurrently.

        Args:
            requests: List of request specifications
            max_concurrency: Maximum concurrent requests

        Returns:
            List of responses
        """
        from asyncio import Semaphore, gather

        semaphore = Semaphore(max_concurrency)

        async def execute_request(req):
            async with semaphore:
                return await self._request(**req)

        tasks = [execute_request(req) for req in requests]
        return await gather(*tasks, return_exceptions=True)
