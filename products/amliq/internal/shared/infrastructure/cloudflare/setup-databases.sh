#!/bin/bash

# Cloudflare D1 Database Setup Script
# This script provisions the three D1 databases required for the FinTech Suite

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Database configuration
DBS=(
    "fintech-unified-primary:Primary database for billing and intelligence data"
    "fintech-unified-secondary:Secondary database for risk management and audit data"
    "fintech-unified-compliance:Compliance database for KYC/AML and case management"
)

echo -e "${BLUE}🚀 Setting up Cloudflare D1 databases for FinTech Suite...${NC}"

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo -e "${RED}❌ Wrangler CLI not found. Please install it with: npm install -g wrangler${NC}"
    exit 1
fi

# Function to create database if it doesn't exist
create_database() {
    local db_name="$1"
    local db_description="$2"

    echo -e "${YELLOW}📊 Creating database: ${db_name}${NC}"

    # Check if database already exists
    if wrangler d1 list --json | grep -q "\"database_name\":\"${db_name}\""; then
        echo -e "${GREEN}✅ Database ${db_name} already exists${NC}"
        return 0
    fi

    # Create the database
    wrangler d1 create "${db_name}" || {
        echo -e "${RED}❌ Failed to create database ${db_name}${NC}"
        return 1
    }

    echo -e "${GREEN}✅ Successfully created database: ${db_name}${NC}"
    echo -e "   ${db_description}"
    echo ""
}

# Create all databases
for db_info in "${DBS[@]}"; do
    IFS=':' read -r db_name db_description <<< "$db_info"
    create_database "$db_name" "$db_description"
done

# List all databases after creation
echo -e "${BLUE}📋 Current D1 databases:${NC}"
wrangler d1 list

echo -e "${GREEN}🎉 D1 database setup completed!${NC}"
echo -e "${YELLOW}📝 Note: Update your wrangler.toml with the correct database IDs returned by the creation commands.${NC}"
