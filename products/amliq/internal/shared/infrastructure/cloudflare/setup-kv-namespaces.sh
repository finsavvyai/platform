#!/bin/bash

# Cloudflare KV Namespace Setup Script
# This script provisions KV namespaces for caching, sessions, and agent memory

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# KV Namespace configuration
KV_NAMESPACES=(
    "CACHE_KV:Application caching and performance optimization"
    "SESSIONS_KV:User session management and authentication tokens"
    "AGENT_MEMORY_KV:AI agent memory and context storage"
    "RATE_LIMITS_KV:API rate limiting and quota management"
    "USER_PREFERENCES_KV:User preferences and settings storage"
    "ORGANIZATION_CONFIG_KV:Organization configuration and settings"
)

echo -e "${BLUE}🗄️  Setting up Cloudflare KV namespaces for FinTech Suite...${NC}"

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo -e "${RED}❌ Wrangler CLI not found. Please install it with: npm install -g wrangler${NC}"
    exit 1
fi

# Function to create KV namespace if it doesn't exist
create_kv_namespace() {
    local namespace_binding="$1"
    local namespace_description="$2"

    echo -e "${YELLOW}🗄️  Creating KV namespace: ${namespace_binding}${NC}"

    # Create the namespace
    wrangler kv:namespace create "${namespace_binding}" || {
        echo -e "${RED}❌ Failed to create KV namespace ${namespace_binding}${NC}"
        return 1
    }

    echo -e "${GREEN}✅ Successfully created KV namespace: ${namespace_binding}${NC}"
    echo -e "   ${namespace_description}"
    echo ""
}

# Create all KV namespaces
for kv_info in "${KV_NAMESPACES[@]}"; do
    IFS=':' read -r namespace_binding namespace_description <<< "$kv_info"
    create_kv_namespace "$namespace_binding" "$namespace_description"
done

# Create preview environments for development
echo -e "${BLUE}🔄 Creating preview environments for development...${NC}"
for kv_info in "${KV_NAMESPACES[@]}"; do
    IFS=':' read -r namespace_binding namespace_description <<< "$kv_info"
    echo -e "${YELLOW}🗄️  Creating preview namespace: ${namespace_binding}${NC}"
    wrangler kv:namespace create "${namespace_binding}" --preview || {
        echo -e "${RED}❌ Failed to create preview KV namespace ${namespace_binding}${NC}"
    }
done

# List all KV namespaces after creation
echo -e "${BLUE}📋 Current KV namespaces:${NC}"
wrangler kv:namespace list

echo -e "${GREEN}🎉 KV namespace setup completed!${NC}"
echo -e "${YELLOW}📝 Note: Update your wrangler.toml with the correct namespace IDs returned by the creation commands.${NC}"
