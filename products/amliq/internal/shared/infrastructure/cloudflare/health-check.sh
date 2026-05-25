#!/bin/bash

# Cloudflare Workers Health Check Script
# This script verifies that all Cloudflare services are properly configured

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🏥 Performing health check for FinTech Suite infrastructure...${NC}"

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo -e "${RED}❌ Wrangler CLI not found. Please install it with: npm install -g wrangler${NC}"
    exit 1
fi

# Initialize counters
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0

# Function to perform health check
health_check() {
    local check_name="$1"
    local check_command="$2"
    local expected_pattern="$3"

    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    echo -e "${YELLOW}🔍 Checking: ${check_name}${NC}"

    if eval "$check_command" 2>/dev/null | grep -q "$expected_pattern"; then
        echo -e "${GREEN}✅ PASSED: ${check_name}${NC}"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
    else
        echo -e "${RED}❌ FAILED: ${check_name}${NC}"
        FAILED_CHECKS=$((FAILED_CHECKS + 1))
    fi
}

# Function to check file existence
file_check() {
    local check_name="$1"
    local file_path="$2"

    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    echo -e "${YELLOW}🔍 Checking: ${check_name}${NC}"

    if [ -f "$file_path" ]; then
        echo -e "${GREEN}✅ PASSED: ${check_name}${NC}"
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
    else
        echo -e "${RED}❌ FAILED: ${check_name} (File not found: $file_path)${NC}"
        FAILED_CHECKS=$((FAILED_CHECKS + 1))
    fi
}

# Check configuration files
echo -e "${BLUE}📁 Checking configuration files...${NC}"
file_check "Wrangler configuration" "wrangler.toml"
file_check "Primary database migrations" "workers/migrations/db-primary/0001_initial_schema.sql"
file_check "Secondary database migrations" "workers/migrations/db-secondary/0001_initial_schema.sql"
file_check "Compliance database migrations" "workers/migrations/db-compliance/0001_initial_schema.sql"

# Check infrastructure scripts
echo -e "${BLUE}🔧 Checking infrastructure scripts...${NC}"
file_check "Database setup script" "infrastructure/cloudflare/setup-databases.sh"
file_check "R2 buckets setup script" "infrastructure/cloudflare/setup-r2-buckets.sh"
file_check "KV namespaces setup script" "infrastructure/cloudflare/setup-kv-namespaces.sh"
file_check "Vectorize setup script" "infrastructure/cloudflare/setup-vectorize-indexes.sh"
file_check "Queues setup script" "infrastructure/cloudflare/setup-queues.sh"
file_check "Environment setup script" "infrastructure/cloudflare/environment-setup.sh"
file_check "Health check script" "infrastructure/cloudflare/health-check.sh"

# Check script permissions
echo -e "${BLUE}🔒 Checking script permissions...${NC}"
health_check "Database setup script permissions" "test -x infrastructure/cloudflare/setup-databases.sh" ""
health_check "R2 buckets setup script permissions" "test -x infrastructure/cloudflare/setup-r2-buckets.sh" ""
health_check "KV namespaces setup script permissions" "test -x infrastructure/cloudflare/setup-kv-namespaces.sh" ""
health_check "Vectorize setup script permissions" "test -x infrastructure/cloudflare/setup-vectorize-indexes.sh" ""
health_check "Queues setup script permissions" "test -x infrastructure/cloudflare/setup-queues.sh" ""
health_check "Environment setup script permissions" "test -x infrastructure/cloudflare/environment-setup.sh" ""

# Check wrangler.toml configuration
echo -e "${BLUE}⚙️  Checking wrangler.toml configuration...${NC}"
health_check "Main worker configuration" "grep -q 'name = \"fintech-unified-suite\"' wrangler.toml" ""
health_check "D1 database bindings" "grep -q '\[\[d1_databases\]\]' wrangler.toml" ""
health_check "R2 bucket bindings" "grep -q '\[\[r2_buckets\]\]' wrangler.toml" ""
health_check "KV namespace bindings" "grep -q '\[\[kv_namespaces\]\]' wrangler.toml" ""
health_check "Vectorize bindings" "grep -q '\[\[vectorize\]\]' wrangler.toml" ""
health_check "Queue bindings" "grep -q '\[\[queues.producers\]\]' wrangler.toml" ""
health_check "AI bindings" "grep -q '\[ai\]' wrangler.toml" ""
health_check "Environment variables" "grep -q '\[vars\]' wrangler.toml" ""

# Check D1 database configuration in wrangler.toml
echo -e "${BLUE}🗄️  Checking D1 database configuration...${NC}"
health_check "Primary database binding" "grep -q 'binding = \"DB_PRIMARY\"' wrangler.toml" ""
health_check "Secondary database binding" "grep -q 'binding = \"DB_SECONDARY\"' wrangler.toml" ""
health_check "Compliance database binding" "grep -q 'binding = \"DB_COMPLIANCE\"' wrangler.toml" ""
health_check "Primary database name" "grep -q 'database_name = \"fintech-unified-primary\"' wrangler.toml" ""
health_check "Secondary database name" "grep -q 'database_name = \"fintech-unified-secondary\"' wrangler.toml" ""
health_check "Compliance database name" "grep -q 'database_name = \"fintech-unified-compliance\"' wrangler.toml" ""

# Check KV namespace configuration
echo -e "${BLUE}🗄️  Checking KV namespace configuration...${NC}"
health_check "Cache KV binding" "grep -q 'binding = \"CACHE_KV\"' wrangler.toml" ""
health_check "Sessions KV binding" "grep -q 'binding = \"SESSIONS_KV\"' wrangler.toml" ""
health_check "Agent memory KV binding" "grep -q 'binding = \"AGENT_MEMORY_KV\"' wrangler.toml" ""
health_check "Rate limits KV binding" "grep -q 'binding = \"RATE_LIMITS_KV\"' wrangler.toml" ""
health_check "User preferences KV binding" "grep -q 'binding = \"USER_PREFERENCES_KV\"' wrangler.toml" ""
health_check "Organization config KV binding" "grep -q 'binding = \"ORGANIZATION_CONFIG_KV\"' wrangler.toml" ""

# Check R2 bucket configuration
echo -e "${BLUE}🪣 Checking R2 bucket configuration...${NC}"
health_check "Documents R2 binding" "grep -q 'binding = \"DOCUMENTS_R2\"' wrangler.toml" ""
health_check "Backups R2 binding" "grep -q 'binding = \"BACKUPS_R2\"' wrangler.toml" ""
health_check "Evidence R2 binding" "grep -q 'binding = \"EVIDENCE_R2\"' wrangler.toml" ""
health_check "AI models R2 binding" "grep -q 'binding = \"AI_MODELS_R2\"' wrangler.toml" ""

# Check Vectorize configuration
echo -e "${BLUE}🔍 Checking Vectorize configuration...${NC}"
health_check "RAG Vectorize binding" "grep -q 'binding = \"RAG_VECTORIZE\"' wrangler.toml" ""
health_check "Document Vectorize binding" "grep -q 'binding = \"DOCUMENT_VECTORIZE\"' wrangler.toml" ""

# Check Queue configuration
echo -e "${BLUE}📋 Checking Queue configuration...${NC}"
health_check "Billing queue producer" "grep -q 'binding = \"BILLING_QUEUE\"' wrangler.toml" ""
health_check "Compliance queue producer" "grep -q 'binding = \"COMPLIANCE_QUEUE\"' wrangler.toml" ""
health_check "Intelligence queue producer" "grep -q 'binding = \"INTELLIGENCE_QUEUE\"' wrangler.toml" ""
health_check "Risk queue producer" "grep -q 'binding = \"RISK_QUEUE\"' wrangler.toml" ""
health_check "Notification queue producer" "grep -q 'binding = \"NOTIFICATION_QUEUE\"' wrangler.toml" ""

# Check environment-specific configurations
echo -e "${BLUE}🏗️  Checking environment configurations...${NC}"
health_check "Development environment" "grep -q '\[env.development\]' wrangler.toml" ""
health_check "Staging environment" "grep -q '\[env.staging\]' wrangler.toml" ""
health_check "Production environment" "grep -q '\[env.production\]' wrangler.toml" ""

# Check database schema structure
echo -e "${BLUE}🗄️  Checking database schema structure...${NC}"
health_check "Billing US customers table" "grep -q 'CREATE TABLE.*billing_us_customers' workers/migrations/db-primary/0001_initial_schema.sql" ""
health_check "Risk events table" "grep -q 'CREATE TABLE.*risk_events' workers/migrations/db-secondary/0001_initial_schema.sql" ""
health_check "Compliance US customers table" "grep -q 'CREATE TABLE.*compliance_us_customers' workers/migrations/db-compliance/0001_initial_schema.sql" ""

# Check for required tools and dependencies
echo -e "${BLUE}🛠️  Checking required tools...${NC}"
health_check "Node.js installation" "command -v node" ""
health_check "NPM installation" "command -v npm" ""
health_check "Wrangler CLI" "command -v wrangler" ""

# Check for documentation files
echo -e "${BLUE}📚 Checking documentation...${NC}"
file_check "Vectorize index documentation" "infrastructure/vectorize-index-config.md"
file_check "Queue schema documentation" "infrastructure/queue-schemas.md"
file_check "Secrets template" "infrastructure/cloudflare/secrets-template.env"

# Summary
echo -e "${BLUE}📊 Health Check Summary${NC}"
echo -e "Total checks: ${TOTAL_CHECKS}"
echo -e "${GREEN}Passed: ${PASSED_CHECKS}${NC}"
echo -e "${RED}Failed: ${FAILED_CHECKS}${NC}"

if [ $FAILED_CHECKS -eq 0 ]; then
    echo -e "${GREEN}🎉 All health checks passed! Infrastructure is ready for deployment.${NC}"
    exit 0
else
    echo -e "${RED}❌ ${FAILED_CHECKS} health check(s) failed. Please resolve the issues before proceeding.${NC}"
    exit 1
fi
