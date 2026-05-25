export interface SecurityDashboard {
  score: {
    overall: number;
    categories: Record<string, number>;
    recommendations: string[];
  };
  recentEvents: Array<{
    id: string;
    eventType: string;
    severity: string;
    details: string | null;
    createdAt: string;
  }>;
  installedSkills: { verified: number; unverified: number; blocked: number };
  openAlerts: number;
  openIncidents: number;
  vulnerabilitySummary: { critical: number; high: number; medium: number; low: number };
  lastScan: string | null;
}

export interface ScorePoint {
  date: string;
  score: number;
}

export interface ThreatCountry {
  country: string;
  eventCount: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

export const categoryLabels: Record<string, string> = {
  credentialSecurity: 'Credential Security',
  skillSafety: 'Skill Safety',
  networkSecurity: 'Network Security',
  updateStatus: 'Update Status',
  configurationHardening: 'Configuration Hardening',
  vulnerabilityManagement: 'Vulnerability Management',
  incidentReadiness: 'Incident Readiness',
};

export const severityColors: Record<string, string> = {
  info: 'bg-info/10 text-info',
  warning: 'bg-yellow-500/10 text-yellow-400',
  critical: 'bg-red-500/10 text-red-400',
};

export function scoreColor(score: number): string {
  if (score >= 80) return 'text-green-400';
  if (score >= 50) return 'text-yellow-400';
  return 'text-red-400';
}

export function barColor(score: number): string {
  if (score >= 80) return 'bg-green-500';
  if (score >= 50) return 'bg-yellow-500';
  return 'bg-red-500';
}
