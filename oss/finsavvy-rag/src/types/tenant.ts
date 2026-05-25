/**
 * TenantContext — cross-agent contract for tenant-scoped RAG operations.
 *
 * The finsavvy-rag indexer and querier honor this context to route writes
 * and reads to the correct per-tenant pgvector schema (`brain_t_<tenant_id>`)
 * and per-tenant audit chain.
 *
 * Structurally compatible with `@amliq/brain` `TenantContext`
 * (`products/amliq/brain/services/api/src/tenant/types.ts`). DO NOT import
 * from `@amliq/brain` — this OSS package stays independent of any FinsavvyAI
 * proprietary product (independence rule). The shape duplication is
 * intentional and asserted by integration tests in the consuming agent.
 *
 * License: Apache-2.0
 */

/**
 * Validation regex for `tenant_id`. MUST match the regex used by
 * `@amliq/brain` at the request boundary; mirrored here so any caller of
 * finsavvy-rag that constructs a TenantContext locally can validate before
 * handing off.
 */
export const TENANT_ID_REGEX = /^[a-z0-9_-]{3,64}$/;

/**
 * Canonical tenant context. Every RAG operation that touches per-tenant
 * data (index, query, delete, audit) MUST accept this as a required input.
 *
 * Fields:
 * - `tenant_id`: opaque identifier; must satisfy `TENANT_ID_REGEX`.
 * - `actor_id`: principal identifier (e.g. JWT `sub`) for audit attribution.
 * - `roles`:    string[] of role identifiers; finsavvy-rag does NOT
 *               interpret roles, only forwards them to the injected
 *               AuditPort for record attribution.
 */
export interface TenantContext {
  readonly tenant_id: string;
  readonly actor_id: string;
  readonly roles: readonly string[];
}

/**
 * Structural-only runtime validator. Mirrors the shape and the regex —
 * NOT a security boundary on its own (the JWT validator in the brain API
 * is). Use at trust-boundary I/O (queue payloads, internal RPCs).
 */
export function isTenantContext(value: unknown): value is TenantContext {
  if (value === null || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (typeof v["tenant_id"] !== "string") return false;
  if (typeof v["actor_id"] !== "string") return false;
  if (!TENANT_ID_REGEX.test(v["tenant_id"] as string)) return false;
  if (!Array.isArray(v["roles"])) return false;
  for (const r of v["roles"] as unknown[]) {
    if (typeof r !== "string") return false;
  }
  return true;
}
