// Regression tests for H-002: DORA `/api/enterprise/dora` leaked cross-tenant
// run durations because the `runs` SELECT had no project scope. Ensures each
// authenticated user sees metrics aggregated ONLY over their own projects.

import { describe, it, expect } from "vitest";
import { enterpriseRoutes } from "./enterprise-dora";
import { createJwt } from "./auth";

const JWT_SECRET = "test-dora-scope-secret";
const NOW = Math.floor(Date.now() / 1000);

async function token(sub: string, login = "tester"): Promise<string> {
  return createJwt(
    { sub, login, provider: "github", iat: NOW, exp: NOW + 3600 },
    JWT_SECRET,
  );
}

// ---------- In-memory D1 mock backed by typed fixture state ------------------

interface Membership { project_id: string; user_sub: string; }
interface Project { id: string; repo: string; }
interface RunRow { repo: string; duration_ms: number | null; status: string; finished_at: string | null; }
interface DeployRow { project_id: string; status: string; created_at: string; }

interface Fixture {
  memberships: Membership[];
  projects: Project[];
  runs: RunRow[];
  deploys: DeployRow[];
}

function makeDb(fx: Fixture): D1Database {
  const api = {
    prepare(sql: string) {
      const binds: unknown[] = [];
      const runner = {
        bind(...args: unknown[]) { binds.push(...args); return runner; },
        async first<T = unknown>(): Promise<T | null> { return null; },
        async run() { return { success: true, meta: { changes: 0 } }; },
        async all<T = unknown>(): Promise<{ results: T[]; success: boolean; meta: Record<string, unknown> }> {
          // SELECT project_id FROM project_memberships WHERE user_sub = ?
          if (/FROM\s+project_memberships/i.test(sql)) {
            const sub = binds[0] as string;
            return {
              results: fx.memberships
                .filter((m) => m.user_sub === sub)
                .map((m) => ({ project_id: m.project_id })) as unknown as T[],
              success: true,
              meta: {},
            };
          }
          // SELECT status, created_at FROM deployment_requests WHERE project_id IN (?,?,?) AND created_at >= ?
          if (/FROM\s+deployment_requests/i.test(sql)) {
            const since = binds[binds.length - 1] as string;
            const projectIds = binds.slice(0, -1) as string[];
            return {
              results: fx.deploys
                .filter((d) => projectIds.includes(d.project_id) && d.created_at >= since)
                .map((d) => ({ status: d.status, created_at: d.created_at })) as unknown as T[],
              success: true,
              meta: {},
            };
          }
          // SELECT runs.duration_ms, runs.status, runs.finished_at
          // FROM runs JOIN projects ON projects.repo = runs.repo
          // WHERE projects.id IN (...) AND runs.duration_ms IS NOT NULL AND runs.finished_at >= ?
          if (/FROM\s+runs/i.test(sql) && /JOIN\s+projects/i.test(sql)) {
            const since = binds[binds.length - 1] as string;
            const projectIds = binds.slice(0, -1) as string[];
            const reposInScope = new Set(
              fx.projects.filter((p) => projectIds.includes(p.id)).map((p) => p.repo),
            );
            return {
              results: fx.runs
                .filter((r) =>
                  reposInScope.has(r.repo) &&
                  r.duration_ms !== null &&
                  (r.finished_at ?? "") >= since,
                )
                .map((r) => ({
                  duration_ms: r.duration_ms,
                  status: r.status,
                  finished_at: r.finished_at,
                })) as unknown as T[],
              success: true,
              meta: {},
            };
          }
          return { results: [] as T[], success: true, meta: {} };
        },
      };
      return runner;
    },
  };
  return api as unknown as D1Database;
}

function buildEnv(db: D1Database): Record<string, unknown> {
  return { DB: db, JWT_SECRET };
}

async function callDora(env: Record<string, unknown>, auth?: string): Promise<Response> {
  const headers: Record<string, string> = {};
  if (auth) headers["authorization"] = `Bearer ${auth}`;
  const req = new Request("https://api.local/dora", { method: "GET", headers });
  return enterpriseRoutes.fetch(req, env);
}

// ---------- Fixtures ---------------------------------------------------------

function recentIso(daysAgo: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString();
}

function baseFixture(): Fixture {
  return {
    memberships: [
      { project_id: "proj-A", user_sub: "github:alice" },
      { project_id: "proj-B", user_sub: "github:bob" },
    ],
    projects: [
      { id: "proj-A", repo: "alice-org/repo-a" },
      { id: "proj-B", repo: "bob-org/repo-b" },
    ],
    runs: [
      // Alice: 3 runs with durations 100, 200, 300 (p50 = 200)
      { repo: "alice-org/repo-a", duration_ms: 100, status: "passed", finished_at: recentIso(1) },
      { repo: "alice-org/repo-a", duration_ms: 200, status: "passed", finished_at: recentIso(2) },
      { repo: "alice-org/repo-a", duration_ms: 300, status: "failed", finished_at: recentIso(3) },
      // Bob: 5 runs with durations 1000..5000 (p50 = 3000)
      { repo: "bob-org/repo-b", duration_ms: 1000, status: "passed", finished_at: recentIso(1) },
      { repo: "bob-org/repo-b", duration_ms: 2000, status: "passed", finished_at: recentIso(1) },
      { repo: "bob-org/repo-b", duration_ms: 3000, status: "passed", finished_at: recentIso(2) },
      { repo: "bob-org/repo-b", duration_ms: 4000, status: "failed", finished_at: recentIso(2) },
      { repo: "bob-org/repo-b", duration_ms: 5000, status: "failed", finished_at: recentIso(3) },
    ],
    deploys: [],
  };
}

// ---------- Tests ------------------------------------------------------------

describe("GET /dora tenant scoping (H-002)", () => {
  it("rejects unauthenticated requests", async () => {
    const env = buildEnv(makeDb(baseFixture()));
    const res = await callDora(env);
    expect(res.status).toBe(401);
  });

  it("Alice sees ONLY her 3 runs (p50 = 200ms), never Bob's data", async () => {
    const env = buildEnv(makeDb(baseFixture()));
    const res = await callDora(env, await token("github:alice", "alice"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { lead_time_ms_p50: number | null; mttr_ms_p50: number | null };
    expect(body.lead_time_ms_p50).toBe(200);
    expect(body.mttr_ms_p50).toBe(300);
    // Absolutely no value from Bob's 1000..5000 bucket should appear.
    expect([1000, 2000, 3000, 4000, 5000]).not.toContain(body.lead_time_ms_p50);
    expect([1000, 2000, 3000, 4000, 5000]).not.toContain(body.mttr_ms_p50);
  });

  it("Bob sees ONLY his 5 runs (p50 = 3000ms), never Alice's data", async () => {
    const env = buildEnv(makeDb(baseFixture()));
    const res = await callDora(env, await token("github:bob", "bob"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { lead_time_ms_p50: number | null; mttr_ms_p50: number | null };
    // p50 impl = durations[floor(n/2)]. Bob's durations [1000..5000] → [2] = 3000.
    expect(body.lead_time_ms_p50).toBe(3000);
    // Bob's failed durations [4000, 5000] → [floor(2/2)] = [1] = 5000.
    expect(body.mttr_ms_p50).toBe(5000);
    expect([100, 200, 300]).not.toContain(body.lead_time_ms_p50);
  });

  it("a user with no memberships gets an empty-shape response, not the global aggregate", async () => {
    const env = buildEnv(makeDb(baseFixture()));
    const res = await callDora(env, await token("github:eve", "eve"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { lead_time_ms_p50: number | null; deploy_count: number };
    expect(body.lead_time_ms_p50).toBeNull();
    expect(body.deploy_count).toBe(0);
  });

  it("combined aggregate (2600ms median over A+B) is NEVER returned to any user", async () => {
    // If the bug regressed, p50 over all 8 sorted durations would be 2000
    // (index floor(8/2)=4 → 3000) or the raw mix. Neither should match any
    // tenant-scoped expected value above — assert explicitly per-user.
    const env = buildEnv(makeDb(baseFixture()));
    const alice = await callDora(env, await token("github:alice"));
    const bob = await callDora(env, await token("github:bob"));
    const aBody = (await alice.json()) as { lead_time_ms_p50: number | null };
    const bBody = (await bob.json()) as { lead_time_ms_p50: number | null };
    expect(aBody.lead_time_ms_p50).not.toBe(bBody.lead_time_ms_p50);
    expect(aBody.lead_time_ms_p50).toBe(200);
    expect(bBody.lead_time_ms_p50).toBe(3000);
  });
});
