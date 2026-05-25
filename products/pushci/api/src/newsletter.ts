// Newsletter signup — stores emails in D1.

import { Hono } from "hono";
import type { Env } from "./types";

type Bindings = Env;
export const newsletterRoutes = new Hono<{ Bindings: Bindings }>();

newsletterRoutes.post("/newsletter", async (c) => {
  const body = await c.req.json<{ email?: string }>();
  const email = body.email?.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return c.json({ error: "valid email required" }, 400);
  }

  // Rate limit: 5 signups per IP per hour
  const ip = c.req.header("cf-connecting-ip") ?? "unknown";
  const rlKey = `nl-rl:${ip}:${Math.floor(Date.now() / 3600000)}`;
  const count = parseInt((await c.env.RUNNERS.get(rlKey)) ?? "0", 10);
  if (count >= 5) return c.json({ error: "too many signups" }, 429);
  await c.env.RUNNERS.put(rlKey, String(count + 1), { expirationTtl: 7200 });

  await c.env.DB.prepare(
    `INSERT OR IGNORE INTO newsletter_subscribers (email, source, created_at) VALUES (?, 'landing', datetime('now'))`
  ).bind(email).run();

  return c.json({ ok: true });
});
