#!/bin/bash

# Questro Quick Setup Helper
# This script helps you through the deployment process step by step

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}🚀 Questro Deployment Assistant${NC}"
echo "=================================="
echo ""
echo -e "${GREEN}✅ Code successfully pushed to GitHub!${NC}"
echo "Repository: https://github.com/finsavvyai/questro"
echo ""

# Step 1: Render Setup
echo -e "${BLUE}Step 1: Render Deployment${NC}"
echo "1. Go to https://render.com and sign in"
echo "2. Click 'New' → 'Blueprint'"
echo "3. Connect GitHub and select 'finsavvyai/questro'"
echo "4. Click 'Apply' (Render will detect render.yaml automatically)"
echo ""
read -p "Press Enter when you've started the Render deployment..."

# Step 2: Supabase Setup
echo ""
echo -e "${BLUE}Step 2: Supabase Database Setup${NC}"
echo "1. Go to https://supabase.com and sign in"
echo "2. Click 'New Project'"
echo "3. Name: 'questro', choose region, generate strong password"
echo ""
read -p "Press Enter when you've created your Supabase project..."

echo ""
echo "Now we need your Supabase credentials:"
echo ""

read -p "Enter your Supabase Project URL (https://xxx.supabase.co): " SUPABASE_URL
read -p "Enter your Supabase anon/public key: " SUPABASE_ANON_KEY
read -p "Enter your Supabase service_role key: " SUPABASE_SERVICE_KEY
read -p "Enter your database host (db.xxx.supabase.co): " SUPABASE_HOST
read -s -p "Enter your database password: " SUPABASE_PASSWORD
echo ""

# Generate JWT secret
JWT_SECRET=$(openssl rand -base64 48 2>/dev/null || head -c 32 /dev/urandom | base64)

echo ""
echo -e "${GREEN}✅ Credentials collected!${NC}"

# Step 3: Environment Variables
echo ""
echo -e "${BLUE}Step 3: Render Environment Variables${NC}"
echo "Copy these environment variables to your Render backend service:"
echo ""
echo -e "${YELLOW}=== BACKEND SERVICE ENVIRONMENT VARIABLES ===${NC}"
echo "NODE_ENV=production"
echo "PORT=10000"
echo "USE_SUPABASE=true"
echo "RUN_MIGRATIONS=true"
echo "SUPABASE_URL=$SUPABASE_URL"
echo "SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY"
echo "SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_KEY"
echo "SUPABASE_DB_HOST=$SUPABASE_HOST"
echo "SUPABASE_DB_PORT=5432"
echo "SUPABASE_DB_NAME=postgres"
echo "SUPABASE_DB_USER=postgres"
echo "SUPABASE_DB_PASSWORD=$SUPABASE_PASSWORD"
echo "JWT_SECRET=$JWT_SECRET"
echo "FRONTEND_URL=https://questro-frontend.onrender.com"
echo "ENABLE_RECORDING=true"
echo "ENABLE_MOBILE_TESTING=true"
echo "ENABLE_WEB_TESTING=true"
echo "LOG_LEVEL=info"
echo ""
echo -e "${YELLOW}=== FRONTEND SERVICE ENVIRONMENT VARIABLES ===${NC}"
echo "VITE_APP_ENV=production"
echo "VITE_API_BASE_URL=https://questro-api.onrender.com"
echo "VITE_SUPABASE_URL=$SUPABASE_URL"
echo "VITE_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY"
echo "VITE_ENABLE_RECORDING=true"
echo "VITE_ENABLE_MOBILE_TESTING=true"
echo "VITE_ENABLE_WEB_TESTING=true"
echo "VITE_ENABLE_ANALYTICS=false"
echo ""

# Save to file
cat > render-environment-variables.txt << EOF
=== BACKEND SERVICE ENVIRONMENT VARIABLES ===
NODE_ENV=production
PORT=10000
USE_SUPABASE=true
RUN_MIGRATIONS=true
SUPABASE_URL=$SUPABASE_URL
SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_KEY
SUPABASE_DB_HOST=$SUPABASE_HOST
SUPABASE_DB_PORT=5432
SUPABASE_DB_NAME=postgres
SUPABASE_DB_USER=postgres
SUPABASE_DB_PASSWORD=$SUPABASE_PASSWORD
JWT_SECRET=$JWT_SECRET
FRONTEND_URL=https://questro-frontend.onrender.com
ENABLE_RECORDING=true
ENABLE_MOBILE_TESTING=true
ENABLE_WEB_TESTING=true
LOG_LEVEL=info

=== FRONTEND SERVICE ENVIRONMENT VARIABLES ===
VITE_APP_ENV=production
VITE_API_BASE_URL=https://questro-api.onrender.com
VITE_SUPABASE_URL=$SUPABASE_URL
VITE_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY
VITE_ENABLE_RECORDING=true
VITE_ENABLE_MOBILE_TESTING=true
VITE_ENABLE_WEB_TESTING=true
VITE_ENABLE_ANALYTICS=false
EOF

echo -e "${GREEN}✅ Environment variables saved to 'render-environment-variables.txt'${NC}"
echo ""
read -p "Press Enter when you've added these environment variables to Render..."

# Step 4: Test deployment
echo ""
echo -e "${BLUE}Step 4: Testing Deployment${NC}"
echo "Once your Render services are deployed, test them:"
echo ""
echo "Backend health check:"
echo "curl https://questro-api.onrender.com/health"
echo ""
echo "Frontend:"
echo "Visit https://questro-frontend.onrender.com"
echo ""

echo -e "${GREEN}🎉 Setup Complete!${NC}"
echo ""
echo "Your Questro platform should now be live at:"
echo "- Frontend: https://questro-frontend.onrender.com"
echo "- Backend: https://questro-api.onrender.com"
echo ""
echo "For detailed monitoring and troubleshooting, see:"
echo "- DEPLOYMENT_MONITOR.md"
echo "- render-environment-variables.txt"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "1. Test the deployment"
echo "2. Set up custom domain (optional)"
echo "3. Configure monitoring"
echo "4. Set up CI/CD workflows"