/**
 * S3 Security Checks
 *
 * Security checks for Amazon S3 buckets using fetch API.
 * Checks for public access, encryption, versioning, and logging.
 *
 * Based on CIS AWS Foundations Benchmark and Prowler best practices.
 */

import type { ScanContext, SecurityFinding } from '../types.js';
import { s3Request, parseS3Acl, parser, listS3Buckets } from './s3-request.js';

// Re-export for backward compatibility
export { listS3Buckets } from './s3-request.js';

/**
 * Check S3.1: Public bucket via ACL
 */
export async function checkS3PublicAcl(
  context: ScanContext,
  bucket: string,
): Promise<SecurityFinding[]> {
  const findings: SecurityFinding[] = [];

  try {
    const response = await s3Request(context, 'GET', bucket, 'acl', context.region);
    if (!response.ok) return findings;

    const text = await response.text();
    const { publicRead, publicWrite } = parseS3Acl(text);

    if (publicRead || publicWrite) {
      findings.push({
        checkId: 's3-public-acl',
        severity: 'critical',
        resourceId: bucket,
        resourceType: 's3-bucket',
        region: context.region,
        title: 'S3 bucket allows public access via ACL',
        description: `Bucket "${bucket}" has ACL grants allowing public ${publicRead ? 'read' : ''}${publicRead && publicWrite ? '/' : ''}${publicWrite ? 'write' : ''} access.`,
        remediation: 'Review and restrict bucket ACL settings. Remove any public grants and enable S3 Block Public Access.',
        complianceFrameworks: ['CIS AWS 2.1.5', 'SOC2 CC6.6'],
      });
    }
  } catch (error) {
    findings.push({
      checkId: 's3-public-acl',
      severity: 'low',
      resourceId: bucket,
      resourceType: 's3-bucket',
      region: context.region,
      title: 'Could not check S3 bucket ACL',
      description: `Failed to retrieve ACL for "${bucket}": ${error instanceof Error ? error.message : 'Unknown error'}`,
      remediation: 'Verify IAM credentials have s3:GetBucketAcl permission.',
    });
  }

  return findings;
}

/**
 * Check S3.2: Missing server-side encryption
 */
export async function checkS3Encryption(
  context: ScanContext,
  bucket: string,
): Promise<SecurityFinding[]> {
  const findings: SecurityFinding[] = [];

  try {
    const response = await s3Request(context, 'GET', bucket, 'encryption', context.region);
    if (!response.ok) return findings;

    const text = await response.text();
    const parsed = parser.parse(text);

    const config = parsed?.ServerSideEncryptionConfiguration;
    const hasRule = config?.Rule || config?.ServerSideEncryptionConfiguration?.Rule;

    if (!hasRule) {
      findings.push({
        checkId: 's3-encryption-disabled',
        severity: 'high',
        resourceId: bucket,
        resourceType: 's3-bucket',
        region: context.region,
        title: 'S3 bucket lacks default encryption',
        description: `Bucket "${bucket}" does not have default encryption enabled.`,
        remediation: 'Enable default encryption using AES256 or aws:kms for the bucket.',
        complianceFrameworks: ['CIS AWS 2.1.3', 'SOC2 CC6.1'],
      });
    }
  } catch (error) {
    findings.push({
      checkId: 's3-encryption-disabled',
      severity: 'low',
      resourceId: bucket,
      resourceType: 's3-bucket',
      region: context.region,
      title: 'Could not check S3 encryption',
      description: `Failed to check encryption for "${bucket}": ${error instanceof Error ? error.message : 'Unknown error'}`,
      remediation: 'Verify IAM credentials have s3:GetEncryptionConfiguration permission.',
    });
  }

  return findings;
}

/**
 * Check S3.3: Missing versioning
 */
export async function checkS3Versioning(
  context: ScanContext,
  bucket: string,
): Promise<SecurityFinding[]> {
  const findings: SecurityFinding[] = [];

  try {
    const response = await s3Request(context, 'GET', bucket, 'versioning', context.region);
    if (!response.ok) return findings;

    const text = await response.text();
    const parsed = parser.parse(text);

    const statusRaw = parsed?.VersioningConfiguration?.Status;
    const status = typeof statusRaw === 'object' ? statusRaw?.['#text'] : statusRaw;
    if (status !== 'Enabled') {
      findings.push({
        checkId: 's3-versioning-disabled',
        severity: 'medium',
        resourceId: bucket,
        resourceType: 's3-bucket',
        region: context.region,
        title: 'S3 bucket versioning not enabled',
        description: `Bucket "${bucket}" does not have versioning enabled, which prevents object recovery.`,
        remediation: 'Enable S3 bucket versioning to protect against accidental deletion or overwrite.',
        complianceFrameworks: ['CIS AWS 2.1.4', 'SOC2 CC6.7'],
      });
    }
  } catch (error) {
    findings.push({
      checkId: 's3-versioning-disabled',
      severity: 'low',
      resourceId: bucket,
      resourceType: 's3-bucket',
      region: context.region,
      title: 'Could not check S3 versioning',
      description: `Failed to check versioning for "${bucket}": ${error instanceof Error ? error.message : 'Unknown error'}`,
      remediation: 'Verify IAM credentials have s3:GetBucketVersioning permission.',
    });
  }

  return findings;
}

/**
 * Run all S3 security checks for a bucket
 */
export async function runS3Checks(
  context: ScanContext,
  bucket: string,
): Promise<SecurityFinding[]> {
  const allFindings = await Promise.all([
    checkS3PublicAcl(context, bucket),
    checkS3Encryption(context, bucket),
    checkS3Versioning(context, bucket),
  ]);

  return allFindings.flat();
}
