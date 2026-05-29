-- Documents Table
-- Core document metadata and storage information
CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    content_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    checksum TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    storage_bucket TEXT NOT NULL,
    metadata TEXT NOT NULL DEFAULT '{}',
    extraction_status TEXT NOT NULL DEFAULT 'pending',
    processing_status TEXT NOT NULL DEFAULT 'pending',
    dlp_status TEXT NOT NULL DEFAULT 'pending',
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    created_by TEXT NOT NULL,
    encryption_key_id TEXT,
    retention_policy TEXT NOT NULL DEFAULT '{}',
    access_level TEXT NOT NULL DEFAULT 'private',
    tags TEXT NOT NULL DEFAULT '[]',
    classification TEXT NOT NULL DEFAULT 'internal',
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Create indexes for document lookups
CREATE INDEX IF NOT EXISTS idx_documents_tenant_id ON documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_documents_created_by ON documents(created_by);
CREATE INDEX IF NOT EXISTS idx_documents_content_type ON documents(content_type);
CREATE INDEX IF NOT EXISTS idx_documents_extraction_status ON documents(extraction_status);
CREATE INDEX IF NOT EXISTS idx_documents_processing_status ON documents(processing_status);
CREATE INDEX IF NOT EXISTS idx_documents_dlp_status ON documents(dlp_status);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at);
CREATE INDEX IF NOT EXISTS idx_documents_classification ON documents(classification);
CREATE INDEX IF NOT EXISTS idx_documents_access_level ON documents(access_level);
CREATE INDEX IF NOT EXISTS idx_documents_checksum ON documents(checksum);

-- Document Processing Jobs Table
-- Track document processing progress
CREATE TABLE IF NOT EXISTS document_processing_jobs (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    job_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    progress INTEGER DEFAULT 0,
    error_message TEXT,
    started_at INTEGER,
    completed_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    metadata TEXT NOT NULL DEFAULT '{}',
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Create indexes for processing jobs
CREATE INDEX IF NOT EXISTS idx_document_processing_jobs_document_id ON document_processing_jobs(document_id);
CREATE INDEX IF NOT EXISTS idx_document_processing_jobs_tenant_id ON document_processing_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_document_processing_jobs_status ON document_processing_jobs(status);
CREATE INDEX IF NOT EXISTS idx_document_processing_jobs_job_type ON document_processing_jobs(job_type);
CREATE INDEX IF NOT EXISTS idx_document_processing_jobs_created_at ON document_processing_jobs(created_at);

-- Document Access Log Table
-- Track document access for audit and compliance
CREATE TABLE IF NOT EXISTS document_access_log (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    user_id TEXT,
    api_key_id TEXT,
    action TEXT NOT NULL,
    access_reason TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    metadata TEXT NOT NULL DEFAULT '{}',
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (api_key_id) REFERENCES api_keys(id) ON DELETE SET NULL
);

-- Create indexes for access log
CREATE INDEX IF NOT EXISTS idx_document_access_log_document_id ON document_access_log(document_id);
CREATE INDEX IF NOT EXISTS idx_document_access_log_tenant_id ON document_access_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_document_access_log_user_id ON document_access_log(user_id);
CREATE INDEX IF NOT EXISTS idx_document_access_log_action ON document_access_log(action);
CREATE INDEX IF NOT EXISTS idx_document_access_log_created_at ON document_access_log(created_at);
