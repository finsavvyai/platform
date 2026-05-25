"""
Test the main SDLC.ai SDK client.
"""

import pytest
from unittest.mock import Mock, patch
import httpx

from sdlc_sdk import SDLCClient, AsyncSDLCClient, Config
from sdlc_sdk.auth import APIKeyAuth
from sdlc_sdk.exceptions import AuthenticationError, NetworkError


class TestSDLCClient:
    """Test synchronous SDLC client."""

    def test_client_initialization(self, config, auth):
        """Test client initialization."""
        client = SDLCClient(config=config, auth=auth)

        assert client.config == config
        assert client.auth == auth
        assert client.users is not None
        assert client.tenants is not None
        assert client.documents is not None
        assert client.rag is not None
        assert client.vector is not None
        assert client.policies is not None
        assert client.llm is not None
        assert client.monitoring is not None
        assert not client._closed

    def test_client_context_manager(self, config, auth):
        """Test client as context manager."""
        with SDLCClient(config=config, auth=auth) as client:
            assert not client._closed
        assert client._closed

    def test_build_url(self, client):
        """Test URL building."""
        url = client._build_url("/users")
        assert url == f"{client.config.base_url}/{client.config.api_version}/users"

        url = client._build_url("users")
        assert url == f"{client.config.base_url}/{client.config.api_version}/users"

    def test_prepare_request(self, client):
        """Test request preparation."""
        url, headers, params, body = client._prepare_request(
            method="GET",
            endpoint="/users",
            params={"page": 1},
            headers={"X-Custom": "value"},
        )

        assert "/users" in url
        assert headers["X-Custom"] == "value"
        assert params["page"] == 1
        assert body is None

    @patch("httpx.Client.request")
    def test_get_request(self, mock_request, client, mock_response):
        """Test GET request."""
        mock_request.return_value = mock_response

        response = client.get("/users")

        assert response.status_code == 200
        mock_request.assert_called_once()

    @patch("httpx.Client.request")
    def test_post_request(self, mock_request, client, mock_response):
        """Test POST request."""
        mock_request.return_value = mock_response

        response = client.post("/users", json={"name": "Test"})

        assert response.status_code == 200
        mock_request.assert_called_once()

    @patch("httpx.Client.request")
    def test_request_with_retry(self, mock_request, client, mock_response):
        """Test request with retry logic."""
        mock_request.side_effect = [
            httpx.NetworkError("Connection failed"),
            mock_response,
        ]

        response = client.get("/users")

        assert response.status_code == 200
        assert mock_request.call_count == 2

    def test_authentication_required(self, config):
        """Test that authentication is required."""
        client = SDLCClient(config=config)
        assert not client.is_authenticated()

    def test_closed_client_error(self, client):
        """Test error when using closed client."""
        client.close()

        with pytest.raises(Exception) as exc_info:
            client.get("/users")
        assert "closed" in str(exc_info.value).lower()


class TestAsyncSDLCClient:
    """Test asynchronous SDLC client."""

    @pytest.mark.asyncio
    async def test_async_client_initialization(self, config, auth):
        """Test async client initialization."""
        client = AsyncSDLCClient(config=config, auth=auth)

        assert client.config == config
        assert client.auth == auth
        assert not client._closed

        await client.close()
        assert client._closed

    @pytest.mark.asyncio
    async def test_async_client_context_manager(self, config, auth):
        """Test async client as context manager."""
        async with AsyncSDLCClient(config=config, auth=auth) as client:
            assert not client._closed
        assert client._closed

    @pytest.mark.asyncio
    @patch("httpx.AsyncClient.request")
    async def test_async_get_request(
        self, mock_request, async_client, mock_async_response
    ):
        """Test async GET request."""
        mock_request.return_value = mock_async_response

        response = await async_client.get("/users")

        assert response.status_code == 200
        mock_request.assert_called_once()

    @pytest.mark.asyncio
    @patch("httpx.AsyncClient.request")
    async def test_async_post_request(
        self, mock_request, async_client, mock_async_response
    ):
        """Test async POST request."""
        mock_request.return_value = mock_async_response

        response = await async_client.post("/users", json={"name": "Test"})

        assert response.status_code == 200
        mock_request.assert_called_once()

    @pytest.mark.asyncio
    async def test_batch_requests(self, async_client):
        """Test batch requests."""
        requests = [
            {"method": "GET", "endpoint": "/users/1"},
            {"method": "GET", "endpoint": "/users/2"},
            {"method": "GET", "endpoint": "/users/3"},
        ]

        with patch.object(async_client, "_request") as mock_request:
            mock_request.return_value = Mock(
                status_code=200, json=lambda: {"id": "test"}
            )

            responses = await async_client.batch_request(requests, max_concurrency=2)

            assert len(responses) == 3
            assert all(
                r.status_code == 200 for r in responses if not isinstance(r, Exception)
            )
