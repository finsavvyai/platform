#!/bin/bash

# Environment Variables and Secrets Setup Script
# This script sets up environment variables and secrets for the FinTech Suite

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔧 Setting up environment variables and secrets for FinTech Suite...${NC}"

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo -e "${RED}❌ Wrangler CLI not found. Please install it with: npm install -g wrangler${NC}"
    exit 1
fi

# Function to set environment variable
set_env_var() {
    local var_name="$1"
    local var_value="$2"
    local environment="${3:-production}"

    echo -e "${YELLOW}⚙️  Setting environment variable: ${var_name}${NC}"

    wrangler secret put "${var_name}" --env "${environment}" <<< "${var_value}" || {
        echo -e "${RED}❌ Failed to set environment variable ${var_name}${NC}"
        return 1
    }

    echo -e "${GREEN}✅ Successfully set environment variable: ${var_name}${NC}"
}

# Function to set secret
set_secret() {
    local secret_name="$1"
    local secret_value="$2"
    local environment="${3:-production}"

    echo -e "${YELLOW}🔐 Setting secret: ${secret_name}${NC}"

    wrangler secret put "${secret_name}" --env "${environment}" <<< "${secret_value}" || {
        echo -e "${RED}❌ Failed to set secret ${secret_name}${NC}"
        return 1
    }

    echo -e "${GREEN}✅ Successfully set secret: ${secret_name}${NC}"
}

# Development environment variables
echo -e "${BLUE}🏗️  Setting up development environment...${NC}"

set_env_var "ENVIRONMENT" "development" "development"
set_env_var "LOG_LEVEL" "debug" "development"
set_env_var "FRONTEND_URL" "http://localhost:3000" "development"
set_env_var "API_BASE_URL" "https://fintech-unified-suite-dev.shaharsolomon.workers.dev" "development"
set_env_var "DEFAULT_REGION" "US" "development"
set_env_var "ENABLE_AI_FEATURES" "true" "development"
set_env_var "ENABLE_COLLABORATION" "true" "development"
set_env_var "ENABLE_REAL_TIME_UPDATES" "true" "development"
set_env_var "ENABLE_ANALYTICS" "true" "development"
set_env_var "APP_VERSION" "1.0.0-dev" "development"

# Production environment variables
echo -e "${BLUE}🚀 Setting up production environment...${NC}"

set_env_var "ENVIRONMENT" "production" "production"
set_env_var "LOG_LEVEL" "warn" "production"
set_env_var "FRONTEND_URL" "https://finsavvyai.com" "production"
set_env_var "API_BASE_URL" "https://api.finsavvyai.com" "production"
set_env_var "DEFAULT_REGION" "US" "production"
set_env_var "ENABLE_AI_FEATURES" "true" "production"
set_env_var "ENABLE_COLLABORATION" "true" "production"
set_env_var "ENABLE_REAL_TIME_UPDATES" "true" "production"
set_env_var "ENABLE_ANALYTICS" "true" "production"
set_env_var "APP_VERSION" "1.0.0" "production"
set_env_var "DEPLOYMENT_TIMESTAMP" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "production"

# AI Model Configuration
echo -e "${BLUE}🤖 Setting up AI model configuration...${NC}"

set_env_var "AI_MODEL" "@cf/meta/llama-3.1-8b-instruct" "production"
set_env_var "EMBEDDING_MODEL" "@cf/baai/bge-base-en-v1.5" "production"
set_env_var "AI_MAX_TOKENS" "4096" "production"
set_env_var "AI_TEMPERATURE" "0.7" "production"
set_env_var "AI_TOP_P" "0.9" "production"
set_env_var "RAG_TOP_K" "5" "production"
set_env_var "RAG_SIMILARITY_THRESHOLD" "0.7" "production"

# External API URLs
echo -e "${BLUE}🌐 Setting up external API configuration...${NC}"

set_env_var "STRIPE_API_URL" "https://api.stripe.com/v1" "production"
set_env_var "ONFIDO_API_URL" "https://api.onfido.com/v3" "production"
set_env_var "COMPLYADVANTAGE_API_URL" "https://api.complyadvantage.com/v1" "production"
set_env_var "OPENAI_API_URL" "https://api.openai.com/v1" "production"

# Security Configuration
echo -e "${BLUE}🔒 Setting up security configuration...${NC}"

set_env_var "JWT_SECRET" "$(openssl rand -base64 32)" "production"
set_env_var "WEBHOOK_SECRET" "$(openssl rand -base64 32)" "production"
set_env_var "ENCRYPTION_KEY" "$(openssl rand -base64 32)" "production"
set_env_var "SESSION_SECRET" "$(openssl rand -base64 32)" "production"
set_env_var "API_KEY_SALT" "$(openssl rand -base64 16)" "production"

# Rate Limiting Configuration
echo -e "${BLUE}📊 Setting up rate limiting configuration...${NC}"

set_env_var "RATE_LIMIT_WINDOW" "3600" "production"  # 1 hour
set_env_var "RATE_LIMIT_REQUESTS" "1000" "production"  # 1000 requests per hour
set_env_var "RATE_LIMIT_BURST" "100" "production"  # 100 requests burst
set_env_var "RATE_LIMIT_STRIPE" "10000" "production"  # Stripe has higher limits
set_env_var "RATE_LIMIT_COMPLIANCE" "5000" "production"  # Compliance operations

# Secrets (these should be set manually with actual values)
echo -e "${YELLOW}🔐 Secrets that need manual configuration:${NC}"
echo -e "   - STRIPE_SECRET_KEY: Your Stripe secret key"
echo -e "   - STRIPE_WEBHOOK_SECRET: Your Stripe webhook secret"
echo -e "   - ONFIDO_API_KEY: Your Onfido API key"
echo -e "   - COMPLYADVANTAGE_API_KEY: Your ComplyAdvantage API key"
echo -e "   - OPENAI_API_KEY: Your OpenAI API key"
echo -e "   - DATABASE_ENCRYPTION_KEY: Database encryption key"
echo -e "   - R2_ACCESS_KEY_ID: R2 access key ID"
echo -e "   - R2_SECRET_ACCESS_KEY: R2 secret access key"
echo ""

# Create secrets configuration template
cat > infrastructure/cloudflare/secrets-template.env << 'EOF'
# Secrets Configuration Template
# Copy this file to secrets.env and fill in your actual values
# DO NOT commit the actual secrets to version control

# Payment Service Provider Secrets
STRIPE_SECRET_KEY=sk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
STRIPE_PUBLISHABLE_KEY=pk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Identity Verification Secrets
ONFIDO_API_KEY=api_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
ONFIDO_WEBHOOK_SECRET=onfido_webhook_xxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Compliance Screening Secrets
COMPLYADVANTAGE_API_KEY=ca_xxxxxxxxxxxxxxxxxxxxxxxxxxxx

# AI Services Secrets
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Database Encryption
DATABASE_ENCRYPTION_KEY=base64_encoded_32_byte_key_here

# Cloud Storage Secrets
R2_ACCESS_KEY_ID=your_r2_access_key_id
R2_SECRET_ACCESS_KEY=your_r2_secret_access_key

# Security Secrets
JWT_SECRET=base64_encoded_jwt_secret_here
WEBHOOK_SECRET=base64_encoded_webhook_secret_here
ENCRYPTION_KEY=base64_encoded_encryption_key_here
SESSION_SECRET=base64_encoded_session_secret_here
API_KEY_SALT=base64_encoded_salt_here

# External Service Webhooks
STRIPE_WEBHOOK_ENDPOINT=https://api.finsavvyai.com/webhooks/stripe
ONFIDO_WEBHOOK_ENDPOINT=https://api.finsavvyai.com/webhooks/onfido

# Third-party Integrations
PLAID_CLIENT_ID=your_plaid_client_id
PLAID_SECRET=your_plaid_secret
QUICKBOOKS_CLIENT_ID=your_quickbooks_client_id
QUICKBOOKS_CLIENT_SECRET=your_quickbooks_client_secret
XERO_CLIENT_ID=your_xero_client_id
XERO_CLIENT_SECRET=your_xero_client_secret

# Monitoring and Analytics
SENTRY_DSN=https://your_sentry_dsn_here
ANALYTICS_WRITE_KEY=your_analytics_write_key_here

# Email Service
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=noreply@finsavvyai.com
SMTP_PASS=your_smtp_password

# Domain Configuration
FRONTEND_DOMAIN=finsavvyai.com
API_DOMAIN=api.finsavvyai.com
EOF

echo -e "${GREEN}✅ Secrets template created: infrastructure/cloudflare/secrets-template.env${NC}"
echo -e "${YELLOW}📝 Next steps:${NC}"
echo -e "   1. Copy infrastructure/cloudflare/secrets-template.env to infrastructure/cloudflare/secrets.env"
echo -e "   2. Fill in your actual secret values"
echo -e "   3. Run 'wrangler secret put SECRET_NAME < infrastructure/cloudflare/secrets.env' for each secret"
echo -e "   4. Never commit the actual secrets to version control"

echo -e "${GREEN}🎉 Environment setup completed!${NC}"
