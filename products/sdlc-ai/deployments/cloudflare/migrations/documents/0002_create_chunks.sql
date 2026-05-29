-- Document Chunks Table
-- Individual text chunks from processed documents
CREATE TABLE IF NOT EXISTS document_chunks (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    content_length INTEGER NOT NULL,
    metadata TEXT NOT NULL DEFAULT '{}',
    embedding_status TEXT NOT NULL DEFAULT 'pending',
    vector_id TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    processing_time_ms INTEGER,
    checksum TEXT NOT NULL,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Create indexes for document chunks
CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id ON document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_tenant_id ON document_chunks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_chunk_index ON document_chunks(chunk_index);
CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding_status ON document_chunks(embedding_status);
CREATE INDEX IF NOT EXISTS idx_document_chunks_vector_id ON document_chunks(vector_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_created_at ON document_chunks(created_at);
CREATE INDEX IF NOT EXISTS idx_document_chunks_content_length ON document_chunks(content_length);
CREATE INDEX IF NOT EXISTS idx_document_chunks_checksum ON document_chunks(checksum);

-- Document Search Index Table
-- Fallback search index for keyword-based search
CREATE TABLE IF NOT EXISTS document_search_index (
    id TEXT PRIMARY KEY,
    chunk_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    content_tokens TEXT NOT NULL,
    title_tokens TEXT,
    metadata_tokens TEXT,
    bm25_score REAL DEFAULT 0.0,
    term_frequency INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (chunk_id) REFERENCES document_chunks(id) ON DELETE CASCADE,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Create indexes for search index
CREATE INDEX IF NOT EXISTS idx_document_search_index_chunk_id ON document_search_index(chunk_id);
CREATE INDEX IF NOT EXISTS idx_document_search_index_tenant_id ON document_search_index(tenant_id);
CREATE INDEX IF NOT EXISTS idx_document_search_index_content_tokens ON document_search_index(content_tokens);
CREATE INDEX IF NOT EXISTS idx_document_search_index_bm25_score ON document_search_index(bm25_score);
CREATE INDEX IF NOT EXISTS idx_document_search_index_term_frequency ON document_search_index(term_frequency);

-- Document Context Windows Table
-- Pre-computed context windows for efficient RAG operations
CREATE TABLE IF NOT EXISTS document_context_windows (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    query_hash TEXT NOT NULL,
    context_window TEXT NOT NULL,
    source_chunk_ids TEXT NOT NULL DEFAULT '[]',
    total_tokens INTEGER NOT NULL,
    relevance_score REAL NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    expires_at INTEGER NOT NULL,
    access_count INTEGER DEFAULT 0,
    last_accessed INTEGER,
    metadata TEXT NOT NULL DEFAULT '{}',
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Create indexes for context windows
CREATE INDEX IF NOT EXISTS idx_document_context_windows_tenant_id ON document_context_windows(tenant_id);
CREATE INDEX IF NOT EXISTS idx_document_context_windows_query_hash ON document_context_windows(query_hash);
CREATE INDEX IF NOT EXISTS idx_document_context_windows_relevance_score ON document_context_windows(relevance_score);
CREATE INDEX IF NOT EXISTS idx_document_context_windows_expires_at ON document_context_windows(expires_at);
CREATE INDEX IF NOT EXISTS idx_document_context_windows_access_count ON document_context_windows(access_count);
CREATE INDEX IF NOT EXISTS idx_document_context_windows_created_at ON document_context_windows(created_at);
