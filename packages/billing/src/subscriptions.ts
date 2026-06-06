import type {
  Subscription,
  SubscriptionAuditEvent,
  SubscriptionId,
  SubscriptionMutation,
  SubscriptionStatus,
  SubscriptionStore,
  SubscriptionTransitionInput,
} from "./types.js";

const ALLOWED_TRANSITIONS: Record<
  SubscriptionStatus,
  readonly SubscriptionStatus[]
> = {
  active: ["active", "past_due", "canceled", "expired"],
  trialing: ["trialing", "active", "past_due", "canceled", "expired"],
  past_due: ["past_due", "active", "canceled", "expired"],
  canceled: ["canceled", "active"],
  expired: ["expired", "active"],
};

const assertCurrentPeriodEnd = (currentPeriodEnd: number): void => {
  if (!Number.isFinite(currentPeriodEnd) || currentPeriodEnd < 0) {
    throw new Error("Subscription currentPeriodEnd must be a non-negative timestamp");
  }
};

export const transitionSubscription = (
  subscription: Subscription,
  input: SubscriptionTransitionInput,
): SubscriptionMutation => {
  const allowed = ALLOWED_TRANSITIONS[subscription.status];
  if (!allowed.includes(input.status)) {
    throw new Error(
      `Invalid subscription transition ${subscription.status} -> ${input.status}`,
    );
  }

  const currentPeriodEnd = input.currentPeriodEnd ?? subscription.currentPeriodEnd;
  assertCurrentPeriodEnd(currentPeriodEnd);

  const next: Subscription = {
    ...subscription,
    status: input.status,
    currentPeriodEnd,
  };
  const auditEvent: SubscriptionAuditEvent = {
    subscriptionId: subscription.id,
    customerId: subscription.customerId,
    fromStatus: subscription.status,
    toStatus: input.status,
    occurredAt: input.occurredAt ?? Date.now(),
    reason: input.reason ?? "subscription.transition",
  };

  return { subscription: next, auditEvent };
};

const upsertMutation = (
  subscription: Subscription,
  reason: string,
): SubscriptionMutation => {
  assertCurrentPeriodEnd(subscription.currentPeriodEnd);
  return {
    subscription,
    auditEvent: {
      subscriptionId: subscription.id,
      customerId: subscription.customerId,
      fromStatus: null,
      toStatus: subscription.status,
      occurredAt: Date.now(),
      reason,
    },
  };
};

export interface SubscriptionPersistenceAdapter {
  findSubscription(id: SubscriptionId): Promise<Subscription | null>;
  saveSubscription(subscription: Subscription): Promise<void>;
  appendSubscriptionAuditEvent?(event: SubscriptionAuditEvent): Promise<void>;
}

export class AdapterSubscriptionStore implements SubscriptionStore {
  constructor(private readonly adapter: SubscriptionPersistenceAdapter) {}

  async get(id: SubscriptionId): Promise<Subscription | null> {
    return this.adapter.findSubscription(id);
  }

  async upsert(
    subscription: Subscription,
    reason = "subscription.upsert",
  ): Promise<SubscriptionMutation> {
    const mutation = upsertMutation(subscription, reason);
    await this.adapter.saveSubscription(mutation.subscription);
    await this.adapter.appendSubscriptionAuditEvent?.(mutation.auditEvent);
    return mutation;
  }

  async transition(
    id: SubscriptionId,
    input: SubscriptionTransitionInput,
  ): Promise<SubscriptionMutation> {
    const existing = await this.adapter.findSubscription(id);
    if (!existing) {
      throw new Error(`Subscription ${id} was not found`);
    }

    const mutation = transitionSubscription(existing, input);
    await this.adapter.saveSubscription(mutation.subscription);
    await this.adapter.appendSubscriptionAuditEvent?.(mutation.auditEvent);
    return mutation;
  }
}

export class InMemorySubscriptionStore implements SubscriptionStore {
  private readonly subscriptions = new Map<SubscriptionId, Subscription>();
  private readonly auditEvents: SubscriptionAuditEvent[] = [];

  constructor(seed: readonly Subscription[] = []) {
    for (const subscription of seed) {
      this.subscriptions.set(subscription.id, subscription);
    }
  }

  async get(id: SubscriptionId): Promise<Subscription | null> {
    return this.subscriptions.get(id) ?? null;
  }

  async upsert(
    subscription: Subscription,
    reason = "subscription.upsert",
  ): Promise<SubscriptionMutation> {
    const mutation = upsertMutation(subscription, reason);
    this.subscriptions.set(subscription.id, mutation.subscription);
    this.auditEvents.push(mutation.auditEvent);
    return mutation;
  }

  async transition(
    id: SubscriptionId,
    input: SubscriptionTransitionInput,
  ): Promise<SubscriptionMutation> {
    const existing = await this.get(id);
    if (!existing) {
      throw new Error(`Subscription ${id} was not found`);
    }

    const mutation = transitionSubscription(existing, input);
    this.subscriptions.set(id, mutation.subscription);
    this.auditEvents.push(mutation.auditEvent);
    return mutation;
  }

  listAuditEvents(): readonly SubscriptionAuditEvent[] {
    return [...this.auditEvents];
  }
}
