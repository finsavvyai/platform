"""
Database Manager for Universal Dependency Platform.

Enterprise-grade database connection and transaction management
with connection pooling, health monitoring, and comprehensive error handling.
"""

import asyncio
import logging
import time
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from typing import Optional, Union

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker
from sqlalchemy.pool import QueuePool, StaticPool
from udp.core.config import settings
from udp.core.models.base import Base
from udp.core.services import DatabaseError as UPMDatabaseError

logger = logging.getLogger(__name__)


class DatabaseManager:
    """
    Enterprise-grade database connection and transaction manager.

    Provides connection pooling, transaction management, health monitoring,
    and comprehensive error handling for database operations.
    """

    def __init__(self):
        self._engine: Optional[AsyncEngine] = None
        self._session_factory: Optional[async_sessionmaker] = None
        self._connection_pool_stats: dict[str, Union[int, float]] = {}
        self._health_status: dict[str, Union[bool, str, float]] = {}
        self._last_health_check: Optional[float] = None
        self._health_check_interval: float = 30.0  # seconds
        self._initialized: bool = False
        self._lock = asyncio.Lock()

    async def initialize(self) -> None:
        """
        Initialize database connections and session factory.

        Creates database engine with appropriate connection pooling
        configuration and initializes session factory.
        """
        async with self._lock:
            if self._initialized:
                return

            try:
                logger.info("Initializing database connection manager")

                # Create database engine with connection pooling
                self._engine = self._create_engine()
                self._session_factory = self._create_session_factory()

                # Create tables if they don't exist
                await self._create_tables()

                # Initialize health monitoring
                self._initialize_health_monitoring()

                self._initialized = True
                logger.info("Database connection manager initialized successfully")

            except Exception as e:
                logger.error(f"Failed to initialize database manager: {str(e)}")
                raise UPMDatabaseError(
                    f"Database initialization failed: {str(e)}",
                    error_code="DB_INIT_FAILED",
                )

    def _create_engine(self) -> AsyncEngine:
        """
        Create database engine with appropriate configuration.

        Returns:
            Configured SQLAlchemy async engine
        """
        engine_kwargs = {
            "echo": settings.DEBUG,
            "future": True,
        }

        # Database-specific configuration
        if settings.DATABASE_URL.startswith("sqlite"):
            # SQLite configuration
            engine_kwargs.update(
                {
                    "poolclass": StaticPool,
                    "connect_args": {
                        "check_same_thread": False,
                        "timeout": 20,
                    },
                    "pool_pre_ping": False,  # SQLite doesn't support pre-ping
                }
            )
        else:
            # PostgreSQL and other databases
            engine_kwargs.update(
                {
                    "poolclass": QueuePool,
                    "pool_size": getattr(settings, "DATABASE_POOL_SIZE", 10),
                    "max_overflow": getattr(settings, "DATABASE_MAX_OVERFLOW", 20),
                    "pool_timeout": getattr(settings, "DATABASE_POOL_TIMEOUT", 30),
                    "pool_recycle": getattr(settings, "DATABASE_POOL_RECYCLE", 3600),
                    "pool_pre_ping": True,
                    "connect_args": {
                        "server_settings": {
                            "application_name": "upm_platform",
                            "jit": "off",  # Disable JIT for faster startup
                        }
                    },
                }
            )

        return create_async_engine(settings.DATABASE_URL, **engine_kwargs)

    def _create_session_factory(self) -> async_sessionmaker:
        """
        Create session factory with appropriate configuration.

        Returns:
            Configured async session maker
        """
        return async_sessionmaker(
            bind=self._engine,
            class_=AsyncSession,
            expire_on_commit=False,
            autoflush=True,
            autocommit=False,
        )

    async def _create_tables(self) -> None:
        """Create database tables if they don't exist."""
        if not self._engine:
            raise UPMDatabaseError("Database engine not initialized")

        try:
            async with self._engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
            logger.info("Database tables created/verified successfully")
        except Exception as e:
            logger.error(f"Failed to create database tables: {str(e)}")
            raise UPMDatabaseError(
                f"Table creation failed: {str(e)}", error_code="TABLE_CREATION_FAILED"
            )

    def _initialize_health_monitoring(self) -> None:
        """Initialize health monitoring for database connections."""
        self._health_status = {
            "healthy": True,
            "last_check": time.time(),
            "error_count": 0,
            "last_error": None,
        }

    @asynccontextmanager
    async def get_session(self) -> AsyncGenerator[AsyncSession, None]:
        """
        Get database session with proper error handling.

        Yields:
            AsyncSession: Database session with automatic cleanup

        Raises:
            UPMDatabaseError: If database is not initialized or session creation fails
        """
        if not self._initialized or not self._session_factory:
            raise UPMDatabaseError(
                "Database manager not initialized", error_code="DB_NOT_INITIALIZED"
            )

        session = self._session_factory()
        try:
            yield session
        except Exception as e:
            await session.rollback()
            logger.error(f"Database session error: {str(e)}")
            raise
        finally:
            await session.close()

    async def execute_in_transaction(
        self, operations: list[callable], rollback_on_error: bool = True
    ) -> list[any]:
        """
        Execute multiple operations within a single transaction.

        Args:
            operations: List of callable operations that accept a session
            rollback_on_error: Whether to rollback on any error

        Returns:
            List of operation results

        Raises:
            UPMDatabaseError: If transaction fails
        """
        if not operations:
            return []

        async with self.get_session() as session:
            try:
                results = []
                for operation in operations:
                    result = await operation(session)
                    results.append(result)
                await session.commit()
                return results
            except Exception as e:
                if rollback_on_error:
                    await session.rollback()
                    logger.error(f"Transaction failed and rolled back: {str(e)}")
                else:
                    logger.error(f"Transaction failed (no rollback): {str(e)}")
                raise UPMDatabaseError(
                    f"Transaction execution failed: {str(e)}",
                    error_code="TRANSACTION_FAILED",
                    details={"operations_count": len(operations)},
                )

    async def warm_connection_pool(self, count: int = 5) -> dict[str, any]:
        """
        Warm up connection pool by creating test connections.

        Args:
            count: Number of connections to create

        Returns:
            Dictionary with warmup results
        """
        if not self._engine:
            raise UPMDatabaseError("Database engine not initialized")

        warmup_results = {
            "requested_connections": count,
            "successful_connections": 0,
            "failed_connections": 0,
            "total_time_ms": 0,
            "errors": [],
        }

        start_time = time.time()

        try:
            # Create multiple connections to warm up the pool
            tasks = []
            for i in range(count):
                tasks.append(self._create_test_connection(i))

            results = await asyncio.gather(*tasks, return_exceptions=True)

            for i, result in enumerate(results):
                if isinstance(result, Exception):
                    warmup_results["failed_connections"] += 1
                    warmup_results["errors"].append(f"Connection {i}: {str(result)}")
                    logger.warning(
                        f"Connection warmup failed for connection {i}: {str(result)}"
                    )
                else:
                    warmup_results["successful_connections"] += 1

        except Exception as e:
            logger.error(f"Connection pool warmup failed: {str(e)}")
            warmup_results["errors"].append(f"Warmup failed: {str(e)}")

        warmup_results["total_time_ms"] = round((time.time() - start_time) * 1000, 2)

        logger.info(
            f"Connection pool warmup completed: "
            f"{warmup_results['successful_connections']}/{count} successful"
        )

        return warmup_results

    async def _create_test_connection(self, connection_id: int) -> None:
        """Create a test connection for warmup."""
        async with self.get_session() as session:
            await session.execute(text("SELECT 1"))
            logger.debug(f"Test connection {connection_id} created successfully")

    async def get_connection_pool_stats(self) -> dict[str, Union[int, float]]:
        """
        Get connection pool statistics.

        Returns:
            Dictionary with pool statistics
        """
        if not self._engine or not self._engine.pool:
            return {
                "pool_size": 0,
                "checked_in": 0,
                "checked_out": 0,
                "overflow": 0,
                "invalid": 0,
            }

        pool = self._engine.pool
        return {
            "pool_size": pool.size(),
            "checked_in": pool.checkedin(),
            "checked_out": pool.checkedout(),
            "overflow": pool.overflow(),
            "invalid": pool.invalid(),
        }

    async def check_database_health(self) -> dict[str, Union[bool, str, float, dict]]:
        """
        Check database connectivity and performance.

        Returns:
            Dictionary with health status and metrics
        """
        current_time = time.time()

        # Use cached result if within check interval
        if (
            self._last_health_check
            and current_time - self._last_health_check < self._health_check_interval
        ):
            return self._health_status

        health_info = {
            "healthy": True,
            "timestamp": current_time,
            "response_time_ms": 0,
            "connection_pool": await self.get_connection_pool_stats(),
            "error": None,
            "database_info": {},
        }

        try:
            start_time = time.time()

            async with self.get_session() as session:
                # Test basic connectivity
                result = await session.execute(text("SELECT 1"))
                await result.fetchone()

                # Get database info
                if settings.DATABASE_URL.startswith("postgresql"):
                    db_info = await self._get_postgresql_info(session)
                elif settings.DATABASE_URL.startswith("sqlite"):
                    db_info = await self._get_sqlite_info(session)
                else:
                    db_info = {"database_type": "unknown"}

                health_info["database_info"] = db_info

            health_info["response_time_ms"] = round(
                (time.time() - start_time) * 1000, 2
            )

            # Update health status
            self._health_status.update(health_info)
            self._last_health_check = current_time

            logger.debug("Database health check completed successfully")

        except Exception as e:
            health_info["healthy"] = False
            health_info["error"] = str(e)

            # Update error tracking
            self._health_status["healthy"] = False
            self._health_status["error_count"] += 1
            self._health_status["last_error"] = str(e)
            self._health_status["last_check"] = current_time

            logger.error(f"Database health check failed: {str(e)}")

        return health_info

    async def _get_postgresql_info(self, session: AsyncSession) -> dict[str, str]:
        """Get PostgreSQL-specific database information."""
        try:
            # Get version
            version_result = await session.execute(text("SELECT version()"))
            version = version_result.scalar()

            # Get connection info
            conn_result = await session.execute(
                text("SELECT count(*) FROM pg_stat_activity WHERE state = 'active'")
            )
            active_connections = conn_result.scalar()

            # Get database size
            size_result = await session.execute(
                text("SELECT pg_size_pretty(pg_database_size(current_database()))")
            )
            db_size = size_result.scalar()

            return {
                "database_type": "postgresql",
                "version": version,
                "active_connections": active_connections,
                "database_size": db_size,
            }

        except Exception as e:
            logger.warning(f"Failed to get PostgreSQL info: {str(e)}")
            return {"database_type": "postgresql", "error": str(e)}

    async def _get_sqlite_info(self, session: AsyncSession) -> dict[str, str]:
        """Get SQLite-specific database information."""
        try:
            # Get SQLite version
            version_result = await session.execute(text("SELECT sqlite_version()"))
            version = version_result.scalar()

            # Get page count and page size
            page_count_result = await session.execute(text("PRAGMA page_count"))
            page_count = page_count_result.scalar()

            page_size_result = await session.execute(text("PRAGMA page_size"))
            page_size = page_size_result.scalar()

            db_size_bytes = page_count * page_size
            db_size_mb = round(db_size_bytes / (1024 * 1024), 2)

            return {
                "database_type": "sqlite",
                "version": f"SQLite {version}",
                "page_count": page_count,
                "page_size": page_size,
                "database_size_mb": db_size_mb,
            }

        except Exception as e:
            logger.warning(f"Failed to get SQLite info: {str(e)}")
            return {"database_type": "sqlite", "error": str(e)}

    async def close(self) -> None:
        """Close database connections and cleanup resources."""
        async with self._lock:
            if not self._initialized:
                return

            try:
                logger.info("Closing database connections")

                if self._engine:
                    await self._engine.dispose()
                    self._engine = None

                self._session_factory = None
                self._initialized = False

                logger.info("Database connections closed successfully")

            except Exception as e:
                logger.error(f"Error closing database connections: {str(e)}")
                raise UPMDatabaseError(
                    f"Database cleanup failed: {str(e)}", error_code="DB_CLEANUP_FAILED"
                )

    @property
    def is_initialized(self) -> bool:
        """Check if database manager is initialized."""
        return self._initialized

    @property
    def engine(self) -> Optional[AsyncEngine]:
        """Get the database engine (for advanced usage)."""
        return self._engine


# Global database manager instance
db_manager = DatabaseManager()


# Convenience functions for backward compatibility
async def get_async_session() -> AsyncGenerator[AsyncSession, None]:
    """Get async database session using database manager."""
    async with db_manager.get_session() as session:
        yield session


async def check_database_health() -> dict[str, Union[bool, str, float, dict]]:
    """Check database health using database manager."""
    return await db_manager.check_database_health()


async def init_database() -> None:
    """Initialize database using database manager."""
    await db_manager.initialize()


async def close_database() -> None:
    """Close database connections using database manager."""
    await db_manager.close()
