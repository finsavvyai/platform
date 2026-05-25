import type { Context, Next } from "hono";
import type { Env, JwtPayload } from "./types";
import { verifyJwt } from "./auth";

export type PlanId = "free" | "pro" | "team";

interface UserRecord {
  sub: string;
  plan: PlanId;
  ai_usage_count: number;
  ai_usage_reset_at: string;
}

const AI_LIMITS: Record<PlanId, number> = {
  free: 0,
  pro: 100,
  team: 500,
};

export async function upsertUser(
  db: D1Database,
  sub: string,
  login: string,
  provider: string,
  email?: string | null
): Promise<UserRecord> {
  await db
    .prepare(
      `INSERT INTO users (sub, login, provider, email) VALUES (?, ?, ?, ?)
       ON CONFLICT(sub) DO UPDATE SET login = excluded.login, email = COALESCE(excluded.email, users.email), updated_at = datetime('now')`
    )
    .bind(sub, login, provider, email ?? null)
    .run();

  const user = await db
    .prepare("SELECT sub, plan, ai_usage_count, ai_usage_reset_at FROM users WHERE sub = ?")
    .bind(sub)
    .first<UserRecord>();

  return user!;
}

export async function getUser(db: D1Database, sub: string): Promise<UserRecord | null> {
  return db
    .prepare("SELECT sub, plan, ai_usage_count, ai_usage_reset_at FROM users WHERE sub = ?")
    .bind(sub)
    .first<UserRecord>();
}

export async function incrementAiUsage(db: D1Database, sub: string): Promise<void> {
  await db
    .prepare("UPDATE users SET ai_usage_count = ai_usage_count + 1, updated_at = datetime('now') WHERE sub = ?")
    .bind(sub)
    .run();
}

async function resetUsageIfNeeded(db: D1Database, user: UserRecord): Promise<UserRecord> {
  const resetAt = new Date(user.ai_usage_reset_at);
  if (resetAt <= new Date()) {
    await db
      .prepare(
        `UPDATE users SET ai_usage_count = 0,
         ai_usage_reset_at = datetime('now', 'start of month', '+1 month'),
         updated_at = datetime('now') WHERE sub = ?`
      )
      .bind(user.sub)
      .run();
    return { ...user, ai_usage_count: 0 };
  }
  return user;
}

export function requirePlan(...allowed: PlanId[]) {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    const token = (c.req.header("authorization") ?? "").replace("Bearer ", "");
    if (!token) return c.json({ error: "unauthorized" }, 401);

    const payload = await verifyJwt(token, c.env.JWT_SECRET);
    if (!payload) return c.json({ error: "unauthorized" }, 401);

    let user = await getUser(c.env.DB, payload.sub);
    if (!user) {
      user = await upsertUser(c.env.DB, payload.sub, payload.login, payload.provider);
    }

    const plan = (user.plan || "free") as PlanId;
    if (!allowed.includes(plan)) {
      return c.json({
        error: "upgrade_required",
        message: `This feature requires a ${allowed[0]} plan or higher`,
        current_plan: plan,
        upgrade_url: "https://app.pushci.dev/billing",
      }, 403);
    }

    await next();
  };
}

export function requireAiQuota() {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    const token = (c.req.header("authorization") ?? "").replace("Bearer ", "");
    if (!token) return c.json({ error: "unauthorized" }, 401);

    const payload = await verifyJwt(token, c.env.JWT_SECRET);
    if (!payload) return c.json({ error: "unauthorized" }, 401);

    let user = await getUser(c.env.DB, payload.sub);
    if (!user) {
      user = await upsertUser(c.env.DB, payload.sub, payload.login, payload.provider);
    }

    user = await resetUsageIfNeeded(c.env.DB, user);
    const plan = (user.plan || "free") as PlanId;
    const limit = AI_LIMITS[plan];

    if (limit === 0) {
      return c.json({
        error: "upgrade_required",
        message: "AI features require a Pro plan. Use your own ANTHROPIC_API_KEY locally for free.",
        current_plan: plan,
        upgrade_url: "https://app.pushci.dev/billing",
      }, 403);
    }

    if (user.ai_usage_count >= limit) {
      return c.json({
        error: "quota_exceeded",
        message: `AI quota exceeded (${user.ai_usage_count}/${limit} this month)`,
        current_plan: plan,
        usage: user.ai_usage_count,
        limit,
        upgrade_url: "https://app.pushci.dev/billing",
      }, 429);
    }

    await incrementAiUsage(c.env.DB, user.sub);
    await next();
  };
}
