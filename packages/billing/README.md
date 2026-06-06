# @finsavvyai/billing

Billing primitives. LemonSqueezy adapter, subscriptions, entitlements.

Exports:

- `StaticEntitlements`
- `transitionSubscription`
- `InMemorySubscriptionStore`
- `AdapterSubscriptionStore`
- `createLemonSqueezySignature`
- `verifyLemonSqueezyWebhookSignature`
- `assertVerifiedLemonSqueezyWebhook`
- types: `Money`, `Plan`, `Subscription`, `Entitlement`, `EntitlementChecker`, `SubscriptionStore`

## Critical paths

- Subscription state writes — 100% coverage.
- Webhook signature verification — 100% coverage.
- Entitlement decisions — 100% coverage.

## LemonSqueezy webhook gate

Verify the raw request body before parsing or mutating subscription state:

```ts
await assertVerifiedLemonSqueezyWebhook({
  rawBody,
  secret: process.env.LEMONSQUEEZY_WEBHOOK_SECRET!,
  signature: request.headers.get("X-Signature"),
});
```

`verifyLemonSqueezyWebhookSignature` computes the LemonSqueezy-compatible
HMAC-SHA256 hex digest over the raw body and compares it with a timing-safe
string comparison.
