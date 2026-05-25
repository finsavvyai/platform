// Notification preferences — stored in KV.

import { Hono } from "hono";
import type { Env, JwtPayload } from "./types";
import { verifyJwt } from "./auth";

type Bindings = Env;

interface NotificationPreferences {
  run_failed: boolean;
  deploy_approval: boolean;
  weekly_digest: boolean;
}

const DEFAULTS: NotificationPreferences = {
  run_failed: true,
  deploy_approval: true,
  weekly_digest: false,
};

function kvKey(sub: string): string {
  return `notif:${sub}`;
}

async function getUser(c: { req: { header: (n: string) => string | undefined }; env: Env }): Promise<JwtPayload | null> {
  const token = (c.req.header("authorization") ?? "").replace("Bearer ", "");
  return token ? verifyJwt(token, c.env.JWT_SECRET) : null;
}

export const notificationRoutes = new Hono<{ Bindings: Bindings }>();

notificationRoutes.get("/preferences", async (c) => {
  const user = await getUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  const raw = await c.env.RUNNERS.get(kvKey(user.sub));
  const prefs: NotificationPreferences = raw ? JSON.parse(raw) : DEFAULTS;
  return c.json({ preferences: prefs });
});

notificationRoutes.put("/preferences", async (c) => {
  const user = await getUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  const body = await c.req.json<Partial<NotificationPreferences>>();
  const raw = await c.env.RUNNERS.get(kvKey(user.sub));
  const current: NotificationPreferences = raw ? JSON.parse(raw) : DEFAULTS;
  const updated: NotificationPreferences = {
    run_failed: typeof body.run_failed === "boolean" ? body.run_failed : current.run_failed,
    deploy_approval: typeof body.deploy_approval === "boolean" ? body.deploy_approval : current.deploy_approval,
    weekly_digest: typeof body.weekly_digest === "boolean" ? body.weekly_digest : current.weekly_digest,
  };
  await c.env.RUNNERS.put(kvKey(user.sub), JSON.stringify(updated));
  return c.json({ preferences: updated });
});
