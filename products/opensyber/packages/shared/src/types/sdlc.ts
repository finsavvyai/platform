/**
 * SDLC.cc DLP Integration Types
 * Types for receiving DLP violations from sdlc-platform DLP service via webhook.
 */

export type SdlcSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type SdlcDetectorSource = 'presidio' | 'regex' | 'classifier' | 'rule-engine';

export interface SdlcDlpViolation {
  violation_id: string;
  severity: SdlcSeverity;
  entity_type: string; // CREDIT_CARD, SSN, EMAIL, MEDICAL_RECORD, etc.
  rule_name: string | null;
  redacted_excerpt: string; // never raw PII — always redacted
  document_id: string | null;
  document_path: string | null;
  confidence: number; // 0.0–1.0
  source: SdlcDetectorSource;
}

export interface SdlcDlpWebhookPayload {
  violations: SdlcDlpViolation[];
  scan_id: string;
  scanned_at: string;
  document_count: number;
  connection_name: string;
}

export function mapSdlcSeverity(severity: SdlcSeverity): SdlcSeverity {
  return severity;
}
