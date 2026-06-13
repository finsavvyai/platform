import { describe, expect, it } from "vitest";
import type {
  ScreenRequest,
  ScreenResponse,
} from "@finsavvyai/aml-screen-client";
import type {
  CustomerId,
  Plan,
  PlanId,
  Subscription,
  SubscriptionId,
} from "@finsavvyai/billing";
import { SnapshotStore } from "./config-store.js";
import { InMemoryUsageMeter } from "./meter.js";
import {
  handleScreen,
  type ScreenClientLike,
  type ScreenToolDeps,
} from "./screen-tool.js";
import { SCREEN_ENTITLEMENT_KEY } from "./types.js";

const CUST = "cust_a" as CustomerId;
const NOW = () => 1_000_000;

function plan(limit: number | "unlimited"): Plan {
  return {
    id: "plan_pilot" as PlanId,
    name: "Pilot",
    price: { amountMinor: 250000, currency: "USD" },
    interval: "month",
    entitlements: [{ key: SCREEN_ENTITLEMENT_KEY, limit }],
  };
}
const SUB: Subscription = {
  id: "sub_1" as SubscriptionId,
  customerId: CUST,
  planId: "plan_pilot" as PlanId,
  status: "active",
  currentPeriodEnd: 2_000_000,
};

/** Fake screen client that records calls and returns a canned response. */
class FakeClient implements ScreenClientLike {
  public calls: ScreenRequest[] = [];
  public constructor(
    private readonly response: ScreenResponse | (() => never),
  ) {}
  public async screen(request: ScreenRequest): Promise<ScreenResponse> {
    this.calls.push(request);
    if (typeof this.response === "function") return this.response();
    return this.response;
  }
}

const oneMatch: ScreenResponse = {
  query: "Ivan Petrov",
  matches: [
    {
      entityId: "OFAC-123",
      entityName: "IVAN PETROV",
      confidence: 0.94,
      lists: ["ofac"],
      layers: [{ layer: "fuzzy", score: 0.94, matched: true }],
      pepStatus: "none",
    },
  ],
  riskLevel: "high",
  latencyMs: 42,
  screenedAt: "2026-06-13T00:00:00.000Z",
};

const noMatch: ScreenResponse = {
  query: "Jane Doe",
  matches: [],
  riskLevel: "clear",
  latencyMs: 30,
  screenedAt: "2026-06-13T00:00:00.000Z",
};

function deps(
  limit: number | "unlimited",
  client: ScreenClientLike,
  opts: { sub?: Subscription; customer?: CustomerId | null } = {},
): ScreenToolDeps {
  return {
    gate: {
      store: new SnapshotStore({
        plans: [plan(limit)],
        subscriptions: [opts.sub ?? SUB],
      }),
      meter: new InMemoryUsageMeter(),
      entitlementKey: SCREEN_ENTITLEMENT_KEY,
      now: NOW,
    },
    client,
    resolveCustomerId: () =>
      opts.customer === undefined ? CUST : opts.customer,
  };
}

describe("handleScreen — argument validation", () => {
  it("rejects a missing/empty name without calling screen", async () => {
    const client = new FakeClient(oneMatch);
    const res = await handleScreen(deps(5, client), { name: "  " });
    expect(res.isError).toBe(true);
    expect(client.calls).toHaveLength(0);
  });

  it("rejects a non-array lists value", async () => {
    const res = await handleScreen(deps(5, new FakeClient(oneMatch)), {
      name: "x",
      lists: "ofac",
    });
    expect(res.isError).toBe(true);
  });

  it("rejects an unknown list id", async () => {
    const res = await handleScreen(deps(5, new FakeClient(oneMatch)), {
      name: "x",
      lists: ["ofac", "nope"],
    });
    expect(res.content[0]?.text).toContain("Unknown list id: nope");
  });

  it("rejects a non-boolean pep", async () => {
    const res = await handleScreen(deps(5, new FakeClient(oneMatch)), {
      name: "x",
      pep: "yes",
    });
    expect(res.isError).toBe(true);
  });

  it("rejects an out-of-range threshold", async () => {
    const res = await handleScreen(deps(5, new FakeClient(oneMatch)), {
      name: "x",
      threshold: 2,
    });
    expect(res.isError).toBe(true);
  });
});

describe("handleScreen — gating", () => {
  it("errors when there is no billing identity", async () => {
    const client = new FakeClient(oneMatch);
    const res = await handleScreen(deps(5, client, { customer: null }), {
      name: "x",
    });
    expect(res.isError).toBe(true);
    expect(client.calls).toHaveLength(0);
  });

  it("returns payment-required when the customer lacks the entitlement", async () => {
    const client = new FakeClient(oneMatch);
    const res = await handleScreen(
      deps(5, client, { sub: { ...SUB, status: "canceled" } }),
      { name: "x" },
    );
    expect(res.isError).toBe(true);
    expect(res.content[0]?.text).toContain("Payment required");
    expect(client.calls).toHaveLength(0);
  });

  it("returns quota-exceeded when the limit is reached", async () => {
    const client = new FakeClient(oneMatch);
    const res = await handleScreen(deps(0, client), { name: "x" });
    expect(res.content[0]?.text).toContain("Quota exceeded");
    expect(client.calls).toHaveLength(0);
  });
});

describe("handleScreen — screening", () => {
  it("passes parsed args through and formats matches with quota", async () => {
    const client = new FakeClient(oneMatch);
    const res = await handleScreen(deps(5, client), {
      name: "Ivan Petrov",
      lists: ["ofac"],
      pep: true,
      threshold: 0.8,
    });
    expect(client.calls[0]).toEqual({
      name: "Ivan Petrov",
      lists: ["ofac"],
      pep: true,
      threshold: 0.8,
    });
    const text = res.content[0]?.text ?? "";
    expect(text).toContain("Risk: HIGH");
    expect(text).toContain("IVAN PETROV (94.0%)");
    expect(text).toContain("quota: 4 remaining");
  });

  it("formats a clean result with unlimited quota", async () => {
    const res = await handleScreen(deps("unlimited", new FakeClient(noMatch)), {
      name: "Jane Doe",
    });
    const text = res.content[0]?.text ?? "";
    expect(text).toContain("No matches");
    expect(text).toContain("quota: unlimited");
  });

  it("surfaces a screening failure as an error result", async () => {
    const client = new FakeClient(() => {
      throw new Error("upstream 503");
    });
    const res = await handleScreen(deps(5, client), { name: "x" });
    expect(res.isError).toBe(true);
    expect(res.content[0]?.text).toContain("Screening failed: upstream 503");
  });

  it("stringifies a non-Error throw from the client", async () => {
    const client = new FakeClient(() => {
      throw "boom"; // eslint-disable-line @typescript-eslint/no-throw-literal
    });
    const res = await handleScreen(deps(5, client), { name: "x" });
    expect(res.content[0]?.text).toContain("Screening failed: boom");
  });
});
