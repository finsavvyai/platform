#!/bin/bash
# Comprehensive Test Script for FinSavvyAI

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🧪 FinSavvyAI Comprehensive Test Suite${NC}"
echo -e "${BLUE}=====================================${NC}"
echo ""

PASSED=0
FAILED=0
GATEWAY_PORT=$(cat .gateway.port 2>/dev/null || echo "8080")
PYTHON_BIN="${FINSAVVYAI_PYTHON:-python3}"
if [ -z "${FINSAVVYAI_PYTHON:-}" ] && [ -x "$REPO_ROOT/.venv/bin/python" ]; then
    PYTHON_BIN="$REPO_ROOT/.venv/bin/python"
fi
RUN_EXTERNAL_TESTS="${RUN_EXTERNAL_TESTS:-0}"

test_service() {
    local name=$1
    local url=$2

    echo -n "Testing $name... "
    if curl -s -f "$url" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ PASS${NC}"
        PASSED=$((PASSED + 1))
        return 0
    else
        echo -e "${RED}❌ FAIL${NC}"
        FAILED=$((FAILED + 1))
        return 1
    fi
}

test_api() {
    local name=$1
    local url=$2
    local method=${3:-GET}
    local data=${4:-""}

    echo -n "Testing $name... "
    if [ "$method" = "POST" ]; then
        response=$(curl -s -w "%{http_code}" -X POST "$url" \
            -H "Content-Type: application/json" \
            -d "$data" -o /tmp/test_response.json)
    else
        response=$(curl -s -w "%{http_code}" "$url" -o /tmp/test_response.json)
    fi

    http_code="${response: -3}"
    if [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
        echo -e "${GREEN}✅ PASS (HTTP $http_code)${NC}"
        PASSED=$((PASSED + 1))
        return 0
    else
        echo -e "${RED}❌ FAIL (HTTP $http_code)${NC}"
        FAILED=$((FAILED + 1))
        return 1
    fi
}

echo -e "${BLUE}📊 Service Health Checks${NC}"
echo "------------------------"
test_service "Master Server" "http://localhost:8000/health"
test_service "Worker Node" "http://localhost:8001/health"
test_service "API Gateway" "http://localhost:${GATEWAY_PORT}/health"
echo ""

echo -e "${BLUE}🔌 API Endpoint Tests${NC}"
echo "----------------------"
test_api "Gateway Models" "http://localhost:${GATEWAY_PORT}/v1/models"
test_api "Gateway Chat" "http://localhost:${GATEWAY_PORT}/v1/chat/completions" "POST" '{"model":"gpt-3.5-turbo-sim","messages":[{"role":"user","content":"Test"}]}'
test_api "Master Cluster Status" "http://localhost:8000/cluster/status"
echo ""

echo -e "${BLUE}🌐 Cloudflare Worker Tests${NC}"
echo "---------------------------"
if [ "$RUN_EXTERNAL_TESTS" = "1" ]; then
    test_service "Cloudflare Worker Info" "https://finsavvyai-llm-proxy.broad-dew-49ad.workers.dev/info"
else
    echo -e "${YELLOW}⚠️  Skipped external checks (set RUN_EXTERNAL_TESTS=1 to enable)${NC}"
fi
echo ""

echo -e "${BLUE}💻 CLI Tests${NC}"
echo "------------"
echo -n "Testing CLI describe clusters... "
if "$PYTHON_BIN" main.py describe clusters > /dev/null 2>&1; then
    echo -e "${GREEN}✅ PASS${NC}"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}❌ FAIL${NC}"
    FAILED=$((FAILED + 1))
fi

echo ""
echo -e "${BLUE}📊 Test Summary${NC}"
echo "==============="
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed!${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠️  Some tests failed${NC}"
    exit 1
fi
