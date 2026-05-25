# LemonSqueezy Configuration for LunaOS Engine

Store ID: `214097`

## Required Secrets

```bash
cd lunaos-engine/packages/api

wrangler secret put LEMONSQUEEZY_API_KEY
wrangler secret put LEMONSQUEEZY_STORE_ID          # 214097
wrangler secret put LEMONSQUEEZY_WEBHOOK_SECRET
wrangler secret put LEMONSQUEEZY_VARIANT_PRO        # variant ID for Pro $29/mo
wrangler secret put LEMONSQUEEZY_VARIANT_TEAM       # variant ID for Team $79/mo
```

## Setup Steps

### 1. Create Products in LemonSqueezy

Use the generated HTML page to create products:
```bash
open scripts/ls-product-descriptions.html
```

Or go to https://app.lemonsqueezy.com/products/new and create:

| Product | Variant | Price |
|---------|---------|-------|
| LunaOS | Pro | $29/mo |
| LunaOS | Team | $79/mo |

Copy the variant IDs after creation.

### 2. Create Webhook

Go to https://app.lemonsqueezy.com/settings/webhooks and add:

- **URL**: `https://api.lunaos.ai/billing/webhook`
- **Signing secret**: generate and save
- **Events**:
  - `subscription_created`
  - `subscription_updated`
  - `subscription_cancelled`
  - `subscription_expired`
  - `subscription_payment_failed`

### 3. Set All Secrets

```bash
wrangler secret put LEMONSQUEEZY_API_KEY
wrangler secret put LEMONSQUEEZY_STORE_ID
wrangler secret put LEMONSQUEEZY_WEBHOOK_SECRET
wrangler secret put LEMONSQUEEZY_VARIANT_PRO
wrangler secret put LEMONSQUEEZY_VARIANT_TEAM
```

### 4. Run Migration

```bash
wrangler d1 execute lunaos-engine-db --file=migrations/007_rename_stripe_to_ls.sql
```

### 5. Verify

```bash
curl -s https://api.lunaos.ai/health | jq .

# Test checkout (requires valid auth token)
curl -X POST https://api.lunaos.ai/billing/checkout \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"plan":"pro"}'
# Should return { checkoutUrl: "https://....lemonsqueezy.com/checkout/..." }
```

## Code References

- Routes: `packages/api/src/routes/billing.ts`
- LS service: `packages/api/src/services/lemonsqueezy.ts`
- Webhook handlers: `packages/api/src/services/billing-webhook-handlers.ts`
- Billing middleware: `packages/api/src/middleware/billing.ts`
- Migration: `packages/api/migrations/007_rename_stripe_to_ls.sql`
- Tier limits: free=100, pro=10,000, team=100,000 executions/month
