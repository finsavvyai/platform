-- Document Chunks Table
-- Individual text chunks with embeddings for vector search
CREATE TABLE IF NOT EXISTS document_chunks (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    content_length INTEGER NOT NULL,
    chunk_type TEXT NOT NULL DEFAULT 'text',
    embedding_model TEXT NOT NULL,
    embedding_dimensions INTEGER NOT NULL,
    embedding_vector TEXT, -- Stored as JSON array in D1 (actual vectors in Vectorize)
    metadata TEXT NOT NULL DEFAULT '{}',
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    processing_status TEXT NOT NULL DEFAULT 'pending',
    dlp_scan_status TEXT NOT NULL DEFAULT 'pending',
    dlp_redacted_content TEXT,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Create indexes for chunk lookups
CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id ON document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_tenant_id ON document_chunks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_chunk_index ON document_chunks(document_id, chunk_index);
CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding_model ON document_chunks(embedding_model);
CREATE INDEX IF NOT EXISTS idx_document_chunks_processing_status ON document_chunks(processing_status);
CREATE INDEX IF NOT EXISTS idx_document_chunks_dlp_scan_status ON document_chunks(dlp_scan_status);
CREATE INDEX IF NOT EXISTS idx_document_chunks_created_at ON document_chunks(created_at);

-- Vector Search Logs Table
-- Track vector search queries and results
CREATE TABLE IF NOT EXISTS vector_search_logs (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    user_id TEXT,
    query_text TEXT NOT NULL,
    query_vector_model TEXT,
    search_type TEXT NOT NULL,
    filters_applied TEXT NOT NULL DEFAULT '{}',
    results_count INTEGER NOT NULL,
    search_duration_ms INTEGER NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    metadata TEXT NOT NULL DEFAULT '{}',
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Create indexes for search logs
CREATE INDEX IF NOT EXISTS idx_vector_search_logs_tenant_id ON vector_search_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vector_search_logs_user_id ON vector_search_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_vector_search_logs_search_type ON vector_search_logs(search_type);
CREATE INDEX IF NOT EXISTS idx_vector_search_logs_created_at ON vector_search_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_vector_search_logs_search_duration_ms ON vector_search_logs(search_duration_ms);

-- Embedding Generation Jobs Table
-- Track embedding generation jobs
CREATE TABLE IF NOT EXISTS embedding_jobs (
    id TEXT PRIMARY KEY,
    chunk_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    model_name TEXT NOT NULL,
    provider TEXT NOT NULL,
    token_count INTEGER,
    cost_usd REAL,
    error_message TEXT,
    started_at INTEGER,
    completed_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    metadata TEXT NOT NULL DEFAULT '{}',
    FOREIGN KEY (chunk_id) REFERENCES document_chunks(id) ON DELETE CASCADE,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Create indexes for embedding jobs
CREATE INDEX IF NOT EXISTS idx_embedding_jobs_chunk_id ON embedding_jobs(chunk_id);
CREATE INDEX IF NOT EXISTS idx_embedding_jobs_tenant_id ON embedding_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_embedding_jobs_status ON embedding_jobs(status);
CREATE INDEX IF NOT EXISTS idx_embedding_jobs_model_name ON embedding_jobs(model_name);
CREATE INDEX IF NOT EXISTS idx_embedding_jobs_provider ON embedding_jobs(provider);
CREATE INDEX IF NOT EXISTS idx_embedding_jobs_created_at ON embedding_jobs(created_at);
