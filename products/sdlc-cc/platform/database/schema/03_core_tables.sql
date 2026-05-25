-- Core Tables Schema
-- Multi-tenant architecture with proper isolation and security

-- Tenants table - Multi-tenant support
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
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB NOT NULL DEFAULT '{}',
    retention_policy JSONB NOT NULL DEFAULT '{"documents": 2555, "audit_logs": 365, "sessions": 30}', -- days
    resource_limits JSONB NOT NULL DEFAULT '{"users": 10, "documents": 1000, "storage_gb": 10, "tokens_per_month": 100000}',
    compliance_requirements JSONB NOT NULL DEFAULT '[]' -- Array of compliance frameworks
);

-- Users table - User management with tenant isolation
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    encrypted_password BYTEA NOT NULL,
    password_hash VARCHAR(255) NOT NULL, -- bcrypt hash
    role user_role NOT NULL DEFAULT 'user',
    permissions JSONB NOT NULL DEFAULT '[]',
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_login TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    mfa_enabled BOOLEAN DEFAULT false,
    mfa_secret BYTEA,
    email_verified BOOLEAN DEFAULT false,
    phone_number VARCHAR(20),
    phone_verified BOOLEAN DEFAULT false,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMPTZ,
    profile JSONB NOT NULL DEFAULT '{}', -- user profile information
    preferences JSONB NOT NULL DEFAULT '{}', -- user preferences
    UNIQUE(tenant_id, email)
);

-- API Keys table - Service-to-service authentication
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    key_hash VARCHAR(255) UNIQUE NOT NULL, -- SHA-256 hash of the key
    key_prefix VARCHAR(20) NOT NULL, -- First few characters for identification
    permissions JSONB NOT NULL DEFAULT '{}',
    rate_limit INTEGER NOT NULL DEFAULT 1000,
    rate_window INTEGER NOT NULL DEFAULT 3600, -- seconds
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES users(id),
    last_used TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    metadata JSONB NOT NULL DEFAULT '{}',
    usage_count INTEGER DEFAULT 0,
    last_ip_address INET
);

-- User Sessions table - Active session tracking
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    refresh_token VARCHAR(255) UNIQUE,
    ip_address INET,
    user_agent TEXT,
    device_fingerprint VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    last_activity TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    metadata JSONB NOT NULL DEFAULT '{}',
    security_flags JSONB NOT NULL DEFAULT '{}'
);

-- Documents table - Document metadata and storage information
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    filename VARCHAR(1000) NOT NULL,
    original_filename VARCHAR(1000) NOT NULL,
    content_type VARCHAR(255) NOT NULL,
    file_size BIGINT NOT NULL,
    checksum VARCHAR(64) NOT NULL, -- SHA-256
    storage_path VARCHAR(1000) NOT NULL,
    storage_bucket VARCHAR(255) NOT NULL,
    storage_provider VARCHAR(50) NOT NULL DEFAULT 'r2',
    metadata JSONB NOT NULL DEFAULT '{}',
    extraction_status document_status NOT NULL DEFAULT 'pending',
    processing_status document_status NOT NULL DEFAULT 'pending',
    dlp_status document_status NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES users(id),
    encryption_key_id VARCHAR(255),
    encryption_algorithm encryption_algorithm DEFAULT 'aes-256-gcm',
    retention_policy JSONB NOT NULL DEFAULT '{}',
    access_level VARCHAR(50) NOT NULL DEFAULT 'private',
    tags JSONB NOT NULL DEFAULT '[]',
    classification data_classification NOT NULL DEFAULT 'internal',
    content_hash VARCHAR(64), -- Hash of extracted content
    language VARCHAR(10) DEFAULT 'en',
    processing_duration_ms INTEGER
);

-- Document Chunks table - Text chunks for RAG
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
    embedding VECTOR(1536), -- Using OpenAI's embedding dimensions
    embedding_status document_status NOT NULL DEFAULT 'pending',
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    processing_time_ms INTEGER,
    checksum VARCHAR(64) NOT NULL,
    token_count INTEGER,
    source_page_number INTEGER,
    source_section VARCHAR(255),
    language VARCHAR(10) DEFAULT 'en'
);

-- Create indexes for performance
CREATE INDEX idx_tenants_domain ON tenants(domain);
CREATE INDEX idx_tenants_status ON tenants(status);
CREATE INDEX idx_tenants_subscription_tier ON tenants(subscription_tier);
CREATE INDEX idx_tenants_created_at ON tenants(created_at);

CREATE INDEX idx_users_tenant_id ON users(tenant_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_tenant_email ON users(tenant_id, email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_is_active ON users(is_active);
CREATE INDEX idx_users_created_at ON users(created_at);
CREATE INDEX idx_users_last_login ON users(last_login);

CREATE INDEX idx_api_keys_tenant_id ON api_keys(tenant_id);
CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_key_prefix ON api_keys(key_prefix);
CREATE INDEX idx_api_keys_is_active ON api_keys(is_active);
CREATE INDEX idx_api_keys_expires_at ON api_keys(expires_at);

CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_tenant_id ON user_sessions(tenant_id);
CREATE INDEX idx_user_sessions_session_token ON user_sessions(session_token);
CREATE INDEX idx_user_sessions_expires_at ON user_sessions(expires_at);
CREATE INDEX idx_user_sessions_is_active ON user_sessions(is_active);

CREATE INDEX idx_documents_tenant_id ON documents(tenant_id);
CREATE INDEX idx_documents_created_by ON documents(created_by);
CREATE INDEX idx_documents_content_type ON documents(content_type);
CREATE INDEX idx_documents_extraction_status ON documents(extraction_status);
CREATE INDEX idx_documents_processing_status ON documents(processing_status);
CREATE INDEX idx_documents_dlp_status ON documents(dlp_status);
CREATE INDEX idx_documents_created_at ON documents(created_at);
CREATE INDEX idx_documents_classification ON documents(classification);
CREATE INDEX idx_documents_access_level ON documents(access_level);
CREATE INDEX idx_documents_checksum ON documents(checksum);
CREATE INDEX idx_documents_content_hash ON documents(content_hash);

CREATE INDEX idx_document_chunks_document_id ON document_chunks(document_id);
CREATE INDEX idx_document_chunks_tenant_id ON document_chunks(tenant_id);
CREATE INDEX idx_document_chunks_chunk_index ON document_chunks(document_id, chunk_index);
CREATE INDEX idx_document_chunks_embedding ON document_chunks USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
CREATE INDEX idx_document_chunks_embedding_status ON document_chunks(embedding_status);
CREATE INDEX idx_document_chunks_created_at ON document_chunks(created_at);
CREATE INDEX idx_document_chunks_token_count ON document_chunks(token_count);

-- Create unique constraints
ALTER TABLE tenants ADD CONSTRAINT chk_tenant_status CHECK (status IN ('active', 'suspended', 'trial', 'deleted'));
ALTER TABLE users ADD CONSTRAINT chk_user_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');
ALTER TABLE users ADD CONSTRAINT chk_role CHECK (role IN ('super_admin', 'tenant_admin', 'data_scientist', 'analyst', 'viewer', 'user'));
ALTER TABLE users ADD CONSTRAINT chk_failed_attempts CHECK (failed_login_attempts >= 0);
ALTER TABLE documents ADD CONSTRAINT chk_file_size CHECK (file_size > 0);
ALTER TABLE documents ADD CONSTRAINT chk_chunk_index CHECK (chunk_index >= 0);
ALTER TABLE document_chunks ADD CONSTRAINT chk_content_length CHECK (content_length > 0);
