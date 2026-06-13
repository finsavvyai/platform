import { describe, expect, it } from "vitest";
import type {
  CustomerId,
  Plan,
  PlanId,
  Subscription,
  SubscriptionId,
} from "@finsavvyai/billing";
import { SnapshotStore } from "./config-store.js";
import { checkAndConsume, type GateDeps } from "./gate.js";
import { InMemoryUsageMeter } from "./meter.js";

const KEY = "aml.screen";
const NOW = () => 1_000_000; // fixed clock (unix seconds)
const CUST = "cust_a" as CustomerId;

function plan(limit: number | "unlimited"): Plan {
  return {
    id: "plan_pilot" as PlanId,
    name: "Pilot",
    price: { amountMinor: 250000, currency: "USD" },
    interval: "month",
    entitlements: [{ key: KEY, limit }],
  };
}

function sub(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: "sub_1" as SubscriptionId,
    customerId: CUST,
    planId: "plan_pilot" as PlanId,
    status: "active",
    currentPeriodEnd: 2_000_000, // > NOW
    ...overrides,
  };
}

function deps(p: Plan, s: Subscription): GateDeps {
  return {
    store: new SnapshotStore({ plans: [p], subscriptions: [s] }),
    meter: new InMemoryUsageMeter(),
    entitlementKey: KEY,
    now: NOW,
  };
}

describe("checkAndConsume", () => {
  it("denies when the customer has no entitlement (no active sub)", async () => {
    const d = deps(plan(3), sub({ status: "canceled" }));
    const decision = await checkAndConsume(d, CUST);
    expect(decision).toEqual({ allowed: false, reason: "no_entitlement" });
    expect(await d.meter.used(CUST, KEY)).toBe(0);
  });

  it("allows under the limit and decrements remaining", async () => {
    const d = deps(plan(3), sub());
    expect(await checkAndConsume(d, CUST)).toEqual({
      allowed: true,
      remaining: 2,
    });
    expect(await checkAndConsume(d, CUST)).toEqual({
      allowed: true,
      remaining: 1,
    });
    expect(await d.meter.used(CUST, KEY)).toBe(2);
  });

  it("denies once the period limit is reached and does not burn quota", async () => {
    const d = deps(plan(2), sub());
    await checkAndConsume(d, CUST);
    await checkAndConsume(d, CUST);
    const denied = await checkAndConsume(d, CUST);
    expect(denied).toEqual({ allowed: false, reason: "limit_exceeded", limit: 2 });
    expect(await d.meter.used(CUST, KEY)).toBe(2); // unchanged by the denial
  });

  it("never blocks an unlimited entitlement", async () => {
    const d = deps(plan("unlimited"), sub());
    for (let i = 0; i < 5; i++) {
      expect(await checkAndConsume(d, CUST)).toEqual({
        allowed: true,
        remaining: "unlimited",
      });
    }
    expect(await d.meter.used(CUST, KEY)).toBe(5);
  });

  it("denies when the entitlement key is not granted by the plan", async () => {
    const d = deps(plan(3), sub());
    const decision = await checkAndConsume(
      { ...d, entitlementKey: "aml.unknown" },
      CUST,
    );
    expect(decision).toEqual({ allowed: false, reason: "no_entitlement" });
  });

  it("works without an injected clock (uses wall time)", async () => {
    // Period end far in the future so the sub is active under real Date.now().
    const d = deps(plan(3), sub({ currentPeriodEnd: 4_102_444_800 }));
    const { now: _omit, ...noClock } = d;
    void _omit;
    expect(await checkAndConsume(noClock, CUST)).toEqual({
      allowed: true,
      remaining: 2,
    });
  });
});
