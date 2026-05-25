#!/bin/bash
# Partition Maintenance Script for QuantumBeam.io
# Manages time-based partitions for high-volume tables

set -e

# Configuration
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_USER=${DB_USER:-postgres}
DB_PASSWORD=${DB_PASSWORD:-postgres}
DB_NAME=${DB_NAME:-quantumbeam}
LOG_FILE=${LOG_FILE:-./logs/partition-maintenance.log}

# Create log directory if it doesn't exist
mkdir -p "$(dirname "$LOG_FILE")"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Function to execute SQL
execute_sql() {
    local sql="$1"
    local description="$2"

    log "Executing: $description"
    log "SQL: $sql"

    PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "$sql" >> "$LOG_FILE" 2>&1

    if [ $? -eq 0 ]; then
        log "✓ Success: $description"
    else
        log "✗ Failed: $description"
        return 1
    fi
}

# Function to create monthly partitions
create_monthly_partitions() {
    local table_name="$1"
    local months_ahead="${2:-3}"

    log "Creating monthly partitions for table: $table_name"

    execute_sql "
    SELECT create_monthly_partitions('$table_name', $months_ahead);
    " "Create monthly partitions for $table_name"
}

# Function to create daily partitions (for high-traffic tables)
create_daily_partitions() {
    local table_name="$1"
    local days_ahead="${2:-7}"

    log "Creating daily partitions for table: $table_name"

    execute_sql "
    SELECT create_daily_partitions('$table_name', $days_ahead);
    " "Create daily partitions for $table_name"
}

# Function to drop old partitions
drop_old_partitions() {
    local table_name="$1"
    local keep_months="${2:-12}"

    log "Dropping old partitions for table: $table_name (keeping $keep_months months)"

    execute_sql "
    SELECT drop_old_partitions('$table_name', $keep_months);
    " "Drop old partitions for $table_name"
}

# Function to analyze partitions
analyze_partitions() {
    local table_name="$1"

    log "Analyzing partitions for table: $table_name"

    execute_sql "
    DO \$\$
    DECLARE
        partition_name TEXT;
    BEGIN
        FOR partition_name IN
            SELECT tablename
            FROM pg_tables
            WHERE tablename LIKE '$table_name\_%'
            ORDER BY tablename DESC
        LOOP
            EXECUTE 'ANALYZE ' || quote_ident(partition_name);
            RAISE NOTICE 'Analyzed partition: %', partition_name;
        END LOOP;
    END \$\$;
    " "Analyze partitions for $table_name"
}

# Function to get partition statistics
get_partition_stats() {
    local table_name="$1"

    log "Getting partition statistics for: $table_name"

    execute_sql "
    SELECT
        schemaname,
        tablename,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
        pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) as index_size,
        (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = schemaname AND table_name = tablename) as columns
    FROM pg_tables
    WHERE tablename LIKE '$table_name\_%'
    ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
    " "Get partition stats for $table_name"
}

# Function to check partition health
check_partition_health() {
    local table_name="$1"

    log "Checking partition health for: $table_name"

    execute_sql "
    WITH partition_info AS (
        SELECT
            tablename,
            CASE
                WHEN tablename LIKE '%_2024_01' THEN '2024-01-01'::date
                WHEN tablename LIKE '%_2024_02' THEN '2024-02-01'::date
                WHEN tablename LIKE '%_2024_03' THEN '2024-03-01'::date
                WHEN tablename LIKE '%_2024_04' THEN '2024-04-01'::date
                WHEN tablename LIKE '%_2024_05' THEN '2024-05-01'::date
                WHEN tablename LIKE '%_2024_06' THEN '2024-06-01'::date
                WHEN tablename LIKE '%_2024_07' THEN '2024-07-01'::date
                WHEN tablename LIKE '%_2024_08' THEN '2024-08-01'::date
                WHEN tablename LIKE '%_2024_09' THEN '2024-09-01'::date
                WHEN tablename LIKE '%_2024_10' THEN '2024-10-01'::date
                WHEN tablename LIKE '%_2024_11' THEN '2024-11-01'::date
                WHEN tablename LIKE '%_2024_12' THEN '2024-12-01'::date
                ELSE NULL
            END as partition_date
        FROM pg_tables
        WHERE tablename LIKE '$table_name\_%'
    )
    SELECT
        tablename,
        partition_date,
        CASE
            WHEN partition_date IS NULL THEN 'unknown'
            WHEN partition_date >= date_trunc('month', CURRENT_DATE) - interval '2 months' THEN 'active'
            WHEN partition_date >= date_trunc('month', CURRENT_DATE) - interval '14 months' THEN 'archivable'
            ELSE 'archived'
        END as status,
        CASE
            WHEN partition_date < date_trunc('month', CURRENT_DATE) - interval '2 months'
            AND partition_date >= date_trunc('month', CURRENT_DATE) - interval '14 months'
            THEN 'Consider archiving to cold storage'
            WHEN partition_date < date_trunc('month', CURRENT_DATE) - interval '14 months'
            THEN 'Ready for deletion'
            ELSE 'OK'
        END as recommendation
    FROM partition_info
    ORDER BY partition_date DESC NULLS LAST;
    " "Check partition health for $table_name"
}

# Function to archive old partitions
archive_partitions() {
    local table_name="$1"
    local archive_months="${2:-12}"

    log "Archiving partitions older than $archive_months months for: $table_name"

    # This would create backup tables before dropping
    execute_sql "
    DO \$\$
    DECLARE
        partition_record RECORD;
        backup_name TEXT;
    BEGIN
        FOR partition_record IN
            SELECT tablename
            FROM pg_tables
            WHERE tablename LIKE '$table_name\_%'
            AND tablename < '$table_name\_' || to_char(date_trunc('month', CURRENT_DATE - interval '$archive_months months'), 'YYYY_MM')
        LOOP
            backup_name := 'archive_' || partition_record.tablename || '_' || to_char(now(), 'YYYYMMDD_HH24MISS');

            -- Create backup
            EXECUTE format('CREATE TABLE %I AS SELECT * FROM %I', backup_name, partition_record.tablename);

            -- Log the backup
            RAISE NOTICE 'Archived partition % to %', partition_record.tablename, backup_name;
        END LOOP;
    END \$\$;
    " "Archive old partitions for $table_name"
}

# Main script logic
case "${1:-help}" in
    "create-monthly")
        if [ -z "$2" ]; then
            echo "Usage: $0 create-monthly <table_name> [months_ahead]"
            exit 1
        fi
        create_monthly_partitions "$2" "${3:-3}"
        ;;

    "create-daily")
        if [ -z "$2" ]; then
            echo "Usage: $0 create-daily <table_name> [days_ahead]"
            exit 1
        fi
        create_daily_partitions "$2" "${3:-7}"
        ;;

    "drop-old")
        if [ -z "$2" ]; then
            echo "Usage: $0 drop-old <table_name> [keep_months]"
            exit 1
        fi
        drop_old_partitions "$2" "${3:-12}"
        ;;

    "analyze")
        if [ -z "$2" ]; then
            echo "Usage: $0 analyze <table_name>"
            exit 1
        fi
        analyze_partitions "$2"
        ;;

    "stats")
        if [ -z "$2" ]; then
            echo "Usage: $0 stats <table_name>"
            exit 1
        fi
        get_partition_stats "$2"
        ;;

    "health")
        if [ -z "$2" ]; then
            echo "Usage: $0 health <table_name>"
            exit 1
        fi
        check_partition_health "$2"
        ;;

    "archive")
        if [ -z "$2" ]; then
            echo "Usage: $0 archive <table_name> [archive_months]"
            exit 1
        fi
        archive_partitions "$2" "${3:-12}"
        ;;

    "maintenance-all")
        log "Running comprehensive partition maintenance"

        # Create new partitions
        create_monthly_partitions "transactions" 3
        create_monthly_partitions "audit.audit_log" 3

        # Analyze partitions
        analyze_partitions "transactions"
        analyze_partitions "audit.audit_log"

        # Check health
        check_partition_health "transactions"
        check_partition_health "audit.audit_log"

        # Show stats
        get_partition_stats "transactions"

        log "Partition maintenance completed"
        ;;

    "cleanup")
        log "Running partition cleanup"

        # Drop old partitions
        drop_old_partitions "transactions" 12
        drop_old_partitions "audit.audit_log" 24

        log "Partition cleanup completed"
        ;;

    "cron")
        # For use in cron jobs
        log "Running scheduled maintenance"

        # First day of month: create new partitions and drop old ones
        if [ $(date +%d) -eq 1 ]; then
            maintenance-all
            cleanup
        # Weekly: analyze and check health
        elif [ $(date +%u) -eq 1 ]; then
            analyze_partitions "transactions"
            check_partition_health "transactions"
        fi

        log "Scheduled maintenance completed"
        ;;

    "help"|*)
        echo "QuantumBeam.io Partition Maintenance Script"
        echo ""
        echo "Usage: $0 [command] [args]"
        echo ""
        echo "Commands:"
        echo "  create-monthly <table> [months]  Create monthly partitions"
        echo "  create-daily <table> [days]      Create daily partitions"
        echo "  drop-old <table> [months]       Drop old partitions"
        echo "  analyze <table>                 Analyze partitions"
        echo "  stats <table>                   Show partition statistics"
        echo "  health <table>                  Check partition health"
        echo "  archive <table> [months]        Archive old partitions"
        echo "  maintenance-all                 Run full maintenance"
        echo "  cleanup                         Drop old partitions"
        echo "  cron                            For cron job execution"
        echo "  help                            Show this help"
        echo ""
        echo "Examples:"
        echo "  $0 create-monthly transactions 3"
        echo "  $0 stats transactions"
        echo "  $0 maintenance-all"
        ;;
esac

log "Script completed at $(date '+%Y-%m-%d %H:%M:%S')"
