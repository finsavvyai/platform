# SPEC — @finsavvyai/billing

## Contract overview

This package is the canonical contract for billing primitives across the
FinsavvyAI portfolio: webhook signature verification (Stripe, LemonSqueezy),
money math in integer minor units, invoice totals, payment orchestration
(`charge` / `refund` / `subscription`) and entitlement resolution. Because
`products/*` cannot import `@finsavvyai/*` at runtime (round-2 isolation),
products mirror these shapes and error codes locally; this spec is the
canonical source they are validated against.

## Public surface

From `src/types.ts`:

- `Currency` — `"USD" | "EUR" | "GBP" | "ILS"`.
- `Money` — `{ amountMinor, currency }` (minor units, never floats).
- Branded ids: `PlanId`, `CustomerId`, `SubscriptionId`.
- `Plan`, `Entitlement`, `Subscription`, `SubscriptionStatus`.
- `EntitlementChecker` interface (`has`, `remaining`).

From `src/providers/stripe/`:

- `verifyStripeWebhook(rawBody, headers, opts)` — constant-time HMAC-SHA256
  over `${t}.${body}`, multi-`v1` rotation, replay tolerance.

From `src/providers/lemonsqueezy/`:

- `verifyLemonSqueezyWebhook(rawBody, headers, opts)` — constant-time
  HMAC-SHA256 over the raw body, optional replay window via
  `X-Event-Timestamp`.

From `src/orchestration/`:

- `charge(req, { gateway })`, `refund(req, { gateway })`,
  `createSubscription(req, { gateway })`, `cancelSubscription(req, { gateway })`.
- `PaymentGateway` interface — injected by consumer.
- All mutations require `idempotencyKey`.

From `src/invoicing/`:

- `money(amount, currency)`, `zero(currency)`.
- `addMoney`, `subtractMoney`, `multiplyByQuantity`, `sumMoney`.
- `applyTaxRate(base, rate)` — banker's rounding to minor units.
- `buildInvoice(input)`, `computeTotals(input)`, `lineTotal(item)`.
- `assertTotalsConsistent(invoice)`.

From `src/entitlements.ts` and `src/entitlement-resolver.ts`:

- `StaticEntitlements` — single-plan checker.
- `resolveEntitlements(store, customerId)` — most-permissive merge across
  active/trialing subscriptions.

From `src/errors.ts`:

- Base: `BillingError` (always carries stable `code`).
- Subclasses: `WebhookSignatureError`, `WebhookEventNotAllowedError`,
  `WebhookReplayError`, `BillingEntitlementMissingError`,
  `InvoiceTotalsMismatchError`, `InvoiceLineItemInvalidError`,
  `CurrencyMismatchError`, `IdempotencyKeyRequiredError`, `ProviderError`.

## Stable error codes

These strings are part of the public contract; consumers switch on them.
Renaming requires a major bump and an addendum.

- `billing.webhook.signature_invalid`
- `billing.webhook.event_not_allowed`
- `billing.webhook.replay`
- `billing.entitlement.missing`
- `billing.invoice.totals_mismatch`
- `billing.invoice.line_item_invalid`
- `billing.money.currency_mismatch`
- `billing.orchestration.idempotency_key_required`
- `billing.provider.error`

## Invariants

1. **Currency is integer minor units.** No floats anywhere in money math.
   Cross-currency arithmetic is forbidden — throw `CurrencyMismatchError`.
2. **Webhook verification is constant-time.** Implementations MUST use
   `crypto.timingSafeEqual` or `crypto.subtle`-backed equivalent. Early
   return on length mismatch is allowed only if it does not leak the secret.
3. **Replay protection is mandatory** for Stripe; optional but recommended
   for LemonSqueezy. Reject events outside the configured window.
4. **All orchestration mutations require `idempotencyKey`.** Missing key
   throws `IdempotencyKeyRequiredError` before any provider call.
5. **Tax rounding is banker's rounding** to minor units. Half-to-even.
6. **`assertTotalsConsistent` is defense-in-depth** — every code path that
   issues an invoice MUST call it before serialization.
7. **Entitlement resolution is most-permissive** across active + trialing
   subscriptions; `expired`, `canceled`, `past_due` are excluded.
8. **`ProviderError`** is the only allowed surface for provider-specific
   failures from orchestration. Provider SDK exceptions MUST be wrapped.

## Test coverage gates

Critical paths (100% lines / branches / functions):

- Stripe + LemonSqueezy webhook signature verification.
- Invoice subtotal / tax / total computation and `assertTotalsConsistent`.
- Money arithmetic (`addMoney`, `subtractMoney`, `multiplyByQuantity`,
  `sumMoney`, `applyTaxRate`).
- Entitlement decisions (`StaticEntitlements`, `resolveEntitlements`).
- Idempotency key enforcement in `charge` / `refund` /
  `createSubscription` / `cancelSubscription`.

Other surfaces: ≥90% lines, ≥85% branches (portfolio default).

## Versioning policy

- Semver.
- Breaking changes: renaming or removing an error code, changing money
  semantics (e.g. switching to floats — disallowed), narrowing a union, or
  altering the webhook verification algorithm.
- All breaking changes require:
  - major bump,
  - addendum in this file's `## Changelog` section,
  - PRs against each known consumer to update their mirror.
- New optional fields, new error subclasses with new codes, new orchestration
  ops, and new providers are minor bumps.

## Known consumers

These code paths mirror types or error codes from this spec (no direct
import):

- `products/amliq/internal/shared/workers/src/billing/` — full billing
  handler set mirroring `verifyStripeWebhook`, `verifyLemonSqueezyWebhook`,
  and the error-code enum.
- `products/amliq/internal/shared/workers/src/billing/__tests__/` — tests
  that assert on the stable `billing.*` codes.
- `products/queryflux/sdlc-ai/services/admin-ui/.../policy.service.ts` —
  uses parallel error-code conventions for billing webhooks (drift candidate).
- Any future product invoicing flow MUST mirror `Money`, `Currency`,
  `assertTotalsConsistent`.

See `docs/quality/CANONICAL_SPEC.md` for the full inventory and drift checks.

## Cross-references

- `@finsavvyai/shared-types` SPEC defines `ActorId` / `AuditId`; billing
  audit emissions (when wired) MUST satisfy that audit event base shape.
- `@finsavvyai/telemetry` owns the `AuditRecord`/`AuditSink` canonical
  source; billing audit events route through telemetry.
- `@finsavvyai/policy-engine` SPEC defines authorization for sensitive
  billing operations (refund issuance, plan changes) — orchestration
  should call into a policy decision before mutating.

## Migration path

If a future round carves out `@finsavvyai/billing` from the isolation rule:

1. Add the carve-out clause to `docs/architecture/ISOLATION_RULES.md`,
   scoped to billing primitives (pure functions, no I/O state).
2. Replace product-local mirrors with `import` from this package, one
   product at a time. Start with `products/amliq/internal/shared/workers/`.
3. Delete mirrored helpers; keep `PaymentGateway` and `Store` impls in the
   product (they are intentionally per-product).
4. Add a CI guard that forbids product-local definitions of money math or
   webhook verification functions.
5. Update `Known consumers` to read "imports directly" rather than
   "mirrors from".
