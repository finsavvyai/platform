#!/bin/bash
# Test MCP Server via stdio (simulates Claude Desktop)

set -e

echo "🧪 Testing QueryFlux MCP Server via stdio..."
echo ""

# Build first
echo "📦 Building MCP server..."
npm run build
echo ""

# Test 1: List tools
echo "📋 Test 1: List available tools"
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | node dist/index.js 2>/dev/null | jq -r '.result.tools[] | "  ✓ \(.name) - \(.description)"'
echo ""

# Test 2: List resources
echo "📋 Test 2: List available resources"
echo '{"jsonrpc":"2.0","id":2,"method":"resources/list","params":{}}' | node dist/index.js 2>/dev/null | jq -r '.result.resources[] | "  ✓ \(.uri) - \(.name)"'
echo ""

echo "✅ MCP server is responding correctly!"
echo ""
echo "Next steps:"
echo "1. Edit ~/Library/Application Support/Claude/claude_desktop_config.json"
echo "2. Add QueryFlux MCP server configuration (see examples/claude-desktop-setup.md)"
echo "3. Restart Claude Desktop"
echo "4. Test with queries like 'Show me the database schema using QueryFlux'"
