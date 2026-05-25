/**
 * Edge transport types — adapter layer between Cloudflare Workers (or any
 * Web-Fetch runtime) and the round-1 `AiGateway` orchestrator.
 *
 * Everything here is runtime-agnostic: it accepts a standard `Request`,
 * returns a `Response`. No Hono coupling. Hono apps can mount this via
 * `app.all('*', toHandler(...))`.
 */

export type ActorId = string;

/** Minimal KV interface — satisfied by Cloudflare KV, in-memory, or Redis adapters. */
export interface KvStore {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, opts: { expirationTtl: number }): Promise<void>;
}

export type AuthClaims = {
  /** Subject — required. The actor id used for downstream tenancy/rate-limit keying. */
  readonly sub: ActorId;
  /** Tenant id — required for multi-tenant gateways. */
  readonly tenantId: string;
  /** Role string, opaque to gateway. */
  readonly role: string;
  /** Issued-at unix seconds. */
  readonly iat: number;
  /** Expiry unix seconds. */
  readonly exp: number;
  /** Optional email. */
  readonly email?: string;
};

export type AuthResult =
  | { readonly ok: true; readonly claims: AuthClaims }
  | { readonly ok: false; readonly status: 401 | 403; readonly code: string; readonly reason: string };

export type RateLimitDecision = {
  readonly allowed: boolean;
  readonly remaining: number;
  readonly limit: number;
  readonly resetEpochMs: number;
};

export type EdgeAuditEvent = {
  readonly ts: number;
  readonly actorId: ActorId | "anonymous";
  readonly event: string;
  readonly resource: string;
  readonly decision: "allow" | "deny";
  readonly reason: string;
};

/** Optional emitter for structured audit logs (auth + rate-limit decisions). */
export type AuditSink = (e: EdgeAuditEvent) => void;
