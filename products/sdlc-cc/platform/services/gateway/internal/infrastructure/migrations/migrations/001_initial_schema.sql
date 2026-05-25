-- 001_initial_schema.sql
-- Initial database schema for SDLC Platform
-- Creates all core tables

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS "vector";

-- Create custom types
CREATE TYPE tenant_status AS ENUM ('active', 'suspended', 'trial', 'deleted');
CREATE TYPE user_role AS ENUM ('super_admin', 'tenant_admin', 'data_scientist', 'analyst', 'viewer', 'user');
CREATE TYPE document_status AS ENUM ('pending', 'processing', 'completed', 'failed');
CREATE TYPE policy_type AS ENUM ('auth', 'data_access', 'dlp', 'cost', 'compliance');
CREATE TYPE encryption_algorithm AS ENUM ('aes-256-gcm', 'aes-256-cbc', 'chacha20-poly1305');
CREATE TYPE data_classification AS ENUM ('public', 'internal', 'confidential', 'restricted');
CREATE TYPE audit_action AS ENUM ('create', 'read', 'update', 'delete', 'login', 'logout', 'access_denied');

-- Tenants table
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255) UNIQUE NOT NULL,
    status tenant_status NOT NULL DEFAULT 'trial',
    config JSONB NOT NULL DEFAULT '{}',
    settings JSONB NOT NULL DEFAULT '{}',
    subscription_tier VARCHAR(50) NOT NULL DEFAULT 'basic',
    data_region VARCHAR(50) NOT NULL DEFAULT 'us-east-1',
    contact_email VARCHAR(255),
    billing_info JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB NOT NULL DEFAULT '{}',
    retention_policy JSONB NOT NULL DEFAULT '{}',
    resource_limits JSONB NOT NULL DEFAULT '{}',
    compliance_requirements JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX idx_tenants_domain ON tenants(domain);
CREATE INDEX idx_tenants_status ON tenants(status);
CREATE INDEX idx_tenants_subscription ON tenants(subscription_tier);

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'user',
    permissions JSONB NOT NULL DEFAULT '[]',
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT true,
    mfa_enabled BOOLEAN NOT NULL DEFAULT false,
    mfa_secret BYTEA,
    email_verified BOOLEAN NOT NULL DEFAULT false,
    phone_number VARCHAR(20),
    phone_verified BOOLEAN NOT NULL DEFAULT false,
    failed_login_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ,
    profile JSONB NOT NULL DEFAULT '{}',
    preferences JSONB NOT NULL DEFAULT '{}',
    UNIQUE(tenant_id, email)
);

CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- User sessions table
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ip_address VARCHAR(45),
    user_agent TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    metadata JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX idx_user_sessions_user ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_token ON user_sessions(token);
CREATE INDEX idx_user_sessions_expires ON user_sessions(expires_at);

-- Documents table
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    filename VARCHAR(1000) NOT NULL,
    original_filename VARCHAR(1000) NOT NULL,
    content_type VARCHAR(255) NOT NULL,
    file_size BIGINT NOT NULL,
    checksum VARCHAR(64) NOT NULL,
    storage_path VARCHAR(1000) NOT NULL,
    storage_bucket VARCHAR(255) NOT NULL,
    storage_provider VARCHAR(50) NOT NULL DEFAULT 'r2',
    metadata JSONB NOT NULL DEFAULT '{}',
    extraction_status document_status NOT NULL DEFAULT 'pending',
    processing_status document_status NOT NULL DEFAULT 'pending',
    dlp_status document_status NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    encryption_key_id VARCHAR(255),
    encryption_algorithm encryption_algorithm NOT NULL DEFAULT 'aes-256-gcm',
    retention_policy JSONB NOT NULL DEFAULT '{}',
    access_level VARCHAR(50) NOT NULL DEFAULT 'private',
    tags JSONB NOT NULL DEFAULT '[]',
    classification data_classification NOT NULL DEFAULT 'internal',
    content_hash VARCHAR(64),
    language VARCHAR(10) NOT NULL DEFAULT 'en',
    processing_duration_ms INTEGER
);

CREATE INDEX idx_documents_tenant ON documents(tenant_id);
CREATE INDEX idx_documents_created_by ON documents(created_by);
CREATE INDEX idx_documents_checksum ON documents(checksum);
CREATE INDEX idx_documents_status ON documents(processing_status);
CREATE INDEX idx_documents_classification ON documents(classification);

-- Document chunks table
CREATE TABLE document_chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    content_length INTEGER NOT NULL,
    chunk_type VARCHAR(50) NOT NULL DEFAULT 'text',
    embedding_model VARCHAR(100),
    embedding_dimensions INTEGER,
    embedding vector(1536),
    embedding_status document_status NOT NULL DEFAULT 'pending',
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processing_time_ms INTEGER,
    checksum VARCHAR(64) NOT NULL,
    token_count INTEGER,
    source_page_number INTEGER,
    source_section VARCHAR(255),
    language VARCHAR(10) NOT NULL DEFAULT 'en'
);

CREATE INDEX idx_document_chunks_document ON document_chunks(document_id);
CREATE INDEX idx_document_chunks_tenant ON document_chunks(tenant_id);
CREATE INDEX idx_document_chunks_embedding_status ON document_chunks(embedding_status);

-- Document processing jobs table
CREATE TABLE document_processing_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    job_type VARCHAR(100) NOT NULL,
    status document_status NOT NULL,
    progress INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 3,
    metadata JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX idx_doc_processing_jobs_document ON document_processing_jobs(document_id);
CREATE INDEX idx_doc_processing_jobs_status ON document_processing_jobs(status);

-- Embedding jobs table
CREATE TABLE embedding_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chunk_id UUID NOT NULL REFERENCES document_chunks(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    model VARCHAR(100) NOT NULL,
    status document_status NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 3,
    duration_ms INTEGER,
    tokens_used INTEGER,
    cost_usd DECIMAL(10,4),
    metadata JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX idx_embedding_jobs_chunk ON embedding_jobs(chunk_id);
CREATE INDEX idx_embedding_jobs_status ON embedding_jobs(status);

-- Policies table
CREATE TABLE policies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type policy_type NOT NULL,
    rego_policy TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT true,
    priority INTEGER NOT NULL DEFAULT 100,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    metadata JSONB NOT NULL DEFAULT '{}',
    test_cases JSONB NOT NULL DEFAULT '[]',
    dependencies JSONB NOT NULL DEFAULT '[]',
    tags JSONB NOT NULL DEFAULT '[]',
    UNIQUE(tenant_id, name)
);

CREATE INDEX idx_policies_tenant ON policies(tenant_id);
CREATE INDEX idx_policies_type ON policies(type);
CREATE INDEX idx_policies_active ON policies(is_active);

-- Policy evaluations table
CREATE TABLE policy_evaluations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    policy_id UUID NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    input JSONB NOT NULL,
    result BOOLEAN NOT NULL,
    explanation TEXT,
    duration_ms INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX idx_policy_evaluations_policy ON policy_evaluations(policy_id);
CREATE INDEX idx_policy_evaluations_user ON policy_evaluations(user_id);
CREATE INDEX idx_policy_evaluations_created ON policy_evaluations(created_at);

-- API keys table
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    key_hash VARCHAR(255) UNIQUE NOT NULL,
    key_prefix VARCHAR(20) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    expires_at TIMESTAMPTZ,
    last_used TIMESTAMPTZ,
    usage_count INTEGER NOT NULL DEFAULT 0,
    max_usage INTEGER,
    permissions JSONB NOT NULL DEFAULT '[]',
    rate_limit INTEGER NOT NULL DEFAULT 1000,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    metadata JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX idx_api_keys_tenant ON api_keys(tenant_id);
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_prefix ON api_keys(key_prefix);
CREATE INDEX idx_api_keys_active ON api_keys(is_active);

-- Token usage table
CREATE TABLE token_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    api_key_id UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    tokens_used INTEGER NOT NULL,
    cost_usd DECIMAL(10,4) NOT NULL,
    model VARCHAR(100) NOT NULL,
    operation VARCHAR(100) NOT NULL,
    duration_ms INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    request_id UUID,
    ip_address VARCHAR(45),
    user_agent TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX idx_token_usage_api_key ON token_usage(api_key_id);
CREATE INDEX idx_token_usage_tenant ON token_usage(tenant_id);
CREATE INDEX idx_token_usage_created ON token_usage(created_at);

-- Document access log table
CREATE TABLE document_access_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action audit_action NOT NULL,
    access_level VARCHAR(50) NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    success BOOLEAN NOT NULL DEFAULT true,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    request_id UUID,
    session_id UUID,
    metadata JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX idx_doc_access_log_document ON document_access_log(document_id);
CREATE INDEX idx_doc_access_log_user ON document_access_log(user_id);
CREATE INDEX idx_doc_access_log_created ON document_access_log(created_at);

-- Audit logs table
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action audit_action NOT NULL,
    resource_type VARCHAR(100) NOT NULL,
    resource_id UUID,
    details JSONB NOT NULL DEFAULT '{}',
    ip_address VARCHAR(45),
    user_agent TEXT,
    session_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    request_id UUID,
    response_status INTEGER,
    processing_time_ms INTEGER,
    metadata JSONB NOT NULL DEFAULT '{}',
    compliance_tags JSONB NOT NULL DEFAULT '[]'
);

CREATE INDEX idx_audit_logs_tenant ON audit_logs(tenant_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_document_chunks_updated_at BEFORE UPDATE ON document_chunks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_policies_updated_at BEFORE UPDATE ON policies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_api_keys_updated_at BEFORE UPDATE ON api_keys
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
