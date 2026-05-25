-- Create SSO providers table
CREATE TABLE IF NOT EXISTS sso_providers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('saml', 'oidc')),
    entity_id TEXT,
    metadata_url TEXT,
    metadata_xml TEXT,
    client_id TEXT,
    client_secret TEXT, -- Encrypted at rest
    auth_url TEXT,
    token_url TEXT,
    user_info_url TEXT,
    scopes TEXT DEFAULT 'openid email profile',
    enabled BOOLEAN DEFAULT true,
    auto_provision BOOLEAN DEFAULT true,
    default_role VARCHAR(50) DEFAULT 'user',
    default_plan VARCHAR(50) DEFAULT 'free',
    attribute_mapping JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on provider type
CREATE INDEX idx_sso_providers_type ON sso_providers(type);
CREATE INDEX idx_sso_providers_enabled ON sso_providers(enabled);

-- Create SSO identities table
CREATE TABLE IF NOT EXISTS sso_identities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    provider_id UUID NOT NULL REFERENCES sso_providers(id) ON DELETE CASCADE,
    external_id VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    attributes JSONB DEFAULT '{}',
    last_authenticated TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(provider_id, external_id)
);

-- Create indexes for identities
CREATE INDEX idx_sso_identities_user_id ON sso_identities(user_id);
CREATE INDEX idx_sso_identities_provider_id ON sso_identities(provider_id);
CREATE INDEX idx_sso_identities_email ON sso_identities(email);
CREATE INDEX idx_sso_identities_external_id ON sso_identities(external_id);

-- Create SSO sessions table
CREATE TABLE IF NOT EXISTS sso_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identity_id UUID REFERENCES sso_identities(id) ON DELETE CASCADE,
    request_id VARCHAR(255) UNIQUE, -- For SAML
    state VARCHAR(255) UNIQUE, -- For OIDC
    nonce VARCHAR(255), -- For OIDC
    redirect_url TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for sessions
CREATE INDEX idx_sso_sessions_identity_id ON sso_sessions(identity_id);
CREATE INDEX idx_sso_sessions_request_id ON sso_sessions(request_id);
CREATE INDEX idx_sso_sessions_state ON sso_sessions(state);
CREATE INDEX idx_sso_sessions_expires_at ON sso_sessions(expires_at);
CREATE INDEX idx_sso_sessions_active ON sso_sessions(is_active);

-- Create enterprise settings table
CREATE TABLE IF NOT EXISTS enterprise_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id VARCHAR(255) NOT NULL UNIQUE,
    provider_id UUID NOT NULL REFERENCES sso_providers(id) ON DELETE CASCADE,
    require_sso BOOLEAN DEFAULT false,
    allow_local_login BOOLEAN DEFAULT true,
    domain_whitelist TEXT, -- Comma-separated list
    role_mappings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for enterprise settings
CREATE INDEX idx_enterprise_settings_organization_id ON enterprise_settings(organization_id);
CREATE INDEX idx_enterprise_settings_provider_id ON enterprise_settings(provider_id);

-- Create audit log for SSO events
CREATE TABLE IF NOT EXISTS sso_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(100) NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    provider_id UUID REFERENCES sso_providers(id) ON DELETE SET NULL,
    identity_id UUID REFERENCES sso_identities(id) ON DELETE SET NULL,
    ip_address INET,
    user_agent TEXT,
    details JSONB DEFAULT '{}',
    success BOOLEAN NOT NULL,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for audit log
CREATE INDEX idx_sso_audit_log_event_type ON sso_audit_log(event_type);
CREATE INDEX idx_sso_audit_log_user_id ON sso_audit_log(user_id);
CREATE INDEX idx_sso_audit_log_provider_id ON sso_audit_log(provider_id);
CREATE INDEX idx_sso_audit_log_created_at ON sso_audit_log(created_at);
CREATE INDEX idx_sso_audit_log_success ON sso_audit_log(success);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_sso_providers_updated_at BEFORE UPDATE ON sso_providers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sso_identities_updated_at BEFORE UPDATE ON sso_identities
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sso_sessions_updated_at BEFORE UPDATE ON sso_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_enterprise_settings_updated_at BEFORE UPDATE ON enterprise_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default SSO providers (optional)
-- This would typically be done via API calls, but here's an example
-- INSERT INTO sso_providers (name, type, entity_id, metadata_url) VALUES
-- ('Example IdP', 'saml', 'https://sso.example.com', 'https://sso.example.com/metadata')
-- ON CONFLICT DO NOTHING;

-- Create view for active SSO sessions with user info
CREATE OR REPLACE VIEW active_sso_sessions AS
SELECT
    s.id,
    s.request_id,
    s.state,
    s.redirect_url,
    s.expires_at,
    u.id as user_id,
    u.email as user_email,
    u.name as user_name,
    p.name as provider_name,
    p.type as provider_type,
    i.external_id,
    s.created_at
FROM sso_sessions s
JOIN sso_identities i ON s.identity_id = i.id
JOIN sso_providers p ON i.provider_id = p.id
LEFT JOIN users u ON i.user_id = u.id
WHERE s.is_active = true AND s.expires_at > NOW();

-- Create view for SSO users summary
CREATE OR REPLACE VIEW sso_users_summary AS
SELECT
    u.id as user_id,
    u.email,
    u.name,
    u.role,
    u.plan,
    COUNT(i.id) as sso_identities_count,
    ARRAY_AGG(p.name) as provider_names,
    MAX(i.last_authenticated) as last_sso_login
FROM users u
LEFT JOIN sso_identities i ON u.id = i.user_id
LEFT JOIN sso_providers p ON i.provider_id = p.id
GROUP BY u.id, u.email, u.name, u.role, u.plan
HAVING COUNT(i.id) > 0;