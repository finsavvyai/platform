export * from "./types.js";
export { StaticEntitlements } from "./entitlements.js";

// LemonSqueezy webhook — verifier moved to ./providers/lemonsqueezy/.
// The old top-level path re-exports for one release; prefer the new path.
export {
  verifyLemonSqueezyWebhook,
  type VerifyOptions as LemonSqueezyVerifyOptions,
  type VerifiedWebhook as LemonSqueezyVerifiedWebhook,
  type WebhookHeaders,
} from "./providers/lemonsqueezy/webhook.js";

// Stripe webhook verifier — constant-time, multi-`v1` rotation aware.
export {
  verifyStripeWebhook,
  parseStripeSignatureHeader,
  type VerifyOptions as StripeVerifyOptions,
  type VerifiedWebhook as StripeVerifiedWebhook,
} from "./providers/stripe/webhook.js";

// Provider-agnostic types & flows.
export type {
  PaymentGateway,
  ProviderName,
  ChargeRequest,
  ChargeResult,
  RefundRequest,
  RefundResult,
  SubscriptionCreateRequest,
  SubscriptionCreateResult,
  SubscriptionCancelRequest,
  SubscriptionCancelResult,
} from "./providers/types.js";

export { charge } from "./orchestration/charge.js";
export { refund } from "./orchestration/refund.js";
export {
  createSubscription,
  cancelSubscription,
} from "./orchestration/subscription.js";

// Invoicing.
export type {
  Invoice,
  InvoiceInput,
  InvoiceStatus,
  InvoiceTotals,
  LineItem,
} from "./invoicing/types.js";
export {
  buildInvoice,
  computeTotals,
  lineTotal,
  assertTotalsConsistent,
} from "./invoicing/invoice.js";
export {
  money,
  zero,
  addMoney,
  subtractMoney,
  multiplyByQuantity,
  applyTaxRate,
  sumMoney,
  equalsMoney,
  bankersRound,
} from "./invoicing/money.js";

// Entitlements.
export {
  resolveEntitlement,
  resolveEntitlements,
  type ResolveOptions,
  type ResolvedEntitlement,
  type Store,
} from "./entitlement-resolver.js";

// Errors.
export {
  BillingError,
  BillingEntitlementMissingError,
  WebhookEventNotAllowedError,
  WebhookReplayError,
  WebhookSignatureError,
  InvoiceTotalsMismatchError,
  InvoiceLineItemInvalidError,
  CurrencyMismatchError,
  IdempotencyKeyRequiredError,
  ProviderError,
} from "./errors.js";
