#!/bin/bash

# Luna Vision RAG™ - Agent Test Suite
# Tests RAG and GLM Vision agents locally

set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║       Luna Vision RAG™ - Agent Test Suite                 ║${NC}"
echo -e "${BLUE}║       Testing local agents and integrations                ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Test function
test_agent() {
    local name=$1
    local command=$2
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    echo -e "${BLUE}[TEST $TOTAL_TESTS]${NC} Testing: ${name}"
    
    if eval "$command" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ PASSED${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}✗ FAILED${NC}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    echo ""
}

echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}1. CHECKING DEPENDENCIES${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
echo ""

test_agent "Node.js installed" "node --version"
test_agent "npm installed" "npm --version"
test_agent "Wrangler installed" "wrangler --version"
test_agent "curl installed" "curl --version"

echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}2. CHECKING PROJECT STRUCTURE${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
echo ""

test_agent "RAG agent exists" "test -d mcp-servers/luna-nexa-rag"
test_agent "GLM Vision agent exists" "test -d mcp-servers/luna-glm-vision"
test_agent "Integration agent exists" "test -d mcp-servers/luna-rag-glm-integration"
test_agent "Tests directory exists" "test -d tests"

echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}3. CHECKING CONFIGURATION FILES${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
echo ""

test_agent "Integration package.json" "test -f mcp-servers/luna-rag-glm-integration/package.json"
test_agent "Integration wrangler.toml" "test -f mcp-servers/luna-rag-glm-integration/wrangler.toml"
test_agent "Integration index.js" "test -f mcp-servers/luna-rag-glm-integration/src/index.js"

echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}4. CHECKING DOCUMENTATION${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
echo ""

test_agent "Integration plan exists" "test -f RAG_GLM_INTEGRATION_PLAN.md"
test_agent "Deployment guide exists" "test -f CLOUD_DEPLOYMENT_GUIDE.md"
test_agent "Product overview exists" "test -f PRODUCT_OVERVIEW.md"
test_agent "Marketing assets exist" "test -f MARKETING_ASSETS.md"
test_agent "Deployment success exists" "test -f DEPLOYMENT_SUCCESS.md"

echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}5. VALIDATING JSON FILES${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
echo ""

if [ -f "mcp-servers/luna-rag-glm-integration/package.json" ]; then
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    echo -e "${BLUE}[TEST $TOTAL_TESTS]${NC} Validating: package.json"
    if node -e "JSON.parse(require('fs').readFileSync('mcp-servers/luna-rag-glm-integration/package.json'))" 2>/dev/null; then
        echo -e "${GREEN}✓ PASSED${NC} - Valid JSON"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}✗ FAILED${NC} - Invalid JSON"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    echo ""
fi

echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}6. CHECKING CLOUDFLARE DEPLOYMENT${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
echo ""

TOTAL_TESTS=$((TOTAL_TESTS + 1))
echo -e "${BLUE}[TEST $TOTAL_TESTS]${NC} Checking: Cloudflare Worker Status"

if curl -s -f "https://luna-vision-rag.broad-dew-49ad.workers.dev/health" > /dev/null; then
    echo -e "${GREEN}✓ PASSED${NC} - Worker is live"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${RED}✗ FAILED${NC} - Worker is not responding"
    FAILED_TESTS=$((FAILED_TESTS + 1))
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

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}✓ All agent tests passed!${NC}"
    exit 0
else
    echo -e "${RED}✗ Some agent tests failed!${NC}"
    exit 1
fi
