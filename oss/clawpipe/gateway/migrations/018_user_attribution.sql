-- 018_user_attribution.sql
-- Add per-user attribution to request rows.
--
-- user_id is NULL for requests made with ad-hoc project keys (correct behaviour,
-- not a bug — only keys issued via the member-bound flow carry a member_user_id).
--
-- api_keys.member_user_id links a key to the project_members row that created it.
-- Gateway resolves user_id at insert time via the lookup in auth.ts.

ALTER TABLE requests ADD COLUMN user_id TEXT;

CREATE INDEX IF NOT EXISTS idx_requests_user
  ON requests (user_id, created_at);

-- Extend api_keys table so member-bound keys carry the owning user_id.
-- Project-level keys already stored in `projects.api_key_hash` leave this NULL.
ALTER TABLE api_keys ADD COLUMN member_user_id TEXT;
