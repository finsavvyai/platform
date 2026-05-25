-- Migration 0023: Extend agent_activity for OpenAgent extension cloud sync
-- Adds new columns for richer event types, metadata, and secrets detection

ALTER TABLE agent_activity ADD COLUMN agent_name TEXT;
ALTER TABLE agent_activity ADD COLUMN event_type TEXT NOT NULL DEFAULT 'file_access';
ALTER TABLE agent_activity ADD COLUMN risk_level TEXT NOT NULL DEFAULT 'low';
ALTER TABLE agent_activity ADD COLUMN file_path TEXT;
ALTER TABLE agent_activity ADD COLUMN secrets_detected INTEGER NOT NULL DEFAULT 0;
ALTER TABLE agent_activity ADD COLUMN metadata TEXT;

-- Backfill from existing columns
UPDATE agent_activity SET agent_name = agent WHERE agent_name IS NULL;
UPDATE agent_activity SET event_type = CASE WHEN type = 'file_read' THEN 'file_access' WHEN type = 'bash_exec' THEN 'terminal_command' ELSE 'file_access' END;
UPDATE agent_activity SET risk_level = risk;
UPDATE agent_activity SET file_path = path;
UPDATE agent_activity SET secrets_detected = secrets_count;

-- Indexes for new columns
CREATE INDEX IF NOT EXISTS idx_agent_activity_event_type ON agent_activity(event_type);
CREATE INDEX IF NOT EXISTS idx_agent_activity_risk_level ON agent_activity(risk_level);
CREATE INDEX IF NOT EXISTS idx_agent_activity_created ON agent_activity(created_at);
