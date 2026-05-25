/**
 * Investigate Decision API — types.
 *
 * Mirrors `packages/shared-types/src/aml.ts` shape (cannot import directly:
 * products/* may not import @finsavvyai/* except telemetry, per round-2 rule).
 * Subject / Transaction / Score / Decision shapes intentionally structural-
 * compatible with shared-types — see referenced symbols below.
 *
 * @see packages/shared-types/src/aml.ts (canonical contract)
 * @see products/amliq/api/decision.md (design)
 */

/** Money in integer minor units (cents). Never floats. */
export type MoneyMinor = number;

export type Channel = "wire" | "card" | "ach" | "crypto" | "internal";

export type RiskTier = "low" | "medium" | "high";

/** @see packages/shared-types/src/aml.ts Subject */
export interface Subject {
  readonly subject_id: string;
  /** Hashed identifier (engines only ever see this, never plaintext PII). */
  readonly subject_hash: string;
  readonly risk_tier?: RiskTier;
  /** Stable, PII-free tags such as country code, MCC pattern, etc. */
  readonly attributes?: Readonly<Record<string, string | number | boolean>>;
}

/** @see packages/shared-types/src/aml.ts Transaction */
export interface Transaction {
  readonly transaction_id: string;
  readonly amount_minor: MoneyMinor; // integer cents
  readonly currency: string; // ISO-4217
  readonly channel: Channel;
  readonly mcc?: string;
  readonly cross_border?: boolean;
  readonly counterparty_country?: string;
}

/**
 * Optional context the orchestrator forwards to the router/aggregator.
 * Shape kept loose; router only consults documented keys.
 */
export interface DecisionContext {
  readonly tenant_policy_id?: string;
  readonly clear_cutoff?: number; // override default 0.40
  readonly review_cutoff?: number; // override default 0.85
  readonly requires_explainability?: boolean;
  readonly prior_sar?: boolean;
  readonly [key: string]: unknown;
}

export interface DecisionRequest {
  readonly subject: Subject;
  readonly transaction: Transaction;
  readonly tenant_id: string;
  readonly context?: DecisionContext;
}

export type EngineName = "quantumbeam" | "ml-fraud";

export type RecommendedAction = "allow" | "flag" | "block";

export interface EngineResult {
  readonly engine: EngineName;
  /** Risk score in 0..100. Engines below 0 or above 100 are clamped. */
  readonly risk_score: number;
  readonly explanations: readonly string[];
  readonly latency_ms: number;
  /** Stable error code (e.g. "timeout", "http_503"). Absent on success. */
  readonly error?: string;
}

export interface AmlDecision {
  readonly decision_id: string;
  readonly request_id: string;
  readonly tenant_id: string;
  readonly ts: string; // ISO-8601
  readonly max_risk_score: number;
  readonly engine_results: readonly EngineResult[];
  readonly aggregated_explanation: readonly string[];
  readonly recommended_action: RecommendedAction;
  /** 0..1, derived from engine score dispersion. 1.0 = unanimous. */
  readonly confidence: number;
  /** True iff ≥1 engine returned an error and ≥1 succeeded. */
  readonly partial: boolean;
}

/**
 * Pluggable HTTP client for one engine. Implementations MUST be safe to call
 * concurrently and MUST NOT throw on network errors — return an EngineResult
 * with `error` populated instead.
 */
export interface EngineClient {
  readonly engine: EngineName;
  score(request: DecisionRequest, signal: AbortSignal): Promise<EngineResult>;
}

/**
 * Tenant-scoped audit emitter. Mirrors `@finsavvyai/telemetry` audit-tamper
 * shape (`{ actorId, event, resource, decision, reason, meta }`). Returns
 * a promise so production sinks (R2, DD) can be async; failures MUST reject
 * — the decision-service blocks the response on emit failure.
 */
export interface AuditEmitter {
  emit(input: AuditInput): Promise<void>;
}

export interface AuditInput {
  readonly actorId: string;
  readonly tenantId: string;
  readonly event: string;
  readonly resource: string;
  readonly decision: "allow" | "deny" | "error";
  readonly reason: string;
  readonly meta?: Readonly<Record<string, unknown>>;
}

/** JWT signer used by EngineClient to attach an auth header per call. */
export interface JwtSigner {
  sign(payload: Readonly<Record<string, unknown>>): Promise<string>;
}

export interface EngineEndpointConfig {
  readonly engine: EngineName;
  readonly url: string;
  readonly timeoutMs: number; // hard wall clock cap
}
