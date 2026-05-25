"""
Cloudflare D1 Database Service for UPM.Plus
"""

import os
import json
import asyncio
from typing import Optional, Dict, Any, List
from urllib.parse import urlparse
import httpx
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text
import logging

from app.core.config import settings

logger = logging.getLogger(__name__)


class CloudflareD1Service:
    """Service for interacting with Cloudflare D1 database"""
    
    def __init__(self):
        self.account_id = settings.CLOUDFLARE_D1_ACCOUNT_ID
        self.database_id = settings.CLOUDFLARE_D1_DATABASE_ID
        self.api_token = settings.CLOUDFLARE_D1_API_TOKEN
        self.schema = settings.CLOUDFLARE_D1_SCHEMA
        self.base_url = f"https://api.cloudflare.com/client/v4/accounts/{self.account_id}/d1/database/{self.database_id}"
        
    async def test_connection(self) -> bool:
        """Test connection to Cloudflare D1"""
        if not all([self.account_id, self.database_id, self.api_token]):
            logger.warning("Cloudflare D1 credentials not configured")
            return False
            
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    self.base_url,
                    headers={"Authorization": f"Bearer {self.api_token}"}
                )
                return response.status_code == 200
        except Exception as e:
            logger.error(f"Failed to connect to Cloudflare D1: {e}")
            return False
    
    async def execute_query(self, query: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Execute a SQL query on Cloudflare D1"""
        if not await self.test_connection():
            raise Exception("Cloudflare D1 connection not available")
            
        try:
            async with httpx.AsyncClient() as client:
                payload = {"sql": query}
                if params:
                    payload["params"] = params
                    
                response = await client.post(
                    f"{self.base_url}/query",
                    headers={
                        "Authorization": f"Bearer {self.api_token}",
                        "Content-Type": "application/json"
                    },
                    json=payload
                )
                
                if response.status_code != 200:
                    raise Exception(f"D1 Query failed: {response.text}")
                    
                return response.json()
                
        except Exception as e:
            logger.error(f"Failed to execute D1 query: {e}")
            raise
    
    async def create_schema(self) -> bool:
        """Create the UPM.Plus schema in Cloudflare D1"""
        try:
            # Create schema SQL
            schema_sql = f"""
            -- Create UPM.Plus schema
            CREATE SCHEMA IF NOT EXISTS {self.schema};
            
            -- Users table
            CREATE TABLE IF NOT EXISTS {self.schema}.users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                username TEXT UNIQUE NOT NULL,
                hashed_password TEXT NOT NULL,
                is_active BOOLEAN DEFAULT TRUE,
                is_superuser BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            -- Workflows table
            CREATE TABLE IF NOT EXISTS {self.schema}.workflows (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                description TEXT,
                definition TEXT NOT NULL, -- JSON workflow definition
                owner_id INTEGER NOT NULL,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (owner_id) REFERENCES {self.schema}.users(id)
            );
            
            -- Workflow executions table
            CREATE TABLE IF NOT EXISTS {self.schema}.workflow_executions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                workflow_id INTEGER NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending', -- pending, running, completed, failed
                result TEXT, -- JSON execution result
                error_message TEXT,
                started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                completed_at TIMESTAMP,
                FOREIGN KEY (workflow_id) REFERENCES {self.schema}.workflows(id)
            );
            
            -- Agents table
            CREATE TABLE IF NOT EXISTS {self.schema}.agents (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                type TEXT NOT NULL, -- browser, conversational, infrastructure, data
                configuration TEXT, -- JSON agent configuration
                owner_id INTEGER NOT NULL,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (owner_id) REFERENCES {self.schema}.users(id)
            );
            
            -- Tasks table
            CREATE TABLE IF NOT EXISTS {self.schema}.tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                agent_id INTEGER NOT NULL,
                type TEXT NOT NULL,
                parameters TEXT, -- JSON task parameters
                status TEXT NOT NULL DEFAULT 'pending',
                result TEXT, -- JSON task result
                error_message TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                started_at TIMESTAMP,
                completed_at TIMESTAMP,
                FOREIGN KEY (agent_id) REFERENCES {self.schema}.agents(id)
            );
            
            -- MCP servers table
            CREATE TABLE IF NOT EXISTS {self.schema}.mcp_servers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                transport_type TEXT NOT NULL, -- http, websocket, stdio
                connection_config TEXT NOT NULL, -- JSON connection details
                owner_id INTEGER NOT NULL,
                is_active BOOLEAN DEFAULT TRUE,
                last_connected_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (owner_id) REFERENCES {self.schema}.users(id)
            );
            
            -- Documents table (for knowledge management)
            CREATE TABLE IF NOT EXISTS {self.schema}.documents (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                metadata TEXT, -- JSON document metadata
                owner_id INTEGER NOT NULL,
                file_path TEXT,
                file_size INTEGER,
                mime_type TEXT,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (owner_id) REFERENCES {self.schema}.users(id)
            );
            
            -- Create indexes for better performance
            CREATE INDEX IF NOT EXISTS idx_users_email ON {self.schema}.users(email);
            CREATE INDEX IF NOT EXISTS idx_workflows_owner ON {self.schema}.workflows(owner_id);
            CREATE INDEX IF NOT EXISTS idx_executions_workflow ON {self.schema}.workflow_executions(workflow_id);
            CREATE INDEX IF NOT EXISTS idx_agents_owner ON {self.schema}.agents(owner_id);
            CREATE INDEX IF NOT EXISTS idx_tasks_agent ON {self.schema}.tasks(agent_id);
            CREATE INDEX IF NOT EXISTS idx_mcp_servers_owner ON {self.schema}.mcp_servers(owner_id);
            CREATE INDEX IF NOT EXISTS idx_documents_owner ON {self.schema}.documents(owner_id);
            """
            
            # Execute schema creation
            result = await self.execute_query(schema_sql)
            
            if result.get("success", False):
                logger.info("Cloudflare D1 schema created successfully")
                return True
            else:
                logger.error(f"Failed to create D1 schema: {result}")
                return False
                
        except Exception as e:
            logger.error(f"Failed to create D1 schema: {e}")
            return False
    
    async def get_database_info(self) -> Dict[str, Any]:
        """Get information about the D1 database"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    self.base_url,
                    headers={"Authorization": f"Bearer {self.api_token}"}
                )
                
                if response.status_code == 200:
                    data = response.json()
                    return {
                        "success": True,
                        "database": data.get("result", {}),
                        "schema": self.schema
                    }
                else:
                    return {"success": False, "error": response.text}
                    
        except Exception as e:
            logger.error(f"Failed to get D1 database info: {e}")
            return {"success": False, "error": str(e)}


# Global D1 service instance
d1_service = CloudflareD1Service()


async def get_d1_service() -> CloudflareD1Service:
    """Get the Cloudflare D1 service instance"""
    return d1_service


class D1AsyncEngine:
    """Async engine wrapper for Cloudflare D1"""
    
    def __init__(self):
        self.d1_service = d1_service
        self._engine = None
        
    async def create_engine(self):
        """Create async engine for D1"""
        if self.d1_service.account_id and self.d1_service.database_id:
            # Use D1 database URL if configured
            database_url = self.d1_service.CLOUDFLARE_D1_DATABASE_URL or f"d1+aiosqlite://{self.d1_service.database_id}"
        else:
            # Fallback to local SQLite
            database_url = settings.DATABASE_URL
            
        self._engine = create_async_engine(
            database_url,
            echo=settings.DATABASE_ECHO,
            future=True
        )
        return self._engine
    
    async def get_session(self) -> AsyncSession:
        """Get async session for D1"""
        if not self._engine:
            await self.create_engine()
            
        async_session = sessionmaker(
            self._engine, class_=AsyncSession, expire_on_commit=False
        )
        return async_session()


# Global D1 engine instance
d1_engine = D1AsyncEngine()


async def get_d1_session() -> AsyncSession:
    """Get a D1 database session"""
    return await d1_engine.get_session()


async def init_d1_database():
    """Initialize Cloudflare D1 database"""
    logger.info("Initializing Cloudflare D1 database...")
    
    # Test connection
    if await d1_service.test_connection():
        logger.info("Cloudflare D1 connection successful")
        
        # Create schema
        if await d1_service.create_schema():
            logger.info("Cloudflare D1 schema created successfully")
        else:
            logger.warning("Failed to create D1 schema, using fallback")
    else:
        logger.info("Cloudflare D1 not available, using local database")
    
    # Initialize engine
    await d1_engine.create_engine()
    logger.info("Database initialization complete")
