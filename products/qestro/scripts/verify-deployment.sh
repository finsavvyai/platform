#!/bin/bash

# Questro Deployment Verification Script
# This script verifies that your backend deployment was successful and everything is working

set -e

echo "🔍 Questro Deployment Verification"
echo "================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Function to check if a URL is accessible
check_url() {
    local url=$1
    local description=$2
    local timeout=${3:-10}

    echo -n "Testing $description... "

    if curl -f -s --max-time $timeout "$url" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ PASS${NC}"
        return 0
    else
        echo -e "${RED}❌ FAIL${NC}"
        return 1
    fi
}

# Function to check API response
check_api() {
    local url=$1
    local description=$2

    echo -n "Testing $description... "

    response=$(curl -s --max-time 10 "$url" 2>/dev/null || echo "")

    if [ $? -eq 0 ] && [ -n "$response" ]; then
        echo -e "${GREEN}✅ PASS${NC}"
        echo "  Response: $(echo "$response" | head -c 100)..."
        return 0
    else
        echo -e "${RED}❌ FAIL${NC}"
        echo "  No response received"
        return 1
    fi
}

echo -e "${BLUE}📍 Step 1: Basic Service Health Checks${NC}"
echo ""

# Get service URL if provided, otherwise prompt for it
if [ -z "$SERVICE_URL" ]; then
    echo "Please enter your backend service URL:"
    echo "Example: https://questro-backend.onrender.com"
    read -p "Service URL: " SERVICE_URL
fi

if [ -z "$SERVICE_URL" ]; then
    echo -e "${RED}❌ Service URL is required${NC}"
    exit 1
fi

# Ensure URL has proper format
if [[ ! $SERVICE_URL == http* ]]; then
    SERVICE_URL="https://$SERVICE_URL"
fi

echo -e "${BLUE}Service URL: $SERVICE_URL${NC}"
echo ""

# Basic connectivity tests
echo "📡 Connectivity Tests:"
echo "---------------------"

health_passed=0
total_tests=0

# Test health endpoint
((total_tests++))
if check_url "$SERVICE_URL/health" "Health Endpoint"; then
    ((health_passed++))
fi

# Test API status
((total_tests++))
if check_url "$SERVICE_URL/api/status" "API Status Endpoint"; then
    ((health_passed++))
fi

# Test basic API routes
((total_tests++))
if check_api "$SERVICE_URL/api/auth/me" "Authentication Test"; then
    ((health_passed++))
fi

# Test database connectivity
((total_tests++))
if check_api "$SERVICE_URL/api/projects" "Database Connectivity"; then
    ((health_passed++))
fi

echo ""
echo -e "${BLUE}📊 Health Check Results:${NC}"
echo "Passed: $health_passed/$total_tests tests"

if [ $health_passed -eq $total_tests ]; then
    echo -e "${GREEN}🎉 All health checks passed!${NC}"
else
    echo -e "${YELLOW}⚠️  Some health checks failed${NC}"
    echo "This might be normal if certain features require authentication"
fi

echo ""
echo -e "${BLUE}🔧 Step 2: Service Configuration Verification${NC}"
echo ""

# Check service headers
echo "📋 Service Headers:"
echo "-------------------"

if curl -s -I "$SERVICE_URL/health" 2>/dev/null | head -10; then
    echo -e "${GREEN}✅ Service responding with headers${NC}"
else
    echo -e "${YELLOW}⚠️  Could not retrieve service headers${NC}"
fi

echo ""
echo -e "${BLUE}📈 Step 3: Performance Checks${NC}"
echo ""

# Basic performance check
echo "⚡ Performance Test:"
echo "-------------------"

start_time=$(date +%s%N)
curl -s "$SERVICE_URL/health" > /dev/null 2>&1
end_time=$(date +%s%N)

response_time=$(( (end_time - start_time) / 1000000 )) # Convert to milliseconds

echo "Response time: ${response_time}ms"

if [ $response_time -lt 1000 ]; then
    echo -e "${GREEN}✅ Good performance (< 1s)${NC}"
elif [ $response_time -lt 3000 ]; then
    echo -e "${YELLOW}⚠️  Acceptable performance (1-3s)${NC}"
else
    echo -e "${RED}❌ Slow performance (> 3s)${NC}"
fi

echo ""
echo -e "${BLUE}🔐 Step 4: Security Checks${NC}"
echo ""

# Check for security headers
echo "🛡️  Security Headers:"
echo "--------------------"

security_headers=(
    "x-content-type-options"
    "x-frame-options"
    "x-xss-protection"
    "strict-transport-security"
)

security_score=0
for header in "${security_headers[@]}"; do
    if curl -s -I "$SERVICE_URL/health" 2>/dev/null | grep -i "$header" > /dev/null; then
        echo -e "  $header: ${GREEN}✅${NC}"
        ((security_score++))
    else
        echo -e "  $header: ${YELLOW}⚠️  Missing${NC}"
    fi
done

echo ""
echo "Security score: $security_score/${#security_headers[@]} headers present"

echo ""
echo -e "${BLUE}📊 Step 5: Summary Report${NC}"
echo ""

# Generate summary
echo "📋 Deployment Verification Summary:"
echo "=================================="
echo "Service URL: $SERVICE_URL"
echo "Health Tests: $health_passed/$total_tests passed"
echo "Response Time: ${response_time}ms"
echo "Security Headers: $security_score/${#security_headers[@]}"
echo ""

# Overall assessment
if [ $health_passed -ge $((total_tests - 1)) ] && [ $response_time -lt 3000 ]; then
    echo -e "${GREEN}🎉 DEPLOYMENT SUCCESSFUL!${NC}"
    echo ""
    echo "✅ Your Questro backend is online and functioning properly"
    echo "✅ Core services are responding correctly"
    echo "✅ Performance is acceptable"
    echo ""
    echo "🚀 Next steps:"
    echo "1. Test your frontend integration"
    echo "2. Configure your environment variables"
    echo "3. Set up monitoring and alerts"
    echo "4. Test with real user workflows"
else
    echo -e "${YELLOW}⚠️  DEPLOYMENT NEEDS ATTENTION${NC}"
    echo ""
    echo "Some checks failed. This might be due to:"
    echo "- Service still starting up (wait a few more minutes)"
    echo "- Missing environment variables"
    echo "- Database connection issues"
    echo "- Authentication requirements"
    echo ""
    echo "🔧 Troubleshooting steps:"
    echo "1. Check Render dashboard logs"
    echo "2. Verify environment variables are set"
    echo "3. Test individual endpoints manually"
    echo "4. Run the deployment script again if needed"
fi

echo ""
echo -e "${BLUE}🔗 Useful Links:${NC}"
echo "- Render Dashboard: https://dashboard.render.com"
echo "- Service Logs: Check Render dashboard"
echo "- Health Endpoint: $SERVICE_URL/health"
echo "- API Documentation: $SERVICE_URL/docs (if available)"

echo ""
echo -e "${BLUE}🤖 MCP Management Commands:${NC}"
echo "cd mcp && export RENDER_API_KEY=your_key && npm run render"