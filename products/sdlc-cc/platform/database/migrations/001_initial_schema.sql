-- SDLC.ai D1 Database Schema
-- Initial migration for production database

-- Tenants table
CREATE TABLE IF NOT EXISTS tenants (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    active INTEGER DEFAULT 1,
    plan TEXT DEFAULT 'free',
    created_at TEXT NOT NULL,
    updated_at TEXT
);

CREATE INDEX idx_tenants_email ON tenants(email);
CREATE INDEX idx_tenants_active ON tenants(active);

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    email TEXT NOT NULL,
    name TEXT,
    role TEXT DEFAULT 'user',
    active INTEGER DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_users_email ON users(email);

-- API Keys table
CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    key_hash TEXT NOT NULL UNIQUE,
    name TEXT,
    scopes TEXT,
    active INTEGER DEFAULT 1,
    expires_at TEXT,
    created_at TEXT NOT NULL,
    last_used_at TEXT,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE INDEX idx_api_keys_tenant ON api_keys(tenant_id);
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);

-- Documents table
CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    key TEXT NOT NULL,
    size INTEGER,
    mime_type TEXT,
    status TEXT DEFAULT 'pending',
    uploaded_at TEXT NOT NULL,
    processed_at TEXT,
    metadata TEXT,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE INDEX idx_documents_tenant ON documents(tenant_id);
CREATE INDEX idx_documents_status ON documents(status);

-- Document chunks table (for RAG)
CREATE TABLE IF NOT EXISTS document_chunks (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    embedding_id TEXT,
    metadata TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (document_id) REFERENCES documents(id)
);

CREATE INDEX idx_chunks_document ON document_chunks(document_id);

-- Policies table
CREATE TABLE IF NOT EXISTS policies (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    policy_type TEXT NOT NULL,
    rules TEXT NOT NULL,
    active INTEGER DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE INDEX idx_policies_tenant ON policies(tenant_id);
CREATE INDEX idx_policies_type ON policies(policy_type);

-- Audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    user_id TEXT,
    action TEXT NOT NULL,
    resource_type TEXT,
    resource_id TEXT,
    details TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_audit_tenant ON audit_logs(tenant_id);
CREATE INDEX idx_audit_created ON audit_logs(created_at);
CREATE INDEX idx_audit_action ON audit_logs(action);

-- Usage metrics table
CREATE TABLE IF NOT EXISTS usage_metrics (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    metric_type TEXT NOT NULL,
    value REAL NOT NULL,
    metadata TEXT,
    recorded_at TEXT NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE INDEX idx_metrics_tenant ON usage_metrics(tenant_id);
CREATE INDEX idx_metrics_type ON usage_metrics(metric_type);
CREATE INDEX idx_metrics_recorded ON usage_metrics(recorded_at);

-- LLM requests table
CREATE TABLE IF NOT EXISTS llm_requests (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    user_id TEXT,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    prompt_tokens INTEGER,
    completion_tokens INTEGER,
    total_tokens INTEGER,
    cost REAL,
    latency_ms INTEGER,
    status TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_llm_tenant ON llm_requests(tenant_id);
CREATE INDEX idx_llm_created ON llm_requests(created_at);

-- Insert default tenant for testing
INSERT INTO tenants (id, name, email, created_at)
VALUES ('default-tenant', 'Default Tenant', 'admin@sdlc.cc', NOW())
ON CONFLICT (id) DO NOTHING;
