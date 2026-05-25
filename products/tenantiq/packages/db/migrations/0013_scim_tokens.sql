-- SCIM 2.0 infrastructure (RFC 7643 / RFC 7644).
--
-- Three tables:
--   1. scim_bearer_tokens — long-lived bearer tokens for IdP → TenantIQ provisioning
--   2. platform_groups    — org-scoped groups (SCIM Group resources, also useful for RBAC)
--   3. platform_group_members — group membership join table
--
-- SCIM target for User resources is the existing platform_users table
-- (MSP admin/team members), NOT the M365-tenant users_cache.
--
-- Token plaintext is shown ONCE on creation, then only its sha256 hash is
-- persisted. last_used_at detects dead tokens. revoked_at = soft delete.

CREATE TABLE IF NOT EXISTS scim_bearer_tokens (
	id TEXT PRIMARY KEY,
	org_id TEXT NOT NULL,
	token_hash TEXT NOT NULL,                    -- sha256(hex) of plaintext
	display_name TEXT NOT NULL,                  -- "Okta - Production"
	scopes_json TEXT NOT NULL DEFAULT '["users:read","users:write","groups:read","groups:write"]',
	created_at INTEGER NOT NULL,
	created_by TEXT NOT NULL,                    -- user.email of creator
	last_used_at INTEGER,
	revoked_at INTEGER,
	revoked_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_scim_tokens_org ON scim_bearer_tokens(org_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_scim_token_hash ON scim_bearer_tokens(token_hash);

-- Groups for SCIM Group resources + future RBAC. external_id is the IdP-side
-- identifier (Okta group id, Entra object id) used to keep IdP and TenantIQ
-- in sync without name collisions.
CREATE TABLE IF NOT EXISTS platform_groups (
	id TEXT PRIMARY KEY,
	org_id TEXT NOT NULL,
	display_name TEXT NOT NULL,
	external_id TEXT,
	created_at INTEGER NOT NULL,
	updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_groups_org ON platform_groups(org_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_groups_external_id ON platform_groups(org_id, external_id);

-- Many-to-many membership. PK is composite — user can be in many groups,
-- group has many users, but each pair only once.
CREATE TABLE IF NOT EXISTS platform_group_members (
	group_id TEXT NOT NULL,
	user_id TEXT NOT NULL,
	added_at INTEGER NOT NULL,
	PRIMARY KEY (group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_group_members_user ON platform_group_members(user_id);
