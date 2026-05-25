#!/bin/bash

# Get zone info for tenantiq.app from Cloudflare
# This checks if domain is already in account

set -e

DOMAIN="tenantiq.app"

echo "🔍 Checking if $DOMAIN is in Cloudflare..."
echo ""

# Get API token from user
echo "📝 Need your Cloudflare API token (read access is enough)"
echo "   Get one here: https://dash.cloudflare.com/profile/api-tokens"
echo ""
read -p "Enter your Cloudflare API Token: " CF_API_TOKEN

if [ -z "$CF_API_TOKEN" ]; then
  echo "❌ Error: API token is required"
  exit 1
fi

echo ""
echo "📡 Fetching zone information..."

# Get zone info
ZONE_INFO=$(curl -s -X GET "https://api.cloudflare.com/client/v4/zones?name=$DOMAIN" \
  -H "Authorization: Bearer $CF_API_TOKEN" \
  -H "Content-Type: application/json")

# Check if zone exists
if echo "$ZONE_INFO" | grep -q '"count":0'; then
  echo "❌ Domain NOT found in Cloudflare"
  echo ""
  echo "You need to add it first:"
  echo "   ./scripts/add-domain-to-cloudflare.sh"
  exit 1
fi

if echo "$ZONE_INFO" | grep -q '"success":true'; then
  echo "✅ Domain found in Cloudflare!"
  echo ""

  # Extract zone ID
  ZONE_ID=$(echo "$ZONE_INFO" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
  echo "📋 Zone Information:"
  echo "   Domain: $DOMAIN"
  echo "   Zone ID: $ZONE_ID"

  # Extract and show nameservers
  echo ""
  echo "📡 Nameservers:"
  echo "$ZONE_INFO" | grep -o '"name_servers":\[[^]]*\]' | sed 's/"name_servers":\[//;s/\]//;s/"//g' | tr ',' '\n' | while read ns; do
    [ -n "$ns" ] && echo "   - $ns"
  done

  # Check status
  STATUS=$(echo "$ZONE_INFO" | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)
  echo ""
  echo "📊 Status: $STATUS"

  if [ "$STATUS" = "active" ]; then
    echo "   ✅ Domain is active and ready!"
  elif [ "$STATUS" = "pending" ]; then
    echo "   ⏳ Domain is pending nameserver update"
    echo "   Update nameservers at Name.com to activate"
  fi

  # Save zone ID for later use
  echo "$ZONE_ID" > /tmp/tenantiq-zone-id
  echo ""
  echo "💾 Zone ID saved to /tmp/tenantiq-zone-id"

  # Check current DNS setup
  echo ""
  echo "🔍 Checking current DNS setup..."
  CURRENT_NS=$(dig NS $DOMAIN +short 2>/dev/null | head -2)
  if [ -n "$CURRENT_NS" ]; then
    echo "   Current nameservers:"
    echo "$CURRENT_NS" | while read ns; do
      echo "   - $ns"
    done

    if echo "$CURRENT_NS" | grep -q "cloudflare.com"; then
      echo ""
      echo "   ✅ Nameservers are pointing to Cloudflare!"
      echo ""
      echo "🚀 Ready to add custom domains!"
      echo "   Run: ./scripts/add-custom-domains-wrangler.sh"
    else
      echo ""
      echo "   ⚠️  Nameservers NOT pointing to Cloudflare yet"
      echo "   Update at: https://www.name.com/account/domain"
    fi
  fi

else
  echo "❌ Error fetching zone info"
  echo ""
  echo "Response: $ZONE_INFO"
fi
