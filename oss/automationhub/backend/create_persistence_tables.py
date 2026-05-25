#!/usr/bin/env python3
"""
Script to create workflow persistence tables directly using SQLAlchemy.
This bypasses Alembic migration issues and creates the tables directly.
"""

import asyncio
import sys
import os

# Add the app directory to the path
sys.path.append(os.path.dirname(__file__))

from sqlalchemy import text
from app.core.database import engine, Base
from app.models.workflow_persistence import (
    WorkflowDefinition, WorkflowExecution, NodeExecution, 
    ExecutionAuditLog, WorkflowVersion
)


async def create_persistence_tables():
    """Create workflow persistence tables."""
    try:
        print("Creating workflow persistence tables...")
        
        async with engine.begin() as conn:
            # First, drop existing tables if they exist
            print("Dropping existing persistence tables if they exist...")
            await conn.execute(text("DROP TABLE IF EXISTS workflow_versions"))
            await conn.execute(text("DROP TABLE IF EXISTS execution_audit_logs"))
            await conn.execute(text("DROP TABLE IF EXISTS node_executions_v2"))
            await conn.execute(text("DROP TABLE IF EXISTS workflow_executions_v2"))
            await conn.execute(text("DROP TABLE IF EXISTS workflow_definitions_v2"))
            
            # Create only the new persistence tables
            await conn.run_sync(Base.metadata.create_all, 
                               tables=[
                                   WorkflowDefinition.__table__,
                                   WorkflowExecution.__table__,
                                   NodeExecution.__table__,
                                   ExecutionAuditLog.__table__,
                                   WorkflowVersion.__table__
                               ])
        
        print("✅ Workflow persistence tables created successfully!")
        
        # Verify tables were created
        async with engine.begin() as conn:
            result = await conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND (name LIKE '%_v2' OR name LIKE '%audit%' OR name LIKE '%version%')"
            )
            tables = result.fetchall()
            
            print(f"\n📋 Created tables:")
            for table in tables:
                print(f"  - {table[0]}")
                
    except Exception as e:
        print(f"❌ Error creating tables: {e}")
        raise


async def main():
    """Main function."""
    await create_persistence_tables()
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())