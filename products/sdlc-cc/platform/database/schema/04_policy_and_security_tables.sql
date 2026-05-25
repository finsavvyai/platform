-- Policy and Security Tables
-- OPA policies, DLP scanning, audit logs, and compliance tracking

-- Policies table - Store OPA policies
CREATE TABLE policies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type policy_type NOT NULL,
    rego_policy TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 100, -- Lower number = higher priority
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES users(id),
    metadata JSONB NOT NULL DEFAULT '{}',
    test_cases JSONB NOT NULL DEFAULT '[]', -- Array of test cases for validation
    dependencies JSONB NOT NULL DEFAULT '[]', -- Array of policy dependencies
    tags JSONB NOT NULL DEFAULT '[]'
);

-- Policy Evaluations table - Audit log for policy decisions
CREATE TABLE policy_evaluations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    policy_id UUID REFERENCES policies(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    request_id UUID NOT NULL,
    decision BOOLEAN NOT NULL,
    reason TEXT,
    input_data JSONB NOT NULL,
    output_data JSONB NOT NULL,
    execution_time_ms INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT,
    resource_type VARCHAR(100),
    resource_id UUID,
    metadata JSONB NOT NULL DEFAULT '{}'
);

-- DLP Scans table - Track DLP scanning results
CREATE TABLE dlp_scans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    content_id UUID NOT NULL,
    content_type VARCHAR(100) NOT NULL,
    scan_results JSONB NOT NULL, -- Detailed PII findings
    risk_score DECIMAL(3, 2) NOT NULL CHECK (risk_score >= 0 AND risk_score <= 1),
    action_taken VARCHAR(100) NOT NULL, -- 'allowed', 'blocked', 'redacted', 'flagged'
    scan_duration_ms INTEGER NOT NULL,
    scan_model VARCHAR(100) NOT NULL,
    scan_version VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_by UUID REFERENCES users(id),
    review_decision VARCHAR(100),
    review_notes TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'
);

-- Audit Logs table - Comprehensive audit trail
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action audit_action NOT NULL,
    resource_type VARCHAR(100) NOT NULL,
    resource_id UUID,
    details JSONB NOT NULL DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    session_id UUID REFERENCES user_sessions(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    request_id UUID,
    response_status INTEGER,
    processing_time_ms INTEGER,
    metadata JSONB NOT NULL DEFAULT '{}',
    compliance_tags JSONB NOT NULL DEFAULT '[]' -- GDPR, HIPAA, etc.
);

-- Token Usage Tracking table - LLM token usage and costs
CREATE TABLE token_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    api_key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL,
    provider VARCHAR(100) NOT NULL, -- 'openai', 'anthropic', 'cohere', etc.
    model VARCHAR(100) NOT NULL,
    tokens_used INTEGER NOT NULL CHECK (tokens_used > 0),
    input_tokens INTEGER,
    output_tokens INTEGER,
    cost_usd DECIMAL(10, 6) NOT NULL CHECK (cost_usd >= 0),
    request_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processing_time_ms INTEGER,
    response_length INTEGER,
    metadata JSONB NOT NULL DEFAULT '{}'
);

-- Document Processing Jobs table - Track async processing
CREATE TABLE document_processing_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    job_type VARCHAR(100) NOT NULL, -- 'text_extraction', 'embedding', 'dlp_scan'
    status document_status NOT NULL DEFAULT 'pending',
    progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    error_message TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    worker_id VARCHAR(255),
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    metadata JSONB NOT NULL DEFAULT '{}',
    result JSONB NOT NULL DEFAULT '{}'
);

-- Vector Search Logs table - Track search queries
CREATE TABLE vector_search_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    query_text TEXT NOT NULL,
    query_vector_model VARCHAR(100),
    search_type VARCHAR(100) NOT NULL, -- 'semantic', 'keyword', 'hybrid'
    filters_applied JSONB NOT NULL DEFAULT '{}',
    results_count INTEGER NOT NULL,
    search_duration_ms INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    request_id UUID,
    metadata JSONB NOT NULL DEFAULT '{}'
);

-- Embedding Jobs table - Track embedding generation
CREATE TABLE embedding_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chunk_id UUID NOT NULL REFERENCES document_chunks(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    status document_status NOT NULL DEFAULT 'pending',
    model_name VARCHAR(100) NOT NULL,
    provider VARCHAR(100) NOT NULL,
    token_count INTEGER,
    cost_usd DECIMAL(10, 6),
    error_message TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    metadata JSONB NOT NULL DEFAULT '{}'
);

-- Document Access Log table - Track document access
CREATE TABLE document_access_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    api_key_id UUID REFERENCES api_keys(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    access_reason TEXT,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    request_id UUID,
    processing_time_ms INTEGER,
    metadata JSONB NOT NULL DEFAULT '{}'
);

-- Create indexes for performance
CREATE INDEX idx_policies_tenant_id ON policies(tenant_id);
CREATE INDEX idx_policies_type ON policies(type);
CREATE INDEX idx_policies_is_active ON policies(is_active);
CREATE INDEX idx_policies_priority ON policies(priority);
CREATE INDEX idx_policies_version ON policies(version);
CREATE INDEX idx_policies_created_at ON policies(created_at);

CREATE INDEX idx_policy_evaluations_tenant_id ON policy_evaluations(tenant_id);
CREATE INDEX idx_policy_evaluations_policy_id ON policy_evaluations(policy_id);
CREATE INDEX idx_policy_evaluations_user_id ON policy_evaluations(user_id);
CREATE INDEX idx_policy_evaluations_decision ON policy_evaluations(decision);
CREATE INDEX idx_policy_evaluations_created_at ON policy_evaluations(created_at);
CREATE INDEX idx_policy_evaluations_request_id ON policy_evaluations(request_id);

CREATE INDEX idx_dlp_scans_tenant_id ON dlp_scans(tenant_id);
CREATE INDEX idx_dlp_scans_content_id ON dlp_scans(content_id);
CREATE INDEX idx_dlp_scans_content_type ON dlp_scans(content_type);
CREATE INDEX idx_dlp_scans_risk_score ON dlp_scans(risk_score);
CREATE INDEX idx_dlp_scans_action_taken ON dlp_scans(action_taken);
CREATE INDEX idx_dlp_scans_created_at ON dlp_scans(created_at);

CREATE INDEX idx_audit_logs_tenant_id ON audit_logs(tenant_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_resource_type ON audit_logs(resource_type);
CREATE INDEX idx_audit_logs_resource_id ON audit_logs(resource_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_request_id ON audit_logs(request_id);

CREATE INDEX idx_token_usage_tenant_id ON token_usage(tenant_id);
CREATE INDEX idx_token_usage_user_id ON token_usage(user_id);
CREATE INDEX idx_token_usage_api_key_id ON token_usage(api_key_id);
CREATE INDEX idx_token_usage_provider ON token_usage(provider);
CREATE INDEX idx_token_usage_model ON token_usage(model);
CREATE INDEX idx_token_usage_created_at ON token_usage(created_at);
CREATE INDEX idx_token_usage_request_id ON token_usage(request_id);

CREATE INDEX idx_document_processing_jobs_document_id ON document_processing_jobs(document_id);
CREATE INDEX idx_document_processing_jobs_tenant_id ON document_processing_jobs(tenant_id);
CREATE INDEX idx_document_processing_jobs_status ON document_processing_jobs(status);
CREATE INDEX idx_document_processing_jobs_job_type ON document_processing_jobs(job_type);
CREATE INDEX idx_document_processing_jobs_created_at ON document_processing_jobs(created_at);

CREATE INDEX idx_vector_search_logs_tenant_id ON vector_search_logs(tenant_id);
CREATE INDEX idx_vector_search_logs_user_id ON vector_search_logs(user_id);
CREATE INDEX idx_vector_search_logs_search_type ON vector_search_logs(search_type);
CREATE INDEX idx_vector_search_logs_created_at ON vector_search_logs(created_at);
CREATE INDEX idx_vector_search_logs_request_id ON vector_search_logs(request_id);

CREATE INDEX idx_embedding_jobs_chunk_id ON embedding_jobs(chunk_id);
CREATE INDEX idx_embedding_jobs_tenant_id ON embedding_jobs(tenant_id);
CREATE INDEX idx_embedding_jobs_status ON embedding_jobs(status);
CREATE INDEX idx_embedding_jobs_model_name ON embedding_jobs(model_name);
CREATE INDEX idx_embedding_jobs_provider ON embedding_jobs(provider);
CREATE INDEX idx_embedding_jobs_created_at ON embedding_jobs(created_at);

CREATE INDEX idx_document_access_log_document_id ON document_access_log(document_id);
CREATE INDEX idx_document_access_log_tenant_id ON document_access_log(tenant_id);
CREATE INDEX idx_document_access_log_user_id ON document_access_log(user_id);
CREATE INDEX idx_document_access_log_action ON document_access_log(action);
CREATE INDEX idx_document_access_log_created_at ON document_access_log(created_at);
CREATE INDEX idx_document_access_log_request_id ON document_access_log(request_id);

-- Create unique constraints
ALTER TABLE policies ADD CONSTRAINT chk_policy_priority CHECK (priority >= 0);
ALTER TABLE policies ADD CONSTRAINT chk_policy_version CHECK (version > 0);
ALTER TABLE policy_evaluations ADD CONSTRAINT chk_execution_time CHECK (execution_time_ms >= 0);
ALTER TABLE token_usage ADD CONSTRAINT chk_tokens_positive CHECK (tokens_used > 0);
ALTER TABLE token_usage ADD CONSTRAINT chk_input_tokens CHECK (input_tokens IS NULL OR input_tokens >= 0);
ALTER TABLE token_usage ADD CONSTRAINT chk_output_tokens CHECK (output_tokens IS NULL OR output_tokens >= 0);
ALTER TABLE document_processing_jobs ADD CONSTRAINT chk_progress_range CHECK (progress >= 0 AND progress <= 100);
ALTER TABLE document_processing_jobs ADD CONSTRAINT chk_retry_count CHECK (retry_count >= 0);
ALTER TABLE vector_search_logs ADD CONSTRAINT chk_results_count CHECK (results_count >= 0);
ALTER TABLE vector_search_logs ADD CONSTRAINT chk_search_duration CHECK (search_duration_ms >= 0);
ALTER TABLE embedding_jobs ADD CONSTRAINT chk_embedding_retry_count CHECK (retry_count >= 0);
