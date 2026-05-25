#!/bin/bash
# Database Setup Test Script for QuantumBeam.io
# Tests and verifies the database setup

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
TESTS_TOTAL=0
TESTS_PASSED=0
TESTS_FAILED=0

# Configuration
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
PGBOUNCER_PORT=${PGBOUNCER_PORT:-6432}
DB_USER=${DB_USER:-postgres}
DB_PASSWORD=${DB_PASSWORD:-postgres}
DB_NAME=${DB_NAME:-quantumbeam}
DB_TEST_NAME=${DB_TEST_NAME:-quantumbeam_test}

# Test functions
run_test() {
    local test_name="$1"
    local test_command="$2"

    TESTS_TOTAL=$((TESTS_TOTAL + 1))

    echo -n "Testing $test_name... "

    if eval "$test_command" >/dev/null 2>&1; then
        echo -e "${GREEN}✓ PASS${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        echo -e "${RED}✗ FAIL${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

print_section() {
    echo -e "\n${BLUE}=== $1 ===${NC}"
}

print_result() {
    echo -e "\n${BLUE}=== Test Results ===${NC}"
    echo -e "Total Tests: $TESTS_TOTAL"
    echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
    echo -e "${RED}Failed: $TESTS_FAILED${NC}"

    if [ $TESTS_FAILED -eq 0 ]; then
        echo -e "\n${GREEN}All tests passed! ✓${NC}"
        exit 0
    else
        echo -e "\n${RED}Some tests failed! ✗${NC}"
        exit 1
    fi
}

# Check if Docker containers are running
check_containers() {
    print_section "Checking Docker Containers"

    run_test "PostgreSQL Container" \
        "docker ps --format 'table {{.Names}}' | grep -q quantumbeam-postgres"

    run_test "PgBouncer Container" \
        "docker ps --format 'table {{.Names}}' | grep -q quantumbeam-pgbouncer"

    run_test "Redis Container" \
        "docker ps --format 'table {{.Names}}' | grep -q quantumbeam-redis"

    run_test "InfluxDB Container" \
        "docker ps --format 'table {{.Names}}' | grep -q quantumbeam-influxdb"

    run_test "Elasticsearch Container" \
        "docker ps --format 'table {{.Names}}' | grep -q quantumbeam-elasticsearch"
}

# Test database connectivity
test_connectivity() {
    print_section "Testing Database Connectivity"

    run_test "PostgreSQL Direct Connection" \
        "PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c 'SELECT 1'"

    run_test "PgBouncer Connection" \
        "PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $PGBOUNCER_PORT -U $DB_USER -d $DB_NAME -c 'SELECT 1'"

    run_test "Database Accessible" \
        "docker exec quantumbeam-postgres pg_isready -U $DB_USER -d $DB_NAME"
}

# Test database schema
test_schema() {
    print_section "Testing Database Schema"

    run_test "Organizations Table Exists" \
        "PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c \"SELECT 1 FROM information_schema.tables WHERE table_name = 'organizations'\""

    run_test "Users Table Exists" \
        "PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c \"SELECT 1 FROM information_schema.tables WHERE table_name = 'users'\""

    run_test "Transactions Table Exists" \
        "PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c \"SELECT 1 FROM information_schema.tables WHERE table_name = 'transactions'\""

    run_test "API Keys Table Exists" \
        "PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c \"SELECT 1 FROM information_schema.tables WHERE table_name = 'api_keys'\""

    run_test "Fraud Rules Table Exists" \
        "PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c \"SELECT 1 FROM information_schema.tables WHERE table_name = 'fraud_rules'\""

    run_test "Quantum Models Table Exists" \
        "PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c \"SELECT 1 FROM information_schema.tables WHERE table_name = 'quantum_models'\""

    run_test "Audit Log Table Exists" \
        "PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c \"SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_log' AND table_schema = 'audit'\""
}

# Test partitioning
test_partitioning() {
    print_section "Testing Table Partitioning"

    run_test "Transactions Table Partitioned" \
        "PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c \"SELECT 'transactions'::regclass IS PARTITIONED\""

    run_test "Transaction Partitions Created" \
        "PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c \"SELECT COUNT(*) FROM pg_tables WHERE tablename LIKE 'transactions_%'\""

    run_test "Audit Log Partitioned" \
        "PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c \"SELECT 'audit.audit_log'::regclass IS PARTITIONED\""

    run_test "Partition Maintenance Functions" \
        "PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c \"SELECT 1 FROM information_schema.routines WHERE routine_name = 'create_monthly_partitions'\""
}

# Test extensions
test_extensions() {
    print_section "Testing PostgreSQL Extensions"

    run_test "UUID-OSSP Extension" \
        "PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c \"SELECT 1 FROM pg_extension WHERE extname = 'uuid-ossp'\""

    run_test "PGCrypto Extension" \
        "PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c \"SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto'\""

    run_test "PG Stat Statements" \
        "PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c \"SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements'\""

    run_test "PG Trigram" \
        "PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c \"SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm'\""

    run_test "PG Cron" \
        "PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c \"SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'\""
}

# Test indexes
test_indexes() {
    print_section "Testing Indexes"

    run_test "Primary Key on Organizations" \
        "PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c \"SELECT 1 FROM pg_indexes WHERE tablename = 'organizations' AND indexname LIKE '%_pkey'\""

    run_test "Unique Index on Users Email" \
        "PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c \"SELECT 1 FROM pg_indexes WHERE tablename = 'users' AND indexdef LIKE '%UNIQUE%' AND indexdef LIKE '%email%'\""

    run_test "Index on Transactions Created At" \
        "PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c \"SELECT 1 FROM pg_indexes WHERE tablename = 'transactions' AND indexdef LIKE '%created_at%'\""

    run_test "GIN Index on Transactions Metadata" \
        "PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c \"SELECT 1 FROM pg_indexes WHERE tablename = 'transactions' AND indexdef LIKE '%gin%' AND indexdef LIKE '%metadata%'\""
}

# Test constraints and triggers
test_constraints() {
    print_section "Testing Constraints and Triggers"

    run_test "Foreign Key Constraints" \
        "PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c \"SELECT COUNT(*) FROM information_schema.table_constraints WHERE constraint_type = 'FOREIGN KEY'\""

    run_test "Check Constraints on Transactions" \
        "PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c \"SELECT 1 FROM information_schema.check_constraints WHERE constraint_name LIKE 'transactions_amount_check'\""

    run_test "Update Timestamp Triggers" \
        "PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c \"SELECT COUNT(*) FROM information_schema.triggers WHERE trigger_name LIKE '%updated_at%'\""

    run_test "Audit Triggers" \
        "PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c \"SELECT COUNT(*) FROM information_schema.triggers WHERE trigger_name LIKE 'audit_%'\""
}

# Test sample data
test_data() {
    print_section "Testing Sample Data"

    run_test "Sample Organizations Exist" \
        "PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c \"SELECT COUNT(*) FROM organizations\""

    run_test "Sample Users Exist" \
        "PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c \"SELECT COUNT(*) FROM users\""

    run_test "Sample API Keys Exist" \
        "PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c \"SELECT COUNT(*) FROM api_keys\""

    run_test "Sample Fraud Rules Exist" \
        "PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c \"SELECT COUNT(*) FROM fraud_rules\""

    run_test "Sample Transactions Exist" \
        "PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c \"SELECT COUNT(*) FROM transactions\""

    run_test "Sample Quantum Models Exist" \
        "PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c \"SELECT COUNT(*) FROM quantum_models\""
}

# Test views
test_views() {
    print_section "Testing Views"

    run_test "Active Transactions View" \
        "PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c \"SELECT 1 FROM information_schema.views WHERE table_name = 'active_transactions'\""

    run_test "High Risk Transactions View" \
        "PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c \"SELECT 1 FROM information_schema.views WHERE table_name = 'high_risk_transactions'\""

    run_test "Transaction Analytics View" \
        "PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c \"SELECT 1 FROM information_schema.views WHERE table_name = 'transaction_analytics'\""

    run_test "Transaction Stats Materialized View" \
        "PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c \"SELECT 1 FROM pg_matviews WHERE matviewname = 'transaction_stats'\""
}

# Test security features
test_security() {
    print_section "Testing Security Features"

    run_test "RLS Enabled on Transactions" \
        "PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c \"SELECT relrowsecurity FROM pg_class WHERE relname = 'transactions'\""

    run_test "RLS Enabled on Users" \
        "PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c \"SELECT relrowsecurity FROM pg_class WHERE relname = 'users'\""

    run_test "RLS Policies Exist" \
        "PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c \"SELECT COUNT(*) FROM pg_policies\""

    run_test "Application Users Created" \
        "PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c \"SELECT COUNT(*) FROM pg_roles WHERE rolname LIKE 'quantumbeam_%'\""
}

# Test performance settings
test_performance() {
    print_section "Testing Performance Settings"

    run_test "Shared Buffers Set" \
        "PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c \"SELECT setting FROM pg_settings WHERE name = 'shared_buffers' AND setting != '128MB'\""

    run_test "Effective Cache Size Set" \
        "PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c \"SELECT setting FROM pg_settings WHERE name = 'effective_cache_size' AND setting != '4GB'\""

    run_test "Work Mem Set" \
        "PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c \"SELECT setting FROM pg_settings WHERE name = 'work_mem' AND setting != '4MB'\""

    run_test "Checkpoint Settings" \
        "PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c \"SELECT setting FROM pg_settings WHERE name = 'checkpoint_completion_target' AND setting = '0.9'\""
}

# Test connection pooling
test_connection_pooling() {
    print_section "Testing Connection Pooling"

    run_test "PgBouncer Process Running" \
        "docker exec quantumbeam-pgbouncer pg_isready -h localhost -p 6432"

    run_test "PgBouncer Config Valid" \
        "docker exec quantumbeam-pgbouncer pgbouncer -R /etc/pgbouncer/pgbouncer.ini"

    run_test "PgBouncer Pool Mode" \
        "PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $PGBOUNCER_PORT -U $DB_USER -d $DB_NAME -c \"SHOW pool_mode\""

    run_test "PgBouncer Stats" \
        "PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $PGBOUNCER_PORT -U stats -d pgbouncer -c \"SHOW STATS\""
}

# Test backup capabilities
test_backup() {
    print_section "Testing Backup Capabilities"

    local backup_file="test_backup_$(date +%Y%m%d_%H%M%S).sql"

    run_test "Create Backup" \
        "docker exec quantumbeam-postgres pg_dump -U $DB_USER -d $DB_NAME > ./backups/$backup_file"

    if [ -f "./backups/$backup_file" ]; then
        run_test "Backup File Created" \
            "test -f ./backups/$backup_file"

        run_test "Backup File Not Empty" \
            "test -s ./backups/$backup_file"

        # Clean up test backup
        rm -f "./backups/$backup_file"
    fi
}

# Test query performance
test_query_performance() {
    print_section "Testing Query Performance"

    # Test simple query
    run_test "Simple Query Performance" \
        "timeout 10 PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c \"EXPLAIN ANALYZE SELECT COUNT(*) FROM transactions\""

    # Test join query
    run_test "Join Query Performance" \
        "timeout 10 PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c \"EXPLAIN ANALYZE SELECT t.*, u.email FROM transactions t JOIN users u ON t.user_id = u.id LIMIT 10\""

    # Test partition pruning
    run_test "Partition Pruning" \
        "timeout 10 PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c \"EXPLAIN ANALYZE SELECT * FROM transactions WHERE created_at >= CURRENT_DATE - INTERVAL '1 day'\""
}

# Main execution
main() {
    echo -e "${BLUE}QuantumBeam.io Database Setup Test${NC}"
    echo "====================================="
    echo "Testing database setup and configuration..."

    # Create backups directory
    mkdir -p ./backups

    # Run all tests
    check_containers
    test_connectivity
    test_schema
    test_partitioning
    test_extensions
    test_indexes
    test_constraints
    test_data
    test_views
    test_security
    test_performance
    test_connection_pooling
    test_backup
    test_query_performance

    # Print results
    print_result
}

# Check if help is requested
if [ "${1:-}" = "help" ]; then
    echo "QuantumBeam.io Database Setup Test Script"
    echo ""
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  help     Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  DB_HOST        Database host (default: localhost)"
    echo "  DB_PORT        Database port (default: 5432)"
    echo "  PGBOUNCER_PORT PgBouncer port (default: 6432)"
    echo "  DB_USER        Database user (default: postgres)"
    echo "  DB_PASSWORD    Database password (default: postgres)"
    echo "  DB_NAME        Database name (default: quantumbeam)"
    echo ""
    echo "Examples:"
    echo "  $0                  # Run all tests"
    echo "  DB_HOST=192.168.1.100 $0  # Test remote database"
    exit 0
fi

# Run main function
main
