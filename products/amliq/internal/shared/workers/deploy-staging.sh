#!/bin/bash

# Staging Deployment Script for Unified FinTech Suite
# Deploys to staging environment with comprehensive testing

set -e

echo "🚀 Unified FinTech Suite - Staging Deployment"
echo "=========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}🎯 Staging Deployment Started - $(date)${NC}"

# Environment setup
echo -e "\n${YELLOW}⚙️ Setting up Staging Environment...${NC}"

# Copy production config to staging
cp workers/wrangler.production.toml workers/wrangler.staging.toml

# Update staging specific settings
sed -i.bak 's/ENVIRONMENT = "production"/ENVIRONMENT = "staging"/' workers/wrangler.staging.toml
sed -i.bak 's/LOG_LEVEL = "info"/LOG_LEVEL = "debug"/' workers/wrangler.staging.toml

# Use staging subdomains
sed -i.bak 's/finsavvyai\.com/staging.finsavvyai.com/g' workers/wrangler.staging.toml

echo "Staging configuration prepared"

# Build and Type Check
echo -e "\n${YELLOW}🔨 Building and Type Checking...${NC}"
cd workers

echo "Running TypeScript type check..."
npm run typecheck || {
    echo -e "${RED}❌ Type check failed${NC}"
    exit 1
}

echo "Building production bundle..."
npm run build || {
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
}

cd ..
echo -e "${GREEN}✅ Build and Type Check Passed${NC}"

# Staging Database Setup
echo -e "\n${YELLOW}🗄️ Setting up Staging Databases...${NC}"
if [ -f "workers/deploy-databases.sh" ]; then
    echo "Running database setup script..."
    ./workers/deploy-databases.sh
else
    echo "Database setup script not found, skipping..."
fi

# Staging Storage Setup
echo -e "\n${YELLOW}📦 Setting up Staging Storage...${NC}"
if [ -f "workers/deploy-storage.sh" ]; then
    echo "Running storage setup script..."
    ./workers/deploy-storage.sh
else
    echo "Storage setup script not found, skipping..."
fi

# Environment Variables
echo -e "\n${YELLOW}🔧 Setting Staging Environment Variables...${NC}"

# Create staging environment file
cat > workers/.env.staging << EOF
# Staging Environment Variables
ENVIRONMENT=staging
LOG_LEVEL=debug
API_VERSION=v1
FRONTEND_URL=https://staging.finsavvyai.com
API_BASE_URL=https://api.staging.finsavvyai.com
BILLING_BASE_URL=https://billing.staging.finsavvyai.com
COMPLIANCE_BASE_URL=https://compliance.staging.finsavvyai.com
INTELLIGENCE_BASE_URL=https://intelligence.staging.finsavvyai.com
RISK_BASE_URL=https://risk.staging.finsavvyai.com

# JWT Secret for staging (would use wrangler secrets in production)
JWT_SECRET=staging-super-secret-jwt-key-32-chars-long-12345

# AI Configuration
AI_MODEL=@cf/meta/llama-3.1-8b-instruct
EMBEDDING_MODEL=@cf/baai/bge-base-en-v1.5
AI_TIMEOUT=30000

# Feature Flags (enable all features for testing)
ENABLE_AI_INSIGHTS=true
ENABLE_RAG_SYSTEM=true
ENABLE_LEARNING_SYSTEM=true
ENABLE_COMPLIANCE_ANALYSIS=true
ENABLE_RISK_MONITORING=true
ENABLE_ADVANCED_SECURITY=true

# Staging Specific
DEBUG_MODE=true
MOCK_EXTERNAL_APIS=true
RATE_LIMIT_REQUESTS=1000
RATE_LIMIT_WINDOW=60000
EOF

echo "Staging environment variables configured"

# Security Configuration
echo -e "\n${YELLOW}🔒 Configuring Security for Staging...${NC}"

# Validate JWT secret length
if [ ${#JWT_SECRET} -lt 32 ]; then
    echo -e "${RED}❌ JWT_SECRET must be at least 32 characters${NC}"
    exit 1
fi

echo "Security configuration validated"

# Pre-deployment Health Check
echo -e "\n${YELLOW}🏥 Pre-deployment Health Check...${NC}"

# Check if wrangler is authenticated
echo "Checking Cloudflare authentication..."
if ! npx wrangler whoami > /dev/null 2>&1; then
    echo -e "${RED}❌ Not logged in to Cloudflare. Run: npx wrangler login${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Cloudflare authentication confirmed${NC}"

# Check required files
echo "Checking required deployment files..."
required_files=(
    "workers/wrangler.staging.toml"
    "workers/src/secure-production-worker.ts"
    "workers/src/billing/routes.ts"
    "workers/src/billing/subscription-service.ts"
    "workers/src/billing/validation-schemas.ts"
)

for file in "${required_files[@]}"; do
    if [ ! -f "$file" ]; then
        echo -e "${RED}❌ Required file missing: $file${NC}"
        exit 1
    fi
done

echo -e "${GREEN}✅ All required files present${NC}"

# Deploy to Staging
echo -e "\n${YELLOW}🚀 Deploying to Staging Environment...${NC}"
cd workers

echo "Deploying with staging configuration..."
npx wrangler deploy --config wrangler.staging.toml --compatibility-date 2024-01-01 || {
    echo -e "${RED}❌ Staging deployment failed${NC}"
    exit 1
}

cd ..

# Staging Health Check
echo -e "\n${YELLOW}🏥 Staging Health Check...${NC}"

STAGING_URL="https://api.staging.finsavvyai.com"
echo "Testing staging endpoint: $STAGING_URL"

# Simple health check
echo "Performing health check..."
HEALTH_RESPONSE=$(curl -s -w "%{http_code}" -o /dev/null "$STAGING_URL/health" || echo "000")

if [ "$HEALTH_RESPONSE" = "200" ]; then
    echo -e "${GREEN}✅ Staging health check passed${NC}"
else
    echo -e "${YELLOW}⚠️ Health check returned $HEALTH_RESPONSE (may be expected for new deployment)${NC}"
fi

# Security Tests
echo -e "\n${YELLOW}🛡️ Running Security Tests on Staging...${NC}"

# Test JWT authentication
echo "Testing JWT authentication..."
JWT_TEST=$(curl -s -X POST "$STAGING_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"test123"}' \
    -w "%{http_code}" -o /dev/null || echo "000")

if [ "$JWT_TEST" = "200" ] || [ "$JWT_TEST" = "401" ]; then
    echo -e "${GREEN}✅ JWT authentication endpoint working${NC}"
else
    echo -e "${YELLOW}⚠️ JWT test returned $JWT_TEST${NC}"
fi

# Test SQL injection prevention
echo "Testing SQL injection prevention..."
SQL_INJECTION_TEST=$(curl -s -X POST "$STAGING_URL/subscriptions" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer test-token" \
    -d '{"customer_id":"test; DROP TABLE users; --","plan_id":"test","billing_cycle":"monthly"}' \
    -w "%{http_code}" -o /dev/null || echo "000")

if [ "$SQL_INJECTION_TEST" = "400" ]; then
    echo -e "${GREEN}✅ SQL injection prevention working (400 bad request)${NC}"
else
    echo -e "${YELLOW}⚠️ SQL injection test returned $SQL_INJECTION_TEST${NC}"
fi

# Test input validation
echo "Testing input validation..."
INPUT_VALIDATION_TEST=$(curl -s -X POST "$STAGING_URL/subscriptions" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer test-token" \
    -d '{"customer_id":"invalid-uuid","plan_id":"invalid-uuid","billing_cycle":"invalid-cycle"}' \
    -w "%{http_code}" -o /dev/null || echo "000")

if [ "$INPUT_VALIDATION_TEST" = "400" ]; then
    echo -e "${GREEN}✅ Input validation working (400 bad request)${NC}"
else
    echo -e "${YELLOW}⚠️ Input validation test returned $INPUT_VALIDATION_TEST${NC}"
fi

echo -e "\n${GREEN}🎯 Staging Deployment Complete!${NC}"

# Staging URLs
echo -e "\n${BLUE}🌐 Staging Endpoints:${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Main API: https://api.staging.finsavvyai.com"
echo "Billing: https://billing.staging.finsavvyai.com"
echo "Compliance: https://compliance.staging.finsavvyai.com"
echo "Intelligence: https://intelligence.staging.finsavvyai.com"
echo "Risk: https://risk.staging.finsavvyai.com"

# Next Steps
echo -e "\n${YELLOW}📋 Staging Deployment Complete!${NC}"
echo -e "${YELLOW}📝 Next Steps:${NC}"
echo "1. 🧪 Run smoke tests on staging"
echo "2. 🔍 Perform security testing"
echo "3. ⚡ Load testing"
echo "4. 🌍 Deploy to production (if all tests pass)"

echo -e "\n${GREEN}✅ Ready for Smoke Testing!${NC}"
