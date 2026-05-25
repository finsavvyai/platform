/**
 * Multi-Cloud Aggregator
 *
 * Aggregates security findings across AWS, GCP, and Azure accounts.
 * Correlates cross-cloud risks for the same resource types.
 */
import type { CloudProvider } from './multi-cloud-manager.js';

export type Severity = 'info' | 'low' | 'medium' | 'high' | 'critical';

export interface CloudFinding {
  id: string;
  provider: CloudProvider;
  accountId: string;
  resourceType: string;
  resourceId: string;
  severity: Severity;
  title: string;
  description: string;
  region?: string;
}

export interface CrossCloudRisk {
  resourceType: string;
  riskTitle: string;
  providers: CloudProvider[];
  findings: CloudFinding[];
  severity: Severity;
}

export interface AggregationResult {
  totalAccounts: number;
  totalFindings: number;
  bySeverity: Record<Severity, number>;
  byProvider: Record<CloudProvider, number>;
  crossCloudRisks: CrossCloudRisk[];
}

const SEVERITY_ORDER: Severity[] = ['info', 'low', 'medium', 'high', 'critical'];

/** Normalize resource types across providers for correlation. */
const RESOURCE_TYPE_MAP: Record<string, string> = {
  's3_bucket': 'public_storage',
  'gcs_bucket': 'public_storage',
  'azure_blob': 'public_storage',
  'ec2_instance': 'compute_instance',
  'gce_instance': 'compute_instance',
  'azure_vm': 'compute_instance',
  'iam_role': 'identity_role',
  'gcp_iam': 'identity_role',
  'azure_ad_role': 'identity_role',
  'security_group': 'network_acl',
  'gcp_firewall': 'network_acl',
  'azure_nsg': 'network_acl',
};

function normalizeResourceType(resourceType: string): string {
  return RESOURCE_TYPE_MAP[resourceType] ?? resourceType;
}

function maxSeverity(findings: CloudFinding[]): Severity {
  let max = 0;
  for (const f of findings) {
    const idx = SEVERITY_ORDER.indexOf(f.severity);
    if (idx > max) max = idx;
  }
  return SEVERITY_ORDER[max] ?? 'info';
}

const CROSS_CLOUD_RISK_TITLES: Record<string, string> = {
  public_storage: 'Public storage buckets exposed across clouds',
  compute_instance: 'Misconfigured compute instances across clouds',
  identity_role: 'Over-privileged identity roles across clouds',
  network_acl: 'Permissive network rules across clouds',
};

/** Detect cross-cloud risks: same normalized resource type across multiple providers. */
function detectCrossCloudRisks(findings: CloudFinding[]): CrossCloudRisk[] {
  const byNormalizedType = new Map<string, CloudFinding[]>();

  for (const finding of findings) {
    const normalized = normalizeResourceType(finding.resourceType);
    const group = byNormalizedType.get(normalized) ?? [];
    group.push(finding);
    byNormalizedType.set(normalized, group);
  }

  const risks: CrossCloudRisk[] = [];
  for (const [resourceType, group] of byNormalizedType) {
    const providers = [...new Set(group.map((f) => f.provider))];
    if (providers.length < 2) continue;
    risks.push({
      resourceType,
      riskTitle: CROSS_CLOUD_RISK_TITLES[resourceType] ?? `Cross-cloud risk: ${resourceType}`,
      providers: providers as CloudProvider[],
      findings: group,
      severity: maxSeverity(group),
    });
  }

  return risks.sort((a, b) =>
    SEVERITY_ORDER.indexOf(b.severity) - SEVERITY_ORDER.indexOf(a.severity),
  );
}

/** Aggregate findings across all cloud accounts and compute cross-cloud risks. */
export function aggregateFindings(
  findings: CloudFinding[],
  accountCount: number,
): AggregationResult {
  const bySeverity: Record<Severity, number> = { info: 0, low: 0, medium: 0, high: 0, critical: 0 };
  const byProvider: Record<CloudProvider, number> = { aws: 0, gcp: 0, azure: 0 };

  for (const f of findings) {
    bySeverity[f.severity] = (bySeverity[f.severity] ?? 0) + 1;
    byProvider[f.provider] = (byProvider[f.provider] ?? 0) + 1;
  }

  return {
    totalAccounts: accountCount,
    totalFindings: findings.length,
    bySeverity,
    byProvider,
    crossCloudRisks: detectCrossCloudRisks(findings),
  };
}
