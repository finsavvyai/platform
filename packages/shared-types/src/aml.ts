/**
 * AML scoring contracts shared between the AMLIQ decision API, its engines,
 * and any external consumer (analyst console, downstream products).
 */

import type {
  AuditId,
  CaseId,
  EngineVersion,
  SubjectId,
} from "./ids.js";

/** Score in the closed interval [0, 1]. Higher = more suspicious. */
export type Score = number;

export type Decision = "clear" | "review" | "block";

export type EngineName = "quantumbeam" | "ml_fraud";

export interface EngineScore {
  readonly engine: EngineName;
  readonly score: Score;
  readonly version: EngineVersion;
  /** Optional stable reason code, e.g. "sanctions_match". No PII. */
  readonly reason?: string;
}

export interface ScoreRequest {
  readonly subjectId: SubjectId;
  /** Hashed subject identifier — never plaintext PII. */
  readonly subjectHash: string;
  readonly caseId?: CaseId;
  /**
   * Free-form structured payload the engines consume. Validation happens at
   * the decision-API boundary; engines see only sanitised values.
   */
  readonly payload: Readonly<Record<string, unknown>>;
}

export interface ScoreResponse {
  readonly auditId: AuditId;
  readonly decision: Decision;
  /** Blended score across engines, in [0, 1]. */
  readonly blendedScore: Score;
  readonly engineScores: readonly EngineScore[];
  /** Stable decision reason code. No PII. */
  readonly reason: string;
}

export const isDecision = (value: unknown): value is Decision =>
  value === "clear" || value === "review" || value === "block";

export const isScore = (value: unknown): value is Score =>
  typeof value === "number" && value >= 0 && value <= 1 && Number.isFinite(value);

// ---------------------------------------------------------------------------
// AMLIQ Unified Decision API contracts
// ---------------------------------------------------------------------------
// Authority: `products/amliq/api/decision.md` (round-4 design). These types
// extend — never replace — the engine-facing `ScoreRequest` / `ScoreResponse`
// above. New AMLIQ callers consume `AmlDecision`; the legacy engine contract
// remains for backwards compatibility.

/** Suspicion risk band assigned to a subject. */
export type RiskBand = "low" | "medium" | "high";

/**
 * Identity subject of an AML decision. Identity is represented ONLY by
 * `subjectHash` — raw names, account numbers, and other plaintext PII are
 * forbidden at this boundary (hashed server-side before reaching here).
 */
export interface Subject {
  readonly subjectHash: string;
  /** ISO 3166-1 alpha-2 country code (e.g. "US", "GB"). */
  readonly country: string;
  readonly riskBand?: RiskBand;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/** Event triggering the AML decision. Amounts are integer minor units. */
export interface Transaction {
  readonly id: string;
  /** Integer minor units (e.g. cents). */
  readonly amount: number;
  /** ISO 4217 currency code (e.g. "USD", "EUR"). */
  readonly currency: string;
  /** ISO 8601 timestamp. */
  readonly timestamp: string;
  readonly channel: string;
  readonly counterpartyHash?: string;
}

/** Request envelope for the AMLIQ unified decision API. */
export interface DecisionRequest {
  readonly subject: Subject;
  readonly transaction: Transaction;
  readonly tenantId: string;
  /** ISO 8601 timestamp the caller stamped on the request. */
  readonly requestedAt: string;
}

/**
 * One evidence entry contributed by a single rule/engine pass. Reasons are
 * stable codes only — no PII, no free-form names.
 */
export interface EvidenceItem {
  readonly engine: string;
  readonly ruleId: string;
  readonly score: number;
  readonly weight: number;
  readonly reason: string;
}

/**
 * Final AMLIQ decision returned by `/v1/aml/decision`. `decision` is the
 * discriminator and is one of `clear` | `review` | `block`. Cutoffs are
 * carried inline so the analyst console and audit consumers can re-derive
 * the band without re-fetching tenant policy.
 */
export interface AmlDecision {
  readonly decision: Decision;
  readonly score: number;
  readonly threshold: {
    readonly clear: number;
    readonly review: number;
  };
  readonly evidence: readonly EvidenceItem[];
  readonly decisionId: string;
  readonly auditId: string;
  /** ISO 8601 timestamp the decision was finalised. */
  readonly decidedAt: string;
}
