/**
 * Skill Submission Security Scanner
 *
 * Automated security analysis for marketplace skill submissions.
 * Wires the "scanning" status in the review workflow to real checks.
 *
 * Checks:
 * 1. Manifest validation (required fields, slug format, version format)
 * 2. Network permission audit (known exfil domains, excessive domains)
 * 3. Source pattern scan (env scanning, credential access, shell injection)
 * 4. File size limits (max 5MB per skill package)
 * 5. Dependency risk (postinstall scripts, known malicious packages)
 */

import {
  scanSkillSource,
  auditManifestDomains,
  type SupplyChainRisk,
} from './supply-chain-security.js';

export interface ScanFinding {
  check: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  message: string;
}

export interface SkillScanResult {
  passed: boolean;
  score: number;
  findings: ScanFinding[];
  scannedAt: string;
  durationMs: number;
}

interface ManifestData {
  name?: string;
  slug?: string;
  version?: string;
  entrypoint?: string;
  permissions?: {
    network?: string[];
    filesystem?: string[];
    env?: string[];
  };
  author?: string;
}

const SLUG_REGEX = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;
const VERSION_REGEX = /^\d+\.\d+\.\d+$/;
const MAX_NETWORK_DOMAINS = 10;
const MAX_ENV_VARS = 20;
const MAX_FILESYSTEM_PATHS = 10;

/**
 * Run full security scan on a skill submission.
 */
export function scanSkillSubmission(
  manifest: ManifestData,
  sourceCode: string | null,
  packageSizeBytes: number,
): SkillScanResult {
  const start = Date.now();
  const findings: ScanFinding[] = [];

  // Check 1: Manifest validation
  findings.push(...validateManifest(manifest));

  // Check 2: Network permission audit
  if (manifest.permissions?.network) {
    findings.push(...auditNetworkPerms(manifest.permissions.network));
  }

  // Check 3: Source pattern scan
  if (sourceCode) {
    const risks = scanSkillSource(sourceCode);
    findings.push(...risks.map(riskToFinding));

    const domainRisks = manifest.permissions?.network
      ? auditManifestDomains(manifest.permissions.network)
      : [];
    findings.push(...domainRisks.map(riskToFinding));
  }

  // Check 4: Package size
  if (packageSizeBytes > 5 * 1024 * 1024) {
    findings.push({
      check: 'package_size',
      severity: 'medium',
      message: `Package size ${(packageSizeBytes / 1024 / 1024).toFixed(1)}MB exceeds 5MB limit`,
    });
  }

  // Check 5: Permission scope
  findings.push(...auditPermissionScope(manifest));

  const hasCritical = findings.some((f) => f.severity === 'critical');
  const hasHigh = findings.some((f) => f.severity === 'high');
  const score = computeScanScore(findings);

  return {
    passed: !hasCritical && !hasHigh,
    score,
    findings,
    scannedAt: new Date().toISOString(),
    durationMs: Date.now() - start,
  };
}

function validateManifest(m: ManifestData): ScanFinding[] {
  const findings: ScanFinding[] = [];

  if (!m.name) findings.push({ check: 'manifest', severity: 'high', message: 'Missing required field: name' });
  if (!m.slug) findings.push({ check: 'manifest', severity: 'high', message: 'Missing required field: slug' });
  else if (!SLUG_REGEX.test(m.slug)) findings.push({ check: 'manifest', severity: 'high', message: `Invalid slug format: "${m.slug}"` });

  if (!m.version) findings.push({ check: 'manifest', severity: 'high', message: 'Missing required field: version' });
  else if (!VERSION_REGEX.test(m.version)) findings.push({ check: 'manifest', severity: 'medium', message: `Non-semver version: "${m.version}"` });

  if (!m.entrypoint) findings.push({ check: 'manifest', severity: 'high', message: 'Missing required field: entrypoint' });
  if (!m.author) findings.push({ check: 'manifest', severity: 'medium', message: 'Missing author field' });

  return findings;
}

function auditNetworkPerms(domains: string[]): ScanFinding[] {
  const findings: ScanFinding[] = [];
  if (domains.length > MAX_NETWORK_DOMAINS) {
    findings.push({
      check: 'network_scope',
      severity: 'medium',
      message: `Requests ${domains.length} network domains (max ${MAX_NETWORK_DOMAINS})`,
    });
  }
  for (const domain of domains) {
    if (domain.includes('*')) {
      findings.push({
        check: 'network_wildcard',
        severity: 'high',
        message: `Wildcard domain "${domain}" — could exfiltrate to any subdomain`,
      });
    }
  }
  return findings;
}

function auditPermissionScope(m: ManifestData): ScanFinding[] {
  const findings: ScanFinding[] = [];
  const env = m.permissions?.env ?? [];
  const fs = m.permissions?.filesystem ?? [];

  if (env.length > MAX_ENV_VARS) {
    findings.push({ check: 'env_scope', severity: 'medium', message: `Requests ${env.length} env vars (max ${MAX_ENV_VARS})` });
  }
  if (fs.length > MAX_FILESYSTEM_PATHS) {
    findings.push({ check: 'fs_scope', severity: 'medium', message: `Requests ${fs.length} filesystem paths (max ${MAX_FILESYSTEM_PATHS})` });
  }
  if (fs.some((p) => p === '/' || p === '/*')) {
    findings.push({ check: 'fs_root', severity: 'critical', message: 'Requests root filesystem access' });
  }
  return findings;
}

function riskToFinding(risk: SupplyChainRisk): ScanFinding {
  return { check: risk.category, severity: risk.severity, message: risk.description };
}

function computeScanScore(findings: ScanFinding[]): number {
  let score = 100;
  for (const f of findings) {
    if (f.severity === 'critical') score -= 30;
    else if (f.severity === 'high') score -= 15;
    else if (f.severity === 'medium') score -= 5;
    else if (f.severity === 'low') score -= 2;
  }
  return Math.max(0, score);
}
