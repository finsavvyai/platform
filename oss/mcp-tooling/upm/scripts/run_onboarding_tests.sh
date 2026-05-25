#!/bin/bash
# Run automated onboarding tests

set -e

echo "🚀 Running UPM Onboarding Tests"
echo "================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if pytest is installed
if ! command -v pytest &> /dev/null; then
    echo -e "${RED}❌ pytest is not installed${NC}"
    echo "Install it with: pip install pytest pytest-asyncio httpx"
    exit 1
fi

# Set environment variables
export SECRET_KEY="test-secret-key-for-onboarding-tests"
export PYTHONPATH="${PYTHONPATH}:$(pwd)/src"

# Test results
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Function to run tests
run_test_suite() {
    local test_type=$1
    local test_path=$2
    local description=$3
    
    echo -e "${YELLOW}Running: ${description}${NC}"
    echo "----------------------------------------"
    
    if pytest "$test_path" -v --tb=short -m "$test_type" 2>&1 | tee /tmp/onboarding_test_output.txt; then
        echo -e "${GREEN}✅ ${description} - PASSED${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}❌ ${description} - FAILED${NC}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    echo ""
}

# Run all onboarding tests
echo "📋 Test Suites:"
echo "1. Unit Tests (onboarding service)"
echo "2. Integration Tests (onboarding integration)"
echo "3. End-to-End Tests (complete onboarding flow)"
echo ""

# Unit tests
run_test_suite "unit" "tests/unit/test_onboarding_service.py" "Unit Tests - Onboarding Service"

# Integration tests
run_test_suite "integration" "tests/integration/test_onboarding_integration.py" "Integration Tests - Onboarding Integration"

# E2E tests
run_test_suite "e2e" "tests/e2e/test_onboarding_flow.py" "End-to-End Tests - Onboarding Flow"

# Summary
echo "================================"
echo "📊 Test Summary"
echo "================================"
echo -e "Total Test Suites: ${TOTAL_TESTS}"
echo -e "${GREEN}Passed: ${PASSED_TESTS}${NC}"
echo -e "${RED}Failed: ${FAILED_TESTS}${NC}"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}✅ All onboarding tests passed!${NC}"
    exit 0
else
    echo -e "${RED}❌ Some onboarding tests failed!${NC}"
    exit 1
fi
