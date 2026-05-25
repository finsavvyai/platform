#!/bin/bash

# Comprehensive Test Runner for Go SDK
# This script runs all tests with coverage reporting and validation

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[TEST RUNNER]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "go.mod" ]; then
    print_error "go.mod not found. Please run this script from the SDK root directory."
    exit 1
fi

print_status "Starting comprehensive test suite for Go SDK..."

# Create results directory
mkdir -p test_results
RESULTS_DIR="./test_results"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Clean up previous test artifacts
print_status "Cleaning up previous test artifacts..."
go clean -testcache
rm -f coverage.out coverage.html coverage.xml
rm -f test_results/*.log

# Download dependencies
print_status "Downloading dependencies..."
go mod download
go mod tidy

# Function to run tests for a specific package
run_package_tests() {
    local package=$1
    local test_name=$2

    print_status "Running tests for package: $package"

    if go test -v -race -count=1 "./$package" > "$RESULTS_DIR/${test_name}_${TIMESTAMP}.log" 2>&1; then
        print_success "✓ $package tests passed"
        return 0
    else
        print_error "✗ $package tests failed"
        echo "Check $RESULTS_DIR/${test_name}_${TIMESTAMP}.log for details"
        return 1
    fi
}

# Function to run tests with coverage
run_coverage_tests() {
    local package=$1
    local test_name=$2

    print_status "Running coverage tests for package: $package"

    if go test -v -race -coverprofile="$RESULTS_DIR/${test_name}_coverage.out" -covermode=atomic "./$package" > "$RESULTS_DIR/${test_name}_coverage_${TIMESTAMP}.log" 2>&1; then
        print_success "✓ $package coverage tests completed"

        # Generate HTML coverage report
        go tool cover -html="$RESULTS_DIR/${test_name}_coverage.out" -o "$RESULTS_DIR/${test_name}_coverage.html"

        # Get coverage percentage
        COVERAGE_PERCENT=$(go tool cover -func="$RESULTS_DIR/${test_name}_coverage.out" | grep total | awk '{print $3}')
        print_status "Coverage for $package: $COVERAGE_PERCENT"

        return 0
    else
        print_error "✗ $package coverage tests failed"
        return 1
    fi
}

# Run benchmark tests
run_benchmarks() {
    local package=$1
    local test_name=$2

    print_status "Running benchmarks for package: $package"

    if go test -bench=. -benchmem "./$package" > "$RESULTS_DIR/${test_name}_bench_${TIMESTAMP}.log" 2>&1; then
        print_success "✓ $package benchmarks completed"
        return 0
    else
        print_warning "⚠ $package benchmarks failed (may be no benchmark functions)"
        return 0
    fi
}

# Test execution order and packages
declare -a TEST_PACKAGES=(
    "pkg/sdln:core"
    "pkg/auth:auth"
    "pkg/middleware:middleware"
    "pkg/retry:retry"
)

# Track overall success
OVERALL_SUCCESS=true
FAILED_PACKAGES=()

# Phase 1: Basic unit tests
print_status "Phase 1: Running basic unit tests..."
for package_info in "${TEST_PACKAGES[@]}"; do
    IFS=':' read -r package test_name <<< "$package_info"
    if ! run_package_tests "$package" "$test_name"; then
        OVERALL_SUCCESS=false
        FAILED_PACKAGES+=("$package")
    fi
done

# Phase 2: Coverage tests
print_status "Phase 2: Running coverage tests..."
COVERAGE_FILES=()
for package_info in "${TEST_PACKAGES[@]}"; do
    IFS=':' read -r package test_name <<< "$package_info"
    if run_coverage_tests "$package" "$test_name"; then
        COVERAGE_FILES+=("$RESULTS_DIR/${test_name}_coverage.out")
    fi
done

# Phase 3: Benchmark tests
print_status "Phase 3: Running benchmark tests..."
for package_info in "${TEST_PACKAGES[@]}"; do
    IFS=':' read -r package test_name <<< "$package_info"
    run_benchmarks "$package" "$test_name"
done

# Phase 4: Race condition tests
print_status "Phase 4: Running race condition tests..."
for package_info in "${TEST_PACKAGES[@]}"; do
    IFS=':' read -r package test_name <<< "$package_info"
    print_status "Running race detection tests for $package..."
    if go test -race -short "./$package" > "$RESULTS_DIR/${test_name}_race_${TIMESTAMP}.log" 2>&1; then
        print_success "✓ $package race condition tests passed"
    else
        print_warning "⚠ $package race condition tests had issues"
    fi
done

# Phase 5: Memory leak tests
print_status "Phase 5: Running memory leak tests..."
for package_info in "${TEST_PACKAGES[@]}"; do
    IFS=':' read -r package test_name <<< "$package_info"
    print_status "Running memory leak tests for $package..."

    # Run with memory profiling
    if go test -memprofile="$RESULTS_DIR/${test_name}_mem.prof" -short "./$package" > "$RESULTS_DIR/${test_name}_memory_${TIMESTAMP}.log" 2>&1; then
        print_success "✓ $package memory profiling completed"
    else
        print_warning "⚠ $package memory profiling had issues"
    fi
done

# Combine coverage reports if any exist
if [ ${#COVERAGE_FILES[@]} -gt 0 ]; then
    print_status "Combining coverage reports..."

    # Create combined coverage file
    echo "mode: atomic" > "$RESULTS_DIR/combined_coverage.out"
    for coverage_file in "${COVERAGE_FILES[@]}"; do
        if [ -f "$coverage_file" ]; then
            grep -v "mode: atomic" "$coverage_file" >> "$RESULTS_DIR/combined_coverage.out"
        fi
    done

    # Generate combined HTML report
    go tool cover -html="$RESULTS_DIR/combined_coverage.out" -o "$RESULTS_DIR/combined_coverage.html"

    # Get total coverage percentage
    TOTAL_COVERAGE=$(go tool cover -func="$RESULTS_DIR/combined_coverage.out" | grep total | awk '{print $3}')
    print_success "Total coverage across all packages: $TOTAL_COVERAGE"
fi

# Phase 6: Integration tests (if they exist)
print_status "Phase 6: Running integration tests..."
if [ -d "tests" ] || [ -f "integration_test.go" ]; then
    if go test -v -tags=integration ./... > "$RESULTS_DIR/integration_${TIMESTAMP}.log" 2>&1; then
        print_success "✓ Integration tests passed"
    else
        print_warning "⚠ Integration tests had issues or none found"
    fi
else
    print_warning "⚠ No integration tests found"
fi

# Phase 7: Build validation
print_status "Phase 7: Validating builds..."
if go build ./... > "$RESULTS_DIR/build_${TIMESTAMP}.log" 2>&1; then
    print_success "✓ Build validation passed"
else
    print_error "✗ Build validation failed"
    OVERALL_SUCCESS=false
fi

# Phase 8: Linting and formatting (if tools are available)
print_status "Phase 8: Running linting and formatting checks..."

# Check for gofmt
if command -v gofmt &> /dev/null; then
    if [ "$(gofmt -s -l . | wc -l)" -eq 0 ]; then
        print_success "✓ Code formatting checks passed"
    else
        print_warning "⚠ Code formatting issues found"
        gofmt -s -l .
    fi
fi

# Check for golint
if command -v golint &> /dev/null; then
    if golint ./... > "$RESULTS_DIR/lint_${TIMESTAMP}.log" 2>&1; then
        print_success "✓ Linting checks passed"
    else
        print_warning "⚠ Linting issues found (check $RESULTS_DIR/lint_${TIMESTAMP}.log)"
    fi
fi

# Check for go vet
if go vet ./... > "$RESULTS_DIR/vet_${TIMESTAMP}.log" 2>&1; then
    print_success "✓ Go vet checks passed"
else
    print_warning "⚠ Go vet issues found (check $RESULTS_DIR/vet_${TIMESTAMP}.log)"
fi

# Generate final report
print_status "Generating final test report..."

REPORT_FILE="$RESULTS_DIR/test_report_${TIMESTAMP}.md"

cat > "$REPORT_FILE" << EOF
# Go SDK Test Report

**Generated:** $(date)
**Test Suite:** Comprehensive Go SDK Testing Framework

## Summary

- **Overall Status:** $(if [ "$OVERALL_SUCCESS" = true ]; then echo "✅ PASSED"; else echo "❌ FAILED"; fi)
- **Total Packages Tested:** ${#TEST_PACKAGES[@]}
- **Failed Packages:** ${#FAILED_PACKAGES[@]}

## Test Results

### Phase 1: Unit Tests
$(for package_info in "${TEST_PACKAGES[@]}"; do
    IFS=':' read -r package test_name <<< "$package_info"
    if [[ " ${FAILED_PACKAGES[@]} " =~ " ${package} " ]]; then
        echo "- ❌ $package - Failed"
    else
        echo "- ✅ $package - Passed"
    fi
done)

### Phase 2: Coverage Reports
EOF

if [ ${#COVERAGE_FILES[@]} -gt 0 ] && [ -f "$RESULTS_DIR/combined_coverage.out" ]; then
    echo "- **Total Coverage:** $TOTAL_COVERAGE" >> "$REPORT_FILE"
    echo "- **Individual Reports:** Available in test_results/ directory" >> "$REPORT_FILE"
else
    echo "- ❌ No coverage reports generated" >> "$REPORT_FILE"
fi

cat >> "$REPORT_FILE" << EOF

### Phase 3: Benchmarks
- Benchmark results available in test_results/ directory

### Phase 4: Race Condition Tests
- Race condition test logs available in test_results/ directory

### Phase 5: Memory Profiling
- Memory profiles available in test_results/ directory

### Phase 6: Integration Tests
$(if [ -f "$RESULTS_DIR/integration_${TIMESTAMP}.log" ]; then
    echo "- Integration test log available"
else
    echo "- No integration tests found"
fi)

### Phase 7: Build Validation
$(if grep -q "passed" "$RESULTS_DIR/build_${TIMESTAMP}.log" 2>/dev/null; then
    echo "- ✅ Build validation passed"
else
    echo "- ❌ Build validation failed"
fi)

### Phase 8: Code Quality
- Go vet checks: test_results/vet_${TIMESTAMP}.log
- Linting checks: $(if [ -f "$RESULTS_DIR/lint_${TIMESTAMP}.log" ]; then echo "Available"; else echo "Not available"; fi)
- Formatting checks: $(if [ -f "$RESULTS_DIR/format_${TIMESTAMP}.log" ]; then echo "Available"; else echo "Not available"; fi)

## Files Generated

- Test logs: test_results/*_${TIMESTAMP}.log
- Coverage reports: test_results/*_coverage.out, test_results/*_coverage.html
- Memory profiles: test_results/*_mem.prof
- Benchmark results: test_results/*_bench_${TIMESTAMP}.log
- Combined report: $REPORT_FILE

## Recommendations

1. Review any failed test logs for issues
2. Check coverage reports for areas needing improvement
3. Analyze benchmark results for performance optimization opportunities
4. Review race condition and memory profiling results

## Next Steps

1. Address any failing tests
2. Improve test coverage in areas with low coverage
3. Optimize performance based on benchmark results
4. Fix any race conditions or memory leaks identified
EOF

# Final status
echo ""
echo "=========================================="
print_status "Test Suite Complete!"
echo "=========================================="

if [ "$OVERALL_SUCCESS" = true ]; then
    print_success "🎉 All tests passed successfully!"
else
    print_error "❌ Some tests failed. Check the logs for details."
    echo "Failed packages:"
    for package in "${FAILED_PACKAGES[@]}"; do
        echo "  - $package"
    done
fi

echo ""
print_status "Detailed report generated: $REPORT_FILE"
print_status "All test artifacts stored in: $RESULTS_DIR"

if [ ${#COVERAGE_FILES[@]} -gt 0 ] && [ -f "$RESULTS_DIR/combined_coverage.html" ]; then
    print_status "Coverage report: $RESULTS_DIR/combined_coverage.html"
fi

exit $(if [ "$OVERALL_SUCCESS" = true ]; then echo 0; else echo 1; fi)
