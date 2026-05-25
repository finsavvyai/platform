"""
Pytest configuration and fixtures for Universal Dependency Platform tests.
"""

import asyncio
from typing import AsyncGenerator, Generator
from unittest.mock import AsyncMock, MagicMock

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.pool import StaticPool

from udp.api.main import app
from udp.core.config import settings
from udp.core.models.base import Base
from udp.infrastructure.database import get_async_session, async_session_maker
from udp.security.auth import create_access_token


# Test database URL
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest.fixture(scope="session")
def event_loop() -> Generator:
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture
async def test_engine():
    """Create test database engine."""
    engine = create_async_engine(
        TEST_DATABASE_URL,
        connect_args={
            "check_same_thread": False,
        },
        poolclass=StaticPool,
    )

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield engine

    await engine.dispose()


@pytest_asyncio.fixture
async def test_db_session(test_engine) -> AsyncGenerator[AsyncSession, None]:
    """Create test database session."""
    async_session_maker = async_sessionmaker(
        test_engine, class_=AsyncSession, expire_on_commit=False
    )

    async with async_session_maker() as session:
        yield session


@pytest.fixture
def override_get_async_session(test_db_session):
    """Override database session dependency."""

    async def _get_test_session():
        yield test_db_session

    app.dependency_overrides[get_async_session] = _get_test_session

    yield

    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def client(override_get_async_session) -> AsyncGenerator[AsyncClient, None]:
    """Create test client."""
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac


@pytest.fixture
def test_user_token():
    """Create test user access token."""
    data = {"sub": "test@example.com"}
    return create_access_token(data)


@pytest.fixture
def test_superuser_token():
    """Create test superuser access token."""
    data = {"sub": "admin@example.com"}
    return create_access_token(data)


@pytest.fixture
def test_headers(test_user_token):
    """Create test headers with authentication."""
    return {"Authorization": f"Bearer {test_user_token}"}


@pytest.fixture
def test_superuser_headers(test_superuser_token):
    """Create test headers with superuser authentication."""
    return {"Authorization": f"Bearer {test_superuser_token}"}


@pytest_asyncio.fixture
async def test_user(test_db_session):
    """Create test user."""
    from udp.core.models.user import User
    from uuid import uuid4
    from datetime import datetime, timezone

    user = User(
        id=uuid4(),
        email="test@example.com",
        hashed_password="$2b$12$EixZaYVK1fsbw1ZfbX3Oxe",  # "secret"
        full_name="Test User",
        is_active=True,
        is_superuser=False,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )

    test_db_session.add(user)
    await test_db_session.commit()
    await test_db_session.refresh(user)

    return user


@pytest_asyncio.fixture
async def test_superuser(test_db_session):
    """Create test superuser."""
    from udp.core.models.user import User
    from uuid import uuid4
    from datetime import datetime, timezone

    user = User(
        id=uuid4(),
        email="admin@example.com",
        hashed_password="$2b$12$EixZaYVK1fsbw1ZfbX3Oxe",  # "secret"
        full_name="Admin User",
        is_active=True,
        is_superuser=True,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )

    test_db_session.add(user)
    await test_db_session.commit()
    await test_db_session.refresh(user)

    return user


@pytest_asyncio.fixture
async def test_dependency(test_db_session, test_user):
    """Create test dependency."""
    from udp.core.models.dependency import Dependency
    from uuid import uuid4
    from datetime import datetime, timezone

    dependency = Dependency(
        id=uuid4(),
        name="test-dependency",
        version="1.0.0",
        language="python",
        framework="fastapi",
        description="Test dependency",
        is_active=True,
        created_by=test_user.id,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )

    test_db_session.add(dependency)
    await test_db_session.commit()
    await test_db_session.refresh(dependency)

    return dependency


@pytest.fixture
def mock_dependency_service():
    """Mock dependency service."""
    service = AsyncMock()
    service.create = AsyncMock()
    service.get = AsyncMock()
    service.list = AsyncMock()
    service.update = AsyncMock()
    service.delete = AsyncMock()
    service.analyze = AsyncMock()
    return service


@pytest.fixture
def mock_workflow_service():
    """Mock workflow service."""
    service = AsyncMock()
    service.create = AsyncMock()
    service.get = AsyncMock()
    service.list = AsyncMock()
    service.execute = AsyncMock()
    return service


@pytest.fixture
def mock_user_service():
    """Mock user service."""
    service = AsyncMock()
    service.create = AsyncMock()
    service.get = AsyncMock()
    service.get_by_email = AsyncMock()
    service.authenticate = AsyncMock()
    return service


# Test markers
pytest_plugins = []


def pytest_configure(config):
    """Configure pytest with custom markers."""
    config.addinivalue_line("markers", "unit: mark test as a unit test")
    config.addinivalue_line("markers", "integration: mark test as an integration test")
    config.addinivalue_line("markers", "e2e: mark test as an end-to-end test")
    config.addinivalue_line("markers", "slow: mark test as slow")


# Test configuration
@pytest.fixture(scope="session")
def test_config():
    """Test configuration settings."""
    return {
        "TEST_DATABASE_URL": TEST_DATABASE_URL,
        "SECRET_KEY": "test-secret-key",
        "ALGORITHM": "HS256",
        "ACCESS_TOKEN_EXPIRE_MINUTES": 30,
    }
