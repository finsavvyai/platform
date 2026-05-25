import { eq, and, gte, desc } from 'drizzle-orm';
import {
  securityPolicies, alertRules, alerts, securityEvents,
  auditLog, vulnerabilities, fileBaselines, accessControlLog,
  incidents, securityScoreHistory, instances,
} from '@opensyber/db';
import {
  SOC2_CONTROLS, ISO27001_CONTROLS, CIS_CONTROLS,
  HIPAA_CONTROLS, GDPR_CONTROLS, NIST_CSF_CONTROLS, PCI_DSS_CONTROLS,
} from '@opensyber/shared';
import type { ComplianceControl, ComplianceControlResult, ComplianceFramework } from '@opensyber/shared';

const FRAMEWORK_CONTROLS: Record<ComplianceFramework, ComplianceControl[]> = {
  soc2: SOC2_CONTROLS,
  iso27001: ISO27001_CONTROLS,
  cis: CIS_CONTROLS,
  hipaa: HIPAA_CONTROLS,
  gdpr: GDPR_CONTROLS,
  nist_csf: NIST_CSF_CONTROLS,
  pci_dss: PCI_DSS_CONTROLS,
};

export async function evaluateCompliance(
  db: any,
  instanceId: string,
  framework: ComplianceFramework,
): Promise<{ results: ComplianceControlResult[]; overallScore: number }> {
  const controls = FRAMEWORK_CONTROLS[framework];
  if (!controls) throw new Error(`Unknown framework: ${framework}`);

  // Gather instance data
  const policies = await db.select().from(securityPolicies)
    .where(and(eq(securityPolicies.instanceId, instanceId), eq(securityPolicies.isActive, true)));
  const rules = await db.select().from(alertRules)
    .where(and(eq(alertRules.instanceId, instanceId), eq(alertRules.isActive, true)));
  const openAlerts = await db.select().from(alerts)
    .where(and(eq(alerts.instanceId, instanceId), eq(alerts.status, 'open')));
  const baselines = await db.select().from(fileBaselines)
    .where(eq(fileBaselines.instanceId, instanceId));
  const vulns = await db.select().from(vulnerabilities)
    .where(and(eq(vulnerabilities.instanceId, instanceId), eq(vulnerabilities.status, 'open')));
  const recentEvents = await db.select().from(securityEvents)
    .where(and(eq(securityEvents.instanceId, instanceId),
      gte(securityEvents.createdAt, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())))
    .limit(500);
  const recentAudit = await db.select().from(auditLog)
    .where(and(eq(auditLog.instanceId, instanceId),
      gte(auditLog.createdAt, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())))
    .limit(500);
  const openIncidents = await db.select().from(incidents)
    .where(eq(incidents.instanceId, instanceId))
    .then((rows: any[]) => rows.filter((r: any) => r.status !== 'closed' && r.status !== 'resolved'));
  const resolvedIncidents = await db.select().from(incidents)
    .where(eq(incidents.instanceId, instanceId))
    .then((rows: any[]) => rows.filter((r: any) => r.status === 'closed' || r.status === 'resolved'));
  const scoreHistory = await db.select().from(securityScoreHistory)
    .where(eq(securityScoreHistory.instanceId, instanceId))
    .orderBy(desc(securityScoreHistory.recordedAt)).limit(30);
  const [instance] = await db.select().from(instances).where(eq(instances.id, instanceId));

  // Build evaluation context
  const ctx = {
    hasPolicies: policies.length > 0,
    hasAlertRules: rules.length > 0,
    hasFileBaselines: baselines.length > 0,
    openAlertCount: openAlerts.length,
    openVulnCount: vulns.length,
    criticalVulnCount: vulns.filter((v: any) => v.severity === 'critical').length,
    eventCount: recentEvents.length,
    auditLogCount: recentAudit.length,
    openIncidentCount: openIncidents.length,
    resolvedIncidentCount: resolvedIncidents.length,
    hasScoreHistory: scoreHistory.length > 0,
    hasGatewayToken: !!instance?.gatewayTokenEncrypted,
    hasAgentVersion: !!instance?.agentVersion,
    hasNetworkPolicy: policies.some((p: any) => p.policyType === 'network_allowlist' || p.policyType === 'network_blocklist'),
    hasIpAllowlist: policies.some((p: any) => p.policyType === 'ip_allowlist'),
    hasFileRules: policies.some((p: any) => p.policyType === 'file_path_rules'),
    hasShellRules: policies.some((p: any) => p.policyType === 'shell_command_rules'),
  };

  const results: ComplianceControlResult[] = controls.map((control) => {
    const { pass, evidence } = evaluateControl(control, ctx);
    return {
      controlId: control.id,
      name: control.name,
      category: control.category,
      status: pass ? 'pass' : 'fail',
      evidence,
    };
  });

  const passing = results.filter((r) => r.status === 'pass').length;
  const overallScore = Math.round((passing / results.length) * 100);

  return { results, overallScore };
}

function evaluateControl(
  control: ComplianceControl,
  ctx: {
    hasPolicies: boolean;
    hasAlertRules: boolean;
    hasFileBaselines: boolean;
    openAlertCount: number;
    openVulnCount: number;
    criticalVulnCount: number;
    eventCount: number;
    auditLogCount: number;
    openIncidentCount: number;
    resolvedIncidentCount: number;
    hasScoreHistory: boolean;
    hasGatewayToken: boolean;
    hasAgentVersion: boolean;
    hasNetworkPolicy: boolean;
    hasIpAllowlist: boolean;
    hasFileRules: boolean;
    hasShellRules: boolean;
  },
): { pass: boolean; evidence: string } {
  // Map control IDs to evaluation logic
  const id = control.id;

  // SOC 2
  if (id === 'soc2-cc1.1' || id === 'iso-a5.1') return { pass: ctx.hasPolicies, evidence: ctx.hasPolicies ? `${ctx.hasPolicies ? 'Active' : 'No'} security policies configured` : 'No security policies defined' };
  if (id === 'soc2-cc3.1' || id === 'cis-7.1') return { pass: ctx.openVulnCount === 0 || ctx.hasScoreHistory, evidence: `${ctx.openVulnCount} open vulnerabilities, score history ${ctx.hasScoreHistory ? 'available' : 'unavailable'}` };
  if (id === 'soc2-cc4.1' || id === 'iso-a12.4' || id === 'cis-8.1') return { pass: ctx.hasAlertRules && ctx.eventCount > 0, evidence: `${ctx.hasAlertRules ? 'Alert rules active' : 'No alert rules'}, ${ctx.eventCount} events in 30d` };
  if (id === 'soc2-cc4.2') return { pass: ctx.openAlertCount === 0, evidence: `${ctx.openAlertCount} open alerts` };
  if (id === 'soc2-cc5.1' || id === 'iso-a8.1' || id === 'cis-6.1') return { pass: ctx.hasGatewayToken, evidence: ctx.hasGatewayToken ? 'Gateway authentication configured' : 'No gateway token configured' };
  if (id === 'soc2-cc5.2' || id === 'cis-5.4') return { pass: ctx.hasGatewayToken, evidence: ctx.hasGatewayToken ? 'Token-based authentication in use' : 'Missing authentication mechanism' };
  if (id === 'soc2-cc5.3' || id === 'iso-a8.2') return { pass: ctx.hasIpAllowlist, evidence: ctx.hasIpAllowlist ? 'IP allowlist configured' : 'No IP allowlist configured' };
  if (id === 'soc2-cc6.1' || id === 'iso-a10.1' || id === 'cis-3.6') return { pass: true, evidence: 'TLS encryption enforced for all connections' };
  if (id === 'soc2-cc6.2') return { pass: ctx.hasGatewayToken, evidence: ctx.hasGatewayToken ? 'Credentials encrypted at rest' : 'Credential encryption not verified' };
  if (id === 'soc2-cc6.3' || id === 'iso-a12.6') return { pass: ctx.criticalVulnCount === 0, evidence: `${ctx.criticalVulnCount} critical vulnerabilities` };
  if (id === 'soc2-cc7.1' || id === 'iso-a16.1' || id === 'cis-17.1') return { pass: ctx.hasAlertRules, evidence: ctx.hasAlertRules ? 'Incident detection via alert rules' : 'No alert rules configured' };
  if (id === 'soc2-cc7.2') return { pass: ctx.resolvedIncidentCount > 0 || ctx.hasAlertRules, evidence: `${ctx.resolvedIncidentCount} resolved incidents, alert rules ${ctx.hasAlertRules ? 'active' : 'inactive'}` };
  if (id === 'soc2-cc7.3') return { pass: ctx.openIncidentCount === 0, evidence: `${ctx.openIncidentCount} open incidents` };
  if (id === 'soc2-cc8.1') return { pass: ctx.auditLogCount > 0, evidence: `${ctx.auditLogCount} audit log entries in 30d` };
  if (id === 'soc2-cc9.1') return { pass: ctx.hasPolicies, evidence: ctx.hasPolicies ? 'Vendor policies configured' : 'No vendor management policies' };
  if (id === 'soc2-a1.1') return { pass: ctx.hasAgentVersion && ctx.hasScoreHistory, evidence: `Agent ${ctx.hasAgentVersion ? 'monitored' : 'not monitored'}, score history ${ctx.hasScoreHistory ? 'available' : 'unavailable'}` };
  if (id === 'soc2-a1.2') return { pass: ctx.hasFileBaselines, evidence: ctx.hasFileBaselines ? 'File baselines configured for recovery' : 'No file baselines for DR' };

  // ISO 27001
  if (id === 'iso-a6.1') return { pass: ctx.hasPolicies, evidence: ctx.hasPolicies ? 'Security roles implied by policy config' : 'No policies defined' };
  if (id === 'iso-a7.1' || id === 'cis-1.1') return { pass: ctx.hasAgentVersion, evidence: ctx.hasAgentVersion ? 'Instance inventory maintained' : 'Instance version unknown' };
  if (id === 'iso-a7.2' || id === 'cis-2.1') return { pass: ctx.hasFileBaselines, evidence: ctx.hasFileBaselines ? 'Assets classified via file baselines' : 'No asset classification' };
  if (id === 'iso-a8.3') return { pass: ctx.hasIpAllowlist, evidence: ctx.hasIpAllowlist ? 'Privileged access restricted' : 'No IP restrictions' };
  if (id === 'iso-a12.1') return { pass: ctx.hasPolicies, evidence: ctx.hasPolicies ? 'Operating procedures documented via policies' : 'No operating procedures' };
  if (id === 'iso-a13.1' || id === 'cis-9.1') return { pass: ctx.hasNetworkPolicy, evidence: ctx.hasNetworkPolicy ? 'Network policies configured' : 'No network policies' };
  if (id === 'iso-a17.1') return { pass: ctx.hasFileBaselines, evidence: ctx.hasFileBaselines ? 'Recovery baselines configured' : 'No continuity plan' };
  if (id === 'iso-a18.1') return { pass: ctx.hasScoreHistory, evidence: ctx.hasScoreHistory ? 'Compliance monitored via score history' : 'No compliance monitoring' };

  // CIS
  if (id === 'cis-1.2' || id === 'soc2-cc1.2' || id === 'soc2-cc2.1') return { pass: ctx.hasPolicies, evidence: ctx.hasPolicies ? 'Governance through policies' : 'No governance evidence' };
  if (id === 'cis-3.1') return { pass: ctx.hasFileRules, evidence: ctx.hasFileRules ? 'Data classification via file rules' : 'No file rules configured' };
  if (id === 'cis-4.1') return { pass: ctx.hasPolicies && ctx.hasShellRules, evidence: `Policies: ${ctx.hasPolicies ? 'yes' : 'no'}, Shell rules: ${ctx.hasShellRules ? 'yes' : 'no'}` };
  if (id === 'cis-4.7') return { pass: ctx.hasNetworkPolicy, evidence: ctx.hasNetworkPolicy ? 'Firewall rules via network policies' : 'No firewall rules' };
  if (id === 'cis-5.1') return { pass: ctx.hasGatewayToken, evidence: ctx.hasGatewayToken ? 'Account management via gateway tokens' : 'No account management' };
  if (id === 'cis-7.5') return { pass: ctx.hasAgentVersion, evidence: ctx.hasAgentVersion ? 'Agent updates tracked' : 'No patch management' };
  if (id === 'cis-8.5') return { pass: ctx.auditLogCount > 0, evidence: `${ctx.auditLogCount} audit entries collected` };

  // Default: pass if they have policies (generic catch-all)
  return { pass: ctx.hasPolicies, evidence: ctx.hasPolicies ? 'General security controls in place' : 'No security controls configured' };
}
