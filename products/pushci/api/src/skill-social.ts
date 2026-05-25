// v1.7.0 skill marketplace social layer: threaded comments, upvote toggle,
// usage telemetry, stats aggregation. Inspired by the KarpathyTalk social
// loop but reimplemented on Hono + D1. All mutations require JWT.

import { Hono } from "hono";
import { verifyJwt } from "./auth";
import type { Env } from "./types";
import type { Context } from "hono";

type Bindings = Env & { RUNNERS: KVNamespace };
export const skillSocialRoutes = new Hono<{ Bindings: Bindings }>();

interface CommentRow {
  id: string; skill_id: string; author_sub: string;
  author_login: string | null; body: string; created_at: string; parent_id: string | null;
}

async function authUser(c: Context<{ Bindings: Bindings }>) {
  const tok = (c.req.header("authorization") ?? "").replace("Bearer ", "");
  return tok ? verifyJwt(tok, c.env.JWT_SECRET) : null;
}

// POST /:id/comments — create a comment or reply.
skillSocialRoutes.post("/:id/comments", async (c) => {
  const user = await authUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  const body = await c.req.json<{ body: string; parent_id?: string }>().catch(() => null);
  if (!body || typeof body.body !== "string" || body.body.trim().length === 0) {
    return c.json({ error: "body required" }, 400);
  }
  const text = body.body.trim().slice(0, 2000);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await c.env.DB.prepare(
    `INSERT INTO skill_comments (id, skill_id, author_sub, author_login, body, created_at, parent_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, c.req.param("id"), user.sub, user.login ?? null, text, now, body.parent_id ?? null).run();
  return c.json({
    id, skill_id: c.req.param("id"), author_sub: user.sub, author_login: user.login ?? null,
    body: text, created_at: now, parent_id: body.parent_id ?? null,
  }, 201);
});

// GET /:id/comments — paginated thread (newest first). Public read.
skillSocialRoutes.get("/:id/comments", async (c) => {
  const limit = Math.min(100, Math.max(1, parseInt(c.req.query("limit") ?? "50", 10) || 50));
  const offset = Math.max(0, parseInt(c.req.query("offset") ?? "0", 10) || 0);
  const rs = await c.env.DB.prepare(
    `SELECT id, skill_id, author_sub, author_login, body, created_at, parent_id
     FROM skill_comments WHERE skill_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).bind(c.req.param("id"), limit, offset).all<CommentRow>();
  return c.json({ comments: rs.results ?? [], limit, offset });
});

// DELETE /:id/comments/:commentId — author-only.
skillSocialRoutes.delete("/:id/comments/:commentId", async (c) => {
  const user = await authUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  const row = await c.env.DB.prepare(
    `SELECT author_sub FROM skill_comments WHERE id = ? AND skill_id = ?`
  ).bind(c.req.param("commentId"), c.req.param("id")).first<{ author_sub: string }>();
  if (!row) return c.json({ error: "not found" }, 404);
  if (row.author_sub !== user.sub) return c.json({ error: "forbidden" }, 403);
  await c.env.DB.prepare(`DELETE FROM skill_comments WHERE id = ?`).bind(c.req.param("commentId")).run();
  return c.json({ ok: true });
});

// POST /:id/upvote — idempotent toggle. Returns new upvote count.
skillSocialRoutes.post("/:id/upvote", async (c) => {
  const user = await authUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  const skillId = c.req.param("id");
  const existing = await c.env.DB.prepare(
    `SELECT 1 AS v FROM skill_upvotes WHERE skill_id = ? AND user_sub = ?`
  ).bind(skillId, user.sub).first<{ v: number }>();
  if (existing) {
    await c.env.DB.prepare(`DELETE FROM skill_upvotes WHERE skill_id = ? AND user_sub = ?`)
      .bind(skillId, user.sub).run();
  } else {
    await c.env.DB.prepare(
      `INSERT INTO skill_upvotes (skill_id, user_sub, created_at) VALUES (?, ?, ?)`
    ).bind(skillId, user.sub, new Date().toISOString()).run();
  }
  const { results } = await c.env.DB.prepare(
    `SELECT COUNT(*) AS c FROM skill_upvotes WHERE skill_id = ?`
  ).bind(skillId).all<{ c: number }>();
  return c.json({ upvoted: !existing, upvotes_count: results?.[0]?.c ?? 0 });
});

// GET /:id/stats — public aggregation.
skillSocialRoutes.get("/:id/stats", async (c) => {
  const skillId = c.req.param("id");
  const thirtyAgo = new Date(Date.now() - 30 * 86400_000).toISOString();
  const db = c.env.DB;
  const [ups, cms, u30, uAll, top] = await Promise.all([
    db.prepare(`SELECT COUNT(*) AS c FROM skill_upvotes WHERE skill_id = ?`).bind(skillId).first<{ c: number }>(),
    db.prepare(`SELECT COUNT(*) AS c FROM skill_comments WHERE skill_id = ?`).bind(skillId).first<{ c: number }>(),
    db.prepare(`SELECT COUNT(*) AS c FROM skill_usage_events WHERE skill_id = ? AND invocation_at >= ?`).bind(skillId, thirtyAgo).first<{ c: number }>(),
    db.prepare(`SELECT COUNT(*) AS c FROM skill_usage_events WHERE skill_id = ?`).bind(skillId).first<{ c: number }>(),
    db.prepare(
      `SELECT user_sub, COUNT(*) AS uses FROM skill_usage_events
       WHERE skill_id = ? AND invocation_at >= ?
       GROUP BY user_sub ORDER BY uses DESC LIMIT 5`
    ).bind(skillId, thirtyAgo).all<{ user_sub: string; uses: number }>(),
  ]);
  const user = await authUser(c);
  let my_usage_count = 0;
  if (user) {
    const row = await db.prepare(
      `SELECT COUNT(*) AS c FROM skill_usage_events WHERE skill_id = ? AND user_sub = ?`
    ).bind(skillId, user.sub).first<{ c: number }>();
    my_usage_count = row?.c ?? 0;
  }
  return c.json({
    skill_id: skillId,
    upvotes_count: ups?.c ?? 0,
    comments_count: cms?.c ?? 0,
    usage_count_30d: u30?.c ?? 0,
    usage_count_all_time: uAll?.c ?? 0,
    top_users_30d: top.results ?? [],
    my_usage_count,
  });
});

// POST /:id/events/invoke — rate-limited telemetry ingest. CLI opt-in only.
skillSocialRoutes.post("/:id/events/invoke", async (c) => {
  const user = await authUser(c);
  if (!user) return c.json({ error: "unauthorized" }, 401);
  const rkey = `skill-invoke-rl:${user.sub}:${Math.floor(Date.now() / 60000)}`;
  const cur = parseInt((await c.env.RUNNERS.get(rkey)) ?? "0", 10);
  if (cur >= 60) return c.json({ error: "rate limit" }, 429);
  await c.env.RUNNERS.put(rkey, String(cur + 1), { expirationTtl: 120 });
  await c.env.DB.prepare(
    `INSERT INTO skill_usage_events (skill_id, user_sub, invocation_at) VALUES (?, ?, ?)`
  ).bind(c.req.param("id"), user.sub, new Date().toISOString()).run();
  return c.json({ ok: true }, 202);
});
