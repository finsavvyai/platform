-- Qestro SaaS Platform - Initial Database Schema
-- This migration creates the complete database structure for enterprise SaaS functionality

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create custom types
CREATE TYPE user_role AS ENUM ('user', 'admin', 'superadmin');
CREATE TYPE user_status AS ENUM ('active', 'suspended', 'pending');
CREATE TYPE team_member_role AS ENUM ('owner', 'admin', 'member', 'viewer');
CREATE TYPE subscription_status AS ENUM ('active', 'canceled', 'past_due', 'unpaid', 'trialing');
CREATE TYPE billing_interval AS ENUM ('month', 'year');
CREATE TYPE notification_type AS ENUM ('email', 'in_app', 'push', 'webhook');
CREATE TYPE audit_action AS ENUM ('create', 'read', 'update', 'delete', 'login', 'logout');

-- Users table - Core user management
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    avatar_url TEXT,
    email_verified BOOLEAN DEFAULT FALSE,
    email_verification_token VARCHAR(255),
    email_verification_expires_at TIMESTAMP,
    mfa_enabled BOOLEAN DEFAULT FALSE,
    mfa_secret VARCHAR(255),
    mfa_backup_codes TEXT[], -- Array of backup codes
    role user_role DEFAULT 'user',
    status user_status DEFAULT 'pending',
    timezone VARCHAR(50) DEFAULT 'UTC',
    language VARCHAR(10) DEFAULT 'en',
    preferences JSONB DEFAULT '{}', -- User preferences as JSON
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login_at TIMESTAMP WITH TIME ZONE,
    last_seen_at TIMESTAMP WITH TIME ZONE,
    login_count INTEGER DEFAULT 0,
    CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Password resets table
CREATE TABLE password_resets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    used_at TIMESTAMP WITH TIME ZONE,
    ip_address INET,
    user_agent TEXT
);

-- Email verification history
CREATE TABLE email_verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    verified_at TIMESTAMP WITH TIME ZONE,
    ip_address INET,
    user_agent TEXT
);

-- User sessions table for active session management
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token VARCHAR(255) UNIQUE NOT NULL,
    access_token_hash VARCHAR(255) NOT NULL, -- Hash of access token for security
    ip_address INET,
    user_agent TEXT,
    device_info JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT valid_expiry CHECK (expires_at > created_at)
);

-- Subscription plans table
CREATE TABLE plans (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    price_cents INTEGER NOT NULL,
    billing_interval billing_interval NOT NULL,
    trial_days INTEGER DEFAULT 0,
    features JSONB NOT NULL DEFAULT '[]', -- Array of feature strings
    limits JSONB NOT NULL DEFAULT '{}', -- Usage limits object
    stripe_price_id VARCHAR(255),
    is_public BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT positive_price CHECK (price_cents >= 0)
);

-- Teams/Organizations table
CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    avatar_url TEXT,
    website VARCHAR(255),
    industry VARCHAR(100),
    company_size VARCHAR(50),
    plan_id INTEGER REFERENCES plans(id),
    subscription_id UUID,
    stripe_customer_id VARCHAR(255),
    settings JSONB DEFAULT '{}', -- Team-wide settings
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT valid_slug CHECK (slug ~* '^[a-z0-9-]+$')
);

-- Team memberships table
CREATE TABLE team_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role team_member_role NOT NULL,
    permissions JSONB DEFAULT '{}', -- Additional permissions
    invited_by UUID REFERENCES users(id),
    invited_at TIMESTAMP WITH TIME ZONE,
    invitation_token VARCHAR(255),
    invitation_expires_at TIMESTAMP WITH TIME ZONE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    left_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(team_id, user_id),
    CONSTRAINT valid_membership CHECK (joined_at IS NOT NULL OR left_at IS NULL)
);

-- Subscriptions table
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    plan_id INTEGER REFERENCES plans(id),
    stripe_subscription_id VARCHAR(255) UNIQUE,
    stripe_customer_id VARCHAR(255),
    status subscription_status NOT NULL,
    current_period_start TIMESTAMP WITH TIME ZONE,
    current_period_end TIMESTAMP WITH TIME ZONE,
    trial_start TIMESTAMP WITH TIME ZONE,
    trial_end TIMESTAMP WITH TIME ZONE,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    canceled_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE,
    billing_cycle_anchor TIMESTAMP WITH TIME ZONE,
    days_until_due INTEGER,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT valid_subscription CHECK (
      (user_id IS NOT NULL) XOR (team_id IS NOT NULL)
    )
);

-- Usage metrics table for tracking plan limits
CREATE TABLE usage_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    metric_type VARCHAR(100) NOT NULL, -- 'test_runs', 'api_calls', 'storage_gb', 'team_members'
    metric_value INTEGER NOT NULL,
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT valid_metric_period CHECK (period_end > period_start),
    CONSTRAINT valid_metric_value CHECK (metric_value >= 0),
    CONSTRAINT valid_subscription_reference CHECK (
      (user_id IS NOT NULL) XOR (team_id IS NOT NULL)
    )
);

-- Projects table
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    description TEXT,
    settings JSONB DEFAULT '{}', -- Project-specific settings
    environment_config JSONB DEFAULT '{}', -- Environment URLs and configs
    is_public BOOLEAN DEFAULT FALSE,
    is_archived BOOLEAN DEFAULT FALSE,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(team_id, slug),
    CONSTRAINT valid_project_slug CHECK (slug ~* '^[a-z0-9-]+$')
);

-- Test cases table
CREATE TABLE test_cases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    test_type VARCHAR(50) NOT NULL, -- 'web', 'mobile', 'api'
    test_config JSONB NOT NULL DEFAULT '{}', -- Test configuration and steps
    variables JSONB DEFAULT '{}', -- Test variables and data
    tags TEXT[] DEFAULT '{}',
    priority INTEGER DEFAULT 5, -- 1-10 scale
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_run_at TIMESTAMP WITH TIME ZONE
);

-- Test runs table
CREATE TABLE test_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    test_case_id UUID NOT NULL REFERENCES test_cases(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    environment VARCHAR(50) NOT NULL, -- 'dev', 'staging', 'prod'
    status VARCHAR(50) NOT NULL, -- 'pending', 'running', 'passed', 'failed', 'cancelled'
    result JSONB DEFAULT '{}', -- Test results and artifacts
    metrics JSONB DEFAULT '{}', -- Performance metrics
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_ms INTEGER,
    triggered_by UUID REFERENCES users(id),
    triggered_by_type VARCHAR(50) DEFAULT 'manual', -- 'manual', 'schedule', 'api'
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT valid_duration CHECK (duration_ms IS NULL OR duration_ms >= 0)
);

-- Notifications table
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    type notification_type NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    data JSONB DEFAULT '{}', -- Additional notification data
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP WITH TIME ZONE,
    email_sent BOOLEAN DEFAULT FALSE,
    push_sent BOOLEAN DEFAULT FALSE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT valid_notification_reference CHECK (
      (user_id IS NOT NULL) XOR (team_id IS NOT NULL)
    )
);

-- Audit logs table for compliance and security
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    team_id UUID REFERENCES teams(id),
    action audit_action NOT NULL,
    resource_type VARCHAR(100),
    resource_id UUID,
    resource_name VARCHAR(255),
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- API keys table for programmatic access
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    key_hash VARCHAR(255) UNIQUE NOT NULL, -- Hash of the actual API key
    key_prefix VARCHAR(20) NOT NULL, -- First few characters for identification
    permissions JSONB DEFAULT '{}', -- Key-specific permissions
    rate_limit_per_hour INTEGER DEFAULT 1000,
    is_active BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMP WITH TIME ZONE,
    last_used_at TIMESTAMP WITH TIME ZONE,
    usage_count INTEGER DEFAULT 0,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT valid_api_key_reference CHECK (
      (user_id IS NOT NULL) XOR (team_id IS NOT NULL)
    ),
    CONSTRAINT valid_key_expiry CHECK (expires_at IS NULL OR expires_at > created_at)
);

-- Webhooks table for integrations
CREATE TABLE webhooks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    url TEXT NOT NULL,
    events TEXT[] NOT NULL DEFAULT '{}', -- Array of events to trigger on
    secret VARCHAR(255), -- HMAC secret for verification
    is_active BOOLEAN DEFAULT TRUE,
    retry_count INTEGER DEFAULT 3,
    timeout_seconds INTEGER DEFAULT 30,
    last_triggered_at TIMESTAMP WITH TIME ZONE,
    last_success_at TIMESTAMP WITH TIME ZONE,
    failure_count INTEGER DEFAULT 0,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT valid_webhook_url CHECK (url ~* '^https://.*'),
    CONSTRAINT valid_webhook_reference CHECK (
      (user_id IS NOT NULL) OR (team_id IS NOT NULL)
    )
);

-- Integrations table for third-party service connections
CREATE TABLE integrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    service VARCHAR(100) NOT NULL, -- 'slack', 'github', 'jira', etc.
    name VARCHAR(255) NOT NULL,
    config JSONB NOT NULL DEFAULT '{}', -- Service-specific configuration
    credentials JSONB NOT NULL DEFAULT '{}', -- Encrypted credentials
    is_active BOOLEAN DEFAULT TRUE,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    sync_status VARCHAR(50) DEFAULT 'pending',
    error_message TEXT,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT valid_integration_reference CHECK (
      (user_id IS NOT NULL) OR (team_id IS NOT NULL)
    )
);

-- File storage table for test artifacts, screenshots, etc.
CREATE TABLE file_storage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    team_id UUID REFERENCES teams(id),
    project_id UUID REFERENCES projects(id),
    test_run_id UUID REFERENCES test_runs(id),
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    size_bytes INTEGER NOT NULL,
    storage_path TEXT NOT NULL,
    storage_provider VARCHAR(50) DEFAULT 'cloudflare', -- 'cloudflare', 'aws', 'gcp'
    is_public BOOLEAN DEFAULT FALSE,
    public_url TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT positive_file_size CHECK (size_bytes > 0),
    CONSTRAINT valid_file_expiry CHECK (expires_at IS NULL OR expires_at > created_at)
);

-- Create indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_created_at ON users(created_at);
CREATE INDEX idx_team_members_team_id ON team_members(team_id);
CREATE INDEX idx_team_members_user_id ON team_members(user_id);
CREATE INDEX idx_team_members_role ON team_members(role);
CREATE INDEX idx_teams_slug ON teams(slug);
CREATE INDEX idx_teams_created_by ON teams(created_by);
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_team_id ON subscriptions(team_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_projects_team_id ON projects(team_id);
CREATE INDEX idx_projects_created_by ON projects(created_by);
CREATE INDEX idx_test_cases_project_id ON test_cases(project_id);
CREATE INDEX idx_test_cases_created_by ON test_cases(created_by);
CREATE INDEX idx_test_runs_test_case_id ON test_runs(test_case_id);
CREATE INDEX idx_test_runs_project_id ON test_runs(project_id);
CREATE INDEX idx_test_runs_status ON test_runs(status);
CREATE INDEX idx_test_runs_created_at ON test_runs(created_at);
CREATE INDEX idx_usage_metrics_user_id ON usage_metrics(user_id);
CREATE INDEX idx_usage_metrics_team_id ON usage_metrics(team_id);
CREATE INDEX idx_usage_metrics_period ON usage_metrics(period_start, period_end);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_team_id ON notifications(team_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_team_id ON audit_logs(team_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX idx_api_keys_team_id ON api_keys(team_id);
CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX idx_webhooks_team_id ON webhooks(team_id);
CREATE INDEX idx_integrations_team_id ON integrations(team_id);
CREATE INDEX idx_file_storage_project_id ON file_storage(project_id);
CREATE INDEX idx_file_storage_test_run_id ON file_storage(test_run_id);

-- Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON teams
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_test_cases_updated_at BEFORE UPDATE ON test_cases
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_webhooks_updated_at BEFORE UPDATE ON webhooks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_integrations_updated_at BEFORE UPDATE ON integrations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default subscription plans
INSERT INTO plans (name, slug, description, price_cents, billing_interval, features, limits, sort_order) VALUES
(
    'Free',
    'free',
    'Perfect for individuals and small projects getting started with automated testing',
    0,
    'month',
    ARRAY[
        'Up to 3 projects',
        'Up to 50 test runs per month',
        'Basic browser recording',
        'Community support',
        'Basic analytics dashboard',
        '1 user account'
    ],
    JSONB_BUILD_OBJECT(
        'projects', 3,
        'testRuns', 50,
        'teamMembers', 1,
        'storage', 1, -- GB
        'apiCalls', 1000,
        'parallelExecutions', 1
    ),
    1
),
(
    'Professional',
    'pro',
    'Ideal for growing teams and professional testing workflows',
    4900, -- $49.00
    'month',
    ARRAY[
        'Unlimited projects',
        'Up to 1,000 test runs per month',
        'Advanced recording (web + mobile)',
        'Team collaboration (up to 10 members)',
        'Priority email support',
        'Advanced analytics & reporting',
        'API access with webhooks',
        'Custom domains',
        'Test scheduling & automation',
        'Performance monitoring',
        'Integration with Slack & GitHub'
    ],
    JSONB_BUILD_OBJECT(
        'projects', -1, -- unlimited
        'testRuns', 1000,
        'teamMembers', 10,
        'storage', 10, -- GB
        'apiCalls', 10000,
        'parallelExecutions', 5,
        'retentionDays', 90
    ),
    2
),
(
    'Enterprise',
    'enterprise',
    'Complete solution for large organizations with advanced security and compliance',
    19900, -- $199.00
    'month',
    ARRAY[
        'Everything in Professional',
        'Unlimited test runs',
        'Unlimited team members',
        'Enterprise SSO (SAML, OIDC)',
        'Advanced security & compliance features',
        'Dedicated account manager',
        'Custom integrations & SLA',
        'On-premise deployment option',
        'Advanced audit logs & reporting',
        'Custom training & onboarding',
        'Phone support with 4-hour response time',
        'Guaranteed 99.9% uptime SLA'
    ],
    JSONB_BUILD_OBJECT(
        'projects', -1,
        'testRuns', -1,
        'teamMembers', -1,
        'storage', 100, -- GB
        'apiCalls', 100000,
        'parallelExecutions', 20,
        'retentionDays', 365,
        'customIntegrations', -1
    ),
    3
);

-- Create default superadmin user (change password in production!)
INSERT INTO users (email, password_hash, first_name, last_name, role, status, email_verified) VALUES
(
    'admin@qestro.app',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewKyNiYxQr6Kg4M.', -- Password: QestroAdmin123!
    'Qestro',
    'Administrator',
    'superadmin',
    'active',
    true
);

-- Create audit log trigger function
CREATE OR REPLACE FUNCTION log_audit_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_logs (action, resource_type, resource_id, new_values, user_id, team_id)
        VALUES ('create', TG_TABLE_NAME, NEW.id, row_to_json(NEW), NEW.created_by,
                CASE WHEN TG_TABLE_NAME = 'teams' THEN NEW.id ELSE NULL END);
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_logs (action, resource_type, resource_id, old_values, new_values, user_id, team_id)
        VALUES ('update', TG_TABLE_NAME, NEW.id, row_to_json(OLD), row_to_json(NEW),
                CASE WHEN TG_TABLE_NAME = 'users' THEN NEW.id ELSE NULL END,
                CASE WHEN TG_TABLE_NAME = 'teams' THEN NEW.id ELSE NULL END);
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit_logs (action, resource_type, resource_id, old_values, user_id, team_id)
        VALUES ('delete', TG_TABLE_NAME, OLD.id, row_to_json(OLD),
                CASE WHEN TG_TABLE_NAME = 'users' THEN OLD.id ELSE NULL END,
                CASE WHEN TG_TABLE_NAME = 'teams' THEN OLD.id ELSE NULL END);
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create audit triggers for important tables
CREATE TRIGGER audit_users AFTER INSERT OR UPDATE OR DELETE ON users
    FOR EACH ROW EXECUTE FUNCTION log_audit_changes();

CREATE TRIGGER audit_teams AFTER INSERT OR UPDATE OR DELETE ON teams
    FOR EACH ROW EXECUTE FUNCTION log_audit_changes();

CREATE TRIGGER audit_team_members AFTER INSERT OR UPDATE OR DELETE ON team_members
    FOR EACH ROW EXECUTE FUNCTION log_audit_changes();

CREATE TRIGGER audit_subscriptions AFTER INSERT OR UPDATE OR DELETE ON subscriptions
    FOR EACH ROW EXECUTE FUNCTION log_audit_changes();

CREATE TRIGGER audit_projects AFTER INSERT OR UPDATE OR DELETE ON projects
    FOR EACH ROW EXECUTE FUNCTION log_audit_changes();

COMMIT;
