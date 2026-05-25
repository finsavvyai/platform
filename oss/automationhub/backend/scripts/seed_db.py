#!/usr/bin/env python3
"""
Database seeding script for development
"""

import asyncio
import sys
import os

# Add the backend directory to the Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app.core.migrations import create_database_schema, reset_database
from app.core.vector_db import knowledge_manager
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def seed_database():
    """Seed the database with development data"""
    try:
        logger.info("Starting database seeding...")
        
        # Create/update database schema
        await create_database_schema()
        
        # Initialize knowledge manager
        await knowledge_manager.initialize()
        
        # Add some sample knowledge
        await knowledge_manager.add_knowledge(
            content="UPM.Plus is an autonomous digital ecosystem orchestrator that combines browser automation, infrastructure management, conversational AI, and workflow orchestration.",
            metadata={
                "type": "system_info",
                "category": "overview",
                "source": "system"
            }
        )
        
        await knowledge_manager.add_knowledge(
            content="Browser automation in UPM.Plus uses Browser Use and NanoBrowser for intelligent web interactions with self-healing capabilities.",
            metadata={
                "type": "feature_info",
                "category": "browser_automation",
                "source": "system"
            }
        )
        
        await knowledge_manager.add_knowledge(
            content="Infrastructure management leverages Ansible for automated provisioning, configuration, and deployment across multiple cloud providers.",
            metadata={
                "type": "feature_info",
                "category": "infrastructure",
                "source": "system"
            }
        )
        
        logger.info("Database seeding completed successfully")
        
    except Exception as e:
        logger.error(f"Database seeding failed: {e}")
        raise
    finally:
        # Clean up connections
        await knowledge_manager.vector_db.disconnect()


async def reset_and_seed():
    """Reset database and seed with fresh data"""
    logger.warning("This will reset the entire database!")
    await reset_database()
    await seed_database()


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Database seeding utility")
    parser.add_argument("--reset", action="store_true", help="Reset database before seeding")
    args = parser.parse_args()
    
    if args.reset:
        asyncio.run(reset_and_seed())
    else:
        asyncio.run(seed_database())