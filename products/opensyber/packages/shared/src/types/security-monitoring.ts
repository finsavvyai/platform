import type { Severity } from './security-events.js';

// ---- Vulnerability Management ----

export type VulnSeverity = 'critical' | 'high' | 'medium' | 'low';
export type VulnStatus = 'open' | 'in_progress' | 'fixed' | 'ignored' | 'false_positive';

export interface VulnerabilityScan {
  id: string;
  instanceId: string;
  scanner: string;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  scannedAt: string;
}

export interface Vulnerability {
  id: string;
  instanceId: string;
  scanId: string;
  cveId: string | null;
  packageName: string;
  packageVersion: string | null;
  fixedVersion: string | null;
  severity: VulnSeverity;
  title: string | null;
  description: string | null;
  status: VulnStatus;
  createdAt: string;
}

// ---- Compliance ----

export type ComplianceFramework = 'soc2' | 'iso27001' | 'cis' | 'hipaa' | 'gdpr' | 'nist_csf' | 'pci_dss';

export interface ComplianceReport {
  id: string;
  instanceId: string;
  framework: ComplianceFramework;
  overallScore: number;
  totalControls: number;
  passingControls: number;
  failingControls: number;
  results: string;
  generatedAt: string;
}

export interface ComplianceControl {
  id: string;
  name: string;
  category: string;
  description: string;
  framework: ComplianceFramework;
}

export interface ComplianceControlResult {
  controlId: string;
  name: string;
  category: string;
  status: 'pass' | 'fail' | 'not_applicable';
  evidence: string;
}

// ---- File Integrity Monitoring ----

export type FileChangeType = 'modified' | 'created' | 'deleted' | 'permissions_changed';

export interface FileBaseline {
  id: string;
  instanceId: string;
  filePath: string;
  sha256: string;
  permissions: string | null;
  size: number | null;
  lastVerified: string;
  createdAt: string;
}

export interface FileIntegrityEvent {
  id: string;
  instanceId: string;
  filePath: string;
  changeType: FileChangeType;
  previousHash: string | null;
  currentHash: string | null;
  details: string | null;
  createdAt: string;
}

// ---- Network Activity ----

export interface NetworkActivityEntry {
  id: string;
  instanceId: string;
  domain: string;
  method: string;
  path: string | null;
  statusCode: number | null;
  action: 'allowed' | 'blocked';
  bytesTransferred: number | null;
  createdAt: string;
}

// ---- Access Control ----

export type AccessType = 'api' | 'ssh' | 'console';

export interface AccessControlEntry {
  id: string;
  instanceId: string;
  accessType: AccessType;
  sourceIp: string | null;
  sourceCountry: string | null;
  action: 'allowed' | 'denied';
  details: string | null;
  createdAt: string;
}

// ---- Threat Map ----

export interface ThreatMapData {
  entries: Array<{
    country: string;
    count: number;
    severity: Severity;
  }>;
  totalEvents: number;
  topCountries: Array<{ country: string; count: number }>;
}

// ---- Score History ----

export interface ScoreHistoryEntry {
  id: string;
  instanceId: string;
  overall: number;
  credentialSecurity: number;
  skillSafety: number;
  networkSecurity: number;
  updateStatus: number;
  configurationHardening: number;
  vulnerabilityManagement: number;
  incidentReadiness: number;
  recordedAt: string;
}
