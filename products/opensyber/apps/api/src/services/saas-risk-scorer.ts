/**
 * SaaS Risk Scorer
 *
 * Scores OAuth apps and computes per-account SaaS posture scores.
 * Generates findings for: excessive permissions, dormant apps, unverified publishers.
 */

export type FindingSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface SaasFinding {
  checkId: string;
  title: string;
  description: string;
  severity: FindingSeverity;
  remediation: string;
  resourceId: string;
  resourceType: 'oauth_app' | 'saas_account';
}

export interface OAuthAppInput {
  id: string;
  appName: string;
  appId: string;
  provider: string;
  scopes: string[];
  riskScore: number;
  riskLevel: string;
  isAiAgent: boolean;
  lastAccessedAt: string | null;
  createdAt: string;
  grantedBy: string | null;
}

export interface AccountPostureResult {
  accountId: string;
  score: number;
  grade: string;
  findings: SaasFinding[];
  appCount: number;
  highRiskCount: number;
}

const EXCESSIVE_SCOPE_THRESHOLD = 8;
const DORMANT_DAYS_THRESHOLD = 90;

const VERIFIED_PUBLISHERS = new Set([
  'github', 'google', 'microsoft', 'slack', 'atlassian', 'salesforce',
  'okta', 'cloudflare', 'datadog', 'pagerduty', 'linear', 'notion',
  'figma', 'vercel', 'netlify', 'sentry', 'snyk', 'sonarqube',
]);

/**
 * Check if an OAuth app has excessive permissions
 */
function checkExcessivePermissions(app: OAuthAppInput): SaasFinding | null {
  if (app.scopes.length <= EXCESSIVE_SCOPE_THRESHOLD && app.riskScore < 50) {
    return null;
  }

  const severity: FindingSeverity = app.riskScore >= 75 ? 'critical' : 'high';

  return {
    checkId: 'saas-oauth-excessive-perms',
    title: `Excessive permissions: ${app.appName}`,
    description: `OAuth app "${app.appName}" has ${app.scopes.length} scopes with risk score ${app.riskScore}.`,
    severity,
    remediation: `Review and reduce scopes for "${app.appName}". Remove unnecessary permissions.`,
    resourceId: app.id,
    resourceType: 'oauth_app',
  };
}

/**
 * Check if an OAuth app is dormant (not accessed recently)
 */
function checkDormantApp(app: OAuthAppInput): SaasFinding | null {
  if (!app.lastAccessedAt) {
    const createdDate = new Date(app.createdAt);
    const daysSinceCreated = (Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceCreated < DORMANT_DAYS_THRESHOLD) return null;

    return {
      checkId: 'saas-oauth-dormant',
      title: `Dormant OAuth app: ${app.appName}`,
      description: `"${app.appName}" was created ${Math.round(daysSinceCreated)} days ago and has never been accessed.`,
      severity: 'medium',
      remediation: `Review if "${app.appName}" is still needed. Revoke access if unused.`,
      resourceId: app.id,
      resourceType: 'oauth_app',
    };
  }

  const lastAccess = new Date(app.lastAccessedAt);
  const daysSinceAccess = (Date.now() - lastAccess.getTime()) / (1000 * 60 * 60 * 24);

  if (daysSinceAccess < DORMANT_DAYS_THRESHOLD) return null;

  return {
    checkId: 'saas-oauth-dormant',
    title: `Dormant OAuth app: ${app.appName}`,
    description: `"${app.appName}" has not been accessed for ${Math.round(daysSinceAccess)} days.`,
    severity: 'medium',
    remediation: `Review if "${app.appName}" is still needed. Revoke access if unused.`,
    resourceId: app.id,
    resourceType: 'oauth_app',
  };
}

/**
 * Check if an OAuth app comes from an unverified publisher
 */
function checkUnverifiedPublisher(app: OAuthAppInput): SaasFinding | null {
  const normalizedName = app.appName.toLowerCase().replace(/[^a-z0-9]/g, '');
  const isVerified = VERIFIED_PUBLISHERS.has(app.provider.toLowerCase()) &&
    Array.from(VERIFIED_PUBLISHERS).some((p) => normalizedName.includes(p));

  if (isVerified) return null;

  return {
    checkId: 'saas-oauth-unverified-publisher',
    title: `Unverified publisher: ${app.appName}`,
    description: `"${app.appName}" is from an unverified publisher on ${app.provider}.`,
    severity: 'low',
    remediation: `Verify the publisher of "${app.appName}" before granting sensitive scopes.`,
    resourceId: app.id,
    resourceType: 'oauth_app',
  };
}

/**
 * Score all OAuth apps and generate findings for a SaaS account
 */
export function scoreOAuthApps(apps: OAuthAppInput[]): SaasFinding[] {
  const findings: SaasFinding[] = [];
  for (const app of apps) {
    const excessive = checkExcessivePermissions(app);
    if (excessive) findings.push(excessive);
    const dormant = checkDormantApp(app);
    if (dormant) findings.push(dormant);
    const unverified = checkUnverifiedPublisher(app);
    if (unverified) findings.push(unverified);
  }
  return findings;
}

/** Severity weights for posture score deduction */
const SEVERITY_WEIGHTS: Record<FindingSeverity, number> = {
  critical: 25, high: 15, medium: 8, low: 3,
};

/**
 * Calculate per-account SaaS posture score (0-100)
 */
export function calculateAccountPosture(
  accountId: string,
  apps: OAuthAppInput[],
): AccountPostureResult {
  const findings = scoreOAuthApps(apps);
  const highRiskCount = apps.filter((a) => a.riskLevel === 'high' || a.riskLevel === 'critical').length;

  let deduction = 0;
  for (const f of findings) {
    deduction += SEVERITY_WEIGHTS[f.severity] ?? 0;
  }

  const score = Math.max(0, Math.min(100, 100 - deduction));
  const grade = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F';

  return { accountId, score, grade, findings, appCount: apps.length, highRiskCount };
}
