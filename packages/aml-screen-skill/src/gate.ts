import {
  resolveEntitlement,
  type CustomerId,
  type Store,
} from "@finsavvyai/billing";
import type { UsageMeter } from "./meter.js";

export type GateDecision =
  | { allowed: true; remaining: number | "unlimited" }
  | {
      allowed: false;
      reason: "no_entitlement" | "limit_exceeded";
      limit?: number;
    };

export interface GateDeps {
  store: Store;
  meter: UsageMeter;
  entitlementKey: string;
  /** Inject clock for tests; defaults to wall time inside the resolver. */
  now?: () => number;
}

/**
 * Resolve the customer's entitlement, enforce the period limit, and consume
 * one unit on success. Usage is recorded ONLY when the call is allowed, so a
 * denied request never burns quota.
 */
export async function checkAndConsume(
  deps: GateDeps,
  customerId: CustomerId,
): Promise<GateDecision> {
  const ent = await resolveEntitlement(
    deps.store,
    customerId,
    deps.entitlementKey,
    deps.now ? { now: deps.now } : {},
  );
  if (ent === null) return { allowed: false, reason: "no_entitlement" };

  const used = await deps.meter.used(customerId, deps.entitlementKey);
  if (ent.limit !== "unlimited" && used >= ent.limit) {
    return { allowed: false, reason: "limit_exceeded", limit: ent.limit };
  }

  await deps.meter.record(customerId, deps.entitlementKey);
  const remaining =
    ent.limit === "unlimited" ? "unlimited" : Math.max(0, ent.limit - used - 1);
  return { allowed: true, remaining };
}
