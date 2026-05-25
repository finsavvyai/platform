# LemonSqueezy Environment Variables Reference

Complete reference of all environment variables required for LemonSqueezy integration with AMLIQ.

## Overview

The AMLIQ backend requires the following environment variables to integrate with LemonSqueezy:
- **2** configuration variables (API key, webhook secret)
- **1** store identifier
- **5** product IDs (one per product line)
- **13** variant IDs (pricing tiers across products)

All values are found in LemonSqueezy Dashboard → Settings.

## Required Environment Variables

### Core Configuration

```bash
# LemonSqueezy API authentication key
# Found: Dashboard → Settings → API Keys → Create API Key
# Keep this secret - treat like a password
LEMONSQUEEZY_API_KEY=lsxauth_live_a1b2c3d4e5f6g7h8i9j0

# LemonSqueezy Store identifier
# Found: Dashboard → Settings → Stores
# Your main store ID
LEMONSQUEEZY_STORE_ID=123456

# Webhook signing secret for request verification
# Found: Dashboard → Settings → Webhooks → Create Webhook → Signing Secret
# Used to verify requests are truly from LemonSqueezy (HMAC-SHA256)
LEMONSQUEEZY_WEBHOOK_SECRET=whsec_1234567890abcdefghijk
```

### Product IDs

Each product has a unique ID in LemonSqueezy:

```bash
# AMLIQ API Access - Real-time transaction screening
# Variants: Starter ($499), Pro ($1,499), Enterprise (custom)
LEMONSQUEEZY_API_PRODUCT_ID=654321

# AMLIQ Dashboard - Web-based case management
# Variants: Base ($299/mo), Additional seats ($49/mo)
LEMONSQUEEZY_DASH_PRODUCT_ID=654322

# AMLIQ SDK - Client libraries for Go, Python, JS
# Variants: Starter ($699), Pro ($1,999), Enterprise (custom)
LEMONSQUEEZY_SDK_PRODUCT_ID=654323

# AMLIQ iFrame Widget - Embeddable KYC/AML widget
# Variants: Basic ($199), Pro ($599), Enterprise (custom)
LEMONSQUEEZY_IFRAME_PRODUCT_ID=654324

# AMLIQ Dataset CSV - Monthly CSV exports and datasets
# Variants: Standard ($999), Premium ($2,499), Enterprise (custom)
LEMONSQUEEZY_CSV_PRODUCT_ID=654325
```

### Variant IDs - AMLIQ API Access (654321)

Pricing tiers for API Access product:

```bash
# Starter Plan: $499/month (10K transactions/mo)
# ID format: VariantID | Annual: VariantID_annual
LEMONSQUEEZY_API_STARTER_VARIANT=1001
LEMONSQUEEZY_API_STARTER_ANNUAL_VARIANT=1001a

# Pro Plan: $1,499/month (100K transactions/mo)
LEMONSQUEEZY_API_PRO_VARIANT=1002
LEMONSQUEEZY_API_PRO_ANNUAL_VARIANT=1002a

# Enterprise Plan: Custom pricing (contact sales)
LEMONSQUEEZY_API_ENTERPRISE_VARIANT=1003
```

### Variant IDs - AMLIQ Dashboard (654322)

Pricing tiers for Dashboard product:

```bash
# Base Plan: $299/month (5 seats included)
LEMONSQUEEZY_DASH_BASE_VARIANT=1004
LEMONSQUEEZY_DASH_BASE_ANNUAL_VARIANT=1004a

# Additional Seat: $49/month (usage-based add-on)
LEMONSQUEEZY_DASH_SEAT_ADDON_VARIANT=1005
```

### Variant IDs - AMLIQ SDK (654323)

Pricing tiers for SDK product:

```bash
# Starter Plan: $699/month
LEMONSQUEEZY_SDK_STARTER_VARIANT=1006
LEMONSQUEEZY_SDK_STARTER_ANNUAL_VARIANT=1006a

# Pro Plan: $1,999/month
LEMONSQUEEZY_SDK_PRO_VARIANT=1007
LEMONSQUEEZY_SDK_PRO_ANNUAL_VARIANT=1007a

# Enterprise Plan: Custom pricing
LEMONSQUEEZY_SDK_ENTERPRISE_VARIANT=1008
```

### Variant IDs - AMLIQ iFrame Widget (654324)

Pricing tiers for iFrame Widget product:

```bash
# Basic Plan: $199/month (1K verifications)
LEMONSQUEEZY_IFRAME_BASIC_VARIANT=1009
LEMONSQUEEZY_IFRAME_BASIC_ANNUAL_VARIANT=1009a

# Pro Plan: $599/month (10K verifications)
LEMONSQUEEZY_IFRAME_PRO_VARIANT=1010
LEMONSQUEEZY_IFRAME_PRO_ANNUAL_VARIANT=1010a

# Enterprise Plan: Custom pricing
LEMONSQUEEZY_IFRAME_ENTERPRISE_VARIANT=1011
```

### Variant IDs - AMLIQ Dataset CSV (654325)

Pricing tiers for Dataset CSV product:

```bash
# Standard Plan: $999/month
LEMONSQUEEZY_CSV_STANDARD_VARIANT=1012
LEMONSQUEEZY_CSV_STANDARD_ANNUAL_VARIANT=1012a

# Premium Plan: $2,499/month (with history)
LEMONSQUEEZY_CSV_PREMIUM_VARIANT=1013
LEMONSQUEEZY_CSV_PREMIUM_ANNUAL_VARIANT=1013a

# Enterprise Plan: Custom pricing
LEMONSQUEEZY_CSV_ENTERPRISE_VARIANT=1014
```

## Optional Configuration

### Testing & Development

```bash
# Enable LemonSqueezy test mode (uses test API credentials)
# Set to "true" for development, "false" for production
LEMONSQUEEZY_TEST_MODE=false

# Test/sandbox API key (if using test mode)
# Found: Dashboard → Settings → Test API Key
LEMONSQUEEZY_TEST_API_KEY=lsxauth_test_xxxxxxxx

# Use test variant IDs in development
# Prepend "test_" to variant IDs when TEST_MODE=true
# Example: test_1001 instead of 1001
```

### Webhook Configuration

```bash
# Custom webhook endpoint (if not using default)
# Default: https://api.amliq.finance/webhooks/lemonsqueezy
LEMONSQUEEZY_WEBHOOK_URL=https://api.amliq.finance/webhooks/lemonsqueezy

# Webhook retry configuration
LEMONSQUEEZY_WEBHOOK_MAX_RETRIES=3
LEMONSQUEEZY_WEBHOOK_RETRY_DELAY_SECONDS=300

# Enable webhook signature verification (highly recommended)
LEMONSQUEEZY_VERIFY_SIGNATURES=true
```

### Caching & Performance

```bash
# Cache promo code validation results (in seconds)
LEMONSQUEEZY_PROMO_CACHE_TTL=3600

# Cache subscription details (in seconds)
LEMONSQUEEZY_SUBSCRIPTION_CACHE_TTL=1800

# Enable Redis caching for billing data
LEMONSQUEEZY_USE_CACHE=true
REDIS_URL=redis://localhost:6379/0
```

## Complete .env Template

```bash
# ==============================================================
# LemonSqueezy Billing Configuration
# ==============================================================

# Core Configuration
LEMONSQUEEZY_API_KEY=lsxauth_live_xxxxxxxxxxxxxxxx
LEMONSQUEEZY_STORE_ID=123456
LEMONSQUEEZY_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxx

# Product IDs
LEMONSQUEEZY_API_PRODUCT_ID=654321
LEMONSQUEEZY_DASH_PRODUCT_ID=654322
LEMONSQUEEZY_SDK_PRODUCT_ID=654323
LEMONSQUEEZY_IFRAME_PRODUCT_ID=654324
LEMONSQUEEZY_CSV_PRODUCT_ID=654325

# AMLIQ API Access Variants
LEMONSQUEEZY_API_STARTER_VARIANT=1001
LEMONSQUEEZY_API_STARTER_ANNUAL_VARIANT=1001a
LEMONSQUEEZY_API_PRO_VARIANT=1002
LEMONSQUEEZY_API_PRO_ANNUAL_VARIANT=1002a
LEMONSQUEEZY_API_ENTERPRISE_VARIANT=1003

# AMLIQ Dashboard Variants
LEMONSQUEEZY_DASH_BASE_VARIANT=1004
LEMONSQUEEZY_DASH_BASE_ANNUAL_VARIANT=1004a
LEMONSQUEEZY_DASH_SEAT_ADDON_VARIANT=1005

# AMLIQ SDK Variants
LEMONSQUEEZY_SDK_STARTER_VARIANT=1006
LEMONSQUEEZY_SDK_STARTER_ANNUAL_VARIANT=1006a
LEMONSQUEEZY_SDK_PRO_VARIANT=1007
LEMONSQUEEZY_SDK_PRO_ANNUAL_VARIANT=1007a
LEMONSQUEEZY_SDK_ENTERPRISE_VARIANT=1008

# AMLIQ iFrame Widget Variants
LEMONSQUEEZY_IFRAME_BASIC_VARIANT=1009
LEMONSQUEEZY_IFRAME_BASIC_ANNUAL_VARIANT=1009a
LEMONSQUEEZY_IFRAME_PRO_VARIANT=1010
LEMONSQUEEZY_IFRAME_PRO_ANNUAL_VARIANT=1010a
LEMONSQUEEZY_IFRAME_ENTERPRISE_VARIANT=1011

# AMLIQ Dataset CSV Variants
LEMONSQUEEZY_CSV_STANDARD_VARIANT=1012
LEMONSQUEEZY_CSV_STANDARD_ANNUAL_VARIANT=1012a
LEMONSQUEEZY_CSV_PREMIUM_VARIANT=1013
LEMONSQUEEZY_CSV_PREMIUM_ANNUAL_VARIANT=1013a
LEMONSQUEEZY_CSV_ENTERPRISE_VARIANT=1014

# Optional: Testing
LEMONSQUEEZY_TEST_MODE=false
LEMONSQUEEZY_TEST_API_KEY=
LEMONSQUEEZY_WEBHOOK_URL=https://api.amliq.finance/webhooks/lemonsqueezy
LEMONSQUEEZY_VERIFY_SIGNATURES=true

# Optional: Caching
LEMONSQUEEZY_USE_CACHE=true
LEMONSQUEEZY_PROMO_CACHE_TTL=3600
LEMONSQUEEZY_SUBSCRIPTION_CACHE_TTL=1800
```

## How to Find These Values

### API Key

1. Log into LemonSqueezy Dashboard
2. Click **Settings** (bottom-left gear icon)
3. Go to **API Keys** tab
4. Click **Create API Key**
5. Set scope to "Subscriptions (read/write), Orders (read)"
6. Copy the generated key

### Store ID

1. Dashboard → **Settings**
2. Go to **Stores** tab
3. Your store ID is displayed next to your store name
4. Also visible in the store URL: `https://app.lemonsqueezy.com/dashboard/stores/123456`

### Webhook Secret

1. Dashboard → **Settings**
2. Go to **Webhooks** tab
3. Click **Create Webhook**
4. Enter webhook URL: `https://api.amliq.finance/webhooks/lemonsqueezy`
5. Click **Create**
6. The **Signing Secret** is displayed (copy immediately)

### Product IDs

1. Dashboard → **Products**
2. Click on a product
3. The Product ID is in the URL: `https://app.lemonsqueezy.com/dashboard/products/654321`
4. Also visible in product details page

### Variant IDs

1. Dashboard → **Products** → (select product)
2. Go to **Variants** tab
3. Each variant shows its ID in the rightmost column
4. Copy variant IDs for each pricing tier

## Loading Environment Variables

### Option 1: .env File

Create `.env` file in project root:

```bash
cp .env.example .env
# Edit .env and add actual values
```

Load in backend:

```go
import "github.com/joho/godotenv"

func init() {
    godotenv.Load()
}

func getEnv(key string) string {
    return os.Getenv(key)
}
```

### Option 2: Environment Variables

```bash
export LEMONSQUEEZY_API_KEY=lsxauth_live_xxx
export LEMONSQUEEZY_STORE_ID=123456
# ... etc

# Then run
go run ./cmd/server
```

### Option 3: Docker

In `docker-compose.yml`:

```yaml
services:
  api:
    environment:
      LEMONSQUEEZY_API_KEY: ${LEMONSQUEEZY_API_KEY}
      LEMONSQUEEZY_STORE_ID: ${LEMONSQUEEZY_STORE_ID}
      # ... etc
```

Run with env file:

```bash
docker-compose --env-file .env up
```

## Validation

Verify all variables are set:

```bash
# Check if all required vars are present
for var in LEMONSQUEEZY_API_KEY LEMONSQUEEZY_STORE_ID LEMONSQUEEZY_WEBHOOK_SECRET; do
  if [ -z "$(eval echo \$$var)" ]; then
    echo "Missing: $var"
  fi
done
```

Test API connection:

```bash
curl -H "Authorization: Bearer $LEMONSQUEEZY_API_KEY" \
  https://api.lemonsqueezy.com/v1/stores/$LEMONSQUEEZY_STORE_ID
```

## Security Best Practices

1. **Never commit .env files** - Add to `.gitignore`
2. **Use secrets manager** - Prefer AWS Secrets Manager, HashiCorp Vault, etc.
3. **Rotate API keys regularly** - Every 90 days minimum
4. **Limit API key scope** - Only request necessary permissions
5. **Monitor API usage** - Set up alerts for unusual activity
6. **Use different keys per environment** - Separate test, staging, prod keys
7. **Log key access** - Track which systems use which keys

## Troubleshooting

### "Invalid API Key" Error

- Verify `LEMONSQUEEZY_API_KEY` is correct (copy from Dashboard)
- Check key hasn't expired or been revoked
- Ensure key has required scopes (Subscriptions read/write)

### "Store Not Found" Error

- Verify `LEMONSQUEEZY_STORE_ID` is numeric and correct
- Check store ID from Dashboard → Settings → Stores
- Store ID should be in URL when viewing store details

### "Invalid Signature" on Webhooks

- Verify `LEMONSQUEEZY_WEBHOOK_SECRET` is correct
- Check webhook was created properly in Dashboard
- Ensure signature verification uses correct HMAC algorithm (SHA256)

### "Variant Not Found" Error

- Verify variant IDs are correct for products
- Check variant IDs in Dashboard → Products → Variants
- Variant IDs may be different in test vs live mode

## Next Steps

- Copy `.env.example` to `.env` and fill in actual values
- Test API connectivity with all credentials
- Configure webhook endpoint and secret
- Run billing integration tests
- Set up production secrets manager
