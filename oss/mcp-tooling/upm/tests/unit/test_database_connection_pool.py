"""
Integration tests for database connection pooling and transaction management.

Tests real database operations, connection pool behavior,
and transaction handling under various scenarios.
"""

import pytest
import asyncio
import time
from typing import List
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from udp.infrastructure.database_manager import DatabaseManager


@pytest.mark.asyncio
@pytest.mark.integration
class TestConnectionPooling:
    """Test connection pooling functionality."""

    @pytest.fixture
    async def pooled_db_manager(self):
        """Create database manager with connection pooling."""
        manager = DatabaseManager()

        # Use SQLite with connection pooling (simulated)
        with patch("udp.infrastructure.database_manager.settings") as mock_settings:
            mock_settings.DATABASE_URL = "sqlite+aiosqlite:///:memory:"
            mock_settings.DEBUG = False
            mock_settings.DATABASE_POOL_SIZE = 5
            mock_settings.DATABASE_MAX_OVERFLOW = 10

            await manager.initialize()
            yield manager
            await manager.close()

    async def test_concurrent_sessions(self, pooled_db_manager):
        """Test multiple concurrent sessions."""
        manager = pooled_db_manager

        async def use_session(session_id: int):
            """Use a session for database operations."""
            async with manager.get_session() as session:
                # Create a test table
                await session.execute(
                    text("""
                    CREATE TABLE IF NOT EXISTS concurrent_test (
                        session_id INTEGER,
                        timestamp TEXT
                    )
                """)
                )

                # Insert a record
                await session.execute(
                    text(
                        "INSERT INTO concurrent_test (session_id, timestamp) VALUES (:sid, :ts)"
                    ),
                    {"sid": session_id, "ts": time.time()},
                )
                await session.commit()

                # Small delay to simulate work
                await asyncio.sleep(0.01)

                return session_id

        # Run multiple concurrent sessions
        tasks = [use_session(i) for i in range(10)]
        results = await asyncio.gather(*tasks)

        # Verify all sessions completed successfully
        assert len(results) == 10
        assert set(results) == set(range(10))

    async def test_connection_pool_warmup(self, pooled_db_manager):
        """Test connection pool warmup functionality."""
        manager = pooled_db_manager

        # Warm up connection pool
        warmup_result = await manager.warm_connection_pool(count=5)

        assert warmup_result["requested_connections"] == 5
        assert warmup_result["successful_connections"] >= 0
        assert warmup_result["total_time_ms"] >= 0

    async def test_connection_pool_stats(self, pooled_db_manager):
        """Test connection pool statistics."""
        manager = pooled_db_manager

        # Get initial stats
        initial_stats = await manager.get_connection_pool_stats()
        assert "pool_size" in initial_stats
        assert "checked_in" in initial_stats
        assert "checked_out" in initial_stats

    async def test_session_reuse(self, pooled_db_manager):
        """Test that sessions are properly reused."""
        manager = pooled_db_manager

        sessions_created = []

        async def create_session():
            async with manager.get_session() as session:
                sessions_created.append(id(session))
                await session.execute(text("SELECT 1"))
                return id(session)

        # Create multiple sessions
        tasks = [create_session() for _ in range(5)]
        await asyncio.gather(*tasks)

        # Sessions should be different instances
        assert len(set(sessions_created)) == len(sessions_created)

    async def test_connection_timeout_simulation(self, pooled_db_manager):
        """Test behavior under simulated connection constraints."""
        manager = pooled_db_manager

        async def long_running_operation():
            async with manager.get_session() as session:
                # Simulate long operation
                await asyncio.sleep(0.1)
                await session.execute(text("SELECT 1"))
                return "completed"

        # Run multiple long operations
        start_time = time.time()
        tasks = [long_running_operation() for _ in range(3)]
        results = await asyncio.gather(*tasks)
        end_time = time.time()

        # All operations should complete
        assert len(results) == 3
        assert all(result == "completed" for result in results)

        # Should take reasonable time (not too long due to proper connection management)
        assert end_time - start_time < 1.0


@pytest.mark.asyncio
@pytest.mark.integration
class TestTransactionManagement:
    """Test transaction management under various scenarios."""

    @pytest.fixture
    async def transaction_db_manager(self):
        """Create database manager for transaction testing."""
        manager = DatabaseManager()

        with patch("udp.infrastructure.database_manager.settings") as mock_settings:
            mock_settings.DATABASE_URL = "sqlite+aiosqlite:///:memory:"
            mock_settings.DEBUG = False

            await manager.initialize()

            # Create test table
            async with manager.get_session() as session:
                await session.execute(
                    text("""
                    CREATE TABLE transaction_test (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        value TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """)
                )
                await session.commit()

            yield manager
            await manager.close()

    async def test_simple_transaction(self, transaction_db_manager):
        """Test basic transaction functionality."""
        manager = transaction_db_manager

        async def insert_value(value: str):
            async with manager.get_session() as session:
                await session.execute(
                    text("INSERT INTO transaction_test (value) VALUES (:val)"),
                    {"val": value},
                )
                return value

        # Execute single operation transaction
        result = await manager.execute_in_transaction([insert_value], ["test_value"])
        assert result == ["test_value"]

        # Verify data was committed
        async with manager.get_session() as session:
            result = await session.execute(
                text("SELECT COUNT(*) FROM transaction_test")
            )
            count = result.scalar()
            assert count == 1

    async def test_multi_operation_transaction(self, transaction_db_manager):
        """Test transaction with multiple operations."""
        manager = transaction_db_manager

        async def insert_value(value: str):
            async with manager.get_session() as session:
                await session.execute(
                    text("INSERT INTO transaction_test (value) VALUES (:val)"),
                    {"val": value},
                )
                return f"inserted_{value}"

        async def count_records():
            async with manager.get_session() as session:
                result = await session.execute(
                    text("SELECT COUNT(*) FROM transaction_test")
                )
                return result.scalar()

        # Execute multiple operations
        operations = [
            lambda session: insert_value("test1"),
            lambda session: insert_value("test2"),
            lambda session: count_records(),
        ]

        results = await manager.execute_in_transaction(operations)
        assert results[0] == "inserted_test1"
        assert results[1] == "inserted_test2"
        assert results[2] == 2  # Two records inserted

    async def test_transaction_rollback_on_error(self, transaction_db_manager):
        """Test transaction rollback when an error occurs."""
        manager = transaction_db_manager

        async def insert_valid_record():
            async with manager.get_session() as session:
                await session.execute(
                    text("INSERT INTO transaction_test (value) VALUES (:val)"),
                    {"val": "valid_record"},
                )
                return "valid_inserted"

        async def insert_invalid_record():
            async with manager.get_session() as session:
                await session.execute(
                    text("INSERT INTO transaction_test (value) VALUES (:val)"),
                    {"val": "invalid_record"},
                )
                # Simulate an error
                raise ValueError("Simulated error")

        # Execute transaction with error
        with pytest.raises(Exception):
            await manager.execute_in_transaction(
                [insert_valid_record, insert_invalid_record]
            )

        # Verify rollback worked - no records should be inserted
        async with manager.get_session() as session:
            result = await session.execute(
                text("SELECT COUNT(*) FROM transaction_test")
            )
            count = result.scalar()
            assert count == 0

    async def test_nested_transaction_simulation(self, transaction_db_manager):
        """Test nested transaction-like behavior."""
        manager = transaction_db_manager

        async def parent_operation():
            async with manager.get_session() as session:
                await session.execute(
                    text("INSERT INTO transaction_test (value) VALUES (:val)"),
                    {"val": "parent"},
                )
                return "parent_completed"

        async def child_operation():
            async with manager.get_session() as session:
                await session.execute(
                    text("INSERT INTO transaction_test (value) VALUES (:val)"),
                    {"val": "child"},
                )
                return "child_completed"

        # Execute as if nested (actually sequential in same transaction)
        results = await manager.execute_in_transaction(
            [parent_operation, child_operation]
        )

        assert results == ["parent_completed", "child_completed"]

        # Verify both records were committed
        async with manager.get_session() as session:
            result = await session.execute(
                text("SELECT COUNT(*) FROM transaction_test")
            )
            count = result.scalar()
            assert count == 2

    async def test_transaction_performance(self, transaction_db_manager):
        """Test transaction performance with multiple operations."""
        manager = transaction_db_manager

        async def bulk_insert(start_id: int, count: int):
            async with manager.get_session() as session:
                for i in range(count):
                    await session.execute(
                        text("INSERT INTO transaction_test (value) VALUES (:val)"),
                        {"val": f"bulk_{start_id + i}"},
                    )
                return count

        # Measure performance
        start_time = time.time()

        results = await manager.execute_in_transaction(
            [lambda session: bulk_insert(0, 100), lambda session: bulk_insert(100, 100)]
        )

        end_time = time.time()

        # Verify results
        assert results[0] == 100
        assert results[1] == 100

        # Should complete in reasonable time
        assert end_time - start_time < 2.0

        # Verify all records were inserted
        async with manager.get_session() as session:
            result = await session.execute(
                text("SELECT COUNT(*) FROM transaction_test")
            )
            count = result.scalar()
            assert count == 200

    async def test_transaction_isolation(self, transaction_db_manager):
        """Test that transactions are properly isolated."""
        manager = transaction_db_manager

        # Start a transaction in one task
        async def transaction_task():
            async with manager.get_session() as session:
                # Insert a record
                await session.execute(
                    text("INSERT INTO transaction_test (value) VALUES (:val)"),
                    {"val": "isolation_test"},
                )

                # Check count before commit
                result = await session.execute(
                    text("SELECT COUNT(*) FROM transaction_test")
                )
                count_in_transaction = result.scalar()

                # Wait a bit
                await asyncio.sleep(0.1)

                # Check count again (should be same in same transaction)
                result = await session.execute(
                    text("SELECT COUNT(*) FROM transaction_test")
                )
                count_after_wait = result.scalar()

                return count_in_transaction, count_after_wait

        # Start another task that checks count from outside
        async def external_check_task():
            await asyncio.sleep(0.05)  # Wait a bit
            async with manager.get_session() as session:
                result = await session.execute(
                    text("SELECT COUNT(*) FROM transaction_test")
                )
                return result.scalar()

        # Run both tasks
        transaction_result, external_count = await asyncio.gather(
            transaction_task(), external_check_task(), return_exceptions=True
        )

        # Transaction should see consistent view
        if isinstance(transaction_result, tuple):
            count_in_tx, count_after_wait = transaction_result
            assert count_in_tx == count_after_wait

        # External count should be independent
        assert isinstance(external_count, int)


@pytest.mark.asyncio
@pytest.mark.integration
class TestDatabaseHealthMonitoring:
    """Test database health monitoring and management."""

    @pytest.fixture
    async def health_db_manager(self):
        """Create database manager for health testing."""
        manager = DatabaseManager()

        with patch("udp.infrastructure.database_manager.settings") as mock_settings:
            mock_settings.DATABASE_URL = "sqlite+aiosqlite:///:memory:"
            mock_settings.DEBUG = False

            await manager.initialize()
            yield manager
            await manager.close()

    async def test_health_check_basic(self, health_db_manager):
        """Test basic health check functionality."""
        manager = health_db_manager

        health = await manager.check_database_health()

        assert health["healthy"] is True
        assert "timestamp" in health
        assert "response_time_ms" in health
        assert "connection_pool" in health
        assert "database_info" in health
        assert health["error"] is None

    async def test_health_check_caching(self, health_db_manager):
        """Test health check result caching."""
        manager = health_db_manager

        # First health check
        health1 = await manager.check_database_health()
        timestamp1 = health1["timestamp"]

        # Immediate second check (should use cache)
        health2 = await manager.check_database_health()
        timestamp2 = health2["timestamp"]

        # Should be the same cached result
        assert timestamp1 == timestamp2

    async def test_health_check_after_cache_expiry(self, health_db_manager):
        """Test health check after cache expiry."""
        manager = health_db_manager

        # Shorten cache interval for testing
        original_interval = manager._health_check_interval
        manager._health_check_interval = 0.1  # 100ms

        try:
            # First health check
            health1 = await manager.check_database_health()
            timestamp1 = health1["timestamp"]

            # Wait for cache to expire
            await asyncio.sleep(0.15)

            # Second health check (should be fresh)
            health2 = await manager.check_database_health()
            timestamp2 = health2["timestamp"]

            # Should be a new result
            assert timestamp2 > timestamp1

        finally:
            # Restore original interval
            manager._health_check_interval = original_interval

    async def test_connection_pool_health_stats(self, health_db_manager):
        """Test connection pool statistics in health check."""
        manager = health_db_manager

        health = await manager.check_database_health()

        assert "connection_pool" in health
        pool_stats = health["connection_pool"]

        # Check required pool stats fields
        required_fields = [
            "pool_size",
            "checked_in",
            "checked_out",
            "overflow",
            "invalid",
        ]
        for field in required_fields:
            assert field in pool_stats
            assert isinstance(pool_stats[field], int)
            assert pool_stats[field] >= 0

    async def test_database_info_collection(self, health_db_manager):
        """Test database information collection."""
        manager = health_db_manager

        health = await manager.check_database_health()

        assert "database_info" in health
        db_info = health["database_info"]

        # Should include database type
        assert "database_type" in db_info
        assert db_info["database_type"] in ["sqlite", "postgresql", "unknown"]


if __name__ == "__main__":
    # Run integration tests
    pytest.main([__file__, "-v", "-m", "integration"])
