// Bus-factor + hotspot analytics — tenant-scoped persistence for PushCI v1.7.
//
// Follows the H-002 pattern: every read/write is gated by
// project_memberships lookup so one tenant's hotspots never leak to
// another. Author identities stored as opaque SHA-256 prefixes (no PII).

import { Hono } from "hono";
import type { Context } from "hono";
import { verifyJwt } from "./auth";
import type { Env } from "./types";

type Bindings = Env;
type Ctx = Context<{ Bindings: Bindings }>;
export const intelRoutes = new Hono<{ Bindings: Bindings }>();

export interface HotspotRecord {
  path: string;
  bus_factor: number;
  total: number;
  top_author_hash: string;
  last_touched: string;
}

export interface HotspotUpload {
  project_id: string;
  hotspots: HotspotRecord[];
}

const KV_PREFIX = "intel:hotspots:";

async function requireMember(c: Ctx, projectId: string): Promise<string | null> {
  const token = (c.req.header("authorization") ?? "").replace("Bearer ", "");
  if (!token) return null;
  const user = await verifyJwt(token, c.env.JWT_SECRET);
  if (!user) return null;
  const membership = await c.env.DB.prepare(
    "SELECT role FROM project_memberships WHERE project_id = ? AND user_sub = ?",
  )
    .bind(projectId, user.sub)
    .first();
  return membership ? user.sub : null;
}

// POST /hotspots — CLI uploads per-project hotspot snapshot.
intelRoutes.post("/hotspots", async (c: Ctx) => {
  let body: HotspotUpload;
  try {
    body = await c.req.json<HotspotUpload>();
  } catch {
    return c.json({ error: "invalid json" }, 400);
  }
  if (!body.project_id || !Array.isArray(body.hotspots)) {
    return c.json({ error: "project_id and hotspots required" }, 400);
  }
  const sub = await requireMember(c, body.project_id);
  if (!sub) return c.json({ error: "forbidden" }, 403);

  const scrubbed = body.hotspots
    .slice(0, 500)
    .map((h) => ({
      path: String(h.path ?? "").slice(0, 512),
      bus_factor: Math.max(0, Number(h.bus_factor ?? 0) | 0),
      total: Math.max(0, Number(h.total ?? 0) | 0),
      top_author_hash: String(h.top_author_hash ?? "").slice(0, 32),
      last_touched: String(h.last_touched ?? ""),
    }));

  await c.env.RUNNERS.put(
    KV_PREFIX + body.project_id,
    JSON.stringify({
      project_id: body.project_id,
      uploaded_by: sub,
      uploaded_at: new Date().toISOString(),
      hotspots: scrubbed,
    }),
    { expirationTtl: 86400 * 30 },
  );
  return c.json({ ok: true, count: scrubbed.length });
});

// GET /hotspots?project_id=... — fetch latest snapshot.
intelRoutes.get("/hotspots", async (c: Ctx) => {
  const projectId = c.req.query("project_id");
  if (!projectId) return c.json({ error: "project_id required" }, 400);
  const sub = await requireMember(c, projectId);
  if (!sub) return c.json({ error: "forbidden" }, 403);
  const cached = await c.env.RUNNERS.get(KV_PREFIX + projectId);
  if (!cached) {
    return c.json({ project_id: projectId, hotspots: [], uploaded_at: null });
  }
  return c.json(JSON.parse(cached));
});
