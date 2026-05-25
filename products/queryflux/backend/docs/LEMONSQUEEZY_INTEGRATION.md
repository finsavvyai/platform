# Lemon Squeezy Payment Integration

This document describes the Lemon Squeezy payment integration implementation for QueryFlux.

## Overview

The Lemon Squeezy integration provides:
- Subscription management (Free, Pro Monthly, Pro Yearly, Enterprise)
- Feature gating based on subscription tiers
- Usage tracking and limits
- Webhook handling for real-time events
- Invoice generation and billing history
- Customer portal for self-service management

## Architecture

### Components

1. **Domain Entities** (`internal/domain/entities/`)
   - `subscription.go` - Subscription model with status tracking
   - `customer.go` - Customer information
   - `invoice.go` - Invoice and billing records

2. **Infrastructure** (`internal/infrastructure/lemonsqueezy/`)
   - `client.go` - HTTP client for Lemon Squeezy API
   - `subscriptions.go` - Subscription management operations
   - `webhooks.go` - Webhook event processing

3. **Services** (`internal/services/`)
   - `subscription_service.go` - Business logic for subscriptions
   - `invoice_service.go` - Invoice and billing logic

4. **HTTP Handlers** (`internal/server/`)
   - `handlers_subscriptions.go` - REST API endpoints
   - `middleware_subscription.go` - Feature gating middleware

## Database Schema

The integration adds the following tables:

- `customers` - Customer information
- `subscriptions` - Subscription records
- `invoices` - Billing invoices
- `subscription_usage_logs` - Usage tracking
- `webhook_events` - Webhook event logs
- `subscription_plans` - Available plan configurations

## API Endpoints

### Subscription Management

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/v1/subscriptions/checkout` | Create checkout URL | Yes |
| GET | `/api/v1/subscriptions/current` | Get current subscription | Yes |
| POST | `/api/v1/subscriptions/cancel` | Cancel subscription | Yes |
| POST | `/api/v1/subscriptions/pause` | Pause subscription | Yes |
| POST | `/api/v1/subscriptions/resume` | Resume subscription | Yes |
| POST | `/api/v1/subscriptions/change-plan` | Change subscription plan | Yes |
| GET | `/api/v1/subscriptions/usage` | Get usage statistics | Yes |
| GET | `/api/v1/subscriptions/check-access` | Check feature access | Yes |
| GET | `/api/v1/subscriptions/plans` | Get available plans | No |
| GET | `/api/v1/subscriptions/invoices` | Get billing history | Yes |
| GET | `/api/v1/subscriptions/invoices/:id` | Get specific invoice | Yes |

### Webhooks

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/v1/webhooks/lemonsqueezy` | Process Lemon Squeezy events | No (signature verified) |

## Configuration

Add the following to your environment variables:

```bash
# Lemon Squeezy Configuration
LEMONSQUEEZY_API_KEY=your_api_key_here
LEMONSQUEEZY_STORE_ID=your_store_id_here
LEMONSQUEEZY_WEBHOOK_SECRET=your_webhook_secret_here

# Webhook URL (set in Lemon Squeezy dashboard)
LEMONSQUEEZY_WEBHOOK_URL=https://your-domain.com/api/v1/webhooks/lemonsqueezy
```

## Subscription Tiers

### Free Plan
- Up to 3 database connections
- 100 queries per day
- 10 saved queries
- Basic query execution
- Export results
- Community support

### Pro Monthly ($29/month)
- Unlimited connections
- Unlimited queries
- AI-powered optimization
- Priority support
- Advanced analytics
- All Free features

### Pro Yearly ($290/year)
- All Pro Monthly features
- 2 months free
- Annual billing

### Enterprise (Custom Pricing)
- Everything in Pro
- Unlimited users
- SSO authentication
- Custom integrations
- Dedicated support
- SLA guarantee

## Feature Gating

The subscription middleware provides several ways to gate features:

```go
// Require specific feature
router.Use(middleware.RequireFeature("ai_optimization"))

// Require active subscription
router.Use(middleware.RequireActiveSubscription())

// Require minimum plan level
router.Use(middleware.RequirePlan("pro"))

// Check usage limits
router.Use(middleware.CheckUsageLimit())
```

## Webhook Events

The integration handles the following Lemon Squeezy events:

- `order_created` - Creates invoices
- `subscription_created` - Activates subscriptions
- `subscription_updated` - Updates subscription status
- `subscription_cancelled` - Cancels subscriptions
- `subscription_expired` - Marks subscriptions as expired
- `subscription_resumed` - Resumes paused subscriptions
- `subscription_paused` - Pauses subscriptions
- `payment_success` - Processes successful payments
- `payment_failed` - Handles failed payments

## Usage Tracking

The system tracks usage for:
- Number of queries executed
- Connections created
- AI features used
- API calls made

Usage resets at the billing period start.

## Testing

Run the tests with:

```bash
# Run all tests
go test ./...

# Run specific test suite
go test ./tests/unit/services/subscription_service_test.go
go test ./tests/unit/infrastructure/lemonsqueezy/...

# Run with coverage
go test -cover ./...
```

## Security Considerations

1. **Webhook Verification**: All webhooks are verified using HMAC signatures
2. **Rate Limiting**: API endpoints have rate limiting based on subscription
3. **Access Control**: Users can only access their own data
4. **Feature Gating**: Premium features require active subscription

## Error Handling

The integration provides detailed error responses:

```json
{
  "error": "feature_not_available",
  "message": "This feature is not available on your current plan",
  "data": {
    "feature": "ai_optimization",
    "upgrade_url": "/api/v1/subscriptions/plans"
  }
}
```

## Monitoring

Monitor these metrics:
- Subscription conversion rates
- Feature usage by plan
- Revenue growth
- Churn rate
- Webhook processing failures

## Migration

Run the database migration:

```sql
-- Migration file: migrations/20250114_create_subscriptions.sql
```

## Support

For issues with the Lemon Squeezy integration:
1. Check Lemon Squeezy dashboard for API status
2. Review webhook logs in the database
3. Check application logs for errors
4. Verify API keys and configuration