-- Migration: Add scoped API key metadata for agent dispatch

ALTER TABLE api_keys_metadata ADD COLUMN project_id TEXT;
ALTER TABLE api_keys_metadata ADD COLUMN adapter TEXT;
ALTER TABLE api_keys_metadata ADD COLUMN allowed_models TEXT;
ALTER TABLE api_keys_metadata ADD COLUMN tool_policy TEXT;

CREATE INDEX IF NOT EXISTS idx_api_keys_project_id ON api_keys_metadata(project_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_adapter ON api_keys_metadata(adapter);
