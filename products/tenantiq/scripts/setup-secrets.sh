#!/bin/bash

# TenantIQ Production Secrets Setup
# This script helps set up required production secrets for the TenantIQ API

set -e

echo "🔐 TenantIQ Production Secrets Setup"
echo "===================================="
echo ""

# Check if running in production context
read -p "⚠️  WARNING: This will set PRODUCTION secrets. Continue? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo "Aborted."
    exit 0
fi

echo ""
echo "📝 Required secrets for TenantIQ API:"
echo "  - AZURE_CLIENT_ID (already set)"
echo "  - AZURE_CLIENT_SECRET (needs to be set)"
echo "  - AZURE_TENANT_ID (needs to be set)"
echo "  - JWT_SECRET (already set)"
echo "  - ANTHROPIC_API_KEY (optional, for AI features)"
echo "  - OPENCLAW_SERVICE_KEY (optional, for LunaOS integration)"
echo "  - SENTRY_DSN (optional, for error tracking)"
echo ""

# Function to set a secret
set_secret() {
    local secret_name=$1
    local secret_description=$2
    local is_optional=$3

    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Setting: $secret_name"
    echo "Description: $secret_description"

    if [ "$is_optional" = "true" ]; then
        read -p "Skip this optional secret? (yes/no): " skip
        if [ "$skip" = "yes" ]; then
            echo "⏭️  Skipped $secret_name"
            return
        fi
    fi

    read -sp "Enter value for $secret_name: " secret_value
    echo ""

    if [ -z "$secret_value" ]; then
        echo "⚠️  Empty value provided, skipping..."
        return
    fi

    echo "$secret_value" | wrangler secret put "$secret_name" --name tenantiq-api
    echo "✅ $secret_name set successfully"
    echo ""
}

# Azure Configuration (Required for Microsoft Graph API)
echo "🔵 Azure AD Configuration"
echo "These credentials are required for Microsoft Graph API access"
echo ""

set_secret "AZURE_CLIENT_SECRET" "Azure AD Application Secret" "false"
set_secret "AZURE_TENANT_ID" "Azure AD Tenant ID" "false"

# Optional Secrets
echo ""
echo "🔧 Optional Configuration"
echo ""

set_secret "ANTHROPIC_API_KEY" "Anthropic API Key for Claude AI features" "true"
set_secret "OPENCLAW_SERVICE_KEY" "OpenClaw Service Authentication Key" "true"
set_secret "SENTRY_DSN" "Sentry DSN for error tracking and monitoring" "true"

echo ""
echo "✨ Production secrets setup complete!"
echo ""
echo "📋 Current secrets:"
wrangler secret list --name tenantiq-api
echo ""
echo "🚀 You can now deploy the API with: pnpm --filter=@tenantiq/api run deploy"
