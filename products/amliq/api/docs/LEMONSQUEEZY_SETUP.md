# LemonSqueezy Setup Guide for AMLIQ

Complete step-by-step integration guide for setting up LemonSqueezy as the billing provider for AMLIQ AML Platform.

## Prerequisites

- LemonSqueezy account (free signup at https://lemonsqueezy.com)
- Admin access to AMLIQ infrastructure
- Access to environment variables / secrets management

## Step 1: Create LemonSqueezy Account & Store

1. Go to https://lemonsqueezy.com and create a free account
2. Complete the registration and email verification
3. Log into your LemonSqueezy dashboard
4. Go to **Settings** → **Stores** → **Create Store**
5. Store Name: `AMLIQ AML Platform`
6. Currency: `USD`
7. Timezone: `UTC`
8. Click **Create Store**
9. Copy your **Store ID** (you'll need this for env variables)

## Step 2: Create Products (5 Total)

Create each product in LemonSqueezy following the configurations below.

### Product 1: AMLIQ API Access
- **Product Name:** `AMLIQ API Access`
- **Description:** `Real-time API access for AML transaction screening and customer verification`
- **Variants:**
  - Starter: $499/month (handles ~10K transactions/mo)
  - Pro: $1,499/month (handles ~100K transactions/mo)
  - Enterprise: Custom pricing (contact sales)
- **Product Type:** Subscription
- **Enable webhooks:** Yes

### Product 2: AMLIQ Dashboard
- **Product Name:** `AMLIQ Dashboard`
- **Description:** `Web-based dashboard for AML case management, alerts, and compliance reporting`
- **Variants:**
  - Base: $299/month (includes 5 seats)
  - Additional Seat: $49/month (usage-based add-on)
- **Product Type:** Subscription
- **Enable webhooks:** Yes

### Product 3: AMLIQ SDK
- **Product Name:** `AMLIQ SDK`
- **Description:** `Client libraries and SDKs for Go, Python, JavaScript integration`
- **Variants:**
  - Starter: $699/month (for development/testing)
  - Pro: $1,999/month (for production use)
  - Enterprise: Custom pricing
- **Product Type:** Subscription
- **Enable webhooks:** Yes

### Product 4: AMLIQ iFrame Widget
- **Product Name:** `AMLIQ iFrame Widget`
- **Description:** `Embeddable KYC/AML verification widget for customer onboarding`
- **Variants:**
  - Basic: $199/month (up to 1K verifications/mo)
  - Pro: $599/month (up to 10K verifications/mo)
  - Enterprise: Custom pricing
- **Product Type:** Subscription
- **Enable webhooks:** Yes

### Product 5: AMLIQ Dataset CSV
- **Product Name:** `AMLIQ Dataset CSV`
- **Description:** `Monthly CSV export of AML screening datasets and sanctions lists`
- **Variants:**
  - Standard: $999/month
  - Premium: $2,499/month (includes historical data)
  - Enterprise: Custom pricing
- **Product Type:** Subscription
- **Enable webhooks:** Yes

After creating each product, save the **Product IDs** for use in environment variables.

## Step 3: Configure Webhooks

1. Go to **Settings** → **Webhooks**
2. Click **Create Webhook**
3. **Webhook URL:** `https://api.amliq.finance/webhooks/lemonsqueezy`
4. **Events to subscribe to:**
   - `subscription_created`
   - `subscription_updated`
   - `subscription_payment_success`
   - `subscription_payment_failed`
   - `subscription_cancelled`
   - `order_created`
5. Click **Create Webhook**
6. Copy the **Webhook Secret** (the signing key)

## Step 4: Create API Key

1. Go to **Settings** → **API Keys**
2. Click **Create API Key**
3. Name: `AMLIQ Backend`
4. Scope: `Subscriptions` (read/write), `Orders` (read)
5. Copy the **API Key** (store securely)

## Step 5: Set Environment Variables

Add these to your `.env` file or secrets manager:

```bash
LEMONSQUEEZY_API_KEY=lsxauth_live_xxxxx
LEMONSQUEEZY_STORE_ID=123456
LEMONSQUEEZY_WEBHOOK_SECRET=whsec_xxxxxxxxxx

# Product IDs (from product creation)
LEMONSQUEEZY_API_PRODUCT_ID=654321
LEMONSQUEEZY_DASH_PRODUCT_ID=654322
LEMONSQUEEZY_SDK_PRODUCT_ID=654323
LEMONSQUEEZY_IFRAME_PRODUCT_ID=654324
LEMONSQUEEZY_CSV_PRODUCT_ID=654325

# Variant IDs (specific pricing tiers)
LEMONSQUEEZY_API_STARTER_VARIANT=1001
LEMONSQUEEZY_API_PRO_VARIANT=1002
LEMONSQUEEZY_API_ENTERPRISE_VARIANT=1003
LEMONSQUEEZY_DASH_BASE_VARIANT=1004
LEMONSQUEEZY_SDK_STARTER_VARIANT=1005
LEMONSQUEEZY_SDK_PRO_VARIANT=1006
LEMONSQUEEZY_SDK_ENTERPRISE_VARIANT=1007
LEMONSQUEEZY_IFRAME_BASIC_VARIANT=1008
LEMONSQUEEZY_IFRAME_PRO_VARIANT=1009
LEMONSQUEEZY_IFRAME_ENTERPRISE_VARIANT=1010
LEMONSQUEEZY_CSV_STANDARD_VARIANT=1011
LEMONSQUEEZY_CSV_PREMIUM_VARIANT=1012
LEMONSQUEEZY_CSV_ENTERPRISE_VARIANT=1013
```

## Step 6: Verify Integration

1. Backend running with env variables set
2. Test webhook delivery: LemonSqueezy Dashboard → Webhooks → View → Test
3. Check `billing_events` table for received webhooks
4. Create test subscription in LemonSqueezy test mode
5. Verify subscription appears in AMLIQ database

## Next Steps

- See `LEMONSQUEEZY_PRODUCTS.md` for variant configuration details
- See `LEMONSQUEEZY_WEBHOOKS.md` for webhook event handling
- See `LEMONSQUEEZY_PROMO.md` for promotional code setup
- See `LEMONSQUEEZY_ENV.md` for complete environment variable reference
