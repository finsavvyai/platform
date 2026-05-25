#!/bin/bash

# Test Coverage Script for QueryFlux Backend
# This script runs comprehensive tests and generates coverage reports

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
COVERAGE_DIR="coverage"
REPORT_DIR="reports"
MIN_COVERAGE=80

echo -e "${BLUE}QueryFlux Backend - Test Coverage Script${NC}"
echo "======================================"

# Create directories
mkdir -p $COVERAGE_DIR
mkdir -p $REPORT_DIR

# Function to print section header
print_section() {
    echo -e "\n${YELLOW}=== $1 ===${NC}"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check dependencies
print_section "Checking Dependencies"

if ! command_exists go; then
    echo -e "${RED}Error: Go is not installed${NC}"
    exit 1
fi

if ! command_exists golint; then
    echo -e "${YELLOW}Installing golint...${NC}"
    go install golang.org/x/lint/golint@latest
fi

if ! command_exists golangci-lint; then
    echo -e "${YELLOW}Installing golangci-lint...${NC}"
    go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest
fi

echo -e "${GREEN}✓ Dependencies checked${NC}"

# Clean previous test results
print_section "Cleaning Previous Results"
go clean -testcache
rm -rf $COVERAGE_DIR
rm -rf $REPORT_DIR
mkdir -p $COVERAGE_DIR
mkdir -p $REPORT_DIR

echo -e "${GREEN}✓ Previous results cleaned${NC}"

# Run go fmt check
print_section "Code Formatting Check"
if [ "$(gofmt -s -l . | wc -l)" -gt 0 ]; then
    echo -e "${RED}Error: Code is not properly formatted${NC}"
    echo "Run 'go fmt -s .' to fix formatting issues"
    gofmt -s -l .
    exit 1
fi
echo -e "${GREEN}✓ Code formatting check passed${NC}"

# Run go vet
print_section "Go Vet Analysis"
go vet ./...
echo -e "${GREEN}✓ Go vet analysis passed${NC}"

# Run golint
print_section "Code Linting (golint)"
lint_output=$(golint ./...)
if [ -n "$lint_output" ]; then
    echo -e "${YELLOW}Linting issues found:${NC}"
    echo "$lint_output"
    echo -e "${YELLOW}Consider fixing these issues for better code quality${NC}"
else
    echo -e "${GREEN}✓ No linting issues found${NC}"
fi

# Run golangci-lint
print_section "Advanced Linting (golangci-lint)"
golangci-lint run --timeout=5m
echo -e "${GREEN}✓ Advanced linting passed${NC}"

# Run unit tests with coverage
print_section "Unit Tests with Coverage"
echo "Running unit tests..."
go test -v -race -coverprofile=$COVERAGE_DIR/unit-coverage.out ./internal/... 2>&1 | tee $REPORT_DIR/unit-test.log

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Unit tests passed${NC}"
else
    echo -e "${RED}✗ Unit tests failed${NC}"
    exit 1
fi

# Generate unit test coverage report
print_section "Unit Test Coverage Report"
go tool cover -html=$COVERAGE_DIR/unit-coverage.out -o $REPORT_DIR/unit-coverage.html
unit_coverage=$(go tool cover -func=$COVERAGE_DIR/unit-coverage.out | grep total | awk '{print $3}' | sed 's/%//')
echo "Unit Test Coverage: ${unit_coverage}%"

# Check if unit coverage meets minimum
if (( $(echo "$unit_coverage >= $MIN_COVERAGE" | bc -l) )); then
    echo -e "${GREEN}✓ Unit test coverage (${unit_coverage}%) meets minimum requirement (${MIN_COVERAGE}%)${NC}"
else
    echo -e "${RED}✗ Unit test coverage (${unit_coverage}%) is below minimum requirement (${MIN_COVERAGE}%)${NC}"
    exit 1
fi

# Run integration tests with coverage (if available)
print_section "Integration Tests"
if [ -d "tests/integration" ]; then
    echo "Running integration tests..."
    go test -v -race -coverprofile=$COVERAGE_DIR/integration-coverage.out ./tests/integration/... 2>&1 | tee $REPORT_DIR/integration-test.log

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Integration tests passed${NC}"

        # Generate integration test coverage report
        go tool cover -html=$COVERAGE_DIR/integration-coverage.out -o $REPORT_DIR/integration-coverage.html
        integration_coverage=$(go tool cover -func=$COVERAGE_DIR/integration-coverage.out | grep total | awk '{print $3}' | sed 's/%//')
        echo "Integration Test Coverage: ${integration_coverage}%"
    else
        echo -e "${RED}✗ Integration tests failed${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}No integration tests found${NC}"
fi

# Run E2E tests (if available)
print_section "End-to-End Tests"
if [ -d "e2e" ]; then
    echo "Running E2E tests..."
    if command_exists npx; then
        cd e2e
        npm test 2>&1 | tee ../$REPORT_DIR/e2e-test.log
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✓ E2E tests passed${NC}"
        else
            echo -e "${RED}✗ E2E tests failed${NC}"
            exit 1
        fi
        cd ..
    else
        echo -e "${YELLOW}Node.js not found, skipping E2E tests${NC}"
    fi
else
    echo -e "${YELLOW}No E2E tests found${NC}"
fi

# Generate combined coverage report
print_section "Combined Coverage Report"
echo "Creating combined coverage report..."

# Combine coverage files if both exist
if [ -f "$COVERAGE_DIR/unit-coverage.out" ] && [ -f "$COVERAGE_DIR/integration-coverage.out" ]; then
    gocovmerge $COVERAGE_DIR/unit-coverage.out $COVERAGE_DIR/integration-coverage.out > $COVERAGE_DIR/combined-coverage.out
    go tool cover -html=$COVERAGE_DIR/combined-coverage.out -o $REPORT_DIR/combined-coverage.html
    combined_coverage=$(go tool cover -func=$COVERAGE_DIR/combined-coverage.out | grep total | awk '{print $3}' | sed 's/%//')
    echo "Combined Test Coverage: ${combined_coverage}%"
elif [ -f "$COVERAGE_DIR/unit-coverage.out" ]; then
    cp $COVERAGE_DIR/unit-coverage.out $COVERAGE_DIR/combined-coverage.out
    cp $REPORT_DIR/unit-coverage.html $REPORT_DIR/combined-coverage.html
    combined_coverage=$unit_coverage
    echo "Combined Test Coverage: ${combined_coverage}% (unit tests only)"
else
    echo -e "${YELLOW}No coverage data available for combined report${NC}"
fi

# Generate coverage summary
print_section "Coverage Summary"
echo "Generating coverage summary..."

cat > $REPORT_DIR/coverage-summary.txt << EOF
QueryFlux Backend - Test Coverage Summary
Generated: $(date)

=== Coverage Reports ===
Unit Test Coverage: ${unit_coverage}%
EOF

if [ -n "$integration_coverage" ]; then
    echo "Integration Test Coverage: ${integration_coverage}%" >> $REPORT_DIR/coverage-summary.txt
fi

if [ -n "$combined_coverage" ]; then
    echo "Combined Test Coverage: ${combined_coverage}%" >> $REPORT_DIR/coverage-summary.txt
fi

echo "" >> $REPORT_DIR/coverage-summary.txt
echo "=== Coverage Reports Generated ===" >> $REPORT_DIR/coverage-summary.txt
echo "Unit Test Coverage HTML: $REPORT_DIR/unit-coverage.html" >> $REPORT_DIR/coverage-summary.txt

if [ -n "$integration_coverage" ]; then
    echo "Integration Test Coverage HTML: $REPORT_DIR/integration-coverage.html" >> $REPORT_DIR/coverage-summary.txt
fi

if [ -n "$combined_coverage" ]; then
    echo "Combined Coverage HTML: $REPORT_DIR/combined-coverage.html" >> $REPORT_DIR/coverage-summary.txt
fi

cat $REPORT_DIR/coverage-summary.txt

# Run benchmark tests
print_section "Benchmark Tests"
echo "Running benchmark tests..."
go test -bench=. -benchmem ./internal/... 2>&1 | tee $REPORT_DIR/benchmark.log
echo -e "${GREEN}✓ Benchmark tests completed${NC}"

# Check for race conditions with stress test
print_section "Race Condition Tests"
echo "Running stress tests for race conditions..."
go test -race -count=100 ./internal/... 2>&1 | tee $REPORT_DIR/race-test.log
echo -e "${GREEN}✓ Race condition tests completed${NC}"

# Generate test matrix
print_section "Test Matrix"
echo "Generating test matrix..."

cat > $REPORT_DIR/test-matrix.json << EOF
{
  "timestamp": "$(date -Iseconds)",
  "unit_tests": {
    "passed": $(grep -c "PASS" $REPORT_DIR/unit-test.log 2>/dev/null || echo "0"),
    "failed": $(grep -c "FAIL" $REPORT_DIR/unit-test.log 2>/dev/null || echo "0"),
    "coverage": "${unit_coverage}%"
  },
  "integration_tests": {
    "passed": $(grep -c "PASS" $REPORT_DIR/integration-test.log 2>/dev/null || echo "0"),
    "failed": $(grep -c "FAIL" $REPORT_DIR/integration-test.log 2>/dev/null || echo "0"),
    "coverage": "${integration_coverage:-"N/A"}"
  },
  "e2e_tests": {
    "passed": $(grep -c "✓" $REPORT_DIR/e2e-test.log 2>/dev/null || echo "0"),
    "failed": $(grep -c "✗" $REPORT_DIR/e2e-test.log 2>/dev/null || echo "0"),
    "coverage": "N/A"
  },
  "linting": {
    "golint_issues": $(echo "$lint_output" | wc -l),
    "golangci_lint_passed": true
  }
}
EOF

echo "Test matrix saved to $REPORT_DIR/test-matrix.json"

# Final summary
print_section "Final Summary"
echo "===================="

if [ -n "$combined_coverage" ]; then
    final_coverage=$combined_coverage
else
    final_coverage=$unit_coverage
fi

if (( $(echo "$final_coverage >= $MIN_COVERAGE" | bc -l) )); then
    echo -e "${GREEN}✓ All tests passed with ${final_coverage}% coverage${NC}"
    echo -e "${GREEN}✓ Quality gates passed${NC}"
    echo ""
    echo "Reports generated:"
    echo "  - Coverage Reports: $REPORT_DIR/*.html"
    echo "  - Test Logs: $REPORT_DIR/*-test.log"
    echo "  - Coverage Summary: $REPORT_DIR/coverage-summary.txt"
    echo "  - Test Matrix: $REPORT_DIR/test-matrix.json"
    exit 0
else
    echo -e "${RED}✗ Coverage (${final_coverage}%) is below minimum requirement (${MIN_COVERAGE}%)${NC}"
    echo ""
    echo "To improve coverage:"
    echo "  1. Write tests for uncovered functions"
    echo "  2. Add edge case tests"
    echo "  3. Include integration test scenarios"
    echo ""
    echo "View detailed coverage report: $REPORT_DIR/combined-coverage.html"
    exit 1
fi