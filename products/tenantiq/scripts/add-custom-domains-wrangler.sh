#!/bin/bash

# Add custom domains to Worker and Pages
# Assumes tenantiq.app is already in Cloudflare

set -e

ACCOUNT_ID="d2fe608a92dc9faa2ce5b0fd2cad5eb7"
WORKER_NAME="tenantiq-api"
PAGES_PROJECT="tenantiq-app"
API_DOMAIN="api.tenantiq.app"
APP_DOMAIN="app.tenantiq.app"

echo "🚀 Adding custom domains to TenantIQ..."
echo ""

# Get API token
echo "📝 Need your Cloudflare API token"
echo "   Get one here: https://dash.cloudflare.com/profile/api-tokens"
echo ""
read -p "Enter your Cloudflare API Token: " CF_API_TOKEN

if [ -z "$CF_API_TOKEN" ]; then
  echo "❌ Error: API token is required"
  exit 1
fi

# Check if zone exists
echo ""
echo "🔍 Step 1: Checking zone status..."
ZONE_INFO=$(curl -s -X GET "https://api.cloudflare.com/client/v4/zones?name=tenantiq.app" \
  -H "Authorization: Bearer $CF_API_TOKEN" \
  -H "Content-Type: application/json")

ZONE_ID=$(echo "$ZONE_INFO" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -z "$ZONE_ID" ]; then
  echo "❌ Error: tenantiq.app not found in Cloudflare"
  echo ""
  echo "Add it first with:"
  echo "   ./scripts/add-domain-to-cloudflare.sh"
  exit 1
fi

echo "✅ Zone found: $ZONE_ID"

# Add custom domain to Worker (api.tenantiq.app)
echo ""
echo "🔧 Step 2: Adding custom domain to Worker ($API_DOMAIN)..."

WORKER_DOMAIN_RESPONSE=$(curl -s -X PUT "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/workers/domains" \
  -H "Authorization: Bearer $CF_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data "{
    \"environment\": \"production\",
    \"hostname\": \"$API_DOMAIN\",
    \"service\": \"$WORKER_NAME\",
    \"zone_id\": \"$ZONE_ID\"
  }")

if echo "$WORKER_DOMAIN_RESPONSE" | grep -q '"success":true'; then
  echo "✅ Worker custom domain added: $API_DOMAIN"
elif echo "$WORKER_DOMAIN_RESPONSE" | grep -q '"code":100'; then
  echo "✅ Worker custom domain already exists: $API_DOMAIN"
else
  echo "⚠️  Worker domain response:"
  echo "$WORKER_DOMAIN_RESPONSE" | jq '.' 2>/dev/null || echo "$WORKER_DOMAIN_RESPONSE"
fi

# Add custom domain to Pages (app.tenantiq.app)
echo ""
echo "🔧 Step 3: Adding custom domain to Pages ($APP_DOMAIN)..."

PAGES_DOMAIN_RESPONSE=$(curl -s -X POST "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/pages/projects/$PAGES_PROJECT/domains" \
  -H "Authorization: Bearer $CF_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data "{
    \"name\": \"$APP_DOMAIN\"
  }")

if echo "$PAGES_DOMAIN_RESPONSE" | grep -q '"success":true'; then
  echo "✅ Pages custom domain added: $APP_DOMAIN"
elif echo "$PAGES_DOMAIN_RESPONSE" | grep -q '"code":8000013'; then
  echo "✅ Pages custom domain already exists: $APP_DOMAIN"
else
  echo "⚠️  Pages domain response:"
  echo "$PAGES_DOMAIN_RESPONSE" | jq '.' 2>/dev/null || echo "$PAGES_DOMAIN_RESPONSE"
fi

# Check DNS records
echo ""
echo "🔍 Step 4: Checking DNS records..."

# Check if API DNS record exists
API_DNS=$(curl -s -X GET "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records?name=$API_DOMAIN" \
  -H "Authorization: Bearer $CF_API_TOKEN" \
  -H "Content-Type: application/json")

if echo "$API_DNS" | grep -q '"count":0'; then
  echo "📝 Creating DNS record for $API_DOMAIN..."
  CREATE_API_DNS=$(curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" \
    -H "Authorization: Bearer $CF_API_TOKEN" \
    -H "Content-Type: application/json" \
    --data "{
      \"type\": \"CNAME\",
      \"name\": \"api\",
      \"content\": \"$WORKER_NAME.broad-dew-49ad.workers.dev\",
      \"ttl\": 1,
      \"proxied\": true
    }")

  if echo "$CREATE_API_DNS" | grep -q '"success":true'; then
    echo "✅ DNS record created for $API_DOMAIN"
  fi
else
  echo "✅ DNS record exists for $API_DOMAIN"
fi

# Check if APP DNS record exists
APP_DNS=$(curl -s -X GET "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records?name=$APP_DOMAIN" \
  -H "Authorization: Bearer $CF_API_TOKEN" \
  -H "Content-Type: application/json")

if echo "$APP_DNS" | grep -q '"count":0'; then
  echo "📝 Creating DNS record for $APP_DOMAIN..."
  CREATE_APP_DNS=$(curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" \
    -H "Authorization: Bearer $CF_API_TOKEN" \
    -H "Content-Type: application/json" \
    --data "{
      \"type\": \"CNAME\",
      \"name\": \"app\",
      \"content\": \"$PAGES_PROJECT.pages.dev\",
      \"ttl\": 1,
      \"proxied\": true
    }")

  if echo "$CREATE_APP_DNS" | grep -q '"success":true'; then
    echo "✅ DNS record created for $APP_DOMAIN"
  fi
else
  echo "✅ DNS record exists for $APP_DOMAIN"
fi

# Summary
echo ""
echo "🎉 Custom domain setup complete!"
echo ""
echo "📋 Your domains:"
echo "   API:  https://$API_DOMAIN"
echo "   Web:  https://$APP_DOMAIN"
echo ""
echo "⏳ Wait 1-2 minutes for SSL provisioning, then test:"
echo ""
echo "   curl https://$API_DOMAIN/health"
echo "   curl -I https://$APP_DOMAIN"
echo ""
echo "🔍 Check status in dashboard:"
echo "   Worker:  https://dash.cloudflare.com/$ACCOUNT_ID/workers/services/view/$WORKER_NAME"
echo "   Pages:   https://dash.cloudflare.com/$ACCOUNT_ID/pages/view/$PAGES_PROJECT"
