"""
Database configuration and session management
"""

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import MetaData
from contextlib import asynccontextmanager
import logging

from app.core.config import settings

logger = logging.getLogger(__name__)

# Global variables for engine and session factory
engine = None
AsyncSessionLocal = None

def init_database():
    """Initialize database engine and session factory"""
    global engine, AsyncSessionLocal
    
    if engine is None:
        # Debug: Print the actual DATABASE_URL
        print(f"DEBUG: DATABASE_URL = {settings.DATABASE_URL}")
        
        # Ensure we're using the async SQLite driver
        database_url = settings.DATABASE_URL
        if database_url.startswith("sqlite://"):
            database_url = database_url.replace("sqlite://", "sqlite+aiosqlite://", 1)
        elif database_url.startswith("sqlite:///") and "+aiosqlite" not in database_url:
            database_url = database_url.replace("sqlite:///", "sqlite+aiosqlite:///", 1)
        
        print(f"DEBUG: Corrected DATABASE_URL = {database_url}")
        
        # Create async engine
        engine = create_async_engine(
            database_url,
            echo=settings.DATABASE_ECHO,
            pool_pre_ping=True,
            pool_recycle=300,
        )
        
        # Create session factory
        AsyncSessionLocal = async_sessionmaker(
            engine,
            class_=AsyncSession,
            expire_on_commit=False
        )
        
        logger.info(f"Database initialized with URL: {database_url}")

# Initialize on import
init_database()

# Metadata for table creation
metadata = MetaData()


class Base(DeclarativeBase):
    """Base class for all database models"""
    metadata = metadata


@asynccontextmanager
async def get_db_session():
    """Get database session context manager"""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def get_db():
    """Dependency for FastAPI to get database session"""
    async with get_db_session() as session:
        yield session


async def create_tables():
    """Create all database tables"""
    try:
        async with engine.begin() as conn:
            # Import all models to ensure they're registered
            from app.models import user, organization, workflow, task, agent, document
            
            # Create all tables
            await conn.run_sync(Base.metadata.create_all)
            logger.info("Database tables created successfully")
    except Exception as e:
        logger.error(f"Failed to create database tables: {e}")
        raise


async def drop_tables():
    """Drop all database tables (for testing)"""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        logger.info("Database tables dropped")