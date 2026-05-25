"""
Comprehensive tests for UPM database connection and transaction management.

Tests async database sessions, connection pooling, transaction handling,
and database health monitoring.
"""

import pytest
import asyncio
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch, AsyncMock
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.exc import SQLAlchemyError, OperationalError, DisconnectionError
from sqlalchemy import text

from src.udp.infrastructure.database import (
    DatabaseConnectionManager,
    db_manager,
    transaction,
    with_session,
    DatabaseError,
    ConnectionPoolError,
    TransactionError,
    get_db_session,
    initialize_database,
    check_database_health,
)
from src.udp.core.config import get_settings


@pytest.fixture
async def test_db_engine():
    """Create test database engine."""
    # Use in-memory SQLite for testing
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)

    # Create test table
    async with engine.begin() as conn:
        await conn.execute(
            text("""
            CREATE TABLE test_table (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        )

    yield engine

    # Cleanup
    await engine.dispose()


@pytest.fixture
async def db_session(test_db_engine):
    """Create test database session."""
    async with AsyncSession(test_db_engine) as session:
        yield session


@pytest.fixture
def mock_settings():
    """Mock settings for testing."""
    settings = MagicMock()
    settings.DATABASE_URL = "sqlite+aiosqlite:///:memory:"
    settings.SQLALCHEMY_ECHO = False
    settings.ENVIRONMENT = "test"
    settings.DB_POOL_SIZE = 5
    settings.DB_MAX_OVERFLOW = 10
    settings.DB_POOL_TIMEOUT = 30
    settings.DB_POOL_RECYCLE = 3600
    settings.DATABASE_SSL_MODE = "prefer"
    settings.VERSION = "1.0.0"
    settings.REDIS_URL = "redis://localhost:6379/0"

    return settings


@pytest.mark.asyncio
class TestDatabaseConnectionManager:
    """Test cases for DatabaseConnectionManager."""

    async def test_singleton_pattern(self):
        """Test that DatabaseConnectionManager follows singleton pattern."""
        manager1 = DatabaseConnectionManager()
        manager2 = DatabaseConnectionManager()

        assert manager1 is manager2

    async def test_initialization_success(self, mock_settings):
        """Test successful database initialization."""
        with patch(
            "src.udp.infrastructure.database.get_settings", return_value=mock_settings
        ):
            manager = DatabaseConnectionManager()
            await manager.initialize()

            assert manager._engine is not None
            assert manager._session_factory is not None

    async def test_initialization_failure(self):
        """Test database initialization failure."""
        with patch("src.udp.infrastructure.database.get_settings") as mock_settings:
            mock_settings.return_value.DATABASE_URL = "invalid://connection"

            manager = DatabaseConnectionManager()

            with pytest.raises(DatabaseError) as exc:
                await manager.initialize()

            assert "Failed to initialize database" in str(exc)

    async def test_get_session_context_manager(self, test_db_engine):
        """Test getting database session using context manager."""
        manager = DatabaseConnectionManager()
        manager._engine = test_db_engine
        manager._session_factory = async_sessionmaker(test_db_engine)

        async with manager.get_session() as session:
            assert isinstance(session, AsyncSession)

            # Test basic database operation
            result = await session.execute(text("SELECT 1 as test"))
            row = result.first()
            assert row[0] == 1

    async def test_get_session_manual_cleanup(self, test_db_engine):
        """Test getting database session with manual cleanup."""
        manager = DatabaseConnectionManager()
        manager._engine = test_db_engine
        manager._session_factory = async_sessionmaker(test_db_engine)

        session = await manager.get_db_session()
        assert isinstance(session, AsyncSession)

        # Manual cleanup
        await session.close()

    async def test_get_connection_context_manager(self, test_db_engine):
        """Test getting database connection using context manager."""
        manager = DatabaseConnectionManager()
        manager._engine = test_db_engine

        async with manager.get_connection() as conn:
            result = await conn.execute(text("SELECT 1 as test"))
            row = result.first()
            assert row[0] == 1

    async def test_execute_in_transaction_success(self, test_db_engine):
        """Test successful transaction execution."""
        manager = DatabaseConnectionManager()
        manager._engine = test_db_engine
        manager._session_factory = async_sessionmaker(test_db_engine)

        async def insert_operation(session):
            await session.execute(
                text("INSERT INTO test_table (name) VALUES (:name)"),
                {"name": "test_transaction"},
            )
            return "success"

        result = await manager.execute_in_transaction(insert_operation)
        assert result == "success"

        # Verify data was committed
        async with manager.get_session() as session:
            result = await session.execute(
                text("SELECT name FROM test_table WHERE name = :name"),
                {"name": "test_transaction"},
            )
            row = result.first()
            assert row[0] == "test_transaction"

    async def test_execute_in_transaction_rollback(self, test_db_engine):
        """Test transaction rollback on error."""
        manager = DatabaseConnectionManager()
        manager._engine = test_db_engine
        manager._session_factory = async_sessionmaker(test_db_engine)

        async def failing_operation(session):
            await session.execute(
                text("INSERT INTO test_table (name) VALUES (:name)"),
                {"name": "before_error"},
            )
            raise Exception("Simulated error")

        with pytest.raises(TransactionError) as exc:
            await manager.execute_in_transaction(failing_operation)

        assert "Transaction failed" in str(exc)

        # Verify data was not committed
        async with manager.get_session() as session:
            result = await session.execute(
                text("SELECT COUNT(*) FROM test_table WHERE name = :name"),
                {"name": "before_error"},
            )
            count = result.scalar()
            assert count == 0

    async def test_execute_multiple_transactions(self, test_db_engine):
        """Test executing multiple separate transactions."""
        manager = DatabaseConnectionManager()
        manager._engine = test_db_engine
        manager._session_factory = async_sessionmaker(test_db_engine)

        async def operation1(session):
            await session.execute(
                text("INSERT INTO test_table (name) VALUES (:name)"),
                {"name": "transaction1"},
            )
            return "result1"

        async def operation2(session):
            await session.execute(
                text("INSERT INTO test_table (name) VALUES (:name)"),
                {"name": "transaction2"},
            )
            return "result2"

        results = await manager.execute_multiple_transactions([operation1, operation2])
        assert results == ["result1", "result2"]

        # Verify both operations were committed
        async with manager.get_session() as session:
            result = await session.execute(
                text(
                    "SELECT COUNT(*) FROM test_table WHERE name IN ('transaction1', 'transaction2')"
                )
            )
            count = result.scalar()
            assert count == 2

    async def test_health_check_success(self, test_db_engine):
        """Test successful health check."""
        manager = DatabaseConnectionManager()
        manager._engine = test_db_engine
        manager._session_factory = async_sessionmaker(test_db_engine)

        health = await manager.health_check()

        assert health["status"] == "healthy"
        assert "timestamp" in health
        assert "checks" in health

        assert health["checks"]["connectivity"]["status"] == "healthy"
        assert health["checks"]["session_creation"]["status"] == "healthy"
        assert health["checks"]["transactions"]["status"] == "healthy"

    async def test_health_check_failure(self, mock_settings):
        """Test health check with database failure."""
        mock_settings.DATABASE_URL = "postgresql://invalid:invalid@localhost/invalid"

        with patch(
            "src.udp.infrastructure.database.get_settings", return_value=mock_settings
        ):
            manager = DatabaseConnectionManager()

            with pytest.raises(DatabaseError):
                await manager.initialize()

            health = await manager.health_check()
            assert health["status"] == "unhealthy"

    async def test_get_connection_pool_stats(self, test_db_engine):
        """Test getting connection pool statistics."""
        manager = DatabaseConnectionManager()
        manager._engine = test_db_engine

        stats = await manager.get_connection_pool_stats()
        assert "pool_size" in stats
        assert isinstance(stats["pool_size"], int)

    async def test_warm_connection_pool(self, test_db_engine):
        """Test warming up connection pool."""
        manager = DatabaseConnectionManager()
        manager._engine = test_db_engine
        manager._session_factory = async_sessionmaker(test_db_engine)

        await manager.warm_connection_pool(count=3)

        # Should not raise any exceptions
        assert True

    async def test_close_database(self, test_db_engine):
        """Test closing database connections."""
        manager = DatabaseConnectionManager()
        manager._engine = test_db_engine

        await manager.close()
        assert manager._engine is None
        assert manager._session_factory is None

    async def test_is_healthy_cached(self, test_db_engine):
        """Test cached health status."""
        manager = DatabaseConnectionManager()
        manager._engine = test_db_engine
        manager._session_factory = async_sessionmaker(test_db_engine)

        # First health check
        health1 = await manager.health_check()
        assert health1["status"] == "healthy"

        # Second health check should use cache
        health2 = await manager.health_check()
        assert health2["status"] == "healthy"
        assert health2["timestamp"] == health1["timestamp"]


@pytest.mark.asyncio
class TestDatabaseDecorators:
    """Test cases for database decorators."""

    async def test_transaction_decorator_success(self, test_db_engine):
        """Test successful transaction decorator."""
        manager = DatabaseConnectionManager()
        manager._engine = test_db_engine
        manager._session_factory = async_sessionmaker(test_db_engine)

        with patch("src.udp.infrastructure.database.db_manager", manager):

            @transaction()
            async def test_operation(session):
                await session.execute(text("SELECT 1 as test"))
                return "decorator_success"

            result = await test_operation()
            assert result == "decorator_success"

    async def test_transaction_decorator_failure(self, test_db_engine):
        """Test transaction decorator with failure."""
        manager = DatabaseConnectionManager()
        manager._engine = test_db_engine
        manager._session_factory = async_sessionmaker(test_db_engine)

        with patch("src.udp.infrastructure.database.db_manager", manager):

            @transaction()
            async def failing_operation(session):
                raise Exception("Decorator test error")

            with pytest.raises(TransactionError):
                await failing_operation()

    async def test_with_session_decorator(self, test_db_engine):
        """Test with_session decorator."""
        manager = DatabaseConnectionManager()
        manager._engine = test_db_engine
        manager._session_factory = async_sessionmaker(test_db_engine)

        with patch("src.udp.infrastructure.database.db_manager", manager):

            @with_session
            async def test_operation(session):
                result = await session.execute(text("SELECT 1 as test"))
                return result.first()[0]

            result = await test_operation()
            assert result == 1


@pytest.mark.asyncio
class TestDatabaseUtilities:
    """Test cases for database utility functions."""

    async def test_get_db_session(self, test_db_engine):
        """Test get_db_session utility function."""
        manager = DatabaseConnectionManager()
        manager._engine = test_db_engine
        manager._session_factory = async_sessionmaker(test_db_engine)

        with patch("src.udp.infrastructure.database.db_manager", manager):
            session = await get_db_session()
            assert isinstance(session, AsyncSession)
            await session.close()

    async def test_initialize_database(self, mock_settings):
        """Test initialize_database utility function."""
        with patch(
            "src.udp.infrastructure.database.get_settings", return_value=mock_settings
        ):
            await initialize_database()

            manager = DatabaseConnectionManager()
            assert manager._engine is not None
            assert manager._session_factory is not None

    async def test_close_database(self):
        """Test close_database utility function."""
        await close_database()

        manager = DatabaseConnectionManager()
        assert manager._engine is None


@pytest.mark.asyncio
class TestDatabaseErrorHandling:
    """Test cases for database error handling."""

    async def test_connection_pool_error(self):
        """Test ConnectionPoolError handling."""
        error = ConnectionPoolError("Pool exhausted")

        assert error.error_code == "CONNECTION_POOL_ERROR"
        assert "Pool exhausted" in error.message

    async def test_transaction_error(self):
        """Test TransactionError handling."""
        error = TransactionError("Transaction failed", details={"step": "validation"})

        assert error.error_code == "TRANSACTION_ERROR"
        assert "Transaction failed" in error.message
        assert error.details["step"] == "validation"

    async def test_database_error_with_context(self):
        """Test DatabaseError with context information."""
        error = DatabaseError(
            "Database operation failed",
            error_code="DB_ERROR",
            details={"query": "SELECT * FROM users", "params": {"id": 123}},
        )

        assert error.error_code == "DB_ERROR"
        assert error.details["query"] == "SELECT * FROM users"
        assert error.details["params"]["id"] == 123


@pytest.mark.asyncio
async def test_database_integration():
    """Integration test for database components."""
    # Create test database
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)

    # Create tables
    async with engine.begin() as conn:
        await conn.execute(
            text("""
            CREATE TABLE users (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT UNIQUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        )
        await conn.execute(
            text("""
            CREATE TABLE posts (
                id INTEGER PRIMARY KEY,
                title TEXT NOT NULL,
                user_id INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        """)
        )

    # Test manager
    manager = DatabaseConnectionManager()
    manager._engine = engine
    manager._session_factory = async_sessionmaker(engine)

    try:
        # Test multiple operations in transaction
        async def create_user_and_posts(session):
            # Insert user
            await session.execute(
                text("INSERT INTO users (name, email) VALUES (:name, :email)"),
                {"name": "Test User", "email": "test@example.com"},
            )

            # Get user ID
            result = await session.execute(text("SELECT last_insert_rowid()"))
            user_id = result.scalar()

            # Insert posts
            await session.execute(
                text("INSERT INTO posts (title, user_id) VALUES (:title, :user_id)"),
                {"title": "Test Post 1", "user_id": user_id},
            )
            await session.execute(
                text("INSERT INTO posts (title, user_id) VALUES (:title, :user_id)"),
                {"title": "Test Post 2", "user_id": user_id},
            )

            return user_id

        user_id = await manager.execute_in_transaction(create_user_and_posts)
        assert user_id is not None

        # Verify data
        async with manager.get_session() as session:
            # Check user count
            user_count = await session.execute(text("SELECT COUNT(*) FROM users"))
            assert user_count.scalar() == 1

            # Check post count
            post_count = await session.execute(text("SELECT COUNT(*) FROM posts"))
            assert post_count.scalar() == 2

            # Check relationship
            posts = await session.execute(
                text("SELECT title FROM posts WHERE user_id = :user_id"),
                {"user_id": user_id},
            )
            post_titles = [row[0] for row in posts.fetchall()]
            assert "Test Post 1" in post_titles
            assert "Test Post 2" in post_titles

        # Test health check
        health = await manager.health_check()
        assert health["status"] == "healthy"

        # Test connection pool stats
        stats = await manager.get_connection_pool_stats()
        assert "pool_size" in stats

        print("✅ Database integration test completed successfully")

    finally:
        # Cleanup
        await manager.close()
        await engine.dispose()


@pytest.mark.asyncio
async def test_database_concurrent_operations():
    """Test concurrent database operations."""
    # Create test database
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)

    # Create table
    async with engine.begin() as conn:
        await conn.execute(
            text("""
            CREATE TABLE concurrent_test (
                id INTEGER PRIMARY KEY,
                worker_id INTEGER,
                operation_id INTEGER,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        )

    manager = DatabaseConnectionManager()
    manager._engine = engine
    manager._session_factory = async_sessionmaker(engine)

    async def worker_operation(worker_id: int, operation_count: int):
        """Simulate concurrent worker operations."""
        for i in range(operation_count):

            async def operation(session):
                await session.execute(
                    text(
                        "INSERT INTO concurrent_test (worker_id, operation_id) VALUES (:worker_id, :operation_id)"
                    ),
                    {"worker_id": worker_id, "operation_id": i},
                )
                return i

            await manager.execute_in_transaction(operation)

    try:
        # Run concurrent operations
        workers = []
        for worker_id in range(5):
            workers.append(worker_operation(worker_id, 3))

        # Execute all workers concurrently
        await asyncio.gather(*workers)

        # Verify all operations completed
        async with manager.get_session() as session:
            result = await session.execute(text("SELECT COUNT(*) FROM concurrent_test"))
            total_count = result.scalar()
            assert total_count == 15  # 5 workers * 3 operations each

        print("✅ Concurrent operations test completed successfully")

    finally:
        # Cleanup
        await manager.close()
        await engine.dispose()


if __name__ == "__main__":
    # Run tests directly for debugging
    import asyncio

    asyncio.run(pytest.main(["-v", __file__]))
