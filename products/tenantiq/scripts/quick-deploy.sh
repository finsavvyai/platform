#!/bin/bash

# Quick deployment script - sets remaining secrets and deploys

set -e

cd /Users/shaharsolomon/dev/projects/tenantiq/apps/api

echo "🚀 TenantIQ Quick Deploy"
echo "========================"
echo ""

# Check existing secrets
echo "📋 Current secrets:"
wrangler secret list
echo ""

# Generate and set JWT secret automatically
echo "🔑 Generating JWT secret..."
JWT_SECRET=$(openssl rand -base64 32)
echo "Generated: $JWT_SECRET"
echo "$JWT_SECRET" | wrangler secret put JWT_SECRET
echo "✅ JWT_SECRET set"
echo ""

echo "📝 You still need to set Azure secrets:"
echo "   wrangler secret put AZURE_CLIENT_SECRET"
echo "   wrangler secret put AZURE_TENANT_ID"
echo ""
echo "Or deploy now without Azure (will work for non-OAuth features):"
read -p "Deploy now? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo ""
  echo "🚀 Deploying to production..."
  wrangler deploy

  echo ""
  echo "✅ Deployed!"
  echo ""
  echo "Test: curl https://api.tenantiq.app/health"
  echo ""
fi
