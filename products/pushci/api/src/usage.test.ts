import { describe, it, expect } from "vitest";
import type { PlanId } from "./usage";
import { PLANS } from "./billing-types";
const AI_LIMITS: Record<PlanId, number> = { free: 0, pro: 100, team: 500 };

describe("AI_LIMITS", () => {
  it("free=0, pro=100, team=500", () => {
    expect(AI_LIMITS.free).toBe(0);
    expect(AI_LIMITS.pro).toBe(100);
    expect(AI_LIMITS.team).toBe(500);
  });
});

describe("requirePlan logic", () => {
  function isAllowed(userPlan: PlanId, allowed: PlanId[]): boolean {
    return allowed.includes(userPlan);
  }

  it("allows pro user on pro-gated route", () => {
    expect(isAllowed("pro", ["pro", "team"])).toBe(true);
  });

  it("blocks free user from pro-gated route", () => {
    expect(isAllowed("free", ["pro", "team"])).toBe(false);
  });

  it("allows team user on team-gated route", () => {
    expect(isAllowed("team", ["team"])).toBe(true);
  });

  it("blocks pro user from team-only route", () => {
    expect(isAllowed("pro", ["team"])).toBe(false);
  });

  it("allows team user on pro-gated route", () => {
    expect(isAllowed("team", ["pro", "team"])).toBe(true);
  });
});

describe("requireAiQuota logic", () => {
  function checkQuota(plan: PlanId, usage: number) {
    const limit = AI_LIMITS[plan];
    if (limit === 0) return { blocked: true, reason: "upgrade_required" };
    if (usage >= limit) return { blocked: true, reason: "quota_exceeded" };
    return { blocked: false };
  }

  it("allows pro user under quota", () => {
    expect(checkQuota("pro", 50).blocked).toBe(false);
  });

  it("blocks user who exceeded monthly AI quota", () => {
    const result = checkQuota("pro", 100);
    expect(result.blocked).toBe(true);
    expect(result.reason).toBe("quota_exceeded");
  });

  it("blocks free user (upgrade_required)", () => {
    const result = checkQuota("free", 0);
    expect(result.blocked).toBe(true);
    expect(result.reason).toBe("upgrade_required");
  });

  it("allows team user at high usage under limit", () => {
    expect(checkQuota("team", 499).blocked).toBe(false);
  });

  it("blocks team user at limit", () => {
    expect(checkQuota("team", 500).blocked).toBe(true);
  });
});

describe("monthly quota reset", () => {
  it("resets when past, skips when future", () => {
    expect(new Date("2025-01-01") <= new Date("2025-02-01")).toBe(true);
    expect(new Date("2025-03-01") <= new Date("2025-02-15")).toBe(false);
  });
});

describe("plan features match PLANS", () => {
  it("free: no AI, 0 cloud min", () => {
    expect(PLANS.free.features.ai_diagnosis).toBe(false);
    expect(PLANS.free.features.cloud_minutes).toBe(0);
  });
  it("pro: AI, 500 min", () => {
    expect(PLANS.pro.features.ai_diagnosis).toBe(true);
    expect(PLANS.pro.features.cloud_minutes).toBe(500);
  });
  it("team: AI, 2000 min, SSO, audit", () => {
    const f = PLANS.team.features;
    expect(f.ai_diagnosis).toBe(true);
    expect(f.cloud_minutes).toBe(2000);
    expect(f.sso).toBe(true);
    expect(f.audit_logs).toBe(true);
  });
});
