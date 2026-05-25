/**
 * CloudTrail Security Checks -- multi-region trails, log encryption, log validation.
 * Based on CIS AWS Foundations Benchmark and Prowler best practices.
 */
import type { ScanContext, SecurityFinding } from '../types.js';
import { cloudTrailRequest, parser } from './cloudtrail-request.js';

/**
 * Check CloudTrail.1: Multi-region trail enabled
 */
export async function checkCloudTrailMultiRegion(context: ScanContext): Promise<SecurityFinding[]> {
  const findings: SecurityFinding[] = [];

  try {
    const response = await cloudTrailRequest(context, 'DescribeTrails', {});
    const parsed = parser.parse(response);
    const trails = parsed?.DescribeTrailsResponse?.trails?.Trail || [];
    const trailsList = Array.isArray(trails) ? trails : trails ? [trails] : [];

    const hasMultiRegionTrail = trailsList.some((trail: Record<string, unknown>) => {
      const isMultiRegionRaw = trail?.IsMultiRegionTrail;
      const isMultiRegion = typeof isMultiRegionRaw === 'object' && isMultiRegionRaw !== null
        ? (isMultiRegionRaw as Record<string, unknown>)['#text']
        : isMultiRegionRaw;
      return isMultiRegion === true || isMultiRegion === 'true';
    });

    if (!hasMultiRegionTrail) {
      findings.push({
        checkId: 'cloudtrail-not-multi-region',
        severity: 'medium',
        resourceId: context.accountId,
        resourceType: 'cloudtrail',
        region: context.region,
        title: 'CloudTrail not enabled in all regions',
        description: 'No CloudTrail trail is configured to log events from all AWS regions.',
        remediation: 'Enable multi-region CloudTrail to capture API activity across all regions.',
        complianceFrameworks: ['CIS AWS 2.4', 'SOC2 CC6.1'],
      });
    }
  } catch (error) {
    findings.push({
      checkId: 'cloudtrail-not-multi-region',
      severity: 'low',
      resourceId: context.accountId,
      resourceType: 'cloudtrail',
      region: context.region,
      title: 'Could not check CloudTrail configuration',
      description: `Failed to check CloudTrail: ${error instanceof Error ? error.message : 'Unknown error'}`,
      remediation: 'Verify IAM credentials have cloudtrail:DescribeTrails permission.',
    });
  }

  return findings;
}

/**
 * Check CloudTrail.2: Trail log encryption enabled
 */
export async function checkCloudTrailEncryption(context: ScanContext): Promise<SecurityFinding[]> {
  const findings: SecurityFinding[] = [];

  try {
    const response = await cloudTrailRequest(context, 'DescribeTrails', {});
    const parsed = parser.parse(response);
    const trails = parsed?.DescribeTrailsResponse?.trails?.Trail || [];
    const trailsList = Array.isArray(trails) ? trails : trails ? [trails] : [];

    for (const trail of trailsList) {
      const trailArnRaw = trail?.TrailARN;
      const trailArn = typeof trailArnRaw === 'object' ? trailArnRaw?.['#text'] : trailArnRaw;
      const kmsKeyRaw = trail?.KmsKeyId;
      const kmsKey = typeof kmsKeyRaw === 'object' ? kmsKeyRaw?.['#text'] : kmsKeyRaw;
      const homeRegionRaw = trail?.HomeRegion;
      const homeRegion = typeof homeRegionRaw === 'object' ? homeRegionRaw?.['#text'] : homeRegionRaw;

      if (homeRegion !== context.region && !trailArn?.includes(':*')) {
        continue;
      }

      if (!kmsKey) {
        findings.push({
          checkId: 'cloudtrail-logs-unencrypted',
          severity: 'medium',
          resourceId: trailArn || 'unknown',
          resourceType: 'cloudtrail-trail',
          region: context.region,
          title: 'CloudTrail logs are not encrypted',
          description: `CloudTrail trail "${trailArn}" does not use KMS encryption for log files.`,
          remediation: 'Enable KMS encryption for CloudTrail log files using a customer-managed key.',
          complianceFrameworks: ['CIS AWS 2.4', 'SOC2 CC6.1'],
        });
      }
    }

    if (trailsList.length === 0) {
      findings.push({
        checkId: 'cloudtrail-not-enabled',
        severity: 'high',
        resourceId: context.accountId,
        resourceType: 'cloudtrail',
        region: context.region,
        title: 'CloudTrail is not enabled',
        description: 'No CloudTrail trails found in the account.',
        remediation: 'Enable CloudTrail with at least one multi-region trail.',
        complianceFrameworks: ['CIS AWS 2.4', 'SOC2 CC6.1'],
      });
    }
  } catch (error) {
    findings.push({
      checkId: 'cloudtrail-logs-unencrypted',
      severity: 'low',
      resourceId: context.accountId,
      resourceType: 'cloudtrail',
      region: context.region,
      title: 'Could not check CloudTrail encryption',
      description: `Failed to check CloudTrail: ${error instanceof Error ? error.message : 'Unknown error'}`,
      remediation: 'Verify IAM credentials have cloudtrail:DescribeTrails permission.',
    });
  }

  return findings;
}

/**
 * Check CloudTrail.3: Log file validation enabled
 */
export async function checkCloudTrailLogValidation(context: ScanContext): Promise<SecurityFinding[]> {
  const findings: SecurityFinding[] = [];

  try {
    const response = await cloudTrailRequest(context, 'DescribeTrails', {});
    const parsed = parser.parse(response);
    const trails = parsed?.DescribeTrailsResponse?.trails?.Trail || [];
    const trailsList = Array.isArray(trails) ? trails : trails ? [trails] : [];

    for (const trail of trailsList) {
      const trailArnRaw = trail?.TrailARN;
      const trailArn = typeof trailArnRaw === 'object' ? trailArnRaw?.['#text'] : trailArnRaw;
      const logValidationRaw = trail?.LogFileValidationEnabled;
      const logValidation = typeof logValidationRaw === 'object' ? logValidationRaw?.['#text'] : logValidationRaw;
      const homeRegionRaw = trail?.HomeRegion;
      const homeRegion = typeof homeRegionRaw === 'object' ? homeRegionRaw?.['#text'] : homeRegionRaw;

      if (homeRegion !== context.region && !trailArn?.includes(':*')) {
        continue;
      }

      if (logValidation !== true && logValidation !== 'true') {
        findings.push({
          checkId: 'cloudtrail-log-validation-disabled',
          severity: 'low',
          resourceId: trailArn || 'unknown',
          resourceType: 'cloudtrail-trail',
          region: context.region,
          title: 'CloudTrail log file validation disabled',
          description: `CloudTrail trail "${trailArn}" does not have log file validation enabled.`,
          remediation: 'Enable log file validation to detect tampering with CloudTrail logs.',
          complianceFrameworks: ['CIS AWS 2.4', 'SOC2 CC6.1'],
        });
      }
    }
  } catch (error) {
    findings.push({
      checkId: 'cloudtrail-log-validation-disabled',
      severity: 'low',
      resourceId: context.accountId,
      resourceType: 'cloudtrail',
      region: context.region,
      title: 'Could not check CloudTrail log validation',
      description: `Failed to check CloudTrail: ${error instanceof Error ? error.message : 'Unknown error'}`,
      remediation: 'Verify IAM credentials have cloudtrail:DescribeTrails permission.',
    });
  }

  return findings;
}

/**
 * Run all CloudTrail security checks
 */
export async function runCloudTrailChecks(context: ScanContext): Promise<SecurityFinding[]> {
  const allFindings = await Promise.all([
    checkCloudTrailMultiRegion(context),
    checkCloudTrailEncryption(context),
    checkCloudTrailLogValidation(context),
  ]);

  return allFindings.flat();
}
