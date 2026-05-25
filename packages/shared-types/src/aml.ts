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
