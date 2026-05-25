#!/bin/bash

echo "🚀 Questro Cloudflare Migration - Complete Test Suite"
echo "===================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

API_BASE_1="https://api.qestro.io"
API_BASE_2="https://api.qestro.app"

echo ""
echo "${BLUE}Step 1: DNS Propagation Check${NC}"
echo "-------------------------------------"

# Function to test DNS
test_dns() {
    local domain=$1
    echo -n "Testing $domain: "
    local result=$(dig +short $domain 2>/dev/null)
    if [ -n "$result" ]; then
        echo -e "${GREEN}✓ Resolves to $result${NC}"
        return 0
    else
        echo -e "${RED}✗ No DNS record found${NC}"
        return 1
    fi
}

# Function to test HTTP endpoint
test_endpoint() {
    local url=$1
    local description=$2
    echo -n "Testing $description: "

    local response=$(curl -s -w "HTTPSTATUS:%{http_code}" "$url" 2>/dev/null)
    local http_code=$(echo $response | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')
    local body=$(echo $response | sed -e 's/HTTPSTATUS:.*//')

    if [ "$http_code" = "200" ]; then
        echo -e "${GREEN}✓ $http_code - OK${NC}"
        echo "  Response: $(echo $body | head -c 100)..."
        return 0
    else
        echo -e "${RED}✗ $http_code - FAILED${NC}"
        if [ -n "$body" ]; then
            echo "  Error: $(echo $body | head -c 100)..."
        fi
        return 1
    fi
}

# Test DNS for both domains
dns_ok=true
test_dns "api.qestro.io" || dns_ok=false
test_dns "api.qestro.app" || dns_ok=false

if [ "$dns_ok" = false ]; then
    echo ""
    echo "${YELLOW}⚠️  DNS records not found. Please create A records in Cloudflare:${NC}"
    echo "   - api.qestro.io → 192.0.2.1 (proxied)"
    echo "   - api.qestro.app → 192.0.2.1 (proxied)"
    echo ""
    echo "Once created, wait 2-3 minutes and run this script again."
    exit 1
fi

echo ""
echo "${BLUE}Step 2: API Endpoint Testing${NC}"
echo "-----------------------------------"

# Test health endpoints
endpoint_ok=true
test_endpoint "$API_BASE_1/health" "Health (qestro.io)" || endpoint_ok=false
test_endpoint "$API_BASE_2/health" "Health (qestro.app)" || endpoint_ok=false

# Test API status endpoints
test_endpoint "$API_BASE_1/api/status" "API Status (qestro.io)" || endpoint_ok=false
test_endpoint "$API_BASE_2/api/status" "API Status (qestro.app)" || endpoint_ok=false

# Test CORS preflight
echo -n "Testing CORS (OPTIONS): "
cors_response=$(curl -s -X OPTIONS -H "Origin: https://qestro.app" \
    -H "Access-Control-Request-Method: GET" \
    -w "HTTPSTATUS:%{http_code}" "$API_BASE_1/health" 2>/dev/null)
cors_code=$(echo $cors_response | tr -d '\n' | sed -e 's/.*HTTPSTATUS://')

if [[ "$cors_code" =~ ^[2-3][0-9][0-9]$ ]]; then
    echo -e "${GREEN}✓ $cors_code - CORS OK${NC}"
else
    echo -e "${RED}✗ $cors_code - CORS Issue${NC}"
    endpoint_ok=false
fi

if [ "$endpoint_ok" = false ]; then
    echo ""
    echo "${RED}❌ Some API endpoints are failing. Check the Cloudflare Workers logs.${NC}"
    exit 1
fi

echo ""
echo "${BLUE}Step 3: Frontend Configuration Check${NC}"
echo "----------------------------------------"

# Check frontend wrangler.toml configuration
echo "Checking frontend configuration..."
if [ -f "frontend/wrangler.toml" ]; then
    if grep -q "VITE_API_URL = \"https://api.qestro.app\"" frontend/wrangler.toml; then
        echo -e "${GREEN}✓ Frontend configured for qestro.app API${NC}"
    else
        echo -e "${YELLOW}⚠️  Frontend API URL may need updating${NC}"
    fi
else
    echo -e "${RED}✗ Frontend wrangler.toml not found${NC}"
fi

echo ""
echo "${BLUE}Step 4: Integration Test${NC}"
echo "-------------------------"

echo "Testing frontend-backend integration..."
integration_ok=true

# Test that API responds to CORS requests from frontend domains
test_integration() {
    local api_url=$1
    local origin=$2

    echo -n "Testing $origin → $api_url: "

    response=$(curl -s -H "Origin: $origin" \
        -H "Access-Control-Request-Method: GET" \
        -H "Access-Control-Request-Headers: Content-Type" \
        -X OPTIONS "$api_url/health" 2>/dev/null)

    if echo "$response" | grep -q "Access-Control-Allow-Origin"; then
        echo -e "${GREEN}✓ CORS headers present${NC}"
        return 0
    else
        echo -e "${RED}✗ Missing CORS headers${NC}"
        return 1
    fi
}

test_integration "$API_BASE_1" "https://qestro.io" || integration_ok=false
test_integration "$API_BASE_2" "https://qestro.app" || integration_ok=false

echo ""
echo "${BLUE}Step 5: Summary${NC}"
echo "---------------"

if [ "$integration_ok" = true ]; then
    echo -e "${GREEN}🎉 Migration Complete! Your Questro API is working on Cloudflare.${NC}"
    echo ""
    echo "✅ Available Endpoints:"
    echo "   • $API_BASE_1/health"
    echo "   • $API_BASE_1/api/status"
    echo "   • $API_BASE_2/health"
    echo "   • $API_BASE_2/api/status"
    echo ""
    echo "🌐 Frontend URLs (once deployed):"
    echo "   • https://qestro.io"
    echo "   • https://qestro.app"
    echo ""
    echo "📝 Next Steps:"
    echo "   1. Deploy frontend with: cd frontend && npm run deploy"
    echo "   2. Update any hardcoded API URLs in your frontend code"
    echo "   3. Test full application functionality"
else
    echo -e "${RED}❌ Migration incomplete. Check the issues above.${NC}"
    exit 1
fi
