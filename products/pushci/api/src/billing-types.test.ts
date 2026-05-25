import { describe, it, expect } from "vitest";
import { PLANS } from "./billing-types";
import type { PlanId, Plan } from "./billing-types";

describe("billing-types plan definitions", () => {
  const planIds: PlanId[] = ["free", "pro", "team", "enterprise"];

  it("has exactly 4 plans", () => {
    expect(Object.keys(PLANS)).toHaveLength(4);
  });

  it("all plans have required fields", () => {
    for (const id of planIds) {
      const p = PLANS[id];
      expect(p.id).toBe(id);
      expect(p.name).toBeTruthy();
      expect(typeof p.price_monthly).toBe("number");
      expect(typeof p.price_annual).toBe("number");
      expect(p.features).toBeDefined();
    }
  });

  it("pro plan has correct pricing ($9/$90)", () => {
    expect(PLANS.pro.price_monthly).toBe(9);
    expect(PLANS.pro.price_annual).toBe(90);
  });

  it("team plan has correct per-seat pricing ($29/$290)", () => {
    expect(PLANS.team.price_monthly).toBe(29);
    expect(PLANS.team.price_annual).toBe(290);
  });

  it("free plan has zero pricing", () => {
    expect(PLANS.free.price_monthly).toBe(0);
    expect(PLANS.free.price_annual).toBe(0);
  });

  it("free plan: AI disabled, 0 cloud minutes", () => {
    expect(PLANS.free.features.ai_diagnosis).toBe(false);
    expect(PLANS.free.features.cloud_minutes).toBe(0);
  });

  it("pro plan: AI enabled, 500 cloud minutes", () => {
    expect(PLANS.pro.features.ai_diagnosis).toBe(true);
    expect(PLANS.pro.features.cloud_minutes).toBe(500);
  });

  it("team plan: AI enabled, 2000 cloud min, SSO, audit", () => {
    expect(PLANS.team.features.ai_diagnosis).toBe(true);
    expect(PLANS.team.features.cloud_minutes).toBe(2000);
    expect(PLANS.team.features.sso).toBe(true);
    expect(PLANS.team.features.audit_logs).toBe(true);
  });
});
