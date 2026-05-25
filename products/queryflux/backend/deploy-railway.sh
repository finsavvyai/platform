#!/bin/bash

# Railway Deployment Script for QueryFlux Backend
# This script helps deploy the backend to Railway

set -e

echo "🚀 Deploying QueryFlux Backend to Railway..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo -e "${YELLOW}Railway CLI not found. Installing...${NC}"
    npm install -g @railway/cli
fi

# Check if user is logged in
if ! railway whoami &> /dev/null; then
    echo -e "${YELLOW}Please log in to Railway:${NC}"
    railway login
fi

# Ensure we're in the backend directory
cd "$(dirname "$0")"

echo -e "${GREEN}Current directory: $(pwd)${NC}"

# Check if railway.toml exists
if [ ! -f "railway.toml" ]; then
    echo -e "${RED}Error: railway.toml not found!${NC}"
    exit 1
fi

# Link or create project
if [ ! -d ".railway" ]; then
    echo -e "${YELLOW}Linking to Railway project...${NC}"
    railway link
fi

# Deploy the backend
echo -e "${GREEN}Deploying backend to Railway...${NC}"
railway up

echo -e "${GREEN}Deployment initiated!${NC}"
echo -e "${YELLOW}Check your Railway dashboard for progress.${NC}"

# Get the project URL
echo -e "${GREEN}Getting project information...${NC}"
PROJECT_URL=$(railway domain --service=queryflux-backend 2>/dev/null || echo "Check Railway dashboard")

echo -e "\n${GREEN}=== Deployment Summary ===${NC}"
echo -e "Backend URL: ${YELLOW}${PROJECT_URL}${NC}"
echo -e "Health Check: ${YELLOW}${PROJECT_URL}/health${NC}"
echo -e "API Base: ${YELLOW}${PROJECT_URL}/api/v1${NC}"

echo -e "\n${YELLOW}Next steps:${NC}"
echo "1. Add a PostgreSQL database service in Railway dashboard"
echo "2. Copy the DATABASE_URL from PostgreSQL service"
echo "3. Add environment variables to backend service:"
echo "   - DATABASE_URL (from PostgreSQL service)"
echo "   - JWT_SECRET (generate a strong secret)"
echo "4. Redeploy if needed"
echo "5. Test the deployment"

echo -e "\n${GREEN}Deployment commands for testing:${NC}"
echo "# Health check:"
echo "curl ${PROJECT_URL}/health"
echo ""
echo "# Test database connection (replace with actual values):"
echo "curl -X POST ${PROJECT_URL}/api/v1/database/connect \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{\"type\": \"postgresql\", \"host\": \"your-db-host\", \"port\": \"5432\", \"database\": \"railway\", \"username\": \"postgres\", \"password\": \"your-password\"}'"

echo -e "\n${GREEN}Deployment complete!${NC}"