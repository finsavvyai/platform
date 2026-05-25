import type {
  EntitlementChecker,
  Plan,
  Subscription,
} from "./types.js";

const ACTIVE_STATUSES = new Set(["active", "trialing"]);

export class StaticEntitlements implements EntitlementChecker {
  has(subscription: Subscription, plan: Plan, key: string): boolean {
    if (!ACTIVE_STATUSES.has(subscription.status)) return false;
    if (subscription.planId !== plan.id) return false;
    return plan.entitlements.some((e) => e.key === key);
  }

  remaining(
    subscription: Subscription,
    plan: Plan,
    key: string,
    used: number,
  ): number | "unlimited" {
    if (!this.has(subscription, plan, key)) return 0;
    const ent = plan.entitlements.find((e) => e.key === key);
    // Defensive type-narrowing: has() returned true, which guarantees
    // some((e) => e.key === key) matched; find() with the same predicate
    // cannot return undefined here. Kept for noUncheckedIndexedAccess.
    /* v8 ignore next 1 */
    if (!ent) return 0;
    if (ent.limit === "unlimited") return "unlimited";
    return Math.max(0, ent.limit - used);
  }
}
