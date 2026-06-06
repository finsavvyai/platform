export type Currency = "USD" | "EUR" | "GBP" | "ILS";

export type Money = {
  readonly amountMinor: number;
  readonly currency: Currency;
};

export type PlanId = string & { readonly __brand: "PlanId" };
export type CustomerId = string & { readonly __brand: "CustomerId" };
export type SubscriptionId = string & { readonly __brand: "SubscriptionId" };

export type Plan = {
  readonly id: PlanId;
  readonly name: string;
  readonly price: Money;
  readonly interval: "month" | "year";
  readonly entitlements: readonly Entitlement[];
};

export type Entitlement = {
  readonly key: string;
  readonly limit: number | "unlimited";
};

export type SubscriptionStatus =
  | "active"
  | "past_due"
  | "canceled"
  | "expired"
  | "trialing";

export type Subscription = {
  readonly id: SubscriptionId;
  readonly customerId: CustomerId;
  readonly planId: PlanId;
  readonly status: SubscriptionStatus;
  readonly currentPeriodEnd: number;
};

export type SubscriptionAuditEvent = {
  readonly subscriptionId: SubscriptionId;
  readonly customerId: CustomerId;
  readonly fromStatus: SubscriptionStatus | null;
  readonly toStatus: SubscriptionStatus;
  readonly occurredAt: number;
  readonly reason: string;
};

export type SubscriptionMutation = {
  readonly subscription: Subscription;
  readonly auditEvent: SubscriptionAuditEvent;
};

export type SubscriptionTransitionInput = {
  readonly status: SubscriptionStatus;
  readonly currentPeriodEnd?: number;
  readonly occurredAt?: number;
  readonly reason?: string;
};

export interface EntitlementChecker {
  has(subscription: Subscription, plan: Plan, key: string): boolean;
  remaining(subscription: Subscription, plan: Plan, key: string, used: number): number | "unlimited";
}

export interface SubscriptionStore {
  get(id: SubscriptionId): Promise<Subscription | null>;
  upsert(subscription: Subscription, reason?: string): Promise<SubscriptionMutation>;
  transition(
    id: SubscriptionId,
    input: SubscriptionTransitionInput,
  ): Promise<SubscriptionMutation>;
}
