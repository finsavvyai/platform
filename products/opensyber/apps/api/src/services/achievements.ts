/**
 * Achievement evaluation service.
 * Checks instance data against achievement criteria and returns earned/locked status.
 */

import { eq, and, gte, desc, ne } from 'drizzle-orm';
import {
  securityScoreHistory, securityPolicies, alertRules,
  incidents, skillInstallations, skills,
  complianceReports, vulnerabilities,
} from '@opensyber/db';
import { ACHIEVEMENTS } from '@opensyber/shared';
import type { Achievement } from '@opensyber/shared';

export interface AchievementResult {
  slug: string;
  title: string;
  description: string;
  icon: string;
  category: string;
  shareText: string;
  earned: boolean;
  earnedAt?: string;
}

export async function evaluateAchievements(
  db: any,
  instanceId: string,
): Promise<AchievementResult[]> {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  // Parallel data fetch
  const [
    scoreHistory,
    policies,
    rules,
    allIncidents,
    skillRows,
    reports,
    vulns,
  ] = await Promise.all([
    db.select().from(securityScoreHistory)
      .where(eq(securityScoreHistory.instanceId, instanceId))
      .orderBy(desc(securityScoreHistory.recordedAt))
      .limit(30),
    db.select().from(securityPolicies)
      .where(and(eq(securityPolicies.instanceId, instanceId), eq(securityPolicies.isActive, true))),
    db.select().from(alertRules)
      .where(and(eq(alertRules.instanceId, instanceId), eq(alertRules.isActive, true))),
    db.select().from(incidents)
      .where(eq(incidents.instanceId, instanceId)),
    db.select({ status: skills.verificationStatus })
      .from(skillInstallations)
      .innerJoin(skills, eq(skillInstallations.skillId, skills.id))
      .where(eq(skillInstallations.instanceId, instanceId)),
    db.select().from(complianceReports)
      .where(eq(complianceReports.instanceId, instanceId)),
    db.select().from(vulnerabilities)
      .where(eq(vulnerabilities.instanceId, instanceId)),
  ]);

  // Build evaluation context
  const ctx = buildContext(scoreHistory, policies, rules, allIncidents, skillRows, reports, vulns, now, day);

  return ACHIEVEMENTS.map((achievement) => ({
    ...achievement,
    earned: checkAchievement(achievement.slug, ctx),
    earnedAt: checkAchievement(achievement.slug, ctx) ? new Date().toISOString() : undefined,
  }));
}

interface EvalContext {
  consecutiveDays95: number;
  consecutiveDays80: number;
  patchedWithinHour: boolean;
  incidentFreeDays: number;
  activeAlertRuleCount: number;
  activePolicyTypes: Set<string>;
  allSkillsVerified: boolean;
  hasSkills: boolean;
  uniqueFrameworks: number;
  resolvedWithin24h: boolean;
  hasNetworkAllowlist: boolean;
  hasNetworkBlocklist: boolean;
}

function buildContext(
  scoreHistory: any[],
  policies: any[],
  rules: any[],
  allIncidents: any[],
  skillRows: any[],
  reports: any[],
  vulns: any[],
  now: number,
  day: number,
): EvalContext {
  // Consecutive days with score >= threshold
  let consecutiveDays95 = 0;
  let consecutiveDays80 = 0;
  for (const record of scoreHistory) {
    if (record.overall >= 95) consecutiveDays95++;
    else break;
  }
  for (const record of scoreHistory) {
    if (record.overall >= 80) consecutiveDays80++;
    else break;
  }

  // CVE patched within 1 hour
  const patchedWithinHour = vulns.some((v: any) => {
    if (v.status !== 'fixed' || !v.createdAt || !v.updatedAt) return false;
    const created = new Date(v.createdAt).getTime();
    const updated = new Date(v.updatedAt).getTime();
    return (updated - created) <= 60 * 60 * 1000;
  });

  // Incident-free days
  const openOrRecent = allIncidents.filter(
    (i: any) => i.status !== 'closed' && i.status !== 'resolved',
  );
  const lastIncidentDate = allIncidents.length > 0
    ? Math.max(...allIncidents.map((i: any) => new Date(i.createdAt).getTime()))
    : 0;
  const incidentFreeDays = lastIncidentDate > 0
    ? Math.floor((now - lastIncidentDate) / day)
    : (scoreHistory.length > 0 ? 30 : 0);

  // Policy types
  const activePolicyTypes = new Set(policies.map((p: any) => p.policyType));

  // Skills verification
  const hasSkills = skillRows.length > 0;
  const allSkillsVerified = hasSkills && skillRows.every(
    (s: any) => s.status === 'approved',
  );

  // Unique compliance frameworks
  const uniqueFrameworks = new Set(reports.map((r: any) => r.framework)).size;

  // Resolved incident within 24h
  const resolvedWithin24h = allIncidents.some((i: any) => {
    if (i.status !== 'resolved' && i.status !== 'closed') return false;
    if (!i.resolvedAt) return false;
    const created = new Date(i.createdAt).getTime();
    const resolved = new Date(i.resolvedAt).getTime();
    return (resolved - created) <= 24 * 60 * 60 * 1000;
  });

  return {
    consecutiveDays95,
    consecutiveDays80,
    patchedWithinHour,
    incidentFreeDays,
    activeAlertRuleCount: rules.length,
    activePolicyTypes,
    allSkillsVerified,
    hasSkills,
    uniqueFrameworks,
    resolvedWithin24h,
    hasNetworkAllowlist: activePolicyTypes.has('network_allowlist'),
    hasNetworkBlocklist: activePolicyTypes.has('network_blocklist'),
  };
}

function checkAchievement(slug: string, ctx: EvalContext): boolean {
  switch (slug) {
    case 'fortress': return ctx.consecutiveDays95 >= 7;
    case 'guardian': return ctx.consecutiveDays80 >= 30;
    case 'zero-day-hero': return ctx.patchedWithinHour;
    case 'clean-sheet': return ctx.incidentFreeDays >= 30;
    case 'vigilant': return ctx.activeAlertRuleCount >= 5;
    case 'hardened': return ctx.activePolicyTypes.size >= 6;
    case 'verified-only': return ctx.allSkillsVerified && ctx.hasSkills;
    case 'compliance-ready': return ctx.uniqueFrameworks >= 3;
    case 'first-responder': return ctx.resolvedWithin24h;
    case 'network-sentinel': return ctx.hasNetworkAllowlist && ctx.hasNetworkBlocklist;
    default: return false;
  }
}
