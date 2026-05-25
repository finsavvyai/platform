-- Initialize LunaOS database
-- This script runs when the PostgreSQL container starts for the first time

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create LunaOS database user (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'lunaos') THEN
        CREATE ROLE lunaos WITH LOGIN PASSWORD 'lunaos';
    END IF;
END
$$;

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE lunaos TO lunaos;

-- Create initial tables
CREATE TABLE IF NOT EXISTS memories (
    id SERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    embedding vector(1536),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS memories_embedding_idx 
ON memories USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

CREATE INDEX IF NOT EXISTS memories_created_at_idx 
ON memories (created_at);

CREATE INDEX IF NOT EXISTS memories_metadata_idx 
ON memories USING gin (metadata);

-- Create agent_memory table for backward compatibility
CREATE TABLE IF NOT EXISTS agent_memory (
    id SERIAL PRIMARY KEY,
    agent_id VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    embedding vector(1536),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS agent_memory_agent_id_idx 
ON agent_memory (agent_id);

CREATE INDEX IF NOT EXISTS agent_memory_embedding_idx 
ON agent_memory USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Grant permissions to lunaos user
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO lunaos;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO lunaos;
