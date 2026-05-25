-- Authentication System Database Schema
-- Comprehensive authentication and authorization tables for SDLC.ai platform

-- Authentication Events table - Track all authentication attempts
CREATE TABLE authentication_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    event_type VARCHAR(100) NOT NULL, -- 'login_attempt', 'login_success', 'login_failure', 'logout', 'token_refresh', 'password_change'
    outcome VARCHAR(50) NOT NULL, -- 'success', 'failure', 'blocked', 'mfa_required'
    email VARCHAR(255) NOT NULL,
    ip_address INET,
    user_agent TEXT,
    device_fingerprint VARCHAR(255),
    session_id UUID REFERENCES user_sessions(id),
    token_id VARCHAR(255),
    failure_reason VARCHAR(255),
    failure_details JSONB DEFAULT '{}',
    request_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    geo_location JSONB DEFAULT '{}', -- {country: "US", city: "San Francisco", lat: 37.7749, lng: -122.4194}
    security_flags JSONB DEFAULT '{}', -- {suspicious: false, brute_force: false, new_device: false}
    risk_score DECIMAL(3,2) CHECK (risk_score >= 0 AND risk_score <= 1)
);

-- Multi-Factor Authentication table - Store MFA configurations and backup codes
CREATE TABLE mfa_configurations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    method VARCHAR(50) NOT NULL, -- 'totp', 'sms', 'email', 'hardware_key'
    is_enabled BOOLEAN DEFAULT false,
    is_primary BOOLEAN DEFAULT false,
    secret_key_encrypted BYTEA, -- Encrypted TOTP secret
    phone_number_encrypted BYTEA, -- Encrypted phone number for SMS
    email_encrypted BYTEA, -- Encrypted email for email-based MFA
    backup_codes_encrypted BYTEA, -- Encrypted backup codes
    device_identifier VARCHAR(255), -- Hardware key identifier
    public_key TEXT, -- Hardware key public key
    counter INTEGER DEFAULT 0, -- Counter for HOTP
    last_used_at TIMESTAMPTZ,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    UNIQUE(user_id, method)
);

-- MFA Verification Attempts table - Track MFA verification attempts
CREATE TABLE mfa_verification_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    method VARCHAR(50) NOT NULL,
    code_or_token VARCHAR(255), -- The provided code/token (masked in logs)
    outcome VARCHAR(50) NOT NULL, -- 'success', 'failure', 'rate_limited', 'invalid_method'
    failure_reason VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    device_fingerprint VARCHAR(255),
    session_id UUID REFERENCES user_sessions(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

-- Password History table - Track password history to prevent reuse
CREATE TABLE password_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    password_hash VARCHAR(255) NOT NULL,
    password_algorithm VARCHAR(50) DEFAULT 'argon2id',
    password_strength_score DECIMAL(3,2) CHECK (password_strength_score >= 0 AND password_strength_score <= 1),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '1 year'), // Keep for 1 year
    metadata JSONB DEFAULT '{}'
);

-- Password Reset Tokens table - Store password reset tokens
CREATE TABLE password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) UNIQUE NOT NULL, -- SHA-256 hash of the token
    token_prefix VARCHAR(20) NOT NULL, -- First few characters for identification
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    used_at TIMESTAMPTZ,
    ip_address INET,
    user_agent TEXT,
    device_fingerprint VARCHAR(255),
    is_used BOOLEAN DEFAULT false,
    metadata JSONB DEFAULT '{}'
);

-- Email Verification Tokens table - Store email verification tokens
CREATE TABLE email_verification_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    token_hash VARCHAR(255) UNIQUE NOT NULL, -- SHA-256 hash of the token
    token_prefix VARCHAR(20) NOT NULL, -- First few characters for identification
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    used_at TIMESTAMPTZ,
    ip_address INET,
    user_agent TEXT,
    device_fingerprint VARCHAR(255),
    is_used BOOLEAN DEFAULT false,
    metadata JSONB DEFAULT '{}'
);

-- Device Trust table - Track trusted devices for users
CREATE TABLE trusted_devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    device_fingerprint VARCHAR(255) NOT NULL,
    device_name VARCHAR(255),
    device_type VARCHAR(100), -- 'mobile', 'desktop', 'tablet', 'unknown'
    platform VARCHAR(100), -- 'iOS', 'Android', 'Windows', 'macOS', 'Linux'
    is_trusted BOOLEAN DEFAULT false,
    trust_expires_at TIMESTAMPTZ,
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    first_seen_at TIMESTAMPTZ DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT,
    location JSONB DEFAULT '{}', -- {country: "US", city: "San Francisco"}
    metadata JSONB DEFAULT '{}',
    UNIQUE(user_id, device_fingerprint)
);

-- Security Events table - Track security-related events
CREATE TABLE security_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    event_type VARCHAR(100) NOT NULL, -- 'account_locked', 'account_unlocked', 'suspicious_activity', 'data_breach_attempt'
    severity VARCHAR(50) NOT NULL, -- 'low', 'medium', 'high', 'critical'
    title VARCHAR(255) NOT NULL,
    description TEXT,
    ip_address INET,
    user_agent TEXT,
    device_fingerprint VARCHAR(255),
    affected_resources JSONB DEFAULT '[]', -- Array of affected resource IDs
    mitigation_actions JSONB DEFAULT '[]', -- Actions taken to mitigate
    created_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES users(id),
    is_resolved BOOLEAN DEFAULT false,
    metadata JSONB DEFAULT '{}'
);

-- Brute Force Protection table - Track IP-based brute force attempts
CREATE TABLE brute_force_protection (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ip_address INET NOT NULL,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    email VARCHAR(255),
    attempt_type VARCHAR(100) NOT NULL, -- 'login', 'password_reset', 'mfa_verification'
    failure_count INTEGER DEFAULT 1,
    last_attempt_at TIMESTAMPTZ DEFAULT NOW(),
    is_blocked BOOLEAN DEFAULT false,
    blocked_until TIMESTAMPTZ,
    block_reason VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

-- Rate Limiting table - Track API rate limiting per user/IP
CREATE TABLE rate_limits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    identifier VARCHAR(255) NOT NULL, -- Can be user_id, IP address, or API key
    identifier_type VARCHAR(50) NOT NULL, -- 'user', 'ip', 'api_key'
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    resource VARCHAR(255) NOT NULL, -- 'api', 'auth', 'upload', etc.
    window_start TIMESTAMPTZ NOT NULL,
    window_end TIMESTAMPTZ NOT NULL,
    request_count INTEGER DEFAULT 1,
    limit_threshold INTEGER NOT NULL,
    is_blocked BOOLEAN DEFAULT false,
    blocked_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

-- Session Security table - Enhanced session tracking with security features
CREATE TABLE session_security (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES user_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    ip_address INET NOT NULL,
    user_agent TEXT NOT NULL,
    device_fingerprint VARCHAR(255),
    location JSONB DEFAULT '{}',
    security_flags JSONB DEFAULT '{}', -- {vpn: false, tor: false, suspicious: false}
    risk_score DECIMAL(3,2) CHECK (risk_score >= 0 AND risk_score <= 1),
    is_anomalous BOOLEAN DEFAULT false,
    anomaly_reasons JSONB DEFAULT '[]', -- Array of anomaly reasons
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_activity TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

-- API Key Authentication Events table - Track API key usage
CREATE TABLE api_key_auth_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    api_key_id UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    event_type VARCHAR(100) NOT NULL, -- 'access_granted', 'access_denied', 'rate_limited', 'key_expired'
    outcome VARCHAR(50) NOT NULL, -- 'success', 'failure'
    request_id UUID,
    ip_address INET,
    user_agent TEXT,
    endpoint VARCHAR(1000),
    http_method VARCHAR(10),
    response_status INTEGER,
    processing_time_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

-- Authentication Settings table - Per-tenant authentication settings
CREATE TABLE authentication_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    setting_key VARCHAR(255) NOT NULL,
    setting_value JSONB NOT NULL,
    description TEXT,
    is_encrypted BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES users(id),
    metadata JSONB DEFAULT '{}',
    UNIQUE(tenant_id, setting_key)
);

-- Create indexes for performance

-- Authentication Events indexes
CREATE INDEX idx_authentication_events_tenant_id ON authentication_events(tenant_id);
CREATE INDEX idx_authentication_events_user_id ON authentication_events(user_id);
CREATE INDEX idx_authentication_events_event_type ON authentication_events(event_type);
CREATE INDEX idx_authentication_events_outcome ON authentication_events(outcome);
CREATE INDEX idx_authentication_events_email ON authentication_events(email);
CREATE INDEX idx_authentication_events_created_at ON authentication_events(created_at);
CREATE INDEX idx_authentication_events_ip_address ON authentication_events(ip_address);
CREATE INDEX idx_authentication_events_device_fingerprint ON authentication_events(device_fingerprint);
CREATE INDEX idx_authentication_events_session_id ON authentication_events(session_id);
CREATE INDEX idx_authentication_events_risk_score ON authentication_events(risk_score);

-- MFA Configurations indexes
CREATE INDEX idx_mfa_configurations_user_id ON mfa_configurations(user_id);
CREATE INDEX idx_mfa_configurations_tenant_id ON mfa_configurations(tenant_id);
CREATE INDEX idx_mfa_configurations_method ON mfa_configurations(method);
CREATE INDEX idx_mfa_configurations_is_enabled ON mfa_configurations(is_enabled);
CREATE INDEX idx_mfa_configurations_is_primary ON mfa_configurations(is_primary);

-- MFA Verification Attempts indexes
CREATE INDEX idx_mfa_verification_attempts_user_id ON mfa_verification_attempts(user_id);
CREATE INDEX idx_mfa_verification_attempts_tenant_id ON mfa_verification_attempts(tenant_id);
CREATE INDEX idx_mfa_verification_attempts_method ON mfa_verification_attempts(method);
CREATE INDEX idx_mfa_verification_attempts_outcome ON mfa_verification_attempts(outcome);
CREATE INDEX idx_mfa_verification_attempts_created_at ON mfa_verification_attempts(created_at);

-- Password History indexes
CREATE INDEX idx_password_history_user_id ON password_history(user_id);
CREATE INDEX idx_password_history_tenant_id ON password_history(tenant_id);
CREATE INDEX idx_password_history_created_at ON password_history(created_at);
CREATE INDEX idx_password_history_expires_at ON password_history(expires_at);

-- Password Reset Tokens indexes
CREATE INDEX idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX idx_password_reset_tokens_tenant_id ON password_reset_tokens(tenant_id);
CREATE INDEX idx_password_reset_tokens_token_hash ON password_reset_tokens(token_hash);
CREATE INDEX idx_password_reset_tokens_token_prefix ON password_reset_tokens(token_prefix);
CREATE INDEX idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);
CREATE INDEX idx_password_reset_tokens_is_used ON password_reset_tokens(is_used);

-- Email Verification Tokens indexes
CREATE INDEX idx_email_verification_tokens_user_id ON email_verification_tokens(user_id);
CREATE INDEX idx_email_verification_tokens_tenant_id ON email_verification_tokens(tenant_id);
CREATE INDEX idx_email_verification_tokens_token_hash ON email_verification_tokens(token_hash);
CREATE INDEX idx_email_verification_tokens_token_prefix ON email_verification_tokens(token_prefix);
CREATE INDEX idx_email_verification_tokens_expires_at ON email_verification_tokens(expires_at);
CREATE INDEX idx_email_verification_tokens_is_used ON email_verification_tokens(is_used);

-- Trusted Devices indexes
CREATE INDEX idx_trusted_devices_user_id ON trusted_devices(user_id);
CREATE INDEX idx_trusted_devices_tenant_id ON trusted_devices(tenant_id);
CREATE INDEX idx_trusted_devices_device_fingerprint ON trusted_devices(device_fingerprint);
CREATE INDEX idx_trusted_devices_is_trusted ON trusted_devices(is_trusted);
CREATE INDEX idx_trusted_devices_trust_expires_at ON trusted_devices(trust_expires_at);
CREATE INDEX idx_trusted_devices_last_seen_at ON trusted_devices(last_seen_at);

-- Security Events indexes
CREATE INDEX idx_security_events_tenant_id ON security_events(tenant_id);
CREATE INDEX idx_security_events_user_id ON security_events(user_id);
CREATE INDEX idx_security_events_event_type ON security_events(event_type);
CREATE INDEX idx_security_events_severity ON security_events(severity);
CREATE INDEX idx_security_events_created_at ON security_events(created_at);
CREATE INDEX idx_security_events_is_resolved ON security_events(is_resolved);
CREATE INDEX idx_security_events_severity_created_at ON security_events(severity, created_at);

-- Brute Force Protection indexes
CREATE INDEX idx_brute_force_protection_ip_address ON brute_force_protection(ip_address);
CREATE INDEX idx_brute_force_protection_tenant_id ON brute_force_protection(tenant_id);
CREATE INDEX idx_brute_force_protection_user_id ON brute_force_protection(user_id);
CREATE INDEX idx_brute_force_protection_email ON brute_force_protection(email);
CREATE INDEX idx_brute_force_protection_attempt_type ON brute_force_protection(attempt_type);
CREATE INDEX idx_brute_force_protection_is_blocked ON brute_force_protection(is_blocked);
CREATE INDEX idx_brute_force_protection_blocked_until ON brute_force_protection(blocked_until);

-- Rate Limits indexes
CREATE INDEX idx_rate_limits_identifier ON rate_limits(identifier);
CREATE INDEX idx_rate_limits_identifier_type ON rate_limits(identifier_type);
CREATE INDEX idx_rate_limits_tenant_id ON rate_limits(tenant_id);
CREATE INDEX idx_rate_limits_resource ON rate_limits(resource);
CREATE INDEX idx_rate_limits_window_start ON rate_limits(window_start);
CREATE INDEX idx_rate_limits_window_end ON rate_limits(window_end);
CREATE INDEX idx_rate_limits_is_blocked ON rate_limits(is_blocked);

-- Session Security indexes
CREATE INDEX idx_session_security_session_id ON session_security(session_id);
CREATE INDEX idx_session_security_user_id ON session_security(user_id);
CREATE INDEX idx_session_security_tenant_id ON session_security(tenant_id);
CREATE INDEX idx_session_security_ip_address ON session_security(ip_address);
CREATE INDEX idx_session_security_device_fingerprint ON session_security(device_fingerprint);
CREATE INDEX idx_session_security_is_anomalous ON session_security(is_anomalous);
CREATE INDEX idx_session_security_risk_score ON session_security(risk_score);
CREATE INDEX idx_session_security_last_activity ON session_security(last_activity);

-- API Key Auth Events indexes
CREATE INDEX idx_api_key_auth_events_api_key_id ON api_key_auth_events(api_key_id);
CREATE INDEX idx_api_key_auth_events_tenant_id ON api_key_auth_events(tenant_id);
CREATE INDEX idx_api_key_auth_events_user_id ON api_key_auth_events(user_id);
CREATE INDEX idx_api_key_auth_events_event_type ON api_key_auth_events(event_type);
CREATE INDEX idx_api_key_auth_events_outcome ON api_key_auth_events(outcome);
CREATE INDEX idx_api_key_auth_events_created_at ON api_key_auth_events(created_at);
CREATE INDEX idx_api_key_auth_events_ip_address ON api_key_auth_events(ip_address);

-- Authentication Settings indexes
CREATE INDEX idx_authentication_settings_tenant_id ON authentication_settings(tenant_id);
CREATE INDEX idx_authentication_settings_setting_key ON authentication_settings(setting_key);
CREATE INDEX idx_authentication_settings_updated_at ON authentication_settings(updated_at);

-- Create constraints and checks

ALTER TABLE authentication_events ADD CONSTRAINT chk_auth_event_type CHECK (event_type IN ('login_attempt', 'login_success', 'login_failure', 'logout', 'token_refresh', 'password_change', 'mfa_setup', 'mfa_verification', 'account_locked', 'account_unlocked', 'password_reset', 'email_verification'));
ALTER TABLE authentication_events ADD CONSTRAINT chk_auth_outcome CHECK (outcome IN ('success', 'failure', 'blocked', 'mfa_required', 'rate_limited'));
ALTER TABLE mfa_configurations ADD CONSTRAINT chk_mfa_method CHECK (method IN ('totp', 'sms', 'email', 'hardware_key', 'backup_code'));
ALTER TABLE mfa_verification_attempts ADD CONSTRAINT chk_mfa_outcome CHECK (outcome IN ('success', 'failure', 'rate_limited', 'invalid_method', 'expired'));
ALTER TABLE trusted_devices ADD CONSTRAINT chk_device_type CHECK (device_type IN ('mobile', 'desktop', 'tablet', 'unknown'));
ALTER TABLE security_events ADD CONSTRAINT chk_security_event_type CHECK (event_type IN ('account_locked', 'account_unlocked', 'suspicious_activity', 'data_breach_attempt', 'privilege_escalation', 'unauthorized_access'));
ALTER TABLE security_events ADD CONSTRAINT chk_severity CHECK (severity IN ('low', 'medium', 'high', 'critical'));
ALTER TABLE brute_force_protection ADD CONSTRAINT chk_brute_force_attempt_type CHECK (attempt_type IN ('login', 'password_reset', 'mfa_verification', 'api_access'));
ALTER TABLE rate_limits ADD CONSTRAINT chk_identifier_type CHECK (identifier_type IN ('user', 'ip', 'api_key'));

-- Create triggers for automatic timestamp updates

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to tables with updated_at columns
CREATE TRIGGER update_mfa_configurations_updated_at BEFORE UPDATE ON mfa_configurations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_brute_force_protection_updated_at BEFORE UPDATE ON brute_force_protection FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_rate_limits_updated_at BEFORE UPDATE ON rate_limits FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_session_security_updated_at BEFORE UPDATE ON session_security FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_authentication_settings_updated_at BEFORE UPDATE ON authentication_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create functions for cleanup and maintenance

-- Function to cleanup expired tokens and old records
CREATE OR REPLACE FUNCTION cleanup_expired_auth_data()
RETURNS void AS $$
BEGIN
    -- Delete expired password reset tokens
    DELETE FROM password_reset_tokens WHERE expires_at < NOW() AND is_used = true;

    -- Delete expired email verification tokens
    DELETE FROM email_verification_tokens WHERE expires_at < NOW() AND is_used = true;

    -- Delete old password history (older than 1 year)
    DELETE FROM password_history WHERE expires_at < NOW();

    -- Delete old authentication events (older than 1 year)
    DELETE FROM authentication_events WHERE created_at < NOW() - INTERVAL '1 year';

    -- Delete old MFA verification attempts (older than 90 days)
    DELETE FROM mfa_verification_attempts WHERE created_at < NOW() - INTERVAL '90 days';

    -- Delete old brute force records (older than 30 days)
    DELETE FROM brute_force_protection WHERE updated_at < NOW() - INTERVAL '30 days';

    -- Delete old rate limit records (older than 24 hours)
    DELETE FROM rate_limits WHERE window_end < NOW() - INTERVAL '24 hours';

    -- Delete expired trusted devices
    DELETE FROM trusted_devices WHERE trust_expires_at < NOW() AND is_trusted = false;

    RAISE NOTICE 'Authentication data cleanup completed';
END;
$$ LANGUAGE plpgsql;

-- Function to get user authentication statistics
CREATE OR REPLACE FUNCTION get_user_auth_stats(p_user_id UUID, p_tenant_id UUID, p_days INTEGER DEFAULT 30)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'login_attempts', (
            SELECT COUNT(*)
            FROM authentication_events
            WHERE user_id = p_user_id
            AND tenant_id = p_tenant_id
            AND event_type = 'login_attempt'
            AND created_at >= NOW() - INTERVAL '%s days'
        ),
        'successful_logins', (
            SELECT COUNT(*)
            FROM authentication_events
            WHERE user_id = p_user_id
            AND tenant_id = p_tenant_id
            AND event_type = 'login_success'
            AND created_at >= NOW() - INTERVAL '%s days'
        ),
        'failed_logins', (
            SELECT COUNT(*)
            FROM authentication_events
            WHERE user_id = p_user_id
            AND tenant_id = p_tenant_id
            AND event_type = 'login_failure'
            AND created_at >= NOW() - INTERVAL '%s days'
        ),
        'unique_ips', (
            SELECT COUNT(DISTINCT ip_address)
            FROM authentication_events
            WHERE user_id = p_user_id
            AND tenant_id = p_tenant_id
            AND created_at >= NOW() - INTERVAL '%s days'
        ),
        'unique_devices', (
            SELECT COUNT(DISTINCT device_fingerprint)
            FROM authentication_events
            WHERE user_id = p_user_id
            AND tenant_id = p_tenant_id
            AND device_fingerprint IS NOT NULL
            AND created_at >= NOW() - INTERVAL '%s days'
        ),
        'last_login', (
            SELECT created_at
            FROM authentication_events
            WHERE user_id = p_user_id
            AND tenant_id = p_tenant_id
            AND event_type = 'login_success'
            ORDER BY created_at DESC
            LIMIT 1
        ),
        'account_status', (
            SELECT jsonb_build_object(
                'is_locked', u.locked_until > NOW(),
                'failed_attempts', u.failed_login_attempts,
                'mfa_enabled', u.mfa_enabled,
                'email_verified', u.email_verified,
                'last_login', u.last_login
            )
            FROM users u
            WHERE u.id = p_user_id AND u.tenant_id = p_tenant_id
        )
    ) INTO result
    FROM dual;

    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Insert default authentication settings for all existing tenants
INSERT INTO authentication_settings (tenant_id, setting_key, setting_value, description)
SELECT
    t.id,
    'password_policy',
    jsonb_build_object(
        'min_length', 8,
        'require_uppercase', true,
        'require_lowercase', true,
        'require_numbers', true,
        'require_symbols', false,
        'max_age_days', 90,
        'prevent_reuse', 5
    ),
    'Password security policy settings'
FROM tenants t
WHERE NOT EXISTS (
    SELECT 1 FROM authentication_settings asettings
    WHERE asettings.tenant_id = t.id AND asettings.setting_key = 'password_policy'
);

INSERT INTO authentication_settings (tenant_id, setting_key, setting_value, description)
SELECT
    t.id,
    'mfa_settings',
    jsonb_build_object(
        'required_for_admins', false,
        'required_for_users', false,
        'allow_backup_codes', true,
        'backup_code_count', 10,
        'totp_window', 30
    ),
    'Multi-factor authentication settings'
FROM tenants t
WHERE NOT EXISTS (
    SELECT 1 FROM authentication_settings asettings
    WHERE asettings.tenant_id = t.id AND asettings.setting_key = 'mfa_settings'
);

INSERT INTO authentication_settings (tenant_id, setting_key, setting_value, description)
SELECT
    t.id,
    'session_settings',
    jsonb_build_object(
        'timeout_minutes', 1440, -- 24 hours
        'max_concurrent_sessions', 5,
        'require_device_verification', false,
        'auto_extend_on_activity', true
    ),
    'Session management settings'
FROM tenants t
WHERE NOT EXISTS (
    SELECT 1 FROM authentication_settings asettings
    WHERE asettings.tenant_id = t.id AND asettings.setting_key = 'session_settings'
);

COMMIT;
