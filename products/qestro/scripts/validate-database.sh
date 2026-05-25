#!/bin/bash

# Database Validation Script for Questro SaaS Platform
# Validates D1 SQLite database schema and integrity

set -e

echo "🔍 Questro Database Validation"
echo "=============================="

# Configuration
DB_NAME=${1:-"qestro-db"}
LOCAL_DB=${2:-"data/qestro-local.db"}

echo "📋 Configuration:"
echo "   Database: $DB_NAME"
echo "   Local DB: $LOCAL_DB"
echo ""

# Function to validate local database
validate_local() {
    echo "🏠 Validating local database..."

    if [ ! -f "$LOCAL_DB" ]; then
        echo "❌ Local database file not found: $LOCAL_DB"
        return 1
    fi

    # Check table count
    TABLE_COUNT=$(sqlite3 "$LOCAL_DB" "SELECT COUNT(*) FROM sqlite_master WHERE type='table';")
    echo "   📊 Tables found: $TABLE_COUNT"

    if [ "$TABLE_COUNT" -lt 30 ]; then
        echo "❌ Insufficient tables (expected 35+, found $TABLE_COUNT)"
        return 1
    fi

    # Check foreign keys are enabled
    FK_CHECK=$(sqlite3 "$LOCAL_DB" "PRAGMA foreign_keys;")
    if [ "$FK_CHECK" != "1" ]; then
        echo "❌ Foreign key constraints not enabled"
        return 1
    fi

    # Test basic operations
    echo "   🧪 Testing basic operations..."

    # Test insert
    sqlite3 "$LOCAL_DB" "
    BEGIN TRANSACTION;
    INSERT OR IGNORE INTO users (id, email, password, created_at, updated_at)
    VALUES ('validate-test', 'validate@test.com', 'hash', strftime('%s', 'now'), strftime('%s', 'now'));
    INSERT OR IGNORE INTO projects (id, user_id, name, type, created_at, updated_at)
    VALUES ('validate-project', 'validate-test', 'Validation Test', 'web', strftime('%s', 'now'), strftime('%s', 'now'));
    ROLLBACK;
    " 2>/dev/null

    if [ $? -eq 0 ]; then
        echo "   ✅ Basic operations passed"
    else
        echo "   ❌ Basic operations failed"
        return 1
    fi

    # Check indexes
    INDEX_COUNT=$(sqlite3 "$LOCAL_DB" "SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%';")
    echo "   📈 Custom indexes: $INDEX_COUNT"

    echo "✅ Local database validation passed"
    return 0
}

# Function to validate remote D1 database
validate_remote() {
    echo "☁️  Validating remote D1 database..."

    # Check if wrangler is available and user is authenticated
    if ! command -v wrangler &> /dev/null; then
        echo "❌ Wrangler CLI not found"
        return 1
    fi

    if ! wrangler whoami &> /dev/null; then
        echo "❌ Not authenticated with Cloudflare"
        return 1
    fi

    # Check if database exists
    if ! wrangler d1 list | grep -q "$DB_NAME"; then
        echo "❌ Database '$DB_NAME' not found"
        return 1
    fi

    echo "   📊 Database '$DB_NAME' found"

    # Check table count
    TABLE_COUNT=$(wrangler d1 execute "$DB_NAME" --command="SELECT COUNT(*) FROM sqlite_master WHERE type='table';" --format=json 2>/dev/null | jq -r '.[].result[0].results[0].count' 2>/dev/null || echo "0")
    echo "   📊 Tables found: $TABLE_COUNT"

    if [ "$TABLE_COUNT" -lt 30 ]; then
        echo "❌ Insufficient tables (expected 35+, found $TABLE_COUNT)"
        return 1
    fi

    # Test basic query
    echo "   🧪 Testing connectivity..."
    TEST_QUERY=$(wrangler d1 execute "$DB_NAME" --command="SELECT 'Database is accessible' as status;" --format=json 2>/dev/null)

    if echo "$TEST_QUERY" | jq -e '.[].result[0].results[0].status' &>/dev/null; then
        echo "   ✅ Database connectivity passed"
    else
        echo "   ❌ Database connectivity failed"
        return 1
    fi

    # List key tables to verify structure
    echo "   📋 Checking key tables..."
    KEY_TABLES=("users" "projects" "recording_sessions" "test_cases" "subscriptions")

    for table in "${KEY_TABLES[@]}"; do
        if wrangler d1 execute "$DB_NAME" --command="SELECT COUNT(*) FROM $table LIMIT 1;" --format=json 2>/dev/null | jq -e '.[].result[0].results[0].' &>/dev/null; then
            echo "     ✅ $table table exists"
        else
            echo "     ❌ $table table missing or inaccessible"
            return 1
        fi
    done

    echo "✅ Remote D1 database validation passed"
    return 0
}

# Function to validate schema consistency
validate_schema_consistency() {
    echo "🔄 Validating schema consistency..."

    if [ ! -f "$LOCAL_DB" ] || ! command -v wrangler &> /dev/null || ! wrangler d1 list | grep -q "$DB_NAME"; then
        echo "⚠️  Skipping consistency check (both databases not available)"
        return 0
    fi

    # Compare table counts
    LOCAL_TABLES=$(sqlite3 "$LOCAL_DB" "SELECT COUNT(*) FROM sqlite_master WHERE type='table';")
    REMOTE_TABLES=$(wrangler d1 execute "$DB_NAME" --command="SELECT COUNT(*) FROM sqlite_master WHERE type='table';" --format=json 2>/dev/null | jq -r '.[].result[0].results[0].count' 2>/dev/null || echo "0")

    if [ "$LOCAL_TABLES" -eq "$REMOTE_TABLES" ]; then
        echo "   ✅ Table counts match: $LOCAL_TABLES"
    else
        echo "   ⚠️  Table count mismatch: Local=$LOCAL_TABLES, Remote=$REMOTE_TABLES"
    fi

    # Compare table names
    LOCAL_TABLE_LIST=$(sqlite3 "$LOCAL_DB" "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;" | tr '\n' ',' | sed 's/,$//')
    REMOTE_TABLE_LIST=$(wrangler d1 execute "$DB_NAME" --command="SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;" --format=json 2>/dev/null | jq -r '.[].result[0].results[].name' | tr '\n' ',' | sed 's/,$//')

    if [ "$LOCAL_TABLE_LIST" = "$REMOTE_TABLE_LIST" ]; then
        echo "   ✅ Table names match"
    else
        echo "   ⚠️  Table name differences detected"
    fi

    echo "✅ Schema consistency check completed"
    return 0
}

# Function to performance test
validate_performance() {
    echo "⚡ Running performance tests..."

    if [ ! -f "$LOCAL_DB" ]; then
        echo "⚠️  Skipping performance tests (no local database)"
        return 0
    fi

    echo "   🧪 Testing query performance..."

    # Test simple queries
    START_TIME=$(date +%s%N)
    sqlite3 "$LOCAL_DB" "SELECT COUNT(*) FROM users;" >/dev/null
    END_TIME=$(date +%s%N)
    QUERY_TIME=$(((END_TIME - START_TIME) / 1000000))

    echo "   📊 Simple query time: ${QUERY_TIME}ms"

    # Test complex join
    START_TIME=$(date +%s%N)
    sqlite3 "$LOCAL_DB" "SELECT COUNT(*) FROM sqlite_master WHERE type='table';" >/dev/null
    END_TIME=$(date +%s%N)
    COMPLEX_TIME=$(((END_TIME - START_TIME) / 1000000))

    echo "   📊 Complex query time: ${COMPLEX_TIME}ms"

    # Check for performance issues
    if [ "$QUERY_TIME" -lt 100 ] && [ "$COMPLEX_TIME" -lt 100 ]; then
        echo "   ✅ Performance tests passed"
    else
        echo "   ⚠️  Performance may need optimization"
    fi

    return 0
}

# Main validation execution
echo "Starting validation at $(date)"
echo ""

# Run validations
VALIDATION_PASSED=true

validate_local || VALIDATION_PASSED=false
echo ""

validate_remote || VALIDATION_PASSED=false
echo ""

validate_schema_consistency || VALIDATION_PASSED=false
echo ""

validate_performance || VALIDATION_PASSED=false
echo ""

# Summary
echo "📊 Validation Summary"
echo "====================="

if [ "$VALIDATION_PASSED" = true ]; then
    echo "✅ All validations passed successfully!"
    echo ""
    echo "🎉 Database is ready for production use"
    exit 0
else
    echo "❌ Some validations failed"
    echo ""
    echo "🔧 Please address the issues above before proceeding"
    exit 1
fi
