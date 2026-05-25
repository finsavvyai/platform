-- Add JSON-encoded public key (JWK) to device bindings so server can verify
-- ECDSA P-256 signatures on every request. The legacy `public_key_hash` field
-- is kept for backward compatibility with the non-signed stub flow.

ALTER TABLE tokenforge_device_bindings ADD COLUMN public_key_jwk TEXT;
ALTER TABLE tokenforge_device_bindings ADD COLUMN device_id TEXT;

CREATE INDEX IF NOT EXISTS idx_tf_bindings_device_id ON tokenforge_device_bindings(device_id);
