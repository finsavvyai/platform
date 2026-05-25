/**
 * GCP Scanner Orchestrator
 *
 * Coordinates GCP security scans by authenticating with a service account,
 * running IAM and GCS checks concurrently, and returning aggregated findings.
 */

import type { SecurityFinding } from '../aws-scanner/types.js';
import { getGcpAccessToken } from './gcp-auth.js';
import { runGcpIamChecks } from './checks/iam.js';
import { runGcpGcsChecks } from './checks/gcs.js';

export interface GcpScanConfig {
  serviceAccountKey: string;
  projectId: string;
}

export interface GcpScanResult {
  status: 'completed' | 'failed';
  findings: SecurityFinding[];
  findingCount: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  error?: string;
}

/**
 * Run a full GCP security scan for a project
 */
export async function runGcpScan(config: GcpScanConfig): Promise<GcpScanResult> {
  const { serviceAccountKey, projectId } = config;

  if (!serviceAccountKey || !projectId) {
    return failedGcpResult('Missing serviceAccountKey or projectId');
  }

  let accessToken: string;
  try {
    accessToken = await getGcpAccessToken(serviceAccountKey);
  } catch (error) {
    return failedGcpResult(
      `GCP authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }

  const checkResults = await Promise.allSettled([
    runGcpIamChecks(accessToken, projectId),
    runGcpGcsChecks(accessToken, projectId),
  ]);

  const allFindings: SecurityFinding[] = [];
  for (const result of checkResults) {
    if (result.status === 'fulfilled') {
      allFindings.push(...result.value);
    } else {
      console.error('GCP check module failed:', result.reason);
    }
  }

  const { criticalCount, highCount, mediumCount, lowCount } =
    countBySeverity(allFindings);

  return {
    status: 'completed',
    findings: allFindings,
    findingCount: allFindings.length,
    criticalCount,
    highCount,
    mediumCount,
    lowCount,
  };
}

function failedGcpResult(error: string): GcpScanResult {
  return {
    status: 'failed',
    findings: [],
    findingCount: 0,
    criticalCount: 0,
    highCount: 0,
    mediumCount: 0,
    lowCount: 0,
    error,
  };
}

function countBySeverity(findings: SecurityFinding[]): {
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
} {
  let criticalCount = 0, highCount = 0, mediumCount = 0, lowCount = 0;
  for (const f of findings) {
    if (f.severity === 'critical') criticalCount++;
    else if (f.severity === 'high') highCount++;
    else if (f.severity === 'medium') mediumCount++;
    else if (f.severity === 'low') lowCount++;
  }
  return { criticalCount, highCount, mediumCount, lowCount };
}
