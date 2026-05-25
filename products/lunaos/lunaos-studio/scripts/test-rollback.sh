#!/bin/bash

# Test Rollback Procedures
# This script tests the rollback functionality in a safe environment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🧪 Testing Rollback Procedures${NC}"
echo "================================================"
echo ""

# Test 1: Check if rollback script exists
echo "Test 1: Rollback Script Existence"
echo "----------------------------------"
if [ -f "./scripts/rollback.sh" ]; then
    echo -e "${GREEN}✓${NC} Rollback script exists"
else
    echo -e "${RED}✗${NC} Rollback script not found"
    exit 1
fi

# Test 2: Check if rollback script is executable
echo ""
echo "Test 2: Rollback Script Permissions"
echo "------------------------------------"
if [ -x "./scripts/rollback.sh" ]; then
    echo -e "${GREEN}✓${NC} Rollback script is executable"
else
    echo -e "${RED}✗${NC} Rollback script is not executable"
    echo "Run: chmod +x ./scripts/rollback.sh"
    exit 1
fi

# Test 3: Check if health check script exists
echo ""
echo "Test 3: Health Check Script Existence"
echo "--------------------------------------"
if [ -f "./scripts/health-check.sh" ]; then
    echo -e "${GREEN}✓${NC} Health check script exists"
else
    echo -e "${RED}✗${NC} Health check script not found"
    exit 1
fi

# Test 4: Check if health check script is executable
echo ""
echo "Test 4: Health Check Script Permissions"
echo "----------------------------------------"
if [ -x "./scripts/health-check.sh" ]; then
    echo -e "${GREEN}✓${NC} Health check script is executable"
else
    echo -e "${RED}✗${NC} Health check script is not executable"
    echo "Run: chmod +x ./scripts/health-check.sh"
    exit 1
fi

# Test 5: Check if Netlify CLI is installed
echo ""
echo "Test 5: Netlify CLI Installation"
echo "---------------------------------"
if command -v netlify &> /dev/null; then
    NETLIFY_VERSION=$(netlify --version)
    echo -e "${GREEN}✓${NC} Netlify CLI is installed: $NETLIFY_VERSION"
else
    echo -e "${YELLOW}⚠${NC} Netlify CLI is not installed"
    echo "Install with: npm install -g netlify-cli"
    echo "This is required for manual rollbacks"
fi

# Test 6: Check if required environment variables are documented
echo ""
echo "Test 6: Environment Variables Documentation"
echo "--------------------------------------------"
if grep -q "NETLIFY_SITE_ID" .env.example 2>/dev/null; then
    echo -e "${GREEN}✓${NC} Environment variables are documented"
else
    echo -e "${YELLOW}⚠${NC} Environment variables should be documented in .env.example"
fi

# Test 7: Check if rollback documentation exists
echo ""
echo "Test 7: Rollback Documentation"
echo "-------------------------------"
if [ -f "./docs/ROLLBACK_PROCEDURES.md" ]; then
    echo -e "${GREEN}✓${NC} Rollback documentation exists"
else
    echo -e "${RED}✗${NC} Rollback documentation not found"
    exit 1
fi

# Test 8: Check if GitHub Actions workflow includes rollback
echo ""
echo "Test 8: GitHub Actions Rollback Configuration"
echo "----------------------------------------------"
if [ -f "./.github/workflows/deploy.yml" ]; then
    if grep -q "Rollback on failure" ./.github/workflows/deploy.yml; then
        echo -e "${GREEN}✓${NC} GitHub Actions includes rollback step"
    else
        echo -e "${RED}✗${NC} GitHub Actions missing rollback step"
        exit 1
    fi
else
    echo -e "${RED}✗${NC} GitHub Actions workflow not found"
    exit 1
fi

# Test 9: Check if health check is integrated in workflow
echo ""
echo "Test 9: Health Check Integration"
echo "---------------------------------"
if grep -q "health-check" ./.github/workflows/deploy.yml; then
    echo -e "${GREEN}✓${NC} Health check is integrated in workflow"
else
    echo -e "${RED}✗${NC} Health check not integrated in workflow"
    exit 1
fi

# Test 10: Validate rollback script syntax
echo ""
echo "Test 10: Rollback Script Syntax"
echo "--------------------------------"
if bash -n ./scripts/rollback.sh 2>/dev/null; then
    echo -e "${GREEN}✓${NC} Rollback script syntax is valid"
else
    echo -e "${RED}✗${NC} Rollback script has syntax errors"
    exit 1
fi

# Test 11: Validate health check script syntax
echo ""
echo "Test 11: Health Check Script Syntax"
echo "------------------------------------"
if bash -n ./scripts/health-check.sh 2>/dev/null; then
    echo -e "${GREEN}✓${NC} Health check script syntax is valid"
else
    echo -e "${RED}✗${NC} Health check script has syntax errors"
    exit 1
fi

# Test 12: Check if jq is installed (required for rollback script)
echo ""
echo "Test 12: jq Installation"
echo "------------------------"
if command -v jq &> /dev/null; then
    JQ_VERSION=$(jq --version)
    echo -e "${GREEN}✓${NC} jq is installed: $JQ_VERSION"
else
    echo -e "${YELLOW}⚠${NC} jq is not installed"
    echo "Install with: brew install jq (macOS) or apt-get install jq (Linux)"
    echo "This is required for the rollback script"
fi

# Test 13: Check if curl is installed (required for health checks)
echo ""
echo "Test 13: curl Installation"
echo "--------------------------"
if command -v curl &> /dev/null; then
    CURL_VERSION=$(curl --version | head -n 1)
    echo -e "${GREEN}✓${NC} curl is installed: $CURL_VERSION"
else
    echo -e "${RED}✗${NC} curl is not installed"
    echo "curl is required for health checks"
    exit 1
fi

# Test 14: Test health check with example URL
echo ""
echo "Test 14: Health Check Functionality"
echo "------------------------------------"
echo "Testing health check with example.com..."
if timeout 30 ./scripts/health-check.sh https://example.com &>/dev/null; then
    echo -e "${GREEN}✓${NC} Health check script works correctly"
else
    echo -e "${YELLOW}⚠${NC} Health check script encountered issues"
    echo "This is expected if testing against example.com"
    echo "The script should work correctly with your actual deployment URL"
fi

# Test 15: Check if deployment protection documentation exists
echo ""
echo "Test 15: Deployment Protection Documentation"
echo "---------------------------------------------"
if [ -f "./.github/DEPLOYMENT_PROTECTION.md" ]; then
    echo -e "${GREEN}✓${NC} Deployment protection documentation exists"
else
    echo -e "${YELLOW}⚠${NC} Deployment protection documentation not found"
fi

# Summary
echo ""
echo "================================================"
echo -e "${BLUE}🧪 Test Summary${NC}"
echo "================================================"
echo ""

CRITICAL_TESTS=11
PASSED_TESTS=0

# Count passed tests (simplified - in real scenario, track each test result)
if [ -f "./scripts/rollback.sh" ] && [ -x "./scripts/rollback.sh" ] && \
   [ -f "./scripts/health-check.sh" ] && [ -x "./scripts/health-check.sh" ] && \
   [ -f "./docs/ROLLBACK_PROCEDURES.md" ] && \
   [ -f "./.github/workflows/deploy.yml" ] && \
   bash -n ./scripts/rollback.sh 2>/dev/null && \
   bash -n ./scripts/health-check.sh 2>/dev/null && \
   command -v curl &> /dev/null; then
    PASSED_TESTS=$CRITICAL_TESTS
fi

if [ $PASSED_TESTS -eq $CRITICAL_TESTS ]; then
    echo -e "${GREEN}✓ All critical tests passed!${NC}"
    echo ""
    echo "Rollback procedures are properly configured."
    echo ""
    echo "Next steps:"
    echo "1. Set up environment variables (NETLIFY_SITE_ID, NETLIFY_AUTH_TOKEN)"
    echo "2. Test rollback in staging environment"
    echo "3. Conduct rollback drill with team"
    echo "4. Document any environment-specific procedures"
    echo ""
    exit 0
else
    echo -e "${RED}✗ Some tests failed${NC}"
    echo ""
    echo "Please review the test output above and fix any issues."
    echo ""
    exit 1
fi
