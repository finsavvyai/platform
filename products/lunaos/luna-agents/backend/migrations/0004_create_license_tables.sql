-- License validation table for IP protection
CREATE TABLE IF NOT EXISTS license_validations (
    id TEXT PRIMARY KEY,
    license_key TEXT NOT NULL,
    user_id TEXT NOT NULL,
    domain TEXT,
    success BOOLEAN DEFAULT false,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- License information table
CREATE TABLE IF NOT EXISTS licenses (
    id TEXT PRIMARY KEY,
    license_key TEXT UNIQUE NOT NULL,
    tier TEXT NOT NULL,
    expires_at DATETIME NOT NULL,
    domain TEXT,
    max_users INTEGER DEFAULT 1,
    features TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_license_validations_key ON license_validations(license_key);
CREATE INDEX IF NOT EXISTS idx_license_validations_user ON license_validations(user_id);
CREATE INDEX IF NOT EXISTS idx_license_validations_success ON license_validations(success);
CREATE INDEX IF NOT EXISTS idx_license_validations_created_at ON license_validations(created_at);

CREATE INDEX IF NOT EXISTS idx_licenses_key ON licenses(license_key);
CREATE INDEX IF NOT EXISTS idx_licenses_tier ON licenses(tier);
CREATE INDEX IF NOT EXISTS idx_licenses_expires_at ON licenses(expires_at);