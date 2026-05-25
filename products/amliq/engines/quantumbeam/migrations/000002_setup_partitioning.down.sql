-- +goose Down
-- Rollback partitioning setup

-- Drop views
DROP VIEW IF EXISTS fraud_statistics;
DROP VIEW IF EXISTS recent_transactions;

-- Drop scheduled jobs (if pg_cron is available)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        PERFORM cron.unschedule('monthly-partition-maintenance');
    END IF;
END $$;

-- Drop triggers and functions
DROP TRIGGER IF EXISTS update_transactions_updated_at ON transactions;
DROP FUNCTION IF EXISTS update_updated_at_column();
DROP FUNCTION IF EXISTS maintenance_monthly_partitions();
DROP FUNCTION IF EXISTS create_partitions_ahead();
DROP FUNCTION IF EXISTS create_monthly_partition();

-- Drop partitioned tables (this will also drop all partitions)
DROP TABLE IF EXISTS fraud_events CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;