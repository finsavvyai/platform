import { Hono } from "hono";
import type { Env } from "./types";
import { PLANS, type PlanId, type PlanFeatures } from "./billing-types";
import { verifyJwt } from "./auth";
import { getUser } from "./usage";

export const entitlementRoutes = new Hono<{ Bindings: Env }>();

// Features a customer might ask about. Keep in sync with PlanFeatures.
export type FeatureKey =
  | "ai_diagnosis"
  | "ai_edit"
  | "cloud_minutes"
  | "cloud_schedules"
  | "deploy_targets"
  | "sso"
  | "audit_logs"
  | "priority_support";

export interface EntitlementResult {
  plan: PlanId;
  feature: FeatureKey;
  allowed: boolean;
  limit: number | boolean;
  used?: number;
  upgrade_to?: PlanId;
  upgrade_url?: string;
}

export function planOf(user: { plan?: string | null } | null): PlanId {
  const p = (user?.plan ?? "free") as PlanId;
  return p in PLANS ? p : "free";
}

export function featureValue(plan: PlanId, feature: FeatureKey): number | boolean {
  const f = PLANS[plan].features as unknown as Record<string, number | boolean>;
  return f[feature];
}

export function isAllowed(plan: PlanId, feature: FeatureKey, used = 0): boolean {
  const v = featureValue(plan, feature);
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return used < v;
  return false;
}

function cheapestPlanWith(feature: FeatureKey): PlanId | undefined {
  const order: PlanId[] = ["free", "pro", "team"];
  for (const id of order) {
    const v = featureValue(id, feature);
    if (typeof v === "boolean" ? v : v > 0) return id;
  }
  return undefined;
}

entitlementRoutes.get("/me/entitlements", async (c) => {
  const token = (c.req.header("authorization") ?? "").replace("Bearer ", "");
  const payload = token ? await verifyJwt(token, c.env.JWT_SECRET) : null;
  if (!payload) return c.json({ error: "unauthorized" }, 401);

  const user = await getUser(c.env.DB, payload.sub);
  const plan = planOf(user);
  return c.json({
    plan,
    name: PLANS[plan].name,
    features: PLANS[plan].features as PlanFeatures,
  });
});

entitlementRoutes.get("/me/entitlements/:feature", async (c) => {
  const token = (c.req.header("authorization") ?? "").replace("Bearer ", "");
  const payload = token ? await verifyJwt(token, c.env.JWT_SECRET) : null;
  if (!payload) return c.json({ error: "unauthorized" }, 401);

  const feature = c.req.param("feature") as FeatureKey;
  if (!(feature in PLANS.free.features)) {
    return c.json({ error: "unknown feature" }, 400);
  }

  const user = await getUser(c.env.DB, payload.sub);
  const plan = planOf(user);
  const used = await countFeatureUse(c.env.DB, payload.sub, feature);
  const limit = featureValue(plan, feature);
  const allowed = isAllowed(plan, feature, used);

  const result: EntitlementResult = { plan, feature, allowed, limit, used };
  if (!allowed) {
    const target = cheapestPlanWith(feature);
    if (target && target !== plan) {
      result.upgrade_to = target;
      result.upgrade_url = "https://app.pushci.dev/billing";
    }
  }
  return c.json(result);
});

async function countFeatureUse(
  db: D1Database,
  userId: string,
  feature: FeatureKey,
): Promise<number> {
  const month = new Date().toISOString().slice(0, 7);
  const row = await db
    .prepare(
      "SELECT count FROM feature_usage WHERE user_id = ?1 AND feature = ?2 AND period = ?3",
    )
    .bind(userId, feature, month)
    .first<{ count: number }>();
  return row?.count ?? 0;
}

export async function recordFeatureUse(
  db: D1Database,
  userId: string,
  feature: FeatureKey,
  n = 1,
): Promise<void> {
  const month = new Date().toISOString().slice(0, 7);
  await db
    .prepare(
      `INSERT INTO feature_usage (user_id, feature, period, count)
       VALUES (?1, ?2, ?3, ?4)
       ON CONFLICT(user_id, feature, period) DO UPDATE SET count = count + ?4`,
    )
    .bind(userId, feature, month, n)
    .run();
}
