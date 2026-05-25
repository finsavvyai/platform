// Tenant-scoping + auth coverage for /api/intel/hotspots (v1.7).
// Mirrors the H-002 pattern from enterprise-dora-tenant-scope.test.ts:
// alice cannot read or write bob's hotspots, and a non-member never
// sees data through the GET endpoint.

import { describe, expect, it } from "vitest";
import { intelRoutes, type HotspotUpload } from "./intel-routes";
import { createJwt } from "./auth";

const JWT_SECRET = "test-intel-secret";
const NOW = Math.floor(Date.now() / 1000);

async function token(sub: string): Promise<string> {
  return createJwt(
    { sub, login: sub, provider: "github", iat: NOW, exp: NOW + 3600 },
    JWT_SECRET,
  );
}

// In-memory KV + D1 stubs scoped to the minimum surface intel-routes uses.
interface Membership { project_id: string; user_sub: string; }

function makeEnv(memberships: Membership[]): Record<string, unknown> {
  const kv = new Map<string, string>();
  const RUNNERS = {
    async get(key: string) { return kv.get(key) ?? null; },
    async put(key: string, value: string) { kv.set(key, value); },
    async delete(key: string) { kv.delete(key); },
  };
  const DB = {
    prepare(sql: string) {
      const binds: unknown[] = [];
      const runner = {
        bind(...args: unknown[]) { binds.push(...args); return runner; },
        async first<T = unknown>(): Promise<T | null> {
          if (/FROM\s+project_memberships/i.test(sql)) {
            const [pid, sub] = binds as [string, string];
            const found = memberships.find(m => m.project_id === pid && m.user_sub === sub);
            return (found ? { role: "developer" } : null) as T | null;
          }
          return null;
        },
        async all() { return { results: [], success: true, meta: {} }; },
        async run() { return { success: true, meta: { changes: 0 } }; },
      };
      return runner;
    },
  };
  return { DB, RUNNERS, JWT_SECRET };
}

async function postHotspots(env: Record<string, unknown>, body: HotspotUpload, auth?: string) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (auth) headers["authorization"] = `Bearer ${auth}`;
  const req = new Request("https://api.local/hotspots", {
    method: "POST", headers, body: JSON.stringify(body),
  });
  return intelRoutes.fetch(req, env);
}

async function getHotspots(env: Record<string, unknown>, pid: string, auth?: string) {
  const headers: Record<string, string> = {};
  if (auth) headers["authorization"] = `Bearer ${auth}`;
  const req = new Request(`https://api.local/hotspots?project_id=${pid}`, { method: "GET", headers });
  return intelRoutes.fetch(req, env);
}

describe("POST /api/intel/hotspots", () => {
  it("rejects unauthenticated requests with 403", async () => {
    const env = makeEnv([]);
    const res = await postHotspots(env, { project_id: "p1", hotspots: [] });
    expect(res.status).toBe(403);
  });

  it("rejects members of a different project with 403 (H-002 scope)", async () => {
    const env = makeEnv([{ project_id: "alice-proj", user_sub: "alice" }]);
    const tok = await token("alice");
    const res = await postHotspots(env, { project_id: "bob-proj", hotspots: [] }, tok);
    expect(res.status).toBe(403);
  });

  it("stores hotspots for project members", async () => {
    const env = makeEnv([{ project_id: "alice-proj", user_sub: "alice" }]);
    const tok = await token("alice");
    const res = await postHotspots(env, {
      project_id: "alice-proj",
      hotspots: [{
        path: "a.ts", bus_factor: 1, total: 7, top_author_hash: "abc", last_touched: "2026-04-17",
      }],
    }, tok);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { count: number };
    expect(data.count).toBe(1);
  });

  it("returns 400 on malformed body", async () => {
    const env = makeEnv([{ project_id: "p", user_sub: "alice" }]);
    const tok = await token("alice");
    const req = new Request("https://api.local/hotspots", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${tok}` },
      body: "{not json",
    });
    const res = await intelRoutes.fetch(req, env);
    expect(res.status).toBe(400);
  });
});

describe("GET /api/intel/hotspots", () => {
  it("never returns another tenant's uploaded hotspots", async () => {
    const env = makeEnv([
      { project_id: "alice-proj", user_sub: "alice" },
      { project_id: "bob-proj", user_sub: "bob" },
    ]);
    const aliceTok = await token("alice");
    const bobTok = await token("bob");
    await postHotspots(env, {
      project_id: "bob-proj",
      hotspots: [{
        path: "secret.ts", bus_factor: 1, total: 99, top_author_hash: "bobhash", last_touched: "2026-04-01",
      }],
    }, bobTok);
    const leak = await getHotspots(env, "bob-proj", aliceTok);
    expect(leak.status).toBe(403);
  });

  it("returns empty shape for members with no prior upload", async () => {
    const env = makeEnv([{ project_id: "p", user_sub: "alice" }]);
    const tok = await token("alice");
    const res = await getHotspots(env, "p", tok);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { hotspots: unknown[]; uploaded_at: string | null };
    expect(body.hotspots).toEqual([]);
    expect(body.uploaded_at).toBeNull();
  });
});
