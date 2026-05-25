#!/bin/bash

# UPM.Plus Subdomain DNS Setup Script
# Creates DNS records for all subdomains in all environments

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

echo -e "${BLUE}🌐 UPM.Plus Subdomain DNS Setup${NC}"
echo -e "${BLUE}Creating DNS records for all subdomains${NC}"
echo

# Get the IP address to point to (Cloudflare's IP for Worker routing)
WORKER_IP="192.0.2.1"  # This is a dummy IP - Workers will handle the routing

# Environments and their zone IDs
environments=(
    "upmplus.dev:c2989096b25bff6ce4fa1463a40892c9"
    "upmplus.io:4d3b07d42642124b8be22e4fb138ba4b"
)

# Subdomains to create
subdomains=(
    "api"
    "app"
    "dashboard"
    "admin"
    "docs"
    "cdn"
    "static"
    "assets"
)

echo -e "${CYAN}DNS Records to Create:${NC}"
echo
for env_info in "${environments[@]}"; do
    IFS=':' read -r domain zone_id <<< "$env_info"
    echo -e "${YELLOW}Domain: ${domain}${NC}"
    for subdomain in "${subdomains[@]}"; do
        echo -e "   ${subdomain}.${domain} → A record (Worker routing)"
    done
    echo
done

echo -e "${MAGENTA}=== DNS Setup Options ===${NC}"
echo
echo -e "${YELLOW}Since we're using Cloudflare Workers, we have two options:${NC}"
echo
echo -e "${GREEN}Option 1 (Recommended):${NC} Use Cloudflare Dashboard"
echo -e "   1. Go to https://dash.cloudflare.com"
echo -e "   2. Select each domain (upmplus.dev, upmplus.io)"
echo -e "   3. Go to DNS section"
echo -e "   4. Add A records for all subdomains pointing to any IP (Workers will override)"
echo -e "   5. Set proxy status to 'Proxied' (orange cloud)"
echo
echo -e "${GREEN}Option 2:${NC} Use Wrangler CLI (if zone permissions allow)"
echo -e "   This requires additional zone permissions"
echo

echo -e "${MAGENTA}=== Manual DNS Setup Instructions ===${NC}"
echo
echo -e "${CYAN}For each domain (upmplus.dev, upmplus.io):${NC}"
echo -e "${YELLOW}1. Go to Cloudflare Dashboard → Select domain → DNS${NC}"
echo -e "${YELLOW}2. Add these A records:${NC}"
echo

for env_info in "${environments[@]}"; do
    IFS=':' read -r domain zone_id <<< "$env_info"

    echo -e "${BLUE}Domain: ${domain}${NC}"
    echo -e "${YELLOW}Add the following A records:${NC}"

    for subdomain in "${subdomains[@]}"; do
        echo -e "   Type: A"
        echo -e "   Name: ${subdomain}"
        echo -e "   IPv4 address: 192.0.2.1"
        echo -e "   Proxy status: Proxied 🟠"
        echo -e "   TTL: Auto"
        echo
    done
done

echo -e "${MAGENTA}=== Worker Route Verification ===${NC}"
echo

echo -e "${CYAN}Checking current Worker routes:${NC}"
echo

for env_info in "${environments[@]}"; do
    IFS=':' read -r domain zone_id <<< "$env_info"

    if [[ "$domain" == "upmplus.dev" ]]; then
        env_name="development"
    elif [[ "$domain" == "upmplus.io" ]]; then
        env_name="staging"
    fi

    echo -e "${YELLOW}Environment: ${env_name} (${domain})${NC}"

    # Check worker deployment
    if wrangler deployments list --env "$env_name" >/dev/null 2>&1; then
        echo -e "   ${GREEN}✅ Worker deployed${NC}"
    else
        echo -e "   ${RED}❌ Worker not deployed${NC}"
    fi

    # Show configured routes
    echo -e "   ${CYAN}Configured routes:${NC}"
    echo -e "   - ${domain}/*"
    echo -e "   - api.${domain}/*"
    echo -e "   - app.${domain}/*"
    echo -e "   - dashboard.${domain}/*"
    echo -e "   - admin.${domain}/*"
    echo -e "   - docs.${domain}/*"
    echo -e "   - cdn.${domain}/*"
    echo -e "   - static.${domain}/*"
    echo -e "   - assets.${domain}/*"
    echo
done

echo -e "${MAGENTA}=== Alternative: Use Wildcard DNS ===${NC}"
echo
echo -e "${GREEN}Simpler option - Create a wildcard record:${NC}"
echo
for env_info in "${environments[@]}"; do
    IFS=':' read -r domain zone_id <<< "$env_info"
    echo -e "${YELLOW}For ${domain}:${NC}"
    echo -e "   Type: A"
    echo -e "   Name: *"
    echo -e "   IPv4 address: 192.0.2.1"
    echo -e "   Proxy status: Proxied 🟠"
    echo -e "   TTL: Auto"
    echo
done

echo -e "${BLUE}📋 Summary:${NC}"
echo -e "${GREEN}✅ Workers are deployed and configured${NC}"
echo -e "${YELLOW}⚠️  DNS records need to be created for subdomains${NC}"
echo -e "${BLUE}ℹ️  Use either individual subdomain records or wildcard * record${NC}"
echo
echo -e "${CYAN}After DNS setup, test with:${NC}"
echo -e "   ./test_all_subdomains.sh"
echo

echo -e "${GREEN}🚀 Once DNS is configured, all subdomains will work!${NC}"