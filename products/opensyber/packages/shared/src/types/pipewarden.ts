/**
 * PipeWarden Integration Types
 * Types for receiving and processing PipeWarden findings webhooks
 */

export type PipeWardenSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface PipeWardenFinding {
  severity: PipeWardenSeverity;
  category: string;
  title: string;
  description: string;
  remediation: string;
  file?: string;
  line?: number;
  confidence: number; // 0.0 to 1.0
  connection_name: string;
  run_id: string;
}

export interface PipeWardenWebhookPayload {
  findings: PipeWardenFinding[];
  risk_score: number;
  summary: string;
  connection_name: string;
  analyzed_at: string;
}

/** Map PipeWarden severity to OpenSyber severity model */
export function mapPipeWardenSeverity(
  pwSeverity: PipeWardenSeverity,
): 'critical' | 'high' | 'medium' | 'low' | 'info' {
  const severityMap: Record<PipeWardenSeverity, 'critical' | 'high' | 'medium' | 'low' | 'info'> = {
    critical: 'critical',
    high: 'high',
    medium: 'medium',
    low: 'low',
    info: 'info',
  };
  return severityMap[pwSeverity] || 'info';
}
