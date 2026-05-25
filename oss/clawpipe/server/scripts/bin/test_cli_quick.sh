#!/bin/bash
# FinSavvyAI CLI Quick Test Suite
# Run this script to test all CLI functionality after reorganization

echo "🧪 FINSAVVYAI CLI TEST SUITE"
echo "============================"
echo "Testing reorganized CLI functionality..."
echo

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

test_count=0
pass_count=0

run_test() {
    local test_name="$1"
    local command="$2"
    local expected_pattern="$3"

    test_count=$((test_count + 1))
    echo -n "Test $test_count: $test_name ... "

    if eval "$command" > /dev/null 2>&1; then
        if eval "$command" 2>&1 | grep -q "$expected_pattern"; then
            echo -e "${GREEN}PASS${NC}"
            pass_count=$((pass_count + 1))
        else
            echo -e "${RED}FAIL${NC} (Pattern not found: $expected_pattern)"
        fi
    else
        echo -e "${RED}FAIL${NC} (Command failed)"
    fi
}

echo "🔍 Basic CLI Tests"
echo "------------------"

# Test 1: CLI path resolution
run_test "CLI Path" "which finsavvyai" "finsavvyai"

# Test 2: Help command
run_test "Help Command" "finsavvyai help" "USAGE"

# Test 3: Error handling
run_test "Error Handling" "finsavvyai invalid-cmd 2>&1" "error"

echo
echo "📊 Describe Commands"
echo "-------------------"

# Test 4: Describe clusters
run_test "Describe Clusters" "finsavvyai describe clusters" "CLUSTERS"

# Test 5: Describe nodes
run_test "Describe Nodes" "finsavvyai describe nodes" "NODES"

# Test 6: Describe services
run_test "Describe Services" "finsavvyai describe services" "SERVICE STATUS"

# Test 7: Detailed nodes
run_test "Detailed Nodes" "finsavvyai describe nodes --detailed" "NODE 1"

echo
echo "📋 Output Formats"
echo "---------------"

# Test 8: JSON output
run_test "JSON Output" "finsavvyai --output json describe clusters" "\\[\\{"

# Test 9: YAML output
run_test "YAML Output" "finsavvyai --output yaml describe clusters" "ClusterId"

# Test 10: No color output
run_test "No Color" "finsavvyai --no-color describe clusters" "CLUSTERS"

echo
echo "⚙️ Global Options"
echo "---------------"

# Test 11: Verbose mode
run_test "Verbose Mode" "finsavvyai --verbose describe clusters" "CLUSTERS"

# Test 12: Profile option
run_test "Profile Option" "finsavvyai --profile test describe clusters" "CLUSTERS"

echo
echo "🔧 Service Management"
echo "-------------------"

# Test 13: Start all services
run_test "Start All Services" "finsavvyai start service all" "successfully"

# Wait for services to start
sleep 3

# Test 14: Services status after start
run_test "Services Running" "finsavvyai describe services" "AVAILABLE"

# Test 15: Stop all services
run_test "Stop All Services" "finsavvyai stop service all" "successfully"

echo
echo "🎯 Individual Services"
echo "--------------------"

# Test 16: Start master only
run_test "Start Master" "finsavvyai start service master" "successfully"

sleep 2

# Test 17: Stop master only
run_test "Stop Master" "finsavvyai stop service master" "successfully"

# Test 18: Start worker only
run_test "Start Worker" "finsavvyai start service worker" "successfully"

sleep 2

# Test 19: Stop worker only
run_test "Stop Worker" "finsavvyai stop service worker" "successfully"

echo
echo "🚨 Error Handling"
echo "---------------"

# Test 20: Invalid describe subcommand
run_test "Invalid Subcommand" "finsavvyai describe invalid 2>&1" "error"

# Test 21: Invalid service type
run_test "Invalid Service" "finsavvyai start service invalid 2>&1" "error"

echo
echo "📊 Test Summary"
echo "=============="
echo "Total Tests: $test_count"
echo "Passed: $pass_count"
echo "Failed: $((test_count - pass_count))"

if [ $pass_count -eq $test_count ]; then
    echo -e "${GREEN}🎉 ALL TESTS PASSED! CLI is working perfectly!${NC}"
    exit 0
else
    echo -e "${RED}⚠️  Some tests failed. Please review the output above.${NC}"
    exit 1
fi
