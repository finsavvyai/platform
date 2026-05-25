-- 0007_linkedin_provider.sql
-- Add LinkedIn as a secondary auth provider on platform_users.
--
-- Note: `auth_provider` column already exists in prod (from a prior schema
-- seed), so only `linkedin_id` + its index need to be added here. Running
-- this on a clean environment still works because this is the first time
-- `linkedin_id` appears.

ALTER TABLE platform_users ADD COLUMN linkedin_id TEXT;

CREATE INDEX IF NOT EXISTS idx_platform_users_linkedin ON platform_users(linkedin_id);
