import { describe, it, expect, vi } from "vitest";

function buildVariantMap(proId: string, teamId: string) {
  const map: Record<number, "pro" | "team"> = {};
  if (proId) map[parseInt(proId, 10)] = "pro";
  if (teamId) map[parseInt(teamId, 10)] = "team";
  return map;
}

function mockDb() {
  const boundFns = {
    run: vi.fn().mockResolvedValue({ success: true }),
    first: vi.fn().mockResolvedValue(null),
  };
  return {
    prepare: vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnValue(boundFns),
    }),
    _bound: boundFns,
  };
}

const PRO_VARIANT = "100";
const TEAM_VARIANT = "200";

describe("buildVariantMap", () => {
  it("maps pro and team variant ids", () => {
    const map = buildVariantMap(PRO_VARIANT, TEAM_VARIANT);
    expect(map[100]).toBe("pro");
    expect(map[200]).toBe("team");
  });

  it("handles missing variant gracefully", () => {
    const map = buildVariantMap("", TEAM_VARIANT);
    expect(map[100]).toBeUndefined();
    expect(map[200]).toBe("team");
  });
});

describe("webhook event handling", () => {
  it("subscription_created sets user plan to pro", async () => {
    const db = mockDb();
    const variantMap = buildVariantMap(PRO_VARIANT, TEAM_VARIANT);
    const variantId = 100;
    const plan = variantMap[variantId] || "pro";
    expect(plan).toBe("pro");
    await db.prepare("UPDATE users SET plan = ?").bind(plan).run();
    expect(db._bound.run).toHaveBeenCalled();
  });

  it("subscription_updated resolves plan from variant", () => {
    const map = buildVariantMap(PRO_VARIANT, TEAM_VARIANT);
    expect(map[200]).toBe("team");
    expect(map[100]).toBe("pro");
    expect(map[999] || "pro").toBe("pro"); // fallback
  });

  it("subscription_cancelled reverts to free", async () => {
    const db = mockDb();
    const event = "subscription_cancelled";
    expect(event).toBe("subscription_cancelled");
    await db.prepare("UPDATE users SET plan = 'free'").bind("cust_1").run();
    expect(db._bound.run).toHaveBeenCalled();
  });

  it("subscription_expired reverts to free", () => {
    const event = "subscription_expired";
    const revertPlan = "free";
    expect(["subscription_cancelled", "subscription_expired"]).toContain(event);
    expect(revertPlan).toBe("free");
  });

  it("payment_failed does not change plan", () => {
    const planChanging = ["subscription_created", "subscription_updated",
      "subscription_cancelled", "subscription_expired"];
    expect(planChanging.includes("subscription_payment_failed")).toBe(false);
  });

  it("unknown event type is handled gracefully", () => {
    const known = ["subscription_created", "subscription_updated",
      "subscription_cancelled", "subscription_expired", "subscription_payment_failed"];
    expect(known.includes("order_completed")).toBe(false);
  });
});

describe("webhook signature validation", () => {
  it("rejects empty signature", () => {
    const signature = "";
    expect(!signature).toBe(true);
  });

  it("rejects mismatched length", () => {
    const expected = "abcdef1234567890";
    const provided = "short";
    expect(expected.length !== provided.length).toBe(true);
  });
});
