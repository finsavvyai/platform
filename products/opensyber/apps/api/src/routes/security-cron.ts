import { eq, and, desc } from 'drizzle-orm';
import {
  instances, securityEvents, skillInstallations, skills,
  securityPolicies, alertRules, alerts, incidents,
  fileBaselines, vulnerabilities, securityScoreHistory,
} from '@opensyber/db';
import type { Env } from '../types.js';
import { calculateSecurityScore } from '../services/security-score.js';

export async function recordScoreSnapshots(env: Env): Promise<void> {
  const { createDb } = await import('../lib/db.js');
  const db = createDb(env.DB);

  const allInstances = await db.select().from(instances)
    .where(eq(instances.status, 'running'));

  for (const instance of allInstances) {
    try {
      await recordInstanceSnapshot(db, instance);
    } catch (err) {
      console.error(`[ScoreSnapshot] Error for instance ${instance.id}:`, err);
    }
  }
}

async function recordInstanceSnapshot(db: any, instance: any): Promise<void> {
  const events = await db.select().from(securityEvents)
    .where(eq(securityEvents.instanceId, instance.id))
    .orderBy(desc(securityEvents.createdAt)).limit(50);

  const installs = await db
    .select({ installation: skillInstallations, skill: skills })
    .from(skillInstallations)
    .innerJoin(skills, eq(skillInstallations.skillId, skills.id))
    .where(eq(skillInstallations.instanceId, instance.id));

  const policies = await db.select().from(securityPolicies)
    .where(and(eq(securityPolicies.instanceId, instance.id), eq(securityPolicies.isActive, true)));
  const rules = await db.select().from(alertRules)
    .where(and(eq(alertRules.instanceId, instance.id), eq(alertRules.isActive, true)));
  const openAlertRows = await db.select().from(alerts)
    .where(and(eq(alerts.instanceId, instance.id), eq(alerts.status, 'open')));
  const openIncidentRows = await db.select().from(incidents)
    .where(eq(incidents.instanceId, instance.id))
    .then((rows: any[]) => rows.filter((r) => r.status !== 'closed' && r.status !== 'resolved'));
  const baselines = await db.select().from(fileBaselines)
    .where(eq(fileBaselines.instanceId, instance.id));
  const vulns = await db.select().from(vulnerabilities)
    .where(and(eq(vulnerabilities.instanceId, instance.id), eq(vulnerabilities.status, 'open')));

  const vulnSummary = {
    critical: vulns.filter((v: any) => v.severity === 'critical').length,
    high: vulns.filter((v: any) => v.severity === 'high').length,
    medium: vulns.filter((v: any) => v.severity === 'medium').length,
    low: vulns.filter((v: any) => v.severity === 'low').length,
  };

  const score = calculateSecurityScore(instance, events, {
    verified: installs.filter((i: any) => i.skill.verificationStatus === 'approved').length,
    unverified: installs.filter((i: any) => i.skill.verificationStatus !== 'approved' && i.skill.verificationStatus !== 'revoked').length,
    blocked: installs.filter((i: any) => i.skill.verificationStatus === 'revoked').length,
  }, {
    activePolicies: policies.length,
    activeAlertRules: rules.length,
    openAlerts: openAlertRows.length,
    openIncidents: openIncidentRows.length,
    fileBaselines: baselines.length,
    vulnSummary,
  });

  await db.insert(securityScoreHistory).values({
    id: crypto.randomUUID(),
    instanceId: instance.id,
    overall: score.overall,
    credentialSecurity: score.categories.credentialSecurity,
    skillSafety: score.categories.skillSafety,
    networkSecurity: score.categories.networkSecurity,
    updateStatus: score.categories.updateStatus,
    configurationHardening: score.categories.configurationHardening,
    vulnerabilityManagement: score.categories.vulnerabilityManagement,
    incidentReadiness: score.categories.incidentReadiness,
    recordedAt: new Date().toISOString(),
  });
}
