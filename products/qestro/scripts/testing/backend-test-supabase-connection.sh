#!/bin/bash

# Test Supabase Database Connection
# Usage: ./scripts/test-supabase-connection.sh [connection-string]

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  🗄️  Supabase Connection Test                             ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Get connection string
if [ -n "$1" ]; then
    DATABASE_URL="$1"
elif [ -n "$DATABASE_URL" ]; then
    echo -e "${BLUE}ℹ️  Using DATABASE_URL from environment${NC}"
else
    echo -e "${YELLOW}⚠️  No connection string provided${NC}"
    echo -e "${YELLOW}   Usage: ./scripts/test-supabase-connection.sh 'postgresql://...'${NC}"
    echo -e "${YELLOW}   Or set DATABASE_URL environment variable${NC}"
    exit 1
fi

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Test 1: Basic Connection${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if psql "$DATABASE_URL" -c "SELECT 1;" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Connection successful${NC}"
else
    echo -e "${RED}❌ Connection failed${NC}"
    echo -e "${RED}   Check your connection string and network${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Test 2: SSL Verification${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

SSL_STATUS=$(psql "$DATABASE_URL" -t -c "SELECT CASE WHEN ssl THEN 'enabled' ELSE 'disabled' END FROM pg_stat_ssl WHERE pid = pg_backend_pid();" | xargs)

if [ "$SSL_STATUS" = "enabled" ]; then
    echo -e "${GREEN}✅ SSL is enabled${NC}"
else
    echo -e "${YELLOW}⚠️  SSL is not enabled${NC}"
    echo -e "${YELLOW}   Add ?sslmode=require to your connection string${NC}"
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Test 3: Database Version${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

VERSION=$(psql "$DATABASE_URL" -t -c "SELECT version();" | xargs)
echo -e "${GREEN}✅ $VERSION${NC}"

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Test 4: Check Tables${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

TABLE_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" | xargs)

if [ "$TABLE_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✅ Found $TABLE_COUNT tables${NC}"

    # Check for key tables
    echo ""
    echo -e "${BLUE}Key tables:${NC}"

    for table in users database_connections database_test_results recordings subscriptions; do
        if psql "$DATABASE_URL" -t -c "SELECT 1 FROM information_schema.tables WHERE table_name = '$table';" | grep -q 1; then
            echo -e "${GREEN}  ✅ $table${NC}"
        else
            echo -e "${YELLOW}  ⚠️  $table (missing)${NC}"
        fi
    done
else
    echo -e "${YELLOW}⚠️  No tables found${NC}"
    echo -e "${YELLOW}   Run migrations: npx drizzle-kit push:pg${NC}"
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Test 5: Connection Pool${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

ACTIVE_CONNECTIONS=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM pg_stat_activity WHERE datname = current_database();" | xargs)
MAX_CONNECTIONS=$(psql "$DATABASE_URL" -t -c "SHOW max_connections;" | xargs)

echo -e "${GREEN}✅ Active connections: $ACTIVE_CONNECTIONS / $MAX_CONNECTIONS${NC}"

if [ "$ACTIVE_CONNECTIONS" -gt $((MAX_CONNECTIONS * 80 / 100)) ]; then
    echo -e "${YELLOW}⚠️  Connection usage is high (>80%)${NC}"
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Test 6: Write Permission${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Try to create a test table
if psql "$DATABASE_URL" -c "CREATE TABLE IF NOT EXISTS _connection_test (id SERIAL PRIMARY KEY); DROP TABLE _connection_test;" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Write permissions OK${NC}"
else
    echo -e "${RED}❌ No write permissions${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Test 7: Database Size${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

DB_SIZE=$(psql "$DATABASE_URL" -t -c "SELECT pg_size_pretty(pg_database_size(current_database()));" | xargs)
echo -e "${GREEN}✅ Database size: $DB_SIZE${NC}"

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✅ All Tests Passed!                                      ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

echo -e "${BLUE}Next steps:${NC}"
echo -e "${BLUE}  1. Add DATABASE_URL to Render environment variables${NC}"
echo -e "${BLUE}  2. Deploy to Render${NC}"
echo -e "${BLUE}  3. Verify production connection works${NC}"
echo ""
