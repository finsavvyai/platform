#!/bin/bash

# Cloudflare D1 Database Setup for UPM.Plus
# This script sets up D1 database with proper schema and configuration

set -e

echo "🚀 Setting up Cloudflare D1 for UPM.Plus..."

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler CLI not found. Installing..."
    npm install -g wrangler
fi

# Configuration
DATABASE_NAME="upm-plus-database"
SCHEMA_NAME="upmplus"

echo "📋 Configuration:"
echo "  Database Name: $DATABASE_NAME"
echo "  Schema Name: $SCHEMA_NAME"

# Create D1 database
echo "🗄️  Creating D1 database..."
wrangler d1 create $DATABASE_NAME

# Get database ID from output
echo "⚡  Retrieving database ID..."
DATABASE_ID=$(wrangler d1 list | grep $DATABASE_NAME | awk '{print $2}')

if [ -z "$DATABASE_ID" ]; then
    echo "❌ Failed to get database ID"
    exit 1
fi

echo "✅ Database ID: $DATABASE_ID"

# Update wrangler.toml with database configuration
echo "🔧 Updating wrangler.toml..."
cat >> wrangler.toml << EOF

# D1 Database for UPM.Plus
[[d1_databases]]
binding = "UPM_PLUS_DB"
database_name = "$DATABASE_NAME"
database_id = "$DATABASE_ID"
EOF

# Create schema SQL file
echo "📝 Creating schema SQL..."
cat > deployment/cloudflare/d1-schema.sql << 'SQL'
-- UPM.Plus Schema for Cloudflare D1
-- Created: $(date)

-- Users table
CREATE TABLE IF NOT EXISTS users (
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
CREATE TABLE IF NOT EXISTS workflows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    definition TEXT NOT NULL, -- JSON workflow definition
    owner_id INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(id)
);

-- Workflow executions table
CREATE TABLE IF NOT EXISTS workflow_executions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workflow_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, running, completed, failed
    result TEXT, -- JSON execution result
    error_message TEXT,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    FOREIGN KEY (workflow_id) REFERENCES workflows(id)
);

-- Agents table
CREATE TABLE IF NOT EXISTS agents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- browser, conversational, infrastructure, data
    configuration TEXT, -- JSON agent configuration
    owner_id INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(id)
);

-- Tasks table
CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    parameters TEXT, -- JSON task parameters
    status TEXT NOT NULL DEFAULT 'pending',
    result TEXT, -- JSON task result
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    FOREIGN KEY (agent_id) REFERENCES agents(id)
);

-- MCP servers table
CREATE TABLE IF NOT EXISTS mcp_servers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    transport_type TEXT NOT NULL, -- http, websocket, stdio
    connection_config TEXT NOT NULL, -- JSON connection details
    owner_id INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    last_connected_at TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(id)
);

-- Documents table (for knowledge management)
CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    metadata TEXT, -- JSON document metadata
    owner_id INTEGER NOT NULL,
    file_path TEXT,
    file_size INTEGER,
    mime_type TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(id)
);

-- Knowledge base table
CREATE TABLE IF NOT EXISTS knowledge_base (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id INTEGER NOT NULL,
    chunk_text TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    embedding_id TEXT, -- Vector embedding reference
    metadata TEXT, -- JSON chunk metadata
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (document_id) REFERENCES documents(id)
);

-- API keys table
CREATE TABLE IF NOT EXISTS api_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key_id TEXT UNIQUE NOT NULL,
    key_hash TEXT NOT NULL,
    owner_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    permissions TEXT, -- JSON permissions array
    is_active BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMP,
    last_used_at TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(id)
);

-- Usage analytics table
CREATE TABLE IF NOT EXISTS usage_analytics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    resource_type TEXT NOT NULL, -- workflow, agent, task, mcp_server
    resource_id INTEGER NOT NULL,
    action TEXT NOT NULL, -- create, read, update, delete, execute
    metadata TEXT, -- JSON analytics metadata
    ip_address TEXT,
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_workflows_owner ON workflows(owner_id);
CREATE INDEX IF NOT EXISTS idx_workflows_active ON workflows(is_active);
CREATE INDEX IF NOT EXISTS idx_executions_workflow ON workflow_executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_executions_status ON workflow_executions(status);
CREATE INDEX IF NOT EXISTS idx_agents_owner ON agents(owner_id);
CREATE INDEX IF NOT EXISTS idx_agents_type ON agents(type);
CREATE INDEX IF NOT EXISTS idx_tasks_agent ON tasks(agent_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_mcp_servers_owner ON mcp_servers(owner_id);
CREATE INDEX IF NOT EXISTS idx_documents_owner ON documents(owner_id);
CREATE INDEX IF NOT EXISTS idx_documents_active ON documents(is_active);
CREATE INDEX IF NOT EXISTS idx_knowledge_document ON knowledge_base(document_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_owner ON api_keys(owner_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(is_active);
CREATE INDEX IF NOT EXISTS idx_usage_user ON usage_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_resource ON usage_analytics(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_usage_created ON usage_analytics(created_at);

-- Insert default admin user (password: admin123 - change in production)
INSERT OR IGNORE INTO users (email, username, hashed_password, is_superuser) 
VALUES ('admin@upm.plus', 'admin', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj6hsxq9w5KS', TRUE);

-- Insert sample workflow
INSERT OR IGNORE INTO workflows (name, description, definition, owner_id) 
VALUES (
    'Sample Browser Automation',
    'A sample workflow that demonstrates browser automation capabilities',
    '{"nodes": [{"id": "1", "type": "browser_navigate", "data": {"url": "https://example.com"}}, {"id": "2", "type": "browser_extract", "data": {"selector": "h1"}}], "edges": [{"source": "1", "target": "2"}]}',
    1
);
SQL

# Execute schema creation
echo "🗄️  Creating database schema..."
wrangler d1 execute $DATABASE_NAME --file=deployment/cloudflare/d1-schema.sql

# Create initial data
echo "📊 Creating initial data..."
cat > deployment/cloudflare/d1-initial-data.sql << 'SQL'
-- Initial data for UPM.Plus

-- Sample MCP server configurations
INSERT OR IGNORE INTO mcp_servers (name, transport_type, connection_config, owner_id) 
VALUES 
    ('AutoBoot Dev Server', 'stdio', '{"command": "node", "args": ["autoboot.js"], "cwd": "/path/to/autoboot"}', 1),
    ('Sample HTTP MCP', 'http', '{"url": "https://api.example.com/mcp", "headers": {"Authorization": "Bearer token"}}', 1);

-- Sample agents
INSERT OR IGNORE INTO agents (name, type, configuration, owner_id) 
VALUES 
    ('Default Browser Agent', 'browser', '{"browser": "chromium", "headless": true}', 1),
    ('Default Conversational Agent', 'conversational', '{"model": "gpt-3.5-turbo", "temperature": 0.7}', 1),
    ('Default Infrastructure Agent', 'infrastructure', '{"ansible": true, "playbooks_dir": "./playbooks"}', 1),
    ('Default Data Agent', 'data', '{"vector_db": "chroma", "embedding_model": "all-MiniLM-L6-v2"}', 1);

-- Sample documents for knowledge base
INSERT OR IGNORE INTO documents (title, content, metadata, owner_id) 
VALUES 
    ('UPM.Plus User Guide', '# UPM.Plus User Guide\n\nThis is a comprehensive guide to using UPM.Plus...', '{"type": "guide", "category": "user"}', 1),
    ('API Documentation', '# API Documentation\n\n## Authentication\n\nAll API requests require authentication...', '{"type": "documentation", "category": "api"}', 1);
SQL

wrangler d1 execute $DATABASE_NAME --file=deployment/cloudflare/d1-initial-data.sql

# Create environment file for backend
echo "🔧 Creating environment configuration..."
cat > .env.d1 << EOF
# Cloudflare D1 Configuration
CLOUDFLARE_D1_DATABASE_URL=d1+aiosqlite://$DATABASE_ID
CLOUDFLARE_ACCOUNT_ID=$(wrangler whoami | jq -r '.account_id')
CLOUDFLARE_D1_DATABASE_ID=$DATABASE_ID
CLOUDFLARE_API_TOKEN=your_api_token_here
CLOUDFLARE_D1_SCHEMA=$SCHEMA_NAME

# Database fallback (for local development)
DATABASE_URL=sqlite+aiosqlite:///./test.db

# Other configuration
SECRET_KEY=dev_secret_key_change_in_production
ENVIRONMENT=development
DEBUG=true
EOF

echo ""
echo "✅ Cloudflare D1 setup complete!"
echo ""
echo "📋 Summary:"
echo "  Database Name: $DATABASE_NAME"
echo "  Database ID: $DATABASE_ID"
echo "  Schema: $SCHEMA_NAME"
echo ""
echo "🔧 Next steps:"
echo "  1. Add your Cloudflare API token to .env.d1"
echo "  2. Copy .env.d1 to .env for backend usage"
echo "  3. Update your backend configuration to use D1"
echo "  4. Test the connection with: python -m app.core.cloudflare_d1"
echo ""
echo "🚀 Your UPM.Plus D1 database is ready!"
