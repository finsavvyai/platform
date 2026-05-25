"""
Database migrations for Cloudflare D1
"""

import asyncio
import logging
from typing import List, Dict, Any
from datetime import datetime

from app.core.cloudflare_d1 import d1_service

logger = logging.getLogger(__name__)


class D1Migration:
    """Database migration for Cloudflare D1"""
    
    def __init__(self, version: str, description: str, sql: str):
        self.version = version
        self.description = description
        self.sql = sql
        self.created_at = datetime.utcnow()
    
    async def execute(self) -> bool:
        """Execute migration"""
        try:
            logger.info(f"Executing migration {self.version}: {self.description}")
            result = await d1_service.execute_query(self.sql)
            
            if result.get("success", False):
                logger.info(f"Migration {self.version} completed successfully")
                return True
            else:
                logger.error(f"Migration {self.version} failed: {result}")
                return False
                
        except Exception as e:
            logger.error(f"Migration {self.version} error: {e}")
            return False


# Database migrations list
MIGRATIONS: List[D1Migration] = [
    D1Migration(
        version="001",
        description="Create initial schema",
        sql="""
        -- Create migration tracking table
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version TEXT PRIMARY KEY,
            description TEXT NOT NULL,
            executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        
        -- Users table
        CREATE TABLE IF NOT EXISTS upmplus.users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            username TEXT UNIQUE NOT NULL,
            hashed_password TEXT NOT NULL,
            is_active BOOLEAN DEFAULT TRUE,
            is_superuser BOOLEAN DEFAULT FALSE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        
        -- Workflows table
        CREATE TABLE IF NOT EXISTS upmplus.workflows (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            definition TEXT NOT NULL,
            owner_id INTEGER NOT NULL,
            is_active BOOLEAN DEFAULT TRUE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (owner_id) REFERENCES upmplus.users(id)
        );
        
        -- Workflow executions table
        CREATE TABLE IF NOT EXISTS upmplus.workflow_executions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            workflow_id INTEGER NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            result TEXT,
            error_message TEXT,
            started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            completed_at DATETIME,
            FOREIGN KEY (workflow_id) REFERENCES upmplus.workflows(id)
        );
        
        -- Agents table
        CREATE TABLE IF NOT EXISTS upmplus.agents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            type TEXT NOT NULL,
            configuration TEXT,
            owner_id INTEGER NOT NULL,
            is_active BOOLEAN DEFAULT TRUE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (owner_id) REFERENCES upmplus.users(id)
        );
        
        -- Tasks table
        CREATE TABLE IF NOT EXISTS upmplus.tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            agent_id INTEGER NOT NULL,
            type TEXT NOT NULL,
            parameters TEXT,
            status TEXT NOT NULL DEFAULT 'pending',
            result TEXT,
            error_message TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            started_at TIMESTAMP,
            completed_at TIMESTAMP,
            FOREIGN KEY (agent_id) REFERENCES upmplus.agents(id)
        );
        
        -- MCP servers table
        CREATE TABLE IF NOT EXISTS upmplus.mcp_servers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            transport_type TEXT NOT NULL,
            connection_config TEXT NOT NULL,
            owner_id INTEGER NOT NULL,
            is_active BOOLEAN DEFAULT TRUE,
            last_connected_at TIMESTAMP,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (owner_id) REFERENCES upmplus.users(id)
        );
        
        -- Documents table
        CREATE TABLE IF NOT EXISTS upmplus.documents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            metadata TEXT,
            owner_id INTEGER NOT NULL,
            file_path TEXT,
            file_size INTEGER,
            mime_type TEXT,
            is_active BOOLEAN DEFAULT TRUE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (owner_id) REFERENCES upmplus.users(id)
        );
        
        -- Knowledge base table
        CREATE TABLE IF NOT EXISTS upmplus.knowledge_base (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            document_id INTEGER NOT NULL,
            chunk_text TEXT NOT NULL,
            chunk_index INTEGER NOT NULL,
            embedding_id TEXT,
            metadata TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (document_id) REFERENCES upmplus.documents(id)
        );
        
        -- API keys table
        CREATE TABLE IF NOT EXISTS upmplus.api_keys (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            key_id TEXT UNIQUE NOT NULL,
            key_hash TEXT NOT NULL,
            owner_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            permissions TEXT,
            is_active BOOLEAN DEFAULT TRUE,
            expires_at TIMESTAMP,
            last_used_at TIMESTAMP,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (owner_id) REFERENCES upmplus.users(id)
        );
        
        -- Usage analytics table
        CREATE TABLE IF NOT EXISTS upmplus.usage_analytics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            resource_type TEXT NOT NULL,
            resource_id INTEGER NOT NULL,
            action TEXT NOT NULL,
            metadata TEXT,
            ip_address TEXT,
            user_agent TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES upmplus.users(id)
        );
        """
    ),
    
    D1Migration(
        version="002",
        description="Create indexes for performance",
        sql="""
        CREATE INDEX IF NOT EXISTS idx_users_email ON upmplus.users(email);
        CREATE INDEX IF NOT EXISTS idx_users_username ON upmplus.users(username);
        CREATE INDEX IF NOT EXISTS idx_workflows_owner ON upmplus.workflows(owner_id);
        CREATE INDEX IF NOT EXISTS idx_workflows_active ON upmplus.workflows(is_active);
        CREATE INDEX IF NOT EXISTS idx_executions_workflow ON upmplus.workflow_executions(workflow_id);
        CREATE INDEX IF NOT EXISTS idx_executions_status ON upmplus.workflow_executions(status);
        CREATE INDEX IF NOT EXISTS idx_agents_owner ON upmplus.agents(owner_id);
        CREATE INDEX IF NOT EXISTS idx_agents_type ON upmplus.agents(type);
        CREATE INDEX IF NOT EXISTS idx_tasks_agent ON upmplus.tasks(agent_id);
        CREATE INDEX IF NOT EXISTS idx_tasks_status ON upmplus.tasks(status);
        CREATE INDEX IF NOT EXISTS idx_mcp_servers_owner ON upmplus.mcp_servers(owner_id);
        CREATE INDEX IF NOT EXISTS idx_documents_owner ON upmplus.documents(owner_id);
        CREATE INDEX IF NOT EXISTS idx_documents_active ON upmplus.documents(is_active);
        CREATE INDEX IF NOT EXISTS idx_knowledge_document ON upmplus.knowledge_base(document_id);
        CREATE INDEX IF NOT EXISTS idx_api_keys_owner ON upmplus.api_keys(owner_id);
        CREATE INDEX IF NOT EXISTS idx_api_keys_active ON upmplus.api_keys(is_active);
        CREATE INDEX IF NOT EXISTS idx_usage_user ON upmplus.usage_analytics(user_id);
        CREATE INDEX IF NOT EXISTS idx_usage_resource ON upmplus.usage_analytics(resource_type, resource_id);
        CREATE INDEX IF NOT EXISTS idx_usage_created ON upmplus.usage_analytics(created_at);
        """
    ),
    
    D1Migration(
        version="003",
        description="Insert initial data",
        sql="""
        -- Insert default admin user (password: admin123 - change in production)
        INSERT OR IGNORE INTO upmplus.users (email, username, hashed_password, is_superuser) 
        VALUES ('admin@upm.plus', 'admin', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj6hsxq9w5KS', TRUE);
        
        -- Insert sample workflow
        INSERT OR IGNORE INTO upmplus.workflows (name, description, definition, owner_id) 
        VALUES (
            'Sample Browser Automation',
            'A sample workflow that demonstrates browser automation capabilities',
            '{"nodes": [{"id": "1", "type": "browser_navigate", "data": {"url": "https://example.com"}}, {"id": "2", "type": "browser_extract", "data": {"selector": "h1"}}], "edges": [{"source": "1", "target": "2"}]}',
            1
        );
        
        -- Insert sample MCP servers
        INSERT OR IGNORE INTO upmplus.mcp_servers (name, transport_type, connection_config, owner_id) 
        VALUES 
            ('AutoBoot Dev Server', 'stdio', '{"command": "node", "args": ["autoboot.js"], "cwd": "/path/to/autoboot"}', 1),
            ('Sample HTTP MCP', 'http', '{"url": "https://api.example.com/mcp", "headers": {"Authorization": "Bearer token"}}', 1);
        
        -- Insert sample agents
        INSERT OR IGNORE INTO upmplus.agents (name, type, configuration, owner_id) 
        VALUES 
            ('Default Browser Agent', 'browser', '{"browser": "chromium", "headless": true}', 1),
            ('Default Conversational Agent', 'conversational', '{"model": "gpt-3.5-turbo", "temperature": 0.7}', 1),
            ('Default Infrastructure Agent', 'infrastructure', '{"ansible": true, "playbooks_dir": "./playbooks"}', 1),
            ('Default Data Agent', 'data', '{"vector_db": "chroma", "embedding_model": "all-MiniLM-L6-v2"}', 1);
        
        -- Insert sample documents
        INSERT OR IGNORE INTO upmplus.documents (title, content, metadata, owner_id) 
        VALUES 
            ('UPM.Plus User Guide', '# UPM.Plus User Guide\\n\\nThis is a comprehensive guide to using UPM.Plus...', '{"type": "guide", "category": "user"}', 1),
            ('API Documentation', '# API Documentation\\n\\n## Authentication\\n\\nAll API requests require authentication...', '{"type": "documentation", "category": "api"}', 1);
        """
    ),
]


class D1MigrationManager:
    """Manager for D1 database migrations"""
    
    def __init__(self):
        self.migrations = MIGRATIONS
    
    async def get_executed_migrations(self) -> List[str]:
        """Get list of already executed migrations"""
        try:
            result = await d1_service.execute_query(
                "SELECT version FROM upmplus.schema_migrations ORDER BY version"
            )
            
            if result.get("success", False):
                return [row[0] for row in result.get("result", [])]
            else:
                return []
                
        except Exception as e:
            logger.error(f"Failed to get executed migrations: {e}")
            return []
    
    async def execute_migration(self, migration: D1Migration) -> bool:
        """Execute a single migration"""
        try:
            # Execute migration SQL
            success = await migration.execute()
            
            if success:
                # Record migration as executed
                await d1_service.execute_query(
                    """
                    INSERT INTO upmplus.schema_migrations (version, description) 
                    VALUES (?, ?)
                    """,
                    [migration.version, migration.description]
                )
                logger.info(f"Migration {migration.version} recorded as executed")
            
            return success
            
        except Exception as e:
            logger.error(f"Failed to execute migration {migration.version}: {e}")
            return False
    
    async def migrate(self) -> Dict[str, Any]:
        """Run all pending migrations"""
        logger.info("Starting D1 database migrations...")
        
        # Get executed migrations
        executed = await self.get_executed_migrations()
        logger.info(f"Already executed migrations: {executed}")
        
        # Find pending migrations
        pending = [m for m in self.migrations if m.version not in executed]
        logger.info(f"Pending migrations: {[m.version for m in pending]}")
        
        # Execute pending migrations
        results = {
            "total": len(self.migrations),
            "executed": len(executed),
            "pending": len(pending),
            "success": 0,
            "failed": 0,
            "errors": []
        }
        
        for migration in pending:
            if await self.execute_migration(migration):
                results["success"] += 1
            else:
                results["failed"] += 1
                results["errors"].append(f"Migration {migration.version} failed")
        
        logger.info(f"Migration completed: {results}")
        return results
    
    async def reset(self) -> bool:
        """Reset database (drop all tables)"""
        logger.warning("Resetting D1 database...")
        
        try:
            # Drop all tables
            reset_sql = """
            DROP TABLE IF EXISTS upmplus.usage_analytics;
            DROP TABLE IF EXISTS upmplus.api_keys;
            DROP TABLE IF EXISTS upmplus.knowledge_base;
            DROP TABLE IF EXISTS upmplus.documents;
            DROP TABLE IF EXISTS upmplus.mcp_servers;
            DROP TABLE IF EXISTS upmplus.tasks;
            DROP TABLE IF EXISTS upmplus.agents;
            DROP TABLE IF EXISTS upmplus.workflow_executions;
            DROP TABLE IF EXISTS upmplus.workflows;
            DROP TABLE IF EXISTS upmplus.users;
            DROP TABLE IF EXISTS upmplus.schema_migrations;
            """
            
            result = await d1_service.execute_query(reset_sql)
            
            if result.get("success", False):
                logger.info("Database reset completed")
                return True
            else:
                logger.error(f"Database reset failed: {result}")
                return False
                
        except Exception as e:
            logger.error(f"Database reset error: {e}")
            return False


# Global migration manager
migration_manager = D1MigrationManager()


async def run_migrations() -> Dict[str, Any]:
    """Run database migrations"""
    return await migration_manager.migrate()


async def reset_database() -> bool:
    """Reset the database"""
    return await migration_manager.reset()
