-- +goose Up
-- QuantumBeam Partitioning Setup Migration
-- Version: 002
-- Description: Set up time-based partitioning for transactions and audit tables

-- Create the transactions table with proper partitioning
DROP TABLE IF EXISTS transactions CASCADE;

CREATE TABLE transactions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    transaction_id VARCHAR(255) NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    merchant_id VARCHAR(255) NOT NULL,
    merchant_category VARCHAR(10),
    merchant_name VARCHAR(255),
    customer_id VARCHAR(255) NOT NULL,
    customer_email VARCHAR(255),
    payment_method payment_method NOT NULL,
    device_id VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    location_country VARCHAR(2),
    location_city VARCHAR(100),
    location_lat DECIMAL(10,8),
    location_lng DECIMAL(11,8),
    risk_score DECIMAL(5,4) DEFAULT 0.0,
    risk_level risk_level DEFAULT 'LOW',
    fraud_score DECIMAL(5,4) DEFAULT 0.0,
    ml_score DECIMAL(5,4) DEFAULT 0.0,
    quantum_score DECIMAL(5,4) DEFAULT 0.0,
    status transaction_status DEFAULT 'pending',
    is_fraud BOOLEAN DEFAULT false,
    is_flagged BOOLEAN DEFAULT false,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Unique constraint with partition key
    UNIQUE (organization_id, transaction_id, timestamp)
) PARTITION BY RANGE (timestamp);

-- Create audit_logs table with partitioning
CREATE TABLE audit_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id VARCHAR(255),
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    metadata JSONB DEFAULT '{}',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
) PARTITION BY RANGE (timestamp);

-- Create fraud_events table with partitioning
CREATE TABLE fraud_events (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) DEFAULT 'medium',
    description TEXT,
    confidence DECIMAL(5,4) DEFAULT 0.0,
    model_version VARCHAR(50),
    features JSONB,
    is_true_positive BOOLEAN,
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
) PARTITION BY RANGE (created_at);

-- Create function to generate monthly partitions
CREATE OR REPLACE FUNCTION create_monthly_partition(
    table_name TEXT,
    start_date DATE
) RETURNS VOID AS $$
DECLARE
    partition_name TEXT;
    end_date DATE;
BEGIN
    partition_name := table_name || '_' || to_char(start_date, 'YYYY_MM');
    end_date := start_date + interval '1 month';

    EXECUTE format('CREATE TABLE IF NOT EXISTS %I PARTITION OF %I FOR VALUES FROM (%L) TO (%L)',
                   partition_name, table_name, start_date, end_date);

    RAISE NOTICE 'Created partition % for table %', partition_name, table_name;
END;
$$ LANGUAGE plpgsql;

-- Create function to create partitions for a range of months
CREATE OR REPLACE FUNCTION create_partitions_ahead(
    table_name TEXT,
    months_ahead INTEGER DEFAULT 3
) RETURNS VOID AS $$
DECLARE
    i INTEGER;
    start_date DATE;
BEGIN
    -- Create current month partition if it doesn't exist
    PERFORM create_monthly_partition(table_name, date_trunc('month', CURRENT_DATE));

    -- Create future partitions
    FOR i IN 1..months_ahead LOOP
        start_date := date_trunc('month', CURRENT_DATE + interval '1 month' * i);
        PERFORM create_monthly_partition(table_name, start_date);
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Create current and future partitions for transactions
SELECT create_partitions_ahead('transactions', 6);

-- Create current and future partitions for audit_logs
SELECT create_partitions_ahead('audit_logs', 3);

-- Create current and future partitions for fraud_events
SELECT create_partitions_ahead('fraud_events', 3);

-- Create indexes for better performance
CREATE INDEX idx_transactions_org_timestamp ON transactions(organization_id, timestamp DESC);
CREATE INDEX idx_transactions_customer_id ON transactions(customer_id);
CREATE INDEX idx_transactions_merchant_id ON transactions(merchant_id);
CREATE INDEX idx_transactions_risk_score ON transactions(risk_score) WHERE risk_score > 0.5;
CREATE INDEX idx_transactions_is_fraud ON transactions(is_fraud) WHERE is_fraud = true;
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_metadata_gin ON transactions USING GIN(metadata);

CREATE INDEX idx_audit_logs_org_timestamp ON audit_logs(organization_id, timestamp DESC);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);

CREATE INDEX idx_fraud_events_org_created ON fraud_events(organization_id, created_at DESC);
CREATE INDEX idx_fraud_events_transaction_id ON fraud_events(transaction_id);
CREATE INDEX idx_fraud_events_event_type ON fraud_events(event_type);
CREATE INDEX idx_fraud_events_severity ON fraud_events(severity);

-- Create trigger to automatically update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_transactions_updated_at
    BEFORE UPDATE ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create automated partition maintenance function
CREATE OR REPLACE FUNCTION maintenance_monthly_partitions()
RETURNS VOID AS $$
BEGIN
    -- Create next month's partitions
    PERFORM create_partitions_ahead('transactions', 7);
    PERFORM create_partitions_ahead('audit_logs', 4);
    PERFORM create_partitions_ahead('fraud_events', 4);

    -- Log the maintenance activity
    INSERT INTO audit_logs (organization_id, action, resource_type, description)
    SELECT id, 'partition_maintenance', 'system', 'Monthly partition maintenance completed'
    FROM organizations WHERE is_active = true;

    RAISE NOTICE 'Monthly partition maintenance completed';
END;
$$ LANGUAGE plpgsql;

-- Set up pg_cron for automatic maintenance (requires pg_cron extension)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        -- Schedule monthly partition maintenance
        PERFORM cron.schedule('monthly-partition-maintenance',
                           '0 2 1 * *',  -- 2 AM on the 1st of every month
                           'SELECT maintenance_monthly_partitions();');

        RAISE NOTICE 'Scheduled automatic partition maintenance with pg_cron';
    ELSE
        RAISE NOTICE 'pg_cron extension not available - manual partition maintenance required';
    END IF;
END $$;

-- Create view for recent transactions (cross-partition)
CREATE OR REPLACE VIEW recent_transactions AS
SELECT
    t.*,
    o.name as organization_name,
    u.email as reviewed_by_email
FROM transactions t
JOIN organizations o ON t.organization_id = o.id
LEFT JOIN users u ON t.reviewed_by = u.id
WHERE t.timestamp >= NOW() - interval '7 days'
ORDER BY t.timestamp DESC;

-- Create view for fraud statistics
CREATE OR REPLACE VIEW fraud_statistics AS
SELECT
    o.id as organization_id,
    o.name as organization_name,
    COUNT(*) as total_transactions,
    COUNT(*) FILTER (WHERE is_fraud = true) as fraud_transactions,
    COUNT(*) FILTER (WHERE is_flagged = true) as flagged_transactions,
    AVG(risk_score) as avg_risk_score,
    MAX(risk_score) as max_risk_score,
    DATE_TRUNC('day', t.timestamp) as date
FROM organizations o
LEFT JOIN transactions t ON o.id = t.organization_id
    AND t.timestamp >= DATE_TRUNC('day', CURRENT_DATE - interval '30 days')
WHERE o.is_active = true
GROUP BY o.id, o.name, DATE_TRUNC('day', t.timestamp)
ORDER BY date DESC, o.name;

-- Grant permissions
GRANT USAGE ON SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;

-- Insert initial configuration data
INSERT INTO audit_logs (organization_id, action, resource_type, description)
SELECT id, 'system_setup', 'partitioning', 'Time-based partitioning enabled for transactions, audit_logs, and fraud_events tables'
FROM organizations WHERE is_active = true;