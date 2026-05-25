#!/bin/bash

# Test Railway Deployment Script
# Use this to test your deployed backend

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get Railway URL from command line or use default
RAILWAY_URL=${1:-"https://your-app-name.up.railway.app"}

echo -e "${BLUE}🧪 Testing Railway Deployment${NC}"
echo -e "${YELLOW}Backend URL: ${RAILWAY_URL}${NC}\n"

# Function to test endpoint
test_endpoint() {
    local endpoint=$1
    local method=${2:-"GET"}
    local data=${3:-""}
    local expected_status=${4:-200}

    echo -e "${BLUE}Testing: ${method} ${endpoint}${NC}"

    if [ "$method" = "POST" ] && [ -n "$data" ]; then
        response=$(curl -s -w "\n%{http_code}" -X POST \
            -H "Content-Type: application/json" \
            -d "$data" \
            "${RAILWAY_URL}${endpoint}")
    else
        response=$(curl -s -w "\n%{http_code}" "${RAILWAY_URL}${endpoint}")
    fi

    status_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n -1)

    if [ "$status_code" -eq "$expected_status" ]; then
        echo -e "${GREEN}✅ Success (${status_code})${NC}"
        echo -e "${YELLOW}Response:${NC} $body\n"
    else
        echo -e "${RED}❌ Failed (${status_code})${NC}"
        echo -e "${YELLOW}Expected: ${expected_status}, Got: ${status_code}${NC}"
        echo -e "${YELLOW}Response:${NC} $body\n"
    fi
}

# 1. Test Health Check
test_endpoint "/health"

# 2. Test Root Endpoint (if exists)
test_endpoint "/"

# 3. Test Database Connect Endpoint (with sample data)
test_endpoint "/api/v1/database/connect" "POST" '{
    "type": "postgresql",
    "host": "localhost",
    "port": "5432",
    "database": "test",
    "username": "test",
    "password": "test"
}' 400

# 4. Test Query Endpoint (should fail without auth)
test_endpoint "/api/v1/database/query" "POST" '{
    "connectionId": "test",
    "query": "SELECT 1"
}' 400

# 5. Test Schema Endpoint (should fail without auth)
test_endpoint "/api/v1/database/schema" "POST" '{
    "connectionId": "test"
}' 400

echo -e "${GREEN}=== Test Summary ===${NC}"
echo -e "Health check: ${RAILWAY_URL}/health"
echo -e "API Base: ${RAILWAY_URL}/api/v1"
echo -e "\n${YELLOW}To test with your own Railway URL:${NC}"
echo "bash test-railway-deployment.sh https://your-actual-app.up.railway.app"

echo -e "\n${BLUE}🚀 Next Steps:${NC}"
echo "1. Verify all endpoints return expected responses"
echo "2. Set up PostgreSQL database in Railway"
echo "3. Configure environment variables"
echo "4. Test actual database connections"
echo "5. Update frontend with the production URL"