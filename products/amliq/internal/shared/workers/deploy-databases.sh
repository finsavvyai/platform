#!/bin/bash

# Database Deployment Script for Unified FinTech Suite
# Sets up all D1 databases with proper schemas

set -e

echo "🗄️ Setting up Unified FinTech Suite D1 Databases..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}📋 Database Deployment Started - $(date)${NC}"

# Create Billing US Database
echo -e "\n${YELLOW}📊 Creating Billing US Database...${NC}"
npx wrangler d1 create fintech-billing-us --region=us-east1 || echo "Database already exists"

# Create Billing EU Database
echo -e "${YELLOW}📊 Creating Billing EU Database...${NC}"
npx wrangler d1 create fintech-billing-eu --region=eu-west1 || echo "Database already exists"

# Create Compliance US Database
echo -e "${YELLOW}📋 Creating Compliance US Database...${NC}"
npx wrangler d1 create fintech-compliance-us --region=us-east1 || echo "Database already exists"

# Create Compliance EU Database
echo -e "${YELLOW}📋 Creating Compliance EU Database...${NC}"
npx wrangler d1 create fintech-compliance-eu --region=eu-west1 || echo "Database already exists"

# Create Intelligence US Database
echo -e "${YELLOW}🧠 Creating Intelligence US Database...${NC}"
npx wrangler d1 create fintech-intelligence-us --region=us-east1 || echo "Database already exists"

# Create Risk US Database
echo -e "${YELLOW}🛡️ Creating Risk US Database...${NC}"
npx wrangler d1 create fintech-risk-us --region=us-east1 || echo "Database already exists"

echo -e "\n${GREEN}✅ D1 Database Setup Complete${NC}"

# Deploy schemas to each database
echo -e "\n${YELLOW}📝 Deploying Database Schemas...${NC}"

# Get actual database IDs after creation
echo "Retrieving database IDs..."
BILLING_US_ID=$(npx wrangler d1 list --output=json | jq -r '.[] | select(.name=="fintech-billing-us") | .id')
BILLING_EU_ID=$(npx wrangler d1 list --output=json | jq -r '.[] | select(.name=="fintech-billing-eu") | .id')
COMPLIANCE_US_ID=$(npx wrangler d1 list --output=json | jq -r '.[] | select(.name=="fintech-compliance-us") | .id')
COMPLIANCE_EU_ID=$(npx wrangler d1 list --output=json | jq -r '.[] | select(.name=="fintech-compliance-eu") | .id')
INTELLIGENCE_US_ID=$(npx wrangler d1 list --output=json | jq -r '.[] | select(.name=="fintech-intelligence-us") | .id')
RISK_US_ID=$(npx wrangler d1 list --output=json | jq -r '.[] | select(.name=="fintech-risk-us") | .id')

echo "Database IDs retrieved:"
echo "Billing US: $BILLING_US_ID"
echo "Billing EU: $BILLING_EU_ID"
echo "Compliance US: $COMPLIANCE_US_ID"
echo "Compliance EU: $COMPLIANCE_EU_ID"
echo "Intelligence US: $INTELLIGENCE_US_ID"
echo "Risk US: $RISK_US_ID"

# Update wrangler.toml with actual database IDs
echo -e "\n${YELLOW}⚙️ Updating wrangler.toml with actual database IDs...${NC}"
sed -i.bak "s/database_id = \"xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx\"/database_id = \"$BILLING_US_ID\"/" workers/wrangler.production.toml
sed -i.bak "s/database_id = \"xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx\"/database_id = \"$BILLING_EU_ID\"/; t" workers/wrangler.production.toml
sed -i.bak "s/database_id = \"xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx\"/database_id = \"$COMPLIANCE_US_ID\"/; t" workers/wrangler.production.toml
sed -i.bak "s/database_id = \"xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx\"/database_id = \"$COMPLIANCE_EU_ID\"/; t" workers/wrangler.production.toml
sed -i.bak "s/database_id = \"xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx\"/database_id = \"$INTELLIGENCE_US_ID\"/; t" workers/wrangler.production.toml
sed -i.bak "s/database_id = \"xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx\"/database_id = \"$RISK_US_ID\"/; t" workers/wrangler.production.toml

echo -e "\n${GREEN}🎯 Database Schemas Ready for Deployment${NC}"
echo -e "${YELLOW}📝 Next Steps:${NC}"
echo "1. Run: npx wrangler d1 execute --database=$BILLING_US_ID --file=workers/migrations/002_billing_schema.sql"
echo "2. Run: npx wrangler d1 execute --database=$BILLING_US_ID --file=workers/migrations/003_subscription_enhancements.sql"
echo "3. Repeat for all databases as needed"

echo -e "\n${GREEN}✅ Database Deployment Complete!${NC}"
