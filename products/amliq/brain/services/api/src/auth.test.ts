/**
 * Token + header parsing tests for the auth middleware.
 * (Role + context-helper tests live in auth.roles.test.ts.)
 */

import { describe, expect, it } from "vitest";
import { buildApp, claims, fixedVerifier, verifierByToken } from "./auth.test-helpers.js";

describe("buildAuthMiddleware — token/header parsing", () => {
  it("rejects request with no Authorization header (401 missing_token)", async () => {
    const app = buildApp(fixedVerifier({ ok: true, claims: claims() }));
    const res = await app.request("/x");
    expect(res.status).toBe(401);
    expect(await res.json()).toStrictEqual({
      ok: false,
      error: "missing_token",
    });
  });

  it("rejects request with empty Authorization header (401 missing_token)", async () => {
    const app = buildApp(fixedVerifier({ ok: true, claims: claims() }));
    const res = await app.request("/x", { headers: { Authorization: "" } });
    expect(res.status).toBe(401);
    expect(await res.json()).toStrictEqual({
      ok: false,
      error: "missing_token",
    });
  });

  it("rejects request with non-Bearer scheme (401 missing_token)", async () => {
    const app = buildApp(fixedVerifier({ ok: true, claims: claims() }));
    const res = await app.request("/x", {
      headers: { Authorization: "Basic abc" },
    });
    expect(res.status).toBe(401);
    expect(await res.json()).toStrictEqual({
      ok: false,
      error: "missing_token",
    });
  });

  it("rejects request with empty bearer / whitespace-only (401 missing_token)", async () => {
    const app = buildApp(fixedVerifier({ ok: true, claims: claims() }));
    for (const auth of ["Bearer ", "Bearer   ", "Bearer\t"]) {
      const res = await app.request("/x", { headers: { Authorization: auth } });
      expect(res.status).toBe(401);
      expect(await res.json()).toStrictEqual({
        ok: false,
        error: "missing_token",
      });
    }
  });

  it("rejects expired token (401 expired_token)", async () => {
    const app = buildApp(
      verifierByToken({ "t-exp": { ok: false, error: "expired_token" } }),
    );
    const res = await app.request("/x", {
      headers: { Authorization: "Bearer t-exp" },
    });
    expect(res.status).toBe(401);
    expect(await res.json()).toStrictEqual({
      ok: false,
      error: "expired_token",
    });
  });

  it("rejects tampered/invalid token (401 invalid_token)", async () => {
    const app = buildApp(
      verifierByToken({ "t-bad": { ok: false, error: "invalid_token" } }),
    );
    const res = await app.request("/x", {
      headers: { Authorization: "Bearer t-bad" },
    });
    expect(res.status).toBe(401);
    expect(await res.json()).toStrictEqual({
      ok: false,
      error: "invalid_token",
    });
  });

  it("rejects revoked token (401 revoked_token)", async () => {
    const app = buildApp(
      verifierByToken({ "t-rev": { ok: false, error: "revoked_token" } }),
    );
    const res = await app.request("/x", {
      headers: { Authorization: "Bearer t-rev" },
    });
    expect(res.status).toBe(401);
    expect(await res.json()).toStrictEqual({
      ok: false,
      error: "revoked_token",
    });
  });
});
