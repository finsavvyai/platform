import type {
  CustomerId,
  Plan,
  PlanId,
  Store,
  Subscription,
} from "@finsavvyai/billing";

export interface BillingSnapshot {
  plans: readonly Plan[];
  subscriptions: readonly Subscription[];
}

/**
 * Read-only billing `Store` backed by an in-memory snapshot (e.g. a config
 * file or a synced billing export). Pure and side-effect free — suitable for
 * tests and for a single-tenant skill deployment. For multi-tenant scale,
 * inject a Store backed by the live billing persistence instead.
 */
export class SnapshotStore implements Store {
  private readonly plans: Map<string, Plan>;

  public constructor(private readonly snapshot: BillingSnapshot) {
    this.plans = new Map(snapshot.plans.map((p) => [p.id, p]));
  }

  public listSubscriptionsByCustomer(
    customerId: CustomerId,
  ): readonly Subscription[] {
    return this.snapshot.subscriptions.filter(
      (s) => s.customerId === customerId,
    );
  }

  public getPlan(planId: PlanId): Plan | undefined {
    return this.plans.get(planId);
  }
}
