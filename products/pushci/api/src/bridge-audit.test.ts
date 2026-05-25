// Integration test: verify every bridge /connect writes an audit_log row
// and /connections/:id DELETE writes another. I-003 fix.
// License: Apache-2.0

import { describe, it, expect, beforeEach } from "vitest";
import { gitlabRoutes } from "./gitlab-routes";
import { createJwt } from "./auth";
import type { Env, JwtPayload } from "./types";

const JWT_SECRET = "test_jwt_secret_long_enough_xyz";

interface AuditRow {
  actor_sub: string | null;
  action: string;
  resource_type: string;
  resource_id: string;
  details_json: string;
}

function makeKv(): KVNamespace {
  const store = new Map<string, string>();
  return {
    get: async (k: string) => store.get(k) ?? null,
    put: async (k: string, v: string) => {
      store.set(k, v);
    },
    delete: async (k: string) => {
      store.delete(k);
    },
    list: async ({ prefix }: { prefix: string }) => ({
      keys: [...store.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })),
    }),
  } as unknown as KVNamespace;
}

function makeDb(): { db: D1Database; rows: AuditRow[] } {
  const rows: AuditRow[] = [];
  const prepare = (_sql: string) => ({
    binds: [] as unknown[],
    bind(...args: unknown[]) {
      this.binds = args;
      return this;
    },
    async run() {
      const [actor_sub, _login, action, resource_type, resource_id, details_json] =
        this.binds as [string | null, string | null, string, string, string, string];
      rows.push({ actor_sub, action, resource_type, resource_id, details_json });
      return { success: true };
    },
  });
  const db = { prepare } as unknown as D1Database;
  return { db, rows };
}

async function authHeader(sub = "github:42"): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: JwtPayload = {
    sub,
    login: "tester",
    provider: "github",
    iat: now,
    exp: now + 3600,
  };
  return `Bearer ${await createJwt(payload, JWT_SECRET)}`;
}

interface Harness {
  env: Env;
  auditRows: AuditRow[];
  auth: string;
}

async function harness(): Promise<Harness> {
  const { db, rows } = makeDb();
  const env = {
    RUNNERS: makeKv(),
    DB: db,
    JWT_SECRET,
  } as unknown as Env;
  return { env, auditRows: rows, auth: await authHeader() };
}

describe("GitLab /connect → audit_log (I-003)", () => {
  let h: Harness;

  beforeEach(async () => {
    h = await harness();
  });

  async function connect(): Promise<{ connection: { id: string; label: string } }> {
    const res = await gitlabRoutes.fetch(
      new Request("https://api.local/connect", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: h.auth,
          "cf-connecting-ip": "203.0.113.50",
        },
        body: JSON.stringify({ privateToken: "glpat-test", label: "corp-gitlab" }),
      }),
      h.env
    );
    expect(res.status).toBe(201);
    return (await res.json()) as { connection: { id: string; label: string } };
  }

  it("writes an integration_connect row with sub + provider + label + ip", async () => {
    await connect();
    const connRows = h.auditRows.filter((r) => r.action === "integration_connect");
    expect(connRows).toHaveLength(1);
    const row = connRows[0];
    expect(row.actor_sub).toBe("github:42");
    expect(row.resource_type).toBe("integration");
    expect(row.resource_id).toBe("gitlab:corp-gitlab");
    const details = JSON.parse(row.details_json);
    expect(details.ip).toBe("203.0.113.50");
    expect(details.meta.baseUrl).toBe("https://gitlab.com");
    // secret must never appear in the audit log
    expect(row.details_json).not.toContain("glpat-test");
  });

  it("writes an integration_disconnect row on DELETE /connections/:id", async () => {
    const { connection } = await connect();
    const res = await gitlabRoutes.fetch(
      new Request(`https://api.local/connections/${connection.id}`, {
        method: "DELETE",
        headers: { authorization: h.auth, "cf-connecting-ip": "203.0.113.50" },
      }),
      h.env
    );
    expect(res.status).toBe(200);
    const disconnectRows = h.auditRows.filter(
      (r) => r.action === "integration_disconnect"
    );
    expect(disconnectRows).toHaveLength(1);
    expect(disconnectRows[0].resource_id).toBe("gitlab:corp-gitlab");
  });

  it("does NOT write an audit row when /connect fails validation", async () => {
    const res = await gitlabRoutes.fetch(
      new Request("https://api.local/connect", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: h.auth },
        body: JSON.stringify({ baseUrl: "http://10.0.0.5", privateToken: "x" }),
      }),
      h.env
    );
    expect(res.status).toBe(400);
    expect(h.auditRows).toHaveLength(0);
  });
});
