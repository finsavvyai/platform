/**
 * JWT auth middleware for the AMLIQ Brain API.
 *
 * - Pulls bearer token from Authorization header (constant-string compare).
 * - Delegates verification to the injected AuthVerifier (DI; no direct import
 *   of @finsavvyai/auth per round-2 rule).
 * - Optional role gate (default: AMLIQ requires `aml:decision:write` for
 *   decision endpoints; brain endpoints will set their own per-route role).
 * - Returns a Hono middleware. Never throws; always sets a JSON response on
 *   failure with a stable error code.
 *
 * 100% line + branch coverage required (portfolio CLAUDE.md: auth middleware).
 */

import type { Context, MiddlewareHandler, Next } from "hono";
import type { AuthClaims, AuthErrorCode, AuthVerifier } from "./types.js";

export const BRAIN_AUTH_CTX_KEY = "brainAuth" as const;

export interface BrainAuthContext {
  readonly token: string;
  readonly claims: AuthClaims;
}

export interface AuthMiddlewareOptions {
  readonly verifier: AuthVerifier;
  readonly requiredRole?: string;
}

const BEARER_PREFIX = "Bearer ";

const extractBearer = (header: string | undefined): string | null => {
  // Hono normalises headers to strings; treat any falsy value as missing.
  if (!header) return null;
  if (!header.startsWith(BEARER_PREFIX)) return null;
  const token = header.slice(BEARER_PREFIX.length).trim();
  if (token.length === 0) return null;
  return token;
};

const httpStatusFor = (code: AuthErrorCode): 401 | 403 => {
  if (code === "insufficient_role") return 403;
  return 401;
};

const denyJson = (
  c: Context,
  code: AuthErrorCode,
): Response =>
  c.json(
    { ok: false, error: code },
    httpStatusFor(code),
  );

const hasRequiredRole = (
  claims: AuthClaims,
  required: string | undefined,
): boolean => {
  if (!required) return true;
  const roles = claims.roles;
  if (!Array.isArray(roles)) return false;
  for (const r of roles) {
    if (typeof r === "string" && r === required) return true;
  }
  return false;
};

/**
 * Build a Hono middleware that verifies the bearer token and (optionally)
 * enforces a role. Sets `c.set("brainAuth", { token, claims })` on success.
 */
export const buildAuthMiddleware = (
  opts: AuthMiddlewareOptions,
): MiddlewareHandler => {
  return async (c: Context, next: Next): Promise<Response | void> => {
    const header = c.req.header("authorization") ?? c.req.header("Authorization");
    const token = extractBearer(header);
    if (token === null) return denyJson(c, "missing_token");

    const result = await opts.verifier.verify(token);
    if (!result.ok) return denyJson(c, result.error);

    if (!hasRequiredRole(result.claims, opts.requiredRole)) {
      return denyJson(c, "insufficient_role");
    }

    const ctx: BrainAuthContext = { token, claims: result.claims };
    c.set(BRAIN_AUTH_CTX_KEY, ctx);
    await next();
    return;
  };
};

/** Helper for downstream handlers to read the verified context. */
export const getBrainAuth = (c: Context): BrainAuthContext => {
  const v = c.get(BRAIN_AUTH_CTX_KEY) as BrainAuthContext | undefined;
  if (!v) {
    // Programmer error: handler ran without the middleware in front.
    throw new Error("brain.auth.context_missing");
  }
  return v;
};
