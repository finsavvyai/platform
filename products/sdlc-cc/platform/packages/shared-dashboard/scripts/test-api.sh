#!/bin/bash

# API Testing Script
# Test all dashboard endpoints for functionality

set -e

echo "🧪 Unified Dashboard API Testing"
echo "=================================="
echo ""

# API Base URL (default to local development)
API_URL=${1:-"http://localhost:8787"}

echo "🌐 Testing API at: $API_URL"
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Test counter
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Test function
test_endpoint() {
    local method=$1
    local endpoint=$2
    local expected_status=$3
    local description=$4
    local data=$5

    TESTS_RUN=$((TESTS_RUN + 1))

    echo -n "Testing: $description... "

    if [ -n "$data" ]; then
        response=$(curl -s -w "\n%{http_code}" -X $method \
            -H "Content-Type: application/json" \
            -d "$data" \
            "$API_URL$endpoint")
    else
        response=$(curl -s -w "\n%{http_code}" -X $method "$API_URL$endpoint")
    fi

    status_code=$(echo "$response" | tail -n 1)
    body=$(echo "$response" | head -n -1)

    if [ "$status_code" == "$expected_status" ]; then
        echo -e "${GREEN}✅ PASS${NC} (HTTP $status_code)"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}❌ FAIL${NC} (Expected: $expected_status, Got: $status_code)"
        echo "   Response: $body"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
}

echo "📋 Running API Tests..."
echo ""

# Health check
test_endpoint "GET" "/health" "200" "Health check endpoint"

# Products status (public endpoint)
test_endpoint "GET" "/api/v1/products/status" "200" "Get all products status"

# Aggregate metrics (public endpoint)
test_endpoint "GET" "/api/v1/metrics/aggregate" "200" "Get aggregate metrics"

# Recent activity (public endpoint)
test_endpoint "GET" "/api/v1/activity/recent?limit=10" "200" "Get recent activity"

# Notifications (public endpoint)
test_endpoint "GET" "/api/v1/notifications" "200" "Get notifications"

# Dashboard analytics (public endpoint)
test_endpoint "GET" "/api/v1/analytics/dashboard?range=24h" "200" "Get dashboard analytics"

# Auth endpoints - should require authentication
test_endpoint "GET" "/api/v1/auth/me" "401" "Get current user (unauthorized)"

test_endpoint "POST" "/api/v1/auth/api-keys" "401" "Create API key (unauthorized)"

# Login endpoint - should accept credentials
test_endpoint "POST" "/api/v1/auth/login" "401" "Login with invalid credentials" \
    '{"email":"test@example.com","password":"wrongpassword"}'

# Register endpoint - should create user
# Note: This might fail if user already exists
test_endpoint "POST" "/api/v1/auth/register" "201" "Register new user (may fail if exists)" \
    '{"email":"test-'$(date +%s)'@example.com","name":"Test User","password":"securepassword123"}'

echo ""
echo "📊 Test Summary:"
echo "   Total Tests: $TESTS_RUN"
echo -e "   ${GREEN}Passed: $TESTS_PASSED${NC}"

if [ $TESTS_FAILED -gt 0 ]; then
    echo -e "   ${RED}Failed: $TESTS_FAILED${NC}"
else
    echo -e "   ${GREEN}Failed: 0${NC}"
fi

echo ""

# Calculate success rate
SUCCESS_RATE=$((TESTS_PASSED * 100 / TESTS_RUN))
echo "   Success Rate: $SUCCESS_RATE%"

echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}❌ Some tests failed${NC}"
    exit 1
fi
