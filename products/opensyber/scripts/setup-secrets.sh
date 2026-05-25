#!/usr/bin/env bash
# OpenSyber — Interactive Cloudflare Secrets Setup
# Run from project root: ./scripts/setup-secrets.sh

set -e

# shellcheck source=./_cf-env.sh
source "$(dirname "$0")/_cf-env.sh"

API_DIR="$(cd "$(dirname "$0")/../apps/api" && pwd)"
echo ""
echo "========================================="
echo "  OpenSyber — Cloudflare Secrets Setup"
echo "========================================="
echo ""
echo "This script will set all required secrets"
echo "for the opensyber-api Cloudflare Worker."
echo ""
echo "Working directory: $API_DIR"
echo "Account:           $CLOUDFLARE_ACCOUNT_ID"
echo "Auth:              keychain item 'cf-write-token'"
echo ""

set_secret() {
  local name=$1
  local description=$2
  local hint=$3

  echo "-----------------------------------------"
  echo "Secret: $name"
  echo "  $description"
  if [ -n "$hint" ]; then
    echo "  Hint: $hint"
  fi
  echo ""

  read -rp "  Enter value (or press Enter to skip): " value

  if [ -z "$value" ]; then
    echo "  SKIPPED"
    echo ""
    return
  fi

  echo "$value" | npx wrangler secret put "$name" --config "$API_DIR/wrangler.toml" 2>&1 | tail -1
  echo "  SET"
  echo ""
}

echo "=========== Clerk Authentication ==========="
echo ""
echo "Get these from https://dashboard.clerk.com"
echo "  -> Your app -> API Keys"
echo ""

set_secret "CLERK_SECRET_KEY" \
  "Clerk backend secret key" \
  "Starts with sk_live_ or sk_test_"

set_secret "CLERK_PUBLISHABLE_KEY" \
  "Clerk frontend publishable key" \
  "Starts with pk_live_ or pk_test_"

set_secret "CLERK_WEBHOOK_SECRET" \
  "Clerk webhook signing secret" \
  "Go to Webhooks -> your endpoint -> Signing Secret (starts with whsec_)"

echo ""
echo "=========== LemonSqueezy Payments ==========="
echo ""
echo "Get these from https://app.lemonsqueezy.com"
echo "  -> Settings -> API Keys / Store / Products"
echo ""

set_secret "LEMONSQUEEZY_API_KEY" \
  "LemonSqueezy API key" \
  "Settings -> API Keys -> Create API Key"

set_secret "LEMONSQUEEZY_WEBHOOK_SECRET" \
  "LemonSqueezy webhook signing secret" \
  "Settings -> Webhooks -> your endpoint -> Signing Secret"

set_secret "LEMONSQUEEZY_STORE_ID" \
  "LemonSqueezy store ID (numeric)" \
  "Settings -> Stores -> your store ID in the URL"

set_secret "OPENSYBER_LS_PRODUCT_ID" \
  "LemonSqueezy product ID for OpenSyber" \
  "Products -> your product -> ID in the URL"

set_secret "OPENSYBER_LS_VARIANT_PERSONAL" \
  "LemonSqueezy variant ID for Personal plan" \
  "Products -> Variants -> Personal variant ID"

set_secret "OPENSYBER_LS_VARIANT_PRO" \
  "LemonSqueezy variant ID for Pro plan" \
  "Products -> Variants -> Pro variant ID"

set_secret "OPENSYBER_LS_VARIANT_TEAM" \
  "LemonSqueezy variant ID for Team plan" \
  "Products -> Variants -> Team variant ID"

echo ""
echo "=========== Infrastructure ==========="
echo ""

set_secret "HETZNER_API_TOKEN" \
  "Hetzner Cloud API token for VM provisioning" \
  "https://console.hetzner.cloud -> Project -> Security -> API Tokens"

set_secret "ENCRYPTION_KEY" \
  "32-char hex key for encrypting gateway tokens" \
  "Generate with: openssl rand -hex 16"

echo ""
echo "========================================="
echo "  Setup complete!"
echo "========================================="
echo ""
echo "To verify, run:"
echo "  cd apps/api && npx wrangler secret list"
echo ""
echo "To redeploy with secrets:"
echo "  pnpm run deploy:api"
echo ""
