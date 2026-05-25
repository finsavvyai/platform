/**
 * AWS Scanner Orchestrator
 *
 * Coordinates AWS security scans by assuming IAM role, running all check
 * modules concurrently, aggregating findings, and persisting results to D1.
 */

import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { cspmScanRuns, cspmFindings, cloudAccounts } from '@opensyber/db';
import { assumeRoleFromConfig } from './sts-client.js';
import type { ScanContext, SecurityFinding, CloudAccountConfig } from './types.js';
import { listS3Buckets, runS3Checks } from './checks/s3.js';
import { runIAMChecks } from './checks/iam.js';
import { runEC2Checks } from './checks/ec2.js';
import { runRDSChecks } from './checks/rds.js';
import { runCloudTrailChecks } from './checks/cloudtrail.js';
import { runGuardDutyChecks } from './checks/guardduty.js';
import { runLambdaChecks } from './checks/lambda.js';
import { runKMSChecks } from './checks/kms.js';
import { runVPCChecks } from './checks/vpc.js';
import {
  DEFAULT_REGION, FINDING_BATCH_SIZE,
  failedResult, extractAccountIdFromArn, countBySeverity,
} from './orchestrator-helpers.js';
import { discoverAfterCspmScan } from '../asset-discovery/hooks.js';

type Db = DrizzleD1Database<Record<string, unknown>>;

export interface AwsScanConfig {
  db: Db;
  cloudAccountId: string;
  orgId: string | null;
  roleArn: string;
  externalId?: string;
  region?: string;
  credentials?: { accessKeyId: string; secretAccessKey: string };
}

export interface AwsScanResult {
  scanRunId: string;
  status: 'running' | 'completed' | 'failed';
  findingCount: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  error?: string;
}

export async function runAwsScan(config: AwsScanConfig): Promise<AwsScanResult> {
  const { db, cloudAccountId, orgId, roleArn, externalId, region = DEFAULT_REGION, credentials } = config;

  if (!credentials?.accessKeyId || !credentials?.secretAccessKey) {
    return failedResult('Missing AWS credentials for STS AssumeRole');
  }

  const accountId = extractAccountIdFromArn(roleArn);
  if (!accountId) return failedResult('Invalid role ARN format');

  let tempCredentials: Awaited<ReturnType<typeof assumeRoleFromConfig>>['credentials'];
  try {
    const assumeResult = await assumeRoleFromConfig(
      { roleArn, externalId, region }, credentials.accessKeyId, credentials.secretAccessKey,
    );
    tempCredentials = assumeResult.credentials;
  } catch (error) {
    return failedResult(`STS AssumeRole failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  const scanRunId = crypto.randomUUID();
  const now = new Date().toISOString();

  try {
    await db.insert(cspmScanRuns).values({
      id: scanRunId, cloudAccountId, orgId, startedAt: now, status: 'running',
      findingCount: 0, criticalCount: 0, highCount: 0,
    });
    await db.update(cloudAccounts).set({ status: 'scanning' }).where(eq(cloudAccounts.id, cloudAccountId));
  } catch (error) {
    return failedResult(`Failed to create scan run: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  const scanContext: ScanContext = { accountId, region, credentials: tempCredentials, externalId };
  const allFindings = await runAllChecks(scanContext);
  const { criticalCount, highCount, mediumCount, lowCount } = countBySeverity(allFindings);

  try {
    if (allFindings.length > 0) {
      const findingRows = allFindings.map((finding) => ({
        id: crypto.randomUUID(), scanRunId, cloudAccountId, orgId: orgId ?? null,
        checkId: finding.checkId, severity: finding.severity, status: 'open' as const,
        resourceId: finding.resourceId, resourceType: finding.resourceType,
        region: finding.region, title: finding.title, description: finding.description,
        remediation: finding.remediation,
        complianceFrameworks: finding.complianceFrameworks ? JSON.stringify(finding.complianceFrameworks) : null,
        firstSeenAt: now,
      }));
      for (let i = 0; i < findingRows.length; i += FINDING_BATCH_SIZE) {
        await db.insert(cspmFindings).values(findingRows.slice(i, i + FINDING_BATCH_SIZE));
      }
    }

    await db.update(cspmScanRuns).set({
      status: 'completed', completedAt: now, findingCount: allFindings.length, criticalCount, highCount,
    }).where(eq(cspmScanRuns.id, scanRunId));
    await db.update(cloudAccounts).set({ lastScanAt: now, status: 'active' }).where(eq(cloudAccounts.id, cloudAccountId));

    // Trigger asset discovery from CSPM findings (non-blocking)
    if (orgId && allFindings.length > 0) {
      const findingRecords = allFindings.map((f) => ({
        checkId: f.checkId, severity: f.severity, resourceId: f.resourceId,
        resourceType: f.resourceType, region: f.region, title: f.title,
      }));
      discoverAfterCspmScan(db as any, orgId, findingRecords).catch(() => {});
    }

    return { scanRunId, status: 'completed', findingCount: allFindings.length, criticalCount, highCount, mediumCount, lowCount };
  } catch (error) {
    const errorMsg = `Failed to persist findings: ${error instanceof Error ? error.message : 'Unknown error'}`;
    await db.update(cspmScanRuns).set({ status: 'failed', completedAt: now }).where(eq(cspmScanRuns.id, scanRunId));
    await db.update(cloudAccounts).set({ status: 'error' }).where(eq(cloudAccounts.id, cloudAccountId));
    return { scanRunId, status: 'failed', findingCount: allFindings.length, criticalCount, highCount, mediumCount, lowCount, error: errorMsg };
  }
}

async function runAllChecks(scanContext: ScanContext): Promise<SecurityFinding[]> {
  let s3Findings: SecurityFinding[] = [];
  try {
    const buckets = await listS3Buckets(scanContext);
    const bucketBatches = buckets.slice(0, 50);
    const bucketCheckResults = await Promise.allSettled(bucketBatches.map((bucket) => runS3Checks(scanContext, bucket)));
    for (const result of bucketCheckResults) {
      if (result.status === 'fulfilled') s3Findings.push(...result.value);
    }
  } catch (error) {
    console.error('Failed to run S3 checks:', error);
  }

  const checkResults = await Promise.allSettled([
    Promise.resolve(s3Findings), runIAMChecks(scanContext), runEC2Checks(scanContext),
    runRDSChecks(scanContext), runCloudTrailChecks(scanContext), runGuardDutyChecks(scanContext),
    runLambdaChecks(scanContext), runKMSChecks(scanContext), runVPCChecks(scanContext),
  ]);

  const allFindings: SecurityFinding[] = [];
  for (const result of checkResults) {
    if (result.status === 'fulfilled') allFindings.push(...result.value);
    else console.error('Check module failed:', result.reason);
  }
  return allFindings;
}

export function validateAwsConfig(config: CloudAccountConfig): { valid: boolean; error?: string } {
  if (!config.roleArn) return { valid: false, error: 'Missing roleArn' };
  const accountId = extractAccountIdFromArn(config.roleArn);
  if (!accountId) return { valid: false, error: 'Invalid roleArn format' };
  return { valid: true };
}
