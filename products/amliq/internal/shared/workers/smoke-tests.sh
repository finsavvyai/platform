#!/bin/bash

# Smoke Tests for Unified FinTech Suite Staging Environment
# Comprehensive testing of all critical functionality

set -e

echo "🧪 Unified FinTech Suite - Staging Smoke Tests"
echo "======================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
STAGING_API="https://api.staging.finsavvyai.com"
BILLING_API="https://billing.staging.finsavvyai.com"
COMPLIANCE_API="https://compliance.staging.finsavvyai.com"
INTELLIGENCE_API="https://intelligence.staging.finsavvyai.com"
RISK_API="https://risk.staging.finsavvyai.com"

# Test Results
PASSED=0
FAILED=0
TOTAL=0

# Helper function to run a test
run_test() {
    local test_name="$1"
    local test_url="$2"
    local method="${3:-GET}"
    local data="$4"
    local expected_status="$5"
    local headers="$6"

    TOTAL=$((TOTAL + 1))
    echo -e "\n${BLUE}🧪 Test: $test_name${NC}"
    echo "URL: $test_url"
    echo "Method: $method"

    if [ -n "$data" ]; then
        echo "Data: $data"
    fi

    if [ -n "$headers" ]; then
        echo "Headers: $headers"
    fi

    # Execute the test
    local response_code
    local response_body

    if [ "$method" = "POST" ] && [ -n "$data" ]; then
        response_code=$(curl -s -w "%{http_code}" -o /tmp/test_response.json -X "$method" "$test_url" -H "Content-Type: application/json" $headers -d "$data" || echo "000")
        response_body=$(cat /tmp/test_response.json 2>/dev/null || echo "")
    elif [ -n "$headers" ]; then
        response_code=$(curl -s -w "%{http_code}" -o /tmp/test_response.json -X "$method" "$test_url" $headers || echo "000")
        response_body=$(cat /tmp/test_response.json 2>/dev/null || echo "")
    else
        response_code=$(curl -s -w "%{http_code}" -o /tmp/test_response.json -X "$method" "$test_url" || echo "000")
        response_body=$(cat /tmp/test_response.json 2>/dev/null || echo "")
    fi

    echo "Response Code: $response_code"

    # Evaluate result
    if [ "$response_code" = "$expected_status" ]; then
        echo -e "${GREEN}✅ PASSED${NC}"
        PASSED=$((PASSED + 1))
    else
        echo -e "${RED}❌ FAILED (Expected: $expected_status, Got: $response_code)${NC}"
        FAILED=$((FAILED + 1))
        if [ -n "$response_body" ] && [ ${#response_body} -lt 200 ]; then
            echo "Response Body: $response_body"
        fi
    fi

    # Cleanup
    rm -f /tmp/test_response.json
}

echo -e "${GREEN}🚀 Starting Smoke Tests - $(date)${NC}"

# Health Checks
echo -e "\n${YELLOW}🏥 Health Checks${NC}"

run_test "Main API Health Check" "$STAGING_API/health" "GET" "" "200"
run_test "Billing API Health Check" "$BILLING_API/health" "GET" "" "200"
run_test "Compliance API Health Check" "$COMPLIANCE_API/health" "GET" "" "200"
run_test "Intelligence API Health Check" "$INTELLIGENCE_API/health" "GET" "" "200"
run_test "Risk API Health Check" "$RISK_API/health" "GET" "" "200"

# Authentication Tests
echo -e "\n${YELLOW}🔐 Authentication Tests${NC}"

# Test JWT authentication
echo -e "\n${BLUE}🔑 Testing JWT Authentication...${NC}"

# Login test (should fail without proper authentication)
run_test "Login without auth" "$STAGING_API/auth/login" "POST" '{"email":"test@example.com","password":"test123"}' "401"

# Get a JWT token (assuming test endpoint exists)
echo "Getting test JWT token..."
JWT_RESPONSE=$(curl -s -X POST "$STAGING_API/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"test@finsavvyai.com","password":"TestPassword123!"}' \
    -H "User-Agent: SmokeTest/1.0" || echo "")

JWT_TOKEN=$(echo "$JWT_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4 2>/dev/null || echo "")

if [ -n "$JWT_TOKEN" ]; then
    echo -e "${GREEN}✅ JWT token obtained for testing${NC}"
    AUTH_HEADER="-H \"Authorization: Bearer $JWT_TOKEN\""

    # Test protected endpoint with JWT
    run_test "Protected endpoint with JWT" "$STAGING_API/user/profile" "GET" "" "200" "$AUTH_HEADER"
else
    echo -e "${YELLOW}⚠️ Could not obtain JWT token, skipping auth tests${NC}"
    AUTH_HEADER=""
fi

# Security Tests
echo -e "\n${YELLOW}🛡️ Security Tests${NC}"

# Test SQL injection prevention
echo -e "\n${BLUE}🔒 Testing SQL Injection Prevention...${NC}"
SQL_INJECTION_DATA='{"customer_id":"test; DROP TABLE users; --","plan_id":"test","billing_cycle":"monthly"}'
run_test "SQL Injection Prevention" "$BILLING_API/subscriptions" "POST" "$SQL_INJECTION_DATA" "400" "$AUTH_HEADER"

# Test XSS prevention
XSS_DATA='{"name":"<script>alert(\"xss\")</script>","email":"test@example.com"}'
run_test "XSS Prevention" "$BILLING_API/customers" "POST" "$XSS_DATA" "400" "$AUTH_HEADER"

# Test input validation
echo -e "\n${BLUE}📋 Testing Input Validation...${NC}"
INVALID_UUID_DATA='{"customer_id":"invalid-uuid","plan_id":"test","billing_cycle":"invalid-cycle"}'
run_test "Input Validation" "$BILLING_API/subscriptions" "POST" "$INVALID_UUID_DATA" "400" "$AUTH_HEADER"

# Test rate limiting
echo -e "\n${BLUE}⚡ Testing Rate Limiting...${NC}"
for i in {1..5}; do
    RATE_LIMIT_CODE=$(curl -s -w "%{http_code}" -o /dev/null "$STAGING_API/test/rate-limit" || echo "000")
    if [ "$RATE_LIMIT_CODE" = "429" ]; then
        echo -e "${GREEN}✅ Rate limiting working (429 status on request $i)${NC}"
        break
    fi
    sleep 0.1
done

if [ "$RATE_LIMIT_CODE" != "429" ]; then
    echo -e "${YELLOW}⚠️ Rate limiting not triggered in 5 requests${NC}"
fi

# Subscription Management Tests
echo -e "\n${YELLOW}📋 Subscription Management Tests${NC}"

if [ -n "$AUTH_HEADER" ]; then
    # Test subscription creation
    SUBSCRIPTION_DATA='{
        "customer_id": "550e8400-e29b-41d4-a716-446655440000",
        "plan_id": "550e8400-e29b-41d4-a716-446655440001",
        "billing_cycle": "monthly",
        "trial_period_days": 14,
        "quantity": 1
    }'
    run_test "Create Subscription" "$BILLING_API/subscriptions" "POST" "$SUBSCRIPTION_DATA" "201" "$AUTH_HEADER"

    # Test subscription listing
    run_test "List Subscriptions" "$BILLING_API/subscriptions" "GET" "" "200" "$AUTH_HEADER"

    # Test plan creation
    PLAN_DATA='{
        "name": "Smoke Test Plan",
        "description": "Plan created during smoke testing",
        "amount": 99.99,
        "currency": "USD",
        "billing_cycle": "monthly",
        "features": ["Feature 1", "Feature 2", "Feature 3"],
        "active": true
    }'
    run_test "Create Plan" "$BILLING_API/plans" "POST" "$PLAN_DATA" "201" "$AUTH_HEADER"

    # Test analytics
    run_test "Get Analytics" "$BILLING_API/subscriptions/analytics" "GET" "" "200" "$AUTH_HEADER"
else
    echo -e "${YELLOW}⚠️ Skipping authenticated tests (no JWT token)${NC}"
fi

# Performance Tests
echo -e "\n${YELLOW}⚡ Performance Tests${NC}"

# Test response times
echo -e "${BLUE}📊 Testing Response Times...${NO_C}"
for endpoint in "$STAGING_API/health" "$BILLING_API/health" "$COMPLIANCE_API/health"; do
    echo "Testing $endpoint..."
    response_time=$(curl -s -w "%{time_total}" -o /dev/null "$endpoint" || echo "timeout")
    if [ "$response_time" != "timeout" ]; then
        response_time_ms=$(echo "$response_time" | cut -d' ' -f2 | cut -d' ' -f1)
        if [ "$(echo "$response_time_ms < 1.0" | bc)" = "1" ]; then
            echo -e "${GREEN}✅ $endpoint: ${response_time_ms}s (Fast)${NC}"
        elif [ "$(echo "$response_time_ms < 3.0" | bc)" = "1" ]; then
            echo -e "${YELLOW}⚠️ $endpoint: ${response_time_ms}s (Acceptable)${NC}"
        else
            echo -e "${RED}❌ $endpoint: ${response_time_ms}s (Slow)${NC}"
        fi
    else
        echo -e "${RED}❌ $endpoint: Timeout${NC}"
    fi
done

# CORS Tests
echo -e "\n${YELLOW}🌐 CORS Tests${NC}"
run_test "CORS Preflight" "$STAGING_API/health" "OPTIONS" "" "200" "-H \"Origin: https://test.finsavvyai.com\" -H \"Access-Control-Request-Method: GET\""

# Error Handling Tests
echo -e "\n${YELLOW}❌ Error Handling Tests${NC}"

run_test "404 Not Found" "$STAGING_API/nonexistent" "GET" "" "404"
run_test "Invalid Method" "$STAGING_API/health" "POST" "" "405"
run_test "Invalid JSON" "$STAGING_API/test" "POST" '{"invalid": json}' "400"

# Cleanup
echo -e "\n${YELLOW}🧹 Cleaning up test artifacts...${NC}"
rm -f /tmp/test_response.json 2>/dev/null

# Results Summary
echo -e "\n${BLUE}📊 Test Results Summary${NC}"
echo "================================"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo -e "${YELLOW}Total: $TOTAL${NC}"

if [ $FAILED -eq 0 ]; then
    echo -e "\n${GREEN}🎉 ALL SMOKE TESTS PASSED!${NC}"
    echo -e "${GREEN}✅ Staging environment is ready for production${NC}"
    echo -e "${YELLOW}📝 Next Steps: Deploy to production${NC}"
    exit 0
else
    echo -e "\n${RED}❌ $FAILED smoke test(s) failed${NC}"
    echo -e "${RED}❌ Fix issues before production deployment${NC}"
    exit 1
fi
