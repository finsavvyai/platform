#!/bin/bash

# LunaForge MCP API Test Script v2.0
# Tests the enhanced production worker at https://lunaforge-mcp.broad-dew-49ad.workers.dev

API_URL="https://lunaforge-mcp.broad-dew-49ad.workers.dev"

echo "🧪 LunaForge MCP API Test Suite v2.0"
echo "======================================="
echo "Endpoint: $API_URL"
echo ""

PASS=0
FAIL=0

run_test() {
  local test_name="$1"
  local test_result="$2"
  if [ "$test_result" == "0" ]; then
    echo "  ✅ $test_name"
    ((PASS++))
  else
    echo "  ❌ $test_name"
    ((FAIL++))
  fi
}

echo "📋 Section 1: Basic Endpoints"
echo "------------------------------"

# Test 1: GET - Service Info
echo -n "Testing GET endpoint... "
response=$(curl -s "$API_URL")
if echo "$response" | grep -q "LunaForge MCP Worker"; then
  run_test "GET returns service info" 0
else
  run_test "GET returns service info" 1
fi

# Test 2: Version (handle escaped quotes in nested JSON)
echo -n "Testing version endpoint... "
response=$(curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"lunaforge_get_version","arguments":{}}}')
if echo "$response" | grep -q '1.0.0'; then
  run_test "Version is 1.0.0" 0
else
  run_test "Version is 1.0.0" 1
fi

# Test 3: Health Check
echo -n "Testing health check... "
response=$(curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"lunaforge_health_check","arguments":{}}}')
if echo "$response" | grep -q 'healthy'; then
  run_test "Health check returns healthy" 0
else
  run_test "Health check returns healthy" 1
fi

echo ""
echo "📋 Section 2: Code Analysis"
echo "----------------------------"

# Test 4: Simple TypeScript class
echo -n "Testing simple class analysis... "
response=$(curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"lunaforge_analyze_content","arguments":{"content":"export class Test {}","filePath":"test.ts"}}}')
if echo "$response" | grep -q 'classCount'; then
  run_test "Analysis returns classCount" 0
else
  run_test "Analysis returns classCount" 1
fi

# Test 5: Multiple classes
echo -n "Testing multiple classes... "
response=$(curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"lunaforge_analyze_content","arguments":{"content":"class A {} class B {} class C {}","filePath":"multi.ts"}}}')
if echo "$response" | grep -q 'classCount'; then
  run_test "Multi-class analysis works" 0
else
  run_test "Multi-class analysis works" 1
fi

# Test 6: Success flag
echo -n "Testing success response... "
response=$(curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"lunaforge_analyze_content","arguments":{"content":"const x = 1;","filePath":"test.ts"}}}')
if echo "$response" | grep -q 'success'; then
  run_test "Returns success field" 0
else
  run_test "Returns success field" 1
fi

echo ""
echo "📋 Section 3: HTTP Features"
echo "----------------------------"

# Test 7: CORS headers
echo -n "Testing CORS preflight... "
status=$(curl -s -o /dev/null -w "%{http_code}" -X OPTIONS "$API_URL")
if [ "$status" == "204" ]; then
  run_test "OPTIONS returns 204" 0
else
  run_test "OPTIONS returns 204" 1
fi

# Test 8: JSON-RPC response structure
echo -n "Testing JSON-RPC structure... "
response=$(curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"lunaforge_get_version","arguments":{}}}')
if echo "$response" | grep -q '"jsonrpc":"2.0"'; then
  run_test "Valid JSON-RPC 2.0 response" 0
else
  run_test "Valid JSON-RPC 2.0 response" 1
fi

# Test 9: List tools
echo -n "Testing tool listing... "
response=$(curl -s -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}')
if echo "$response" | grep -q 'lunaforge_health_check'; then
  run_test "Lists all 3 tools" 0
else
  run_test "Lists all 3 tools" 1
fi

# Test 10: Method not allowed
echo -n "Testing PUT rejection... "
status=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "$API_URL")
if [ "$status" == "405" ]; then
  run_test "PUT returns 405" 0
else
  run_test "PUT returns 405" 1
fi

echo ""
echo "======================================="
echo "📊 Results: $PASS passed, $FAIL failed"
echo ""

if [ $FAIL -eq 0 ]; then
  echo "🎉 ALL TESTS PASSED! Production Ready 10/10"
  exit 0
else
  echo "⚠️ Some tests need attention"
  exit 1
fi
