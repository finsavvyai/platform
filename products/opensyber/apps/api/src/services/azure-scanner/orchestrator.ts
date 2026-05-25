/**
 * Azure Scanner Orchestrator
 *
 * Coordinates Azure security scans by authenticating with a service principal,
 * running RBAC and Storage checks concurrently, and returning aggregated findings.
 */

import type { SecurityFinding } from '../aws-scanner/types.js';
import { getAzureAccessToken } from './azure-auth.js';
import { runAzureRbacChecks } from './checks/rbac.js';
import { runAzureStorageChecks } from './checks/storage.js';

export interface AzureScanConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  subscriptionId: string;
}

export interface AzureScanResult {
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
 * Run a full Azure security scan for a subscription
 */
export async function runAzureScan(config: AzureScanConfig): Promise<AzureScanResult> {
  const { tenantId, clientId, clientSecret, subscriptionId } = config;

  if (!tenantId || !clientId || !clientSecret || !subscriptionId) {
    return failedAzureResult('Missing Azure credentials or subscriptionId');
  }

  let accessToken: string;
  try {
    accessToken = await getAzureAccessToken(tenantId, clientId, clientSecret);
  } catch (error) {
    return failedAzureResult(
      `Azure authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }

  const checkResults = await Promise.allSettled([
    runAzureRbacChecks(accessToken, subscriptionId),
    runAzureStorageChecks(accessToken, subscriptionId),
  ]);

  const allFindings: SecurityFinding[] = [];
  for (const result of checkResults) {
    if (result.status === 'fulfilled') {
      allFindings.push(...result.value);
    } else {
      console.error('Azure check module failed:', result.reason);
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

function failedAzureResult(error: string): AzureScanResult {
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
