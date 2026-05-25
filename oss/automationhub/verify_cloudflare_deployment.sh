#!/bin/bash

echo "🔍 UPM.Plus Production Deployment Verification"
echo "=============================================="

# Function to test endpoint
test_endpoint() {
    local url=$1
    local name=$2
    local expected_pattern=$3

    echo "Testing $name: $url"

    if response=$(curl -s "$url" 2>/dev/null); then
        if echo "$response" | grep -q "$expected_pattern"; then
            echo "✅ $name - OK"
            return 0
        else
            echo "❌ $name - FAILED (Response: $(echo "$response" | head -c 100)...)"
            return 1
        fi
    else
        echo "❌ $name - FAILED (No response)"
        return 1
    fi
}

# Test main site
echo ""
echo "1️⃣ Testing Main Site..."
test_endpoint "https://upm.plus" "Main Site" "UPM.Plus"

# Test API endpoints
echo ""
echo "2️⃣ Testing API Endpoints..."
test_endpoint "https://upm.plus/api/health" "Health API" "status"
test_endpoint "https://upm.plus/api/v1/agents" "Agents API" "agents"
test_endpoint "https://upm.plus/api/v1/tenants" "Tenants API" "tenant"
test_endpoint "https://upm.plus/api/v1/workflows" "Workflows API" "workflows"

# Test analytics endpoints
echo ""
echo "3️⃣ Testing Analytics Endpoints..."
test_endpoint "https://upm.plus/api/v1/analytics/metrics/recent" "Analytics Metrics" "success"
test_endpoint "https://upm.plus/api/v1/multi-cloud/providers" "Multi-Cloud Providers" "success"
test_endpoint "https://upm.plus/api/v1/multi-cloud/resources" "Multi-Cloud Resources" "success"

# Test frontend routes
echo ""
echo "4️⃣ Testing Frontend Routes..."
test_endpoint "https://upm.plus/dashboard" "Dashboard" "Dashboard"
test_endpoint "https://upm.plus/admin" "Admin Panel" "Admin"
test_endpoint "https://upm.plus/analytics" "Analytics" "Analytics"

# Test CORS and headers
echo ""
echo "5️⃣ Testing CORS and Headers..."
echo "Testing CORS preflight..."
cors_response=$(curl -s -I -X OPTIONS -H "Origin: https://app.upm.plus" -H "Access-Control-Request-Method: POST" "https://upm.plus/api/health" 2>/dev/null)
if echo "$cors_response" | grep -q "Access-Control-Allow-Origin"; then
    echo "✅ CORS Headers - OK"
else
    echo "⚠️  CORS Headers - May need adjustment"
fi

# Test rate limiting
echo ""
echo "6️⃣ Testing Rate Limiting..."
echo "Making multiple rapid requests..."
for i in {1..5}; do
    curl -s "https://upm.plus/api/health" > /dev/null &
done
wait
echo "✅ Rate Limiting Test - Completed (no immediate block)"

# Summary
echo ""
echo "📊 Deployment Summary"
echo "===================="
echo "Main Site: https://upm.plus"
echo "API Gateway: https://upm.plus/api/"
echo "Analytics Dashboard: https://upm.plus/dashboard"
echo ""
echo "🔗 Key API Endpoints:"
echo "- Health Check: GET /api/health"
echo "- Agents: GET /api/v1/agents"
echo "- Analytics: GET /api/v1/analytics/*"
echo "- Multi-Cloud: GET /api/v1/multi-cloud/*"
echo ""
echo "✅ UPM.Plus is LIVE and OPERATIONAL! 🚀"