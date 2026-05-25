-- UPM.Plus AutomationHub - D1 Database Schema
-- Migration: 0001_initial_schema
-- Created: November 7, 2024

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    avatar_url TEXT,
    plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'premium', 'enterprise')),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    preferences TEXT, -- JSON string
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    last_login_at TEXT
);

-- Agents table
CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('browser', 'infrastructure', 'conversational', 'data')),
    capabilities TEXT, -- JSON array
    config TEXT, -- JSON object
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'error')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    last_run_at TEXT
);

-- Workflows table
CREATE TABLE IF NOT EXISTS workflows (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    creator_id TEXT NOT NULL,
    definition TEXT, -- JSON object
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Workflow steps table
CREATE TABLE IF NOT EXISTS workflow_steps (
    id TEXT PRIMARY KEY,
    workflow_id TEXT NOT NULL,
    step_order INTEGER NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    config TEXT, -- JSON object
    conditions TEXT, -- JSON array
    created_at TEXT NOT NULL,
    FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
);

-- Tasks table
CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    workflow_id TEXT,
    agent_id TEXT,
    name TEXT NOT NULL,
    description TEXT,
    input_data TEXT, -- JSON object
    output_data TEXT, -- JSON object
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    error_message TEXT,
    execution_time INTEGER, -- in milliseconds
    created_at TEXT NOT NULL,
    started_at TEXT,
    completed_at TEXT,
    FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE SET NULL,
    FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE SET NULL
);

-- Task logs table
CREATE TABLE IF NOT EXISTS task_logs (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    level TEXT NOT NULL CHECK (level IN ('debug', 'info', 'warn', 'error')),
    message TEXT NOT NULL,
    data TEXT, -- JSON object
    created_at TEXT NOT NULL,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

-- Workflow executions table
CREATE TABLE IF NOT EXISTS workflow_executions (
    id TEXT PRIMARY KEY,
    workflow_id TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    input_data TEXT, -- JSON object
    output_data TEXT, -- JSON object
    error_message TEXT,
    triggered_by TEXT,
    started_at TEXT,
    completed_at TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
);

-- Files table
CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    original_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    content_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    checksum TEXT,
    status TEXT DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'processing', 'processed', 'deleted')),
    metadata TEXT, -- JSON object
    upload_time TEXT NOT NULL,
    deleted_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    data TEXT, -- JSON object
    read_at TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- API keys table
CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    key_hash TEXT NOT NULL,
    permissions TEXT, -- JSON array
    last_used_at TEXT,
    expires_at TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'expired')),
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- User sessions table
CREATE TABLE IF NOT EXISTS user_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    session_token TEXT UNIQUE NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    last_accessed_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_agents_type ON agents(type);
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
CREATE INDEX IF NOT EXISTS idx_workflows_creator_id ON workflows(creator_id);
CREATE INDEX IF NOT EXISTS idx_workflows_status ON workflows(status);
CREATE INDEX IF NOT EXISTS idx_workflow_steps_workflow_id ON workflow_steps(workflow_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_agent_id ON tasks(agent_id);
CREATE INDEX IF NOT EXISTS idx_tasks_workflow_id ON tasks(workflow_id);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);
CREATE INDEX IF NOT EXISTS idx_task_logs_task_id ON task_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_task_logs_created_at ON task_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow_id ON workflow_executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_status ON workflow_executions(status);
CREATE INDEX IF NOT EXISTS idx_files_user_id ON files(user_id);
CREATE INDEX IF NOT EXISTS idx_files_status ON files(status);
CREATE INDEX IF NOT EXISTS idx_files_upload_time ON files(upload_time);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read_at ON notifications(read_at);
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_session_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);

-- Insert initial data
INSERT OR IGNORE INTO users (id, email, name, plan, status, created_at, updated_at) VALUES
('admin', 'admin@upm.plus', 'Administrator', 'enterprise', 'active', datetime('now'), datetime('now'));

INSERT OR IGNORE INTO agents (id, name, type, capabilities, status, created_at, updated_at) VALUES
('browser-agent-1', 'Chrome Browser Agent', 'browser', '["automation", "screenshot", "form-filling"]', 'active', datetime('now'), datetime('now')),
('infrastructure-agent-1', 'Infrastructure Agent', 'infrastructure', '["server-management", "monitoring", "deployment"]', 'active', datetime('now'), datetime('now')),
('conversation-agent-1', 'Conversation Agent', 'conversational', '["chat", "email", "document-analysis"]', 'active', datetime('now'), datetime('now')),
('data-agent-1', 'Data Processing Agent', 'data', '["etl", "analysis", "reporting"]', 'active', datetime('now'), datetime('now'));

-- Create a sample workflow
INSERT OR IGNORE INTO workflows (id, name, description, creator_id, definition, status, created_at, updated_at) VALUES
('sample-workflow-1', 'Sample Automation Workflow', 'A sample workflow for testing purposes', 'admin', '{"steps": [{"type": "browser", "action": "navigate", "url": "https://example.com"}]}', 'active', datetime('now'), datetime('now'));

-- Create workflow steps for the sample workflow
INSERT OR IGNORE INTO workflow_steps (id, workflow_id, step_order, name, type, config, created_at) VALUES
('step-1', 'sample-workflow-1', 1, 'Navigate to Website', 'browser', '{"action": "navigate", "url": "https://example.com"}', datetime('now')),
('step-2', 'sample-workflow-1', 2, 'Take Screenshot', 'browser', '{"action": "screenshot", "full_page": true}', datetime('now'));