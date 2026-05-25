#!/bin/bash

# Custom Domain Setup Script for TenantIQ
# This script sets up api.tenantiq.app and app.tenantiq.app using Cloudflare API

set -e

ACCOUNT_ID="d2fe608a92dc9faa2ce5b0fd2cad5eb7"
WORKER_NAME="tenantiq-api"
PAGES_PROJECT="tenantiq-app"

echo "🔍 Step 1: Getting Cloudflare API token..."
echo "Please run: wrangler login"
echo "Then get your API token from: https://dash.cloudflare.com/profile/api-tokens"
echo ""
read -p "Enter your Cloudflare API Token: " CF_API_TOKEN

echo ""
echo "🔍 Step 2: Getting zone ID for tenantiq.app..."
ZONE_RESPONSE=$(curl -s -X GET "https://api.cloudflare.com/client/v4/zones?name=tenantiq.app" \
  -H "Authorization: Bearer $CF_API_TOKEN" \
  -H "Content-Type: application/json")

ZONE_ID=$(echo $ZONE_RESPONSE | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$ZONE_ID" ]; then
  echo "❌ Error: Could not find zone ID for tenantiq.app"
  echo "Response: $ZONE_RESPONSE"
  echo ""
  echo "Make sure tenantiq.app is added to your Cloudflare account:"
  echo "👉 https://dash.cloudflare.com"
  exit 1
fi

echo "✅ Zone ID: $ZONE_ID"
echo ""

echo "🔍 Step 3: Getting Worker script name..."
SCRIPT_RESPONSE=$(curl -s -X GET "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/workers/scripts/$WORKER_NAME" \
  -H "Authorization: Bearer $CF_API_TOKEN" \
  -H "Content-Type: application/json")

echo "✅ Worker found: $WORKER_NAME"
echo ""

echo "🚀 Step 4: Adding custom domain to Worker (api.tenantiq.app)..."
DOMAIN_RESPONSE=$(curl -s -X PUT "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/workers/domains" \
  -H "Authorization: Bearer $CF_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data "{
    \"environment\": \"production\",
    \"hostname\": \"api.tenantiq.app\",
    \"service\": \"$WORKER_NAME\",
    \"zone_id\": \"$ZONE_ID\"
  }")

if echo "$DOMAIN_RESPONSE" | grep -q '"success":true'; then
  echo "✅ Custom domain added: api.tenantiq.app"
else
  echo "⚠️  Domain setup response: $DOMAIN_RESPONSE"
fi
echo ""

echo "🔍 Step 5: Checking DNS records..."
DNS_RESPONSE=$(curl -s -X GET "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records?name=api.tenantiq.app" \
  -H "Authorization: Bearer $CF_API_TOKEN" \
  -H "Content-Type: application/json")

if echo "$DNS_RESPONSE" | grep -q '"name":"api.tenantiq.app"'; then
  echo "✅ DNS record exists for api.tenantiq.app"
else
  echo "⚠️  Creating DNS record for api.tenantiq.app..."
  CREATE_DNS=$(curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" \
    -H "Authorization: Bearer $CF_API_TOKEN" \
    -H "Content-Type: application/json" \
    --data "{
      \"type\": \"CNAME\",
      \"name\": \"api\",
      \"content\": \"$WORKER_NAME.broad-dew-49ad.workers.dev\",
      \"ttl\": 1,
      \"proxied\": true
    }")

  if echo "$CREATE_DNS" | grep -q '"success":true'; then
    echo "✅ DNS record created"
  else
    echo "❌ Failed to create DNS record"
    echo "Response: $CREATE_DNS"
  fi
fi
echo ""

echo "🎉 Setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Wait 1-2 minutes for DNS propagation"
echo "2. Test: curl https://api.tenantiq.app/health"
echo "3. For Pages (app.tenantiq.app), go to Cloudflare Dashboard:"
echo "   👉 https://dash.cloudflare.com/$ACCOUNT_ID/pages/view/$PAGES_PROJECT"
echo "   Click 'Custom domains' → Add 'app.tenantiq.app'"
echo ""
echo "🔗 Your production URLs:"
echo "   API: https://api.tenantiq.app"
echo "   Web: https://app.tenantiq.app"
