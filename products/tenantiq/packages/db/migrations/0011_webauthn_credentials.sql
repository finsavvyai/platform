-- WebAuthn / passkey credentials.
-- Each row = one device authenticator bound to a user. Multiple per user allowed.

CREATE TABLE IF NOT EXISTS webauthn_credentials (
	credential_id TEXT PRIMARY KEY,        -- base64url-encoded credId
	user_id TEXT NOT NULL,
	public_key BLOB NOT NULL,              -- COSE-encoded public key
	counter INTEGER NOT NULL DEFAULT 0,    -- replay protection
	transports TEXT,                       -- comma-separated: usb,nfc,ble,internal,hybrid
	device_name TEXT,                      -- user-supplied label ("iPhone 15", "TouchID")
	created_at INTEGER NOT NULL,
	last_used_at INTEGER,
	backed_up INTEGER NOT NULL DEFAULT 0,  -- 1 if synced to iCloud Keychain / Google Password Manager
	device_type TEXT                       -- "singleDevice" | "multiDevice"
);

CREATE INDEX IF NOT EXISTS idx_webauthn_user ON webauthn_credentials(user_id);

-- Challenge cache (short-lived registration/auth challenges).
-- Stored in KV in production for low-latency single-tenant use.
-- This table is optional belt-and-suspenders for audit.
CREATE TABLE IF NOT EXISTS webauthn_challenges (
	challenge TEXT PRIMARY KEY,
	user_id TEXT,
	purpose TEXT NOT NULL,                 -- "register" | "authenticate"
	created_at INTEGER NOT NULL,
	expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_webauthn_challenges_expires ON webauthn_challenges(expires_at);
