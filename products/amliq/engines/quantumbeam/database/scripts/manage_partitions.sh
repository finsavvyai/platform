#!/bin/bash
# Partition Management Script for QuantumBeam.io
# Manages time-based partitions for PostgreSQL tables

set -euo pipefail

# Configuration
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-quantumbeam}
DB_USER=${DB_USER:-postgres}
DB_PASSWORD=${DB_PASSWORD:-postgres}

# Partition settings
TRANSACTIONS_RETENTION_MONTHS=${TRANSACTIONS_RETENTION_MONTHS:-12}
AUDIT_RETENTION_MONTHS=${AUDIT_RETENTION_MONTHS:-24}
METRICS_RETENTION_MONTHS=${METRICS_RETENTION_MONTHS:-36}
PARTITIONS_AHEAD=${PARTITIONS_AHEAD:-3}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
    exit 1
}

# Execute SQL with error handling
execute_sql() {
    local sql="$1"
    local description="$2"

    log "Executing: $description"

    PGPASSWORD=$DB_PASSWORD psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 <<-EOF$sql
EOF

    if [ $? -eq 0 ]; then
        log "✓ Successfully executed: $description"
    else
        error "✗ Failed to execute: $description"
    fi
}

# Create monthly partitions
create_partitions() {
    local table_name="$1"
    local months_ahead="$2"

    log "Creating $months_ahead months ahead partitions for table: $table_name"

    local sql="
    DO \$\$
    DECLARE
        start_date DATE;
        end_date DATE;
        partition_name TEXT;
        i INTEGER;
    BEGIN
        FOR i IN 0..$months_ahead LOOP
            start_date := date_trunc('month', CURRENT_DATE + interval '1 month' * i);
            end_date := start_date + interval '1 month';
            partition_name := '$table_name' || '_' || to_char(start_date, 'YYYY_MM');

            EXECUTE format('CREATE TABLE IF NOT EXISTS %I PARTITION OF %I FOR VALUES FROM (%L) TO (%L)',
                          partition_name, '$table_name', start_date, end_date);

            -- Log partition creation
            RAISE NOTICE 'Created partition: %', partition_name;
        END LOOP;
    END
    \$\$;
    "

    execute_sql "$sql" "Create partitions for $table_name"
}

# Drop old partitions
drop_old_partitions() {
    local table_name="$1"
    local keep_months="$2"

    log "Dropping partitions older than $keep_months months for table: $table_name"

    local sql="
    DO \$\$
    DECLARE
        cutoff_date DATE;
        rec RECORD;
        partitions_to_drop TEXT[];
    BEGIN
        cutoff_date := date_trunc('month', CURRENT_DATE - interval '1 month' * $keep_months);

        -- Find partitions to drop
        FOR rec IN
            SELECT tablename
            FROM pg_tables
            WHERE tablename LIKE '$table_name' || '_%'
            AND schemaname = CASE WHEN '$table_name' LIKE 'audit.%' THEN 'audit' ELSE 'public' END
        LOOP
            IF rec.tablename < '$table_name' || '_' || to_char(cutoff_date, 'YYYY_MM') THEN
                partitions_to_drop := array_append(partitions_to_drop, rec.tablename);
            END IF;
        END LOOP;

        -- Drop partitions
        FOREACH partition_name IN ARRAY partitions_to_drop
        LOOP
            EXECUTE 'DROP TABLE IF EXISTS ' || CASE WHEN '$table_name' LIKE 'audit.%' THEN 'audit.' ELSE 'public.' END || partition_name || ' CASCADE';
            RAISE NOTICE 'Dropped partition: %', partition_name;
        END LOOP;
    END
    \$\$;
    "

    execute_sql "$sql" "Drop old partitions for $table_name"
}

# Create indexes on partitions
create_partition_indexes() {
    local table_name="$1"

    log "Creating indexes on partitions for table: $table_name"

    local sql="
    DO \$\$
    DECLARE
        rec RECORD;
        schema_name TEXT := CASE WHEN '$table_name' LIKE 'audit.%' THEN 'audit' ELSE 'public' END;
        base_table TEXT := CASE WHEN '$table_name' LIKE 'audit.%' THEN substring('$table_name' FROM 7) ELSE '$table_name' END;
    BEGIN
        FOR rec IN
            SELECT tablename
            FROM pg_tables
            WHERE tablename LIKE base_table || '_%'
            AND schemaname = schema_name
        LOOP
            -- Create common indexes
            IF base_table = 'transactions' THEN
                EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (organization_id)',
                              'idx_' || rec.tablename || '_organization_id', schema_name || '.' || rec.tablename);
                EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (created_at)',
                              'idx_' || rec.tablename || '_created_at', schema_name || '.' || rec.tablename);
                EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (status)',
                              'idx_' || rec.tablename || '_status', schema_name || '.' || rec.tablename);
            ELSIF base_table = 'audit_log' THEN
                EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (timestamp)',
                              'idx_' || rec.tablename || '_timestamp', schema_name || '.' || rec.tablename);
                EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (table_name)',
                              'idx_' || rec.tablename || '_table_name', schema_name || '.' || rec.tablename);
            END IF;
        END LOOP;
    END
    \$\$;
    "

    execute_sql "$sql" "Create indexes on partitions for $table_name"
}

# Analyze partitions
analyze_partitions() {
    local table_name="$1"

    log "Analyzing partitions for table: $table_name"

    local sql="
    DO \$\$
    DECLARE
        rec RECORD;
        schema_name TEXT := CASE WHEN '$table_name' LIKE 'audit.%' THEN 'audit' ELSE 'public' END;
        base_table TEXT := CASE WHEN '$table_name' LIKE 'audit.%' THEN substring('$table_name' FROM 7) ELSE '$table_name' END;
    BEGIN
        FOR rec IN
            SELECT tablename
            FROM pg_tables
            WHERE tablename LIKE base_table || '_%'
            AND schemaname = schema_name
        LOOP
            EXECUTE 'ANALYZE ' || schema_name || '.' || rec.tablename;
            RAISE NOTICE 'Analyzed partition: %', rec.tablename;
        END LOOP;
    END
    \$\$;
    "

    execute_sql "$sql" "Analyze partitions for $table_name"
}

# Show partition status
show_partition_status() {
    local table_name="$1"

    log "Partition status for table: $table_name"

    local sql="
    SELECT
        schemaname,
        tablename,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
        pg_stat_get_numscans(oid) as scans,
        pg_stat_get_tuples_returned(oid) as tuples_returned
    FROM pg_tables
    WHERE tablename LIKE '$table_name' || '_%'
    AND schemaname = CASE WHEN '$table_name' LIKE 'audit.%' THEN 'audit' ELSE 'public' END
    ORDER BY tablename DESC;
    "

    PGPASSWORD=$DB_PASSWORD psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "$sql"
}

# Vacuum partitions
vacuum_partitions() {
    local table_name="$1"

    log "Vacuuming partitions for table: $table_name"

    local sql="
    DO \$\$
    DECLARE
        rec RECORD;
        schema_name TEXT := CASE WHEN '$table_name' LIKE 'audit.%' THEN 'audit' ELSE 'public' END;
        base_table TEXT := CASE WHEN '$table_name' LIKE 'audit.%' THEN substring('$table_name' FROM 7) ELSE '$table_name' END;
    BEGIN
        FOR rec IN
            SELECT tablename
            FROM pg_tables
            WHERE tablename LIKE base_table || '_%'
            AND schemaname = schema_name
        LOOP
            EXECUTE 'VACUUM ANALYZE ' || schema_name || '.' || rec.tablename;
            RAISE NOTICE 'Vacuumed partition: %', rec.tablename;
        END LOOP;
    END
    \$\$;
    "

    execute_sql "$sql" "Vacuum partitions for $table_name"
}

# Migrate data to partitions
migrate_to_partitions() {
    local table_name="$1"

    log "Migrating data to partitions for table: $table_name"

    local sql="
    DO \$\$
    DECLARE
        rec RECORD;
        count INTEGER;
    BEGIN
        -- Check if there's data in the default partition
        EXECUTE format('SELECT COUNT(*) FROM %I', '$table_name' || '_default') INTO count;

        IF count > 0 THEN
            RAISE NOTICE 'Found % rows in default partition, migrating...', count;

            -- Move data to appropriate partitions
            EXECUTE format('
                INSERT INTO %I
                SELECT * FROM %I
                WHERE created_at >= date_trunc(''month'', CURRENT_DATE - interval ''1 month'')
                ON CONFLICT DO NOTHING
            ', '$table_name', '$table_name' || '_default');

            -- Delete migrated data from default partition
            EXECUTE format('
                DELETE FROM %I
                WHERE created_at >= date_trunc(''month'', CURRENT_DATE - interval ''1 month'')
            ', '$table_name' || '_default');

            GET DIAGNOSTICS count = ROW_COUNT;
            RAISE NOTICE 'Migrated % rows to partitions', count;
        END IF;
    END
    \$\$;
    "

    execute_sql "$sql" "Migrate data to partitions for $table_name"
}

# Main function
main() {
    local action="${1:-all}"

    log "Starting partition management for QuantumBeam.io"
    log "Database: $DB_HOST:$DB_PORT/$DB_NAME"

    case "$action" in
        "create")
            log "Creating future partitions..."
            create_partitions "transactions" $PARTITIONS_AHEAD
            create_partitions "audit.audit_log" $PARTITIONS_AHEAD
            ;;
        "drop")
            log "Dropping old partitions..."
            drop_old_partitions "transactions" $TRANSACTIONS_RETENTION_MONTHS
            drop_old_partitions "audit.audit_log" $AUDIT_RETENTION_MONTHS
            ;;
        "indexes")
            log "Creating indexes on partitions..."
            create_partition_indexes "transactions"
            create_partition_indexes "audit.audit_log"
            ;;
        "analyze")
            log "Analyzing partitions..."
            analyze_partitions "transactions"
            analyze_partitions "audit.audit_log"
            ;;
        "vacuum")
            log "Vacuuming partitions..."
            vacuum_partitions "transactions"
            vacuum_partitions "audit.audit_log"
            ;;
        "status")
            show_partition_status "transactions"
            show_partition_status "audit.audit_log"
            ;;
        "migrate")
            log "Migrating data to partitions..."
            migrate_to_partitions "transactions"
            migrate_to_partitions "audit.audit_log"
            ;;
        "all")
            log "Running full partition maintenance..."
            create_partitions "transactions" $PARTITIONS_AHEAD
            create_partitions "audit.audit_log" $PARTITIONS_AHEAD
            create_partition_indexes "transactions"
            create_partition_indexes "audit.audit_log"
            analyze_partitions "transactions"
            analyze_partitions "audit.audit_log"
            ;;
        *)
            echo "Usage: $0 {create|drop|indexes|analyze|vacuum|status|migrate|all}"
            echo ""
            echo "Actions:"
            echo "  create   - Create future partitions"
            echo "  drop     - Drop old partitions"
            echo "  indexes  - Create indexes on partitions"
            echo "  analyze  - Analyze partitions for statistics"
            echo "  vacuum   - Vacuum partitions"
            echo "  status   - Show partition status"
            echo "  migrate  - Migrate data to partitions"
            echo "  all      - Run all maintenance tasks"
            exit 1
            ;;
    esac

    log "Partition management completed successfully!"
}

# Check if database is accessible
if ! PGPASSWORD=$DB_PASSWORD psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" &>/dev/null; then
    error "Cannot connect to database. Please check connection parameters."
fi

# Run main function
main "$@"
