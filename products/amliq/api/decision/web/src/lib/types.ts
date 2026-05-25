/**
 * Local mirror of the Investigate decision contract.
 *
 * Mirrored — NOT imported — to honour the round-2 rule: this `web/` package
 * MUST NOT import from `@finsavvyai/*` or sibling product subtrees. Shape
 * is structurally compatible with
 * `products/amliq/api/decision/src/types.ts` (the canonical source). If
 * the upstream contract changes, the Investigate release checklist
 * requires this mirror to be updated in the same release.
 *
 * @see products/amliq/api/decision/src/types.ts
 */

export type MoneyMinor = number;

export type Channel = 'wire' | 'card' | 'ach' | 'crypto' | 'internal';

export type RiskTier = 'low' | 'medium' | 'high';

export type EngineName = 'quantumbeam' | 'ml-fraud';

export type RecommendedAction = 'allow' | 'flag' | 'block';

export interface EngineResult {
  readonly engine: EngineName;
  readonly risk_score: number;
  readonly explanations: readonly string[];
  readonly latency_ms: number;
  readonly error?: string;
}

export interface AmlDecision {
  readonly decision_id: string;
  readonly request_id: string;
  readonly tenant_id: string;
  readonly ts: string;
  readonly max_risk_score: number;
  readonly engine_results: readonly EngineResult[];
  readonly aggregated_explanation: readonly string[];
  readonly recommended_action: RecommendedAction;
  readonly confidence: number;
  readonly partial: boolean;
}

/**
 * Subject summary surfaced to the analyst console. PII-free: only the
 * stable `subject_hash` and any non-PII attributes (country code, MCC
 * pattern). The plaintext subject id is NEVER returned to the UI per the
 * AMLIQ parent CLAUDE.md PII rule.
 */
export interface DecisionListRow {
  readonly decision_id: string;
  readonly tenant_id: string;
  readonly ts: string;
  readonly subject_hash: string;
  readonly amount_minor: MoneyMinor;
  readonly currency: string;
  readonly channel: Channel;
  readonly max_risk_score: number;
  readonly recommended_action: RecommendedAction;
}

/**
 * Tamper-evident audit-log record surfaced to the audit-viewer page.
 * Mirrors `@finsavvyai/telemetry` audit shape (mesh M2 §6). `reason` is a
 * stable code — never plaintext PII (AMLIQ CLAUDE.md hard rule).
 */
export interface AuditRecord {
  readonly ts: string;
  readonly actor_id: string;
  readonly tenant_id: string;
  readonly event: string;
  readonly resource: string;
  readonly decision: 'allow' | 'deny' | 'error';
  readonly reason: string;
  readonly chain_prev_hash: string;
  readonly chain_hash: string;
}

export interface ChainStatus {
  readonly verified: boolean;
  readonly last_verified_ts: string;
  readonly head_hash: string;
  readonly broken_at_index?: number;
}

export interface DecisionListResponse {
  readonly ok: true;
  readonly tenant_id: string;
  readonly rows: readonly DecisionListRow[];
}

export interface DecisionDetailResponse {
  readonly ok: true;
  readonly decision: AmlDecision;
  readonly subject_hash: string;
  readonly amount_minor: MoneyMinor;
  readonly currency: string;
  readonly channel: Channel;
}

export interface AuditListResponse {
  readonly ok: true;
  readonly tenant_id: string;
  readonly records: readonly AuditRecord[];
  readonly chain: ChainStatus;
}

export interface InvestigateError {
  readonly ok: false;
  readonly error: string;
}

export type DecisionListApi = DecisionListResponse | InvestigateError;
export type DecisionDetailApi = DecisionDetailResponse | InvestigateError;
export type AuditListApi = AuditListResponse | InvestigateError;
