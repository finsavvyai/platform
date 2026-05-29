-- Vector Metadata Table
-- Track vector embeddings and their metadata
CREATE TABLE IF NOT EXISTS vector_metadata (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    chunk_id TEXT NOT NULL,
    vector_id TEXT NOT NULL,
    embedding_model TEXT NOT NULL,
    embedding_dimensions INTEGER NOT NULL,
    embedding_provider TEXT NOT NULL,
    vector_size_bytes INTEGER NOT NULL,
    processing_time_ms INTEGER,
    cost_usd REAL DEFAULT 0.0,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    metadata TEXT NOT NULL DEFAULT '{}',
    FOREIGN KEY (chunk_id) REFERENCES document_chunks(id) ON DELETE CASCADE,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Create indexes for vector metadata
CREATE INDEX IF NOT EXISTS idx_vector_metadata_tenant_id ON vector_metadata(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vector_metadata_chunk_id ON vector_metadata(chunk_id);
CREATE INDEX IF NOT EXISTS idx_vector_metadata_vector_id ON vector_metadata(vector_id);
CREATE INDEX IF NOT EXISTS idx_vector_metadata_embedding_model ON vector_metadata(embedding_model);
CREATE INDEX IF NOT EXISTS idx_vector_metadata_embedding_provider ON vector_metadata(embedding_provider);
CREATE INDEX IF NOT EXISTS idx_vector_metadata_created_at ON vector_metadata(created_at);

-- Vector Search Logs Table
-- Track vector search operations for analytics and billing
CREATE TABLE IF NOT EXISTS vector_search_logs (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    user_id TEXT,
    api_key_id TEXT,
    query_vector_id TEXT,
    search_type TEXT NOT NULL,
    results_count INTEGER NOT NULL,
    search_radius REAL,
 filters_applied TEXT NOT NULL DEFAULT '{}',
    processing_time_ms INTEGER NOT NULL,
    cost_usd REAL DEFAULT 0.0,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    ip_address TEXT,
    user_agent TEXT,
    metadata TEXT NOT NULL DEFAULT '{}',
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (api_key_id) REFERENCES api_keys(id) ON DELETE SET NULL
);

-- Create indexes for search logs
CREATE INDEX IF NOT EXISTS idx_vector_search_logs_tenant_id ON vector_search_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vector_search_logs_user_id ON vector_search_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_vector_search_logs_search_type ON vector_search_logs(search_type);
CREATE INDEX IF NOT EXISTS idx_vector_search_logs_results_count ON vector_search_logs(results_count);
CREATE INDEX IF NOT EXISTS idx_vector_search_logs_processing_time_ms ON vector_search_logs(processing_time_ms);
CREATE INDEX IF NOT EXISTS idx_vector_search_logs_created_at ON vector_search_logs(created_at);

-- Embedding Batches Table
-- Track batch embedding operations
CREATE TABLE IF NOT EXISTS embedding_batches (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    batch_size INTEGER NOT NULL,
    embedding_model TEXT NOT NULL,
    embedding_provider TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    total_tokens INTEGER NOT NULL,
    total_cost_usd REAL DEFAULT 0.0,
    processing_time_ms INTEGER,
    error_message TEXT,
    started_at INTEGER,
    completed_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    metadata TEXT NOT NULL DEFAULT '{}',
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Create indexes for embedding batches
CREATE INDEX IF NOT EXISTS idx_embedding_batches_tenant_id ON embedding_batches(tenant_id);
CREATE INDEX IF NOT EXISTS idx_embedding_batches_status ON embedding_batches(status);
CREATE INDEX IF NOT EXISTS idx_embedding_batches_embedding_model ON embedding_batches(embedding_model);
CREATE INDEX IF NOT EXISTS idx_embedding_batches_embedding_provider ON embedding_batches(embedding_provider);
CREATE INDEX IF NOT EXISTS idx_embedding_batches_created_at ON embedding_batches(created_at);

-- Vector Index Configuration Table
-- Store vector index configurations and settings
CREATE TABLE IF NOT EXISTS vector_index_configs (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    index_name TEXT NOT NULL,
    index_type TEXT NOT NULL,
    dimensions INTEGER NOT NULL,
    distance_metric TEXT NOT NULL,
    configuration TEXT NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'active',
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    metadata TEXT NOT NULL DEFAULT '{}',
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Create indexes for index configurations
CREATE INDEX IF NOT EXISTS idx_vector_index_configs_tenant_id ON vector_index_configs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vector_index_configs_index_name ON vector_index_configs(index_name);
CREATE INDEX IF NOT EXISTS idx_vector_index_configs_index_type ON vector_index_configs(index_type);
CREATE INDEX IF NOT EXISTS idx_vector_index_configs_status ON vector_index_configs(status);
CREATE INDEX IF NOT EXISTS idx_vector_index_configs_created_at ON vector_index_configs(created_at);
