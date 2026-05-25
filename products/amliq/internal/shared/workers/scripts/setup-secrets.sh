#!/bin/bash

# Secrets Setup Script
# Configures all secrets for the FinTech suite

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Navigate to workers directory
cd "$(dirname "$0")/.."

log_info "Setting up secrets for FinTech suite..."

# Check if .env.local exists
if [ ! -f "../.env.local" ]; then
    log_error ".env.local file not found. Please create it from .env.example"
    exit 1
fi

# Load environment variables
log_info "Loading environment variables from .env.local..."
source ../.env.local

# Function to set secret if value is not placeholder
set_secret_if_valid() {
    local secret_name="$1"
    local secret_value="$2"
    local placeholder_pattern="$3"

    if [ -n "$secret_value" ] && [[ ! "$secret_value" =~ ^${placeholder_pattern} ]]; then
        log_info "Setting secret: $secret_name"
        echo "$secret_value" | wrangler secret put "$secret_name"
        log_success "Secret $secret_name set successfully"
    else
        log_warning "Skipping $secret_name - value appears to be placeholder or empty"
        log_info "Set it manually with: wrangler secret put $secret_name"
    fi
}

# Security secrets
log_info "Setting security secrets..."
set_secret_if_valid "JWT_SECRET" "$JWT_SECRET" "your_super_secret_jwt_key"
set_secret_if_valid "ENCRYPTION_KEY" "$ENCRYPTION_KEY" "your_32_character_encryption_key"
set_secret_if_valid "API_KEY_SECRET" "$API_KEY_SECRET" "your_api_key_secret"

# AI Provider secrets
log_info "Setting AI provider secrets..."
set_secret_if_valid "OPENAI_API_KEY" "$OPENAI_API_KEY" "your_openai_api_key"
set_secret_if_valid "OPENAI_ORG_ID" "$OPENAI_ORG_ID" "your_openai_org_id"
set_secret_if_valid "ANTHROPIC_API_KEY" "$ANTHROPIC_API_KEY" "your_anthropic_api_key"
set_secret_if_valid "GEMINI_API_KEY" "$GEMINI_API_KEY" "your_gemini_api_key"
set_secret_if_valid "PERPLEXITY_API_KEY" "$PERPLEXITY_API_KEY" "your_perplexity_api_key"

# Payment processing secrets
log_info "Setting payment secrets..."
set_secret_if_valid "STRIPE_SECRET_KEY" "$STRIPE_SECRET_KEY" "sk_test_"
set_secret_if_valid "LEMONSQUEEZY_API_KEY" "$LEMONSQUEEZY_API_KEY" "your_lemonsqueezy_api_key"

# Compliance service secrets
log_info "Setting compliance secrets..."
set_secret_if_valid "COMPLYADVANTAGE_API_KEY" "$COMPLYADVANTAGE_API_KEY" "your_complyadvantage_api_key"
set_secret_if_valid "OPENSANCTIONS_API_KEY" "$OPENSANCTIONS_API_KEY" "your_opensanctions_api_key"

# Email service secrets
log_info "Setting email service secrets..."
set_secret_if_valid "RESEND_API_KEY" "$RESEND_API_KEY" "re_"
set_secret_if_valid "SMTP_PASS" "$SMTP_PASS" "your_app_password"

# Monitoring and analytics
log_info "Setting monitoring secrets..."
set_secret_if_valid "SENTRY_DSN" "$SENTRY_DSN" "https://"
set_secret_if_valid "DATADOG_API_KEY" "$DATADOG_API_KEY" "your_datadog_api_key"
set_secret_if_valid "MONITORING_WEBHOOK" "$MONITORING_WEBHOOK" "https://your-monitoring"

# Database configuration (if any)
log_info "Setting database secrets..."
set_secret_if_valid "DATABASE_URL" "$DATABASE_URL" "sqlite:"

log_success "Secrets setup completed!"
log_info ""
log_info "Remaining manual setup:"
log_info "1. For any skipped secrets, set them manually using: wrangler secret put <SECRET_NAME>"
log_info "2. Configure database IDs in wrangler.toml after creating D1 databases"
log_info "3. Configure KV namespace IDs in wrangler.toml after creating namespaces"
log_info "4. Update any other resource-specific configuration"