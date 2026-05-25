/**
 * Healing Engine Type Definitions & Exports
 */

export type FailureType =
  | 'selector_changed'
  | 'timing_issue'
  | 'assertion_drift'
  | 'api_schema_change'
  | 'unknown';

export interface FailureAnalysis {
  type: FailureType;
  originalError: string;
  errorPatterns: string[];
  diagnosis: string;
  severity: 'low' | 'medium' | 'high';
}

export interface HealingSuggestion {
  id: string;
  type: string;
  originalValue: string;
  suggestedValue: string;
  confidence: number;
  rationale: string;
  beforeAfterDiff: string;
}

export interface HealingRecord {
  timestamp: Date;
  fixType: string;
  confidence: number;
  applied: boolean;
  originalValue: string;
  suggestedValue: string;
}

export interface HealingResult {
  testId: string;
  healed: boolean;
  appliedFix?: HealingSuggestion;
  suggestions: HealingSuggestion[];
  analysis: FailureAnalysis;
  confidenceScore: number;
  timestamp: Date;
  healingHistory: HealingRecord[];
}

export { SelectorHealer } from './SelectorHealer.js';
export { TimingHealer } from './TimingHealer.js';
export { AssertionHealer } from './AssertionHealer.js';
export { APIHealer } from './APIHealer.js';
