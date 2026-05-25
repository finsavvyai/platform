/**
 * CSPM scanner service
 *
 * Dispatches cloud security scans based on provider:
 * - AWS: Delegates to AWS scanner orchestrator (real STS AssumeRole checks)
 * - GCP: Delegates to GCP scanner orchestrator (service account auth)
 * - Azure: Delegates to Azure scanner orchestrator (client credentials auth)
 */

import { runAwsScan, type AwsScanConfig } from './aws-scanner/orchestrator.js';
import { runGcpScan } from './gcp-scanner/orchestrator.js';
import { runAzureScan } from './azure-scanner/orchestrator.js';
import type {
  CloudAccountRecord, ScanResult, StoredCredentials,
  GcpStoredCredentials, AzureStoredCredentials,
} from './cspm-scanner-types.js';
import { failedScanResult, decryptCredentials } from './cspm-scanner-types.js';
import { countBySeverity } from './aws-scanner/orchestrator-helpers.js';
import type { DrizzleD1Database } from 'drizzle-orm/d1';

type Db = DrizzleD1Database<Record<string, unknown>>;

// Re-export for backward compatibility
export type { CloudAccountRecord, ScanResult } from './cspm-scanner-types.js';

/**
 * Run CSPM scan for a cloud account
 */
export async function runCspmScan(
  db: Db,
  cloudAccountId: string,
  orgId: string | null,
  account: CloudAccountRecord,
  encryptionKey?: string,
): Promise<ScanResult> {
  switch (account.provider) {
    case 'aws':
      return runAwsAccountScan(db, cloudAccountId, orgId, account, encryptionKey);
    case 'gcp':
      return runGcpAccountScan(account, encryptionKey);
    case 'azure':
      return runAzureAccountScan(account, encryptionKey);
    default:
      return failedScanResult(`Unknown provider: ${account.provider}`);
  }
}

/**
 * Run AWS security scan
 */
async function runAwsAccountScan(
  db: Db, cloudAccountId: string, orgId: string | null,
  account: CloudAccountRecord, encryptionKey?: string,
): Promise<ScanResult> {
  if (!account.roleArn) {
    return failedScanResult('AWS account missing roleArn. Please configure IAM role ARN.');
  }

  let awsCredentials: StoredCredentials | null = null;
  if (account.credentials) {
    try {
      if (!encryptionKey) return failedScanResult('Missing encryption key for credential decryption');
      const decrypted = await decryptCredentials(account.credentials, encryptionKey);
      awsCredentials = JSON.parse(decrypted) as StoredCredentials;
    } catch {
      return failedScanResult('Failed to decrypt AWS credentials');
    }
  }

  if (!awsCredentials?.accessKeyId || !awsCredentials?.secretAccessKey) {
    return failedScanResult('AWS account missing credentials.');
  }

  const config: AwsScanConfig = {
    db, cloudAccountId, orgId,
    roleArn: account.roleArn,
    externalId: account.externalId ?? undefined,
    credentials: { accessKeyId: awsCredentials.accessKeyId, secretAccessKey: awsCredentials.secretAccessKey },
  };

  const result = await runAwsScan(config);
  return {
    scanRun: {
      id: result.scanRunId, status: result.status,
      findingCount: result.findingCount, criticalCount: result.criticalCount,
      highCount: result.highCount, mediumCount: result.mediumCount, lowCount: result.lowCount,
    },
    error: result.error,
  };
}

/**
 * Run GCP security scan
 */
async function runGcpAccountScan(
  account: CloudAccountRecord,
  encryptionKey?: string,
): Promise<ScanResult> {
  if (!account.credentials) {
    return failedScanResult('GCP account missing credentials. Please configure service account key.');
  }
  if (!encryptionKey) return failedScanResult('Missing encryption key for credential decryption');

  let gcpCredentials: GcpStoredCredentials;
  try {
    const decrypted = await decryptCredentials(account.credentials, encryptionKey);
    gcpCredentials = JSON.parse(decrypted) as GcpStoredCredentials;
  } catch {
    return failedScanResult('Failed to decrypt GCP credentials');
  }

  if (!gcpCredentials.serviceAccountKey) {
    return failedScanResult('GCP account missing serviceAccountKey in credentials.');
  }

  const projectId = account.externalId;
  if (!projectId) return failedScanResult('GCP account missing project ID (externalId).');

  const result = await runGcpScan({ serviceAccountKey: gcpCredentials.serviceAccountKey, projectId });

  return {
    scanRun: {
      id: crypto.randomUUID(), status: result.status,
      findingCount: result.findingCount, criticalCount: result.criticalCount,
      highCount: result.highCount, mediumCount: result.mediumCount, lowCount: result.lowCount,
    },
    error: result.error,
  };
}

/**
 * Run Azure security scan
 */
async function runAzureAccountScan(
  account: CloudAccountRecord,
  encryptionKey?: string,
): Promise<ScanResult> {
  if (!account.credentials) {
    return failedScanResult('Azure account missing credentials. Please configure service principal.');
  }
  if (!encryptionKey) return failedScanResult('Missing encryption key for credential decryption');

  let azureCredentials: AzureStoredCredentials;
  try {
    const decrypted = await decryptCredentials(account.credentials, encryptionKey);
    azureCredentials = JSON.parse(decrypted) as AzureStoredCredentials;
  } catch {
    return failedScanResult('Failed to decrypt Azure credentials');
  }

  if (!azureCredentials.tenantId || !azureCredentials.clientId || !azureCredentials.clientSecret) {
    return failedScanResult('Azure account missing tenantId, clientId, or clientSecret in credentials.');
  }

  const subscriptionId = azureCredentials.subscriptionId || account.externalId;
  if (!subscriptionId) return failedScanResult('Azure account missing subscription ID.');

  const result = await runAzureScan({
    tenantId: azureCredentials.tenantId, clientId: azureCredentials.clientId,
    clientSecret: azureCredentials.clientSecret, subscriptionId,
  });

  return {
    scanRun: {
      id: crypto.randomUUID(), status: result.status,
      findingCount: result.findingCount, criticalCount: result.criticalCount,
      highCount: result.highCount, mediumCount: result.mediumCount, lowCount: result.lowCount,
    },
    error: result.error,
  };
}
