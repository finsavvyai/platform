#!/bin/bash

# Supabase Setup and Migration Script
# This script guides you through setting up Supabase and running migrations

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  🗄️  Supabase Production Database Setup                   ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Step 1: Check if DATABASE_URL is set
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 1: Check Database Connection${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if [ -z "$DATABASE_URL" ]; then
    echo -e "${YELLOW}⚠️  DATABASE_URL not set${NC}"
    echo ""
    echo -e "${PURPLE}Please follow these steps:${NC}"
    echo ""
    echo -e "${PURPLE}1. Go to https://supabase.com/${NC}"
    echo -e "${PURPLE}2. Create account and new project 'qestro-production'${NC}"
    echo -e "${PURPLE}3. Navigate to: Settings → Database → Connection String${NC}"
    echo -e "${PURPLE}4. Copy the Session Mode connection string (port 5432)${NC}"
    echo ""
    echo -e "${YELLOW}Then run this script with:${NC}"
    echo -e "${GREEN}export DATABASE_URL='postgresql://postgres.[ref]:[password]@host:5432/postgres?sslmode=require'${NC}"
    echo -e "${GREEN}./scripts/setup-supabase.sh${NC}"
    echo ""
    exit 1
else
    echo -e "${GREEN}✅ DATABASE_URL is set${NC}"

    # Mask the password in the URL for display
    MASKED_URL=$(echo "$DATABASE_URL" | sed -E 's/(:[^:@]+)@/:*****@/')
    echo -e "${BLUE}   Connection: $MASKED_URL${NC}"
fi

echo ""

# Step 2: Test basic connection
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 2: Test Connection${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Check if psql is installed
if ! command -v psql &> /dev/null; then
    echo -e "${RED}❌ psql not found${NC}"
    echo -e "${YELLOW}   Install PostgreSQL client:${NC}"
    echo -e "${YELLOW}   macOS: brew install postgresql${NC}"
    echo -e "${YELLOW}   Ubuntu: sudo apt-get install postgresql-client${NC}"
    exit 1
fi

if psql "$DATABASE_URL" -c "SELECT 1;" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Connection successful${NC}"
else
    echo -e "${RED}❌ Connection failed${NC}"
    echo -e "${RED}   Check your DATABASE_URL and network connection${NC}"
    echo ""
    echo -e "${YELLOW}Common issues:${NC}"
    echo -e "${YELLOW}   - Wrong password${NC}"
    echo -e "${YELLOW}   - Missing ?sslmode=require${NC}"
    echo -e "${YELLOW}   - Wrong port (should be 5432 for Session Mode)${NC}"
    exit 1
fi

echo ""

# Step 3: Verify SSL
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 3: Verify SSL${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

SSL_STATUS=$(psql "$DATABASE_URL" -t -c "SELECT CASE WHEN ssl THEN 'enabled' ELSE 'disabled' END FROM pg_stat_ssl WHERE pid = pg_backend_pid();" 2>/dev/null | xargs || echo "unknown")

if [ "$SSL_STATUS" = "enabled" ]; then
    echo -e "${GREEN}✅ SSL is enabled${NC}"
elif [ "$SSL_STATUS" = "disabled" ]; then
    echo -e "${RED}❌ SSL is NOT enabled${NC}"
    echo -e "${YELLOW}   Add ?sslmode=require to your DATABASE_URL${NC}"
    exit 1
else
    echo -e "${YELLOW}⚠️  Could not verify SSL status${NC}"
    echo -e "${YELLOW}   Continuing anyway...${NC}"
fi

echo ""

# Step 4: Check current tables
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 4: Check Existing Tables${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

TABLE_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" | xargs)

if [ "$TABLE_COUNT" -gt 0 ]; then
    echo -e "${YELLOW}⚠️  Found $TABLE_COUNT existing tables${NC}"
    echo ""
    echo -e "${YELLOW}Do you want to:${NC}"
    echo -e "${YELLOW}  1. Keep existing tables and add new ones (SAFE)${NC}"
    echo -e "${YELLOW}  2. Drop all tables and recreate (DESTRUCTIVE)${NC}"
    echo ""
    read -p "Enter choice (1 or 2): " CHOICE

    if [ "$CHOICE" = "2" ]; then
        echo -e "${RED}⚠️  WARNING: This will delete ALL data!${NC}"
        read -p "Type 'DELETE ALL DATA' to confirm: " CONFIRM

        if [ "$CONFIRM" = "DELETE ALL DATA" ]; then
            echo -e "${YELLOW}Dropping all tables...${NC}"
            psql "$DATABASE_URL" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" > /dev/null 2>&1
            echo -e "${GREEN}✅ All tables dropped${NC}"
        else
            echo -e "${YELLOW}Cancelled. Keeping existing tables.${NC}"
        fi
    fi
else
    echo -e "${GREEN}✅ No existing tables (fresh database)${NC}"
fi

echo ""

# Step 5: Run migrations
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 5: Run Migrations${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Check if we're in the backend directory
if [ ! -f "package.json" ]; then
    echo -e "${YELLOW}⚠️  Not in backend directory${NC}"
    if [ -d "backend" ]; then
        echo -e "${BLUE}   Switching to backend directory...${NC}"
        cd backend
    else
        echo -e "${RED}❌ Cannot find backend directory${NC}"
        exit 1
    fi
fi

# Check if drizzle-kit is installed
if ! npx drizzle-kit --version &> /dev/null; then
    echo -e "${YELLOW}⚠️  drizzle-kit not found${NC}"
    echo -e "${BLUE}   Installing dependencies...${NC}"
    npm install
fi

echo -e "${BLUE}Running migrations with Drizzle...${NC}"
echo ""

# Set environment for Supabase
export USE_SUPABASE=true
# Disable SSL certificate verification for Supabase (required for drizzle-kit)
export NODE_TLS_REJECT_UNAUTHORIZED=0

echo -e "${YELLOW}Note: Drizzle may ask about column changes.${NC}"
echo -e "${YELLOW}      For 'connection_id', select '+ connection_id create column' (press Enter)${NC}"
echo -e "${YELLOW}      For other prompts, select the first option (create/add)${NC}"
echo ""
echo -e "${BLUE}Starting migration...${NC}"

if NODE_TLS_REJECT_UNAUTHORIZED=0 npx drizzle-kit push:pg --config=drizzle.config.ts; then
    echo ""
    echo -e "${GREEN}✅ Migrations completed successfully${NC}"
else
    echo ""
    echo -e "${RED}❌ Migration failed${NC}"
    echo -e "${YELLOW}   Common issues:${NC}"
    echo -e "${YELLOW}   - Interactive prompts: You need to answer them${NC}"
    echo -e "${YELLOW}   - Connection timeout: Check your DATABASE_URL${NC}"
    echo -e "${YELLOW}   - Schema conflicts: Review changes carefully${NC}"
    echo ""
    echo -e "${YELLOW}To skip prompts and auto-accept changes, run:${NC}"
    echo -e "${GREEN}NODE_TLS_REJECT_UNAUTHORIZED=0 npx drizzle-kit push:pg --force${NC}"
    exit 1
fi

echo ""

# Step 6: Verify tables created
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 6: Verify Tables${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

FINAL_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" | xargs)

echo -e "${GREEN}✅ Found $FINAL_COUNT tables${NC}"
echo ""

# Check for key tables
echo -e "${BLUE}Key tables:${NC}"
EXPECTED_TABLES=("users" "database_connections" "database_test_results" "recordings" "subscriptions" "api_keys" "test_executions")

for table in "${EXPECTED_TABLES[@]}"; do
    if psql "$DATABASE_URL" -t -c "SELECT 1 FROM information_schema.tables WHERE table_name = '$table';" | grep -q 1; then
        echo -e "${GREEN}  ✅ $table${NC}"
    else
        echo -e "${YELLOW}  ⚠️  $table (missing)${NC}"
    fi
done

echo ""

# Step 7: Run connection test script
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}Step 7: Full Connection Test${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if [ -f "scripts/test-supabase-connection.sh" ]; then
    echo -e "${BLUE}Running comprehensive connection test...${NC}"
    echo ""
    bash scripts/test-supabase-connection.sh "$DATABASE_URL"
else
    echo -e "${YELLOW}⚠️  Connection test script not found${NC}"
fi

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✅ Supabase Setup Complete!                               ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

echo -e "${PURPLE}Next Steps:${NC}"
echo -e "${PURPLE}1. Add DATABASE_URL to Render environment variables${NC}"
echo -e "${PURPLE}2. Add security secrets to Render (see SECURITY_IMPLEMENTATION_GUIDE.md)${NC}"
echo -e "${PURPLE}3. Deploy backend to Render${NC}"
echo -e "${PURPLE}4. Test production deployment${NC}"
echo ""

echo -e "${BLUE}To add to Render:${NC}"
echo -e "${GREEN}1. Go to https://dashboard.render.com/${NC}"
echo -e "${GREEN}2. Select 'questro-api' service${NC}"
echo -e "${GREEN}3. Click 'Environment' tab${NC}"
echo -e "${GREEN}4. Add DATABASE_URL with your connection string${NC}"
echo ""
