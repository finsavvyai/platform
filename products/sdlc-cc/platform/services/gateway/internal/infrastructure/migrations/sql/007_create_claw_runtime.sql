-- Migration: 007_create_claw_runtime
-- Description: Create persistent Claw session and memory tables for hosted agent execution

CREATE TABLE IF NOT EXISTS claw_sessions (
    session_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    project_id TEXT NOT NULL,
    adapter TEXT NOT NULL,
    agent_id TEXT,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_claw_sessions_tenant_user ON claw_sessions(tenant_id, user_id, last_seen_at DESC);

CREATE TABLE IF NOT EXISTS claw_memories (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    session_id TEXT,
    agent_id TEXT,
    memory_type TEXT NOT NULL,
    content TEXT NOT NULL,
    source TEXT,
    importance INTEGER NOT NULL DEFAULT 0,
    tags JSONB NOT NULL DEFAULT '[]',
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_claw_memories_tenant_user ON claw_memories(tenant_id, user_id, created_at DESC);
CREATE INDEX idx_claw_memories_session ON claw_memories(session_id, created_at DESC);
CREATE INDEX idx_claw_memories_type ON claw_memories(memory_type, created_at DESC);
