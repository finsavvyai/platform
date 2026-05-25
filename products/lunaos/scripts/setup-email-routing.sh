#!/bin/bash
# Setup Cloudflare Email Routing for ALL 41 domains
# Uses Global API Key (required for email routing API)
#
# Usage:
#   CLOUDFLARE_AUTH_EMAIL=your@email.com \
#   CLOUDFLARE_GLOBAL_KEY=xxx \
#   bash setup-email-routing.sh
#
# Get Global API Key: https://dash.cloudflare.com/profile/api-tokens → Global API Key → View

set -euo pipefail

AUTH_EMAIL="${CLOUDFLARE_AUTH_EMAIL:?Set CLOUDFLARE_AUTH_EMAIL (your CF login email)}"
GLOBAL_KEY="${CLOUDFLARE_GLOBAL_KEY:?Set CLOUDFLARE_GLOBAL_KEY (Global API Key from CF profile)}"
DEST_EMAIL="${DEST_EMAIL:-info@finsavvyai.com}"
ACCOUNT_ID="d2fe608a92dc9faa2ce5b0fd2cad5eb7"
API="https://api.cloudflare.com/client/v4"

auth=(-H "X-Auth-Email: $AUTH_EMAIL" -H "X-Auth-Key: $GLOBAL_KEY" -H "Content-Type: application/json")

echo "=== Email Routing Setup (41 domains) ==="
echo "Forwarding: *@domain → $DEST_EMAIL"
echo ""

# Add destination
echo "Adding destination email..."
curl -s -X POST "$API/accounts/$ACCOUNT_ID/email/routing/addresses" "${auth[@]}" \
  -d "{\"email\":\"$DEST_EMAIL\"}" 2>&1 | python3 -c "
import sys,json; d=json.load(sys.stdin)
r=d.get('result',{})
if r: print(f'  ✓ {r.get(\"email\",\"\")} (verified: {r.get(\"verified\",False)})')
else: print(f'  {d.get(\"errors\",[{}])[0].get(\"message\",\"already exists\")}')" 2>/dev/null
echo ""

# Get all zones
ZONES=$(curl -s "$API/zones?per_page=50&account.id=$ACCOUNT_ID" "${auth[@]}")
COUNT=$(echo "$ZONES" | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('result',[])))")
echo "Found $COUNT zones"
echo ""

# Process each zone
echo "$ZONES" | python3 -c "
import sys,json
for z in sorted(json.load(sys.stdin).get('result',[]), key=lambda x: x['name']):
    print(f'{z[\"name\"]} {z[\"id\"]}')
" | while read domain zone_id; do

  # Enable email routing
  enable=$(curl -s -X POST "$API/zones/$zone_id/email/routing/enable" "${auth[@]}" \
    -d '{"enabled":true}' 2>&1 | python3 -c "
import sys,json; d=json.load(sys.stdin)
print('✓' if d.get('success') else d.get('errors',[{}])[0].get('message','?')[:50])" 2>/dev/null)

  # Create catch-all rule
  rule=$(curl -s -X POST "$API/zones/$zone_id/email/routing/rules" "${auth[@]}" \
    -d "{
      \"actions\":[{\"type\":\"forward\",\"value\":[\"$DEST_EMAIL\"]}],
      \"matchers\":[{\"type\":\"all\"}],
      \"enabled\":true,
      \"name\":\"Catch-all to $DEST_EMAIL\",
      \"priority\":0
    }" 2>&1 | python3 -c "
import sys,json; d=json.load(sys.stdin)
print('✓' if d.get('success') else d.get('errors',[{}])[0].get('message','?')[:50])" 2>/dev/null)

  echo "  $domain: enable=$enable catch-all=$rule"
done

echo ""
echo "=== Done ==="
echo "Test: send an email to hello@lunaos.ai — should arrive at $DEST_EMAIL"
