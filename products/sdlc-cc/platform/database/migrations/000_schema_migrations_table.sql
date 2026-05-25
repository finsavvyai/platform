-- Schema Migrations Table Setup
-- This migration creates the table to track all database migrations

-- Create schema migrations tracking table
CREATE TABLE IF NOT EXISTS schema_migrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    name TEXT,
    filename VARCHAR(255),
    checksum VARCHAR(64),
    executed_at TIMESTAMPTZ DEFAULT NOW(),
    applied_at TIMESTAMPTZ DEFAULT NOW(),
    execution_time_ms INTEGER,
    rollback_script TEXT,
    dependencies TEXT[] DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}'
);

-- Backfill columns / nullability for older deployments where the table
-- was created with NOT NULL on filename/description/checksum and no
-- name/applied_at columns. Idempotent.
ALTER TABLE schema_migrations ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE schema_migrations ADD COLUMN IF NOT EXISTS applied_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE schema_migrations ALTER COLUMN description DROP NOT NULL;
ALTER TABLE schema_migrations ALTER COLUMN filename DROP NOT NULL;
ALTER TABLE schema_migrations ALTER COLUMN checksum DROP NOT NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_schema_migrations_version ON schema_migrations(version);
CREATE INDEX IF NOT EXISTS idx_schema_migrations_executed_at ON schema_migrations(executed_at);
CREATE INDEX IF NOT EXISTS idx_schema_migrations_tags ON schema_migrations USING GIN(tags);

-- Insert initial migration record
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
    '000',
    'Create schema migrations table',
    '000_schema_migrations_table.sql',
    md5('000_schema_migrations_table.sql'),
    $rollback$
    DROP TABLE IF EXISTS schema_migrations;
    $rollback$,
    '{}',
    '{core,setup}',
    '{"required": true, "critical": true}'
) ON CONFLICT (version) DO NOTHING;
