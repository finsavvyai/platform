# Billing API

Manage subscriptions, view usage, and handle payments via LemonSqueezy.

## Create Checkout Session

Start a LemonSqueezy Checkout flow to upgrade.

```http
POST /billing/checkout
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "tier": "pro"
}
```

| Field | Type | Values | Description |
|-------|------|--------|-------------|
| `tier` | string | `pro`, `team` | Target subscription tier |

**Response (200):**

```json
{
  "checkoutUrl": "https://lunaos.lemonsqueezy.com/checkout/...",
  "sessionId": "cs_..."
}
```

Redirect the user to `checkoutUrl` to complete payment.

---

## Get Subscription

View the current user's subscription status.

```http
GET /billing/subscription
Authorization: Bearer <token>
```

**Response (200) — Subscribed user:**

```json
{
  "tier": "pro",
  "status": "active",
  "subscription": {
    "id": "sub_...",
    "currentPeriodStart": "2026-02-01T00:00:00.000Z",
    "currentPeriodEnd": "2026-03-01T00:00:00.000Z",
    "cancelAtPeriodEnd": false,
    "createdAt": "2026-02-01T00:00:00.000Z"
  }
}
```

**Response (200) — Free user:**

```json
{
  "tier": "free",
  "status": "active",
  "subscription": null
}
```

---

## Get Usage

View current rate limit usage and subscription details.

```http
GET /billing/usage
Authorization: Bearer <token>
```

**Response (200):**

```json
{
  "tier": "pro",
  "rateLimit": {
    "limit": 600,
    "window": "1m",
    "used": 12,
    "remaining": 588
  },
  "period": {
    "start": "2026-02-01T00:00:00.000Z",
    "end": "2026-02-28T23:59:59.000Z"
  },
  "features": {
    "managedKeys": true,
    "mcpServers": 33,
    "rag": true,
    "visualQA": true
  }
}
```

---

## Cancel Subscription

Cancel at end of current billing period.

```http
POST /billing/cancel
Authorization: Bearer <token>
```

**Response (200):**

```json
{
  "message": "Subscription will be canceled at end of billing period"
}
```

---

## Customer Portal

Create a LemonSqueezy portal session for managing billing.

```http
POST /billing/portal
Authorization: Bearer <token>
```

**Response (200):**

```json
{
  "portalUrl": "https://app.lemonsqueezy.com/my-orders/..."
}
```

Redirect the user to `portalUrl` to manage their subscription, update payment method, or view invoices.

---

## Plan Comparison

| Feature | Free ($0) | Pro ($29/mo) | Team ($79/mo) |
|---------|-----------|-------------|---------------|
| Commands | Unlimited | Unlimited | Unlimited |
| API Keys | BYOK | Managed keys | Managed keys |
| Access | CLI + Dashboard + Studio | CLI + Dashboard + Studio | CLI + Dashboard + Studio |
| MCP Servers | — | 33 MCP servers | 33 MCP servers |
| RAG | — | ✅ | ✅ |
| Visual QA | — | ✅ | ✅ |
| Rate limit | 60/min | 600/min | 6,000/min |
| Team workspace | — | — | ✅ |
| SSO / SAML | — | — | ✅ |
| Shared memory | — | — | ✅ |
| Audit logs | — | — | ✅ |
| Support | Community | Priority | Dedicated + SLA |
