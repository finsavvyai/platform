"""
Unit tests for database connection and transaction management.

Tests the DatabaseManager class, connection pooling, transaction handling,
and health monitoring functionality.
"""

import pytest
import asyncio
from unittest.mock import AsyncMock, Mock, patch, MagicMock
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from sqlalchemy.exc import SQLAlchemyError

from udp.infrastructure.database_manager import (
    DatabaseManager,
    db_manager,
    get_async_session,
    check_database_health,
    init_database,
    close_database,
)
from udp.core.services import DatabaseError as UPMDatabaseError


@pytest.mark.asyncio
class TestDatabaseManager:
    """Test database manager functionality."""

    @pytest.fixture
    async def database_manager(self):
        """Create a test database manager instance."""
        manager = DatabaseManager()
        # Don't initialize for most tests to avoid actual DB connections
        yield manager
        # Cleanup
        if manager.is_initialized:
            await manager.close()

    @pytest.fixture
    async def mock_settings(self):
        """Mock database settings for testing."""
        with patch("udp.infrastructure.database_manager.settings") as mock_settings:
            mock_settings.DATABASE_URL = "sqlite+aiosqlite:///:memory:"
            mock_settings.DEBUG = False
            mock_settings.DATABASE_POOL_SIZE = 5
            mock_settings.DATABASE_MAX_OVERFLOW = 10
            mock_settings.DATABASE_POOL_TIMEOUT = 30
            mock_settings.DATABASE_POOL_RECYCLE = 3600
            yield mock_settings

    async def test_database_manager_initialization(
        self, database_manager, mock_settings
    ):
        """Test database manager initialization."""
        # Should not be initialized initially
        assert not database_manager.is_initialized
        assert database_manager._engine is None
        assert database_manager._session_factory is None

        # Initialize
        await database_manager.initialize()

        # Should be initialized
        assert database_manager.is_initialized
        assert database_manager._engine is not None
        assert database_manager._session_factory is not None

        # Test re-initialization (should not double-initialize)
        await database_manager.initialize()
        assert database_manager.is_initialized

    async def test_database_manager_postgresql_config(self, mock_settings):
        """Test PostgreSQL-specific configuration."""
        mock_settings.DATABASE_URL = "postgresql+asyncpg://user:pass@localhost/test"

        manager = DatabaseManager()

        with patch(
            "udp.infrastructure.database_manager.create_async_engine"
        ) as mock_create_engine:
            mock_engine = AsyncMock()
            mock_create_engine.return_value = mock_engine

            await manager.initialize()

            # Check that PostgreSQL-specific arguments were passed
            mock_create_engine.assert_called_once()
            call_args = mock_create_engine.call_args
            assert call_args[1]["poolclass"] is not None  # QueuePool
            assert "connect_args" in call_args[1]
            assert "server_settings" in call_args[1]["connect_args"]

    async def test_get_session_uninitialized(self, database_manager):
        """Test getting session when manager is not initialized."""
        with pytest.raises(UPMDatabaseError) as exc_info:
            async with database_manager.get_session():
                pass

        assert exc_info.value.error_code == "DB_NOT_INITIALIZED"

    async def test_get_session_success(self, database_manager, mock_settings):
        """Test successful session creation and cleanup."""
        await database_manager.initialize()

        # Mock session
        mock_session = AsyncMock(spec=AsyncSession)
        database_manager._session_factory = AsyncMock(return_value=mock_session)

        # Use session
        async with database_manager.get_session() as session:
            assert session == mock_session
            mock_session.close.assert_not_called()  # Should not close while in use

        # Session should be closed after context
        mock_session.close.assert_called_once()

    async def test_get_session_with_error(self, database_manager, mock_settings):
        """Test session error handling and rollback."""
        await database_manager.initialize()

        # Mock session that raises an error
        mock_session = AsyncMock(spec=AsyncSession)
        mock_session.rollback = AsyncMock()
        database_manager._session_factory = AsyncMock(return_value=mock_session)

        # Simulate error in session
        with pytest.raises(ValueError):
            async with database_manager.get_session() as session:
                raise ValueError("Test error")

        # Rollback should be called
        mock_session.rollback.assert_called_once()
        mock_session.close.assert_called_once()

    async def test_execute_in_transaction_success(
        self, database_manager, mock_settings
    ):
        """Test successful transaction execution."""
        await database_manager.initialize()

        # Mock operations
        operation1 = AsyncMock(return_value="result1")
        operation2 = AsyncMock(return_value="result2")

        # Mock session
        mock_session = AsyncMock(spec=AsyncSession)
        mock_session.commit = AsyncMock()
        database_manager._session_factory = AsyncMock(return_value=mock_session)

        # Execute transaction
        results = await database_manager.execute_in_transaction(
            [operation1, operation2]
        )

        # Verify results
        assert results == ["result1", "result2"]
        operation1.assert_called_once_with(mock_session)
        operation2.assert_called_once_with(mock_session)
        mock_session.commit.assert_called_once()

    async def test_execute_in_transaction_with_error_rollback(
        self, database_manager, mock_settings
    ):
        """Test transaction rollback on error."""
        await database_manager.initialize()

        # Mock operations - second one fails
        operation1 = AsyncMock(return_value="result1")
        operation2 = AsyncMock(side_effect=ValueError("Test error"))

        # Mock session
        mock_session = AsyncMock(spec=AsyncSession)
        mock_session.commit = AsyncMock()
        mock_session.rollback = AsyncMock()
        database_manager._session_factory = AsyncMock(return_value=mock_session)

        # Execute transaction - should raise error
        with pytest.raises(UPMDatabaseError):
            await database_manager.execute_in_transaction([operation1, operation2])

        # Verify rollback was called
        mock_session.rollback.assert_called_once()
        mock_session.commit.assert_not_called()

    async def test_execute_in_transaction_with_error_no_rollback(
        self, database_manager, mock_settings
    ):
        """Test transaction with error but no rollback."""
        await database_manager.initialize()

        # Mock operations - second one fails
        operation1 = AsyncMock(return_value="result1")
        operation2 = AsyncMock(side_effect=ValueError("Test error"))

        # Mock session
        mock_session = AsyncMock(spec=AsyncSession)
        mock_session.commit = AsyncMock()
        mock_session.rollback = AsyncMock()
        database_manager._session_factory = AsyncMock(return_value=mock_session)

        # Execute transaction with no rollback
        with pytest.raises(UPMDatabaseError):
            await database_manager.execute_in_transaction(
                [operation1, operation2], rollback_on_error=False
            )

        # Verify rollback was NOT called
        mock_session.rollback.assert_not_called()

    async def test_execute_in_transaction_empty_operations(
        self, database_manager, mock_settings
    ):
        """Test transaction with no operations."""
        await database_manager.initialize()

        results = await database_manager.execute_in_transaction([])
        assert results == []

    async def test_warm_connection_pool(self, database_manager, mock_settings):
        """Test connection pool warmup."""
        await database_manager.initialize()

        # Mock the _create_test_connection method
        database_manager._create_test_connection = AsyncMock()

        # Warm up connections
        result = await database_manager.warm_connection_pool(count=3)

        # Verify results
        assert result["requested_connections"] == 3
        assert result["successful_connections"] == 3
        assert result["failed_connections"] == 0
        assert len(result["errors"]) == 0
        assert result["total_time_ms"] >= 0

        # Verify test connections were created
        assert database_manager._create_test_connection.call_count == 3

    async def test_warm_connection_pool_with_failures(
        self, database_manager, mock_settings
    ):
        """Test connection pool warmup with some failures."""
        await database_manager.initialize()

        # Mock the _create_test_connection method - some fail
        async def mock_create_test_connection(conn_id):
            if conn_id == 1:
                raise ValueError("Connection failed")
            return None

        database_manager._create_test_connection = AsyncMock(
            side_effect=mock_create_test_connection
        )

        # Warm up connections
        result = await database_manager.warm_connection_pool(count=3)

        # Verify results
        assert result["requested_connections"] == 3
        assert result["successful_connections"] == 2  # 2 succeed, 1 fails
        assert result["failed_connections"] == 1
        assert len(result["errors"]) == 1

    async def test_get_connection_pool_stats_uninitialized(self, database_manager):
        """Test getting pool stats when not initialized."""
        stats = await database_manager.get_connection_pool_stats()
        assert stats["pool_size"] == 0
        assert stats["checked_in"] == 0

    async def test_get_connection_pool_stats(self, database_manager, mock_settings):
        """Test getting connection pool statistics."""
        await database_manager.initialize()

        # Mock pool
        mock_pool = AsyncMock()
        mock_pool.size.return_value = 10
        mock_pool.checkedin.return_value = 5
        mock_pool.checkedout.return_value = 3
        mock_pool.overflow.return_value = 2
        mock_pool.invalid.return_value = 0

        database_manager._engine.pool = mock_pool

        stats = await database_manager.get_connection_pool_stats()
        assert stats["pool_size"] == 10
        assert stats["checked_in"] == 5
        assert stats["checked_out"] == 3
        assert stats["overflow"] == 2
        assert stats["invalid"] == 0

    async def test_check_database_health_success(self, database_manager, mock_settings):
        """Test successful database health check."""
        await database_manager.initialize()

        # Mock successful health check
        async def mock_get_session():
            mock_session = AsyncMock(spec=AsyncSession)
            mock_result = AsyncMock()
            mock_result.fetchone.return_value = (1,)
            mock_session.execute.return_value = mock_result
            return mock_session

        database_manager.get_session = mock_get_session

        health = await database_manager.check_database_health()

        assert health["healthy"] is True
        assert health["response_time_ms"] >= 0
        assert "connection_pool" in health
        assert health["error"] is None

    async def test_check_database_health_failure(self, database_manager, mock_settings):
        """Test database health check failure."""
        await database_manager.initialize()

        # Mock failed health check
        async def mock_get_session():
            raise SQLAlchemyError("Connection failed")

        database_manager.get_session = mock_get_session

        health = await database_manager.check_database_health()

        assert health["healthy"] is False
        assert "Connection failed" in health["error"]
        assert health["error_count"] > 0

    async def test_health_check_caching(self, database_manager, mock_settings):
        """Test health check result caching."""
        await database_manager.initialize()

        # Mock successful health check
        async def mock_get_session():
            mock_session = AsyncMock(spec=AsyncSession)
            mock_result = AsyncMock()
            mock_result.fetchone.return_value = (1,)
            mock_session.execute.return_value = mock_result
            return mock_session

        database_manager.get_session = mock_get_session

        # First call
        health1 = await database_manager.check_database_health()
        first_time = health1["timestamp"]

        # Second call within cache interval (should return cached result)
        health2 = await database_manager.check_database_health()
        second_time = health2["timestamp"]

        # Should be the same cached result
        assert health1["timestamp"] == health2["timestamp"]

    async def test_get_postgresql_info(self, database_manager):
        """Test PostgreSQL database info retrieval."""
        mock_session = AsyncMock(spec=AsyncSession)

        # Mock database queries
        version_result = AsyncMock()
        version_result.scalar.return_value = "PostgreSQL 14.0"
        conn_result = AsyncMock()
        conn_result.scalar.return_value = 5
        size_result = AsyncMock()
        size_result.scalar.return_value = "125MB"

        async def mock_execute(query):
            if "version()" in str(query):
                return version_result
            elif "pg_stat_activity" in str(query):
                return conn_result
            elif "pg_database_size" in str(query):
                return size_result
            return AsyncMock()

        mock_session.execute = mock_execute

        info = await database_manager._get_postgresql_info(mock_session)

        assert info["database_type"] == "postgresql"
        assert "PostgreSQL 14.0" in info["version"]
        assert info["active_connections"] == 5
        assert info["database_size"] == "125MB"

    async def test_get_sqlite_info(self, database_manager):
        """Test SQLite database info retrieval."""
        mock_session = AsyncMock(spec=AsyncSession)

        # Mock database queries
        version_result = AsyncMock()
        version_result.scalar.return_value = "3.39.0"
        page_count_result = AsyncMock()
        page_count_result.scalar.return_value = 100
        page_size_result = AsyncMock()
        page_size_result.scalar.return_value = 4096

        async def mock_execute(query):
            if "sqlite_version()" in str(query):
                return version_result
            elif "page_count" in str(query):
                return page_count_result
            elif "page_size" in str(query):
                return page_size_result
            return AsyncMock()

        mock_session.execute = mock_execute

        info = await database_manager._get_sqlite_info(mock_session)

        assert info["database_type"] == "sqlite"
        assert "SQLite 3.39.0" in info["version"]
        assert info["page_count"] == 100
        assert info["page_size"] == 4096
        assert info["database_size_mb"] == 0.39  # 100 * 4096 / (1024 * 1024)

    async def test_close_database(self, database_manager, mock_settings):
        """Test database connection cleanup."""
        await database_manager.initialize()
        assert database_manager.is_initialized

        # Mock engine dispose
        database_manager._engine = AsyncMock()
        database_manager._engine.dispose = AsyncMock()

        await database_manager.close()

        assert not database_manager.is_initialized
        assert database_manager._engine is None
        assert database_manager._session_factory is None
        database_manager._engine.dispose.assert_called_once()

    async def test_close_uninitialized_database(self, database_manager):
        """Test closing database when not initialized."""
        # Should not raise error
        await database_manager.close()
        assert not database_manager.is_initialized


@pytest.mark.asyncio
class TestGlobalDatabaseManager:
    """Test global database manager instance and convenience functions."""

    async def test_global_db_manager_exists(self):
        """Test that global database manager instance exists."""
        from udp.infrastructure.database_manager import db_manager

        assert isinstance(db_manager, DatabaseManager)

    async def test_get_async_session_function(self):
        """Test global get_async_session function."""
        with patch("udp.infrastructure.database_manager.db_manager") as mock_manager:
            mock_context = AsyncMock()
            mock_manager.get_session.return_value.__aenter__ = AsyncMock(
                return_value="session"
            )
            mock_manager.get_session.return_value.__aexit__ = AsyncMock(
                return_value=None
            )

            # Use the function
            async with get_async_session() as session:
                assert session == "session"

            mock_manager.get_session.assert_called_once()

    async def test_check_database_health_function(self):
        """Test global check_database_health function."""
        with patch("udp.infrastructure.database_manager.db_manager") as mock_manager:
            mock_manager.check_database_health = AsyncMock(
                return_value={"healthy": True}
            )

            result = await check_database_health()
            assert result == {"healthy": True}
            mock_manager.check_database_health.assert_called_once()

    async def test_init_database_function(self):
        """Test global init_database function."""
        with patch("udp.infrastructure.database_manager.db_manager") as mock_manager:
            mock_manager.initialize = AsyncMock()

            await init_database()
            mock_manager.initialize.assert_called_once()

    async def test_close_database_function(self):
        """Test global close_database function."""
        with patch("udp.infrastructure.database_manager.db_manager") as mock_manager:
            mock_manager.close = AsyncMock()

            await close_database()
            mock_manager.close.assert_called_once()


@pytest.mark.asyncio
class TestDatabaseIntegration:
    """Integration tests for database management."""

    @pytest.fixture
    async def in_memory_db(self):
        """Create in-memory database for testing."""
        manager = DatabaseManager()

        with patch("udp.infrastructure.database_manager.settings") as mock_settings:
            mock_settings.DATABASE_URL = "sqlite+aiosqlite:///:memory:"
            mock_settings.DEBUG = False

            await manager.initialize()
            yield manager
            await manager.close()

    async def test_full_database_lifecycle(self, in_memory_db):
        """Test complete database lifecycle."""
        manager = in_memory_db

        # Should be initialized
        assert manager.is_initialized

        # Test session creation
        async with manager.get_session() as session:
            assert session is not None

            # Test basic query
            result = await session.execute(manager._engine.text("SELECT 1"))
            assert result.fetchone()[0] == 1

        # Test health check
        health = await manager.check_database_health()
        assert health["healthy"] is True

        # Test connection pool stats
        stats = await manager.get_connection_pool_stats()
        assert stats["pool_size"] >= 0

    async def test_transaction_commit(self, in_memory_db):
        """Test transaction commit functionality."""
        manager = in_memory_db

        # Create a table for testing
        async with manager.get_session() as session:
            await session.execute(
                manager._engine.text("""
                CREATE TABLE IF NOT EXISTS test_table (
                    id INTEGER PRIMARY KEY,
                    name TEXT
                )
            """)
            )
            await session.commit()

        # Define operations
        async def insert_operation(session):
            await session.execute(
                manager._engine.text("INSERT INTO test_table (name) VALUES ('test')")
            )
            return "inserted"

        async def select_operation(session):
            result = await session.execute(
                manager._engine.text("SELECT COUNT(*) FROM test_table")
            )
            return result.scalar()

        # Execute transaction
        results = await manager.execute_in_transaction(
            [insert_operation, select_operation]
        )

        assert results[0] == "inserted"
        assert results[1] == 1

    async def test_transaction_rollback(self, in_memory_db):
        """Test transaction rollback functionality."""
        manager = in_memory_db

        # Create a table for testing
        async with manager.get_session() as session:
            await session.execute(
                manager._engine.text("""
                CREATE TABLE IF NOT EXISTS test_table (
                    id INTEGER PRIMARY KEY,
                    name TEXT
                )
            """)
            )
            await session.commit()

        # Define operations - second one fails
        async def insert_operation(session):
            await session.execute(
                manager._engine.text("INSERT INTO test_table (name) VALUES ('test')")
            )
            return "inserted"

        async def failing_operation(session):
            raise ValueError("Test error")

        # Execute transaction - should rollback
        with pytest.raises(UPMDatabaseError):
            await manager.execute_in_transaction([insert_operation, failing_operation])

        # Verify rollback worked - table should be empty
        async with manager.get_session() as session:
            result = await session.execute(
                manager._engine.text("SELECT COUNT(*) FROM test_table")
            )
            count = result.scalar()
            assert count == 0


if __name__ == "__main__":
    # Run tests
    pytest.main([__file__, "-v"])
