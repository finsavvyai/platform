-- API key rotation lifecycle. Adds the columns the rotation handler
-- and background sweeper rely on, alongside an index for the sweeper's
-- "expired or rotating-past-grace" sweep.
--
-- Day 9 of the production-ready roadmap.

ALTER TABLE api_keys
    ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS rotated_from_key_id UUID REFERENCES api_keys (id),
    ADD COLUMN IF NOT EXISTS rotation_grace_period_seconds INTEGER NOT NULL DEFAULT 86400,
    ADD COLUMN IF NOT EXISTS rotation_started_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;

-- Sweeper hot path: find keys whose grace window has passed.
CREATE INDEX IF NOT EXISTS idx_api_keys_expiry_sweep
    ON api_keys (expires_at)
    WHERE expires_at IS NOT NULL AND revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_api_keys_rotation_sweep
    ON api_keys (rotation_started_at)
    WHERE rotation_started_at IS NOT NULL AND revoked_at IS NULL;

COMMENT ON COLUMN api_keys.rotation_grace_period_seconds IS
    'Once rotated, the old key continues to be honored for this many seconds before the sweeper revokes it. Default 86400 (24h).';
