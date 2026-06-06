import { describe, expect, it } from "vitest";
import {
  AdapterSubscriptionStore,
  InMemorySubscriptionStore,
  transitionSubscription,
  type SubscriptionPersistenceAdapter,
} from "./subscriptions.js";
import type {
  CustomerId,
  PlanId,
  Subscription,
  SubscriptionAuditEvent,
  SubscriptionId,
} from "./types.js";

const subscription = (
  status: Subscription["status"] = "trialing",
): Subscription => ({
  id: "sub_1" as SubscriptionId,
  customerId: "cus_1" as CustomerId,
  planId: "pro" as PlanId,
  status,
  currentPeriodEnd: 1_800_000_000_000,
});

describe("subscription lifecycle", () => {
  it("transitions status and emits an audit event", () => {
    const result = transitionSubscription(subscription(), {
      status: "active",
      currentPeriodEnd: 1_800_100_000_000,
      occurredAt: 1_700_000_000_000,
      reason: "lemonsqueezy.subscription_created",
    });

    expect(result.subscription.status).toBe("active");
    expect(result.subscription.currentPeriodEnd).toBe(1_800_100_000_000);
    expect(result.auditEvent).toMatchObject({
      subscriptionId: "sub_1",
      fromStatus: "trialing",
      toStatus: "active",
      occurredAt: 1_700_000_000_000,
      reason: "lemonsqueezy.subscription_created",
    });
  });

  it("rejects invalid lifecycle transitions", () => {
    expect(() =>
      transitionSubscription(subscription("active"), { status: "trialing" }),
    ).toThrow("Invalid subscription transition active -> trialing");
  });

  it("rejects invalid period timestamps", () => {
    expect(() =>
      transitionSubscription(subscription(), {
        status: "active",
        currentPeriodEnd: -1,
      }),
    ).toThrow("currentPeriodEnd");
  });
});

describe("InMemorySubscriptionStore", () => {
  it("persists upserts and transitions with audit events", async () => {
    const store = new InMemorySubscriptionStore();
    await store.upsert(subscription(), "seed");
    const mutation = await store.transition("sub_1" as SubscriptionId, {
      status: "past_due",
      reason: "lemonsqueezy.subscription_payment_failed",
    });

    await expect(store.get("sub_1" as SubscriptionId)).resolves.toMatchObject({
      status: "past_due",
    });
    expect(mutation.auditEvent.reason).toBe(
      "lemonsqueezy.subscription_payment_failed",
    );
    expect(store.listAuditEvents()).toHaveLength(2);
  });

  it("fails closed when a transition targets a missing subscription", async () => {
    const store = new InMemorySubscriptionStore();
    await expect(
      store.transition("missing" as SubscriptionId, { status: "active" }),
    ).rejects.toThrow("Subscription missing was not found");
  });
});

describe("AdapterSubscriptionStore", () => {
  it("adapts repository reads writes and audit appends", async () => {
    const rows = new Map<SubscriptionId, Subscription>();
    const audit: SubscriptionAuditEvent[] = [];
    const adapter: SubscriptionPersistenceAdapter = {
      async findSubscription(id) {
        return rows.get(id) ?? null;
      },
      async saveSubscription(next) {
        rows.set(next.id, next);
      },
      async appendSubscriptionAuditEvent(event) {
        audit.push(event);
      },
    };
    const store = new AdapterSubscriptionStore(adapter);

    await store.upsert(subscription("active"));
    await store.transition("sub_1" as SubscriptionId, { status: "canceled" });

    expect(rows.get("sub_1" as SubscriptionId)?.status).toBe("canceled");
    expect(audit.map((event) => event.toStatus)).toEqual([
      "active",
      "canceled",
    ]);
  });
});
