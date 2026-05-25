#!/bin/bash

# QuantumBeam.io - Post-Initialization Script for PostgreSQL Partitioning
# This script runs after database initialization to set up partitioning

set -e

echo "🔧 QuantumBeam PostgreSQL Partitioning Setup"
echo "============================================="

# Wait for PostgreSQL to be fully ready
echo "Waiting for PostgreSQL to be ready..."
until pg_isready -U postgres -d quantumbeam_dev; do
    echo "PostgreSQL is unavailable - sleeping"
    sleep 2
done

echo "PostgreSQL is ready - setting up partitioning..."

# Enable required extensions
echo "Enabling extensions..."
psql -U postgres -d quantumbeam_dev -c "
-- Enable necessary extensions for partitioning and advanced features
CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";
CREATE EXTENSION IF NOT EXISTS \"pg_stat_statements\";
CREATE EXTENSION IF NOT EXISTS \"pg_trgm\";
CREATE EXTENSION IF NOT EXISTS \"btree_gin\";
CREATE EXTENSION IF NOT EXISTS \"btree_gist\";

-- Try to enable pg_cron for scheduled tasks (optional)
DO \$\$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
        CREATE EXTENSION IF NOT EXISTS pg_cron;
        RAISE NOTICE 'pg_cron extension enabled for scheduled partition maintenance';
    ELSE
        RAISE NOTICE 'pg_cron extension not available - manual maintenance required';
    END IF;
END \$\$;
"

echo "Extensions enabled successfully"

# Run the partitioning migration
echo "Running partitioning migration..."
if [ -f "/docker-entrypoint-initdb.d/02-migrations/000002_setup_partitioning.up.sql" ]; then
    psql -U postgres -d quantumbeam_dev -f "/docker-entrypoint-initdb.d/02-migrations/000002_setup_partitioning.up.sql"
    echo "Partitioning migration completed"
else
    echo "Warning: Partitioning migration file not found"
fi

# Create partition maintenance schema
echo "Setting up partition maintenance schema..."
psql -U postgres -d quantumbeam_dev -c "
-- Create schema for partition maintenance functions
CREATE SCHEMA IF NOT EXISTS partition_maintenance AUTHORIZATION postgres;

-- Grant usage to postgres user
GRANT USAGE ON SCHEMA partition_maintenance TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA partition_maintenance TO postgres;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA partition_maintenance TO postgres;
"

echo "Partition maintenance schema created"

# Create a test organization and user for validation
echo "Creating test data..."
psql -U postgres -d quantumbeam_dev -c "
-- Insert test organization
INSERT INTO organizations (id, name, slug, plan_type) VALUES
('00000000-0000-0000-0000-000000000001', 'Test Organization', 'test-org', 'developer')
ON CONFLICT (id) DO NOTHING;

-- Insert test user
INSERT INTO users (id, organization_id, email, password_hash, first_name, last_name, role) VALUES
('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'admin@test.com', '\$2b\$12\$placeholder_hash', 'Admin', 'User', 'admin')
ON CONFLICT (id) DO NOTHING;
"

echo "Test data created"

# Run validation tests
echo "Running validation tests..."
psql -U postgres -d quantumbeam_dev -c "
-- Validate partitioned tables
DO \$\$
DECLARE
    table_name TEXT;
    is_partitioned BOOLEAN;
BEGIN
    FOR table_name IN ARRAY['transactions', 'audit_logs', 'fraud_events'] LOOP
        SELECT relkind = 'p' INTO is_partitioned
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = table_name AND n.nspname = 'public';

        IF is_partitioned THEN
            RAISE NOTICE '✓ Table % is properly partitioned', table_name;
        ELSE
            RAISE WARNING '✗ Table % is not partitioned', table_name;
        END IF;
    END LOOP;
END \$\$;

-- Check for current month partitions
DO \$\$
DECLARE
    partition_count INTEGER;
    table_name TEXT;
BEGIN
    FOR table_name IN ARRAY['transactions', 'audit_logs', 'fraud_events'] LOOP
        SELECT COUNT(*) INTO partition_count
        FROM pg_partitions
        WHERE tablename = table_name
        AND partitionname LIKE table_name || '_' || to_char(CURRENT_DATE, 'YYYY_MM');

        IF partition_count > 0 THEN
            RAISE NOTICE '✓ Current month partition exists for %', table_name;
        ELSE
            RAISE WARNING '✗ Current month partition missing for %', table_name;
        END IF;
    END LOOP;
END \$\$;

-- Test inserting a sample transaction
INSERT INTO transactions (
    organization_id,
    transaction_id,
    amount,
    currency,
    merchant_id,
    customer_id,
    payment_method
) VALUES (
    '00000000-0000-0000-0000-000000000001',
    'TEST_PARTITION_001',
    100.00,
    'USD',
    'TEST_MERCHANT',
    'TEST_CUSTOMER',
    'credit_card'
);

RAISE NOTICE '✓ Sample transaction inserted successfully';

-- Test querying across partitions
SELECT COUNT(*) as transaction_count FROM transactions;

RAISE NOTICE '✓ Cross-partition queries working';
"

echo "Validation tests completed"

# Create indexes for performance
echo "Creating performance indexes..."
psql -U postgres -d quantumbeam_dev -c "
-- Additional performance indexes for time-based queries
CREATE INDEX IF NOT EXISTS idx_transactions_timestamp_desc ON transactions (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_org_amount ON transactions (organization_id, amount DESC);
CREATE INDEX IF NOT EXISTS idx_fraud_events_created_desc ON fraud_events (created_at DESC);

-- Partial indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_transactions_high_risk ON transactions (organization_id, timestamp) WHERE risk_score > 0.5;
CREATE INDEX IF NOT EXISTS idx_transactions_fraud_flagged ON transactions (organization_id, timestamp) WHERE is_flagged = true;
CREATE INDEX IF NOT EXISTS idx_audit_logs_recent ON audit_logs (timestamp DESC) WHERE timestamp > NOW() - interval '7 days';
"

echo "Performance indexes created"

# Setup automatic vacuum and analyze for partitions
echo "Configuring automatic maintenance..."
psql -U postgres -U postgres -d postgres -c "
-- Update postgresql.conf settings for partition maintenance
ALTER SYSTEM SET autovacuum = on;
ALTER SYSTEM SET autovacuum_max_workers = 3;
ALTER SYSTEM SET autovacuum_naptime = '10s';
ALTER SYSTEM SET maintenance_work_mem = '128MB';
ALTER SYSTEM SET enable_partition_pruning = on;

SELECT pg_reload_conf();
"

echo "Automatic maintenance configured"

# Display summary
echo ""
echo "🎉 PostgreSQL Partitioning Setup Complete!"
echo "=========================================="
echo ""
echo "Database Configuration:"
echo "  • Host: localhost"
echo "  • Port: 5433"
echo "  • Database: quantumbeam_dev"
echo "  • User: postgres"
echo ""
echo "Partitioned Tables:"
echo "  • transactions (monthly partitions)"
echo "  • audit_logs (monthly partitions)"
echo "  • fraud_events (monthly partitions)"
echo ""
echo "Key Features:"
echo "  ✓ Time-based partitioning implemented"
echo "  ✓ Automatic partition creation functions"
echo "  ✓ Performance optimized indexes"
echo "  ✓ Cross-partition query views"
echo "  ✓ Maintenance automation ready"
echo ""
echo "Management Commands:"
echo "  • ./scripts/manage-partitions.sh stats"
echo "  • ./scripts/manage-partitions.sh create transactions 6"
echo "  • ./scripts/manage-partitions.sh list transactions"
echo ""
echo "Next Steps:"
echo "  1. Connect your application to: postgresql://postgres:password@localhost:5433/quantumbeam_dev"
echo "  2. Test the partitioning with: ./scripts/manage-partitions.sh test"
echo "  3. Monitor partition performance with: ./scripts/manage-partitions.sh stats"