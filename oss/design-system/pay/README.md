# @finsavvyai/pay

Unified payment abstraction library for Stripe and LemonSqueezy with first-class TypeScript support.

## Features

- **Provider Abstraction**: Unified interface for Stripe and LemonSqueezy
- **Type Safety**: Strict TypeScript throughout with full type coverage
- **Dependency Injection**: Factory pattern for flexible provider instantiation
- **Webhook Handling**: Signature verification and event parsing for both providers
- **Plan Management**: Pre-defined plans with feature gating
- **Zero Dependencies**: Fetch-based API calls, no heavy SDK dependencies

## Installation

```bash
npm install @finsavvyai/pay
```

## Quick Start

### Create a Payment Client

```typescript
import { createPaymentClient } from '@finsavvyai/pay';

const stripe = createPaymentClient('stripe', {
  apiKey: process.env.STRIPE_API_KEY!,
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
});

const lemonsqueezy = createPaymentClient('lemonsqueezy', {
  apiKey: process.env.LEMONSQUEEZY_API_KEY!,
  webhookSecret: process.env.LEMONSQUEEZY_WEBHOOK_SECRET!,
});
```

Or use environment variables:

```typescript
import { createPaymentClientFromEnv } from '@finsavvyai/pay';

const stripe = createPaymentClientFromEnv('stripe');
```

### Create a Checkout Session

```typescript
const session = await stripe.createCheckout({
  customerId: 'cus_123',
  priceId: 'price_pro_monthly',
  successUrl: 'https://example.com/success',
  cancelUrl: 'https://example.com/cancel',
});

console.log(session.url); // Redirect user to checkout
```

### Manage Subscriptions

```typescript
// Get subscription
const subscription = await stripe.getSubscription('sub_123');
console.log(subscription.status); // 'active', 'cancelled', etc.

// Cancel subscription
await stripe.cancelSubscription('sub_123');
```

### Handle Webhooks

```typescript
import { WebhookHandler } from '@finsavvyai/pay';

const handler = new WebhookHandler({
  provider: 'stripe',
  secret: process.env.STRIPE_WEBHOOK_SECRET!,
});

// In your webhook endpoint:
const event = await handler.handle(req.headers['stripe-signature'], req.body);

switch (event.type) {
  case 'subscription.created':
    console.log('New subscription:', event.data);
    break;
  case 'payment.succeeded':
    console.log('Payment processed:', event.data);
    break;
}
```

### Feature Gating

```typescript
import { canAccessFeature, getAvailableFeatures } from '@finsavvyai/pay';

const userPlan = 'pro';

if (canAccessFeature(userPlan, 'api_access')) {
  // Enable API endpoint
}

const features = getAvailableFeatures('starter');
// ['basic_budgeting', 'account_tracking', ...]
```

## Plan Tiers

### Starter ($29/month)
- Up to 5 accounts
- Basic budgeting
- Transaction tracking
- Email support

### Pro ($79/month)
- Unlimited accounts
- Advanced analytics
- Investment tracking
- Tax reports
- API access
- Priority support

### Enterprise ($299/month)
- Everything in Pro
- Custom integrations
- Dedicated account manager
- SLA guarantee
- Advanced security
- White-label options

## Architecture

### Type System

- `PaymentProvider`: Base interface all providers implement
- `CheckoutOptions`, `CheckoutSession`: Checkout workflow types
- `Subscription`: Subscription state
- `WebhookEvent`: Typed webhook events

### Providers

- `StripeClient`: Stripe API wrapper
- `LemonSqueezyClient`: LemonSqueezy API wrapper
- Both implement `PaymentProvider` interface

### Webhook System

- `WebhookHandler`: Provider-agnostic webhook handling
- `signature.ts`: HMAC-SHA256 verification for both providers
- Automatic event type mapping and parsing

### Plans

- `definitions.ts`: Pre-defined tier configurations
- `feature-gate.ts`: Feature access control matrix
- Support for Stripe price IDs and LemonSqueezy variant IDs

## Testing

All code is tested with vitest. Run tests:

```bash
npm test
```

Coverage:
- 62 unit tests across 5 test files
- Mocked HTTP calls (no real API calls)
- All core functionality covered

## Error Handling

```typescript
import { PaymentError, WebhookSignatureError } from '@finsavvyai/pay';

try {
  await client.createCheckout(opts);
} catch (error) {
  if (error instanceof PaymentError) {
    console.error(`[${error.code}] ${error.message}`);
  }
}
```

## API Reference

See TypeScript definitions in `src/types.ts` for complete interface documentation.

## License

MIT
