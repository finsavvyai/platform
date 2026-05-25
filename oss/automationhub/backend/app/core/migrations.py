"""
Database migration utilities
"""

import logging
from sqlalchemy import text
from app.core.database import engine, Base
from app.models import user, organization, workflow, task, agent, document

logger = logging.getLogger(__name__)


async def create_database_schema():
    """Create all database tables and initial data"""
    try:
        async with engine.begin() as conn:
            # Create all tables
            await conn.run_sync(Base.metadata.create_all)
            logger.info("Database schema created successfully")
            
            # Create initial data if needed
            await _create_initial_data(conn)
            
    except Exception as e:
        logger.error(f"Failed to create database schema: {e}")
        raise


async def _create_initial_data(conn):
    """Create initial data for the application"""
    try:
        # Check if we already have initial data
        result = await conn.execute(text("SELECT COUNT(*) FROM users"))
        user_count = result.scalar()
        
        if user_count == 0:
            logger.info("Creating initial data...")
            
            # Create default organization
            await conn.execute(text("""
                INSERT INTO organizations (id, name, domain, subscription_plan, created_at)
                VALUES (
                    gen_random_uuid(),
                    'Default Organization',
                    'default.local',
                    'enterprise',
                    NOW()
                )
            """))
            
            logger.info("Initial data created successfully")
        else:
            logger.info("Initial data already exists, skipping creation")
            
    except Exception as e:
        logger.error(f"Failed to create initial data: {e}")
        # Don't raise here as this is not critical for basic functionality


async def drop_database_schema():
    """Drop all database tables (for testing/reset)"""
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
            logger.info("Database schema dropped successfully")
    except Exception as e:
        logger.error(f"Failed to drop database schema: {e}")
        raise


async def reset_database():
    """Reset the entire database (drop and recreate)"""
    logger.warning("Resetting database - all data will be lost!")
    await drop_database_schema()
    await create_database_schema()
    logger.info("Database reset completed")