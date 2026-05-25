/**
 * Enhanced Security Score calculation (7 categories, weighted).
 * Extracted from security routes for testability.
 */

export interface ScoreInstance {
  lastHealthCheck: string | null;
  gatewayTokenEncrypted: string | null;
  agentVersion: string | null;
}

export interface ScoreSkillCounts {
  verified: number;
  unverified: number;
  blocked: number;
}

export interface ScoreExtended {
  activePolicies: number;
  activeAlertRules: number;
  openAlerts: number;
  openIncidents: number;
  fileBaselines: number;
  vulnSummary: { critical: number; high: number; medium: number; low: number };
}

export interface ScoreEvent {
  severity: string;
  eventType: string;
  createdAt: string;
}

export interface ScoreResult {
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

export function calculateSecurityScore(
  instance: ScoreInstance,
  events: ScoreEvent[],
  skillCounts: ScoreSkillCounts,
  extended: ScoreExtended,
): ScoreResult {
  const recommendations: string[] = [];
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const recentEvents = events.filter((e) => new Date(e.createdAt).getTime() > now - day);

  // 1. Credential Security (20%)
  let credentialSecurity = 100;
  if (!instance.gatewayTokenEncrypted) {
    credentialSecurity -= 50;
    recommendations.push('Configure gateway token for secure agent communication.');
  }
  const credEvents = recentEvents.filter(
    (e) => e.eventType === 'credential_access' && e.severity === 'critical',
  ).length;
  credentialSecurity -= Math.min(credEvents * 15, 40);
  if (credEvents > 0) recommendations.push(`${credEvents} critical credential access event(s) in 24h.`);
  if (extended.activePolicies === 0) credentialSecurity -= 10;
  credentialSecurity = clamp(credentialSecurity);

  // 2. Skill Safety (15%)
  let skillSafety = 100;
  skillSafety -= skillCounts.unverified * 20;
  skillSafety -= skillCounts.blocked * 30;
  if (skillCounts.unverified > 0) recommendations.push(`Remove or verify ${skillCounts.unverified} unverified skill(s).`);
  if (skillCounts.blocked > 0) recommendations.push(`Remove ${skillCounts.blocked} blocked/revoked skill(s).`);
  skillSafety = clamp(skillSafety);

  // 3. Network Security (20%)
  let networkSecurity = 100;
  const netEvents = recentEvents.filter((e) => e.eventType === 'unauthorized_network').length;
  networkSecurity -= Math.min(netEvents * 10, 50);
  if (netEvents > 0) recommendations.push(`${netEvents} unauthorized network event(s) in 24h.`);
  if (extended.activePolicies === 0) {
    networkSecurity -= 20;
    recommendations.push('Configure network allowlist/blocklist policies.');
  }
  networkSecurity = clamp(networkSecurity);

  // 4. Update Status (10%)
  let updateStatus = 100;
  if (!instance.agentVersion) {
    updateStatus -= 40;
    recommendations.push('Agent version not reported.');
  }
  if (!instance.lastHealthCheck || new Date(instance.lastHealthCheck).getTime() < now - 5 * 60 * 1000) {
    updateStatus -= 30;
    recommendations.push('Instance health check is overdue.');
  }
  updateStatus = clamp(updateStatus);

  // 5. Configuration Hardening (15%)
  let configurationHardening = 100;
  if (extended.activePolicies === 0) {
    configurationHardening -= 30;
    recommendations.push('Create security policies for your instance.');
  }
  if (extended.fileBaselines === 0) {
    configurationHardening -= 25;
    recommendations.push('Set up file integrity baselines.');
  }
  if (extended.activeAlertRules === 0) {
    configurationHardening -= 25;
    recommendations.push('Configure alert rules for threat detection.');
  }
  configurationHardening = clamp(configurationHardening);

  // 6. Vulnerability Management (10%)
  let vulnerabilityManagement = 100;
  const vs = extended.vulnSummary;
  vulnerabilityManagement -= vs.critical * 25;
  vulnerabilityManagement -= vs.high * 15;
  vulnerabilityManagement -= vs.medium * 5;
  if (vs.critical > 0) recommendations.push(`${vs.critical} critical vulnerabilities require immediate attention.`);
  if (vs.high > 0) recommendations.push(`${vs.high} high severity vulnerabilities found.`);
  vulnerabilityManagement = clamp(vulnerabilityManagement);

  // 7. Incident Readiness (10%)
  let incidentReadiness = 100;
  if (extended.activeAlertRules === 0) incidentReadiness -= 30;
  incidentReadiness -= Math.min(extended.openIncidents * 10, 30);
  incidentReadiness -= Math.min(extended.openAlerts * 5, 30);
  if (extended.openIncidents > 0) recommendations.push(`${extended.openIncidents} open incident(s) need attention.`);
  if (extended.openAlerts > 0) recommendations.push(`${extended.openAlerts} unresolved alert(s).`);
  incidentReadiness = clamp(incidentReadiness);

  // Weighted average
  const overall = Math.round(
    credentialSecurity * 0.20 +
    skillSafety * 0.15 +
    networkSecurity * 0.20 +
    updateStatus * 0.10 +
    configurationHardening * 0.15 +
    vulnerabilityManagement * 0.10 +
    incidentReadiness * 0.10,
  );

  return {
    overall: clamp(overall),
    categories: {
      credentialSecurity,
      skillSafety,
      networkSecurity,
      updateStatus,
      configurationHardening,
      vulnerabilityManagement,
      incidentReadiness,
    },
    recommendations,
  };
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, n));
}
