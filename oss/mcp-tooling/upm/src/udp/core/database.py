"""
Database configuration and session management.

Enterprise-grade database setup with connection pooling,
async support, and comprehensive error handling.
"""

from collections.abc import AsyncGenerator
from typing import Optional

import structlog
from sqlalchemy import MetaData
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.pool import NullPool, QueuePool
from udp.core.config import settings

logger = structlog.get_logger()

# SQLAlchemy metadata with naming convention
metadata = MetaData(
    naming_convention={
        "ix": "ix_%(column_0_label)s",
        "uq": "uq_%(table_name)s_%(column_0_name)s",
        "ck": "ck_%(table_name)s_%(constraint_name)s",
        "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
        "pk": "pk_%(table_name)s",
    }
)

# Declarative base
Base = declarative_base(metadata=metadata)

# Global engine and session maker
engine: Optional[object] = None
SessionLocal: Optional[async_sessionmaker] = None


def create_database_engine():
    """
    Create database engine with appropriate configuration.

    Returns:
        Configured SQLAlchemy async engine
    """
    connect_args = {}
    poolclass = QueuePool

    # SQLite-specific configuration
    if settings.database.url.startswith("sqlite"):
        connect_args["check_same_thread"] = False
        poolclass = NullPool  # SQLite doesn't support connection pooling

    # PostgreSQL-specific configuration
    elif "postgresql" in settings.database.url:
        connect_args["server_settings"] = {
            "application_name": "udp",
            "jit": "off",  # Disable JIT for faster startup
        }

    # Build engine arguments
    engine_args = {
        "echo": settings.database.echo,
        "poolclass": poolclass,
        "connect_args": connect_args,
        "future": True,  # Use SQLAlchemy 2.0 style
    }

    # Only add pooling parameters for non-SQLite databases
    if poolclass != NullPool:
        engine_args.update(
            {
                "pool_size": settings.database.pool_size,
                "max_overflow": settings.database.max_overflow,
                "pool_timeout": settings.database.pool_timeout,
                "pool_recycle": settings.database.pool_recycle,
                "pool_pre_ping": True,  # Verify connections before use
            }
        )

    return create_async_engine(settings.database.url, **engine_args)


async def init_database() -> None:
    """
    Initialize database connection and create tables.

    Sets up the global engine and session factory, and creates
    all tables if they don't exist.
    """
    global engine, SessionLocal

    try:
        logger.info(
            "Initializing database",
            url=settings.database.url.split("@")[-1]
            if "@" in settings.database.url
            else settings.database.url,
        )

        # Create engine
        engine = create_database_engine()

        # Create session factory
        SessionLocal = async_sessionmaker(
            engine,
            class_=AsyncSession,
            expire_on_commit=False,
            autoflush=True,
            autocommit=False,
        )

        # Import all models to ensure they are registered
        import udp.infrastructure.models  # noqa: F401

        # Create tables
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        logger.info("Database initialized successfully")

    except Exception as e:
        logger.error("Failed to initialize database", error=str(e), exc_info=True)
        raise


async def get_async_session() -> AsyncGenerator[AsyncSession, None]:
    """
    Get async database session.

    Dependency function for FastAPI that provides database sessions
    with proper cleanup and error handling.

    Yields:
        AsyncSession: Database session

    Raises:
        RuntimeError: If database is not initialized
    """
    if SessionLocal is None:
        raise RuntimeError("Database not initialized. Call init_database() first.")

    async with SessionLocal() as session:
        try:
            yield session
        except Exception as e:
            logger.error("Database session error", error=str(e), exc_info=True)
            await session.rollback()
            raise
        finally:
            await session.close()


async def close_database() -> None:
    """
    Close database connections.

    Cleanup function to properly close all database connections
    and dispose of the engine.
    """
    global engine

    if engine:
        logger.info("Closing database connections")
        await engine.dispose()
        engine = None
        logger.info("Database connections closed")


# Health check function
async def check_database_health() -> bool:
    """
    Check database connectivity.

    Returns:
        bool: True if database is healthy, False otherwise
    """
    if not engine:
        return False

    try:
        async with engine.begin() as conn:
            await conn.exec_driver_sql("SELECT 1")
        return True
    except Exception as e:
        logger.error("Database health check failed", error=str(e))
        return False
