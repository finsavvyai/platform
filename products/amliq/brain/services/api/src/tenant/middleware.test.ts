/**
 * Tenant middleware tests — 100% line + branch coverage on the security path
 * (tenant.missing / tenant.unknown).
 */

import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { BRAIN_AUTH_CTX_KEY } from "../auth.js";
import type { BrainAuthContext } from "../auth.js";
import type { AuthClaims } from "../types.js";
import { buildTenantMiddleware, getBrainTenant } from "./middleware.js";

const baseClaims = (overrides: Partial<AuthClaims> = {}): AuthClaims => ({
  sub: "alice",
  iss: "https://issuer.example",
  aud: "amliq-brain",
  exp: Math.floor(Date.now() / 1000) + 3600,
  roles: ["brain:search:read"],
  ...overrides,
});

const seedAuth = (claims: AuthClaims | null) => async (
  c: Parameters<Parameters<Hono["use"]>[1]>[0],
  next: () => Promise<void>,
): Promise<void> => {
  if (claims !== null) {
    const ctx: BrainAuthContext = { token: "tok-x", claims };
    c.set(BRAIN_AUTH_CTX_KEY, ctx);
  }
  await next();
};

const buildApp = (claims: AuthClaims | null): Hono => {
  const app = new Hono();
  app.use("*", seedAuth(claims));
  app.use("*", buildTenantMiddleware());
  app.get("/x", (c) => {
    const t = getBrainTenant(c);
    return c.json({ ok: true, tenant_id: t.tenant_id, roles: t.roles });
  });
  return app;
};

describe("buildTenantMiddleware — success path", () => {
  it("sets TenantContext when tnt + roles are present and valid", async () => {
    const app = buildApp(
      baseClaims({ tnt: "acme_co", roles: ["brain:search:read"] } as AuthClaims),
    );
    const res = await app.request("/x");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { tenant_id: string; roles: string[] };
    expect(body.tenant_id).toBe("acme_co");
    expect(body.roles).toEqual(["brain:search:read"]);
  });

  it("accepts dashes, digits, underscores in tenant_id", async () => {
    const app = buildApp(
      baseClaims({ tnt: "t-3_x", roles: ["brain:case:write"] } as AuthClaims),
    );
    const res = await app.request("/x");
    expect(res.status).toBe(200);
  });
});

describe("buildTenantMiddleware — tenant.missing", () => {
  it("denies 403 tenant.missing when tnt claim is absent", async () => {
    const app = buildApp(baseClaims());
    const res = await app.request("/x");
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ ok: false, error: "tenant.missing" });
  });

  it("denies 403 tenant.missing when tnt is empty string", async () => {
    const app = buildApp(baseClaims({ tnt: "" } as AuthClaims));
    const res = await app.request("/x");
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ ok: false, error: "tenant.missing" });
  });

  it("denies 403 tenant.missing when tnt is null", async () => {
    const app = buildApp(baseClaims({ tnt: null } as unknown as AuthClaims));
    const res = await app.request("/x");
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ ok: false, error: "tenant.missing" });
  });

  it("denies 403 tenant.missing when auth context absent (programmer error)", async () => {
    const app = buildApp(null);
    const res = await app.request("/x");
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ ok: false, error: "tenant.missing" });
  });
});

describe("buildTenantMiddleware — tenant.unknown", () => {
  it("denies 403 tenant.unknown when tnt is non-string", async () => {
    const app = buildApp(baseClaims({ tnt: 42 } as unknown as AuthClaims));
    const res = await app.request("/x");
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ ok: false, error: "tenant.unknown" });
  });

  it("denies 403 tenant.unknown when tnt has uppercase", async () => {
    const app = buildApp(baseClaims({ tnt: "Acme" } as AuthClaims));
    const res = await app.request("/x");
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ ok: false, error: "tenant.unknown" });
  });

  it("denies 403 tenant.unknown when tnt is too short", async () => {
    const app = buildApp(baseClaims({ tnt: "ab" } as AuthClaims));
    const res = await app.request("/x");
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ ok: false, error: "tenant.unknown" });
  });

  it("denies 403 tenant.unknown when tnt is too long (>64)", async () => {
    const app = buildApp(baseClaims({ tnt: "a".repeat(65) } as AuthClaims));
    const res = await app.request("/x");
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ ok: false, error: "tenant.unknown" });
  });

  it("denies 403 tenant.unknown when tnt contains SQL meta", async () => {
    const app = buildApp(
      baseClaims({ tnt: "x'; DROP TABLE--" } as AuthClaims),
    );
    const res = await app.request("/x");
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ ok: false, error: "tenant.unknown" });
  });

  it("denies 403 tenant.unknown when roles is non-array", async () => {
    const app = buildApp(
      baseClaims({ tnt: "acme", roles: "brain:admin" } as unknown as AuthClaims),
    );
    const res = await app.request("/x");
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ ok: false, error: "tenant.unknown" });
  });

  it("denies 403 tenant.unknown when roles contains non-strings", async () => {
    const app = buildApp(
      baseClaims({ tnt: "acme", roles: [1, 2] as unknown as string[] }),
    );
    const res = await app.request("/x");
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ ok: false, error: "tenant.unknown" });
  });
});

describe("getBrainTenant", () => {
  it("throws when middleware did not run", () => {
    // synthesise a minimal context-like object
    const fake = { get: (_k: string) => undefined } as unknown as Parameters<
      typeof getBrainTenant
    >[0];
    expect(() => getBrainTenant(fake)).toThrow("brain.tenant.context_missing");
  });
});
