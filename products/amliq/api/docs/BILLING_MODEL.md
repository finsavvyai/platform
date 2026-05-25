# BILLING_MODEL.md — Pricing & Subscription Reference

## Competitive Positioning

World-Check charges $25,000–$100,000+/year. AMLIQ delivers superior
AI-powered matching at 60–80% lower cost, positioning as the modern
alternative for fintechs, mid-market banks, and enterprises.

## 5 Products × 3 Tiers = 15+ SKUs

### Product 1: API

RESTful screening service for servers. Usage-based or flat-rate.

| Tier | Monthly | Annual | Features |
|------|---------|--------|----------|
| **Startup** | $999 | $9,990 | 10k screenings/mo, L1-L4 matching, 5 core lists |
| **Professional** | $4,999 | $49,990 | 250k screenings/mo, L1-L6 + PEP, all lists, webhooks, 99.9% SLA |
| **Enterprise** | Custom ($15k-$50k/yr) | Custom | Unlimited, graph matching, on-premise, SOC 2, dedicated AM |

**Overage**: $0.02 per screening beyond plan limit

### Product 2: Dashboard

Web UI for compliance teams to review alerts, configure screening, manage team.

| Tier | Monthly | Annual | Features |
|------|---------|--------|----------|
| **Startup** | $799 | $7,990 | 3 seats, alert queue, basic analytics |
| **Professional** | $2,999 | $29,990 | 15 seats, advanced analytics, custom branding, audit export |
| **Enterprise** | Custom | Custom | Unlimited seats, SSO/SAML, role-based access, custom workflows |

**Seat overage**: $99/seat/month (Startup), $79/seat/month (Professional)

### Product 3: SDK

Downloadable libraries (Go, Python, Node.js) for offline/on-premise screening.

| Tier | Monthly | Annual | Features |
|------|---------|--------|----------|
| **Startup** | $1,999 | $19,990 | Go + Python, 1 environment, weekly updates |
| **Professional** | $5,999 | $59,990 | All SDKs, 3 environments, daily updates |
| **Enterprise** | Custom | Custom | Unlimited, on-premise, hourly updates, custom integration |

**Usage**: List data updates included. Custom lists +$500/mo each.

### Product 4: iFrame

Embeddable screening widget for partner platforms.

| Tier | Monthly | Annual | Features |
|------|---------|--------|----------|
| **Startup** | $499 | $4,990 | 1 domain, 10K lookups, basic styling |
| **Professional** | $1,999 | $19,990 | 5 domains, 100K lookups, full white-label |
| **Enterprise** | Custom | Custom | Unlimited domains, dedicated support |

**Overage**: $0.01 per lookup beyond plan limit

### Product 5: Dataset

Raw sanctions list data in standardized JSON/CSV.

| Tier | Monthly | Annual | Features |
|------|---------|--------|----------|
| **Standard** | $1,999 | $19,990 | Daily CSV/JSON, public sanctions, basic fields |
| **Premium** | $4,999 | $49,990 | Hourly updates, PEP + sanctions, delta feed, rich metadata |
| **Enterprise** | Custom | Custom | Real-time streaming, custom lists, webhook delivery, SLA |

**Lists included**: 350+ via OpenSanctions + OFAC, UN, EU, UK, Swiss,
Israeli NBCTF/Treasury/MoD, FATF, Interpol, World Bank, FBI, Europol

## Plan Pricing Matrix

```
API Startup        → $999/mo  (10K screenings)
API Professional   → $4,999/mo (250K screenings)
API Enterprise     → $15K-$50K/yr (unlimited)

Dashboard Startup      → $799/mo  (3 seats)
Dashboard Professional → $2,999/mo (15 seats)
Dashboard Enterprise   → Custom

SDK Startup        → $1,999/mo (1 env)
SDK Professional   → $5,999/mo (3 envs)
SDK Enterprise     → Custom

iFrame Startup     → $499/mo  (10K lookups)
iFrame Professional→ $1,999/mo (100K lookups)
iFrame Enterprise  → Custom

Dataset Standard   → $1,999/mo (daily, basic)
Dataset Premium    → $4,999/mo (hourly, PEPs, deltas)
Dataset Enterprise → Custom (real-time streaming)

Bundled: API + Dashboard → 15% discount
Full Platform (all 5)   → 25% discount
```

## LemonSqueezy Integration

### Webhook Flow

```
LemonSqueezy (Stripe backend)
    ↓ (customer clicks "Subscribe")
Checkout Form (embedded iframe)
    ↓ (payment processed)
Webhook: subscription.created
    ↓ (HMAC-SHA256 verified)
webhook_handler.go
    ↓
Create Subscription record in DB
    ↓
Send confirmation email
    ↓
Activate API key
    ↓
User can start screening
```

### Webhook Events Handled

| Event | Action |
|-------|--------|
| `subscription.created` | Create subscription, activate API key |
| `subscription.updated` | Update subscription (tier change, renewal) |
| `subscription.cancelled` | Mark as Cancelled, disable API key |
| `subscription.expired` | Mark as Expired, disable API key |
| `subscription.resumed` | Mark as Active, re-enable API key |

### Webhook Verification

```go
// LemonSqueezy sends:
// X-Signature: HMAC-SHA256(body, webhook_secret)

// We verify:
signature := hmac.New(sha256.New, webhookSecret).Sum(body)
if !bytes.Equal(signature, provided) {
    return ErrInvalidSignature
}
```

## Usage Metering

Each subscription tracks usage per metric type.

### Metrics by Product

| Product | Metric | Unit | Cap |
|---------|--------|------|-----|
| API | screenings | count | Per-tier limit (10k-unlimited) |
| Dashboard | seats | count | Per-tier limit (3-unlimited) |
| Dashboard | alerts_reviewed | count | Unlimited |
| SDK | environments | count | Per-tier limit (1-unlimited) |
| SDK | list_updates | count | Unlimited (included) |
| iFrame | screenings | count | Per-tier limit (1k-unlimited) |
| Dataset | list_exports | count | Per-tier limit (4-unlimited) |

### Recording Usage

```go
// In handler_screening.go, after successful screening
usage.Record(UsageRecord{
    TenantID: tenantID,
    Metric:   domain.ScreeningsCount,
    Quantity: 1,
    PeriodStart: startOfMonth,
    PeriodEnd:   endOfMonth,
})

// Check if over limit
if usage.Sum(tenantID, ScreeningsCount) > plan.ScreeningsPerMonth {
    if !hasOverageCredits(tenantID) {
        return ErrQuotaExceeded
    }
    chargeOverage(tenantID, quantity)
}
```

## API Key Prefixes (Product Identification)

Each API key starts with product prefix for instant product identification:

```
api_sk_abc123def...         → API product
dash_sk_xyz789uvw...        → Dashboard product (internal use)
sdk_sk_pqr456stu...         → SDK product
iframe_sk_lmn789opq...      → iFrame product
dataset_sk_jkl012mno...     → Dataset product
```

Middleware extracts prefix → identifies product → checks tier limits.

## Promo Codes

### Built-in Codes

| Code | Discount | Use | Expires |
|------|----------|-----|---------|
| AMLIQ_FREE | 100% | Testing/beta customers | End of month |
| EARLYBIRD | 50% | First 100 customers | End of Q1 |
| PARTNER | Custom | Integration partners | Per agreement |

### Promo Code Structure

```go
type PromoCode struct {
    Code      string      // "AMLIQ_FREE"
    Discount  float64     // 0.50 = 50% off
    AppliesTo []Product   // Which products? [] = all
    ExpiresAt time.Time
    MaxUses   int         // -1 = unlimited
    UsedCount int
}

// In checkout
if promoCode.AppliesTo == nil || contains(promoCode.AppliesTo, product) {
    basePrice := plan.Monthly
    discount := basePrice * promoCode.Discount
    final := basePrice - discount
}
```

## Seat Management (Dashboard Product)

### Seat Limit Per Tier

| Tier | Seats | Overage Cost |
|------|-------|--------------|
| Lite | 3 | $50/mo each |
| Pro | 10 | $50/mo each |
| Enterprise | Unlimited | N/A |

### Seat Lifecycle

```go
type Seat struct {
    ID      string
    SubID   SubscriptionID
    Email   string
    Role    SeatRole  // Admin, Analyst, Auditor
    Status  SeatStatus // Active, Invited, Revoked
}

// Add seat
subscription.AddSeat(Seat{
    Email: "analyst@bank.com",
    Role: domain.RoleAnalyst,
})

// Check limit
if subscription.SeatCount() > subscription.Plan.Tier.SeatLimit {
    chargeOverage()
}
```

## Invoice Generation

Monthly invoices auto-generated from usage records.

```go
type Invoice struct {
    ID              string
    TenantID        TenantID
    SubscriptionID  SubscriptionID
    Items           []InvoiceItem      // Subscription fee, overage
    Subtotal        float64
    Discount        float64            // Promo code discount
    Tax             float64            // If applicable
    Total           float64
    DueDate         time.Time
    PaidAt          *time.Time         // When paid
    Status          string             // Draft, Sent, Paid, Overdue
}

type InvoiceItem struct {
    Description string      // "API Pro (1M screenings)"
    Quantity    int
    UnitPrice   float64
    Amount      float64
}
```

### Sending Invoices

```bash
# Monthly cron job (1st of month)
for each subscription {
    usageThisMonth := usage.Sum(tenant, period)
    invoice := GenerateInvoice(subscription, usage)
    SendEmail(tenant.BillingEmail, invoice)
    MarkForPaymentCollection()
}
```

## Subscription Lifecycle

```
Start              ↓
    ↓
    Customer clicks Subscribe
    ↓
PendingPayment → (Stripe processes) → Active
    ↓                                    ↓
    ↓ (payment fails)          (API key works)
    Cancelled                  (Usage tracked)
                               ↓
                        (End of billing cycle)
                               ↓
                        Renew automatically?
                               ├─ Yes → Active (renewed)
                               └─ No → Expired
                                      ↓
                                   API disabled
```

## Testing with Stripe/LemonSqueezy

### Use Test Mode

```bash
# .env.test
LEMONSQUEEZY_API_KEY=test_xxx
LEMONSQUEEZY_WEBHOOK_SECRET=test_yyy
STRIPE_TEST_MODE=true
```

### Test Card Numbers

| Scenario | Card | Result |
|----------|------|--------|
| Success | 4242 4242 4242 4242 | Payment succeeds |
| Decline | 4000 0000 0000 0002 | Payment declined |
| Expires | 4000 0000 0000 0069 | Card expired |

### Test Subscriptions

```bash
# Create test subscription
curl -X POST https://api.lemonsqueezy.com/v1/subscriptions \
  -H "Authorization: Bearer test_key" \
  -d '{"customer_id": 1, "product_id": 123}'
```

## Add a New Product

1. Add to domain `Product` enum
2. Create pricing SKUs (Lite/Pro/Enterprise)
3. Create `Plan` records in database
4. Add usage metric to `UsageMetric` enum
5. Create handler to track usage
6. Update API key prefixes
7. Create documentation

## Add a New Product Tier

1. Define features in `PlanTierFeatures`
2. Create 5 plans (one per product) with new tier
3. Update pricing matrix
4. Update LemonSqueezy variant SKUs
5. Update middleware rate limit checks
6. Test quota enforcement

---

**Billing system via LemonSqueezy** (not homegrown). See `internal/billing/` for implementation details.
