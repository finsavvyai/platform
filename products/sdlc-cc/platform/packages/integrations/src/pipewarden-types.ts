/**
 * PipeWarden integration type definitions
 */

/** DLP finding from SDLC engine */
export interface DLPFinding {
  pattern: string;
  match: string;
  file: string;
  line: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  confidence: number;
}

/** OPA policy from SDLC engine */
export interface OPAPolicy {
  id: string;
  name: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  enforced: boolean;
  rules: OPARule[];
}

/** OPA policy rule */
export interface OPARule {
  id: string;
  description: string;
  action: 'allow' | 'deny' | 'audit';
  conditions: Record<string, unknown>;
}

/** Compliance report from PipeWarden */
export interface ComplianceReport {
  connectionName: string;
  timestamp: Date;
  dlpFindings: DLPFinding[];
  policyViolations: PolicyViolation[];
  riskScore: number;
  summary: string;
}

/** Policy violation */
export interface PolicyViolation {
  policyId: string;
  policyName: string;
  severity: string;
  description: string;
  remediation: string;
}
