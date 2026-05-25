import type { CustomerId, Money, PlanId, SubscriptionId } from "../types.js";

/**
 * Provider-agnostic gateway contract.
 *
 * Each concrete provider (Stripe, LemonSqueezy, …) implements this so the
 * orchestration layer never reaches into provider-specific APIs. Keep this
 * interface narrow on purpose — anything provider-specific belongs under
 * `providers/<name>/`.
 *
 * Money is always passed in integer minor units (cents, agorot, …) with an
 * explicit ISO-4217 currency. Never use floats.
 */
export type ProviderName = "stripe" | "lemonsqueezy" | (string & {});

export type ChargeRequest = {
  readonly idempotencyKey: string;
  readonly customerId: CustomerId;
  readonly amount: Money;
  readonly description?: string;
  readonly metadata?: Readonly<Record<string, string>>;
};

export type ChargeResult = {
  readonly provider: ProviderName;
  readonly providerChargeId: string;
  readonly status: "succeeded" | "pending" | "failed";
  readonly amount: Money;
};

export type RefundRequest = {
  readonly idempotencyKey: string;
  readonly providerChargeId: string;
  readonly amount: Money;
  readonly reason?: "duplicate" | "fraudulent" | "requested_by_customer";
};

export type RefundResult = {
  readonly provider: ProviderName;
  readonly providerRefundId: string;
  readonly status: "succeeded" | "pending" | "failed";
  readonly amount: Money;
};

export type SubscriptionCreateRequest = {
  readonly idempotencyKey: string;
  readonly customerId: CustomerId;
  readonly planId: PlanId;
  readonly trialDays?: number;
  readonly metadata?: Readonly<Record<string, string>>;
};

export type SubscriptionCreateResult = {
  readonly provider: ProviderName;
  readonly providerSubscriptionId: string;
  readonly status: "active" | "trialing" | "pending";
};

export type SubscriptionCancelRequest = {
  readonly idempotencyKey: string;
  readonly subscriptionId: SubscriptionId;
  readonly atPeriodEnd: boolean;
};

export type SubscriptionCancelResult = {
  readonly provider: ProviderName;
  readonly providerSubscriptionId: string;
  readonly canceledAt: number;
  readonly effectiveAt: number;
};

export interface PaymentGateway {
  readonly name: ProviderName;
  charge(req: ChargeRequest): Promise<ChargeResult>;
  refund(req: RefundRequest): Promise<RefundResult>;
  createSubscription(
    req: SubscriptionCreateRequest,
  ): Promise<SubscriptionCreateResult>;
  cancelSubscription(
    req: SubscriptionCancelRequest,
  ): Promise<SubscriptionCancelResult>;
}
