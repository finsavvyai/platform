-- Migration 003: Create Policy and Security Tables
-- Version: 1.0.0
-- Description: Create tables for OPA policies, DLP scanning, audit logs, and compliance tracking
-- Dependencies: 002_create_core_tables.sql
-- Rollback: Drop all policy and security tables
-- Tags: security,policy,audit,compliance

BEGIN;

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
    tags JSONB NOT NULL DEFAULT '[]',
    environment VARCHAR(50) DEFAULT 'production', -- 'development', 'staging', 'production'
    last_tested_at TIMESTAMPTZ,
    test_results JSONB NOT NULL DEFAULT '{}',
    deleted_at TIMESTAMPTZ,
    CONSTRAINT chk_policy_priority CHECK (priority >= 0),
    CONSTRAINT chk_policy_version CHECK (version > 0),
    CONSTRAINT uq_tenant_policy_name UNIQUE(tenant_id, name)
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
    metadata JSONB NOT NULL DEFAULT '{}',
    evaluation_context JSONB NOT NULL DEFAULT '{}', -- Additional context for the evaluation
    CONSTRAINT chk_execution_time_positive CHECK (execution_time_ms >= 0)
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
    metadata JSONB NOT NULL DEFAULT '{}',
    pii_entities JSONB NOT NULL DEFAULT '[]', -- Array of detected PII entities
    scan_confidence DECIMAL(3, 2), -- Confidence score of the scan
    CONSTRAINT chk_scan_duration_positive CHECK (scan_duration_ms >= 0),
    CONSTRAINT chk_scan_confidence_range CHECK (scan_confidence IS NULL OR (scan_confidence >= 0 AND scan_confidence <= 1))
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
    compliance_tags JSONB NOT NULL DEFAULT '[]', -- GDPR, HIPAA, etc.
    risk_level VARCHAR(20) DEFAULT 'low', -- 'low', 'medium', 'high', 'critical'
    correlation_id UUID, -- For tracking related operations
    CONSTRAINT chk_response_status_range CHECK (response_status IS NULL OR (response_status >= 100 AND response_status <= 599)),
    CONSTRAINT chk_processing_time_positive CHECK (processing_time_ms IS NULL OR processing_time_ms >= 0),
    CONSTRAINT chk_risk_level CHECK (risk_level IN ('low', 'medium', 'high', 'critical'))
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
    metadata JSONB NOT NULL DEFAULT '{}',
    request_type VARCHAR(50) DEFAULT 'completion', -- 'completion', 'embedding', 'chat', etc.
    temperature DECIMAL(3, 2),
    max_tokens INTEGER,
    cache_hit BOOLEAN DEFAULT false,
    CONSTRAINT chk_input_tokens_positive CHECK (input_tokens IS NULL OR input_tokens >= 0),
    CONSTRAINT chk_output_tokens_positive CHECK (output_tokens IS NULL OR output_tokens >= 0),
    CONSTRAINT chk_processing_time_positive CHECK (processing_time_ms IS NULL OR processing_time_ms >= 0),
    CONSTRAINT chk_temperature_range CHECK (temperature IS NULL OR (temperature >= 0 AND temperature <= 2)),
    CONSTRAINT chk_max_tokens_positive CHECK (max_tokens IS NULL OR max_tokens > 0)
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
    result JSONB NOT NULL DEFAULT '{}',
    priority INTEGER DEFAULT 100, -- Lower number = higher priority
    queue_name VARCHAR(100),
    CONSTRAINT chk_retry_count_positive CHECK (retry_count >= 0),
    CONSTRAINT chk_priority_positive CHECK (priority >= 0)
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
    metadata JSONB NOT NULL DEFAULT '{}',
    query_embedding VECTOR(1536), -- Store the actual query embedding
    similarity_threshold REAL,
    max_results INTEGER,
    search_strategy VARCHAR(50), -- 'hnsw', 'ivfflat', 'brute_force'
    cache_hit BOOLEAN DEFAULT false,
    CONSTRAINT chk_results_count_positive CHECK (results_count >= 0),
    CONSTRAINT chk_search_duration_positive CHECK (search_duration_ms >= 0),
    CONSTRAINT chk_similarity_threshold_range CHECK (similarity_threshold IS NULL OR (similarity_threshold >= 0 AND similarity_threshold <= 1)),
    CONSTRAINT chk_max_results_positive CHECK (max_results IS NULL OR max_results > 0)
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
    metadata JSONB NOT NULL DEFAULT '{}',
    batch_id UUID, -- For batch processing
    batch_size INTEGER,
    CONSTRAINT chk_token_count_positive CHECK (token_count IS NULL OR token_count >= 0),
    CONSTRAINT chk_cost_positive CHECK (cost_usd IS NULL OR cost_usd >= 0),
    CONSTRAINT chk_retry_count_positive CHECK (retry_count >= 0),
    CONSTRAINT chk_batch_size_positive CHECK (batch_size IS NULL OR batch_size > 0)
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
    metadata JSONB NOT NULL DEFAULT '{}',
    access_granted BOOLEAN DEFAULT true,
    denial_reason VARCHAR(255),
    CONSTRAINT chk_processing_time_positive CHECK (processing_time_ms IS NULL OR processing_time_ms >= 0)
);

-- Compliance Reports table - Track compliance activities
CREATE TABLE compliance_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    report_type VARCHAR(100) NOT NULL, -- 'gdpr', 'hipaa', 'sox', 'pci_dss'
    report_period_start TIMESTAMPTZ NOT NULL,
    report_period_end TIMESTAMPTZ NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'failed'
    report_data JSONB NOT NULL DEFAULT '{}',
    findings JSONB NOT NULL DEFAULT '[]',
    recommendations JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    generated_by UUID REFERENCES users(id),
    reviewed_by UUID REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    file_path VARCHAR(1000),
    file_format VARCHAR(20) DEFAULT 'pdf', -- 'pdf', 'csv', 'json'
    metadata JSONB NOT NULL DEFAULT '{}',
    CONSTRAINT chk_report_period CHECK (report_period_end > report_period_start),
    CONSTRAINT chk_status CHECK (status IN ('pending', 'in_progress', 'completed', 'failed'))
);

-- Create indexes for performance
CREATE INDEX idx_policies_tenant_id ON policies(tenant_id);
CREATE INDEX idx_policies_type ON policies(type);
CREATE INDEX idx_policies_is_active ON policies(is_active);
CREATE INDEX idx_policies_priority ON policies(priority);
CREATE INDEX idx_policies_version ON policies(version);
CREATE INDEX idx_policies_created_at ON policies(created_at);
CREATE INDEX idx_policies_deleted_at ON policies(deleted_at) WHERE deleted_at IS NOT NULL;

CREATE INDEX idx_policy_evaluations_tenant_id ON policy_evaluations(tenant_id);
CREATE INDEX idx_policy_evaluations_policy_id ON policy_evaluations(policy_id);
CREATE INDEX idx_policy_evaluations_user_id ON policy_evaluations(user_id);
CREATE INDEX idx_policy_evaluations_decision ON policy_evaluations(decision);
CREATE INDEX idx_policy_evaluations_created_at ON policy_evaluations(created_at);
CREATE INDEX idx_policy_evaluations_request_id ON policy_evaluations(request_id);
CREATE INDEX idx_policy_evaluations_execution_time ON policy_evaluations(execution_time_ms);

CREATE INDEX idx_dlp_scans_tenant_id ON dlp_scans(tenant_id);
CREATE INDEX idx_dlp_scans_content_id ON dlp_scans(content_id);
CREATE INDEX idx_dlp_scans_content_type ON dlp_scans(content_type);
CREATE INDEX idx_dlp_scans_risk_score ON dlp_scans(risk_score);
CREATE INDEX idx_dlp_scans_action_taken ON dlp_scans(action_taken);
CREATE INDEX idx_dlp_scans_created_at ON dlp_scans(created_at);
CREATE INDEX idx_dlp_scans_scan_confidence ON dlp_scans(scan_confidence);

CREATE INDEX idx_audit_logs_tenant_id ON audit_logs(tenant_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_resource_type ON audit_logs(resource_type);
CREATE INDEX idx_audit_logs_resource_id ON audit_logs(resource_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_request_id ON audit_logs(request_id);
CREATE INDEX idx_audit_logs_risk_level ON audit_logs(risk_level);
CREATE INDEX idx_audit_logs_correlation_id ON audit_logs(correlation_id);

CREATE INDEX idx_token_usage_tenant_id ON token_usage(tenant_id);
CREATE INDEX idx_token_usage_user_id ON token_usage(user_id);
CREATE INDEX idx_token_usage_api_key_id ON token_usage(api_key_id);
CREATE INDEX idx_token_usage_provider ON token_usage(provider);
CREATE INDEX idx_token_usage_model ON token_usage(model);
CREATE INDEX idx_token_usage_created_at ON token_usage(created_at);
CREATE INDEX idx_token_usage_request_id ON token_usage(request_id);
CREATE INDEX idx_token_usage_cost_usd ON token_usage(cost_usd);

CREATE INDEX idx_document_processing_jobs_document_id ON document_processing_jobs(document_id);
CREATE INDEX idx_document_processing_jobs_tenant_id ON document_processing_jobs(tenant_id);
CREATE INDEX idx_document_processing_jobs_status ON document_processing_jobs(status);
CREATE INDEX idx_document_processing_jobs_job_type ON document_processing_jobs(job_type);
CREATE INDEX idx_document_processing_jobs_created_at ON document_processing_jobs(created_at);
CREATE INDEX idx_document_processing_jobs_priority ON document_processing_jobs(priority);
CREATE INDEX idx_document_processing_jobs_queue_name ON document_processing_jobs(queue_name);

CREATE INDEX idx_vector_search_logs_tenant_id ON vector_search_logs(tenant_id);
CREATE INDEX idx_vector_search_logs_user_id ON vector_search_logs(user_id);
CREATE INDEX idx_vector_search_logs_search_type ON vector_search_logs(search_type);
CREATE INDEX idx_vector_search_logs_created_at ON vector_search_logs(created_at);
CREATE INDEX idx_vector_search_logs_request_id ON vector_search_logs(request_id);
CREATE INDEX idx_vector_search_logs_query_embedding ON vector_search_logs USING hnsw (query_embedding vector_cosine_ops);
CREATE INDEX idx_vector_search_logs_search_duration ON vector_search_logs(search_duration_ms);

CREATE INDEX idx_embedding_jobs_chunk_id ON embedding_jobs(chunk_id);
CREATE INDEX idx_embedding_jobs_tenant_id ON embedding_jobs(tenant_id);
CREATE INDEX idx_embedding_jobs_status ON embedding_jobs(status);
CREATE INDEX idx_embedding_jobs_model_name ON embedding_jobs(model_name);
CREATE INDEX idx_embedding_jobs_provider ON embedding_jobs(provider);
CREATE INDEX idx_embedding_jobs_created_at ON embedding_jobs(created_at);
CREATE INDEX idx_embedding_jobs_batch_id ON embedding_jobs(batch_id);

CREATE INDEX idx_document_access_log_document_id ON document_access_log(document_id);
CREATE INDEX idx_document_access_log_tenant_id ON document_access_log(tenant_id);
CREATE INDEX idx_document_access_log_user_id ON document_access_log(user_id);
CREATE INDEX idx_document_access_log_action ON document_access_log(action);
CREATE INDEX idx_document_access_log_created_at ON document_access_log(created_at);
CREATE INDEX idx_document_access_log_request_id ON document_access_log(request_id);
CREATE INDEX idx_document_access_log_access_granted ON document_access_log(access_granted);

CREATE INDEX idx_compliance_reports_tenant_id ON compliance_reports(tenant_id);
CREATE INDEX idx_compliance_reports_report_type ON compliance_reports(report_type);
CREATE INDEX idx_compliance_reports_status ON compliance_reports(status);
CREATE INDEX idx_compliance_reports_period ON compliance_reports(report_period_start, report_period_end);
CREATE INDEX idx_compliance_reports_created_at ON compliance_reports(created_at);

-- Record migration
INSERT INTO schema_migrations (
    version,
    description,
    filename,
    checksum,
    rollback_script,
    dependencies,
    tags,
    metadata
) VALUES (
    '003',
    'Create Policy and Security Tables',
    '003_create_policy_and_security_tables.sql',
    md5('003_create_policy_and_security_tables.sql'),
    $rollback$
    DROP TABLE IF EXISTS compliance_reports;
    DROP TABLE IF EXISTS document_access_log;
    DROP TABLE IF EXISTS embedding_jobs;
    DROP TABLE IF EXISTS vector_search_logs;
    DROP TABLE IF EXISTS document_processing_jobs;
    DROP TABLE IF EXISTS token_usage;
    DROP TABLE IF EXISTS audit_logs;
    DROP TABLE IF EXISTS dlp_scans;
    DROP TABLE IF EXISTS policy_evaluations;
    DROP TABLE IF EXISTS policies;
    $rollback$,
    '{002}',
    '{security,policy,audit,compliance}',
    '{"required": true, "critical": true}'
);

COMMIT;
