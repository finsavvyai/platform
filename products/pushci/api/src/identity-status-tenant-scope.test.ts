// H-003 regression: /api/enterprise/identity-status must scope SAML/SCIM
// lookups to the caller's org memberships. The old kv.list(prefix) leaked
// the first tenant's SSO config name to every authenticated user.

import { describe, it, expect } from "vitest";
import { enterpriseRoutes } from "./enterprise-dora";
import { createJwt } from "./auth";

const JWT_SECRET = "test-identity-scope-secret";
const NOW = Math.floor(Date.now() / 1000);

async function token(sub: string): Promise<string> {
  return createJwt(
    { sub, login: sub, provider: "github", iat: NOW, exp: NOW + 3600 },
    JWT_SECRET,
  );
}

interface OrgRow { id: string; slug: string; }
interface OrgMember { org_id: string; user_sub: string; }
interface Fixture {
  orgs: OrgRow[];
  memberships: OrgMember[];
  kv: Record<string, string>;
}

function makeDb(fx: Fixture): D1Database {
  const api = {
    prepare(sql: string) {
      const binds: unknown[] = [];
      const runner = {
        bind(...args: unknown[]) { binds.push(...args); return runner; },
        async first() { return null; },
        async run() { return { success: true, meta: { changes: 0 } }; },
        async all<T = unknown>() {
          if (/FROM\s+organizations/i.test(sql) && /JOIN\s+org_members/i.test(sql)) {
            const sub = binds[0] as string;
            const orgIds = new Set(
              fx.memberships.filter((m) => m.user_sub === sub).map((m) => m.org_id),
            );
            const results = fx.orgs
              .filter((o) => orgIds.has(o.id))
              .map((o) => ({ slug: o.slug })) as unknown as T[];
            return { results, success: true, meta: {} };
          }
          return { results: [] as T[], success: true, meta: {} };
        },
      };
      return runner;
    },
  };
  return api as unknown as D1Database;
}

function makeKv(store: Record<string, string>): KVNamespace {
  const api = {
    async get(key: string): Promise<string | null> {
      return key in store ? store[key] : null;
    },
    async put(key: string, value: string) { store[key] = value; },
    // H-003 guard: regression to kv.list() must fail loudly.
    async list(): Promise<never> {
      throw new Error("identity-status must NOT scan KV by prefix");
    },
    async delete() { /* unused */ },
  };
  return api as unknown as KVNamespace;
}

function env(fx: Fixture): Record<string, unknown> {
  return { DB: makeDb(fx), RUNNERS: makeKv(fx.kv), JWT_SECRET };
}

async function call(fxEnv: Record<string, unknown>, auth?: string): Promise<Response> {
  const headers: Record<string, string> = {};
  if (auth) headers["authorization"] = `Bearer ${auth}`;
  const req = new Request("https://api.local/identity-status", { method: "GET", headers });
  return enterpriseRoutes.fetch(req, fxEnv);
}

const ACME_SAML = JSON.stringify({
  entityId: "https://okta.com/acme",
  ssoUrl: "https://acme.okta.com/sso",
  cert: "PEM",
  updatedAt: "2026-04-01T00:00:00.000Z",
});
const GLOBEX_SAML = JSON.stringify({
  entityId: "https://login.microsoftonline.com/globex",
  ssoUrl: "https://globex.onmicrosoft.com/sso",
  cert: "PEM",
  updatedAt: "2026-04-02T00:00:00.000Z",
});

type IdBody = {
  sso: { configured: boolean; tenant: string | null; provider: string | null };
  scim: { configured: boolean; tenant: string | null };
};

describe("GET /identity-status tenant scoping (H-003)", () => {
  it("rejects unauthenticated requests", async () => {
    const res = await call(env({ orgs: [], memberships: [], kv: {} }));
    expect(res.status).toBe(401);
  });

  it("caller's org has SAML → configured=true with tenant+provider", async () => {
    const fx: Fixture = {
      orgs: [{ id: "o-acme", slug: "acme" }],
      memberships: [{ org_id: "o-acme", user_sub: "github:alice" }],
      kv: { "saml:tenant:acme": ACME_SAML },
    };
    const res = await call(env(fx), await token("github:alice"));
    expect(res.status).toBe(200);
    const body = await res.json() as IdBody;
    expect(body.sso.configured).toBe(true);
    expect(body.sso.tenant).toBe("acme");
    expect(body.sso.provider).toBe("Okta (SAML 2.0)");
  });

  it("caller's org has NO SAML, foreign org has one → reports not configured", async () => {
    // Alice is only in globex (no SAML). Acme has SAML — must NOT leak.
    const fx: Fixture = {
      orgs: [
        { id: "o-acme", slug: "acme" },
        { id: "o-globex", slug: "globex" },
      ],
      memberships: [{ org_id: "o-globex", user_sub: "github:alice" }],
      kv: { "saml:tenant:acme": ACME_SAML },
    };
    const res = await call(env(fx), await token("github:alice"));
    const body = await res.json() as IdBody;
    expect(body.sso.configured).toBe(false);
    expect(body.sso.tenant).toBeNull();
  });

  it("user with no org memberships sees nothing even if other orgs have SAML+SCIM", async () => {
    const fx: Fixture = {
      orgs: [{ id: "o-acme", slug: "acme" }],
      memberships: [],
      kv: { "saml:tenant:acme": ACME_SAML, "scim:token:acme": "secret-token" },
    };
    const res = await call(env(fx), await token("github:nomad"));
    const body = await res.json() as IdBody;
    expect(body.sso.configured).toBe(false);
    expect(body.scim.configured).toBe(false);
    expect(body.sso.tenant).toBeNull();
    expect(body.scim.tenant).toBeNull();
  });

  it("two orgs both with SAML — each user sees only their own tenant", async () => {
    const fx: Fixture = {
      orgs: [
        { id: "o-acme", slug: "acme" },
        { id: "o-globex", slug: "globex" },
      ],
      memberships: [
        { org_id: "o-acme", user_sub: "github:alice" },
        { org_id: "o-globex", user_sub: "github:bob" },
      ],
      kv: { "saml:tenant:acme": ACME_SAML, "saml:tenant:globex": GLOBEX_SAML },
    };
    const e = env(fx);
    const alice = await (await call(e, await token("github:alice"))).json() as IdBody;
    const bob = await (await call(e, await token("github:bob"))).json() as IdBody;
    expect(alice.sso.tenant).toBe("acme");
    expect(alice.sso.provider).toBe("Okta (SAML 2.0)");
    expect(bob.sso.tenant).toBe("globex");
    expect(bob.sso.provider).toBe("Azure AD (SAML 2.0)");
    expect(alice.sso.tenant).not.toBe(bob.sso.tenant);
  });

  it("SCIM scoping — foreign SCIM token never leaks", async () => {
    const fx: Fixture = {
      orgs: [
        { id: "o-acme", slug: "acme" },
        { id: "o-globex", slug: "globex" },
      ],
      memberships: [{ org_id: "o-globex", user_sub: "github:bob" }],
      kv: { "scim:token:acme": "acme-secret-token" },
    };
    const res = await call(env(fx), await token("github:bob"));
    const body = await res.json() as IdBody;
    expect(body.scim.configured).toBe(false);
    expect(body.scim.tenant).toBeNull();
  });

  it("SCIM configured for caller's own org is reported correctly", async () => {
    const fx: Fixture = {
      orgs: [{ id: "o-globex", slug: "globex" }],
      memberships: [{ org_id: "o-globex", user_sub: "github:bob" }],
      kv: { "scim:token:globex": "globex-secret-token" },
    };
    const res = await call(env(fx), await token("github:bob"));
    const body = await res.json() as IdBody;
    expect(body.scim.configured).toBe(true);
    expect(body.scim.tenant).toBe("globex");
  });
});
