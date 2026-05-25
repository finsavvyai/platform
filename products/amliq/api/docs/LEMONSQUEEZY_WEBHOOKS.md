# LemonSqueezy Webhooks Integration Reference

Complete reference for handling LemonSqueezy webhook events in AMLIQ backend.

## Supported Event Types

AMLIQ subscribes to the following LemonSqueezy webhook events:

| Event Type | Trigger | AMLIQ Action |
|---|---|---|
| `subscription_created` | New subscription purchased | Create user_subscription record |
| `subscription_updated` | Plan change, billing info updated | Update subscription details |
| `subscription_payment_success` | Successful payment processed | Update next_billing_date, reset retries |
| `subscription_payment_failed` | Payment declined or failed | Increment retry counter, send alert |
| `subscription_cancelled` | Subscription cancelled | Mark subscription inactive, disable features |
| `order_created` | One-time purchase completed | Create order record, grant access |

## Webhook URL Configuration

Configure in LemonSqueezy Dashboard:

- **Endpoint:** `https://api.amliq.finance/webhooks/lemonsqueezy`
- **Method:** `POST`
- **Content-Type:** `application/json`
- **Signature Header:** `X-Signature`

## Request Signature Verification

Every webhook request includes an `X-Signature` header containing an HMAC-SHA256 signature.

### Verification Algorithm

1. Extract raw request body (bytes)
2. Get `X-Signature` header value
3. Compute HMAC-SHA256 using webhook secret as key
4. Compare computed signature with header value (use constant-time comparison)
5. Reject if signatures don't match (potential forgery)

### Go Implementation

```go
import (
    "crypto/hmac"
    "crypto/sha256"
    "encoding/hex"
    "io"
    "net/http"
)

func verifyWebhookSignature(r *http.Request, secret string) ([]byte, error) {
    // Read body
    body, err := io.ReadAll(r.Body)
    if err != nil {
        return nil, err
    }
    defer r.Body.Close()

    // Get signature header
    signature := r.Header.Get("X-Signature")
    if signature == "" {
        return nil, fmt.Errorf("missing X-Signature header")
    }

    // Compute HMAC
    h := hmac.New(sha256.New, []byte(secret))
    h.Write(body)
    expectedSignature := hex.EncodeToString(h.Sum(nil))

    // Constant-time comparison
    if !hmac.Equal([]byte(signature), []byte(expectedSignature)) {
        return nil, fmt.Errorf("invalid signature")
    }

    return body, nil
}
```

## Event Payload Structure

All webhooks follow this structure:

```json
{
  "meta": {
    "event_name": "subscription_created",
    "webhook_id": "wb_abc123",
    "timestamp": "2026-03-26T12:34:56Z"
  },
  "data": {
    "type": "subscriptions",
    "id": "sub_12345",
    "attributes": {
      "customer_id": "cus_99999",
      "order_id": "ord_88888",
      "product_id": "654321",
      "variant_id": "1001",
      "user_name": "John Doe",
      "user_email": "john@example.com",
      "status": "active",
      "status_formatted": "Active",
      "pause_at": null,
      "cancelled_at": null,
      "billing_anchor": 26,
      "first_subscription_item": {
        "id": "sub_item_11111",
        "price_id": "pri_22222",
        "quantity": 1,
        "is_usage_based": false
      },
      "urls": {
        "update_payment_method": "https://...",
        "customer_portal": "https://..."
      },
      "renews_at": "2026-04-26T12:34:56Z",
      "ends_at": null,
      "created_at": "2026-03-26T12:34:56Z",
      "updated_at": "2026-03-26T12:34:56Z"
    }
  }
}
```

## Handling Specific Events

### 1. subscription_created

New customer purchased a subscription.

**Action:**
```go
func handleSubscriptionCreated(webhook *WebhookPayload) error {
    sub := webhook.Data.Attributes

    // Create user if not exists
    user, err := findOrCreateUser(sub.UserEmail, sub.UserName)
    if err != nil {
        return err
    }

    // Create subscription record
    userSub := &UserSubscription{
        UserID:           user.ID,
        LSSubscriptionID: webhook.Data.ID,
        LSProductID:      sub.ProductID,
        LSVariantID:      sub.VariantID,
        Status:           sub.Status,
        RenewsAt:         sub.RenewsAt,
        EndsAt:           sub.EndsAt,
        CreatedAt:        time.Now(),
        UpdatedAt:        time.Now(),
    }

    if err := db.Create(userSub).Error; err != nil {
        return err
    }

    // Grant features based on plan
    if err := grantPlanFeatures(user.ID, sub.VariantID); err != nil {
        return err
    }

    // Send welcome email
    return email.SendWelcomeEmail(user.Email, sub.VariantID)
}
```

**Database Update:**
```sql
INSERT INTO user_subscriptions (
  user_id, ls_subscription_id, ls_product_id, ls_variant_id,
  status, renews_at, ends_at, created_at, updated_at
) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW());

INSERT INTO billing_events (
  subscription_id, event_type, event_data, created_at
) VALUES (LAST_INSERT_ID(), 'subscription_created', ?, NOW());
```

### 2. subscription_updated

Customer modified subscription (plan change, quantity update, etc.)

**Action:**
```go
func handleSubscriptionUpdated(webhook *WebhookPayload) error {
    sub := webhook.Data.Attributes

    // Load existing subscription
    userSub := &UserSubscription{}
    if err := db.Where("ls_subscription_id = ?", webhook.Data.ID).First(userSub).Error; err != nil {
        return err
    }

    // Check if plan changed
    planChanged := userSub.LSVariantID != sub.VariantID

    // Update subscription
    updates := map[string]interface{}{
        "status":      sub.Status,
        "ls_variant_id": sub.VariantID,
        "renews_at":   sub.RenewsAt,
        "ends_at":     sub.EndsAt,
        "updated_at":  time.Now(),
    }

    if err := db.Model(userSub).Updates(updates).Error; err != nil {
        return err
    }

    // If plan changed, grant/revoke features
    if planChanged {
        if err := revokePlanFeatures(userSub.UserID, userSub.LSVariantID); err != nil {
            return err
        }
        if err := grantPlanFeatures(userSub.UserID, sub.VariantID); err != nil {
            return err
        }
    }

    // Send notification email
    return email.SendPlanUpdatedEmail(userSub.User.Email, sub.VariantID)
}
```

### 3. subscription_payment_success

Payment processed successfully.

**Action:**
```go
func handlePaymentSuccess(webhook *WebhookPayload) error {
    sub := webhook.Data.Attributes

    userSub := &UserSubscription{}
    if err := db.Where("ls_subscription_id = ?", webhook.Data.ID).First(userSub).Error; err != nil {
        return err
    }

    // Update next billing date
    updates := map[string]interface{}{
        "status":                 "active",
        "next_billing_date":      sub.RenewsAt,
        "payment_failed_count":   0,
        "payment_failed_at":      nil,
        "updated_at":             time.Now(),
    }

    if err := db.Model(userSub).Updates(updates).Error; err != nil {
        return err
    }

    // Re-enable features if previously disabled
    return enablePlanFeatures(userSub.UserID)
}
```

### 4. subscription_payment_failed

Payment failed/declined.

**Action:**
```go
func handlePaymentFailed(webhook *WebhookPayload) error {
    sub := webhook.Data.Attributes

    userSub := &UserSubscription{}
    if err := db.Where("ls_subscription_id = ?", webhook.Data.ID).First(userSub).Error; err != nil {
        return err
    }

    // Increment retry counter
    failedCount := userSub.PaymentFailedCount + 1
    updates := map[string]interface{}{
        "payment_failed_count": failedCount,
        "payment_failed_at":    time.Now(),
        "updated_at":           time.Now(),
    }

    if err := db.Model(userSub).Updates(updates).Error; err != nil {
        return err
    }

    // Disable features if 3+ failures
    if failedCount >= 3 {
        if err := disablePlanFeatures(userSub.UserID); err != nil {
            return err
        }
    }

    // Send retry notification email
    return email.SendPaymentFailedEmail(
        userSub.User.Email,
        failedCount,
        sub.URLs.UpdatePaymentMethod, // LemonSqueezy payment update URL
    )
}
```

### 5. subscription_cancelled

Customer cancelled subscription.

**Action:**
```go
func handleSubscriptionCancelled(webhook *WebhookPayload) error {
    sub := webhook.Data.Attributes

    userSub := &UserSubscription{}
    if err := db.Where("ls_subscription_id = ?", webhook.Data.ID).First(userSub).Error; err != nil {
        return err
    }

    // Update subscription
    updates := map[string]interface{}{
        "status":     "cancelled",
        "ended_at":   sub.CancelledAt,
        "updated_at": time.Now(),
    }

    if err := db.Model(userSub).Updates(updates).Error; err != nil {
        return err
    }

    // Disable all plan features
    if err := disablePlanFeatures(userSub.UserID); err != nil {
        return err
    }

    // Send cancellation confirmation
    return email.SendCancellationConfirmEmail(userSub.User.Email)
}
```

### 6. order_created

One-time purchase completed (non-subscription).

**Action:**
```go
func handleOrderCreated(webhook *WebhookPayload) error {
    order := webhook.Data.Attributes

    // Create order record
    newOrder := &Order{
        LSOrderID:    webhook.Data.ID,
        LSProductID:  order.ProductID,
        CustomerName: order.CustomerName,
        CustomerEmail: order.CustomerEmail,
        Amount:       order.TotalFormatted,
        Status:       order.Status,
        CreatedAt:    time.Now(),
    }

    if err := db.Create(newOrder).Error; err != nil {
        return err
    }

    // Send order confirmation
    return email.SendOrderConfirmation(order.CustomerEmail, webhook.Data.ID)
}
```

## Webhook Retry Policy

LemonSqueezy retries failed webhooks automatically:

- **1st attempt:** Immediate
- **2nd attempt:** 5 minutes later
- **3rd attempt:** 30 minutes later
- **After 3 failures:** Webhook marked as failed, manual review needed

**AMLIQ Response Requirements:**
- Return HTTP 200 on success
- Return HTTP 200 even if event already processed (idempotent)
- Don't throw errors for recoverable issues
- Response must be within 30 seconds

## Idempotency & Deduplication

Implement idempotent webhook handling using event deduplication:

```go
// Check if webhook already processed
var existingEvent BillingEvent
if err := db.Where("event_id = ?", webhook.Meta.WebhookID).First(&existingEvent).Error; err == nil {
    // Event already processed, return success
    return nil
}

// Process event...

// Store event receipt
billingEvent := &BillingEvent{
    EventID:   webhook.Meta.WebhookID,
    EventType: webhook.Meta.EventName,
    EventData: marshaled,
    CreatedAt: time.Now(),
}
db.Create(billingEvent)
```

## Testing Webhooks Locally

### Option 1: LemonSqueezy CLI

```bash
# Download LemonSqueezy CLI
curl -fsSL https://cli.lemonsqueezy.com/install.sh | sh

# Start tunnel to local backend
lemonsqueezy webhook forward http://localhost:8080/webhooks/lemonsqueezy

# Dashboard will show tunnel URL - use that as webhook endpoint
```

### Option 2: ngrok

```bash
# Start ngrok tunnel
ngrok http 8080

# Update LemonSqueezy webhook URL to:
# https://abc123.ngrok.io/webhooks/lemonsqueezy

# Test webhook delivery
curl -X POST https://abc123.ngrok.io/webhooks/lemonsqueezy \
  -H "X-Signature: $(echo -n 'body' | openssl dgst -sha256 -hmac 'secret' | xxd -r -p | base64)" \
  -H "Content-Type: application/json" \
  -d @webhook_payload.json
```

## Debugging Webhooks

### Check Webhook Delivery Status

In LemonSqueezy Dashboard:
1. Settings → Webhooks
2. Select webhook
3. View → see delivery history with timestamps and responses

### Check AMLIQ Billing Events Table

```sql
-- View all received webhook events
SELECT * FROM billing_events ORDER BY created_at DESC LIMIT 20;

-- Check for failed events
SELECT * FROM billing_events WHERE status = 'failed';

-- Count events by type
SELECT event_type, COUNT(*) FROM billing_events GROUP BY event_type;
```

### Enable Webhook Logging

In AMLIQ backend:

```go
// Middleware to log all webhook requests
func loggingMiddleware(c *gin.Context) {
    body, _ := io.ReadAll(c.Request.Body)
    c.Request.Body = io.NopCloser(bytes.NewReader(body))

    log.WithFields(log.Fields{
        "event": c.Request.Header.Get("X-Webhook-Event"),
        "body": string(body),
        "signature": c.Request.Header.Get("X-Signature"),
    }).Info("Webhook received")

    c.Next()
}
```

## Webhook Payload Examples

### subscription_created Payload

```json
{
  "meta": {
    "event_name": "subscription_created",
    "webhook_id": "wb_test123"
  },
  "data": {
    "id": "sub_123456",
    "attributes": {
      "user_email": "john@example.com",
      "user_name": "John Doe",
      "product_id": "654321",
      "variant_id": "1001",
      "status": "active",
      "renews_at": "2026-04-26T12:34:56Z"
    }
  }
}
```

### subscription_payment_failed Payload

```json
{
  "meta": {
    "event_name": "subscription_payment_failed",
    "webhook_id": "wb_test456"
  },
  "data": {
    "id": "sub_123456",
    "attributes": {
      "user_email": "john@example.com",
      "status": "past_due",
      "urls": {
        "update_payment_method": "https://checkout.lemonsqueezy.com/..."
      }
    }
  }
}
```

## Production Checklist

- [ ] Webhook URL configured in LemonSqueezy
- [ ] Webhook secret stored in `LEMONSQUEEZY_WEBHOOK_SECRET` env var
- [ ] Signature verification implemented and tested
- [ ] All 6 event types handled (subscription_created, updated, payment_success, payment_failed, cancelled, order_created)
- [ ] Idempotency/deduplication implemented
- [ ] Error logging in place
- [ ] Retry logic handles failures gracefully
- [ ] Database migrations for `billing_events` table
- [ ] Webhook logs monitored in production
- [ ] Alerting configured for failed webhooks
- [ ] Tested with real LemonSqueezy account in test mode

## Next Steps

- Implement webhook handler in `cmd/webhooks/lemonsqueezy.go`
- Create database migrations for billing tables
- Set up monitoring/alerting for webhook failures
