"""
Pytest configuration and fixtures for SDLC.ai SDK tests.
"""

import os
import pytest
from unittest.mock import Mock, AsyncMock
import httpx

from sdlc_sdk import SDLCClient, AsyncSDLCClient, Config
from sdlc_sdk.auth import APIKeyAuth


@pytest.fixture
def api_key():
    """Get test API key."""
    return os.getenv("SDLC_TEST_API_KEY", "test-api-key-12345")


@pytest.fixture
def base_url():
    """Get test base URL."""
    return os.getenv("SDLC_TEST_URL", "https://api.test.sdlc.ai")


@pytest.fixture
def config(base_url):
    """Create test configuration."""
    return Config(
        base_url=base_url,
        timeout=5.0,
        retry=dict(max_retries=1),
        security=dict(verify_ssl=False),
    )


@pytest.fixture
def auth(api_key):
    """Create test authentication."""
    return APIKeyAuth(api_key=api_key)


@pytest.fixture
def client(config, auth):
    """Create synchronous test client."""
    return SDLCClient(config=config, auth=auth)


@pytest.fixture
async def async_client(config, auth):
    """Create asynchronous test client."""
    client = AsyncSDLCClient(config=config, auth=auth)
    yield client
    await client.close()


@pytest.fixture
def mock_response():
    """Create mock HTTP response."""
    response = Mock(spec=httpx.Response)
    response.status_code = 200
    response.json.return_value = {"success": True}
    response.headers = {}
    response.elapsed = Mock()
    response.elapsed.total_seconds.return_value = 0.1
    return response


@pytest.fixture
def mock_async_response():
    """Create mock async HTTP response."""
    response = AsyncMock(spec=httpx.Response)
    response.status_code = 200
    response.json.return_value = {"success": True}
    response.headers = {}
    response.elapsed = Mock()
    response.elapsed.total_seconds.return_value = 0.1
    response.is_error = False
    return response


@pytest.fixture
def sample_user_data():
    """Sample user data for testing."""
    return {
        "id": "user-123",
        "email": "test@example.com",
        "name": "Test User",
        "tenant_id": "tenant-123",
        "is_active": True,
        "created_at": "2024-01-01T00:00:00Z",
        "updated_at": "2024-01-01T00:00:00Z",
    }


@pytest.fixture
def sample_tenant_data():
    """Sample tenant data for testing."""
    return {
        "id": "tenant-123",
        "name": "Test Tenant",
        "slug": "test-tenant",
        "owner_id": "user-123",
        "status": "active",
        "created_at": "2024-01-01T00:00:00Z",
        "updated_at": "2024-01-01T00:00:00Z",
    }


@pytest.fixture
def sample_document_data():
    """Sample document data for testing."""
    return {
        "id": "doc-123",
        "name": "Test Document.pdf",
        "tenant_id": "tenant-123",
        "owner_id": "user-123",
        "status": "processed",
        "processing_status": "completed",
        "is_indexed": True,
        "created_at": "2024-01-01T00:00:00Z",
        "updated_at": "2024-01-01T00:00:00Z",
    }
