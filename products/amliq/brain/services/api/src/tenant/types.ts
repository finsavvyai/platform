/**
 * Multi-tenant canonical types.
 *
 * Mesh §2 contract — every Brain agent imports `TenantContext` from this
 * module. The shape is mirrored structurally (NOT imported) in
 * `oss/finsavvy-rag/src/types/tenant.ts` to keep the OSS package independent
 * of `@amliq/brain`.
 *
 * Tenant identifiers are constrained by a regex applied at every boundary
 * (JWT extraction, schema name composition, audit chain lookup).
 */

/**
 * Validation regex for `tenant_id`. Lowercase alphanum + dash + underscore,
 * 3-64 chars. Bound at both ends by the boundary validators in
 * `middleware.ts` and `audit-prod/state-store.ts`. Never mutate without a
 * corresponding migration of every persisted tenant_id.
 */
export const TENANT_ID_REGEX = /^[a-z0-9_-]{3,64}$/;

/** Canonical tenant context attached to every authenticated request. */
export interface TenantContext {
  readonly tenant_id: string;
  readonly actor_id: string;
  readonly roles: readonly string[];
}

/**
 * Derived authorisation scope. Computed from `roles` via `deriveScope` in
 * `scope.ts`. Booleans only — handlers should call the `requireX` helpers
 * rather than reading these fields directly so that denials flow through the
 * shared error path.
 */
export interface TenantScope {
  readonly read: boolean;
  readonly write: boolean;
  readonly admin: boolean;
}

/**
 * Stable error codes for the tenant subsystem. Codes are wire-stable; the
 * Hono error handler maps each to an HTTP 403 with `{ ok: false, error }`.
 *
 * - `tenant.missing`      — JWT verified but `tnt` claim absent.
 * - `tenant.unknown`      — `tnt` present but fails `TENANT_ID_REGEX`.
 * - `tenant.scope_denied` — scope check (`requireWrite`/`requireAdmin`) denied.
 */
export type TenantErrorCode =
  | "tenant.missing"
  | "tenant.unknown"
  | "tenant.scope_denied";

/** Error thrown by `scope.ts` helpers and recognised by the middleware. */
export class TenantError extends Error {
  readonly code: TenantErrorCode;
  constructor(code: TenantErrorCode, message?: string) {
    super(message ?? code);
    this.name = "TenantError";
    this.code = code;
  }
}

/** Hono context key under which `TenantContext` is stored after middleware. */
export const BRAIN_TENANT_CTX_KEY = "brainTenant" as const;
