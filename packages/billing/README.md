# @finsavvyai/billing

## SPEC PACKAGE

This package is the canonical SPECIFICATION + reference implementation for
billing primitives (webhooks, money math, entitlements, orchestration).
Products do NOT import from this package at runtime (round-2 isolation rule:
`products/*` must not import `@finsavvyai/*`).
Products MAY copy types or mirror logic from here; any drift is reviewed
against this source of truth.

See [SPEC.md](./SPEC.md) for the contract reference.

---

Provider-agnostic billing primitives: webhook verification, payment
orchestration, invoicing, subscriptions, entitlements.

## Surface

### Providers

- `verifyStripeWebhook(rawBody, headers, opts)` — constant-time HMAC-SHA256
  over `${t}.${body}` per Stripe's signing scheme, with multi-`v1` rotation
  support and replay tolerance.
- `verifyLemonSqueezyWebhook(rawBody, headers, opts)` — constant-time
  HMAC-SHA256 over the raw body, with optional replay window when an
  `X-Event-Timestamp` header is proxied through.

Both verifiers are transport-agnostic (no HTTP client, no SDK) and live
under `src/providers/<name>/`.

### Orchestration

Provider-agnostic flows that wrap an injected `PaymentGateway`:

- `charge(req, { gateway })`
- `refund(req, { gateway })`
- `createSubscription(req, { gateway })`
- `cancelSubscription(req, { gateway })`

All mutations require an `idempotencyKey`. Errors from the underlying
provider surface as a stable `ProviderError` so callers don't need to catch
provider-specific exception types.

### Invoicing

Pure money math in integer minor units only — never floats:

- `money(amount, currency)`, `zero(currency)`
- `addMoney`, `subtractMoney`, `multiplyByQuantity`, `sumMoney`
- `applyTaxRate(base, rate)` — banker's rounding to minor units
- `buildInvoice(input)`, `computeTotals(input)`, `lineTotal(item)`
- `assertTotalsConsistent(invoice)` — defense-in-depth check before issue

### Entitlements

- `StaticEntitlements` — single-plan checker
- `resolveEntitlements(store, customerId)` — most-permissive merge across
  active/trialing subscriptions, via an injected `Store` interface

### Errors (stable `code` strings, part of the public contract)

- `billing.webhook.signature_invalid`
- `billing.webhook.event_not_allowed`
- `billing.webhook.replay`
- `billing.entitlement.missing`
- `billing.invoice.totals_mismatch`
- `billing.invoice.line_item_invalid`
- `billing.money.currency_mismatch`
- `billing.orchestration.idempotency_key_required`
- `billing.provider.error`

## Critical paths (100% coverage)

- Stripe + LemonSqueezy webhook signature verification
- Invoice subtotal / tax / total computation and consistency check
- Money arithmetic (no float currency anywhere)
- Entitlement decisions

## Not in scope

- Concrete `PaymentGateway` implementations for Stripe / LemonSqueezy.
  Implement against the exported `PaymentGateway` interface in the calling
  service — keeps the SDK reachable without pulling in vendor SDKs.
- Persistence. `Store` and gateways are interfaces; wire them to whatever
  database or KV your service uses.
- Invoice PDF rendering. Compute totals here, render in a separate package.

## Deprecations

- `import … from "@finsavvyai/billing/lemonsqueezy-webhook.js"` — moved
  under `providers/lemonsqueezy/`. The old path re-exports for one release;
  prefer the new path or the package root export.
