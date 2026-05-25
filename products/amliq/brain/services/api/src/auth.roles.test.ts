/**
 * Role-gate + handler-context tests for the auth middleware.
 * (Token/header parsing tests live in auth.test.ts.)
 */

import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { BRAIN_AUTH_CTX_KEY, getBrainAuth } from "./auth.js";
import { buildApp, claims, verifierByToken } from "./auth.test-helpers.js";

describe("buildAuthMiddleware — role gate + context propagation", () => {
  it("rejects valid token missing required role (403 insufficient_role)", async () => {
    const app = buildApp(
      verifierByToken({
        "t-ok": { ok: true, claims: claims({ roles: ["other:role"] }) },
      }),
      "aml:decision:write",
    );
    const res = await app.request("/x", {
      headers: { Authorization: "Bearer t-ok" },
    });
    expect(res.status).toBe(403);
    expect(await res.json()).toStrictEqual({
      ok: false,
      error: "insufficient_role",
    });
  });

  it("rejects valid token with no roles array (403 insufficient_role)", async () => {
    const app = buildApp(
      verifierByToken({
        "t-ok": { ok: true, claims: { ...claims(), roles: undefined } },
      }),
      "aml:decision:write",
    );
    const res = await app.request("/x", {
      headers: { Authorization: "Bearer t-ok" },
    });
    expect(res.status).toBe(403);
  });

  it("rejects valid token whose roles entries are not strings (403)", async () => {
    const app = buildApp(
      verifierByToken({
        "t-ok": {
          ok: true,
          // Hostile shape: roles contains non-strings (e.g. accidental object).
          claims: { ...claims(), roles: [42 as unknown as string] },
        },
      }),
      "aml:decision:write",
    );
    const res = await app.request("/x", {
      headers: { Authorization: "Bearer t-ok" },
    });
    expect(res.status).toBe(403);
  });

  it("accepts valid token with required role and surfaces claims to handler", async () => {
    const app = buildApp(
      verifierByToken({
        "t-ok": {
          ok: true,
          claims: claims({ sub: "alice", roles: ["aml:decision:write"] }),
        },
      }),
      "aml:decision:write",
    );
    const res = await app.request("/x", {
      headers: { Authorization: "Bearer t-ok" },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toStrictEqual({
      ok: true,
      sub: "alice",
      tokenLen: 4,
    });
  });

  it("accepts valid token when no role gate configured", async () => {
    const app = buildApp(
      verifierByToken({
        "t-ok": { ok: true, claims: claims({ sub: "bob", roles: [] }) },
      }),
    );
    const res = await app.request("/x", {
      headers: { Authorization: "Bearer t-ok" },
    });
    expect(res.status).toBe(200);
  });

  it("getBrainAuth throws stable code when middleware did not run", async () => {
    const app = new Hono();
    app.get("/raw", (c) => {
      try {
        getBrainAuth(c);
        return c.text("nope");
      } catch (e) {
        return c.text((e as Error).message, 500);
      }
    });
    const r = await app.request("/raw");
    expect(r.status).toBe(500);
    expect(await r.text()).toBe("brain.auth.context_missing");
  });

  it("uses BRAIN_AUTH_CTX_KEY as the documented constant", () => {
    expect(BRAIN_AUTH_CTX_KEY).toBe("brainAuth");
  });
});
