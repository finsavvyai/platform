import { describe, expect, it } from "vitest";
import { StaticEntitlements } from "./entitlements.js";
import type {
  CustomerId,
  Plan,
  PlanId,
  Subscription,
  SubscriptionId,
} from "./types.js";

const plan: Plan = {
  id: "pro" as PlanId,
  name: "Pro",
  price: { amountMinor: 2900, currency: "USD" },
  interval: "month",
  entitlements: [
    { key: "seats", limit: 5 },
    { key: "api_calls", limit: "unlimited" },
  ],
};

const sub = (status: Subscription["status"]): Subscription => ({
  id: "s1" as SubscriptionId,
  customerId: "c1" as CustomerId,
  planId: plan.id,
  status,
  currentPeriodEnd: 9999999999,
});

describe("StaticEntitlements", () => {
  const ent = new StaticEntitlements();

  it("grants entitlement on active sub", () => {
    expect(ent.has(sub("active"), plan, "seats")).toBe(true);
  });

  it("denies on canceled sub", () => {
    expect(ent.has(sub("canceled"), plan, "seats")).toBe(false);
  });

  it("calculates remaining numeric", () => {
    expect(ent.remaining(sub("active"), plan, "seats", 3)).toBe(2);
  });

  it("returns unlimited", () => {
    expect(ent.remaining(sub("active"), plan, "api_calls", 1e6)).toBe("unlimited");
  });

  it("denies remaining when overage", () => {
    expect(ent.remaining(sub("active"), plan, "seats", 10)).toBe(0);
  });

  it("denies has() when subscription is on a different plan", () => {
    // Covers entitlements.ts line 12 (planId !== plan.id) true branch.
    const otherPlanSub: Subscription = {
      ...sub("active"),
      planId: "free" as PlanId,
    };
    expect(ent.has(otherPlanSub, plan, "seats")).toBe(false);
  });

  it("returns 0 from remaining() when subscription is inactive", () => {
    // Covers entitlements.ts line 22 (!this.has(...) true branch).
    expect(ent.remaining(sub("canceled"), plan, "seats", 0)).toBe(0);
    expect(ent.remaining(sub("expired"), plan, "api_calls", 1)).toBe(0);
  });

  it("trialing status is treated as active", () => {
    // Reinforces ACTIVE_STATUSES membership for trialing.
    expect(ent.has(sub("trialing"), plan, "seats")).toBe(true);
    expect(ent.remaining(sub("trialing"), plan, "seats", 2)).toBe(3);
  });

  it("past_due is treated as inactive (entitlement denied)", () => {
    expect(ent.has(sub("past_due"), plan, "seats")).toBe(false);
    expect(ent.remaining(sub("past_due"), plan, "seats", 0)).toBe(0);
  });

  it("unknown key returns false on has() and 0 on remaining()", () => {
    expect(ent.has(sub("active"), plan, "no_such_key")).toBe(false);
    expect(ent.remaining(sub("active"), plan, "no_such_key", 0)).toBe(0);
  });
});
