/**
 * RDS Security Checks
 *
 * Security checks for Amazon RDS using fetch API.
 * Checks for encryption, public accessibility, and backup retention.
 *
 * Based on CIS AWS Foundations Benchmark and Prowler best practices.
 */

import { XMLParser } from 'fast-xml-parser';
import type { ScanContext, SecurityFinding } from '../types.js';
import { rdsRequest } from './rds-request.js';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  textNodeName: '#text',
});

function parseInstances(response: string) {
  const parsed = parser.parse(response);
  const instances = parsed?.DescribeDBInstancesResponse?.DBInstances?.DBInstance || [];
  return Array.isArray(instances) ? instances : instances ? [instances] : [];
}

function extractField(instance: any, field: string): unknown {
  const raw = instance?.[field];
  return typeof raw === 'object' ? raw?.['#text'] : raw;
}

/**
 * Check RDS.1: Unencrypted RDS instances
 */
export async function checkRDSEncryption(context: ScanContext): Promise<SecurityFinding[]> {
  const findings: SecurityFinding[] = [];
  try {
    const response = await rdsRequest(context, 'DescribeDBInstances', {});
    for (const instance of parseInstances(response)) {
      const instanceId = extractField(instance, 'DBInstanceIdentifier') as string;
      const encrypted = extractField(instance, 'StorageEncrypted');
      if (encrypted !== true && encrypted !== 'true') {
        findings.push({
          checkId: 'rds-instance-unencrypted', severity: 'high',
          resourceId: instanceId || 'unknown', resourceType: 'rds-instance', region: context.region,
          title: 'RDS instance is not encrypted',
          description: `RDS instance "${instanceId}" has storage encryption disabled.`,
          remediation: 'Enable encryption at rest for RDS instances. Use AWS KMS customer-managed keys.',
          complianceFrameworks: ['CIS AWS 2.8', 'SOC2 CC6.1'],
        });
      }
    }
  } catch (error) {
    findings.push({
      checkId: 'rds-instance-unencrypted', severity: 'low',
      resourceId: context.accountId, resourceType: 'rds-account', region: context.region,
      title: 'Could not check RDS encryption',
      description: `Failed to check RDS: ${error instanceof Error ? error.message : 'Unknown error'}`,
      remediation: 'Verify IAM credentials have rds:DescribeDBInstances permission.',
    });
  }
  return findings;
}

/**
 * Check RDS.2: Publicly accessible RDS instances
 */
export async function checkRDSPublicAccess(context: ScanContext): Promise<SecurityFinding[]> {
  const findings: SecurityFinding[] = [];
  try {
    const response = await rdsRequest(context, 'DescribeDBInstances', {});
    for (const instance of parseInstances(response)) {
      const instanceId = extractField(instance, 'DBInstanceIdentifier') as string;
      const isPublic = extractField(instance, 'PubliclyAccessible');
      if (isPublic === true || isPublic === 'true') {
        findings.push({
          checkId: 'rds-instance-public', severity: 'critical',
          resourceId: instanceId || 'unknown', resourceType: 'rds-instance', region: context.region,
          title: 'RDS instance is publicly accessible',
          description: `RDS instance "${instanceId}" is configured to be publicly accessible from the internet.`,
          remediation: 'Disable public accessibility. Use VPC security groups and VPN for database access.',
          complianceFrameworks: ['CIS AWS 2.9', 'SOC2 CC6.6'],
        });
      }
    }
  } catch (error) {
    findings.push({
      checkId: 'rds-instance-public', severity: 'low',
      resourceId: context.accountId, resourceType: 'rds-account', region: context.region,
      title: 'Could not check RDS public access',
      description: `Failed to check RDS: ${error instanceof Error ? error.message : 'Unknown error'}`,
      remediation: 'Verify IAM credentials have rds:DescribeDBInstances permission.',
    });
  }
  return findings;
}

/**
 * Check RDS.3: Automated backup retention < 7 days
 */
export async function checkRDSBackupRetention(context: ScanContext): Promise<SecurityFinding[]> {
  const findings: SecurityFinding[] = [];
  try {
    const response = await rdsRequest(context, 'DescribeDBInstances', {});
    for (const instance of parseInstances(response)) {
      const instanceId = extractField(instance, 'DBInstanceIdentifier') as string;
      const retention = extractField(instance, 'BackupRetentionPeriod');
      const retentionDays = typeof retention === 'number' ? retention : parseInt(String(retention || '0'), 10);
      if (retentionDays < 7) {
        findings.push({
          checkId: 'rds-backup-retention-low', severity: 'medium',
          resourceId: instanceId || 'unknown', resourceType: 'rds-instance', region: context.region,
          title: 'RDS backup retention less than 7 days',
          description: `RDS instance "${instanceId}" has automated backup retention of ${retentionDays} day(s).`,
          remediation: 'Increase automated backup retention to at least 7 days.',
          complianceFrameworks: ['SOC2 CC6.7'],
        });
      }
    }
  } catch (error) {
    findings.push({
      checkId: 'rds-backup-retention-low', severity: 'low',
      resourceId: context.accountId, resourceType: 'rds-account', region: context.region,
      title: 'Could not check RDS backup settings',
      description: `Failed to check RDS: ${error instanceof Error ? error.message : 'Unknown error'}`,
      remediation: 'Verify IAM credentials have rds:DescribeDBInstances permission.',
    });
  }
  return findings;
}

/**
 * Run all RDS security checks
 */
export async function runRDSChecks(context: ScanContext): Promise<SecurityFinding[]> {
  const allFindings = await Promise.all([
    checkRDSEncryption(context),
    checkRDSPublicAccess(context),
    checkRDSBackupRetention(context),
  ]);
  return allFindings.flat();
}
