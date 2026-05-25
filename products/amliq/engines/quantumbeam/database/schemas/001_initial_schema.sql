-- QuantumBeam.io Database Schema
-- Core schema with time-based partitioning for transactions
-- Version: 1.0.0

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "pg_cron" SCHEMA partition_maintenance;
CREATE EXTENSION IF NOT EXISTS "pg_partman" SCHEMA partition_maintenance;
CREATE EXTENSION IF NOT EXISTS "btree_gin";
CREATE EXTENSION IF NOT EXISTS "btree_gist";
CREATE EXTENSION IF NOT EXISTS "intarray";
CREATE EXTENSION IF NOT EXISTS "hstore";
CREATE EXTENSION IF NOT EXISTS "ltree";

-- Create custom types
CREATE TYPE transaction_status AS ENUM (
    'pending',
    'processing',
    'approved',
    'declined',
    'reversed',
    'chargeback',
    'error'
);

CREATE TYPE fraud_risk_level AS ENUM (
    'low',
    'medium',
    'high',
    'critical'
);

CREATE TYPE quantum_processing_status AS ENUM (
    'pending',
    'queued',
    'processing',
    'completed',
    'failed',
    'fallback'
);

CREATE TYPE notification_type AS ENUM (
    'email',
    'sms',
    'webhook',
    'push',
    'slack'
);

-- Create audit trigger function
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS \$\$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit.audit_log(
            table_name,
            operation,
            user_id,
            old_values,
            new_values,
            timestamp
        ) VALUES (
            TG_TABLE_NAME,
            TG_OP,
            current_setting('app.current_user_id', true)::uuid,
            NULL,
            to_jsonb(NEW),
            now()
        );
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit.audit_log(
            table_name,
            operation,
            user_id,
            old_values,
            new_values,
            timestamp
        ) VALUES (
            TG_TABLE_NAME,
            TG_OP,
            current_setting('app.current_user_id', true)::uuid,
            to_jsonb(OLD),
            to_jsonb(NEW),
            now()
        );
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit.audit_log(
            table_name,
            operation,
            user_id,
            old_values,
            new_values,
            timestamp
        ) VALUES (
            TG_TABLE_NAME,
            TG_OP,
            current_setting('app.current_user_id', true)::uuid,
            to_jsonb(OLD),
            NULL,
            now()
        );
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
\$\$ LANGUAGE plpgsql;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS \$\$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
\$\$ LANGUAGE plpgsql;

-- Create function to generate transaction IDs
CREATE OR REPLACE FUNCTION generate_transaction_id()
RETURNS TEXT AS \$\$
DECLARE
    prefix TEXT := 'QB';
    timestamp TEXT := to_char(now(), 'YYYYMMDDHH24MISS');
    random_part TEXT := lpad(floor(random() * 1000000)::text, 6, '0');
BEGIN
    RETURN prefix || timestamp || random_part;
END;
\$\$ LANGUAGE plpgsql;

-- =================================
-- ORGANIZATIONS TABLE
-- =================================
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    industry VARCHAR(100),
    website VARCHAR(500),
    logo_url VARCHAR(500),
    timezone VARCHAR(50) DEFAULT 'UTC',
    currency VARCHAR(3) DEFAULT 'USD',
    settings JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_by UUID REFERENCES users(id),
    version INTEGER DEFAULT 1
);

-- Indexes for organizations
CREATE INDEX idx_organizations_slug ON organizations(slug);
CREATE INDEX idx_organizations_is_active ON organizations(is_active);
CREATE INDEX idx_organizations_created_at ON organizations(created_at);
CREATE INDEX idx_organizations_name ON organizations USING gin(to_tsvector('english', name));

-- =================================
-- USERS TABLE
-- =================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(20),
    avatar_url VARCHAR(500),
    timezone VARCHAR(50) DEFAULT 'UTC',
    language VARCHAR(10) DEFAULT 'en',
    last_login_at TIMESTAMP WITH TIME ZONE,
    last_login_ip INET,
    email_verified_at TIMESTAMP WITH TIME ZONE,
    phone_verified_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    is_email_verified BOOLEAN DEFAULT false,
    is_phone_verified BOOLEAN DEFAULT false,
    two_factor_enabled BOOLEAN DEFAULT false,
    two_factor_secret VARCHAR(255),
    settings JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Indexes for users
CREATE INDEX idx_users_organization_id ON users(organization_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_is_active ON users(is_active);
CREATE INDEX idx_users_created_at ON users(created_at);
CREATE UNIQUE INDEX idx_users_email_organization ON users(email, organization_id);

-- =================================
-- API KEYS TABLE
-- =================================
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    key_hash VARCHAR(255) NOT NULL UNIQUE,
    key_prefix VARCHAR(20) NOT NULL,
    permissions JSONB DEFAULT '[]',
    rate_limit_per_minute INTEGER DEFAULT 1000,
    rate_limit_per_hour INTEGER DEFAULT 100000,
    ip_whitelist INET[],
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMP WITH TIME ZONE,
    last_used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Indexes for api_keys
CREATE INDEX idx_api_keys_organization_id ON api_keys(organization_id);
CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_is_active ON api_keys(is_active);
CREATE INDEX idx_api_keys_expires_at ON api_keys(expires_at);

-- =================================
-- TRANSACTIONS PARTITIONED TABLE
-- =================================
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id VARCHAR(50) UNIQUE NOT NULL DEFAULT generate_transaction_id(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    user_id UUID REFERENCES users(id),

    -- Transaction details
    amount DECIMAL(19,4) NOT NULL CHECK (amount > 0),
    currency VARCHAR(3) NOT NULL,
    merchant_name VARCHAR(255),
    merchant_category_code VARCHAR(10),
    merchant_id VARCHAR(100),

    -- Payment method
    payment_method_type VARCHAR(50),
    payment_method_token VARCHAR(255),
    card_last_four VARCHAR(4),
    card_brand VARCHAR(50),
    card_exp_month INTEGER,
    card_exp_year INTEGER,

    -- Location data
    ip_address INET,
    country_code VARCHAR(2),
    city VARCHAR(100),
    postal_code VARCHAR(20),
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),

    -- Device data
    device_id VARCHAR(255),
    device_fingerprint VARCHAR(255),
    user_agent TEXT,

    -- Transaction status
    status transaction_status NOT NULL DEFAULT 'pending',
    gateway_transaction_id VARCHAR(255),
    gateway_response_code VARCHAR(50),
    gateway_response_message TEXT,

    -- Fraud detection
    fraud_score DECIMAL(5,4) CHECK (fraud_score >= 0 AND fraud_score <= 1),
    fraud_risk_level fraud_risk_level,
    is_fraudulent BOOLEAN DEFAULT false,
    fraud_rules_triggered JSONB DEFAULT '[]',

    -- Quantum processing
    quantum_processing_status quantum_processing_status DEFAULT 'pending',
    quantum_result JSONB,
    quantum_processing_time_ms INTEGER,
    quantum_model_version VARCHAR(50),
    quantum_confidence DECIMAL(5,4),

    -- Processing metadata
    processing_started_at TIMESTAMP WITH TIME ZONE,
    processing_completed_at TIMESTAMP WITH TIME ZONE,
    processing_duration_ms INTEGER,

    -- Additional data
    metadata JSONB DEFAULT '{}',
    custom_fields JSONB DEFAULT '{}',

    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
) PARTITION BY RANGE (created_at);

-- Create default partition for current month
CREATE TABLE transactions_current PARTITION OF transactions
    FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');

-- Indexes for transactions
CREATE INDEX idx_transactions_organization_id ON transactions(organization_id);
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_fraud_risk_level ON transactions(fraud_risk_level);
CREATE INDEX idx_transactions_created_at ON transactions(created_at);
CREATE INDEX idx_transactions_amount ON transactions(amount);
CREATE INDEX idx_transactions_currency ON transactions(currency);
CREATE INDEX idx_transactions_merchant_id ON transactions(merchant_id);
CREATE INDEX idx_transactions_ip_address ON transactions(ip_address);
CREATE INDEX idx_transactions_device_id ON transactions(device_id);
CREATE INDEX idx_transactions_quantum_status ON transactions(quantum_processing_status);

-- GIN indexes for JSONB fields
CREATE INDEX idx_transactions_metadata ON transactions USING gin(metadata);
CREATE INDEX idx_transactions_fraud_rules ON transactions USING gin(fraud_rules_triggered);
CREATE INDEX idx_transactions_custom_fields ON transactions USING gin(custom_fields);
CREATE INDEX idx_transactions_quantum_result ON transactions USING gin(quantum_result);

-- Full-text search index
CREATE INDEX idx_transactions_merchant_name_fts ON transactions USING gin(to_tsvector('english', merchant_name));

-- =================================
-- FRAUD RULES TABLE
-- =================================
CREATE TABLE fraud_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    rule_type VARCHAR(50) NOT NULL,
    conditions JSONB NOT NULL,
    actions JSONB NOT NULL,
    weight DECIMAL(5,4) DEFAULT 1.0,
    is_active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 100,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- =================================
-- QUANTUM MODELS TABLE
-- =================================
CREATE TABLE quantum_models (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    version VARCHAR(50) NOT NULL,
    model_type VARCHAR(50) NOT NULL,
    description TEXT,
    parameters JSONB DEFAULT '{}',
    circuit_json TEXT,
    backend_provider VARCHAR(50),
    backend_config JSONB DEFAULT '{}',
    performance_metrics JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- =================================
-- AUDIT LOG TABLE
-- =================================
CREATE TABLE audit.audit_log (
    id BIGSERIAL PRIMARY KEY,
    table_name VARCHAR(255) NOT NULL,
    operation VARCHAR(10) NOT NULL,
    user_id UUID,
    old_values JSONB,
    new_values JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT now(),
    ip_address INET,
    user_agent TEXT
) PARTITION BY RANGE (timestamp);

-- Create partitions for audit log
CREATE TABLE audit.audit_log_current PARTITION OF audit.audit_log
    FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');

-- Indexes for audit log
CREATE INDEX idx_audit_log_table_name ON audit.audit_log(table_name);
CREATE INDEX idx_audit_log_timestamp ON audit.audit_log(timestamp);
CREATE INDEX idx_audit_log_user_id ON audit.audit_log(user_id);

-- =================================
-- TRIGGERS
-- =================================
-- Update timestamp triggers
CREATE TRIGGER update_organizations_updated_at
    BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_api_keys_updated_at
    BEFORE UPDATE ON api_keys
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_fraud_rules_updated_at
    BEFORE UPDATE ON fraud_rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_quantum_models_updated_at
    BEFORE UPDATE ON quantum_models
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Audit triggers
CREATE TRIGGER audit_organizations
    AFTER INSERT OR UPDATE OR DELETE ON organizations
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_users
    AFTER INSERT OR UPDATE OR DELETE ON users
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_api_keys
    AFTER INSERT OR UPDATE OR DELETE ON api_keys
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- =================================
-- PARTITION MANAGEMENT FUNCTIONS
-- =================================
-- Function to create monthly partitions for transactions
CREATE OR REPLACE FUNCTION create_monthly_partitions(table_name TEXT, months_ahead INTEGER DEFAULT 3)
RETURNS VOID AS \$\$
DECLARE
    start_date DATE;
    end_date DATE;
    partition_name TEXT;
    i INTEGER;
BEGIN
    FOR i IN 0..months_ahead LOOP
        start_date := date_trunc('month', CURRENT_DATE + interval '1 month' * i);
        end_date := start_date + interval '1 month';
        partition_name := table_name || '_' || to_char(start_date, 'YYYY_MM');

        EXECUTE format('CREATE TABLE IF NOT EXISTS %I PARTITION OF %I FOR VALUES FROM (%L) TO (%L)',
                      partition_name, table_name, start_date, end_date);

        -- Create indexes on partition
        EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (organization_id)',
                      'idx_' || partition_name || '_organization_id', partition_name);
        EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (created_at)',
                      'idx_' || partition_name || '_created_at', partition_name);
    END LOOP;
END;
\$\$ LANGUAGE plpgsql;

-- Function to drop old partitions
CREATE OR REPLACE FUNCTION drop_old_partitions(table_name TEXT, keep_months INTEGER DEFAULT 12)
RETURNS VOID AS \$\$
DECLARE
    cutoff_date DATE;
    partition_name TEXT;
    rec RECORD;
BEGIN
    cutoff_date := date_trunc('month', CURRENT_DATE - interval '1 month' * keep_months);

    FOR rec IN SELECT tablename FROM pg_tables WHERE tablename LIKE table_name || '_%' LOOP
        IF rec.tablename < table_name || '_' || to_char(cutoff_date, 'YYYY_MM') THEN
            EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(rec.tablename) || ' CASCADE';
        END IF;
    END LOOP;
END;
\$\$ LANGUAGE plpgsql;

-- Schedule partition maintenance with pg_cron
SELECT cron.schedule('create-transactions-partitions', '0 0 1 * *',
                     'SELECT create_monthly_partitions(''transactions'', 3);');

SELECT cron.schedule('drop-old-transactions-partitions', '0 2 1 * *',
                     'SELECT drop_old_partitions(''transactions'', 12);');

SELECT cron.schedule('create-audit-partitions', '0 0 1 * *',
                     'SELECT create_monthly_partitions(''audit.audit_log'', 3);');

SELECT cron.schedule('drop-old-audit-partitions', '0 3 1 * *',
                     'SELECT drop_old_partitions(''audit.audit_log'', 24);');

-- =================================
-- VIEWS
-- =================================
-- Active transactions view
CREATE VIEW active_transactions AS
SELECT * FROM transactions
WHERE status IN ('pending', 'processing')
AND created_at > CURRENT_TIMESTAMP - interval '24 hours';

-- High-risk transactions view
CREATE VIEW high_risk_transactions AS
SELECT * FROM transactions
WHERE fraud_risk_level IN ('high', 'critical')
OR fraud_score > 0.7
AND created_at > CURRENT_TIMESTAMP - interval '7 days';

-- Transaction analytics view
CREATE VIEW transaction_analytics AS
SELECT
    organization_id,
    DATE_TRUNC('day', created_at) as date,
    COUNT(*) as transaction_count,
    SUM(amount) as total_amount,
    AVG(amount) as avg_amount,
    MAX(amount) as max_amount,
    MIN(amount) as min_amount,
    COUNT(CASE WHEN is_fraudulent = true THEN 1 END) as fraudulent_count,
    ROUND(COUNT(CASE WHEN is_fraudulent = true THEN 1 END) * 100.0 / COUNT(*), 2) as fraud_rate_pct
FROM transactions
GROUP BY organization_id, DATE_TRUNC('day', created_at);

-- =================================
-- ROW LEVEL SECURITY
-- =================================
-- Enable RLS on sensitive tables
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- RLS policies for transactions
CREATE POLICY organization_transactions ON transactions
    FOR ALL TO quantumbeam_api
    USING (organization_id = current_setting('app.organization_id')::uuid);

-- RLS policies for users
CREATE POLICY organization_users ON users
    FOR ALL TO quantumbeam_api
    USING (organization_id = current_setting('app.organization_id')::uuid);

-- RLS policies for api_keys
CREATE POLICY organization_api_keys ON api_keys
    FOR ALL TO quantumbeam_api
    USING (organization_id = current_setting('app.organization_id')::uuid);

-- =================================
-- INITIAL DATA
-- =================================
-- Insert default quantum models
INSERT INTO quantum_models (name, version, model_type, description) VALUES
    ('Variational Quantum Classifier', 'v1.0.0', 'VQC', 'Quantum classifier for fraud detection'),
    ('Quantum Approximate Optimization', 'v1.0.0', 'QAOA', 'Optimizer for fraud ring detection'),
    ('Hybrid Quantum-Classical', 'v1.0.0', 'HYBRID', 'Hybrid model combining quantum and classical');

-- Create initial admin user (password: admin123)
INSERT INTO users (id, email, username, password_hash, first_name, last_name, is_active, is_email_verified)
VALUES (
    uuid_generate_v4(),
    'admin@quantumbeam.io',
    'admin',
    '$2a$10$N9qo8uLOickgx2ZMRZoMye1cSjX4E4W9XOpD8YQ7W3jX9jW9W9W9W',
    'System',
    'Administrator',
    true,
    true
) ON CONFLICT (email) DO NOTHING;

-- =================================
-- PERFORMANCE ANALYTICS
-- =================================
-- Create materialized view for transaction statistics
CREATE MATERIALIZED VIEW transaction_stats AS
SELECT
    DATE_TRUNC('hour', created_at) as hour,
    COUNT(*) as transaction_count,
    SUM(amount) as total_volume,
    AVG(fraud_score) as avg_fraud_score,
    COUNT(CASE WHEN is_fraudulent = true THEN 1 END) as fraud_count,
    AVG(quantum_processing_time_ms) as avg_quantum_time
FROM transactions
GROUP BY DATE_TRUNC('hour', created_at)
WITH DATA;

-- Create unique index for refresh
CREATE UNIQUE INDEX idx_transaction_stats_hour ON transaction_stats(hour);

-- Function to refresh materialized view
CREATE OR REPLACE FUNCTION refresh_transaction_stats()
RETURNS VOID AS \$\$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY transaction_stats;
END;
\$\$ LANGUAGE plpgsql;

-- Schedule refresh every hour
SELECT cron.schedule('refresh-transaction-stats', '0 * * * *',
                     'SELECT refresh_transaction_stats();');

-- Grant permissions
GRANT SELECT ON transaction_stats TO quantumbeam_ml;
GRANT SELECT ON transaction_stats TO quantumbeam_readonly;

-- Create schema for analytics if not exists
CREATE SCHEMA IF NOT EXISTS analytics AUTHORIZATION quantumbeam_ml;

-- Create analytics tables
CREATE TABLE analytics.transaction_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id),
    metric_date DATE NOT NULL,
    total_transactions INTEGER,
    total_amount DECIMAL(19,4),
    avg_transaction_amount DECIMAL(19,4),
    fraud_rate DECIMAL(5,4),
    avg_fraud_score DECIMAL(5,4),
    quantum_processing_avg_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_transaction_metrics_org_date ON analytics.transaction_metrics(organization_id, metric_date);

COMMIT;
