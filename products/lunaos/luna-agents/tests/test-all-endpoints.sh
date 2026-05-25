#!/bin/bash

# Luna Vision RAG™ - Comprehensive API Test Suite
# Tests all endpoints and agents

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="https://luna-vision-rag.broad-dew-49ad.workers.dev"
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Test results array
declare -a TEST_RESULTS

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║       Luna Vision RAG™ - API Test Suite                   ║${NC}"
echo -e "${BLUE}║       Testing all endpoints and agents                     ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Base URL: ${BASE_URL}${NC}"
echo ""

# Function to test endpoint
test_endpoint() {
    local name=$1
    local method=$2
    local endpoint=$3
    local data=$4
    local expected_status=${5:-200}
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    echo -e "${BLUE}[TEST $TOTAL_TESTS]${NC} Testing: ${name}"
    
    if [ "$method" == "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" "${BASE_URL}${endpoint}")
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" "${BASE_URL}${endpoint}" \
            -H "Content-Type: application/json" \
            -d "$data")
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" == "$expected_status" ]; then
        echo -e "${GREEN}✓ PASSED${NC} - Status: $http_code"
        echo -e "  Response: ${body:0:100}..."
        PASSED_TESTS=$((PASSED_TESTS + 1))
        TEST_RESULTS+=("✓ $name")
    else
        echo -e "${RED}✗ FAILED${NC} - Expected: $expected_status, Got: $http_code"
        echo -e "  Response: $body"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        TEST_RESULTS+=("✗ $name")
    fi
    echo ""
}

# Start testing
echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}1. HEALTH & INFO ENDPOINTS${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
echo ""

test_endpoint "Health Check" "GET" "/health" "" 200
test_endpoint "API Info" "GET" "/api" "" 200
test_endpoint "Root Endpoint" "GET" "/" "" 200

echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}2. RAG ENDPOINTS${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
echo ""

test_endpoint "RAG Setup" "POST" "/api/rag/setup" \
    '{"projectPath":"/test/project","collectionName":"test-collection","vectorDB":"pinecone"}' 200

test_endpoint "RAG Query" "POST" "/api/rag/query" \
    '{"query":"authentication logic","collectionName":"test-collection","topK":5}' 200

test_endpoint "RAG Index" "POST" "/api/rag/index" \
    '{"collectionName":"test-collection","contexts":["context1","context2"]}' 200

echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}3. GLM VISION ENDPOINTS${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
echo ""

test_endpoint "GLM Capture" "POST" "/api/glm/capture" \
    '{"url":"https://example.com"}' 200

test_endpoint "GLM Analyze" "POST" "/api/glm/analyze" \
    '{"screenshot":"base64data"}' 200

test_endpoint "GLM Test" "POST" "/api/glm/test" \
    '{"testCase":"login-flow"}' 200

echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}4. INTEGRATION ENDPOINTS${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
echo ""

test_endpoint "Integration Validate" "POST" "/api/integration/validate" \
    '{"component":"LoginForm"}' 200

test_endpoint "Integration Generate" "POST" "/api/integration/generate" \
    '{"component":"LoginForm","framework":"playwright"}' 200

test_endpoint "Integration Report" "POST" "/api/integration/report" \
    '{"testRun":"run-123"}' 200

echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}5. ERROR HANDLING${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
echo ""

test_endpoint "404 Not Found" "GET" "/api/nonexistent" "" 404
test_endpoint "Invalid Method" "GET" "/api/rag/setup" "" 405

echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}6. CORS PREFLIGHT${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
echo ""

echo -e "${BLUE}[TEST $((TOTAL_TESTS + 1))]${NC} Testing: CORS Preflight"
TOTAL_TESTS=$((TOTAL_TESTS + 1))

cors_response=$(curl -s -w "\n%{http_code}" -X OPTIONS "${BASE_URL}/api/rag/query" \
    -H "Origin: https://example.com" \
    -H "Access-Control-Request-Method: POST")

cors_code=$(echo "$cors_response" | tail -n1)

if [ "$cors_code" == "200" ] || [ "$cors_code" == "204" ]; then
    echo -e "${GREEN}✓ PASSED${NC} - CORS Preflight: $cors_code"
    PASSED_TESTS=$((PASSED_TESTS + 1))
    TEST_RESULTS+=("✓ CORS Preflight")
else
    echo -e "${RED}✗ FAILED${NC} - CORS Preflight: $cors_code"
    FAILED_TESTS=$((FAILED_TESTS + 1))
    TEST_RESULTS+=("✗ CORS Preflight")
fi
echo ""

# Summary
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                    TEST SUMMARY                            ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "Total Tests:  ${BLUE}${TOTAL_TESTS}${NC}"
echo -e "Passed:       ${GREEN}${PASSED_TESTS}${NC}"
echo -e "Failed:       ${RED}${FAILED_TESTS}${NC}"
echo -e "Success Rate: ${YELLOW}$(awk "BEGIN {printf \"%.1f\", ($PASSED_TESTS/$TOTAL_TESTS)*100}")%${NC}"
echo ""

# Detailed results
echo -e "${YELLOW}Detailed Results:${NC}"
for result in "${TEST_RESULTS[@]}"; do
    echo "  $result"
done
echo ""

# Exit code
if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}✗ Some tests failed!${NC}"
    exit 1
fi
