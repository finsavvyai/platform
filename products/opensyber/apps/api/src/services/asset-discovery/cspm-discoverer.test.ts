import { describe, it, expect } from 'vitest';
import { discoverFromCspmFindings } from './cspm-discoverer.js';
import type { CspmFindingRecord } from './types.js';

function makeFinding(overrides: Partial<CspmFindingRecord> = {}): CspmFindingRecord {
  return {
    checkId: 's3-public-acl',
    severity: 'high',
    resourceId: 'arn:aws:s3:::my-bucket',
    resourceType: 's3-bucket',
    region: 'us-east-1',
    title: 'S3 Bucket Public ACL',
    ...overrides,
  };
}

describe('discoverFromCspmFindings', () => {
  it('should discover cloud resource assets', () => {
    const result = discoverFromCspmFindings([makeFinding()]);
    expect(result.assets).toHaveLength(1);
    expect(result.assets[0].assetType).toBe('cloud_resource');
    expect(result.assets[0].identifier).toBe('arn:aws:s3:::my-bucket');
  });

  it('should classify sensitivity based on finding severity', () => {
    const critical = discoverFromCspmFindings([makeFinding({ severity: 'critical' })]);
    expect(critical.assets[0].sensitivity).toBe('critical');

    const high = discoverFromCspmFindings([makeFinding({ severity: 'high' })]);
    expect(high.assets[0].sensitivity).toBe('high');
  });

  it('should mark RDS and SecretManager as crown jewels', () => {
    const rds = discoverFromCspmFindings([makeFinding({
      resourceType: 'rds',
      resourceId: 'arn:aws:rds:::prod-db',
    })]);
    expect(rds.assets[0].isCrownJewel).toBe(true);
  });

  it('should infer public read relation for public S3 findings', () => {
    const result = discoverFromCspmFindings([makeFinding({
      checkId: 's3-public-acl',
      resourceType: 's3-bucket',
    })]);
    const rel = result.relations.find((r) => r.relationType === 'read_access');
    expect(rel).toBeDefined();
    expect(rel!.sourceIdentifier).toBe('internet');
  });

  it('should deduplicate findings by resourceId', () => {
    const findings = [
      makeFinding({ resourceId: 'bucket-1' }),
      makeFinding({ checkId: 's3-encryption', resourceId: 'bucket-1' }),
    ];
    const result = discoverFromCspmFindings(findings);
    expect(result.assets).toHaveLength(1);
  });

  it('should include metadata with check details', () => {
    const result = discoverFromCspmFindings([makeFinding()]);
    expect(result.assets[0].metadata).toBeDefined();
    expect(result.assets[0].metadata!.checkId).toBe('s3-public-acl');
    expect(result.assets[0].metadata!.region).toBe('us-east-1');
  });

  it('should handle empty findings array', () => {
    const result = discoverFromCspmFindings([]);
    expect(result.assets).toHaveLength(0);
    expect(result.relations).toHaveLength(0);
  });
});
