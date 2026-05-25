-- FinSavvy AI Suite - Core Schema
-- Revolutionary AI-powered financial technology platform
-- Migration: 0001_core_tables
-- Created: 2025-10-14

-- Core organizations table with multi-tenant support
CREATE TABLE IF NOT EXISTS organizations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    domain TEXT,
    region TEXT NOT NULL CHECK (region IN ('US', 'EU')),
    subscription_tier TEXT NOT NULL DEFAULT 'free' CHECK (subscription_tier IN ('free', 'starter', 'professional', 'enterprise')),
    settings TEXT NOT NULL DEFAULT '{}', -- JSON for organization settings
    ai_features_enabled BOOLEAN NOT NULL DEFAULT true,
    autonomous_agents_enabled BOOLEAN NOT NULL DEFAULT false,
    data_retention_days INTEGER NOT NULL DEFAULT 365,
    custom_compliance_rules BOOLEAN NOT NULL DEFAULT false,
    advanced_analytics BOOLEAN NOT NULL DEFAULT false,
    multi_region BOOLEAN NOT NULL DEFAULT false,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Constraints and indexes
    CONSTRAINT organizations_domain_unique UNIQUE (domain),
    CONSTRAINT organizations_name_not_empty CHECK (length(name) > 0)
);

-- Index for region-based queries
CREATE INDEX idx_organizations_region ON organizations(region);
CREATE INDEX idx_organizations_subscription_tier ON organizations(subscription_tier);

-- Core users table with role-based access control
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    organization_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'finance', 'compliance', 'auditor', 'viewer')),
    permissions TEXT NOT NULL DEFAULT '[]', -- JSON array of permissions
    first_name TEXT,
    last_name TEXT,
    phone TEXT,
    avatar_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    email_verified BOOLEAN NOT NULL DEFAULT false,
    last_login DATETIME,
    password_hash TEXT,
    two_factor_enabled BOOLEAN NOT NULL DEFAULT false,
    two_factor_secret TEXT,
    preferences TEXT NOT NULL DEFAULT '{}', -- JSON for user preferences
    ai_preferences TEXT NOT NULL DEFAULT '{}', -- JSON for AI interaction preferences
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Foreign key constraint
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,

    -- Constraints
    CONSTRAINT users_email_format CHECK (email LIKE '%@%.%'),
    CONSTRAINT users_organization_role CHECK (
        (role = 'admin' AND organization_id IS NOT NULL) OR
        (role IN ('finance', 'compliance', 'auditor', 'viewer') AND organization_id IS NOT NULL)
    )
);

-- Indexes for user queries
CREATE INDEX idx_users_organization_id ON users(organization_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_is_active ON users(is_active);

-- Comprehensive audit log for compliance and debugging
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    user_id TEXT,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    old_values TEXT, -- JSON of previous state
    new_values TEXT, -- JSON of new state
    ip_address TEXT,
    user_agent TEXT,
    session_id TEXT,
    request_id TEXT NOT NULL,
    trace_id TEXT,
    ai_decision TEXT, -- JSON for AI-related decisions
    confidence_score REAL CHECK (confidence_score >= 0.0 AND confidence_score <= 1.0),
    risk_level TEXT CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    metadata TEXT, -- Additional context
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Foreign key constraints
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes for audit log queries
CREATE INDEX idx_audit_logs_organization_id ON audit_logs(organization_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_request_id ON audit_logs(request_id);

-- AI session management for context and learning
CREATE TABLE IF NOT EXISTS ai_sessions (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    user_id TEXT,
    agent_type TEXT CHECK (agent_type IN ('billing', 'compliance', 'intelligence', 'risk', 'orchestrator')),
    agent_id TEXT,
    session_context TEXT NOT NULL DEFAULT '{}', -- JSON for session context
    conversation_summary TEXT, -- AI-generated summary
    learning_insights TEXT, -- JSON for learning from this session
    user_satisfaction_score INTEGER CHECK (user_satisfaction_score >= 1 AND user_satisfaction_score <= 5),
    is_active BOOLEAN NOT NULL DEFAULT true,
    started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ended_at DATETIME,
    last_activity DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    message_count INTEGER NOT NULL DEFAULT 0,
    task_count INTEGER NOT NULL DEFAULT 0,

    -- Foreign key constraints
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes for AI session queries
CREATE INDEX idx_ai_sessions_organization_id ON ai_sessions(organization_id);
CREATE INDEX idx_ai_sessions_user_id ON ai_sessions(user_id);
CREATE INDEX idx_ai_sessions_agent_type ON ai_sessions(agent_type);
CREATE INDEX idx_ai_sessions_is_active ON ai_sessions(is_active);
CREATE INDEX idx_ai_sessions_last_activity ON ai_sessions(last_activity);

-- AI messages for conversation tracking and learning
CREATE TABLE IF NOT EXISTS ai_messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    organization_id TEXT NOT NULL,
    user_id TEXT,
    agent_id TEXT,
    type TEXT NOT NULL CHECK (type IN ('command', 'query', 'response', 'notification', 'system')),
    content TEXT NOT NULL,
    content_type TEXT NOT NULL DEFAULT 'text' CHECK (content_type IN ('text', 'json', 'file_url')),
    metadata TEXT NOT NULL DEFAULT '{}', -- JSON for additional context
    parent_id TEXT, -- For conversation threading
    thread_id TEXT, -- For grouping related messages
    confidence_score REAL CHECK (confidence_score >= 0.0 AND confidence_score <= 1.0),
    processing_time_ms INTEGER,
    ai_model_used TEXT,
    token_count INTEGER,
    cost_estimate REAL, -- in USD
    feedback_received BOOLEAN NOT NULL DEFAULT false,
    feedback_rating INTEGER CHECK (feedback_rating >= 1 AND feedback_rating <= 5),
    feedback_comment TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Foreign key constraints
    FOREIGN KEY (session_id) REFERENCES ai_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (parent_id) REFERENCES ai_messages(id) ON DELETE SET NULL
);

-- Indexes for AI message queries
CREATE INDEX idx_ai_messages_session_id ON ai_messages(session_id);
CREATE INDEX idx_ai_messages_organization_id ON ai_messages(organization_id);
CREATE INDEX idx_ai_messages_user_id ON ai_messages(user_id);
CREATE INDEX idx_ai_messages_agent_id ON ai_messages(agent_id);
CREATE INDEX idx_ai_messages_type ON ai_messages(type);
CREATE INDEX idx_ai_messages_created_at ON ai_messages(created_at);
CREATE INDEX idx_ai_messages_thread_id ON ai_messages(thread_id);

-- AI tasks for autonomous agent workload tracking
CREATE TABLE IF NOT EXISTS ai_tasks (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    user_id TEXT,
    session_id TEXT,
    agent_type TEXT NOT NULL CHECK (agent_type IN ('billing', 'compliance', 'intelligence', 'risk', 'orchestrator')),
    agent_id TEXT,
    task_type TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'cancelled', 'retrying')),
    input_data TEXT NOT NULL, -- JSON for task input
    output_data TEXT, -- JSON for task output
    error_message TEXT,
    error_details TEXT, -- JSON for detailed error information
    progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    estimated_duration_minutes INTEGER,
    actual_duration_minutes INTEGER,
    confidence_score REAL CHECK (confidence_score >= 0.0 AND confidence_score <= 1.0),
    requires_human_approval BOOLEAN NOT NULL DEFAULT false,
    human_approver_id TEXT,
    human_approval_at DATETIME,
    auto_retry_count INTEGER NOT NULL DEFAULT 0,
    max_auto_retries INTEGER NOT NULL DEFAULT 3,
    next_retry_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    started_at DATETIME,
    completed_at DATETIME,

    -- Foreign key constraints
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (session_id) REFERENCES ai_sessions(id) ON DELETE SET NULL,
    FOREIGN KEY (human_approver_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes for AI task queries
CREATE INDEX idx_ai_tasks_organization_id ON ai_tasks(organization_id);
CREATE INDEX idx_ai_tasks_user_id ON ai_tasks(user_id);
CREATE INDEX idx_ai_tasks_agent_type ON ai_tasks(agent_type);
CREATE INDEX idx_ai_tasks_status ON ai_tasks(status);
CREATE INDEX idx_ai_tasks_priority ON ai_tasks(priority);
CREATE INDEX idx_ai_tasks_created_at ON ai_tasks(created_at);
CREATE INDEX idx_ai_tasks_next_retry_at ON ai_tasks(next_retry_at);

-- Knowledge base for RAG system
CREATE TABLE IF NOT EXISTS knowledge_base (
    id TEXT PRIMARY KEY,
    organization_id TEXT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('regulation', 'policy', 'procedure', 'faq', 'best_practice', 'template', 'guide')),
    category TEXT NOT NULL,
    tags TEXT NOT NULL DEFAULT '[]', -- JSON array of tags
    embedding_vector BLOB, -- Vector embedding for similarity search
    source TEXT NOT NULL,
    source_url TEXT,
    author TEXT,
    language TEXT NOT NULL DEFAULT 'en',
    last_reviewed_at DATETIME,
    review_frequency_days INTEGER NOT NULL DEFAULT 90,
    next_review_at DATETIME,
    confidence_score REAL NOT NULL DEFAULT 1.0 CHECK (confidence_score >= 0.0 AND confidence_score <= 1.0),
    relevance_score REAL NOT NULL DEFAULT 1.0 CHECK (relevance_score >= 0.0 AND relevance_score <= 1.0),
    usage_count INTEGER NOT NULL DEFAULT 0,
    last_used_at DATETIME,
    is_public BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    ai_generated BOOLEAN NOT NULL DEFAULT false,
    ai_generation_prompt TEXT,
    metadata TEXT NOT NULL DEFAULT '{}', -- JSON for additional metadata
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Foreign key constraint
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,

    -- Constraints
    CONSTRAINT knowledge_base_title_not_empty CHECK (length(title) > 0),
    CONSTRAINT knowledge_base_content_not_empty CHECK (length(content) > 0)
);

-- Indexes for knowledge base queries
CREATE INDEX idx_knowledge_base_organization_id ON knowledge_base(organization_id);
CREATE INDEX idx_knowledge_base_type ON knowledge_base(type);
CREATE INDEX idx_knowledge_base_category ON knowledge_base(category);
CREATE INDEX idx_knowledge_base_is_active ON knowledge_base(is_active);
CREATE INDEX idx_knowledge_base_is_public ON knowledge_base(is_public);
CREATE INDEX idx_knowledge_base_relevance_score ON knowledge_base(relevance_score);
CREATE INDEX idx_knowledge_base_last_used_at ON knowledge_base(last_used_at);

-- User feedback for AI learning and improvement
CREATE TABLE IF NOT EXISTS ai_feedback (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    user_id TEXT,
    session_id TEXT,
    task_id TEXT,
    message_id TEXT,
    feedback_type TEXT NOT NULL CHECK (feedback_type IN ('task_completion', 'response_quality', 'conversation', 'feature_request', 'bug_report')),
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    context TEXT, -- JSON for additional context
    improvement_suggestions TEXT,
    was_helpful BOOLEAN,
    would_recommend BOOLEAN,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Foreign key constraints
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (session_id) REFERENCES ai_sessions(id) ON DELETE SET NULL,
    FOREIGN KEY (task_id) REFERENCES ai_tasks(id) ON DELETE SET NULL,
    FOREIGN KEY (message_id) REFERENCES ai_messages(id) ON DELETE SET NULL
);

-- Indexes for AI feedback queries
CREATE INDEX idx_ai_feedback_organization_id ON ai_feedback(organization_id);
CREATE INDEX idx_ai_feedback_user_id ON ai_feedback(user_id);
CREATE INDEX idx_ai_feedback_feedback_type ON ai_feedback(feedback_type);
CREATE INDEX idx_ai_feedback_rating ON ai_feedback(rating);
CREATE INDEX idx_ai_feedback_created_at ON ai_feedback(created_at);

-- AI model usage tracking for analytics and billing
CREATE TABLE IF NOT EXISTS ai_model_usage (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    user_id TEXT,
    model_name TEXT NOT NULL,
    model_type TEXT NOT NULL CHECK (model_type IN ('llm', 'embedding', 'image', 'audio', 'custom')),
    input_tokens INTEGER,
    output_tokens INTEGER,
    total_tokens INTEGER,
    processing_time_ms INTEGER,
    cost_estimate REAL, -- in USD
    request_type TEXT NOT NULL CHECK (request_type IN ('query', 'generation', 'analysis', 'embedding', 'classification', 'extraction')),
    success BOOLEAN NOT NULL DEFAULT true,
    error_code TEXT,
    error_message TEXT,
    cache_hit BOOLEAN NOT NULL DEFAULT false,
    metadata TEXT, -- JSON for additional usage context
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Foreign key constraints
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes for AI model usage queries
CREATE INDEX idx_ai_model_usage_organization_id ON ai_model_usage(organization_id);
CREATE INDEX idx_ai_model_usage_user_id ON ai_model_usage(user_id);
CREATE INDEX idx_ai_model_usage_model_name ON ai_model_usage(model_name);
CREATE INDEX idx_ai_model_usage_created_at ON ai_model_usage(created_at);
CREATE INDEX idx_ai_model_usage_success ON ai_model_usage(success);

-- Triggers for automatic timestamp updates
CREATE TRIGGER IF NOT EXISTS update_organizations_updated_at
    AFTER UPDATE ON organizations
    FOR EACH ROW
    BEGIN
        UPDATE organizations SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_users_updated_at
    AFTER UPDATE ON users
    FOR EACH ROW
    BEGIN
        UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_ai_sessions_last_activity
    AFTER UPDATE ON ai_sessions
    FOR EACH ROW
    BEGIN
        UPDATE ai_sessions SET last_activity = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_knowledge_base_updated_at
    AFTER UPDATE ON knowledge_base
    FOR EACH ROW
    BEGIN
        UPDATE knowledge_base SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;