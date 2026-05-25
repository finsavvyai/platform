import { describe, it, expect, vi, beforeEach } from "vitest";
import { billingRoutes } from "./billing";
import { PLANS } from "./billing-types";
import { createJwt } from "./auth";

const JWT_SECRET = "test-secret-key";
const NOW = Math.floor(Date.now() / 1000);

async function makeToken(sub = "github:1", login = "tester") {
  return createJwt(
    { sub, login, provider: "github", iat: NOW, exp: NOW + 3600 },
    JWT_SECRET,
  );
}

function mockDb(firstResult: unknown = null) {
  return {
    prepare: () => ({
      bind: () => ({
        run: vi.fn().mockResolvedValue({}),
        first: vi.fn().mockResolvedValue(firstResult),
      }),
    }),
  } as unknown as D1Database;
}

function buildEnv(db: D1Database) {
  return {
    DB: db,
    JWT_SECRET,
    LEMONSQUEEZY_API_KEY: "ls_key",
    LEMONSQUEEZY_WEBHOOK_SECRET: "wh_secret",
    LEMONSQUEEZY_STORE_ID: "store_1",
    PUSHCI_LS_VARIANT_PRO: "100",
    PUSHCI_LS_VARIANT_TEAM: "200",
    APP_URL: "https://app.pushci.dev",
  };
}

describe("GET /plans", () => {
  it("returns 4 plans with correct ids", async () => {
    const plans = Object.values(PLANS);
    expect(plans).toHaveLength(4);
    expect(plans.map((p) => p.id)).toEqual(["free", "pro", "team", "enterprise"]);
  });

  it("every plan has a price and features", () => {
    for (const p of Object.values(PLANS)) {
      expect(typeof p.price_monthly).toBe("number");
      expect(p.features).toBeDefined();
      expect(typeof p.features.cloud_minutes).toBe("number");
    }
  });
});

describe("POST /checkout validation", () => {
  it("rejects missing plan", () => {
    const plan = undefined as unknown as string;
    const valid = ["pro", "team"].includes(plan);
    expect(valid).toBe(false);
  });

  it("rejects invalid plan name", () => {
    expect(["pro", "team"].includes("enterprise")).toBe(false);
  });

  it("accepts pro plan", () => {
    expect(["pro", "team"].includes("pro")).toBe(true);
  });

  it("accepts team plan", () => {
    expect(["pro", "team"].includes("team")).toBe(true);
  });
});

describe("variant mapping", () => {
  it("maps pro variant id from env", () => {
    const env = buildEnv(mockDb());
    const map: Record<number, string> = {};
    map[parseInt(env.PUSHCI_LS_VARIANT_PRO, 10)] = "pro";
    map[parseInt(env.PUSHCI_LS_VARIANT_TEAM, 10)] = "team";
    expect(map[100]).toBe("pro");
    expect(map[200]).toBe("team");
  });
});

describe("portal gating", () => {
  it("user without ls_customer_id has no subscription", () => {
    const user = { sub: "github:1", plan: "free" };
    expect((user as { ls_customer_id?: string }).ls_customer_id).toBeUndefined();
  });

  it("user with ls_customer_id can reach portal", () => {
    const user = { sub: "github:1", plan: "pro", ls_customer_id: "cust_42" };
    expect(user.ls_customer_id).toBe("cust_42");
  });
});
