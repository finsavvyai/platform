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
});
