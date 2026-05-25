// Tests for Stream F compliance — hash chain + evidence export shape.

import { describe, it, expect } from "vitest";
import {
  computeEntryHash,
  canonicalJson,
  verifyAuditChain,
  extractChainMetadata,
  AUDIT_CHAIN_GENESIS,
  type AuditChainRow,
} from "./audit-immutable";
import { complianceRoutes, _internal } from "./compliance";
import { createJwt } from "./auth";

const JWT_SECRET = "test-compliance-secret";
const NOW = Math.floor(Date.now() / 1000);

async function token(sub = "github:42", login = "auditor") {
  return createJwt(
    { sub, login, provider: "github", iat: NOW, exp: NOW + 3600 },
    JWT_SECRET,
  );
}

// ---------- Minimal in-memory D1 mock ----------------------------------------

interface Row {
  id: number;
  actor_sub: string | null;
  actor_login: string | null;
  action: string;
  resource_type: string;
  resource_id: string;
  details_json: string;
  created_at: string;
}

function makeDb(initial: Row[] = []): D1Database {
  const state = { audit: [...initial] as Row[], memberships: [] as any[], teams: [] as any[] };

  const api = {
    prepare(sql: string) {
      const binds: unknown[] = [];
      const runner = {
        bind(...args: unknown[]) {
          binds.push(...args);
          return runner;
        },
        async first<T = unknown>(): Promise<T | null> {
          if (/team_memberships/i.test(sql) && /role\s*=\s*'admin'/i.test(sql)) {
            const sub = binds[0] as string;
            return (state.teams.find((r) => r.user_sub === sub && r.role === "admin")
              ? ({ ok: 1 } as unknown as T)
              : null);
          }
          return null;
        },
        async run() {
          if (/^INSERT\s+INTO\s+audit_logs/i.test(sql)) {
            const [actor_sub, actor_login, action, resource_type, resource_id, details_json] =
              binds as (string | null)[];
            state.audit.push({
              id: state.audit.length + 1,
              actor_sub: actor_sub ?? null,
              actor_login: actor_login ?? null,
              action: action as string,
              resource_type: resource_type as string,
              resource_id: resource_id as string,
              details_json: (details_json as string) ?? "{}",
              created_at: new Date().toISOString(),
            });
            return { success: true, meta: { changes: 1 } };
          }
          if (/^UPDATE\s+audit_logs/i.test(sql)) {
            const [newLogin, sub] = binds as (string | null)[];
            let changes = 0;
            for (const r of state.audit) {
              if (r.actor_sub === sub) {
                r.actor_login = newLogin;
                changes++;
              }
            }
            return { success: true, meta: { changes } };
          }
          return { success: true, meta: { changes: 0 } };
        },
        async all<T = unknown>() {
          if (/FROM\s+audit_logs/i.test(sql) && /WHERE\s+id\s*>=\s*\?\s*AND\s+id\s*<=\s*\?/i.test(sql)) {
            const [from, to] = binds as number[];
            const out = state.audit
              .filter((r) => r.id >= from && r.id <= to)
              .sort((a, b) => a.id - b.id);
            return { results: out as unknown as T[], success: true, meta: {} };
          }
          if (/FROM\s+audit_logs/i.test(sql) && /actor_sub\s*=\s*\?/i.test(sql)) {
            const sub = binds[0] as string;
            return {
              results: state.audit.filter((r) => r.actor_sub === sub) as unknown as T[],
              success: true,
              meta: {},
            };
          }
          if (/FROM\s+audit_logs/i.test(sql)) {
            return {
              results: [...state.audit].sort((a, b) => b.id - a.id).slice(0, 1000) as unknown as T[],
              success: true,
              meta: {},
            };
          }
          if (/FROM\s+project_memberships/i.test(sql) && /user_sub\s*=\s*\?/i.test(sql)) {
            const sub = binds[0] as string;
            return {
              results: state.memberships.filter((m) => m.user_sub === sub) as unknown as T[],
              success: true,
              meta: {},
            };
          }
          if (/FROM\s+project_memberships/i.test(sql)) {
            return { results: state.memberships as unknown as T[], success: true, meta: {} };
          }
          if (/FROM\s+team_memberships/i.test(sql)) {
            const sub = binds[0] as string;
            return {
              results: state.teams.filter((t) => t.user_sub === sub) as unknown as T[],
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

function makeKv(): KVNamespace {
  const store = new Map<string, string>();
  return {
    async get(key: string) {
      return store.get(key) ?? null;
    },
    async put(key: string, value: string) {
      store.set(key, value);
    },
    async delete(key: string) {
      store.delete(key);
    },
    async list() {
      return { keys: [...store.keys()].map((name) => ({ name })), list_complete: true, cursor: "" };
    },
  } as unknown as KVNamespace;
}

function buildEnv(db: D1Database, kv: KVNamespace = makeKv()) {
  return {
    DB: db,
    RUNNERS: kv,
    JWT_SECRET,
    APP_URL: "https://app.pushci.dev",
    ENVIRONMENT: "test",
    ANTHROPIC_API_KEY: "",
    GITHUB_CLIENT_ID: "",
    GITHUB_CLIENT_SECRET: "",
    GITLAB_CLIENT_ID: "",
    GITLAB_CLIENT_SECRET: "",
    GITLAB_BASE_URL: "",
    GOOGLE_CLIENT_ID: "",
    GOOGLE_CLIENT_SECRET: "",
    LINKEDIN_CLIENT_ID: "",
    LINKEDIN_CLIENT_SECRET: "",
    FACEBOOK_CLIENT_ID: "",
    FACEBOOK_CLIENT_SECRET: "",
    BITBUCKET_CLIENT_ID: "",
    BITBUCKET_CLIENT_SECRET: "",
    MICROSOFT_CLIENT_ID: "",
    MICROSOFT_CLIENT_SECRET: "",
    MICROSOFT_TENANT_ID: "",
    LEMONSQUEEZY_API_KEY: "",
    LEMONSQUEEZY_WEBHOOK_SECRET: "",
    LEMONSQUEEZY_STORE_ID: "",
    PUSHCI_LS_VARIANT_PRO: "",
    PUSHCI_LS_VARIANT_TEAM: "",
  } as unknown as Record<string, unknown>;
}

// ---------- Hash chain unit tests --------------------------------------------

describe("canonicalJson", () => {
  it("produces stable output regardless of key order", () => {
    const a = canonicalJson({ a: 1, b: 2, c: { y: 1, x: 2 } });
    const b = canonicalJson({ c: { x: 2, y: 1 }, b: 2, a: 1 });
    expect(a).toBe(b);
  });

  it("sorts nested arrays only as-is", () => {
    const out = canonicalJson([3, 1, 2]);
    expect(out).toBe("[3,1,2]");
  });
});

describe("computeEntryHash", () => {
  it("hashes deterministically", async () => {
    const entry = {
      actor_sub: "u1",
      actor_login: "alice",
      action: "run.start",
      resource_type: "run",
      resource_id: "r1",
      details: { foo: "bar" },
    };
    const h1 = await computeEntryHash(entry, AUDIT_CHAIN_GENESIS);
    const h2 = await computeEntryHash(entry, AUDIT_CHAIN_GENESIS);
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
  });

  it("chains different hashes for different previous", async () => {
    const entry = {
      actor_sub: "u1",
      actor_login: "alice",
      action: "run.start",
      resource_type: "run",
      resource_id: "r1",
      details: {},
    };
    const h1 = await computeEntryHash(entry, AUDIT_CHAIN_GENESIS);
    const h2 = await computeEntryHash(entry, "a".repeat(64));
    expect(h1).not.toBe(h2);
  });
});

// Build a valid hash-chained row set by computing hashes ourselves.
async function buildChain(entries: Array<{ action: string; details?: Record<string, unknown> }>): Promise<Row[]> {
  const rows: Row[] = [];
  let prev = AUDIT_CHAIN_GENESIS;
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const entry = {
      actor_sub: "sub1",
      actor_login: "alice",
      action: e.action,
      resource_type: "run",
      resource_id: `r${i}`,
      details: e.details ?? {},
    };
    const entry_hash = await computeEntryHash(entry, prev);
    const details_json = JSON.stringify({
      ...entry.details,
      _chain: { prev_hash: prev, entry_hash, chained_at: new Date().toISOString(), tenant: "t1" },
    });
    rows.push({
      id: i + 1,
      actor_sub: entry.actor_sub,
      actor_login: entry.actor_login,
      action: entry.action,
      resource_type: entry.resource_type,
      resource_id: entry.resource_id,
      details_json,
      created_at: new Date().toISOString(),
    });
    prev = entry_hash;
  }
  return rows;
}

describe("verifyAuditChain", () => {
  it("validates a clean chain", async () => {
    const rows = await buildChain([
      { action: "run.start" },
      { action: "run.finish", details: { ok: true } },
      { action: "deploy.request" },
    ]);
    const db = makeDb(rows);
    const res = await verifyAuditChain(db, 1, 3);
    expect(res.valid).toBe(true);
    expect(res.checked).toBe(3);
  });

  it("detects a tampered entry", async () => {
    const rows = await buildChain([
      { action: "run.start" },
      { action: "run.finish", details: { ok: true } },
      { action: "deploy.request" },
    ]);
    // Tamper with row 2's action without updating its hash.
    const tampered = { ...rows[1], action: "run.hijacked" };
    const db = makeDb([rows[0], tampered, rows[2]]);
    const res = await verifyAuditChain(db, 1, 3);
    expect(res.valid).toBe(false);
    expect(res.brokenAt).toBe(2);
    expect(res.reason).toBe("entry_hash_mismatch");
  });

  it("detects a chain break (missing prev link)", async () => {
    const rows = await buildChain([{ action: "a" }, { action: "b" }]);
    // Rebuild row 2 as if it followed a different predecessor.
    const fakeEntry = {
      actor_sub: "sub1",
      actor_login: "alice",
      action: "b",
      resource_type: "run",
      resource_id: "r1",
      details: {},
    };
    const badPrev = "f".repeat(64);
    const badHash = await computeEntryHash(fakeEntry, badPrev);
    rows[1].details_json = JSON.stringify({
      _chain: { prev_hash: badPrev, entry_hash: badHash, chained_at: "x", tenant: "t1" },
    });
    const db = makeDb(rows);
    const res = await verifyAuditChain(db, 1, 2);
    expect(res.valid).toBe(false);
    expect(res.brokenAt).toBe(2);
    expect(res.reason).toBe("prev_hash_mismatch");
  });

  it("extracts chain metadata from details_json", async () => {
    const rows = await buildChain([{ action: "run.start" }]);
    const meta = extractChainMetadata(rows[0].details_json);
    expect(meta).not.toBeNull();
    expect(meta?.prev_hash).toBe(AUDIT_CHAIN_GENESIS);
    expect(meta?.entry_hash).toMatch(/^[0-9a-f]{64}$/);
  });
});

// ---------- Evidence export + routes -----------------------------------------

async function callRoute(
  method: "GET" | "PUT" | "DELETE",
  path: string,
  env: Record<string, unknown>,
  opts: { auth?: string; body?: unknown } = {},
) {
  const headers: Record<string, string> = {};
  if (opts.auth) headers["authorization"] = `Bearer ${opts.auth}`;
  if (opts.body !== undefined) headers["content-type"] = "application/json";
  const req = new Request(`https://api.local${path}`, {
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  return complianceRoutes.fetch(req, env);
}

describe("GET /soc2/evidence", () => {
  it("rejects without auth", async () => {
    const db = makeDb();
    const env = buildEnv(db);
    const res = await callRoute("GET", "/soc2/evidence", env);
    expect(res.status).toBe(401);
  });

  it("returns a signed evidence pack with expected shape", async () => {
    const rows = await buildChain([{ action: "run.start" }, { action: "run.finish" }]);
    const db = makeDb(rows);
    const env = buildEnv(db);
    const t = await token();
    const res = await callRoute("GET", "/soc2/evidence", env, { auth: t });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.pack_version).toBe("1.0");
    expect(body.product).toBe("PushCI");
    expect(Array.isArray(body.access_reviews)).toBe(true);
    expect(Array.isArray(body.audit_sample)).toBe(true);
    expect(Array.isArray(body.control_tests)).toBe(true);
    expect((body.audit_sample as unknown[]).length).toBe(2);
    expect((body.control_tests as unknown[]).length).toBeGreaterThanOrEqual(5);
    expect(typeof body.signature).toBe("string");
    expect((body.signature as string).length).toBe(64);
    expect(body.signature_algo).toBe("HMAC-SHA-256");
    expect(body.exported_at).toBeDefined();
    expect(Array.isArray(body.trust_services_criteria)).toBe(true);
    expect((body.retention as { audit_log_years: number }).audit_log_years).toBe(7);
  });
});

describe("GET /retention-policy", () => {
  it("returns defaults when KV empty", async () => {
    const db = makeDb();
    const env = buildEnv(db);
    const t = await token();
    const res = await callRoute("GET", "/retention-policy", env, { auth: t });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.audit_log_years).toBe(7);
    expect(body.pipeline_log_days).toBe(90);
    expect(body.data_residency).toBe("global");
  });
});

describe("PUT /retention-policy", () => {
  it("forbids non-admin", async () => {
    const db = makeDb();
    const env = buildEnv(db);
    const t = await token();
    const res = await callRoute("PUT", "/retention-policy", env, {
      auth: t,
      body: { audit_log_years: 10 },
    });
    expect(res.status).toBe(403);
  });
});

describe("GDPR export + erase", () => {
  it("allows self-export", async () => {
    const rows = await buildChain([{ action: "run.start" }]);
    // Own the row
    rows[0].actor_sub = "github:42";
    const db = makeDb(rows);
    const env = buildEnv(db);
    const t = await token();
    const res = await callRoute("GET", "/gdpr/export/github:42", env, { auth: t });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, any>;
    expect(body.user_sub).toBe("github:42");
    expect(body.data).toBeDefined();
    expect(Array.isArray(body.data.audit_logs)).toBe(true);
  });

  it("rejects cross-user export without admin", async () => {
    const db = makeDb();
    const env = buildEnv(db);
    const t = await token();
    const res = await callRoute("GET", "/gdpr/export/github:999", env, { auth: t });
    expect(res.status).toBe(403);
  });

  it("erases actor_login for the target user", async () => {
    const rows = await buildChain([{ action: "run.start" }]);
    rows[0].actor_sub = "github:42";
    rows[0].actor_login = "alice";
    const db = makeDb(rows);
    const env = buildEnv(db);
    const t = await token();
    const res = await callRoute("DELETE", "/gdpr/erase/github:42", env, { auth: t });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.erased).toBe(true);
    expect(body.scrubbed_audit_rows).toBe(1);
  });
});

describe("internal helpers", () => {
  it("clampInt clamps to min/max", () => {
    expect(_internal.clampInt(5, 1, 2, 10)).toBe(5);
    expect(_internal.clampInt(0, 1, 2, 10)).toBe(2);
    expect(_internal.clampInt(99, 1, 2, 10)).toBe(10);
    expect(_internal.clampInt("bad", 3, 2, 10)).toBe(3);
  });

  it("controlTestsForPack covers core TSC families", () => {
    const tests = _internal.controlTestsForPack("2024-01-01T00:00:00Z");
    const ids = tests.map((t) => t.control_id);
    expect(ids).toContain("CC6.1");
    expect(ids).toContain("CC7.2");
    expect(ids).toContain("A1.2");
    expect(ids).toContain("C1.1");
  });

  it("hmacSignHex returns 64-char hex", async () => {
    const sig = await _internal.hmacSignHex("key", "payload");
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
  });
});

// Touch unused imports to keep tsc happy in strict mode.
void ({} as AuditChainRow);
