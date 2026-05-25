/**
 * Compliance report type definitions for SOC2, HIPAA, GDPR, and PCI-DSS mapping.
 */

export type ComplianceFramework = 'SOC2' | 'HIPAA' | 'GDPR' | 'PCI-DSS';

export type FindingCategory =
  | 'secrets'
  | 'branch-security'
  | 'missing-tests'
  | 'permissions'
  | 'supply-chain';

export type Severity = 'critical' | 'high' | 'medium' | 'low';

export type ComplianceStatus = 'pass' | 'fail' | 'partial';

/** Finding from a PipeWarden scan. */
export interface PipeWardenFinding {
  id: string;
  category: FindingCategory;
  severity: Severity;
  description: string;
  /** Link to underlying scan result. */
  evidence?: string;
  resolved?: boolean;
}

/** Compliance mapping of a finding to a framework control. */
export interface ComplianceMapping {
  framework: ComplianceFramework;
  /** e.g., "CC6.1" for SOC2. */
  control: string;
  controlDescription: string;
  status: ComplianceStatus;
  finding: PipeWardenFinding;
  evidence: string;
  remediation?: string;
}

/** Aggregated compliance report for one framework. */
export interface ComplianceReport {
  framework: ComplianceFramework;
  generatedAt: Date;
  summary: {
    total: number;
    passed: number;
    failed: number;
    partial: number;
  };
  mappings: ComplianceMapping[];
}

/** Definition of a framework control. */
export interface ControlDefinition {
  description: string;
  categories: FindingCategory[];
}
