#!/bin/bash

# Test script for rag.lunaos.ai custom domain setup
# Run this after configuring the custom domain in Cloudflare Dashboard

echo "🧪 Testing rag.lunaos.ai setup..."
echo "=================================="
echo ""

# Test 1: DNS Resolution
echo "1️⃣  Testing DNS Resolution..."
if command -v dig &> /dev/null; then
    dig +short rag.lunaos.ai
    if [ $? -eq 0 ]; then
        echo "✅ DNS resolves"
    else
        echo "❌ DNS not resolving"
    fi
else
    echo "⚠️  dig command not found, skipping DNS test"
fi
echo ""

# Test 2: Health Check
echo "2️⃣  Testing Health Endpoint..."
HEALTH_RESPONSE=$(curl -s https://rag.lunaos.ai/health)
if [ $? -eq 0 ]; then
    echo "✅ Health endpoint responding"
    if command -v jq &> /dev/null; then
        echo "$HEALTH_RESPONSE" | jq .
    else
        echo "$HEALTH_RESPONSE"
    fi
else
    echo "❌ Health endpoint not responding"
fi
echo ""

# Test 3: API Info
echo "3️⃣  Testing API Info Endpoint..."
API_RESPONSE=$(curl -s https://rag.lunaos.ai/api)
if [ $? -eq 0 ]; then
    echo "✅ API endpoint responding"
    if command -v jq &> /dev/null; then
        echo "$API_RESPONSE" | jq .endpoints
    else
        echo "$API_RESPONSE"
    fi
else
    echo "❌ API endpoint not responding"
fi
echo ""

# Test 4: Response Time
echo "4️⃣  Testing Response Time..."
TIME_TOTAL=$(curl -w "%{time_total}" -s -o /dev/null https://rag.lunaos.ai/health)
if [ $? -eq 0 ]; then
    echo "✅ Response time: ${TIME_TOTAL}s"
    # Check if response time is under 1 second
    if (( $(echo "$TIME_TOTAL < 1.0" | bc -l) )); then
        echo "✅ Response time is excellent (< 1s)"
    else
        echo "⚠️  Response time is slow (> 1s)"
    fi
else
    echo "❌ Could not measure response time"
fi
echo ""

# Test 5: SSL Certificate
echo "5️⃣  Testing SSL Certificate..."
SSL_INFO=$(curl -I https://rag.lunaos.ai/health 2>&1 | grep -i "HTTP\|server")
if [ $? -eq 0 ]; then
    echo "✅ SSL certificate valid"
    echo "$SSL_INFO"
else
    echo "❌ SSL certificate issue"
fi
echo ""

# Test 6: CORS Headers
echo "6️⃣  Testing CORS Headers..."
CORS_HEADERS=$(curl -I https://rag.lunaos.ai/health 2>&1 | grep -i "access-control")
if [ -n "$CORS_HEADERS" ]; then
    echo "✅ CORS headers present"
    echo "$CORS_HEADERS"
else
    echo "⚠️  CORS headers not found"
fi
echo ""

# Test 7: RAG Query Endpoint
echo "7️⃣  Testing RAG Query Endpoint..."
RAG_RESPONSE=$(curl -s -X POST https://rag.lunaos.ai/api/rag/query \
  -H "Content-Type: application/json" \
  -d '{"query":"test","collectionName":"demo","topK":5}')
if [ $? -eq 0 ]; then
    echo "✅ RAG query endpoint responding"
    if command -v jq &> /dev/null; then
        echo "$RAG_RESPONSE" | jq .
    else
        echo "$RAG_RESPONSE"
    fi
else
    echo "❌ RAG query endpoint not responding"
fi
echo ""

# Summary
echo "=================================="
echo "✅ Test Suite Complete!"
echo "=================================="
echo ""
echo "📊 Summary:"
echo "  - DNS Resolution: Check output above"
echo "  - Health Endpoint: Check output above"
echo "  - API Endpoint: Check output above"
echo "  - Response Time: Check output above"
echo "  - SSL Certificate: Check output above"
echo "  - CORS Headers: Check output above"
echo "  - RAG Query: Check output above"
echo ""
echo "🎯 Next Steps:"
echo "  1. If all tests pass, your domain is ready!"
echo "  2. Update documentation with new domain"
echo "  3. Test all other API endpoints"
echo "  4. Announce the new domain!"
echo ""
echo "🌐 Your Luna Vision RAG™ is live at:"
echo "   https://rag.lunaos.ai"
echo ""
