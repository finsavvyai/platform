import type {
  CustomerId,
  Entitlement,
  Plan,
  PlanId,
  Subscription,
} from "./types.js";

/**
 * Read-side flow: resolve the active entitlements for a customer.
 *
 * Pure function over an injected `Store` — no DB, no I/O assumptions.
 * Caller wires the store to whatever persistence they want (Postgres,
 * Redis snapshot, LemonSqueezy sync). Keeping this resolver pure is what
 * lets us hit 100% coverage on the entitlement-read critical path.
 */

export interface Store {
  /** All subscriptions known for this customer, any status. */
  listSubscriptionsByCustomer(
    customerId: CustomerId,
  ): readonly Subscription[] | Promise<readonly Subscription[]>;
  /** Plan lookup. Return undefined if the plan id is unknown. */
  getPlan(planId: PlanId): Plan | undefined | Promise<Plan | undefined>;
}

export type ResolvedEntitlement = {
  readonly key: string;
  readonly limit: number | "unlimited";
  /** Unix seconds — earliest expiry across the contributing subscriptions. */
  readonly expiresAt: number;
  /** Subscriptions that contributed to this entitlement (for audit). */
  readonly sourceSubscriptionIds: readonly string[];
};

export type ResolveOptions = {
  /** Inject clock for tests. Defaults to Date.now() in seconds. */
  readonly now?: () => number;
};

const ACTIVE_STATUSES = new Set(["active", "trialing"]);

/**
 * Resolve all active entitlements for a customer.
 *
 * Rules (most-permissive wins):
 *  - Only `active` / `trialing` subscriptions whose period has not ended
 *    contribute.
 *  - If multiple subscriptions grant the same key, the resulting limit is
 *    `unlimited` if any contributing entitlement is unlimited, otherwise the
 *    maximum numeric limit.
 *  - `expiresAt` is the **latest** period-end across contributors (because
 *    coverage persists as long as any contributing sub is active).
 */
export async function resolveEntitlements(
  store: Store,
  customerId: CustomerId,
  opts: ResolveOptions = {},
): Promise<readonly ResolvedEntitlement[]> {
  const now = (opts.now ?? defaultNow)();
  const subs = await store.listSubscriptionsByCustomer(customerId);
  const active = subs.filter(
    (s) => ACTIVE_STATUSES.has(s.status) && s.currentPeriodEnd > now,
  );
  if (active.length === 0) return [];

  const byKey = new Map<
    string,
    {
      limit: number | "unlimited";
      expiresAt: number;
      sources: string[];
    }
  >();

  for (const sub of active) {
    const plan = await store.getPlan(sub.planId);
    if (!plan) continue;
    for (const ent of plan.entitlements) {
      merge(byKey, ent, sub);
    }
  }

  return [...byKey.entries()]
    .map(([key, v]) => ({
      key,
      limit: v.limit,
      expiresAt: v.expiresAt,
      sourceSubscriptionIds: v.sources,
    }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

function merge(
  byKey: Map<
    string,
    { limit: number | "unlimited"; expiresAt: number; sources: string[] }
  >,
  ent: Entitlement,
  sub: Subscription,
): void {
  const prev = byKey.get(ent.key);
  if (!prev) {
    byKey.set(ent.key, {
      limit: ent.limit,
      expiresAt: sub.currentPeriodEnd,
      sources: [sub.id],
    });
    return;
  }
  prev.sources.push(sub.id);
  prev.expiresAt = Math.max(prev.expiresAt, sub.currentPeriodEnd);
  if (prev.limit === "unlimited" || ent.limit === "unlimited") {
    prev.limit = "unlimited";
    return;
  }
  prev.limit = Math.max(prev.limit, ent.limit);
}

/**
 * Resolve a single entitlement key. Returns `null` when the customer has
 * no active entitlement for that key.
 */
export async function resolveEntitlement(
  store: Store,
  customerId: CustomerId,
  key: string,
  opts: ResolveOptions = {},
): Promise<ResolvedEntitlement | null> {
  const all = await resolveEntitlements(store, customerId, opts);
  return all.find((e) => e.key === key) ?? null;
}

function defaultNow(): number {
  return Math.floor(Date.now() / 1000);
}
