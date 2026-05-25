/**
 * Shared types for the AMLIQ Brain API service.
 *
 * All cross-package surfaces are defined as local interfaces (round-2 rule:
 * no direct imports from other @finsavvyai/* packages from products/*).
 * Implementations are injected via the service constructor.
 */

// -------- Health (round-3 mesh contract §1) --------

export type HealthStatus = "ok" | "degraded" | "down";

export interface HealthCheck {
  readonly name: string;
  readonly status: HealthStatus;
}

export interface HealthSnapshot {
  readonly status: HealthStatus;
  readonly version: string;
  readonly uptime_s: number;
  readonly checks: readonly HealthCheck[];
}

export type HealthProbe = () => Promise<HealthCheck> | HealthCheck;

// -------- Auth (interface-only, mirrors @finsavvyai/auth surface) --------

export type AuthErrorCode =
  | "missing_token"
  | "invalid_token"
  | "expired_token"
  | "revoked_token"
  | "insufficient_role";

export interface AuthClaims {
  readonly sub: string;
  readonly iss: string;
  readonly aud: string | readonly string[];
  readonly exp: number;
  readonly iat?: number;
  readonly jti?: string;
  readonly roles?: readonly string[];
  readonly [k: string]: unknown;
}

export type AuthVerifyOk = { readonly ok: true; readonly claims: AuthClaims };
export type AuthVerifyErr = { readonly ok: false; readonly error: AuthErrorCode };
export type AuthVerifyResult = AuthVerifyOk | AuthVerifyErr;

/** DI surface: provided by the host wiring layer. */
export interface AuthVerifier {
  verify(token: string): Promise<AuthVerifyResult>;
}

// -------- Audit (interface-only, mirrors @finsavvyai/telemetry surface) --------

export type AuditDecision = "allow" | "deny" | "error";

export interface AuditInput {
  readonly actorId: string;
  readonly event: string;
  readonly resource: string;
  readonly decision: AuditDecision;
  readonly reason?: string;
  readonly meta?: Readonly<Record<string, unknown>>;
}

export interface AuditRecord {
  readonly ts: string;
  readonly actor_id: string;
  readonly event: string;
  readonly resource: string;
  readonly decision: AuditDecision;
  readonly reason: string;
  readonly meta?: Readonly<Record<string, unknown>>;
  readonly chain?: AuditChainInfo;
}

export interface AuditChainInfo {
  readonly prevHash: string;
  readonly hash: string;
  readonly sig: string;
}

/** Sink for finalised audit records (DI; one record per call). */
export type AuditSink = (record: AuditRecord) => void | Promise<void>;

// -------- Tamper-evident chain (provided by AUDIT-TAMPER package) --------

export interface ChainAppendResult {
  readonly hash: string;
  readonly sig: string;
}

/**
 * AUDIT-TAMPER cross-agent contract.
 * Brain calls chainAppend(prevHash, record) before invoking the sink.
 * AUDIT-TAMPER ships the implementation in packages/telemetry/src/audit-tamper.
 */
export interface AuditChain {
  chainAppend(
    prevHash: string,
    record: Omit<AuditRecord, "chain">,
  ): Promise<ChainAppendResult> | ChainAppendResult;
}

// -------- App config --------

export interface BrainApiConfig {
  readonly version: string;
  readonly startedAtMs: number;
  readonly auth: AuthVerifier;
  readonly audit: {
    readonly sink: AuditSink;
    readonly fallbackSink?: AuditSink;
    readonly chain?: AuditChain;
  };
  readonly probes?: readonly HealthProbe[];
  readonly requiredRole?: string;
  readonly clock?: () => Date;
  /**
   * Optional search configuration. When provided, `POST /v1/search` is
   * mounted under the authenticated subtree. Owned by SEARCH-UI agent.
   */
  readonly search?: {
    readonly adapter: import("./search/types.js").SearchAdapter;
    readonly defaultTopK?: number;
    readonly maxTopK?: number;
  };
}
