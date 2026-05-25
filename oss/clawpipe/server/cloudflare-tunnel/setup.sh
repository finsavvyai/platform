#!/bin/bash
# Cloudflare Tunnel Setup Script for FinSavvyAI
set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOMAIN="${CLOUDFLARE_DOMAIN:-llm.finsavvyai.com}"
TUNNEL_NAME="${TUNNEL_NAME:-finsavvyai}"

echo -e "${GREEN}Cloudflare Tunnel Setup for FinSavvyAI${NC}"
echo "========================================"
echo ""

# Check cloudflared is installed
if ! command -v cloudflared &> /dev/null; then
    echo -e "${RED}cloudflared not found. Install it first:${NC}"
    echo "  macOS:  brew install cloudflared"
    echo "  Linux:  curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared && chmod +x /usr/local/bin/cloudflared"
    exit 1
fi

# Step 1: Login
echo -e "${GREEN}Step 1: Authenticate with Cloudflare${NC}"
if ! cloudflared tunnel list &>/dev/null; then
    echo "Opening browser for authentication..."
    cloudflared tunnel login
fi
echo -e "${GREEN}Authenticated.${NC}"
echo ""

# Step 2: Create tunnel
echo -e "${GREEN}Step 2: Create tunnel '${TUNNEL_NAME}'${NC}"
EXISTING=$(cloudflared tunnel list --output json 2>/dev/null | python3 -c "
import json, sys
tunnels = json.load(sys.stdin)
for t in tunnels:
    if t['name'] == '${TUNNEL_NAME}':
        print(t['id'])
        break
" 2>/dev/null || echo "")

if [ -n "$EXISTING" ]; then
    TUNNEL_ID="$EXISTING"
    echo "Tunnel already exists: $TUNNEL_ID"
else
    TUNNEL_ID=$(cloudflared tunnel create "$TUNNEL_NAME" 2>&1 | grep -oP '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}')
    echo "Created tunnel: $TUNNEL_ID"
fi
echo ""

# Step 3: Copy credentials for Docker
echo -e "${GREEN}Step 3: Setting up credentials${NC}"
mkdir -p "$SCRIPT_DIR/credentials"
CRED_SRC="$HOME/.cloudflared/${TUNNEL_ID}.json"
CRED_DST="$SCRIPT_DIR/credentials/${TUNNEL_ID}.json"

if [ -f "$CRED_SRC" ]; then
    cp "$CRED_SRC" "$CRED_DST"
    chmod 600 "$CRED_DST"
    echo "Credentials copied to $CRED_DST"
else
    echo -e "${YELLOW}Credentials file not found at $CRED_SRC${NC}"
    echo "You may need to copy it manually."
fi
echo ""

# Step 4: Update config.yml with tunnel ID
echo -e "${GREEN}Step 4: Updating config.yml${NC}"
sed -i.bak "s/TUNNEL_ID_HERE/$TUNNEL_ID/g" "$SCRIPT_DIR/config.yml"
rm -f "$SCRIPT_DIR/config.yml.bak"
echo "Updated config.yml with tunnel ID: $TUNNEL_ID"
echo ""

# Step 5: Create DNS records
echo -e "${GREEN}Step 5: Creating DNS records${NC}"
for subdomain in gateway master worker monitor; do
    HOSTNAME="${subdomain}.${DOMAIN}"
    echo -n "  $HOSTNAME -> "
    if cloudflared tunnel route dns "$TUNNEL_NAME" "$HOSTNAME" 2>/dev/null; then
        echo -e "${GREEN}created${NC}"
    else
        echo -e "${YELLOW}already exists or failed${NC}"
    fi
done
echo ""

# Summary
echo -e "${GREEN}Setup Complete!${NC}"
echo "========================================"
echo ""
echo "Tunnel ID:    $TUNNEL_ID"
echo "Tunnel Name:  $TUNNEL_NAME"
echo ""
echo "DNS Records:"
echo "  gateway.${DOMAIN}  -> API Gateway (:8080)"
echo "  master.${DOMAIN}   -> Master Server (:8000)"
echo "  worker.${DOMAIN}   -> Worker Node (:8001)"
echo "  monitor.${DOMAIN}  -> Grafana (:3000)"
echo ""
echo "Next steps:"
echo "  1. Start with Docker:"
echo "     docker-compose -f docker-compose.production.yml up -d"
echo ""
echo "  2. Or run standalone:"
echo "     cloudflared tunnel --config $SCRIPT_DIR/config.yml run"
echo ""
echo "  3. Set Cloudflare Worker secrets:"
echo "     cd cloudflare-api"
echo "     wrangler secret put CLUSTER_MASTER_URL  # enter: https://master.${DOMAIN}"
echo "     wrangler secret put GATEWAY_URL          # enter: https://gateway.${DOMAIN}"
echo ""
echo "  4. Deploy Cloudflare Worker:"
echo "     cd cloudflare-api && wrangler deploy"
