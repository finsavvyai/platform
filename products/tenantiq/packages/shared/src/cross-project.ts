// ============================================================
// Cross-project shared types for FinsavvyAI security products
// Used by TenantIQ, OpenSyber, and PipeWarden
// ============================================================

/** Universal alert format — shared across FinsavvyAI security products */
export interface UniversalAlert {
  id: string;
  source: 'tenantiq' | 'opensyber' | 'pipewarden' | 'external';
  sourceId: string;
  category: 'security' | 'compliance' | 'cost' | 'performance';
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  description: string;
  affectedResource: string;
  frameworks: string[];
  remediationSteps: string[];
  autoRemediable: boolean;
  confidence: number;
  detectedAt: number;
  resolvedAt?: number;
  metadata: Record<string, unknown>;
}

/** Compliance control — shared across CIS, SOC2, HIPAA frameworks */
export interface UniversalComplianceControl {
  id: string;
  framework: string;
  controlId: string;
  title: string;
  description: string;
  status: 'pass' | 'fail' | 'not_applicable' | 'manual_review';
  severity: 'critical' | 'high' | 'medium' | 'low';
  evidence: string;
  remediationScript?: string;
  lastChecked: number;
}

/** Shared threat intel entry */
export interface ThreatIntelEntry {
  indicator: string;
  type: 'ip' | 'domain' | 'hash' | 'email' | 'pattern';
  source: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  context: string;
  firstSeen: number;
  lastSeen: number;
  confidence: number;
}

export type UniversalAlertSource = UniversalAlert['source'];
export type UniversalAlertCategory = UniversalAlert['category'];
export type UniversalAlertSeverity = UniversalAlert['severity'];
export type ComplianceControlStatus = UniversalComplianceControl['status'];
export type ThreatIntelType = ThreatIntelEntry['type'];
