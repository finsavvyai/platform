#!/bin/bash

# QuantumBeam.io - PostgreSQL Partition Management Script
# Manages time-based partitions for transactions, audit_logs, and fraud_events tables

set -e

# Configuration
DB_HOST=${DB_HOST:-"localhost"}
DB_PORT=${DB_PORT:-"5432"}
DB_NAME=${DB_NAME:-"quantumbeam_dev"}
DB_USER=${DB_USER:-"postgres"}
DB_PASSWORD=${DB_PASSWORD:-"password"}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Database connection function
execute_sql() {
    local sql="$1"
    local description="$2"

    log_info "Executing: $description"

    PGPASSWORD=$DB_PASSWORD psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "$sql" || {
        log_error "Failed to execute: $description"
        exit 1
    }

    log_success "Completed: $description"
}

# Check database connection
check_connection() {
    log_info "Checking database connection..."

    if PGPASSWORD=$DB_PASSWORD psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" > /dev/null 2>&1; then
        log_success "Database connection successful"
    else
        log_error "Cannot connect to database. Please check your connection parameters."
        exit 1
    fi
}

# Create monthly partitions
create_partitions() {
    local table_name="$1"
    local months_ahead="${2:-3}"

    log_info "Creating partitions for table: $table_name"

    local sql="
    DO \$\$
    BEGIN
        -- Create current month partition
        PERFORM create_monthly_partition('$table_name', date_trunc('month', CURRENT_DATE));

        -- Create future partitions
        FOR i IN 1..$months_ahead LOOP
            PERFORM create_monthly_partition('$table_name', date_trunc('month', CURRENT_DATE + interval '1 month' * i));
        END LOOP;

        RAISE NOTICE 'Created partitions for table: $table_name';
    END \$\$;
    "

    execute_sql "$sql" "Create partitions for $table_name"
}

# List existing partitions
list_partitions() {
    local table_name="$1"

    log_info "Listing partitions for table: $table_name"

    local sql="
    SELECT
        schemaname,
        tablename,
        partitionname,
        partitiontype,
        partitionkey
    FROM pg_partitions
    WHERE tablename = '$table_name'
    ORDER BY partitionname;
    "

    PGPASSWORD=$DB_PASSWORD psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "$sql"
}

# Drop old partitions (older than specified months)
drop_old_partitions() {
    local table_name="$1"
    local months_to_keep="${2:-12}"

    log_info "Dropping partitions older than $months_to_keep months for table: $table_name"

    local sql="
    DO \$\$
    DECLARE
        partition_record RECORD;
        cutoff_date DATE := date_trunc('month', CURRENT_DATE - interval '$months_to_keep months');
        partition_name TEXT;
    BEGIN
        FOR partition_record IN
            SELECT schemaname, partitionname
            FROM pg_partitions
            WHERE tablename = '$table_name'
            AND partitionname < '$table_name' || '_' || to_char(cutoff_date, 'YYYY_MM')
        LOOP
            partition_name := partition_record.schemaname || '.' || partition_record.partitionname;
            EXECUTE 'DROP TABLE IF EXISTS ' || partition_name || ' CASCADE;';
            RAISE NOTICE 'Dropped partition: %', partition_name;
        END LOOP;
    END \$\$;
    "

    execute_sql "$sql" "Drop old partitions for $table_name"
}

# Analyze partition sizes
analyze_partition_sizes() {
    local table_name="$1"

    log_info "Analyzing partition sizes for table: $table_name"

    local sql="
    SELECT
        schemaname,
        tablename,
        partitionname,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||partitionname)) as size,
        pg_total_relation_size(schemaname||'.'||partitionname) as size_bytes
    FROM pg_partitions
    WHERE tablename = '$table_name'
    ORDER BY size_bytes DESC;
    "

    PGPASSWORD=$DB_PASSWORD psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "$sql"
}

# Run maintenance on all tables
run_maintenance() {
    log_info "Running monthly maintenance on all partitioned tables..."

    local sql="
    SELECT maintenance_monthly_partitions();
    "

    execute_sql "$sql" "Monthly partition maintenance"
}

# Show partition statistics
show_statistics() {
    log_info "Partition Statistics"
    echo "===================="

    local tables=("transactions" "audit_logs" "fraud_events")

    for table in "${tables[@]}"; do
        echo ""
        echo "Table: $table"
        echo "-------------"

        # Check if table exists and is partitioned
        local exists_sql="
        SELECT COUNT(*) FROM pg_tables WHERE tablename = '$table';
        "

        local table_exists=$(PGPASSWORD=$DB_PASSWORD psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "$exists_sql" | tr -d ' ')

        if [ "$table_exists" -eq 0 ]; then
            log_warning "Table $table does not exist"
            continue
        fi

        # Show partition count
        local count_sql="
        SELECT COUNT(*) FROM pg_partitions WHERE tablename = '$table';
        "

        local partition_count=$(PGPASSWORD=$DB_PASSWORD psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "$count_sql" | tr -d ' ')
        echo "Partitions: $partition_count"

        # Show total size
        local size_sql="
        SELECT pg_size_pretty(pg_total_relation_size('$table')) as total_size;
        "

        local total_size=$(PGPASSWORD=$DB_PASSWORD psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "$size_sql" | tr -d ' ')
        echo "Total Size: $total_size"

        # Show row count
        local rows_sql="
        SELECT COUNT(*) FROM $table;
        "

        local row_count=$(PGPASSWORD=$DB_PASSWORD psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "$rows_sql" | tr -d ' ')
        echo "Total Rows: $row_count"
    done
}

# Test partition functionality
test_partitions() {
    log_info "Testing partition functionality..."

    # Test inserting into current month partition
    local test_sql="
    INSERT INTO transactions (
        organization_id,
        transaction_id,
        amount,
        currency,
        merchant_id,
        customer_id,
        payment_method,
        timestamp
    ) VALUES (
        (SELECT id FROM organizations LIMIT 1),
        'TEST_PARTITION_' || substr(md5(random()::text), 1, 10),
        100.00,
        'USD',
        'TEST_MERCHANT',
        'TEST_CUSTOMER',
        'credit_card',
        NOW()
    );

    SELECT 'Insert successful - row count: ' || COUNT(*) FROM transactions WHERE transaction_id LIKE 'TEST_PARTITION_%';
    "

    execute_sql "$test_sql" "Test partition insert"

    # Test query performance
    local perf_sql="
    EXPLAIN (ANALYZE, BUFFERS)
    SELECT COUNT(*)
    FROM transactions
    WHERE timestamp >= DATE_TRUNC('month', CURRENT_DATE)
    AND timestamp < DATE_TRUNC('month', CURRENT_DATE) + interval '1 month';
    "

    log_info "Query performance analysis:"
    PGPASSWORD=$DB_PASSWORD psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "$perf_sql"
}

# Show usage information
show_usage() {
    echo "QuantumBeam PostgreSQL Partition Management Script"
    echo "=================================================="
    echo ""
    echo "Usage: $0 [command] [options]"
    echo ""
    echo "Commands:"
    echo "  check                  Check database connection"
    echo "  create [table] [months] Create partitions for table (default: 3 months ahead)"
    echo "  list [table]           List partitions for table"
    echo "  drop [table] [months]  Drop old partitions (default: keep 12 months)"
    echo "  analyze [table]        Analyze partition sizes"
    echo "  maintenance            Run monthly maintenance on all tables"
    echo "  stats                  Show partition statistics for all tables"
    echo "  test                   Test partition functionality"
    echo "  help                   Show this help message"
    echo ""
    echo "Tables: transactions, audit_logs, fraud_events"
    echo ""
    echo "Environment Variables:"
    echo "  DB_HOST        Database host (default: localhost)"
    echo "  DB_PORT        Database port (default: 5432)"
    echo "  DB_NAME        Database name (default: quantumbeam_dev)"
    echo "  DB_USER        Database user (default: postgres)"
    echo "  DB_PASSWORD    Database password (default: password)"
    echo ""
    echo "Examples:"
    echo "  $0 check                               # Check connection"
    echo "  $0 create transactions 6               # Create 6 months of partitions"
    echo "  $0 list transactions                   # List all partitions"
    echo "  $0 drop transactions 24                # Drop partitions older than 24 months"
    echo "  $0 analyze transactions                 # Analyze partition sizes"
    echo "  $0 maintenance                         # Run maintenance"
    echo "  $0 stats                               # Show statistics"
    echo "  $0 test                                # Test functionality"
}

# Main execution logic
main() {
    local command="${1:-help}"

    case "$command" in
        "check")
            check_connection
            ;;
        "create")
            if [ -z "$2" ]; then
                log_error "Table name is required"
                show_usage
                exit 1
            fi
            check_connection
            create_partitions "$2" "${3:-3}"
            ;;
        "list")
            if [ -z "$2" ]; then
                log_error "Table name is required"
                show_usage
                exit 1
            fi
            check_connection
            list_partitions "$2"
            ;;
        "drop")
            if [ -z "$2" ]; then
                log_error "Table name is required"
                show_usage
                exit 1
            fi
            check_connection
            drop_old_partitions "$2" "${3:-12}"
            ;;
        "analyze")
            if [ -z "$2" ]; then
                log_error "Table name is required"
                show_usage
                exit 1
            fi
            check_connection
            analyze_partition_sizes "$2"
            ;;
        "maintenance")
            check_connection
            run_maintenance
            ;;
        "stats")
            check_connection
            show_statistics
            ;;
        "test")
            check_connection
            test_partitions
            ;;
        "help"|"-h"|"--help")
            show_usage
            ;;
        *)
            log_error "Unknown command: $command"
            show_usage
            exit 1
            ;;
    esac
}

# Execute main function with all arguments
main "$@"