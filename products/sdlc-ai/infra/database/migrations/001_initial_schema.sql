-- SDLC.ai Platform - Initial Database Schema
-- Version: 3.0.0
-- Created: 2024-01-15
-- Description: Core schema for multi-tenant AI platform

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS "btree_gin" WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS "btree_gist" WITH SCHEMA public;

-- Create custom types
CREATE TYPE tenant_status AS ENUM ('active', 'inactive', 'suspended', 'deleted');
CREATE TYPE user_role AS ENUM ('admin', 'user', 'viewer', 'analyst');
CREATE TYPE user_status AS ENUM ('active', 'inactive', 'suspended', 'pending');
CREATE TYPE document_status AS ENUM ('draft', 'processing', 'processed', 'failed', 'archived');
CREATE TYPE document_type AS ENUM ('pdf', 'docx', 'txt', 'csv', 'xlsx', 'pptx', 'image', 'other');
CREATE TYPE rag_status AS ENUM ('pending', 'processing', 'completed', 'failed');
CREATE TYPE embedding_model AS ENUM ('text-embedding-ada-002', 'text-embedding-3-small', 'text-embedding-3-large');
CREATE TYPE llm_provider AS ENUM ('openai', 'anthropic', 'google', 'azure');
CREATE type audit_action AS ENUM ('create', 'read', 'update', 'delete', 'login', 'logout', 'download', 'upload');
CREATE type dlp_status AS ENUM ('scanning', 'passed', 'failed', 'quarantined');
CREATE type retention_policy AS ENUM ('standard', 'compliance', 'custom');

-- Core schema
-- Tenants table
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    domain VARCHAR(255),
    status tenant_status NOT NULL DEFAULT 'active',
    settings JSONB NOT NULL DEFAULT '{}',
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,

    CONSTRAINT tenants_name_check CHECK (length(name) >= 2),
    CONSTRAINT tenants_slug_check CHECK (slug ~ '^[a-z0-9-]+$'),
    CONSTRAINT tenants_domain_check CHECK (domain IS NULL OR domain ~ '^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')
);

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    username VARCHAR(100),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    role user_role NOT NULL DEFAULT 'user',
    status user_status NOT NULL DEFAULT 'active',
    mfa_enabled BOOLEAN NOT NULL DEFAULT false,
    mfa_secret VARCHAR(32),
    phone VARCHAR(20),
    avatar_url TEXT,
    preferences JSONB NOT NULL DEFAULT '{}',
    metadata JSONB NOT NULL DEFAULT '{}',
    last_login_at TIMESTAMP WITH TIME ZONE,
    email_verified_at TIMESTAMP WITH TIME ZONE,
    phone_verified_at TIMESTAMP WITH TIME ZONE,
    password_hash VARCHAR(255),
    salt VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,

    CONSTRAINT users_email_unique UNIQUE (email),
    CONSTRAINT users_username_unique UNIQUE (username),
    CONSTRAINT users_email_check CHECK (email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    CONSTRAINT users_role_check CHECK (role IN ('admin', 'user', 'viewer', 'analyst'))
);

-- User sessions table
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    refresh_token_hash VARCHAR(255),
    ip_address INET NOT NULL,
    user_agent TEXT,
    device_info JSONB NOT NULL DEFAULT '{}',
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMP WITH TIME ZONE,

    CONSTRAINT sessions_token_hash_not_empty CHECK (length(token_hash) > 0)
);

-- Documents table
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    file_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    file_hash VARCHAR(64) NOT NULL,
    mime_type VARCHAR(100),
    document_type document_type NOT NULL,
    status document_status NOT NULL DEFAULT 'draft',
    processing_status JSONB NOT NULL DEFAULT '{}',
    metadata JSONB NOT NULL DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    classification VARCHAR(50),
    retention_policy retention_policy DEFAULT 'standard',
    retention_until TIMESTAMP WITH TIME ZONE,
    version INTEGER NOT NULL DEFAULT 1,
    parent_id UUID REFERENCES documents(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,

    CONSTRAINT documents_name_check CHECK (length(name) >= 1),
    CONSTRAINT documents_file_size_check CHECK (file_size >= 0),
    CONSTRAINT documents_version_check CHECK (version > 0)
);

-- Document chunks table (for RAG)
CREATE TABLE document_chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    CONSTRAINT chunks_unique_document_chunk UNIQUE (document_id, chunk_index),
    CONSTRAINT chunks_index_check CHECK (chunk_index >= 0)
);

-- Vector embeddings table
CREATE TABLE vector_embeddings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_chunk_id UUID NOT NULL REFERENCES document_chunks(id) ON DELETE CASCADE,
    embedding_model embedding_model NOT NULL,
    dimensions INTEGER NOT NULL,
    embedding VECTOR(1536) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    CONSTRAINT embeddings_unique_chunk_model UNIQUE (document_chunk_id, embedding_model),
    CONSTRAINT embeddings_dimensions_check CHECK (dimensions = 1536)
);

-- RAG conversations table
CREATE TABLE rag_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255),
    status rag_status NOT NULL DEFAULT 'pending',
    context JSONB NOT NULL DEFAULT '{}',
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE
);

-- RAG messages table
CREATE TABLE rag_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES rag_conversations(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    token_count INTEGER,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- RAG context items table
CREATE TABLE rag_context_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES rag_conversations(id) ON DELETE CASCADE,
    message_id UUID REFERENCES rag_messages(id) ON DELETE CASCADE,
    document_chunk_id UUID NOT NULL REFERENCES document_chunks(id) ON DELETE CASCADE,
    similarity_score FLOAT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    CONSTRAINT context_items_score_check CHECK (similarity_score >= 0 AND similarity_score <= 1)
);

-- API keys table
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    key_hash VARCHAR(255) NOT NULL UNIQUE,
    key_prefix VARCHAR(10) NOT NULL,
    permissions JSONB NOT NULL DEFAULT '{}',
    rate_limit INTEGER DEFAULT 1000,
    last_used_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,

    CONSTRAINT api_keys_name_check CHECK (length(name) >= 1),
    CONSTRAINT api_keys_rate_limit_check CHECK (rate_limit > 0)
);

-- Webhooks table
CREATE TABLE webhooks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    url TEXT NOT NULL,
    secret VARCHAR(255),
    events TEXT[] NOT NULL DEFAULT '{}',
    active BOOLEAN NOT NULL DEFAULT true,
    retry_count INTEGER DEFAULT 3,
    timeout INTEGER DEFAULT 30,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,

    CONSTRAINT webhooks_name_check CHECK (length(name) >= 1),
    CONSTRAINT webhooks_url_check CHECK (url ~ '^https?://.*'),
    CONSTRAINT webhooks_events_check CHECK (array_length(events, 1) > 0),
    CONSTRAINT webhooks_retry_check CHECK (retry_count >= 0),
    CONSTRAINT webhooks_timeout_check CHECK (timeout > 0)
);

-- Webhook deliveries table
CREATE TABLE webhook_deliveries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    response_code INTEGER,
    response_body TEXT,
    delivered_at TIMESTAMP WITH TIME ZONE,
    next_retry_at TIMESTAMP WITH TIME ZONE,
    retry_count INTEGER DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    CONSTRAINT webhook_deliveries_status_check CHECK (status IN ('pending', 'delivered', 'failed', 'retrying')),
    CONSTRAINT webhook_deliveries_retry_check CHECK (retry_count >= 0)
);

-- DLP scans table
CREATE TABLE dlp_scans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    status dlp_status NOT NULL DEFAULT 'scanning',
    findings JSONB NOT NULL DEFAULT '[]',
    risk_score INTEGER DEFAULT 0,
    scan_result JSONB NOT NULL DEFAULT '{}',
    scanned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    CONSTRAINT dlp_scans_risk_score_check CHECK (risk_score >= 0 AND risk_score <= 100)
);

-- Audit log table
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action audit_action NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    CONSTRAINT audit_logs_action_check CHECK (action IN ('create', 'read', 'update', 'delete', 'login', 'logout', 'download', 'upload'))
);

-- System metrics table
CREATE TABLE system_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    metric_name VARCHAR(100) NOT NULL,
    metric_value NUMERIC NOT NULL,
    labels JSONB NOT NULL DEFAULT '{}',
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    CONSTRAINT metrics_name_check CHECK (length(metric_name) >= 1)
);

-- Background jobs table
CREATE TABLE background_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    job_type VARCHAR(100) NOT NULL,
    job_data JSONB NOT NULL DEFAULT '{}',
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    priority INTEGER DEFAULT 0,
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    error_message TEXT,
    result JSONB,
    scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    CONSTRAINT background_jobs_status_check CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    CONSTRAINT background_jobs_priority_check CHECK (priority >= 0),
    CONSTRAINT background_jobs_attempts_check CHECK (attempts >= 0),
    CONSTRAINT background_jobs_max_attempts_check CHECK (max_attempts > 0)
);

-- Create indexes
-- Tenants
CREATE INDEX idx_tenants_status ON tenants(status);
CREATE INDEX idx_tenants_created_at ON tenants(created_at);

-- Users
CREATE INDEX idx_users_tenant_id ON users(tenant_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_created_at ON users(created_at);

-- User sessions
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_token_hash ON user_sessions(token_hash);
CREATE INDEX idx_user_sessions_expires_at ON user_sessions(expires_at);
CREATE INDEX idx_user_sessions_ip_address ON user_sessions(ip_address);

-- Documents
CREATE INDEX idx_documents_tenant_id ON documents(tenant_id);
CREATE INDEX idx_documents_user_id ON documents(user_id);
CREATE INDEX idx_documents_status ON documents(status);
CREATE INDEX idx_documents_type ON documents(document_type);
CREATE INDEX idx_documents_created_at ON documents(created_at);
CREATE INDEX idx_documents_file_hash ON documents(file_hash);
CREATE INDEX idx_documents_tags ON documents USING GIN(tags);
CREATE INDEX idx_documents_metadata ON documents USING GIN(metadata);
CREATE INDEX idx_documents_retention_until ON documents(retention_until) WHERE retention_until IS NOT NULL;

-- Document chunks
CREATE INDEX idx_document_chunks_document_id ON document_chunks(document_id);
CREATE INDEX idx_document_chunks_content_gin ON document_chunks USING GIN(to_tsvector('english', content));

-- Vector embeddings
CREATE INDEX idx_vector_embeddings_chunk_id ON vector_embeddings(document_chunk_id);
CREATE INDEX idx_vector_embeddings_model ON vector_embeddings(embedding_model);
CREATE INDEX idx_vector_embeddings_vector ON vector_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- RAG conversations
CREATE INDEX idx_rag_conversations_tenant_id ON rag_conversations(tenant_id);
CREATE INDEX idx_rag_conversations_user_id ON rag_conversations(user_id);
CREATE INDEX idx_rag_conversations_status ON rag_conversations(status);
CREATE INDEX idx_rag_conversations_created_at ON rag_conversations(created_at);

-- RAG messages
CREATE INDEX idx_rag_messages_conversation_id ON rag_messages(conversation_id);
CREATE INDEX idx_rag_messages_created_at ON rag_messages(created_at);

-- RAG context items
CREATE INDEX idx_rag_context_items_conversation_id ON rag_context_items(conversation_id);
CREATE INDEX idx_rag_context_items_chunk_id ON rag_context_items(document_chunk_id);
CREATE INDEX idx_rag_context_items_similarity ON rag_context_items(similarity_score);

-- API keys
CREATE INDEX idx_api_keys_tenant_id ON api_keys(tenant_id);
CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX idx_api_key_s_active ON api_keys(is_active);
CREATE INDEX idx_api_keys_expires_at ON api_keys(expires_at) WHERE expires_at IS NOT NULL;

-- Webhooks
CREATE INDEX idx_webhooks_tenant_id ON webhooks(tenant_id);
CREATE INDEX idx_webhooks_user_id ON webhooks(user_id);
CREATE INDEX idx_webhooks_active ON webhooks(active);
CREATE INDEX idx_webhooks_events ON webhooks USING GIN(events);

-- Webhook deliveries
CREATE INDEX idx_webhook_deliveries_webhook_id ON webhook_deliveries(webhook_id);
CREATE INDEX idx_webhook_deliveries_status ON webhook_deliveries(status);
CREATE INDEX idx_webhook_deliveries_next_retry ON webhook_deliveries(next_retry_at) WHERE next_retry_at IS NOT NULL;
CREATE INDEX idx_webhook_deliveries_created_at ON webhook_deliveries(created_at);

-- DLP scans
CREATE INDEX idx_dlp_scans_document_id ON dlp_scans(document_id);
CREATE INDEX idx_dlp_scans_status ON dlp_scans(status);
CREATE INDEX idx_dlp_scans_risk_score ON dlp_scans(risk_score);
CREATE INDEX idx_dlp_scans_scanned_at ON dlp_scans(scanned_at);

-- Audit logs
CREATE INDEX idx_audit_logs_tenant_id ON audit_logs(tenant_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_ip_address ON audit_logs(ip_address) WHERE ip_address IS NOT NULL;

-- System metrics
CREATE INDEX idx_system_metrics_name ON system_metrics(metric_name);
CREATE INDEX idx_system_metrics_timestamp ON system_metrics(timestamp);
CREATE INDEX idx_system_metrics_name_timestamp ON system_metrics(metric_name, timestamp);

-- Background jobs
CREATE INDEX idx_background_jobs_tenant_id ON background_jobs(tenant_id);
CREATE INDEX idx_background_jobs_status ON background_jobs(status);
CREATE INDEX idx_background_jobs_type ON background_jobs(job_type);
CREATE INDEX idx_background_jobs_priority ON background_jobs(priority DESC);
CREATE INDEX idx_background_jobs_scheduled_at ON background_jobs(scheduled_at);
CREATE INDEX idx_background_jobs_next_retry ON background_jobs(scheduled_at) WHERE status = 'failed';

-- Create trigger functions
-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rag_conversations_updated_at BEFORE UPDATE ON rag_conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_api_keys_updated_at BEFORE UPDATE ON api_keys
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_webhooks_updated_at BEFORE UPDATE ON webhooks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create audit trigger
CREATE OR REPLACE FUNCTION audit_trigger()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_logs (tenant_id, user_id, action, resource_type, resource_id, new_values)
        VALUES (
            COALESCE(NEW.tenant_id, (SELECT tenant_id FROM users WHERE id = NEW.user_id)),
            NEW.user_id,
            'create',
            TG_TABLE_NAME,
            NEW.id,
            row_to_json(NEW)
        );
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_logs (tenant_id, user_id, action, resource_type, resource_id, old_values, new_values)
        VALUES (
            COALESCE(NEW.tenant_id, OLD.tenant_id),
            NEW.user_id,
            'update',
            TG_TABLE_NAME,
            NEW.id,
            row_to_json(OLD),
            row_to_json(NEW)
        );
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit_logs (tenant_id, user_id, action, resource_type, resource_id, old_values)
        VALUES (
            OLD.tenant_id,
            OLD.user_id,
            'delete',
            TG_TABLE_NAME,
            OLD.id,
            row_to_json(OLD)
        );
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Apply audit triggers to key tables
CREATE TRIGGER audit_tenants AFTER INSERT OR UPDATE OR DELETE ON tenants
    FOR EACH ROW EXECUTE FUNCTION audit_trigger();

CREATE TRIGGER audit_users AFTER INSERT OR UPDATE OR DELETE ON users
    FOR EACH ROW EXECUTE FUNCTION audit_trigger();

CREATE TRIGGER audit_documents AFTER INSERT OR UPDATE OR DELETE ON documents
    FOR EACH ROW EXECUTE FUNCTION audit_trigger();

CREATE TRIGGER audit_api_keys AFTER INSERT OR UPDATE OR DELETE ON api_keys
    FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- Create RLS policies
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE rag_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE rag_messages ENABLE ROW LEVEL SECURITY;

-- Tenants RLS policies
CREATE POLICY tenant_isolation ON tenants
    FOR ALL TO authenticated_user
    USING (id = current_setting('app.current_tenant_id')::uuid);

-- Users RLS policies
CREATE POLICY users_tenant_isolation ON users
    FOR ALL TO authenticated_user
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY users_self_access ON users
    FOR SELECT TO authenticated_user
    USING (id = current_setting('app.current_user_id')::uuid);

-- Documents RLS policies
CREATE POLICY documents_tenant_isolation ON documents
    FOR ALL TO authenticated_user
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- RAG conversations RLS policies
CREATE POLICY rag_conversations_tenant_isolation ON rag_conversations
    FOR ALL TO authenticated_user
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY rag_conversations_user_access ON rag_conversations
    FOR ALL TO authenticated_user
    USING (user_id = current_setting('app.current_user_id')::uuid);

-- Create views
-- Active tenants view
CREATE VIEW active_tenants AS
SELECT * FROM tenants
WHERE status = 'active' AND deleted_at IS NULL;

-- Active users view
CREATE VIEW active_users AS
SELECT u.*, t.name as tenant_name
FROM users u
JOIN tenants t ON u.tenant_id = t.id
WHERE u.status = 'active' AND u.deleted_at IS NULL
  AND t.status = 'active' AND t.deleted_at IS NULL;

-- Document statistics view
CREATE VIEW document_statistics AS
SELECT
    t.id as tenant_id,
    t.name as tenant_name,
    COUNT(d.id) as total_documents,
    COUNT(CASE WHEN d.status = 'processed' THEN 1 END) as processed_documents,
    SUM(d.file_size) as total_storage_bytes,
    AVG(d.file_size) as avg_file_size,
    COUNT(DISTINCT d.user_id) as unique_uploaders
FROM tenants t
LEFT JOIN documents d ON t.id = d.tenant_id AND d.deleted_at IS NULL
WHERE t.status = 'active' AND t.deleted_at IS NULL
GROUP BY t.id, t.name;

-- RAG statistics view
CREATE VIEW rag_statistics AS
SELECT
    t.id as tenant_id,
    t.name as tenant_name,
    COUNT(rc.id) as total_conversations,
    COUNT(DISTINCT rc.user_id) as unique_users,
    COUNT(rm.id) as total_messages,
    AVG(rm.token_count) as avg_tokens_per_message
FROM tenants t
LEFT JOIN rag_conversations rc ON t.id = rc.tenant_id
LEFT JOIN rag_messages rm ON rc.id = rm.conversation_id
WHERE t.status = 'active' AND t.deleted_at IS NULL
GROUP BY t.id, t.name;

-- Insert initial data
-- Create default admin user
INSERT INTO users (tenant_id, email, username, first_name, last_name, role, status, password_hash, salt)
SELECT
    id,
    'admin@sdlc.ai',
    'admin',
    'SDLC',
    'Admin',
    'admin',
    'active',
    crypt('admin123', gen_salt('bf')),
    gen_salt('bf')
FROM tenants
WHERE slug = 'default'
ON CONFLICT (email) DO NOTHING;

-- Create functions for common operations
-- Get tenant by slug
CREATE OR REPLACE FUNCTION get_tenant_by_slug(slug_param TEXT)
RETURNS TABLE(id UUID, name TEXT, status tenant_status) AS $$
BEGIN
    RETURN QUERY
    SELECT t.id, t.name, t.status
    FROM tenants t
    WHERE t.slug = slug_param AND t.deleted_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check user permissions
CREATE OR REPLACE FUNCTION check_user_permission(user_id_param UUID, permission_param TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    user_role users.role%TYPE;
    user_status users.status%TYPE;
    tenant_status tenants.status%TYPE;
BEGIN
    SELECT u.role, u.status, t.status
    INTO user_role, user_status, tenant_status
    FROM users u
    JOIN tenants t ON u.tenant_id = t.id
    WHERE u.id = user_id_param
      AND u.deleted_at IS NULL
      AND t.deleted_at IS NULL;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    IF user_status != 'active' OR tenant_status != 'active' THEN
        RETURN FALSE;
    END IF;

    -- Admin has all permissions
    IF user_role = 'admin' THEN
        RETURN TRUE;
    END IF;

    -- Check specific permissions based on role
    CASE permission_param
        WHEN 'read_documents' THEN RETURN user_role IN ('user', 'viewer', 'analyst');
        WHEN 'write_documents' THEN RETURN user_role IN ('user', 'analyst');
        WHEN 'delete_documents' THEN RETURN user_role = 'analyst';
        WHEN 'read_analytics' THEN RETURN user_role IN ('analyst', 'admin');
        WHEN 'manage_users' THEN RETURN user_role = 'admin';
        ELSE RETURN FALSE;
    END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Generate API key
CREATE OR REPLACE FUNCTION generate_api_key()
RETURNS TEXT AS $$
DECLARE
    key_prefix TEXT := 'sdlc_';
    key_body TEXT := encode(gen_random_bytes(32), 'hex');
BEGIN
    RETURN key_prefix || key_body;
END;
$$ LANGUAGE plpgsql;

-- Get document similarity search
CREATE OR REPLACE FUNCTION search_similar_documents(
    query_vector VECTOR(1536),
    tenant_uuid UUID DEFAULT NULL,
    limit_num INTEGER DEFAULT 10,
    threshold FLOAT DEFAULT 0.7
)
RETURNS TABLE(
    document_id UUID,
    document_name TEXT,
    chunk_content TEXT,
    similarity_score FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        d.id,
        d.name,
        dc.content,
        1 - (ve.embedding <=> query_vector) as similarity
    FROM documents d
    JOIN document_chunks dc ON d.id = dc.document_id
    JOIN vector_embeddings ve ON dc.id = ve.document_chunk_id
    WHERE (tenant_uuid IS NULL OR d.tenant_id = tenant_uuid)
      AND d.status = 'processed'
      AND d.deleted_at IS NULL
      AND 1 - (ve.embedding <=> query_vector) >= threshold
    ORDER BY similarity DESC
    LIMIT limit_num;
END;
$$ LANGUAGE plpgsql;

COMMIT;
