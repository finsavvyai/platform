/**
 * Test-only helpers for auth middleware specs.
 * Kept out of build outputs (test files only import this).
 */

import { Hono } from "hono";
import { buildAuthMiddleware, getBrainAuth } from "./auth.js";
import type { AuthClaims, AuthVerifier, AuthVerifyResult } from "./types.js";

export const claims = (overrides: Partial<AuthClaims> = {}): AuthClaims => ({
  sub: "user-1",
  iss: "https://issuer.example",
  aud: "amliq-brain",
  exp: Math.floor(Date.now() / 1000) + 3600,
  iat: Math.floor(Date.now() / 1000),
  roles: ["aml:decision:write"],
  ...overrides,
});

export const fixedVerifier = (result: AuthVerifyResult): AuthVerifier => ({
  verify: async () => result,
});

export const verifierByToken = (
  map: Record<string, AuthVerifyResult>,
): AuthVerifier => ({
  verify: async (token: string) =>
    map[token] ?? { ok: false, error: "invalid_token" },
});

export const buildApp = (
  verifier: AuthVerifier,
  requiredRole?: string,
): Hono => {
  const app = new Hono();
  const mw = buildAuthMiddleware(
    requiredRole !== undefined ? { verifier, requiredRole } : { verifier },
  );
  app.use("*", mw);
  app.get("/x", (c) => {
    const { claims: cl, token } = getBrainAuth(c);
    return c.json({ ok: true, sub: cl.sub, tokenLen: token.length });
  });
  return app;
};
