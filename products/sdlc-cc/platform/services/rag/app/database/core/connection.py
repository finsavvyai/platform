"""
Database configuration and connection management for the RAG service.

This module provides async database connection management with connection pooling,
retry logic, health monitoring, and support for both PostgreSQL (main) and
Cloudflare D1 (edge) databases.
"""

import asyncio
import logging
import os
from contextlib import asynccontextmanager
from typing import Any, AsyncGenerator, Dict, Optional

import asyncpg
import aioredis
from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
    AsyncEngine,
    AsyncConnection,
)
import backoff

from ..models import Base
from .health import HealthChecker, HealthStatus

logger = logging.getLogger(__name__)


class DatabaseConfig:
    """Database configuration."""

    def __init__(
        self,
        database_url: str,
        pool_size: int = 10,
        max_overflow: int = 20,
        pool_timeout: int = 30,
        pool_recycle: int = 3600,
        pool_pre_ping: bool = True,
        echo: bool = False,
        echo_pool: bool = False,
        future: bool = True,
        connect_args: Optional[Dict[str, Any]] = None,
        redis_url: Optional[str] = None,
        redis_max_connections: int = 10,
        d1_database: Optional[str] = None,
        d1_account_id: Optional[str] = None,
        d1_api_token: Optional[str] = None,
        retry_attempts: int = 3,
        retry_delay: float = 1.0,
        retry_max_delay: float = 60.0,
        retry_jitter: float = 0.1,
        health_check_interval: float = 30.0,
        health_check_timeout: float = 5.0,
        isolation_level: str = "READ_COMMITTED",
    ):
        self.database_url = database_url
        self.pool_size = pool_size
        self.max_overflow = max_overflow
        self.pool_timeout = pool_timeout
        self.pool_recycle = pool_recycle
        self.pool_pre_ping = pool_pre_ping
        self.echo = echo
        self.echo_pool = echo_pool
        self.future = future
        self.connect_args = connect_args or {}
        self.redis_url = redis_url
        self.redis_max_connections = redis_max_connections
        self.d1_database = d1_database
        self.d1_account_id = d1_account_id
        self.d1_api_token = d1_api_token
        self.retry_attempts = retry_attempts
        self.retry_delay = retry_delay
        self.retry_max_delay = retry_max_delay
        self.retry_jitter = retry_jitter
        self.health_check_interval = health_check_interval
        self.health_check_timeout = health_check_timeout
        self.isolation_level = isolation_level

    @classmethod
    def from_env(cls) -> "DatabaseConfig":
        """Create configuration from environment variables."""
        return cls(
            database_url=os.getenv(
                "DATABASE_URL", "postgresql+asyncpg://user:pass@localhost/sdlc"
            ),
            pool_size=int(os.getenv("DB_POOL_SIZE", "10")),
            max_overflow=int(os.getenv("DB_MAX_OVERFLOW", "20")),
            pool_timeout=int(os.getenv("DB_POOL_TIMEOUT", "30")),
            pool_recycle=int(os.getenv("DB_POOL_RECYCLE", "3600")),
            pool_pre_ping=os.getenv("DB_POOL_PRE_PING", "true").lower() == "true",
            echo=os.getenv("DB_ECHO", "false").lower() == "true",
            echo_pool=os.getenv("DB_ECHO_POOL", "false").lower() == "true",
            redis_url=os.getenv("REDIS_URL"),
            redis_max_connections=int(os.getenv("REDIS_MAX_CONNECTIONS", "10")),
            d1_database=os.getenv("D1_DATABASE"),
            d1_account_id=os.getenv("D1_ACCOUNT_ID"),
            d1_api_token=os.getenv("D1_API_TOKEN"),
            retry_attempts=int(os.getenv("DB_RETRY_ATTEMPTS", "3")),
            retry_delay=float(os.getenv("DB_RETRY_DELAY", "1.0")),
            retry_max_delay=float(os.getenv("DB_RETRY_MAX_DELAY", "60.0")),
            retry_jitter=float(os.getenv("DB_RETRY_JITTER", "0.1")),
            health_check_interval=float(os.getenv("DB_HEALTH_CHECK_INTERVAL", "30.0")),
            health_check_timeout=float(os.getenv("DB_HEALTH_CHECK_TIMEOUT", "5.0")),
            isolation_level=os.getenv("DB_ISOLATION_LEVEL", "READ_COMMITTED"),
        )


class DatabaseManager:
    """Async database manager with connection pooling and health monitoring."""

    def __init__(self, config: DatabaseConfig):
        self.config = config
        self._engine: Optional[AsyncEngine] = None
        self._session_factory: Optional[async_sessionmaker[AsyncSession]] = None
        self._redis: Optional[aioredis.Redis] = None
        self._health_checker: Optional[HealthChecker] = None
        self._is_initialized = False
        self._lock = asyncio.Lock()

    async def initialize(self) -> None:
        """Initialize database connections and health monitoring."""
        async with self._lock:
            if self._is_initialized:
                return

            await self._initialize_engine()
            await self._initialize_redis()
            await self._initialize_health_checker()

            # Run migrations
            await self.create_tables()

            self._is_initialized = True
            logger.info("Database manager initialized successfully")

    async def _initialize_engine(self) -> None:
        """Initialize SQLAlchemy async engine."""
        engine_kwargs = {
            "echo": self.config.echo,
            "future": self.config.future,
            "pool_size": self.config.pool_size,
            "max_overflow": self.config.max_overflow,
            "pool_timeout": self.config.pool_timeout,
            "pool_recycle": self.config.pool_recycle,
            "pool_pre_ping": self.config.pool_pre_ping,
            "connect_args": {
                **self.config.connect_args,
                "server_settings": {
                    "application_name": "sdlc-rag-service",
                    "timezone": "UTC",
                },
            },
        }

        self._engine = create_async_engine(self.config.database_url, **engine_kwargs)

        # Create session factory
        self._session_factory = async_sessionmaker(
            bind=self._engine,
            class_=AsyncSession,
            expire_on_commit=False,
            autoflush=True,
            autocommit=False,
        )

        logger.info(f"Database engine initialized: {self.config.database_url}")

    async def _initialize_redis(self) -> None:
        """Initialize Redis connection."""
        if not self.config.redis_url:
            logger.info("Redis not configured, skipping initialization")
            return

        self._redis = aioredis.from_url(
            self.config.redis_url,
            max_connections=self.config.redis_max_connections,
            retry_on_timeout=True,
            socket_timeout=5,
            socket_connect_timeout=5,
            decode_responses=True,
        )

        # Test Redis connection
        try:
            await self._redis.ping()
            logger.info("Redis connection established")
        except Exception as e:
            logger.warning(f"Failed to connect to Redis: {e}")
            self._redis = None

    async def _initialize_health_checker(self) -> None:
        """Initialize health checker."""
        self._health_checker = HealthChecker(
            engine=self._engine,
            redis=self._redis,
            check_interval=self.config.health_check_interval,
            check_timeout=self.config.health_check_timeout,
        )
        await self._health_checker.start()

    @asynccontextmanager
    async def get_session(self) -> AsyncGenerator[AsyncSession, None]:
        """Get a database session with automatic cleanup."""
        if not self._is_initialized:
            await self.initialize()

        if not self._session_factory:
            raise RuntimeError("Database not initialized")

        async with self._session_factory() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise
            finally:
                await session.close()

    @asynccontextmanager
    async def get_connection(self) -> AsyncGenerator[AsyncConnection, None]:
        """Get a raw database connection."""
        if not self._is_initialized:
            await self.initialize()

        if not self._engine:
            raise RuntimeError("Database not initialized")

        async with self._engine.begin() as conn:
            yield conn

    async def execute_raw_sql(
        self, query: str, params: Optional[Dict[str, Any]] = None
    ) -> Any:
        """Execute raw SQL with retry logic."""
        return await self.retry_operation(self._execute_raw_sql_internal, query, params)

    async def _execute_raw_sql_internal(
        self, query: str, params: Optional[Dict[str, Any]] = None
    ) -> Any:
        """Internal raw SQL execution."""
        async with self.get_connection() as conn:
            result = await conn.execute(text(query), params or {})
            return result

    @backoff.on_exception(
        backoff.expo,
        (asyncpg.exceptions.PostgresError, Exception),
        max_tries=3,
        base=1,
        max_value=60,
        jitter=None,
    )
    async def retry_operation(self, func, *args, **kwargs):
        """Execute operation with exponential backoff retry."""
        return await func(*args, **kwargs)

    async def create_tables(self) -> None:
        """Create all database tables."""
        if not self._engine:
            raise RuntimeError("Database not initialized")

        async with self._engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        logger.info("Database tables created successfully")

    async def drop_tables(self) -> None:
        """Drop all database tables (use with caution)."""
        if not self._engine:
            raise RuntimeError("Database not initialized")

        async with self._engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)

        logger.warning("Database tables dropped")

    async def close(self) -> None:
        """Close all database connections."""
        async with self._lock:
            if self._health_checker:
                await self._health_checker.stop()
                self._health_checker = None

            if self._redis:
                await self._redis.close()
                self._redis = None

            if self._engine:
                await self._engine.dispose()
                self._engine = None
                self._session_factory = None

            self._is_initialized = False
            logger.info("Database connections closed")

    async def health_check(self) -> HealthStatus:
        """Perform comprehensive health check."""
        if not self._health_checker:
            return HealthStatus(
                database_healthy=False,
                redis_healthy=False,
                overall_healthy=False,
                error="Health checker not initialized",
                checks={},
            )

        return await self._health_checker.check_health()

    def get_redis(self) -> Optional[aioredis.Redis]:
        """Get Redis client."""
        return self._redis

    def is_healthy(self) -> bool:
        """Check if database is healthy."""
        if not self._health_checker:
            return False
        return self._health_checker.is_healthy()

    def get_engine_info(self) -> Dict[str, Any]:
        """Get engine information."""
        if not self._engine:
            return {"status": "not_initialized"}

        pool = self._engine.pool
        return {
            "status": "initialized",
            "pool_size": self.config.pool_size,
            "current_connections": pool.size() if pool else 0,
            "available_connections": pool.checkedout() if pool else 0,
            "database_url": self.config.database_url.split("@")[-1],  # Hide password
        }


class TenantAwareDatabaseManager:
    """Database manager with tenant-aware session management."""

    def __init__(self, db_manager: DatabaseManager):
        self.db_manager = db_manager

    @asynccontextmanager
    async def get_tenant_session(
        self, tenant_id: str, user_id: Optional[str] = None
    ) -> AsyncGenerator[AsyncSession, None]:
        """Get a tenant-scoped database session."""
        async with self.db_manager.get_session() as session:
            # Set tenant context for row-level security
            await session.execute(
                text("SET app.current_tenant_id = :tenant_id"), {"tenant_id": tenant_id}
            )

            if user_id:
                await session.execute(
                    text("SET app.current_user_id = :user_id"), {"user_id": user_id}
                )

            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    async def execute_tenant_query(
        self, tenant_id: str, query: str, params: Optional[Dict[str, Any]] = None
    ) -> Any:
        """Execute query with tenant context."""
        params = params or {}
        params["tenant_id"] = tenant_id

        async with self.get_tenant_session(tenant_id) as session:
            result = await session.execute(text(query), params)
            return result

    async def check_tenant_access(self, tenant_id: str, user_id: str) -> bool:
        """Check if user has access to tenant."""
        try:
            result = await self.execute_tenant_query(
                tenant_id,
                """
                SELECT 1 FROM users
                WHERE id = :user_id AND tenant_id = :tenant_id AND is_active = true
                """,
                {"user_id": user_id, "tenant_id": tenant_id},
            )
            return result.scalar() is not None
        except Exception:
            return False


class MultiDatabaseManager:
    """Manager for multiple database backends (PostgreSQL + D1)."""

    def __init__(
        self,
        primary_db: DatabaseManager,
        edge_db: Optional[DatabaseManager] = None,
    ):
        self.primary_db = primary_db
        self.edge_db = edge_db

    async def initialize(self) -> None:
        """Initialize all database connections."""
        await self.primary_db.initialize()
        if self.edge_db:
            await self.edge_db.initialize()

    @asynccontextmanager
    async def get_primary_session(self) -> AsyncGenerator[AsyncSession, None]:
        """Get primary database session."""
        async with self.primary_db.get_session() as session:
            yield session

    @asynccontextmanager
    async def get_edge_session(self) -> AsyncGenerator[AsyncSession, None]:
        """Get edge database session."""
        if not self.edge_db:
            raise RuntimeError("Edge database not configured")

        async with self.edge_db.get_session() as session:
            yield session

    def get_session_for_operation(self, operation_type: str) -> DatabaseManager:
        """Get appropriate database manager for operation type."""
        # Edge operations: reads, simple queries, user sessions
        edge_operations = {"read", "session", "cache", "lookup"}

        if operation_type.lower() in edge_operations and self.edge_db:
            return self.edge_db

        # Primary operations: writes, complex queries, analytics
        return self.primary_db

    async def close(self) -> None:
        """Close all database connections."""
        await self.primary_db.close()
        if self.edge_db:
            await self.edge_db.close()

    async def health_check(self) -> Dict[str, HealthStatus]:
        """Perform health check on all databases."""
        results = {"primary": await self.primary_db.health_check()}

        if self.edge_db:
            results["edge"] = await self.edge_db.health_check()

        return results


# Global database manager instance
_db_manager: Optional[DatabaseManager] = None
_multi_db_manager: Optional[MultiDatabaseManager] = None


async def get_database_manager() -> DatabaseManager:
    """Get global database manager instance."""
    global _db_manager
    if _db_manager is None:
        config = DatabaseConfig.from_env()
        _db_manager = DatabaseManager(config)
        await _db_manager.initialize()
    return _db_manager


async def get_multi_database_manager() -> MultiDatabaseManager:
    """Get global multi-database manager instance."""
    global _multi_db_manager
    if _multi_db_manager is None:
        primary_config = DatabaseConfig.from_env()

        # Configure edge database if D1 credentials are available
        edge_config = None
        if (
            primary_config.d1_database
            and primary_config.d1_account_id
            and primary_config.d1_api_token
        ):
            # Create D1 connection URL
            d1_url = f"sqlite+aiosqlite:///file:d1_{primary_config.d1_database}.db"
            edge_config = DatabaseConfig(
                database_url=d1_url,
                pool_size=5,
                max_overflow=5,
                echo=primary_config.echo,
            )

        primary_db = DatabaseManager(primary_config)
        edge_db = DatabaseManager(edge_config) if edge_config else None

        _multi_db_manager = MultiDatabaseManager(primary_db, edge_db)
        await _multi_db_manager.initialize()

    return _multi_db_manager


async def close_database_connections() -> None:
    """Close all database connections."""
    global _db_manager, _multi_db_manager

    if _multi_db_manager:
        await _multi_db_manager.close()
        _multi_db_manager = None

    if _db_manager:
        await _db_manager.close()
        _db_manager = None


# Context manager for database operations
@asynccontextmanager
async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """Get database session for use in dependency injection."""
    db_manager = await get_database_manager()
    async with db_manager.get_session() as session:
        yield session


@asynccontextmanager
async def get_tenant_db_session(
    tenant_id: str, user_id: Optional[str] = None
) -> AsyncGenerator[AsyncSession, None]:
    """Get tenant-scoped database session."""
    db_manager = await get_database_manager()
    tenant_manager = TenantAwareDatabaseManager(db_manager)
    async with tenant_manager.get_tenant_session(tenant_id, user_id) as session:
        yield session
