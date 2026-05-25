// E2E test auth endpoint — bypasses OAuth for automated testing.
// Requires E2E_TEST_SECRET env var. Never works in production.

import { Hono } from "hono";
import type { Env } from "./types";
import { createJwt } from "./auth";
import { upsertUser } from "./usage";
import type { PlanId } from "./usage";

type AuthTestBody = {
  user_id: string;
  login: string;
  plan: PlanId;
  e2e_secret: string;
};

export const authTestRoutes = new Hono<{ Bindings: Env }>();

authTestRoutes.post("/e2e-login", async (c) => {
  const secret = c.env.E2E_TEST_SECRET;
  if (!secret) return c.json({ error: "not configured" }, 403);

  const body = await c.req.json<AuthTestBody>();
  if (!body.e2e_secret || body.e2e_secret !== secret) {
    return c.json({ error: "invalid secret" }, 403);
  }
  if (!body.user_id || !body.login || !body.plan) {
    return c.json({ error: "user_id, login, plan required" }, 400);
  }

  const sub = `e2e:${body.user_id}`;
  await upsertUser(c.env.DB, sub, body.login, "github");

  if (body.plan !== "free") {
    await c.env.DB.prepare(
      "UPDATE users SET plan = ?, updated_at = datetime('now') WHERE sub = ?"
    ).bind(body.plan, sub).run();
  }

  const now = Math.floor(Date.now() / 1000);
  const token = await createJwt(
    { sub, login: body.login, provider: "github", iat: now, exp: now + 3600 },
    c.env.JWT_SECRET
  );

  const user = {
    login: body.login,
    id: 0,
    avatar_url: `https://github.com/${body.login}.png`,
    name: body.login,
    provider: "github" as const,
  };

  return c.json({ token, user, plan: body.plan });
});
