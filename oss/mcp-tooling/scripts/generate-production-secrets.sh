#!/bin/bash

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SECRETS_DIR="${PROJECT_ROOT}/secrets"
ENV_FILE="${PROJECT_ROOT}/.env.production"
TEMPLATE_FILE="${PROJECT_ROOT}/.env.template"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}🔒 MCPOverflow Production Secrets Generator${NC}"
echo "This script will generate secure random secrets for your production environment."
echo ""

# Ensure openssl is installed
if ! command -v openssl &> /dev/null; then
    echo -e "${RED}Error: openssl is required but not installed.${NC}"
    exit 1
fi

generate_secret() {
    # Use hex encoding for URL-safe secrets (no / or = characters)
    openssl rand -hex 32
}

generate_api_key() {
    echo "sk_$(openssl rand -hex 24)"
}

# Create secrets directory
mkdir -p "${SECRETS_DIR}"

# Check for existing production env
if [ -f "${ENV_FILE}" ]; then
    echo -e "${YELLOW}Warning: ${ENV_FILE} already exists.${NC}"
    read -p "Do you want to overwrite it? (y/N) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborted."
        exit 0
    fi
    # Backup existing file
    cp "${ENV_FILE}" "${ENV_FILE}.bak.$(date +%Y%m%d_%H%M%S)"
    echo "Backed up existing file."
fi

echo "Generating secrets..."

# Core Secrets
JWT_SECRET=$(generate_secret)
DB_PASSWORD=$(generate_secret)
REDIS_PASSWORD=$(generate_secret)
SUPABASE_ANON_KEY=$(generate_secret) # In reality, this comes from Supabase dash
SUPABASE_SERVICE_KEY=$(generate_secret) # In reality, this comes from Supabase dash
AGENTKIT_API_KEY=$(generate_api_key)

# Placeholder func for things we can't auto-generate
ask_secret() {
    local key=$1
    local desc=$2
    local current=""
    
    # Try to grab from current env if exists
    if [ -f "${ENV_FILE}" ]; then
        current=$(grep "^${key}=" "${ENV_FILE}" | cut -d'=' -f2-)
    fi
    
    if [ -z "$current" ]; then
        echo -e "${YELLOW}Enter ${desc} for ${key} (leave empty for placeholder):${NC}" >&2
        read -r input
        if [ -n "$input" ]; then
            echo "$input"
        else
            echo "CHANGE_ME_IN_PRODUCTION"
        fi
    else
        echo "$current"
    fi
}

echo "Collecting external service credentials..."
CLOUDFLARE_API_TOKEN=$(ask_secret "CLOUDFLARE_API_TOKEN" "Cloudflare API Token")
CLOUDFLARE_ACCOUNT_ID=$(ask_secret "CLOUDFLARE_ACCOUNT_ID" "Cloudflare Account ID")

# Write to .env.production
cat > "${ENV_FILE}" << EOF
# Production Environment Configuration
# Generated on $(date)
ENVIRONMENT=production

# Database
DB_HOST=postgres
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=${DB_PASSWORD}
DB_NAME=mcpoverflow
DB_SSL_MODE=require

# External Services
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
SUPABASE_SERVICE_KEY=${SUPABASE_SERVICE_KEY}

# Redis
REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379

# Auth & Security
JWT_SECRET=${JWT_SECRET}
JWT_ACCESS_TOKEN_EXPIRY=900
JWT_REFRESH_TOKEN_EXPIRY=604800

# AgentKit
AGENTKIT_API_KEY=${AGENTKIT_API_KEY}
AGENTKIT_BASE_URL=https://api.openai.com/v1/agentkit

# Deployment
CLOUDFLARE_API_TOKEN=${CLOUDFLARE_API_TOKEN}
CLOUDFLARE_ACCOUNT_ID=${CLOUDFLARE_ACCOUNT_ID}

# Domain Configuration
DOMAIN_MARKETING_URL=https://mcpoverflow.com
DOMAIN_DEVELOPER_URL=https://app.mcpoverflow.io
DOMAIN_AI_URL=https://mcpoverflow.ai
DOMAIN_DOCS_URL=https://mcpoverflow.dev
EOF

# Also generate Docker Secrets files if requested
read -p "Do you want to generate local Docker secret files (for swarm/compose)? (y/N) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "${DB_PASSWORD}" > "${SECRETS_DIR}/db_password.txt"
    echo "${JWT_SECRET}" > "${SECRETS_DIR}/jwt_secret.txt"
    echo "${REDIS_PASSWORD}" > "${SECRETS_DIR}/redis_password.txt"
    echo "Secrets written to ${SECRETS_DIR}/"
fi

chmod 600 "${ENV_FILE}"
echo -e "${GREEN}✅ Production configuration generated at ${ENV_FILE}${NC}"
echo "Make sure to securely transfer this file to your production server or inject variables into your CI/CD pipeline."
