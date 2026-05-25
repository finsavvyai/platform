#!/bin/bash
# Test the website locally

set -e

echo "🧪 Testing UPM Website"
echo "====================="
echo ""

# Check if server is running
if curl -s http://localhost:8040/health > /dev/null 2>&1; then
    echo "✅ Server is running"
else
    echo "❌ Server is not running"
    echo "Start it with: python -m udp.api.main"
    exit 1
fi

echo ""
echo "Testing routes:"
echo ""

# Test root route
echo "1. Testing / (root):"
if curl -s http://localhost:8040/ | grep -q "Universal Package Manager"; then
    echo "   ✅ Landing page is being served"
else
    echo "   ❌ Landing page not found - check template path"
fi

# Test pricing
echo ""
echo "2. Testing /pricing:"
if curl -s http://localhost:8040/pricing | grep -q "Pricing"; then
    echo "   ✅ Pricing page is being served"
else
    echo "   ❌ Pricing page not found"
fi

# Test docs
echo ""
echo "3. Testing /docs:"
if curl -s http://localhost:8040/docs | grep -q "Documentation"; then
    echo "   ✅ Docs page is being served"
else
    echo "   ❌ Docs page not found"
fi

echo ""
echo "✅ Website test complete!"
echo ""
echo "🌐 Visit http://localhost:8040 to see your new website"
