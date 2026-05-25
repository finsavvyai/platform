#!/bin/bash

# UPM.Plus Deployment Test Script
# Run this after fixing your Cloudflare API token

echo "🚀 Testing UPM.Plus Deployment After Token Fix"
echo "=========================================="

# Test 1: Verify authentication
echo ""
echo "1️⃣ Testing authentication..."
wrangler whoami
if [ $? -eq 0 ]; then
    echo "✅ Authentication successful"
else
    echo "❌ Authentication failed - fix your API token first"
    exit 1
fi

# Test 2: Test database connection
echo ""
echo "2️⃣ Testing D1 database connection..."
wrangler d1 execute upm-plus-production-db --remote --command "SELECT COUNT(*) as table_count FROM sqlite_master WHERE type='table'"

# Test 3: Test basic deployment
echo ""
echo "3️⃣ Testing worker deployment..."
wrangler deploy --env production

# Test 4: Test queue creation (optional)
echo ""
echo "4️⃣ Testing queue creation..."
wrangler queues create upm-plus-queue

# Test 5: Test production API
echo ""
echo "5️⃣ Testing production API..."
curl -s https://upm.plus/api/health | head -5

# Test 6: Test analytics API
echo ""
echo "6️⃣ Testing analytics API..."
curl -s https://upm.plus/api/v1/analytics/metrics/recent | head -5

echo ""
echo "🎉 Deployment test completed!"
echo "If all tests passed, your UPM.Plus is live on upm.plus"