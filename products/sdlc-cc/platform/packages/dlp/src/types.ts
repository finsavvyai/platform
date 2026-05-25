/**
 * Core types for the DLP (Data Loss Prevention) engine.
 *
 * Defines PII entity types, match results, masking strategies,
 * scan results, and policy actions used across the detection,
 * masking, and policy evaluation modules.
 */

/** PII entity types handled by the fast detector. */
export enum PIIType {
  EMAIL = 'EMAIL',
  PHONE = 'PHONE',
  SSN = 'SSN',
  CREDIT_CARD = 'CREDIT_CARD',
  IP_ADDRESS = 'IP_ADDRESS',
  DOB = 'DOB',
}

/** Result of a single PII match within scanned text. */
export interface PIIMatch {
  /** The type of PII detected. */
  piiType: PIIType;
  /** Start index in the source text. */
  start: number;
  /** End index in the source text (exclusive). */
  end: number;
  /** The matched text content. */
  matchedText: string;
  /** Confidence score between 0 and 1. */
  confidence: number;
  /** Label used when redacting, e.g. [REDACTED_EMAIL]. */
  redactedLabel: string;
}

/** Strategy for masking detected PII. */
export enum MaskingStrategy {
  /** Replace with [REDACTED_TYPE] label. */
  REDACT = 'REDACT',
  /** Replace with a partial SHA-256 hash. */
  HASH = 'HASH',
  /** Replace with a reversible token. */
  TOKENIZE = 'TOKENIZE',
}

/** Configuration for the DLP engine. */
export interface DLPConfig {
  /** Whether the detector is enabled. Defaults to true. */
  enabled: boolean;
  /** Default masking strategy. Defaults to REDACT. */
  defaultStrategy: MaskingStrategy;
  /** Per-type strategy overrides. */
  strategyOverrides: Partial<Record<PIIType, MaskingStrategy>>;
  /** Minimum confidence threshold to include a match. */
  confidenceThreshold: number;
}

/** Result of scanning a text for PII. */
export interface ScanResult {
  /** The original input text. */
  originalText: string;
  /** All PII matches found. */
  matches: PIIMatch[];
  /** Total number of matches. */
  matchCount: number;
  /** Distinct PII types detected. */
  detectedTypes: PIIType[];
  /** Time taken in microseconds. */
  scanTimeUs: number;
}

/** Policy action to take based on scan results. */
export enum PolicyAction {
  /** Allow the content through unchanged. */
  ALLOW = 'ALLOW',
  /** Block the content entirely. */
  BLOCK = 'BLOCK',
  /** Mask detected PII and allow. */
  MASK = 'MASK',
  /** Hold for manual review. */
  QUARANTINE = 'QUARANTINE',
}

/** A single policy rule definition. */
export interface PolicyRule {
  /** Unique identifier for the rule. */
  id: string;
  /** Human-readable description. */
  description: string;
  /** Action to take when rule triggers. */
  action: PolicyAction;
  /** Rule triggers if any of these PII types are found. */
  triggerTypes?: PIIType[];
  /** Rule triggers if match count exceeds this threshold. */
  minMatchCount?: number;
  /** Rule triggers if confidence exceeds this threshold. */
  minConfidence?: number;
  /** Priority (lower number = higher priority). */
  priority: number;
}

/** Result of policy evaluation. */
export interface PolicyEvalResult {
  /** The determined action. */
  action: PolicyAction;
  /** The rule that triggered, if any. */
  triggeredRule: PolicyRule | null;
  /** All rules that matched, ordered by priority. */
  matchedRules: PolicyRule[];
  /** The scan result that was evaluated. */
  scanResult: ScanResult;
}

/** Default DLP configuration. */
export const DEFAULT_DLP_CONFIG: DLPConfig = {
  enabled: true,
  defaultStrategy: MaskingStrategy.REDACT,
  strategyOverrides: {},
  confidenceThreshold: 0.5,
};
