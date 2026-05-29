-- Users Table
-- User accounts with tenant isolation
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    email TEXT NOT NULL,
    encrypted_password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    permissions TEXT NOT NULL DEFAULT '[]',
    metadata TEXT NOT NULL DEFAULT '{}',
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    last_login INTEGER,
    is_active BOOLEAN DEFAULT true,
    mfa_enabled BOOLEAN DEFAULT false,
    mfa_secret TEXT,
    email_verified BOOLEAN DEFAULT false,
    phone_number TEXT,
    phone_verified BOOLEAN DEFAULT false,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Create indexes for user lookups
CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_tenant_email ON users(tenant_id, email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login);

-- API Keys Table
-- API key management for service-to-service authentication
CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    user_id TEXT,
    name TEXT NOT NULL,
    key_hash TEXT UNIQUE NOT NULL,
    permissions TEXT NOT NULL DEFAULT '{}',
    rate_limit INTEGER NOT NULL DEFAULT 1000,
    expires_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    created_by TEXT NOT NULL,
    last_used INTEGER,
    is_active BOOLEAN DEFAULT true,
    metadata TEXT NOT NULL DEFAULT '{}',
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Create indexes for API key lookups
CREATE INDEX IF NOT EXISTS idx_api_keys_tenant_id ON api_keys(tenant_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_is_active ON api_keys(is_active);
CREATE INDEX IF NOT EXISTS idx_api_keys_expires_at ON api_keys(expires_at);
CREATE INDEX IF NOT EXISTS idx_api_keys_created_at ON api_keys(created_at);

-- User Sessions Table
-- Active session tracking for security and audit
CREATE TABLE IF NOT EXISTS user_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    session_token TEXT UNIQUE NOT NULL,
    refresh_token TEXT UNIQUE,
    ip_address TEXT,
    user_agent TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    expires_at INTEGER NOT NULL,
    last_activity INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    is_active BOOLEAN DEFAULT true,
    metadata TEXT NOT NULL DEFAULT '{}',
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Create indexes for session lookups
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_tenant_id ON user_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_session_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_is_active ON user_sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_user_sessions_last_activity ON user_sessions(last_activity);

-- Insert default system user
INSERT OR IGNORE INTO users (
    id,
    tenant_id,
    email,
    encrypted_password,
    role,
    permissions,
    is_active,
    email_verified
) VALUES (
    'system-user',
    'system-tenant',
    'system@sdlc.ai',
    'encrypted_placeholder_password',
    'system_admin',
    '["all_permissions"]',
    true,
    true
);
