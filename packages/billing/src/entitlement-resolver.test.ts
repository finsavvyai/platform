import { describe, expect, it } from "vitest";
import { resolveEntitlement, resolveEntitlements, type Store } from "./entitlement-resolver.js";
import type { CustomerId, Plan, PlanId, Subscription, SubscriptionId, SubscriptionStatus } from "./types.js";

const CUSTOMER = "cust_1" as CustomerId;
const NOW = 1_700_000_000;
const FUTURE = NOW + 3600;
const PAST = NOW - 3600;

const planFree: Plan = {
  id: "free" as PlanId,
  name: "Free",
  price: { amountMinor: 0, currency: "USD" },
  interval: "month",
  entitlements: [{ key: "seats", limit: 1 }],
};

const planPro: Plan = {
  id: "pro" as PlanId,
  name: "Pro",
  price: { amountMinor: 2900, currency: "USD" },
  interval: "month",
  entitlements: [
    { key: "seats", limit: 5 },
    { key: "api_calls", limit: "unlimited" },
  ],
};

const planTeam: Plan = {
  id: "team" as PlanId,
  name: "Team",
  price: { amountMinor: 9900, currency: "USD" },
  interval: "month",
  entitlements: [
    { key: "seats", limit: 20 },
    { key: "exports", limit: 100 },
  ],
};

function sub(
  id: string,
  planId: PlanId,
  status: SubscriptionStatus,
  endsAt: number,
  customerId: CustomerId = CUSTOMER,
): Subscription {
  return {
    id: id as SubscriptionId,
    customerId,
    planId,
    status,
    currentPeriodEnd: endsAt,
  };
}

function makeStore(
  subs: readonly Subscription[],
  plans: readonly Plan[],
): Store {
  const planMap = new Map(plans.map((p) => [p.id, p] as const));
  return {
    listSubscriptionsByCustomer: (customerId) =>
      subs.filter((s) => s.customerId === customerId),
    getPlan: (id) => planMap.get(id),
  };
}

describe("resolveEntitlements", () => {
  const opts = { now: () => NOW };

  it("returns empty for customer with no subs", async () => {
    expect(
      await resolveEntitlements(makeStore([], [planPro]), CUSTOMER, opts),
    ).toEqual([]);
  });

  it("excludes expired subs", async () => {
    const store = makeStore(
      [sub("s1", planPro.id, "active", PAST)],
      [planPro],
    );
    expect(await resolveEntitlements(store, CUSTOMER, opts)).toEqual([]);
  });

  it("excludes canceled and past_due subs", async () => {
    const store = makeStore(
      [
        sub("s1", planPro.id, "canceled", FUTURE),
        sub("s2", planPro.id, "past_due", FUTURE),
      ],
      [planPro],
    );
    expect(await resolveEntitlements(store, CUSTOMER, opts)).toEqual([]);
  });

  it("includes trialing subs", async () => {
    const store = makeStore(
      [sub("s1", planPro.id, "trialing", FUTURE)],
      [planPro],
    );
    const out = await resolveEntitlements(store, CUSTOMER, opts);
    expect(out.find((e) => e.key === "seats")?.limit).toBe(5);
  });

  it("skips subscriptions whose plan is unknown", async () => {
    const store = makeStore(
      [sub("s1", "ghost" as PlanId, "active", FUTURE)],
      [planPro],
    );
    expect(await resolveEntitlements(store, CUSTOMER, opts)).toEqual([]);
  });

  it("merges overlapping subs — numeric most-permissive wins", async () => {
    const store = makeStore(
      [
        sub("s1", planFree.id, "active", FUTURE),
        sub("s2", planPro.id, "active", FUTURE + 100),
        sub("s3", planTeam.id, "active", FUTURE + 50),
      ],
      [planFree, planPro, planTeam],
    );
    const out = await resolveEntitlements(store, CUSTOMER, opts);
    const seats = out.find((e) => e.key === "seats");
    expect(seats?.limit).toBe(20);
    expect(seats?.expiresAt).toBe(FUTURE + 100);
    expect(seats?.sourceSubscriptionIds).toEqual(["s1", "s2", "s3"]);
  });

  it("two unlimited contributors stay unlimited", async () => {
    const store = makeStore(
      [
        sub("s1", planPro.id, "active", FUTURE),
        sub("s2", planPro.id, "active", FUTURE + 100),
      ],
      [planPro],
    );
    const out = await resolveEntitlements(store, CUSTOMER, opts);
    expect(out.find((e) => e.key === "api_calls")?.limit).toBe("unlimited");
  });

  it("unlimited beats numeric in either merge direction", async () => {
    const a = makeStore(
      [
        sub("s1", planTeam.id, "active", FUTURE),
        sub("s2", planPro.id, "active", FUTURE),
      ],
      [planPro, planTeam],
    );
    const b = makeStore(
      [
        sub("s1", planPro.id, "active", FUTURE),
        sub("s2", planTeam.id, "active", FUTURE),
      ],
      [planPro, planTeam],
    );
    const outA = await resolveEntitlements(a, CUSTOMER, opts);
    const outB = await resolveEntitlements(b, CUSTOMER, opts);
    expect(outA.find((e) => e.key === "api_calls")?.limit).toBe("unlimited");
    expect(outB.find((e) => e.key === "api_calls")?.limit).toBe("unlimited");
  });

  it("scopes by customer id", async () => {
    const other = "cust_2" as CustomerId;
    const store = makeStore(
      [sub("s1", planPro.id, "active", FUTURE, other)],
      [planPro],
    );
    expect(await resolveEntitlements(store, CUSTOMER, opts)).toEqual([]);
  });

  it("uses default clock when no `now` injected", async () => {
    const store = makeStore(
      [sub("s1", planPro.id, "active", Math.floor(Date.now() / 1000) + 60)],
      [planPro],
    );
    expect((await resolveEntitlements(store, CUSTOMER)).length).toBeGreaterThan(
      0,
    );
  });
});

describe("resolveEntitlement (single key)", () => {
  const opts = { now: () => NOW };

  it("returns entitlement when active", async () => {
    const store = makeStore([sub("s1", planPro.id, "active", FUTURE)], [planPro]);
    expect((await resolveEntitlement(store, CUSTOMER, "seats", opts))?.limit).toBe(5);
  });

  it("returns null when key is missing", async () => {
    const store = makeStore([sub("s1", planFree.id, "active", FUTURE)], [planFree]);
    expect(await resolveEntitlement(store, CUSTOMER, "exports", opts)).toBeNull();
  });
});
