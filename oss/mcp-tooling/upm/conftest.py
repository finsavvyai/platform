"""
Pytest configuration for UPM test suite.
"""

import pytest
import asyncio
from unittest.mock import AsyncMock

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from udp.core.models.base import Base


@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
async def db_session():
    """Create a test database session."""

    # Use in-memory SQLite for testing
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        echo=False,
    )

    # Create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Create session
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        yield session

    # Clean up
    await engine.dispose()


# Mock fixtures
@pytest.fixture
def mock_user_service():
    """Mock user service for testing."""
    from unittest.mock import AsyncMock

    return AsyncMock()


@pytest.fixture
def mock_notification_service():
    """Mock notification service for testing."""
    from unittest.mock import AsyncMock

    return AsyncMock()


@pytest.fixture
def mock_approval_workflow():
    """Mock approval workflow for testing."""
    from unittest.mock import AsyncMock, MagicMock

    mock_workflow = AsyncMock()
    mock_workflow.execute.return_value = {
        "workflow_id": "test-workflow-id",
        "status": "completed",
        "final_decision": "approved",
        "decision_rationale": "Test approval",
    }

    return mock_workflow


# Test markers
pytest_plugins = []


# Custom markers
def pytest_configure(config):
    """Configure custom markers."""
    config.addinivalue_line("markers", "unit: Mark test as unit test")
    config.addinivalue_line("markers", "integration: Mark test as integration test")
    config.addinivalue_line("markers", "e2e: Mark test as end-to-end test")
    config.addinivalue_line("markers", "slow: Mark test as slow running")
    config.addinivalue_line("markers", "security: Mark test as security-related")
    config.addinivalue_line("markers", "policy: Mark test as policy-related")


# Test collection configuration
collect_ignore_glob = [
    "migrations/*",
    ".git/*",
    ".pytest_cache/*",
    "__pycache__/*",
    "*.pyc",
]
