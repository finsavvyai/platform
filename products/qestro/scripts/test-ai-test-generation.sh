#!/bin/bash

# AI Test Generation Service Test Script
#
# This script tests the comprehensive AI test generation functionality
# including test generation, optimization, coverage analysis, and recommendations.

set -e

echo "🤖 Questro AI Test Generation Service Test Suite"
echo "=================================================="
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
API_BASE="http://localhost:8787"
TIMEOUT=30

# Helper functions
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
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

# Check if worker is running
check_worker() {
    print_status "Checking if AI Test Generation worker is running..."

    if curl -s --max-time 5 "$API_BASE/health" > /dev/null; then
        print_success "Worker is running"
        return 0
    else
        print_error "Worker is not running. Please start the worker first:"
        echo "   npm run build && npx wrangler dev --port 8787"
        exit 1
    fi
}

# Test 1: Health Check
test_health_check() {
    print_status "Test 1: Health Check"

    response=$(curl -s "$API_BASE/health" | jq -r '.status // "error"')

    if [ "$response" = "healthy" ]; then
        print_success "Health check passed"
        return 0
    else
        print_error "Health check failed"
        return 1
    fi
}

# Test 2: Demo Setup
test_demo_setup() {
    print_status "Test 2: Demo Data Setup"

    response=$(curl -s -X POST "$API_BASE/ai-test-generation/setup-demo" | jq -r '.success // false')

    if [ "$response" = "true" ]; then
        print_success "Demo setup completed"
        return 0
    else
        print_error "Demo setup failed"
        return 1
    fi
}

# Test 3: Test Case Generation
test_case_generation() {
    print_status "Test 3: AI Test Case Generation"

    request_body='{
        "description": "User authentication system with login, logout, and password reset functionality",
        "context": {
            "projectInfo": {
                "name": "Authentication Test Project",
                "description": "Testing user authentication flows",
                "platform": "web",
                "technology": ["React", "TypeScript", "Node.js"],
                "framework": ["Playwright", "Jest"]
            },
            "requirements": {
                "functional": ["User login", "User logout", "Password reset", "Account registration"],
                "nonFunctional": ["Security", "Performance", "Accessibility"],
                "businessRules": ["Users must verify email", "Password complexity requirements"]
            },
            "constraints": {
                "maxTestCases": 5,
                "priority": "high",
                "testTypes": ["functional", "security"]
            }
        },
        "options": {
            "maxTestCases": 5,
            "prioritize": true
        }
    }'

    response=$(curl -s -X POST "$API_BASE/ai-test-generation/generate" \
        -H "Content-Type: application/json" \
        -d "$request_body")

    success=$(echo "$response" | jq -r '.success // false')
    test_count=$(echo "$response" | jq -r '.data.metadata.generatedCount // 0')

    if [ "$success" = "true" ] && [ "$test_count" -gt 0 ]; then
        print_success "Generated $test_count test cases"
        echo "$response" | jq -r '.data.testCases[].name' | head -3 | while read -r name; do
            echo "   📋 $name"
        done
        return 0
    else
        print_error "Test generation failed"
        echo "Response: $response" | jq -r '.error // "Unknown error"'
        return 1
    fi
}

# Test 4: Test Optimization
test_optimization() {
    print_status "Test 4: Test Case Optimization"

    request_body='{
        "testCases": [
            {
                "id": "test-001",
                "name": "User Login Test",
                "description": "Test user login functionality",
                "steps": [
                    {"action": "Open login page", "expected": "Login form displayed"},
                    {"action": "Enter username", "expected": "Username entered"},
                    {"action": "Enter password", "expected": "Password entered"},
                    {"action": "Click submit", "expected": "User redirected to dashboard"}
                ],
                "complexity": "medium",
                "riskLevel": "high"
            }
        ],
        "feedback": {
            "issues": ["Test steps could be more specific", "Missing error scenarios"],
            "suggestions": ["Add negative test cases", "Include field validation tests"],
            "priorities": ["Focus on security aspects"],
            "constraints": ["Reduce execution time", "Improve reliability"]
        }
    }'

    response=$(curl -s -X POST "$API_BASE/ai-test-generation/optimize" \
        -H "Content-Type: application/json" \
        -d "$request_body")

    success=$(echo "$response" | jq -r '.success // false')
    optimized_count=$(echo "$response" | jq -r '.data.metadata.optimizedCount // 0')

    if [ "$success" = "true" ] && [ "$optimized_count" -gt 0 ]; then
        print_success "Optimized $optimized_count test cases"
        avg_improvement=$(echo "$response" | jq -r '.data.metadata.averageImprovement // 0')
        echo "   📈 Average improvement: ${avg_improvement}%"
        return 0
    else
        print_error "Test optimization failed"
        echo "Response: $response" | jq -r '.error // "Unknown error"'
        return 1
    fi
}

# Test 5: Coverage Analysis
test_coverage_analysis() {
    print_status "Test 5: Test Coverage Analysis"

    request_body='{
        "projectId": "test-project-001",
        "options": {
            "provider": "openai"
        }
    }'

    response=$(curl -s -X POST "$API_BASE/ai-test-generation/coverage-analysis" \
        -H "Content-Type: application/json" \
        -d "$request_body")

    success=$(echo "$response" | jq -r '.success // false')
    coverage=$(echo "$response" | jq -r '.data.coverage.overallCoverage // -1')

    if [ "$success" = "true" ] && [ "$coverage" -ge 0 ]; then
        print_success "Coverage analysis completed"
        echo "   📊 Overall coverage: ${coverage}%"
        gaps=$(echo "$response" | jq -r '.data.coverage.gaps | length // 0')
        echo "   🕳️  Coverage gaps identified: $gaps"
        return 0
    else
        print_error "Coverage analysis failed"
        echo "Response: $response" | jq -r '.error // "Unknown error"'
        return 1
    fi
}

# Test 6: Recommendations Generation
test_recommendations() {
    print_status "Test 6: Test Recommendations Generation"

    request_body='{
        "projectId": "test-project-001",
        "goals": ["improve security coverage", "increase mobile testing", "add performance tests"],
        "options": {
            "provider": "openai"
        }
    }'

    response=$(curl -s -X POST "$API_BASE/ai-test-generation/recommendations" \
        -H "Content-Type: application/json" \
        -d "$request_body")

    success=$(echo "$response" | jq -r '.success // false')
    rec_count=$(echo "$response" | jq -r '.data.recommendations | length // 0')
    priority_count=$(echo "$response" | jq -r '.data.priorityTests | length // 0')

    if [ "$success" = "true" ] && [ "$rec_count" -gt 0 ]; then
        print_success "Generated $rec_count recommendations"
        echo "   🎯 Priority test cases: $priority_count"
        echo "   ⏱️  Estimated effort: $(echo "$response" | jq -r '.data.metadata.estimatedEffort // 0') hours"
        echo "   💰 Expected ROI: $(echo "$response" | jq -r '.data.metadata.expectedROI // 0')"
        return 0
    else
        print_error "Recommendations generation failed"
        echo "Response: $response" | jq -r '.error // "Unknown error"'
        return 1
    fi
}

# Test 7: Usage Metrics
test_metrics() {
    print_status "Test 7: Usage Metrics"

    response=$(curl -s "$API_BASE/ai-test-generation/metrics")

    success=$(echo "$response" | jq -r '.success // false')

    if [ "$success" = "true" ]; then
        total_cost=$(echo "$response" | jq -r '.data.metrics.totalCost // 0')
        operations=$(echo "$response" | jq -r '.data.metrics.operationsCount // 0')
        success_rate=$(echo "$response" | jq -r '.data.metrics.successRate // 0')

        print_success "Metrics retrieved successfully"
        echo "   💰 Total cost: \$$(printf "%.4f" "$total_cost")"
        echo "   📊 Operations: $operations"
        echo "   📈 Success rate: ${success_rate}%"
        return 0
    else
        print_error "Metrics retrieval failed"
        return 1
    fi
}

# Test 8: Comprehensive Test
test_comprehensive() {
    print_status "Test 8: Comprehensive Functionality Test"

    response=$(curl -s -X POST "$API_BASE/ai-test-generation/comprehensive-test" \
        -H "Content-Type: application/json")

    success=$(echo "$response" | jq -r '.success // false')
    total_tests=$(echo "$response" | jq -r '.data.summary.totalTests // 0')
    successful_tests=$(echo "$response" | jq -r '.data.summary.successfulTests // 0')
    success_rate=$(echo "$response" | jq -r '.data.summary.successRate // 0')

    if [ "$success" = "true" ] && [ "$(echo "$success_rate >= 80" | bc -l)" -eq 1 ]; then
        print_success "Comprehensive test passed"
        echo "   📊 Test results: $successful_tests/$total_tests passed"
        echo "   📈 Success rate: ${success_rate}%"
        echo "   ⏱️  Duration: $(echo "$response" | jq -r '.data.summary.testDuration // 0')ms"
        return 0
    else
        print_error "Comprehensive test failed"
        echo "   📊 Test results: $successful_tests/$total_tests passed"
        echo "   📈 Success rate: ${success_rate}%"

        # Show detailed results
        echo "   📋 Detailed results:"
        echo "$response" | jq -r '.data.results | to_entries[] | "   \(.key): \(.value.status // "unknown")"' | while read -r line; do
            echo "     $line"
        done
        return 1
    fi
}

# Cleanup function
cleanup() {
    print_status "Cleaning up test environment..."
    # Add any cleanup tasks here
    print_success "Cleanup completed"
}

# Main execution
main() {
    # Trap cleanup on exit
    trap cleanup EXIT

    print_status "Starting AI Test Generation Service test suite..."
    echo ""

    # Run tests
    local tests=(
        "check_worker"
        "test_health_check"
        "test_demo_setup"
        "test_case_generation"
        "test_optimization"
        "test_coverage_analysis"
        "test_recommendations"
        "test_metrics"
        "test_comprehensive"
    )

    local passed=0
    local failed=0
    local total=${#tests[@]}

    for test in "${tests[@]}"; do
        echo ""
        if $test; then
            ((passed++))
        else
            ((failed++))
        fi
    done

    echo ""
    print_status "Test Suite Summary"
    echo "======================"
    echo "Total tests: $total"
    echo -e "Passed: ${GREEN}$passed${NC}"
    echo -e "Failed: ${RED}$failed${NC}"

    if [ $failed -eq 0 ]; then
        echo ""
        print_success "🎉 All tests passed! AI Test Generation Service is working correctly."
        exit 0
    else
        echo ""
        print_error "❌ Some tests failed. Please check the errors above."
        exit 1
    fi
}

# Check dependencies
check_dependencies() {
    command -v curl >/dev/null 2>&1 || { print_error "curl is required but not installed."; exit 1; }
    command -v jq >/dev/null 2>&1 || { print_error "jq is required but not installed."; exit 1; }
    command -v bc >/dev/null 2>&1 || { print_error "bc is required but not installed."; exit 1; }
}

# Check dependencies and run main
check_dependencies
main
