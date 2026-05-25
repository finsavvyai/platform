-- Authentication System Database Schema Extensions
-- This migration adds comprehensive authentication tables and security features

-- First, let's add any missing ENUM types if they don't exist
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM (
        'super_admin',
        'tenant_admin',
        'data_scientist',
        'analyst',
        'viewer',
        'user'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE tenant_status AS ENUM (
        'active',
        'suspended',
        'trial',
        'deleted'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE document_status AS ENUM (
        'pending',
        'processing',
        'completed',
        'failed'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE encryption_algorithm AS ENUM (
        'aes-256-gcm',
        'aes-256-cbc',
        'chacha20-poly1305'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE data_classification AS ENUM (
        'public',
        'internal',
        'confidential',
        'restricted'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE audit_action AS ENUM (
        'create',
        'read',
        'update',
        'delete',
        'login',
        'logout',
        'access_denied',
        'password_change',
        'password_reset',
        'mfa_enabled',
        'mfa_disabled',
        'token_issued',
        'token_revoked',
        'session_created',
        'session_terminated',
        'export',
        'share',
        'download',
        'upload'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE policy_type AS ENUM (
        'access_control',
        'data_retention',
        'dlp_policy',
        'security_policy',
        'compliance_policy'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Authentication-specific extensions to existing tables
ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS auth_config JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS sso_config JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS mfa_settings JSONB DEFAULT '{"required": false}',
ADD COLUMN IF NOT EXISTS session_settings JSONB DEFAULT '{"timeout_minutes": 1440}',
ADD COLUMN IF NOT EXISTS security_policies JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS authentication_methods JSONB DEFAULT '["password"]';

ALTER TABLE users
ADD COLUMN IF NOT EXISTS password_algorithm VARCHAR(50) DEFAULT 'argon2id',
ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS mfa_secret_encrypted BYTEA,
ADD COLUMN IF NOT EXISTS mfa_backup_codes_encrypted TEXT,
ADD COLUMN IF NOT EXISTS mfa_methods JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS last_password_change TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS password_history JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS security_questions JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS failed_login_ip_addresses INET[],
ADD COLUMN IF NOT EXISTS known_devices JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS security_flags JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS two_factor_backup_used INTEGER DEFAULT 0;

-- Create new authentication tables

-- Password reset tokens table
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    token_prefix VARCHAR(10) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    used_at TIMESTAMPTZ,
    ip_address INET,
    user_agent TEXT,
    is_used BOOLEAN DEFAULT false,
    metadata JSONB DEFAULT '{}'
);

-- Email verification tokens table
CREATE TABLE IF NOT EXISTS email_verification_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    token_prefix VARCHAR(10) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    used_at TIMESTAMPTZ,
    ip_address INET,
    user_agent TEXT,
    is_used BOOLEAN DEFAULT false,
    metadata JSONB DEFAULT '{}'
);

-- MFA backup codes table
CREATE TABLE IF NOT EXISTS mfa_backup_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    code_hash VARCHAR(255) NOT NULL,
    is_used BOOLEAN DEFAULT false,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'
);

-- Device tracking table
CREATE TABLE IF NOT EXISTS user_devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    device_fingerprint VARCHAR(255) NOT NULL,
    device_name VARCHAR(255),
    device_type VARCHAR(100),
    platform VARCHAR(100),
    browser VARCHAR(100),
    ip_address INET,
    user_agent TEXT,
    is_trusted BOOLEAN DEFAULT false,
    last_seen TIMESTAMPTZ DEFAULT NOW(),
    first_seen TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    UNIQUE(user_id, device_fingerprint)
);

-- Failed login attempts table for security monitoring
CREATE TABLE IF NOT EXISTS failed_login_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL,
    tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
    ip_address INET,
    user_agent TEXT,
    failure_reason VARCHAR(100),
    attempted_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

-- Security event logs table
CREATE TABLE IF NOT EXISTS security_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    event_type VARCHAR(100) NOT NULL,
    event_severity VARCHAR(20) NOT NULL DEFAULT 'info',
    event_category VARCHAR(50),
    description TEXT,
    ip_address INET,
    user_agent TEXT,
    session_id UUID REFERENCES user_sessions(id),
    request_id UUID,
    resource_type VARCHAR(100),
    resource_id UUID,
    details JSONB DEFAULT '{}',
    risk_score DECIMAL(3,2) DEFAULT 0.0,
    is_resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- JWT token blacklist table
CREATE TABLE IF NOT EXISTS token_blacklist (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    token_id VARCHAR(255) NOT NULL,
    token_type VARCHAR(50) NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ DEFAULT NOW(),
    revoked_by UUID REFERENCES users(id),
    reason VARCHAR(255),
    metadata JSONB DEFAULT '{}'
);

-- Rate limiting table
CREATE TABLE IF NOT EXISTS rate_limits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    ip_address INET,
    resource_type VARCHAR(100) NOT NULL,
    resource_id VARCHAR(255),
    window_start TIMESTAMPTZ NOT NULL,
    window_end TIMESTAMPTZ NOT NULL,
    request_count INTEGER DEFAULT 1,
    limit_amount INTEGER NOT NULL,
    is_blocked BOOLEAN DEFAULT false,
    blocked_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Security settings table (tenant-level)
CREATE TABLE IF NOT EXISTS security_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    setting_key VARCHAR(255) NOT NULL,
    setting_value JSONB NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES users(id),
    UNIQUE(tenant_id, setting_key)
);

-- API key usage tracking
CREATE TABLE IF NOT EXISTS api_key_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    api_key_id UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    request_id UUID NOT NULL,
    endpoint VARCHAR(500),
    method VARCHAR(10),
    ip_address INET,
    user_agent TEXT,
    response_status INTEGER,
    processing_time_ms INTEGER,
    request_size INTEGER,
    response_size INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

-- Session analytics table
CREATE TABLE IF NOT EXISTS session_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES user_sessions(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    page_url VARCHAR(1000),
    referrer_url VARCHAR(1000),
    ip_address INET,
    user_agent TEXT,
    event_data JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance

-- Password reset tokens indexes
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_tenant_id ON password_reset_tokens(tenant_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token_hash ON password_reset_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_is_used ON password_reset_tokens(is_used);

-- Email verification tokens indexes
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_user_id ON email_verification_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_tenant_id ON email_verification_tokens(tenant_id);
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_token_hash ON email_verification_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_expires_at ON email_verification_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_is_used ON email_verification_tokens(is_used);

-- MFA backup codes indexes
CREATE INDEX IF NOT EXISTS idx_mfa_backup_codes_user_id ON mfa_backup_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_mfa_backup_codes_tenant_id ON mfa_backup_codes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mfa_backup_codes_is_used ON mfa_backup_codes(is_used);
CREATE INDEX IF NOT EXISTS idx_mfa_backup_codes_expires_at ON mfa_backup_codes(expires_at);

-- User devices indexes
CREATE INDEX IF NOT EXISTS idx_user_devices_user_id ON user_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_user_devices_tenant_id ON user_devices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_devices_device_fingerprint ON user_devices(device_fingerprint);
CREATE INDEX IF NOT EXISTS idx_user_devices_is_trusted ON user_devices(is_trusted);
CREATE INDEX IF NOT EXISTS idx_user_devices_last_seen ON user_devices(last_seen);

-- Failed login attempts indexes
CREATE INDEX IF NOT EXISTS idx_failed_login_attempts_email ON failed_login_attempts(email);
CREATE INDEX IF NOT EXISTS idx_failed_login_attempts_tenant_id ON failed_login_attempts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_failed_login_attempts_ip_address ON failed_login_attempts(ip_address);
CREATE INDEX IF NOT EXISTS idx_failed_login_attempts_attempted_at ON failed_login_attempts(attempted_at);
CREATE INDEX IF NOT EXISTS idx_failed_login_attempts_failure_reason ON failed_login_attempts(failure_reason);

-- Security events indexes
CREATE INDEX IF NOT EXISTS idx_security_events_tenant_id ON security_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_security_events_user_id ON security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_security_events_event_type ON security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_event_severity ON security_events(event_severity);
CREATE INDEX IF NOT EXISTS idx_security_events_event_category ON security_events(event_category);
CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON security_events(created_at);
CREATE INDEX IF NOT EXISTS idx_security_events_ip_address ON security_events(ip_address);
CREATE INDEX IF NOT EXISTS idx_security_events_risk_score ON security_events(risk_score);
CREATE INDEX IF NOT EXISTS idx_security_events_is_resolved ON security_events(is_resolved);

-- Token blacklist indexes
CREATE INDEX IF NOT EXISTS idx_token_blacklist_token_id ON token_blacklist(token_id);
CREATE INDEX IF NOT EXISTS idx_token_blacklist_token_type ON token_blacklist(token_type);
CREATE INDEX IF NOT EXISTS idx_token_blacklist_user_id ON token_blacklist(user_id);
CREATE INDEX IF NOT EXISTS idx_token_blacklist_tenant_id ON token_blacklist(tenant_id);
CREATE INDEX IF NOT EXISTS idx_token_blacklist_expires_at ON token_blacklist(expires_at);
CREATE INDEX IF NOT EXISTS idx_token_blacklist_revoked_at ON token_blacklist(revoked_at);

-- Rate limiting indexes
CREATE INDEX IF NOT EXISTS idx_rate_limits_tenant_id ON rate_limits(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rate_limits_user_id ON rate_limits(user_id);
CREATE INDEX IF NOT EXISTS idx_rate_limits_ip_address ON rate_limits(ip_address);
CREATE INDEX IF NOT EXISTS idx_rate_limits_resource_type ON rate_limits(resource_type);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window_start ON rate_limits(window_start);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window_end ON rate_limits(window_end);
CREATE INDEX IF NOT EXISTS idx_rate_limits_is_blocked ON rate_limits(is_blocked);
CREATE INDEX IF NOT EXISTS idx_rate_limits_blocked_until ON rate_limits(blocked_until);

-- Security settings indexes
CREATE INDEX IF NOT EXISTS idx_security_settings_tenant_id ON security_settings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_security_settings_setting_key ON security_settings(setting_key);
CREATE INDEX IF NOT EXISTS idx_security_settings_is_active ON security_settings(is_active);

-- API key usage indexes
CREATE INDEX IF NOT EXISTS idx_api_key_usage_api_key_id ON api_key_usage(api_key_id);
CREATE INDEX IF NOT EXISTS idx_api_key_usage_tenant_id ON api_key_usage(tenant_id);
CREATE INDEX IF NOT EXISTS idx_api_key_usage_user_id ON api_key_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_api_key_usage_request_id ON api_key_usage(request_id);
CREATE INDEX IF NOT EXISTS idx_api_key_usage_created_at ON api_key_usage(created_at);
CREATE INDEX IF NOT EXISTS idx_api_key_usage_endpoint ON api_key_usage(endpoint);

-- Session analytics indexes
CREATE INDEX IF NOT EXISTS idx_session_analytics_session_id ON session_analytics(session_id);
CREATE INDEX IF NOT EXISTS idx_session_analytics_tenant_id ON session_analytics(tenant_id);
CREATE INDEX IF NOT EXISTS idx_session_analytics_user_id ON session_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_session_analytics_event_type ON session_analytics(event_type);
CREATE INDEX IF NOT EXISTS idx_session_analytics_created_at ON session_analytics(created_at);

-- Create triggers for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to tables with updated_at columns. DROP IF EXISTS
-- before each CREATE so this migration is re-runnable; PG14+ has
-- CREATE OR REPLACE TRIGGER but we don't want to require 14+.
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tenants_updated_at ON tenants;
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_security_settings_updated_at ON security_settings;
CREATE TRIGGER update_security_settings_updated_at BEFORE UPDATE ON security_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_rate_limits_updated_at ON rate_limits;
CREATE TRIGGER update_rate_limits_updated_at BEFORE UPDATE ON rate_limits
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create Row Level Security (RLS) policies for multi-tenant security
ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_verification_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE mfa_backup_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_blacklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_key_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_analytics ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view their own password reset tokens" ON password_reset_tokens;
CREATE POLICY "Users can view their own password reset tokens" ON password_reset_tokens
    FOR SELECT USING (current_setting('app.current_user_id', true)::UUID = user_id);

DROP POLICY IF EXISTS "Users can view their own email verification tokens" ON email_verification_tokens;
CREATE POLICY "Users can view their own email verification tokens" ON email_verification_tokens
    FOR SELECT USING (current_setting('app.current_user_id', true)::UUID = user_id);

DROP POLICY IF EXISTS "Users can view their own MFA backup codes" ON mfa_backup_codes;
CREATE POLICY "Users can view their own MFA backup codes" ON mfa_backup_codes
    FOR SELECT USING (current_setting('app.current_user_id', true)::UUID = user_id);

DROP POLICY IF EXISTS "Users can view their own devices" ON user_devices;
CREATE POLICY "Users can view their own devices" ON user_devices
    FOR SELECT USING (current_setting('app.current_user_id', true)::UUID = user_id);

DROP POLICY IF EXISTS "Users can view their own security events" ON security_events;
CREATE POLICY "Users can view their own security events" ON security_events
    FOR SELECT USING (current_setting('app.current_user_id', true)::UUID = user_id);

DROP POLICY IF EXISTS "Users can view their own token blacklist entries" ON token_blacklist;
CREATE POLICY "Users can view their own token blacklist entries" ON token_blacklist
    FOR SELECT USING (current_setting('app.current_user_id', true)::UUID = user_id);

DROP POLICY IF EXISTS "Users can view their own rate limits" ON rate_limits;
CREATE POLICY "Users can view their own rate limits" ON rate_limits
    FOR SELECT USING (current_setting('app.current_user_id', true)::UUID = user_id);

DROP POLICY IF EXISTS "Tenant members can view tenant security settings" ON security_settings;
CREATE POLICY "Tenant members can view tenant security settings" ON security_settings
    FOR SELECT USING (current_setting('app.current_tenant_id', true)::UUID = tenant_id);

-- Create views for common security queries
CREATE OR REPLACE VIEW user_security_summary AS
SELECT
    u.id,
    u.tenant_id,
    u.email,
    u.role,
    u.is_active,
    u.email_verified,
    u.mfa_enabled,
    u.failed_login_attempts,
    u.locked_until,
    u.last_login,
    u.created_at,
    u.updated_at,
    COUNT(DISTINCT ud.id) as device_count,
    COUNT(DISTINCT fl.id) as failed_login_count_24h,
    COUNT(DISTINCT se.id) as security_events_7d
FROM users u
LEFT JOIN user_devices ud ON u.id = ud.user_id
LEFT JOIN failed_login_attempts fl ON u.email = fl.email AND fl.attempted_at > NOW() - INTERVAL '24 hours'
LEFT JOIN security_events se ON u.id = se.user_id AND se.created_at > NOW() - INTERVAL '7 days'
GROUP BY u.id, u.tenant_id, u.email, u.role, u.is_active, u.email_verified, u.mfa_enabled,
         u.failed_login_attempts, u.locked_until, u.last_login, u.created_at, u.updated_at;

CREATE OR REPLACE VIEW tenant_security_overview AS
SELECT
    t.id as tenant_id,
    t.name as tenant_name,
    t.status,
    COUNT(DISTINCT u.id) as total_users,
    COUNT(DISTINCT CASE WHEN u.is_active THEN u.id END) as active_users,
    COUNT(DISTINCT CASE WHEN u.mfa_enabled THEN u.id END) as mfa_users,
    COUNT(DISTINCT CASE WHEN u.email_verified THEN u.id END) as verified_users,
    COUNT(DISTINCT fl.id) as failed_logins_24h,
    COUNT(DISTINCT se.id) as security_events_7d,
    COUNT(DISTINCT ak.id) as active_api_keys,
    COUNT(DISTINCT us.id) as active_sessions,
    MAX(u.last_login) as last_user_login
FROM tenants t
LEFT JOIN users u ON t.id = u.tenant_id
LEFT JOIN failed_login_attempts fl ON t.id = fl.tenant_id AND fl.attempted_at > NOW() - INTERVAL '24 hours'
LEFT JOIN security_events se ON t.id = se.tenant_id AND se.created_at > NOW() - INTERVAL '7 days'
LEFT JOIN api_keys ak ON t.id = ak.tenant_id AND ak.is_active AND ak.expires_at > NOW()
LEFT JOIN user_sessions us ON t.id = us.tenant_id AND us.is_active AND us.expires_at > NOW()
GROUP BY t.id, t.name, t.status;

-- Insert default security settings for all existing tenants
INSERT INTO security_settings (tenant_id, setting_key, setting_value, description)
SELECT
    id,
    'password_policy',
    '{
        "min_length": 8,
        "require_uppercase": true,
        "require_lowercase": true,
        "require_numbers": true,
        "require_symbols": false,
        "prevent_reuse": 5,
        "max_age_days": 90
    }',
    'Password security policy settings'
FROM tenants
ON CONFLICT (tenant_id, setting_key) DO NOTHING;

INSERT INTO security_settings (tenant_id, setting_key, setting_value, description)
SELECT
    id,
    'session_policy',
    '{
        "timeout_minutes": 1440,
        "max_concurrent_sessions": 5,
        "require_mfa_for_new_session": false,
        "idle_timeout_minutes": 30
    }',
    'Session management policy settings'
FROM tenants
ON CONFLICT (tenant_id, setting_key) DO NOTHING;

INSERT INTO security_settings (tenant_id, setting_key, setting_value, description)
SELECT
    id,
    'mfa_policy',
    '{
        "required": false,
        "methods": ["totp", "sms", "email"],
        "backup_codes_count": 10,
        "remember_device_days": 30
    }',
    'Multi-factor authentication policy settings'
FROM tenants
ON CONFLICT (tenant_id, setting_key) DO NOTHING;

-- Create functions for common security operations

CREATE OR REPLACE FUNCTION lock_user_account(user_uuid UUID, lock_duration_minutes INTEGER DEFAULT 15)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE users
    SET locked_until = NOW() + (lock_duration_minutes || ' minutes')::INTERVAL,
        updated_at = NOW()
    WHERE id = user_uuid;

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION unlock_user_account(user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE users
    SET locked_until = NULL,
        failed_login_attempts = 0,
        updated_at = NOW()
    WHERE id = user_uuid;

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION record_security_event(
    tenant_uuid UUID,
    user_uuid UUID,
    event_type_param VARCHAR(100),
    event_severity_param VARCHAR(20) DEFAULT 'info',
    event_category_param VARCHAR(50) DEFAULT NULL,
    description_param TEXT DEFAULT NULL,
    ip_address_param INET DEFAULT NULL,
    user_agent_param TEXT DEFAULT NULL,
    session_id_param UUID DEFAULT NULL,
    request_id_param UUID DEFAULT NULL,
    resource_type_param VARCHAR(100) DEFAULT NULL,
    resource_id_param UUID DEFAULT NULL,
    details_param JSONB DEFAULT '{}',
    risk_score_param DECIMAL(3,2) DEFAULT 0.0
)
RETURNS UUID AS $$
DECLARE
    event_id UUID;
BEGIN
    INSERT INTO security_events (
        tenant_id, user_id, event_type, event_severity, event_category,
        description, ip_address, user_agent, session_id, request_id,
        resource_type, resource_id, details, risk_score
    ) VALUES (
        tenant_uuid, user_uuid, event_type_param, event_severity_param, event_category_param,
        description_param, ip_address_param, user_agent_param, session_id_param, request_id_param,
        resource_type_param, resource_id_param, details_param, risk_score_param
    ) RETURNING id INTO event_id;

    RETURN event_id;
END;
$$ LANGUAGE plpgsql;

-- Create procedure for cleaning up expired tokens and old security data
CREATE OR REPLACE FUNCTION cleanup_security_data()
RETURNS void AS $$
BEGIN
    -- Clean up expired password reset tokens
    DELETE FROM password_reset_tokens WHERE expires_at < NOW() - INTERVAL '7 days';

    -- Clean up expired email verification tokens
    DELETE FROM email_verification_tokens WHERE expires_at < NOW() - INTERVAL '7 days';

    -- Clean up used MFA backup codes that are older than 30 days
    DELETE FROM mfa_backup_codes WHERE is_used = true AND used_at < NOW() - INTERVAL '30 days';

    -- Clean up expired token blacklist entries
    DELETE FROM token_blacklist WHERE expires_at < NOW();

    -- Clean up old failed login attempts (keep last 90 days)
    DELETE FROM failed_login_attempts WHERE attempted_at < NOW() - INTERVAL '90 days';

    -- Clean up old session analytics (keep last 1 year)
    DELETE FROM session_analytics WHERE created_at < NOW() - INTERVAL '1 year';

    -- Clean up old API key usage logs (keep last 90 days)
    DELETE FROM api_key_usage WHERE created_at < NOW() - INTERVAL '90 days';

    -- Clean up old rate limiting records (keep last 24 hours)
    DELETE FROM rate_limits WHERE window_end < NOW() - INTERVAL '24 hours';

    RAISE NOTICE 'Security data cleanup completed';
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions (adjust as needed for your setup)
-- GRANT USAGE ON SCHEMA public TO authenticated_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated_user;
-- GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated_user;

-- Log migration completion
DO $$
BEGIN
    RAISE NOTICE 'Authentication system schema migration completed successfully';
END $$;
