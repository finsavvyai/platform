/**
 * CSPM Discoverer
 *
 * Extracts cloud resource assets and relations from CSPM scan findings.
 */
import type { DiscoveryResult, CspmFindingRecord, DiscoveredAsset, DiscoveredRelation } from './types.js';
import { classifyCloudResourceSensitivity } from './sensitivity-rules.js';

const CROWN_JEWEL_TYPES = new Set(['secretsmanager', 'kms', 'rds', 'dynamodb']);

export function discoverFromCspmFindings(findings: CspmFindingRecord[]): DiscoveryResult {
  const assets: DiscoveredAsset[] = [];
  const relations: DiscoveredRelation[] = [];
  const seen = new Set<string>();

  for (const finding of findings) {
    const key = `cloud_resource:${finding.resourceId}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const sensitivity = classifyCloudResourceSensitivity(finding.resourceType, finding.severity);
    const isCrownJewel = CROWN_JEWEL_TYPES.has(finding.resourceType.toLowerCase());

    assets.push({
      assetType: 'cloud_resource',
      name: finding.title || finding.resourceId,
      identifier: finding.resourceId,
      sensitivity,
      isCrownJewel,
      discoverySource: 'cspm_scan',
      metadata: {
        checkId: finding.checkId,
        resourceType: finding.resourceType,
        region: finding.region,
        severity: finding.severity,
      },
    });

    // Infer relations from resource types
    inferRelationsFromResourceType(finding, assets, relations, seen);
  }

  return { assets, relations };
}

function inferRelationsFromResourceType(
  finding: CspmFindingRecord,
  _assets: DiscoveredAsset[],
  relations: DiscoveredRelation[],
  _seen: Set<string>,
): void {
  const type = finding.resourceType.toLowerCase();

  // S3 public access → internet can read
  if (type.includes('s3') && finding.checkId.includes('public')) {
    relations.push({
      sourceIdentifier: 'internet',
      targetIdentifier: finding.resourceId,
      relationType: 'read_access',
      confidence: 0.9,
      discoverySource: 'cspm_scan',
    });
  }

  // Open security group → network access
  if (type.includes('security-group') && finding.checkId.includes('open')) {
    relations.push({
      sourceIdentifier: 'internet',
      targetIdentifier: finding.resourceId,
      relationType: 'network_access',
      confidence: 0.8,
      discoverySource: 'cspm_scan',
    });
  }

  // IAM findings → role/permission relations
  if (type.includes('iam') && finding.checkId.includes('admin')) {
    relations.push({
      sourceIdentifier: finding.resourceId,
      targetIdentifier: '*',
      relationType: 'write_access',
      confidence: 0.7,
      discoverySource: 'iam_policy',
    });
  }
}
