export interface SecurityEvent {
  id: string;
  instanceId: string;
  eventType: SecurityEventType;
  severity: Severity;
  skillId: string | null;
  sourceIp: string | null;
  sourceCountry: string | null;
  details: string | null;
  createdAt: string;
}

export type SecurityEventType =
  | 'skill_blocked'
  | 'skill_installed'
  | 'skill_removed'
  | 'anomaly_detected'
  | 'credential_access'
  | 'unauthorized_network'
  | 'file_access_violation'
  | 'update_applied'
  | 'instance_hardened'
  | 'brute_force_attempt';

export type Severity = 'info' | 'warning' | 'critical';

export interface AuditLogEntry {
  id: string;
  instanceId: string;
  action: AuditAction;
  skillId: string | null;
  details: string | null;
  createdAt: string;
}

export type AuditAction =
  | 'shell_exec'
  | 'file_read'
  | 'file_write'
  | 'http_request'
  | 'credential_access'
  | 'skill_install'
  | 'skill_uninstall'
  | 'config_change';

export interface SecurityScore {
  overall: number;
  categories: {
    credentialSecurity: number;
    skillSafety: number;
    networkSecurity: number;
    updateStatus: number;
    configurationHardening: number;
    vulnerabilityManagement: number;
    incidentReadiness: number;
  };
  recommendations: string[];
}

export interface SecurityDashboard {
  score: SecurityScore;
  recentEvents: SecurityEvent[];
  installedSkills: {
    verified: number;
    unverified: number;
    blocked: number;
  };
  openAlerts: number;
  openIncidents: number;
  vulnerabilitySummary: VulnerabilitySummary;
  lastScan: string | null;
}

export interface VulnerabilitySummary {
  critical: number;
  high: number;
  medium: number;
  low: number;
}
