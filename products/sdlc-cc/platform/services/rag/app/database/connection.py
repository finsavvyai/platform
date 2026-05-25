"""
Database connection management for the RAG service.
"""

import asyncio
import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator, Optional

from sqlalchemy import event
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import NullPool

from app.core.config import get_settings
from app.models.base import Base

logger = logging.getLogger(__name__)


class DatabaseManager:
    """Manages database connections and provides health monitoring."""

    def __init__(self):
        self._engine: Optional[AsyncEngine] = None
        self._session_factory: Optional[async_sessionmaker] = None
        self._connection_pool_stats = {
            "total_connections": 0,
            "active_connections": 0,
            "idle_connections": 0,
            "failed_connections": 0,
        }
        self._health_check_task: Optional[asyncio.Task] = None
        self._is_healthy = True
        self._last_health_check = None
        self._settings = get_settings()

    @property
    def engine(self) -> AsyncEngine:
        """Get or create the database engine."""
        if self._engine is None:
            self._engine = self._create_engine()
        return self._engine

    @property
    def session_factory(self) -> async_sessionmaker:
        """Get or create the session factory."""
        if self._session_factory is None:
            self._session_factory = async_sessionmaker(
                bind=self.engine,
                class_=AsyncSession,
                expire_on_commit=False,
                autoflush=True,
                autocommit=False,
            )
        return self._session_factory

    def _create_engine(self) -> AsyncEngine:
        """Create the database engine with proper configuration."""
        settings = self._settings

        # Configure engine based on environment
        engine_kwargs = {
            "echo": settings.db_echo,
            "future": True,
            "pool_pre_ping": True,
            "pool_recycle": 3600,  # Recycle connections after 1 hour
        }

        if settings.is_test:
            # Use NullPool for testing to avoid connection issues
            engine_kwargs["poolclass"] = NullPool
        else:
            # Configure connection pooling for production
            engine_kwargs.update(
                {
                    "pool_size": settings.db_pool_size,
                    "max_overflow": settings.db_max_overflow,
                    "pool_timeout": 30,
                    "pool_reset_on_return": "commit",
                }
            )

        # Create engine
        engine = create_async_engine(settings.database_url, **engine_kwargs)

        # Register event listeners for monitoring
        self._register_event_listeners(engine)

        logger.info(
            f"Database engine created with pool_size={settings.db_pool_size}, max_overflow={settings.db_max_overflow}"
        )
        return engine

    def _register_event_listeners(self, engine: AsyncEngine):
        """Register SQLAlchemy event listeners for monitoring."""

        @event.listens_for(engine.sync_engine, "connect")
        def receive_connect(dbapi_connection, connection_record):
            """Called when a connection is established."""
            self._connection_pool_stats["total_connections"] += 1
            logger.debug("Database connection established")

        @event.listens_for(engine.sync_engine, "checkout")
        def receive_checkout(dbapi_connection, connection_record, connection_proxy):
            """Called when a connection is checked out from the pool."""
            self._connection_pool_stats["active_connections"] += 1
            self._connection_pool_stats["idle_connections"] = max(
                0, self._connection_pool_stats["idle_connections"] - 1
            )

        @event.listens_for(engine.sync_engine, "checkin")
        def receive_checkin(dbapi_connection, connection_record):
            """Called when a connection is returned to the pool."""
            self._connection_pool_stats["active_connections"] = max(
                0, self._connection_pool_stats["active_connections"] - 1
            )
            self._connection_pool_stats["idle_connections"] += 1

        @event.listens_for(engine.sync_engine, "invalidate")
        def receive_invalidate(dbapi_connection, connection_record, exception):
            """Called when a connection is invalidated."""
            self._connection_pool_stats["failed_connections"] += 1
            logger.warning(f"Database connection invalidated: {exception}")

    @asynccontextmanager
    async def get_session(self) -> AsyncGenerator[AsyncSession, None]:
        """Get a database session with proper error handling."""
        session = self.session_factory()
        try:
            yield session
        except Exception as e:
            await session.rollback()
            logger.error(f"Database session error: {e}")
            raise
        finally:
            await session.close()

    async def create_all_tables(self):
        """Create all database tables."""
        async with self.engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("All database tables created")

    async def drop_all_tables(self):
        """Drop all database tables."""
        async with self.engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
        logger.info("All database tables dropped")

    async def health_check(self) -> dict:
        """Perform a comprehensive health check."""
        health_status = {
            "status": "unhealthy",
            "timestamp": None,
            "connection_pool": {},
            "database": {},
            "errors": [],
        }

        try:
            import datetime

            health_status["timestamp"] = datetime.datetime.utcnow().isoformat()

            # Test basic connectivity
            async with self.get_session() as session:
                result = await session.execute("SELECT 1 as health_check")
                row = result.first()

                if row and row[0] == 1:
                    health_status["database"]["connectivity"] = "healthy"
                else:
                    health_status["database"]["connectivity"] = "unhealthy"
                    health_status["errors"].append("Basic connectivity test failed")

            # Check connection pool stats
            pool = self.engine.pool
            if pool:
                health_status["connection_pool"] = {
                    "size": pool.size(),
                    "checked_in": pool.checkedin(),
                    "checked_out": pool.checkedout(),
                    "overflow": pool.overflow(),
                    "invalid": pool.invalid(),
                }

            # Check database version and stats
            async with self.get_session() as session:
                # Get database version
                version_result = await session.execute("SELECT version()")
                version_row = version_result.first()
                if version_row:
                    health_status["database"]["version"] = version_row[0]

                # Get connection stats
                stats_result = await session.execute("""
                    SELECT
                        count(*) as total_connections,
                        count(*) FILTER (WHERE state = 'active') as active_connections
                    FROM pg_stat_activity
                    WHERE datname = current_database()
                """)
                stats_row = stats_result.first()
                if stats_row:
                    health_status["database"]["connections"] = {
                        "total": stats_row[0],
                        "active": stats_row[1],
                    }

                # Check table existence
                tables_result = await session.execute("""
                    SELECT table_name
                    FROM information_schema.tables
                    WHERE table_schema = 'public'
                    AND table_name IN ('tenants', 'users', 'documents', 'document_chunks')
                """)
                tables = [row[0] for row in tables_result]
                health_status["database"]["tables"] = {
                    "required": ["tenants", "users", "documents", "document_chunks"],
                    "existing": tables,
                    "missing": [
                        t
                        for t in ["tenants", "users", "documents", "document_chunks"]
                        if t not in tables
                    ],
                }

            # Determine overall health
            db_connectivity = health_status["database"].get("connectivity", "unhealthy")
            missing_tables = health_status["database"]["tables"].get("missing", [])

            if db_connectivity == "healthy" and not missing_tables:
                health_status["status"] = "healthy"
            elif db_connectivity == "healthy":
                health_status["status"] = "degraded"
                health_status["errors"].append(f"Missing tables: {missing_tables}")

            self._is_healthy = health_status["status"] == "healthy"
            self._last_health_check = health_status["timestamp"]

        except Exception as e:
            health_status["status"] = "unhealthy"
            health_status["errors"].append(f"Health check failed: {str(e)}")
            self._is_healthy = False
            logger.error(f"Database health check failed: {e}")

        return health_status

    async def get_connection_pool_stats(self) -> dict:
        """Get detailed connection pool statistics."""
        pool = self.engine.pool
        if not pool:
            return {"error": "Connection pool not initialized"}

        return {
            "size": pool.size(),
            "checked_in": pool.checkedin(),
            "checked_out": pool.checkedout(),
            "overflow": pool.overflow(),
            "invalid": pool.invalid(),
            "internal_stats": self._connection_pool_stats,
        }

    async def close(self):
        """Close the database engine and cleanup resources."""
        if self._health_check_task:
            self._health_check_task.cancel()
            try:
                await self._health_check_task
            except asyncio.CancelledError:
                pass

        if self._engine:
            await self._engine.dispose()
            self._engine = None
            logger.info("Database engine closed")

        self._session_factory = None

    async def __aenter__(self):
        """Async context manager entry."""
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        await self.close()


class DatabaseHealthMonitor:
    """Monitors database health and provides alerts."""

    def __init__(self, db_manager: DatabaseManager):
        self.db_manager = db_manager
        self._monitoring_task: Optional[asyncio.Task] = None
        self._health_callbacks = []
        self._is_monitoring = False

    def add_health_callback(self, callback):
        """Add a callback to be called when health status changes."""
        self._health_callbacks.append(callback)

    async def start_monitoring(self, interval: int = 60):
        """Start continuous health monitoring."""
        if self._is_monitoring:
            return

        self._is_monitoring = True
        self._monitoring_task = asyncio.create_task(self._monitor_loop(interval))
        logger.info(f"Database health monitoring started with {interval}s interval")

    async def stop_monitoring(self):
        """Stop health monitoring."""
        if not self._is_monitoring:
            return

        self._is_monitoring = False
        if self._monitoring_task:
            self._monitoring_task.cancel()
            try:
                await self._monitoring_task
            except asyncio.CancelledError:
                pass

        logger.info("Database health monitoring stopped")

    async def _monitor_loop(self, interval: int):
        """Main monitoring loop."""
        last_healthy_status = True

        while self._is_monitoring:
            try:
                health_status = await self.db_manager.health_check()
                current_healthy = health_status["status"] == "healthy"

                # Trigger callbacks if health status changed
                if current_healthy != last_healthy_status:
                    await self._notify_health_change(health_status)
                    last_healthy_status = current_healthy

                # Log health status changes
                if not current_healthy:
                    logger.warning(f"Database health degraded: {health_status}")

                await asyncio.sleep(interval)

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Health monitoring error: {e}")
                await asyncio.sleep(min(interval, 30))  # Wait at least 30s on error

    async def _notify_health_change(self, health_status: dict):
        """Notify all registered callbacks about health changes."""
        for callback in self._health_callbacks:
            try:
                if asyncio.iscoroutinefunction(callback):
                    await callback(health_status)
                else:
                    callback(health_status)
            except Exception as e:
                logger.error(f"Health callback error: {e}")


# Global database manager instance
db_manager = DatabaseManager()


# Health monitor instance
health_monitor = DatabaseHealthMonitor(db_manager)


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency for getting a database session."""
    async with db_manager.get_session() as session:
        yield session


# Database utilities
async def execute_raw_query(
    session: AsyncSession,
    query: str,
    params: Optional[dict] = None,
) -> list:
    """Execute a raw SQL query and return results."""
    try:
        result = await session.execute(query, params or {})
        return result.fetchall()
    except Exception as e:
        logger.error(f"Raw query execution failed: {e}")
        raise


async def execute_raw_statement(
    session: AsyncSession,
    statement: str,
    params: Optional[dict] = None,
) -> int:
    """Execute a raw SQL statement and return affected rows."""
    try:
        result = await session.execute(statement, params or {})
        await session.commit()
        return result.rowcount
    except Exception as e:
        await session.rollback()
        logger.error(f"Raw statement execution failed: {e}")
        raise


async def check_database_exists(
    db_url: str,
    db_name: str,
) -> bool:
    """Check if a database exists."""
    try:
        # Extract connection info and connect to postgres database
        import asyncpg

        conn = await asyncpg.connect(db_url.replace("/" + db_name, "/postgres"))

        result = await conn.fetchval(
            "SELECT 1 FROM pg_database WHERE datname = $1", db_name
        )

        await conn.close()
        return result is not None
    except Exception as e:
        logger.error(f"Database existence check failed: {e}")
        return False


async def create_database_if_not_exists(
    db_url: str,
    db_name: str,
) -> bool:
    """Create database if it doesn't exist."""
    if await check_database_exists(db_url, db_name):
        return True

    try:
        import asyncpg

        conn = await asyncpg.connect(db_url.replace("/" + db_name, "/postgres"))

        await conn.execute(f'CREATE DATABASE "{db_name}"')
        await conn.close()

        logger.info(f"Database '{db_name}' created successfully")
        return True
    except Exception as e:
        logger.error(f"Database creation failed: {e}")
        return False


# Transaction management
@asynccontextmanager
async def transaction_scope(
    session: AsyncSession,
    rollback_on_error: bool = True,
) -> AsyncGenerator[AsyncSession, None]:
    """Context manager for database transactions."""
    try:
        async with session.begin():
            yield session
    except Exception as e:
        if rollback_on_error:
            await session.rollback()
        logger.error(f"Transaction failed: {e}")
        raise


# Retry mechanism for database operations
async def with_retry(
    operation,
    max_retries: int = 3,
    base_delay: float = 1.0,
    max_delay: float = 30.0,
    backoff_factor: float = 2.0,
):
    """Execute an operation with exponential backoff retry."""
    import random

    last_exception = None

    for attempt in range(max_retries + 1):
        try:
            return await operation()
        except Exception as e:
            last_exception = e

            if attempt == max_retries:
                logger.error(f"Operation failed after {max_retries} retries: {e}")
                break

            # Calculate delay with jitter
            delay = min(base_delay * (backoff_factor**attempt), max_delay)
            jitter = random.uniform(0, delay * 0.1)  # 10% jitter
            total_delay = delay + jitter

            logger.warning(
                f"Operation failed (attempt {attempt + 1}/{max_retries + 1}), retrying in {total_delay:.2f}s: {e}"
            )
            await asyncio.sleep(total_delay)

    raise last_exception
