// Tests for the v1.7.0 skill marketplace social layer (skill-social.ts).
// In-memory D1 + KV shims, drive the Hono app directly.

import { describe, it, expect, beforeEach } from "vitest";
import { createJwt } from "./auth";
import { skillSocialRoutes } from "./skill-social";
import type { Env } from "./types";

const SECRET = "test-jwt-secret";
const SUB = "github:42"; const SUB2 = "github:7";

interface Row { [k: string]: string | number }
function makeDB(): { db: D1Database; store: Record<string, Row[]> } {
  const store: Record<string, Row[]> = {
    skill_comments: [], skill_upvotes: [], skill_usage_events: [],
  };
  const mkStmt = (sql: string, binds: unknown[] = []): D1PreparedStatement => ({
    bind: (...b: unknown[]) => mkStmt(sql, b),
    run: async () => { exec(sql, binds, store); return { success: true } as unknown as D1Result; },
    all: async <T = unknown>() => ({ results: select(sql, binds, store) as T[], success: true } as unknown as D1Result<T>),
    first: async <T = unknown>() => (select(sql, binds, store)[0] as T | null) ?? null,
    raw: async () => [],
  } as unknown as D1PreparedStatement);
  return { db: { prepare: (sql: string) => mkStmt(sql) } as unknown as D1Database, store };
}

function exec(sql: string, b: unknown[], s: Record<string, Row[]>) {
  if (sql.startsWith("INSERT INTO skill_comments")) {
    s.skill_comments.push({
      id: b[0] as string, skill_id: b[1] as string, author_sub: b[2] as string,
      author_login: (b[3] as string) ?? "", body: b[4] as string,
      created_at: b[5] as string, parent_id: (b[6] as string) ?? "",
    });
  } else if (sql.startsWith("INSERT INTO skill_upvotes")) {
    s.skill_upvotes.push({ skill_id: b[0] as string, user_sub: b[1] as string, created_at: b[2] as string });
  } else if (sql.startsWith("INSERT INTO skill_usage_events")) {
    s.skill_usage_events.push({ skill_id: b[0] as string, user_sub: b[1] as string, invocation_at: b[2] as string });
  } else if (sql.startsWith("DELETE FROM skill_comments")) {
    s.skill_comments = s.skill_comments.filter(r => r.id !== (b[0] as string));
  } else if (sql.startsWith("DELETE FROM skill_upvotes")) {
    s.skill_upvotes = s.skill_upvotes.filter(r => !(r.skill_id === b[0] && r.user_sub === b[1]));
  }
}

function select(sql: string, b: unknown[], s: Record<string, Row[]>): Row[] {
  if (sql.includes("COUNT(*) AS c FROM skill_comments")) {
    return [{ c: s.skill_comments.filter(r => r.skill_id === b[0]).length }];
  }
  if (sql.includes("FROM skill_comments WHERE id")) {
    return s.skill_comments.filter(r => r.id === b[0] && r.skill_id === b[1]);
  }
  if (sql.includes("FROM skill_comments WHERE skill_id")) {
    const rows = s.skill_comments.filter(r => r.skill_id === b[0]);
    rows.sort((a, c) => String(c.created_at).localeCompare(String(a.created_at)));
    return rows.slice(b[2] as number, (b[2] as number) + (b[1] as number));
  }
  if (sql.startsWith("SELECT 1 AS v FROM skill_upvotes")) {
    return s.skill_upvotes.filter(r => r.skill_id === b[0] && r.user_sub === b[1]).map(() => ({ v: 1 }));
  }
  if (sql.includes("COUNT(*) AS c FROM skill_upvotes")) {
    return [{ c: s.skill_upvotes.filter(r => r.skill_id === b[0]).length }];
  }
  if (sql.includes("COUNT(*) AS c FROM skill_usage_events WHERE skill_id = ? AND user_sub")) {
    return [{ c: s.skill_usage_events.filter(r => r.skill_id === b[0] && r.user_sub === b[1]).length }];
  }
  if (sql.includes("COUNT(*) AS c FROM skill_usage_events WHERE skill_id = ? AND invocation_at")) {
    return [{ c: s.skill_usage_events.filter(r => r.skill_id === b[0] && r.invocation_at >= (b[1] as string)).length }];
  }
  if (sql.includes("COUNT(*) AS c FROM skill_usage_events WHERE skill_id")) {
    return [{ c: s.skill_usage_events.filter(r => r.skill_id === b[0]).length }];
  }
  if (sql.includes("GROUP BY user_sub")) {
    const m = new Map<string, number>();
    s.skill_usage_events.filter(r => r.skill_id === b[0] && r.invocation_at >= (b[1] as string))
      .forEach(r => m.set(r.user_sub as string, (m.get(r.user_sub as string) ?? 0) + 1));
    return [...m.entries()].map(([user_sub, uses]) => ({ user_sub, uses })).sort((a, c) => c.uses - a.uses).slice(0, 5);
  }
  return [];
}

function makeKV(): KVNamespace {
  const m = new Map<string, string>();
  return {
    get: async (k: string) => m.get(k) ?? null,
    put: async (k: string, v: string) => { m.set(k, v); },
    delete: async (k: string) => { m.delete(k); },
    list: async () => ({ keys: [], list_complete: true, cacheStatus: null }),
    getWithMetadata: async () => ({ value: null, metadata: null, cacheStatus: null }),
  } as unknown as KVNamespace;
}

async function tok(sub = SUB): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return createJwt({ sub, login: sub === SUB ? "octo" : "other", provider: "github", iat: now, exp: now + 3600 }, SECRET);
}

async function call(env: Env, path: string, init: RequestInit & { bearer?: string } = {}): Promise<Response> {
  const { bearer, headers, ...rest } = init;
  const h = new Headers(headers);
  if (bearer) h.set("authorization", `Bearer ${bearer}`);
  if (init.body) h.set("content-type", "application/json");
  return skillSocialRoutes.fetch(new Request(`http://t${path}`, { ...rest, headers: h }), env);
}

describe("skill-social routes", () => {
  let env: Env;
  beforeEach(() => { env = { DB: makeDB().db, RUNNERS: makeKV(), JWT_SECRET: SECRET } as Env; });

  it("rejects unauthenticated comment creation", async () => {
    const r = await call(env, "/heal/comments", { method: "POST", body: JSON.stringify({ body: "hi" }) });
    expect(r.status).toBe(401);
  });
  it("creates a comment with 201 and payload", async () => {
    const r = await call(env, "/heal/comments", { method: "POST", bearer: await tok(), body: JSON.stringify({ body: "nice skill" }) });
    expect(r.status).toBe(201);
    const j = await r.json() as { id: string; body: string; author_sub: string };
    expect(j.body).toBe("nice skill"); expect(j.author_sub).toBe(SUB);
  });
  it("creates a reply with parent_id", async () => {
    const p = await call(env, "/heal/comments", { method: "POST", bearer: await tok(), body: JSON.stringify({ body: "top" }) });
    const parent = await p.json() as { id: string };
    const r = await call(env, "/heal/comments", { method: "POST", bearer: await tok(SUB2), body: JSON.stringify({ body: "reply", parent_id: parent.id }) });
    const j = await r.json() as { parent_id: string };
    expect(j.parent_id).toBe(parent.id);
  });
  it("rejects empty comment body with 400", async () => {
    const r = await call(env, "/heal/comments", { method: "POST", bearer: await tok(), body: JSON.stringify({ body: "" }) });
    expect(r.status).toBe(400);
  });
  it("lists comments paginated public", async () => {
    for (let i = 0; i < 3; i++) await call(env, "/heal/comments", { method: "POST", bearer: await tok(), body: JSON.stringify({ body: `c${i}` }) });
    const r = await call(env, "/heal/comments?limit=10");
    const j = await r.json() as { comments: unknown[] };
    expect(j.comments).toHaveLength(3);
  });
  it("author can delete own comment", async () => {
    const c = await (await call(env, "/heal/comments", { method: "POST", bearer: await tok(), body: JSON.stringify({ body: "x" }) })).json() as { id: string };
    const r = await call(env, `/heal/comments/${c.id}`, { method: "DELETE", bearer: await tok() });
    expect(r.status).toBe(200);
  });
  it("non-author delete is forbidden 403", async () => {
    const c = await (await call(env, "/heal/comments", { method: "POST", bearer: await tok(), body: JSON.stringify({ body: "x" }) })).json() as { id: string };
    const r = await call(env, `/heal/comments/${c.id}`, { method: "DELETE", bearer: await tok(SUB2) });
    expect(r.status).toBe(403);
  });
  it("delete returns 404 for missing comment", async () => {
    const r = await call(env, "/heal/comments/nope", { method: "DELETE", bearer: await tok() });
    expect(r.status).toBe(404);
  });
  it("upvote toggles on then off and returns counts", async () => {
    const a = await (await call(env, "/heal/upvote", { method: "POST", bearer: await tok() })).json() as { upvoted: boolean; upvotes_count: number };
    expect(a.upvoted).toBe(true); expect(a.upvotes_count).toBe(1);
    const b = await (await call(env, "/heal/upvote", { method: "POST", bearer: await tok() })).json() as { upvoted: boolean; upvotes_count: number };
    expect(b.upvoted).toBe(false); expect(b.upvotes_count).toBe(0);
  });
  it("upvote requires auth", async () => {
    const r = await call(env, "/heal/upvote", { method: "POST" });
    expect(r.status).toBe(401);
  });
  it("multiple users upvote the same skill independently", async () => {
    await call(env, "/heal/upvote", { method: "POST", bearer: await tok() });
    const r = await (await call(env, "/heal/upvote", { method: "POST", bearer: await tok(SUB2) })).json() as { upvotes_count: number };
    expect(r.upvotes_count).toBe(2);
  });
  it("stats aggregates comments, upvotes, usage counts", async () => {
    await call(env, "/heal/comments", { method: "POST", bearer: await tok(), body: JSON.stringify({ body: "a" }) });
    await call(env, "/heal/upvote", { method: "POST", bearer: await tok() });
    await call(env, "/heal/events/invoke", { method: "POST", bearer: await tok() });
    await call(env, "/heal/events/invoke", { method: "POST", bearer: await tok(SUB2) });
    const j = await (await call(env, "/heal/stats")).json() as {
      upvotes_count: number; comments_count: number; usage_count_all_time: number; usage_count_30d: number; top_users_30d: unknown[]
    };
    expect(j.upvotes_count).toBe(1); expect(j.comments_count).toBe(1);
    expect(j.usage_count_all_time).toBe(2); expect(j.usage_count_30d).toBe(2);
    expect(j.top_users_30d.length).toBe(2);
  });
  it("stats my_usage_count is 0 without auth", async () => {
    const j = await (await call(env, "/heal/stats")).json() as { my_usage_count: number };
    expect(j.my_usage_count).toBe(0);
  });
  it("stats my_usage_count shows personal invocations with auth", async () => {
    await call(env, "/heal/events/invoke", { method: "POST", bearer: await tok() });
    await call(env, "/heal/events/invoke", { method: "POST", bearer: await tok() });
    const j = await (await call(env, "/heal/stats", { bearer: await tok() })).json() as { my_usage_count: number };
    expect(j.my_usage_count).toBe(2);
  });
  it("invoke event requires auth", async () => {
    const r = await call(env, "/heal/events/invoke", { method: "POST" });
    expect(r.status).toBe(401);
  });
  it("pagination offset and limit honored", async () => {
    for (let i = 0; i < 5; i++) {
      await call(env, "/heal/comments", { method: "POST", bearer: await tok(), body: JSON.stringify({ body: `c${i}` }) });
    }
    const j = await (await call(env, "/heal/comments?limit=2&offset=1")).json() as { comments: unknown[]; limit: number; offset: number };
    expect(j.comments).toHaveLength(2); expect(j.limit).toBe(2); expect(j.offset).toBe(1);
  });
});
