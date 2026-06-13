import { describe, expect, it } from "vitest";
import type {
  CustomerId,
  Plan,
  PlanId,
  Subscription,
  SubscriptionId,
} from "@finsavvyai/billing";
import { SnapshotStore } from "./config-store.js";

const PLAN: Plan = {
  id: "plan_pilot" as PlanId,
  name: "Fintech Pilot",
  price: { amountMinor: 250000, currency: "USD" },
  interval: "month",
  entitlements: [{ key: "aml.screen", limit: 100 }],
};

const SUB: Subscription = {
  id: "sub_1" as SubscriptionId,
  customerId: "cust_a" as CustomerId,
  planId: "plan_pilot" as PlanId,
  status: "active",
  currentPeriodEnd: 4_102_444_800, // 2100
};

describe("SnapshotStore", () => {
  it("returns subscriptions for a known customer", () => {
    const store = new SnapshotStore({ plans: [PLAN], subscriptions: [SUB] });
    expect(store.listSubscriptionsByCustomer("cust_a" as CustomerId)).toEqual([
      SUB,
    ]);
  });

  it("returns an empty list for an unknown customer", () => {
    const store = new SnapshotStore({ plans: [PLAN], subscriptions: [SUB] });
    expect(
      store.listSubscriptionsByCustomer("cust_x" as CustomerId),
    ).toEqual([]);
  });

  it("resolves plans by id and undefined when missing", () => {
    const store = new SnapshotStore({ plans: [PLAN], subscriptions: [SUB] });
    expect(store.getPlan("plan_pilot" as PlanId)).toEqual(PLAN);
    expect(store.getPlan("plan_missing" as PlanId)).toBeUndefined();
  });
});
