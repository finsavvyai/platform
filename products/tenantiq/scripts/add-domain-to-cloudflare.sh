#!/bin/bash

# Add domain to Cloudflare account using API
# This replaces the manual dashboard step

set -e

ACCOUNT_ID="d2fe608a92dc9faa2ce5b0fd2cad5eb7"
DOMAIN="tenantiq.app"

echo "🚀 Adding $DOMAIN to Cloudflare account..."
echo ""

# Get API token from user
echo "📝 You need a Cloudflare API token with 'Zone Edit' permissions"
echo "   Get one here: https://dash.cloudflare.com/profile/api-tokens"
echo "   → Create Token → Edit zone DNS → Use template"
echo ""
read -p "Enter your Cloudflare API Token: " CF_API_TOKEN

if [ -z "$CF_API_TOKEN" ]; then
  echo "❌ Error: API token is required"
  exit 1
fi

echo ""
echo "📡 Adding zone to Cloudflare..."

# Add zone to Cloudflare
ZONE_RESPONSE=$(curl -s -X POST "https://api.cloudflare.com/client/v4/zones" \
  -H "Authorization: Bearer $CF_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data "{
    \"name\": \"$DOMAIN\",
    \"account\": {
      \"id\": \"$ACCOUNT_ID\"
    },
    \"jump_start\": true,
    \"type\": \"full\"
  }")

# Check if successful
if echo "$ZONE_RESPONSE" | grep -q '"success":true'; then
  echo "✅ Domain added successfully!"

  # Extract zone ID
  ZONE_ID=$(echo "$ZONE_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
  echo "   Zone ID: $ZONE_ID"

  # Extract nameservers
  echo ""
  echo "📋 Cloudflare Nameservers:"
  echo "$ZONE_RESPONSE" | grep -o '"name_servers":\[[^]]*\]' | grep -o '"[^"]*\.ns\.cloudflare\.com"' | tr -d '"' | while read ns; do
    echo "   - $ns"
  done

  echo ""
  echo "🎯 Next Steps:"
  echo "1. Update nameservers at Name.com to the ones above"
  echo "   → https://www.name.com/account/domain"
  echo ""
  echo "2. Wait for DNS propagation (5-30 minutes)"
  echo "   Check with: dig NS $DOMAIN +short"
  echo ""
  echo "3. Add custom domains to Workers/Pages:"
  echo "   ./scripts/setup-custom-domains.sh"
  echo ""

  # Save zone ID for later use
  echo "$ZONE_ID" > /tmp/tenantiq-zone-id
  echo "💾 Zone ID saved to /tmp/tenantiq-zone-id"

elif echo "$ZONE_RESPONSE" | grep -q '"code":1061'; then
  echo "⚠️  Domain already exists in Cloudflare!"
  echo ""
  echo "Getting zone information..."

  # Get existing zone info
  ZONE_INFO=$(curl -s -X GET "https://api.cloudflare.com/client/v4/zones?name=$DOMAIN" \
    -H "Authorization: Bearer $CF_API_TOKEN" \
    -H "Content-Type: application/json")

  ZONE_ID=$(echo "$ZONE_INFO" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

  if [ -n "$ZONE_ID" ]; then
    echo "✅ Found existing zone!"
    echo "   Zone ID: $ZONE_ID"

    # Get nameservers
    echo ""
    echo "📋 Your Cloudflare Nameservers:"
    echo "$ZONE_INFO" | grep -o '"name_servers":\[[^]]*\]' | grep -o '"[^"]*\.ns\.cloudflare\.com"' | tr -d '"' | while read ns; do
      echo "   - $ns"
    done

    echo ""
    echo "🎯 Make sure these nameservers are set at Name.com"
    echo "   → https://www.name.com/account/domain"
    echo ""

    # Save zone ID for later use
    echo "$ZONE_ID" > /tmp/tenantiq-zone-id
    echo "💾 Zone ID saved to /tmp/tenantiq-zone-id"

    echo ""
    echo "You can proceed to add custom domains:"
    echo "   ./scripts/setup-custom-domains.sh"
  else
    echo "❌ Could not retrieve zone information"
    echo "Response: $ZONE_INFO"
  fi

else
  echo "❌ Error adding domain"
  echo ""
  echo "Response: $ZONE_RESPONSE"
  echo ""

  # Check for common errors
  if echo "$ZONE_RESPONSE" | grep -q '"code":1003'; then
    echo "💡 Error: Invalid API token"
    echo "   Make sure your token has 'Zone Edit' permissions"
  elif echo "$ZONE_RESPONSE" | grep -q '"code":9103'; then
    echo "💡 Error: Domain is already registered with another Cloudflare account"
    echo "   You may need to transfer it first"
  fi

  exit 1
fi
