# LemonSqueezy Promo Code Setup Guide

Guide for creating, managing, and testing promotional discount codes in LemonSqueezy for AMLIQ products.

## Creating Promo Codes via Dashboard

### Step 1: Access Discounts Section

1. Log into LemonSqueezy Dashboard
2. Navigate to **Products** → **Discounts**
3. Click **Create Discount**

### Step 2: Create AMLIQ_FREE Code

Use case: Testing and internal staff accounts

- **Code:** `AMLIQ_FREE`
- **Type:** Percentage discount
- **Percentage:** 100%
- **Duration:** Forever (no expiration)
- **Applies to:** All products
- **Max uses:** Unlimited (or set limit for staff)
- **Notes:** For testing and internal use only

### Step 3: Create AMLIQ_LAUNCH Code

Use case: Launch promotional discount for early customers

- **Code:** `AMLIQ_LAUNCH`
- **Type:** Percentage discount
- **Percentage:** 30%
- **Duration:** Limited time (expires in 3 months)
- **Start Date:** Today
- **End Date:** +90 days
- **Applies to:** All products
- **Max uses:** 500 (limit early-bird benefit)
- **Notes:** Launch promotion - 30% off all plans for 3 months

### Step 4: Create AMLIQ_PARTNER Code

Use case: Partner and reseller discounts

- **Code:** `AMLIQ_PARTNER`
- **Type:** Percentage discount
- **Percentage:** 25%
- **Duration:** Forever
- **Applies to:** All products
- **Max uses:** Unlimited
- **Min subscription value:** $100/month (prevents abuse)
- **Notes:** Partner/reseller pricing

### Step 5: Create AMLIQ_NONPROFIT Code

Use case: Nonprofit/NGO/academic institutions

- **Code:** `AMLIQ_NONPROFIT`
- **Type:** Percentage discount
- **Percentage:** 50%
- **Duration:** Forever
- **Applies to:** All products
- **Max uses:** Unlimited
- **Notes:** Nonprofit pricing - requires verification

## Creating Promo Codes via API

Use LemonSqueezy API for programmatic promo code creation:

```bash
curl -X POST https://api.lemonsqueezy.com/v1/discounts \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "type": "discounts",
      "attributes": {
        "name": "AMLIQ Summer Sale",
        "code": "AMLIQ_SUMMER",
        "discount_type": "percentage",
        "discount_value": 15,
        "duration": "repeating",
        "duration_in_months": 3,
        "max_uses": 1000,
        "starts_at": "2026-06-01T00:00:00Z",
        "expires_at": "2026-08-31T23:59:59Z"
      },
      "relationships": {
        "products": {
          "data": [
            {"type": "products", "id": "654321"},
            {"type": "products", "id": "654322"},
            {"type": "products", "id": "654323"},
            {"type": "products", "id": "654324"},
            {"type": "products", "id": "654325"}
          ]
        }
      }
    }
  }'
```

## Promo Code Validation in Backend

### Validation Endpoint

AMLIQ backend receives promo code at checkout and validates:

```go
// POST /api/v1/billing/promo-validate
type ValidatePromoRequest struct {
    Code         string `json:"code" binding:"required"`
    CustomerEmail string `json:"email" binding:"required,email"`
}

type ValidatePromoResponse struct {
    Valid        bool    `json:"valid"`
    Discount     float64 `json:"discount"` // 0.30 for 30% off
    Message      string  `json:"message"`
    ExpiresAt    *time.Time `json:"expires_at"`
}
```

### Validation Logic

1. Lookup code in `promo_codes` table
2. Check if code is active (not expired, use limit not reached)
3. Check if code applies to selected product
4. Check customer eligibility (if applicable)
5. Return discount percentage and validity
6. Store used code + customer email for deduplication

### Sample Validation Code

```go
func (svc *BillingService) ValidatePromoCode(ctx context.Context, code, customerEmail string) (*PromoValidation, error) {
    // Lookup in cache first
    cached, err := svc.redis.Get(ctx, fmt.Sprintf("promo:%s", code)).Result()
    if err == nil {
        return parsePromoValidation(cached), nil
    }

    // Query database
    var promo PromoCode
    if err := svc.db.Where("code = ? AND is_active = ?", strings.ToUpper(code), true).First(&promo).Error; err != nil {
        return nil, fmt.Errorf("promo code not found")
    }

    // Check expiration
    if promo.ExpiresAt != nil && time.Now().After(*promo.ExpiresAt) {
        return nil, fmt.Errorf("promo code expired")
    }

    // Check max uses
    if promo.MaxUses > 0 {
        var usedCount int64
        svc.db.Model(&PromoCodeUsage{}).Where("promo_code_id = ?", promo.ID).Count(&usedCount)
        if usedCount >= int64(promo.MaxUses) {
            return nil, fmt.Errorf("promo code max uses exceeded")
        }
    }

    // Cache result for 1 hour
    svc.redis.SetEX(ctx, fmt.Sprintf("promo:%s", code), encodePromoValidation(&promo), time.Hour)

    return &PromoValidation{
        Valid:    true,
        Discount: promo.DiscountPercentage,
        ExpiresAt: promo.ExpiresAt,
    }, nil
}
```

## Testing Promo Codes

### In Development (Test Mode)

1. Set LemonSqueezy test mode: `LEMONSQUEEZY_TEST_MODE=true`
2. Use test variant IDs in checkout
3. Apply AMLIQ_FREE or AMLIQ_LAUNCH codes
4. Verify discount applied in test payment

### Local Testing with ngrok

For webhook testing with promo codes:

```bash
# Start ngrok tunnel
ngrok http 8080

# Update LemonSqueezy webhook URL to ngrok URL
https://abc123def456.ngrok.io/webhooks/lemonsqueezy

# Create test subscription with promo code via API
curl -X POST https://api.lemonsqueezy.com/v1/checkouts \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "data": {
      "type": "checkouts",
      "attributes": {
        "product_id": 654321,
        "variant_id": 1001,
        "customer_email": "test@example.com",
        "discount_code": "AMLIQ_LAUNCH"
      }
    }
  }'

# Monitor webhook receipt in logs
tail -f logs/webhooks.log | grep billing_events
```

## Testing Scenarios

### Scenario 1: Valid Code Applied

1. Customer enters promo code at checkout
2. Validate endpoint returns `valid: true`, `discount: 0.30`
3. Checkout applies 30% discount to total
4. Subscription created with discount metadata
5. Webhook received, discount stored in `promo_code_usage` table

### Scenario 2: Expired Code

1. Customer enters expired promo code
2. Validate endpoint returns `valid: false`, `message: "promo code expired"`
3. Checkout form shows error message
4. Customer must remove code or choose different code

### Scenario 3: Max Uses Exceeded

1. Promo code has 100 max uses, already used 100 times
2. Validate endpoint returns `valid: false`, `message: "promo code max uses exceeded"`
3. Checkout form shows error message

### Scenario 4: Code Not Found

1. Customer enters non-existent code
2. Validate endpoint returns `valid: false`, `message: "promo code not found"`
3. Checkout form shows error message

## Tracking Promo Usage

### Database Schema

```sql
CREATE TABLE promo_codes (
    id BIGINT PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    discount_type VARCHAR(20), -- 'percentage' or 'fixed'
    discount_value DECIMAL(10, 2),
    max_uses INT,
    is_active BOOLEAN DEFAULT true,
    starts_at TIMESTAMP,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE promo_code_usage (
    id BIGINT PRIMARY KEY,
    promo_code_id BIGINT REFERENCES promo_codes(id),
    subscription_id BIGINT REFERENCES subscriptions(id),
    customer_email VARCHAR(255),
    discount_amount DECIMAL(10, 2),
    used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Reporting

Promo code usage dashboard:
- Query `promo_code_usage` grouped by `promo_code_id`
- Sum discounts given per code
- Track adoption rate (number of subscriptions using code)
- Identify top performing codes

## Deactivating Promo Codes

### Via Dashboard

1. Dashboard → Products → Discounts
2. Select code
3. Click **Deactivate** (sets `is_active = false`)
4. Confirm deactivation

### Via API

```bash
curl -X PATCH https://api.lemonsqueezy.com/v1/discounts/12345 \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "data": {
      "type": "discounts",
      "attributes": {
        "is_active": false
      }
    }
  }'
```

## Best Practices

1. **Avoid Stacking:** Only allow one promo code per subscription
2. **Clear Expiration:** Always set end dates for time-limited codes
3. **Monitor Abuse:** Set reasonable max uses and min subscription values
4. **Test Thoroughly:** Test each code in both test and live environments
5. **Document Codes:** Keep internal wiki with active codes and their purposes
6. **Audit Trail:** Log all promo code usage for compliance/accounting
7. **Cache Wisely:** Cache validation results to avoid database hits
8. **Communicate Clearly:** Set clear T&Cs on coupon pages

## Common Codes

| Code | Discount | Duration | Use Case | Status |
|---|---|---|---|---|
| AMLIQ_FREE | 100% | Forever | Testing | Active |
| AMLIQ_LAUNCH | 30% | 3 months | Launch | Active (expires 90 days) |
| AMLIQ_PARTNER | 25% | Forever | Partners | Active |
| AMLIQ_NONPROFIT | 50% | Forever | Nonprofits | Active |

## Next Steps

- Implement validation endpoint in backend
- Store promo usage in billing_events and promo_code_usage tables
- Create admin dashboard for promo code management
- Set up alerts for near-limit codes (e.g., 90% of max uses reached)
