// Build Cache API — store and retrieve dependency/artifact caches to speed up CI runs.

import { Hono } from "hono";
import { verifyJwt } from "./auth";
import type { Env } from "./types";

export const cacheRoutes = new Hono<{ Bindings: Env }>();

interface CacheEntry {
  hash: string;
  sizeBytes: number;
  storedAt: string;
  hits: number;
}

const TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

// Store a cache entry
cacheRoutes.post("/store", async (c) => {
  const token = (c.req.header("authorization") ?? "").replace("Bearer ", "");
  const user = token ? await verifyJwt(token, c.env.JWT_SECRET) : null;
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const body = await c.req.json<{
    key: string;
    hash: string;
    projectId: string;
    sizeBytes: number;
  }>();

  if (!body.key || !body.hash || !body.projectId) {
    return c.json({ error: "key, hash, and projectId are required" }, 400);
  }
  if (typeof body.sizeBytes !== "number" || body.sizeBytes < 0) {
    return c.json({ error: "sizeBytes must be a positive number" }, 400);
  }

  const entry: CacheEntry = {
    hash: body.hash,
    sizeBytes: body.sizeBytes,
    storedAt: new Date().toISOString(),
    hits: 0,
  };

  const kvKey = `cache:${body.projectId}:${body.key}`;
  await c.env.RUNNERS.put(kvKey, JSON.stringify(entry), {
    expirationTtl: TTL_SECONDS,
  });

  return c.json({ ok: true, key: kvKey, expiresIn: TTL_SECONDS }, 201);
});

// Lookup a cache entry
cacheRoutes.get("/lookup/:projectId/:key", async (c) => {
  const token = (c.req.header("authorization") ?? "").replace("Bearer ", "");
  const user = token ? await verifyJwt(token, c.env.JWT_SECRET) : null;
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const projectId = c.req.param("projectId");
  const key = c.req.param("key");
  const kvKey = `cache:${projectId}:${key}`;

  const raw = await c.env.RUNNERS.get(kvKey);
  if (!raw) return c.json({ hit: false });

  const entry: CacheEntry = JSON.parse(raw);
  entry.hits += 1;

  await c.env.RUNNERS.put(kvKey, JSON.stringify(entry), {
    expirationTtl: TTL_SECONDS,
  });

  return c.json({
    hit: true,
    hash: entry.hash,
    url: `/api/cache/download/${projectId}/${key}`,
  });
});

// Invalidate a cache entry
cacheRoutes.delete("/invalidate/:projectId/:key", async (c) => {
  const token = (c.req.header("authorization") ?? "").replace("Bearer ", "");
  const user = token ? await verifyJwt(token, c.env.JWT_SECRET) : null;
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const projectId = c.req.param("projectId");
  const key = c.req.param("key");
  const kvKey = `cache:${projectId}:${key}`;

  await c.env.RUNNERS.delete(kvKey);
  return c.json({ ok: true });
});

// Cache stats for a project
cacheRoutes.get("/stats/:projectId", async (c) => {
  const token = (c.req.header("authorization") ?? "").replace("Bearer ", "");
  const user = token ? await verifyJwt(token, c.env.JWT_SECRET) : null;
  if (!user) return c.json({ error: "unauthorized" }, 401);

  const projectId = c.req.param("projectId");
  const prefix = `cache:${projectId}:`;

  const listed = await c.env.RUNNERS.list({ prefix });

  let totalHits = 0;
  let totalSize = 0;
  let entries = 0;

  for (const k of listed.keys) {
    const raw = await c.env.RUNNERS.get(k.name);
    if (!raw) continue;
    const entry: CacheEntry = JSON.parse(raw);
    entries += 1;
    totalHits += entry.hits;
    totalSize += entry.sizeBytes;
  }

  const lookups = totalHits + entries; // rough estimate
  const hitRate = lookups > 0 ? Math.round((totalHits / lookups) * 100) : 0;

  return c.json({ entries, totalHits, totalSize, hitRate });
});
