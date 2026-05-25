# LemonSqueezy Products Configuration Reference

Detailed product and variant configuration for AMLIQ AML Platform billing.

## Product Overview Table

| Product Name | LemonSqueezy ID | Annual Discount | Status |
|---|---|---|---|
| AMLIQ API Access | 654321 | 20% off | Active |
| AMLIQ Dashboard | 654322 | 20% off | Active |
| AMLIQ SDK | 654323 | 20% off | Active |
| AMLIQ iFrame Widget | 654324 | 20% off | Active |
| AMLIQ Dataset CSV | 654325 | 20% off | Active |

## Product 1: AMLIQ API Access (654321)

| Variant Name | Billing Cycle | Monthly Price | Annual Price | Variant ID |
|---|---|---|---|---|
| Starter | Monthly | $499 | $399.20/mo | 1001 |
| Starter Annual | Annual | - | $4,790.40/yr | 1001a |
| Pro | Monthly | $1,499 | $1,199.20/mo | 1002 |
| Pro Annual | Annual | - | $14,390.40/yr | 1002a |
| Enterprise | Custom | Contact Sales | Contact Sales | 1003 |

**Description:** Real-time API access for transaction screening and customer verification. Includes webhooks, batch processing, and priority support.

**Environment Variables:**
```
LEMONSQUEEZY_API_PRODUCT_ID=654321
LEMONSQUEEZY_API_STARTER_VARIANT=1001
LEMONSQUEEZY_API_PRO_VARIANT=1002
LEMONSQUEEZY_API_ENTERPRISE_VARIANT=1003
```

## Product 2: AMLIQ Dashboard (654322)

| Variant Name | Billing Cycle | Base Price | Per Seat | Variant ID |
|---|---|---|---|---|
| Base 5-Seat | Monthly | $299 | $49/mo ea | 1004 |
| Base 5-Seat Annual | Annual | $2,392/yr | $39.20/mo ea | 1004a |

**Description:** Web-based dashboard for case management, alert triage, compliance reporting, and team collaboration.

**Features:**
- Dashboard for up to 5 users
- Custom alerts and case management
- Compliance reports (SAR, STR, CTR)
- Activity audit logs
- Additional seats: $49/month each

**Environment Variables:**
```
LEMONSQUEEZY_DASH_PRODUCT_ID=654322
LEMONSQUEEZY_DASH_BASE_VARIANT=1004
LEMONSQUEEZY_DASH_SEAT_ADDON_VARIANT=1005
```

## Product 3: AMLIQ SDK (654323)

| Variant Name | Billing Cycle | Monthly Price | Annual Price | Variant ID |
|---|---|---|---|---|
| Starter | Monthly | $699 | $559.20/mo | 1006 |
| Starter Annual | Annual | - | $6,710.40/yr | 1006a |
| Pro | Monthly | $1,999 | $1,599.20/mo | 1007 |
| Pro Annual | Annual | - | $19,190.40/yr | 1007a |
| Enterprise | Custom | Contact Sales | Contact Sales | 1008 |

**Description:** Official client SDKs for Go, Python, JavaScript/Node.js, and Java. Includes API documentation, code examples, and developer support.

**Environment Variables:**
```
LEMONSQUEEZY_SDK_PRODUCT_ID=654323
LEMONSQUEEZY_SDK_STARTER_VARIANT=1006
LEMONSQUEEZY_SDK_PRO_VARIANT=1007
LEMONSQUEEZY_SDK_ENTERPRISE_VARIANT=1008
```

## Product 4: AMLIQ iFrame Widget (654324)

| Variant Name | Billing Cycle | Monthly Price | Verifications/mo | Variant ID |
|---|---|---|---|---|
| Basic | Monthly | $199 | 1,000 | 1009 |
| Basic Annual | Annual | $159.20/mo | 1,000 | 1009a |
| Pro | Monthly | $599 | 10,000 | 1010 |
| Pro Annual | Annual | $479.20/mo | 10,000 | 1010a |
| Enterprise | Custom | Contact Sales | Custom | 1011 |

**Description:** Drop-in embeddable KYC/AML widget for customer onboarding. White-labeled, mobile-responsive, PCI-compliant.

**Features:**
- Document verification
- Liveness detection
- Sanctions list screening
- Custom branding options
- Mobile-optimized UI

**Environment Variables:**
```
LEMONSQUEEZY_IFRAME_PRODUCT_ID=654324
LEMONSQUEEZY_IFRAME_BASIC_VARIANT=1009
LEMONSQUEEZY_IFRAME_PRO_VARIANT=1010
LEMONSQUEEZY_IFRAME_ENTERPRISE_VARIANT=1011
```

## Product 5: AMLIQ Dataset CSV (654325)

| Variant Name | Billing Cycle | Monthly Price | Annual Price | Variant ID |
|---|---|---|---|---|
| Standard | Monthly | $999 | $799.20/mo | 1012 |
| Standard Annual | Annual | - | $9,590.40/yr | 1012a |
| Premium | Monthly | $2,499 | $1,999.20/mo | 1013 |
| Premium Annual | Annual | - | $23,990.40/yr | 1013a |
| Enterprise | Custom | Contact Sales | Contact Sales | 1014 |

**Description:** Monthly CSV exports of screening datasets, sanctions lists, and PEP databases.

**Features:**
- Monthly updated datasets
- Multiple formats (CSV, JSON)
- Historical data (Premium only)
- Bulk download capability
- Custom filtering options

**Environment Variables:**
```
LEMONSQUEEZY_CSV_PRODUCT_ID=654325
LEMONSQUEEZY_CSV_STANDARD_VARIANT=1012
LEMONSQUEEZY_CSV_PREMIUM_VARIANT=1013
LEMONSQUEEZY_CSV_ENTERPRISE_VARIANT=1014
```

## Annual Pricing Strategy

All products offer **20% discount** for annual billing:
- Monthly: $100 → Annual: $960/year ($80/mo equivalent)
- Monthly: $499 → Annual: $4,790.40/year ($399.20/mo equivalent)
- Monthly: $1,499 → Annual: $14,390.40/year ($1,199.20/mo equivalent)

Create annual variants in LemonSqueezy with reduced price and billing cycle set to "Annual".

## Test Mode vs Live Mode

**Test Mode:**
- LemonSqueezy Dashboard → Settings → Toggle "Test Mode"
- Use test variant IDs (prefixed with `test_`)
- Transactions don't charge actual payment methods
- Useful for development and testing

**Live Mode:**
- Production variant IDs (no `test_` prefix)
- Real charges to customer payment methods
- Monitor billing_events table for webhook deliveries
- Verify Stripe/PayPal integration

## Implementation Notes

1. **Soft Deletes:** When plan changes detected, store variant history in user_subscriptions table
2. **Feature Gating:** Use variant_id to determine available features
3. **Usage Tracking:** Monitor API usage against plan limits
4. **Overage Handling:** Implement soft limits with warnings at 80%, hard limits at 100%
5. **Downgrade Protection:** Prevent downgrades if usage exceeds new plan limit

## Variant ID Lookup in Backend

```go
// Example: Determine plan tier from variant ID
func getPlanTier(variantID string) string {
    switch variantID {
    case "1001", "1001a": // API Starter
        return "starter"
    case "1002", "1002a": // API Pro
        return "pro"
    case "1003": // API Enterprise
        return "enterprise"
    // ... other variants
    default:
        return "free"
    }
}
```

## Next Steps

- Configure webhook events in `LEMONSQUEEZY_WEBHOOKS.md`
- Set up promo codes in `LEMONSQUEEZY_PROMO.md`
- Complete environment variables in `LEMONSQUEEZY_ENV.md`
