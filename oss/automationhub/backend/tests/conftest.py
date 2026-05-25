"""
Shared pytest fixtures for backend tests.
"""
# Ensure SQLite for tests before any app imports so tenant models skip schema='public'
import os
if "DATABASE_URL" not in os.environ:
    os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///./test.db"

import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from app.core.database import get_db_session, create_tables
from app.models.agent import Agent


@pytest.fixture
def mock_db_session():
    """Provide a mock DB session for auth/endpoint tests; overrides get_db app-wide."""
    from app.main import app
    from app.core.database import get_db

    session = MagicMock()
    result_mock = MagicMock()
    result_mock.scalar_one_or_none.return_value = None
    result_mock.scalars.return_value.all.return_value = []
    session.execute = AsyncMock(return_value=result_mock)
    session.commit = AsyncMock()
    session.flush = AsyncMock()
    session.add = MagicMock()
    session.refresh = AsyncMock()
    session.rollback = AsyncMock()

    async def _mock_get_db():
        yield session

    app.dependency_overrides[get_db] = _mock_get_db
    try:
        yield session
    finally:
        app.dependency_overrides.pop(get_db, None)


@pytest.fixture
def authenticated_client():
    """Headers dict for authenticated requests (Bearer token)."""
    return {"Authorization": "Bearer test-access-token"}


@pytest_asyncio.fixture(scope="session")
async def ensure_tables():
    """Create database tables once per test session."""
    await create_tables()


@pytest_asyncio.fixture
async def db(ensure_tables):
    """Provide an async database session for tests."""
    async with get_db_session() as session:
        yield session


@pytest_asyncio.fixture
async def sample_agent(db):
    """Create a sample agent for testing."""
    agent = Agent(
        name="Test Agent",
        description="Test agent description",
        agent_type="browser",
        capabilities=["web_navigation"],
        status="active",
        is_enabled=True,
    )
    db.add(agent)
    await db.commit()
    await db.refresh(agent)
    return agent
