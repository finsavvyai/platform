/** Compliance and policy enforcement types */

export interface CompliancePolicy {
  id: string;
  name: string;
  framework: string;
  rules: PolicyRule[];
}

export interface PolicyRule {
  condition: string;
  action: string;
  severity: string;
  expectedValue?: string;
  maxDays?: number;
  minDays?: number;
}

export interface AuditLog {
  id: string;
  timestamp: Date;
  action: string;
  policyId: string;
  agentId: string;
  userId?: string;
  result: string;
  details: Record<string, unknown>;
}

export interface ComplianceReport {
  id: string;
  framework: string;
  generatedAt: Date;
  period: { start: Date; end: Date };
  violations: PolicyViolationSummary[];
  complianceScore: number;
  details?: Record<string, unknown>;
}

export interface PolicyViolation {
  id: string;
  policyId: string;
  agentId: string;
  type: string;
  severity: string;
  timestamp: Date;
  details: Record<string, unknown>;
  autoRemediatable?: boolean;
}

export interface PolicyViolationSummary {
  id: string;
  type: string;
  severity: string;
  timestamp: Date;
  agentId?: string;
}
