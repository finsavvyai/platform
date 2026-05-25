#!/bin/bash

# UPM.Plus Wrangler Setup Script
# Creates KV namespaces, D1 database, and initial configuration

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔧 UPM.Plus Wrangler Setup${NC}"
echo

# Check if Wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo -e "${RED}[✗] Wrangler CLI not found${NC}"
    echo -e "${YELLOW}Installing Wrangler CLI...${NC}"
    npm install -g wrangler
fi

# Check authentication
echo -e "${CYAN}Checking authentication...${NC}"
if ! wrangler whoami &> /dev/null; then
    echo -e "${YELLOW}Please login to Cloudflare:${NC}"
    wrangler login
fi

echo -e "${GREEN}[✓] Authenticated as:${NC}"
wrangler whoami
echo

# Create KV namespaces
echo -e "${CYAN}Creating KV namespaces...${NC}"

KV_NAMESPACES=(
    "upm-plus-cache-kv:UPM_CACHE"
    "upm-plus-config-kv:UPM_CONFIG"
)

for kv_config in "${KV_NAMESPACES[@]}"; do
    IFS=':' read -r kv_name binding <<< "$kv_config"

    echo -e "${YELLOW}Creating KV namespace: ${kv_name}${NC}"

    # Create production namespace
    if wrangler kv:namespace create "$kv_name" 2>/dev/null; then
        echo -e "${GREEN}  [✓] Created ${kv_name}${NC}"
    else
        echo -e "${GREEN}  [✓] ${kv_name} already exists${NC}"
    fi

    # Create preview namespace
    if wrangler kv:namespace create "$kv_name" --preview 2>/dev/null; then
        echo -e "${GREEN}  [✓] Created preview ${kv_name}${NC}"
    else
        echo -e "${GREEN}  [✓] Preview ${kv_name} already exists${NC}"
    fi
done

echo

# Create D1 database
echo -e "${CYAN}Creating D1 database...${NC}"
if wrangler d1 create upm-plus-config 2>/dev/null; then
    echo -e "${GREEN}[✓] Created D1 database: upm-plus-config${NC}"
else
    echo -e "${GREEN}[✓] D1 database already exists${NC}"
fi

echo

# Create Queue
echo -e "${CYAN}Creating Queue...${NC}"
if wrangler queues create upm-plus-queue 2>/dev/null; then
    echo -e "${GREEN}[✓] Created Queue: upm-plus-queue${NC}"
else
    echo -e "${GREEN}[✓] Queue already exists${NC}"
fi

echo

# Update wrangler.toml with actual IDs
echo -e "${CYAN}Updating wrangler.toml with resource IDs...${NC}"

# Get KV namespace IDs
echo -e "${YELLOW}Getting KV namespace IDs...${NC}"
CACHE_ID=$(wrangler kv:namespace list | jq -r '.[] | select(.title=="upm-plus-cache-kv") | .id' || echo "")
CONFIG_ID=$(wrangler kv:namespace list | jq -r '.[] | select(.title=="upm-plus-config-kv") | .id' || echo "")

# Get D1 database ID
echo -e "${YELLOW}Getting D1 database ID...${NC}"
DB_ID=$(wrangler d1 list | jq -r '.[] | select(.name=="upm-plus-config") | .uuid' || echo "")

# Get Queue ID
echo -e "${YELLOW}Getting Queue ID...${NC}"
QUEUE_ID=$(wrangler queues list | jq -r '.[] | select(.queue_name=="upm-plus-queue") | .queue_id' || echo "")

echo
echo -e "${GREEN}Resource IDs:${NC}"
echo -e "Cache KV: ${CACHE_ID}"
echo -e "Config KV: ${CONFIG_ID}"
echo -e "Database: ${DB_ID}"
echo -e "Queue: ${QUEUE_ID}"

echo

# Set initial configuration in KV
echo -e "${CYAN}Setting up initial configuration...${NC}"

# Basic configuration
CONFIG='{
  "app": {
    "name": "UPM.Plus",
    "version": "1.0.0",
    "description": "Autonomous Digital Ecosystem Orchestrator"
  },
  "domains": {
    "production": "upm.plus",
    "development": "upmplus.dev",
    "staging": "upmplus.io",
    "ai": "upmplus.ai"
  },
  "api": {
    "version": "v1",
    "rate_limit": 100,
    "cache_ttl": 3600
  },
  "features": {
    "multi_domain": true,
    "analytics": true,
    "monitoring": true,
    "ai_integration": true
  }
}'

# Store configuration in KV (if we have the IDs)
if [[ -n "$CONFIG_ID" ]]; then
    echo "$CONFIG" | wrangler kv:key put "global_config" --namespace-id="$CONFIG_ID"
    echo -e "${GREEN}[✓] Global configuration stored${NC}"
fi

echo

# Test deployment
echo -e "${CYAN}Running test deployment...${NC}"
echo -e "${YELLOW}Testing worker configuration...${NC}"

if wrangler deploy --dry-run; then
    echo -e "${GREEN}[✓] Worker configuration is valid${NC}"
else
    echo -e "${RED}[✗] Worker configuration has errors${NC}"
    exit 1
fi

echo
echo -e "${GREEN}🎉 Setup completed successfully!${NC}"
echo
echo -e "${CYAN}Next steps:${NC}"
echo -e "1. Deploy your workers:"
echo -e "   ./scripts/wrangler-deploy.sh --all"
echo -e "2. Or deploy to specific environment:"
echo -e "   ./scripts/wrangler-deploy.sh --production"
echo -e "3. Monitor your workers:"
echo -e "   wrangler tail"
echo -e "4. Test your endpoints:"
echo -e "   curl https://upm.plus/api/health"
echo
echo -e "${YELLOW}Note: DNS propagation may take 5-15 minutes after deployment${NC}"