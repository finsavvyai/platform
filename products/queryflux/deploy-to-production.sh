#!/bin/bash

# QueryFlux Production Deployment Script
# This script automates Steps 2-4 of the deployment process
# You must have already created a Neon database (Step 1)

set -e  # Exit on error

echo "========================================="
echo "QueryFlux Production Deployment"
echo "========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check prerequisites
echo "Checking prerequisites..."

if ! command -v psql &> /dev/null; then
    echo -e "${RED}ERROR: psql not found. Install PostgreSQL client first.${NC}"
    exit 1
fi

if ! command -v npx &> /dev/null; then
    echo -e "${RED}ERROR: npx not found. Install Node.js first.${NC}"
    exit 1
fi

if ! npx wrangler whoami &> /dev/null; then
    echo -e "${RED}ERROR: Not logged in to Cloudflare. Run: npx wrangler login${NC}"
    exit 1
fi

echo -e "${GREEN}✓ All prerequisites met${NC}"
echo ""

# Step 1: Get Neon connection string
echo "========================================="
echo "Step 1: Neon Database Configuration"
echo "========================================="
echo ""
echo "You should have created a Neon database at https://neon.tech"
echo ""
read -p "Enter your Neon connection string: " NEON_DB_URL

if [ -z "$NEON_DB_URL" ]; then
    echo -e "${RED}ERROR: Connection string cannot be empty${NC}"
    exit 1
fi

# Validate connection string format (accept both postgres:// and postgresql://)
if [[ ! "$NEON_DB_URL" =~ ^postgres ]]; then
    echo -e "${RED}ERROR: Invalid connection string format${NC}"
    echo "Should start with: postgres:// or postgresql://"
    exit 1
fi

# Normalize postgresql:// to postgres:// for compatibility
NEON_DB_URL="${NEON_DB_URL//postgresql:/postgres:}"

echo -e "${GREEN}✓ Connection string accepted${NC}"
echo ""

# Step 2: Initialize database
echo "========================================="
echo "Step 2: Initialize Database Schema"
echo "========================================="
echo ""

echo "Running migration..."
MIGRATION_FILE="queryflux-backend/migrations/001_create_users_and_refresh_tokens.sql"
if psql "$NEON_DB_URL" < "$MIGRATION_FILE"; then
    echo -e "${GREEN}✓ Migration successful${NC}"
else
    echo -e "${YELLOW}⚠ Migration may have failed or tables already exist${NC}"
fi
echo ""
echo "Applying optional cleanup migration (removes legacy seed user if present)..."
CLEANUP="queryflux-backend/migrations/004_remove_seed_test_user.sql"
if [[ -f "$CLEANUP" ]] && psql "$NEON_DB_URL" < "$CLEANUP"; then
    echo -e "${GREEN}✓ Cleanup migration applied${NC}"
else
    echo -e "${YELLOW}⚠ Cleanup migration skipped or failed (non-fatal)${NC}"
fi
echo ""

echo "Verifying tables..."
if psql "$NEON_DB_URL" -c "\dt" | grep -q "users"; then
    echo -e "${GREEN}✓ Tables created successfully${NC}"
else
    echo -e "${RED}ERROR: Tables not found${NC}"
    exit 1
fi
echo ""

echo "Optional: create a dev test user via your auth UI or a dedicated seed script — not inserted by migrations."
echo ""

echo "========================================="
echo "Step 3: Configure Cloudflare Secrets"
echo "========================================="
echo ""

# Change to queryflux-worker directory for wrangler commands
cd queryflux-worker

echo "Setting DATABASE_URL..."
echo "$NEON_DB_URL" | npx wrangler secret put DATABASE_URL --env production
echo -e "${GREEN}✓ DATABASE_URL set${NC}"
echo ""

JWT_SECRET="$(openssl rand -base64 32 | tr -d '\n')"
echo "Setting JWT_SECRET (generated)..."
echo "$JWT_SECRET" | npx wrangler secret put JWT_SECRET --env production
echo -e "${GREEN}✓ JWT_SECRET set${NC}"
echo ""

read -p "Do you have an OpenAI API key? (y/n): " HAS_OPENAI
if [ "$HAS_OPENAI" = "y" ] || [ "$HAS_OPENAI" = "Y" ]; then
    read -p "Enter OpenAI API key: " OPENAI_KEY
    if [ -n "$OPENAI_KEY" ]; then
        echo "$OPENAI_KEY" | npx wrangler secret put OPENAI_API_KEY --env production
        echo -e "${GREEN}✓ OPENAI_API_KEY set${NC}"
    fi
fi
echo ""

echo "Verifying secrets..."
npx wrangler secret list --env production
echo ""

# Step 4: Deploy to Cloudflare Workers
echo "========================================="
echo "Step 4: Deploy to Cloudflare Workers"
echo "========================================="
echo ""

echo "Deploying worker..."
if npm run deploy:prod; then
    echo -e "${GREEN}✓ Worker deployed successfully!${NC}"
else
    echo -e "${RED}ERROR: Worker deployment failed${NC}"
    exit 1
fi
echo ""

# Get worker URL
echo "========================================="
echo "Deployment Complete!"
echo "========================================="
echo ""
echo -e "${GREEN}Your QueryFlux backend is now live!${NC}"
echo ""
echo "Worker URL: Check the output above for your .workers.dev URL"
echo ""
echo "Next steps:"
echo "1. Test your deployment with the health endpoint"
echo "2. Create first admin user via registration or admin tooling"
echo "3. Deploy frontend to Cloudflare Pages"
echo "4. Update platform configs with your worker URL"
echo ""
echo "See QUICK_DEPLOY_GUIDE.md for detailed testing steps."
echo ""

# Save deployment info
cat > deployment-info.txt <<EOF
QueryFlux Production Deployment
Deployed: $(date)

Database: Neon PostgreSQL
Connection: ${NEON_DB_URL%%\?*}... (check Neon dashboard for full URL)

Worker: Cloudflare Workers (production)
Check deployment output above for worker URL

Next Steps:
1. Test health endpoint: curl https://YOUR-WORKER-URL/health
2. Test login endpoint
3. Deploy frontend
4. Update platform configs

See QUICK_DEPLOY_GUIDE.md for details.
EOF

echo -e "${GREEN}Deployment info saved to: deployment-info.txt${NC}"
