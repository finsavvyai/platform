-- 021_api_keys_table.sql
-- Create the api_keys table that auth.ts:35 queries.
--
-- Why this exists late: migration 018 ALTERed api_keys to add member_user_id,
-- but no earlier migration ever CREATEd it on remote D1. Production auth was
-- throwing `D1_ERROR: no such table: api_keys` on every /v1/prompt call,
-- preventing the fallback to projects.api_key_hash from running.
--
-- The table can be empty — auth.ts falls through to the projects table when
-- the primary lookup returns no row. Member-bound keys (issued via the
-- project_members flow) will populate it going forward.

CREATE TABLE IF NOT EXISTS api_keys (
  id              TEXT PRIMARY KEY,
  project_id      TEXT NOT NULL,
  key_hash        TEXT NOT NULL,
  member_user_id  TEXT,
  created_at      INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_api_keys_hash
  ON api_keys (key_hash);

CREATE INDEX IF NOT EXISTS idx_api_keys_project
  ON api_keys (project_id);
