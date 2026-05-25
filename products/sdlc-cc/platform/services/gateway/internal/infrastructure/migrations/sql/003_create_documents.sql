-- Migration: 003_create_documents
-- Description: Create documents and document_chunks tables with pgvector support

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    title VARCHAR(512) NOT NULL,
    content_type VARCHAR(100) NOT NULL,
    file_path VARCHAR(1024),
    file_size_bytes BIGINT NOT NULL DEFAULT 0,
    file_hash VARCHAR(64),
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    processing_error TEXT,
    chunk_count INTEGER NOT NULL DEFAULT 0,
    token_count INTEGER NOT NULL DEFAULT 0,
    language VARCHAR(10),
    metadata JSONB NOT NULL DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    classification VARCHAR(50) NOT NULL DEFAULT 'internal',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_documents_tenant_id ON documents(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_documents_user_id ON documents(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_documents_status ON documents(tenant_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_documents_tags ON documents USING GIN(tags) WHERE deleted_at IS NULL;
CREATE INDEX idx_documents_metadata ON documents USING GIN(metadata) WHERE deleted_at IS NULL;
CREATE INDEX idx_documents_created_at ON documents(tenant_id, created_at DESC) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS document_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    token_count INTEGER NOT NULL DEFAULT 0,
    embedding vector(1536),
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(document_id, chunk_index)
);

CREATE INDEX idx_document_chunks_document_id ON document_chunks(document_id);
CREATE INDEX idx_document_chunks_tenant_id ON document_chunks(tenant_id);
CREATE INDEX idx_document_chunks_embedding ON document_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_documents ON documents
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_document_chunks ON document_chunks
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
