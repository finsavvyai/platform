/**
 * Tenant extraction middleware.
 *
 * Runs AFTER `buildAuthMiddleware` (auth.ts). Reads the verified
 * `AuthClaims` from `BRAIN_AUTH_CTX_KEY`, extracts the `tnt` and `roles`
 * claims, validates them, and stores a frozen `TenantContext` under
 * `BRAIN_TENANT_CTX_KEY` for downstream handlers.
 *
 * 100% line + branch coverage required (security-critical: tenant.missing
 * is the only line of defence against cross-tenant data leakage at the
 * request boundary).
 *
 * Never throws. On failure: responds with 403 + stable error code, does not
 * invoke `next()`.
 */

import type { Context, MiddlewareHandler, Next } from "hono";
import { BRAIN_AUTH_CTX_KEY } from "../auth.js";
import type { BrainAuthContext } from "../auth.js";
import {
  BRAIN_TENANT_CTX_KEY,
  TENANT_ID_REGEX,
  type TenantContext,
  type TenantErrorCode,
} from "./types.js";

const denyJson = (c: Context, code: TenantErrorCode): Response =>
  c.json({ ok: false, error: code }, 403);

const extractRoles = (raw: unknown): readonly string[] | null => {
  if (!Array.isArray(raw)) return null;
  const out: string[] = [];
  for (const r of raw) {
    if (typeof r !== "string") return null;
    out.push(r);
  }
  return out;
};

const extractTenantId = (claims: Readonly<Record<string, unknown>>): {
  ok: true;
  value: string;
} | { ok: false; code: "tenant.missing" | "tenant.unknown" } => {
  const raw = claims["tnt"];
  if (raw === undefined || raw === null || raw === "") {
    return { ok: false, code: "tenant.missing" };
  }
  if (typeof raw !== "string") {
    return { ok: false, code: "tenant.unknown" };
  }
  if (!TENANT_ID_REGEX.test(raw)) {
    return { ok: false, code: "tenant.unknown" };
  }
  return { ok: true, value: raw };
};

const readBrainAuth = (c: Context): BrainAuthContext | null => {
  const v = c.get(BRAIN_AUTH_CTX_KEY) as BrainAuthContext | undefined;
  return v ?? null;
};

/**
 * Hono middleware factory. No options — auth middleware is the sole input
 * (via context) so wiring stays declarative.
 */
export const buildTenantMiddleware = (): MiddlewareHandler => {
  return async (c: Context, next: Next): Promise<Response | void> => {
    const auth = readBrainAuth(c);
    if (auth === null) {
      // Programmer error: tenant middleware ran without auth in front.
      // Treat as missing rather than throw — never break the audit invariant.
      return denyJson(c, "tenant.missing");
    }

    const claims = auth.claims as Readonly<Record<string, unknown>>;
    const tnt = extractTenantId(claims);
    if (!tnt.ok) return denyJson(c, tnt.code);

    const roles = extractRoles(claims["roles"]);
    if (roles === null) return denyJson(c, "tenant.unknown");

    const ctx: TenantContext = Object.freeze({
      tenant_id: tnt.value,
      actor_id: auth.claims.sub,
      roles: Object.freeze([...roles]),
    });
    c.set(BRAIN_TENANT_CTX_KEY, ctx);
    await next();
    return;
  };
};

/** Read the verified TenantContext. Throws if middleware did not run. */
export const getBrainTenant = (c: Context): TenantContext => {
  const v = c.get(BRAIN_TENANT_CTX_KEY) as TenantContext | undefined;
  if (!v) throw new Error("brain.tenant.context_missing");
  return v;
};
