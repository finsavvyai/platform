# Microsoft Commercial Marketplace Integration

TenantIQ integrates with the Microsoft Commercial Marketplace (AppSource) using the SaaS Fulfillment API v2. This enables MSPs to discover, purchase, and manage TenantIQ subscriptions directly from AppSource.

## Architecture

```
MSP purchases on AppSource
  -> Microsoft redirects to Landing Page (https://app.tenantiq.app/marketplace?token=...)
  -> Landing page calls POST /api/marketplace/resolve to verify token
  -> POST /api/marketplace/activate provisions the subscription
  -> Lifecycle events (plan change, cancel, etc.) arrive at POST /api/marketplace/webhook
```

## Partner Center Setup

### 1. Azure AD App Registration

Create a dedicated app registration for marketplace in Azure Portal:

- **Name**: `TenantIQ Marketplace`
- **Supported account types**: Accounts in any organizational directory
- **Redirect URI**: `https://app.tenantiq.app/marketplace`
- **API permissions**: None required (Microsoft sends events to your webhook)
- Note the **Application (client) ID** and create a **client secret**

### 2. Partner Center Configuration

In [Partner Center](https://partner.microsoft.com/dashboard):

1. Go to **Commercial Marketplace** > **Overview** > **New offer** > **SaaS**
2. Fill in offer details (name, description, logos)
3. Under **Technical configuration**, set:
   - **Landing page URL**: `https://app.tenantiq.app/marketplace`
   - **Connection webhook URL**: `https://api.tenantiq.app/api/marketplace/webhook`
   - **Azure AD tenant ID**: Your TenantIQ Azure AD tenant ID
   - **Azure AD app ID**: The app registration client ID from step 1

### 3. Plan Configuration

Create these plans in Partner Center with matching IDs:

| Plan ID | Name | Price | Billing |
|---------|------|-------|---------|
| `tenantiq-starter` | Starter | $29/mo | Per-organization |
| `tenantiq-professional` | Professional | $79/mo | Per-organization |
| `tenantiq-enterprise` | Enterprise | $149/mo | Per-organization |

## API Endpoints

### POST `/api/marketplace/webhook` (no auth)

Microsoft calls this endpoint for subscription lifecycle events. No TenantIQ auth required; validated via `x-ms-marketplace-token` header.

**Supported actions**: `ChangePlan`, `ChangeQuantity`, `Suspend`, `Unsubscribe`, `Reinstate`, `Renew`

### POST `/api/marketplace/resolve`

Resolves a marketplace purchase token to subscription details. Called by the landing page.

### POST `/api/marketplace/activate`

Activates a new subscription, creating the organization and storing the subscription record.

### GET `/api/marketplace/subscriptions` (admin only)

Lists all active marketplace subscriptions. Requires TenantIQ auth with admin role.

## Environment Variables

Add to `wrangler.toml` or secrets:

```toml
MARKETPLACE_WEBHOOK_SECRET = "your-shared-secret"  # Optional: for additional webhook validation
```

## Testing with Partner Center Sandbox

1. In Partner Center, use the **Preview audience** feature to test with specific Azure AD tenants
2. Create a test subscription through the sandbox flow
3. Verify the landing page resolves the token correctly
4. Test webhook events using the Partner Center **Operations** panel
5. Validate plan changes and cancellation flows

### Manual webhook testing:

```bash
curl -X POST https://api.tenantiq.app/api/marketplace/webhook \
  -H "Content-Type: application/json" \
  -H "x-ms-marketplace-token: your-token" \
  -d '{
    "action": "ChangePlan",
    "subscriptionId": "sub-123",
    "planId": "tenantiq-professional"
  }'
```

## Data Storage

| Key Pattern | Store | Purpose |
|-------------|-------|---------|
| `marketplace-sub:{subscriptionId}` | KV | Active subscription record |
| `marketplace-resolve:{token}` | KV | Temporary token-to-subscription mapping |
| `marketplace-event:{orgId}:{eventId}` | KV | Audit trail (90-day TTL) |
| `organizations.billing_plan` | D1 | Organization billing tier |

## Go-Live Checklist

- [ ] Azure AD app registration created with correct redirect URI
- [ ] Partner Center offer configured with landing page and webhook URLs
- [ ] Plan IDs match between Partner Center and `marketplace-config.ts`
- [ ] Webhook endpoint accessible from Microsoft (no IP restriction)
- [ ] Landing page tested with real AppSource purchase flow
- [ ] All lifecycle events tested: ChangePlan, Suspend, Unsubscribe, Reinstate, Renew
- [ ] Audit logging verified in KV
- [ ] Organization billing_plan updates verified in D1
- [ ] Error handling tested (invalid tokens, unknown plans)
- [ ] Monitoring alerts configured for webhook failures
- [ ] Partner Center offer submitted for review
- [ ] Offer published to AppSource

## Reference

- [SaaS Fulfillment API v2](https://learn.microsoft.com/en-us/partner-center/marketplace-offers/partner-center-portal/pc-saas-fulfillment-subscription-api)
- [SaaS Webhook Reference](https://learn.microsoft.com/en-us/partner-center/marketplace-offers/partner-center-portal/pc-saas-fulfillment-webhook)
- [Partner Center Portal](https://partner.microsoft.com/dashboard)
